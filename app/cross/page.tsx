import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  TrendingUp,
  AlertCircle,
  Minus,
  Tag,
  GitCompare,
  BarChart2,
} from "lucide-react";
import { SUPERCENT_GAMES, type GamePreset } from "@/lib/presets";
import GameIcon from "@/components/GameIcon";
import type { Sentiment, ReviewCategory } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisRow {
  sentiment: Sentiment;
  category: ReviewCategory;
  keywords: string[];
}

interface GameStats {
  game: GamePreset;
  total: number;
  sentimentCount: Record<Sentiment, number>;
  sortedCategories: [string, number][];
  topKeywords: string[];
}

// ─── Supabase ─────────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getGameStats(game: GamePreset): Promise<GameStats | null> {
  const supabase = getSupabase();

  // iOS + Android 분석 결과를 한번에 조회
  const { data, error } = await supabase
    .from("review_analysis")
    .select("sentiment, category, keywords")
    .in("app_id", [game.ios_app_id, game.android_package]);

  if (error || !data || data.length === 0) return null;

  const rows = data as AnalysisRow[];

  const sentimentCount: Record<Sentiment, number> = { positive: 0, negative: 0, neutral: 0 };
  for (const r of rows) sentimentCount[r.sentiment]++;

  const categoryCount: Record<string, number> = {};
  for (const r of rows) categoryCount[r.category] = (categoryCount[r.category] ?? 0) + 1;
  const sortedCategories = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);

  const kwFreq: Record<string, number> = {};
  for (const r of rows) {
    for (const kw of r.keywords) kwFreq[kw] = (kwFreq[kw] ?? 0) + 1;
  }
  const topKeywords = Object.entries(kwFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw]) => kw);

  return { game, total: rows.length, sentimentCount, sortedCategories, topKeywords };
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

// 게임별 색상
const GAME_COLORS = ["indigo", "violet"] as const;
type GameColor = typeof GAME_COLORS[number];

