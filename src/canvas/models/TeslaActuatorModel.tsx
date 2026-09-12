import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CADMesh } from '../CADMesh';

interface ModelProps {
  isActive?: boolean;
  isAnimating?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

export const TeslaActuatorModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const stage1Ref = useRef<THREE.Group>(null);
  const stage2Ref = useRef<THREE.Group>(null);
  const currentSpeedRef = useRef(0);
  const localTimeRef = useRef(0);

  useEffect(() => {
    if (!isActive || !isRotating) {
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0);
      currentSpeedRef.current = 0;
    }
    if (!isActive || !isAnimating) {
      localTimeRef.current = 0;
      if (stage1Ref.current) stage1Ref.current.position.y = 0;
      if (stage2Ref.current) stage2Ref.current.position.y = 0;
    }
  }, [isActive, isRotating, isAnimating]);

  useFrame((_state, delta) => {
    delta = Math.min(delta, 0.035);

    if (!isActive || !isRotating) {
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0);
      currentSpeedRef.current = 0;
    }
    if (!isActive || !isAnimating) {
      localTimeRef.current = 0;
      if (stage1Ref.current) stage1Ref.current.position.y = 0;
      if (stage2Ref.current) stage2Ref.current.position.y = 0;
    }

    if (!isActive) {
      if (groupRef.current) groupRef.current.scale.setScalar(1.25);
      return;
    }

    if (groupRef.current) {
      groupRef.current.scale.setScalar(1.25);
    }

    if (isAnimating) {
      localTimeRef.current += delta;
    }
    const time = localTimeRef.current;

    const targetSpeed = isRotating && isAnimating ? 0.2 : 0;
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current && isRotating) {
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.z = 0;
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      }
    }

    // Kinematic Extension (Starts smoothly from 0 at rest)
    const stroke = isAnimating ? (-Math.cos(time * 1.6) * 0.5 + 0.5) * 0.45 : 0;

    if (stage1Ref.current) {
      stage1Ref.current.position.y = stroke * 0.5;
    }
    if (stage2Ref.current) {
      stage2Ref.current.position.y = stroke * 1.0;
    }
  });

  // Industrial Tesla Aerospace-grade Material Colors
  const aluminumBaseColor = '#94a3b8';   // 6061-T6 Anodized Aluminum Outer Housing
  const aluminumStage1Color = '#cbd5e1';  // Telescoping Stage 1 Tube
  const aluminumStage2Color = '#f1f5f9';  // Inner Deployable Ram
  const motorBodyColor = '#0f172a';       // High-Torque NEMA Motor Enclosure
  const pulleyColor = '#3b82f6';          // Blue Anodized Tooling Flange
  const bracketColor = '#475569';         // Sheet Metal Mounting Brackets

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      {/* 1. Base Mounting Plate */}
      <CADMesh color={bracketColor} isActive={isActive} position={[0, -0.75, 0]}>
        <boxGeometry args={[1.0, 0.08, 0.5]} />
      </CADMesh>

      {/* Main Base Aluminum Guide Housing (Stage 0) */}
      <CADMesh color={aluminumBaseColor} isActive={isActive} position={[0, -0.25, 0]}>
        <boxGeometry args={[0.62, 0.9, 0.38]} />
      </CADMesh>

      {/* 2. Drive Motor Assembly */}
      <group position={[-0.42, -0.4, 0]}>
        {/* Motor Cylindrical Casing */}
        <CADMesh color={motorBodyColor} isActive={isActive} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.45, 24]} />
        </CADMesh>
        {/* Motor Face Mount */}
        <CADMesh color={bracketColor} isActive={isActive} position={[0, 0.24, 0]}>
          <boxGeometry args={[0.3, 0.04, 0.3]} />
        </CADMesh>
      </group>

      {/* 3. Telescoping Intermediate Stage 1 (Clean Box) */}
      <group ref={stage1Ref} position={[0, 0, 0]}>
        <CADMesh color={aluminumStage1Color} isActive={isActive} position={[0, 0.1, 0]}>
          <boxGeometry args={[0.48, 0.8, 0.28]} />
        </CADMesh>
      </group>

      {/* 4. Inner Deployable Stage 2 & Tooling Flange */}
      <group ref={stage2Ref} position={[0, 0, 0]}>
        <CADMesh color={aluminumStage2Color} isActive={isActive} position={[0, 0.35, 0]}>
          <boxGeometry args={[0.34, 0.75, 0.18]} />
        </CADMesh>
        {/* Top Deployable Tooling Flange */}
        <CADMesh color={pulleyColor} isActive={isActive} position={[0, 0.75, 0]}>
          <boxGeometry args={[0.6, 0.08, 0.28]} />
        </CADMesh>
      </group>
    </group>
  );
};
