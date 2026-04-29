import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, TransformControls } from "@react-three/drei";
import { CaseMesh } from "./CaseMesh";
import { ArchLine } from "./ArchLine";
import type { CaseData } from "../lib/types";
import { usePlan, ToothTransform } from "../lib/store";

interface Props {
  caseData: CaseData;
  pairedCase?: CaseData | null;
  // Зазор между челюстями по Z. Для парных кейсов разносим upper над lower,
  // чтобы окклюзия читалась визуально (без точного alignment, который
  // требует отдельного pipeline).
  occlusionGap?: number;
}

export function Viewer({ caseData, pairedCase, occlusionGap = 18 }: Props) {
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

  // Какая челюсть верхняя для этой пары.
  const isPaired = !!pairedCase;
  const primaryUpper = caseData.jaw === "upper";
  const primaryZ = isPaired ? (primaryUpper ? occlusionGap : 0) : 0;
  const pairedZ = isPaired ? (primaryUpper ? 0 : occlusionGap) : 0;

  return (
    <Canvas
      camera={{ position: [0, -150, 100], fov: 45, near: 0.1, far: 2000 }}
      style={{ background: "#1a1a1f" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[80, 80, 80]} intensity={0.7} />
      <directionalLight position={[-80, -80, 80]} intensity={0.4} />
      <directionalLight position={[0, 0, -80]} intensity={0.25} />
      <OrbitControls makeDefault enableDamping target={[0, 0, 0]} />
      {/* Bounds.observe=false: фитим камеру один раз на загрузке кейса и
          не пересчитываем при движении зубов, иначе камера дёргается на
          каждом стейдже. Ключ зависит от пары — пересчитывается при смене. */}
      <Bounds key={caseData.id + (pairedCase?.id ?? "")} fit clip margin={1.4}>
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
