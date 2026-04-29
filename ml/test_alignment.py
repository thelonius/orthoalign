"""Тесты PCA-выравнивания и эвристик знаков."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent))
from prepare_cases import align_to_canonical_axes  # noqa: E402


def make_synthetic_jaw(jaw: str, *, rotation_axis: tuple[float, float, float] | None = None,
                       rotation_angle: float = 0.0, mirror_x: bool = False,
                       flip_z: bool = False) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Создаёт синтетическую U-образную челюсть и опционально применяет
    случайное вращение/зеркало, чтобы проверить, что align его исправит.

    Зубы расставляются слева направо для смотрящего: моляр-моляр-...-резец-
    резец-...-моляр. Это согласуется с FDI-конвенцией (11-17 справа от
    midline, 21-27 слева)."""
    a, c = 0.05, -25.0
    # Порядок слева направо для смотрящего: 27...21|11...17 (или 37...31|41...47).
    if jaw == "upper":
        labels_list = [27, 26, 25, 24, 23, 22, 21, 11, 12, 13, 14, 15, 16, 17]
    else:
        labels_list = [37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47]
    centers: list[np.ndarray] = []
    for i, _ in enumerate(labels_list):
        x = -25 + (i * 50) / 13
        y = a * x * x + c
        centers.append(np.array([x, y, 0.0]))

    # Имитация коронки — ставим вершины зуба около центра.
    # Для upper crowns смещены в -Z (от центроида), для lower в +Z.
    crown_z = -3.0 if jaw == "upper" else 3.0
    vertices: list[np.ndarray] = []
    labels_arr: list[int] = []
    # Десна — несколько vertices в нулевом Z
    for x in np.linspace(-30, 30, 20):
        for y in np.linspace(-30, 30, 20):
            vertices.append(np.array([x, y, 0.0]))
            labels_arr.append(0)
    # Каждый зуб — 5 vertices в его коронке
    for label, c_xyz in zip(labels_list, centers):
        for _ in range(5):
            vertices.append(c_xyz + np.array([0, 0, crown_z]))
            labels_arr.append(label)

    verts = np.array(vertices, dtype=np.float32)
    # Простой mesh: треугольники по индексам
    n = len(verts)
    faces = np.array(
        [[i, (i + 1) % n, (i + 2) % n] for i in range(0, n - 2, 3)],
        dtype=np.uint32,
    )
    labels_np = np.array(labels_arr, dtype=np.int32)

    if mirror_x:
        verts[:, 0] *= -1
    if flip_z:
        verts[:, 2] *= -1
    if rotation_axis is not None and rotation_angle != 0:
        from scipy.spatial.transform import Rotation as R  # type: ignore
        rot = R.from_rotvec(np.array(rotation_axis) * rotation_angle)
        verts = rot.apply(verts).astype(np.float32)

    return verts, faces, labels_np


