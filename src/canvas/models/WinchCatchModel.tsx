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

// Optimal Calibrated Defaults for Drone-Catch Winch
const DEFAULT_OFFSET: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_SCALE = 7.00;

// Baked Custom Part Color Overrides for Winch
const DEFAULT_PART_COLORS: Record<number, string> = {
  0: '#a5a8ac',
  1: '#8cacf3',
  2: '#059669',
  6: '#0c053d',
  9: '#3e4041',
  12: '#3e4041',
  15: '#cbd5e1',
  16: '#999456',
  19: '#1e293b',
  20: '#1e293b',
  22: '#94cbff',
  23: '#6f7576',
  27: '#383838',
  29: '#cbd5e1',
  30: '#94cbff',
};

// Baked Custom Part Kinematics Animations (Speeds in RPM)
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {
  1: {
    type: 'continuous-spin',
    axis: 'x',
    direction: 1,
    speed: 40.6,
    amplitude: 35,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
  },
  16: {
    type: 'continuous-spin',
    axis: 'x',
    direction: -1,
    speed: 60,
    amplitude: 35,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
  },
  22: {
    type: 'continuous-spin',
    axis: 'x',
    direction: -1,
    speed: 120,
    amplitude: 35,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
  },
  30: {
    type: 'continuous-spin',
    axis: 'x',
    direction: -1,
    speed: 120,
    amplitude: 35,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
  },
};

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

