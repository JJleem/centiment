import { Suspense } from "react";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, TrendingUp, AlertCircle, Minus, Tag, GitCompare, BarChart2, Sparkles,
} from "lucide-react";
import { SUPERCENT_GAMES, type GamePreset } from "@/lib/presets";
import GameIcon from "@/components/GameIcon";
import { buildCrossComparePrompt } from "@/lib/prompts/analyze";
import { supabaseAdmin } from "@/lib/supabase";
import ReanalyzeCrossButton from "@/components/ReanalyzeCrossButton";
import type { Sentiment, ReviewCategory } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnalysisRow { sentiment: Sentiment; category: ReviewCategory; keywords: string[]; }

interface GameStats {
  game: GamePreset;
  total: number;
  sentimentCount: Record<Sentiment, number>;
  sortedCategories: [string, number][];
  topKeywords: string[];
}

// ─── Data fetching ─────────────────────────────────────────────────────────────
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

async function getGameStats(game: GamePreset): Promise<GameStats | null> {
  const supabase = getSupabase();
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
  for (const r of rows) for (const kw of r.keywords) kwFreq[kw] = (kwFreq[kw] ?? 0) + 1;
  const topKeywords = Object.entries(kwFreq).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([kw]) => kw);
  return { game, total: rows.length, sentimentCount, sortedCategories, topKeywords };
}

async function getOrCreateCrossInsight(ids: string[], statsList: GameStats[]): Promise<string> {
  const [g1, g2] = ids;

  // 2게임일 때만 DB 캐시 사용
  if (ids.length === 2) {
    const { data } = await supabaseAdmin
      .from("cross_comparison_history")
      .select("insight")
      .eq("game1_id", g1)
      .eq("game2_id", g2)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.insight) return data.insight;
  }

  const toInput = (s: GameStats) => ({
    name: s.game.name,
    total: s.total,
    positive: s.sentimentCount.positive,
    negative: s.sentimentCount.negative,
    topCategories: s.sortedCategories.slice(0, 3).map(([c]) => c),
    topKeywords: s.topKeywords.slice(0, 8),
  });

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: buildCrossComparePrompt(statsList.map(toInput)) }],
  });
  console.log(`[cross][sonnet] input:${res.usage.input_tokens} output:${res.usage.output_tokens}`);
  const insight = res.content[0].type === "text" ? res.content[0].text.trim() : "";

  // 2게임일 때만 저장
  if (ids.length === 2) {
    await supabaseAdmin.from("cross_comparison_history").insert({
      game1_id: g1, game2_id: g2,
      game1_name: statsList[0].game.name, game2_name: statsList[1].game.name,
      insight,
    });
  }

  return insight;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const SENTIMENT_CONFIG: Record<Sentiment, { label: string; barColor: string; textColor: string; icon: React.ReactNode }> = {
  positive: { label: "긍정", barColor: "bg-emerald-500", textColor: "text-emerald-600", icon: <TrendingUp size={13} /> },
  negative: { label: "부정", barColor: "bg-rose-500",    textColor: "text-rose-600",    icon: <AlertCircle size={13} /> },
  neutral:  { label: "중립", barColor: "bg-zinc-400",    textColor: "text-zinc-500",    icon: <Minus size={13} /> },
};

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  gameplay: "게임플레이", ui: "UI/UX", performance: "성능",
  monetization: "결제/광고", content: "콘텐츠", bug: "버그", other: "기타",
};
const ALL_CATEGORIES: ReviewCategory[] = ["gameplay", "ui", "performance", "monetization", "content", "bug", "other"];

const PALETTE = [
  { bg: "bg-indigo-50 border-indigo-100", bar: "bg-indigo-400", text: "text-indigo-600", kw: "bg-indigo-50 text-indigo-700 border-indigo-100", kwShared: "bg-indigo-100 text-indigo-800 border-indigo-200 font-medium" },
  { bg: "bg-violet-50 border-violet-100", bar: "bg-violet-400", text: "text-violet-600", kw: "bg-violet-50 text-violet-700 border-violet-100", kwShared: "bg-violet-100 text-violet-800 border-violet-200 font-medium" },
  { bg: "bg-fuchsia-50 border-fuchsia-100", bar: "bg-fuchsia-400", text: "text-fuchsia-600", kw: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100", kwShared: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 font-medium" },
];

