"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface VersionTrendData {
  version: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface Props {
  data: VersionTrendData[];
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-sm text-xs space-y-1">
      <p className="font-semibold text-zinc-700">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span style={{ color: p.color }}>●</span>
          <span className="text-zinc-500">{p.name}</span>
          <span className="font-medium text-zinc-700 ml-auto">
            {p.value}건 ({total > 0 ? Math.round((p.value / total) * 100) : 0}%)
          </span>
        </div>
      ))}
      <div className="border-t border-zinc-100 pt-1 text-zinc-400">총 {total}건</div>
    </div>
  );
};

export default function VersionTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-xs text-zinc-400 text-center py-6">버전 정보가 있는 리뷰가 없습니다.</p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 4 }} barSize={28}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis
          dataKey="version"
          tick={{ fontSize: 11, fill: "#71717a" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#71717a" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) =>
            value === "positive" ? "긍정" : value === "negative" ? "부정" : "중립"
          }
          wrapperStyle={{ fontSize: 11 }}
        />
        <Bar dataKey="positive" name="positive" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
        <Bar dataKey="neutral" name="neutral" stackId="a" fill="#a1a1aa" />
        <Bar dataKey="negative" name="negative" stackId="a" fill="#f43f5e" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
