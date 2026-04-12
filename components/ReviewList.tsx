"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import type { Sentiment, ReviewCategory } from "@/types";

const PAGE_SIZE = 20;

interface ReviewItem {
  content: string;
  rating: number;
  version: string | null;
  review_date: string;
}

interface AnalysisItem {
  sentiment: Sentiment;
  category: ReviewCategory;
  keywords: string[];
}

const SENTIMENT_CONFIG: Record<Sentiment, { label: string; color: string; active: string }> = {
  positive: { label: "긍정", color: "text-emerald-600", active: "bg-emerald-500 text-white border-emerald-500" },
  negative: { label: "부정", color: "text-rose-600",    active: "bg-rose-500 text-white border-rose-500" },
  neutral:  { label: "중립", color: "text-zinc-500",    active: "bg-zinc-500 text-white border-zinc-500" },
};

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  gameplay:     "게임플레이",
  ui:           "UI/UX",
  performance:  "성능",
  monetization: "결제/광고",
  content:      "콘텐츠",
  bug:          "버그",
  other:        "기타",
};

const SENTIMENTS = Object.keys(SENTIMENT_CONFIG) as Sentiment[];
const CATEGORIES = Object.keys(CATEGORY_LABEL) as ReviewCategory[];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-xs">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

interface Props {
  reviews: ReviewItem[];
  analyses: AnalysisItem[];
}

export default function ReviewList({ reviews, analyses }: Props) {
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ReviewCategory | "all">("all");
  const [shown, setShown] = useState(PAGE_SIZE);

  // 리뷰 + 분석 페어링 후 필터 적용
  const filtered = useMemo(() => {
    return reviews
      .map((review, i) => ({ review, analysis: analyses[i] }))
      .filter(({ analysis }) => {
        if (!analysis) return false;
        if (sentimentFilter !== "all" && analysis.sentiment !== sentimentFilter) return false;
        if (categoryFilter !== "all" && analysis.category !== categoryFilter) return false;
        return true;
      });
  }, [reviews, analyses, sentimentFilter, categoryFilter]);

  // 필터 변경 시 페이지 리셋
  function handleSentiment(val: Sentiment | "all") {
    setSentimentFilter(val);
    setShown(PAGE_SIZE);
  }
  function handleCategory(val: ReviewCategory | "all") {
    setCategoryFilter(val);
    setShown(PAGE_SIZE);
  }

  const visible = filtered.slice(0, shown);
  const hasMore = shown < filtered.length;

  return (
    <div className="space-y-4">
      {/* 감성 필터 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleSentiment("all")}
          className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
            sentimentFilter === "all"
              ? "bg-zinc-800 text-white border-zinc-800"
              : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          전체
        </button>
        {SENTIMENTS.map((s) => {
          const cfg = SENTIMENT_CONFIG[s];
          const active = sentimentFilter === s;
          return (
            <button
              key={s}
              onClick={() => handleSentiment(s)}
              className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                active ? cfg.active : `${cfg.color} border-zinc-200 hover:border-zinc-400`
              }`}
            >
              {cfg.label}
            </button>
          );
        })}
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleCategory("all")}
          className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
            categoryFilter === "all"
              ? "bg-indigo-500 text-white border-indigo-500"
              : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          전체 카테고리
        </button>
        {CATEGORIES.map((c) => {
          const active = categoryFilter === c;
          return (
            <button
              key={c}
              onClick={() => handleCategory(c)}
              className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                active
                  ? "bg-indigo-500 text-white border-indigo-500"
                  : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              {CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>

      {/* 결과 카운트 */}
      <p className="text-xs text-zinc-400">
        {sentimentFilter === "all" && categoryFilter === "all"
          ? `총 ${filtered.length}건`
          : `필터 결과 ${filtered.length}건 / 전체 ${reviews.length}건`}
      </p>

      {/* 리뷰 카드 */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-zinc-300 text-sm">
          해당 조건의 리뷰가 없습니다.
        </div>
      ) : (
        <>
          {visible.map(({ review, analysis }, i) => {
            const sentCfg = analysis ? SENTIMENT_CONFIG[analysis.sentiment] : null;
            return (
              <Card key={i} className="border-zinc-100">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} />
                      <span className="text-[10px] text-zinc-300">
                        {new Date(review.review_date).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {analysis && (
                        <>
                          <Badge variant="outline" className={`text-[10px] ${sentCfg?.color}`}>
                            {sentCfg?.label}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {CATEGORY_LABEL[analysis.category]}
                          </Badge>
                        </>
                      )}
                      {review.version && (
                        <span className="text-[10px] text-zinc-300">v{review.version}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed line-clamp-3">
                    {review.content}
                  </p>
                  {analysis?.keywords?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {analysis.keywords.map((kw) => (
                        <span key={kw} className="text-[10px] text-zinc-400">#{kw}</span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {hasMore && (
            <Button
              variant="outline"
              className="w-full text-zinc-500"
              onClick={() => setShown((prev) => Math.min(prev + PAGE_SIZE, filtered.length))}
            >
              <ChevronDown size={15} className="mr-1.5" />
              더 보기 ({shown}/{filtered.length})
            </Button>
          )}
        </>
      )}
    </div>
  );
}
