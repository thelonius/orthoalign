import { useEffect, useState } from "react";
import { Viewer } from "./components/Viewer";
import { StageSlider } from "./components/StageSlider";
import { fetchCases, fetchCase } from "./lib/api";
import type { CaseData, CaseMeta } from "./lib/types";
import { usePlan } from "./lib/store";
import { CriticPanel } from "./components/CriticPanel";
import { MetricsBar } from "./components/MetricsBar";

export function App() {
  const [cases, setCases] = useState<CaseMeta[]>([]);
  const [activeCase, setActiveCase] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // About показываем только если пользователь его раньше не закрывал.
  const [showAbout, setShowAbout] = useState(
    () => !localStorage.getItem("orthoalign.aboutDismissed"),
  );
  const [showCritic, setShowCritic] = useState(false);

  const dismissAbout = () => {
    setShowAbout(false);
    localStorage.setItem("orthoalign.aboutDismissed", "1");
  };
  // Bump'ится при «применить план» — сигнал StageSlider'у автозапустить play.
  const [autoplayTrigger, setAutoplayTrigger] = useState(0);

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
    <div className={"app" + (showCritic && activeCase ? " app--with-critic" : "")}>
      {showAbout && (
        <div className="about" onClick={() => dismissAbout()}>
          <div className="about__panel" onClick={(e) => e.stopPropagation()}>
            <button className="about__close" onClick={() => dismissAbout()}>×</button>
            <h2>OrthoAlign — демо ортодонтического планировщика</h2>
            <p>
              Технико-демонстрационный прототип. Сделан как заявка на роль AI Fullstack
              в продуктовой команде, выпускающей прозрачные элайнеры.
            </p>
            <h3>Что показывает</h3>
            <ol>
              <li>3D-скан челюсти автоматически сегментирован на зубы по FDI.</li>
              <li>AI-планировщик (Llama 3.3 70B через Groq) предлагает целевые движения зубов с клиническим обоснованием, либо вы расставляете вручную через клик и гизмо.</li>
              <li>Слайдер «Стадия» прогоняет интерполяцию от исходного состояния к плановому, ▶ запускает анимацию.</li>
              <li>Метрики «было → стало» (dispersion, spacing variance, midline) показывают численный эффект плана.</li>
              <li>Зубы перекрывающие соседей подсвечиваются красным — план физически невозможен в этой точке.</li>
            </ol>

            <h3>Что это НЕ есть</h3>
            <p className="about__note" style={{borderTop: 'none', paddingTop: 0, marginTop: 0}}>
              Не клинический инструмент. Не учитывает overbite/overjet, Bolton ratio,
              торк, реальные размеры зубов, окклюзию двух челюстей, биомеханику движения.
              Это технико-демонстрационный прототип, показывающий навык построения
              такого софта, а не готовое решение.
            </p>
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
            <button className="about__start" onClick={() => dismissAbout()}>
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
        {activeCase && targetCount > 0 && (
          <span className="app__hint">
            {editing
              ? selectedLabel
                ? `Зуб ${selectedLabel}: тащите гизмо для целевой позиции`
                : "Кликните зуб, чтобы расставить целевую позицию"
              : stage === 0
                ? "Стадия 0 — исходное состояние. Прокрутите до конца для редактирования."
                : `Стадия ${Math.round(stage)} из ${maxStage}`}
          </span>
        )}
        {activeCase && (
          <button
            className="app__critic"
            onClick={() => setShowCritic((s) => !s)}
            title="Открыть AI-планировщик"
          >
            🤖 AI план
          </button>
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
            {targetCount === 0 && !showCritic && (
              <div className="empty-plan">
                <div className="empty-plan__panel">
                  <div className="empty-plan__title">
                    Это исходное состояние — то, с чем пациент пришёл к врачу
                  </div>
                  <div className="empty-plan__hint">
                    Создайте план: целевые позиции зубов после лечения.
                    После этого слайдер покажет анимацию по стадиям.
                  </div>
                  <div className="empty-plan__actions">
                    <button onClick={() => setShowCritic(true)}>🤖 AI план через Llama</button>
                  </div>
                  <div className="empty-plan__or">
                    или клик по любому зубу — расставляйте вручную
                  </div>
                </div>
              </div>
            )}
            <MetricsBar caseData={activeCase} />
            <StageSlider
              stage={stage}
              max={maxStage}
              onChange={setStage}
              hasPlan={targetCount > 0}
              autoplayTrigger={autoplayTrigger}
            />
          </>
        ) : (
          <div className="placeholder">Выберите кейс слева</div>
        )}
      </main>

      {activeCase && showCritic && (
        <CriticPanel
          caseId={activeCase.id}
          onClose={() => setShowCritic(false)}
          onPlanApplied={() => {
            setShowCritic(false);
            setAutoplayTrigger((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
