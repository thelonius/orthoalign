import { useMemo } from "react";
import * as THREE from "three";
import type { CaseData } from "../lib/types";

interface Props {
  caseData: CaseData;
  stage: number;
}

// Палитра для FDI-нумерации: десна = серый, зубы = HSL по индексу.
function colorForLabel(label: number): THREE.Color {
  if (label === 0) return new THREE.Color(0x8a7f72);
  const hue = ((label * 47) % 360) / 360;
  return new THREE.Color().setHSL(hue, 0.55, 0.6);
}

interface ToothMesh {
  label: number;
  geometry: THREE.BufferGeometry;
  center: THREE.Vector3;
}

function buildToothMeshes(caseData: CaseData): ToothMesh[] {
  const { vertices, faces, labels } = caseData;

  // Группируем треугольники по доминирующему лейблу его вершин.
  const trianglesByLabel = new Map<number, number[]>();
  for (let i = 0; i < faces.length; i += 3) {
    const a = faces[i];
    const b = faces[i + 1];
    const c = faces[i + 2];
    const la = labels[a];
    const lb = labels[b];
    const lc = labels[c];
    // Голосование: если все три вершины разные — отдаём гингиве.
    const label = la === lb || la === lc ? la : lb === lc ? lb : 0;
    if (!trianglesByLabel.has(label)) trianglesByLabel.set(label, []);
    trianglesByLabel.get(label)!.push(a, b, c);
  }

  const result: ToothMesh[] = [];
  for (const [label, triIndices] of trianglesByLabel) {
    const geom = new THREE.BufferGeometry();
    // Перепаковка: новые компактные индексы.
    const remap = new Map<number, number>();
    const positions: number[] = [];
    const newFaces: number[] = [];
    for (const oldIdx of triIndices) {
      let newIdx = remap.get(oldIdx);
      if (newIdx === undefined) {
        newIdx = positions.length / 3;
        remap.set(oldIdx, newIdx);
        positions.push(
          vertices[oldIdx * 3],
          vertices[oldIdx * 3 + 1],
          vertices[oldIdx * 3 + 2],
        );
      }
      newFaces.push(newIdx);
    }
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geom.setIndex(newFaces);
    geom.computeVertexNormals();

    geom.computeBoundingBox();
    const center = new THREE.Vector3();
    geom.boundingBox!.getCenter(center);

    result.push({ label, geometry: geom, center });
  }
  return result;
}

export function CaseMesh({ caseData, stage }: Props) {
  const teeth = useMemo(() => buildToothMeshes(caseData), [caseData]);

  // Простая интерполяция стадий: зубы расходятся вверх по Y пропорционально
  // stage. В v1 это плейсхолдер для целевых позиций — заменим на реальную
  // интерполяцию start→target когда добавим редактирование.
  const t = stage / 20;

  return (
    <group>
      {teeth.map(({ label, geometry }) => {
        const isGum = label === 0;
        const offset: [number, number, number] = isGum
          ? [0, 0, 0]
          : [0, t * 2 * Math.sin(label), 0];
        return (
          <mesh
            key={label}
            geometry={geometry}
            position={offset}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={colorForLabel(label)}
              roughness={0.6}
              metalness={0.05}
            />
          </mesh>
        );
      })}
    </group>
  );
}
