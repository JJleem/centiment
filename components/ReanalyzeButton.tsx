"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Loader2, RotateCcw } from "lucide-react";
import type { GamePreset } from "@/lib/presets";
import { readAnalyzeStream } from "@/lib/utils";

type Step = "idle" | "fetching" | "analyzing" | "done" | "error";

const STEP_LABEL: Record<Step, string> = {
  idle:      "",
  fetching:  "리뷰 수집 중...",
  analyzing: "Claude AI 분석 중...",
  done:      "완료!",
  error:     "",
};

interface Props {
  game: GamePreset;
}

export default function ReanalyzeButton({ game }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [progressValue, setProgressValue] = useState(0);

  const isRunning = step === "fetching" || step === "analyzing";

  async function handleReanalyze(force = false) {
    setStep("fetching");
    setErrorMsg("");
    setProgressValue(15);

    try {
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
      setProgressValue(20);

      // 배치 진행률 추적 (iOS + Android 합산)
      const batchTotals = { ios: 0, android: 0 };
      const batchDones  = { ios: 0, android: 0 };

      const updatePct = () => {
        const total = batchTotals.ios + batchTotals.android;
        if (total === 0) return;
        const done = batchDones.ios + batchDones.android;
        setProgressValue(Math.round(20 + (done / total) * 70));
      };

      const [iosRes, androidRes] = await Promise.all([
        fetch("/api/reviews/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: game.ios_app_id, platform: "ios", force }),
        }),
        fetch("/api/reviews/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ app_id: game.android_package, platform: "android", force }),
        }),
      ]);

      if (!iosRes.ok) {
        const err = await iosRes.json().catch(() => ({}));
        throw new Error(`iOS 분석 실패: ${err.error ?? iosRes.statusText}`);
      }
      if (!androidRes.ok) {
        const err = await androidRes.json().catch(() => ({}));
        throw new Error(`Android 분석 실패: ${err.error ?? androidRes.statusText}`);
      }

      await Promise.all([
        readAnalyzeStream(iosRes, (event) => {
          if (event.type === "start") { batchTotals.ios = event.total_batches; }
          else if (event.type === "batch") { batchDones.ios = event.done; batchTotals.ios = event.total; updatePct(); }
          else if (event.type === "summarizing") { setProgressValue((v) => Math.max(v, 85)); }
        }),
        readAnalyzeStream(androidRes, (event) => {
          if (event.type === "start") { batchTotals.android = event.total_batches; }
          else if (event.type === "batch") { batchDones.android = event.done; batchTotals.android = event.total; updatePct(); }
          else if (event.type === "summarizing") { setProgressValue((v) => Math.max(v, 85)); }
        }),
      ]);

      setStep("done");
      setProgressValue(100);
      setTimeout(() => {
        router.refresh();
        setStep("idle");
        setProgressValue(0);
      }, 800);
    } catch (e) {
      setStep("error");
      setProgressValue(0);
      setErrorMsg(e instanceof Error ? e.message : "알 수 없는 오류");
    }
  }

  return (
    <div className="space-y-2 flex flex-col items-end">
      <div className="flex items-center gap-2">
        {/* 전체 재분석 (force) */}
        <button
          disabled={isRunning}
          onClick={() => handleReanalyze(true)}
          className="text-[11px] text-zinc-400 hover:text-rose-500 transition-colors flex items-center gap-1 disabled:opacity-40"
          title="기존 분석 결과를 전부 삭제하고 처음부터 재분석합니다"
        >
          <RotateCcw size={11} />
          전체 재분석
        </button>

        {/* 증분 재분석 (기본) */}
        <Button
          variant="outline"
          size="sm"
          disabled={isRunning}
          onClick={() => handleReanalyze(false)}
          className="flex items-center gap-1.5 text-zinc-500"
        >
          {isRunning ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <RefreshCw size={13} />
          )}
          {isRunning ? STEP_LABEL[step] : "새 리뷰 분석"}
        </Button>
      </div>

      {isRunning && (
        <div className="w-48 space-y-1">
          <Progress value={progressValue} className="h-1" />
        </div>
      )}

      {step === "error" && (
        <p className="text-xs text-rose-500 max-w-48 text-right">{errorMsg}</p>
      )}
    </div>
  );
}
