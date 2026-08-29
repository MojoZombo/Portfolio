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

export const InductiveRobotModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const armBaseRef = useRef<THREE.Group>(null);
  const armUpperRef = useRef<THREE.Group>(null);
  const wheelFL = useRef<THREE.Group>(null);
  const wheelFR = useRef<THREE.Group>(null);
  const wheelRL = useRef<THREE.Group>(null);
  const wheelRR = useRef<THREE.Group>(null);
  const currentSpeedRef = useRef(0);
  const localTimeRef = useRef(0);

  useFrame((_state, delta) => { delta = Math.min(delta, 0.035);
    if (isAnimating) {
      localTimeRef.current += delta;
    }
    const time = localTimeRef.current;

    if (groupRef.current) {
      groupRef.current.scale.setScalar(1.2);
    }

    const targetSpeed = isActive && isRotating && isAnimating ? 0.55 : 0;
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

    // Kinematic slow motion for charging arm & wheels
    if (armBaseRef.current && isAnimating) {
      armBaseRef.current.rotation.y = Math.sin(time * 0.8) * 0.4;
    }
    if (armUpperRef.current && isAnimating) {
      armUpperRef.current.rotation.z = Math.sin(time * 1.2) * 0.25 - 0.2;
    }

    const wheelSpin = time * 2.0;
    if (isAnimating) {
      if (wheelFL.current) wheelFL.current.rotation.x = wheelSpin;
      if (wheelFR.current) wheelFR.current.rotation.x = wheelSpin;
      if (wheelRL.current) wheelRL.current.rotation.x = wheelSpin;
      if (wheelRR.current) wheelRR.current.rotation.x = wheelSpin;
    }
  });

  // Clearpath Husky Signature Colors + Industrial EV Battery Hardware
  const huskyYellow = '#f59e0b';      // Clearpath Signature Safety Yellow
  const chassisBlack = '#1e293b';     // Powder-coated Steel Chassis
  const tireRubber = '#0f172a';       // Heavy-Duty Lugged All-Terrain Tires
  const batteryAlum = '#64748b';      // High-Capacity 48V EV Battery Pack
  const inverterSilver = '#94a3b8';   // DC Fast Charging Inverter Enclosure
  const armGunmetal = '#334155';      // Robotic Charging Arm Links
  const lidarCyan = '#0284c7';        // Autonomous Navigation LiDAR & Cameras

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      {/* 1. Clearpath Husky Base Chassis Frame */}
      <CADMesh color={chassisBlack} isActive={isActive} position={[0, -0.2, 0]}>
        <boxGeometry args={[0.9, 0.22, 1.2]} />
      </CADMesh>

      {/* Husky Yellow Accent Top Rails */}
      <CADMesh color={huskyYellow} isActive={isActive} position={[-0.42, -0.05, 0]}>
        <boxGeometry args={[0.08, 0.12, 1.25]} />
      </CADMesh>
      <CADMesh color={huskyYellow} isActive={isActive} position={[0.42, -0.05, 0]}>
        <boxGeometry args={[0.08, 0.12, 1.25]} />
      </CADMesh>

      {/* 2. Rugged 4WD All-Terrain Lugged Wheels */}
      {/* Front Left */}
      <group position={[-0.52, -0.3, 0.42]} ref={wheelFL}>
        <CADMesh color={tireRubber} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.16, 24]} />
        </CADMesh>
        <CADMesh color={huskyYellow} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.17, 16]} />
        </CADMesh>
      </group>

      {/* Front Right */}
      <group position={[0.52, -0.3, 0.42]} ref={wheelFR}>
        <CADMesh color={tireRubber} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.16, 24]} />
        </CADMesh>
        <CADMesh color={huskyYellow} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.17, 16]} />
        </CADMesh>
      </group>

      {/* Rear Left */}
      <group position={[-0.52, -0.3, -0.42]} ref={wheelRL}>
        <CADMesh color={tireRubber} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.16, 24]} />
        </CADMesh>
        <CADMesh color={huskyYellow} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.17, 16]} />
        </CADMesh>
      </group>

      {/* Rear Right */}
      <group position={[0.52, -0.3, -0.42]} ref={wheelRR}>
        <CADMesh color={tireRubber} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22, 0.22, 0.16, 24]} />
        </CADMesh>
        <CADMesh color={huskyYellow} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.11, 0.11, 0.17, 16]} />
        </CADMesh>
      </group>

      {/* 3. EV Charging Battery Payload Subframe */}
      <CADMesh color={batteryAlum} isActive={isActive} position={[0, 0.12, -0.2]}>
        <boxGeometry args={[0.7, 0.35, 0.65]} />
      </CADMesh>
      {/* Battery Tie-Down Bracket Rails */}
      <CADMesh color={chassisBlack} isActive={isActive} position={[0, 0.31, -0.2]}>
        <boxGeometry args={[0.74, 0.04, 0.68]} />
      </CADMesh>

      {/* 4. DC Fast Charging Inverter / Electronics Enclosure */}
      <CADMesh color={inverterSilver} isActive={isActive} position={[0, 0.45, -0.2]}>
        <boxGeometry args={[0.55, 0.24, 0.5]} />
      </CADMesh>

      {/* 5. Autonomous Navigation LiDAR Mast */}
      <group position={[0, 0.62, -0.4]}>
        <CADMesh color={chassisBlack} isActive={isActive} position={[0, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.15, 12]} />
        </CADMesh>
        <CADMesh color={lidarCyan} isActive={isActive} position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.08, 20]} />
        </CADMesh>
      </group>

      {/* 6. Welded Pedestal & Articulated Robotic Charging Arm */}
      <group position={[0, 0.02, 0.32]}>
        {/* Welded Heavy-Duty Steel Arm Pedestal */}
        <CADMesh color={chassisBlack} isActive={isActive} position={[0, 0.1, 0]}>
          <boxGeometry args={[0.26, 0.28, 0.26]} />
        </CADMesh>

        {/* Rotating Arm Shoulder Base */}
        <group ref={armBaseRef} position={[0, 0.26, 0]}>
          <CADMesh color={huskyYellow} isActive={isActive}>
            <cylinderGeometry args={[0.11, 0.13, 0.1, 24]} />
          </CADMesh>

          {/* Lower Arm Link */}
          <group position={[0, 0.15, 0]}>
            <CADMesh color={armGunmetal} isActive={isActive} position={[0, 0.18, 0]}>
              <boxGeometry args={[0.09, 0.38, 0.1]} />
            </CADMesh>

            {/* Elbow Joint & Upper Arm Link */}
            <group ref={armUpperRef} position={[0, 0.38, 0]}>
              <CADMesh color={huskyYellow} isActive={isActive} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.07, 0.07, 0.12, 20]} />
              </CADMesh>
              <CADMesh color={armGunmetal} isActive={isActive} position={[0, 0.18, 0.12]} rotation={[0.4, 0, 0]}>
                <boxGeometry args={[0.08, 0.36, 0.09]} />
              </CADMesh>

              {/* End-Effector Charging Coupler Connector */}
              <group position={[0, 0.34, 0.24]} rotation={[0.5, 0, 0]}>
                <CADMesh color={huskyYellow} isActive={isActive}>
                  <boxGeometry args={[0.12, 0.1, 0.14]} />
                </CADMesh>
                {/* Charging Plug Nozzle */}
                <CADMesh color={chassisBlack} isActive={isActive} position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.04, 0.05, 0.12, 16]} />
                </CADMesh>
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
};
