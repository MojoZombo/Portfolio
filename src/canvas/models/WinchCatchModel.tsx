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

// Optimal Calibrated Defaults for Drone-Catch Winch
const DEFAULT_OFFSET: [number, number, number] = [0.00, 0.00, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.00, 38.00, 0.00];
const DEFAULT_SCALE = 1.20;

// Baked Custom Part Color Overrides for Winch
const DEFAULT_PART_COLORS: Record<number, string> = {
  0: '#64748b', // mesh_0
  1: '#d97706', // mesh_0_1
  5: '#1e293b', // mesh_0_5
  6: '#475569', // mesh_0_6
  8: '#cbd5e1', // mesh_0_8_(Body_A)
  9: '#475569', // mesh_0_9
  10: '#475569', // mesh_0_10
  11: '#475569', // mesh_0_11
  12: '#ea580c', // mesh_0_12
  13: '#059669', // mesh_0_13_(Body_A)
  14: '#059669', // mesh_0_14
  16: '#cbd5e1', // mesh_0_16
  17: '#c19a6b', // mesh_0_13_(Body_B)
  18: '#64748b', // mesh_0_13_(Body_C)
  19: '#1e293b', // mesh_0_8_(Body_B)
};

// Hidden Parts:
const DEFAULT_PART_VISIBILITY: Record<number, boolean> = {
  31: false, // mesh_31
};

// Baked Custom Part Kinematics Animations
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {};

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

  template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !(child instanceof THREE.LineSegments)) {
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
        // Compute edges once at 28 deg to prevent main thread freeze on dense CAD parts
        const celEdges = new THREE.EdgesGeometry(mesh.geometry, 28);
        activeEdgesList.push(celEdges);
        staticEdgesList.push(celEdges);
      } catch {
        // Ignore non-standard geometries
      }
    }
  });

  return { template, originalMaterials, staticEdgesList, activeEdgesList, partsInfo };
}

export const WinchCatchModel: React.FC<ModelProps> = ({ isActive = false, isRotating = true, isAnimating = true }) => {
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

  // Load the CAD assembly from public/models/drone-catch-split-compressed.glb
  const { scene } = useGLTF('./models/drone-catch-split-compressed.glb');

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
        defaultVisibility: DEFAULT_PART_VISIBILITY,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('drone-catch');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'drone-catch';

  // Create permanent scene instance ONCE
  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterWinchPrototype!.template.clone(true);
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
      if ((child as THREE.Mesh).isMesh && !(child instanceof THREE.LineSegments)) {
        const mesh = child as THREE.Mesh;
        const currentPartStart = runningPartIdx;
        const currentMeshIdx = meshIdx;

        mesh.userData.cadPartIndex = currentPartStart;
        mesh.userData.isCadMesh = true;

        if (Array.isArray(mesh.material)) {
          const toonArr = mesh.material.map((m, subIdx) => {
            const partNum = currentPartStart + subIdx;
            const stdMat = m as THREE.MeshStandardMaterial;
            const defaultBaked = masterWinchPrototype?.partsInfo[partNum]?.color || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#d6d1c8');
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
          const defaultBaked = masterWinchPrototype?.partsInfo[currentPartStart]?.color || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#d6d1c8');
          const initialColor = DEFAULT_PART_COLORS[currentPartStart] || defaultBaked;
          const toon = new THREE.MeshToonMaterial({
            color: new THREE.Color(initialColor),
            gradientMap: toonGradient,
          });
          toonMap.set(mesh, toon);
          runningPartIdx += 1;
        }

        if (masterWinchPrototype!.staticEdgesList[currentMeshIdx]) {
          const bpLine = new THREE.LineSegments(
            masterWinchPrototype!.staticEdgesList[currentMeshIdx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterWinchPrototype!.activeEdgesList[currentMeshIdx]) {
          const celLine = new THREE.LineSegments(
            masterWinchPrototype!.activeEdgesList[currentMeshIdx],
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
      if ((child as THREE.Mesh).isMesh && !(child instanceof THREE.LineSegments)) {
        const mesh = child as THREE.Mesh;
        if (!mesh.geometry.boundingBox) {
          mesh.geometry.computeBoundingBox();
        }
        const geomCom = mesh.geometry.boundingBox
          ? mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
          : new THREE.Vector3();
        const initQuat = mesh.quaternion.clone();
        const com = mesh.position.clone().add(geomCom.clone().applyQuaternion(initQuat));

        list.push({
          mesh,
          initialPos: mesh.position.clone(),
          initialRot: mesh.rotation.clone(),
          initialQuat: initQuat,
          centerOfMass: com,
          index: idx,
        });
        idx++;
      }
    });
    meshNodesRef.current = list;
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
            const defaultBaked = masterWinchPrototype?.partsInfo[currentPartIdx]?.color || '#d6d1c8';
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
          const defaultBaked = masterWinchPrototype?.partsInfo[currentPartIdx]?.color || '#d6d1c8';
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

  useFrame((_state, delta) => { delta = Math.min(delta, 0.035);
    if (isAnimating) {
      localTimeRef.current += delta;
    }
    // Dynamically adjust calibration transforms in frame loop without scene re-cloning
    if (isModelCalibrating && pivotRef.current) {
      pivotRef.current.position.set(settings.offsetX, settings.offsetY, settings.offsetZ);
      pivotRef.current.rotation.set(
        (settings.rotX * Math.PI) / 180,
        (settings.rotY * Math.PI) / 180,
        (settings.rotZ * Math.PI) / 180
      );
    }

    // 1. If static blueprint mode, keep strictly still in rest position and return
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

    // 2. Active Mode / Calibration Mode: Constant scale and turntable rotation
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

    // 3. Execute Live Kinematics Animations with Hierarchical Forward Kinematics
    const time = localTimeRef.current;
    if (isAnimating && meshNodesRef.current.length > 0) {
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
          ? (settings.animationOverrides[node.index] || DEFAULT_PART_ANIMATIONS[node.index])
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
          if (anim && anim.type !== 'none') {
            const applyAnim = (animConfig: any) => {
            if (!animConfig || animConfig.type === 'none') return;
            if (animConfig.type === 'multi' && Array.isArray(animConfig.subAnimations)) {
              animConfig.subAnimations.forEach(applyAnim);
              return;
            }

            const phaseRad = ((animConfig.phase || 0) * Math.PI) / 180;
            const rawAxis = new THREE.Vector3(
              animConfig.axis === 'x' ? 1 : 0,
              animConfig.axis === 'y' ? 1 : 0,
              animConfig.axis === 'z' ? 1 : 0
            );
            const axisVec = rawAxis.clone().applyQuaternion(accumulatedDeltaQuat);
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
                pivot.add(
                  new THREE.Vector3(
                    (animConfig.pivotX || 0) / 100,
                    (animConfig.pivotY || 0) / 100,
                    (animConfig.pivotZ || 0) / 100
                  ).applyQuaternion(accumulatedDeltaQuat)
                  );
              }

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
              const centerM = (distPosM - distNegM) / 2;
              const strokeHalfM = (distPosM + distNegM) / 2;
              const displacementScalar = (centerM + Math.sin(time * omega + phaseRad) * strokeHalfM) * dir;
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
useGLTF.preload('./models/drone-catch-split-compressed.glb');
