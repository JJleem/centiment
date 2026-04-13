"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Loader2 } from "lucide-react";
import type { GamePreset } from "@/lib/presets";

type Step = "idle" | "fetching" | "analyzing" | "done" | "error";

const STEP_LABEL: Record<Step, string> = {
  idle:      "",
  fetching:  "리뷰 수집 중...",
  analyzing: "Claude AI 분석 중...",
  done:      "완료!",
  error:     "",
};

const STEP_PROGRESS: Record<Step, number> = {
  idle:      0,
  fetching:  35,
  analyzing: 75,
  done:      100,
  error:     0,
};

interface Props {
  game: GamePreset;
}

export default function ReanalyzeButton({ game }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isRunning = step === "fetching" || step === "analyzing";

  async function handleReanalyze() {
    setStep("fetching");
    setErrorMsg("");

    try {
      // iOS + Android 동시 수집
      const [iosFetch, androidFetch] = await Promise.all([
        fetch("/api/reviews/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: game.ios_app_id, platform: "ios", count: 100 }),
        }),
        fetch("/api/reviews/fetch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: game.android_package, platform: "android", count: 100 }),
        }),
      ]);

      if (!iosFetch.ok) {
        const err = await iosFetch.json().catch(() => ({}));
        throw new Error(`iOS 수집 실패: ${err.error ?? iosFetch.statusText}`);
      }
      if (!androidFetch.ok) {
        const err = await androidFetch.json().catch(() => ({}));
        throw new Error(`Android 수집 실패: ${err.error ?? androidFetch.statusText}`);
      }

      setStep("analyzing");

      // iOS + Android 동시 분석
      const [iosAnalyze, androidAnalyze] = await Promise.all([
        fetch("/api/reviews/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: game.ios_app_id, platform: "ios" }),
        }),
        fetch("/api/reviews/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: game.android_package, platform: "android" }),
        }),
      ]);

      if (!iosAnalyze.ok) {
        const err = await iosAnalyze.json().catch(() => ({}));
        throw new Error(`iOS 분석 실패: ${err.error ?? iosAnalyze.statusText}`);
      }
      if (!androidAnalyze.ok) {
        const err = await androidAnalyze.json().catch(() => ({}));
        throw new Error(`Android 분석 실패: ${err.error ?? androidAnalyze.statusText}`);
      }

      setStep("done");
      setTimeout(() => {
        router.refresh();
        setStep("idle");
      }, 800);
    } catch (e) {
      setStep("error");
      setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류");
    }
  }

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        disabled={isRunning}
        onClick={handleReanalyze}
        className="flex items-center gap-1.5 text-zinc-500"
      >
        {isRunning ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <RefreshCw size={13} />
        )}
        {isRunning ? STEP_LABEL[step] : "재수집 · 재분석"}
      </Button>

      {isRunning && (
        <div className="w-48 space-y-1">
          <Progress value={STEP_PROGRESS[step]} className="h-1" />
        </div>
      )}

      {step === "error" && (
        <p className="text-xs text-rose-500">{errorMsg}</p>
      )}
    </div>
  );
}
