import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createToonGradientMap } from '../materials';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration, PartColorInfo, PartAnimationConfig } from '../../context/TransformCalibrationContext';
import { CADPivotGizmo } from '../CADPivotGizmo';
import { computeGeometryCenterOfMass, splitAllMultiMaterialMeshes, getAssemblyRoot } from '../../utils/meshSplitter';

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

// Optimal Calibrated CAD Defaults for Robot Hand
const DEFAULT_OFFSET: [number, number, number] = [0.42, 0.2, 0.46];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0, -90, 0];
const DEFAULT_SCALE = 1.1;

// Baked Custom Part Color Overrides for Robot Hand
const DEFAULT_PART_COLORS: Record<number, string> = {
  0: '#008c4a', // mesh1757_mesh
  3: '#3b82f6', // mesh1757_mesh_10_(Body_B)
  4: '#FDB515', // mesh1757_mesh_10_(Body_C)
  5: '#3b82f6', // mesh1757_mesh_10_(Body_D)
  6: '#3b82f6', // mesh1757_mesh_10_(Body_E)
  7: '#3b82f6', // mesh1757_mesh_10_(Body_F)
  8: '#3b82f6', // mesh1757_mesh_10_(Body_G)
  9: '#3b82f6', // mesh1757_mesh_10_(Body_H)
  10: '#3b82f6', // mesh1757_mesh_10_(Body_I)
  11: '#3b82f6', // mesh1757_mesh_10_(Body_J)
  12: '#FDB515', // mesh1757_mesh_10_(Body_K)
  13: '#3b82f6', // mesh1757_mesh_10_(Body_L)
  14: '#3b82f6', // mesh1757_mesh_10_(Body_M)
  15: '#3b82f6', // mesh1757_mesh_10_(Body_N)
  16: '#3b82f6', // mesh1757_mesh_10_(Body_O)
  17: '#FDB515', // mesh1757_mesh_10_(Body_P)
  24: '#475569', // mesh1757_mesh_15
  25: '#475569', // mesh1757_mesh_16
  26: '#475569', // mesh1757_mesh_17
  43: '#1e293b', // mesh1757_mesh_8_(Body_A)
  44: '#1e293b', // mesh1757_mesh_8_(Body_B)
  45: '#1e293b', // mesh1757_mesh_8_(Body_C)
  46: '#1e293b', // mesh1757_mesh_8_(Body_D)
  47: '#1e293b', // mesh1757_mesh_8_(Body_E)
  48: '#1e293b', // mesh1757_mesh_8_(Body_F)
  49: '#1e293b', // mesh1757_mesh_8_(Body_G)
  50: '#1e293b', // mesh1757_mesh_8_(Body_H)
  51: '#1e293b', // mesh1757_mesh_8_(Body_I)
  52: '#1e293b', // mesh1757_mesh_8_(Body_J)
  53: '#1e293b', // mesh1757_mesh_8_(Body_K)
  54: '#1e293b', // mesh1757_mesh_8_(Body_L)
  55: '#1e293b', // mesh1757_mesh_8_(Body_M)
  56: '#1e293b', // mesh1757_mesh_8_(Body_N)
  57: '#1e293b', // mesh1757_mesh_8_(Body_O)
};

