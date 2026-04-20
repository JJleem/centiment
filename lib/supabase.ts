import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// non-Latin1 문자 제거 — env var 붙여넣기 시 한글 IME 잔류 문자 방어
function sanitizeKey(key: string): string {
  return (key ?? "").trim().replace(/[^\x00-\xFF]/g, "");
}

// 클라이언트 사이드용 (읽기)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 서버 사이드 API route용 (쓰기 — RLS 우회)
export const supabaseAdmin = createClient(
  supabaseUrl,
  sanitizeKey(process.env.SUPABASE_SERVICE_ROLE_KEY!)
);
