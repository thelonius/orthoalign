import { create } from "zustand";
import * as THREE from "three";
import type { SuggestResponse, DemoPlan } from "./types";

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
  // Последний AI-разбор: храним per-tooth rationale, чтобы показать в карточке зуба.
  lastSuggestion: SuggestResponse | null;
  // Показывать ли фитированную параболу-арку поверх сцены.
  showArch: boolean;
  // Метаданные применённого демо-плана (для подписи в UI).
  appliedPlanTitle: string | null;

  setCase: (caseId: string) => void;
  setStage: (stage: number) => void;
  selectTooth: (label: number | null) => void;
  setSelectedObj: (obj: Group | null) => void;
  setTargetTransform: (label: number, transform: ToothTransform) => void;
  setAllTargets: (targets: Record<number, ToothTransform>) => void;
  resetTargets: () => void;
  setGizmoMode: (mode: GizmoMode) => void;
  setLastSuggestion: (s: SuggestResponse | null) => void;
  toggleArch: () => void;
  loadDemoPlan: (plan: DemoPlan) => void;
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
    lastSuggestion: null,
    showArch: false,
    appliedPlanTitle: null,

    setCase: (caseId) =>
      set({
        caseId,
        stage: 0,
        selectedLabel: null,
        selectedObj: null,
        targets: {},
        lastSuggestion: null,
        appliedPlanTitle: null,
      }),
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
    resetTargets: () =>
      set({
        targets: {},
        selectedLabel: null,
        selectedObj: null,
        appliedPlanTitle: null,
      }),
    setGizmoMode: (mode) => set({ gizmoMode: mode }),
    setLastSuggestion: (s) => set({ lastSuggestion: s }),
    toggleArch: () => set((s) => ({ showArch: !s.showArch })),
    loadDemoPlan: (plan) => {
      const targets: Record<number, ToothTransform> = {};
      for (const [k, v] of Object.entries(plan.targets)) {
        targets[Number(k)] = {
          position: v.position,
          quaternion: v.quaternion,
        };
      }
      set({
        targets,
        stage: 0,
        selectedLabel: null,
        selectedObj: null,
        appliedPlanTitle: plan.title,
        // Демо-план не приходит от LLM — затираем последний AI-разбор,
        // чтобы карточка зуба не показывала чужой rationale.
        lastSuggestion: null,
      });
    },
  };
});

// Кватернион-temporary'ы для slerp без аллокаций на каждом кадре.
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();

export function getDisplayTransform(
  target: ToothTransform | undefined,
  stage: number,
  maxStage: number,
): ToothTransform {
  if (!target) return IDENTITY;
  const t = maxStage > 0 ? stage / maxStage : 0;
  // Slerp по кватернионам — корректное вращение по дуге, без артефактов
  // на больших углах. Lerp на quat «срезает угол» через хорду и при >30°
  // даёт неестественное движение.
  _qa.set(
    IDENTITY.quaternion[0],
    IDENTITY.quaternion[1],
    IDENTITY.quaternion[2],
    IDENTITY.quaternion[3],
  );
  _qb.set(
    target.quaternion[0],
    target.quaternion[1],
    target.quaternion[2],
    target.quaternion[3],
  );
  _qa.slerp(_qb, t);
  return {
    position: [
      IDENTITY.position[0] + (target.position[0] - IDENTITY.position[0]) * t,
      IDENTITY.position[1] + (target.position[1] - IDENTITY.position[1]) * t,
      IDENTITY.position[2] + (target.position[2] - IDENTITY.position[2]) * t,
    ],
    quaternion: [_qa.x, _qa.y, _qa.z, _qa.w],
  };
}
