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

export const FTCRobotModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true, isAnimating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const intakeRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const currentSpeedRef = useRef(0);

  const localTimeRef = useRef(0);

  useFrame((_state, delta) => {
    if (isAnimating) {
      localTimeRef.current += delta;
    }
    if (groupRef.current) {
      groupRef.current.scale.setScalar(1.2);
    }

    const targetSpeed = isActive && isRotating && isAnimating ? 0.7 : 0;
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      } else if (!isActive) {
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, 0, 4.0, delta);
      }
    }

    if (intakeRef.current) {
      if (isActive) {
        intakeRef.current.rotation.x += delta * 5;
      } else {
        intakeRef.current.rotation.x = 0;
      }
    }

    if (armRef.current) {
      if (isActive) {
        const t = localTimeRef.current;
        armRef.current.rotation.z = Math.sin(t * 1.5) * 0.25 - 0.2;
      } else {
        armRef.current.rotation.z = -0.2;
      }
    }
  });

  const chassisColor = '#334155'; // Dark slate chassis
  const plateColor = '#f59e0b'; // FTC gold/amber anodized aluminum
  const wheelColor = '#1e293b'; // Charcoal mecanum wheels
  const rollerColor = '#2563eb'; // Blue silicone intake compliant wheels
  const armColor = '#94a3b8'; // Aluminum lift arm

  return (
    <group ref={groupRef} position={[0, -0.2, 0]} scale={1.2}>
      {/* Chassis Frame Channel (Extruded U-Channel) */}
      <CADMesh color={plateColor} isActive={isActive} position={[0, 0.2, 0]}>
        <boxGeometry args={[1.5, 0.1, 1.2]} />
      </CADMesh>

      {/* Left & Right Side Drive Plates */}
      <CADMesh color={chassisColor} isActive={isActive} position={[-0.8, 0.25, 0]}>
        <boxGeometry args={[0.08, 0.35, 1.3]} />
      </CADMesh>
      <CADMesh color={chassisColor} isActive={isActive} position={[0.8, 0.25, 0]}>
        <boxGeometry args={[0.08, 0.35, 1.3]} />
      </CADMesh>

      {/* 4 Mecanum Drive Wheels */}
      {[-0.55, 0.55].map((z, zIdx) => (
        <React.Fragment key={zIdx}>
          <CADMesh
            color={wheelColor}
            isActive={isActive}
            position={[-0.92, 0.2, z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.26, 0.26, 0.16, 20]} />
          </CADMesh>
          <CADMesh
            color={wheelColor}
            isActive={isActive}
            position={[0.92, 0.2, z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.26, 0.26, 0.16, 20]} />
          </CADMesh>
        </React.Fragment>
      ))}

      {/* Front Compliant Intake Roller System */}
      <group ref={intakeRef} position={[0, 0.25, 0.75]}>
        <CADMesh color="#475569" isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 1.1, 12]} />
        </CADMesh>
        {[-0.35, -0.12, 0.12, 0.35].map((x, xIdx) => (
          <CADMesh
            key={xIdx}
            color={rollerColor}
            isActive={isActive}
            position={[x, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
          </CADMesh>
        ))}
      </group>

      {/* Vertical Lift Mast Stanchions */}
      <CADMesh color={chassisColor} isActive={isActive} position={[-0.45, 0.75, -0.3]}>
        <boxGeometry args={[0.08, 1.0, 0.08]} />
      </CADMesh>
      <CADMesh color={chassisColor} isActive={isActive} position={[0.45, 0.75, -0.3]}>
        <boxGeometry args={[0.08, 1.0, 0.08]} />
      </CADMesh>

      {/* Articulated Scorer Arm */}
      <group ref={armRef} position={[0, 1.1, -0.3]}>
        <CADMesh color={armColor} isActive={isActive} position={[0, 0.4, 0.35]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.55, 0.06, 0.9]} />
        </CADMesh>
        <CADMesh color={plateColor} isActive={isActive} position={[0, 0.75, 0.75]}>
          <boxGeometry args={[0.4, 0.18, 0.25]} />
        </CADMesh>
      </group>
    </group>
  );
};
