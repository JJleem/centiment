"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, Smartphone, Play, X, Search } from "lucide-react";
import type { Sentiment, ReviewCategory, Platform } from "@/types";

const PAGE_SIZE = 20;

export interface CombinedItem {
  content: string;
  rating: number;
  version: string | null;
  review_date: string;
  platform: Platform;
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

function PlatformBadge({ platform }: { platform: Platform }) {
  const isIos = platform === "ios";
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
      isIos ? "bg-sky-50 text-sky-600" : "bg-teal-50 text-teal-600"
    }`}>
      {isIos ? <Smartphone size={9} /> : <Play size={9} />}
      {isIos ? "iOS" : "Android"}
    </span>
  );
}

interface Props {
  items: CombinedItem[];
}

function ReviewModal({ item, onClose }: { item: CombinedItem; onClose: () => void }) {
  const sentCfg = SENTIMENT_CONFIG[item.sentiment];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={item.platform} />
            <StarRating rating={item.rating} />
            <span className="text-[10px] text-zinc-300">
              {new Date(item.review_date).toLocaleDateString("ko-KR", {
                year: "numeric", month: "short", day: "numeric",
              })}
            </span>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors">
            <X size={16} />
          </button>
        </div>
        {/* 배지 */}
        <div className="flex items-center gap-1.5 px-5 py-2 border-b border-zinc-50">
          <Badge variant="outline" className={`text-[10px] ${sentCfg.color}`}>{sentCfg.label}</Badge>
          <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABEL[item.category]}</Badge>
          {item.version && <span className="text-[10px] text-zinc-300">v{item.version}</span>}
        </div>
        {/* 본문 */}
        <div className="overflow-y-auto px-5 py-4">
          <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{item.content}</p>
          {item.keywords?.length > 0 && (
            <div className="flex gap-1 mt-4">
              {item.keywords.map((kw) => (
                <span key={kw} className="text-[10px] text-zinc-400">#{kw}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReviewList({ items }: Props) {
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<ReviewCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<CombinedItem | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) return false;
      if (sentimentFilter !== "all" && item.sentiment !== sentimentFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (q && !item.content.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, platformFilter, sentimentFilter, categoryFilter, search]);

  // 검색어 하이라이트
  function highlight(text: string) {
    const q = search.trim();
    if (!q) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  }

  function resetPage() { setShown(PAGE_SIZE); }

  const visible = filtered.slice(0, shown);
  const hasMore = shown < filtered.length;

  return (
    <div className="space-y-4">
      {/* 검색창 */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          placeholder="리뷰 내용 검색..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); resetPage(); }}
          className="w-full pl-8 pr-8 py-2 text-sm border border-zinc-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
        />
        {search && (
          <button
            onClick={() => { setSearch(""); resetPage(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* 플랫폼 필터 */}
      <div className="flex gap-2">
        {(["all", "ios", "android"] as const).map((p) => {
          const active = platformFilter === p;
          const label = p === "all" ? "전체" : p === "ios" ? "iOS" : "Android";
          const Icon = p === "ios" ? Smartphone : p === "android" ? Play : null;
          return (
            <button
              key={p}
              onClick={() => { setPlatformFilter(p); resetPage(); }}
              className={`flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                active
                  ? p === "ios"
                    ? "bg-sky-500 text-white border-sky-500"
                    : p === "android"
                    ? "bg-teal-500 text-white border-teal-500"
                    : "bg-zinc-800 text-white border-zinc-800"
                  : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
              }`}
            >
              {Icon && <Icon size={10} />}
              {label}
            </button>
          );
        })}
      </div>

      {/* 감성 필터 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setSentimentFilter("all"); resetPage(); }}
          className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
            sentimentFilter === "all"
              ? "bg-zinc-800 text-white border-zinc-800"
              : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          전체 감성
        </button>
        {SENTIMENTS.map((s) => {
          const cfg = SENTIMENT_CONFIG[s];
          const active = sentimentFilter === s;
          return (
            <button
              key={s}
              onClick={() => { setSentimentFilter(s); resetPage(); }}
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
          onClick={() => { setCategoryFilter("all"); resetPage(); }}
          className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
            categoryFilter === "all"
              ? "bg-indigo-500 text-white border-indigo-500"
              : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
          }`}
        >
          전체 카테고리
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => { setCategoryFilter(c); resetPage(); }}
            className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
              categoryFilter === c
                ? "bg-indigo-500 text-white border-indigo-500"
                : "text-zinc-500 border-zinc-200 hover:border-zinc-400"
            }`}
          >
            {CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      {/* 결과 카운트 */}
      <p className="text-xs text-zinc-400">
        {filtered.length === items.length
          ? `총 ${filtered.length}건`
          : `필터 결과 ${filtered.length}건 / 전체 ${items.length}건`}
      </p>

      {/* 리뷰 카드 */}
      {selected && <ReviewModal item={selected} onClose={() => setSelected(null)} />}

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-zinc-300 text-sm">
          해당 조건의 리뷰가 없습니다.
        </div>
      ) : (
        <>
          {visible.map((item, i) => {
            const sentCfg = SENTIMENT_CONFIG[item.sentiment];
            return (
              <Card
                key={i}
                className="border-zinc-100 cursor-pointer hover:border-zinc-300 transition-colors"
                onClick={() => setSelected(item)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={item.platform} />
                      <StarRating rating={item.rating} />
                      <span className="text-[10px] text-zinc-300">
                        {new Date(item.review_date).toLocaleDateString("ko-KR", {
                          year: "numeric", month: "short", day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${sentCfg.color}`}>
                        {sentCfg.label}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {CATEGORY_LABEL[item.category]}
                      </Badge>
                      {item.version && (
                        <span className="text-[10px] text-zinc-300">v{item.version}</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-zinc-700 leading-relaxed line-clamp-3">
                    {highlight(item.content)}
                  </p>
                  {item.keywords?.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {item.keywords.map((kw) => (
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
