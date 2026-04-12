"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Smartphone, Play, BarChart3, ChevronRight } from "lucide-react";
import { SUPERCENT_GAMES, type GamePreset } from "@/lib/presets";
import type { Platform } from "@/types";

type Step = "idle" | "fetching" | "analyzing" | "done" | "error";

const PLATFORM_OPTIONS: { value: Platform; label: string; icon: React.ReactNode }[] = [
  { value: "ios", label: "iOS", icon: <Smartphone size={14} /> },
  { value: "android", label: "Android", icon: <Play size={14} /> },
];

const STEP_PROGRESS: Record<Step, number> = {
  idle: 0,
  fetching: 30,
  analyzing: 70,
  done: 100,
  error: 0,
};

const STEP_LABEL: Record<Step, string> = {
  idle: "",
  fetching: "리뷰 수집 중...",
  analyzing: "Claude AI 분석 중...",
  done: "완료!",
  error: "오류가 발생했습니다.",
};

export default function HomePage() {
  const router = useRouter();
  const [selectedGame, setSelectedGame] = useState<GamePreset | null>(null);
  const [platform, setPlatform] = useState<Platform>("ios");
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isRunning = step === "fetching" || step === "analyzing";

  async function handleStart() {
    if (!selectedGame) return;
    setStep("fetching");
    setErrorMsg("");

    try {
      const appId =
        platform === "ios"
          ? selectedGame.ios_app_id
          : selectedGame.android_package;

      // 1. Fetch reviews
      const fetchRes = await fetch("/api/reviews/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, platform, count: 100 }),
      });
      if (!fetchRes.ok) throw new Error("리뷰 수집 실패");

      // 2. Analyze
      setStep("analyzing");
      const analyzeRes = await fetch("/api/reviews/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app_id: appId, platform }),
      });
      if (!analyzeRes.ok) throw new Error("분석 실패");

      setStep("done");
      setTimeout(() => {
        router.push(`/result?app_id=${appId}&platform=${platform}`);
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
        {/* Step 1 — Game select */}
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

        {/* Step 2 — Platform select */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            2. 플랫폼 선택
          </p>
          <div className="flex gap-2">
            {PLATFORM_OPTIONS.map((p) => (
              <button
                key={p.value}
                onClick={() => !isRunning && setPlatform(p.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                  platform === p.value
                    ? "bg-indigo-500 text-white border-indigo-500"
                    : "bg-white text-zinc-600 border-zinc-200 hover:border-indigo-300"
                }`}
              >
                {p.icon}
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {/* Step 3 — Run */}
        <section>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
            3. 분석 시작
          </p>
          <p className="text-xs text-zinc-400 mb-3">
            최근 리뷰 최대 100건을 수집하여 분석합니다.
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
                분석 시작
                <ChevronRight size={16} className="ml-1" />
              </>
            )}
          </Button>

          {/* Progress */}
          {step !== "idle" && step !== "error" && (
            <div className="mt-4 space-y-1.5">
              <Progress value={STEP_PROGRESS[step]} className="h-1.5" />
              <p className="text-xs text-zinc-400 text-right">{STEP_LABEL[step]}</p>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <p className="mt-3 text-sm text-red-500 text-center">{errorMsg}</p>
          )}
        </section>
      </div>
    </main>
  );
}
