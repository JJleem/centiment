"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SUPERCENT_GAMES, GENRES, type GamePreset } from "@/lib/presets";
import HistorySection from "@/components/HistorySection";
import CrossHistorySection from "@/components/CrossHistorySection";
import WeeklySummaryCards from "@/components/WeeklySummaryCards";
import BatchAnalyzeSection from "@/components/BatchAnalyzeSection";
import GameIcon from "@/components/GameIcon";
import Link from "next/link";
import {
  Search, BarChart3, ChevronRight, AlertTriangle,
  Loader2, GitCompare, Check, Sparkles, ArrowRight, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { readAnalyzeStream } from "@/lib/utils";
import type { AnalyzeProgressEvent } from "@/types";

type Step = "idle" | "fetching" | "analyzing" | "done" | "error";
type PlatformPhase = "idle" | "classifying" | "summarizing" | "done";
interface PlatformProgress { phase: PlatformPhase; batchDone: number; batchTotal: number; }
const INIT_PROGRESS: PlatformProgress = { phase: "idle", batchDone: 0, batchTotal: 0 };

function formatCount(n: number): string {
  if (n >= 10000) return `${Math.floor(n / 10000)}만+`;
  if (n >= 1000) return `${Math.floor(n / 1000)}천+`;
  return String(n);
}

// ─── Cross comparison dropdown ────────────────────────────────────────────────
function GameSelectDropdown({
  label, selected, onSelect, exclude, color, games,
}: {
  label: string;
  selected: GamePreset | null;
  onSelect: (g: GamePreset) => void;
  exclude?: string;
  color: "indigo" | "violet";
  games: GamePreset[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = games.filter(
    (g) => g.id !== exclude && g.name.toLowerCase().includes(q.toLowerCase())
  );
  const ring =
    color === "indigo"
      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
      : "border-violet-300 bg-violet-50 text-violet-700";

  return (
    <div className="relative">
      <p className="text-[10px] text-zinc-400 mb-1">{label}</p>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all ${
          selected ? ring : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-zinc-300"
        }`}
      >
        {selected ? (
          <>
            <GameIcon game={selected} size={20} />
            <span className="text-[11px] font-medium truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-[11px]">선택...</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 w-full min-w-[180px] bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b border-zinc-100">
              <input
                autoFocus
                type="text"
                placeholder="검색..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full text-xs px-2.5 py-1.5 border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300"
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center py-4 text-xs text-zinc-400">검색 결과 없음</p>
              ) : (
                filtered.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { onSelect(g); setOpen(false); setQ(""); }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition-colors"
                  >
                    <GameIcon game={g} size={20} />
                    <span className="text-xs truncate flex-1 text-left">{g.name}</span>
                    <span className="text-[10px] text-zinc-400 shrink-0">★ {g.store_rating.toFixed(1)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState<GamePreset | null>(null);
  const [reviewCount, setReviewCount] = useState<100 | 200>(100);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string>("전체");
  const [crossG1, setCrossG1] = useState<GamePreset | null>(null);
  const [crossG2, setCrossG2] = useState<GamePreset | null>(null);
  const [crossG3, setCrossG3] = useState<GamePreset | null>(null);
  const [analyzedGames, setAnalyzedGames] = useState<GamePreset[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ ios: PlatformProgress; android: PlatformProgress }>({
    ios: INIT_PROGRESS, android: INIT_PROGRESS,
  });

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set<string>((data.history ?? []).map((h: { app_id: string }) => h.app_id));
        setAnalyzedGames(SUPERCENT_GAMES.filter((g) => ids.has(g.ios_app_id) || ids.has(g.android_package)));
      })
      .catch(() => {});
  }, []);

  const isRunning = step === "fetching" || step === "analyzing";

  const progressValue = useMemo(() => {
    if (step === "idle" || step === "error") return 0;
    if (step === "fetching") return 15;
    if (step === "done") return 100;
    const frac = (p: PlatformProgress) => {
      if (p.phase === "idle") return 0;
      if (p.phase === "classifying") return p.batchTotal > 0 ? (p.batchDone / p.batchTotal) * 0.85 : 0.05;
      if (p.phase === "summarizing") return 0.9;
      return 1;
    };
    return Math.round(15 + ((frac(analyzeProgress.ios) + frac(analyzeProgress.android)) / 2) * 80);
  }, [step, analyzeProgress]);

  const progressLabel = useMemo(() => {
    if (step === "fetching") return "iOS · Android 리뷰 수집 중...";
    if (step === "done") return "완료!";
    if (step !== "analyzing") return "";
    const label = (p: PlatformProgress, name: string) => {
      if (p.phase === "idle") return `${name} 준비 중`;
      if (p.phase === "classifying")
        return p.batchTotal > 0 ? `${name} 분류 중 (${p.batchDone}/${p.batchTotal})` : `${name} 분류 준비 중`;
      if (p.phase === "summarizing") return `${name} 요약 중`;
      return `${name} 완료`;
    };
    return `${label(analyzeProgress.ios, "iOS")} · ${label(analyzeProgress.android, "Android")}`;
  }, [step, analyzeProgress]);

  const filteredGames = useMemo(
    () => SUPERCENT_GAMES.filter((g) => {
      const matchSearch = g.name.toLowerCase().includes(search.toLowerCase());
      const matchGenre = genreFilter === "전체" || g.genre === genreFilter;
      return matchSearch && matchGenre;
    }),
    [search, genreFilter]
  );

  async function handleStart() {
    if (!selectedGame) return;
    setStep("fetching");
    setErrorMsg("");
    setAnalyzeProgress({ ios: INIT_PROGRESS, android: INIT_PROGRESS });

    try {
      const [iosFetch, androidFetch] = await Promise.all([
        fetch("/api/reviews/fetch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.ios_app_id, platform: "ios", count: reviewCount }),
        }),
        fetch("/api/reviews/fetch", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.android_package, platform: "android", count: reviewCount }),
        }),
      ]);
      if (!iosFetch.ok) { const b = await iosFetch.json().catch(() => ({})); throw new Error(`[iOS 수집 실패] ${b.error ?? iosFetch.statusText}`); }
      if (!androidFetch.ok) { const b = await androidFetch.json().catch(() => ({})); throw new Error(`[Android 수집 실패] ${b.error ?? androidFetch.statusText}`); }

      setStep("analyzing");

      const [iosRes, androidRes] = await Promise.all([
        fetch("/api/reviews/analyze", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.ios_app_id, platform: "ios" }),
        }),
        fetch("/api/reviews/analyze", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.android_package, platform: "android" }),
        }),
      ]);
      if (!iosRes.ok) { const b = await iosRes.json().catch(() => ({})); throw new Error(`[iOS 분석 실패] ${b.error ?? iosRes.statusText}`); }
      if (!androidRes.ok) { const b = await androidRes.json().catch(() => ({})); throw new Error(`[Android 분석 실패] ${b.error ?? androidRes.statusText}`); }

      const updateProgress = (platform: "ios" | "android") => (event: AnalyzeProgressEvent) => {
        setAnalyzeProgress((prev) => {
          const p = { ...prev[platform] };
          if (event.type === "start") { p.phase = "classifying"; p.batchTotal = event.total_batches; }
          else if (event.type === "batch") { p.phase = "classifying"; p.batchDone = event.done; p.batchTotal = event.total; }
          else if (event.type === "summarizing") { p.phase = "summarizing"; }
          else if (event.type === "done") { p.phase = "done"; }
          return { ...prev, [platform]: p };
        });
      };

      await Promise.all([
        readAnalyzeStream(iosRes, updateProgress("ios")),
        readAnalyzeStream(androidRes, updateProgress("android")),
      ]);

      setStep("done");
      setTimeout(() => router.push(`/result?game=${selectedGame.id}`), 500);
    } catch (e) {
      setStep("error");
      setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류");
    }
  }

  const isAnalyzed = selectedGame ? analyzedGames.some((g) => g.id === selectedGame.id) : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/20">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-sm shadow-indigo-200">
              <BarChart3 size={15} className="text-white" />
            </div>
            <span className="font-bold text-lg bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Centiment
            </span>
          </div>
          <span className="text-zinc-200 text-sm">|</span>
          <span className="hidden sm:block text-zinc-400 text-sm">Supercent 게임 리뷰 감성 분석</span>
          <a
            href="/plan.html"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          >
            기획서 확인하기
          </a>
          {analyzedGames.length > 0 && (
            <span className="ml-auto text-[11px] text-zinc-400 hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {analyzedGames.length}개 분석 완료
            </span>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-6 items-start">

          {/* ── LEFT: Game list ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Search + genre filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="게임 이름 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-sm border border-zinc-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap items-center">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenreFilter(g)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      genreFilter === g
                        ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-200"
                        : "bg-white border border-zinc-200 text-zinc-500 hover:border-indigo-200 hover:text-indigo-600 shadow-sm"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 주간 요약 카드 */}
            <WeeklySummaryCards />

            {/* Count label */}
            <div className="flex items-center justify-between px-0.5">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                게임 목록 <span className="normal-case font-normal text-zinc-300 ml-1">{filteredGames.length}개</span>
              </p>
              {analyzedGames.length > 0 && (
                <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  분석 완료 {analyzedGames.length}개
                </span>
              )}
            </div>

            {/* Game grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {filteredGames.map((game) => {
                const active = selectedGame?.id === game.id;
                const analyzed = analyzedGames.some((g) => g.id === game.id);
                return (
                  <button
                    key={game.id}
                    onClick={() => !isRunning && setSelectedGame(active ? null : game)}
                    className={`group relative flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all duration-200 ${
                      active
                        ? "border-indigo-400 bg-gradient-to-br from-indigo-50 to-violet-50 shadow-lg shadow-indigo-100/60 ring-2 ring-indigo-200/50"
                        : "border-zinc-100 bg-white hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 shadow-sm"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <GameIcon game={game} size={40} className="rounded-xl" />
                      {analyzed && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white shadow-sm" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-semibold leading-tight line-clamp-2 ${active ? "text-indigo-700" : "text-zinc-800"}`}>
                        {game.name}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                        <span className="text-amber-400">★</span>
                        <span>{game.store_rating.toFixed(1)}</span>
                        <span className="text-zinc-200">·</span>
                        <span>{game.genre}</span>
                      </p>
                    </div>
                    {active && (
                      <span className="absolute top-2.5 right-2.5 w-5 h-5 bg-gradient-to-br from-indigo-500 to-violet-500 rounded-full flex items-center justify-center shadow-sm">
                        <Check size={10} className="text-white" />
                      </span>
                    )}
                  </button>
                );
              })}
              {filteredGames.length === 0 && (
                <p className="col-span-full text-center py-16 text-sm text-zinc-400">
                  검색 결과가 없습니다
                </p>
              )}
            </div>

            {/* Mobile: action panel (shown below grid on small screens) */}
            <div className="lg:hidden">
              {selectedGame && (
                <div className="bg-white rounded-3xl shadow-xl shadow-zinc-200/60 border border-zinc-100 overflow-hidden">
                  <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-5 pt-5 pb-4 border-b border-zinc-100 flex items-center gap-4">
                    <div className="relative">
                      <GameIcon game={selectedGame} size={52} className="rounded-2xl shadow-md" />
                      {isAnalyzed && (
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                          <Check size={9} className="text-white" />
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-base text-zinc-900">{selectedGame.name}</p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        ★ {selectedGame.store_rating.toFixed(1)} · {formatCount(selectedGame.rating_count)} 평가
                      </p>
                    </div>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex gap-2">
                      {([100, 200] as const).map((n) => (
                        <button
                          key={n}
                          onClick={() => !isRunning && setReviewCount(n)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                            reviewCount === n
                              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent shadow-md shadow-indigo-200"
                              : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-indigo-200"
                          }`}
                        >
                          최근 {n}건
                        </button>
                      ))}
                    </div>
                    <button
                      disabled={isRunning}
                      onClick={handleStart}
                      className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {isRunning ? <><Loader2 size={14} className="animate-spin" />{step === "fetching" ? "수집 중..." : "분석 중..."}</> : <><Zap size={14} />iOS · Android 동시 분석</>}
                    </button>
                    {step !== "idle" && step !== "error" && (
                      <div className="space-y-1">
                        <Progress value={progressValue} className="h-1.5" />
                        <p className="text-[11px] text-zinc-400 text-right">{progressLabel}</p>
                      </div>
                    )}
                    {step === "error" && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                        <p className="text-xs font-semibold text-rose-600">오류 발생</p>
                        <p className="text-xs text-rose-500 break-all mt-1">{errorMsg}</p>
                        <button onClick={() => setStep("idle")} className="text-xs text-rose-400 underline mt-1">닫기</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Sticky action panel (desktop only) ───────────────────── */}
          <div className="hidden lg:block w-80 xl:w-88 shrink-0">
            <div className="sticky top-24 space-y-4">

              {/* Selected game panel */}
              <div className="bg-white rounded-3xl shadow-xl shadow-zinc-200/60 border border-zinc-100 overflow-hidden">
                {selectedGame ? (
                  <>
                    {/* Hero */}
                    <div className="bg-gradient-to-br from-indigo-50 via-white to-violet-50 px-6 pt-6 pb-5 border-b border-zinc-100">
                      <div className="flex items-start gap-4">
                        <div className="relative shrink-0">
                          <GameIcon game={selectedGame} size={64} className="rounded-2xl shadow-lg shadow-indigo-100" />
                          {isAnalyzed && (
                            <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-400 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                              <Check size={10} className="text-white" />
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-base text-zinc-900 leading-snug">{selectedGame.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-medium">
                              {selectedGame.genre}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1.5">
                            <span className="text-amber-400">★</span> {selectedGame.store_rating.toFixed(1)}
                            <span className="mx-1 text-zinc-200">·</span>
                            {formatCount(selectedGame.rating_count)} 평가
                            <span className="mx-1 text-zinc-200">·</span>
                            {selectedGame.downloads}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="px-5 py-5 space-y-4">
                      {/* Count selector */}
                      <div>
                        <p className="text-xs font-medium text-zinc-500 mb-2">수집 건수</p>
                        <div className="flex gap-2">
                          {([100, 200] as const).map((n) => (
                            <button
                              key={n}
                              onClick={() => !isRunning && setReviewCount(n)}
                              className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                                reviewCount === n
                                  ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white border-transparent shadow-md shadow-indigo-200"
                                  : "bg-zinc-50 text-zinc-500 border-zinc-200 hover:border-indigo-200 hover:text-indigo-600"
                              }`}
                            >
                              최근 {n}건
                            </button>
                          ))}
                        </div>
                        {reviewCount === 200 && (
                          <p className="flex items-center gap-1 text-[11px] text-amber-500 mt-1.5">
                            <AlertTriangle size={10} /> 분석 시간이 늘어납니다
                          </p>
                        )}
                      </div>

                      {/* Analyze button */}
                      <button
                        disabled={isRunning}
                        onClick={handleStart}
                        className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
                      >
                        {isRunning ? (
                          <><Loader2 size={14} className="animate-spin" />{step === "fetching" ? "리뷰 수집 중..." : "AI 분석 중..."}</>
                        ) : (
                          <><Zap size={14} />iOS · Android 동시 분석</>
                        )}
                      </button>

                      {/* Progress */}
                      {step !== "idle" && step !== "error" && (
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>{progressLabel}</span>
                            <span className="font-medium">{progressValue}%</span>
                          </div>
                          <Progress value={progressValue} className="h-1.5" />
                        </div>
                      )}

                      {/* Error */}
                      {step === "error" && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 space-y-1.5">
                          <p className="text-xs font-semibold text-rose-600">오류가 발생했습니다</p>
                          <p className="text-xs text-rose-500 break-all">{errorMsg}</p>
                          <button onClick={() => setStep("idle")} className="text-xs text-rose-400 underline underline-offset-2 hover:text-rose-600">
                            닫고 다시 시도
                          </button>
                        </div>
                      )}

                      {/* Result link */}
                      {isAnalyzed && step === "idle" && (
                        <Link
                          href={`/result?game=${selectedGame.id}`}
                          className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl border border-zinc-200 text-xs font-medium text-zinc-500 hover:border-indigo-200 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                        >
                          기존 분석 결과 보기 <ArrowRight size={12} />
                        </Link>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="px-6 py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100 flex items-center justify-center mx-auto mb-4 shadow-inner">
                      <Sparkles size={22} className="text-zinc-300" />
                    </div>
                    <p className="text-sm font-semibold text-zinc-400">게임을 선택하세요</p>
                    <p className="text-xs text-zinc-300 mt-1.5 leading-relaxed">
                      좌측 목록에서<br />분석할 게임을 클릭하세요
                    </p>
                  </div>
                )}
              </div>

              {/* Compare panel */}
              <div className="bg-white rounded-3xl shadow-xl shadow-zinc-200/60 border border-zinc-100">
                <div className="px-5 py-3.5 border-b border-zinc-50 flex items-center gap-2 rounded-t-3xl">
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                    <GitCompare size={11} className="text-violet-500" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-600">게임 간 비교</p>
                  {analyzedGames.length < 2 && (
                    <span className="ml-auto text-[10px] text-zinc-300">분석된 게임 2개 이상 필요</span>
                  )}
                </div>
                <div className="px-5 py-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <GameSelectDropdown
                      label="게임 1"
                      selected={crossG1}
                      onSelect={setCrossG1}
                      exclude={crossG2?.id}
                      color="indigo"
                      games={analyzedGames}
                    />
                    <GameSelectDropdown
                      label="게임 2"
                      selected={crossG2}
                      onSelect={setCrossG2}
                      exclude={crossG1?.id}
                      color="violet"
                      games={analyzedGames}
                    />
                  </div>
                  <GameSelectDropdown
                    label="게임 3 (선택)"
                    selected={crossG3}
                    onSelect={setCrossG3}
                    exclude={crossG1?.id}
                    color="violet"
                    games={analyzedGames.filter((g) => g.id !== crossG1?.id && g.id !== crossG2?.id)}
                  />
                  {crossG1 && crossG2 && crossG1.id !== crossG2.id ? (
                    <Link
                      href={`/cross?g1=${crossG1.id}&g2=${crossG2.id}${crossG3 ? `&g3=${crossG3.id}` : ""}`}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 text-xs font-semibold text-indigo-600 hover:from-indigo-100 hover:to-violet-100 hover:border-indigo-200 transition-all"
                    >
                      <GitCompare size={13} />
                      {crossG3 ? "3게임 비교" : `${crossG1.name} vs ${crossG2.name} 비교`}
                    </Link>
                  ) : (
                    <p className="text-[11px] text-zinc-300 text-center py-1">
                      {crossG1 && crossG2 && crossG1.id === crossG2.id
                        ? "서로 다른 게임을 선택해 주세요"
                        : "두 게임을 선택하면 비교 시작"}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* ── History (full width below) ────────────────────────────────────── */}
        <div className="mt-12 space-y-8">
          <BatchAnalyzeSection />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <CrossHistorySection />
            <HistorySection />
          </div>
        </div>

      </div>
    </div>
  );
}
