import type { CaseData } from "./types";
import type { ToothTransform } from "./store";

// Канонический порядок FDI вдоль зубной дуги: от дальнего правого моляра
// к дальнему левому, проходя через центральные резцы.
const UPPER_ORDER = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
const LOWER_ORDER = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

type V3 = [number, number, number];

/**
 * «Авто-расстановка»: эвристика, которая прогоняет current centers через
 * полиномиальный фит арки в плоскости XY и переставляет зубы на равномерные
 * точки вдоль арки. Цель — увидеть, как должна выглядеть «идеальная» дуга,
 * и сразу получить целевые offsets для каждого зуба.
 *
 * В v3 заменим на LLM с клиническим обоснованием (overbite, midline,
 * angulation), пока — чистая геометрия.
 */
export function computeAutoArrangeTargets(
  caseData: CaseData,
): Record<number, ToothTransform> {
  const order = caseData.jaw === "upper" ? UPPER_ORDER : LOWER_ORDER;
  const centers = caseData.toothInitialCenters;
  const present = order.filter((label) => centers[String(label)]);
  if (present.length < 4) return {};

  const points: V3[] = present.map((label) => centers[String(label)]);

  // Ось арки: возьмём X как «ширина», Y как «глубина». Фитим параболу
  // Y(x) = a*x² + b*x + c. Стандартный МНК.
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const { a, b, c } = fitParabola(xs, ys);

  // Считаем длину параболы между крайними X через дискретизацию, потом
  // распределяем зубы равномерно по параметру длины дуги.
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const steps = 200;
  const samples: { x: number; y: number; s: number }[] = [];
  let cumLen = 0;
  let prevX = xMin;
  let prevY = a * xMin * xMin + b * xMin + c;
  samples.push({ x: prevX, y: prevY, s: 0 });
  for (let i = 1; i <= steps; i++) {
    const x = xMin + ((xMax - xMin) * i) / steps;
    const y = a * x * x + b * x + c;
    cumLen += Math.hypot(x - prevX, y - prevY);
    samples.push({ x, y, s: cumLen });
    prevX = x;
    prevY = y;
  }
  const totalLen = cumLen;

  // Идеальная позиция каждого зуба: равномерные точки по длине дуги.
  function pointAtArcLen(s: number): { x: number; y: number } {
    if (s <= 0) return samples[0];
    if (s >= totalLen) return samples[samples.length - 1];
    // Бинарный поиск
    let lo = 0;
    let hi = samples.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].s < s) lo = mid;
      else hi = mid;
    }
    const t = (s - samples[lo].s) / (samples[hi].s - samples[lo].s);
    return {
      x: samples[lo].x + t * (samples[hi].x - samples[lo].x),
      y: samples[lo].y + t * (samples[hi].y - samples[lo].y),
    };
  }

  const MAX_SHIFT = 2.5;
  const STRENGTH = 0.5;
  // Поворот зуба вокруг вертикальной оси (Z) для выравнивания «лица»
  // зуба перпендикулярно касательной к арке. Клинически — это коррекция
  // ротации, которая в Скученности встречается у каждого второго зуба.
  // 3° — субтильная коррекция. Наша модель сравнивает текущую
  // и идеальную касательные арки, что в скученности упирается в потолок
  // у всех зубов одновременно. Реальная клиническая ротация требует
  // знания текущей ориентации каждого зуба, а у нас только центры —
  // полностью корректную ротацию делать тут нечестно. Маленький cap
  // даёт визуальный эффект «подравнивания», не претендуя на точность.
  const MAX_ROTATION_DEG = 3;
  const ROTATION_STRENGTH = 0.3;

  // Идеальные позиции на арке для всех зубов (для расчёта касательной).
  const idealPositions = present.map((_, i) => {
    const s = (totalLen * i) / (present.length - 1);
    return pointAtArcLen(s);
  });

  const targets: Record<number, ToothTransform> = {};
  for (let i = 0; i < present.length; i++) {
    const label = present[i];
    const cur = points[i];
    const ideal = idealPositions[i];

    let offset: V3 = [
      (ideal.x - cur[0]) * STRENGTH,
      (ideal.y - cur[1]) * STRENGTH,
      0,
    ];
    const mag = Math.hypot(offset[0], offset[1]);
    const skipMove = mag < 0.3;
    if (mag > MAX_SHIFT) {
      const scale = MAX_SHIFT / mag;
      offset = [offset[0] * scale, offset[1] * scale, 0];
    }

    // Касательная к арке: вектор от предыдущего к следующему зубу.
    // Для крайних зубов берём одностороннюю касательную.
    const prevIdeal = idealPositions[Math.max(0, i - 1)];
    const nextIdeal = idealPositions[Math.min(present.length - 1, i + 1)];
    const idealTan = [nextIdeal.x - prevIdeal.x, nextIdeal.y - prevIdeal.y];

    const prevCur = points[Math.max(0, i - 1)];
    const nextCur = points[Math.min(present.length - 1, i + 1)];
    const curTan = [nextCur[0] - prevCur[0], nextCur[1] - prevCur[1]];

    const idealAng = Math.atan2(idealTan[1], idealTan[0]);
    const curAng = Math.atan2(curTan[1], curTan[0]);
    let deltaRad = idealAng - curAng;
    // Нормализуем в [-π, π]
    while (deltaRad > Math.PI) deltaRad -= 2 * Math.PI;
    while (deltaRad < -Math.PI) deltaRad += 2 * Math.PI;
    deltaRad *= ROTATION_STRENGTH;

    const maxRad = (MAX_ROTATION_DEG * Math.PI) / 180;
    if (Math.abs(deltaRad) > maxRad) {
      deltaRad = Math.sign(deltaRad) * maxRad;
    }

    const skipRotation = Math.abs(deltaRad) < 0.02;
    if (skipMove && skipRotation) continue;

    // Кватернион вокруг оси Z: (0, 0, sin(θ/2), cos(θ/2))
    const quat: [number, number, number, number] = [
      0,
      0,
      Math.sin(deltaRad / 2),
      Math.cos(deltaRad / 2),
    ];

    targets[label] = { position: offset, quaternion: quat };
  }

  return targets;
}

function fitParabola(xs: number[], ys: number[]): { a: number; b: number; c: number } {
  // Решение нормального уравнения для полинома 2-й степени.
  // X^T X * [a,b,c]^T = X^T Y, где X = [x², x, 1].
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
  // Матрица:
  // [s4 s3 s2] [a]   [t2]
  // [s3 s2 s1] [b] = [t1]
  // [s2 s1 s0] [c]   [t0]
  return solve3x3(
    [
      [s4, s3, s2],
      [s3, s2, s1],
      [s2, s1, s0],
    ],
    [t2, t1, t0],
  );
}

function solve3x3(M: number[][], v: number[]): { a: number; b: number; c: number } {
  // Метод Крамера. Достаточно для 3x3 в браузере.
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
