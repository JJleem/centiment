"use client";

import { useEffect, useState, useCallback } from "react";
import { Smartphone, Play, Loader2, RefreshCw } from "lucide-react";
import type { CategoryInsight } from "@/app/api/category-insights/route";
import type { Platform } from "@/types";

const CATEGORY_COLOR: Record<string, string> = {
  bug:          "bg-rose-50 border-rose-200 text-rose-700",
  monetization: "bg-amber-50 border-amber-200 text-amber-700",
  gameplay:     "bg-indigo-50 border-indigo-200 text-indigo-700",
  performance:  "bg-orange-50 border-orange-200 text-orange-700",
  ui:           "bg-violet-50 border-violet-200 text-violet-700",
  content:      "bg-teal-50 border-teal-200 text-teal-700",
};

function PlatformBlock({ gameId, platform }: { gameId: string; platform: Platform }) {
  const [insights, setInsights] = useState<CategoryInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isIos = platform === "ios";

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      const url = `/api/category-insights?game=${gameId}&platform=${platform}${force ? "&force=true" : ""}`;
      const d = await fetch(url).then((r) => r.json());
      setInsights(d.insights ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gameId, platform]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs font-semibold flex items-center gap-1 ${isIos ? "text-sky-600" : "text-teal-600"}`}>
          {isIos ? <Smartphone size={11} /> : <Play size={11} />}
          {isIos ? "iOS" : "Android"}
        </p>
        {!loading && insights.length > 0 && (
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-40"
            title="재생성"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-400 py-4">
          <Loader2 size={12} className="animate-spin" /> Haiku 분석 중...
        </div>
      ) : insights.length === 0 ? (
        <p className="text-xs text-zinc-300 py-4">데이터 부족 (카테고리당 3건 이상 필요)</p>
      ) : (
        <div className={`space-y-2.5 transition-opacity ${refreshing ? "opacity-50" : ""}`}>
          {insights.map((item) => (
            <div key={item.category} className={`px-3 py-2.5 rounded-xl border ${CATEGORY_COLOR[item.category] ?? "bg-zinc-50 border-zinc-200 text-zinc-700"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold">{item.label}</span>
                <span className="text-[10px] opacity-50">{item.count}건</span>
              </div>
              <p className="text-xs leading-relaxed">{item.insight}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoryInsights({ gameId, hasIos, hasAndroid }: {
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
