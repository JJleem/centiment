import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase";
import { SUPERCENT_GAMES } from "@/lib/presets";
import { buildCrossComparePrompt } from "@/lib/prompts/analyze";
import type { Sentiment, ReviewCategory } from "@/types";

interface AnalysisRow {
  sentiment: Sentiment;
  category: ReviewCategory;
  keywords: string[];
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function fetchStats(appIds: string[]) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("review_analysis")
    .select("sentiment, category, keywords")
    .in("app_id", appIds);
  if (error || !data || data.length === 0) return null;
  const rows = data as AnalysisRow[];
  const sentimentCount = { positive: 0, negative: 0, neutral: 0 } as Record<Sentiment, number>;
  for (const r of rows) sentimentCount[r.sentiment]++;
  const categoryCount: Record<string, number> = {};
  for (const r of rows) categoryCount[r.category] = (categoryCount[r.category] ?? 0) + 1;
  const kwFreq: Record<string, number> = {};
  for (const r of rows) for (const kw of r.keywords) kwFreq[kw] = (kwFreq[kw] ?? 0) + 1;
  const topKeywords = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  const topCategories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c);
  return { total: rows.length, sentimentCount, topCategories, topKeywords };
}

export async function POST(req: NextRequest) {
  const { g1, g2, g3 } = await req.json() as { g1: string; g2: string; g3?: string };

  const gameIds = [g1, g2, ...(g3 ? [g3] : [])];
  const games = gameIds.map((id) => SUPERCENT_GAMES.find((g) => g.id === id)).filter(Boolean);
  if (games.length < 2) return NextResponse.json({ error: "game not found" }, { status: 400 });

  const statsList = await Promise.all(
    games.map((g) => fetchStats([g!.ios_app_id, g!.android_package]))
  );
  if (statsList.some((s) => !s)) return NextResponse.json({ error: "no data" }, { status: 400 });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{
      role: "user",
      content: buildCrossComparePrompt(
        statsList.map((s, i) => ({
          name: games[i]!.name,
          total: s!.total,
          positive: s!.sentimentCount.positive,
          negative: s!.sentimentCount.negative,
          topCategories: s!.topCategories,
          topKeywords: s!.topKeywords,
        }))
      ),
    }],
  });
  console.log(`[cross-insight][sonnet] input:${res.usage.input_tokens} output:${res.usage.output_tokens}`);
  const insight = res.content[0].type === "text" ? res.content[0].text.trim() : "";

  // 2게임일 때만 히스토리 저장
  if (!g3) {
    await supabaseAdmin.from("cross_comparison_history").insert({
      game1_id: g1, game2_id: g2,
      game1_name: games[0]!.name, game2_name: games[1]!.name,
      insight,
    });
  }

  return NextResponse.json({ insight });
}
