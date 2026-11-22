import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createToonGradientMap } from '../materials';
import { useTheme } from '../../context/ThemeContext';
import {
  useTransformCalibration,
  PartColorInfo,
  PartAnimationConfig,
} from '../../context/TransformCalibrationShared';
import { shouldBuildBlueprintEdges, ensureBlueprintEdges } from '../../utils/meshSplitter';

interface ModelProps {
  isActive?: boolean;
  isAnimating?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

const toonGradient = createToonGradientMap();

// Calibrated stage framing for Tesla Deployable Linear Actuator
const DEFAULT_OFFSET: [number, number, number] = [0.0, 0.0, 0.0];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.0, -10.0, 0.0];
const DEFAULT_SCALE = 5.2;
const DEFAULT_ROTATION_SPEED = 0.20;

// Clean-room kinematics matching cad-workspace/build/tesla_clean.py (Y-up meters in clone space)
const STROKE_1 = 0.088;
const STROKE_2 = 0.172;
const HINGE_Y_DEPLOYED = 0.416;
const HINGE_Z = 0.022;
const PIN_DY = -0.022;
const PIN_DZ = -0.024;
const RAIL_Z = -0.002;
const ROD_X = 0.042;
const CARRIAGE_Y_DEPLOYED = 0.194;
const L_ROD = 0.200;
const MAX_FLIP_RAD = (82 * Math.PI) / 180;

const STAGE1_NAMES = new Set([
  'stage_1_tube_l',
  'stage_1_tube_r',
  'stage_1_collar_l',
  'stage_1_collar_r',
]);

const STAGE2_NAMES = new Set([
  'stage_2_tube_l',
  'stage_2_tube_r',
  'top_cradle_bar',
  'top_cradle_ear_l',
  'top_cradle_ear_r',
  'plate_yoke_pin_l',
  'plate_yoke_pin_r',
]);

const PLATE_NAMES = new Set([
  'payload_plate',
  'plate_yoke_rib',
  'plate_yoke_crank',
  'plate_yoke_clevis_pin',
]);

const CARRIAGE_NAMES = new Set([
  'rail_carriage_body',
  'rail_carriage_ear',
  'rail_carriage_pin',
]);

const ROD_NAMES = new Set([
  'link_rod_shaft',
  'link_rod_head_bot',
  'link_rod_head_top',
]);

const PART_NAME_COLORS: Record<string, string> = {
  base_plate: '#64748b',
  top_cradle_bar: '#64748b',
  top_cradle_ear_l: '#64748b',
  top_cradle_ear_r: '#64748b',
  base_foot_l: '#334155',
  base_foot_r: '#334155',
  base_col_mount_l: '#334155',
  base_col_mount_r: '#334155',
  motor_mount: '#334155',
  motor_cap: '#334155',
  plate_yoke_rib: '#334155',
  plate_yoke_crank: '#334155',
  guide_rail_tab_bot: '#334155',
  guide_rail_tab_top: '#334155',
  motor_body: '#1e293b',
  link_rod_head_bot: '#1e293b',
  link_rod_head_top: '#1e293b',
  pulley_motor: '#3b82f6',
  pulley_l: '#3b82f6',
  pulley_r: '#3b82f6',
  pulley_idler_l: '#3b82f6',
  pulley_idler_r: '#3b82f6',
  rail_carriage_body: '#3b82f6',
  drive_belt: '#0f172a',
  outer_column_l: '#94a3b8',
  outer_column_r: '#94a3b8',
  outer_collar_l: '#2563eb',
  outer_collar_r: '#2563eb',
  rail_carriage_ear: '#2563eb',
  stage_1_tube_l: '#cbd5e1',
  stage_1_tube_r: '#cbd5e1',
  plate_yoke_pin_l: '#cbd5e1',
  plate_yoke_pin_r: '#cbd5e1',
  plate_yoke_clevis_pin: '#cbd5e1',
  rail_carriage_pin: '#cbd5e1',
  link_rod_shaft: '#cbd5e1',
  stage_1_collar_l: '#38bdf8',
  stage_1_collar_r: '#38bdf8',
  stage_2_tube_l: '#e2e8f0',
  stage_2_tube_r: '#e2e8f0',
  payload_plate: '#e2e8f0',
  guide_rail: '#475569',
};

const DEFAULT_PART_VISIBILITY: Record<number, boolean> = {};
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {};

const smootherstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * t * (t * (t * 6 - 15) + 10);
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

let masterTeslaPrototype: {
  template: THREE.Group;
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
  defaultColors: Record<number, string>;
} | null = null;

function buildMasterTeslaPrototype(sourceScene: THREE.Group) {
  const template = sourceScene.clone(true);
  const staticEdgesList: THREE.EdgesGeometry[] = [];
  const activeEdgesList: THREE.EdgesGeometry[] = [];
  const partsInfo: PartColorInfo[] = [];
  const defaultColors: Record<number, string> = {};

  template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      const partIdx = partsInfo.length;
      const partName = mesh.name || `Component ${partIdx + 1}`;
      const stdMat = Array.isArray(mesh.material)
        ? (mesh.material[0] as THREE.MeshStandardMaterial)
        : (mesh.material as THREE.MeshStandardMaterial);

      const fallbackHex = stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1';
      const hex = PART_NAME_COLORS[partName] || fallbackHex;
      defaultColors[partIdx] = hex;
      partsInfo.push({
        index: partIdx,
        name: partName,
        color: hex,
      });

      try {
        if (shouldBuildBlueprintEdges()) {
          staticEdgesList.push(new THREE.EdgesGeometry(mesh.geometry, 8));
        }
        activeEdgesList.push(new THREE.EdgesGeometry(mesh.geometry, 28));
      } catch {
        // Ignore non-standard geometries
      }
    }
  });

  return { template, staticEdgesList, activeEdgesList, partsInfo, defaultColors };
}

