"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronRight, Smartphone, Play } from "lucide-react";
import { SUPERCENT_GAMES } from "@/lib/presets";
import GameIcon from "@/components/GameIcon";
import type { HistoryItem } from "@/app/api/history/route";

function SentimentMiniBar({ positive, negative, neutral, total }: {
  positive: number; negative: number; neutral: number; total: number;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-full gap-px">
      <div className="bg-emerald-400" style={{ width: `${pct(positive)}%` }} />
      <div className="bg-rose-400"   style={{ width: `${pct(negative)}%` }} />
      <div className="bg-zinc-300"   style={{ width: `${pct(neutral)}%` }} />
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function HistorySection() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <p className="text-xs text-zinc-300 text-center py-4">히스토리 불러오는 중...</p>
  );
  if (history.length === 0) return null;

  // 게임별 그룹핑
  const gameHistory = SUPERCENT_GAMES.map((game) => {
    const ios = history.find((h) => h.app_id === game.ios_app_id && h.platform === "ios");
    const android = history.find((h) => h.app_id === game.android_package && h.platform === "android");
    if (!ios && !android) return null;
    const analyzed_at = [ios?.analyzed_at, android?.analyzed_at]
      .filter(Boolean)
      .sort()
      .at(-1)!;
    return { game, ios, android, analyzed_at };
  })
    .filter(Boolean)
    .sort((a, b) => new Date(b!.analyzed_at).getTime() - new Date(a!.analyzed_at).getTime());

  if (gameHistory.length === 0) return null;

  return (
    <section>
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Clock size={12} />
        분석 히스토리
      </p>
      <div className="space-y-2">
        {gameHistory.map((entry) => {
          const { game, ios, android, analyzed_at } = entry!;

          const totalPositive = (ios?.positive ?? 0) + (android?.positive ?? 0);
          const totalNegative = (ios?.negative ?? 0) + (android?.negative ?? 0);
          const totalNeutral  = (ios?.neutral  ?? 0) + (android?.neutral  ?? 0);
          const total = totalPositive + totalNegative + totalNeutral;
          const pctPositive = total > 0 ? Math.round((totalPositive / total) * 100) : 0;

          // 긍정률 색상
          const pctColor =
            pctPositive >= 70 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
            pctPositive >= 40 ? "text-amber-600 bg-amber-50 border-amber-200" :
                                "text-rose-600 bg-rose-50 border-rose-200";

          // AI 요약 (iOS 우선, 없으면 Android)
          const summary = ios?.summary || android?.summary || "";

          return (
            <div
              key={game.id}
              className="bg-white border border-zinc-200 rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all"
              onClick={() => router.push(`/result?game=${game.id}`)}
            >
              {/* 상단: 게임 정보 + 날짜 */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <GameIcon game={game} size={28} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{game.name}</span>
                      <span className={`text-[10px] ${ios ? "text-sky-500" : "text-zinc-300"}`}>
                        <Smartphone size={10} className="inline" />
                      </span>
                      <span className={`text-[10px] ${android ? "text-teal-500" : "text-zinc-300"}`}>
                        <Play size={10} className="inline" />
                      </span>
                    </div>
                    {/* iOS / Android 건수 */}
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {ios && <span className="text-sky-500">iOS {ios.total}건</span>}
                      {ios && android && <span className="text-zinc-300 mx-1">·</span>}
                      {android && <span className="text-teal-500">Android {android.total}건</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-zinc-400">{formatDate(analyzed_at)}</span>
                  <ChevronRight size={14} className="text-zinc-300" />
                </div>
              </div>

              {/* 감성 바 + 긍정률 */}
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex-1">
                  <SentimentMiniBar
                    positive={totalPositive}
                    negative={totalNegative}
                    neutral={totalNeutral}
                    total={total}
                  />
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${pctColor}`}>
                  긍정 {pctPositive}%
                </span>
              </div>

              {/* AI 요약 */}
              {summary && (
                <p className="text-[11px] text-zinc-400 line-clamp-1 leading-relaxed">
                  {summary}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
