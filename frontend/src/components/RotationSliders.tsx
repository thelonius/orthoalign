import { useEffect, useState } from "react";
import * as THREE from "three";
import { usePlan, ToothTransform } from "../lib/store";

const RANGE_DEG = 45;
const STEP_DEG = 0.5;

function quatToEulerDeg(q: [number, number, number, number]): [number, number, number] {
  const quat = new THREE.Quaternion(q[0], q[1], q[2], q[3]);
  const eul = new THREE.Euler().setFromQuaternion(quat, "XYZ");
  const r2d = 180 / Math.PI;
  return [eul.x * r2d, eul.y * r2d, eul.z * r2d];
}

function eulerDegToQuat(e: [number, number, number]): [number, number, number, number] {
  const d2r = Math.PI / 180;
  const eul = new THREE.Euler(e[0] * d2r, e[1] * d2r, e[2] * d2r, "XYZ");
  const q = new THREE.Quaternion().setFromEuler(eul);
  return [q.x, q.y, q.z, q.w];
}

const AXES: { key: 0 | 1 | 2; label: string; color: string }[] = [
  { key: 0, label: "X", color: "#e74c3c" },
  { key: 1, label: "Y", color: "#27ae60" },
  { key: 2, label: "Z", color: "#3498db" },
];

export function RotationSliders() {
  const selectedLabel = usePlan((s) => s.selectedLabel);
  const targets = usePlan((s) => s.targets);
  const setTargetTransform = usePlan((s) => s.setTargetTransform);

  const [eulerDeg, setEulerDeg] = useState<[number, number, number]>([0, 0, 0]);

  // Когда меняется выбранный зуб или его таргет извне (LLM, гизмо) —
  // подтягиваем актуальный угол в слайдеры.
  useEffect(() => {
    if (selectedLabel == null) {
      setEulerDeg([0, 0, 0]);
      return;
    }
    const t = targets[selectedLabel];
    setEulerDeg(t ? quatToEulerDeg(t.quaternion) : [0, 0, 0]);
  }, [selectedLabel, targets]);

  if (selectedLabel == null) return null;

  const onSlide = (axis: 0 | 1 | 2, value: number) => {
    const next: [number, number, number] = [...eulerDeg];
    next[axis] = value;
    setEulerDeg(next);
    const q = eulerDegToQuat(next);
    const existing = targets[selectedLabel];
    const target: ToothTransform = {
      position: existing?.position ?? [0, 0, 0],
      quaternion: q,
    };
    setTargetTransform(selectedLabel, target);
  };

  const reset = () => {
    setEulerDeg([0, 0, 0]);
    const existing = targets[selectedLabel];
    const target: ToothTransform = {
      position: existing?.position ?? [0, 0, 0],
      quaternion: [0, 0, 0, 1],
    };
    setTargetTransform(selectedLabel, target);
  };

  return (
    <div className="rot-sliders">
      <div className="rot-sliders__head">
        <span>Поворот зуба {selectedLabel}</span>
        <button onClick={reset} title="Сбросить ротацию">↺</button>
      </div>
      {AXES.map((a) => (
        <div key={a.key} className="rot-sliders__row">
          <span className="rot-sliders__axis" style={{ color: a.color }}>{a.label}</span>
          <input
            type="range"
            min={-RANGE_DEG}
            max={RANGE_DEG}
            step={STEP_DEG}
            value={eulerDeg[a.key]}
            onChange={(e) => onSlide(a.key, Number(e.target.value))}
            style={{ accentColor: a.color }}
          />
          <span className="rot-sliders__value">
            {eulerDeg[a.key] >= 0 ? "+" : ""}
            {eulerDeg[a.key].toFixed(1)}°
          </span>
        </div>
      ))}
    </div>
  );
}
