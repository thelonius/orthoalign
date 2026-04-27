import type { CaseData, CaseMeta } from "./types";

const BASE = "/api";

export async function fetchCases(): Promise<CaseMeta[]> {
  const r = await fetch(`${BASE}/cases`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function fetchCase(id: string): Promise<CaseData> {
  const r = await fetch(`${BASE}/cases/${id}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
