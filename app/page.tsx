"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, BarChart3, ChevronRight, AlertTriangle, GitCompare } from "lucide-react";
import { SUPERCENT_GAMES, type GamePreset } from "@/lib/presets";
import HistorySection from "@/components/HistorySection";
import GameIcon from "@/components/GameIcon";
import Link from "next/link";

type Step = "idle" | "fetching" | "analyzing" | "done" | "error";

const STEP_PROGRESS: Record<Step, number> = {
  idle:      0,
  fetching:  30,
  analyzing: 70,
  done:      100,
  error:     0,
};

const STEP_LABEL: Record<Step, string> = {
  idle:      "",
  fetching:  "iOS · Android 리뷰 수집 중...",
  analyzing: "Claude AI 분석 중...",
  done:      "완료!",
  error:     "오류가 발생했습니다.",
};

const COUNT_OPTIONS = [
  { value: 100, label: "최근 100건" },
  { value: 200, label: "최근 200건" },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState<GamePreset | null>(null);
  const [reviewCount, setReviewCount] = useState<100 | 200>(100);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [crossG1, setCrossG1] = useState<GamePreset | null>(null);
  const [crossG2, setCrossG2] = useState<GamePreset | null>(null);

  const isRunning = step === "fetching" || step === "analyzing";

  async function handleStart() {
    if (!selectedGame) return;
    setStep("fetching");
    setErrorMsg("");

    try {
      // iOS + Android 동시 수집
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
        const body = await iosFetch.json().catch(() => ({}));
        throw new Error(`[iOS 수집 실패] ${body.error ?? iosFetch.statusText}`);
      }
      if (!androidFetch.ok) {
        const body = await androidFetch.json().catch(() => ({}));
        throw new Error(`[Android 수집 실패] ${body.error ?? androidFetch.statusText}`);
      }

      // iOS + Android 동시 분석
      setStep("analyzing");
      const [iosAnalyze, androidAnalyze] = await Promise.all([
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

      if (!iosAnalyze.ok) {
        const body = await iosAnalyze.json().catch(() => ({}));
        throw new Error(`[iOS 분석 실패] ${body.error ?? iosAnalyze.statusText}`);
      }
      if (!androidAnalyze.ok) {
        const body = await androidAnalyze.json().catch(() => ({}));
        throw new Error(`[Android 분석 실패] ${body.error ?? androidAnalyze.statusText}`);
      }

      setStep("done");
      setTimeout(() => {
        router.push(`/result?game=${selectedGame.id}`);
      }, 600);
    } catch (e) {
      setStep("error");
      setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-4 py-16">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BarChart3 className="text-indigo-500" size={28} />
          <h1 className="text-3xl font-bold tracking-tight">Centiment</h1>
        </div>
        <p className="text-zinc-500 text-sm">
          Supercent 게임 리뷰 감성 분석 대시보드
        </p>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        {/* 게임 선택 */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            1. 게임 선택
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SUPERCENT_GAMES.map((game) => {
              const active = selectedGame?.id === game.id;
              return (
                <Card
                  key={game.id}
                  onClick={() => !isRunning && setSelectedGame(game)}
                  className={`cursor-pointer transition-all border-2 ${
                    active
                      ? "border-indigo-500 shadow-md"
                      : "border-transparent hover:border-zinc-300"
                  }`}
                >
                  <CardHeader className="pb-3 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <GameIcon game={game} size={48} />
                      <Badge variant="secondary" className="text-[10px] mt-0.5">
                        {game.genre}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm mt-2">{game.name}</CardTitle>
                    <CardDescription className="text-xs space-y-0.5">
                      <span className="flex items-center gap-1">
                        <span className="text-amber-400">★</span>
                        <span>{game.store_rating.toFixed(1)}</span>
                        <span className="text-zinc-300">·</span>
                        <span>{(game.rating_count / 10000).toFixed(0)}만+</span>
                      </span>
                      <span className="block">{game.downloads} 다운로드</span>
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 수집 건수 */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            2. 수집 건수
          </p>
          <div className="flex gap-2">
            {COUNT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => !isRunning && setReviewCount(opt.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  reviewCount === opt.value
                    ? "bg-indigo-500 text-white border-indigo-500"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {reviewCount === 200 && (
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle size={12} />
              건수가 많을수록 분석 시간이 길어질 수 있습니다.
            </div>
          )}
        </section>

        {/* 분석 시작 */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            3. 분석 시작
          </p>
          <p className="text-xs text-zinc-400 mb-3">
            iOS · Android 양쪽 리뷰를 동시에 수집하여 플랫폼 비교 분석합니다.
          </p>
          <Button
            size="lg"
            className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
            disabled={!selectedGame || isRunning}
            onClick={handleStart}
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                {STEP_LABEL[step]}
              </>
            ) : (
              <>
                iOS · Android 동시 분석
                <ChevronRight size={16} className="ml-1" />
              </>
            )}
          </Button>

          {step !== "idle" && step !== "error" && (
            <div className="mt-4 space-y-1.5">
              <Progress value={STEP_PROGRESS[step]} className="h-1.5" />
              <p className="text-xs text-zinc-400 text-right">{STEP_LABEL[step]}</p>
            </div>
          )}

          {step === "error" && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 space-y-2">
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

        {/* 게임 간 비교 */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <GitCompare size={12} />
            게임 간 비교
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* G1 */}
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-400">첫 번째 게임</p>
              <div className="grid grid-cols-3 gap-1.5">
                {SUPERCENT_GAMES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setCrossG1(game)}
                    className={`flex flex-col items-center py-2 px-1 rounded-lg border text-xs transition-all ${
                      crossG1?.id === game.id
                        ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        : "border-zinc-200 hover:border-zinc-300 text-zinc-500"
                    }`}
                  >
                    <GameIcon game={game} size={28} />
                    <span className="truncate w-full text-center mt-0.5 text-[10px]">{game.name}</span>
                  </button>
                ))}
              </div>
            </div>
            {/* G2 */}
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-400">두 번째 게임</p>
              <div className="grid grid-cols-3 gap-1.5">
                {SUPERCENT_GAMES.map((game) => (
                  <button
                    key={game.id}
                    onClick={() => setCrossG2(game)}
                    className={`flex flex-col items-center py-2 px-1 rounded-lg border text-xs transition-all ${
                      crossG2?.id === game.id
                        ? "border-violet-400 bg-violet-50 text-violet-700"
                        : "border-zinc-200 hover:border-zinc-300 text-zinc-500"
                    }`}
                  >
                    <GameIcon game={game} size={28} />
                    <span className="truncate w-full text-center mt-0.5 text-[10px]">{game.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {crossG1 && crossG2 && crossG1.id !== crossG2.id ? (
            <Link
              href={`/cross?g1=${crossG1.id}&g2=${crossG2.id}`}
              className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-600 hover:border-indigo-300 hover:text-indigo-600 transition-all"
            >
              <GitCompare size={14} />
              {crossG1.name} vs {crossG2.name} 비교하기
            </Link>
          ) : (
            <p className="mt-2 text-[10px] text-zinc-300 text-center">
              {crossG1 && crossG2 && crossG1.id === crossG2.id
                ? "서로 다른 게임을 선택해 주세요"
                : "두 게임을 선택하면 비교 대시보드로 이동합니다"}
            </p>
          )}
        </section>

        <HistorySection />
      </div>
    </main>
  );
}
