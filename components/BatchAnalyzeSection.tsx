"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown, ChevronUp, Loader2, Check, AlertCircle,
  Clock, Zap, DollarSign,
} from "lucide-react";
import { SUPERCENT_GAMES } from "@/lib/presets";
import { readAnalyzeStream } from "@/lib/utils";
import type { UnanalyzedGame } from "@/app/api/unanalyzed-games/route";

type GameStatus = "idle" | "fetching" | "analyzing" | "done" | "error";
interface GameProgress { status: GameStatus; error?: string; }

const CACHE_KEY = "centiment:unanalyzed-games";
const CACHE_TTL = 10 * 60 * 1000; // 10분

function readCache(): UnanalyzedGame[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: UnanalyzedGame[]; ts: number };
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeCache(data: UnanalyzedGame[]) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

function clearCache() {
  try { sessionStorage.removeItem(CACHE_KEY); } catch {}
}

export default function BatchAnalyzeSection() {
  const router = useRouter();
  const [games, setGames] = useState<UnanalyzedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, GameProgress>>({});

  const fetchGames = useCallback((force = false) => {
    if (!force) {
      const cached = readCache();
      if (cached) { setGames(cached); setLoading(false); return; }
    }
    setLoading(true);
    fetch("/api/unanalyzed-games")
      .then((r) => r.json())
      .then((d) => { const list = d.games ?? []; writeCache(list); setGames(list); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  if (!loading && games.length === 0) return null;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedGames = games.filter((g) => selected.has(g.game_id));
  const totalCost = selectedGames.reduce((s, g) => s + g.estimated_cost, 0);
  const totalReviews = selectedGames.reduce((s, g) => s + g.ios_reviews + g.android_reviews, 0);

  async function runBatch() {
    setConfirming(false);
    setRunning(true);
    setProgress(Object.fromEntries(selectedGames.map((g) => [g.game_id, { status: "idle" as GameStatus }])));

    for (const game of selectedGames) {
      const preset = SUPERCENT_GAMES.find((g) => g.id === game.game_id);
      if (!preset) continue;

      try {
        // 1. 수집
        setProgress((p) => ({ ...p, [game.game_id]: { status: "fetching" } }));
        const [iosFetch, androidFetch] = await Promise.all([
          fetch("/api/reviews/fetch", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_id: preset.ios_app_id, platform: "ios", count: 100 }),
          }),
          fetch("/api/reviews/fetch", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_id: preset.android_package, platform: "android", count: 100 }),
          }),
        ]);
        if (!iosFetch.ok || !androidFetch.ok) throw new Error("리뷰 수집 실패");

        // 2. 분석
        setProgress((p) => ({ ...p, [game.game_id]: { status: "analyzing" } }));
        const [iosRes, androidRes] = await Promise.all([
          fetch("/api/reviews/analyze", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_id: preset.ios_app_id, platform: "ios" }),
          }),
          fetch("/api/reviews/analyze", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ app_id: preset.android_package, platform: "android" }),
          }),
        ]);
        if (!iosRes.ok || !androidRes.ok) throw new Error("분석 실패");
        await Promise.all([readAnalyzeStream(iosRes, () => {}), readAnalyzeStream(androidRes, () => {})]);

        setProgress((p) => ({ ...p, [game.game_id]: { status: "done" } }));
      } catch (e) {
        setProgress((p) => ({
          ...p,
          [game.game_id]: { status: "error", error: e instanceof Error ? e.message : "오류" },
        }));
      }
    }

    setRunning(false);
    clearCache();
    fetchGames(true); // 캐시 무효화 + 강제 재조회
  }

  const statusIcon = (s: GameStatus) => ({
    idle:      <Clock size={12} className="text-zinc-300" />,
    fetching:  <Loader2 size={12} className="animate-spin text-sky-400" />,
    analyzing: <Loader2 size={12} className="animate-spin text-indigo-400" />,
    done:      <Check size={12} className="text-emerald-500" />,
    error:     <AlertCircle size={12} className="text-rose-500" />,
  }[s]);

  const statusLabel = (s: GameStatus) => ({
    idle:      <span className="text-zinc-300">대기</span>,
    fetching:  <span className="text-sky-500">수집 중...</span>,
    analyzing: <span className="text-indigo-500">분석 중...</span>,
    done:      <span className="text-emerald-600 font-medium">완료</span>,
    error:     <span className="text-rose-500">오류</span>,
  }[s]);

  const doneCount = Object.values(progress).filter((p) => p.status === "done").length;

  return (
    <section>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 hover:text-zinc-600 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Zap size={12} className="text-amber-400" />
          미분석 게임
          {loading
            ? <Loader2 size={10} className="animate-spin ml-1" />
            : <span className="normal-case font-normal text-zinc-300 ml-1">{games.length}개</span>
          }
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && !loading && (
        <div className="space-y-3">
          {/* 전체 선택/해제 */}
          {!running && (
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <button onClick={() => setSelected(new Set(games.map((g) => g.game_id)))} className="hover:text-indigo-600 transition-colors">전체 선택</button>
              <span className="text-zinc-200">·</span>
              <button onClick={() => setSelected(new Set())} className="hover:text-zinc-600 transition-colors">전체 해제</button>
            </div>
          )}

          {/* 게임 목록 */}
          <div className="space-y-2">
            {games.map((game) => {
              const prog = progress[game.game_id];
              return (
                <div
                  key={game.game_id}
                  className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${
                    selected.has(game.game_id) && !running ? "border-indigo-200 shadow-sm" : "border-zinc-100"
                  }`}
                >
                  {prog ? (
                    <div className="shrink-0">{statusIcon(prog.status)}</div>
                  ) : (
                    <input
                      type="checkbox"
                      checked={selected.has(game.game_id)}
                      onChange={() => toggleSelect(game.game_id)}
                      disabled={running}
                      className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer shrink-0"
                    />
                  )}
                  <img src={game.icon_url} alt={game.name} className="w-8 h-8 rounded-xl shadow-sm shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-zinc-800 truncate">{game.name}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {game.ios_reviews > 0 && <span className="text-sky-500">iOS {game.ios_reviews}건 </span>}
                      {game.android_reviews > 0 && <span className="text-teal-500">Android {game.android_reviews}건</span>}
                      {game.ios_reviews === 0 && game.android_reviews === 0 && <span>리뷰 미수집</span>}
                    </p>
                  </div>
                  {prog ? (
                    <div className="text-[10px]">{statusLabel(prog.status)}</div>
                  ) : (
                    <span className="text-[10px] text-zinc-400 shrink-0">~${game.estimated_cost.toFixed(3)}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 선택 요약 + 시작 */}
          {selected.size > 0 && !running && Object.keys(progress).length === 0 && (
            <div className="bg-white border border-indigo-100 rounded-2xl px-5 py-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600">
                  <span className="font-semibold text-indigo-600">{selected.size}개</span> 선택
                  {totalReviews > 0 && <span className="text-zinc-400 ml-1">· {totalReviews}건</span>}
                </span>
                <span className="flex items-center gap-1 font-semibold text-zinc-700">
                  <DollarSign size={11} className="text-emerald-500" />
                  예상 ~${totalCost.toFixed(3)}
                </span>
              </div>
              <button
                onClick={() => setConfirming(true)}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 shadow-md shadow-indigo-200 hover:from-indigo-600 hover:to-violet-600 transition-all flex items-center justify-center gap-2"
              >
                <Zap size={14} /> 일괄 분석 시작
              </button>
            </div>
          )}

          {/* 실행 중 진행 바 */}
          {running && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-indigo-700 mb-1">
                분석 중... ({doneCount}/{selectedGames.length})
              </p>
              <div className="h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full transition-all duration-500"
                  style={{ width: `${selectedGames.length > 0 ? Math.round((doneCount / selectedGames.length) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* 완료 요약 */}
          {!running && Object.keys(progress).length > 0 && (
            <div className="bg-white border border-zinc-100 rounded-xl px-4 py-3 space-y-2 shadow-sm">
              <p className="text-xs font-semibold text-zinc-700">
                완료 {doneCount}/{selectedGames.length}
              </p>
              {selectedGames.map((g) => {
                const p = progress[g.game_id];
                if (!p) return null;
                return (
                  <div key={g.game_id} className="flex items-center gap-2">
                    {statusIcon(p.status)}
                    <span className="text-xs text-zinc-700 flex-1 truncate">{g.name}</span>
                    {p.status === "done" && (
                      <button onClick={() => router.push(`/result?game=${g.game_id}`)} className="text-[10px] text-indigo-500 hover:underline shrink-0">
                        결과 보기 →
                      </button>
                    )}
                    {p.status === "error" && <span className="text-[10px] text-rose-400">{p.error}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 확인 모달 */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setConfirming(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-zinc-900">일괄 분석 시작</h2>
            <div className="space-y-1.5 text-sm text-zinc-600">
              <div className="flex justify-between"><span>선택한 게임</span><span className="font-semibold text-zinc-800">{selected.size}개</span></div>
              <div className="flex justify-between"><span>분석 예정 리뷰</span><span className="font-semibold text-zinc-800">{totalReviews}건</span></div>
              <div className="flex justify-between"><span>예상 API 비용</span><span className="font-semibold text-emerald-700">${totalCost.toFixed(3)}</span></div>
            </div>
            <p className="text-xs text-zinc-400 bg-zinc-50 rounded-lg px-3 py-2">게임을 순차적으로 분석합니다. 페이지를 닫지 마세요.</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">취소</button>
              <button onClick={runBatch} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-500 shadow-md shadow-indigo-200 transition-all">시작</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
