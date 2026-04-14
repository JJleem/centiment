import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { SUPERCENT_GAMES } from "@/lib/presets";
import type { Platform } from "@/types";

const LANG_META: Record<string, { label: string; flag: string }> = {
  en: { label: "미국",  flag: "🇺🇸" },
  ko: { label: "한국",  flag: "🇰🇷" },
  ja: { label: "일본",  flag: "🇯🇵" },
  de: { label: "독일",  flag: "🇩🇪" },
};

export interface LangSentimentItem {
  lang: string;
  label: string;
  flag: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  positive_rate: number;
}

export async function GET(req: NextRequest) {
  const gameId = req.nextUrl.searchParams.get("game");
  const platform = req.nextUrl.searchParams.get("platform") as Platform | null;
  if (!gameId || !platform) return NextResponse.json({ items: [] });

  const game = SUPERCENT_GAMES.find((g) => g.id === gameId);
  if (!game) return NextResponse.json({ items: [] });

  const appId = platform === "ios" ? game.ios_app_id : game.android_package;

  const { data, error } = await supabaseAdmin
    .from("review_analysis")
    .select("lang, sentiment")
    .eq("app_id", appId)
    .eq("platform", platform)
    .not("lang", "is", null);

  if (error || !data || data.length === 0) return NextResponse.json({ items: [] });

  // lang별 집계
  const map = new Map<string, { positive: number; negative: number; neutral: number; total: number }>();
  for (const row of data) {
    const lang = row.lang as string;
    if (!map.has(lang)) map.set(lang, { positive: 0, negative: 0, neutral: 0, total: 0 });
    const item = map.get(lang)!;
    item.total++;
    if (row.sentiment === "positive") item.positive++;
    else if (row.sentiment === "negative") item.negative++;
    else item.neutral++;
  }

  const items: LangSentimentItem[] = [...map.entries()]
    .map(([lang, counts]) => ({
      lang,
      label: LANG_META[lang]?.label ?? lang,
      flag: LANG_META[lang]?.flag ?? "🌐",
      ...counts,
      positive_rate: counts.total > 0 ? Math.round((counts.positive / counts.total) * 100) : 0,
    }))
    .sort((a, b) => b.positive_rate - a.positive_rate);

  return NextResponse.json({ items });
}
