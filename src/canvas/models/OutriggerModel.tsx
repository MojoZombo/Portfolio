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

// Calibrated stage framing for Raise Robotics Tracked Construction Robot
const DEFAULT_OFFSET: [number, number, number] = [0.0, 0.08, 0.0];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.0, -22.0, 0.0];
const DEFAULT_SCALE = 1.68;
const DEFAULT_ROTATION_SPEED = 0.20;

// Clean-room kinematics matching cad-workspace/build/raise_outrigger_clean.py (Y-up meters in clone space)
// build123d (X_bd, Y_bd, Z_bd) -> Three.js (X = X_bd, Y = Z_bd, Z = -Y_bd)
const S_LIFT = 0.025;
const S_FREE = 0.190;
const S_TOTAL = S_LIFT + S_FREE;

const ARM_MOUNT_X = 0.240;
const ARM_SHOULDER_Z_THREE = 0.790; // -(-0.790)
const ARM_SHOULDER_Y_THREE = 1.080;

const UR_L1 = 0.480;
const UR_L2 = 0.440;
const YAW_REST_RAD = (18.0 * Math.PI) / 180.0;

const REST_FWD_L = 0.560;
const REST_UP_L = -0.520;
const REST_FWD_R = 0.620;
const REST_UP_R = -0.450;

const WORK_HIGH_FWD = 0.720;
const WORK_HIGH_UP = -0.240;
const WORK_LOW_FWD = 0.540;
const WORK_LOW_UP = -0.560;

const STOW_FWD = 0.380;
const STOW_UP = -0.280;
const STOW_YAW_DELTA_RAD = (8.0 * Math.PI) / 180.0;

// 10.0 s dwell-padded cycle; t = 0 starts cleanly in Outriggers Deployed Rest pose (u = 1)
const CYCLE_PERIOD = 10.0;
const INITIAL_PHASE_OFFSET = 0.55;

interface ArmIKResult {
  theta1: number;
  theta2Abs: number;
  elFwd: number;
  elUp: number;
}

function solveURIK(fwd: number, up: number): ArmIKResult {
  const r2 = fwd * fwd + up * up;
  const r = Math.sqrt(Math.max(1e-8, r2));
  const alpha = Math.atan2(up, fwd);
  const cosBeta = Math.max(-0.9999, Math.min(0.9999, (r2 + UR_L1 * UR_L1 - UR_L2 * UR_L2) / (2 * r * UR_L1)));
  const beta = Math.acos(cosBeta);
  const phi1 = alpha + beta; // Elbow-up branch matching Raise workshop stance
  const elFwd = UR_L1 * Math.cos(phi1);
  const elUp = UR_L1 * Math.sin(phi1);
  const phi2 = Math.atan2(up - elUp, fwd - elFwd);
  return {
    theta1: Math.PI / 2 - phi1,
    theta2Abs: Math.PI / 2 - phi2,
    elFwd,
    elUp,
  };
}

const REST_IK_L = solveURIK(REST_FWD_L, REST_UP_L);
const REST_IK_R = solveURIK(REST_FWD_R, REST_UP_R);

const OUTRIGGER_LEG_PREFIXES = ['outrigger_rod_', 'outrigger_clevis_', 'outrigger_foot_'];

const ARM_L_SH = new Set(['ur_shoulder_l', 'ur_shoulder_ring_l']);
const ARM_L_UP = new Set(['ur_upper_arm_l', 'ur_upper_ring_l', 'ur_elbow_outer_ring_l']);
const ARM_L_FORE = new Set(['ur_forearm_l', 'ur_elbow_ring_l', 'ur_wrist_inner_ring_l']);
const ARM_L_WRIST = new Set(['ur_wrist_l', 'ur_wrist_ring_l', 'ur_tool_body_l', 'ur_tool_tip_l']);

const ARM_R_SH = new Set(['ur_shoulder_r', 'ur_shoulder_ring_r']);
const ARM_R_UP = new Set(['ur_upper_arm_r', 'ur_upper_ring_r', 'ur_elbow_outer_ring_r']);
const ARM_R_FORE = new Set(['ur_forearm_r', 'ur_elbow_ring_r', 'ur_wrist_inner_ring_r']);
const ARM_R_WRIST = new Set(['ur_wrist_r', 'ur_wrist_ring_r', 'ur_tool_body_r', 'ur_tool_tip_r']);

