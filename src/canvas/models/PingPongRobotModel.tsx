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

// Optimal Calibrated Defaults for Ping Pong Robot
const DEFAULT_OFFSET: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_SCALE = 5.50;

// Static ball kinematic constants & zero-allocation scratch vectors
const BALL_LOCAL_CONTACT = new THREE.Vector3(0.0204, 0.095, 0.004);
const scratchBallContact = new THREE.Vector3();

// Baked Custom Part Color Overrides for Ping Pong Robot
const DEFAULT_PART_COLORS: Record<number, string> = {
  2: '#64748b', // Mesh_31_2
  5: '#64748b', // Mesh_31_5
  6: '#64748b', // Mesh_31_6
  7: '#475569', // Mesh_31_7
  8: '#1e293b', // Mesh_31_8
  34: '#475569', // Mesh_49_11
  35: '#475569', // Mesh_49_12
  36: '#919191', // Mesh_49_13
  38: '#f8fafc', // Mesh_49_15
  55: '#ff7300', // Ping Pong Ball
  56: '#475569', // Mesh_49_8 (Body C)
  57: '#059669', // Mesh_49_8 (Body D)
  58: '#dc2626', // Mesh_49_8 (Body E)
  59: '#f8fafc', // Mesh_49_8 (Body F)
  60: '#475569', // Mesh_49_8 (Body G)
  61: '#059669', // Mesh_49_8 (Body H)
  62: '#dc2626', // Mesh_49_8 (Body I)
  63: '#f8fafc', // Mesh_49_8 (Body J)
  64: '#475569', // Mesh_49_8 (Body K)
  65: '#059669', // Mesh_49_8 (Body L)
  66: '#dc2626', // Mesh_49_8 (Body M)
  67: '#f8fafc', // Mesh_49_8 (Body N)
  68: '#475569', // Mesh_49_8 (Body O)
  69: '#059669', // Mesh_49_8 (Body P)
  70: '#dc2626', // Mesh_49_8 (Body Q)
  71: '#f8fafc', // Mesh_49_8 (Body R)
  72: '#475569', // Mesh_49_8 (Body S)
  73: '#059669', // Mesh_49_8 (Body T)
  74: '#dc2626', // Mesh_49_8 (Body U)
  75: '#f8fafc', // Mesh_49_8 (Body V)
  76: '#475569', // Mesh_49_8 (Body W)
  77: '#059669', // Mesh_49_8 (Body X)
  78: '#dc2626', // Mesh_49_8 (Body Y)
  79: '#f8fafc', // Mesh_49_8 (Body Z)
  80: '#475569', // Mesh_49_8 (Body [)
  81: '#059669', // Mesh_49_8 (Body \)
  82: '#dc2626', // Mesh_49_8 (Body ])
  83: '#f8fafc', // Mesh_49_8 (Body ^)
  84: '#475569', // Mesh_49_8 (Body _)
  85: '#059669', // Mesh_49_8 (Body `)
  86: '#dc2626', // Mesh_49_8 (Body a)
  87: '#f8fafc', // Mesh_49_8 (Body b)
  88: '#475569', // Mesh_49_8 (Body c)
  89: '#059669', // Mesh_49_8 (Body d)
  90: '#dc2626', // Mesh_49_8 (Body e)
};

// Hidden Parts:
const DEFAULT_PART_VISIBILITY: Record<number, boolean> = {
  23: false, // Mesh_49
  26: false, // Mesh_49_3
  29: false, // Mesh_49_6
  37: false, // Mesh_49_14
  65: false, // Mesh_49_8 (Body L)
  69: false, // Mesh_49_8 (Body P)
};

