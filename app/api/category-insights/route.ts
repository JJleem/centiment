import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { SUPERCENT_GAMES } from "@/lib/presets";
import { buildCategoryInsightPrompt } from "@/lib/prompts/analyze";
import type { Platform, ReviewCategory } from "@/types";

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  gameplay: "게임플레이", ui: "UI/UX", performance: "성능",
  monetization: "결제/광고", content: "콘텐츠", bug: "버그", other: "기타",
};
const TARGET_CATEGORIES: ReviewCategory[] = ["bug", "monetization", "gameplay", "performance", "ui", "content"];

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export interface CategoryInsight {
  category: ReviewCategory;
  label: string;
  count: number;
  insight: string;
}

async function generateAndSave(appId: string, platform: Platform): Promise<CategoryInsight[]> {
  const supabase = getSupabase();

  const [{ data: analyses }, { data: reviews }] = await Promise.all([
    supabase
      .from("review_analysis")
      .select("category")
      .eq("app_id", appId)
      .eq("platform", platform)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("content")
      .eq("app_id", appId)
      .eq("platform", platform)
      .order("review_date", { ascending: false }),
  ]);

  if (!analyses || analyses.length === 0) return [];

  const categoryContents: Partial<Record<ReviewCategory, string[]>> = {};
  analyses.forEach((row, i) => {
    const cat = row.category as ReviewCategory;
    if (!categoryContents[cat]) categoryContents[cat] = [];
    const content = (reviews ?? [])[i]?.content;
    if (content) categoryContents[cat]!.push(content);
  });

  const topCats = TARGET_CATEGORIES
    .filter((c) => (categoryContents[c]?.length ?? 0) >= 3)
    .sort((a, b) => (categoryContents[b]?.length ?? 0) - (categoryContents[a]?.length ?? 0))
    .slice(0, 3);

  if (topCats.length === 0) return [];

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const insights: CategoryInsight[] = await Promise.all(
    topCats.map(async (cat) => {
      const contents = categoryContents[cat] ?? [];
      const res = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: buildCategoryInsightPrompt(CATEGORY_LABEL[cat], contents) }],
      });
      console.log(`[category-insights][haiku] ${cat} input:${res.usage.input_tokens} output:${res.usage.output_tokens}`);
      const insight = res.content[0].type === "text" ? res.content[0].text.trim() : "";
      return { category: cat, label: CATEGORY_LABEL[cat], count: contents.length, insight };
    })
  );

  // 기존 삭제 후 새로 저장
  await supabaseAdmin
    .from("category_insights")
    .delete()
    .eq("app_id", appId)
    .eq("platform", platform);

  await supabaseAdmin.from("category_insights").insert(
    insights.map((item) => ({
      app_id: appId,
      platform,
      category: item.category,
      label: item.label,
      count: item.count,
      insight: item.insight,
    }))
  );

  return insights;
}

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("game");
  const platform = req.nextUrl.searchParams.get("platform") as Platform | null;
  const force = req.nextUrl.searchParams.get("force") === "true";
  if (!gameId || !platform) return NextResponse.json({ insights: [] });

  const game = SUPERCENT_GAMES.find((g) => g.id === gameId);
  if (!game) return NextResponse.json({ insights: [] });

  const appId = platform === "ios" ? game.ios_app_id : game.android_package;

  // force가 아니면 DB에서 먼저 조회
  if (!force) {
    const { data } = await supabaseAdmin
      .from("category_insights")
      .select("category, label, count, insight")
      .eq("app_id", appId)
      .eq("platform", platform)
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      return NextResponse.json({ insights: data as CategoryInsight[], cached: true });
    }
  }

  // 없거나 force면 생성
  const insights = await generateAndSave(appId, platform);
  return NextResponse.json({ insights });
}
