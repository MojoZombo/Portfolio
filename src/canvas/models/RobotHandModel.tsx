import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createToonGradientMap } from '../materials';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration, PartColorInfo } from '../../context/TransformCalibrationContext';
import { CADPivotGizmo } from '../CADPivotGizmo';

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
const DEFAULT_OFFSET: [number, number, number] = [0.62, 0.21, 0.55];
const DEFAULT_ROTATION_DEG: [number, number, number] = [-90, 0, 0];
const DEFAULT_SCALE = 0.80;

// Baked Custom Part Color Overrides for Robot Hand
const DEFAULT_PART_COLORS: Record<number, string> = {
  0: '#008c4a',
  10: '#808080',
  11: '#c2c2c2',
  24: '#475569',
  25: '#475569',
  26: '#475569',
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
  const { scene } = useGLTF('./models/HandDecimatedCompressed.glb');

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

        const origMat = masterCADPrototype?.originalMaterials[meshIndex] || mesh.material;

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

  const localTimeRef = useRef(0);

  useFrame((_state, delta) => {
    if (isAnimating) {
      localTimeRef.current += delta;
    }
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

    // 2. Active Mode / Calibration Mode
    const baseScale = isModelCalibrating ? settings.scale : DEFAULT_SCALE;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(baseScale);
    }

    // Auto rotate parent with smooth acceleration from 0 RPM
    const maxSpeed = isModelCalibrating ? settings.rotationSpeed : 0.6;
    const targetSpeed = isModelCalibrating ? (settings.autoRotate ? maxSpeed : 0) : (isActive && isRotating && isAnimating ? maxSpeed : 0);
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      } else if (!isActive && !isModelCalibrating) {
        groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, 0, 4.0, delta);
      }
    }

    // 3. Execute Live Kinematics Animations around Center of Mass / Custom Pivot
    const time = localTimeRef.current;
    if (meshNodesRef.current.length > 0) {
      meshNodesRef.current.forEach((node) => {
        const anim = isModelCalibrating ? settings.animationOverrides[node.index] : null;

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

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {isModelCalibrating && settings.showGizmo && <CADPivotGizmo />}

      <primitive object={centeredScene} />
    </group>
  );
};

// Preload the CAD model
useGLTF.preload('./models/HandDecimatedCompressed.glb');
