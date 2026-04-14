import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { SUPERCENT_GAMES } from "@/lib/presets";

export interface WeeklyGameSummary {
  game_id: string;
  game_name: string;
  icon_url: string;
  total: number;
  positive_rate: number;
}

export async function GET() {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("review_analysis")
    .select("app_id, sentiment")
    .gte("created_at", oneWeekAgo);

  if (error || !data || data.length === 0) {
    return NextResponse.json({ top: [], bottom: [] });
  }

  // app_id별 집계
  const map = new Map<string, { positive: number; total: number }>();
  for (const row of data) {
    if (!map.has(row.app_id)) map.set(row.app_id, { positive: 0, total: 0 });
    const item = map.get(row.app_id)!;
    item.total++;
    if (row.sentiment === "positive") item.positive++;
  }

  // 게임별로 iOS + Android 합산
  const results: WeeklyGameSummary[] = [];
  for (const game of SUPERCENT_GAMES) {
    const ios = map.get(game.ios_app_id);
    const android = map.get(game.android_package);
    const total = (ios?.total ?? 0) + (android?.total ?? 0);
    const positive = (ios?.positive ?? 0) + (android?.positive ?? 0);
    if (total < 10) continue; // 샘플 너무 적으면 제외
    results.push({
      game_id: game.id,
      game_name: game.name,
      icon_url: game.icon_url,
      total,
      positive_rate: Math.round((positive / total) * 100),
    });
  }

  results.sort((a, b) => b.positive_rate - a.positive_rate);

  return NextResponse.json({
    top: results.slice(0, 3),
    bottom: results.slice(-3).reverse(),
  });
}