// Baked Custom Part Animations
const DEFAULT_PART_ANIMATIONS: Record<number, any> = {
  3: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 8,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 60,
    pivotMode: "custom",
    pivotX: 0,
    pivotY: -22.5,
    pivotZ: 0
  },
  4: {
    type: "oscillate-rotation",
    axis: "x",
    axisAlignment: "model",
    axisRotX: 29,
    axisRotY: -21,
    axisRotZ: -14,
    direction: 1,
    speed: 10,
    amplitude: 8,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "custom",
    pivotX: -10,
    pivotY: -9.5,
    pivotZ: 19
  },
  5: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 8,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "custom",
    pivotX: -1.5,
    pivotY: -21.5,
    pivotZ: 0
  },
  6: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 8,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 20,
    pivotMode: "custom",
    pivotX: -2,
    pivotY: -21,
    pivotZ: 0
  },
  7: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 8,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 40,
    pivotMode: "custom",
    pivotX: 0,
    pivotY: -21,
    pivotZ: 0
  },
  8: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 5,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 20,
    pivotMode: "custom",
    pivotX: -3,
    pivotY: -12.5,
    pivotZ: 0,
    parentPartIndex: 6
  },
  9: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 5,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 40,
    pivotMode: "custom",
    pivotX: 0,
    pivotY: -14,
    pivotZ: 0,
    parentPartIndex: 7
  },
  10: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 5,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 40,
    pivotMode: "custom",
    pivotX: 0,
    pivotY: -13,
    pivotZ: 0,
    parentPartIndex: 3
  },
  11: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 5,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "custom",
    pivotX: -2.5,
    pivotY: -13,
    pivotZ: 0,
    parentPartIndex: 5
  },
  12: {
    type: "oscillate-rotation",
    axis: "x",
    axisAlignment: "model",
    axisRotX: 29,
    axisRotY: -29,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 5,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "custom",
    pivotX: -5.5,
    pivotY: -6,
    pivotZ: 10.5,
    parentPartIndex: 4
  },
  13: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 2,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 60,
    pivotMode: "custom",
    pivotX: 0,
    pivotY: -10,
    pivotZ: 0,
    parentPartIndex: 10
  },
  14: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 2,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 40,
    pivotMode: "custom",
    pivotX: 0,
    pivotY: -10.5,
    pivotZ: 0,
    parentPartIndex: 9
  },
  15: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 2,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "custom",
    pivotX: -2.5,
    pivotY: -11,
    pivotZ: 0,
    parentPartIndex: 11
  },
  16: {
    type: "oscillate-rotation",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 2,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 20,
    pivotMode: "custom",
    pivotX: -3.5,
    pivotY: -11,
    pivotZ: 0,
    parentPartIndex: 8
  },
  17: {
    type: "oscillate-rotation",
    axis: "x",
    axisAlignment: "model",
    axisRotX: 29,
    axisRotY: -29,
    axisRotZ: 0,
    direction: 1,
    speed: 10,
    amplitude: 2,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "custom",
    pivotX: -5,
    pivotY: -8,
    pivotZ: 5.5,
    parentPartIndex: 12
  },
  43: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 4
  },
  44: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 12
  },
  48: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 10
  },
  49: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 5
  },
  50: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 6
  },
  52: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 3
  },
  53: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 7
  },
  54: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 9
  },
  56: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 11
  },
  57: {
    type: "none",
    axis: "z",
    axisAlignment: "model",
    axisRotX: 0,
    axisRotY: 0,
    axisRotZ: 0,
    direction: 1,
    speed: 60,
    amplitude: 35,
    amplitudePositive: 10,
    amplitudeNegative: 10,
    phase: 0,
    pivotMode: "center-of-mass",
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    parentPartIndex: 8
  }
};

// Custom Assembly Tree Part Order:
const DEFAULT_PART_ORDER = [0,1,2,5,49,11,56,15,6,50,8,57,16,7,53,9,54,14,3,52,10,48,13,4,43,12,44,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,45,46,47,51,55,58];

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

// Master prototype cache: Geometries & EdgesGeometry computed ONCE
let masterCADPrototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterCADPrototype(sourceScene: THREE.Group) {
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
          const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#d6d1c8');
          partsInfo.push({
            index: partsInfo.length,
            name: m.name ? m.name.replace(/_\d+$/, '') : `Assembly Component ${partsInfo.length + 1}`,
            color: defaultBakedColor,
          });
        });
      } else {
        const stdMat = mesh.material as THREE.MeshStandardMaterial;
        const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#d6d1c8');
        partsInfo.push({
          index: partsInfo.length,
          name: mesh.name || `Component ${partsInfo.length + 1}`,
          color: defaultBakedColor,
        });
      }

      try {
        const bpEdges = new THREE.EdgesGeometry(mesh.geometry, 5);
        staticEdgesList.push(bpEdges);

        const celEdges = new THREE.EdgesGeometry(mesh.geometry, 28);
        activeEdgesList.push(celEdges);
      } catch {
        // Ignore non-standard
      }
    }
  });

  return { template, originalMaterials, staticEdgesList, activeEdgesList, partsInfo };
}

