#!/usr/bin/env python3
"""
Детерминистский генератор демо-плана лечения для каждого кейса.

Для GH Pages-демо нужен план без живого LLM/бэкенда. Этот скрипт:
1. Читает meta.json кейса (toothCenters в мм).
2. Фитит параболу Y = a*X² + b*X + c по плановым позициям зубов.
3. Считает целевую дельту для каждого зуба:
   - delta_y = fitted_y - actual_y  (подтянуть к арке)
   - delta_x = -midline_x           (выровнять среднюю линию)
   - delta_z = 0                    (высоту не трогаем)
4. Капит дельту коэффициентом, чтобы движение читалось, но не было фриковым.
5. Записывает в backend/data/cases/<id>/plan.json.

Запуск:
    .venv/bin/python ml/generate_demo_plan.py

Опционально для одного кейса:
    .venv/bin/python ml/generate_demo_plan.py --case-id 01F4JV8X_upper
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

REPO_ROOT = Path(__file__).resolve().parents[1]
CASES_DIR = REPO_ROOT / "backend" / "data" / "cases"

UPPER_INCISORS = (11, 21)
LOWER_INCISORS = (41, 31)

# Все дельты умножаются на коэффициент: 1.0 — двигаем на полный offset, 0.0 — никуда.
# 0.85 даёт визуально заметное «лечение», не доводя зубы до перекрытий.
SCALE = 0.85

# Жёсткий cap на компоненты дельты, мм. Защита от выбросов на кривых кейсах.
CAP_MM = 3.5


def fit_parabola(xs: np.ndarray, ys: np.ndarray) -> tuple[float, float, float]:
    """Фит Y = a*X² + b*X + c МНК. Возвращает (a, b, c)."""
    A = np.stack([xs * xs, xs, np.ones_like(xs)], axis=1)
    coef, *_ = np.linalg.lstsq(A, ys, rcond=None)
    return float(coef[0]), float(coef[1]), float(coef[2])


def cap(value: float, limit: float = CAP_MM) -> float:
    return max(-limit, min(limit, value))


def build_plan(meta: dict) -> dict:
    centers: dict[str, list[float]] = meta["toothCenters"]
    jaw: str = meta["jaw"]
    incisors = UPPER_INCISORS if jaw == "upper" else LOWER_INCISORS

    labels = sorted(int(k) for k in centers.keys())
    xs = np.array([centers[str(l)][0] for l in labels], dtype=float)
    ys = np.array([centers[str(l)][1] for l in labels], dtype=float)

    a, b, c = fit_parabola(xs, ys)
    fitted_ys = a * xs * xs + b * xs + c

    # Midline: средняя X центральных резцов. Для нормально стоящих кейсов ~0,
    # для смещённых — заметно ненулевое.
    inc_xs = [centers[str(l)][0] for l in incisors if str(l) in centers]
    midline_x = float(np.mean(inc_xs)) if inc_xs else 0.0

    targets: dict[str, dict] = {}
    for label, x, y, fy in zip(labels, xs, ys, fitted_ys):
        dx = cap(-midline_x * SCALE)
        dy = cap((fy - y) * SCALE)
        # Z (высота) — не трогаем, в реальной ортодонтии extrusion/intrusion
        # просчитывается отдельно и требует другой биомеханики.
        targets[str(label)] = {
            "position": [round(dx, 3), round(dy, 3), 0.0],
            "quaternion": [0.0, 0.0, 0.0, 1.0],
        }

    # Метаданные плана для UI: что мы вообще делали.
    rationales = []
    if abs(midline_x) > 0.5:
        rationales.append(f"коррекция средней линии на {abs(midline_x):.1f} мм")
    max_arch_dev = float(np.max(np.abs(ys - fitted_ys)))
    if max_arch_dev > 0.3:
        rationales.append(
            f"выравнивание по идеальной арке (макс. отклонение {max_arch_dev:.1f} мм)"
        )
    if not rationales:
        rationales.append(
            "минимальная коррекция — кейс уже близок к идеалу, демо двигает зубы для иллюстрации"
        )

    return {
        "id": meta["id"],
        "kind": "demo",
        "title": "Демо-план: " + ", ".join(rationales),
        "arch": {"a": a, "b": b, "c": c},
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
