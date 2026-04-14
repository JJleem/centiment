"use client";

import { Download } from "lucide-react";
import type { CombinedItem } from "@/components/ReviewList";

const CATEGORY_LABEL: Record<string, string> = {
  gameplay: "게임플레이", ui: "UI/UX", performance: "성능",
  monetization: "결제/광고", content: "콘텐츠", bug: "버그", other: "기타",
};
const SENTIMENT_LABEL: Record<string, string> = {
  positive: "긍정", negative: "부정", neutral: "중립",
};

export default function CsvExportButton({ items, gameName }: { items: CombinedItem[]; gameName: string }) {
  function handleDownload() {
    const headers = ["날짜", "플랫폼", "버전", "평점", "감성", "카테고리", "키워드", "리뷰 내용"];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const rows = items.map((item) => [
      item.review_date ? item.review_date.slice(0, 10) : "",
      item.platform === "ios" ? "iOS" : "Android",
      item.version ?? "",
      String(item.rating),
      SENTIMENT_LABEL[item.sentiment] ?? item.sentiment,
      CATEGORY_LABEL[item.category] ?? item.category,
      item.keywords.join(" | "),
      escape(item.content),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${gameName}_리뷰_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
      title={`${items.length}건 CSV 다운로드`}
    >
      <Download size={12} />
      CSV
    </button>
  );
}
