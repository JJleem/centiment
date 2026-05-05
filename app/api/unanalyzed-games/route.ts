import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { SUPERCENT_GAMES } from "@/lib/presets";

export interface UnanalyzedGame {
  game_id: string;
  name: string;
  icon_url: string;
  genre: string;
  ios_reviews: number;   // reviews 테이블의 미분석 건수
  android_reviews: number;
  estimated_cost: number; // USD
}

// 토큰 비용 추정
// Haiku: 입력 $0.80/M · 출력 $4/M  → 리뷰당 평균 ~$0.0004
// Sonnet: 요약 고정 ~$0.02/플랫폼
const HAIKU_PER_REVIEW = 0.0004;
const SONNET_PER_PLATFORM = 0.02;

export async function GET() {
  // 이미 분석된 app_id 목록 — 1000행 한도 우회를 위해 known app_ids로 필터 후 페이지네이션
  const allKnownAppIds = SUPERCENT_GAMES.flatMap((g) => [g.ios_app_id, g.android_package]);
  const analyzedIds = new Set<string>();
  const PAGE_SIZE = 1000;
  let page = 0;
  while (true) {
    const { data } = await supabaseAdmin
      .from("review_analysis")
      .select("app_id")
      .in("app_id", allKnownAppIds)
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (!data || data.length === 0) break;
    for (const r of data) analyzedIds.add(r.app_id as string);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  // 완전히 미분석인 게임 (iOS / Android 둘 다 없는 것)
  const unanalyzedGames = SUPERCENT_GAMES.filter(
    (g) => !analyzedIds.has(g.ios_app_id) && !analyzedIds.has(g.android_package)
  );

  if (unanalyzedGames.length === 0) return NextResponse.json({ games: [] });

  // 각 게임의 수집된 리뷰 수 조회 (페이지네이션)
  const allAppIds = unanalyzedGames.flatMap((g) => [g.ios_app_id, g.android_package]);
  const countMap: Record<string, number> = {};
  if (allAppIds.length > 0) {
    let rPage = 0;
    while (true) {
      const { data: reviewCounts } = await supabaseAdmin
        .from("reviews")
        .select("app_id")
        .in("app_id", allAppIds)
        .range(rPage * PAGE_SIZE, (rPage + 1) * PAGE_SIZE - 1);
      if (!reviewCounts || reviewCounts.length === 0) break;
      for (const row of reviewCounts) {
        countMap[row.app_id] = (countMap[row.app_id] ?? 0) + 1;
      }
      if (reviewCounts.length < PAGE_SIZE) break;
      rPage++;
    }
  }

  // 로케일당 40건 × 4로케일 = 160건/플랫폼 (수집 예상 최대치)
  const DEFAULT_PER_PLATFORM = 160;

  const games: UnanalyzedGame[] = unanalyzedGames.map((g) => {
    const iosInDb = countMap[g.ios_app_id] ?? 0;
    const androidInDb = countMap[g.android_package] ?? 0;
    // DB에 있으면 실제 수, 없으면 기본 예상치 사용
    const ios = iosInDb > 0 ? iosInDb : DEFAULT_PER_PLATFORM;
    const android = androidInDb > 0 ? androidInDb : DEFAULT_PER_PLATFORM;
    const total = ios + android;
    const cost = total * HAIKU_PER_REVIEW + 2 * SONNET_PER_PLATFORM;
    return {
      game_id: g.id,
      name: g.name,
      icon_url: g.icon_url,
      genre: g.genre,
      ios_reviews: ios,
      android_reviews: android,
      estimated_cost: Math.round(cost * 1000) / 1000,
    };
  });

  return NextResponse.json({ games });
}
