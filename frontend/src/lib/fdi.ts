// FDI World Dental Federation notation: 11-48.
// Первая цифра — квадрант (1=upper right, 2=upper left, 3=lower left, 4=lower right).
// Вторая — позиция от центральной линии (1=incisor central, ... 8=third molar).
//
// Источник терминов: ISO 3950, оставлены русские названия для UI-карточки.

const KIND_NAMES_RU: Record<number, string> = {
  1: "центральный резец",
  2: "боковой резец",
  3: "клык",
  4: "первый премоляр",
  5: "второй премоляр",
  6: "первый моляр",
  7: "второй моляр",
  8: "третий моляр",
};

const QUADRANT_NAMES_RU: Record<number, string> = {
  1: "верхняя челюсть, справа",
  2: "верхняя челюсть, слева",
  3: "нижняя челюсть, слева",
  4: "нижняя челюсть, справа",
};

export function fdiName(label: number): string {
  if (label === 0) return "десна / нёбо";
  const quadrant = Math.floor(label / 10);
  const position = label % 10;
  const kind = KIND_NAMES_RU[position];
  const quad = QUADRANT_NAMES_RU[quadrant];
  if (!kind || !quad) return `FDI ${label}`;
  return `${kind} (${quad})`;
}

// Стандартный порядок зубов по дуге для каждой челюсти, слева направо
// в перспективе пациента (для UI-схемы челюсти).
export const FDI_UPPER_LEFT_TO_RIGHT = [
  27, 26, 25, 24, 23, 22, 21, 11, 12, 13, 14, 15, 16, 17,
];
export const FDI_LOWER_LEFT_TO_RIGHT = [
  37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47,
];
