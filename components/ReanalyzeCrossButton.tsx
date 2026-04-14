"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function ReanalyzeCrossButton({ g1, g2 }: { g1: string; g2: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleReanalyze() {
    setLoading(true);
    try {
      await fetch("/api/cross-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ g1, g2 }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleReanalyze}
      disabled={loading}
      className="ml-auto shrink-0 text-amber-400 hover:text-amber-600 transition-colors disabled:opacity-40"
      title="AI 인사이트 재생성"
    >
      <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
    </button>
  );
}
