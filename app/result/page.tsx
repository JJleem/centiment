import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Smartphone,
  Play,
  TrendingUp,
  AlertCircle,
  Minus,
  Tag,
  MessageSquare,
  BarChart2,
} from "lucide-react";
import { SUPERCENT_GAMES } from "@/lib/presets";
import ReviewList, { type CombinedItem } from "@/components/ReviewList";
import ReanalyzeButton from "@/components/ReanalyzeButton";
import type { Platform, Sentiment, ReviewCategory } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisRow {
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

interface PlatformStats {
  total: number;
  sentimentCount: Record<Sentiment, number>;
  sortedCategories: [string, number][];
  topKeywords: string[];
  summary: string;
  reviewItems: CombinedItem[];
}

// ─── Supabase ─────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getPlatformStats(
  app_id: string,
  platform: Platform
): Promise<PlatformStats | null> {
  const supabase = getSupabase();

  const [{ data: analyses, error }, { data: reviews }] = await Promise.all([
    supabase
      .from("review_analysis")
      .select("platform, version, sentiment, category, keywords, summary")
      .eq("app_id", app_id)
      .eq("platform", platform)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("content, rating, version, review_date")
      .eq("app_id", app_id)
      .eq("platform", platform)
      .order("review_date", { ascending: false }),
  ]);

  if (error || !analyses || analyses.length === 0) return null;

  const rows = analyses as AnalysisRow[];
  const reviewRows = (reviews ?? []) as ReviewRow[];

  // 감성 집계
  const sentimentCount: Record<Sentiment, number> = { positive: 0, negative: 0, neutral: 0 };
  for (const r of rows) sentimentCount[r.sentiment]++;

  // 카테고리 집계
  const categoryCount: Record<string, number> = {};
  for (const r of rows) categoryCount[r.category] = (categoryCount[r.category] ?? 0) + 1;
  const sortedCategories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);

  // 키워드 빈도
  const kwFreq: Record<string, number> = {};
  for (const r of rows) {
    for (const kw of r.keywords) kwFreq[kw] = (kwFreq[kw] ?? 0) + 1;
  }
  const topKeywords = Object.entries(kwFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw]) => kw);

  // 리뷰 + 분석 페어링 (index 기준)
  const reviewItems: CombinedItem[] = rows.map((analysis, i) => ({
    content: reviewRows[i]?.content ?? "",
    rating: reviewRows[i]?.rating ?? 0,
    version: reviewRows[i]?.version ?? analysis.version,
    review_date: reviewRows[i]?.review_date ?? "",
    platform,
    sentiment: analysis.sentiment,
    category: analysis.category,
    keywords: analysis.keywords,
  })).filter((item) => item.content !== "");

  return {
    total: rows.length,
    sentimentCount,
    sortedCategories,
    topKeywords,
    summary: rows[0].summary,
    reviewItems,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SENTIMENT_CONFIG: Record<
  Sentiment,
  { label: string; barColor: string; textColor: string; icon: React.ReactNode }
> = {
  positive: { label: "긍정", barColor: "bg-emerald-500", textColor: "text-emerald-600", icon: <TrendingUp size={13} /> },
  negative: { label: "부정", barColor: "bg-rose-500",    textColor: "text-rose-600",    icon: <AlertCircle size={13} /> },
  neutral:  { label: "중립", barColor: "bg-zinc-400",    textColor: "text-zinc-500",    icon: <Minus size={13} /> },
};

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  gameplay:     "게임플레이",
  ui:           "UI/UX",
  performance:  "성능",
  monetization: "결제/광고",
  content:      "콘텐츠",
  bug:          "버그",
  other:        "기타",
};

const ALL_CATEGORIES: ReviewCategory[] = [
  "gameplay", "ui", "performance", "monetization", "content", "bug", "other",
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function SentimentColumn({
  stats,
  platform,
}: {
  stats: PlatformStats | null;
  platform: Platform;
}) {
  const isIos = platform === "ios";
  const accent = isIos ? "text-sky-600" : "text-teal-600";
  const bg = isIos ? "bg-sky-50 border-sky-100" : "bg-teal-50 border-teal-100";

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${bg}`}>
      <div className={`flex items-center gap-1.5 text-xs font-semibold ${accent}`}>
        {isIos ? <Smartphone size={12} /> : <Play size={12} />}
        {isIos ? "iOS" : "Android"}
        {stats && (
          <span className="ml-auto font-normal text-zinc-400">{stats.total}건</span>
        )}
      </div>
      {stats ? (
        (["positive", "negative", "neutral"] as Sentiment[]).map((s) => {
          const cfg = SENTIMENT_CONFIG[s];
          const pct = stats.total > 0 ? Math.round((stats.sentimentCount[s] / stats.total) * 100) : 0;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1 w-14 text-xs font-medium ${cfg.textColor}`}>
                {cfg.icon}{cfg.label}
              </div>
              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className={`h-full ${cfg.barColor} rounded-full`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-zinc-400 w-10 text-right">{pct}%</span>
            </div>
          );
        })
      ) : (
        <div className="py-6 text-center text-zinc-300 text-xs">
          {isIos ? <Smartphone size={20} className="mx-auto mb-1" /> : <Play size={20} className="mx-auto mb-1" />}
          분석 데이터 없음
        </div>
      )}
    </div>
  );
}

