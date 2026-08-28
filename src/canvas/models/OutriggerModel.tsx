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

export const OutriggerModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true, isAnimating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const pistonRef = useRef<THREE.Group>(null);
  const currentSpeedRef = useRef(0);

  const localTimeRef = useRef(0);

  useFrame((_state, delta) => {
    if (isAnimating) {
      localTimeRef.current += delta;
    }
    if (groupRef.current) {
      groupRef.current.scale.setScalar(1.25);
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

    if (pistonRef.current) {
      if (isActive) {
        const t = localTimeRef.current;
        pistonRef.current.position.y = -0.3 + Math.sin(t * 1.5) * 0.15;
      } else {
        pistonRef.current.position.y = -0.3;
      }
    }
  });

  const bodyColor = '#ca8a04'; // Industrial CAT yellow
  const ironColor = '#334155'; // Cast iron chassis
  const chromeColor = '#e2e8f0'; // Chrome plated cylinder rod
  const hydraulicColor = '#2563eb'; // Hydraulic blue fittings
  const footPadColor = '#1e293b'; // Heavy rubber/steel foot

  return (
    <group ref={groupRef} position={[0, 0.2, 0]} scale={1.25}>
      {/* Upper Mounting Yoke Bracket */}
      <CADMesh color={ironColor} isActive={isActive} position={[0, 0.8, 0]}>
        <boxGeometry args={[0.6, 0.3, 0.4]} />
      </CADMesh>
      {/* High-Strength Pivot Pin */}
      <CADMesh color={chromeColor} isActive={isActive} position={[0, 0.8, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.7, 16]} />
      </CADMesh>

      {/* Main Outer Telescoping Box Beam */}
      <CADMesh color={bodyColor} isActive={isActive} position={[0, 0.15, 0]}>
        <boxGeometry args={[0.38, 1.0, 0.38]} />
      </CADMesh>

      {/* Hydraulic Manifold & Fittings */}
      <CADMesh color={hydraulicColor} isActive={isActive} position={[0.22, 0.35, 0]}>
        <boxGeometry args={[0.08, 0.2, 0.14]} />
      </CADMesh>
      <CADMesh color={hydraulicColor} isActive={isActive} position={[0.22, -0.15, 0]}>
        <boxGeometry args={[0.08, 0.2, 0.14]} />
      </CADMesh>

      {/* Inner Telescoping Piston & Foot Pad Group */}
      <group ref={pistonRef} position={[0, -0.3, 0]}>
        <CADMesh color={chromeColor} isActive={isActive} position={[0, -0.25, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.8, 20]} />
        </CADMesh>
        <CADMesh color={ironColor} isActive={isActive} position={[0, -0.7, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
        </CADMesh>
        <CADMesh color={footPadColor} isActive={isActive} position={[0, -0.85, 0]}>
          <cylinderGeometry args={[0.55, 0.6, 0.12, 24]} />
        </CADMesh>
        <CADMesh color={bodyColor} isActive={isActive} position={[0, -0.92, 0]}>
          <cylinderGeometry args={[0.48, 0.48, 0.04, 8]} />
        </CADMesh>
      </group>
    </group>
  );
};
