import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createToonGradientMap } from '../materials';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration, PartColorInfo, PartAnimationConfig } from '../../context/TransformCalibrationContext';
import { CADPivotGizmo } from '../CADPivotGizmo';

interface ModelProps {
  isActive?: boolean;
  isAnimating?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

interface MeshNodeInfo {
  mesh: THREE.Mesh;
  initialPos: THREE.Vector3;
  initialRot: THREE.Euler;
  initialQuat: THREE.Quaternion;
  centerOfMass: THREE.Vector3;
  index: number;
}

const toonGradient = createToonGradientMap();

// Optimal Calibrated Defaults for Underwater Robot
const DEFAULT_OFFSET: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.0, 0.0, 0.0];
const DEFAULT_SCALE = 5.50;

// Default Part Colors for Underwater Robot
const DEFAULT_PART_COLORS: Record<number, string> = {
  0: '#003262', // dropperBottom-1
  1: '#FDB515', // dropperPlatform-2
  2: '#64748b', // Mesh_8
  3: '#64748b', // Mesh_8_1
  4: '#64748b', // Mesh_8_2
  11: '#003262', // Mesh_46
  13: '#FDB515', // Mesh_49
  14: '#FDB515', // Mesh_49_1
  16: '#cbd5e1', // Mesh_36_1
  19: '#cbd5e1', // Mesh_36_4
  20: '#cbd5e1', // Mesh_37
  22: '#1e293b', // Mesh_37_2
  23: '#64748b', // Mesh_37_3
  24: '#64748b', // Mesh_37_4
  25: '#64748b', // Mesh_37_5
  26: '#64748b', // Mesh_37_6
  27: '#64748b', // Mesh_37_7
  28: '#003262', // Dynamic_Gripper-1
  29: '#64748b', // M200_Motor-1
  30: '#64748b', // Mesh_15
  31: '#64748b', // Mesh_15_1
  32: '#003262', // CameraMountBack_-_Radial-2
  33: '#475569', // CameraMountFront_-_Radial-1
  35: '#3f5b88', // Mesh_4
  37: '#FDB515', // VerticalDoubleThruster-2
};

// Default Kinematics Animations
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {};

// Shared global blueprint materials
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

// Master prototype cache for Underwater Robot
let masterUnderwaterRobotPrototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterUnderwaterRobotPrototype(sourceScene: THREE.Group) {
  const template = sourceScene.clone(true);
  const originalMaterials: (THREE.Material | THREE.Material[])[] = [];
  const staticEdgesList: THREE.EdgesGeometry[] = [];
  const activeEdgesList: THREE.EdgesGeometry[] = [];
  const partsInfo: PartColorInfo[] = [];

  template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      originalMaterials.push(mesh.material);

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          const stdMat = m as THREE.MeshStandardMaterial;
          const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
          partsInfo.push({
            index: partsInfo.length,
            name: m.name ? m.name.replace(/_\d+$/, '') : `ROV Component ${partsInfo.length + 1}`,
            color: defaultBakedColor,
          });
        });
      } else {
        const stdMat = mesh.material as THREE.MeshStandardMaterial;
        const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
        partsInfo.push({
          index: partsInfo.length,
          name: mesh.name || `Component ${partsInfo.length + 1}`,
          color: defaultBakedColor,
        });
      }

      try {
        const bpEdges = new THREE.EdgesGeometry(mesh.geometry, 8);
        staticEdgesList.push(bpEdges);

        const celEdges = new THREE.EdgesGeometry(mesh.geometry, 28);
        activeEdgesList.push(celEdges);
      } catch {
        // Ignore non-standard geometries
      }
    }
  });

  return {
    template,
    originalMaterials,
    staticEdgesList,
    activeEdgesList,
    partsInfo,
  };
}

