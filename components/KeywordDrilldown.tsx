"use client";

import { useState } from "react";
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

export default function KeywordDrilldown({ iosKeywords, androidKeywords, allItems }: Props) {
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null);

  const filteredItems = activeKeyword
    ? allItems.filter((item) => item.keywords.includes(activeKeyword))
    : allItems;

  function toggle(kw: string) {
    setActiveKeyword((prev) => (prev === kw ? null : kw));
  }

  // 두 플랫폼에 모두 있는 키워드 체크 (볼드 처리용)
  const sharedKeywords = new Set(
    iosKeywords.filter((kw) => androidKeywords.includes(kw))
  );

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
              <div className="flex flex-wrap gap-1.5">
                {iosKeywords.map((kw) => {
                  const active = activeKeyword === kw;
                  return (
                    <button key={kw} onClick={() => toggle(kw)}>
                      <Badge
                        variant="secondary"
                        className={`text-xs font-normal cursor-pointer transition-all select-none ${
                          active
                            ? "bg-indigo-500 text-white border-indigo-500 scale-105"
                            : sharedKeywords.has(kw)
                            ? "bg-sky-100 text-sky-800 border-sky-200 hover:bg-sky-200 font-medium"
                            : "bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100"
                        }`}
                      >
                        {kw}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Android */}
            <div>
              <p className="text-xs font-semibold text-teal-600 flex items-center gap-1 mb-2">
                <Play size={11} /> Android
              </p>
              <div className="flex flex-wrap gap-1.5">
                {androidKeywords.map((kw) => {
                  const active = activeKeyword === kw;
                  return (
                    <button key={kw} onClick={() => toggle(kw)}>
                      <Badge
                        variant="secondary"
                        className={`text-xs font-normal cursor-pointer transition-all select-none ${
                          active
                            ? "bg-indigo-500 text-white border-indigo-500 scale-105"
                            : sharedKeywords.has(kw)
                            ? "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200 font-medium"
                            : "bg-teal-50 text-teal-700 border-teal-100 hover:bg-teal-100"
                        }`}
                      >
                        {kw}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 양쪽 공통 키워드 안내 */}
          {sharedKeywords.size > 0 && !activeKeyword && (
            <p className="text-[10px] text-zinc-400">
              진한 배지는 iOS · Android 공통 키워드입니다.
            </p>
          )}

          {/* 활성 필터 표시 */}
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
