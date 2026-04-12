import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Smartphone, Play, TrendingUp, AlertCircle, Minus, Tag, MessageSquare, BarChart2 } from "lucide-react";
import { SUPERCENT_GAMES } from "@/lib/presets";
import ReviewList from "@/components/ReviewList";
import type { Platform, Sentiment, ReviewCategory } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisRow {
  app_id: string;
  platform: Platform;
  version: string | null;
  sentiment: Sentiment;
  category: ReviewCategory;
  keywords: string[];
  summary: string;
}

interface ReviewRow {
  content: string;
  rating: number;
  version: string | null;
  review_date: string;
}

interface AnalysisRowWithReview extends AnalysisRow {
  reviews?: ReviewRow;
}

// ─── Supabase server client ───────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Data fetching ────────────────────────────────────────────────────────────
async function getDashboardData(app_id: string, platform: Platform) {
  const supabase = getSupabase();

  const { data: analyses, error } = await supabase
    .from("review_analysis")
    .select("app_id, platform, version, sentiment, category, keywords, summary")
    .eq("app_id", app_id)
    .eq("platform", platform)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!analyses || analyses.length === 0) return null;

  const rows = analyses as AnalysisRow[];

  // 감성 집계
  const sentimentCount = { positive: 0, negative: 0, neutral: 0 };
  for (const r of rows) sentimentCount[r.sentiment]++;

  // 카테고리 집계
  const categoryCount: Record<string, number> = {};
  for (const r of rows) {
    categoryCount[r.category] = (categoryCount[r.category] ?? 0) + 1;
  }
  const sortedCategories = Object.entries(categoryCount)
    .sort((a, b) => b[1] - a[1]);

  // 키워드 빈도
  const kwFreq: Record<string, number> = {};
  for (const r of rows) {
    for (const kw of r.keywords) {
      kwFreq[kw] = (kwFreq[kw] ?? 0) + 1;
    }
  }
  const topKeywords = Object.entries(kwFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw]) => kw);

  // 전체 리뷰 (reviews 테이블)
  const { data: allReviews } = await supabase
    .from("reviews")
    .select("content, rating, version, review_date")
    .eq("app_id", app_id)
    .eq("platform", platform)
    .order("review_date", { ascending: false });

  // summary는 최신 것 사용
  const summary = rows[0].summary;

  return {
    total: rows.length,
    sentimentCount,
    sortedCategories,
    topKeywords,
    summary,
    allReviews: (allReviews ?? []) as ReviewRow[],
    allAnalyses: rows as AnalysisRowWithReview[],
  };
}

// ─── Helper: sentiment 스타일 ─────────────────────────────────────────────────
const SENTIMENT_CONFIG: Record<
  Sentiment,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  positive: {
    label: "긍정",
    color: "text-emerald-600",
    bg: "bg-emerald-500",
    icon: <TrendingUp size={16} />,
  },
  negative: {
    label: "부정",
    color: "text-rose-600",
    bg: "bg-rose-500",
    icon: <AlertCircle size={16} />,
  },
  neutral: {
    label: "중립",
    color: "text-zinc-500",
    bg: "bg-zinc-400",
    icon: <Minus size={16} />,
  },
};

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  gameplay: "게임플레이",
  ui: "UI/UX",
  performance: "성능",
  monetization: "결제/광고",
  content: "콘텐츠",
  bug: "버그",
  other: "기타",
};

function SentimentBar({ count, total, sentiment }: { count: number; total: number; sentiment: Sentiment }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const cfg = SENTIMENT_CONFIG[sentiment];
  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-1 w-16 text-sm font-medium ${cfg.color}`}>
        {cfg.icon}
        {cfg.label}
      </div>
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full ${cfg.bg} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-zinc-500 w-16 text-right">
        {count}건 ({pct}%)
      </span>
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
async function Dashboard({ app_id, platform }: { app_id: string; platform: Platform }) {
  const game = SUPERCENT_GAMES.find(
    (g) => g.ios_app_id === app_id || g.android_package === app_id
  );

  const data = await getDashboardData(app_id, platform);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-400 gap-3">
        <BarChart2 size={40} className="text-zinc-300" />
        <p className="text-sm">분석 데이터가 없습니다. 먼저 리뷰를 수집하고 분석해 주세요.</p>
        <Link href="/" className="text-indigo-500 text-sm underline underline-offset-2">
          메인으로 돌아가기
        </Link>
      </div>
    );
  }

  const maxCategoryCount = data.sortedCategories[0]?.[1] ?? 1;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{game?.emoji ?? "🎮"}</span>
              <h1 className="text-xl font-bold">{game?.name ?? app_id}</h1>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                {platform === "ios" ? <Smartphone size={11} /> : <Play size={11} />}
                {platform === "ios" ? "iOS" : "Android"}
              </Badge>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              최근 리뷰 100건 기준 · 분석 완료 {data.total}건
            </p>
          </div>
        </div>

        {/* AI 인사이트 요약 */}
        <Card className="border-indigo-100 bg-indigo-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-indigo-600 flex items-center gap-1.5">
              <MessageSquare size={14} />
              AI 인사이트 요약
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-700 leading-relaxed">{data.summary}</p>
          </CardContent>
        </Card>

        {/* 감성 분석 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">감성 분석</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["positive", "negative", "neutral"] as Sentiment[]).map((s) => (
              <SentimentBar
                key={s}
                sentiment={s}
                count={data.sentimentCount[s]}
                total={data.total}
              />
            ))}
          </CardContent>
        </Card>

        {/* 카테고리 분석 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">카테고리 분석</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {data.sortedCategories.map(([cat, count]) => {
              const pct = Math.round((count / maxCategoryCount) * 100);
              return (
                <div key={cat} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-zinc-500 shrink-0">
                    {CATEGORY_LABEL[cat as ReviewCategory] ?? cat}
                  </span>
                  <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 상위 키워드 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Tag size={13} />
              주요 키워드
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.topKeywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="text-xs font-normal">
                  {kw}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* 최근 리뷰 */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            전체 리뷰 ({data.allReviews.length}건)
          </h2>
          <ReviewList reviews={data.allReviews} analyses={data.allAnalyses} />
        </div>

      </div>
    </main>
  );
}

// ─── Page (searchParams) ──────────────────────────────────────────────────────
export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ app_id?: string; platform?: string }>;
}) {
  const params = await searchParams;
  const app_id = params.app_id ?? "";
  const platform = (params.platform ?? "ios") as Platform;

  if (!app_id) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-400">
        <p>app_id가 필요합니다.</p>
      </main>
    );
  }

  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        데이터 로딩 중...
      </main>
    }>
      <Dashboard app_id={app_id} platform={platform} />
    </Suspense>
  );
}