export const TeslaActuatorModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const stage1GroupRef = useRef<THREE.Group | null>(null);
  const stage2GroupRef = useRef<THREE.Group | null>(null);
  const platePivotRef = useRef<THREE.Group | null>(null);
  const carriageGroupRef = useRef<THREE.Group | null>(null);
  const rodPivotRef = useRef<THREE.Group | null>(null);

  const currentSpeedRef = useRef(0);
  const localTimeRef = useRef(0);
  const easeInTimeRef = useRef(0);

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

  const { scene } = useGLTF('./models/TeslaActuatorClean.glb');

  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  if (!masterTeslaPrototype) {
    masterTeslaPrototype = buildMasterTeslaPrototype(scene);
  }
  ensureBlueprintEdges(masterTeslaPrototype.template, masterTeslaPrototype.staticEdgesList);

  useEffect(() => {
    if (masterTeslaPrototype) {
      registerModel({
        modelId: 'tesla-actuator',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterTeslaPrototype.partsInfo,
        defaultColors: masterTeslaPrototype.defaultColors,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
        defaultVisibility: DEFAULT_PART_VISIBILITY,
        defaultRotationSpeed: DEFAULT_ROTATION_SPEED,
      });
    }
  }, [registerModel]);

  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('tesla-actuator');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'tesla-actuator';

  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterTeslaPrototype!.template.clone(true);
    const toonMap = new Map<THREE.Mesh, THREE.MeshToonMaterial>();
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

    const stage1Meshes: THREE.Mesh[] = [];
    const stage2Meshes: THREE.Mesh[] = [];
    const plateMeshes: THREE.Mesh[] = [];
    const carriageMeshes: THREE.Mesh[] = [];
    const rodMeshes: THREE.Mesh[] = [];

    let meshIdx = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const idx = meshIdx++;
        mesh.userData.cadPartIndex = idx;
        mesh.userData.isCadMesh = true;

        const initColor = masterTeslaPrototype!.defaultColors[idx] || '#cbd5e1';
        toonMap.set(
          mesh,
          new THREE.MeshToonMaterial({
            color: new THREE.Color(initColor),
            gradientMap: toonGradient,
          })
        );

        if (masterTeslaPrototype!.staticEdgesList[idx]) {
          const bpLine = new THREE.LineSegments(
            masterTeslaPrototype!.staticEdgesList[idx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterTeslaPrototype!.activeEdgesList[idx]) {
          const celLine = new THREE.LineSegments(
            masterTeslaPrototype!.activeEdgesList[idx],
            celLineMat
          );
          mesh.add(celLine);
          celLines.push(celLine);
        }

        const baseName = (mesh.name || '').replace(/\.\d+$/, '');
        if (STAGE1_NAMES.has(baseName)) stage1Meshes.push(mesh);
        else if (STAGE2_NAMES.has(baseName)) stage2Meshes.push(mesh);
        else if (PLATE_NAMES.has(baseName)) plateMeshes.push(mesh);
        else if (CARRIAGE_NAMES.has(baseName)) carriageMeshes.push(mesh);
        else if (ROD_NAMES.has(baseName)) rodMeshes.push(mesh);
      }
    });

    // Center unrotated geometry around origin while keeping clone inner space aligned with build123d coordinates
    const bbox = new THREE.Box3().setFromObject(clone);
    const center = bbox.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -center.y, -center.z);

    const stage1Group = new THREE.Group();
    const stage2Group = new THREE.Group();
    const platePivotGroup = new THREE.Group();
    platePivotGroup.position.set(0, HINGE_Y_DEPLOYED, HINGE_Z);
    const carriageGroup = new THREE.Group();
    const rodPivotGroup = new THREE.Group();
    rodPivotGroup.position.set(ROD_X, CARRIAGE_Y_DEPLOYED, RAIL_Z);

    clone.add(stage1Group);
    clone.add(stage2Group);
    clone.add(platePivotGroup);
    clone.add(carriageGroup);
    clone.add(rodPivotGroup);

    clone.updateMatrixWorld(true);
    stage1Meshes.forEach((m) => stage1Group.attach(m));
    stage2Meshes.forEach((m) => stage2Group.attach(m));
    plateMeshes.forEach((m) => platePivotGroup.attach(m));
    carriageMeshes.forEach((m) => carriageGroup.attach(m));
    rodMeshes.forEach((m) => rodPivotGroup.attach(m));

    stage1GroupRef.current = stage1Group;
    stage2GroupRef.current = stage2Group;
    platePivotRef.current = platePivotGroup;
    carriageGroupRef.current = carriageGroup;
    rodPivotRef.current = rodPivotGroup;

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

  const applyKinematics = useCallback((p: number) => {
    const clampedP = Math.max(0, Math.min(1, p));
    const stage1DeltaY = -(1 - clampedP) * STROKE_1;
    const stage2DeltaY = -(1 - clampedP) * STROKE_2;
    const hingeY = HINGE_Y_DEPLOYED + stage2DeltaY;

    const flipT = smootherstep(0.32, 0.96, clampedP);
    const plateAngle = (1 - flipT) * MAX_FLIP_RAD;

    const cosA = Math.cos(plateAngle);
    const sinA = Math.sin(plateAngle);
    const pinTopY = hingeY + (PIN_DY * cosA - PIN_DZ * sinA);
    const pinTopZ = HINGE_Z + (PIN_DY * sinA + PIN_DZ * cosA);

    const dz = pinTopZ - RAIL_Z;
    const dy = Math.sqrt(Math.max(1e-6, L_ROD * L_ROD - dz * dz));
    const carriageY = pinTopY - dy;

    if (stage1GroupRef.current) {
      stage1GroupRef.current.position.y = stage1DeltaY;
    }
    if (stage2GroupRef.current) {
      stage2GroupRef.current.position.y = stage2DeltaY;
    }
    if (platePivotRef.current) {
      platePivotRef.current.position.set(0, hingeY, HINGE_Z);
      platePivotRef.current.rotation.x = plateAngle;
    }
    if (carriageGroupRef.current) {
      carriageGroupRef.current.position.y = carriageY - CARRIAGE_Y_DEPLOYED;
    }
    if (rodPivotRef.current) {
      rodPivotRef.current.position.set(ROD_X, carriageY, RAIL_Z);
      // Local +Z maps forward; rotating around -X leans +Y axis toward dz (-Y->+Z)
      rodPivotRef.current.rotation.x = Math.atan2(dz, dy);
    }
  }, []);

  // Update shaded/blueprint materials, edges, and studio highlights
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
    const defaultColors = masterTeslaPrototype!.defaultColors;

    let partRunningIndex = 0;
    toonMaterialsMap.forEach((toonMat, mesh) => {
      const idx = partRunningIndex++;
      const isPartVisible = isModelCalibrating
        ? settings.visibilityOverrides?.[idx] !== false
        : DEFAULT_PART_VISIBILITY[idx] !== false;

      if (isShaded) {
        const isPartSelected = isModelCalibrating && selectedPartIndex === idx;
        const overrideHex =
          isModelCalibrating && settings.colorOverrides?.[idx]
            ? settings.colorOverrides[idx]
            : defaultColors[idx] || '#cbd5e1';

        mesh.material = toonMat;
        toonMat.visible = isPartVisible;
        toonMat.color.set(isPartSelected ? '#38bdf8' : overrideHex);
        toonMat.emissive.set(isPartSelected ? '#0284c7' : '#000000');
      } else {
        mesh.material = bpMat;
      }
      mesh.visible = isPartVisible;
    });
  }, [
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

  useEffect(() => {
    return () => {
      const uniqueMats = new Set<THREE.Material>();
      toonMaterialsMap.forEach((m) => uniqueMats.add(m));
      blueprintEdgeLines.forEach((l) => {
        if (l.material instanceof THREE.Material) uniqueMats.add(l.material);
      });
      celEdgeLines.forEach((l) => {
        if (l.material instanceof THREE.Material) uniqueMats.add(l.material);
      });
      uniqueMats.forEach((m) => m.dispose());
    };
  }, [toonMaterialsMap, blueprintEdgeLines, celEdgeLines]);

  useEffect(() => {
    if (!isModelCalibrating && !isActive) {
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0);
      currentSpeedRef.current = 0;
      localTimeRef.current = 0;
      easeInTimeRef.current = 0;
      applyKinematics(1);
    }
  }, [isActive, isModelCalibrating, applyKinematics]);

  useFrame((_state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.035);

    if (pivotRef.current) {
      const offsetX = isModelCalibrating ? settings.offsetX : DEFAULT_OFFSET[0];
      const offsetY = isModelCalibrating ? settings.offsetY : DEFAULT_OFFSET[1];
      const offsetZ = isModelCalibrating ? settings.offsetZ : DEFAULT_OFFSET[2];
      const rotX = isModelCalibrating
        ? (settings.rotX * Math.PI) / 180
        : (DEFAULT_ROTATION_DEG[0] * Math.PI) / 180;
      const rotY = isModelCalibrating
        ? (settings.rotY * Math.PI) / 180
        : (DEFAULT_ROTATION_DEG[1] * Math.PI) / 180;
      const rotZ = isModelCalibrating
        ? (settings.rotZ * Math.PI) / 180
        : (DEFAULT_ROTATION_DEG[2] * Math.PI) / 180;

      pivotRef.current.rotation.order = 'YXZ';
      pivotRef.current.rotation.set(rotX, rotY, rotZ);
      pivotRef.current.position.set(offsetX, offsetY, offsetZ);
    }

    const baseScale = isModelCalibrating ? settings.scale : DEFAULT_SCALE;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(baseScale);
    }

    if (!isActive && !isModelCalibrating) {
      if (groupRef.current) {
        groupRef.current.rotation.set(0, 0, 0);
      }
      currentSpeedRef.current = 0;
      localTimeRef.current = 0;
      easeInTimeRef.current = 0;
      applyKinematics(1);
      return;
    }

    const isPlaying = isModelCalibrating ? (isAnimating ?? true) : isActive && isAnimating;
    if (isPlaying) {
      easeInTimeRef.current += delta;
    } else {
      easeInTimeRef.current = 0;
    }
    const easeProgress = Math.min(1, easeInTimeRef.current / 1.2);
    const animEase = isModelCalibrating
      ? 1
      : easeProgress * easeProgress * (3 - 2 * easeProgress);

    if (isPlaying) {
      localTimeRef.current += delta * animEase;
    }

    const maxSpeed = isModelCalibrating ? settings.rotationSpeed : DEFAULT_ROTATION_SPEED;
    const targetSpeed = isModelCalibrating
      ? settings.autoRotate
        ? maxSpeed
        : 0
      : isActive && isRotating && isAnimating
      ? maxSpeed * animEase
      : 0;
    currentSpeedRef.current = THREE.MathUtils.damp(
      currentSpeedRef.current,
      targetSpeed,
      4.0,
      delta
    );

    if (groupRef.current && (isRotating || isModelCalibrating)) {
      groupRef.current.rotation.x = 0;
      groupRef.current.rotation.z = 0;
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      }
    }

    // Cosine deployment cycle starting cleanly at deployed rest pose (p = 1 at t = 0)
    // and freezing in place when paused in ProjectModal
    const p = 0.5 + 0.5 * Math.cos(localTimeRef.current * 1.15);
    applyKinematics(p);
  });

  return (
    <group ref={groupRef}>
      <primitive object={centeredScene} />
    </group>
  );
};
