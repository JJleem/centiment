import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { buildClassifyPrompt, buildSummaryPrompt } from "@/lib/prompts/analyze";
import type {
  AnalyzeReviewsRequest,
  AnalyzeProgressEvent,
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
    max_tokens: 8192,
    messages: [{ role: "user", content: buildClassifyPrompt(batch) }],
  });

  console.log(
    `[analyze][haiku] input:${res.usage.input_tokens} output:${res.usage.output_tokens}`
  );
  usage.haiku.input_tokens += res.usage.input_tokens;
  usage.haiku.output_tokens += res.usage.output_tokens;

  const raw = res.content[0].type === "text" ? res.content[0].text : "[]";
  const text = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    const parsed = JSON.parse(text) as ClassifyResult[];
    if (parsed.length !== batch.length) {
      console.warn(`[analyze][haiku] count mismatch: expected ${batch.length}, got ${parsed.length} — padding with defaults`);
      while (parsed.length < batch.length) {
        parsed.push({ sentiment: "neutral", category: "other", keywords: [] });
      }
    }
    return parsed.slice(0, batch.length);
  } catch {
    console.error("[analyze][haiku] JSON parse failed:", text.slice(0, 300));
    return batch.map(() => ({ sentiment: "neutral", category: "other", keywords: [] }));
  }
}

// ─── Sonnet: 요약 + 이슈 목록 ─────────────────────────────────────────────────
interface SummaryResult {
  summary: string;
  issues: string[];
}

async function summarize(
  classified: ClassifyResult[],
  bugContents: string[],
  usage: UsageAcc
): Promise<SummaryResult> {
  const total = classified.length;
  const positive = classified.filter((r) => r.sentiment === "positive").length;
  const negative = classified.filter((r) => r.sentiment === "negative").length;
  const neutral = total - positive - negative;

  const kwFreq: Record<string, number> = {};
  for (const r of classified) {
    for (const kw of r.keywords) kwFreq[kw] = (kwFreq[kw] ?? 0) + 1;
  }
  const topKeywords = Object.entries(kwFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([kw]) => kw);

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
        content: buildSummaryPrompt({
          total, positive, negative, neutral,
          topKeywords, categoryCounts,
          bugContents: bugContents.slice(0, 20),
        }),
      },
    ],
  });

  console.log(
    `[analyze][sonnet] input:${res.usage.input_tokens} output:${res.usage.output_tokens}`
  );
  usage.sonnet.input_tokens += res.usage.input_tokens;
  usage.sonnet.output_tokens += res.usage.output_tokens;

  const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
  const text = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    const parsed = JSON.parse(text) as SummaryResult;
    return {
      summary: parsed.summary ?? "",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    console.error("[analyze][sonnet] JSON parse failed:", text.slice(0, 300));
    return { summary: text, issues: [] };
  }
}

// ─── ReviewRow ────────────────────────────────────────────────────────────────
interface ReviewRow {
  id: string;
  app_id: string;
  platform: Platform;
  version: string | null;
  content: string;
  rating: number;
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = (await req.json()) as AnalyzeReviewsRequest;
  const { app_id, platform, force = false } = body;

