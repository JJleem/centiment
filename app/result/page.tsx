import { Suspense } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Smartphone,
  Play,
  TrendingUp,
  AlertCircle,
  Minus,
  MessageSquare,
  BarChart2,
  Bug,
  Sparkles,
  Tag,
} from "lucide-react";
import { SUPERCENT_GAMES } from "@/lib/presets";
import GameIcon from "@/components/GameIcon";
import ReviewList, { type CombinedItem } from "@/components/ReviewList";
import ReanalyzeButton from "@/components/ReanalyzeButton";
import CsvExportButton from "@/components/CsvExportButton";
import AnalysisTimeline from "@/components/AnalysisTimeline";
import CategoryInsights from "@/components/CategoryInsights";
import VersionAlertsList from "@/components/VersionAlertsList";
import LangSentimentChart from "@/components/LangSentimentChart";
import KeywordDrilldown from "@/components/KeywordDrilldown";
import VersionTrendChart, { type VersionTrendData } from "@/components/VersionTrendChart";
import RatingDistChart from "@/components/RatingDistChart";
import type { Platform, Sentiment, ReviewCategory } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisRow {
  platform: Platform;
  version: string | null;
  sentiment: Sentiment;
  category: ReviewCategory;
  keywords: string[];
  summary: string;
  issues: string[];
}

interface ReviewRow {
  content: string;
  rating: number;
  version: string | null;
  review_date: string;
}

interface PlatformStats {
  total: number;
  fetchedTotal: number;        // reviews 테이블 실제 수집 건수
  sentimentCount: Record<Sentiment, number>;
  sortedCategories: [string, number][];
  topKeywords: string[];
  sellingKeywords: string[];   // 긍정 리뷰 전용 키워드 (셀링포인트)
  summary: string;
  issues: string[];
  versionTrend: VersionTrendData[];
  dateTrend: VersionTrendData[];   // 월별 감성 트렌드 (version 필드를 레이블로 재사용)
  reviewItems: CombinedItem[];
  ratingDist: Record<number, number>;
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
      .select("platform, version, sentiment, category, keywords, summary, issues")
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

  // 긍정 리뷰 전용 키워드 집계 (셀링포인트)
  const posKwFreq: Record<string, number> = {};
  for (const r of rows) {
    if (r.sentiment === "positive") {
      for (const kw of r.keywords) posKwFreq[kw] = (posKwFreq[kw] ?? 0) + 1;
    }
  }
  const sellingKeywords = Object.entries(posKwFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([kw]) => kw);