export const UnderwaterRobotModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const cloneRef = useRef<THREE.Group | null>(null);
  const meshNodesRef = useRef<MeshNodeInfo[]>([]);
  const currentSpeedRef = useRef(0);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    isOpen: isCalibrating,
    activeModelId,
    setActiveModelId,
    selectedPartIndex,
    registerModel,
    settings,
  } = useTransformCalibration();

  // Load the CAD assembly from public/models/UnderwaterRobot.glb
  const { scene } = useGLTF('./models/UnderwaterRobot.glb');

  // Exact matching blueprint colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterUnderwaterRobotPrototype) {
    masterUnderwaterRobotPrototype = buildMasterUnderwaterRobotPrototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterUnderwaterRobotPrototype) {
      registerModel({
        modelId: 'underwater-robot',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterUnderwaterRobotPrototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('underwater-robot');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'underwater-robot';

  // Create permanent scene instance ONCE
  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterUnderwaterRobotPrototype!.template.clone(true);
    cloneRef.current = clone;

    const toonMap = new Map<THREE.Mesh, THREE.MeshToonMaterial | THREE.MeshToonMaterial[]>();
    const bpLines: THREE.LineSegments[] = [];
    const celLines: THREE.LineSegments[] = [];

    const bpLineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(blueprintLineColor),
      linewidth: 1,
    });

    const celLineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(celOutlineColor),
      linewidth: 1.5,
    });

    let runningPartIdx = 0;
    let meshIdx = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const currentPartStart = runningPartIdx;
        const currentMeshIdx = meshIdx;

        mesh.userData.cadPartIndex = currentPartStart;
        mesh.userData.isCadMesh = true;

        if (Array.isArray(mesh.material)) {
          const toonArr = mesh.material.map((_, subIdx) => {
            const partNum = currentPartStart + subIdx;
            const initialColor = DEFAULT_PART_COLORS[partNum] || '#cbd5e1';
            return new THREE.MeshToonMaterial({
              color: new THREE.Color(initialColor),
              gradientMap: toonGradient,
            });
          });
          toonMap.set(mesh, toonArr);
          runningPartIdx += mesh.material.length;
        } else {
          const initialColor = DEFAULT_PART_COLORS[currentPartStart] || '#cbd5e1';
          const toon = new THREE.MeshToonMaterial({
            color: new THREE.Color(initialColor),
            gradientMap: toonGradient,
          });
          toonMap.set(mesh, toon);
          runningPartIdx += 1;
        }

        if (masterUnderwaterRobotPrototype!.staticEdgesList[currentMeshIdx]) {
          const bpLine = new THREE.LineSegments(
            masterUnderwaterRobotPrototype!.staticEdgesList[currentMeshIdx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterUnderwaterRobotPrototype!.activeEdgesList[currentMeshIdx]) {
          const celLine = new THREE.LineSegments(
            masterUnderwaterRobotPrototype!.activeEdgesList[currentMeshIdx],
            celLineMat
          );
          mesh.add(celLine);
          celLines.push(celLine);
        }

        meshIdx++;
      }
    });

    // 1. Center the unrotated CAD geometry inside the pivot group
    const bbox = new THREE.Box3().setFromObject(clone);
    const center = bbox.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -center.y, -center.z);

    // 2. Set initial world rotation and offset on the pivot
    pivot.rotation.set(
      (DEFAULT_ROTATION_DEG[0] * Math.PI) / 180,
      (DEFAULT_ROTATION_DEG[1] * Math.PI) / 180,
      (DEFAULT_ROTATION_DEG[2] * Math.PI) / 180
    );
    pivot.position.set(DEFAULT_OFFSET[0], DEFAULT_OFFSET[1], DEFAULT_OFFSET[2]);

    pivot.add(clone);
    root.add(pivot);

    return {
      centeredScene: root,
      toonMaterialsMap: toonMap,
      blueprintEdgeLines: bpLines,
      celEdgeLines: celLines,
    };
  }, []);

  // Collect kinematic nodes
  useEffect(() => {
    const list: MeshNodeInfo[] = [];
    let idx = 0;
    centeredScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        const geomCom = mesh.geometry.boundingBox
          ? mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
          : new THREE.Vector3();
        const initQuat = mesh.quaternion.clone();
        const com = mesh.position.clone().add(geomCom.clone().applyQuaternion(initQuat));

        list.push({
          mesh,
          initialPos: mesh.position.clone(),
          initialRot: mesh.rotation.clone(),
          initialQuat: initQuat,
          centerOfMass: com,
          index: idx,
        });
        idx++;
      }
    });
    meshNodesRef.current = list;
  }, [centeredScene]);

  // Update materials, edges and selection highlights
  useEffect(() => {
    const isShaded = isActive || isModelCalibrating;

    blueprintEdgeLines.forEach((line) => {
      line.visible = !isShaded;
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.color.set(blueprintLineColor);
      }
    });

    celEdgeLines.forEach((line) => {
      line.visible = isShaded;
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.color.set(celOutlineColor);
      }
    });

    const bpMat = isDark ? darkBlueprintMat : lightBlueprintMat;

    let partRunningIndex = 0;
    toonMaterialsMap.forEach((toonMatOrArray, mesh) => {
      if (isShaded) {
        if (Array.isArray(toonMatOrArray)) {
          mesh.material = toonMatOrArray;
          toonMatOrArray.forEach((tm) => {
            const currentPartIdx = partRunningIndex++;
            const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
            const overrideHex = (isModelCalibrating && settings.colorOverrides?.[currentPartIdx])
              ? settings.colorOverrides[currentPartIdx]
              : (DEFAULT_PART_COLORS[currentPartIdx] || '#cbd5e1');

            tm.color.set(isPartSelected ? '#38bdf8' : overrideHex);
            tm.emissive.set(isPartSelected ? '#0284c7' : '#000000');
          });
        } else {
          const currentPartIdx = partRunningIndex++;
          const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
          const overrideHex = (isModelCalibrating && settings.colorOverrides?.[currentPartIdx])
            ? settings.colorOverrides[currentPartIdx]
            : (DEFAULT_PART_COLORS[currentPartIdx] || '#cbd5e1');

          mesh.material = toonMatOrArray;
          toonMatOrArray.color.set(isPartSelected ? '#38bdf8' : overrideHex);
          toonMatOrArray.emissive.set(isPartSelected ? '#0284c7' : '#000000');
        }
      } else {
        if (Array.isArray(toonMatOrArray)) {
          mesh.material = toonMatOrArray.map(() => bpMat);
          partRunningIndex += toonMatOrArray.length;
        } else {
          mesh.material = bpMat;
          partRunningIndex += 1;
        }
      }
    });
  }, [
    centeredScene,
    isActive,
    isModelCalibrating,
    isDark,
    selectedPartIndex,
    toonMaterialsMap,
    blueprintEdgeLines,
    celEdgeLines,
    blueprintLineColor,
    celOutlineColor,
    isModelCalibrating ? settings.colorOverrides : null,
  ]);

  // Frame loop
  const localTimeRef = useRef(0);

  useFrame((_state, delta) => { delta = Math.min(delta, 0.035);
    if (isAnimating) {
      localTimeRef.current += delta;
    }
    // Always apply transform calibration directly to pivot
    if (pivotRef.current) {
      const offsetX = isModelCalibrating ? settings.offsetX : DEFAULT_OFFSET[0];
      const offsetY = isModelCalibrating ? settings.offsetY : DEFAULT_OFFSET[1];
      const offsetZ = isModelCalibrating ? settings.offsetZ : DEFAULT_OFFSET[2];
      const rotX = isModelCalibrating ? (settings.rotX * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[0] * Math.PI) / 180;
      const rotY = isModelCalibrating ? (settings.rotY * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[1] * Math.PI) / 180;
      const rotZ = isModelCalibrating ? (settings.rotZ * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[2] * Math.PI) / 180;

      pivotRef.current.rotation.set(rotX, rotY, rotZ);
      pivotRef.current.position.set(offsetX, offsetY, offsetZ);
    }

    if (!isActive && !isModelCalibrating) {
      if (groupRef.current) {
        groupRef.current.scale.setScalar(DEFAULT_SCALE);
      }
      if (meshNodesRef.current.length > 0) {
        meshNodesRef.current.forEach((node) => {
          node.mesh.position.copy(node.initialPos);
          node.mesh.rotation.copy(node.initialRot);
        });
      }
      return;
    }

    const baseScale = isModelCalibrating ? settings.scale : DEFAULT_SCALE;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(baseScale);
    }

    // Auto rotate parent with smooth acceleration from 0 RPM
    const maxSpeed = isModelCalibrating ? settings.rotationSpeed : 0.6;
    const targetSpeed = isModelCalibrating ? (settings.autoRotate ? maxSpeed : 0) : (isActive && isRotating && isAnimating ? maxSpeed : 0);
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      } else if (!isActive && !isModelCalibrating) {
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, 0, 4.0, delta);
      }
    }

    const time = localTimeRef.current;
    if (meshNodesRef.current.length > 0) {
      meshNodesRef.current.forEach((node) => {
        const anim = isModelCalibrating ? settings.animationOverrides[node.index] : null;

        if (!anim || anim.type === 'none') {
          node.mesh.position.copy(node.initialPos);
          node.mesh.rotation.copy(node.initialRot);
          return;
        }

        const phaseRad = (anim.phase * Math.PI) / 180;
        const axisVec = new THREE.Vector3(
          anim.axis === 'x' ? 1 : 0,
          anim.axis === 'y' ? 1 : 0,
          anim.axis === 'z' ? 1 : 0
        );
        const dir = anim.direction ?? 1;
        const omega = (anim.speed * Math.PI * 2) / 60;

        const pivotMode = anim.pivotMode || 'center-of-mass';
        let pivot = node.centerOfMass.clone();

        if (pivotMode === 'origin') {
          pivot.set(0, 0, 0);
        } else if (pivotMode === 'custom') {
          pivot.add(
            new THREE.Vector3(
              (anim.pivotX || 0) / 100,
              (anim.pivotY || 0) / 100,
              (anim.pivotZ || 0) / 100
            )
          );
        }

        if (anim.type === 'continuous-spin' || anim.type === 'oscillate-rotation') {
          const angle =
            anim.type === 'continuous-spin'
              ? time * omega * dir
              : Math.sin(time * omega + phaseRad) *
                (((anim.amplitude || 30) * Math.PI) / 180) *
                dir;

          const qDelta = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
          node.mesh.quaternion.copy(qDelta).multiply(node.initialQuat);
          node.mesh.position
            .copy(pivot)
            .add(node.initialPos.clone().sub(pivot).applyQuaternion(qDelta));
        } else if (anim.type === 'linear-reciprocate') {
          node.mesh.quaternion.copy(node.initialQuat);
          const ampMeters = ((anim.amplitude || 10) / 100) * dir;
          const displacement = axisVec
            .clone()
            .multiplyScalar(Math.sin(time * omega + phaseRad) * ampMeters);
          node.mesh.position.copy(node.initialPos).add(displacement);
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {isModelCalibrating && settings.showGizmo && <CADPivotGizmo />}
      <primitive object={centeredScene} />
    </group>
  );
};

useGLTF.preload('./models/UnderwaterRobot.glb');
