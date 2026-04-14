"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SUPERCENT_GAMES, GENRES, type GamePreset } from "@/lib/presets";
import HistorySection from "@/components/HistorySection";
import CrossHistorySection from "@/components/CrossHistorySection";
import GameIcon from "@/components/GameIcon";
import Link from "next/link";
import {
  Search, BarChart3, ChevronRight, AlertTriangle,
  Loader2, GitCompare, Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// ─── Cross comparison dropdown ─────────────────────────────────────────────────
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
      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
      : "border-violet-400 bg-violet-50 text-violet-700";

  return (
    <div className="relative">
      <p className="text-[10px] text-zinc-400 mb-1.5">{label}</p>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all ${
          selected ? ring : "border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300"
        }`}
      >
        {selected ? (
          <>
            <GameIcon game={selected} size={26} />
            <span className="text-xs font-medium truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-xs">게임 선택...</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full mt-1 w-full min-w-[200px] bg-white border border-zinc-200 rounded-xl shadow-xl overflow-hidden">
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
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center py-4 text-xs text-zinc-400">검색 결과 없음</p>
              ) : (
                filtered.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => { onSelect(g); setOpen(false); setQ(""); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-zinc-50 transition-colors"
                  >
                    <GameIcon game={g} size={24} />
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

// ─── Main page ─────────────────────────────────────────────────────────────────
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
  const [analyzedGames, setAnalyzedGames] = useState<GamePreset[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ ios: PlatformProgress; android: PlatformProgress }>({
    ios: INIT_PROGRESS,
    android: INIT_PROGRESS,
  });

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set<string>((data.history ?? []).map((h: { app_id: string }) => h.app_id));
        const games = SUPERCENT_GAMES.filter(
          (g) => ids.has(g.ios_app_id) || ids.has(g.android_package)
        );
        setAnalyzedGames(games);
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
    const combined = (frac(analyzeProgress.ios) + frac(analyzeProgress.android)) / 2;
    return Math.round(15 + combined * 80);
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
    () =>
      SUPERCENT_GAMES.filter((g) => {
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
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.ios_app_id, platform: "ios", count: reviewCount }),
        }),
        fetch("/api/reviews/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.android_package, platform: "android", count: reviewCount }),
        }),
      ]);
      if (!iosFetch.ok) {
        const b = await iosFetch.json().catch(() => ({}));
        throw new Error(`[iOS 수집 실패] ${b.error ?? iosFetch.statusText}`);
      }
      if (!androidFetch.ok) {
        const b = await androidFetch.json().catch(() => ({}));
        throw new Error(`[Android 수집 실패] ${b.error ?? androidFetch.statusText}`);
      }

      setStep("analyzing");

      const [iosRes, androidRes] = await Promise.all([
        fetch("/api/reviews/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.ios_app_id, platform: "ios" }),
        }),
        fetch("/api/reviews/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.android_package, platform: "android" }),
        }),
      ]);
      if (!iosRes.ok) {
        const b = await iosRes.json().catch(() => ({}));
        throw new Error(`[iOS 분석 실패] ${b.error ?? iosRes.statusText}`);
      }
      if (!androidRes.ok) {
        const b = await androidRes.json().catch(() => ({}));
        throw new Error(`[Android 분석 실패] ${b.error ?? androidRes.statusText}`);
      }

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

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-white border-b border-zinc-100 px-5 py-3.5 flex items-center gap-3">
        <BarChart3 className="text-indigo-500 shrink-0" size={20} />
        <span className="font-bold text-base tracking-tight">Centiment</span>
        <span className="hidden sm:block text-zinc-200 text-sm">|</span>
        <span className="hidden sm:block text-zinc-400 text-sm">Supercent 게임 리뷰 감성 분석</span>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

        {/* ── 게임 선택 ─────────────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
            게임 선택 <span className="normal-case font-normal text-zinc-300 ml-1">({SUPERCENT_GAMES.length}개)</span>
          </p>

          {/* 검색 + 장르 필터 */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="게임 이름 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-shadow"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap items-center">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenreFilter(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    genreFilter === g
                      ? "bg-indigo-500 text-white shadow-sm"
                      : "bg-white border border-zinc-200 text-zinc-500 hover:border-indigo-300 hover:text-indigo-600"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* 게임 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {filteredGames.map((game) => {
              const active = selectedGame?.id === game.id;
              return (
                <button
                  key={game.id}
                  onClick={() => !isRunning && setSelectedGame(active ? null : game)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    active
                      ? "border-indigo-500 bg-indigo-50 shadow-sm ring-1 ring-indigo-200"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm"
                  }`}
                >
                  <GameIcon game={game} size={38} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-zinc-800 leading-tight line-clamp-2">{game.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                      <span className="text-amber-400">★</span>
                      <span>{game.store_rating.toFixed(1)}</span>
                      <span className="text-zinc-300">·</span>
                      <span>{game.genre}</span>
                    </p>
                  </div>
                  {active && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                      <Check size={9} className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
            {filteredGames.length === 0 && (
              <p className="col-span-full text-center py-12 text-sm text-zinc-400">
                검색 결과가 없습니다
              </p>
            )}
          </div>
        </section>

        {/* ── 분석 액션 (게임 선택 시 표시) ──────────────────────────────────── */}
        {selectedGame && (
          <section className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-5 shadow-sm">
            {/* 선택된 게임 정보 */}
            <div className="flex items-center gap-4">
              <GameIcon game={selectedGame} size={56} />
              <div>
                <p className="font-bold text-base">{selectedGame.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <Badge variant="secondary" className="text-[10px]">{selectedGame.genre}</Badge>
                  <span className="text-xs text-zinc-400">
                    <span className="text-amber-400">★</span> {selectedGame.store_rating.toFixed(1)}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {formatCount(selectedGame.rating_count)} 평가
                  </span>
                  <span className="text-xs text-zinc-400">{selectedGame.downloads} 다운로드</span>
                </div>
              </div>
            </div>

            {/* 수집 건수 */}
            <div>
              <p className="text-xs text-zinc-500 mb-2">수집 건수</p>
              <div className="flex gap-2 items-center">
                {([100, 200] as const).map((n) => (
                  <button
                    key={n}
                    onClick={() => !isRunning && setReviewCount(n)}
                    className={`px-4 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                      reviewCount === n
                        ? "bg-indigo-500 text-white border-indigo-500 shadow-sm"
                        : "bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-indigo-300"
                    }`}
                  >
                    최근 {n}건
                  </button>
                ))}
                {reviewCount === 200 && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-500 ml-1">
                    <AlertTriangle size={11} /> 분석 시간이 늘어납니다
                  </span>
                )}
              </div>
            </div>

            {/* 분석 버튼 */}
            <Button
              size="lg"
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-semibold"
              disabled={isRunning}
              onClick={handleStart}
            >
              {isRunning ? (
                <>
                  <Loader2 size={15} className="animate-spin mr-2" />
                  {step === "fetching" ? "iOS · Android 리뷰 수집 중..." : "Claude AI 분석 중..."}
                </>
              ) : (
                <>
                  iOS · Android 동시 분석
                  <ChevronRight size={16} className="ml-1" />
                </>
              )}
            </Button>

            {step !== "idle" && step !== "error" && (
              <div className="space-y-1">
                <Progress value={progressValue} className="h-1.5" />
                <p className="text-[11px] text-zinc-400 text-right">{progressLabel}</p>
              </div>
            )}

            {step === "error" && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 space-y-1.5">
                <p className="text-xs font-semibold text-rose-600">오류가 발생했습니다</p>
                <p className="text-xs text-rose-500 break-all">{errorMsg}</p>
                <button
                  onClick={() => setStep("idle")}
                  className="text-xs text-rose-400 underline underline-offset-2 hover:text-rose-600"
                >
                  닫고 다시 시도
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── 게임 간 비교 ──────────────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <GitCompare size={12} /> 게임 간 비교
          </p>
          <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <GameSelectDropdown
                label="첫 번째 게임"
                selected={crossG1}
                onSelect={setCrossG1}
                exclude={crossG2?.id}
                color="indigo"
                games={analyzedGames}
              />
              <GameSelectDropdown
                label="두 번째 게임"
                selected={crossG2}
                onSelect={setCrossG2}
                exclude={crossG1?.id}
                color="violet"
                games={analyzedGames}
              />
            </div>
            {crossG1 && crossG2 && crossG1.id !== crossG2.id ? (
              <Link
                href={`/cross?g1=${crossG1.id}&g2=${crossG2.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
              >
                <GitCompare size={14} />
                {crossG1.name} vs {crossG2.name} 비교하기
              </Link>
            ) : (
              <p className="text-[11px] text-zinc-300 text-center pb-1">
                {crossG1 && crossG2 && crossG1.id === crossG2.id
                  ? "서로 다른 게임을 선택해 주세요"
                  : "두 게임을 선택하면 비교 대시보드로 이동합니다"}
              </p>
            )}
          </div>
        </section>

        <CrossHistorySection />
        <HistorySection />
      </div>
    </main>
  );
}
