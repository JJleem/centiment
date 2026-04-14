"use client";

import { useEffect, useState } from "react";
import { Smartphone, Play, Clock } from "lucide-react";
import type { TimelineEntry } from "@/app/api/analysis-timeline/route";

function MiniBar({ positive, negative, neutral, total }: {
  positive: number; negative: number; neutral: number; total: number;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const posPct = pct(positive);
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 rounded-full overflow-hidden w-20 gap-px">
        <div className="bg-emerald-400" style={{ width: `${pct(positive)}%` }} />
        <div className="bg-rose-400"   style={{ width: `${pct(negative)}%` }} />
        <div className="bg-zinc-300"   style={{ width: `${pct(neutral)}%` }} />
      </div>
      <span className={`text-[10px] font-semibold w-8 ${
        posPct >= 70 ? "text-emerald-600" : posPct >= 40 ? "text-amber-600" : "text-rose-600"
      }`}>
        {posPct}%
      </span>
      <span className="text-[10px] text-zinc-300">{total}건</span>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

export default function AnalysisTimeline({ gameId }: { gameId: string }) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/analysis-timeline?g=${gameId}`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.timeline ?? []))
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) return (
    <p className="text-xs text-zinc-300 text-center py-4">타임라인 불러오는 중...</p>
  );
  if (timeline.length === 0) return null;

  // 분석 1회뿐이면 타임라인 의미 없음
  if (timeline.length < 2) return null;

  return (
    <div className="space-y-0">
      {[...timeline].reverse().map((entry, i) => (
        <div key={entry.date} className="flex gap-4">
          {/* 타임라인 선 */}
          <div className="flex flex-col items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0 mt-1 shadow-sm" />
            {i < timeline.length - 1 && (
              <div className="w-px flex-1 bg-zinc-100 mt-1" />
            )}
          </div>

          {/* 내용 */}
          <div className="pb-5 flex-1 min-w-0">
            <p className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5 mb-2">
              <Clock size={10} className="text-zinc-300" />
              {formatDate(entry.date)}
            </p>
            <div className="space-y-1.5">
              {entry.ios && (
                <div className="flex items-center gap-2">
                  <Smartphone size={10} className="text-sky-400 shrink-0" />
                  <MiniBar {...entry.ios} />
                </div>
              )}
              {entry.android && (
                <div className="flex items-center gap-2">
                  <Play size={10} className="text-teal-400 shrink-0" />
                  <MiniBar {...entry.android} />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
