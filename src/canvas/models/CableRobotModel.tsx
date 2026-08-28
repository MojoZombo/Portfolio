import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createToonGradientMap } from '../materials';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration, PartColorInfo, PartAnimationConfig, CDPRConfig } from '../../context/TransformCalibrationContext';
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
  initialQuat: THREE.Quaternion;
  centerOfMass: THREE.Vector3;
  index: number;
}

const toonGradient = createToonGradientMap();

// Optimal Calibrated Defaults for Cable Robot Iteration 2
const DEFAULT_OFFSET: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [-90, -0.5, 0];
const DEFAULT_SCALE = 1.30;

// Baked Custom Part Color Overrides
const DEFAULT_PART_COLORS: Record<number, string> = {
  0: '#cbd5e1',
  1: '#616161',
  2: '#1e293b',
  5: '#cbd5e1',
  6: '#c19a6b',
  7: '#475569',
  8: '#c19a6b',
  10: '#525151',
  11: '#656161',
  17: '#696969',
};

// Baked Custom Part Kinematics Animations
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {};

// Baked Default CDPR Cable Robot Rig Config
const DEFAULT_CDPR_CONFIG: CDPRConfig = {
  enabled: true,
  plateSize: 0.18,
  plateThickness: 0.012,
  plateElevation: 0,
  plateColor: '#ea580c',
  frameWidth: 2.4,
  frameDepth: 2.4,
  pulleyElevation: 0.033,
  winchOffsetY: 0.13,
  winchInsetX: 0.95105,
  winchInsetZ: -0.07,
  motionRangeX: 0.85,
  motionRangeZ: 0.9,
  motionSpeed: 1,
  motionPattern: 'lissajous',
  cableColor: '#38bdf8',
  cableThickness: 1.5,
  showWorkspaceBoundary: false,
};

