// 서버 컴포넌트 — 1~5점 평점 분포 가로 바 차트

interface Props {
  dist: Record<number, number>;
  total: number;
  color: "sky" | "teal";
}

const COLOR: Record<Props["color"], { bar: string; text: string }> = {
  sky:  { bar: "bg-sky-400",  text: "text-sky-600"  },
  teal: { bar: "bg-teal-400", text: "text-teal-600" },
};

export default function RatingDistChart({ dist, total, color }: Props) {
  const maxCount = Math.max(...[1, 2, 3, 4, 5].map((s) => dist[s] ?? 0), 1);
  const c = COLOR[color];

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = dist[star] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const barW = Math.round((count / maxCount) * 100);
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="text-[10px] text-amber-400 w-[52px] shrink-0 tracking-tighter">
              {"★".repeat(star)}{"☆".repeat(5 - star)}
            </span>
            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
              <div className={`h-full ${c.bar} rounded-full`} style={{ width: `${barW}%` }} />
            </div>
            <span className="text-[10px] text-zinc-400 w-16 text-right shrink-0">
              {count}건{" "}
              <span className={`font-medium ${c.text}`}>{pct}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