  // 버전별 감성 트렌드
  const parseVer = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const versionMap: Record<string, { positive: number; negative: number; neutral: number }> = {};
  for (const r of rows) {
    const ver = r.version ?? "미상";
    if (!versionMap[ver]) versionMap[ver] = { positive: 0, negative: 0, neutral: 0 };
    versionMap[ver][r.sentiment]++;
  }
  const versionTrend: VersionTrendData[] = Object.entries(versionMap)
    .sort(([a], [b]) => {
      const av = parseVer(a), bv = parseVer(b);
      for (let i = 0; i < Math.max(av.length, bv.length); i++) {
        const diff = (av[i] ?? 0) - (bv[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return a.localeCompare(b);
    })
    .map(([version, counts]) => ({
      version,
      ...counts,
      total: counts.positive + counts.negative + counts.neutral,
    }));

  // 평점 분포
  const ratingDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviewRows) {
    const star = Math.round(r.rating);
    if (star >= 1 && star <= 5) ratingDist[star]++;
  }

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

  // 월별 감성 트렌드
  const monthMap: Record<string, { positive: number; negative: number; neutral: number }> = {};
  for (const item of reviewItems) {
    if (!item.review_date) continue;
    const month = item.review_date.slice(0, 7); // "YYYY-MM"
    if (!monthMap[month]) monthMap[month] = { positive: 0, negative: 0, neutral: 0 };
    monthMap[month][item.sentiment]++;
  }
  const dateTrend: VersionTrendData[] = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({
      version: month.slice(2).replace("-", "."), // "2024-01" → "24.01"
      ...counts,
      total: counts.positive + counts.negative + counts.neutral,
    }));

  return {
    total: rows.length,
    fetchedTotal: reviewRows.length,
    sentimentCount,
    sortedCategories,
    topKeywords,
    sellingKeywords,
    summary: rows[0].summary,
    issues: rows[0].issues ?? [],
    versionTrend,
    dateTrend,
    reviewItems,
    ratingDist,
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
          <span className="ml-auto font-normal text-zinc-400 flex items-center gap-1">
            <span>{stats.total}건 분석</span>
            {stats.fetchedTotal > stats.total && (
              <>
                <span className="text-zinc-300">/</span>
                <span className="text-zinc-300">{stats.fetchedTotal}건 수집</span>
              </>
            )}
          </span>
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

  if (!hasData) return (
    <p className="text-xs text-zinc-300 text-center py-6">카테고리 데이터가 없습니다.</p>
  );

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

// ─── Version alert helper ─────────────────────────────────────────────────────
interface VersionAlert { version: string; prev: string; change: number; }

function getVersionAlerts(trend: VersionTrendData[]): VersionAlert[] {
  if (trend.length < 2) return [];
  const alerts: VersionAlert[] = [];
  for (let i = 1; i < trend.length; i++) {
    const prev = trend[i - 1];
    const curr = trend[i];
    const prevPct = prev.total > 0 ? Math.round((prev.positive / prev.total) * 100) : 0;
    const currPct = curr.total > 0 ? Math.round((curr.positive / curr.total) * 100) : 0;
    const change = currPct - prevPct;
    if (Math.abs(change) >= 10) alerts.push({ version: curr.version, prev: prev.version, change });
  }
  return alerts;
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
    unstable_cache(
      () => getPlatformStats(game.ios_app_id, "ios"),
      [`platform-stats-${game.ios_app_id}-ios`],
      { revalidate: 3600, tags: [`analysis-${game.ios_app_id}`] }
    )(),
    unstable_cache(
      () => getPlatformStats(game.android_package, "android"),
      [`platform-stats-${game.android_package}-android`],
      { revalidate: 3600, tags: [`analysis-${game.android_package}`] }
    )(),
  ]);

  if (!ios && !android) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <GameIcon game={game} size={32} />
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

  // 버전 릴리즈 알림 (±10%p 이상 변동)
  const iosAlerts = getVersionAlerts(ios?.versionTrend ?? []);
  const androidAlerts = getVersionAlerts(android?.versionTrend ?? []);
  const allAlerts = [...iosAlerts.map((a) => ({ ...a, platform: "iOS" })), ...androidAlerts.map((a) => ({ ...a, platform: "Android" }))];

  // 긍정률 비교
  const iosPct = ios ? Math.round((ios.sentimentCount.positive / ios.total) * 100) : null;
  const androidPct = android ? Math.round((android.sentimentCount.positive / android.total) * 100) : null;
  const diffMsg = iosPct !== null && androidPct !== null && iosPct !== androidPct
    ? `${iosPct > androidPct ? "iOS" : "Android"}가 긍정률 ${Math.abs(iosPct - androidPct)}%p 더 높음`
    : null;

  // 통합 긍정률
  const combinedTotal = (ios?.total ?? 0) + (android?.total ?? 0);
  const combinedPositive = (ios?.sentimentCount.positive ?? 0) + (android?.sentimentCount.positive ?? 0);
  const combinedPct = combinedTotal > 0 ? Math.round((combinedPositive / combinedTotal) * 100) : null;
  const pctColor = combinedPct === null ? "text-zinc-400" : combinedPct >= 70 ? "text-emerald-600" : combinedPct >= 40 ? "text-amber-600" : "text-rose-600";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/10">

      {/* ── 헤더 ────────────────────────────────────────────────────────────── */}
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-100 sticky top-0 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </Link>
          <GameIcon game={game} size={36} className="rounded-xl shadow-sm shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-zinc-900 truncate">{game.name}</h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium">{game.genre}</span>
              {ios && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-100 flex items-center gap-0.5"><Smartphone size={9} /> iOS {ios.total}건</span>}
              {android && <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 border border-teal-100 flex items-center gap-0.5"><Play size={9} /> Android {android.total}건</span>}
            </div>
          </div>
          {combinedPct !== null && (
            <div className="hidden sm:flex items-baseline gap-1 shrink-0">
              <span className={`text-2xl font-bold ${pctColor}`}>{combinedPct}%</span>
              <span className="text-xs text-zinc-400">긍정률</span>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <CsvExportButton items={allReviewItems} gameName={game.name} />
            <ReanalyzeButton game={game} />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-6 items-start">

          {/* ── LEFT: 인사이트 영역 ─────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* 버전 릴리즈 알림 */}
            <VersionAlertsList alerts={allAlerts} />

            {/* AI 인사이트 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { stats: ios, platform: "ios", accentBg: "from-sky-50 to-white", accent: "text-sky-600", border: "border-sky-100", icon: <Smartphone size={11} /> },
                { stats: android, platform: "android", accentBg: "from-teal-50 to-white", accent: "text-teal-600", border: "border-teal-100", icon: <Play size={11} /> },
              ].map(({ stats, platform, accentBg, accent, border, icon }) => (
                <div key={platform} className={`bg-gradient-to-br ${accentBg} rounded-2xl border ${border} p-4 shadow-sm`}>
                  <p className={`text-xs font-semibold ${accent} flex items-center gap-1.5 mb-2`}>
                    <Sparkles size={11} /> {icon} {platform === "ios" ? "iOS" : "Android"} AI 인사이트
                  </p>
                  {stats?.summary
                    ? <p className="text-xs text-zinc-700 leading-relaxed">{stats.summary}</p>
                    : <p className="text-xs text-zinc-300 italic">{stats ? "데이터 부족" : "데이터 없음"}</p>
                  }
                </div>
              ))}
            </div>

            {/* 카테고리 세부 인사이트 */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <BarChart2 size={13} /> 카테고리별 세부 인사이트
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryInsights gameId={game_id} hasIos={!!ios} hasAndroid={!!android} />
              </CardContent>
            </Card>

            {/* 이슈 목록 */}
            {((ios?.issues?.length ?? 0) > 0 || (android?.issues?.length ?? 0) > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([{ stats: ios, platform: "ios" as const }, { stats: android, platform: "android" as const }]).map(({ stats, platform }) => {
                  if (!stats || stats.issues.length === 0) return null;
                  const isIos = platform === "ios";
                  return (
                    <Card key={platform} className={`shadow-sm ${isIos ? "border-rose-100 bg-rose-50/30" : "border-orange-100 bg-orange-50/30"}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className={`text-xs flex items-center gap-1.5 ${isIos ? "text-rose-600" : "text-orange-600"}`}>
                          <Bug size={12} /> {isIos ? <Smartphone size={11} /> : <Play size={11} />} {isIos ? "iOS" : "Android"} 주요 이슈
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1.5">
                          {stats.issues.map((issue, i) => (
                            <li key={i} className="flex items-center gap-2 text-xs text-zinc-700">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isIos ? "bg-rose-100 text-rose-600" : "bg-orange-100 text-orange-600"}`}>{i + 1}</span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* 셀링포인트 */}
            {((ios?.sellingKeywords?.length ?? 0) > 0 || (android?.sellingKeywords?.length ?? 0) > 0) && (
              <Card className="border-emerald-100 bg-emerald-50/30 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5 text-emerald-700">
                    <Tag size={13} /> 셀링포인트 — 유저가 자주 언급한 장점
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {([{ stats: ios, label: "iOS", icon: <Smartphone size={11} />, isIos: true }, { stats: android, label: "Android", icon: <Play size={11} />, isIos: false }]).map(({ stats, label, icon, isIos }) =>
                      stats && (stats.sellingKeywords?.length ?? 0) > 0 ? (
                        <div key={label}>
                          <p className={`text-xs font-semibold ${isIos ? "text-sky-600" : "text-teal-600"} flex items-center gap-1 mb-2`}>{icon} {label}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {stats.sellingKeywords.map((kw, i) => (
                              <span key={kw} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                i === 0 ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                                i <= 2  ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                                          "bg-white text-emerald-600 border-emerald-100"
                              }`}>
                                {i < 3 && <span className="text-[9px] font-bold text-emerald-400">#{i + 1}</span>}
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-3">긍정 리뷰에서 추출한 키워드 — 마케팅 카피 소재로 활용하세요</p>
                </CardContent>
              </Card>
            )}

            {/* 키워드 드릴다운 + 리뷰 목록 */}
            <KeywordDrilldown
              iosKeywords={ios?.topKeywords ?? []}
              androidKeywords={android?.topKeywords ?? []}
              allItems={allReviewItems}
            />
          </div>

          {/* ── RIGHT: 통계 사이드바 ─────────────────────────────────────────── */}
          <div className="hidden lg:block w-72 xl:w-80 shrink-0">
            <div className="sticky top-24 space-y-4">

              {/* 감성 비교 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-zinc-500">감성 분석</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <SentimentColumn stats={ios} platform="ios" />
                  <SentimentColumn stats={android} platform="android" />
                  {diffMsg && (
                    <p className={`text-[11px] text-center font-medium ${iosPct! > androidPct! ? "text-sky-600" : "text-teal-600"}`}>{diffMsg}</p>
                  )}
                </CardContent>
              </Card>

              {/* 평점 분포 */}
              {(ios || android) && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-zinc-500 flex items-center gap-1"><span className="text-amber-400">★</span> 평점 분포</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ios && <div><p className="text-[10px] font-semibold text-sky-600 flex items-center gap-1 mb-2"><Smartphone size={9} /> iOS</p><RatingDistChart dist={ios.ratingDist} total={ios.total} color="sky" /></div>}
                    {android && <div><p className="text-[10px] font-semibold text-teal-600 flex items-center gap-1 mb-2"><Play size={9} /> Android</p><RatingDistChart dist={android.ratingDist} total={android.total} color="teal" /></div>}
                  </CardContent>
                </Card>
              )}

              {/* 카테고리 비교 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-zinc-500">카테고리별 비교</CardTitle>
                </CardHeader>
                <CardContent>
                  {ios || android ? <CategoryComparison ios={ios} android={android} /> : <p className="text-xs text-zinc-300 text-center py-4">데이터 없음</p>}
                </CardContent>
              </Card>

              {/* 국가별 감성 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-zinc-500">🌍 국가별 감성</CardTitle>
                </CardHeader>
                <CardContent>
                  <LangSentimentChart gameId={game_id} hasIos={!!ios} hasAndroid={!!android} />
                </CardContent>
              </Card>

              {/* 버전별 트렌드 */}
              {(ios || android) && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-zinc-500 flex items-center gap-1"><TrendingUp size={11} /> 버전별 트렌드</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ios && <div><p className="text-[10px] font-semibold text-sky-600 flex items-center gap-1 mb-2"><Smartphone size={9} /> iOS</p>{ios.versionTrend.length >= 2 ? <VersionTrendChart data={ios.versionTrend} /> : <p className="text-[10px] text-zinc-300 text-center py-3">버전 2개 이상 필요</p>}</div>}
                    {android && <div><p className="text-[10px] font-semibold text-teal-600 flex items-center gap-1 mb-2"><Play size={9} /> Android</p>{android.versionTrend.length >= 2 ? <VersionTrendChart data={android.versionTrend} /> : <p className="text-[10px] text-zinc-300 text-center py-3">버전 2개 이상 필요</p>}</div>}
                  </CardContent>
                </Card>
              )}

              {/* 월별 트렌드 */}
              {(ios || android) && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs text-zinc-500 flex items-center gap-1"><TrendingUp size={11} /> 월별 트렌드</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {ios && <div><p className="text-[10px] font-semibold text-sky-600 flex items-center gap-1 mb-2"><Smartphone size={9} /> iOS</p>{(ios.dateTrend ?? []).length >= 2 ? <VersionTrendChart data={ios.dateTrend ?? []} /> : <p className="text-[10px] text-zinc-300 text-center py-3">2개월 이상 필요</p>}</div>}
                    {android && <div><p className="text-[10px] font-semibold text-teal-600 flex items-center gap-1 mb-2"><Play size={9} /> Android</p>{(android.dateTrend ?? []).length >= 2 ? <VersionTrendChart data={android.dateTrend ?? []} /> : <p className="text-[10px] text-zinc-300 text-center py-3">2개월 이상 필요</p>}</div>}
                  </CardContent>
                </Card>
              )}

              {/* 분석 이력 타임라인 */}
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-zinc-500">분석 이력</CardTitle>
                </CardHeader>
                <CardContent>
                  <AnalysisTimeline gameId={game_id} />
                </CardContent>
              </Card>

            </div>
          </div>

        </div>
      </div>
    </div>
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