function CategoryComparison({
  ios,
  android,
}: {
  ios: PlatformStats | null;
  android: PlatformStats | null;
}) {
  const iosMap = Object.fromEntries(ios?.sortedCategories ?? []);
  const androidMap = Object.fromEntries(android?.sortedCategories ?? []);
  const globalMax = Math.max(...Object.values(iosMap), ...Object.values(androidMap), 1);

  const hasData = ALL_CATEGORIES.some(
    (cat) => (iosMap[cat] ?? 0) > 0 || (androidMap[cat] ?? 0) > 0
  );

  if (!hasData) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> iOS
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" /> Android
        </span>
      </div>

      {ALL_CATEGORIES.map((cat) => {
        const iosCount = iosMap[cat] ?? 0;
        const androidCount = androidMap[cat] ?? 0;
        if (iosCount === 0 && androidCount === 0) return null;
        return (
          <div key={cat} className="space-y-1">
            <span className="text-xs text-zinc-500">{CATEGORY_LABEL[cat]}</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-sky-400 rounded-full" style={{ width: `${Math.round((iosCount / globalMax) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-zinc-400 w-5 text-right">{iosCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                <div className="h-full bg-teal-400 rounded-full" style={{ width: `${Math.round((androidCount / globalMax) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-zinc-400 w-5 text-right">{androidCount}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function Dashboard({ game_id }: { game_id: string }) {
  const game = SUPERCENT_GAMES.find((g) => g.id === game_id);

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-400 gap-3">
        <BarChart2 size={36} className="text-zinc-300" />
        <p className="text-sm">게임을 찾을 수 없습니다.</p>
        <Link href="/" className="text-indigo-500 text-sm underline underline-offset-2">메인으로 돌아가기</Link>
      </div>
    );
  }

  const [ios, android] = await Promise.all([
    getPlatformStats(game.ios_app_id, "ios"),
    getPlatformStats(game.android_package, "android"),
  ]);

  if (!ios && !android) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <span className="text-2xl">{game.emoji}</span>
            <h1 className="text-xl font-bold">{game.name}</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
            <BarChart2 size={40} className="text-zinc-300" />
            <p className="text-sm">분석 데이터가 없습니다. 먼저 분석을 실행해 주세요.</p>
            <Link href="/" className="text-indigo-500 text-sm underline underline-offset-2 mt-2">메인으로 돌아가기</Link>
          </div>
        </div>
      </main>
    );
  }

  // 통합 리뷰 목록 (날짜순 병합)
  const allReviewItems = [
    ...(ios?.reviewItems ?? []),
    ...(android?.reviewItems ?? []),
  ].sort(
    (a, b) => new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
  );

  // 긍정률 비교
  const iosPct = ios ? Math.round((ios.sentimentCount.positive / ios.total) * 100) : null;
  const androidPct = android ? Math.round((android.sentimentCount.positive / android.total) * 100) : null;
  const diffMsg = iosPct !== null && androidPct !== null && iosPct !== androidPct
    ? `${iosPct > androidPct ? "iOS" : "Android"}가 긍정률 ${Math.abs(iosPct - androidPct)}%p 더 높음`
    : null;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors mt-1">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{game.emoji}</span>
                <h1 className="text-xl font-bold">{game.name}</h1>
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Smartphone size={10} /> iOS
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Play size={10} /> Android
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                iOS {ios ? `${ios.total}건` : "데이터 없음"} · Android {android ? `${android.total}건` : "데이터 없음"}
              </p>
            </div>
          </div>
          <ReanalyzeButton game={game} />
        </div>

        {/* AI 인사이트 — 2열 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className={ios ? "border-sky-100 bg-sky-50/50" : "border-zinc-100"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-sky-600 flex items-center gap-1.5">
                <MessageSquare size={12} /><Smartphone size={12} /> iOS AI 인사이트
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ios
                ? <p className="text-xs text-zinc-700 leading-relaxed">{ios.summary}</p>
                : <p className="text-xs text-zinc-300">데이터 없음</p>
              }
            </CardContent>
          </Card>

          <Card className={android ? "border-teal-100 bg-teal-50/50" : "border-zinc-100"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-teal-600 flex items-center gap-1.5">
                <MessageSquare size={12} /><Play size={12} /> Android AI 인사이트
              </CardTitle>
            </CardHeader>
            <CardContent>
              {android
                ? <p className="text-xs text-zinc-700 leading-relaxed">{android.summary}</p>
                : <p className="text-xs text-zinc-300">데이터 없음</p>
              }
            </CardContent>
          </Card>
        </div>

        {/* 감성 비교 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">감성 분석 비교</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SentimentColumn stats={ios} platform="ios" />
              <SentimentColumn stats={android} platform="android" />
            </div>
            {diffMsg && (
              <p className={`text-xs text-center ${iosPct! > androidPct! ? "text-sky-600" : "text-teal-600"}`}>
                <span className="font-semibold">{diffMsg}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* 카테고리 비교 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">카테고리별 비교</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryComparison ios={ios} android={android} />
          </CardContent>
        </Card>

        {/* 키워드 비교 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Tag size={13} /> 주요 키워드 비교
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-sky-600 flex items-center gap-1 mb-2">
                  <Smartphone size={11} /> iOS
                </p>
                {ios ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ios.topKeywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs font-normal bg-sky-50 text-sky-700 border-sky-100">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-300">데이터 없음</p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-teal-600 flex items-center gap-1 mb-2">
                  <Play size={11} /> Android
                </p>
                {android ? (
                  <div className="flex flex-wrap gap-1.5">
                    {android.topKeywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className="text-xs font-normal bg-teal-50 text-teal-700 border-teal-100">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-300">데이터 없음</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* 통합 리뷰 목록 */}
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">
            전체 리뷰 ({allReviewItems.length}건)
          </h2>
          <ReviewList items={allReviewItems} />
        </div>

      </div>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const params = await searchParams;
  const game_id = params.game ?? "";

  if (!game_id) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-400">
        <p>game 파라미터가 필요합니다.</p>
      </main>
    );
  }

  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        데이터 로딩 중...
      </main>
    }>
      <Dashboard game_id={game_id} />
    </Suspense>
  );
}
