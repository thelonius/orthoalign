// Утилиты для работы с фитированной аркой Y(X) = a*X² + b*X + c.
// Используется и в metrics.ts (RMS отклонение), и в визуализации (ArchLine),
// и в ToothInfoPanel (offset зуба от арки в мм).

import type { CaseData } from "./types";
import type { ToothTransform } from "./store";
import { getDisplayTransform } from "./store";

export interface ArchCoeffs {
  a: number;
  b: number;
  c: number;
}

const UPPER_ORDER = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
const LOWER_ORDER = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

export function fitArchFromPositions(
  positions: { x: number; y: number }[],
): ArchCoeffs {
  const n = positions.length;
  if (n < 3) return { a: 0, b: 0, c: 0 };
  // Cramer's rule на нормальных уравнениях МНК. Та же логика, что в metrics.ts.
  let s0 = n,
    s1 = 0,
    s2 = 0,
    s3 = 0,
    s4 = 0;
  let t0 = 0,
    t1 = 0,
    t2 = 0;
  for (const p of positions) {
    const x2 = p.x * p.x;
    s1 += p.x;
    s2 += x2;
    s3 += x2 * p.x;
    s4 += x2 * x2;
    t0 += p.y;
    t1 += p.x * p.y;
    t2 += x2 * p.y;
  }
  const M = [
    [s4, s3, s2],
    [s3, s2, s1],
    [s2, s1, s0],
  ];
  const v = [t2, t1, t0];
  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(M);
  if (Math.abs(D) < 1e-9) return { a: 0, b: 0, c: 0 };
  const swap = (col: number, repl: number[]) =>
    M.map((row, i) => row.map((val, j) => (j === col ? repl[i] : val)));
  return {
    a: det3(swap(0, v)) / D,
    b: det3(swap(1, v)) / D,
    c: det3(swap(2, v)) / D,
  };
}

/**
 * Текущие позиции зубов на стадии stage: исходный центр + интерполированный target offset.
 */
export function currentPositions(
  caseData: CaseData,
  targets: Record<number, ToothTransform>,
  stage: number,
  maxStage: number,
): { label: number; x: number; y: number; z: number }[] {
  const order = caseData.jaw === "upper" ? UPPER_ORDER : LOWER_ORDER;
  const centers = caseData.toothInitialCenters;
  const out: { label: number; x: number; y: number; z: number }[] = [];
  for (const label of order) {
    const c = centers[String(label)];
    if (!c) continue;
    const display = getDisplayTransform(targets[label], stage, maxStage);
    out.push({
      label,
      x: c[0] + display.position[0],
      y: c[1] + display.position[1],
      z: c[2] + display.position[2],
    });
  }
  return out;
}

/**
 * Перпендикулярное расстояние от точки (x, y) до параболы Y(x) = a*x² + b*x + c.
 *
 * Точное значение требует численного решения (минимизация по x'); для UI
 * достаточно вертикальной разницы — она хорошо коррелирует с фактическим
 * перпендикуляром при пологих наклонах арки.
 */
export function offsetFromArch(
  x: number,
  y: number,
  arch: ArchCoeffs,
): number {
  const yPred = arch.a * x * x + arch.b * x + arch.c;
  return y - yPred;
}

/**
 * Сэмпл точек на арке для отрисовки полилинии в Three.js.
 * Z-координату берём как медиану z из позиций — арка лежит «на уровне»
 * центров коронок, без подъёма к молярам.
 */
export function sampleArch(
  arch: ArchCoeffs,
  xs: number[],
  z: number,
  steps = 80,
): [number, number, number][] {
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const pad = (xMax - xMin) * 0.05;
  const out: [number, number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const x = xMin - pad + ((xMax - xMin + 2 * pad) * i) / steps;
    const y = arch.a * x * x + arch.b * x + arch.c;
    out.push([x, y, z]);
  }
  return out;
}

export function medianZ(positions: { z: number }[]): number {
  if (positions.length === 0) return 0;
  const sorted = positions.map((p) => p.z).sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[m - 1] + sorted[m]) / 2 : sorted[m];
}
