import { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { CaseData } from "../lib/types";
import { usePlan } from "../lib/store";
import {
  currentPositions,
  fitArchFromPositions,
  medianZ,
  sampleArch,
} from "../lib/arch";

interface Props {
  caseData: CaseData;
}

/**
 * Опциональная отрисовка фитированной арки Y(X) — той же параболы, по которой
 * считается dispersion в metrics.ts. Включается тоглом showArch в шапке.
 *
 * Точки сэмплируются с небольшим выходом за крайние моляры, чтобы линия
 * не «обрывалась» прямо в зубе. Z берётся как медиана текущих центров —
 * на верхней челюсти это ~22 мм, на нижней может быть отрицательным.
 */
export function ArchLine({ caseData }: Props) {
  const showArch = usePlan((s) => s.showArch);
  const targets = usePlan((s) => s.targets);
  const stage = usePlan((s) => s.stage);
  const maxStage = usePlan((s) => s.maxStage);

  const points = useMemo<[number, number, number][]>(() => {
    if (!showArch) return [];
    const positions = currentPositions(caseData, targets, stage, maxStage);
    if (positions.length < 4) return [];
    const arch = fitArchFromPositions(positions);
    const xs = positions.map((p) => p.x);
    const z = medianZ(positions);
    return sampleArch(arch, xs, z);
  }, [caseData, targets, stage, maxStage, showArch]);

  if (!showArch || points.length === 0) return null;

  // drei.Line ждёт массив [x,y,z]; покрашен в тёплый янтарный, контрастирующий
  // с пёстрыми зубами и стальным фоном. transparent + opacity, чтобы не
  // забивать сцену поверх mesh.
  return (
    <Line
      points={points as unknown as THREE.Vector3[]}
      color="#ffb340"
      lineWidth={2}
      transparent
      opacity={0.9}
      dashed={false}
    />
  );
}
