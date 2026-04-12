import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { buildClassifyPrompt, buildSummaryPrompt } from "@/lib/prompts/analyze";
import type {
  AnalyzeReviewsRequest,
  AnalyzeReviewsResponse,
  Platform,
  ReviewPayload,
  Sentiment,
  ReviewCategory,
} from "@/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 20;

// ─── Usage 누산기 ─────────────────────────────────────────────────────────────
interface UsageAcc {
  haiku: { input_tokens: number; output_tokens: number };
  sonnet: { input_tokens: number; output_tokens: number };
}

// ─── Haiku: 배치 분류 ─────────────────────────────────────────────────────────
interface ClassifyResult {
  sentiment: Sentiment;
  category: ReviewCategory;
  keywords: string[];
}

async function classifyBatch(
  batch: ReviewPayload[],
  usage: UsageAcc
): Promise<ClassifyResult[]> {
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 4096,
    messages: [{ role: "user", content: buildClassifyPrompt(batch) }],
  });

  // usage 로그
  console.log(
    `[analyze][haiku] input:${res.usage.input_tokens} output:${res.usage.output_tokens}`
  );
  usage.haiku.input_tokens += res.usage.input_tokens;
  usage.haiku.output_tokens += res.usage.output_tokens;

  const raw = res.content[0].type === "text" ? res.content[0].text : "[]";
  // 마크다운 코드블록 제거
  const text = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    const parsed = JSON.parse(text) as ClassifyResult[];
    if (parsed.length !== batch.length) {
      console.warn(`[analyze][haiku] count mismatch: expected ${batch.length}, got ${parsed.length}`);
    }
    return parsed;
  } catch {
    console.error("[analyze][haiku] JSON parse failed:", text.slice(0, 300));
    return batch.map(() => ({ sentiment: "neutral", category: "other", keywords: [] }));
  }
}

// ─── Sonnet: 전체 요약 ────────────────────────────────────────────────────────
async function summarize(
  classified: ClassifyResult[],
  usage: UsageAcc
): Promise<string> {
  const total = classified.length;
  const positive = classified.filter((r) => r.sentiment === "positive").length;
  const negative = classified.filter((r) => r.sentiment === "negative").length;
  const neutral = total - positive - negative;

  // 키워드 빈도 집계
  const kwFreq: Record<string, number> = {};
  for (const r of classified) {
    for (const kw of r.keywords) {
      kwFreq[kw] = (kwFreq[kw] ?? 0) + 1;
    }
  }
  const topKeywords = Object.entries(kwFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw);

  // 카테고리 집계
  const categoryCounts: Record<string, number> = {};
  for (const r of classified) {
    categoryCounts[r.category] = (categoryCounts[r.category] ?? 0) + 1;
  }

  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: buildSummaryPrompt({ total, positive, negative, neutral, topKeywords, categoryCounts }),
      },
    ],
  });

  console.log(
    `[analyze][sonnet] input:${res.usage.input_tokens} output:${res.usage.output_tokens}`
  );
  usage.sonnet.input_tokens += res.usage.input_tokens;
  usage.sonnet.output_tokens += res.usage.output_tokens;

  return res.content[0].type === "text" ? res.content[0].text.trim() : "";
}

// ─── DB 저장 ──────────────────────────────────────────────────────────────────
interface ReviewRow {
  id: string;
  app_id: string;
  platform: Platform;
  version: string | null;
  content: string;
  rating: number;
}

async function saveAnalysis(
  rows: ReviewRow[],
  classified: ClassifyResult[],
  summary: string
) {
  const records = rows.map((row, i) => ({
    app_id: row.app_id,
    platform: row.platform,
    version: row.version,
    sentiment: classified[i].sentiment,
    category: classified[i].category,
    keywords: classified[i].keywords,
    summary,
  }));

  const { error } = await supabase.from("review_analysis").insert(records);
  if (error) throw new Error(`Supabase insert error: ${error.message}`);
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeReviewsRequest;
    const { app_id, platform } = body;

    if (!app_id || !platform) {
      return NextResponse.json({ error: "app_id and platform are required" }, { status: 400 });
    }

    // 리뷰 전체 조회
    const { data: reviews, error: fetchErr } = await supabase
      .from("reviews")
      .select("id, app_id, platform, version, content, rating")
      .eq("app_id", app_id)
      .eq("platform", platform);

    if (fetchErr) throw new Error(`Supabase fetch error: ${fetchErr.message}`);

    // 기존 분석 결과 삭제 (재분석)
    await supabase
      .from("review_analysis")
      .delete()
      .eq("app_id", app_id)
      .eq("platform", platform);
    if (!reviews || reviews.length === 0) {
      return NextResponse.json({ analyzed: 0, usage: { haiku: { input_tokens: 0, output_tokens: 0 }, sonnet: { input_tokens: 0, output_tokens: 0 } } } satisfies AnalyzeReviewsResponse);
    }

    const usage: UsageAcc = {
      haiku: { input_tokens: 0, output_tokens: 0 },
      sonnet: { input_tokens: 0, output_tokens: 0 },
    };

    // 배치 단위 Haiku 분류
    const allClassified: ClassifyResult[] = [];
    for (let i = 0; i < reviews.length; i += BATCH_SIZE) {
      const batchRows = reviews.slice(i, i + BATCH_SIZE) as ReviewRow[];
      const payloads: ReviewPayload[] = batchRows.map((r) => ({
        content: r.content,
        rating: r.rating,
        version: r.version,
      }));
      const results = await classifyBatch(payloads, usage);
      allClassified.push(...results);
    }

    // Sonnet 요약 (1회)
    const summary = await summarize(allClassified, usage);

    // DB 저장
    await saveAnalysis(reviews as ReviewRow[], allClassified, summary);

    console.log(`[analyze] done — total:${reviews.length} | haiku: ${JSON.stringify(usage.haiku)} | sonnet: ${JSON.stringify(usage.sonnet)}`);

    return NextResponse.json({
      analyzed: reviews.length,
      usage,
    } satisfies AnalyzeReviewsResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[analyze] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
