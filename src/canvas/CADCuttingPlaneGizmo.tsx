import React from 'react';
import * as THREE from 'three';

interface CuttingPlaneGizmoProps {
  axis: 'x' | 'y' | 'z';
  offset: number; // in meters / world units
  size?: number;
  visible?: boolean;
}

export const CADCuttingPlaneGizmo: React.FC<CuttingPlaneGizmoProps> = ({
  axis,
  offset,
  size = 2.5,
  visible = true,
}) => {
  if (!visible) return null;

  // Rotation to align plane normal with selected axis
  let rotation: [number, number, number] = [0, 0, 0];
  let position: [number, number, number] = [0, 0, 0];

  if (axis === 'x') {
    // Plane perpendicular to X axis (facing +X)
    rotation = [0, Math.PI / 2, 0];
    position = [offset, 0, 0];
  } else if (axis === 'y') {
    // Plane perpendicular to Y axis (facing +Y)
    rotation = [-Math.PI / 2, 0, 0];
    position = [0, offset, 0];
  } else {
    // Plane perpendicular to Z axis (facing +Z)
    rotation = [0, 0, 0];
    position = [0, 0, offset];
  }

  const planeColor = axis === 'x' ? '#ef4444' : axis === 'y' ? '#22c55e' : '#3b82f6';

  return (
    <group position={position} rotation={rotation}>
      {/* Semi-transparent plane surface */}
      <mesh>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          color={planeColor}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outer border wireframe */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(size, size)]} />
        <lineBasicMaterial color={planeColor} linewidth={2} transparent opacity={0.85} />
      </lineSegments>

      {/* Grid divisions across plane */}
      <gridHelper
        args={[size, 10, planeColor, planeColor]}
        rotation={[Math.PI / 2, 0, 0]}
      />

      {/* Normal Arrow indicating positive side */}
      <arrowHelper
        args={[
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, 0),
          0.35,
          new THREE.Color(planeColor).getHex(),
          0.08,
          0.04
        ]}
      />
    </group>
  );
};
