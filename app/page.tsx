"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, BarChart3, ChevronRight } from "lucide-react";
import { SUPERCENT_GAMES, type GamePreset } from "@/lib/presets";
import HistorySection from "@/components/HistorySection";

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

export default function HomePage() {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState<GamePreset | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

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
          body: JSON.stringify({ app_id: selectedGame.ios_app_id, platform: "ios", count: 100 }),
        }),
        fetch("/api/reviews/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: selectedGame.android_package, platform: "android", count: 100 }),
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
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">{game.emoji}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {game.genre}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm mt-2">{game.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {game.downloads} 다운로드
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 분석 시작 */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            2. 분석 시작
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

        <HistorySection />
      </div>
    </main>
  );
}
