"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, ChevronRight, Smartphone, Play } from "lucide-react";
import { SUPERCENT_GAMES } from "@/lib/presets";
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

interface GameHistory {
  ios?: HistoryItem;
  android?: HistoryItem;
  analyzed_at: string;
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

          const date = new Date(analyzed_at).toLocaleDateString("ko-KR", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          });

          return (
            <Card
              key={game.id}
              className="cursor-pointer hover:border-indigo-200 transition-colors"
              onClick={() => router.push(`/result?game=${game.id}`)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{game.emoji}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm font-medium truncate">{game.name}</span>
                        {/* 플랫폼 유무 표시 */}
                        <span className={`text-[10px] ${ios ? "text-sky-500" : "text-zinc-300"}`}>
                          <Smartphone size={10} className="inline" />
                        </span>
                        <span className={`text-[10px] ${android ? "text-teal-500" : "text-zinc-300"}`}>
                          <Play size={10} className="inline" />
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <SentimentMiniBar
                          positive={totalPositive}
                          negative={totalNegative}
                          neutral={totalNeutral}
                          total={total}
                        />
                        <span className="text-[10px] text-zinc-400 shrink-0">
                          긍정 {pctPositive}% · {total}건
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-zinc-300">{date}</span>
                    <ChevronRight size={14} className="text-zinc-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
