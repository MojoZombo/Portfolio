import React from 'react';
import { Html } from '@react-three/drei';

export const CADPivotGizmo: React.FC = () => {
  const axisLength = 1.2;
  const axisThickness = 0.015;

  return (
    <group name="CADPivotGizmo" userData={{ isHelper: true }} position={[0, 0, 0]}>
      {/* Central Pivot Point Sphere */}
      <mesh name="CADPivotGizmo_Sphere" userData={{ isHelper: true }}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ec4899" depthTest={false} transparent opacity={0.9} />
      </mesh>
      
      <Html position={[0, 0.12, 0]} center>
        <div className="px-1.5 py-0.5 rounded bg-pink-600 text-white font-mono text-[9px] font-bold shadow pointer-events-none whitespace-nowrap">
          PIVOT (0,0,0)
        </div>
      </Html>

      {/* X Axis - Red */}
      <group name="CADPivotGizmo_GroupX" userData={{ isHelper: true }} position={[axisLength / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <mesh name="CADPivotGizmo_CylinderX" userData={{ isHelper: true }}>
          <cylinderGeometry args={[axisThickness, axisThickness, axisLength, 8]} />
          <meshBasicMaterial color="#ef4444" depthTest={false} />
        </mesh>
      </group>
      <mesh name="CADPivotGizmo_ConeX" userData={{ isHelper: true }} position={[axisLength, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.04, 0.12, 12]} />
        <meshBasicMaterial color="#ef4444" depthTest={false} />
      </mesh>
      <Html position={[axisLength + 0.1, 0, 0]} center>
        <span className="text-[10px] font-mono font-bold text-red-500 bg-white/80 dark:bg-black/80 px-1 rounded">X</span>
      </Html>

      {/* Y Axis - Green (UP) */}
      <group name="CADPivotGizmo_GroupY" userData={{ isHelper: true }} position={[0, axisLength / 2, 0]}>
        <mesh name="CADPivotGizmo_CylinderY" userData={{ isHelper: true }}>
          <cylinderGeometry args={[axisThickness, axisThickness, axisLength, 8]} />
          <meshBasicMaterial color="#10b981" depthTest={false} />
        </mesh>
      </group>
      <mesh name="CADPivotGizmo_ConeY" userData={{ isHelper: true }} position={[0, axisLength, 0]}>
        <coneGeometry args={[0.04, 0.12, 12]} />
        <meshBasicMaterial color="#10b981" depthTest={false} />
      </mesh>
      <Html position={[0, axisLength + 0.1, 0]} center>
        <span className="text-[10px] font-mono font-bold text-emerald-500 bg-white/80 dark:bg-black/80 px-1 rounded">Y (UP)</span>
      </Html>

      {/* Z Axis - Blue */}
      <group name="CADPivotGizmo_GroupZ" userData={{ isHelper: true }} position={[0, 0, axisLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh name="CADPivotGizmo_CylinderZ" userData={{ isHelper: true }}>
          <cylinderGeometry args={[axisThickness, axisThickness, axisLength, 8]} />
          <meshBasicMaterial color="#3b82f6" depthTest={false} />
        </mesh>
      </group>
      <mesh name="CADPivotGizmo_ConeZ" userData={{ isHelper: true }} position={[0, 0, axisLength]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.04, 0.12, 12]} />
        <meshBasicMaterial color="#3b82f6" depthTest={false} />
      </mesh>
      <Html position={[0, 0, axisLength + 0.1]} center>
        <span className="text-[10px] font-mono font-bold text-blue-500 bg-white/80 dark:bg-black/80 px-1 rounded">Z</span>
      </Html>
    </group>
  );
};
