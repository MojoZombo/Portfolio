import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createToonGradientMap } from '../materials';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration, PartColorInfo, PartAnimationConfig } from '../../context/TransformCalibrationContext';
import { CADPivotGizmo } from '../CADPivotGizmo';
import { computeGeometryCenterOfMass, splitAllMultiMaterialMeshes } from '../../utils/meshSplitter';

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

// Optimal Calibrated Defaults for Scrubtious Bottle Scrubber
const DEFAULT_OFFSET: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_SCALE = 7.50;
const DEFAULT_ROTATION_SPEED = 0.20;

// Baked Custom Part Color Overrides for Scrubtious
const DEFAULT_PART_COLORS: Record<number, string> = {
  0: '#cbd5e1', // Spring (silver/metallic)
  1: '#0d9488', // Scrubber attachment (teal)
  2: '#f59e0b', // Scrub Daddy sponge (yellow)
  3: '#1e293b', // Female handle body (dark slate)
};

// Hidden Parts (none by default)
const DEFAULT_PART_VISIBILITY: Record<number, boolean> = {};

// Default Kinematics Animations
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {
  0: {
    type: 'none',
    axis: 'z',
    axisAlignment: 'model',
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 1,
  },
  1: {
    type: 'multi',
    axis: 'x',
    axisAlignment: 'model',
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    subAnimations: [
      {
        type: 'oscillate-rotation',
        axis: 'y',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 360,
        amplitudePositive: 0,
        amplitudeNegative: 13,
        phase: 90,
        pivotMode: 'custom',
        pivotX: 0,
        pivotY: 0,
        pivotZ: -0.4,
      },
      {
        type: 'linear-reciprocate',
        axis: 'y',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 35,
        amplitudePositive: 0,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
    ],
  },
  2: {
    type: 'none',
    axis: 'z',
    axisAlignment: 'model',
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 1,
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

// Master prototype cache for Scrubtious Bottle Scrubber
let masterScrubtiousPrototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterScrubtiousPrototype(sourceScene: THREE.Group) {
  const template = sourceScene.clone(true);
  const originalMaterials: (THREE.Material | THREE.Material[])[] = [];
  const staticEdgesList: THREE.EdgesGeometry[] = [];
  const activeEdgesList: THREE.EdgesGeometry[] = [];
  const partsInfo: PartColorInfo[] = [];

  // Flatten hierarchy to root template to avoid local-coordinate nesting issues
  const meshesToFlatten: THREE.Mesh[] = [];
  template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && child.parent !== template) {
      meshesToFlatten.push(child as THREE.Mesh);
    }
  });
  meshesToFlatten.forEach((mesh) => {
    if ((!mesh.name || mesh.name.startsWith('Mesh_')) && mesh.parent?.name) {
      mesh.name = mesh.parent.name;
    }
    mesh.updateWorldMatrix(true, false);
    template.updateWorldMatrix(true, false);
    template.attach(mesh);
  });

  splitAllMultiMaterialMeshes(template);

  template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      originalMaterials.push(mesh.material);

      const partDisplayName = mesh.name || `Component ${partsInfo.length + 1}`;

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m, mIdx) => {
          const stdMat = m as THREE.MeshStandardMaterial;
          const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
          partsInfo.push({
            index: partsInfo.length,
            name: `${partDisplayName} (Part ${mIdx + 1})`,
            color: defaultBakedColor,
          });
        });
      } else {
        const stdMat = mesh.material as THREE.MeshStandardMaterial;
        const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
        partsInfo.push({
          index: partsInfo.length,
          name: partDisplayName,
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

export const BottleScrubberModel: React.FC<ModelProps> = ({
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

  // Load the CAD assembly from public/models/Scrubtious.glb with local/CDN Draco support
  const { scene } = useGLTF('./models/Scrubtious.glb', '/draco/gltf/');

  // Blueprint line colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterScrubtiousPrototype) {
    masterScrubtiousPrototype = buildMasterScrubtiousPrototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterScrubtiousPrototype) {
      registerModel({
        modelId: 'bottle-scrubber',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterScrubtiousPrototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
        defaultVisibility: DEFAULT_PART_VISIBILITY,
        defaultRotationSpeed: DEFAULT_ROTATION_SPEED,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('bottle-scrubber');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'bottle-scrubber';

  // Create permanent scene instance ONCE
  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterScrubtiousPrototype!.template.clone(true);
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

        if (masterScrubtiousPrototype!.staticEdgesList[currentMeshIdx]) {
          const bpLine = new THREE.LineSegments(
            masterScrubtiousPrototype!.staticEdgesList[currentMeshIdx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterScrubtiousPrototype!.activeEdgesList[currentMeshIdx]) {
          const celLine = new THREE.LineSegments(
            masterScrubtiousPrototype!.activeEdgesList[currentMeshIdx],
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
    pivot.rotation.order = 'YXZ';
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
        const geomCom = computeGeometryCenterOfMass(mesh.geometry);
        const initQuat = mesh.quaternion.clone();
        const scaledCom = geomCom.clone().multiply(mesh.scale);
        const com = mesh.position.clone().add(scaledCom.applyQuaternion(initQuat));
        mesh.userData.centerOfMass = com;

        const partIdx = mesh.userData.cadPartIndex !== undefined ? mesh.userData.cadPartIndex : idx;

        list.push({
          mesh,
          initialPos: mesh.position.clone(),
          initialRot: mesh.rotation.clone(),
          initialQuat: initQuat,
          centerOfMass: com,
          index: partIdx,
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
      let isMeshVisible = true;
      if (isShaded) {
        if (Array.isArray(toonMatOrArray)) {
          let anySubVisible = false;
          mesh.material = toonMatOrArray;
          toonMatOrArray.forEach((tm) => {
            const currentPartIdx = partRunningIndex++;
            const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
            const overrideHex = (isModelCalibrating && settings.colorOverrides?.[currentPartIdx])
              ? settings.colorOverrides[currentPartIdx]
              : (DEFAULT_PART_COLORS[currentPartIdx] || '#cbd5e1');

            const isPartVisible = isModelCalibrating
              ? settings.visibilityOverrides?.[currentPartIdx] !== false
              : DEFAULT_PART_VISIBILITY[currentPartIdx] !== false;

            if (isPartVisible) anySubVisible = true;
            tm.visible = isPartVisible;
            tm.color.set(isPartSelected ? '#38bdf8' : overrideHex);
            tm.emissive.set(isPartSelected ? '#0284c7' : '#000000');
          });
          isMeshVisible = anySubVisible;
        } else {
          const currentPartIdx = partRunningIndex++;
          const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
          const overrideHex = (isModelCalibrating && settings.colorOverrides?.[currentPartIdx])
            ? settings.colorOverrides[currentPartIdx]
            : (DEFAULT_PART_COLORS[currentPartIdx] || '#cbd5e1');

          const isPartVisible = isModelCalibrating
            ? settings.visibilityOverrides?.[currentPartIdx] !== false
            : DEFAULT_PART_VISIBILITY[currentPartIdx] !== false;

          isMeshVisible = isPartVisible;
          mesh.material = toonMatOrArray;
          toonMatOrArray.visible = isPartVisible;
          toonMatOrArray.color.set(isPartSelected ? '#38bdf8' : overrideHex);
          toonMatOrArray.emissive.set(isPartSelected ? '#0284c7' : '#000000');
        }
      } else {
        if (Array.isArray(toonMatOrArray)) {
          let anySubVisible = false;
          mesh.material = toonMatOrArray.map(() => {
            const currentPartIdx = partRunningIndex++;
            const isPartVisible = isModelCalibrating
              ? settings.visibilityOverrides?.[currentPartIdx] !== false
              : DEFAULT_PART_VISIBILITY[currentPartIdx] !== false;
            if (isPartVisible) anySubVisible = true;
            return bpMat;
          });
          isMeshVisible = anySubVisible;
        } else {
          const currentPartIdx = partRunningIndex++;
          const isPartVisible = isModelCalibrating
            ? settings.visibilityOverrides?.[currentPartIdx] !== false
            : DEFAULT_PART_VISIBILITY[currentPartIdx] !== false;
          isMeshVisible = isPartVisible;
          mesh.material = bpMat;
        }
      }
      mesh.visible = isMeshVisible;
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
    isModelCalibrating ? settings.visibilityOverrides : null,
  ]);

  const localTimeRef = useRef(0);

  useEffect(() => {
    if (!isModelCalibrating && (!isActive || !isRotating)) {
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0);
      currentSpeedRef.current = 0;
    }
    if (!isModelCalibrating && (!isActive || !isAnimating)) {
      localTimeRef.current = 0;
      if (meshNodesRef.current.length > 0) {
        meshNodesRef.current.forEach((node) => {
          node.mesh.position.copy(node.initialPos);
          node.mesh.rotation.copy(node.initialRot);
        });
      }
    }
  }, [isActive, isRotating, isAnimating, isModelCalibrating]);

  useFrame((_state, delta) => {
    delta = Math.min(delta, 0.035);

    // Apply transform calibration directly to pivot
    if (pivotRef.current) {
      const offsetX = isModelCalibrating ? settings.offsetX : DEFAULT_OFFSET[0];
      const offsetY = isModelCalibrating ? settings.offsetY : DEFAULT_OFFSET[1];
      const offsetZ = isModelCalibrating ? settings.offsetZ : DEFAULT_OFFSET[2];
      const rotX = isModelCalibrating ? (settings.rotX * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[0] * Math.PI) / 180;
      const rotY = isModelCalibrating ? (settings.rotY * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[1] * Math.PI) / 180;
      const rotZ = isModelCalibrating ? (settings.rotZ * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[2] * Math.PI) / 180;

      pivotRef.current.rotation.order = 'YXZ';
      pivotRef.current.rotation.set(rotX, rotY, rotZ);
      pivotRef.current.position.set(offsetX, offsetY, offsetZ);
    }

    if (!isModelCalibrating && (!isActive || !isRotating)) {
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0);
      currentSpeedRef.current = 0;
    }
    if (!isModelCalibrating && (!isActive || !isAnimating)) {
      localTimeRef.current = 0;
      if (meshNodesRef.current.length > 0) {
        meshNodesRef.current.forEach((node) => {
          node.mesh.position.copy(node.initialPos);
          node.mesh.rotation.copy(node.initialRot);
        });
      }
    }

    if (!isActive && !isModelCalibrating) {
      if (groupRef.current) {
        groupRef.current.scale.setScalar(DEFAULT_SCALE);
      }
      return;
    }

    if (isAnimating && (isActive || isModelCalibrating)) {
      localTimeRef.current += delta;
    }

    const baseScale = isModelCalibrating ? settings.scale : DEFAULT_SCALE;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(baseScale);
    }

    // Auto rotate parent with smooth acceleration from 0 RPM
    const maxSpeed = isModelCalibrating ? settings.rotationSpeed : DEFAULT_ROTATION_SPEED;
    const targetSpeed = isModelCalibrating ? (settings.autoRotate ? maxSpeed : 0) : (isActive && isRotating && isAnimating ? maxSpeed : 0);
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current && (isRotating || isModelCalibrating)) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      }
    }

    const time = isAnimating ? localTimeRef.current : 0;
    if (meshNodesRef.current.length > 0 && !isModelCalibrating) {
      const computedTransforms = new Map<
        number,
        { pos: THREE.Vector3; quat: THREE.Quaternion; deltaPos: THREE.Vector3; deltaQuat: THREE.Quaternion }
      >();

      const nodeMap = new Map<number, MeshNodeInfo>();
      meshNodesRef.current.forEach((n) => nodeMap.set(n.index, n));

      const solveKinematics = (
        partIdx: number,
        visited = new Set<number>()
      ): { pos: THREE.Vector3; quat: THREE.Quaternion; deltaPos: THREE.Vector3; deltaQuat: THREE.Quaternion } | null => {
        if (computedTransforms.has(partIdx)) {
          return computedTransforms.get(partIdx)!;
        }
        if (visited.has(partIdx)) {
          const n = nodeMap.get(partIdx);
          if (!n) return null;
          return {
            pos: n.initialPos.clone(),
            quat: n.initialQuat.clone(),
            deltaPos: new THREE.Vector3(),
            deltaQuat: new THREE.Quaternion(),
          };
        }
        visited.add(partIdx);

        const node = nodeMap.get(partIdx);
        if (!node) return null;

        const anim: PartAnimationConfig | undefined = DEFAULT_PART_ANIMATIONS[node.index];
        const parentIdx = anim?.parentPartIndex;
        let basePos = node.initialPos.clone();
        let baseQuat = node.initialQuat.clone();
        let parentDeltaQuat = new THREE.Quaternion();

        if (parentIdx !== undefined && parentIdx !== null && parentIdx !== partIdx && nodeMap.has(parentIdx)) {
          const parentResult = solveKinematics(parentIdx, visited);
          const parentNode = nodeMap.get(parentIdx);
          if (parentResult && parentNode) {
            parentDeltaQuat = parentResult.deltaQuat;
            const relOffset = node.initialPos.clone().sub(parentNode.initialPos);
            basePos = parentResult.pos.clone().add(relOffset.clone().applyQuaternion(parentDeltaQuat));
            baseQuat = parentDeltaQuat.clone().multiply(node.initialQuat);
          }
        }

        let currentPos = basePos.clone();
        let currentQuat = baseQuat.clone();
        let accumulatedDeltaQuat = parentDeltaQuat.clone();

        const restingCom = basePos.clone().add(
          node.centerOfMass.clone().sub(node.initialPos).applyQuaternion(parentDeltaQuat)
        );
        node.mesh.userData.restingCom = restingCom;
        node.mesh.userData.restingPos = basePos.clone();
        node.mesh.userData.parentDeltaQuat = parentDeltaQuat.clone();

        if (anim && anim.type !== 'none') {
          const applyAnim = (animConfig: any) => {
            if (!animConfig || animConfig.type === 'none') return;
            if (animConfig.type === 'multi' && Array.isArray(animConfig.subAnimations)) {
              animConfig.subAnimations.forEach(applyAnim);
              return;
            }

            const phaseRad = ((animConfig.phase || 0) * Math.PI) / 180;
            const rotXRad = ((animConfig.axisRotX || 0) * Math.PI) / 180;
            const rotYRad = ((animConfig.axisRotY || 0) * Math.PI) / 180;
            const rotZRad = ((animConfig.axisRotZ || 0) * Math.PI) / 180;
            const customAxisQuat = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(rotXRad, rotYRad, rotZRad, 'XYZ')
            );

            const rawAxis = new THREE.Vector3(
              animConfig.axis === 'x' ? 1 : 0,
              animConfig.axis === 'y' ? 1 : 0,
              animConfig.axis === 'z' ? 1 : 0
            );
            const orientedAxis = rawAxis.clone().applyQuaternion(customAxisQuat);
            const alignment = animConfig.axisAlignment || 'model';
            const parentWorldQuat = new THREE.Quaternion();
            if (node.mesh.parent) {
              node.mesh.parent.getWorldQuaternion(parentWorldQuat);
            }

            let axisVec: THREE.Vector3;
            let pivotOffset: THREE.Vector3;

            const rawPivotOffset = new THREE.Vector3(
              (animConfig.pivotX || 0) / 100,
              (animConfig.pivotY || 0) / 100,
              (animConfig.pivotZ || 0) / 100
            );

            if (alignment === 'global') {
              axisVec = orientedAxis.clone().applyQuaternion(parentWorldQuat.clone().invert());
              pivotOffset = rawPivotOffset.clone().applyQuaternion(parentWorldQuat.clone().invert());
            } else if (alignment === 'part') {
              axisVec = orientedAxis.clone().applyQuaternion(baseQuat);
              pivotOffset = rawPivotOffset.clone().applyQuaternion(baseQuat);
            } else {
              axisVec = orientedAxis.clone().applyQuaternion(parentDeltaQuat);
              pivotOffset = rawPivotOffset.clone().applyQuaternion(parentDeltaQuat);
            }

            const dir = animConfig.direction ?? 1;
            const omega = ((animConfig.speed || 0) * Math.PI * 2) / 60;

            if (animConfig.type === 'continuous-spin' || animConfig.type === 'oscillate-rotation') {
              const pivotMode = animConfig.pivotMode || 'center-of-mass';
              let pivot = basePos.clone().add(
                node.centerOfMass.clone().sub(node.initialPos).applyQuaternion(accumulatedDeltaQuat)
              );

              const translationDelta = currentPos.clone().sub(basePos);
              pivot.add(translationDelta);

              if (pivotMode === 'origin') {
                pivot.copy(basePos).add(translationDelta);
              } else if (pivotMode === 'custom') {
                pivot.add(pivotOffset);
              }

              node.mesh.userData.hingePivot = pivot.clone();
              node.mesh.userData.hingeAxis = axisVec.clone();

              const angle =
                animConfig.type === 'continuous-spin'
                  ? time * omega * dir
                  : Math.sin(time * omega + phaseRad) *
                    (((animConfig.amplitude || 30) * Math.PI) / 180) *
                    dir;

              const qDelta = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
              currentQuat = qDelta.clone().multiply(currentQuat);
              currentPos.sub(pivot).applyQuaternion(qDelta).add(pivot);
              accumulatedDeltaQuat = qDelta.clone().multiply(accumulatedDeltaQuat);
            } else if (animConfig.type === 'linear-reciprocate') {
              const distPosM = ((animConfig.amplitudePositive !== undefined ? animConfig.amplitudePositive : (animConfig.amplitude || 10)) / 100);
              const distNegM = ((animConfig.amplitudeNegative !== undefined ? animConfig.amplitudeNegative : (animConfig.amplitude || 10)) / 100);
              let displacementScalar = 0;
              if (distNegM === 0) {
                const progress = (1 - Math.cos(time * omega + phaseRad)) / 2;
                displacementScalar = progress * distPosM * dir;
              } else if (distPosM === 0) {
                const progress = (1 - Math.cos(time * omega + phaseRad)) / 2;
                displacementScalar = -progress * distNegM * dir;
              } else {
                const s = Math.sin(time * omega + phaseRad);
                displacementScalar = (s >= 0 ? s * distPosM : s * distNegM) * dir;
              }
              const displacement = axisVec.clone().multiplyScalar(displacementScalar);
              currentPos.add(displacement);
            }
          };

          applyAnim(anim);
        }

        node.mesh.position.copy(currentPos);
        node.mesh.quaternion.copy(currentQuat);

        const deltaPos = currentPos.clone().sub(node.initialPos);
        const deltaQuat = currentQuat.clone().multiply(node.initialQuat.clone().invert());
        const result = { pos: currentPos, quat: currentQuat, deltaPos, deltaQuat };
        computedTransforms.set(partIdx, result);
        return result;
      };

      meshNodesRef.current.forEach((node) => {
        solveKinematics(node.index);
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

useGLTF.preload('./models/Scrubtious.glb', '/draco/gltf/');

