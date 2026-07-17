import { Suspense, useLayoutEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

// The avatar is normalized to this height (feet at y=0, head/hat top at
// y≈TARGET_HEIGHT) regardless of the source model's original scale.
const TARGET_HEIGHT = 1.8;

// Camera framing for a head-and-shoulders portrait crop, with headroom
// above the head so hats/hair aren't clipped by the frame edge.
const CAMERA_TARGET = [0, TARGET_HEIGHT * 0.86, 0];
const CAMERA_POSITION = [0, TARGET_HEIGHT * 0.88, 1.25];
const CAMERA_FOV = 34;

function findBone(scene, suffix) {
  let found = null;
  scene.traverse((obj) => {
    if (obj.isBone && obj.name.toLowerCase().endsWith(suffix.toLowerCase())) {
      found = obj;
    }
  });
  return found;
}

// Rotates `bone` (in its own local space) so that the direction from
// `bone` to `childBone`, measured in WORLD space, ends up pointing along
// `targetWorldDir`. This is rig-agnostic — it doesn't assume which local
// axis (X/Y/Z) the rig treats as "swing" or "twist", so it works the same
// whether the model came from Mixamo, Avaturn, ReadyPlayerMe, etc.
// (The old approach rotated a guessed local axis by a guessed number of
// degrees, which only happens to work if that axis convention matches —
// that's why 70° and 92° both produced the wrong pose on this rig.)
function alignBoneToWorldDirection(bone, childBone, targetWorldDir) {
  if (!bone || !childBone) return;

  bone.updateMatrixWorld(true);

  const bonePos = new THREE.Vector3();
  const childPos = new THREE.Vector3();
  bone.getWorldPosition(bonePos);
  childBone.getWorldPosition(childPos);

  const currentDir = childPos.clone().sub(bonePos).normalize();
  const target = targetWorldDir.clone().normalize();

  // World-space rotation that takes currentDir -> target
  const deltaQuat = new THREE.Quaternion().setFromUnitVectors(currentDir, target);

  const worldQuat = new THREE.Quaternion();
  bone.getWorldQuaternion(worldQuat);
  const newWorldQuat = deltaQuat.multiply(worldQuat);

  const parentWorldQuat = new THREE.Quaternion();
  bone.parent.getWorldQuaternion(parentWorldQuat);

  // Convert the desired world rotation back into bone's local space
  bone.quaternion.copy(parentWorldQuat.invert().multiply(newWorldQuat));
  bone.updateMatrixWorld(true);
}

// sideSign: +1 for the left arm, -1 for the right arm — just controls a
// tiny outward lean so hands clear the hips instead of clipping the torso.
function relaxOneArm(upperArm, foreArm, sideSign) {
  if (!upperArm || !foreArm) return;

  // Shoulder -> elbow: point almost straight down.
  alignBoneToWorldDirection(
    upperArm,
    foreArm,
    new THREE.Vector3(sideSign * 0.12, -1, 0)
  );

  // Elbow -> wrist: also straight down, arm fully extended/relaxed
  // (not bent forward like a zombie pose).
  const hand = foreArm.children.find((c) => c.isBone);
  if (hand) {
    alignBoneToWorldDirection(
      foreArm,
      hand,
      new THREE.Vector3(sideSign * 0.03, -1, 0.02)
    );
  }
}

function relaxArmPose(scene) {
  const leftArm = findBone(scene, "LeftArm");
  const rightArm = findBone(scene, "RightArm");
  const leftForeArm = findBone(scene, "LeftForeArm");
  const rightForeArm = findBone(scene, "RightForeArm");

  if (!leftArm || !rightArm || !leftForeArm || !rightForeArm) {
    console.warn(
      "Avatar3D: couldn't find arm/forearm bones to fix T-pose. " +
      "Open console → scene.traverse to inspect bone names and adjust findBone() suffixes."
    );
    return;
  }

  relaxOneArm(leftArm, leftForeArm, 1);
  relaxOneArm(rightArm, rightForeArm, -1);
}

function Model({ url, facingOffset }) {
  const { scene } = useGLTF(url);

  useLayoutEffect(() => {
    scene.rotation.y = facingOffset;
    relaxArmPose(scene);

    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    scene.position.x -= center.x;
    scene.position.z -= center.z;
    scene.position.y -= box.min.y;

    const scale = TARGET_HEIGHT / size.y;
    scene.scale.setScalar(scale);
  }, [scene, facingOffset]);

  return <primitive object={scene} />;
}

function Avatar3D({ avatarUrl, facingOffset = 0 }) {
  if (!avatarUrl) {
    return (
      <div className="avatar-placeholder">
        <span>🧑‍⚕️</span>
        <p>No avatar selected</p>
      </div>
    );
  }

  return (
    <Canvas camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}>
      <ambientLight intensity={1} />
      <directionalLight position={[2, 3, 2]} intensity={1.2} />
      <Suspense fallback={null}>
        <Model url={avatarUrl} facingOffset={facingOffset} />
        <Environment preset="city" background={false} />
      </Suspense>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        target={CAMERA_TARGET}
        minPolarAngle={Math.PI / 2.4}
        maxPolarAngle={Math.PI / 2.15}
      />
    </Canvas>
  );
}

export default Avatar3D;