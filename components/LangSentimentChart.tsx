"use client";

import { useEffect, useState } from "react";
import { Smartphone, Play } from "lucide-react";
import type { LangSentimentItem } from "@/app/api/lang-sentiment/route";
import type { Platform } from "@/types";

function SentimentBar({ positive, negative, neutral, total }: {
  positive: number; negative: number; neutral: number; total: number;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div className="flex h-2 rounded-full overflow-hidden w-full gap-px">
      <div className="bg-emerald-400 transition-all" style={{ width: `${pct(positive)}%` }} title={`긍정 ${pct(positive)}%`} />
      <div className="bg-rose-400 transition-all"    style={{ width: `${pct(negative)}%` }} title={`부정 ${pct(negative)}%`} />
      <div className="bg-zinc-200 transition-all"    style={{ width: `${pct(neutral)}%` }}  title={`중립 ${pct(neutral)}%`} />
    </div>
  );
}

function PlatformBlock({ gameId, platform }: { gameId: string; platform: Platform }) {
  const [items, setItems] = useState<LangSentimentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isIos = platform === "ios";

  useEffect(() => {
    fetch(`/api/lang-sentiment?game=${gameId}&platform=${platform}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [gameId, platform]);

  return (
    <div>
      <p className={`text-xs font-semibold flex items-center gap-1 mb-3 ${isIos ? "text-sky-600" : "text-teal-600"}`}>
        {isIos ? <Smartphone size={11} /> : <Play size={11} />}
        {isIos ? "iOS" : "Android"}
      </p>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-zinc-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-zinc-300 py-4">
          아직 데이터 없음 — 재분석 후 표시됩니다
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const posPct = item.positive_rate;
            const pctColor =
              posPct >= 70 ? "text-emerald-600" :
              posPct >= 40 ? "text-amber-600" :
                             "text-rose-600";
            return (
              <div key={item.lang}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs flex items-center gap-1.5">
                    <span className="text-base leading-none">{item.flag}</span>
                    <span className="font-medium text-zinc-700">{item.label}</span>
                    <span className="text-zinc-300">·</span>
                    <span className="text-zinc-400">{item.total}건</span>
                  </span>
                  <span className={`text-xs font-bold ${pctColor}`}>{posPct}%</span>
                </div>
                <SentimentBar
                  positive={item.positive}
                  negative={item.negative}
                  neutral={item.neutral}
                  total={item.total}
                />
                <div className="flex gap-3 mt-1 text-[10px] text-zinc-400">
                  <span className="text-emerald-500">긍정 {item.positive}</span>
                  <span className="text-rose-500">부정 {item.negative}</span>
                  <span className="text-zinc-400">중립 {item.neutral}</span>
                </div>
              </div>
            );
          })}

          {/* 범례 */}
          <div className="flex items-center gap-3 pt-1 border-t border-zinc-100 text-[10px] text-zinc-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />긍정</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />부정</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-200" />중립</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LangSentimentChart({ gameId, hasIos, hasAndroid }: {
  gameId: string;
  hasIos: boolean;
  hasAndroid: boolean;
}) {
  if (!hasIos && !hasAndroid) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {hasIos    && <PlatformBlock gameId={gameId} platform="ios" />}
      {hasAndroid && <PlatformBlock gameId={gameId} platform="android" />}
    </div>
  );
}
