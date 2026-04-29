export type ToothLabel = number;

export interface CaseMeta {
  id: string;
  name: string;
  jaw: "upper" | "lower";
  toothCount: number;
  source: string;
  toothCenters: Record<string, [number, number, number]>;
  // Если у кейса есть парная челюсть — id второго кейса. Frontend подгружает оба
  // и рендерит вместе. Без этого поля кейс рендерится одной челюстью.
  pairedCaseId?: string;
  // isPrimary=false — кейс не показывается в списке выбора, только подгружается
  // как paired. true (или undefined) — обычный кейс в списке.
  isPrimary?: boolean;
}

export interface Transform {
  position: [number, number, number];
  rotationEuler: [number, number, number];
}

export interface CaseData extends CaseMeta {
  vertices: number[];
  faces: number[];
  labels: number[];
  toothInitialCenters: Record<string, [number, number, number]>;
}

export interface ToothAdjustment {
  label: number;
  delta_position: [number, number, number];
  rationale: string;
}

export interface SuggestResponse {
  commentary: string;
  adjustments: ToothAdjustment[];
  model: string;
  raw_llm_text?: string | null;
}

// Демо-план, собранный детерминистски в ml/generate_demo_plan.py.
// Используется на GH Pages, где /api/suggest недоступен.
export interface DemoPlan {
  id: string;
  kind: "demo";
  title: string;
  arch: { a: number; b: number; c: number };
  midline_x: number;
  targets: Record<
    string,
    {
      position: [number, number, number];
      quaternion: [number, number, number, number];
    }
  >;
}
