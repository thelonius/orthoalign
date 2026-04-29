import {
  FDI_LOWER_LEFT_TO_RIGHT,
  FDI_UPPER_LEFT_TO_RIGHT,
} from "../lib/fdi";

interface Props {
  jaw: "upper" | "lower";
  selected: number | null;
  onSelect?: (label: number) => void;
}

/**
 * Мини-схема челюсти как FDI-декодер. Подсвечивает выбранный зуб, показывает
 * его номер, чтобы пользователь видел «11 — это первый резец справа сверху»,
 * а не гадал по 3D-сцене.
 *
 * Ширина каждой ячейки фиксированная, midline — между седьмой и восьмой ячейкой.
 */
export function JawSchema({ jaw, selected, onSelect }: Props) {
  const order = jaw === "upper" ? FDI_UPPER_LEFT_TO_RIGHT : FDI_LOWER_LEFT_TO_RIGHT;
  return (
    <div className={`jaw-schema jaw-schema--${jaw}`}>
      <div className="jaw-schema__row">
        {order.map((label, i) => {
          const isMidlineGap = i === 7;
          const cls =
            "jaw-schema__cell" +
            (label === selected ? " jaw-schema__cell--selected" : "") +
            (isMidlineGap ? " jaw-schema__cell--with-midline" : "");
          return (
            <button
              key={label}
              type="button"
              className={cls}
              onClick={() => onSelect?.(label)}
              title={`FDI ${label}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="jaw-schema__caption">
        {jaw === "upper" ? "верхняя челюсть" : "нижняя челюсть"} · вид со стороны
        пациента
      </div>
    </div>
  );
}
