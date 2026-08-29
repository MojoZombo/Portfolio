import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CADMesh } from '../CADMesh';

interface ModelProps {
  isActive?: boolean;
  isAnimating?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

export const BottleScrubberModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true, isAnimating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const colletRef = useRef<THREE.Group>(null);
  const currentSpeedRef = useRef(0);

  const localTimeRef = useRef(0);

  useFrame((_state, delta) => { delta = Math.min(delta, 0.035);
    if (isAnimating) {
      localTimeRef.current += delta;
    }
    if (groupRef.current) {
      groupRef.current.scale.setScalar(1.3);
    }

    const targetSpeed = isActive && isRotating && isAnimating ? 0.6 : 0;
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      } else if (!isActive) {
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, 0, 4.0, delta);
      }
    }

    if (colletRef.current) {
      if (isActive) {
        const t = localTimeRef.current;
        colletRef.current.rotation.y = Math.sin(t * 1.5) * 0.3;
      } else {
        colletRef.current.rotation.y = 0;
      }
    }
  });

  const handleColor = '#0d9488'; // Clean teal ergonomic handle
  const collarColor = '#f1f5f9'; // Matte white locking collar
  const spongeColor = '#f59e0b'; // Kitchen sponge yellow
  const scrubLayerColor = '#047857'; // Green abrasive scrubber layer
  const gripAccentColor = '#334155'; // Dark grey overmold grip

  return (
    <group ref={groupRef} position={[0, -0.1, 0]} scale={1.3} rotation={[0, 0, -0.3]}>
      {/* Ergonomic Handle Stem */}
      <CADMesh color={handleColor} isActive={isActive} position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.16, 1.2, 24]} />
      </CADMesh>

      {/* Textured Rubber Ergonomic Grip Overmold Bands */}
      <CADMesh color={gripAccentColor} isActive={isActive} position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.12, 24]} />
      </CADMesh>
      <CADMesh color={gripAccentColor} isActive={isActive} position={[0, -0.65, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.12, 24]} />
      </CADMesh>

      {/* Hanging Loop */}
      <CADMesh color={handleColor} isActive={isActive} position={[0, -1.15, 0]}>
        <torusGeometry args={[0.1, 0.04, 12, 20]} />
      </CADMesh>

      {/* Quarter-Turn Threaded Locking Collet Collar */}
      <group ref={colletRef} position={[0, 0.18, 0]}>
        <CADMesh color={collarColor} isActive={isActive}>
          <cylinderGeometry args={[0.22, 0.2, 0.22, 24]} />
        </CADMesh>
        <CADMesh color="#cbd5e1" isActive={isActive} position={[0.21, 0, 0]}>
          <boxGeometry args={[0.04, 0.18, 0.04]} />
        </CADMesh>
        <CADMesh color="#cbd5e1" isActive={isActive} position={[-0.21, 0, 0]}>
          <boxGeometry args={[0.04, 0.18, 0.04]} />
        </CADMesh>
      </group>

      {/* Sponge Clamp Head Jaws */}
      <group position={[0, 0.65, 0]}>
        <CADMesh color={handleColor} isActive={isActive} position={[-0.2, 0, 0]}>
          <boxGeometry args={[0.06, 0.7, 0.15]} />
        </CADMesh>
        <CADMesh color={handleColor} isActive={isActive} position={[0.2, 0, 0]}>
          <boxGeometry args={[0.06, 0.7, 0.15]} />
        </CADMesh>

        {/* Sponge Block */}
        <CADMesh color={spongeColor} isActive={isActive} position={[0, 0.05, 0]}>
          <boxGeometry args={[0.34, 0.65, 0.38]} />
        </CADMesh>
        <CADMesh color={scrubLayerColor} isActive={isActive} position={[0, 0.05, 0.2]}>
          <boxGeometry args={[0.34, 0.65, 0.04]} />
        </CADMesh>
      </group>
    </group>
  );
};
