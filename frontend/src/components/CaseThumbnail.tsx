import type { CaseMeta } from "../lib/types";

interface Props {
  meta: CaseMeta;
  size?: number;
}

function colorForLabel(label: number): string {
  const hue = ((label * 47) % 360) / 360;
  // HSL → CSS string
  const h = hue * 360;
  return `hsl(${h.toFixed(0)}, 55%, 60%)`;
}

/**
 * Маленькая SVG-арка показывает паттерн кейса по центрам зубов.
 * Топ-даун проекция, цветные точки по FDI, без меша. Лёгкая, не
 * требует загрузки data.json.
 */
export function CaseThumbnail({ meta, size = 60 }: Props) {
  const labels = Object.keys(meta.toothCenters)
    .map(Number)
    .sort((a, b) => a - b);
  if (labels.length === 0) return <div className="thumbnail" style={{ width: size, height: size }} />;

  // Берём X (лево-право) и Y (передне-задне) координаты, нормализуем в 0..1
  const xs: number[] = [];
  const ys: number[] = [];
  for (const l of labels) {
    const c = meta.toothCenters[String(l)];
    xs.push(c[0]);
    ys.push(c[1]);
  }
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  // Padding 10%, square viewBox
  const pad = 0.12;
  const range = Math.max(xRange, yRange);
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  const half = (range / 2) * (1 + pad * 2);

  const vbX = cx - half;
  const vbY = cy - half;
  const vbSize = half * 2;

  return (
    <svg
      className="thumbnail"
      width={size}
      height={size}
      viewBox={`${vbX} ${vbY} ${vbSize} ${vbSize}`}
      // Для нижней челюсти (FDI 31-47) Y-ось такая же; для верхней наоборот.
      // Зеркалим Y чтобы передние зубы (меньшие FDI рядом с центральными
      // резцами) всегда были снизу — арка открыта вверх.
      style={{
        transform: meta.jaw === "upper" ? "scaleY(-1)" : undefined,
      }}
    >
      <rect x={vbX} y={vbY} width={vbSize} height={vbSize} fill="#1c1c24" rx={vbSize * 0.05} />
      {labels.map((label) => {
        const c = meta.toothCenters[String(label)];
        return (
          <circle
            key={label}
            cx={c[0]}
            cy={c[1]}
            r={vbSize * 0.05}
            fill={colorForLabel(label)}
          />
        );
      })}
    </svg>
  );
}
