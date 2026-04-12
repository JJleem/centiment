import { NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export interface HistoryItem {
  app_id: string;
  platform: string;
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  summary: string;
  analyzed_at: string;
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("review_analysis")
      .select("app_id, platform, sentiment, summary, created_at");

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      return NextResponse.json({ history: [] });
    }

    const map = new Map<string, HistoryItem>();

    for (const row of data) {
      const key = `${row.app_id}__${row.platform}`;
      if (!map.has(key)) {
        map.set(key, {
          app_id: row.app_id,
          platform: row.platform,
          total: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          summary: row.summary,
          analyzed_at: row.created_at,
        });
      }
      const item = map.get(key)!;
      item.total++;
      if (row.sentiment === "positive") item.positive++;
      else if (row.sentiment === "negative") item.negative++;
      else item.neutral++;
      if (row.created_at > item.analyzed_at) {
        item.analyzed_at = row.created_at;
        item.summary = row.summary;
      }
    }

    const history = Array.from(map.values()).sort(
      (a, b) => new Date(b.analyzed_at).getTime() - new Date(a.analyzed_at).getTime()
    );

    return NextResponse.json({ history });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
