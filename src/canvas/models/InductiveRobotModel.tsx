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

// Calibrated stage framing for Inductive IR3 Autonomous EV Charging Robot
const DEFAULT_OFFSET: [number, number, number] = [0.0, -0.05, 0.0];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.0, -18.0, 0.0];
const DEFAULT_SCALE = 2.45;
const DEFAULT_ROTATION_SPEED = 0.22;

// Clean-room kinematics matching cad-workspace/build/inductive_clean.py (Y-up meters in clone space)
// build123d (X_bd, Y_bd, Z_bd) -> Three.js (X = X_bd, Y = Z_bd, Z = -Y_bd)
const WHEEL_X = 0.2775;
const WHEEL_Z_THREE = 0.256; // front = +WHEEL_Z_THREE, rear = -WHEEL_Z_THREE
const WHEEL_Y_THREE = 0.165;

const ARM_BASE_Z_THREE = 0.295; // -(-0.295)
const ARM_BASE_Y_THREE = 0.533;
const SHOULDER_Y_THREE = 0.650;

const L1 = 0.280;
const L2 = 0.270;

const WRIST_DOCK_FWD = 0.415;
const WRIST_DOCK_UP = 0.240;
const WRIST_PRE_FWD = 0.265;
const WRIST_PRE_UP = 0.240;
const WRIST_STOW_FWD = 0.185;
const WRIST_STOW_UP = 0.130;
const STOW_YAW_RAD = 0.18;
const STOW_WHEEL_RAD = -0.65;

interface ArmIKResult {
  theta1: number;
  theta2Abs: number;
  elFwd: number;
  elUp: number;
}

function solveArmIK(fwd: number, up: number): ArmIKResult {
  const r2 = fwd * fwd + up * up;
  const r = Math.sqrt(Math.max(1e-8, r2));
  const alpha = Math.atan2(up, fwd);
  const cosBeta = Math.max(-0.9999, Math.min(0.9999, (r2 + L1 * L1 - L2 * L2) / (2 * r * L1)));
  const beta = Math.acos(cosBeta);
  const phi1 = alpha - beta;
  const elFwd = L1 * Math.cos(phi1);
  const elUp = L1 * Math.sin(phi1);
  const phi2 = Math.atan2(up - elUp, fwd - elFwd);
  return {
    theta1: Math.PI / 2 - phi1,
    theta2Abs: Math.PI / 2 - phi2,
    elFwd,
    elUp,
  };
}

const REST_IK = solveArmIK(WRIST_DOCK_FWD, WRIST_DOCK_UP);
const ELBOW_Y_REST = SHOULDER_Y_THREE + REST_IK.elUp;
const ELBOW_Z_REST = ARM_BASE_Z_THREE + REST_IK.elFwd;
const WRIST_Y_REST = SHOULDER_Y_THREE + WRIST_DOCK_UP;
const WRIST_Z_REST = ARM_BASE_Z_THREE + WRIST_DOCK_FWD;

// 6-phase EV docking cycle timing (8.0 s total; t = 0 sits cleanly in the Docked pause)
const CYCLE_PERIOD = 8.0;
const INITIAL_PHASE_OFFSET = 0.70;

const WHEEL_FL_NAMES = new Set(['wheel_tire_fl', 'wheel_hub_fl']);
const WHEEL_FR_NAMES = new Set(['wheel_tire_fr', 'wheel_hub_fr']);
const WHEEL_RL_NAMES = new Set(['wheel_tire_rl', 'wheel_hub_rl']);
const WHEEL_RR_NAMES = new Set(['wheel_tire_rr', 'wheel_hub_rr']);

const ARM_BASE_NAMES = new Set(['arm_base_collar', 'arm_base_turret', 'arm_base_ring']);
const ARM_UPPER_NAMES = new Set(['arm_upper_link', 'arm_shoulder_ring', 'arm_elbow_outer_ring']);
const ARM_FOREARM_NAMES = new Set(['arm_forearm_link', 'arm_elbow_inner_ring', 'arm_wrist_inner_ring']);
const ARM_WRIST_NAMES = new Set([
  'arm_wrist_drum',
  'arm_wrist_outer_ring',
  'arm_coupler_neck',
  'arm_coupler_body',
  'arm_coupler_status',
  'arm_coupler_nozzle',
]);

