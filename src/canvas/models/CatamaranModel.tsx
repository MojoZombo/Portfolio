import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CADMesh } from '../CADMesh';

interface ModelProps {
  isActive?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

export const CatamaranModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const wingRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(1.1);

  useFrame((state, delta) => {
    // Native Three.js GPU smooth scale transition
    const targetScale = isActive ? 1.25 : 1.1;
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
      groupRef.current.position.y = Math.sin(t * 1.5) * 0.05 - 0.2;
      groupRef.current.rotation.z = Math.sin(t * 1.2) * 0.03;
    }
    if (wingRef.current) {
      wingRef.current.rotation.y = Math.sin(t * 0.8) * 0.25;
    }
  });

  const hullColor = '#2563eb'; // Ocean blue hull
  const deckColor = '#f8fafc'; // White composite
  const wingColor = '#f1f5f9'; // Rigid wingsail white
  const solarColor = '#0f172a'; // Solar array dark navy
  const accentColor = '#dc2626'; // High-vis red

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={1.1}>
      {/* Port Hull Pontoon (Left) */}
      <group position={[-0.7, 0, 0]}>
        <CADMesh color={hullColor} isActive={isActive} position={[0, 0, 0]}>
          <capsuleGeometry args={[0.16, 1.8, 8, 16]} />
        </CADMesh>
        <CADMesh color={hullColor} isActive={isActive} position={[0, 0, 1.0]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 0.5, 16]} />
        </CADMesh>
        <CADMesh color="#1e293b" isActive={isActive} position={[0, -0.3, 0]}>
          <boxGeometry args={[0.04, 0.4, 0.4]} />
        </CADMesh>
      </group>

      {/* Starboard Hull Pontoon (Right) */}
      <group position={[0.7, 0, 0]}>
        <CADMesh color={hullColor} isActive={isActive} position={[0, 0, 0]}>
          <capsuleGeometry args={[0.16, 1.8, 8, 16]} />
        </CADMesh>
        <CADMesh color={hullColor} isActive={isActive} position={[0, 0, 1.0]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.16, 0.5, 16]} />
        </CADMesh>
        <CADMesh color="#1e293b" isActive={isActive} position={[0, -0.3, 0]}>
          <boxGeometry args={[0.04, 0.4, 0.4]} />
        </CADMesh>
      </group>

      {/* Structural Crossbeams */}
      <CADMesh color={deckColor} isActive={isActive} position={[0, 0.16, 0.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.5, 16]} />
      </CADMesh>
      <CADMesh color={deckColor} isActive={isActive} position={[0, 0.16, -0.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 1.5, 16]} />
      </CADMesh>

      {/* Central Electronics / Solar Deck */}
      <CADMesh color={deckColor} isActive={isActive} position={[0, 0.22, 0]}>
        <boxGeometry args={[1.1, 0.08, 1.2]} />
      </CADMesh>
      <CADMesh color={solarColor} isActive={isActive} position={[0, 0.27, 0]}>
        <boxGeometry args={[0.95, 0.02, 1.05]} />
      </CADMesh>

      {/* Rigid Wingsail Assembly */}
      <group ref={wingRef} position={[0, 0.28, 0.1]}>
        <CADMesh color="#475569" isActive={isActive} position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.06, 0.08, 0.2, 16]} />
        </CADMesh>
        <CADMesh color={wingColor} isActive={isActive} position={[0, 1.0, 0]}>
          <boxGeometry args={[0.08, 1.7, 0.6]} />
        </CADMesh>
        <CADMesh color={accentColor} isActive={isActive} position={[0, 1.0, 0.3]}>
          <cylinderGeometry args={[0.04, 0.04, 1.7, 12]} />
        </CADMesh>
        <CADMesh color="#334155" isActive={isActive} position={[0, 1.3, -0.55]}>
          <boxGeometry args={[0.03, 0.03, 0.6]} />
        </CADMesh>
        <CADMesh color={accentColor} isActive={isActive} position={[0, 1.3, -0.85]}>
          <boxGeometry args={[0.02, 0.4, 0.25]} />
        </CADMesh>
      </group>
    </group>
  );
};
