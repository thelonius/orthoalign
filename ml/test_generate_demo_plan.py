"""Юнит-тесты для канонического алгоритма демо-плана."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent))
from generate_demo_plan import (  # noqa: E402
    arc_length_to_x,
    build_plan,
    canonical_arc_lengths,
    cap,
    fit_symmetric_parabola,
)


def make_meta(jaw: str, centers: dict[int, tuple[float, float, float]]) -> dict:
    """Удобный helper для создания meta-фикстуры."""
    return {
        "id": "test",
        "jaw": jaw,
        "toothCenters": {str(k): list(v) for k, v in centers.items()},
    }


class TestFitSymmetricParabola:
    def test_recovers_known_parabola(self):
        """y = 0.05x² - 25, фит должен вернуть a≈0.05 и c≈-25."""
        a, c = 0.05, -25.0
        xs = np.array([-20.0, -10.0, 0.0, 10.0, 20.0])
        ys = a * xs ** 2 + c
        a_fit, c_fit = fit_symmetric_parabola(xs, ys)
        assert a_fit == pytest.approx(a, abs=1e-6)
        assert c_fit == pytest.approx(c, abs=1e-6)

    def test_no_linear_term(self):
        """Симметричный фит игнорирует линейный b. Если данные асимметричны,
        фит даст лучший компромисс по a и c, но без b."""
        xs = np.array([-10.0, 0.0, 10.0])
        ys = np.array([5.0, 0.0, 5.0])  # симметричная парабола
        a_fit, c_fit = fit_symmetric_parabola(xs, ys)
        assert a_fit == pytest.approx(0.05, abs=1e-6)
        assert c_fit == pytest.approx(0, abs=1e-6)


class TestArcLengthToX:
    def test_zero_length_returns_zero(self):
        assert arc_length_to_x(0, 0.05) == 0.0

    def test_sign_preserved(self):
        """Отрицательная длина дуги → отрицательный X."""
        x_pos = arc_length_to_x(10, 0.05)
        x_neg = arc_length_to_x(-10, 0.05)
        assert x_pos > 0
        assert x_neg < 0
        assert x_pos == pytest.approx(-x_neg, abs=0.01)

    def test_flat_parabola_arc_equals_x(self):
        """При a=0 парабола вырождается в прямую Y=c, длина дуги = |X|."""
        x = arc_length_to_x(15, 0.0)
        assert x == pytest.approx(15, abs=0.01)

    def test_curved_arc_less_x(self):
        """При a>0 для одной и той же длины дуги X меньше |s|, потому что
        часть дуги «уходит» в Y."""
        s = 20
        x = arc_length_to_x(s, 0.1)
        assert abs(x) < s

    def test_arc_length_monotonic(self):
        """Чем больше s, тем больше |X| (для фиксированной a)."""
        a = 0.05
        prev_x = 0.0
        for s in [1, 5, 10, 15, 20, 30]:
            x = arc_length_to_x(s, a)
            assert x > prev_x
            prev_x = x


class TestCanonicalArcLengths:
    def test_upper_right_positive_left_negative(self):
        """Для верхней челюсти: 11-17 в +s, 21-27 в -s."""
        present = {11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27}
        s = canonical_arc_lengths("upper", present)
        for l in [11, 12, 13, 14, 15, 16, 17]:
            assert s[l] > 0
        for l in [21, 22, 23, 24, 25, 26, 27]:
            assert s[l] < 0

    def test_lower_right_positive(self):
        """Для нижней челюсти: 41-47 в +s, 31-37 в -s."""
        present = {41, 31}
        s = canonical_arc_lengths("lower", present)
        assert s[41] > 0
        assert s[31] < 0

    def test_distance_grows_outward(self):
        """11 ближе к midline чем 17."""
        present = {11, 17, 21, 27}
        s = canonical_arc_lengths("upper", present)
        assert abs(s[11]) < abs(s[17])
        assert abs(s[21]) < abs(s[27])

    def test_skips_missing(self):
        """Если зуба нет, в результате он не появляется."""
        present = {11, 13}
        s = canonical_arc_lengths("upper", present)
        assert 12 not in s
        assert 11 in s
        assert 13 in s


class TestCap:
    def test_within_range(self):
        assert cap(2.0) == 2.0
        assert cap(-2.0) == -2.0

    def test_clipped_to_max(self):
        assert cap(10.0, limit=4.0) == 4.0
        assert cap(-10.0, limit=4.0) == -4.0

    def test_default_limit(self):
        assert cap(100.0) == 4.0


class TestBuildPlan:
    def test_ideal_case_minimal_correction(self):
        """Кейс на симметричной арке с midline=0 не требует движений.

        Используем сам arc_length_to_x для расстановки — тогда зубы стоят
        точно на канонических позициях, и алгоритм должен вернуть нулевые
        дельты.
        """
        a = 0.05
        c_val = -25.0
        from generate_demo_plan import (  # noqa: E402
            UPPER_LEFT,
            UPPER_RIGHT,
            canonical_arc_lengths,
        )
        labels_set = set(UPPER_RIGHT) | set(UPPER_LEFT)
        arc_lengths = canonical_arc_lengths("upper", labels_set)
        centers: dict[int, tuple[float, float, float]] = {}
        for label, s in arc_lengths.items():
            x = arc_length_to_x(s, a)
            y = a * x * x + c_val
            centers[label] = (x, y, 0.0)

        meta = make_meta("upper", centers)
        plan = build_plan(meta)

        # Все дельты должны быть близки к нулю (фит может слегка отличаться
        # от истинного a/c из-за дискретизации arc_length_to_x).
        for label in labels_set:
            pos = plan["targets"][str(label)]["position"]
            assert abs(pos[0]) < 0.6, f"dx for {label}: {pos[0]}"
            assert abs(pos[1]) < 0.6, f"dy for {label}: {pos[1]}"

    def test_midline_shift_corrected(self):
        """Если midline сдвинут, план должен двигать зубы в обратную сторону."""
        # Все зубы сдвинуты на +5 по X относительно нормы.
        a = 0.05
        from generate_demo_plan import (  # noqa: E402
            CROWN_WIDTHS_MM,
            UPPER_LEFT,
            UPPER_RIGHT,
        )
        centers: dict[int, tuple[float, float, float]] = {}
        cumul = 0.0
        for label in UPPER_RIGHT:
            w = CROWN_WIDTHS_MM[label]
            x = cumul + w / 2 + 5.0  # midline shift +5
            centers[label] = (x, a * (x - 5.0) ** 2 - 25.0, 0.0)
            cumul += w
        cumul = 0.0
        for label in UPPER_LEFT:
            w = CROWN_WIDTHS_MM[label]
            x = -(cumul + w / 2) + 5.0
            centers[label] = (x, a * (x - 5.0) ** 2 - 25.0, 0.0)
            cumul += w

        meta = make_meta("upper", centers)
        plan = build_plan(meta)
        # Все зубы должны двигаться в -X (в сторону истинного midline)
        for label in [11, 12, 13, 21, 22, 23]:
            dx = plan["targets"][str(label)]["position"][0]
            assert dx < 0, f"{label} should move left, got dx={dx}"

    def test_quaternion_is_identity(self):
        """v1 алгоритма не делает ротации — кватернион всегда identity."""
        centers = {11: (0, -25, 0), 12: (5, -22, 0), 13: (10, -18, 0),
                   21: (-2, -25, 0), 22: (-7, -22, 0), 23: (-12, -18, 0)}
        meta = make_meta("upper", centers)
        plan = build_plan(meta)
        for label, target in plan["targets"].items():
            assert target["quaternion"] == [0.0, 0.0, 0.0, 1.0]

    def test_capping_limits_movement(self):
        """При огромном midline shift (50мм) дельта всё равно ≤4мм."""
        centers = {11: (50, -25, 0), 12: (55, -22, 0), 13: (60, -18, 0),
                   21: (45, -25, 0), 22: (40, -22, 0), 23: (35, -18, 0)}
        meta = make_meta("upper", centers)
        plan = build_plan(meta)
        for target in plan["targets"].values():
            dx, dy, dz = target["position"]
            assert abs(dx) <= 4.0
            assert abs(dy) <= 4.0
            assert abs(dz) <= 4.0

    def test_lower_jaw_uses_lower_incisors(self):
        """Для нижней челюсти midline считается между 41/31."""
        centers = {41: (5, -20, 0), 31: (-5, -20, 0), 47: (25, 15, 0), 37: (-25, 15, 0)}
        meta = make_meta("lower", centers)
        plan = build_plan(meta)
        # midline должен быть взят как среднее (5 + -5)/2 = 0
        assert plan["midline_x"] == pytest.approx(0, abs=0.1)

    def test_real_case_01F4JV8X(self):
        """Регрессионный тест на реальном кейсе из репозитория."""
        import json
        path = Path(__file__).parent.parent / "backend" / "data" / "cases" / "01F4JV8X_upper" / "meta.json"
        if not path.exists():
            pytest.skip(f"кейс не сгенерирован: {path}")
        meta = json.loads(path.read_text())
        plan = build_plan(meta)
        assert plan["arch"]["b"] == 0.0  # симметричная парабола
        assert plan["arch"]["a"] > 0  # парабола открыта вверх
        assert "title" in plan
        assert len(plan["targets"]) == meta["toothCount"]