const PART_NAME_COLORS: Record<string, string> = {
  track_belt_l: '#111827',
  track_belt_r: '#111827',
  bogie_guard_l: '#1e293b',
  bogie_guard_r: '#1e293b',
  enclosure_latches_l: '#1e293b',
  enclosure_latches_r: '#1e293b',
  side_vent_l: '#1e293b',
  side_vent_r: '#1e293b',
  turret_sensors: '#1e293b',
  outrigger_housing_fl: '#1e293b',
  outrigger_housing_fr: '#1e293b',
  outrigger_housing_rl: '#1e293b',
  outrigger_housing_rr: '#1e293b',
  tracked_base_hull: '#334155',
  road_wheels_l: '#334155',
  road_wheels_r: '#334155',
  outrigger_mount_fl: '#334155',
  outrigger_mount_fr: '#334155',
  outrigger_mount_rl: '#334155',
  outrigger_mount_rr: '#334155',
  outrigger_clevis_fl: '#334155',
  outrigger_clevis_fr: '#334155',
  outrigger_clevis_rl: '#334155',
  outrigger_clevis_rr: '#334155',
  ur_base_l: '#334155',
  ur_base_r: '#334155',
  outrigger_rod_fl: '#cbd5e1',
  outrigger_rod_fr: '#cbd5e1',
  outrigger_rod_rl: '#cbd5e1',
  outrigger_rod_rr: '#cbd5e1',
  outrigger_foot_fl: '#cbd5e1',
  outrigger_foot_fr: '#cbd5e1',
  outrigger_foot_rl: '#cbd5e1',
  outrigger_foot_rr: '#cbd5e1',
  deck_beacon: '#cbd5e1',
  ur_tool_tip_l: '#cbd5e1',
  ur_tool_tip_r: '#cbd5e1',
  enclosure_lower: '#24528a',
  enclosure_upper: '#24528a',
  enclosure_rear_turret: '#1c3f6e',
  ur_shoulder_l: '#f1f5f9',
  ur_upper_arm_l: '#f1f5f9',
  ur_forearm_l: '#f1f5f9',
  ur_wrist_l: '#f1f5f9',
  ur_shoulder_r: '#f1f5f9',
  ur_upper_arm_r: '#f1f5f9',
  ur_forearm_r: '#f1f5f9',
  ur_wrist_r: '#f1f5f9',
  ur_shoulder_ring_l: '#ea580c',
  ur_upper_ring_l: '#ea580c',
  ur_elbow_outer_ring_l: '#ea580c',
  ur_elbow_ring_l: '#ea580c',
  ur_wrist_inner_ring_l: '#ea580c',
  ur_wrist_ring_l: '#ea580c',
  ur_shoulder_ring_r: '#ea580c',
  ur_upper_ring_r: '#ea580c',
  ur_elbow_outer_ring_r: '#ea580c',
  ur_elbow_ring_r: '#ea580c',
  ur_wrist_inner_ring_r: '#ea580c',
  ur_wrist_ring_r: '#ea580c',
  ur_tool_body_l: '#2563eb',
  ur_tool_body_r: '#2563eb',
};

const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {};
const DEFAULT_PART_VISIBILITY: Record<number, boolean> = {};

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

let masterOutriggerPrototype: {
  template: THREE.Group;
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
  defaultColors: Record<number, string>;
} | null = null;

