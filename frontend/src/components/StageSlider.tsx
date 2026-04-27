interface Props {
  stage: number;
  max: number;
  onChange: (s: number) => void;
}

export function StageSlider({ stage, max, onChange }: Props) {
  return (
    <div className="stage-slider">
      <label>
        Стадия лечения: <strong>{stage} / {max}</strong>
      </label>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={stage}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
