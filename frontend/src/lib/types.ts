export type ToothLabel = number;

export interface CaseMeta {
  id: string;
  name: string;
  jaw: "upper" | "lower";
  toothCount: number;
  source: string;
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