// Master prototype cache for Winch
let masterWinchPrototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterWinchPrototype(sourceScene: THREE.Group) {
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
          const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#d6d1c8');
          partsInfo.push({
            index: partsInfo.length,
            name: m.name ? m.name.replace(/_\d+$/, '') : `Winch Sub-assembly ${partsInfo.length + 1}`,
            color: defaultBakedColor,
          });
        });
      } else {
        const stdMat = mesh.material as THREE.MeshStandardMaterial;
        const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#d6d1c8');
        partsInfo.push({
          index: partsInfo.length,
          name: mesh.name || `Winch Part ${partsInfo.length + 1}`,
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

  return { template, originalMaterials, staticEdgesList, activeEdgesList, partsInfo };
}

export const WinchCatchModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true }) => {
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

  // Load the CAD assembly from public/models/winchcablerobot.glb
  const { scene } = useGLTF('./models/winchcablerobot.glb');

  // Exact matching blueprint colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterWinchPrototype) {
    masterWinchPrototype = buildMasterWinchPrototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterWinchPrototype) {
      registerModel({
        modelId: 'drone-catch',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterWinchPrototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open (prevents root context thrashing on scroll)
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('drone-catch');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'drone-catch';

  // Create permanent scene instance ONCE (100% stable, zero re-cloning on scroll)
  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const clone = scene.clone(true);
    cloneRef.current = clone;

    const rotXRad = (DEFAULT_ROTATION_DEG[0] * Math.PI) / 180;
    const rotYRad = (DEFAULT_ROTATION_DEG[1] * Math.PI) / 180;
    const rotZRad = (DEFAULT_ROTATION_DEG[2] * Math.PI) / 180;

    clone.rotation.set(rotXRad, rotYRad, rotZRad);
    root.add(clone);

    const bbox = new THREE.Box3().setFromObject(root);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    centerRef.current = center;

    clone.position.sub(center).add(new THREE.Vector3(...DEFAULT_OFFSET));

    const toonMap = new Map<THREE.Mesh, THREE.MeshToonMaterial | THREE.MeshToonMaterial[]>();
    const bpLines: THREE.LineSegments[] = [];
    const celLines: THREE.LineSegments[] = [];
    const nodes: MeshNodeInfo[] = [];

    let meshIndex = 0;
    let partIndex = 0;

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.geometry.computeBoundingBox();
        const com = new THREE.Vector3();
        if (mesh.geometry.boundingBox) {
          mesh.geometry.boundingBox.getCenter(com);
        }

        nodes.push({
          mesh,
          initialPos: mesh.position.clone(),
          initialRot: mesh.rotation.clone(),
          centerOfMass: com,
          index: meshIndex,
        });

        const origMat = masterWinchPrototype?.originalMaterials[meshIndex] || mesh.material;

        if (Array.isArray(origMat)) {
          const mats = origMat.map((m) => {
            const currentPartIdx = partIndex++;
            const bakedColor = DEFAULT_PART_COLORS[currentPartIdx];
            const stdMat = m as THREE.MeshStandardMaterial;
            const col = bakedColor ? new THREE.Color(bakedColor) : (stdMat?.color ? stdMat.color.clone() : new THREE.Color('#d6d1c8'));
            return new THREE.MeshToonMaterial({
              color: col,
              emissive: new THREE.Color('#000000'),
              gradientMap: toonGradient,
            });
          });
          toonMap.set(mesh, mats);
        } else {
          const currentPartIdx = partIndex++;
          const bakedColor = DEFAULT_PART_COLORS[currentPartIdx];
          const stdMat = origMat as THREE.MeshStandardMaterial;
          const col = bakedColor ? new THREE.Color(bakedColor) : (stdMat?.color ? stdMat.color.clone() : new THREE.Color('#d6d1c8'));
          const mat = new THREE.MeshToonMaterial({
            color: col,
            emissive: new THREE.Color('#000000'),
            gradientMap: toonGradient,
          });
          toonMap.set(mesh, mat);
        }

        if (masterWinchPrototype?.staticEdgesList[meshIndex]) {
          const bpLineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color('#94A8C4'),
            linewidth: 1.35,
            transparent: true,
            opacity: 0.9,
          });
          const bpLine = new THREE.LineSegments(masterWinchPrototype.staticEdgesList[meshIndex], bpLineMat);
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterWinchPrototype?.activeEdgesList[meshIndex]) {
          const celLineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color('#0A0E14'),
            linewidth: 1.5,
            transparent: true,
            opacity: 0.75,
          });
          const celLine = new THREE.LineSegments(masterWinchPrototype.activeEdgesList[meshIndex], celLineMat);
          mesh.add(celLine);
          celLines.push(celLine);
        }

        meshIndex++;
      }
    });

    meshNodesRef.current = nodes;

    return { centeredScene: root, toonMaterialsMap: toonMap, blueprintEdgeLines: bpLines, celEdgeLines: celLines };
  }, [scene]);

  // Apply materials and dynamic color overrides (Instantaneous reference swap, 0 GPU recompilation)
  useEffect(() => {
    if (!centeredScene) return;

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
    // Dynamically adjust calibration transforms in frame loop without scene re-cloning
    if (isModelCalibrating && cloneRef.current) {
      cloneRef.current.rotation.set(
        (settings.rotX * Math.PI) / 180,
        (settings.rotY * Math.PI) / 180,
        (settings.rotZ * Math.PI) / 180
      );
      cloneRef.current.position
        .copy(new THREE.Vector3(...DEFAULT_OFFSET))
        .sub(centerRef.current)
        .add(new THREE.Vector3(settings.offsetX, settings.offsetY, settings.offsetZ));
    }

    // 1. If static blueprint mode, keep strictly still in rest position and return
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

    // 2. Active Mode / Calibration Mode: Scale damp and turntable rotation
    const baseScale = isModelCalibrating ? settings.scale : DEFAULT_SCALE;
    const targetScale = isActive ? baseScale * 1.12 : baseScale;
    scaleRef.current = THREE.MathUtils.damp(scaleRef.current, targetScale, 4.0, delta);
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleRef.current);
    }

    const shouldRotate = isModelCalibrating ? settings.autoRotate : (isActive && isRotating);
    const speed = isModelCalibrating ? settings.rotationSpeed : 0.6;

    if (shouldRotate && groupRef.current) {
      groupRef.current.rotation.y += delta * speed;
    }

    // 3. Execute Live Kinematics Animations around Center of Mass / Custom Pivot
    const time = state.clock.getElapsedTime();
    if (meshNodesRef.current.length > 0) {
      meshNodesRef.current.forEach((node) => {
        const anim = isModelCalibrating
          ? (settings.animationOverrides[node.index] || DEFAULT_PART_ANIMATIONS[node.index])
          : DEFAULT_PART_ANIMATIONS[node.index];

        if (!anim || anim.type === 'none') {
          node.mesh.position.copy(node.initialPos);
          node.mesh.rotation.copy(node.initialRot);
          return;
        }

        const phaseRad = (anim.phase * Math.PI) / 180;
        const axis = anim.axis;
        const dir = anim.direction ?? 1;
        const omega = (anim.speed * Math.PI * 2) / 60;

        // Determine pivot point for rotation
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

          // Exact rotation around Pivot Point
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

// Preload the CAD model
useGLTF.preload('./models/winchcablerobot.glb');