// ─── SentimentColumn ──────────────────────────────────────────────────────────
function SentimentColumn({ stats, palette }: { stats: GameStats; palette: typeof PALETTE[number] }) {
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${palette.bg}`}>
      <div className={`flex items-center gap-2 text-sm font-semibold ${palette.text}`}>
        <GameIcon game={stats.game} size={22} />
        <span className="truncate">{stats.game.name}</span>
        <span className="ml-auto text-xs font-normal text-zinc-400 shrink-0">{stats.total}건</span>
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
async function CrossDashboard({ ids }: { ids: string[] }) {
  const games = ids.map((id) => SUPERCENT_GAMES.find((g) => g.id === id)).filter(Boolean) as GamePreset[];
  if (games.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-400 gap-3">
        <p className="text-sm">게임을 찾을 수 없습니다.</p>
        <Link href="/" className="text-indigo-500 text-sm underline underline-offset-2">메인으로 돌아가기</Link>
      </div>
    );
  }

  const statsList = await Promise.all(
    games.map((g) =>
      unstable_cache(
        () => getGameStats(g),
        [`game-stats-${g.id}`],
        { revalidate: 3600, tags: [`analysis-${g.ios_app_id}`, `analysis-${g.android_package}`] }
      )()
    )
  );

  if (statsList.every((s) => !s)) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-10">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors"><ArrowLeft size={20} /></Link>
            <h1 className="text-xl font-bold">게임 비교</h1>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
            <BarChart2 size={36} className="text-zinc-300" />
            <p className="text-sm">분석 데이터가 없습니다. 먼저 분석을 실행해 주세요.</p>
            <Link href="/" className="text-indigo-500 text-sm underline underline-offset-2 mt-2">메인으로 돌아가기</Link>
          </div>
        </div>
      </main>
    );
  }

  const validStats = statsList.filter(Boolean) as GameStats[];
  const crossInsight = validStats.length >= 2
    ? await getOrCreateCrossInsight(ids, validStats)
    : null;

  // 카테고리 맵 배열
  const catMaps = statsList.map((s) => Object.fromEntries(s?.sortedCategories ?? []));
  const globalMax = Math.max(...catMaps.flatMap((m) => Object.values(m)), 1);

  // 공통 키워드 (모든 게임에 있는 키워드)
  const kwSets = statsList.map((s) => new Set(s?.topKeywords ?? []));
  const allKws = statsList.flatMap((s) => s?.topKeywords ?? []);
  const uniqueKws = [...new Set(allKws)];
  const sharedKw = new Set(uniqueKws.filter((kw) => kwSets.every((set) => set.has(kw))));

  // 긍정률 순위
  const pctList = statsList.map((s) => s ? Math.round((s.sentimentCount.positive / s.total) * 100) : null);
  const maxPct = Math.max(...(pctList.filter((p) => p !== null) as number[]));
  const winner = games[pctList.indexOf(maxPct)];

  const [g1, g2, g3] = ids;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* 헤더 */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="text-zinc-400 hover:text-zinc-700 transition-colors mr-1">
            <ArrowLeft size={20} />
          </Link>
          {games.map((g, i) => (
            <div key={g.id} className="flex items-center gap-2">
              {i > 0 && (
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <GitCompare size={11} /> vs
                </Badge>
              )}
              <GameIcon game={g} size={28} />
              <span className={`text-base font-bold ${PALETTE[i]?.text ?? ""}`}>{g.name}</span>
            </div>
          ))}
          <div className="ml-auto flex flex-wrap gap-2 text-xs text-zinc-400">
            {games.map((g, i) => (
              <Link key={g.id} href={`/result?game=${g.id}`} className={`hover:${PALETTE[i]?.text ?? "text-zinc-600"} transition-colors`}>
                {g.name} 상세 →
              </Link>
            ))}
          </div>
        </div>

        {/* AI 인사이트 */}
        {crossInsight && (
          <Card className="border-amber-100 bg-amber-50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-2">
                <Sparkles size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-900 leading-relaxed">{crossInsight}</p>
                <ReanalyzeCrossButton g1={g1} g2={g2} g3={g3} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 감성 비교 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">감성 분석 비교 (iOS + Android 통합)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`grid gap-4 ${games.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              {statsList.map((stats, i) => (
                stats
                  ? <SentimentColumn key={games[i].id} stats={stats} palette={PALETTE[i]} />
                  : <div key={i} className="rounded-xl border p-4 text-center text-xs text-zinc-300">데이터 없음</div>
              ))}
            </div>
            {winner && (
              <p className="text-xs text-center text-emerald-600">
                <span className="font-semibold">{winner.name}</span>이 긍정률 최고 ({maxPct}%)
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
            <div className="flex items-center flex-wrap gap-4 text-xs text-zinc-400">
              {games.map((g, i) => (
                <span key={g.id} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${PALETTE[i].bar} inline-block`} />
                  {g.name}
                </span>
              ))}
            </div>
            {ALL_CATEGORIES.map((cat) => {
              const counts = catMaps.map((m) => m[cat] ?? 0);
              if (counts.every((c) => c === 0)) return null;
              return (
                <div key={cat} className="space-y-1">
                  <span className="text-xs text-zinc-500">{CATEGORY_LABEL[cat]}</span>
                  {counts.map((count, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                        <div className={`h-full ${PALETTE[i].bar} rounded-full`} style={{ width: `${Math.round((count / globalMax) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-400 w-5 text-right">{count}</span>
                    </div>
                  ))}
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
            <div className={`grid gap-6 ${games.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {statsList.map((stats, i) => {
                const p = PALETTE[i];
                return (
                  <div key={games[i].id}>
                    <p className={`text-xs font-semibold ${p.text} mb-2`}>{games[i].name}</p>
                    {stats ? (
                      <div className="flex flex-wrap gap-1.5">
                        {stats.topKeywords.map((kw) => (
                          <Badge key={kw} variant="secondary" className={`text-xs font-normal ${sharedKw.has(kw) ? p.kwShared : p.kw}`}>
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    ) : <p className="text-xs text-zinc-300">데이터 없음</p>}
                  </div>
                );
              })}
            </div>
            {sharedKw.size > 0 && (
              <p className="text-[10px] text-zinc-400">진한 배지는 모든 게임 공통 키워드입니다.</p>
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
  searchParams: Promise<{ g1?: string; g2?: string; g3?: string }>;
}) {
  const params = await searchParams;
  const g1 = params.g1 ?? "";
  const g2 = params.g2 ?? "";
  const g3 = params.g3 ?? "";

  if (!g1 || !g2) {
    return (
      <main className="min-h-screen flex items-center justify-center text-zinc-400">
        <p className="text-sm">g1, g2 파라미터가 필요합니다.</p>
      </main>
    );
  }

  const ids = [g1, g2, ...(g3 ? [g3] : [])].filter((id, idx, arr) => arr.indexOf(id) === idx);

  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center text-zinc-400 text-sm">
        비교 데이터 로딩 중...
      </main>
    }>
      <CrossDashboard ids={ids} />
    </Suspense>
  );
}
