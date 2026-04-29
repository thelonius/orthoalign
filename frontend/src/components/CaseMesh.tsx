import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { ThreeEvent } from "@react-three/fiber";
import type { CaseData } from "../lib/types";
import { usePlan, getDisplayTransform } from "../lib/store";
import { findCollisions } from "../lib/collisions";

interface Props {
  caseData: CaseData;
  // Z-смещение, которое унаследовано от родительской группы (для парных
  // кейсов upper поднята над lower). Сохраняем в userData, чтобы Viewer
  // мог скорректировать дельту при работе TransformControls.
  zOffset?: number;
}

function colorForLabel(label: number, selected: boolean, colliding: boolean): THREE.Color {
  if (label === 0) return new THREE.Color(0x8a7f72);
  if (colliding) return new THREE.Color(0xd0524a); // приглушённый красный
  if (selected) return new THREE.Color(0x4a90e2);
  const hue = ((label * 47) % 360) / 360;
  return new THREE.Color().setHSL(hue, 0.55, 0.6);
}

interface ToothMeshData {
  label: number;
  geometry: THREE.BufferGeometry;
  center: THREE.Vector3;
}

function buildToothMeshes(caseData: CaseData): ToothMeshData[] {
  const { vertices, faces, labels } = caseData;
  const trianglesByLabel = new Map<number, number[]>();
  for (let i = 0; i < faces.length; i += 3) {
    const a = faces[i];
    const b = faces[i + 1];
    const c = faces[i + 2];
    const la = labels[a];
    const lb = labels[b];
    const lc = labels[c];
    const label = la === lb || la === lc ? la : lb === lc ? lb : 0;
    if (!trianglesByLabel.has(label)) trianglesByLabel.set(label, []);
    trianglesByLabel.get(label)!.push(a, b, c);
  }

  const result: ToothMeshData[] = [];
  for (const [label, triIndices] of trianglesByLabel) {
    const geom = new THREE.BufferGeometry();
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
    geom.computeBoundingSphere();
    const center = new THREE.Vector3();
    geom.boundingBox!.getCenter(center);
    result.push({ label, geometry: geom, center });
  }
  return result;
}

interface ToothProps {
  data: ToothMeshData;
  isSelected: boolean;
  isColliding: boolean;
  zOffset?: number;
}

function Tooth({ data, isSelected, isColliding, zOffset = 0 }: ToothProps) {
  const { label, geometry, center } = data;
  const stage = usePlan((s) => s.stage);
  const maxStage = usePlan((s) => s.maxStage);
  const target = usePlan((s) => s.targets[label]);
  const selectTooth = usePlan((s) => s.selectTooth);
  const setSelectedObj = usePlan((s) => s.setSelectedObj);
  const display = getDisplayTransform(target, stage, maxStage);
  const groupRef = useRef<THREE.Group | null>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Клик по десне снимает текущее выделение.
    // Клик по зубу выделяет + автоматом ставит stage=max через store
    // (selectTooth action), чтобы гизмо показывал редактируемое состояние.
    if (label === 0) selectTooth(null);
    else selectTooth(label);
  };

  // When selected from anywhere (click or programmatic), publish our group
  // ref to the store so TransformControls in Viewer can attach to it.
  useEffect(() => {
    if (isSelected && groupRef.current) {
      setSelectedObj(groupRef.current);
    }
  }, [isSelected, setSelectedObj]);

  const setRef = (g: THREE.Group | null) => {
    groupRef.current = g;
    if (g) {
      g.userData.pivot = [center.x, center.y, center.z];
      g.userData.label = label;
      // Z-offset унаследованный от родительской группы (для парных кейсов).
      // Используется в Viewer.onGizmoChange чтобы исключить его из дельты.
      g.userData.zOffset = zOffset;
    }
  };

  return (
    <group
      ref={setRef}
      position={[
        center.x + display.position[0],
        center.y + display.position[1],
        center.z + display.position[2],
      ]}
      quaternion={display.quaternion}
    >
      <mesh
        geometry={geometry}
        position={[-center.x, -center.y, -center.z]}
        onClick={handleClick}
      >
        <meshStandardMaterial
          color={colorForLabel(label, isSelected, isColliding)}
          roughness={0.6}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}

export function CaseMesh({ caseData, zOffset = 0 }: Props) {
  const teeth = useMemo(() => buildToothMeshes(caseData), [caseData]);
  const selectedLabel = usePlan((s) => s.selectedLabel);
  const selectTooth = usePlan((s) => s.selectTooth);
  const targets = usePlan((s) => s.targets);
  const stage = usePlan((s) => s.stage);
  const maxStage = usePlan((s) => s.maxStage);

  const colliding = useMemo(() => {
    const t = maxStage > 0 ? stage / maxStage : 0;
    return findCollisions(caseData, targets, t);
  }, [caseData, targets, stage, maxStage]);

  return (
    <group onPointerMissed={() => selectTooth(null)}>
      {teeth.map((data) => (
        <Tooth
          key={data.label}
          data={data}
          isSelected={data.label === selectedLabel}
          isColliding={colliding.has(data.label)}
          zOffset={zOffset}
        />
      ))}
    </group>
  );
}
