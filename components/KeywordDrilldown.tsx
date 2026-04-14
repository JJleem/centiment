"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tag, Smartphone, Play, X } from "lucide-react";
import ReviewList, { type CombinedItem } from "@/components/ReviewList";

interface Props {
  iosKeywords: string[];
  androidKeywords: string[];
  allItems: CombinedItem[];
}

type KeywordTone = "positive" | "negative" | "neutral";

// 키워드별 감성 색상 (플랫폼 색과 분리)
const TONE_STYLE: Record<KeywordTone, { badge: string; hover: string }> = {
  positive: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", hover: "hover:bg-emerald-100" },
  negative: { badge: "bg-rose-50 text-rose-700 border-rose-200",         hover: "hover:bg-rose-100"    },
  neutral:  { badge: "",                                                   hover: ""                     }, // 플랫폼 기본색 사용
};

// 플랫폼 기본 색상 (tone이 neutral일 때 fallback)
const PLATFORM_STYLE: Record<"ios" | "android", { normal: string; shared: string; hover: string }> = {
  ios:     { normal: "bg-sky-50 text-sky-700 border-sky-100",      shared: "bg-sky-100 text-sky-800 border-sky-200",      hover: "hover:bg-sky-100"  },
  android: { normal: "bg-teal-50 text-teal-700 border-teal-100",   shared: "bg-teal-100 text-teal-800 border-teal-200",   hover: "hover:bg-teal-100" },
};

export default function KeywordDrilldown({ iosKeywords, androidKeywords, allItems }: Props) {
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  const filteredItems = activeKeyword
    ? allItems.filter((item) => item.keywords.includes(activeKeyword))
    : allItems;

  function toggle(kw: string) {
    setActiveKeyword((prev) => (prev === kw ? null : kw));
  }

  // 공통 키워드
  const sharedKeywords = useMemo(
    () => new Set(iosKeywords.filter((kw) => androidKeywords.includes(kw))),
    [iosKeywords, androidKeywords]
  );

  // 키워드별 감성 빈도 집계
  const keywordTone = useMemo(() => {
    const freq: Record<string, { positive: number; negative: number; neutral: number }> = {};
    for (const item of allItems) {
      for (const kw of item.keywords) {
        if (!freq[kw]) freq[kw] = { positive: 0, negative: 0, neutral: 0 };
        freq[kw][item.sentiment]++;
      }
    }
    const toneMap: Record<string, KeywordTone> = {};
    for (const [kw, counts] of Object.entries(freq)) {
      const total = counts.positive + counts.negative + counts.neutral;
      if (total === 0) { toneMap[kw] = "neutral"; continue; }
      const posPct = counts.positive / total;
      const negPct = counts.negative / total;
      toneMap[kw] = posPct >= 0.6 ? "positive" : negPct >= 0.6 ? "negative" : "neutral";
    }
    return toneMap;
  }, [allItems]);

  function getBadgeClass(kw: string, platform: "ios" | "android"): string {
    if (activeKeyword === kw) return "bg-indigo-500 text-white border-indigo-500 scale-105";
    const tone = keywordTone[kw] ?? "neutral";
    const isShared = sharedKeywords.has(kw);
    const weight = isShared ? "font-medium" : "font-normal";
    if (tone !== "neutral") {
      return `${TONE_STYLE[tone].badge} ${TONE_STYLE[tone].hover} ${weight}`;
    }
    const p = PLATFORM_STYLE[platform];
    return `${isShared ? p.shared : p.normal} ${p.hover} ${weight}`;
  }

  const hasSentimentBadge =
    [...iosKeywords, ...androidKeywords].some((kw) => {
      const t = keywordTone[kw];
      return t === "positive" || t === "negative";
    });

  return (
    <>
      {/* 키워드 비교 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Tag size={13} /> 주요 키워드 비교
            <span className="ml-auto text-[10px] font-normal text-zinc-400">
              클릭하면 해당 리뷰만 필터링됩니다
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            {/* iOS */}
            <div>
              <p className="text-xs font-semibold text-sky-600 flex items-center gap-1 mb-2">
                <Smartphone size={11} /> iOS
              </p>
              {iosKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {iosKeywords.map((kw) => (
                    <button key={kw} onClick={() => toggle(kw)}>
                      <Badge
                        variant="secondary"
                        className={`text-xs cursor-pointer transition-all select-none ${getBadgeClass(kw, "ios")}`}
                      >
                        {kw}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-300 py-2">키워드 데이터 없음</p>
              )}
            </div>

            {/* Android */}
            <div>
              <p className="text-xs font-semibold text-teal-600 flex items-center gap-1 mb-2">
                <Play size={11} /> Android
              </p>
              {androidKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {androidKeywords.map((kw) => (
                    <button key={kw} onClick={() => toggle(kw)}>
                      <Badge
                        variant="secondary"
                        className={`text-xs cursor-pointer transition-all select-none ${getBadgeClass(kw, "android")}`}
                      >
                        {kw}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-300 py-2">키워드 데이터 없음</p>
              )}
            </div>
          </div>

          {/* 범례 */}
          {!activeKeyword && (
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-400">
              {hasSentimentBadge && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-emerald-200 inline-block" /> 주로 긍정 키워드
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-rose-200 inline-block" /> 주로 부정 키워드
                  </span>
                </>
              )}
              {sharedKeywords.size > 0 && (
                <span className="flex items-center gap-1">
                  <span className="font-semibold text-zinc-500">B</span> iOS · Android 공통
                </span>
              )}
            </div>
          )}

          {/* 활성 필터 */}
          {activeKeyword && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-indigo-50 border border-indigo-100">
              <span className="text-xs text-indigo-700 font-medium">
                &ldquo;{activeKeyword}&rdquo; 키워드 포함 리뷰
              </span>
              <span className="text-xs text-indigo-400">{filteredItems.length}건</span>
              <button
                onClick={() => setActiveKeyword(null)}
                className="ml-auto text-indigo-400 hover:text-indigo-700 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* 통합 리뷰 목록 */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">
          {activeKeyword
            ? `"${activeKeyword}" 리뷰 (${filteredItems.length}건)`
            : `전체 리뷰 (${allItems.length}건)`}
        </h2>
        <ReviewList items={filteredItems} />
      </div>
    </>
  );
}