// Baked Custom Part Kinematics Animations
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {
  27: {
    type: 'linear-reciprocate',
    axis: 'y',
    direction: 1,
    speed: 100,
    amplitude: 10,
    amplitudePositive: 1,
    amplitudeNegative: 0,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
  },
  31: {
    type: 'linear-reciprocate',
    axis: 'y',
    direction: 1,
    speed: 100,
    amplitude: 10,
    amplitudePositive: 1,
    amplitudeNegative: 0,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
  },
  34: {
    type: 'linear-reciprocate',
    axis: 'y',
    direction: 1,
    speed: 100,
    amplitude: 10,
    amplitudePositive: 1,
    amplitudeNegative: 0,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
  },
  35: {
    type: 'linear-reciprocate',
    axis: 'y',
    direction: 1,
    speed: 100,
    amplitude: 10,
    amplitudePositive: 1,
    amplitudeNegative: 0,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
  },
  36: {
    type: 'multi',
    axis: 'x',
    direction: 1,
    speed: 100,
    amplitude: 10,
    amplitudePositive: 1,
    amplitudeNegative: 0,
    phase: 0,
    pivotMode: 'center-of-mass',
    pivotX: 0,
    pivotY: 0,
    pivotZ: 0,
    subAnimations: [
      {
        type: 'linear-reciprocate',
        axis: 'y',
        direction: 1,
        speed: 100,
        amplitude: 10,
        amplitudePositive: 1,
        amplitudeNegative: 0,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      {
        type: 'oscillate-rotation',
        axis: 'x',
        direction: 1,
        speed: 60,
        amplitude: 2,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
    ],
  },
  38: {
    type: 'multi',
    axis: 'z',
    direction: 1,
    speed: 60,
    amplitude: 11,
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
        axis: 'x',
        direction: 1,
        speed: 60,
        amplitude: 6,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      {
        type: 'linear-reciprocate',
        axis: 'y',
        direction: 1,
        speed: 100,
        amplitude: 35,
        amplitudePositive: 1,
        amplitudeNegative: 0,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      {
        type: 'oscillate-rotation',
        axis: 'z',
        direction: 1,
        speed: 60,
        amplitude: 2,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
    ],
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

// Master prototype cache for Ping-Pong Robot
let masterPingPongPrototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterPingPongPrototype(sourceScene: THREE.Group) {
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

  // Ping Pong Ball: Bouncing on top of Mesh_49_15 beneath Mesh_31_17
  const ballRadius = 0.018;
  const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 24);
  const ballMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff7300'),
    roughness: 0.25,
    metalness: 0.05,
    name: 'Ping_Pong_Ball_Mat',
  });
  const ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.name = 'Ping_Pong_Ball';
  ballMesh.position.set(0.1701, 0.4313, 0.2231);
  ballMesh.userData.isPingPongBall = true;
  template.add(ballMesh);

  template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      originalMaterials.push(mesh.material);

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          const stdMat = m as THREE.MeshStandardMaterial;
          const defaultBakedColor = (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
          partsInfo.push({
            index: partsInfo.length,
            name: m.name ? m.name.replace(/_\d+$/, '') : `Ping Pong Component ${partsInfo.length + 1}`,
            color: defaultBakedColor,
          });
        });
      } else {
        const stdMat = mesh.material as THREE.MeshStandardMaterial;
        const defaultBakedColor = (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
        partsInfo.push({
          index: partsInfo.length,
          name: mesh.userData.isPingPongBall ? 'Ping Pong Ball' : (mesh.name || `Component ${partsInfo.length + 1}`),
          color: defaultBakedColor,
        });
      }

      try {
        const bpEdges = new THREE.EdgesGeometry(mesh.geometry, mesh.userData.isPingPongBall ? 30 : 8);
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

export const PingPongRobotModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true, isAnimating = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const cloneRef = useRef<THREE.Group | null>(null);
  const meshNodesRef = useRef<MeshNodeInfo[]>([]);
  const ballNodeRef = useRef<MeshNodeInfo | null>(null);
  const paddleNodeRef = useRef<MeshNodeInfo | null>(null);
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

  // Load the CAD assembly from public/models/pingpongtest.glb
  const { scene } = useGLTF('./models/pingpongtest.glb');

  // Exact matching blueprint colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterPingPongPrototype) {
    masterPingPongPrototype = buildMasterPingPongPrototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterPingPongPrototype) {
      registerModel({
        modelId: 'ping-pong',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterPingPongPrototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultVisibility: DEFAULT_PART_VISIBILITY,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('ping-pong');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'ping-pong';

  // Create permanent scene instance ONCE
  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterPingPongPrototype!.template.clone(true);
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
          const toonArr = mesh.material.map((m, subIdx) => {
            const partNum = currentPartStart + subIdx;
            const stdMat = m as THREE.MeshStandardMaterial;
            const defaultBaked = masterPingPongPrototype?.partsInfo[partNum]?.color || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
            const initialColor = DEFAULT_PART_COLORS[partNum] || defaultBaked;
            return new THREE.MeshToonMaterial({
              color: new THREE.Color(initialColor),
              gradientMap: toonGradient,
            });
          });
          toonMap.set(mesh, toonArr);
          runningPartIdx += mesh.material.length;
        } else {
          const stdMat = mesh.material as THREE.MeshStandardMaterial;
          const defaultBaked = masterPingPongPrototype?.partsInfo[currentPartStart]?.color || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
          const initialColor = DEFAULT_PART_COLORS[currentPartStart] || defaultBaked;
          const toon = new THREE.MeshToonMaterial({
            color: new THREE.Color(initialColor),
            gradientMap: toonGradient,
          });
          toonMap.set(mesh, toon);
          runningPartIdx += 1;
        }

        if (masterPingPongPrototype!.staticEdgesList[currentMeshIdx]) {
          const bpLine = new THREE.LineSegments(
            masterPingPongPrototype!.staticEdgesList[currentMeshIdx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterPingPongPrototype!.activeEdgesList[currentMeshIdx]) {
          const celLine = new THREE.LineSegments(
            masterPingPongPrototype!.activeEdgesList[currentMeshIdx],
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
    ballNodeRef.current = list.find((n) => n.mesh.name === 'Ping_Pong_Ball') || null;
    paddleNodeRef.current = list.find((n) => n.index === 38) || null;
  }, [centeredScene]);

  // Apply materials and dynamic color overrides
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
          mesh.material = toonMatOrArray;
          let anySubVisible = false;
          toonMatOrArray.forEach((tm) => {
            const currentPartIdx = partRunningIndex++;
            const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
            const defaultBaked = masterPingPongPrototype?.partsInfo[currentPartIdx]?.color || '#cbd5e1';
            const overrideHex = (isModelCalibrating && settings.colorOverrides?.[currentPartIdx])
              ? settings.colorOverrides[currentPartIdx]
              : (DEFAULT_PART_COLORS[currentPartIdx] || defaultBaked);

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
          const defaultBaked = masterPingPongPrototype?.partsInfo[currentPartIdx]?.color || '#cbd5e1';
          const overrideHex = (isModelCalibrating && settings.colorOverrides?.[currentPartIdx])
            ? settings.colorOverrides[currentPartIdx]
            : (DEFAULT_PART_COLORS[currentPartIdx] || defaultBaked);

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
    const maxSpeed = isModelCalibrating ? settings.rotationSpeed : 0.2;
    const targetSpeed = isModelCalibrating ? (settings.autoRotate ? maxSpeed : 0) : (isActive && isRotating && isAnimating ? maxSpeed : 0);
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current && (isRotating || isModelCalibrating)) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
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
              // 'model': Assembly Model Root frame (groupRef)
              const assemblyWorldQuat = new THREE.Quaternion();
              if (groupRef.current) {
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
              let pivot = basePos.clone().add(node.centerOfMass.clone().sub(node.initialPos).applyQuaternion(accumulatedDeltaQuat));

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

      // Animate Ping Pong Ball bouncing on top of Mesh_49_15 (Part 38) beneath Mesh_31_17 (Part 17)
      const ballNode = ballNodeRef.current;
      const paddleNode = paddleNodeRef.current;
      if (ballNode && paddleNode) {
        const userBallAnim = isModelCalibrating ? settings.animationOverrides[ballNode.index] : null;
        if (!userBallAnim || userBallAnim.type === 'none') {
          // Zero-allocation dynamic contact point tracking on top face of Mesh_49_15
          scratchBallContact.copy(BALL_LOCAL_CONTACT).applyQuaternion(paddleNode.mesh.quaternion);
          const contactX = paddleNode.mesh.position.x + scratchBallContact.x;
          const contactY = paddleNode.mesh.position.y + scratchBallContact.y;
          const contactZ = paddleNode.mesh.position.z + scratchBallContact.z;

          const ballRadius = 0.018;

          if (!isAnimating) {
            // Rest pose: resting flush on top of paddle surface
            ballNode.mesh.position.set(contactX, contactY + ballRadius, contactZ);
            ballNode.mesh.scale.set(1, 1, 1);
          } else {
            // Analytic closed-form trajectory: exact mathematical curve, 0 physics simulation overhead
            const omega = (100 * Math.PI * 2) / 60; // 100 RPM paddle speed
            const phaseShift = 0; // Starts flush against the platform at t = 0
            const cyclePhase = (((time * omega - phaseShift) / (2 * Math.PI)) % 1 + 1) % 1;

            // Parabolic gravity trajectory: 4 * h * u * (1 - u)
            // Paddle peak top is at y ~ 0.433. Roof (Mesh_31_17) bottom is at y = 0.5574.
            // With maxBounceHeight = 0.070, ball top reaches y = 0.5393, staying safely beneath Mesh_31_17.
            const maxBounceHeight = 0.070;
            const bounceY = 4 * maxBounceHeight * cyclePhase * (1 - cyclePhase);

            // Squash & stretch on impact (at cyclePhase near 0 and 1)
            const distFromImpact = Math.min(cyclePhase, 1 - cyclePhase);
            let scaleY = 1;
            let scaleXZ = 1;
            if (distFromImpact < 0.08) {
              const impactIntensity = Math.sin((1 - distFromImpact / 0.08) * Math.PI);
              scaleY = 1 - 0.15 * impactIntensity;
              scaleXZ = 1 + 0.075 * impactIntensity;
            } else {
              const flightSpeed = Math.abs(1 - 2 * cyclePhase);
              scaleY = 1 + 0.06 * flightSpeed;
              scaleXZ = 1 - 0.03 * flightSpeed;
            }

            const ballY = contactY + (ballRadius * scaleY) + bounceY;
            ballNode.mesh.position.set(contactX, ballY, contactZ);
            ballNode.mesh.scale.set(scaleXZ, scaleY, scaleXZ);

            // Subtle topspin rotation
            ballNode.mesh.rotation.z += delta * 6.0;
            ballNode.mesh.rotation.x += delta * 2.0;
          }
        }
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {isModelCalibrating && settings.showGizmo && <CADPivotGizmo />}
      <primitive object={centeredScene} />
    </group>
  );
};

useGLTF.preload('./models/pingpongtest.glb');
