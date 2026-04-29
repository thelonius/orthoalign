import { useState } from "react";
import { requestSuggest } from "../lib/api";
import type { SuggestResponse } from "../lib/types";
import { usePlan, ToothTransform } from "../lib/store";

interface Props {
  caseId: string;
  onClose: () => void;
  onPlanApplied?: () => void;
}

export function CriticPanel({ caseId, onClose, onPlanApplied }: Props) {
  const targets = usePlan((s) => s.targets);
  const setAllTargets = usePlan((s) => s.setAllTargets);
  const setStage = usePlan((s) => s.setStage);
  const setLastSuggestion = usePlan((s) => s.setLastSuggestion);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestResponse | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await requestSuggest(caseId, targets);
      setResult(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!result) return;
    const merged: Record<number, ToothTransform> = { ...targets };
    for (const adj of result.adjustments) {
      const existing = merged[adj.label];
      const basePos: [number, number, number] = existing?.position ?? [0, 0, 0];
      merged[adj.label] = {
        position: [
          basePos[0] + adj.delta_position[0],
          basePos[1] + adj.delta_position[1],
          basePos[2] + adj.delta_position[2],
        ],
        quaternion: existing?.quaternion ?? [0, 0, 0, 1],
      };
    }
    setAllTargets(merged);
    // Сохраняем разбор в store, чтобы карточка зуба могла показать
    // per-tooth rationale даже после закрытия CriticPanel.
    setLastSuggestion(result);
    setStage(0);
    onPlanApplied?.();
  };

  return (
    <aside className="critic">
      <header className="critic__header">
        <h3>🤖 LLM-критик</h3>
        <button className="critic__close" onClick={onClose} title="Закрыть">×</button>
      </header>
      <div className="critic__body">
        {!result && !loading && !error && (
          <>
            <p>
              Отправит текущий план (исходные центры + уже расставленные цели) в
              LLM и вернёт клинический разбор + список адресных правок.
            </p>
            <p className="critic__hint">
              Модель и провайдер задаются через env (Groq / Ollama / Together / любой OpenAI-совместимый).
            </p>
            <button className="critic__run" onClick={run}>
              Запросить разбор →
            </button>
          </>
        )}

        {loading && <div className="critic__loading">Думает…</div>}

        {error && (
          <div className="critic__error">
            <strong>Ошибка:</strong>
            <pre>{error}</pre>
            <button className="critic__run" onClick={run}>Повторить</button>
          </div>
        )}

        {result && (
          <>
            <h4>Клинический разбор</h4>
            <p className="critic__commentary">{result.commentary}</p>

            <h4>Адресные правки ({result.adjustments.length})</h4>
            {result.adjustments.length === 0 ? (
              <p className="critic__hint">Модель не предложила правок.</p>
            ) : (
              <ul className="critic__adjustments">
                {result.adjustments.map((adj, i) => (
                  <li key={i}>
                    <div className="critic__adj-head">
                      <strong>FDI {adj.label}</strong>
                      <span className="critic__adj-delta">
                        Δ ({adj.delta_position.map((n) => n.toFixed(2)).join(", ")})
                      </span>
                    </div>
                    <div className="critic__adj-rationale">{adj.rationale}</div>
                  </li>
                ))}
              </ul>
            )}

            <div className="critic__footer-actions">
              <button className="critic__apply" onClick={apply} disabled={!result.adjustments.length}>
                Применить правки
              </button>
              <button className="critic__rerun" onClick={run}>
                Запросить заново
              </button>
            </div>
            <p className="critic__model-tag">Модель: <code>{result.model}</code></p>
          </>
        )}
      </div>
    </aside>
  );
}
