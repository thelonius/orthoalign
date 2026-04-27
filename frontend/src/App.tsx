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
  const [showAbout, setShowAbout] = useState(true);

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
      {showAbout && (
        <div className="about" onClick={() => setShowAbout(false)}>
          <div className="about__panel" onClick={(e) => e.stopPropagation()}>
            <button className="about__close" onClick={() => setShowAbout(false)}>×</button>
            <h2>OrthoAlign — демо ортодонтического планировщика</h2>
            <p>
              Технико-демонстрационный прототип. Сделан как заявка на роль AI Fullstack
              в продуктовой команде, выпускающей прозрачные элайнеры.
            </p>
            <h3>Что показывает</h3>
            <ol>
              <li>Загруженный 3D-скан челюсти автоматически разделён на отдельные зубы (FDI-нумерация).</li>
              <li>Слайдер «Стадия лечения» прогоняет интерполяцию между исходным и целевым положением каждого зуба.</li>
              <li>На максимальной стадии можно выбрать зуб и подвинуть его гизмо — это и есть работа техника по планированию, которую обычно делают руками 30-60 минут на кейс.</li>
            </ol>
            <h3>Стек</h3>
            <p>
              Python · FastAPI · Celery · Redis · MySQL · React · TypeScript ·
              Three.js (react-three-fiber) · WebGL · trimesh · MeshSegNet (планируется в v2)
            </p>
            <p className="about__note">
              Данные — открытый датасет <a href="https://crns-smartvision.github.io/teeth3ds" target="_blank" rel="noopener">Teeth3DS</a> (CC BY-NC-SA),
              ровно те же реальные интраоральные сканы, что используют в исследованиях по сегментации зубов.
              Сегментация на демо-кейсах предкэширована; в v2 планируется живой инференс через
              Celery-таску на pretrained MeshSegNet.
            </p>
            <button className="about__start" onClick={() => setShowAbout(false)}>
              Начать →
            </button>
          </div>
        </div>
      )}
      <header className="app__header">
        <h1>OrthoAlign</h1>
        <span className="app__tag">v0.1 · demo</span>
        <button className="app__about" onClick={() => setShowAbout(true)} title="О проекте">
          ?
        </button>
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
