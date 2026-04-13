// ─── Platform ───────────────────────────────────────────────────────────────
export type Platform = "ios" | "android";

// ─── Sentiment / Category ───────────────────────────────────────────────────
export type Sentiment = "positive" | "negative" | "neutral";

export type ReviewCategory =
  | "gameplay"
  | "ui"
  | "performance"
  | "monetization"
  | "content"
  | "bug"
  | "other";

// ─── Raw Review (scraper output → DB) ───────────────────────────────────────
export interface Review {
  id: string;
  app_id: string;
  platform: Platform;
  version: string | null;
  rating: number;          // 1–5
  content: string;
  review_date: string;     // ISO 8601
  fetched_at: string;      // ISO 8601
}

// ─── Slim payload passed to Claude (content + rating + version 만) ──────────
export interface ReviewPayload {
  content: string;
  rating: number;
  version: string | null;
}

// ─── Analysis result (DB row) ───────────────────────────────────────────────
export interface ReviewAnalysis {
  id: string;
  app_id: string;
  platform: Platform;
  version: string | null;
  sentiment: Sentiment;
  category: ReviewCategory;
  keywords: string[];
  summary: string;
  created_at: string;      // ISO 8601
}

// ─── API request / response shapes ─────────────────────────────────────────
export interface FetchReviewsRequest {
  app_id: string;
  platform: Platform;
  count?: number;          // default 100
}

export interface FetchReviewsResponse {
  inserted: number;
  skipped: number;
}

export interface AnalyzeReviewsRequest {
  app_id: string;
  platform: Platform;
  force?: boolean; // true = 전체 삭제 후 재분석, false(기본) = 신규 리뷰만 분석
}

export interface AnalyzeReviewsResponse {
  analyzed: number;
  usage: {
    haiku: { input_tokens: number; output_tokens: number };
    sonnet: { input_tokens: number; output_tokens: number };
  };
}

// ─── Dashboard aggregates ───────────────────────────────────────────────────
export interface SentimentSummary {
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

export interface CategoryBreakdown {
  category: ReviewCategory;
  count: number;
  sentiment: SentimentSummary;
}

export interface DashboardData {
  app_id: string;
  platform: Platform;
  sentiment: SentimentSummary;
  categories: CategoryBreakdown[];
  top_keywords: string[];
  overall_summary: string;
  generated_at: string;
}
