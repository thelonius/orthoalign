"""
Готовит один кейс для OrthoAlign из пары (mesh-файл, JSON с лейблами).

Использование:
    python ml/prepare_cases.py \
        --mesh path/to/case.obj \
        --labels path/to/case.json \
        --case-id ZOUIF2W4_upper \
        --name "Скученность фронта (демо)" \
        --jaw upper \
        --output backend/data/cases

Вход:
    mesh:   .obj / .stl / .ply / .vtk — что угодно, что читает trimesh
    labels: JSON в формате 3DTeethSeg22 / MeshSegNet:
            {"jaw": "upper|lower",
             "labels": [int, ...],     # длина == len(vertices), FDI коды
             "instances": [int, ...]}  # опционально

Выход в <output>/<case_id>/:
    meta.json — короткое описание (id, name, jaw, toothCount, source)
    data.json — меш + лейблы + центры зубов для UI
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np


def decimate_mesh(vertices: np.ndarray, faces: np.ndarray, labels: np.ndarray,
                  target_faces: int = 30000):
    """Снижает плотность меша до target_faces, сохраняя per-vertex labels.

    Использует quadric edge collapse через trimesh.
    Лейблы переносятся через ближайшего соседа (KDTree).
    """
    import trimesh

    if len(faces) <= target_faces:
        return vertices, faces, labels

    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    simplified = mesh.simplify_quadric_decimation(face_count=target_faces)
    new_v = np.asarray(simplified.vertices, dtype=np.float32)
    new_f = np.asarray(simplified.faces, dtype=np.uint32)

    from scipy.spatial import cKDTree
    tree = cKDTree(vertices)
    _, idx = tree.query(new_v)
    new_labels = labels[idx]
    return new_v, new_f, new_labels


def normalize_mesh(vertices: np.ndarray) -> np.ndarray:
    """Центрирует меш по центру bbox и масштабирует под камеру.

    Центр bbox, а не среднее вершин, чтобы плотные участки (десна) не
    смещали ноль.
    """
    bb_min = vertices.min(axis=0)
    bb_max = vertices.max(axis=0)
    center = (bb_min + bb_max) / 2
    centered = vertices - center
    max_extent = np.abs(centered).max()
    if max_extent > 0:
        scale = 50.0 / max_extent
        centered *= scale
    return centered.astype(np.float32)


def load_mesh(mesh_path: Path):
    import trimesh
    mesh = trimesh.load(str(mesh_path), process=False, force="mesh")
    if not hasattr(mesh, "vertices") or not hasattr(mesh, "faces"):
        raise ValueError(f"{mesh_path}: не удалось распарсить как меш")
    vertices = np.asarray(mesh.vertices, dtype=np.float32)
    faces = np.asarray(mesh.faces, dtype=np.uint32)
    return vertices, faces


def load_labels(labels_path: Path, n_vertices: int) -> tuple[np.ndarray, str | None]:
    with labels_path.open() as f:
        data = json.load(f)
    labels = np.asarray(data["labels"], dtype=np.int32)
    if len(labels) != n_vertices:
        raise ValueError(
            f"{labels_path}: длина labels ({len(labels)}) != vertices "
            f"({n_vertices})"
        )
    return labels, data.get("jaw")


def process_case(*, mesh_path: Path, labels_path: Path, case_id: str,
                 name: str, jaw: str, output_dir: Path,
                 source: str, target_faces: int = 30000):
    vertices, faces = load_mesh(mesh_path)
    labels, jaw_from_file = load_labels(labels_path, len(vertices))

    if jaw_from_file and jaw_from_file != jaw:
        print(f"[warn] jaw в файле ({jaw_from_file}) != переданный ({jaw})",
              file=sys.stderr)

    vertices, faces, labels = decimate_mesh(vertices, faces, labels,
                                            target_faces=target_faces)
    vertices = normalize_mesh(vertices)

    tooth_centers: dict[str, list[float]] = {}
    for label in np.unique(labels):
        if label == 0:
            continue
        mask = labels == label
        center = vertices[mask].mean(axis=0)
        tooth_centers[str(int(label))] = center.tolist()

    # Teeth3DS даёт сканы upper/lower в разных локальных системах координат.
    # Чтобы UI был консистентным («right tooth = +X»), детектируем перевёрнутые
    # сканы по правому моляру (FDI 17 для upper, 47 для lower) и зеркалим
    # геометрию по X. Без этого парные кейсы не лягут друг на друга.
    right_molar = "17" if jaw == "upper" else "47"
    if right_molar in tooth_centers and tooth_centers[right_molar][0] < 0:
        vertices = vertices.copy()
        vertices[:, 0] *= -1.0
        # Зеркалим — меняется winding треугольников. Перевернуть индексы граней,
        # иначе нормали смотрят внутрь и шейдинг получается чёрным.
        faces = faces[:, [0, 2, 1]]
        for k in tooth_centers:
            tooth_centers[k][0] *= -1.0
        print(f"[mirror] {case_id}: зеркало по X (right molar был в -X)")

    case_dir = output_dir / case_id
    case_dir.mkdir(parents=True, exist_ok=True)

    meta = {
        "id": case_id,
        "name": name,
        "jaw": jaw,
        "toothCount": len(tooth_centers),
        "source": source,
        # Центры зубов идут и в meta — фронт использует их для SVG-миниатюр
        # без загрузки полного меша.
        "toothCenters": tooth_centers,
    }
    with (case_dir / "meta.json").open("w") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    data = {
        **meta,
        "vertices": vertices.flatten().tolist(),
        "faces": faces.flatten().tolist(),
        "labels": labels.tolist(),
        "toothInitialCenters": tooth_centers,
    }
    with (case_dir / "data.json").open("w") as f:
        json.dump(data, f)

    size_mb = (case_dir / "data.json").stat().st_size / 1024 / 1024
    print(f"[ok] {case_id}: {len(vertices)} v, {len(faces)} f, "
          f"{len(tooth_centers)} зубов, {size_mb:.1f} MB")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mesh", type=Path, required=True,
                        help="Путь к mesh-файлу (.obj/.stl/.ply/.vtk)")
    parser.add_argument("--labels", type=Path, required=True,
                        help="Путь к JSON с лейблами в формате 3DTeethSeg22")
    parser.add_argument("--case-id", required=True,
                        help="ID кейса (станет именем папки)")
    parser.add_argument("--name", required=True,
                        help="Человекочитаемое название для UI")
    parser.add_argument("--jaw", choices=["upper", "lower"], required=True)
    parser.add_argument("--output", type=Path,
                        default=Path("backend/data/cases"))
    parser.add_argument("--source",
                        default="Teeth3DS / 3DTeethSeg22 (CC BY-NC-SA 4.0)")
    parser.add_argument("--target-faces", type=int, default=30000,
                        help="Целевое число граней после decimation")
    args = parser.parse_args()

    if not args.mesh.exists():
        print(f"Нет mesh-файла: {args.mesh}", file=sys.stderr)
        sys.exit(1)
    if not args.labels.exists():
        print(f"Нет labels-файла: {args.labels}", file=sys.stderr)
        sys.exit(1)

    args.output.mkdir(parents=True, exist_ok=True)

    process_case(
        mesh_path=args.mesh,
        labels_path=args.labels,
        case_id=args.case_id,
        name=args.name,
        jaw=args.jaw,
        output_dir=args.output,
        source=args.source,
        target_faces=args.target_faces,
    )


if __name__ == "__main__":
    main()
