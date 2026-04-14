"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { WeeklyGameSummary } from "@/app/api/weekly-summary/route";

function GameCard({
  item,
  rank,
  variant,
  onClick,
}: {
  item: WeeklyGameSummary;
  rank: number;
  variant: "top" | "bottom";
  onClick: () => void;
}) {
  const isTop = variant === "top";
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md text-left w-full ${
        isTop
          ? "bg-emerald-50 border-emerald-100 hover:border-emerald-200"
          : "bg-rose-50 border-rose-100 hover:border-rose-200"
      }`}
    >
      <span className={`text-xs font-bold w-4 shrink-0 ${isTop ? "text-emerald-400" : "text-rose-400"}`}>
        {rank}
      </span>
      <img src={item.icon_url} alt={item.game_name} className="w-8 h-8 rounded-xl shrink-0 shadow-sm" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-800 truncate">{item.game_name}</p>
        <p className="text-[10px] text-zinc-400 mt-0.5">{item.total}건 분석</p>
      </div>
      <span className={`text-sm font-bold shrink-0 ${isTop ? "text-emerald-600" : "text-rose-600"}`}>
        {item.positive_rate}%
      </span>
    </button>
  );
}

export default function WeeklySummaryCards() {
  const router = useRouter();
  const [top, setTop] = useState<WeeklyGameSummary[]>([]);
  const [bottom, setBottom] = useState<WeeklyGameSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/weekly-summary")
      .then((r) => r.json())
      .then((d) => { setTop(d.top ?? []); setBottom(d.bottom ?? []); })
      .finally(() => setLoading(false));
  }, []);

  if (loading || (top.length === 0 && bottom.length === 0)) return null;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 상위 */}
      {top.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-50">
            <div className="w-5 h-5 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={11} className="text-emerald-500" />
            </div>
            <p className="text-xs font-semibold text-zinc-600">이번 주 긍정률 TOP 3</p>
          </div>
          <div className="p-3 space-y-2">
            {top.map((item, i) => (
              <GameCard
                key={item.game_id}
                item={item}
                rank={i + 1}
                variant="top"
                onClick={() => router.push(`/result?game=${item.game_id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 하위 */}
      {bottom.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-50">
            <div className="w-5 h-5 rounded-lg bg-rose-50 flex items-center justify-center">
              <TrendingDown size={11} className="text-rose-500" />
            </div>
            <p className="text-xs font-semibold text-zinc-600">이번 주 긍정률 BOTTOM 3</p>
          </div>
          <div className="p-3 space-y-2">
            {bottom.map((item, i) => (
              <GameCard
                key={item.game_id}
                item={item}
                rank={i + 1}
                variant="bottom"
                onClick={() => router.push(`/result?game=${item.game_id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
