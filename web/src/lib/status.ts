import type { Snapshot } from "@/api/queries";
import { isStale } from "./format";

export type Tone = "ok" | "warn" | "danger" | "info" | "violet" | "neutral";

export function statusTone(status?: string | null): Tone {
  const value = (status ?? "").toLowerCase();
  if (!value) return "neutral";
  if (/(ошиб|авар|error|fault|alarm|стоп|stop|блок)/.test(value)) return "danger";
  if (/(работ|выполн|run|active|цикл|cut)/.test(value)) return "ok";
  if (/(готов|ожидан|idle|ready|пауза|pause|заверш)/.test(value)) return "info";
  if (/(налад|setup|ручн|manual)/.test(value)) return "warn";
  return "neutral";
}

export function modeTone(mode?: string | null): Tone {
  const value = (mode ?? "").toLowerCase();
  if (!value) return "neutral";
  if (/(авто|auto)/.test(value)) return "info";
  if (/(ручн|manual|jog)/.test(value)) return "warn";
  if (/(mdi|полуавт|semi)/.test(value)) return "violet";
  return "neutral";
}

export function programTone(percent?: number | null): Tone {
  if (percent === null || percent === undefined) return "neutral";
  if (percent >= 100) return "ok";
  if (percent > 0) return "info";
  return "neutral";
}

export function isSnapshotStale(snapshot: Snapshot): boolean {
  return !snapshot.online || isStale(snapshot.received_at);
}

export function standName(standId: number): string {
  return `Стенд ${standId}`;
}
