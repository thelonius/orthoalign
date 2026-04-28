import { create } from "zustand";

export interface ToothTransform {
  position: [number, number, number];
  quaternion: [number, number, number, number];
}

const IDENTITY: ToothTransform = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
};

import type { Group } from "three";

type GizmoMode = "translate" | "rotate";

interface PlanState {
  caseId: string | null;
  stage: number;
  maxStage: number;
  selectedLabel: number | null;
  selectedObj: Group | null;
  targets: Record<number, ToothTransform>;
  gizmoMode: GizmoMode;

  setCase: (caseId: string) => void;
  setStage: (stage: number) => void;
  selectTooth: (label: number | null) => void;
  setSelectedObj: (obj: Group | null) => void;
  setTargetTransform: (label: number, transform: ToothTransform) => void;
  setAllTargets: (targets: Record<number, ToothTransform>) => void;
  resetTargets: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
}

export const usePlan = create<PlanState>()((set, get) => {
  if (typeof window !== "undefined") {
    (window as any).__plan = { get, set };
  }
  return {
  caseId: null,
  stage: 0,
  maxStage: 20,
  selectedLabel: null,
  selectedObj: null,
  targets: {},
  gizmoMode: "translate",

  setCase: (caseId) =>
    set({ caseId, stage: 0, selectedLabel: null, selectedObj: null, targets: {} }),
  setStage: (stage) => set({ stage }),
  selectTooth: (selectedLabel) =>
    // При выделении автоматом ставим стадию на максимум — так пользователь
    // редактирует «целевую» позицию, а не пытается двигать зуб в исходном
    // состоянии (что бессмысленно, т.к. отображение всё равно показывает
    // identity при stage=0).
    set((s) => ({
      selectedLabel,
      selectedObj: null,
      stage: selectedLabel != null ? s.maxStage : s.stage,
    })),
  setSelectedObj: (obj) => set({ selectedObj: obj }),
  setTargetTransform: (label, transform) =>
    set((s) => ({ targets: { ...s.targets, [label]: transform } })),
  setAllTargets: (targets) => set({ targets }),
  resetTargets: () => set({ targets: {}, selectedLabel: null, selectedObj: null }),
  setGizmoMode: (mode) => set({ gizmoMode: mode }),
};
});

export function getDisplayTransform(
  target: ToothTransform | undefined,
  stage: number,
  maxStage: number,
): ToothTransform {
  if (!target) return IDENTITY;
  const t = maxStage > 0 ? stage / maxStage : 0;
  return {
    position: [
      IDENTITY.position[0] + (target.position[0] - IDENTITY.position[0]) * t,
      IDENTITY.position[1] + (target.position[1] - IDENTITY.position[1]) * t,
      IDENTITY.position[2] + (target.position[2] - IDENTITY.position[2]) * t,
    ],
    // Slerp would be more correct, lerp on quat is OK for small rotations.
    quaternion: [
      IDENTITY.quaternion[0] + (target.quaternion[0] - IDENTITY.quaternion[0]) * t,
      IDENTITY.quaternion[1] + (target.quaternion[1] - IDENTITY.quaternion[1]) * t,
      IDENTITY.quaternion[2] + (target.quaternion[2] - IDENTITY.quaternion[2]) * t,
      IDENTITY.quaternion[3] + (target.quaternion[3] - IDENTITY.quaternion[3]) * t,
    ],
  };
}
