import { useEffect, useState } from "react";
import { Viewer } from "./components/Viewer";
import { StageSlider } from "./components/StageSlider";
import { fetchCases, fetchCase } from "./lib/api";
import type { CaseData, CaseMeta } from "./lib/types";

export function App() {
  const [cases, setCases] = useState<CaseMeta[]>([]);
  const [activeCase, setActiveCase] = useState<CaseData | null>(null);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCases()
      .then(setCases)
      .catch((e) => setError(String(e)));
  }, []);

  const onSelectCase = async (id: string) => {
    setError(null);
    setStage(0);
    try {
      const data = await fetchCase(id);
      setActiveCase(data);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>OrthoAlign</h1>
        <span className="app__tag">v0.1 · demo</span>
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
                <small>{c.jaw === "upper" ? "верхняя" : "нижняя"}</small>
              </button>
            </li>
          ))}
          {cases.length === 0 && !error && <li className="muted">Загрузка…</li>}
        </ul>
      </aside>

      <main className="app__main">
        {activeCase ? (
          <>
            <Viewer caseData={activeCase} stage={stage} />
            <StageSlider stage={stage} max={20} onChange={setStage} />
          </>
        ) : (
          <div className="placeholder">Выберите кейс слева</div>
        )}
      </main>
    </div>
  );
}
