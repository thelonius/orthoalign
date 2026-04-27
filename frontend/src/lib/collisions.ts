import type { CaseData } from "./types";
import type { ToothTransform } from "./store";

const UPPER_ORDER = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
const LOWER_ORDER = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

// Зуб считается «коллидирующим» с соседом, если расстояние между их центрами
// после применения целей сжалось до меньше чем COMPRESS_THRESHOLD от исходного.
// 0.6 значит «зубы не должны сближаться более чем на 40%». Грубая
// аппроксимация коллизии без меш-меш проверки.
const COMPRESS_THRESHOLD = 0.6;

/**
 * Возвращает множество label'ов зубов которые конфликтуют с соседями
 * на текущей стадии. Мы не делаем настоящую mesh-mesh коллизию (дорого
 * на каждый кадр), а проверяем сжатие межцентровых дистанций — что ловит
 * случаи когда план LLM или пользователь подвинули зубы друг в друга.
 */
export function findCollisions(
  caseData: CaseData,
  targets: Record<number, ToothTransform>,
  stageProgress: number,  // 0..1
): Set<number> {
  const order = caseData.jaw === "upper" ? UPPER_ORDER : LOWER_ORDER;
  const centers = caseData.toothInitialCenters;
  const present: { label: number; orig: [number, number, number]; cur: [number, number, number] }[] = [];

  for (const label of order) {
    const c = centers[String(label)];
    if (!c) continue;
    const t = targets[label];
    const dx = (t?.position[0] ?? 0) * stageProgress;
    const dy = (t?.position[1] ?? 0) * stageProgress;
    const dz = (t?.position[2] ?? 0) * stageProgress;
    present.push({
      label,
      orig: c,
      cur: [c[0] + dx, c[1] + dy, c[2] + dz],
    });
  }

  const colliding = new Set<number>();
  for (let i = 0; i < present.length - 1; i++) {
    const a = present[i];
    const b = present[i + 1];
    const origDist = Math.hypot(
      b.orig[0] - a.orig[0],
      b.orig[1] - a.orig[1],
      b.orig[2] - a.orig[2],
    );
    const curDist = Math.hypot(
      b.cur[0] - a.cur[0],
      b.cur[1] - a.cur[1],
      b.cur[2] - a.cur[2],
    );
    if (origDist > 0 && curDist < origDist * COMPRESS_THRESHOLD) {
      colliding.add(a.label);
      colliding.add(b.label);
    }
  }
  return colliding;
}
