"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Play, Clock, ChevronRight } from "lucide-react";
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

  return (
    <section>
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Clock size={12} />
        분석 히스토리
      </p>
      <div className="space-y-2">
        {history.map((item) => {
          const game = SUPERCENT_GAMES.find(
            (g) => g.ios_app_id === item.app_id || g.android_package === item.app_id
          );
          const pctPositive = item.total > 0 ? Math.round((item.positive / item.total) * 100) : 0;
          const date = new Date(item.analyzed_at).toLocaleDateString("ko-KR", {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          });

          return (
            <Card
              key={`${item.app_id}__${item.platform}`}
              className="cursor-pointer hover:border-indigo-200 transition-colors"
              onClick={() => router.push(`/result?app_id=${item.app_id}&platform=${item.platform}`)}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg shrink-0">{game?.emoji ?? "🎮"}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium truncate">{game?.name ?? item.app_id}</span>
                        <Badge variant="secondary" className="flex items-center gap-0.5 text-[10px] shrink-0">
                          {item.platform === "ios" ? <Smartphone size={9} /> : <Play size={9} />}
                          {item.platform === "ios" ? "iOS" : "Android"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <SentimentMiniBar
                          positive={item.positive}
                          negative={item.negative}
                          neutral={item.neutral}
                          total={item.total}
                        />
                        <span className="text-[10px] text-zinc-400 shrink-0">
                          긍정 {pctPositive}% · {item.total}건
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
