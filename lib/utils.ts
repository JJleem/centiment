import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { AnalyzeProgressEvent } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── NDJSON 스트림 리더 ────────────────────────────────────────────────────
export async function readAnalyzeStream(
  response: Response,
  onEvent: (event: AnalyzeProgressEvent) => void
): Promise<void> {
  if (!response.body) throw new Error("응답 스트림이 없습니다");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let errorMsg: string | null = null;

  outer: while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const event = JSON.parse(trimmed) as AnalyzeProgressEvent;
        if (event.type === "error") { errorMsg = event.message; break outer; }
        onEvent(event);
      } catch {}
    }
  }

  if (buffer.trim() && !errorMsg) {
    try {
      const event = JSON.parse(buffer) as AnalyzeProgressEvent;
      if (event.type === "error") errorMsg = event.message;
      else onEvent(event);
    } catch {}
  }

  if (errorMsg) throw new Error(errorMsg);
}
