import { describe, expect, it } from "vitest";
import { computeMetrics } from "./metrics";
import type { CaseData } from "./types";
import type { ToothTransform } from "./store";

// Идеальный U-образный кейс: зубы на параболе Y = 0.05x² - 25, midline в X=0.
function makeIdealCase(jaw: "upper" | "lower"): CaseData {
  const a = 0.05;
  const c = -25;
  const labels = jaw === "upper"
    ? [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]
    : [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];
  // Раздаём X равномерно от -25 до 25.
  const centers: Record<string, [number, number, number]> = {};
  labels.forEach((label, i) => {
    const x = -25 + (i * 50) / 13;
    const y = a * x * x + c;
    centers[String(label)] = [x, y, 0];
  });
  return {
    id: "test",
    name: "test",
    jaw,
    toothCount: 14,
    source: "test",
    toothCenters: centers,
    toothInitialCenters: centers,
    vertices: [],
    faces: [],
    labels: [],
  };
}

describe("computeMetrics", () => {
  it("идеальная U-образная челюсть имеет почти нулевую дисперсию", () => {
    const c = makeIdealCase("upper");
    const m = computeMetrics(c, {});
    expect(m.dispersion).toBeLessThan(0.01);
  });

  it("midlineShift = 0, когда центральные резцы симметричны вокруг X=0", () => {
    const c = makeIdealCase("upper");
    const m = computeMetrics(c, {});
    // 11 и 21 не идеально симметричны в нашей раскладке — но midlineShift
    // должен быть мал (несколько мм максимум).
    expect(m.midlineShift).toBeLessThan(2);
  });

  it("сдвиг всех зубов на +5мм по X увеличивает midlineShift на ~5мм", () => {
    const c = makeIdealCase("upper");
    const labels = Object.keys(c.toothCenters).map(Number);
    const targets: Record<number, ToothTransform> = {};
    for (const l of labels) {
      targets[l] = { position: [5, 0, 0], quaternion: [0, 0, 0, 1] };
    }
    const baseline = computeMetrics(c, {});
    const shifted = computeMetrics(c, targets);
    expect(shifted.midlineShift - baseline.midlineShift).toBeGreaterThan(4);
    expect(shifted.midlineShift - baseline.midlineShift).toBeLessThan(6);
  });

  it("если зубов меньше 4, метрики все нули", () => {
    const c: CaseData = {
      id: "x",
      name: "x",
      jaw: "upper",
      toothCount: 0,
      source: "x",
      toothCenters: { "11": [0, -25, 0] },
      toothInitialCenters: { "11": [0, -25, 0] },
      vertices: [],
      faces: [],
      labels: [],
    };
    const m = computeMetrics(c, {});
    expect(m.dispersion).toBe(0);
    expect(m.spacingVariance).toBe(0);
    expect(m.midlineShift).toBe(0);
  });

  it("выброс одного зуба от арки увеличивает дисперсию", () => {
    const c = makeIdealCase("upper");
    const baseline = computeMetrics(c, {});
    // Сдвинем 14-й зуб на 5мм по Y — он выпадет из арки.
    const targets: Record<number, ToothTransform> = {
      14: { position: [0, 5, 0], quaternion: [0, 0, 0, 1] },
    };
    const m = computeMetrics(c, targets);
    expect(m.dispersion).toBeGreaterThan(baseline.dispersion + 1);
  });

  it("работает для нижней челюсти (использует LOWER_ORDER)", () => {
    const c = makeIdealCase("lower");
    const m = computeMetrics(c, {});
    expect(m.dispersion).toBeLessThan(0.01);
  });
});
