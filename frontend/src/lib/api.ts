import type { CaseData, CaseMeta } from "./types";

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
