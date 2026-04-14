import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SUPERCENT_GAMES } from "@/lib/presets";
import { buildCategoryInsightPrompt } from "@/lib/prompts/analyze";
import type { Platform, Sentiment, ReviewCategory } from "@/types";

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  gameplay: "게임플레이", ui: "UI/UX", performance: "성능",
  monetization: "결제/광고", content: "콘텐츠", bug: "버그", other: "기타",
};

// 인사이트 생성 대상 카테고리 (other 제외)
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

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("game");
  const platform = req.nextUrl.searchParams.get("platform") as Platform | null;
  if (!gameId || !platform) return NextResponse.json({ insights: [] });

  const game = SUPERCENT_GAMES.find((g) => g.id === gameId);
  if (!game) return NextResponse.json({ insights: [] });

  const appId = platform === "ios" ? game.ios_app_id : game.android_package;
  const supabase = getSupabase();

  // review_analysis + reviews 페어링 (result page와 동일한 방식)
  const [{ data: analyses }, { data: reviews }] = await Promise.all([
    supabase
      .from("review_analysis")
      .select("sentiment, category, keywords")
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

  if (!analyses || analyses.length === 0) return NextResponse.json({ insights: [] });

  // 카테고리별 리뷰 내용 그룹핑
  const categoryContents: Partial<Record<ReviewCategory, string[]>> = {};
  analyses.forEach((row, i) => {
    const cat = row.category as ReviewCategory;
    if (!categoryContents[cat]) categoryContents[cat] = [];
    const content = (reviews ?? [])[i]?.content;
    if (content) categoryContents[cat]!.push(content);
  });

  // 건수 기준 상위 카테고리 (최대 3개, other 제외)
  const topCats = TARGET_CATEGORIES
    .filter((c) => (categoryContents[c]?.length ?? 0) >= 3)
    .sort((a, b) => (categoryContents[b]?.length ?? 0) - (categoryContents[a]?.length ?? 0))
    .slice(0, 3);

  if (topCats.length === 0) return NextResponse.json({ insights: [] });

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

  return NextResponse.json({ insights });
}
