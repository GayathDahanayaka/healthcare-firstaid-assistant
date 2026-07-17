import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment } from "@react-three/drei";

function Model({ url }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} scale={1.5} position={[0, -1.6, 0]} />;
}

function Avatar3D({ avatarUrl }) {
  return (
    <Canvas camera={{ position: [0, 0.2, 2.2], fov: 30 }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 2, 2]} intensity={1} />
      <Model url={avatarUrl} />
      <Environment preset="city" />
      <OrbitControls enableZoom={false} minPolarAngle={Math.PI / 2.5} maxPolarAngle={Math.PI / 2.2} />
    </Canvas>
  );
}

export default Avatar3D;