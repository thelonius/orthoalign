import { Canvas } from "@react-three/fiber";
import { OrbitControls, Bounds } from "@react-three/drei";
import { CaseMesh } from "./CaseMesh";
import type { CaseData } from "../lib/types";

interface Props {
  caseData: CaseData;
  stage: number;
}

export function Viewer({ caseData, stage }: Props) {
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
        <CaseMesh caseData={caseData} stage={stage} />
      </Bounds>
    </Canvas>
  );
}
