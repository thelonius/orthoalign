import { useEffect, useRef, useState } from "react";
import { usePlan } from "../lib/store";

interface Props {
  stage: number;
  max: number;
  onChange: (s: number) => void;
  hasPlan: boolean;
  // При изменении значения слайдер автозапустит play (счётчик bump'ится в App).
  autoplayTrigger: number;
}

const PLAY_DURATION_MS = 4000;

export function StageSlider({ stage, max, onChange, hasPlan, autoplayTrigger }: Props) {
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startStageRef = useRef<number>(0);
  const selectTooth = usePlan((s) => s.selectTooth);

  // Автозапуск play при изменении autoplayTrigger (после применения плана).
  useEffect(() => {
    if (autoplayTrigger > 0 && hasPlan) {
      selectTooth(null);
      setPlaying(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayTrigger]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    // Если слайдер уже на максимуме — стартуем с нуля.
    const beginStage = stage >= max ? 0 : stage;
    startStageRef.current = beginStage;
    startTimeRef.current = performance.now();
    if (beginStage !== stage) onChange(beginStage);

    const tick = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const remaining = max - startStageRef.current;
      const t = Math.min(1, elapsed / (PLAY_DURATION_MS * (remaining / max)));
      const next = startStageRef.current + remaining * t;
      onChange(Math.min(max, next));
      if (t >= 1) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  return (
    <div className={"stage-slider" + (!hasPlan ? " stage-slider--disabled" : "")}>
      <button
        className="stage-slider__play"
        disabled={!hasPlan}
        onClick={() => {
          if (!hasPlan) return;
          if (!playing) selectTooth(null);
          setPlaying((p) => !p);
        }}
        title={
          !hasPlan
            ? "Создайте план чтобы воспроизвести"
            : playing
              ? "Пауза"
              : "Воспроизвести анимацию лечения"
        }
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <label>
        {hasPlan ? (
          <>Стадия: <strong>{Math.round(stage)} / {max}</strong></>
        ) : (
          <span className="stage-slider__hint">План ещё не создан</span>
        )}
      </label>
      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={stage}
        disabled={!hasPlan}
        onChange={(e) => {
          if (playing) setPlaying(false);
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
}
