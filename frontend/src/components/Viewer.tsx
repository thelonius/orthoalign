import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, TransformControls } from "@react-three/drei";
import { CaseMesh } from "./CaseMesh";
import type { CaseData } from "../lib/types";
import { usePlan, ToothTransform } from "../lib/store";

interface Props {
  caseData: CaseData;
}

export function Viewer({ caseData }: Props) {
  const selectedObj = usePlan((s) => s.selectedObj);
  const selectedLabel = usePlan((s) => s.selectedLabel);
  const setTargetTransform = usePlan((s) => s.setTargetTransform);
  const gizmoMode = usePlan((s) => s.gizmoMode);

  const onGizmoChange = () => {
    if (selectedLabel == null || !selectedObj) return;
    const pivot = (selectedObj.userData?.pivot as
      | [number, number, number]
      | undefined) ?? [0, 0, 0];
    const target: ToothTransform = {
      position: [
        selectedObj.position.x - pivot[0],
        selectedObj.position.y - pivot[1],
        selectedObj.position.z - pivot[2],
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
          каждом стейдже. */}
      <Bounds key={caseData.id} fit clip margin={1.4}>
        <CaseMesh caseData={caseData} />
      </Bounds>
      {selectedObj && (
        <TransformControls
          object={selectedObj}
          mode={gizmoMode}
          size={0.7}
          onObjectChange={onGizmoChange}
        />
      )}
    </Canvas>
  );
}
