import { NextRequest, NextResponse } from "next/server";
// Supabase 클라이언트 완전 제거 — ByteString 오류 방지를 위해 raw fetch만 사용
import type { FetchReviewsRequest, FetchReviewsResponse, Platform } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const gplayScraper = require("google-play-scraper").default;

// ─── 수집 대상 로케일 ──────────────────────────────────────────────────────────
const IOS_STOREFRONTS = [
  { lang: "en", storefront: "143441-1,29" }, // 미국
  { lang: "ko", storefront: "143466-1,29" }, // 한국
  { lang: "ja", storefront: "143462-1,29" }, // 일본
  { lang: "de", storefront: "143443-1,29" }, // 독일
];

const ANDROID_LOCALES = [
  { lang: "en", country: "us" },
  { lang: "ko", country: "kr" },
  { lang: "ja", country: "jp" },
  { lang: "de", country: "de" },
];

const PER_LOCALE = 40; // 로케일당 수집 건수

// ─── Types ────────────────────────────────────────────────────────────────────
interface ScrapedReview {
  app_id: string;
  platform: Platform;
  lang: string;
  version: string | null;
  rating: number;
  content: string;
  review_date: string;
}

interface MZReview {
  body: string;
  date: string;
  rating: number;
}

// ─── PostgREST raw fetch 헬퍼 ────────────────────────────────────────────────
function pgUrl() { return process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(); }
function pgKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(); }
function pgHeaders() {
  return {
    "apikey":        pgKey(),
    "Authorization": `Bearer ${pgKey()}`,
    "Content-Type":  "application/json",
  };
}

// ─── DB 최신 날짜 조회 ────────────────────────────────────────────────────────
async function getLatestDatesByLang(
  appId: string,
  platform: Platform
): Promise<Record<string, string>> {
  try {
    const params = new URLSearchParams({
      select:    "lang,review_date",
      app_id:    `eq.${appId}`,
      platform:  `eq.${platform}`,
      order:     "review_date.desc",
    });
    const res = await fetch(`${pgUrl()}/rest/v1/reviews?${params}`, {
      headers: pgHeaders(),
    });
    if (!res.ok) return {};
    const data = await res.json() as { lang: string; review_date: string }[];
    return data.reduce<Record<string, string>>((acc, row) => {
      if (!acc[row.lang]) acc[row.lang] = row.review_date;
      return acc;
    }, {});
  } catch (e) {
    console.warn("[fetch] getLatestDatesByLang failed:", e instanceof Error ? e.message : e);
    return {};
  }
}

// ─── iOS: 로케일별 수집 ───────────────────────────────────────────────────────
async function fetchMZStorePage(
  appId: string,
  storefront: string,
  startIndex: number
): Promise<MZReview[]> {
  const url = `https://itunes.apple.com/WebObjects/MZStore.woa/wa/userReviewsRow?id=${appId}&displayable-kind=11&startIndex=${startIndex}&endIndex=${startIndex + 19}&sort=4`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "iTunes/12.0 (Macintosh; OS X 10.15)",
        "X-Apple-Store-Front": storefront,
      },
    });
    if (!res.ok) return [];
    const json = await res.json() as { userReviewList?: MZReview[] };
    return json.userReviewList ?? [];
  } catch (e) {
    // Apple CDN이 non-Latin1 응답 헤더를 보낼 때 undici ByteString 에러 발생
    // 해당 페이지만 스킵하고 나머지 계속 수집
    console.warn(`[fetch] MZStore page skipped (startIndex:${startIndex}):`, e instanceof Error ? e.message : e);
    return [];
  }
}

async function fetchIosLocale(
  appId: string,
  lang: string,
  storefront: string,
  after?: string
): Promise<ScrapedReview[]> {
  try {
    const pages = Math.ceil(PER_LOCALE / 20);
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) => fetchMZStorePage(appId, storefront, i * 20))
    );
    const cutoff = after ? new Date(after) : null;
    return results.flat()
      .slice(0, PER_LOCALE)
      .filter((r) => !cutoff || new Date(r.date) > cutoff)
      .map((r) => ({
        app_id: appId,
        platform: "ios" as Platform,
        lang,
        version: null,
        rating: r.rating,
        content: r.body,
        review_date: new Date(r.date).toISOString(),
      }));
  } catch (e) {
    console.warn(`[fetch] iOS locale ${lang} skipped:`, e instanceof Error ? e.message : e);
    return [];
  }
}

