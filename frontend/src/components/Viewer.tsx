import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds, TransformControls } from "@react-three/drei";
import { CaseMesh } from "./CaseMesh";
import type { CaseData } from "../lib/types";
import { usePlan, ToothTransform } from "../lib/store";

interface Props {
  caseData: CaseData;
}

export function Viewer({ caseData }: Props) {
  const stage = usePlan((s) => s.stage);
  const maxStage = usePlan((s) => s.maxStage);
  const selectedObj = usePlan((s) => s.selectedObj);
  const selectedLabel = usePlan((s) => s.selectedLabel);
  const setTargetTransform = usePlan((s) => s.setTargetTransform);

  const editing = stage === maxStage;

  const onGizmoChange = () => {
    if (selectedLabel == null || !selectedObj) return;
    // Group's local position already encodes (tooth-center + offset).
    // We compute offset = group.position - tooth-center via reading from
    // the pre-transform pose. Since at editing time stage==max, target
    // equals the displayed transform; so we read group's current
    // position/quaternion as-is, minus the stored tooth pivot encoded in
    // userData.
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
      <Bounds key={caseData.id} fit clip observe margin={1.4}>
        <CaseMesh caseData={caseData} />
      </Bounds>
      {selectedObj && editing && (
        <TransformControls
          object={selectedObj}
          mode="translate"
          size={0.6}
          onObjectChange={onGizmoChange}
        />
      )}
    </Canvas>
  );
}
