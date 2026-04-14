"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GitCompare } from "lucide-react";
import { SUPERCENT_GAMES } from "@/lib/presets";
import GameIcon from "@/components/GameIcon";
import type { CrossHistoryItem } from "@/app/api/cross-history/route";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function CrossHistorySection() {
  const router = useRouter();
  const [history, setHistory] = useState<CrossHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cross-history")
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <p className="text-xs text-zinc-300 text-center py-4">비교 히스토리 불러오는 중...</p>
  );
  if (history.length === 0) return null;

  return (
    <section>
      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <GitCompare size={12} />
        비교 히스토리
      </p>
      <div className="space-y-2">
        {history.map((item) => {
          const game1 = SUPERCENT_GAMES.find((g) => g.id === item.game1_id);
          const game2 = SUPERCENT_GAMES.find((g) => g.id === item.game2_id);
          return (
            <div
              key={item.id}
              className="bg-white border border-zinc-200 rounded-xl px-4 py-3 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all"
              onClick={() => router.push(`/cross?g1=${item.game1_id}&g2=${item.game2_id}`)}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  {game1 && <GameIcon game={game1} size={20} />}
                  <span className="text-xs font-medium text-indigo-600">{item.game1_name}</span>
                  <span className="text-[10px] text-zinc-300">vs</span>
                  {game2 && <GameIcon game={game2} size={20} />}
                  <span className="text-xs font-medium text-violet-600">{item.game2_name}</span>
                </div>
                <span className="text-[10px] text-zinc-400 shrink-0">{formatDate(item.created_at)}</span>
              </div>
              <p className="text-[11px] text-zinc-400 line-clamp-1 leading-relaxed">{item.insight}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
