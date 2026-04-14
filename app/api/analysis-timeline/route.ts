import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { SUPERCENT_GAMES } from "@/lib/presets";

export interface TimelineEntry {
  date: string; // "YYYY-MM-DD"
  ios: { total: number; positive: number; negative: number; neutral: number } | null;
  android: { total: number; positive: number; negative: number; neutral: number } | null;
}

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("g");
  if (!gameId) return NextResponse.json({ timeline: [] });

  const game = SUPERCENT_GAMES.find((g) => g.id === gameId);
  if (!game) return NextResponse.json({ timeline: [] });

  const { data, error } = await supabaseAdmin
    .from("review_analysis")
    .select("app_id, platform, sentiment, created_at")
    .in("app_id", [game.ios_app_id, game.android_package])
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return NextResponse.json({ timeline: [] });

  // 날짜(일) × 플랫폼 집계
  type Counts = { total: number; positive: number; negative: number; neutral: number };
  const map = new Map<string, { ios: Counts | null; android: Counts | null }>();

  for (const row of data) {
    const date = (row.created_at as string).slice(0, 10);
    if (!map.has(date)) map.set(date, { ios: null, android: null });
    const entry = map.get(date)!;
    const platform: "ios" | "android" =
      row.app_id === game.ios_app_id ? "ios" : "android";
    if (!entry[platform]) entry[platform] = { total: 0, positive: 0, negative: 0, neutral: 0 };
    const p = entry[platform]!;
    p.total++;
    if (row.sentiment === "positive") p.positive++;
    else if (row.sentiment === "negative") p.negative++;
    else p.neutral++;
  }

  const timeline: TimelineEntry[] = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  return NextResponse.json({ timeline });
}
