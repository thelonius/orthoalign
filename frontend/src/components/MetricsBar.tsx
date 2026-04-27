import { useMemo } from "react";
import type { CaseData } from "../lib/types";
import { usePlan } from "../lib/store";
import { computeMetrics } from "../lib/metrics";

interface Props {
  caseData: CaseData;
}

interface MetricRow {
  key: keyof ReturnType<typeof computeMetrics>;
  label: string;
  unit: string;
  precision: number;
  goodIfLower: boolean;
}

const ROWS: MetricRow[] = [
  { key: "dispersion", label: "Дисперсия от арки", unit: "мм", precision: 2, goodIfLower: true },
  { key: "spacingVariance", label: "Вариация шага", unit: "мм²", precision: 2, goodIfLower: true },
  { key: "midlineShift", label: "Смещение midline", unit: "мм", precision: 2, goodIfLower: true },
];

export function MetricsBar({ caseData }: Props) {
  const targets = usePlan((s) => s.targets);

  const before = useMemo(() => computeMetrics(caseData, {}), [caseData]);
  const after = useMemo(() => computeMetrics(caseData, targets), [caseData, targets]);
  const hasTargets = Object.keys(targets).length > 0;

  return (
    <div className="metrics">
      {ROWS.map((row) => {
        const b = before[row.key];
        const a = after[row.key];
        const delta = a - b;
        const improving = (row.goodIfLower && delta < 0) || (!row.goodIfLower && delta > 0);
        const stagnant = Math.abs(delta) < 0.01;
        return (
          <div key={row.key} className="metrics__cell">
            <div className="metrics__label">{row.label}</div>
            <div className="metrics__values">
              <span className="metrics__before">{b.toFixed(row.precision)}</span>
              {hasTargets && (
                <>
                  <span className="metrics__arrow">→</span>
                  <span
                    className={
                      "metrics__after " +
                      (stagnant ? "" : improving ? "metrics__after--good" : "metrics__after--bad")
                    }
                  >
                    {a.toFixed(row.precision)}
                  </span>
                </>
              )}
              <span className="metrics__unit">{row.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