function buildMasterOutriggerPrototype(sourceScene: THREE.Group) {
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
      const baseName = partName.replace(/\.\d+$/, '');
      const stdMat = Array.isArray(mesh.material)
        ? (mesh.material[0] as THREE.MeshStandardMaterial)
        : (mesh.material as THREE.MeshStandardMaterial);

      const fallbackHex = stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1';
      const hex = PART_NAME_COLORS[baseName] || fallbackHex;
      defaultColors[partIdx] = hex;
      partsInfo.push({
        index: partIdx,
        name: baseName,
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

export const OutriggerModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group | null>(null);

  const bodyGroupRef = useRef<THREE.Group | null>(null);
  const outriggerLegsGroupRef = useRef<THREE.Group | null>(null);

  const armBaseLRef = useRef<THREE.Group | null>(null);
  const armShLRef = useRef<THREE.Group | null>(null);
  const armElLRef = useRef<THREE.Group | null>(null);
  const armWrLRef = useRef<THREE.Group | null>(null);

  const armBaseRRef = useRef<THREE.Group | null>(null);
  const armShRRef = useRef<THREE.Group | null>(null);
  const armElRRef = useRef<THREE.Group | null>(null);
  const armWrRRef = useRef<THREE.Group | null>(null);

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

  const { scene } = useGLTF('./models/RaiseOutriggerClean.glb');

  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  if (!masterOutriggerPrototype) {
    masterOutriggerPrototype = buildMasterOutriggerPrototype(scene);
  }
  ensureBlueprintEdges(masterOutriggerPrototype.template, masterOutriggerPrototype.staticEdgesList);

  useEffect(() => {
    if (masterOutriggerPrototype) {
      registerModel({
        modelId: 'outrigger',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterOutriggerPrototype.partsInfo,
        defaultColors: masterOutriggerPrototype.defaultColors,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
        defaultVisibility: DEFAULT_PART_VISIBILITY,
        defaultRotationSpeed: DEFAULT_ROTATION_SPEED,
      });
    }
  }, [registerModel]);

  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('outrigger');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'outrigger';

  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterOutriggerPrototype!.template.clone(true);
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

    const bodyMeshes: THREE.Mesh[] = [];
    const legMeshes: THREE.Mesh[] = [];

    const lShMeshes: THREE.Mesh[] = [];
    const lUpMeshes: THREE.Mesh[] = [];
    const lForeMeshes: THREE.Mesh[] = [];
    const lWrMeshes: THREE.Mesh[] = [];

    const rShMeshes: THREE.Mesh[] = [];
    const rUpMeshes: THREE.Mesh[] = [];
    const rForeMeshes: THREE.Mesh[] = [];
    const rWrMeshes: THREE.Mesh[] = [];

    let meshIdx = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const idx = meshIdx++;
        mesh.userData.cadPartIndex = idx;
        mesh.userData.isCadMesh = true;

        const initColor = masterOutriggerPrototype!.defaultColors[idx] || '#cbd5e1';
        toonMap.set(
          mesh,
          new THREE.MeshToonMaterial({
            color: new THREE.Color(initColor),
            gradientMap: toonGradient,
          })
        );

        if (masterOutriggerPrototype!.staticEdgesList[idx]) {
          const bpLine = new THREE.LineSegments(
            masterOutriggerPrototype!.staticEdgesList[idx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterOutriggerPrototype!.activeEdgesList[idx]) {
          const celLine = new THREE.LineSegments(
            masterOutriggerPrototype!.activeEdgesList[idx],
            celLineMat
          );
          mesh.add(celLine);
          celLines.push(celLine);
        }

        const baseName = (mesh.name || '').replace(/\.\d+$/, '');
        if (OUTRIGGER_LEG_PREFIXES.some((pfx) => baseName.startsWith(pfx))) {
          legMeshes.push(mesh);
        } else if (ARM_L_SH.has(baseName)) {
          lShMeshes.push(mesh);
        } else if (ARM_L_UP.has(baseName)) {
          lUpMeshes.push(mesh);
        } else if (ARM_L_FORE.has(baseName)) {
          lForeMeshes.push(mesh);
        } else if (ARM_L_WRIST.has(baseName)) {
          lWrMeshes.push(mesh);
        } else if (ARM_R_SH.has(baseName)) {
          rShMeshes.push(mesh);
        } else if (ARM_R_UP.has(baseName)) {
          rUpMeshes.push(mesh);
        } else if (ARM_R_FORE.has(baseName)) {
          rForeMeshes.push(mesh);
        } else if (ARM_R_WRIST.has(baseName)) {
          rWrMeshes.push(mesh);
        } else {
          bodyMeshes.push(mesh);
        }
      }
    });

    // Center overall robot silhouette at origin while keeping clone inner space in GLB meters
    const bbox = new THREE.Box3().setFromObject(clone);
    const center = bbox.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -center.y, -center.z);

    const bodyGroup = new THREE.Group();
    const outriggerLegsGroup = new THREE.Group();

    const makeArmHierarchy = (sx: number, restIK: ArmIKResult, wFwdRest: number, wUpRest: number) => {
      const base = new THREE.Group();
      base.position.set(sx * ARM_MOUNT_X, ARM_SHOULDER_Y_THREE, ARM_SHOULDER_Z_THREE);
      base.rotation.y = sx * YAW_REST_RAD;

      const sh = new THREE.Group();
      const el = new THREE.Group();
      el.position.set(0, restIK.elUp, restIK.elFwd);

      const wr = new THREE.Group();
      wr.position.set(0, wUpRest - restIK.elUp, wFwdRest - restIK.elFwd);

      base.add(sh);
      sh.add(el);
      el.add(wr);
      return { base, sh, el, wr };
    };

    const armL = makeArmHierarchy(-1, REST_IK_L, REST_FWD_L, REST_UP_L);
    const armR = makeArmHierarchy(+1, REST_IK_R, REST_FWD_R, REST_UP_R);

    clone.add(bodyGroup);
    bodyGroup.add(outriggerLegsGroup);
    bodyGroup.add(armL.base);
    bodyGroup.add(armR.base);

    clone.updateMatrixWorld(true);
    bodyMeshes.forEach((m) => bodyGroup.attach(m));
    legMeshes.forEach((m) => outriggerLegsGroup.attach(m));

    lShMeshes.forEach((m) => armL.base.attach(m));
    lUpMeshes.forEach((m) => armL.sh.attach(m));
    lForeMeshes.forEach((m) => armL.el.attach(m));
    lWrMeshes.forEach((m) => armL.wr.attach(m));

    rShMeshes.forEach((m) => armR.base.attach(m));
    rUpMeshes.forEach((m) => armR.sh.attach(m));
    rForeMeshes.forEach((m) => armR.el.attach(m));
    rWrMeshes.forEach((m) => armR.wr.attach(m));

    bodyGroupRef.current = bodyGroup;
    outriggerLegsGroupRef.current = outriggerLegsGroup;

    armBaseLRef.current = armL.base;
    armShLRef.current = armL.sh;
    armElLRef.current = armL.el;
    armWrLRef.current = armL.wr;

    armBaseRRef.current = armR.base;
    armShRRef.current = armR.sh;
    armElRRef.current = armR.el;
    armWrRRef.current = armR.wr;

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

    let u = 1.0; // Outrigger deployment progress (1 = planted & lifted, 0 = stowed)
    let fwdL = REST_FWD_L;
    let upL = REST_UP_L;
    let yawDeltaL = 0.0;

    let fwdR = REST_FWD_R;
    let upR = REST_UP_R;
    let yawDeltaR = 0.0;

    if (phase < 1.1) {
      // Phase 1: Deployed rest dwell (t = 0 sits cleanly here)
      u = 1.0;
    } else if (phase < 3.4) {
      // Phase 2: Stabilized on outriggers — alternating dual UR20 working reach sweep
      u = 1.0;
      if (phase < 2.25) {
        const k = smootherstep(1.1, 2.25, phase);
        fwdL = REST_FWD_L + (WORK_LOW_FWD - REST_FWD_L) * k;
        upL = REST_UP_L + (WORK_LOW_UP - REST_UP_L) * k;
        yawDeltaL = -STOW_YAW_DELTA_RAD * k;

        fwdR = REST_FWD_R + (WORK_HIGH_FWD - REST_FWD_R) * k;
        upR = REST_UP_R + (WORK_HIGH_UP - REST_UP_R) * k;
        yawDeltaR = +STOW_YAW_DELTA_RAD * k;
      } else {
        const k = smootherstep(2.25, 3.4, phase);
        fwdL = WORK_LOW_FWD + (STOW_FWD - WORK_LOW_FWD) * k;
        upL = WORK_LOW_UP + (STOW_UP - WORK_LOW_UP) * k;
        yawDeltaL = -STOW_YAW_DELTA_RAD;

        fwdR = WORK_HIGH_FWD + (STOW_FWD - WORK_HIGH_FWD) * k;
        upR = WORK_HIGH_UP + (STOW_UP - WORK_HIGH_UP) * k;
        yawDeltaR = +STOW_YAW_DELTA_RAD;
      }
    } else if (phase < 5.3) {
      // Phase 3: Lower chassis onto tracks (-25 mm), then retract all 4 corner outriggers (+190 mm)
      const k = smootherstep(3.4, 5.3, phase);
      u = 1.0 - k;
      fwdL = STOW_FWD;
      upL = STOW_UP;
      yawDeltaL = -STOW_YAW_DELTA_RAD;
      fwdR = STOW_FWD;
      upR = STOW_UP;
      yawDeltaR = +STOW_YAW_DELTA_RAD;
    } else if (phase < 6.4) {
      // Phase 4: Mobile track-grounded stowed dwell
      u = 0.0;
      fwdL = STOW_FWD;
      upL = STOW_UP;
      yawDeltaL = -STOW_YAW_DELTA_RAD;
      fwdR = STOW_FWD;
      upR = STOW_UP;
      yawDeltaR = +STOW_YAW_DELTA_RAD;
    } else if (phase < 8.4) {
      // Phase 5: Outriggers drop to floor touchdown, then jack chassis +25 mm off tracks
      const k = smootherstep(6.4, 8.4, phase);
      u = k;
      fwdL = STOW_FWD;
      upL = STOW_UP;
      yawDeltaL = -STOW_YAW_DELTA_RAD;
      fwdR = STOW_FWD;
      upR = STOW_UP;
      yawDeltaR = +STOW_YAW_DELTA_RAD;
    } else {
      // Phase 6: Smoothly unfold both UR20 arms back to deployed rest pose
      const k = smootherstep(8.4, 10.0, phase);
      u = 1.0;
      fwdL = STOW_FWD + (REST_FWD_L - STOW_FWD) * k;
      upL = STOW_UP + (REST_UP_L - STOW_UP) * k;
      yawDeltaL = -STOW_YAW_DELTA_RAD * (1.0 - k);

      fwdR = STOW_FWD + (REST_FWD_R - STOW_FWD) * k;
      upR = STOW_UP + (REST_UP_R - STOW_UP) * k;
      yawDeltaR = +STOW_YAW_DELTA_RAD * (1.0 - k);
    }

    const strokeUp = S_TOTAL * (1.0 - u);
    const bodyDeltaY = -Math.min(S_LIFT, strokeUp);
    const legRelY = strokeUp;

    if (bodyGroupRef.current) bodyGroupRef.current.position.y = bodyDeltaY;
    if (outriggerLegsGroupRef.current) outriggerLegsGroupRef.current.position.y = legRelY;

    const ikL = solveURIK(fwdL, upL);
    const dq1L = ikL.theta1 - REST_IK_L.theta1;
    const dq2L = ikL.theta2Abs - ikL.theta1 - (REST_IK_L.theta2Abs - REST_IK_L.theta1);
    const dq3L = -(dq1L + dq2L);

    if (armBaseLRef.current) armBaseLRef.current.rotation.y = -YAW_REST_RAD + yawDeltaL;
    if (armShLRef.current) armShLRef.current.rotation.x = dq1L;
    if (armElLRef.current) armElLRef.current.rotation.x = dq2L;
    if (armWrLRef.current) armWrLRef.current.rotation.x = dq3L;

    const ikR = solveURIK(fwdR, upR);
    const dq1R = ikR.theta1 - REST_IK_R.theta1;
    const dq2R = ikR.theta2Abs - ikR.theta1 - (REST_IK_R.theta2Abs - REST_IK_R.theta1);
    const dq3R = -(dq1R + dq2R);

    if (armBaseRRef.current) armBaseRRef.current.rotation.y = +YAW_REST_RAD + yawDeltaR;
    if (armShRRef.current) armShRRef.current.rotation.x = dq1R;
    if (armElRRef.current) armElRRef.current.rotation.x = dq2R;
    if (armWrRRef.current) armWrRRef.current.rotation.x = dq3R;
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
    const defaultColors = masterOutriggerPrototype!.defaultColors;

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