export const RobotHandModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true, isAnimating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const cloneRef = useRef<THREE.Group | null>(null);
  const centerRef = useRef<THREE.Vector3>(new THREE.Vector3());
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

  // Load CAD model
  const { scene } = useGLTF('./models/HandSplit.glb');

  // Exact matching blueprint colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterCADPrototype) {
    masterCADPrototype = buildMasterCADPrototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterCADPrototype) {
      registerModel({
        modelId: 'robot-hand',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterCADPrototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
        defaultPartOrder: DEFAULT_PART_ORDER,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open (prevents root context thrashing on scroll)
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('robot-hand');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'robot-hand';

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

        const geomCom = computeGeometryCenterOfMass(mesh.geometry);
        const initQuat = mesh.quaternion.clone();
        const scaledCom = geomCom.clone().multiply(mesh.scale);
        const com = mesh.position.clone().add(scaledCom.applyQuaternion(initQuat));
        mesh.userData.centerOfMass = com;
        mesh.userData.hasOwnKinematics = true;
        mesh.userData.initialPos = mesh.position.clone();
        mesh.userData.initialRot = mesh.rotation.clone();
        mesh.userData.initialQuat = initQuat;

        mesh.userData.partIndex = meshIndex;
        mesh.userData.cadPartIndex = meshIndex;
        mesh.userData.isCadMesh = true;
        mesh.userData.partName = mesh.name || `Component ${meshIndex + 1}`;


        nodes.push({
          mesh,
          initialPos: mesh.position.clone(),
          initialRot: mesh.rotation.clone(),
          initialQuat: initQuat,
          centerOfMass: com,
          index: meshIndex,
        });

        const origMat = masterCADPrototype?.originalMaterials[meshIndex] || mesh.material;

        if (Array.isArray(origMat)) {
          const mats = origMat.map((m) => {
            const currentPartIdx = partIndex++;
            const bakedColor = DEFAULT_PART_COLORS[currentPartIdx];
            const stdMat = m as THREE.MeshStandardMaterial;
            const col = bakedColor ? new THREE.Color(bakedColor) : (stdMat?.color ? stdMat.color.clone() : new THREE.Color('#d6d1c8'));
            const mat = new THREE.MeshToonMaterial({
              color: col,
              emissive: new THREE.Color('#000000'),
              gradientMap: toonGradient,
            });
            mat.userData.originalColor = '#' + col.getHexString();
            return mat;
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
          mat.userData.originalColor = '#' + col.getHexString();
          toonMap.set(mesh, mat);
        }

        if (masterCADPrototype?.staticEdgesList[meshIndex]) {
          const bpLineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color('#94A8C4'),
            linewidth: 1.35,
            transparent: true,
            opacity: 0.9,
          });
          const bpLine = new THREE.LineSegments(masterCADPrototype.staticEdgesList[meshIndex], bpLineMat);
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterCADPrototype?.activeEdgesList[meshIndex]) {
          const celLineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color('#0A0E14'),
            linewidth: 1.5,
            transparent: true,
            opacity: 0.75,
          });
          const celLine = new THREE.LineSegments(masterCADPrototype.activeEdgesList[meshIndex], celLineMat);
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

            const baseColor = overrideHex || tm.userData?.originalColor || '#d6d1c8';
            tm.color.set(isPartSelected ? '#38bdf8' : baseColor);
            tm.emissive.set(isPartSelected ? '#0284c7' : '#000000');
          });
        } else {
          const currentPartIdx = partRunningIndex++;
          const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
          const overrideHex = isModelCalibrating
            ? (settings.colorOverrides[currentPartIdx] || DEFAULT_PART_COLORS[currentPartIdx])
            : DEFAULT_PART_COLORS[currentPartIdx];

          mesh.material = toonMatOrArray;
          const baseColor = overrideHex || toonMatOrArray.userData?.originalColor || '#d6d1c8';
          toonMatOrArray.color.set(isPartSelected ? '#38bdf8' : baseColor);
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

  useFrame((_state, delta) => { delta = Math.min(delta, 0.035);
    // Dynamically adjust calibration transforms in frame loop without scene re-cloning
    if (isModelCalibrating && cloneRef.current) {
      cloneRef.current.rotation.set(
        (settings.rotX * Math.PI) / 180,
        (settings.rotY * Math.PI) / 180,
        (settings.rotZ * Math.PI) / 180
      );
      cloneRef.current.position
        .copy(new THREE.Vector3(settings.offsetX, settings.offsetY, settings.offsetZ))
        .sub(centerRef.current);
      cloneRef.current.updateWorldMatrix(true, false);
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

    // 1. If static blueprint mode, keep strictly still in rest position and return
    if (!isActive && !isModelCalibrating) {
      if (groupRef.current) {
        groupRef.current.scale.setScalar(DEFAULT_SCALE);
      }
      return;
    }

    // 2. Active Mode / Calibration Mode
    const baseScale = isModelCalibrating ? settings.scale : DEFAULT_SCALE;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(baseScale);
    }

    // Auto rotate parent with smooth acceleration from 0 RPM
    const maxSpeed = isModelCalibrating ? settings.rotationSpeed : 0.2;
    const targetSpeed = isModelCalibrating ? (settings.autoRotate ? maxSpeed : 0) : (isActive && isRotating && isAnimating ? maxSpeed : 0);
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current && (isRotating || isModelCalibrating)) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      }
    }

    // 3. Execute Live Kinematics Animations around Center of Mass / Custom Pivot
    const isPlaying = isModelCalibrating ? (isAnimating ?? true) : (isActive && isAnimating);
    if (isPlaying) {
      localTimeRef.current += Math.min(delta, 0.035);
    }
    const time = isPlaying ? localTimeRef.current : 0;

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
              // 'model': CAD Model Root frame (cloneRef so animations stay oriented relative to the rotated model)
              const assemblyWorldQuat = new THREE.Quaternion();
              if (cloneRef.current) {
                cloneRef.current.getWorldQuaternion(assemblyWorldQuat);
              } else if (groupRef.current) {
                groupRef.current.getWorldQuaternion(assemblyWorldQuat);
              } else {
                const assemblyRoot = getAssemblyRoot(node.mesh);
                assemblyRoot.getWorldQuaternion(assemblyWorldQuat);
              }
              const assemblyToParentQuat = parentWorldQuat.clone().invert().multiply(assemblyWorldQuat);

              axisVec = orientedAxis.clone().applyQuaternion(assemblyToParentQuat).applyQuaternion(accumulatedDeltaQuat);
              pivotOffset = rawPivotOffset.clone().applyQuaternion(assemblyToParentQuat).applyQuaternion(accumulatedDeltaQuat);
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
              if (isPlaying) {
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

// Preload the CAD model
useGLTF.preload('./models/HandSplit.glb');
