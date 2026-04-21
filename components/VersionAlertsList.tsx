"use client";

import { useState } from "react";
import { TrendingUp, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface VersionAlert {
  version: string;
  prev: string;
  change: number;
  platform: string;
}

const SHOW_DEFAULT = 3;

export default function VersionAlertsList({ alerts }: { alerts: VersionAlert[] }) {
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) return null;

  const visible = expanded ? alerts : alerts.slice(0, SHOW_DEFAULT);
  const hidden = alerts.length - SHOW_DEFAULT;

  return (
    <div className="space-y-2">
      {visible.map((alert, i) => {
        const isUp = alert.change > 0;
        return (
          <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs ${
            isUp ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                 : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            {isUp ? <TrendingUp size={13} /> : <AlertCircle size={13} />}
            <span>
              <span className="font-semibold">{alert.platform} v{alert.version}</span>
              {" "}업데이트 후 긍정률{" "}
              <span className="font-bold">{isUp ? "+" : ""}{alert.change}%p {isUp ? "상승" : "하락"}</span>
              <span className="opacity-60 ml-1">(v{alert.prev} 대비)</span>
            </span>
            <span className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isUp ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                   : "bg-rose-100 border-rose-300 text-rose-700"
            }`}>
              {isUp ? "호반응" : "급락 주의"}
            </span>
          </div>
        );
      })}

      {alerts.length > SHOW_DEFAULT && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 transition-colors pl-1"
        >
          {expanded ? (
            <><ChevronUp size={12} /> 접기</>
          ) : (
            <><ChevronDown size={12} /> 나머지 {hidden}개 더 보기</>
          )}
        </button>
      )}
    </div>
  );
}
