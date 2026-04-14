import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export interface CrossHistoryItem {
  id: string;
  game1_id: string;
  game2_id: string;
  game1_name: string;
  game2_name: string;
  insight: string;
  created_at: string;
}

export async function GET() {
  const { data } = await supabaseAdmin
    .from("cross_comparison_history")
    .select("id, game1_id, game2_id, game1_name, game2_name, insight, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ history: data ?? [] });
}
