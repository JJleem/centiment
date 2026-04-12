"use client";

import { useState } from "react";
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

const SENTIMENT_CONFIG: Record<Sentiment, { label: string; color: string }> = {
  positive: { label: "긍정", color: "text-emerald-600" },
  negative: { label: "부정", color: "text-rose-600" },
  neutral:  { label: "중립", color: "text-zinc-500" },
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
  const [shown, setShown] = useState(PAGE_SIZE);
  const visible = reviews.slice(0, shown);
  const hasMore = shown < reviews.length;

  return (
    <div className="space-y-3">
      {visible.map((review, i) => {
        const analysis = analyses[i];
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
          onClick={() => setShown((prev) => Math.min(prev + PAGE_SIZE, reviews.length))}
        >
          <ChevronDown size={15} className="mr-1.5" />
          더 보기 ({shown}/{reviews.length})
        </Button>
      )}
    </div>
  );
}
