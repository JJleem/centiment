import type { ReviewPayload } from "@/types";

// ─── Sonnet: 크로스 비교 인사이트 ─────────────────────────────────────────────
// Input : 두 게임의 집계 통계
// Output: 한 문장 한국어 인사이트
export function buildCrossComparePrompt(
  g1: { name: string; total: number; positive: number; negative: number; topCategories: string[]; topKeywords: string[] },
  g2: { name: string; total: number; positive: number; negative: number; topCategories: string[]; topKeywords: string[] }
): string {
  const pct = (n: number, t: number) => (t > 0 ? Math.round((n / t) * 100) : 0);
  return `You are a mobile game product manager writing a one-sentence competitive insight in Korean.

Game 1 — ${g1.name}:
- ${g1.total} reviews, positive ${pct(g1.positive, g1.total)}%, negative ${pct(g1.negative, g1.total)}%
- Top categories: ${g1.topCategories.slice(0, 3).join(", ")}
- Top keywords: ${g1.topKeywords.slice(0, 8).join(", ")}

Game 2 — ${g2.name}:
- ${g2.total} reviews, positive ${pct(g2.positive, g2.total)}%, negative ${pct(g2.negative, g2.total)}%
- Top categories: ${g2.topCategories.slice(0, 3).join(", ")}
- Top keywords: ${g2.topKeywords.slice(0, 8).join(", ")}

Return ONLY one sentence in Korean (no markdown, no explanation) that highlights the most meaningful difference between the two games and gives an actionable insight for the product team.`;
}

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

  return `You are a mobile game review analyst. Reviews may be in any language (English, Korean, Japanese, German, etc.) — classify them all the same way.

Return ONLY a JSON array (no markdown, no explanation) with exactly ${batch.length} objects in order:
[
  {
    "sentiment": "positive" | "negative" | "neutral",
    "category": "gameplay" | "ui" | "performance" | "monetization" | "content" | "bug" | "other",
    "keywords": [up to 3 short English keywords translated from the review]
  },
  ...
]

Rules:
- sentiment: judge by review CONTENT first; use rating only as a tiebreaker when content is ambiguous
  - positive: content expresses satisfaction, praise, or recommendation (regardless of rating)
  - negative: content expresses complaints, frustration, or criticism (regardless of rating)
  - neutral: content is vague, too short to judge (e.g. "ㅎㅎ", "굿", "잘됨"), or genuinely balanced — do NOT force positive/negative on meaningless reviews
  - if rating and content strongly conflict, ALWAYS trust content over rating
- category: pick the single most dominant topic
- keywords: always output in English regardless of review language, lowercase, max 3 words each

Reviews:
${items}`;
}

// ─── Sonnet: 요약 + 이슈 목록 ─────────────────────────────────────────────────
// Input : 분류 결과 집계 통계 + 버그 카테고리 리뷰 원문 (최대 20건)
// Output: JSON { summary: string, issues: string[] }
export function buildSummaryPrompt(stats: {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  topKeywords: string[];
  categoryCounts: Record<string, number>;
  bugContents: string[];   // 버그 카테고리 리뷰 원문
}): string {
  const bugSection = stats.bugContents.length > 0
    ? `\nBug/crash reports (${stats.bugContents.length} reviews):\n${
        stats.bugContents.map((c, i) => `[${i + 1}] ${c.slice(0, 200)}`).join("\n")
      }`
    : "\nBug/crash reports: none";

  return `You are a game product manager writing an internal insight report in Korean.

Review analysis results:
- Total reviews: ${stats.total}
- Positive: ${stats.positive} (${Math.round((stats.positive / stats.total) * 100)}%)
- Negative: ${stats.negative} (${Math.round((stats.negative / stats.total) * 100)}%)
- Neutral: ${stats.neutral} (${Math.round((stats.neutral / stats.total) * 100)}%)
- Top keywords: ${stats.topKeywords.slice(0, 10).join(", ")}
- Category breakdown: ${JSON.stringify(stats.categoryCounts)}
${bugSection}

Return ONLY a JSON object (no markdown, no explanation):
{
  "summary": "<3 sentences in Korean: (1) overall sentiment & what players love, (2) main complaint with specific evidence, (3) one concrete improvement suggestion>",
  "issues": ["<specific bug or issue in Korean, max 15 chars>", ...]
}

Rules for issues:
- Extract distinct, concrete issues from the bug reports (e.g. "광고 스킵 불가", "결제 후 아이템 미지급")
- If no bug reports, return an empty array []
- Max 8 issues, each under 20 characters in Korean
- Do NOT include vague issues like "버그 있음"`;
}