const COLOR_MAP: Record<GameColor, { bg: string; bar: string; text: string; badge: string }> = {
  indigo: { bg: "bg-indigo-50 border-indigo-100", bar: "bg-indigo-400", text: "text-indigo-600", badge: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  violet: { bg: "bg-violet-50 border-violet-100", bar: "bg-violet-400", text: "text-violet-600", badge: "bg-violet-50 text-violet-700 border-violet-100" },
};

// ─── Components ───────────────────────────────────────────────────────────────
function SentimentColumn({ stats, color }: { stats: GameStats; color: GameColor }) {
  const c = COLOR_MAP[color];
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${c.bg}`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${c.text}`}>
        <GameIcon game={stats.game} size={24} />
        {stats.game.name}
        <span className="ml-auto text-xs font-normal text-zinc-400">{stats.total}건</span>
      </div>
      {(["positive", "negative", "neutral"] as Sentiment[]).map((s) => {
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
      })}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
async function CrossDashboard({ g1, g2 }: { g1: string; g2: string }) {
  if (g1 === g2) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-400 gap-3">
        <p className="text-sm">같은 게임을 선택했습니다. 다른 게임을 선택해 주세요.</p>
        <Link href="/" className="text-indigo-500 text-sm underline underline-offset-2">메인으로 돌아가기</Link>
      </div>
    );
  }

  const game1 = SUPERCENT_GAMES.find((g) => g.id === g1);
  const game2 = SUPERCENT_GAMES.find((g) => g.id === g2);

  if (!game1 || !game2) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-400 gap-3">
        <p className="text-sm">게임을 찾을 수 없습니다.</p>
        <Link href="/" className="text-indigo-500 text-sm underline underline-offset-2">메인으로 돌아가기</Link>
      </div>
    );
  }

  const [stats1, stats2] = await Promise.all([
    getGameStats(game1),
    getGameStats(game2),
  ]);

  if (!stats1 && !stats2) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold">게임 비교</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
            <BarChart2 size={36} className="text-zinc-300" />
            <p className="text-sm">두 게임 모두 분석 데이터가 없습니다. 먼저 분석을 실행해 주세요.</p>
            <Link href="/" className="text-indigo-500 text-sm underline underline-offset-2 mt-2">메인으로 돌아가기</Link>
          </div>
        </div>
      </main>
    );
  }

  // 공통 키워드
  const kw1Set = new Set(stats1?.topKeywords ?? []);
  const kw2Set = new Set(stats2?.topKeywords ?? []);
  const sharedKw = new Set([...(stats1?.topKeywords ?? [])].filter((k) => kw2Set.has(k)));

  // 카테고리 max
  const cat1Map = Object.fromEntries(stats1?.sortedCategories ?? []);
  const cat2Map = Object.fromEntries(stats2?.sortedCategories ?? []);
  const globalMax = Math.max(...Object.values(cat1Map), ...Object.values(cat2Map), 1);

  // 긍정률 비교
  const pct1 = stats1 ? Math.round((stats1.sentimentCount.positive / stats1.total) * 100) : null;
  const pct2 = stats2 ? Math.round((stats2.sentimentCount.positive / stats2.total) * 100) : null;
  const winner = pct1 !== null && pct2 !== null
    ? pct1 > pct2 ? game1 : pct2 > pct1 ? game2 : null
    : null;
  const diff = pct1 !== null && pct2 !== null ? Math.abs(pct1 - pct2) : 0;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <GameIcon game={game1} size={32} />
          <h1 className="text-xl font-bold">{game1.name}</h1>
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            <GitCompare size={11} /> vs
          </Badge>
          <GameIcon game={game2} size={32} />
          <h1 className="text-xl font-bold">{game2.name}</h1>
          <div className="ml-auto flex gap-2 text-xs text-zinc-400">
            <Link href={`/result?game=${g1}`} className="hover:text-indigo-500 transition-colors">{game1.name} 상세 →</Link>
            <span>·</span>
            <Link href={`/result?game=${g2}`} className="hover:text-violet-500 transition-colors">{game2.name} 상세 →</Link>
          </div>
        </div>

        {/* 감성 비교 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">감성 분석 비교 (iOS + Android 통합)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {stats1
                ? <SentimentColumn stats={stats1} color="indigo" />
                : <div className="rounded-xl border p-4 text-center text-xs text-zinc-300">데이터 없음</div>
              }
              {stats2
                ? <SentimentColumn stats={stats2} color="violet" />
                : <div className="rounded-xl border p-4 text-center text-xs text-zinc-300">데이터 없음</div>
              }
            </div>
            {winner && diff > 0 && (
              <p className="text-xs text-center text-emerald-600">
                <span className="font-semibold">{winner.name}</span>이 긍정률 {diff}%p 더 높음
              </p>
            )}
          </CardContent>
        </Card>

        {/* 카테고리 비교 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">카테고리별 비교</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                {game1.name}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
                {game2.name}
              </span>
            </div>
            {ALL_CATEGORIES.map((cat) => {
              const c1 = cat1Map[cat] ?? 0;
              const c2 = cat2Map[cat] ?? 0;
              if (c1 === 0 && c2 === 0) return null;
              return (
                <div key={cat} className="space-y-1">
                  <span className="text-xs text-zinc-500">{CATEGORY_LABEL[cat]}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.round((c1 / globalMax) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-400 w-5 text-right">{c1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.round((c2 / globalMax) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-400 w-5 text-right">{c2}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 키워드 비교 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Tag size={13} /> 주요 키워드 비교
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-indigo-600 mb-2">{game1.name}</p>
                {stats1 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {stats1.topKeywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className={`text-xs font-normal ${
                        sharedKw.has(kw)
                          ? "bg-indigo-100 text-indigo-800 border-indigo-200 font-medium"
                          : "bg-indigo-50 text-indigo-700 border-indigo-100"
                      }`}>
                        {kw}
                      </Badge>
                    ))}
                  </div>
                ) : <p className="text-xs text-zinc-300">데이터 없음</p>}
              </div>
              <div>
                <p className="text-xs font-semibold text-violet-600 mb-2">{game2.name}</p>
                {stats2 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {stats2.topKeywords.map((kw) => (
                      <Badge key={kw} variant="secondary" className={`text-xs font-normal ${
                        sharedKw.has(kw)
                          ? "bg-violet-100 text-violet-800 border-violet-200 font-medium"
                          : "bg-violet-50 text-violet-700 border-violet-100"
                      }`}>
                        {kw}
                      </Badge>
                    ))}
                  </div>
                ) : <p className="text-xs text-zinc-300">데이터 없음</p>}
              </div>
            </div>
            {sharedKw.size > 0 && (
              <p className="text-[10px] text-zinc-400">진한 배지는 두 게임 공통 키워드입니다.</p>
            )}
          </CardContent>
        </Card>

      </div>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CrossPage({
  searchParams,
}: {
  searchParams: Promise<{ g1?: string; g2?: string }>;
}) {
  const params = await searchParams;
  const g1 = params.g1 ?? "";
  const g2 = params.g2 ?? "";

  if (!g1 || !g2) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-400">
        <p className="text-sm">g1, g2 파라미터가 필요합니다.</p>
      </main>
    );
  }

  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        비교 데이터 로딩 중...
      </main>
    }>
      <CrossDashboard g1={g1} g2={g2} />
    </Suspense>
  );
}