  if (!app_id || !platform) {
    return NextResponse.json({ error: "app_id and platform are required" }, { status: 400 });
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const send = async (event: AnalyzeProgressEvent) => {
    try {
      await writer.write(encoder.encode(JSON.stringify(event) + "\n"));
    } catch {}
  };

  (async () => {
    try {
      const usage: UsageAcc = {
        haiku: { input_tokens: 0, output_tokens: 0 },
        sonnet: { input_tokens: 0, output_tokens: 0 },
      };

      // ── 전체 재분석 모드 (force) ──────────────────────────────────────────────
      if (force) {
        const { data: allReviews, error: fetchErr } = await supabase
          .from("reviews")
          .select("id, app_id, platform, version, content, rating")
          .eq("app_id", app_id)
          .eq("platform", platform);

        if (fetchErr) throw new Error(fetchErr.message);

        await supabase
          .from("review_analysis")
          .delete()
          .eq("app_id", app_id)
          .eq("platform", platform);

        if (!allReviews || allReviews.length === 0) {
          await send({ type: "done", analyzed: 0 });
          return;
        }

        const rows = allReviews as ReviewRow[];
        const batchCount = Math.ceil(rows.length / BATCH_SIZE);
        await send({ type: "start", total_batches: batchCount });

        const allClassified: ClassifyResult[] = [];
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const payloads: ReviewPayload[] = batch.map((r) => ({
            content: r.content,
            rating: r.rating,
            version: r.version,
          }));
          allClassified.push(...(await classifyBatch(payloads, usage)));
          await send({ type: "batch", done: Math.floor(i / BATCH_SIZE) + 1, total: batchCount });
        }

        const bugContents = rows
          .filter((_, i) => allClassified[i]?.category === "bug")
          .map((r) => r.content);

        await send({ type: "summarizing" });
        const { summary, issues } = await summarize(allClassified, bugContents, usage);

        const records = rows.map((row, i) => ({
          app_id: row.app_id,
          platform: row.platform,
          version: row.version,
          sentiment: allClassified[i].sentiment,
          category: allClassified[i].category,
          keywords: allClassified[i].keywords,
          summary,
          issues,
          review_id: row.id,
        }));
        const { error: insertErr } = await supabase.from("review_analysis").insert(records);
        if (insertErr) throw new Error(insertErr.message);

        console.log(`[analyze][force] done — total:${rows.length} | haiku:${JSON.stringify(usage.haiku)} | sonnet:${JSON.stringify(usage.sonnet)}`);
        await send({ type: "done", analyzed: rows.length });
        return;
      }

      // ── 증분 모드 (기본) ──────────────────────────────────────────────────────
      const { data: existingAnalyses } = await supabase
        .from("review_analysis")
        .select("review_id")
        .eq("app_id", app_id)
        .eq("platform", platform)
        .not("review_id", "is", null);

      const analyzedIds = new Set((existingAnalyses ?? []).map((r) => r.review_id as string));

      const { data: allReviews, error: fetchErr } = await supabase
        .from("reviews")
        .select("id, app_id, platform, version, content, rating")
        .eq("app_id", app_id)
        .eq("platform", platform);

      if (fetchErr) throw new Error(fetchErr.message);
      if (!allReviews || allReviews.length === 0) {
        await send({ type: "done", analyzed: 0 });
        return;
      }

      const rows = allReviews as ReviewRow[];
      const unanalyzed = rows.filter((r) => !analyzedIds.has(r.id));

      if (unanalyzed.length === 0) {
        console.log(`[analyze][incremental] no new reviews — ${app_id}/${platform}`);
        await send({ type: "done", analyzed: 0 });
        return;
      }

      console.log(`[analyze][incremental] new:${unanalyzed.length} / total:${rows.length} — ${app_id}/${platform}`);

      const batchCount = Math.ceil(unanalyzed.length / BATCH_SIZE);
      await send({ type: "start", total_batches: batchCount });

      const newClassified: ClassifyResult[] = [];
      for (let i = 0; i < unanalyzed.length; i += BATCH_SIZE) {
        const batch = unanalyzed.slice(i, i + BATCH_SIZE);
        const payloads: ReviewPayload[] = batch.map((r) => ({
          content: r.content,
          rating: r.rating,
          version: r.version,
        }));
        newClassified.push(...(await classifyBatch(payloads, usage)));
        await send({ type: "batch", done: Math.floor(i / BATCH_SIZE) + 1, total: batchCount });
      }

      const newRecords = unanalyzed.map((row, i) => ({
        app_id: row.app_id,
        platform: row.platform,
        version: row.version,
        sentiment: newClassified[i].sentiment,
        category: newClassified[i].category,
        keywords: newClassified[i].keywords,
        summary: "",
        issues: [] as string[],
        review_id: row.id,
      }));
      const { error: insertErr } = await supabase.from("review_analysis").insert(newRecords);
      if (insertErr) throw new Error(insertErr.message);

      const { data: allAnalyses } = await supabase
        .from("review_analysis")
        .select("sentiment, category, keywords")
        .eq("app_id", app_id)
        .eq("platform", platform);

      const allClassifiedForSummary = (allAnalyses ?? []) as ClassifyResult[];

      const { data: bugAnalysisRows } = await supabase
        .from("review_analysis")
        .select("review_id")
        .eq("app_id", app_id)
        .eq("platform", platform)
        .eq("category", "bug")
        .not("review_id", "is", null);

      const bugReviewIds = (bugAnalysisRows ?? []).map((r) => r.review_id as string);
      let bugContents: string[] = [];
      if (bugReviewIds.length > 0) {
        const { data: bugReviews } = await supabase
          .from("reviews")
          .select("content")
          .in("id", bugReviewIds)
          .limit(20);
        bugContents = (bugReviews ?? []).map((r) => r.content as string);
      }

      await send({ type: "summarizing" });
      const { summary, issues } = await summarize(allClassifiedForSummary, bugContents, usage);

      await supabase
        .from("review_analysis")
        .update({ summary, issues })
        .eq("app_id", app_id)
        .eq("platform", platform);

      console.log(`[analyze][incremental] done — new:${unanalyzed.length} | haiku:${JSON.stringify(usage.haiku)} | sonnet:${JSON.stringify(usage.sonnet)}`);
      await send({ type: "done", analyzed: unanalyzed.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      console.error("[analyze] error:", message);
      await send({ type: "error", message });
    } finally {
      try { await writer.close(); } catch {}
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
