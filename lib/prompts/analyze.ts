import type { ReviewPayload } from "@/types";

// ─── Haiku: 리뷰 배치 분류 ────────────────────────────────────────────────────
// Input : ReviewPayload[] (20건)
// Output: JSON array — { sentiment, category, keywords }[]
export function buildClassifyPrompt(batch: ReviewPayload[]): string {
  const items = batch
    .map(
      (r, i) =>
        `[${i}] rating:${r.rating} version:${r.version ?? "unknown"}\n${r.content}`
    )
    .join("\n\n");

  return `You are a mobile game review analyst. Classify each review below.

Return ONLY a JSON array (no markdown, no explanation) with exactly ${batch.length} objects in order:
[
  {
    "sentiment": "positive" | "negative" | "neutral",
    "category": "gameplay" | "ui" | "performance" | "monetization" | "content" | "bug" | "other",
    "keywords": [up to 3 short English keywords]
  },
  ...
]

Rules:
- sentiment: positive(4-5★ praise), negative(1-2★ complaints or 3★ mixed criticism), neutral(3★ balanced)
- category: pick the single most dominant topic
- keywords: lowercase, max 3 words each

Reviews:
${items}`;
}

// ─── Sonnet: 전체 요약 ────────────────────────────────────────────────────────
// Input : 분류 결과 집계 통계 + 상위 키워드
// Output: 3~5문장 인사이트 요약 (한국어)
export function buildSummaryPrompt(stats: {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  topKeywords: string[];
  categoryCounts: Record<string, number>;
}): string {
  return `You are a game product manager writing an internal insight report in Korean.

Review analysis results:
- Total reviews: ${stats.total}
- Positive: ${stats.positive} (${Math.round((stats.positive / stats.total) * 100)}%)
- Negative: ${stats.negative} (${Math.round((stats.negative / stats.total) * 100)}%)
- Neutral: ${stats.neutral} (${Math.round((stats.neutral / stats.total) * 100)}%)
- Top keywords: ${stats.topKeywords.slice(0, 10).join(", ")}
- Category breakdown: ${JSON.stringify(stats.categoryCounts)}

Write exactly 3 sentences in Korean for the game team. No more, no less.
Sentence 1: overall sentiment and what players love.
Sentence 2: main complaint with specific evidence from keywords.
Sentence 3: one concrete improvement suggestion.
Output plain text only, no markdown, no headers, no bullet points.`;
}
