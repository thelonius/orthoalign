import type { CaseData, CaseMeta, SuggestResponse } from "./types";
import type { ToothTransform } from "./store";

// VITE_API_MODE: 'static' (default) reads case JSON from /cases/ as static
// assets — works on any static host, no backend required.
// 'backend' calls the FastAPI server via vite proxy; useful for dev when
// you want the full Python+Celery stack alive.
const MODE = (import.meta.env.VITE_API_MODE as string) ?? "static";

export async function fetchCases(): Promise<CaseMeta[]> {
  const url = MODE === "backend" ? "/api/cases" : "/cases/index.json";
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchCase(id: string): Promise<CaseData> {
  const url = MODE === "backend" ? `/api/cases/${id}` : `/cases/${id}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function requestSuggest(
  caseId: string,
  currentTargets: Record<number, ToothTransform>,
): Promise<SuggestResponse> {
  // Конвертируем кватернионы в угол вокруг Z, чтобы LLM не пугать.
  const compact: Record<number, { position: [number, number, number]; rotation_deg_z: number }> = {};
  for (const [k, t] of Object.entries(currentTargets)) {
    const angDeg = (2 * Math.atan2(t.quaternion[2], t.quaternion[3]) * 180) / Math.PI;
    compact[Number(k)] = { position: t.position, rotation_deg_z: angDeg };
  }
  const r = await fetch("/api/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ case_id: caseId, current_targets: compact }),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`HTTP ${r.status}: ${text}`);
  }
  return r.json();
}
