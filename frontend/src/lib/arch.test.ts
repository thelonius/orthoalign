import { describe, expect, it } from "vitest";
import {
  fitArchFromPositions,
  offsetFromArch,
  sampleArch,
  medianZ,
} from "./arch";

describe("fitArchFromPositions", () => {
  it("возвращает все нули, если точек меньше трёх", () => {
    expect(fitArchFromPositions([])).toEqual({ a: 0, b: 0, c: 0 });
    expect(fitArchFromPositions([{ x: 0, y: 0 }])).toEqual({ a: 0, b: 0, c: 0 });
    expect(
      fitArchFromPositions([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("точно восстанавливает идеальную параболу y = 0.05x² - 25", () => {
    const a = 0.05;
    const c = -25;
    const points = [-20, -10, 0, 10, 20].map((x) => ({
      x,
      y: a * x * x + c,
    }));
    const fit = fitArchFromPositions(points);
    expect(fit.a).toBeCloseTo(a, 5);
    expect(fit.b).toBeCloseTo(0, 5);
    expect(fit.c).toBeCloseTo(c, 5);
  });

  it("находит линейный коэффициент при асимметричных данных", () => {
    // y = 0.04x² + 0.5x + 1 — асимметричная парабола
    const a = 0.04;
    const b = 0.5;
    const c = 1;
    const points = [-10, -5, 0, 5, 10, 15].map((x) => ({
      x,
      y: a * x * x + b * x + c,
    }));
    const fit = fitArchFromPositions(points);
    expect(fit.a).toBeCloseTo(a, 5);
    expect(fit.b).toBeCloseTo(b, 5);
    expect(fit.c).toBeCloseTo(c, 5);
  });

  it("даёт устойчивый ответ при шуме", () => {
    // Добавляем небольшой шум — фит должен быть рядом с истиной.
    const a = 0.06;
    const points = [-15, -10, -5, 0, 5, 10, 15].map((x, i) => ({
      x,
      y: a * x * x - 25 + (i % 2 === 0 ? 0.1 : -0.1),
    }));
    const fit = fitArchFromPositions(points);
    expect(fit.a).toBeCloseTo(a, 2);
  });
});

describe("offsetFromArch", () => {
  it("возвращает 0 для точек на самой параболе", () => {
    const arch = { a: 0.05, b: 0, c: -10 };
    expect(offsetFromArch(0, -10, arch)).toBe(0);
    expect(offsetFromArch(10, 0.05 * 100 - 10, arch)).toBeCloseTo(0);
  });

  it("положительный offset = точка выше параболы", () => {
    const arch = { a: 0.05, b: 0, c: 0 };
    expect(offsetFromArch(0, 5, arch)).toBe(5);
  });

  it("отрицательный offset = точка ниже параболы", () => {
    const arch = { a: 0.05, b: 0, c: 0 };
    expect(offsetFromArch(0, -5, arch)).toBe(-5);
  });
});

describe("sampleArch", () => {
  it("первая и последняя точки покрывают диапазон xs с padding", () => {
    const arch = { a: 0.05, b: 0, c: -10 };
    const xs = [-10, 0, 10];
    const points = sampleArch(arch, xs, 5, 50);
    // 5% padding с каждой стороны → выходим за [-10, 10]
    expect(points[0][0]).toBeLessThan(-10);
    expect(points[points.length - 1][0]).toBeGreaterThan(10);
  });

  it("Z всех точек одинаковый и равен переданному", () => {
    const arch = { a: 0.05, b: 0, c: -10 };
    const points = sampleArch(arch, [-10, 0, 10], 7.5, 20);
    for (const p of points) {
      expect(p[2]).toBe(7.5);
    }
  });

  it("Y соответствует параболе", () => {
    const arch = { a: 0.05, b: 0, c: -10 };
    const points = sampleArch(arch, [-10, 0, 10], 0, 30);
    for (const [x, y] of points) {
      expect(y).toBeCloseTo(arch.a * x * x + arch.c);
    }
  });
});

describe("medianZ", () => {
  it("возвращает 0 для пустого массива", () => {
    expect(medianZ([])).toBe(0);
  });

  it("медиана нечётной длины", () => {
    expect(medianZ([{ z: 1 }, { z: 5 }, { z: 3 }])).toBe(3);
  });

  it("медиана чётной длины — среднее двух центральных", () => {
    expect(medianZ([{ z: 1 }, { z: 2 }, { z: 3 }, { z: 4 }])).toBe(2.5);
  });
});
