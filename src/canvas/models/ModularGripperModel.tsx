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
  isHovered?: boolean;
  isRotating?: boolean;
}

interface MeshNodeInfo {
  mesh: THREE.Mesh;
  initialPos: THREE.Vector3;
  initialRot: THREE.Euler;
  centerOfMass: THREE.Vector3;
  index: number;
}

const toonGradient = createToonGradientMap();

// Optimal Calibrated Defaults for Modular Gripper
const DEFAULT_OFFSET: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [-90, 0, 0];
const DEFAULT_SCALE = 6.50;

// Default Part Colors for Modular Gripper
const DEFAULT_PART_COLORS: Record<number, string> = {};

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

// Master prototype cache for Modular Gripper
let masterModularGripperPrototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterModularGripperPrototype(sourceScene: THREE.Group) {
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
            name: m.name ? m.name.replace(/_\d+$/, '') : `Gripper Component ${partsInfo.length + 1}`,
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

export const ModularGripperModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const cloneRef = useRef<THREE.Group | null>(null);
  const centerRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const scaleRef = useRef(DEFAULT_SCALE);
  const meshNodesRef = useRef<MeshNodeInfo[]>([]);

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

  // Load the CAD assembly from public/models/RaiseGripper.glb
  const { scene } = useGLTF('./models/RaiseGripper.glb');

  // Exact matching blueprint colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterModularGripperPrototype) {
    masterModularGripperPrototype = buildMasterModularGripperPrototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterModularGripperPrototype) {
      registerModel({
        modelId: 'modular-gripper',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterModularGripperPrototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('modular-gripper');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'modular-gripper';

  // Create permanent scene instance ONCE
  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const clone = masterModularGripperPrototype!.template.clone(true);
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

    let meshIndex = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const currentIdx = meshIndex;

        if (Array.isArray(mesh.material)) {
          const toonArr = mesh.material.map((_, subIdx) => {
            const initialColor = DEFAULT_PART_COLORS[currentIdx + subIdx] || '#cbd5e1';
            return new THREE.MeshToonMaterial({
              color: new THREE.Color(initialColor),
              gradientMap: toonGradient,
            });
          });
          toonMap.set(mesh, toonArr);
        } else {
          const initialColor = DEFAULT_PART_COLORS[currentIdx] || '#cbd5e1';
          const toon = new THREE.MeshToonMaterial({
            color: new THREE.Color(initialColor),
            gradientMap: toonGradient,
          });
          toonMap.set(mesh, toon);
        }

        if (masterModularGripperPrototype!.staticEdgesList[currentIdx]) {
          const bpLine = new THREE.LineSegments(
            masterModularGripperPrototype!.staticEdgesList[currentIdx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterModularGripperPrototype!.activeEdgesList[currentIdx]) {
          const celLine = new THREE.LineSegments(
            masterModularGripperPrototype!.activeEdgesList[currentIdx],
            celLineMat
          );
          mesh.add(celLine);
          celLines.push(celLine);
        }

        meshIndex++;
      }
    });

    // Auto-center around bounding box volume center
    const bbox = new THREE.Box3().setFromObject(clone);
    const center = bbox.getCenter(new THREE.Vector3());
    centerRef.current.copy(center);
    clone.position.sub(center);

    root.add(clone);

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
        const com = mesh.geometry.boundingBox
          ? mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
          : new THREE.Vector3();

        list.push({
          mesh,
          initialPos: mesh.position.clone(),
          initialRot: mesh.rotation.clone(),
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
            const overrideHex = isModelCalibrating
              ? (settings.colorOverrides[currentPartIdx] || DEFAULT_PART_COLORS[currentPartIdx])
              : DEFAULT_PART_COLORS[currentPartIdx];

            if (overrideHex) {
              tm.color.set(isPartSelected ? '#38bdf8' : overrideHex);
            }
            tm.emissive.set(isPartSelected ? '#0284c7' : '#000000');
          });
        } else {
          const currentPartIdx = partRunningIndex++;
          const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
          const overrideHex = isModelCalibrating
            ? (settings.colorOverrides[currentPartIdx] || DEFAULT_PART_COLORS[currentPartIdx])
            : DEFAULT_PART_COLORS[currentPartIdx];

          mesh.material = toonMatOrArray;
          if (overrideHex) {
            toonMatOrArray.color.set(isPartSelected ? '#38bdf8' : overrideHex);
          }
          toonMatOrArray.emissive.set(isPartSelected ? '#0284c7' : '#000000');
        }
      } else {
        if (Array.isArray(toonMatOrArray)) {
          mesh.material = toonMatOrArray.map(() => bpMat);
        } else {
          mesh.material = bpMat;
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

  useFrame((state, delta) => {
    if (isModelCalibrating && cloneRef.current) {
      cloneRef.current.rotation.set(
        (settings.rotX * Math.PI) / 180,
        (settings.rotY * Math.PI) / 180,
        (settings.rotZ * Math.PI) / 180
      );
      cloneRef.current.position
        .copy(new THREE.Vector3(settings.offsetX, settings.offsetY, settings.offsetZ))
        .sub(centerRef.current);
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
    const targetScale = isActive ? baseScale * 1.15 : baseScale;
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, targetScale, 4.0, delta);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleRef.current);
    }

    const shouldRotate = isModelCalibrating ? settings.autoRotate : (isActive && isRotating);
    const speed = isModelCalibrating ? settings.rotationSpeed : 0.6;

    if (shouldRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * speed;
    }

    const time = state.clock.getElapsedTime();
    if (meshNodesRef.current.length > 0) {
      meshNodesRef.current.forEach((node) => {
        const anim = isModelCalibrating ? settings.animationOverrides[node.index] : null;

        if (!anim || anim.type === 'none') {
          node.mesh.position.copy(node.initialPos);
          node.mesh.rotation.copy(node.initialRot);
          return;
        }

        const phaseRad = (anim.phase * Math.PI) / 180;
        const axis = anim.axis;
        const dir = anim.direction ?? 1;
        const omega = (anim.speed * Math.PI * 2) / 60;

        const pivotMode = anim.pivotMode || 'center-of-mass';
        let pivot = node.centerOfMass.clone();

        if (pivotMode === 'origin') {
          pivot.set(0, 0, 0);
        } else if (pivotMode === 'custom') {
          pivot.add(new THREE.Vector3((anim.pivotX || 0) / 100, (anim.pivotY || 0) / 100, (anim.pivotZ || 0) / 100));
        }

        if (anim.type === 'continuous-spin' || anim.type === 'oscillate-rotation') {
          const targetEuler = node.initialRot.clone();

          if (anim.type === 'continuous-spin') {
            targetEuler[axis] = node.initialRot[axis] + (time * omega * dir);
          } else {
            const ampRad = (anim.amplitude * Math.PI) / 180;
            targetEuler[axis] = node.initialRot[axis] + Math.sin(time * omega + phaseRad) * ampRad * dir;
          }

          const pivotVector = pivot.clone();
          const rotatedPivot = pivot.clone().applyEuler(targetEuler);

          node.mesh.rotation.copy(targetEuler);
          node.mesh.position.copy(node.initialPos).add(pivotVector).sub(rotatedPivot);
        } else if (anim.type === 'linear-reciprocate') {
          node.mesh.rotation.copy(node.initialRot);
          const ampMeters = (anim.amplitude / 100) * dir;
          node.mesh.position.copy(node.initialPos);
          node.mesh.position[axis] = node.initialPos[axis] + Math.sin(time * omega + phaseRad) * ampMeters;
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

useGLTF.preload('./models/RaiseGripper.glb');
