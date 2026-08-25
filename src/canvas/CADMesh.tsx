import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { createToonGradientMap } from './materials';
import { useTheme } from '../context/ThemeContext';

const toonGradient = createToonGradientMap();

// Shared global materials to avoid 400+ material allocations on theme change
const darkBlueprintMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#233247'),
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

const lightBlueprintMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#FFFFFF'),
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

interface CADMeshProps {
  geometry?: THREE.BufferGeometry;
  color?: string | number;
  isActive?: boolean;
  outlineColor?: string;
  outlineThreshold?: number;
  children?: React.ReactNode;
  [key: string]: any;
}

export const CADMesh: React.FC<CADMeshProps> = ({
  color = '#cbd5e1',
  isActive = false,
  outlineColor,
  outlineThreshold = 22,
  children,
  ...props
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const meshRef = useRef<THREE.Mesh>(null);

  const blueprintLineColor = outlineColor || (isDark ? '#94A8C4' : '#1E293B');
  const celOutlineColor = outlineColor || (isDark ? '#0A0E14' : '#0F172A');

  // Cel shaded material for this mesh
  const celMat = useMemo(
    () =>
      new THREE.MeshToonMaterial({
        color: new THREE.Color(color),
        gradientMap: toonGradient,
      }),
    [color]
  );

  // Pick blueprint material instantly without reallocating
  const bpMat = isDark ? darkBlueprintMat : lightBlueprintMat;

  // Update line colors instantly on theme change without CPU geometry rebuild
  useEffect(() => {
    if (!meshRef.current) return;

    // Check if edge line is attached
    let edgeLine = meshRef.current.children.find((c) => c.type === 'LineSegments') as THREE.LineSegments | undefined;

    if (!edgeLine && meshRef.current.geometry) {
      try {
        const edgesGeom = new THREE.EdgesGeometry(meshRef.current.geometry, outlineThreshold);
        const lineMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(isActive ? celOutlineColor : blueprintLineColor),
          linewidth: isActive ? 1.5 : 1.35,
          transparent: true,
          opacity: isActive ? 0.75 : 0.85,
        });
        edgeLine = new THREE.LineSegments(edgesGeom, lineMat);
        meshRef.current.add(edgeLine);
      } catch {
        // Fallback for non-standard geometry
      }
    }

    if (edgeLine && edgeLine.material instanceof THREE.LineBasicMaterial) {
      edgeLine.material.color.set(isActive ? celOutlineColor : blueprintLineColor);
      edgeLine.material.opacity = isActive ? 0.75 : 0.85;
    }
  }, [isActive, isDark, celOutlineColor, blueprintLineColor, outlineThreshold]);

  return (
    <mesh
      ref={meshRef}
      {...props}
      material={isActive ? celMat : bpMat}
      castShadow
      receiveShadow
    >
      {children}
    </mesh>
  );
};
