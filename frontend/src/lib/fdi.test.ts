import { describe, expect, it } from "vitest";
import {
  fdiName,
  FDI_LOWER_LEFT_TO_RIGHT,
  FDI_UPPER_LEFT_TO_RIGHT,
} from "./fdi";

describe("fdiName", () => {
  it("0 = десна / нёбо", () => {
    expect(fdiName(0)).toContain("десна");
  });

  it("11 = центральный резец, верхняя челюсть, справа", () => {
    const n = fdiName(11);
    expect(n).toContain("центральный резец");
    expect(n).toContain("верхняя");
    expect(n).toContain("справа");
  });

  it("47 = второй моляр, нижняя челюсть, справа", () => {
    const n = fdiName(47);
    expect(n).toContain("второй моляр");
    expect(n).toContain("нижняя");
    expect(n).toContain("справа");
  });

  it("23 = клык верхней челюсти слева", () => {
    const n = fdiName(23);
    expect(n).toContain("клык");
    expect(n).toContain("верхняя");
    expect(n).toContain("слева");
  });

  it("неизвестный FDI возвращает fallback", () => {
    expect(fdiName(99)).toContain("99");
  });

  it("37 = второй моляр нижней челюсти слева", () => {
    const n = fdiName(37);
    expect(n).toContain("второй моляр");
    expect(n).toContain("нижняя");
    expect(n).toContain("слева");
  });
});

describe("FDI порядок зубов", () => {
  it("верхняя челюсть содержит 14 зубов", () => {
    expect(FDI_UPPER_LEFT_TO_RIGHT).toHaveLength(14);
  });

  it("нижняя челюсть содержит 14 зубов", () => {
    expect(FDI_LOWER_LEFT_TO_RIGHT).toHaveLength(14);
  });

  it("верхняя начинается с 27 (моляр слева) и заканчивается 17 (моляр справа)", () => {
    expect(FDI_UPPER_LEFT_TO_RIGHT[0]).toBe(27);
    expect(FDI_UPPER_LEFT_TO_RIGHT[13]).toBe(17);
  });

  it("нижняя начинается с 37 и заканчивается 47", () => {
    expect(FDI_LOWER_LEFT_TO_RIGHT[0]).toBe(37);
    expect(FDI_LOWER_LEFT_TO_RIGHT[13]).toBe(47);
  });

  it("midline между позициями 6 и 7 (резцы 21/11 для upper)", () => {
    // Слева направо: ..., 22, 21 | 11, 12, ...
    expect(FDI_UPPER_LEFT_TO_RIGHT[6]).toBe(21);
    expect(FDI_UPPER_LEFT_TO_RIGHT[7]).toBe(11);
    expect(FDI_LOWER_LEFT_TO_RIGHT[6]).toBe(31);
    expect(FDI_LOWER_LEFT_TO_RIGHT[7]).toBe(41);
  });

  it("каждый FDI код уникален в массиве", () => {
    expect(new Set(FDI_UPPER_LEFT_TO_RIGHT).size).toBe(14);
    expect(new Set(FDI_LOWER_LEFT_TO_RIGHT).size).toBe(14);
  });
});
