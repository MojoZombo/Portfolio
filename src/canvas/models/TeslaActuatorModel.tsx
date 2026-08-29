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

export const TeslaActuatorModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const stage1Ref = useRef<THREE.Group>(null);
  const stage2Ref = useRef<THREE.Group>(null);
  const screwLeftRef = useRef<THREE.Group>(null);
  const screwRightRef = useRef<THREE.Group>(null);
  const motorPulleyRef = useRef<THREE.Group>(null);
  const currentSpeedRef = useRef(0);
  const localTimeRef = useRef(0);

  useFrame((_state, delta) => { delta = Math.min(delta, 0.035);
    if (isAnimating) {
      localTimeRef.current += delta;
    }
    const time = localTimeRef.current;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(1.25);
    }

    const targetSpeed = isActive && isRotating && isAnimating ? 0.6 : 0;
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current) {
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.z = 0;
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      } else if (!isActive) {
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, 0, 4.0, delta);
      }
    }

    // Kinematic Extension and Lead Screw Rotation
    const stroke = isActive && isAnimating ? (Math.sin(time * 1.6) * 0.5 + 0.5) * 0.45 : 0;
    const screwAngle = time * 8.0;

    if (stage1Ref.current) {
      stage1Ref.current.position.y = stroke * 0.5;
    }
    if (stage2Ref.current) {
      stage2Ref.current.position.y = stroke * 1.0;
    }
    if (screwLeftRef.current && isAnimating) {
      screwLeftRef.current.rotation.y = screwAngle;
    }
    if (screwRightRef.current && isAnimating) {
      screwRightRef.current.rotation.y = screwAngle;
    }
    if (motorPulleyRef.current && isAnimating) {
      motorPulleyRef.current.rotation.y = screwAngle * 1.5;
    }
  });

  // Industrial Tesla Aerospace-grade Material Colors
  const aluminumBaseColor = '#94a3b8';   // 6061-T6 Anodized Aluminum Outer Housing
  const aluminumStage1Color = '#cbd5e1';  // Telescoping Stage 1 Tube
  const aluminumStage2Color = '#f1f5f9';  // Inner Deployable Ram
  const steelScrewColor = '#64748b';      // Precision 1018 Steel Lead Screws
  const brassNutColor = '#d97706';        // Phosphor Bronze Drive Nuts
  const delrinSliderColor = '#1e293b';    // Low-Friction Delrin Sliders
  const motorBodyColor = '#0f172a';       // High-Torque NEMA Motor Enclosure
  const pulleyColor = '#3b82f6';          // Blue Anodized Timing Pulleys
  const beltColor = '#334155';            // Reinforced Rubber Timing Belt
  const bracketColor = '#475569';         // Sheet Metal Mounting Brackets

  return (
    <group ref={groupRef} position={[0, -0.15, 0]}>
      {/* 1. Base Mounting Plate & Housing */}
      <CADMesh color={bracketColor} isActive={isActive} position={[0, -0.75, 0]}>
        <boxGeometry args={[1.1, 0.08, 0.5]} />
      </CADMesh>

      {/* Main Base Aluminum Guide Housing */}
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
        {/* Motor Drive Pulley */}
        <group ref={motorPulleyRef} position={[0, 0.29, 0]}>
          <CADMesh color={pulleyColor} isActive={isActive}>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 20]} />
          </CADMesh>
        </group>
      </group>

      {/* 3. Dual Synchronized Lead Screws & Thrust Bearing Mounts */}
      {/* Left Lead Screw */}
      <group position={[-0.22, 0.1, 0]}>
        <group ref={screwLeftRef}>
          <CADMesh color={steelScrewColor} isActive={isActive}>
            <cylinderGeometry args={[0.025, 0.025, 1.4, 16]} />
          </CADMesh>
        </group>
        {/* Bottom Pulley */}
        <CADMesh color={pulleyColor} isActive={isActive} position={[0, -0.7, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 20]} />
        </CADMesh>
        {/* Top Thrust Bearing Block */}
        <CADMesh color={bracketColor} isActive={isActive} position={[0, 0.72, 0]}>
          <boxGeometry args={[0.1, 0.06, 0.1]} />
        </CADMesh>
      </group>

      {/* Right Lead Screw */}
      <group position={[0.22, 0.1, 0]}>
        <group ref={screwRightRef}>
          <CADMesh color={steelScrewColor} isActive={isActive}>
            <cylinderGeometry args={[0.025, 0.025, 1.4, 16]} />
          </CADMesh>
        </group>
        {/* Bottom Pulley */}
        <CADMesh color={pulleyColor} isActive={isActive} position={[0, -0.7, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 20]} />
        </CADMesh>
        {/* Top Thrust Bearing Block */}
        <CADMesh color={bracketColor} isActive={isActive} position={[0, 0.72, 0]}>
          <boxGeometry args={[0.1, 0.06, 0.1]} />
        </CADMesh>
      </group>

      {/* Synchronous Timing Belt */}
      <CADMesh color={beltColor} isActive={isActive} position={[-0.1, -0.6, 0]}>
        <boxGeometry args={[0.72, 0.035, 0.22]} />
      </CADMesh>

      {/* 4. Telescoping Intermediate Stage 1 */}
      <group ref={stage1Ref} position={[0, 0, 0]}>
        <CADMesh color={aluminumStage1Color} isActive={isActive} position={[0, 0.1, 0]}>
          <boxGeometry args={[0.48, 0.8, 0.28]} />
        </CADMesh>
        {/* Delrin Low-Friction Slider Pads */}
        <CADMesh color={delrinSliderColor} isActive={isActive} position={[0.245, -0.22, 0]}>
          <boxGeometry args={[0.02, 0.18, 0.24]} />
        </CADMesh>
        <CADMesh color={delrinSliderColor} isActive={isActive} position={[-0.245, -0.22, 0]}>
          <boxGeometry args={[0.02, 0.18, 0.24]} />
        </CADMesh>
      </group>

      {/* 5. Inner Deployable Stage 2 & Payload Ram Interface */}
      <group ref={stage2Ref} position={[0, 0, 0]}>
        {/* Inner Telescoping Solid Ram */}
        <CADMesh color={aluminumStage2Color} isActive={isActive} position={[0, 0.35, 0]}>
          <boxGeometry args={[0.34, 0.75, 0.18]} />
        </CADMesh>
        {/* Bronze Drive Lead Nut Blocks */}
        <CADMesh color={brassNutColor} isActive={isActive} position={[-0.22, 0.05, 0]}>
          <boxGeometry args={[0.08, 0.12, 0.08]} />
        </CADMesh>
        <CADMesh color={brassNutColor} isActive={isActive} position={[0.22, 0.05, 0]}>
          <boxGeometry args={[0.08, 0.12, 0.08]} />
        </CADMesh>
        {/* Top Deployable Tooling Flange */}
        <CADMesh color={pulleyColor} isActive={isActive} position={[0, 0.75, 0]}>
          <boxGeometry args={[0.6, 0.08, 0.28]} />
        </CADMesh>
      </group>
    </group>
  );
};
