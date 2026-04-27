import { useEffect, useState } from "react";
import { Viewer } from "./components/Viewer";
import { StageSlider } from "./components/StageSlider";
import { fetchCases, fetchCase } from "./lib/api";
import type { CaseData, CaseMeta } from "./lib/types";
import { usePlan } from "./lib/store";

export function App() {
  const [cases, setCases] = useState<CaseMeta[]>([]);
  const [activeCase, setActiveCase] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setCaseInStore = usePlan((s) => s.setCase);
  const stage = usePlan((s) => s.stage);
  const maxStage = usePlan((s) => s.maxStage);
  const setStage = usePlan((s) => s.setStage);
  const selectedLabel = usePlan((s) => s.selectedLabel);
  const targets = usePlan((s) => s.targets);
  const resetTargets = usePlan((s) => s.resetTargets);

  useEffect(() => {
    fetchCases()
      .then(setCases)
      .catch((e) => setError(String(e)));
  }, []);

  const onSelectCase = async (id: string) => {
    setError(null);
    setCaseInStore(id);
    try {
      const data = await fetchCase(id);
      setActiveCase(data);
    } catch (e) {
      setError(String(e));
    }
  };

  const editing = stage === maxStage;
  const targetCount = Object.keys(targets).length;

  return (
    <div className="app">
      <header className="app__header">
        <h1>OrthoAlign</h1>
        <span className="app__tag">v0.1 · demo</span>
        {activeCase && (
          <span className="app__hint">
            {editing
              ? selectedLabel
                ? `Зуб ${selectedLabel}: тащите гизмо для целевой позиции`
                : "Кликните зуб, чтобы расставить целевую позицию"
              : stage === 0
                ? "Прокрутите слайдер до конца, чтобы редактировать."
                : `Стадия ${stage} из ${maxStage}`}
          </span>
        )}
        {targetCount > 0 && (
          <button className="app__reset" onClick={resetTargets} title="Сбросить все цели">
            Сброс ({targetCount})
          </button>
        )}
      </header>

      <aside className="app__sidebar">
        <h2>Демо-кейсы</h2>
        {error && <div className="error">{error}</div>}
        <ul className="case-list">
          {cases.map((c) => (
            <li key={c.id}>
              <button
                className={activeCase?.id === c.id ? "active" : ""}
                onClick={() => onSelectCase(c.id)}
              >
                {c.name}
                <small>
                  {c.jaw === "upper" ? "верхняя" : "нижняя"} · {c.toothCount} зубов
                </small>
              </button>
            </li>
          ))}
          {cases.length === 0 && !error && <li className="muted">Загрузка…</li>}
        </ul>
      </aside>

      <main className="app__main">
        {activeCase ? (
          <>
            <Viewer caseData={activeCase} />
            <StageSlider stage={stage} max={maxStage} onChange={setStage} />
          </>
        ) : (
          <div className="placeholder">Выберите кейс слева</div>
        )}
      </main>
    </div>
  );
}
