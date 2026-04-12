import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import type { FetchReviewsRequest, FetchReviewsResponse, Platform } from "@/types";

// ─── Scraper imports (CommonJS) ──────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const gplayScraper = require("google-play-scraper").default;

// ─── Normalized shape after scraping ────────────────────────────────────────
interface ScrapedReview {
  app_id: string;
  platform: Platform;
  version: string | null;
  rating: number;
  content: string;
  review_date: string;
}

// ─── iOS scraper (MZStore API) ───────────────────────────────────────────────
interface MZReview {
  userReviewId: string;
  body: string;
  date: string;
  rating: number;
  title: string;
}

async function fetchMZStorePage(appId: string, startIndex: number): Promise<MZReview[]> {
  const url = `https://itunes.apple.com/WebObjects/MZStore.woa/wa/userReviewsRow?id=${appId}&displayable-kind=11&startIndex=${startIndex}&endIndex=${startIndex + 19}&sort=4`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "iTunes/12.0 (Macintosh; OS X 10.15)",
      "X-Apple-Store-Front": "143441-1,29",
    },
  });
  if (!res.ok) return [];
  const json = await res.json() as { userReviewList?: MZReview[] };
  return json.userReviewList ?? [];
}

async function fetchIosReviews(appId: string, count: number): Promise<ScrapedReview[]> {
  const pages = Math.ceil(Math.min(count, 100) / 20);
  const results = await Promise.all(
    Array.from({ length: pages }, (_, i) => fetchMZStorePage(appId, i * 20))
  );

  const flat = results.flat();
  return flat.slice(0, count).map((r) => ({
    app_id: appId,
    platform: "ios",
    version: null,
    rating: r.rating,
    content: r.body,
    review_date: new Date(r.date).toISOString(),
  }));
}

// ─── Android scraper ──────────────────────────────────────────────────────────
async function fetchAndroidReviews(packageName: string, count: number): Promise<ScrapedReview[]> {
  const result = await gplayScraper.reviews({
    appId: packageName,
    lang: "en",
    country: "us",
    sort: gplayScraper.sort.NEWEST,
    num: Math.min(count, 200),
  });

  const items = (result.data ?? result) as {
    score: number;
    text: string;
    version: string;
    date: string;
  }[];

  return items.slice(0, count).map((r) => ({
    app_id: packageName,
    platform: "android",
    version: r.version ?? null,
    rating: r.score,
    content: r.text ?? "",
    review_date: new Date(r.date).toISOString(),
  }));
}

// ─── DB upsert (배치) ─────────────────────────────────────────────────────────
async function upsertReviews(
  reviews: ScrapedReview[]
): Promise<{ inserted: number; skipped: number }> {
  const rows = reviews.map((r) => ({ ...r, fetched_at: new Date().toISOString() }));

  const { data, error } = await supabase
    .from("reviews")
    .upsert(rows, {
      onConflict: "app_id,platform,content,review_date",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) throw new Error(`Supabase upsert error: ${error.message}`);

  const inserted = data?.length ?? 0;
  const skipped = reviews.length - inserted;
  return { inserted, skipped };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FetchReviewsRequest;
    const { app_id, platform, count = 100 } = body;

    if (!app_id || !platform) {
      return NextResponse.json({ error: "app_id and platform are required" }, { status: 400 });
    }

    const scraped =
      platform === "ios"
        ? await fetchIosReviews(app_id, count)
        : await fetchAndroidReviews(app_id, count);

    // content가 비어있는 리뷰 제거 (별점만 남긴 리뷰)
    const valid = scraped.filter((r) => r.content.trim().length > 0);

    const { inserted, skipped } = await upsertReviews(valid);

    console.log(`[fetch] ${platform} ${app_id} — scraped: ${scraped.length}, inserted: ${inserted}, skipped: ${skipped}`);

    return NextResponse.json({ inserted, skipped } satisfies FetchReviewsResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[fetch] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
