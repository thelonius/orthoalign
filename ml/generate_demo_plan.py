#!/usr/bin/env python3
"""
Канонический генератор демо-плана: расставить зубы вдоль идеализированной
дуги в правильном FDI-порядке и с правильными интервалами.

Старая версия фитировала параболу по реальным (искажённым) позициям и тянула
зубы к этой же кривой — outlier-зуб искажал параболу, остальные ехали не туда.
Эта версия:

1. Считает midline_x = средняя X-координата центральных резцов (11 и 21
   для верхней, 41 и 31 для нижней).
2. Виртуально сдвигает все позиции на -midline_x и фитирует СИММЕТРИЧНУЮ
   параболу Y = a*x² + c (без линейного члена b).
3. Раздаёт каждому зубу его «каноническое» место на дуге: положение
   определяется FDI-номером и средними размерами коронок (резец 8.5 мм,
   моляр ~10 мм и т.д.). Зуб стоит на параболе на расстоянии arc_length
   от midline, равном кумулятивной сумме половин коронок до этого зуба.
4. Дельта = (canonical - actual) * SCALE. На «нормальном» прикусе canonical
   близок к actual → дельты маленькие. На патологии canonical отличается
   радикально → понятное, направленное движение.

Запуск:
    .venv/bin/python ml/generate_demo_plan.py
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[1]
CASES_DIR = REPO_ROOT / "backend" / "data" / "cases"

# Mesial-Distal ширина коронок в мм по FDI (усреднённые таблицы Nelson&Ash).
# Мы используем их для распределения зубов вдоль дуги.
CROWN_WIDTHS_MM: dict[int, float] = {
    # Верхняя челюсть
    11: 8.5, 12: 6.5, 13: 7.5, 14: 7.0, 15: 6.5, 16: 10.5, 17: 9.5,
    21: 8.5, 22: 6.5, 23: 7.5, 24: 7.0, 25: 6.5, 26: 10.5, 27: 9.5,
    # Нижняя челюсть
    31: 5.0, 32: 5.5, 33: 6.5, 34: 7.0, 35: 7.0, 36: 11.0, 37: 10.5,
    41: 5.0, 42: 5.5, 43: 6.5, 44: 7.0, 45: 7.0, 46: 11.0, 47: 10.5,
}

UPPER_RIGHT = [11, 12, 13, 14, 15, 16, 17]
UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27]
LOWER_RIGHT = [41, 42, 43, 44, 45, 46, 47]
LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37]

# Насколько дотягивать к каноническому положению. 0.7 = двигаемся к идеалу
# на 70%, чтобы видеть прогресс лечения, но не «дёргать» здоровые зубы.
SCALE = 0.7

# Защита от выбросов: дельта по любой оси не больше CAP_MM мм.
CAP_MM = 4.0


def fit_symmetric_parabola(xs_centered: np.ndarray, ys: np.ndarray) -> tuple[float, float]:
    """Фит y = a*x² + c через МНК. Возвращает (a, c).

    Симметричен относительно оси X=0 — после виртуального сдвига midline это
    означает «арка симметричная вокруг сагиттальной плоскости».
    """
    A = np.stack([xs_centered * xs_centered, np.ones_like(xs_centered)], axis=1)
    coef, *_ = np.linalg.lstsq(A, ys, rcond=None)
    return float(coef[0]), float(coef[1])


def arc_length_to_x(target_s: float, a: float, *, n_steps: int = 200) -> float:
    """Найти X на параболе y=ax²+c, такое что длина дуги от 0 до X = target_s.

    Используем дискретный интеграл и интерполяцию. Знак target_s сохраняется:
    отрицательный s → отрицательный X (левая сторона).
    """
    if target_s == 0:
        return 0.0
    sign = 1.0 if target_s > 0 else -1.0
    s_abs = abs(target_s)
    # Параметризуем X в диапазоне [0, X_max], считаем накопленную длину дуги.
    # Берём X_max заведомо больше нужного: 2*s_abs хватит для пологих парабол.
    x_max = max(50.0, 2.0 * s_abs)
    xs = np.linspace(0.0, x_max, n_steps + 1)
    dx = xs[1] - xs[0]
    # Производная dy/dx = 2ax. Длина дуги = ∫ √(1 + (dy/dx)²) dx.
    integrand = np.sqrt(1.0 + (2.0 * a * xs) ** 2)
    cum_s = np.concatenate(([0.0], np.cumsum((integrand[:-1] + integrand[1:]) / 2 * dx)))
    if cum_s[-1] < s_abs:
        # Парабола слишком пологая или мы запросили нереально длинную дугу.
        return sign * xs[-1]
    # Линейная интерполяция: ищем индекс, где cum_s переходит s_abs.
    idx = int(np.searchsorted(cum_s, s_abs))
    if idx == 0:
        return sign * 0.0
    s_lo, s_hi = cum_s[idx - 1], cum_s[idx]
    x_lo, x_hi = xs[idx - 1], xs[idx]
    t = (s_abs - s_lo) / (s_hi - s_lo) if s_hi > s_lo else 0.0
    return sign * (x_lo + t * (x_hi - x_lo))


def cap(value: float, limit: float = CAP_MM) -> float:
    return max(-limit, min(limit, value))


def canonical_arc_lengths(jaw: str, present_labels: set[int]) -> dict[int, float]:
    """Возвращает каноническую длину дуги от midline для каждого зуба.

    Знак: положительный — правая сторона пациента (FDI 11-17 / 41-47),
    отрицательный — левая (21-27 / 31-37). Используется средняя ширина коронок.
    """
    if jaw == "upper":
        right_order, left_order = UPPER_RIGHT, UPPER_LEFT
    else:
        right_order, left_order = LOWER_RIGHT, LOWER_LEFT

    out: dict[int, float] = {}
    cumul = 0.0
    for label in right_order:
        w = CROWN_WIDTHS_MM[label]
        if label in present_labels:
            out[label] = cumul + w / 2
        cumul += w
    cumul = 0.0
    for label in left_order:
        w = CROWN_WIDTHS_MM[label]
        if label in present_labels:
            out[label] = -(cumul + w / 2)
        cumul += w
    return out


def build_plan(meta: dict) -> dict:
    centers: dict[str, list[float]] = meta["toothCenters"]
    jaw: str = meta["jaw"]
    incisors = (11, 21) if jaw == "upper" else (41, 31)

    present = {int(k) for k in centers.keys()}
    labels = sorted(present)

    # 1. Midline через центральные резцы. Если их нет — берём центр бокса.
    inc_xs = [centers[str(i)][0] for i in incisors if str(i) in centers]
    midline_x = float(np.mean(inc_xs)) if inc_xs else 0.0

    # 2. Сдвинутые координаты, фит симметричной параболы.
    xs = np.array([centers[str(l)][0] for l in labels], dtype=float)
    ys = np.array([centers[str(l)][1] for l in labels], dtype=float)
    xs_centered = xs - midline_x
    a, c = fit_symmetric_parabola(xs_centered, ys)

    # 3. Каноническое положение каждого зуба на этой параболе.
    arc_lengths = canonical_arc_lengths(jaw, present)

    targets: dict[str, dict] = {}
    for label, x_actual, y_actual in zip(labels, xs, ys):
        s = arc_lengths.get(label)
        if s is None:
            # Запасной случай — зуб не из стандартного набора (например, сверхкомплектный).
            # Не двигаем.
            targets[str(label)] = {
                "position": [0.0, 0.0, 0.0],
                "quaternion": [0.0, 0.0, 0.0, 1.0],
            }
            continue
        x_canonical_centered = arc_length_to_x(s, a)
        y_canonical = a * x_canonical_centered ** 2 + c
        # Возвращаем X в мировую систему: midline после плана становится в X=0,
        # значит мировое X = canonical_centered (без midline_x обратно).
        # Это и есть «выровнять midline».
        x_canonical_world = x_canonical_centered

        dx = cap((x_canonical_world - x_actual) * SCALE)
        dy = cap((y_canonical - y_actual) * SCALE)
        targets[str(label)] = {
            "position": [round(dx, 3), round(dy, 3), 0.0],
            "quaternion": [0.0, 0.0, 0.0, 1.0],
        }

    # Метаданные плана для UI: что мы сделали.
    deviations = []
    midline_correction = abs(midline_x)
    if midline_correction > 0.5:
        deviations.append(f"коррекция midline на {midline_correction:.1f} мм")
    max_arch_dev = float(np.max(np.abs(ys - (a * xs_centered ** 2 + c))))
    if max_arch_dev > 0.5:
        deviations.append(f"выравнивание по дуге (макс. отклонение {max_arch_dev:.1f} мм)")
    if not deviations:
        deviations.append("минимальная коррекция — кейс близок к норме")

    return {
        "id": meta["id"],
        "kind": "demo",
        "title": "Демо-план: " + ", ".join(deviations),
        "arch": {"a": a, "b": 0.0, "c": c},
        "midline_x": midline_x,
        "targets": targets,
    }


def process_case(case_dir: Path) -> Path | None:
    meta_path = case_dir / "meta.json"
    if not meta_path.exists():
        return None
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    plan = build_plan(meta)
    plan_path = case_dir / "plan.json"
    plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    return plan_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case-id", help="Сгенерировать только для одного кейса")
    args = parser.parse_args()

    if not CASES_DIR.exists():
        raise SystemExit(f"Нет директории кейсов: {CASES_DIR}")

    if args.case_id:
        targets = [CASES_DIR / args.case_id]
    else:
        targets = sorted(p for p in CASES_DIR.iterdir() if p.is_dir())

    for case_dir in targets:
        out = process_case(case_dir)
        if out:
            print(f"[ok] {case_dir.name} → {out.relative_to(REPO_ROOT)}")
        else:
            print(f"[skip] {case_dir.name}: нет meta.json")


if __name__ == "__main__":
    main()
