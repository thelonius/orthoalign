import type { CaseData, CaseMeta, DemoPlan, SuggestResponse } from "./types";
import type { ToothTransform } from "./store";

// VITE_API_MODE: 'static' (default) reads case JSON from /cases/ as static
// assets — works on any static host, no backend required.
// 'backend' calls the FastAPI server via vite proxy; useful for dev when
// you want the full Python+Celery stack alive.
const MODE = (import.meta.env.VITE_API_MODE as string) ?? "static";
// BASE учитывает vite-конфиг (base: '/' в dev, '/orthoalign/' в GH Pages).
// Без него fetch('/cases/...') ушёл бы в корень домена, минуя путь приложения.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export async function fetchCases(): Promise<CaseMeta[]> {
  const url = MODE === "backend" ? "/api/cases" : `${BASE}/cases/index.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchCase(id: string): Promise<CaseData> {
  const url = MODE === "backend" ? `/api/cases/${id}` : `${BASE}/cases/${id}.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// Демо-план — статический JSON, кладётся sync-cases'ом из backend/data/cases/<id>/plan.json.
// Работает на GH Pages где /api/suggest недоступен.
export async function fetchDemoPlan(id: string): Promise<DemoPlan | null> {
  const url = `${BASE}/cases/${id}_plan.json`;
  const r = await fetch(url);
  if (r.status === 404) return null;
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
