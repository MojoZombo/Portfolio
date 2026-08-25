import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CADMesh } from '../CADMesh';

interface ModelProps {
  isActive?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

export const UnderwaterRobotModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const thrusterRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(1.2);

  useFrame((state, delta) => {
    // Native Three.js GPU smooth scale transition
    const targetScale = isActive ? 1.35 : 1.2;
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, targetScale, 4.0, delta);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleRef.current);
    }

    if (!isActive) return;

    const t = state.clock.getElapsedTime();
    if (groupRef.current) {
      if (isRotating) {
        groupRef.current.rotation.y += delta * 0.6;
      }
      groupRef.current.position.y = Math.sin(t * 1.4) * 0.06;
      groupRef.current.rotation.x = Math.sin(t * 1.1) * 0.04;
    }
  });

  const hullColor = '#0284c7'; // Submarine Blue
  const endcapColor = '#1e293b'; // Anodized endcap
  const thrusterColor = '#334155'; // Thruster shroud
  const accentColor = '#eab308'; // High-visibility yellow

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={1.2}>
      {/* Main Cylindrical Pressure Hull */}
      <CADMesh color={hullColor} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.36, 0.36, 1.4, 24]} />
      </CADMesh>

      {/* Front Optical Dome Hemisphere */}
      <CADMesh color="#67e8f9" isActive={isActive} position={[0.7, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <sphereGeometry args={[0.36, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </CADMesh>

      {/* Rear Waterproof Endcap */}
      <CADMesh color={endcapColor} isActive={isActive} position={[-0.72, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.38, 0.38, 0.1, 24]} />
      </CADMesh>

      {/* 4 Ducted Propulsion Thrusters */}
      <group ref={thrusterRef}>
        <CADMesh color={thrusterColor} isActive={isActive} position={[0, 0.45, 0.35]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.3, 16, 1, true]} />
        </CADMesh>
        <CADMesh color={thrusterColor} isActive={isActive} position={[0, 0.45, -0.35]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.3, 16, 1, true]} />
        </CADMesh>
        <CADMesh color={thrusterColor} isActive={isActive} position={[0, -0.45, 0.35]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.3, 16, 1, true]} />
        </CADMesh>
        <CADMesh color={thrusterColor} isActive={isActive} position={[0, -0.45, -0.35]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.12, 0.12, 0.3, 16, 1, true]} />
        </CADMesh>
      </group>

      {/* Dual Pneumatic Torpedo Launch Tubes */}
      <CADMesh color={accentColor} isActive={isActive} position={[0.2, 0.28, 0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.8, 16]} />
      </CADMesh>
      <CADMesh color={accentColor} isActive={isActive} position={[0.2, 0.28, -0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 0.8, 16]} />
      </CADMesh>

      {/* Front Manipulator Claw */}
      <group position={[0.9, -0.2, 0]}>
        <CADMesh color="#475569" isActive={isActive}>
          <cylinderGeometry args={[0.05, 0.05, 0.25, 12]} />
        </CADMesh>
        <CADMesh color={accentColor} isActive={isActive} position={[0.12, 0.08, 0]}>
          <boxGeometry args={[0.18, 0.04, 0.08]} />
        </CADMesh>
        <CADMesh color={accentColor} isActive={isActive} position={[0.12, -0.08, 0]}>
          <boxGeometry args={[0.18, 0.04, 0.08]} />
        </CADMesh>
      </group>
    </group>
  );
};
