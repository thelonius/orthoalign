import { useEffect, useRef, useState } from "react";
import { usePlan } from "../lib/store";

interface Props {
  stage: number;
  max: number;
  onChange: (s: number) => void;
}

const PLAY_DURATION_MS = 4000;

export function StageSlider({ stage, max, onChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const startStageRef = useRef<number>(0);
  const selectTooth = usePlan((s) => s.selectTooth);

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
    <div className="stage-slider">
      <button
        className="stage-slider__play"
        onClick={() => {
          if (!playing) selectTooth(null); // Снимаем синюю подсветку, чтобы
          // во время анимации все зубы были равноправны.
          setPlaying((p) => !p);
        }}
        title={playing ? "Пауза" : "Воспроизвести анимацию лечения"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <label>
        Стадия: <strong>{Math.round(stage)} / {max}</strong>
      </label>
      <input
        type="range"
        min={0}
        max={max}
        step={0.1}
        value={stage}
        onChange={(e) => {
          if (playing) setPlaying(false);
          onChange(Number(e.target.value));
        }}
      />
    </div>
  );
}
