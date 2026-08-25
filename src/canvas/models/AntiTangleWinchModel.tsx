import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CADMesh } from '../CADMesh';

interface ModelProps {
  isActive?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

export const AntiTangleWinchModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const spoolRef = useRef<THREE.Group>(null);
  const levelWindRef = useRef<THREE.Group>(null);
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
    if (spoolRef.current) {
      spoolRef.current.rotation.x += delta * 4;
    }
    if (levelWindRef.current) {
      levelWindRef.current.position.x = Math.sin(t * 2) * 0.32;
    }
  });

  const frameColor = '#1e293b'; // Structural dark frame
  const spoolColor = '#64748b'; // Steel spool drum
  const brassColor = '#d97706'; // Precision brass pawl & gear
  const motorColor = '#2563eb'; // Electric motor blue

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={1.3}>
      {/* Base mounting platform */}
      <CADMesh color={frameColor} isActive={isActive} position={[0, 0.05, 0]}>
        <boxGeometry args={[1.6, 0.08, 1.0]} />
      </CADMesh>

      {/* Left and Right Side Plates */}
      <CADMesh color={frameColor} isActive={isActive} position={[-0.55, 0.45, 0]}>
        <boxGeometry args={[0.08, 0.75, 0.65]} />
      </CADMesh>
      <CADMesh color={frameColor} isActive={isActive} position={[0.55, 0.45, 0]}>
        <boxGeometry args={[0.08, 0.75, 0.65]} />
      </CADMesh>

      {/* Rotating Main Winch Drum Spool */}
      <group ref={spoolRef} position={[0, 0.45, -0.05]}>
        <CADMesh color={spoolColor} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.9, 24]} />
        </CADMesh>
        <CADMesh color={spoolColor} isActive={isActive} position={[-0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.42, 0.42, 0.04, 24]} />
        </CADMesh>
        <CADMesh color={spoolColor} isActive={isActive} position={[0.45, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.42, 0.42, 0.04, 24]} />
        </CADMesh>
      </group>

      {/* Reciprocating Diamond Reversing Screw Shaft */}
      <CADMesh color="#e2e8f0" isActive={isActive} position={[0, 0.55, 0.22]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 1.0, 16]} />
      </CADMesh>

      {/* Synchronized Spur Drive Gears */}
      <CADMesh color={brassColor} isActive={isActive} position={[-0.58, 0.45, -0.05]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.04, 18]} />
      </CADMesh>
      <CADMesh color={brassColor} isActive={isActive} position={[-0.58, 0.55, 0.22]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.04, 14]} />
      </CADMesh>

      {/* Dynamic Reciprocating Level-Wind Pawl Carriage */}
      <group ref={levelWindRef} position={[0, 0.55, 0.22]}>
        <CADMesh color={brassColor} isActive={isActive}>
          <boxGeometry args={[0.14, 0.16, 0.16]} />
        </CADMesh>
        <CADMesh color="#f8fafc" isActive={isActive} position={[0, 0.08, 0.1]}>
          <torusGeometry args={[0.06, 0.02, 12, 20]} />
        </CADMesh>
      </group>

      {/* Drive Motor */}
      <group position={[0.75, 0.45, -0.05]} rotation={[0, 0, Math.PI / 2]}>
        <CADMesh color={motorColor} isActive={isActive}>
          <cylinderGeometry args={[0.18, 0.18, 0.35, 20]} />
        </CADMesh>
      </group>
    </group>
  );
};
