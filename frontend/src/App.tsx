import { useEffect, useState } from "react";
import { Viewer } from "./components/Viewer";
import { StageSlider } from "./components/StageSlider";
import { fetchCases, fetchCase, fetchDemoPlan } from "./lib/api";
import type { CaseData, CaseMeta, DemoPlan } from "./lib/types";
import { usePlan } from "./lib/store";
import { CriticPanel } from "./components/CriticPanel";
import { MetricsBar } from "./components/MetricsBar";
import { CaseThumbnail } from "./components/CaseThumbnail";
import { RotationSliders } from "./components/RotationSliders";
import { ToothInfoPanel } from "./components/ToothInfoPanel";

export function App() {
  const [cases, setCases] = useState<CaseMeta[]>([]);
  const [activeCase, setActiveCase] = useState<CaseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // About свернут по умолчанию — открывается по клику на ? в шапке.
  const [showAbout, setShowAbout] = useState(false);
  const [showCritic, setShowCritic] = useState(false);
  // Sidebar открыт по умолчанию на десктопе; на мобильном CSS скроет его.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const dismissAbout = () => setShowAbout(false);
  // Bump'ится при «применить план» — сигнал StageSlider'у автозапустить play.
  const [autoplayTrigger, setAutoplayTrigger] = useState(0);

  const setCaseInStore = usePlan((s) => s.setCase);
  const stage = usePlan((s) => s.stage);
  const maxStage = usePlan((s) => s.maxStage);
  const setStage = usePlan((s) => s.setStage);
  const selectedLabel = usePlan((s) => s.selectedLabel);
  const targets = usePlan((s) => s.targets);
  const resetTargets = usePlan((s) => s.resetTargets);
  const gizmoMode = usePlan((s) => s.gizmoMode);
  const setGizmoMode = usePlan((s) => s.setGizmoMode);
  const showArch = usePlan((s) => s.showArch);
  const toggleArch = usePlan((s) => s.toggleArch);
  const loadDemoPlan = usePlan((s) => s.loadDemoPlan);
  const appliedPlanTitle = usePlan((s) => s.appliedPlanTitle);

  // Демо-план кейса (для GH Pages — без бэкенда, чтобы Play мог что-то двигать).
  const [demoPlan, setDemoPlan] = useState<DemoPlan | null>(null);

  const onLoadDemoPlan = () => {
    if (!demoPlan) return;
    loadDemoPlan(demoPlan);
    setShowCritic(false);
    setAutoplayTrigger((n) => n + 1);
  };

  useEffect(() => {
    fetchCases()
      .then((cs) => {
        setCases(cs);
        // Автовыбор первого кейса для немедленного wow-эффекта.
        if (cs.length > 0) onSelectCase(cs[0].id);
      })
      .catch((e) => setError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectCase = async (id: string) => {
    setError(null);
    setCaseInStore(id);
    setDemoPlan(null);
    try {
      const data = await fetchCase(id);
      setActiveCase(data);
      // Тянем демо-план параллельно — отсутствие 404 не считается ошибкой.
      try {
        const plan = await fetchDemoPlan(id);
        setDemoPlan(plan);
      } catch {
        setDemoPlan(null);
      }
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
        <button
          className="app__burger"
          onClick={() => setSidebarOpen((s) => !s)}
          aria-label="Свернуть/раскрыть меню кейсов"
        >
          ☰
        </button>
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
          <label className="app__toggle" title="Показать идеальную параболу-арку">
            <input
              type="checkbox"
              checked={showArch}
              onChange={toggleArch}
            />
            <span>Дуга</span>
          </label>
        )}
        {activeCase && demoPlan && (
          <button
            className="app__demo-plan"
            onClick={onLoadDemoPlan}
            title={demoPlan.title}
          >
            🎬 Пример плана
          </button>
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

      {sidebarOpen && (
        <div className="app__drawer-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={"app__sidebar" + (sidebarOpen ? " app__sidebar--open" : " app__sidebar--collapsed")}>
        <h2>Демо-кейсы</h2>
        {error && <div className="error">{error}</div>}
        <ul className="case-list">
          {cases.map((c) => (
            <li key={c.id}>
              <button
                className={activeCase?.id === c.id ? "active" : ""}
                onClick={() => onSelectCase(c.id)}
              >
                <CaseThumbnail meta={c} size={48} />
                <div className="case-list__text">
                  <div className="case-list__name">{c.name}</div>
                  <small>
                    {c.jaw === "upper" ? "верхняя" : "нижняя"} · {c.toothCount} зубов
                  </small>
                </div>
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
            {selectedLabel != null && (
              <>
                <div className="gizmo-toolbar">
                  <div className="gizmo-toolbar__label">Зуб {selectedLabel}</div>
                  <div className="gizmo-toolbar__modes">
                    <button
                      className={gizmoMode === "translate" ? "active" : ""}
                      onClick={() => setGizmoMode("translate")}
                      title="Перемещение по осям"
                    >
                      ⇄ Сдвиг
                    </button>
                    <button
                      className={gizmoMode === "rotate" ? "active" : ""}
                      onClick={() => setGizmoMode("rotate")}
                      title="Поворот по трём осям"
                    >
                      ↻ Поворот
                    </button>
                  </div>
                </div>
                {gizmoMode === "rotate" && <RotationSliders />}
                <ToothInfoPanel caseData={activeCase} />
              </>
            )}
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
                    {demoPlan && (
                      <button
                        className="empty-plan__primary"
                        onClick={onLoadDemoPlan}
                        title={demoPlan.title}
                      >
                        🎬 Показать пример плана
                      </button>
                    )}
                    <button onClick={() => setShowCritic(true)}>🤖 AI план через Llama</button>
                  </div>
                  <div className="empty-plan__or">
                    или клик по любому зубу — расставляйте вручную
                  </div>
                </div>
              </div>
            )}
            {appliedPlanTitle && targetCount > 0 && (
              <div className="applied-plan-tag" title={appliedPlanTitle}>
                Применён: {appliedPlanTitle}
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
          <div className="placeholder">
            <p>Загружаем демо-кейс…</p>
          </div>
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
