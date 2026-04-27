import type { CaseData } from "./types";
import type { ToothTransform } from "./store";

const UPPER_ORDER = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
const LOWER_ORDER = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

export interface PlanMetrics {
  dispersion: number;        // RMS отклонение от фитируемой арки, мм
  spacingVariance: number;   // Дисперсия меж-зубных интервалов, мм²
  midlineShift: number;      // Отклонение средней точки 11/21 от X=0, мм
}

/**
 * Считает метрики качества плана: насколько зубы выровнены, равномерно
 * расставлены и насколько средняя линия совпадает с сагиттальной.
 *
 * Принимает позиции зубов «после применения смещений на стадии max».
 * Для метрики «до» — вызовите с пустыми targets.
 */
export function computeMetrics(
  caseData: CaseData,
  targets: Record<number, ToothTransform>,
): PlanMetrics {
  const order = caseData.jaw === "upper" ? UPPER_ORDER : LOWER_ORDER;
  const centers = caseData.toothInitialCenters;

  // Текущие позиции = исходные центры + target offset (или 0).
  const positions: { label: number; x: number; y: number }[] = [];
  for (const label of order) {
    const c = centers[String(label)];
    if (!c) continue;
    const t = targets[label];
    const dx = t?.position[0] ?? 0;
    const dy = t?.position[1] ?? 0;
    positions.push({ label, x: c[0] + dx, y: c[1] + dy });
  }

  if (positions.length < 4) {
    return { dispersion: 0, spacingVariance: 0, midlineShift: 0 };
  }

  // === Dispersion: фитим параболу Y(x), считаем RMS отклонения по Y ===
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const { a, b, c } = fitParabola(xs, ys);
  let sse = 0;
  for (const p of positions) {
    const yPred = a * p.x * p.x + b * p.x + c;
    sse += (p.y - yPred) ** 2;
  }
  const dispersion = Math.sqrt(sse / positions.length);

  // === Spacing variance: расстояния между соседями ===
  const gaps: number[] = [];
  for (let i = 1; i < positions.length; i++) {
    gaps.push(
      Math.hypot(positions[i].x - positions[i - 1].x, positions[i].y - positions[i - 1].y),
    );
  }
  const meanGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const spacingVariance =
    gaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / gaps.length;

  // === Midline shift: средняя точка центральных резцов от X=0 ===
  const incisor1 = caseData.jaw === "upper" ? 11 : 41;
  const incisor2 = caseData.jaw === "upper" ? 21 : 31;
  const p1 = positions.find((p) => p.label === incisor1);
  const p2 = positions.find((p) => p.label === incisor2);
  const midlineShift = p1 && p2 ? Math.abs((p1.x + p2.x) / 2) : 0;

  return { dispersion, spacingVariance, midlineShift };
}

function fitParabola(xs: number[], ys: number[]): { a: number; b: number; c: number } {
  const n = xs.length;
  let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  let t0 = 0, t1 = 0, t2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    const x2 = x * x;
    s1 += x;
    s2 += x2;
    s3 += x2 * x;
    s4 += x2 * x2;
    t0 += y;
    t1 += x * y;
    t2 += x2 * y;
  }
  const M = [
    [s4, s3, s2],
    [s3, s2, s1],
    [s2, s1, s0],
  ];
  const v = [t2, t1, t0];
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-9) return { a: 0, b: 0, c: 0 };
  const swap = (col: number, replacement: number[]) =>
    M.map((row, i) => row.map((val, j) => (j === col ? replacement[i] : val)));
  return {
    a: det(swap(0, v)) / D,
    b: det(swap(1, v)) / D,
    c: det(swap(2, v)) / D,
  };
}
