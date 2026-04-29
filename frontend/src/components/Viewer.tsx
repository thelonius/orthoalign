import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, OrbitControls, TransformControls } from "@react-three/drei";
import { CaseMesh } from "./CaseMesh";
import { ArchLine } from "./ArchLine";
import type { CaseData } from "../lib/types";
import { usePlan, ToothTransform } from "../lib/store";

interface Props {
  caseData: CaseData;
  pairedCase?: CaseData | null;
  // Зазор между челюстями после совмещения окклюзальных плоскостей, мм.
  // 0.5 мм — реалистичный физиологический зазор между зубами в покое.
  occlusionGap?: number;
}

/**
 * Возвращает Z-координату окклюзальной плоскости челюсти.
 *
 * После PCA-выравнивания в prepare_cases.py:
 *   — у нижней челюсти коронки в +Z, occlusal plane = max Z вершин зубов
 *   — у верхней челюсти коронки в -Z, occlusal plane = min Z вершин зубов
 *
 * Берём 95-й перцентиль вместо абсолютного max/min — отсекаем выбросы
 * на отдельных вершинах, которые могут быть выше остальной поверхности.
 */
function computeOcclusalZ(caseData: CaseData): number {
  const verts = caseData.vertices;
  const labels = caseData.labels;
  const isLower = caseData.jaw === "lower";
  const zs: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 0) continue;
    zs.push(verts[i * 3 + 2]);
  }
  if (zs.length === 0) return 0;
  zs.sort((a, b) => a - b);
  const idx = Math.floor((isLower ? 0.95 : 0.05) * (zs.length - 1));
  return zs[idx];
}

export function Viewer({ caseData, pairedCase, occlusionGap = 0.5 }: Props) {
  const selectedObj = usePlan((s) => s.selectedObj);
  const selectedLabel = usePlan((s) => s.selectedLabel);
  const setTargetTransform = usePlan((s) => s.setTargetTransform);
  const gizmoMode = usePlan((s) => s.gizmoMode);

  const onGizmoChange = () => {
    if (selectedLabel == null || !selectedObj) return;
    const pivot = (selectedObj.userData?.pivot as
      | [number, number, number]
      | undefined) ?? [0, 0, 0];
    // ВАЖНО: position зуба = position group в мировых координатах. Если зуб
    // принадлежит парной челюсти, у его группы есть родительский offset по Z
    // (через <group position={[0,0,occlusionGap]}>). Берём world-position
    // вместо локального, чтобы дельта считалась корректно.
    const worldPos = selectedObj.getWorldPosition(
      new (selectedObj.position.constructor as any)(),
    );
    const target: ToothTransform = {
      position: [
        worldPos.x - pivot[0],
        worldPos.y - pivot[1],
        // Для верхней челюсти Z-offset из родителя должен исключаться из дельты —
        // храним «чистое» смещение от исходной позиции коронки.
        worldPos.z - pivot[2] - (selectedObj.userData?.zOffset ?? 0),
      ],
      quaternion: [
        selectedObj.quaternion.x,
        selectedObj.quaternion.y,
        selectedObj.quaternion.z,
        selectedObj.quaternion.w,
      ],
    };
    setTargetTransform(selectedLabel, target);
  };

  // Совмещаем окклюзальные плоскости двух челюстей. Без этого upper и lower
  // живут в собственных локальных системах после PCA-выравнивания, и зубы
  // верхней могут проваливаться в нижнюю или висеть в воздухе.
  //
  // Для пары: одну челюсть оставляем в её координатах (z_offset=0), вторую
  // сдвигаем так, чтобы её occlusal plane легла на occlusal plane первой
  // плюс физиологический зазор. Сдвигаем только нижнюю — для верхней
  // anchor — её occlusal min, для нижней — occlusal max.
  const offsets = useMemo(() => {
    if (!pairedCase) return { primary: 0, paired: 0 };
    const primaryIsUpper = caseData.jaw === "upper";
    const upperCase = primaryIsUpper ? caseData : pairedCase;
    const lowerCase = primaryIsUpper ? pairedCase : caseData;
    const upperOccZ = computeOcclusalZ(upperCase); // нижний край верхних коронок
    const lowerOccZ = computeOcclusalZ(lowerCase); // верхний край нижних коронок
    // Цель: lowerOccZ + offset_lower == upperOccZ + offset_upper - gap
    // Зафиксируем upper в его координатах, сдвинем lower так, чтобы её max Z
    // оказался ровно gap'ом ниже min Z верхней.
    const offsetForLower = upperOccZ - lowerOccZ - occlusionGap;
    return primaryIsUpper
      ? { primary: 0, paired: offsetForLower }
      : { primary: offsetForLower, paired: 0 };
  }, [caseData, pairedCase, occlusionGap]);

  const primaryZ = offsets.primary;
  const pairedZ = offsets.paired;

  return (
    <Canvas
      camera={{ position: [0, -150, 100], fov: 45, near: 0.1, far: 2000 }}
      style={{ background: "#1a1a1f" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[80, 80, 80]} intensity={0.7} />
      <directionalLight position={[-80, -80, 80]} intensity={0.4} />
      <directionalLight position={[0, 0, -80]} intensity={0.25} />
      <OrbitControls makeDefault enableDamping />
      {/* drei.Bounds: fit-камера к содержимому, БЕЗ clip — clip ломает
          r3f mount на пустой первой отрисовке (ошибка в CameraFit показала,
          что проблема в timing'е инициализации controls). Ключ зависит от
          пары — пересчитывается при смене кейса. */}
      <Bounds key={caseData.id + (pairedCase?.id ?? "")} fit margin={1.4}>
        <group position={[0, 0, primaryZ]}>
          <CaseMesh caseData={caseData} zOffset={primaryZ} />
          <ArchLine caseData={caseData} />
        </group>
        {pairedCase && (
          <group position={[0, 0, pairedZ]}>
            <CaseMesh caseData={pairedCase} zOffset={pairedZ} />
            <ArchLine caseData={pairedCase} />
          </group>
        )}
      </Bounds>
      {selectedObj && (
        <TransformControls
          object={selectedObj}
          mode={gizmoMode}
          size={gizmoMode === "rotate" ? 1.6 : 1.0}
          space="local"
          onObjectChange={onGizmoChange}
        />
      )}
    </Canvas>
  );
}