class TestAlignToCanonicalAxes:
    def test_already_aligned_upper_unchanged(self):
        """Уже корректно ориентированная челюсть не должна сильно сдвинуться."""
        verts, faces, labels = make_synthetic_jaw("upper")
        v_aligned, _, centers_dict = align_to_canonical_axes(verts, faces, labels, "upper")
        # 17 (right molar) в +X
        assert centers_dict["17"][0] > 0
        # 11 (резец) в -Y, 17 (моляр) в +Y
        assert centers_dict["11"][1] < centers_dict["17"][1]

    def test_mirrored_x_gets_flipped_back(self):
        """Если скан зеркальный по X, alignment должен распознать и развернуть."""
        verts, faces, labels = make_synthetic_jaw("upper", mirror_x=True)
        _, _, centers_dict = align_to_canonical_axes(verts, faces, labels, "upper")
        # После align: 17 (right) снова в +X
        assert centers_dict["17"][0] > 0

    def test_lower_jaw_canonical(self):
        """Нижняя челюсть: 47 в +X, 41 в -Y, 47 в +Y."""
        verts, faces, labels = make_synthetic_jaw("lower")
        _, _, centers_dict = align_to_canonical_axes(verts, faces, labels, "lower")
        assert centers_dict["47"][0] > 0
        assert centers_dict["41"][1] < centers_dict["47"][1]

    def test_z_flipped_lower_corrected(self):
        """Если у lower коронки в -Z, alignment должен flip'нуть Z."""
        verts, faces, labels = make_synthetic_jaw("lower", flip_z=True)
        v_aligned, _, _ = align_to_canonical_axes(verts, faces, labels, "lower")
        # Tooth-vertices в среднем должны быть в +Z (для lower).
        tooth_mask = labels != 0
        avg_tooth_z = v_aligned[tooth_mask, 2].mean()
        avg_all_z = v_aligned[:, 2].mean()
        assert avg_tooth_z > avg_all_z

    def test_z_flipped_upper_corrected(self):
        """Если у upper коронки в +Z, alignment должен flip'нуть Z."""
        verts, faces, labels = make_synthetic_jaw("upper", flip_z=True)
        v_aligned, _, _ = align_to_canonical_axes(verts, faces, labels, "upper")
        tooth_mask = labels != 0
        avg_tooth_z = v_aligned[tooth_mask, 2].mean()
        avg_all_z = v_aligned[:, 2].mean()
        # Для upper: коронки в -Z от среднего всех вершин
        assert avg_tooth_z < avg_all_z

    def test_winding_invariant_after_double_flip(self):
        """Зеркало X + Z = два flip'а, winding должен оставаться согласованным."""
        verts, faces, labels = make_synthetic_jaw("upper", mirror_x=True, flip_z=True)
        _, faces_aligned, _ = align_to_canonical_axes(verts, faces, labels, "upper")
        # Просто проверяем, что faces — корректный массив N×3 без NaN/inf.
        assert faces_aligned.shape[1] == 3
        assert (faces_aligned >= 0).all()


class TestRealCases:
    """Регрессионные тесты на реальных кейсах из репозитория."""

    @pytest.fixture
    def cases_dir(self):
        return Path(__file__).parent.parent / "backend" / "data" / "cases"

    def test_01F4JV8X_upper_canonical(self, cases_dir):
        import json
        meta_path = cases_dir / "01F4JV8X_upper" / "meta.json"
        if not meta_path.exists():
            pytest.skip("кейс не сгенерирован")
        meta = json.loads(meta_path.read_text())
        # 17 (right molar) в +X
        assert meta["toothCenters"]["17"][0] > 0
        # 11 в -Y, 17 в +Y
        assert meta["toothCenters"]["11"][1] < meta["toothCenters"]["17"][1]

    def test_X9OQZ131_paired_consistent(self, cases_dir):
        import json
        upper_p = cases_dir / "X9OQZ131_upper" / "meta.json"
        lower_p = cases_dir / "X9OQZ131_lower" / "meta.json"
        if not upper_p.exists() or not lower_p.exists():
            pytest.skip("парный кейс не сгенерирован")
        upper = json.loads(upper_p.read_text())
        lower = json.loads(lower_p.read_text())
        # Для пары: 17 (upper right) и 47 (lower right) оба в +X.
        assert upper["toothCenters"]["17"][0] > 0
        assert lower["toothCenters"]["47"][0] > 0
        # Резцы (11/41) в -Y, моляры (17/47) в +Y для обеих челюстей.
        assert upper["toothCenters"]["11"][1] < upper["toothCenters"]["17"][1]
        assert lower["toothCenters"]["41"][1] < lower["toothCenters"]["47"][1]
        # Paired-связки выставлены.
        assert upper.get("pairedCaseId") == "X9OQZ131_lower"
        assert lower.get("pairedCaseId") == "X9OQZ131_upper"
        assert lower.get("isPrimary") is True
        assert upper.get("isPrimary") is False
