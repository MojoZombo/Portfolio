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

// Optimal Calibrated Defaults for Sailing Catamaran
const DEFAULT_OFFSET: [number, number, number] = [-0.15, 0.03, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [-90.0, -90.0, 0.0];
const DEFAULT_SCALE = 2.30;
const DEFAULT_ROTATION_SPEED = 0.20; // 0.2 rad/s turntable rotation

// Default Part Colors for Sailing Catamaran
const DEFAULT_PART_COLORS: Record<number, string> = {
  2: '#cbd5e1', // Aluminium_extrusion_20x20x1000-1
  3: '#cbd5e1', // Aluminium_extrusion_20x20x1000-2
  4: '#cbd5e1', // Aluminium_extrusion_20x20x1000-3
  8: '#1e293b', // Cantam_Sail_Gear_45_Teeth_10mm_Thick_for_print_(1)-1
  9: '#1e293b', // PART_Sail_Bearing_Mounting_Plate-1
  10: '#1e293b', // PART_Sail_Bearing_Mounting_Plate-2
  11: '#1e293b', // Sail_Bearing_Extention-1
  12: '#1e293b', // Sail_Bearing_Housing_less_friction-1
  13: '#1e293b', // Sail_Bearing_Housing_w_posts-1
  14: '#3b82f6', // Electronics_Housing_Clamp-1
  15: '#3b82f6', // Electronics_Housing_Clamp-2
  16: '#3b82f6', // Electronics_Housing_Clamp-3
  17: '#3b82f6', // Electronics_Housing_Clamp-4
  18: '#0284c7', // Electronics_Housing-1
  19: '#003262', // Baby_Sail_Attatchment-1001
  20: '#FDB515', // Mesh_19001
  21: '#003262', // Mesh_19001_1
  22: '#003262', // Mesh_19001_2
  23: '#003262', // Baby_Sail_Rod_Sleeve-1
  24: '#003262', // Daddy_Sail_Rod_Sleeve-1
  30: '#FDB515', // rudder_1-1
  31: '#FDB515', // rudder_mount-1
  32: '#FDB515', // rudder_mount-2
  33: '#FDB515', // rudder_1-1001
  34: '#FDB515', // rudder_mount-1001
  35: '#FDB515', // rudder_mount-2001
};

// Default Kinematics Animations (Aligned to Assembly Model Frame)
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {
  19: {
    type: 'oscillate-rotation',
    axis: 'y',
    axisAlignment: 'model',
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: -10,
    amplitude: 34,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 20,
    pivotMode: 'custom',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 22,
  },
  20: {
    type: 'none',
    axis: 'y',
    axisAlignment: 'model',
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
    parentPartIndex: 19,
  },
  22: {
    type: 'oscillate-rotation',
    axis: 'y',
    axisAlignment: 'model',
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 30,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 20,
    pivotMode: 'custom',
    pivotX: 0,
    pivotY: 55,
    pivotZ: -12,
  },
  23: {
    type: 'none',
    axis: 'y',
    axisAlignment: 'model',
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
    parentPartIndex: 22,
  },
  24: {
    type: 'none',
    axis: 'y',
    axisAlignment: 'model',
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
    parentPartIndex: 22,
  },
  26: {
    type: 'none',
    axis: 'y',
    axisAlignment: 'model',
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
    parentPartIndex: 22,
  },
  28: {
    type: 'none',
    axis: 'y',
    axisAlignment: 'model',
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
    parentPartIndex: 22,
  },
  30: {
    type: 'oscillate-rotation',
    axis: 'y',
    axisAlignment: 'model',
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: -5,
    amplitude: 27,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: 'custom',
    pivotX: 0,
    pivotY: 0,
    pivotZ: -3,
  },
  33: {
    type: 'oscillate-rotation',
    axis: 'y',
    axisAlignment: 'model',
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: -5,
    amplitude: 27,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: 'custom',
    pivotX: 0,
    pivotY: 0,
    pivotZ: -3,
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

// Master prototype cache for Catamaran
let masterCatamaranPrototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterCatamaranPrototype(sourceScene: THREE.Group) {
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
    mesh.updateWorldMatrix(true, false);
    template.updateWorldMatrix(true, false);
    template.attach(mesh);
  });

  splitAllMultiMaterialMeshes(template);

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
            name: m.name ? m.name.replace(/_\d+$/, '') : `Catamaran Component ${partsInfo.length + 1}`,
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

export const CatamaranModel: React.FC<ModelProps> = ({
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

  // Load the CAD assembly from public/models/Sailboat.glb
  const { scene } = useGLTF('./models/Sailboat.glb');

  // Exact matching blueprint colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterCatamaranPrototype) {
    masterCatamaranPrototype = buildMasterCatamaranPrototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterCatamaranPrototype) {
      registerModel({
        modelId: 'catamaran',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterCatamaranPrototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
        defaultRotationSpeed: DEFAULT_ROTATION_SPEED,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('catamaran');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'catamaran';

  // Create permanent scene instance ONCE
  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterCatamaranPrototype!.template.clone(true);
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

        if (masterCatamaranPrototype!.staticEdgesList[currentMeshIdx]) {
          const bpLine = new THREE.LineSegments(
            masterCatamaranPrototype!.staticEdgesList[currentMeshIdx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterCatamaranPrototype!.activeEdgesList[currentMeshIdx]) {
          const celLine = new THREE.LineSegments(
            masterCatamaranPrototype!.activeEdgesList[currentMeshIdx],
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

        // Signal to StudioSceneBridge that this model manages its own kinematics
        mesh.userData.hasOwnKinematics = true;

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

  const localTimeRef = useRef(0);

  useFrame((_state, delta) => {
    delta = Math.min(delta, 0.035);
    if (isAnimating && (isActive || isModelCalibrating)) {
      localTimeRef.current += delta;
    } else if (!isActive && !isModelCalibrating) {
      localTimeRef.current = 0;
    }
    // Always apply transform calibration directly to pivot
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

    if (!isActive && !isModelCalibrating) {
      if (groupRef.current) {
        groupRef.current.scale.setScalar(DEFAULT_SCALE);
      }
      if (isAnimating && meshNodesRef.current.length > 0) {
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
    const maxSpeed = isModelCalibrating ? settings.rotationSpeed : DEFAULT_ROTATION_SPEED;
    const targetSpeed = isModelCalibrating ? (settings.autoRotate ? maxSpeed : 0) : (isActive && isRotating && isAnimating ? maxSpeed : 0);
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      } else if (!isActive && !isModelCalibrating) {
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, 0, 4.0, delta);
      }
    }

    const time = isAnimating ? localTimeRef.current : 0;
    if (meshNodesRef.current.length > 0) {
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

        const anim: PartAnimationConfig | undefined = isModelCalibrating
          ? settings.animationOverrides[node.index]
          : DEFAULT_PART_ANIMATIONS[node.index];

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
              // 'model': Align with Catamaran Model Frame
              // Converts from upright boat model frame into CAD mesh frame (+Z is mast, +Y is bow)
              const uprightToCadQuat = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ')
              );

              axisVec = orientedAxis.clone().applyQuaternion(uprightToCadQuat).applyQuaternion(accumulatedDeltaQuat);
              pivotOffset = rawPivotOffset.clone().applyQuaternion(uprightToCadQuat).applyQuaternion(accumulatedDeltaQuat);
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
        node.mesh.userData.currentCom = basePos.clone().add(
          node.centerOfMass.clone().sub(node.initialPos).applyQuaternion(accumulatedDeltaQuat)
        );

        const deltaPos = currentPos.clone().sub(node.initialPos);
        const deltaQuat = currentQuat.clone().multiply(node.initialQuat.clone().invert());
        const result = { pos: currentPos, quat: currentQuat, deltaPos, deltaQuat };
        computedTransforms.set(partIdx, result);
        return result;
      };

      nodeMap.forEach((_, pIdx) => {
        solveKinematics(pIdx);
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

useGLTF.preload('./models/Sailboat.glb');