// Dynamic 4-Cable CDPR End-Effector Plate & Real-Time Driven Wires
const CDPRRig: React.FC<{
  config: CDPRConfig;
  isActive: boolean;
  isCalibrating: boolean;
  isDark: boolean;
}> = ({ config, isActive, isCalibrating, isDark }) => {
  const plateRef = useRef<THREE.Group>(null);
  const cableLineRef = useRef<THREE.LineSegments>(null);
  const cablePositions = useMemo(() => new Float32Array(16 * 3), []); // 8 segments * 2 vertices * 3 coords = 48

  const cableGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cablePositions, 3));
    return geo;
  }, [cablePositions]);

  const isShaded = isActive || isCalibrating;

  // Exact matching blueprint / cel outline colors
  const blueprintLineColor = isDark ? '#FFFFFF' : '#0F172A';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';
  const outlineColor = isShaded ? celOutlineColor : blueprintLineColor;

  const outlineLineMat = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(outlineColor),
      linewidth: 1.5,
    });
  }, [outlineColor]);

  // Static mode wire color: pure white in dark mode, black in light mode to match edges
  // Dynamic mode wire color: custom cable color (e.g. #38bdf8)
  const cableMaterial = useMemo(() => {
    const wireColor = isShaded ? (config.cableColor || '#38bdf8') : (isDark ? '#FFFFFF' : '#0F172A');
    return new THREE.LineBasicMaterial({
      color: new THREE.Color(wireColor),
      linewidth: config.cableThickness || 1.5,
      transparent: true,
      opacity: isShaded ? 0.92 : 0.95,
    });
  }, [config.cableColor, config.cableThickness, isShaded, isDark]);

  const plateToonMat = useMemo(() => {
    return new THREE.MeshToonMaterial({
      color: new THREE.Color(config.plateColor),
      gradientMap: toonGradient,
    });
  }, [config.plateColor]);

  const hubToonMat = useMemo(() => {
    return new THREE.MeshToonMaterial({
      color: new THREE.Color('#475569'),
      gradientMap: toonGradient,
    });
  }, []);

  const eyeletToonMat = useMemo(() => {
    return new THREE.MeshToonMaterial({
      color: new THREE.Color('#94a3b8'),
      gradientMap: toonGradient,
    });
  }, []);

  const postToonMat = useMemo(() => {
    return new THREE.MeshToonMaterial({
      color: new THREE.Color('#64748b'),
      gradientMap: toonGradient,
    });
  }, []);

  const darkBlueprintMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#233247' }), []);
  const lightBlueprintMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);
  const currentBlueprintMat = isDark ? darkBlueprintMat : lightBlueprintMat;

  const currentPlateMat = isShaded ? plateToonMat : currentBlueprintMat;
  const currentHubMat = isShaded ? hubToonMat : currentBlueprintMat;
  const currentEyeletMat = isShaded ? eyeletToonMat : currentBlueprintMat;
  const currentPostMat = isShaded ? postToonMat : currentBlueprintMat;

  // Procedural Geometries & Crisp Cel Edge Outlines
  const plateGeo = useMemo(
    () => new THREE.BoxGeometry(config.plateSize, config.plateThickness, config.plateSize),
    [config.plateSize, config.plateThickness]
  );
  const plateEdges = useMemo(() => new THREE.EdgesGeometry(plateGeo), [plateGeo]);

  const hubGeo = useMemo(
    () => new THREE.CylinderGeometry(config.plateSize * 0.28, config.plateSize * 0.28, 0.016, 24),
    [config.plateSize]
  );
  const hubEdges = useMemo(() => new THREE.EdgesGeometry(hubGeo, 25), [hubGeo]);

  const eyeletGeo = useMemo(() => new THREE.CylinderGeometry(0.006, 0.006, 0.012, 12), []);
  const eyeletEdges = useMemo(() => new THREE.EdgesGeometry(eyeletGeo, 25), [eyeletGeo]);

  const postGeo = useMemo(() => new THREE.CylinderGeometry(0.018, 0.018, 0.014, 16), []);
  const postEdges = useMemo(() => new THREE.EdgesGeometry(postGeo, 25), [postGeo]);

  useFrame((state) => {
    if (!config.enabled) return;

    const time = state.clock.getElapsedTime();
    const isMoving = isActive || isCalibrating;
    const speed = config.motionSpeed;

    let targetX = 0;
    let targetZ = 0;
    let targetY = config.plateElevation;

    if (isMoving && config.motionPattern !== 'static') {
      const rx = config.motionRangeX;
      const rz = config.motionRangeZ;

      if (config.motionPattern === 'lissajous') {
        targetX = rx * (0.62 * Math.sin(0.85 * time * speed) + 0.38 * Math.sin(1.95 * time * speed + 0.6));
        targetZ = rz * (0.62 * Math.cos(0.95 * time * speed) + 0.38 * Math.cos(2.25 * time * speed + 1.2));
      } else if (config.motionPattern === 'circle') {
        targetX = rx * Math.cos(time * speed);
        targetZ = rz * Math.sin(time * speed);
      } else if (config.motionPattern === 'square') {
        const cycle = ((time * speed * 0.4) % 4);
        if (cycle < 1) {
          targetX = -rx + 2 * rx * cycle;
          targetZ = -rz;
        } else if (cycle < 2) {
          targetX = rx;
          targetZ = -rz + 2 * rz * (cycle - 1);
        } else if (cycle < 3) {
          targetX = rx - 2 * rx * (cycle - 2);
          targetZ = rz;
        } else {
          targetX = -rx;
          targetZ = rz - 2 * rz * (cycle - 3);
        }
      } else {
        // wander
        targetX = rx * (0.45 * Math.sin(0.6 * time * speed) + 0.35 * Math.sin(1.4 * time * speed + 1.2) + 0.2 * Math.sin(2.8 * time * speed));
        targetZ = rz * (0.45 * Math.cos(0.7 * time * speed) + 0.35 * Math.cos(1.6 * time * speed + 0.9) + 0.2 * Math.cos(3.1 * time * speed));
      }
    }

    // Update plate position
    if (plateRef.current) {
      plateRef.current.position.set(targetX, targetY, targetZ);
    }

    // Update cable vertex buffer
    const pos = cablePositions;
    const pw = config.plateSize / 2;
    const pd = config.plateSize / 2;
    const fw = config.frameWidth / 2;
    const fd = config.frameDepth / 2;
    const py = config.pulleyElevation;
    const wy = config.winchOffsetY;
    const wx = config.winchInsetX;
    const wz = config.winchInsetZ;

    // Corner 0: (-X, -Z)
    // Plate Corner 0 to Pulley 0
    pos[0] = targetX - pw; pos[1] = targetY; pos[2] = targetZ - pd;
    pos[3] = -fw;          pos[4] = py;      pos[5] = -fd;
    // Pulley 0 to Winch 0
    pos[6] = -fw;          pos[7] = py;      pos[8] = -fd;
    pos[9] = -fw + wx;     pos[10] = wy;     pos[11] = -fd + wz;

    // Corner 1: (+X, -Z)
    // Plate Corner 1 to Pulley 1
    pos[12] = targetX + pw; pos[13] = targetY; pos[14] = targetZ - pd;
    pos[15] = fw;           pos[16] = py;      pos[17] = -fd;
    // Pulley 1 to Winch 1
    pos[18] = fw;           pos[19] = py;      pos[20] = -fd;
    pos[21] = fw - wx;      pos[22] = wy;      pos[23] = -fd + wz;

    // Corner 2: (+X, +Z)
    // Plate Corner 2 to Pulley 2
    pos[24] = targetX + pw; pos[25] = targetY; pos[26] = targetZ + pd;
    pos[27] = fw;           pos[28] = py;      pos[29] = fd;
    // Pulley 2 to Winch 2
    pos[30] = fw;           pos[31] = py;      pos[32] = fd;
    pos[33] = fw - wx;      pos[34] = wy;      pos[35] = fd - wz;

    // Corner 3: (-X, +Z)
    // Plate Corner 3 to Pulley 3
    pos[36] = targetX - pw; pos[37] = targetY; pos[38] = targetZ + pd;
    pos[39] = -fw;          pos[40] = py;      pos[41] = fd;
    // Pulley 3 to Winch 3
    pos[42] = -fw;          pos[43] = py;      pos[44] = fd;
    pos[45] = -fw + wx;     pos[46] = wy;      pos[47] = fd - wz;

    if (cableLineRef.current) {
      cableLineRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (!config.enabled) return null;

  return (
    <group>
      {/* 8 Dynamic Cable Lines */}
      <lineSegments ref={cableLineRef} geometry={cableGeometry} material={cableMaterial} />

      {/* End-Effector Central Plate */}
      <group ref={plateRef} position={[0, config.plateElevation, 0]}>
        {/* Main Aluminum Plate with Cel Outline */}
        <mesh geometry={plateGeo} material={currentPlateMat} castShadow receiveShadow />
        <lineSegments geometry={plateEdges} material={outlineLineMat} />

        {/* Center Payload Hub with Cel Outline */}
        <group position={[0, config.plateThickness / 2 + 0.008, 0]}>
          <mesh geometry={hubGeo} material={currentHubMat} />
          <lineSegments geometry={hubEdges} material={outlineLineMat} />
        </group>

        {/* Center Target Indicator Dot */}
        <mesh position={[0, config.plateThickness / 2 + 0.017, 0]}>
          <cylinderGeometry args={[config.plateSize * 0.08, config.plateSize * 0.08, 0.004, 16]} />
          <meshBasicMaterial color={isShaded ? '#38bdf8' : outlineColor} />
        </mesh>

        {/* 4 Corner Cable Attachment Eyelets with Cel Outline */}
        {[
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([sx, sz], i) => (
          <group
            key={i}
            position={[
              sx * (config.plateSize / 2 - 0.012),
              config.plateThickness / 2 + 0.006,
              sz * (config.plateSize / 2 - 0.012),
            ]}
          >
            <mesh geometry={eyeletGeo} material={currentEyeletMat} />
            <lineSegments geometry={eyeletEdges} material={outlineLineMat} />
          </group>
        ))}
      </group>

      {/* 4 Corner Pulley Cylinders on Frame Boundary with Cel Outline */}
      {[
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([sx, sz], i) => (
        <group
          key={i}
          position={[
            sx * (config.frameWidth / 2),
            config.pulleyElevation,
            sz * (config.frameDepth / 2),
          ]}
        >
          <mesh geometry={postGeo} material={currentPostMat} />
          <lineSegments geometry={postEdges} material={outlineLineMat} />
        </group>
      ))}

      {/* Workspace Boundary Plane Wireframe */}
      {config.showWorkspaceBoundary && (
        <group position={[0, config.plateElevation, 0]}>
          <lineSegments>
            <edgesGeometry
              args={[new THREE.BoxGeometry(config.motionRangeX * 2, 0.002, config.motionRangeZ * 2)]}
            />
            <lineBasicMaterial color="#38bdf8" transparent opacity={0.35} />
          </lineSegments>
        </group>
      )}
    </group>
  );
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

// Master prototype cache for Cable Robot Iteration 2
let masterCableRobot2Prototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterCableRobot2Prototype(sourceScene: THREE.Group) {
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
            name: m.name ? m.name.replace(/_\d+$/, '') : `Cable Robot Sub-assembly ${partsInfo.length + 1}`,
            color: defaultBakedColor,
          });
        });
      } else {
        const stdMat = mesh.material as THREE.MeshStandardMaterial;
        const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length] || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
        partsInfo.push({
          index: partsInfo.length,
          name: mesh.name || `Cable Robot Part ${partsInfo.length + 1}`,
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

export const CableRobotModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true }) => {
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

  // Load the CAD assembly from public/models/CableRobotV2Decimated.glb
  const { scene } = useGLTF('./models/CableRobotV2Decimated.glb');

  // Exact matching blueprint colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterCableRobot2Prototype) {
    masterCableRobot2Prototype = buildMasterCableRobot2Prototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterCableRobot2Prototype) {
      registerModel({
        modelId: 'cable-robot-2',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterCableRobot2Prototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
        defaultCDPRConfig: DEFAULT_CDPR_CONFIG,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open (prevents root context thrashing on scroll)
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('cable-robot-2');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'cable-robot-2';

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
        const geomCom = new THREE.Vector3();
        if (mesh.geometry.boundingBox) {
          mesh.geometry.boundingBox.getCenter(geomCom);
        }
        const initQuat = mesh.quaternion.clone();
        const com = mesh.position.clone().add(geomCom.clone().applyQuaternion(initQuat));

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

        const origMat = masterCableRobot2Prototype?.originalMaterials[meshIndex] || mesh.material;

        if (Array.isArray(origMat)) {
          const mats = origMat.map((m) => {
            const currentPartIdx = partIndex++;
            const bakedColor = DEFAULT_PART_COLORS[currentPartIdx];
            const stdMat = m as THREE.MeshStandardMaterial;
            const col = bakedColor ? new THREE.Color(bakedColor) : (stdMat?.color ? stdMat.color.clone() : new THREE.Color('#cbd5e1'));
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
          const col = bakedColor ? new THREE.Color(bakedColor) : (stdMat?.color ? stdMat.color.clone() : new THREE.Color('#cbd5e1'));
          const mat = new THREE.MeshToonMaterial({
            color: col,
            emissive: new THREE.Color('#000000'),
            gradientMap: toonGradient,
          });
          toonMap.set(mesh, mat);
        }

        if (masterCableRobot2Prototype?.staticEdgesList[meshIndex]) {
          const bpLineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color('#94A8C4'),
            linewidth: 1.35,
            transparent: true,
            opacity: 0.9,
          });
          const bpLine = new THREE.LineSegments(masterCableRobot2Prototype.staticEdgesList[meshIndex], bpLineMat);
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterCableRobot2Prototype?.activeEdgesList[meshIndex]) {
          const celLineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color('#0A0E14'),
            linewidth: 1.5,
            transparent: true,
            opacity: 0.75,
          });
          const celLine = new THREE.LineSegments(masterCableRobot2Prototype.activeEdgesList[meshIndex], celLineMat);
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
        .copy(new THREE.Vector3(settings.offsetX, settings.offsetY, settings.offsetZ))
        .sub(centerRef.current);
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

  const currentCDPRConfig = isModelCalibrating ? settings.cdprConfig : DEFAULT_CDPR_CONFIG;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {isModelCalibrating && settings.showGizmo && <CADPivotGizmo />}

      <primitive object={centeredScene} />

      {/* CDPR Central Plate and Real-Time Driven Cables */}
      <CDPRRig
        config={currentCDPRConfig}
        isActive={isActive}
        isCalibrating={isModelCalibrating}
        isDark={isDark}
      />
    </group>
  );
};

// Preload the CAD model
useGLTF.preload('./models/CableRobotV2Decimated.glb');
