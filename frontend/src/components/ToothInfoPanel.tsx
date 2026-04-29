import { useMemo } from "react";
import { usePlan } from "../lib/store";
import type { CaseData } from "../lib/types";
import { fdiName } from "../lib/fdi";
import {
  currentPositions,
  fitArchFromPositions,
  offsetFromArch,
} from "../lib/arch";
import { JawSchema } from "./JawSchema";

interface Props {
  caseData: CaseData;
  pairedCase?: CaseData | null;
}

function fmtMm(v: number, digits = 2): string {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(digits)} мм`;
}

/**
 * Карточка выбранного зуба. Появляется при клике на зуб.
 *
 * Показывает:
 * — FDI номер + русское название (по словарю fdi.ts)
 * — мини-схему челюсти с подсветкой
 * — исходную позицию (центр коронки в мировой системе)
 * — целевую позицию (исходная + target offset)
 * — дельту (вектор и модуль)
 * — отклонение от арки до и после плана (в мм)
 * — AI-обоснование, если на этот зуб был LLM-план
 */
export function ToothInfoPanel({ caseData, pairedCase }: Props) {
  const selectedLabel = usePlan((s) => s.selectedLabel);
  const targets = usePlan((s) => s.targets);
  const lastSuggestion = usePlan((s) => s.lastSuggestion);
  const maxStage = usePlan((s) => s.maxStage);
  const selectTooth = usePlan((s) => s.selectTooth);

  // Какая из двух челюстей содержит выбранный зуб. По FDI первый знак
  // достаточен: 1*/2* — upper, 3*/4* — lower.
  const owningCase = useMemo(() => {
    if (selectedLabel == null) return null;
    const expectsUpper = selectedLabel < 30;
    if (caseData.jaw === (expectsUpper ? "upper" : "lower")) return caseData;
    if (pairedCase && pairedCase.jaw === (expectsUpper ? "upper" : "lower"))
      return pairedCase;
    return caseData;
  }, [caseData, pairedCase, selectedLabel]);

  const archInfo = useMemo(() => {
    if (selectedLabel == null || !owningCase) return null;
    const initialPositions = currentPositions(owningCase, {}, 0, maxStage);
    const targetPositions = currentPositions(
      owningCase,
      targets,
      maxStage,
      maxStage,
    );
    if (initialPositions.length < 4) return null;
    const archInitial = fitArchFromPositions(initialPositions);
    const archTarget = fitArchFromPositions(targetPositions);
    const initial = initialPositions.find((p) => p.label === selectedLabel);
    const target = targetPositions.find((p) => p.label === selectedLabel);
    if (!initial || !target) return null;
    return {
      initial,
      target,
      offsetInitial: offsetFromArch(initial.x, initial.y, archInitial),
      offsetTarget: offsetFromArch(target.x, target.y, archTarget),
    };
  }, [owningCase, targets, selectedLabel, maxStage]);

  if (selectedLabel == null) return null;

  const target = targets[selectedLabel];
  const dx = target?.position[0] ?? 0;
  const dy = target?.position[1] ?? 0;
  const dz = target?.position[2] ?? 0;
  const deltaMag = Math.sqrt(dx * dx + dy * dy + dz * dz);

  const aiAdj = lastSuggestion?.adjustments.find(
    (a) => a.label === selectedLabel,
  );

  return (
    <aside className="tooth-info">
      <header className="tooth-info__header">
        <div className="tooth-info__label">
          <span className="tooth-info__fdi">{selectedLabel}</span>
          <span className="tooth-info__name">{fdiName(selectedLabel)}</span>
        </div>
        <button
          className="tooth-info__close"
          onClick={() => selectTooth(null)}
          title="Снять выделение"
        >
          ×
        </button>
      </header>

      <JawSchema
        jaw={owningCase?.jaw ?? caseData.jaw}
        selected={selectedLabel}
        onSelect={selectTooth}
      />

      {archInfo && (
        <section className="tooth-info__section">
          <h4>Координаты центра коронки (мм)</h4>
          <table className="tooth-info__table">
            <thead>
              <tr>
                <th></th>
                <th>X</th>
                <th>Y</th>
                <th>Z</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>исходно</td>
                <td>{archInfo.initial.x.toFixed(2)}</td>
                <td>{archInfo.initial.y.toFixed(2)}</td>
                <td>{archInfo.initial.z.toFixed(2)}</td>
              </tr>
              <tr>
                <td>цель</td>
                <td>{archInfo.target.x.toFixed(2)}</td>
                <td>{archInfo.target.y.toFixed(2)}</td>
                <td>{archInfo.target.z.toFixed(2)}</td>
              </tr>
              <tr className="tooth-info__delta-row">
                <td>Δ</td>
                <td>{fmtMm(dx)}</td>
                <td>{fmtMm(dy)}</td>
                <td>{fmtMm(dz)}</td>
              </tr>
            </tbody>
          </table>
          <div className="tooth-info__delta-mag">
            Суммарное смещение: <strong>{deltaMag.toFixed(2)} мм</strong>
          </div>
        </section>
      )}

      {archInfo && (
        <section className="tooth-info__section">
          <h4>Отклонение от идеальной арки</h4>
          <div className="tooth-info__arch">
            <div>
              исходно: <strong>{fmtMm(archInfo.offsetInitial)}</strong>
            </div>
            <div>
              после плана: <strong>{fmtMm(archInfo.offsetTarget)}</strong>
            </div>
            <div className="tooth-info__hint">
              Знак показывает сторону: «+» — наружу от арки, «−» — внутрь.
            </div>
          </div>
        </section>
      )}

      {aiAdj && (
        <section className="tooth-info__section tooth-info__section--ai">
          <h4>🤖 Обоснование AI-плана</h4>
          <p className="tooth-info__rationale">{aiAdj.rationale}</p>
          <div className="tooth-info__hint">
            Δ от LLM: ({aiAdj.delta_position.map((n) => n.toFixed(2)).join(", ")}) мм
          </div>
        </section>
      )}
    </aside>
  );
}
