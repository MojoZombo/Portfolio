import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CADMesh } from '../CADMesh';

interface ModelProps {
  isActive?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

export const ModularGripperModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const leftJawRef = useRef<THREE.Group>(null);
  const rightJawRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(1.3);

  useFrame((state, delta) => {
    // Native Three.js GPU smooth scale transition
    const targetScale = isActive ? 1.45 : 1.3;
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, targetScale, 4.0, delta);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleRef.current);
    }

    if (!isActive) return;

    const t = state.clock.getElapsedTime();
    if (groupRef.current && isRotating) {
      groupRef.current.rotation.y += delta * 0.6;
    }
    const clampOffset = 0.08 + Math.abs(Math.sin(t * 1.5)) * 0.12;
    if (leftJawRef.current) leftJawRef.current.position.x = -clampOffset;
    if (rightJawRef.current) rightJawRef.current.position.x = clampOffset;
  });

  const bodyColor = '#1e293b'; // Anodized black CNC body
  const jawColor = '#94a3b8'; // CNC milled aluminum
  const pneumaticColor = '#3b82f6'; // Pneumatic line blue
  const bracketColor = '#ca8a04'; // Gold anodized bracket workpiece

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={1.3}>
      {/* Robot ISO Flange Mounting Hub */}
      <CADMesh color="#475569" isActive={isActive} position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.35, 0.4, 0.16, 24]} />
      </CADMesh>

      {/* Main Pneumatic Gripper Body */}
      <CADMesh color={bodyColor} isActive={isActive} position={[0, -0.2, 0]}>
        <boxGeometry args={[0.9, 0.6, 0.5]} />
      </CADMesh>

      {/* Dual Pneumatic Port Fittings */}
      <CADMesh color={pneumaticColor} isActive={isActive} position={[-0.2, -0.2, 0.28]}>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
      </CADMesh>
      <CADMesh color={pneumaticColor} isActive={isActive} position={[0.2, -0.2, 0.28]}>
        <cylinderGeometry args={[0.05, 0.05, 0.12, 12]} />
      </CADMesh>

      {/* Precision Linear Guide Rails */}
      <CADMesh color="#e2e8f0" isActive={isActive} position={[0, 0.15, 0]}>
        <boxGeometry args={[1.2, 0.08, 0.12]} />
      </CADMesh>

      {/* Moving Left Jaw Carriage */}
      <group ref={leftJawRef} position={[-0.15, 0.15, 0]}>
        <CADMesh color={bodyColor} isActive={isActive} position={[0, 0.08, 0]}>
          <boxGeometry args={[0.22, 0.2, 0.35]} />
        </CADMesh>
        <CADMesh color={jawColor} isActive={isActive} position={[0, 0.35, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.28]} />
        </CADMesh>
      </group>

      {/* Moving Right Jaw Carriage */}
      <group ref={rightJawRef} position={[0.15, 0.15, 0]}>
        <CADMesh color={bodyColor} isActive={isActive} position={[0, 0.08, 0]}>
          <boxGeometry args={[0.22, 0.2, 0.35]} />
        </CADMesh>
        <CADMesh color={jawColor} isActive={isActive} position={[0, 0.35, 0]}>
          <boxGeometry args={[0.12, 0.45, 0.28]} />
        </CADMesh>
      </group>

      {/* Clamped Structural Aluminum Bracket Workpiece */}
      <group position={[0, 0.4, 0]}>
        <CADMesh color={bracketColor} isActive={isActive} position={[0, 0, 0]}>
          <boxGeometry args={[0.24, 0.4, 0.24]} />
        </CADMesh>
      </group>
    </group>
  );
};
