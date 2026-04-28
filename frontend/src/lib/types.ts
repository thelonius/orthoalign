export type ToothLabel = number;

export interface CaseMeta {
  id: string;
  name: string;
  jaw: "upper" | "lower";
  toothCount: number;
  source: string;
  toothCenters: Record<string, [number, number, number]>;
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