async function fetchIosReviews(appId: string): Promise<ScrapedReview[]> {
  const latestDates = await getLatestDatesByLang(appId, "ios");
  const results = await Promise.all(
    IOS_STOREFRONTS.map(({ lang, storefront }) =>
      fetchIosLocale(appId, lang, storefront, latestDates[lang])
    )
  );
  return results.flat();
}

// ─── Android: 로케일별 수집 ───────────────────────────────────────────────────
async function fetchAndroidLocale(
  packageName: string,
  lang: string,
  country: string,
  after?: string
): Promise<ScrapedReview[]> {
  try {
    const result = await gplayScraper.reviews({
      appId: packageName,
      lang,
      country,
      sort: gplayScraper.sort.NEWEST,
      num: PER_LOCALE,
    });
    const items = (result.data ?? result) as { score: number; text: string; version: string; date: string }[];
    const cutoff = after ? new Date(after) : null;
    return items
      .slice(0, PER_LOCALE)
      .filter((r) => !cutoff || new Date(r.date) > cutoff)
      .map((r) => ({
        app_id: packageName,
        platform: "android" as Platform,
        lang,
        version: r.version ?? null,
        rating: r.score,
        content: r.text ?? "",
        review_date: new Date(r.date).toISOString(),
      }));
  } catch {
    console.warn(`[fetch] android locale ${lang}-${country} failed, skipping`);
    return [];
  }
}

async function fetchAndroidReviews(packageName: string): Promise<ScrapedReview[]> {
  const latestDates = await getLatestDatesByLang(packageName, "android");
  const results = await Promise.all(
    ANDROID_LOCALES.map(({ lang, country }) =>
      fetchAndroidLocale(packageName, lang, country, latestDates[lang])
    )
  );
  return results.flat();
}

// ─── DB upsert ────────────────────────────────────────────────────────────────
// supabase-js 클라이언트 우회 — 한/일/중 문자가 content에 포함될 때
// postgrest-js 내부에서 ByteString 오류가 발생하므로 raw fetch로 직접 호출
async function upsertReviews(
  reviews: ScrapedReview[]
): Promise<{ inserted: number; skipped: number }> {
  const rows = reviews.map((r) => ({
    ...r,
    // null byte 및 제어문자 제거 (DB 저장 안전성 확보)
    content: r.content.replace(/\0/g, "").trim(),
    fetched_at: new Date().toISOString(),
  }));

  const res = await fetch(
    `${pgUrl()}/rest/v1/reviews?on_conflict=app_id%2Cplatform%2Ccontent%2Creview_date%2Clang`,
    {
      method: "POST",
      headers: { ...pgHeaders(), "Prefer": "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(rows),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert error: ${res.status} ${text}`);
  }

  return { inserted: rows.length, skipped: 0 };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as FetchReviewsRequest;
    const { app_id, platform } = body;

    if (!app_id || !platform) {
      return NextResponse.json({ error: "app_id and platform are required" }, { status: 400 });
    }

    const scraped =
      platform === "ios"
        ? await fetchIosReviews(app_id)
        : await fetchAndroidReviews(app_id);

    const valid = scraped.filter((r) => r.content.trim().length > 0);

    const langBreakdown = valid.reduce<Record<string, number>>((acc, r) => {
      acc[r.lang] = (acc[r.lang] ?? 0) + 1;
      return acc;
    }, {});

    const { inserted, skipped } = await upsertReviews(valid);

    console.log(
      `[fetch] ${platform} ${app_id} — scraped: ${scraped.length}, after-cutoff: ${valid.length}, inserted: ${inserted}, skipped: ${skipped} | langs: ${JSON.stringify(langBreakdown)}`
    );

    return NextResponse.json({ inserted, skipped } satisfies FetchReviewsResponse);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[fetch] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