const PART_NAME_COLORS: Record<string, string> = {
  chassis_lower_pan: '#1e293b',
  chassis_side_wall_l: '#1e293b',
  chassis_side_wall_r: '#1e293b',
  bumper_front: '#1e293b',
  bumper_rear: '#1e293b',
  gantry_post_l: '#1e293b',
  gantry_post_r: '#1e293b',
  gantry_crossbar: '#1e293b',
  lidar_mast: '#1e293b',
  side_compute_bracket: '#1e293b',
  rear_battery_pack: '#1e293b',
  arm_base_collar: '#1e293b',
  arm_coupler_body: '#1e293b',
  husky_status_strip: '#0f172a',
  front_depth_cam_lens: '#0f172a',
  mast_depth_cam_lens: '#0f172a',
  lidar_window: '#0f172a',
  wheel_tire_fl: '#0f172a',
  wheel_tire_fr: '#0f172a',
  wheel_tire_rl: '#0f172a',
  wheel_tire_rr: '#0f172a',
  husky_rear_cowl_l: '#f59e0b',
  husky_rear_cowl_r: '#f59e0b',
  husky_side_trim_l: '#f59e0b',
  husky_side_trim_r: '#f59e0b',
  husky_front_trim_l: '#f59e0b',
  husky_front_trim_r: '#f59e0b',
  inverter_yellow_shroud: '#f59e0b',
  pedestal_base_plate: '#94a3b8',
  pedestal_column: '#94a3b8',
  lidar_cap: '#94a3b8',
  pedestal_top_plate: '#334155',
  front_depth_cam_mount: '#334155',
  wheel_hub_fl: '#334155',
  wheel_hub_fr: '#334155',
  wheel_hub_rl: '#334155',
  wheel_hub_rr: '#334155',
  axle_stub_fl: '#334155',
  axle_stub_fr: '#334155',
  axle_stub_rl: '#334155',
  axle_stub_rr: '#334155',
  side_compute_box: '#334155',
  rear_battery_tray: '#334155',
  inverter_body: '#475569',
  battery_pack_main: '#1e3a8a',
  battery_pack_top: '#b91c1c',
  front_depth_cam_body: '#cbd5e1',
  mast_depth_cam_body: '#cbd5e1',
  sheet_metal_bridge: '#cbd5e1',
  lidar_base: '#cbd5e1',
  arm_coupler_nozzle: '#cbd5e1',
  rear_battery_strap: '#dc2626',
  arm_base_turret: '#f1f5f9',
  arm_upper_link: '#f1f5f9',
  arm_forearm_link: '#f1f5f9',
  arm_wrist_drum: '#f1f5f9',
  arm_coupler_neck: '#f1f5f9',
  arm_base_ring: '#f97316',
  arm_shoulder_ring: '#f97316',
  arm_elbow_outer_ring: '#f97316',
  arm_elbow_inner_ring: '#f97316',
  arm_wrist_inner_ring: '#f97316',
  arm_wrist_outer_ring: '#f97316',
  arm_coupler_status: '#10b981',
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

let masterInductivePrototype: {
  template: THREE.Group;
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
  defaultColors: Record<number, string>;
} | null = null;

function buildMasterInductivePrototype(sourceScene: THREE.Group) {
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

export const InductiveRobotModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group | null>(null);

  const wheelFLRef = useRef<THREE.Group | null>(null);
  const wheelFRRef = useRef<THREE.Group | null>(null);
  const wheelRLRef = useRef<THREE.Group | null>(null);
  const wheelRRRef = useRef<THREE.Group | null>(null);

  const armBaseRef = useRef<THREE.Group | null>(null);
  const armShoulderRef = useRef<THREE.Group | null>(null);
  const armElbowRef = useRef<THREE.Group | null>(null);
  const armWristRef = useRef<THREE.Group | null>(null);

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

  const { scene } = useGLTF('./models/InductiveRobotClean.glb');

  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  if (!masterInductivePrototype) {
    masterInductivePrototype = buildMasterInductivePrototype(scene);
  }
  ensureBlueprintEdges(masterInductivePrototype.template, masterInductivePrototype.staticEdgesList);

  useEffect(() => {
    if (masterInductivePrototype) {
      registerModel({
        modelId: 'inductive-robot',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterInductivePrototype.partsInfo,
        defaultColors: masterInductivePrototype.defaultColors,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
        defaultVisibility: DEFAULT_PART_VISIBILITY,
        defaultRotationSpeed: DEFAULT_ROTATION_SPEED,
      });
    }
  }, [registerModel]);

  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('inductive-robot');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'inductive-robot';

  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterInductivePrototype!.template.clone(true);
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

    const wheelFLMeshes: THREE.Mesh[] = [];
    const wheelFRMeshes: THREE.Mesh[] = [];
    const wheelRLMeshes: THREE.Mesh[] = [];
    const wheelRRMeshes: THREE.Mesh[] = [];

    const armBaseMeshes: THREE.Mesh[] = [];
    const armUpperMeshes: THREE.Mesh[] = [];
    const armForearmMeshes: THREE.Mesh[] = [];
    const armWristMeshes: THREE.Mesh[] = [];

    let meshIdx = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const idx = meshIdx++;
        mesh.userData.cadPartIndex = idx;
        mesh.userData.isCadMesh = true;

        const initColor = masterInductivePrototype!.defaultColors[idx] || '#cbd5e1';
        toonMap.set(
          mesh,
          new THREE.MeshToonMaterial({
            color: new THREE.Color(initColor),
            gradientMap: toonGradient,
          })
        );

        if (masterInductivePrototype!.staticEdgesList[idx]) {
          const bpLine = new THREE.LineSegments(
            masterInductivePrototype!.staticEdgesList[idx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterInductivePrototype!.activeEdgesList[idx]) {
          const celLine = new THREE.LineSegments(
            masterInductivePrototype!.activeEdgesList[idx],
            celLineMat
          );
          mesh.add(celLine);
          celLines.push(celLine);
        }

        const baseName = (mesh.name || '').replace(/\.\d+$/, '');
        if (WHEEL_FL_NAMES.has(baseName)) wheelFLMeshes.push(mesh);
        else if (WHEEL_FR_NAMES.has(baseName)) wheelFRMeshes.push(mesh);
        else if (WHEEL_RL_NAMES.has(baseName)) wheelRLMeshes.push(mesh);
        else if (WHEEL_RR_NAMES.has(baseName)) wheelRRMeshes.push(mesh);
        else if (ARM_BASE_NAMES.has(baseName)) armBaseMeshes.push(mesh);
        else if (ARM_UPPER_NAMES.has(baseName)) armUpperMeshes.push(mesh);
        else if (ARM_FOREARM_NAMES.has(baseName)) armForearmMeshes.push(mesh);
        else if (ARM_WRIST_NAMES.has(baseName)) armWristMeshes.push(mesh);
      }
    });

    // Center overall robot silhouette at origin while keeping clone inner space in GLB meters
    const bbox = new THREE.Box3().setFromObject(clone);
    const center = bbox.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -center.y, -center.z);

    const wheelFLGroup = new THREE.Group();
    wheelFLGroup.position.set(-WHEEL_X, WHEEL_Y_THREE, WHEEL_Z_THREE);
    const wheelFRGroup = new THREE.Group();
    wheelFRGroup.position.set(WHEEL_X, WHEEL_Y_THREE, WHEEL_Z_THREE);
    const wheelRLGroup = new THREE.Group();
    wheelRLGroup.position.set(-WHEEL_X, WHEEL_Y_THREE, -WHEEL_Z_THREE);
    const wheelRRGroup = new THREE.Group();
    wheelRRGroup.position.set(WHEEL_X, WHEEL_Y_THREE, -WHEEL_Z_THREE);

    const armBaseGroup = new THREE.Group();
    armBaseGroup.position.set(0, ARM_BASE_Y_THREE, ARM_BASE_Z_THREE);

    const armShoulderGroup = new THREE.Group();
    armShoulderGroup.position.set(0, SHOULDER_Y_THREE - ARM_BASE_Y_THREE, 0);

    const armElbowGroup = new THREE.Group();
    armElbowGroup.position.set(0, ELBOW_Y_REST - SHOULDER_Y_THREE, ELBOW_Z_REST - ARM_BASE_Z_THREE);

    const armWristGroup = new THREE.Group();
    armWristGroup.position.set(0, WRIST_Y_REST - ELBOW_Y_REST, WRIST_Z_REST - ELBOW_Z_REST);

    clone.add(wheelFLGroup);
    clone.add(wheelFRGroup);
    clone.add(wheelRLGroup);
    clone.add(wheelRRGroup);
    clone.add(armBaseGroup);
    armBaseGroup.add(armShoulderGroup);
    armShoulderGroup.add(armElbowGroup);
    armElbowGroup.add(armWristGroup);

    clone.updateMatrixWorld(true);
    wheelFLMeshes.forEach((m) => wheelFLGroup.attach(m));
    wheelFRMeshes.forEach((m) => wheelFRGroup.attach(m));
    wheelRLMeshes.forEach((m) => wheelRLGroup.attach(m));
    wheelRRMeshes.forEach((m) => wheelRRGroup.attach(m));
    armBaseMeshes.forEach((m) => armBaseGroup.attach(m));
    armUpperMeshes.forEach((m) => armShoulderGroup.attach(m));
    armForearmMeshes.forEach((m) => armElbowGroup.attach(m));
    armWristMeshes.forEach((m) => armWristGroup.attach(m));

    wheelFLRef.current = wheelFLGroup;
    wheelFRRef.current = wheelFRGroup;
    wheelRLRef.current = wheelRLGroup;
    wheelRRRef.current = wheelRRGroup;

    armBaseRef.current = armBaseGroup;
    armShoulderRef.current = armShoulderGroup;
    armElbowRef.current = armElbowGroup;
    armWristRef.current = armWristGroup;

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

  const applyKinematics = useCallback((timeSec: number) => {
    const rawPhase = (timeSec + INITIAL_PHASE_OFFSET) % CYCLE_PERIOD;
    const phase = rawPhase < 0 ? rawPhase + CYCLE_PERIOD : rawPhase;

    let fwd = WRIST_DOCK_FWD;
    let up = WRIST_DOCK_UP;
    let yawRad = 0;
    let wheelAngle = 0;

    if (phase < 1.4) {
      // Phase 1: Docked pause
      fwd = WRIST_DOCK_FWD;
      up = WRIST_DOCK_UP;
      yawRad = 0;
      wheelAngle = 0;
    } else if (phase < 2.4) {
      // Phase 2: Straight horizontal unplug along constant height
      const k = smootherstep(1.4, 2.4, phase);
      fwd = WRIST_DOCK_FWD + (WRIST_PRE_FWD - WRIST_DOCK_FWD) * k;
      up = WRIST_DOCK_UP;
    } else if (phase < 4.0) {
      // Phase 3: Fold arm to Stowed-Ready while backing slightly away
      const k = smootherstep(2.4, 4.0, phase);
      fwd = WRIST_PRE_FWD + (WRIST_STOW_FWD - WRIST_PRE_FWD) * k;
      up = WRIST_PRE_UP + (WRIST_STOW_UP - WRIST_PRE_UP) * k;
      yawRad = STOW_YAW_RAD * k;
      wheelAngle = STOW_WHEEL_RAD * k;
    } else if (phase < 5.4) {
      // Phase 4: Stowed-Ready pause
      fwd = WRIST_STOW_FWD;
      up = WRIST_STOW_UP;
      yawRad = STOW_YAW_RAD;
      wheelAngle = STOW_WHEEL_RAD;
    } else if (phase < 7.0) {
      // Phase 5: Subtle approach roll forward + unfold arm to Pre-Dock height
      const k = smootherstep(5.4, 7.0, phase);
      fwd = WRIST_STOW_FWD + (WRIST_PRE_FWD - WRIST_STOW_FWD) * k;
      up = WRIST_STOW_UP + (WRIST_PRE_UP - WRIST_STOW_UP) * k;
      yawRad = STOW_YAW_RAD * (1 - k);
      wheelAngle = STOW_WHEEL_RAD * (1 - k);
    } else {
      // Phase 6: Straight horizontal plug-in to Docked height
      const k = smootherstep(7.0, 8.0, phase);
      fwd = WRIST_PRE_FWD + (WRIST_DOCK_FWD - WRIST_PRE_FWD) * k;
      up = WRIST_PRE_UP;
    }

    const r2 = fwd * fwd + up * up;
    const r = Math.sqrt(Math.max(1e-8, r2));
    const alpha = Math.atan2(up, fwd);
    const cosBeta = Math.max(-0.9999, Math.min(0.9999, (r2 + L1 * L1 - L2 * L2) / (2 * r * L1)));
    const beta = Math.acos(cosBeta);
    const phi1 = alpha - beta;
    const phi2 = Math.atan2(up - L1 * Math.sin(phi1), fwd - L1 * Math.cos(phi1));

    const theta1 = Math.PI / 2 - phi1;
    const theta2Abs = Math.PI / 2 - phi2;

    const dq1 = theta1 - REST_IK.theta1;
    const dq2 = theta2Abs - theta1 - (REST_IK.theta2Abs - REST_IK.theta1);
    const dq3 = -(dq1 + dq2);

    if (armBaseRef.current) armBaseRef.current.rotation.y = yawRad;
    if (armShoulderRef.current) armShoulderRef.current.rotation.x = dq1;
    if (armElbowRef.current) armElbowRef.current.rotation.x = dq2;
    if (armWristRef.current) armWristRef.current.rotation.x = dq3;

    if (wheelFLRef.current) wheelFLRef.current.rotation.x = wheelAngle;
    if (wheelFRRef.current) wheelFRRef.current.rotation.x = wheelAngle;
    if (wheelRLRef.current) wheelRLRef.current.rotation.x = wheelAngle;
    if (wheelRRRef.current) wheelRRRef.current.rotation.x = wheelAngle;
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
    const defaultColors = masterInductivePrototype!.defaultColors;

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
      applyKinematics(0);
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
      applyKinematics(0);
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

    applyKinematics(localTimeRef.current);
  });

  return (
    <group ref={groupRef}>
      <primitive object={centeredScene} />
    </group>
  );
};
