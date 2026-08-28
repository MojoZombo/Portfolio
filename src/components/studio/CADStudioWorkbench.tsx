import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { projectsData } from '../../data/projectsData';
import { ModelRenderer } from '../../canvas/ModelRenderer';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration, SplitPartRecord } from '../../context/TransformCalibrationContext';
import { CADCuttingPlaneGizmo } from '../../canvas/CADCuttingPlaneGizmo';
import { separateDisconnectedIslands, sliceGeometryByPlane } from '../../utils/meshSplitter';
import {
  Palette,
  Play,
  Copy,
  Check,
  Sun,
  Moon,
  Move,
  RotateCw,
  Box,
  Layers,
  ArrowLeft,
  Cpu,
  RefreshCw,
  Search,
  Edit2,
  Crosshair,
  Scissors,
  Boxes,
  Sparkles,
  Undo2,
  Camera,
} from 'lucide-react';

interface StudioProps {
  onExit: () => void;
}

// Preset Metallic / Anodized Palette
const COLOR_PRESETS = [
  { name: 'Titanium Gray', hex: '#64748b' },
  { name: 'Slate Steel', hex: '#475569' },
  { name: 'Anodized Blue', hex: '#3b82f6' },
  { name: 'Sky Cyan', hex: '#0284c7' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Safety Orange', hex: '#ea580c' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Crimson Red', hex: '#dc2626' },
  { name: 'Brass / Bronze', hex: '#c19a6b' },
  { name: 'Carbon Black', hex: '#1e293b' },
  { name: 'Powder White', hex: '#f8fafc' },
  { name: 'Raw Aluminum', hex: '#cbd5e1' },
];

/**
 * Scene bridge to allow dynamic on-demand mesh splitting, individual part highlighting, material updates,
 * and live kinematics animation for both native CAD parts and dynamically split sub-parts.
 */
function StudioSceneBridge({
  onSceneReady,
  onEngineReady,
  selectedPartIndex,
  colorOverrides,
  animationOverrides,
}: {
  onSceneReady: (scene: THREE.Scene) => void;
  onEngineReady?: (handles: { scene: THREE.Scene; camera: THREE.Camera; gl: THREE.WebGLRenderer }) => void;
  selectedPartIndex: number | null;
  colorOverrides: Record<number, string>;
  animationOverrides: Record<number, any>;
}) {
  const { scene, camera, gl } = useThree();

  useEffect(() => {
    onSceneReady(scene);
    if (onEngineReady) {
      onEngineReady({ scene, camera, gl });
    }
  }, [scene, camera, gl, onSceneReady, onEngineReady]);

  // Live update highlight glow, colors, and live kinematics for all CAD parts and dynamically split sub-meshes
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    let fallbackIdx = 0;

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (
          !mesh.name.includes('Helper') &&
          !mesh.name.includes('Gizmo') &&
          !mesh.name.includes('Grid') &&
          !mesh.name.includes('Line')
        ) {
          const currentIdx =
            mesh.userData.cadPartIndex !== undefined
              ? mesh.userData.cadPartIndex
              : mesh.userData.partIndex !== undefined
              ? mesh.userData.partIndex
              : fallbackIdx;

          mesh.userData.partIndex = currentIdx;
          mesh.userData.cadPartIndex = currentIdx;
          mesh.userData.isCadMesh = true;

          // 1. Initial transform capture for robust kinematics
          if (!mesh.userData.initialPos) {
            mesh.userData.initialPos = mesh.position.clone();
            mesh.userData.initialRot = mesh.rotation.clone();
            mesh.userData.initialQuat = mesh.quaternion.clone();
          }

          // 2. Center of mass calculation in parent space
          if (!mesh.userData.centerOfMass) {
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            const geomCom = mesh.geometry.boundingBox
              ? mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
              : new THREE.Vector3();

            mesh.userData.geomCom = geomCom;
            mesh.userData.centerOfMass = mesh.userData.initialPos
              .clone()
              .add(geomCom.clone().applyQuaternion(mesh.userData.initialQuat));
          }

          // 3. Highlight glow & Color override sync
          const isSelected = selectedPartIndex === currentIdx;
          const overrideColor = colorOverrides[currentIdx];

          const mat = mesh.material;
          if (mat) {
            if (Array.isArray(mat)) {
              mat.forEach((m) => {
                if ((m as THREE.MeshToonMaterial).isMeshToonMaterial) {
                  const tm = m as THREE.MeshToonMaterial;
                  if (isSelected) {
                    tm.color.set('#38bdf8');
                    tm.emissive.set('#0284c7');
                  } else {
                    if (overrideColor) tm.color.set(overrideColor);
                    tm.emissive.set('#000000');
                  }
                }
              });
            } else if ((mat as THREE.MeshToonMaterial).isMeshToonMaterial) {
              const tm = mat as THREE.MeshToonMaterial;
              if (isSelected) {
                tm.color.set('#38bdf8');
                tm.emissive.set('#0284c7');
              } else {
                if (overrideColor) tm.color.set(overrideColor);
                tm.emissive.set('#000000');
              }
            }
          }

          // 4. Kinematics Animation (Rotation around true Center of Mass with ZERO axis drift)
          const anim = animationOverrides[currentIdx];
          if (anim && anim.type !== 'none') {
            const axisVec = new THREE.Vector3(
              anim.axis === 'x' ? 1 : 0,
              anim.axis === 'y' ? 1 : 0,
              anim.axis === 'z' ? 1 : 0
            );
            const dir = anim.direction ?? 1;
            const omega = (anim.speed * Math.PI * 2) / 60;
            const phaseRad = ((anim.phase || 0) * Math.PI) / 180;

            const pivotMode = anim.pivotMode || 'center-of-mass';
            let pivotPoint = (mesh.userData.centerOfMass as THREE.Vector3).clone();
            if (pivotMode === 'origin') {
              pivotPoint.set(0, 0, 0);
            } else if (pivotMode === 'custom') {
              pivotPoint.add(
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
              mesh.quaternion.copy(qDelta).multiply(mesh.userData.initialQuat);
              mesh.position
                .copy(pivotPoint)
                .add(
                  (mesh.userData.initialPos as THREE.Vector3)
                    .clone()
                    .sub(pivotPoint)
                    .applyQuaternion(qDelta)
                );
            } else if (anim.type === 'linear-reciprocate') {
              mesh.quaternion.copy(mesh.userData.initialQuat);
              const ampMeters = ((anim.amplitude || 10) / 100) * dir;
              const displacement = axisVec
                .clone()
                .multiplyScalar(Math.sin(time * omega + phaseRad) * ampMeters);
              mesh.position
                .copy(mesh.userData.initialPos as THREE.Vector3)
                .add(displacement);
            }
          }

          fallbackIdx++;
        }
      }
    });
  });

  return null;
}

function getSafeColor(hex: string | undefined, fallback = '#cbd5e1'): string {
  if (!hex || typeof hex !== 'string') return fallback;
  const trimmed = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return fallback;
}

export const CADStudioWorkbench: React.FC<StudioProps> = ({ onExit }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const {
    activeModelId,
    setActiveModelId,
    selectedPartIndex,
    setSelectedPartIndex,
    settings,
    availableParts,
    updateSetting,
    updatePartColor,
    updatePartAnimation,
    updatePartName,
    updateCDPRConfig,
    resetPartAnimation,
    resetSettings,
    setIsOpen,
    cuttingPlaneConfig,
    setCuttingPlaneConfig,
    registerSplitParts,
    splitHistory,
  } = useTransformCalibration();

  const [activeTab, setActiveTab] = useState<'transform' | 'colors' | 'splitter' | 'kinematics' | 'cdpr' | 'export'>('transform');
  const [partSearch, setPartSearch] = useState('');
  const [renderMode, setRenderMode] = useState<'shaded' | 'blueprint'>('shaded');
  const [isOrthographic, setIsOrthographic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  const [tempPartName, setTempPartName] = useState('');
  const [splitFeedback, setSplitFeedback] = useState<string | null>(null);
  const [splitToleranceRatio, setSplitToleranceRatio] = useState<number>(0.001);
  const studioEngineRef = useRef<{ scene: THREE.Scene; camera: THREE.Camera; gl: THREE.WebGLRenderer } | null>(null);
  const [isExportingPosters, setIsExportingPosters] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  // Ensure calibration context is active in Studio
  useEffect(() => {
    setIsOpen(true);
    return () => setIsOpen(false);
  }, [setIsOpen]);

  // Model list
  const modelsList = useMemo(() => {
    return projectsData.map((p) => ({
      id: p.modelType,
      title: p.title,
      company: p.company,
    }));
  }, []);

  const captureCurrentPoster = async (customFilename?: string) => {
    if (!studioEngineRef.current) return;
    const { scene, camera, gl } = studioEngineRef.current;

    // 1. Save previous camera state
    const savedPos = camera.position.clone();
    const savedRot = camera.rotation.clone();
    const savedFov = (camera as THREE.PerspectiveCamera).fov;
    const savedAspect = (camera as THREE.PerspectiveCamera).aspect;

    // 2. Set exact 1:1 website camera perspective: position [4.6, 3.2, 5.0], FOV 34, lookAt (0,0,0)
    camera.position.set(4.6, 3.2, 5.0);
    camera.lookAt(0, 0, 0);
    (camera as THREE.PerspectiveCamera).fov = 34;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    // 3. Temporarily hide helpers/grid/gizmos in scene
    const hiddenElements: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (
        obj.name.includes('Helper') ||
        obj.name.includes('Gizmo') ||
        obj.name.includes('Grid') ||
        obj.type === 'GridHelper'
      ) {
        if (obj.visible) {
          obj.visible = false;
          hiddenElements.push(obj);
        }
      }
    });

    // 4. Force a clean transparent WebGL render frame
    gl.setClearColor(0x000000, 0);
    gl.render(scene, camera);

    const filename = customFilename || `${activeModelId}-${renderMode}.png`;
    const dataUrl = gl.domElement.toDataURL('image/png');

    // 5. Trigger download
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 6. Restore original camera and gizmo visibility
    hiddenElements.forEach((el) => {
      el.visible = true;
    });
    camera.position.copy(savedPos);
    camera.rotation.copy(savedRot);
    (camera as THREE.PerspectiveCamera).fov = savedFov;
    (camera as THREE.PerspectiveCamera).aspect = savedAspect;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  };

  const handleExportAllPosters = async () => {
    setIsExportingPosters(true);
    const models = modelsList.map((m) => m.id);

    for (let i = 0; i < models.length; i++) {
      const mid = models[i];
      setExportProgress(`Generating 1:1 posters for ${mid} (${i + 1}/${models.length})...`);
      setActiveModelId(mid);

      // 1. Shaded mode snapshot
      setRenderMode('shaded');
      await new Promise((r) => setTimeout(r, 800));
      await captureCurrentPoster(`${mid}-shaded.png`);

      // 2. Blueprint mode snapshot
      setRenderMode('blueprint');
      await new Promise((r) => setTimeout(r, 800));
      await captureCurrentPoster(`${mid}-blueprint.png`);
    }

    setExportProgress('✅ All 1:1 model posters exported successfully!');
    setIsExportingPosters(false);
    setTimeout(() => setExportProgress(null), 5000);
  };

  const activeProject = useMemo(() => {
    return projectsData.find((p) => p.modelType === activeModelId) || projectsData[0];
  }, [activeModelId]);

  // Filtered parts tree
  const filteredParts = useMemo(() => {
    if (!partSearch.trim()) return availableParts;
    return availableParts.filter(
      (p) =>
        p.name.toLowerCase().includes(partSearch.toLowerCase()) ||
        p.index.toString().includes(partSearch)
    );
  }, [availableParts, partSearch]);

  const activeAnim = useMemo(() => {
    if (selectedPartIndex === null) return null;
    return settings.animationOverrides[selectedPartIndex] || null;
  }, [selectedPartIndex, settings.animationOverrides]);

  const selectedPart = useMemo(() => {
    if (selectedPartIndex === null) return null;
    return availableParts.find((p) => p.index === selectedPartIndex) || null;
  }, [selectedPartIndex, availableParts]);

  // Code generator with custom names and comments
  const generatedCode = useMemo(() => {
    const rotRadX = (settings.rotX * Math.PI) / 180;
    const rotRadY = (settings.rotY * Math.PI) / 180;
    const rotRadZ = (settings.rotZ * Math.PI) / 180;

    let output = `// Optimal CAD Alignment Settings for [${activeModelId}]:\n`;
    output += `const offset: [number, number, number] = [${settings.offsetX.toFixed(2)}, ${settings.offsetY.toFixed(2)}, ${settings.offsetZ.toFixed(2)}];\n`;
    output += `const rotation: [number, number, number] = [${rotRadX.toFixed(3)}, ${rotRadY.toFixed(3)}, ${rotRadZ.toFixed(3)}]; // [${settings.rotX}°, ${settings.rotY}°, ${settings.rotZ}°]\n`;
    output += `const scale = ${settings.scale.toFixed(2)};\n`;

    if (Object.keys(settings.colorOverrides).length > 0) {
      output += `\n// Custom Part Color Overrides:\n`;
      output += `const partColorOverrides: Record<number, string> = {\n`;
      for (const [idxStr, color] of Object.entries(settings.colorOverrides)) {
        const idx = parseInt(idxStr);
        const name = availableParts.find((p) => p.index === idx)?.name || `Part #${idx}`;
        output += `  ${idx}: '${color}', // ${name}\n`;
      }
      output += `};\n`;
    }

    if (Object.keys(settings.animationOverrides).length > 0) {
      output += `\n// Custom Part Animations:\n`;
      output += `const partAnimationOverrides = ${JSON.stringify(settings.animationOverrides, null, 2)};\n`;
    }

    if (activeModelId === 'cable-robot-2') {
      output += `\n// CDPR 4-Cable Robot Kinematics Config:\n`;
      output += `const cdprConfig = ${JSON.stringify(settings.cdprConfig, null, 2)};\n`;
    }

    return output;
  }, [activeModelId, settings, availableParts]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sceneRef = useRef<THREE.Scene | null>(null);

  const handleSaveRename = (index: number) => {
    if (tempPartName.trim()) {
      updatePartName(index, tempPartName.trim());
    }
    setEditingPartIndex(null);
    setTempPartName('');
  };

  const handleSplitIslands = (partIndex: number) => {
    if (!sceneRef.current) return;

    // Locate target mesh in active WebGL scene
    const cadMeshes: THREE.Mesh[] = [];
    const nonGizmoMeshes: THREE.Mesh[] = [];
    sceneRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (m.userData?.isCadMesh) {
          cadMeshes.push(m);
        }
        if (
          !m.name.includes('Helper') &&
          !m.name.includes('Gizmo') &&
          !m.name.includes('Grid') &&
          !m.name.includes('Line')
        ) {
          nonGizmoMeshes.push(m);
        }
      }
    });

    const targetMesh =
      cadMeshes.find(
        (m) =>
          m.userData.cadPartIndex === partIndex ||
          m.userData.partIndex === partIndex
      ) ||
      cadMeshes[partIndex] ||
      nonGizmoMeshes.find((m) => m.userData.partIndex === partIndex) ||
      nonGizmoMeshes[partIndex];

    if (!targetMesh || !targetMesh.geometry || !targetMesh.parent) {
      setSplitFeedback(`⚠️ Unable to locate 3D mesh for part #${partIndex}.`);
      setTimeout(() => setSplitFeedback(null), 3000);
      return;
    }

    // Save original geometry for undo
    if (!targetMesh.userData.originalGeometry) {
      targetMesh.userData.originalGeometry = targetMesh.geometry.clone();
    }

    const res = separateDisconnectedIslands(targetMesh.geometry, splitToleranceRatio);
    if (res.islandCount <= 1) {
      setSplitFeedback(`ℹ️ Part #${partIndex} is already a single unified solid piece with no air gaps.`);
      setTimeout(() => setSplitFeedback(null), 4000);
      return;
    }

    const parent = targetMesh.parent;
    const originalPart = availableParts.find((p) => p.index === partIndex);
    const originalName = originalPart?.name || `Part #${partIndex}`;
    const baseName = originalName.replace(/\s*\(.*?\)$/, '');

    // 1. Keep island 0 on original mesh
    targetMesh.geometry = res.geometries[0];
    targetMesh.geometry.computeBoundingBox();
    targetMesh.name = `${baseName} (Body A)`;
    targetMesh.userData.partIndex = partIndex;
    targetMesh.userData.cadPartIndex = partIndex;
    targetMesh.userData.isCadMesh = true;

    // 2. Add sibling meshes for additional islands
    const subPartConfigs: { name: string; color: string }[] = [];
    const createdMeshes: THREE.Mesh[] = [];

    for (let i = 1; i < res.geometries.length; i++) {
      const bodyLabel = String.fromCharCode(65 + i);
      const subMat = Array.isArray(targetMesh.material)
        ? targetMesh.material.map((m) => m.clone())
        : targetMesh.material.clone();

      const subMesh = new THREE.Mesh(res.geometries[i], subMat);
      subMesh.name = `${baseName} (Body ${bodyLabel})`;
      subMesh.position.copy(targetMesh.position);
      subMesh.rotation.copy(targetMesh.rotation);
      subMesh.scale.copy(targetMesh.scale);
      subMesh.castShadow = targetMesh.castShadow;
      subMesh.receiveShadow = targetMesh.receiveShadow;
      subMesh.userData.isSubPart = true;
      subMesh.userData.parentIndex = partIndex;
      subMesh.userData.isCadMesh = true;

      parent.add(subMesh);
      createdMeshes.push(subMesh);

      subPartConfigs.push({
        name: `${baseName} (Body ${bodyLabel})`,
        color: COLOR_PRESETS[(partIndex + i * 3) % COLOR_PRESETS.length].hex,
      });
    }

    // Register new sub-parts in context
    const newIndices = registerSplitParts(partIndex, subPartConfigs, 'islands');
    createdMeshes.forEach((cm, idx) => {
      if (newIndices[idx] !== undefined) {
        cm.userData.partIndex = newIndices[idx];
        cm.userData.cadPartIndex = newIndices[idx];
      }
    });

    if (newIndices.length > 0) {
      setSelectedPartIndex(newIndices[0]);
      setSplitFeedback(`✨ Separated "${originalName}" into ${res.islandCount} independent 3D parts!`);
      setTimeout(() => setSplitFeedback(null), 4500);
    }
  };

  const handleSplitByPlane = (partIndex: number) => {
    if (!sceneRef.current) return;

    const cadMeshes: THREE.Mesh[] = [];
    const nonGizmoMeshes: THREE.Mesh[] = [];
    sceneRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (m.userData?.isCadMesh) {
          cadMeshes.push(m);
        }
        if (
          !m.name.includes('Helper') &&
          !m.name.includes('Gizmo') &&
          !m.name.includes('Grid') &&
          !m.name.includes('Line')
        ) {
          nonGizmoMeshes.push(m);
        }
      }
    });

    const targetMesh =
      cadMeshes.find(
        (m) =>
          m.userData.cadPartIndex === partIndex ||
          m.userData.partIndex === partIndex
      ) ||
      cadMeshes[partIndex] ||
      nonGizmoMeshes.find((m) => m.userData.partIndex === partIndex) ||
      nonGizmoMeshes[partIndex];

    if (!targetMesh || !targetMesh.geometry || !targetMesh.parent) return;

    if (!targetMesh.userData.originalGeometry) {
      targetMesh.userData.originalGeometry = targetMesh.geometry.clone();
    }

    const normal = new THREE.Vector3(
      cuttingPlaneConfig.axis === 'x' ? 1 : 0,
      cuttingPlaneConfig.axis === 'y' ? 1 : 0,
      cuttingPlaneConfig.axis === 'z' ? 1 : 0
    );
    const point = new THREE.Vector3(
      cuttingPlaneConfig.axis === 'x' ? cuttingPlaneConfig.offset : 0,
      cuttingPlaneConfig.axis === 'y' ? cuttingPlaneConfig.offset : 0,
      cuttingPlaneConfig.axis === 'z' ? cuttingPlaneConfig.offset : 0
    );

    const res = sliceGeometryByPlane(targetMesh.geometry, point, normal);
    if (!res) {
      setSplitFeedback(`⚠️ Cutting plane does not intersect part #${partIndex}. Try adjusting the position slider.`);
      setTimeout(() => setSplitFeedback(null), 4000);
      return;
    }

    const parent = targetMesh.parent;
    const originalPart = availableParts.find((p) => p.index === partIndex);
    const originalName = originalPart?.name || `Part #${partIndex}`;
    const baseName = originalName.replace(/\s*\(.*?\)$/, '');
    const axisLabel = cuttingPlaneConfig.axis.toUpperCase();

    // 1. Assign sideA to target mesh
    targetMesh.geometry = res.sideA;
    targetMesh.geometry.computeBoundingBox();
    targetMesh.name = `${baseName} (+${axisLabel} Half)`;
    targetMesh.userData.partIndex = partIndex;
    targetMesh.userData.cadPartIndex = partIndex;
    targetMesh.userData.isCadMesh = true;

    // 2. Clone and attach sideB mesh
    const subMat = Array.isArray(targetMesh.material)
      ? targetMesh.material.map((m) => m.clone())
      : targetMesh.material.clone();

    const subMesh = new THREE.Mesh(res.sideB, subMat);
    subMesh.name = `${baseName} (-${axisLabel} Half)`;
    subMesh.position.copy(targetMesh.position);
    subMesh.rotation.copy(targetMesh.rotation);
    subMesh.scale.copy(targetMesh.scale);
    subMesh.castShadow = targetMesh.castShadow;
    subMesh.receiveShadow = targetMesh.receiveShadow;
    subMesh.userData.isSubPart = true;
    subMesh.userData.parentIndex = partIndex;
    subMesh.userData.isCadMesh = true;
    parent.add(subMesh);

    const subPartConfigs = [
      {
        name: `${baseName} (-${axisLabel} Half)`,
        color: COLOR_PRESETS[(partIndex + 5) % COLOR_PRESETS.length].hex,
      },
    ];

    const newIndices = registerSplitParts(partIndex, subPartConfigs, 'plane');
    if (newIndices.length > 0) {
      subMesh.userData.partIndex = newIndices[0];
      subMesh.userData.cadPartIndex = newIndices[0];
      setSelectedPartIndex(newIndices[0]);
      setSplitFeedback(`✂️ Bisected "${originalName}" along ${axisLabel}-axis into 2 independent 3D parts!`);
      setTimeout(() => setSplitFeedback(null), 4500);
    }
    setCuttingPlaneConfig({ active: false });
  };

  const handleRevertSplit = (splitRecord: SplitPartRecord) => {
    if (!sceneRef.current) return;

    const parentPartIndex = splitRecord.originalPartIndex;
    let targetMesh: THREE.Mesh | null = null;
    const subMeshesToRemove: THREE.Mesh[] = [];

    sceneRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (
          m.userData.cadPartIndex === parentPartIndex ||
          m.userData.partIndex === parentPartIndex
        ) {
          targetMesh = m;
        }
        if (m.userData.parentIndex === parentPartIndex && m.userData.isSubPart) {
          subMeshesToRemove.push(m);
        }
      }
    });

    if (targetMesh && (targetMesh as THREE.Mesh).userData.originalGeometry) {
      (targetMesh as THREE.Mesh).geometry = (targetMesh as THREE.Mesh).userData.originalGeometry;
      (targetMesh as THREE.Mesh).geometry.computeBoundingBox();
    }

    subMeshesToRemove.forEach((sm) => {
      sm.parent?.remove(sm);
      sm.geometry.dispose();
    });

    setSplitFeedback(`↺ Reverted split for Part #${parentPartIndex} back to unified body.`);
    setTimeout(() => setSplitFeedback(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      
      {/* 1. TOP STUDIO TOOLBAR */}
      <header className="h-14 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 flex items-center justify-between z-30 shrink-0">
        
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} />
            <span>Return to Portfolio</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Cpu size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white font-mono flex items-center gap-2">
                <span>CAD STUDIO WORKBENCH</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono border border-blue-500/30">PRO</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Center: Model Selector Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <Box size={14} className="text-blue-400" />
            <select
              value={activeModelId}
              onChange={(e) => {
                setActiveModelId(e.target.value);
                setSelectedPartIndex(null);
              }}
              className="bg-transparent text-xs font-mono font-semibold text-white outline-none cursor-pointer pr-2"
            >
              {modelsList.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                  {m.title} ({m.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Render Toggles & Theme */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Mode Switcher */}
          <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80">
            <button
              onClick={() => setRenderMode('shaded')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                renderMode === 'shaded' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cel-Shaded
            </button>
            <button
              onClick={() => setRenderMode('blueprint')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                renderMode === 'blueprint' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Blueprint
            </button>
          </div>

          {/* Camera Projection */}
          <button
            onClick={() => setIsOrthographic((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg border transition-all ${
              isOrthographic
                ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Isometric Orthographic vs Perspective Camera"
          >
            {isOrthographic ? 'Isometric (Ortho)' : 'Perspective'}
          </button>

          {/* Center Axes / Gizmo Toggle */}
          <button
            onClick={() => updateSetting('showGizmo', !settings.showGizmo)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
              settings.showGizmo
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40 font-medium'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Center Pivot Axes (CAD Gizmo)"
          >
            <Crosshair size={13} className={settings.showGizmo ? 'text-emerald-400' : 'text-slate-400'} />
            <span className="text-[11px]">{settings.showGizmo ? 'Axes ON' : 'Axes OFF'}</span>
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-all ${
              showGrid
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle Ground Grid"
          >
            <Layers size={14} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Toggle Canvas Theme"
          >
            {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-400" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN STUDIO BODY (3-PANEL EXPANSIVE WORKBENCH) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANEL: HIERARCHY & ASSEMBLY PART TREE */}
        <aside className="w-72 bg-slate-900/60 backdrop-blur border-r border-slate-800 flex flex-col z-20 shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers size={13} className="text-blue-400" />
              <span>ASSEMBLY TREE</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              {availableParts.length} parts
            </span>
          </div>

          {/* Part Search */}
          <div className="p-2 border-b border-slate-800/60">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter parts by name or #..."
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 bg-slate-950/80 text-xs font-mono text-slate-200 rounded-lg border border-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Parts List with Inline Rename */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredParts.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-500">
                No parts detected
              </div>
            ) : (
              filteredParts.map((part) => {
                const isSelected = selectedPartIndex === part.index;
                const isEditing = editingPartIndex === part.index;
                const activeColor = settings.colorOverrides[part.index] || part.color;
                const hasAnim = settings.animationOverrides[part.index] && settings.animationOverrides[part.index].type !== 'none';

                return (
                  <div
                    key={part.index}
                    className={`group relative rounded-lg text-xs font-mono flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md font-semibold'
                        : 'hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full p-1.5">
                        <input
                          type="text"
                          value={tempPartName}
                          autoFocus
                          onChange={(e) => setTempPartName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(part.index);
                            if (e.key === 'Escape') setEditingPartIndex(null);
                          }}
                          className="flex-1 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-blue-400 outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(part.index)}
                          className="p-1 rounded bg-blue-500 text-white hover:bg-blue-400 cursor-pointer"
                        >
                          <Check size={11} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPartIndex(isSelected ? null : part.index);
                            if (!isSelected && activeTab === 'transform') {
                              setActiveTab('colors');
                            }
                          }}
                          className="flex-1 text-left px-2.5 py-2 flex items-center gap-2 truncate cursor-pointer"
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-inner"
                            style={{ backgroundColor: activeColor }}
                          />
                          <span className="truncate">{part.name}</span>
                        </button>

                        <div className="flex items-center gap-1 pr-2 shrink-0">
                          {hasAnim && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Animated" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPartIndex(part.index);
                              setCuttingPlaneConfig({ targetPartIndex: part.index });
                              setActiveTab('splitter');
                            }}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-opacity cursor-pointer ${
                              isSelected ? 'text-white' : 'text-purple-400 hover:text-white'
                            }`}
                            title="Open Splitter Tool for this part"
                          >
                            <Scissors size={11} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPartIndex(part.index);
                              setTempPartName(part.name);
                            }}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-opacity cursor-pointer ${
                              isSelected ? 'text-white' : 'text-slate-400 hover:text-white'
                            }`}
                            title="Rename Part"
                          >
                            <Edit2 size={11} />
                          </button>
                          <span className="text-[10px] opacity-60">#{part.index}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick selection bar */}
          {selectedPartIndex !== null && (
            <div className="p-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 truncate max-w-[170px]">
                Selected: <span className="text-blue-400 font-semibold">{selectedPart?.name}</span>
              </span>
              <button
                onClick={() => setSelectedPartIndex(null)}
                className="text-slate-400 hover:text-white underline cursor-pointer text-[11px]"
              >
                Deselect
              </button>
            </div>
          )}
        </aside>

        {/* CENTER VIEWPORT: EXPANSIVE 3D WORKSPACE */}
        <main className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden">
          
          {/* Subtle Background Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-950/80 to-slate-950 pointer-events-none" />

          {/* 3D Canvas with Direct Click Selection */}
          <Canvas
            className="grab-cursor"
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
          >
            {isOrthographic ? (
              <OrthographicCamera
                makeDefault
                position={[5, 4, 5]}
                zoom={90}
                near={-100}
                far={1000}
              />
            ) : (
              <PerspectiveCamera
                makeDefault
                position={[5.5, 3.8, 5.5]}
                fov={38}
                near={0.1}
                far={1000}
              />
            )}

            {/* Studio Lighting */}
            <ambientLight intensity={isDark ? (renderMode === 'shaded' ? 1.0 : 0.8) : 1.1} />
            <directionalLight position={[8, 12, 8]} intensity={renderMode === 'shaded' ? 1.6 : 1.2} castShadow />
            <directionalLight position={[-8, -4, -6]} intensity={0.5} />

            {/* Ground Drafting Grid */}
            {showGrid && (
              <Grid
                position={[0, -1.8, 0]}
                args={[20, 20]}
                cellSize={0.5}
                cellThickness={1}
                cellColor={isDark ? '#334155' : '#94a3b8'}
                sectionSize={2.0}
                sectionThickness={1.5}
                sectionColor={isDark ? '#3b82f6' : '#2563eb'}
                fadeDistance={15}
                fadeStrength={1}
              />
            )}

            <Suspense fallback={null}>
              <ModelRenderer
                modelType={activeModelId}
                isActive={renderMode === 'shaded'}
                isHovered={false}
                isRotating={settings.autoRotate}
              />
            </Suspense>

            {/* Scene Bridge for Dynamic Live Splitting & Material Synchronization */}
            <StudioSceneBridge
              onSceneReady={(sc) => {
                sceneRef.current = sc;
              }}
              onEngineReady={(handles) => {
                studioEngineRef.current = handles;
              }}
              selectedPartIndex={selectedPartIndex}
              colorOverrides={settings.colorOverrides}
              animationOverrides={settings.animationOverrides}
            />

            {/* Interactive Cutting Plane Gizmo for Part Slicing */}
            {cuttingPlaneConfig.active && (
              <CADCuttingPlaneGizmo
                axis={cuttingPlaneConfig.axis}
                offset={cuttingPlaneConfig.offset}
                size={2.8}
                visible={true}
              />
            )}

            {/* Interactive Orientation Gizmo Cube in Top-Right */}
            <GizmoHelper alignment="top-right" margin={[70, 70]}>
              <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#ffffff" />
            </GizmoHelper>

            <OrbitControls
              target={[0, 0, 0]}
              enableZoom={true}
              enablePan={true}
              dampingFactor={0.08}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 1.05}
            />
          </Canvas>

          {/* Overlay Model Info Badge */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur px-3 py-2 rounded-xl border border-slate-800 shadow-xl space-y-0.5 pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs font-bold text-white tracking-tight">{activeProject.title}</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400">
                SCALE: {settings.scale.toFixed(2)}x • ROT: [{settings.rotX}°, {settings.rotY}°, {settings.rotZ}°]
              </p>
            </div>
          </div>

          {/* Overlay Turntable Pause/Play Floating Pill */}
          <div className="absolute bottom-4 left-4 z-10">
            <button
              onClick={() => updateSetting('autoRotate', !settings.autoRotate)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-xs font-semibold shadow-xl backdrop-blur-md border transition-all cursor-pointer ${
                settings.autoRotate
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-blue-500/20'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <RotateCw size={13} className={settings.autoRotate ? 'animate-spin' : ''} />
              <span>{settings.autoRotate ? 'Auto-Spin Active' : 'Turntable Paused'}</span>
            </button>
          </div>
        </main>

        {/* RIGHT PANEL: INSPECTOR & STUDIO CONTROLS */}
        <aside className="w-80 sm:w-96 bg-slate-900/80 backdrop-blur border-l border-slate-800 flex flex-col z-20 shrink-0">
          
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1">
            <button
              onClick={() => setActiveTab('transform')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'transform'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Move size={13} />
              <span>Transform</span>
            </button>

            <button
              onClick={() => setActiveTab('colors')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'colors'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Palette size={13} />
              <span>Colors</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('splitter');
                if (selectedPartIndex !== null) {
                  setCuttingPlaneConfig({ targetPartIndex: selectedPartIndex });
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'splitter'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scissors size={13} />
              <span>Splitter</span>
            </button>

            <button
              onClick={() => setActiveTab('kinematics')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'kinematics'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play size={13} />
              <span>Motion</span>
            </button>

            {activeModelId === 'cable-robot-2' && (
              <button
                onClick={() => setActiveTab('cdpr')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                  activeTab === 'cdpr'
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm font-semibold'
                    : 'text-amber-400 hover:text-amber-200'
                }`}
              >
                <Cpu size={13} />
                <span>CDPR Rig</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'export'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Copy size={13} />
              <span>Export</span>
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* TAB 1: TRANSFORMS */}
            {activeTab === 'transform' && (
              <div className="space-y-6">
                
                {/* Scale */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center font-mono text-xs">
                    <span className="font-semibold text-slate-200">Scale Factor</span>
                    <span className="text-blue-400">{settings.scale.toFixed(2)}x</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.1"
                      max="15.0"
                      step="0.05"
                      value={settings.scale}
                      onChange={(e) => updateSetting('scale', parseFloat(e.target.value))}
                      className="flex-1 accent-blue-500 cursor-pointer"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={settings.scale}
                      onChange={(e) => updateSetting('scale', parseFloat(e.target.value) || 1)}
                      className="w-16 px-2 py-1 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right"
                    />
                  </div>
                </div>

                {/* Rotation X / Y / Z with Direct Inputs & 90° Snap Buttons */}
                <div className="space-y-4 border-t border-slate-800 pt-4">
                  <span className="text-xs font-mono font-semibold uppercase text-slate-400">Rotation (Degrees)</span>
                  
                  {/* Rot X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-red-400 font-bold">X-Axis Rotation</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={settings.rotX}
                          onChange={(e) => updateSetting('rotX', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right focus:border-red-500 outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">°</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={settings.rotX}
                        onChange={(e) => updateSetting('rotX', parseInt(e.target.value))}
                        className="flex-1 accent-red-500 cursor-pointer"
                      />
                      <button
                        onClick={() => updateSetting('rotX', (settings.rotX - 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        -90°
                      </button>
                      <button
                        onClick={() => updateSetting('rotX', (settings.rotX + 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        +90°
                      </button>
                    </div>
                  </div>

                  {/* Rot Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-green-400 font-bold">Y-Axis Rotation</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={settings.rotY}
                          onChange={(e) => updateSetting('rotY', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right focus:border-green-500 outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">°</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={settings.rotY}
                        onChange={(e) => updateSetting('rotY', parseInt(e.target.value))}
                        className="flex-1 accent-green-500 cursor-pointer"
                      />
                      <button
                        onClick={() => updateSetting('rotY', (settings.rotY - 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        -90°
                      </button>
                      <button
                        onClick={() => updateSetting('rotY', (settings.rotY + 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        +90°
                      </button>
                    </div>
                  </div>

                  {/* Rot Z */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-blue-400 font-bold">Z-Axis Rotation</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={settings.rotZ}
                          onChange={(e) => updateSetting('rotZ', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right focus:border-blue-500 outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">°</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={settings.rotZ}
                        onChange={(e) => updateSetting('rotZ', parseInt(e.target.value))}
                        className="flex-1 accent-blue-500 cursor-pointer"
                      />
                      <button
                        onClick={() => updateSetting('rotZ', (settings.rotZ - 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        -90°
                      </button>
                      <button
                        onClick={() => updateSetting('rotZ', (settings.rotZ + 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        +90°
                      </button>
                    </div>
                  </div>
                </div>

                {/* Position Offset X / Y / Z with Direct Inputs */}
                <div className="space-y-4 border-t border-slate-800 pt-4">
                  <span className="text-xs font-mono font-semibold uppercase text-slate-400">Position Offset (Meters)</span>
                  
                  {['offsetX', 'offsetY', 'offsetZ'].map((axisKey, idx) => {
                    const label = ['Offset X', 'Offset Y', 'Offset Z'][idx];
                    const color = ['text-red-400', 'text-green-400', 'text-blue-400'][idx];
                    const val = settings[axisKey as keyof typeof settings] as number;

                    return (
                      <div key={axisKey} className="space-y-1.5">
                        <div className="flex justify-between items-center font-mono text-[11px]">
                          <span className={`${color} font-bold`}>{label}</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={val}
                              onChange={(e) => updateSetting(axisKey as any, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right focus:border-blue-500 outline-none"
                            />
                            <span className="text-slate-400 text-[11px]">m</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="-3.0"
                          max="3.0"
                          step="0.01"
                          value={val}
                          onChange={(e) => updateSetting(axisKey as any, parseFloat(e.target.value))}
                          className="w-full accent-slate-400 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Viewport Gizmo & Center Axes Toggle */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <Crosshair size={14} className={settings.showGizmo ? 'text-emerald-400' : 'text-slate-500'} />
                    <span className="text-slate-300 font-medium">Center Pivot Axes (CAD Gizmo)</span>
                  </div>
                  <button
                    onClick={() => updateSetting('showGizmo', !settings.showGizmo)}
                    className={`px-3 py-1 rounded-lg border text-xs font-mono transition-colors ${
                      settings.showGizmo
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {settings.showGizmo ? 'Visible' : 'Hidden'}
                  </button>
                </div>

                {/* Reset button */}
                <div className="pt-2">
                  <button
                    onClick={resetSettings}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Reset Transforms to Defaults</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: PART COLORS & MATERIALS */}
            {activeTab === 'colors' && (
              <div className="space-y-5">
                {selectedPartIndex === null ? (
                  <div className="bg-slate-950/60 rounded-xl p-4 text-center border border-slate-800 space-y-2">
                    <Palette size={24} className="mx-auto text-blue-400 opacity-60" />
                    <p className="text-xs font-mono text-slate-300 font-semibold">Select a Part from the Assembly Tree</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Choose any component on the left list to inspect its material, rename it, or customize its color.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Part Name & Rename Field */}
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400">Selected Component</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedPart?.name || ''}
                          onChange={(e) => updatePartName(selectedPartIndex, e.target.value)}
                          placeholder="Part Name..."
                          className="flex-1 px-2.5 py-1.5 bg-slate-950 text-xs font-mono font-bold text-white rounded-lg border border-slate-700 outline-none focus:border-blue-500"
                        />
                        <span className="text-[10px] font-mono text-slate-400 px-2 py-1 bg-slate-900 rounded">
                          #{selectedPartIndex}
                        </span>
                      </div>
                    </div>

                    {/* Color Input */}
                    <div className="space-y-2">
                      <span className="text-xs font-mono font-semibold text-slate-300">Custom Hex Color</span>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={getSafeColor(settings.colorOverrides[selectedPartIndex] || selectedPart?.color)}
                          onChange={(e) => updatePartColor(selectedPartIndex, e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={settings.colorOverrides[selectedPartIndex] || ''}
                          placeholder={selectedPart?.color || '#RRGGBB'}
                          onChange={(e) => updatePartColor(selectedPartIndex, e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 text-xs font-mono text-white rounded-lg border border-slate-800 outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* Color Presets */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-mono font-semibold text-slate-400">Preset Anodized Palettes</span>
                      <div className="grid grid-cols-4 gap-2">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.hex}
                            onClick={() => updatePartColor(selectedPartIndex, preset.hex)}
                            className="group flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 transition-all cursor-pointer"
                            title={preset.name}
                          >
                            <span
                              className="w-6 h-6 rounded-md shadow-md border border-white/20"
                              style={{ backgroundColor: preset.hex }}
                            />
                            <span className="text-[9px] font-mono text-slate-400 truncate max-w-full">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MESH PART SPLITTER */}
            {activeTab === 'splitter' && (
              <div className="space-y-5">
                {splitFeedback && (
                  <div className="p-3 bg-purple-950/70 border border-purple-500/50 rounded-xl text-xs font-mono text-purple-200 flex items-center gap-2 animate-fade-in shadow-lg">
                    <Sparkles size={15} className="text-purple-400 shrink-0" />
                    <span>{splitFeedback}</span>
                  </div>
                )}

                {selectedPartIndex === null ? (
                  <div className="bg-slate-950/60 rounded-xl p-5 text-center border border-slate-800 space-y-3">
                    <Scissors size={28} className="mx-auto text-purple-400 opacity-60" />
                    <p className="text-xs font-mono text-slate-200 font-semibold">Select a Part to Split</p>
                    <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                      Choose any compound part from the assembly tree on the left to separate disconnected bodies (air gaps) or add cutting planes to bisect geometry.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Selected Part Card Header */}
                    <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold flex items-center gap-1.5">
                          <Scissors size={12} />
                          <span>Active Target Node</span>
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Part #{selectedPartIndex}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20 shadow-inner"
                          style={{ backgroundColor: settings.colorOverrides[selectedPartIndex] || selectedPart?.color || '#cbd5e1' }}
                        />
                        <h4 className="text-xs font-bold text-white font-mono truncate">
                          {selectedPart?.name || `Part #${selectedPartIndex}`}
                        </h4>
                      </div>
                    </div>

                    {/* METHOD 1: DISCONNECTED ISLANDS (AIR SEPARATION) */}
                    <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Boxes size={15} className="text-blue-400" />
                          <span className="text-xs font-mono font-bold text-white">Separate by Air / Loose Bodies</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                          Auto-Detect
                        </span>
                      </div>

                      <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                        Scans triangle connectivity across the selected geometry to detect physically separate bodies with air between them (e.g. dual extrusions, brackets, or fastener sets sharing 1 mesh).
                      </p>

                      {/* Gap Detection Sensitivity Selector */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="text-slate-300 font-semibold">Gap Sensitivity</span>
                          <span className="text-blue-400 font-bold">
                            {splitToleranceRatio === 0.0003
                              ? 'Fine (Tiny Gaps)'
                              : splitToleranceRatio === 0.001
                              ? 'Balanced (Standard CAD)'
                              : 'Coarse (Wide Gaps Only)'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { label: 'Fine', value: 0.0003, desc: '0.03%' },
                            { label: 'Balanced', value: 0.001, desc: '0.1%' },
                            { label: 'Coarse', value: 0.004, desc: '0.4%' },
                          ].map((opt) => (
                            <button
                              key={opt.label}
                              onClick={() => setSplitToleranceRatio(opt.value)}
                              className={`py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all cursor-pointer border ${
                                splitToleranceRatio === opt.value
                                  ? 'bg-blue-600/30 text-blue-300 border-blue-500/50 shadow-sm'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {opt.label} <span className="text-[9px] opacity-70">({opt.desc})</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSplitIslands(selectedPartIndex)}
                        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                      >
                        <Sparkles size={13} />
                        <span>⚡ Separate Disconnected Bodies</span>
                      </button>
                    </div>

                    {/* METHOD 2: INTERACTIVE CUTTING PLANE SLICER */}
                    <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Scissors size={15} className="text-purple-400" />
                          <span className="text-xs font-mono font-bold text-white">Bisect with Cutting Plane</span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                          Planar Slice
                        </span>
                      </div>

                      <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                        Add a 3D slicing plane across the part to cut and divide it into two independent sub-parts for custom multi-tone coloring or isolated animation.
                      </p>

                      {/* Slicing Axis Buttons */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-mono font-semibold text-slate-300">Cutting Normal Axis</span>
                        <div className="flex gap-2">
                          {(['x', 'y', 'z'] as const).map((ax) => (
                            <button
                              key={ax}
                              onClick={() => {
                                setCuttingPlaneConfig({
                                  active: true,
                                  targetPartIndex: selectedPartIndex,
                                  axis: ax,
                                });
                              }}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono uppercase font-bold transition-all cursor-pointer ${
                                cuttingPlaneConfig.active && cuttingPlaneConfig.axis === ax
                                  ? ax === 'x'
                                    ? 'bg-red-600 text-white shadow-md'
                                    : ax === 'y'
                                    ? 'bg-green-600 text-white shadow-md'
                                    : 'bg-blue-600 text-white shadow-md'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              {ax}-Axis
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Plane Offset Position Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-mono">
                          <span className="text-slate-300 font-semibold">Plane Position</span>
                          <span className="text-purple-400 font-bold">
                            {(cuttingPlaneConfig.offset * 100).toFixed(1)} cm
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="-1.5"
                            max="1.5"
                            step="0.01"
                            value={cuttingPlaneConfig.offset}
                            onChange={(e) => {
                              setCuttingPlaneConfig({
                                active: true,
                                targetPartIndex: selectedPartIndex,
                                offset: parseFloat(e.target.value),
                              });
                            }}
                            className="flex-1 accent-purple-500 cursor-pointer"
                          />
                          <input
                            type="number"
                            step="0.01"
                            value={cuttingPlaneConfig.offset}
                            onChange={(e) => {
                              setCuttingPlaneConfig({
                                active: true,
                                targetPartIndex: selectedPartIndex,
                                offset: parseFloat(e.target.value) || 0,
                              });
                            }}
                            className="w-16 px-2 py-0.5 bg-slate-900 text-xs font-mono text-white rounded border border-slate-700 text-right outline-none"
                          />
                        </div>
                      </div>

                      {/* Cutting Plane Gizmo Toggle */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => {
                            setCuttingPlaneConfig({
                              active: !cuttingPlaneConfig.active,
                              targetPartIndex: selectedPartIndex,
                            });
                          }}
                          className={`text-[11px] font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            cuttingPlaneConfig.active
                              ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 font-bold'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                        >
                          {cuttingPlaneConfig.active ? '👁️ Plane Gizmo Active' : 'Show 3D Plane Gizmo'}
                        </button>

                        <button
                          onClick={() => handleSplitByPlane(selectedPartIndex)}
                          className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                        >
                          <Scissors size={12} />
                          <span>✂️ Apply Split</span>
                        </button>
                      </div>
                    </div>

                    {/* METHOD 3: SPLIT HISTORY & LINEAGE */}
                    {splitHistory.length > 0 && (
                      <div className="bg-slate-950/80 rounded-xl p-3.5 border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold text-slate-300">
                            Split History ({splitHistory.length})
                          </span>
                          <button
                            onClick={() => setActiveTab('colors')}
                            className="text-[10px] font-mono text-blue-400 hover:text-blue-300 underline cursor-pointer"
                          >
                            Color Sub-Parts →
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto">
                          {splitHistory.map((rec) => (
                            <div
                              key={rec.id}
                              className="p-2 rounded bg-slate-900/90 border border-slate-800 text-[11px] font-mono flex items-center justify-between"
                            >
                              <span className="text-slate-300">
                                Part #{rec.originalPartIndex} →{' '}
                                <span className="text-purple-400 font-semibold">
                                  {rec.newPartIndices.map((i) => `#${i}`).join(', ')}
                                </span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">
                                  {rec.type}
                                </span>
                                <button
                                  onClick={() => handleRevertSplit(rec)}
                                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                                  title="Revert / Merge this split"
                                >
                                  <Undo2 size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: KINEMATICS & MOTION */}
            {activeTab === 'kinematics' && (
              <div className="space-y-5">
                {selectedPartIndex === null ? (
                  <div className="bg-slate-950/60 rounded-xl p-4 text-center border border-slate-800 space-y-2">
                    <Play size={24} className="mx-auto text-amber-400 opacity-60" />
                    <p className="text-xs font-mono text-slate-300 font-semibold">Select a Part to Animate</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Pick any component from the assembly tree on the left to assign rotary RPM, oscillation sweep, or linear stroke.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Part Name Header */}
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Kinematics Node</span>
                      <h4 className="text-xs font-bold text-white font-mono truncate">
                        {selectedPart?.name || `Part #${selectedPartIndex}`}
                      </h4>
                    </div>

                    {/* Motion Type */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono font-semibold text-slate-300">Animation Type</span>
                      <select
                        value={activeAnim?.type || 'none'}
                        onChange={(e) =>
                          updatePartAnimation(selectedPartIndex, {
                            type: e.target.value as any,
                            axis: activeAnim?.axis || 'x',
                            speed: activeAnim?.speed || 60,
                            direction: activeAnim?.direction || 1,
                            amplitude: activeAnim?.amplitude || 35,
                            phase: activeAnim?.phase || 0,
                            pivotMode: activeAnim?.pivotMode || 'center-of-mass',
                            pivotX: activeAnim?.pivotX || 0,
                            pivotY: activeAnim?.pivotY || 0,
                            pivotZ: activeAnim?.pivotZ || 0,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 text-xs font-mono text-white rounded-lg border border-slate-800 outline-none cursor-pointer"
                      >
                        <option value="none">No Motion (Static)</option>
                        <option value="continuous-spin">Continuous Spin (Rotary RPM)</option>
                        <option value="oscillate-rotation">Oscillating Rotation (Sweep)</option>
                        <option value="linear-reciprocate">Linear Reciprocating (Stroke)</option>
                      </select>
                    </div>

                    {activeAnim && activeAnim.type !== 'none' && (
                      <>
                        {/* Axis */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-mono font-semibold text-slate-300">Rotation / Motion Axis</span>
                          <div className="flex gap-2">
                            {(['x', 'y', 'z'] as const).map((ax) => (
                              <button
                                key={ax}
                                onClick={() => updatePartAnimation(selectedPartIndex, { axis: ax })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-mono uppercase font-bold transition-all cursor-pointer ${
                                  activeAnim.axis === ax
                                    ? ax === 'x'
                                    ? 'bg-red-600 text-white'
                                    : ax === 'y'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {ax}-Axis
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Direction */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-mono font-semibold text-slate-300">Spin Direction</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePartAnimation(selectedPartIndex, { direction: 1 })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.direction === 1
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Forward / CW (+1)
                            </button>
                            <button
                              onClick={() => updatePartAnimation(selectedPartIndex, { direction: -1 })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.direction === -1
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Reverse / CCW (-1)
                            </button>
                          </div>
                        </div>

                        {/* Speed in RPM with Direct Input */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-slate-300 font-semibold">Motion Speed</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="10000"
                                step="1"
                                value={activeAnim.speed}
                                onChange={(e) => updatePartAnimation(selectedPartIndex, { speed: parseFloat(e.target.value) || 0 })}
                                className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-amber-400 font-bold rounded border border-slate-800 text-right outline-none"
                              />
                              <span className="text-slate-400 text-[11px]">RPM</span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="3000"
                            step="1"
                            value={activeAnim.speed}
                            onChange={(e) => updatePartAnimation(selectedPartIndex, { speed: parseFloat(e.target.value) })}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>

                        {/* Pivot Center Mode */}
                        <div className="space-y-2 border-t border-slate-800 pt-3">
                          <span className="text-xs font-mono font-semibold text-slate-300">Pivot Axis Center</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePartAnimation(selectedPartIndex, { pivotMode: 'center-of-mass' })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.pivotMode === 'center-of-mass'
                                  ? 'bg-emerald-600 text-white font-semibold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Center of Mass
                            </button>
                            <button
                              onClick={() => updatePartAnimation(selectedPartIndex, { pivotMode: 'custom' })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.pivotMode === 'custom'
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Custom Offset
                            </button>
                          </div>
                        </div>

                        {/* Custom Pivot XYZ with Direct Inputs */}
                        {activeAnim.pivotMode === 'custom' && (
                          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                            {['pivotX', 'pivotY', 'pivotZ'].map((pKey, idx) => {
                              const label = ['Pivot X (cm)', 'Pivot Y (cm)', 'Pivot Z (cm)'][idx];
                              const val = (activeAnim as any)[pKey] || 0;
                              return (
                                <div key={pKey} className="space-y-1.5">
                                  <div className="flex justify-between items-center font-mono text-[10px]">
                                    <span className="text-slate-400">{label}</span>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={val}
                                        onChange={(e) =>
                                          updatePartAnimation(selectedPartIndex, { [pKey]: parseFloat(e.target.value) || 0 })
                                        }
                                        className="w-16 px-1.5 py-0.5 bg-slate-950 text-[11px] font-mono text-white rounded border border-slate-800 text-right outline-none"
                                      />
                                      <span className="text-slate-400">cm</span>
                                    </div>
                                  </div>
                                  <input
                                    type="range"
                                    min="-100"
                                    max="100"
                                    step="1"
                                    value={val}
                                    onChange={(e) =>
                                      updatePartAnimation(selectedPartIndex, { [pKey]: parseInt(e.target.value) })
                                    }
                                    className="w-full accent-blue-500 cursor-pointer"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <button
                          onClick={() => resetPartAnimation(selectedPartIndex)}
                          className="w-full py-1.5 rounded-lg text-xs font-mono text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 transition-colors cursor-pointer"
                        >
                          Remove Animation from this Part
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CDPR CABLE ROBOT RIG & KINEMATICS */}
            {activeTab === 'cdpr' && (
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="bg-amber-950/40 p-3.5 rounded-xl border border-amber-800/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
                      <Cpu size={14} className="text-amber-400" />
                      <span>CDPR 4-CABLE KINEMATICS RIG</span>
                    </span>
                    <button
                      onClick={() => updateCDPRConfig({ enabled: !settings.cdprConfig.enabled })}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition-all ${
                        settings.cdprConfig.enabled
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {settings.cdprConfig.enabled ? 'RIG ACTIVE' : 'DISABLED'}
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-amber-200/70">
                    Real-time inverse kinematics simulation with dynamic end-effector plate and 8 driven cable spans.
                  </p>
                </div>

                {/* Section 1: End-Effector Central Plate */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Box size={13} className="text-orange-400" />
                    <span>End-Effector Central Plate</span>
                  </span>

                  {/* Plate Size */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Plate Width / Length</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.05"
                          max="0.80"
                          value={settings.cdprConfig.plateSize}
                          onChange={(e) => updateCDPRConfig({ plateSize: parseFloat(e.target.value) || 0.18 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.60"
                      step="0.01"
                      value={settings.cdprConfig.plateSize}
                      onChange={(e) => updateCDPRConfig({ plateSize: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                  </div>

                  {/* Plate Thickness */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Plate Thickness</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.002"
                          min="0.004"
                          max="0.08"
                          value={settings.cdprConfig.plateThickness}
                          onChange={(e) => updateCDPRConfig({ plateThickness: parseFloat(e.target.value) || 0.012 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.005"
                      max="0.05"
                      step="0.002"
                      value={settings.cdprConfig.plateThickness}
                      onChange={(e) => updateCDPRConfig({ plateThickness: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                  </div>

                  {/* Plate Elevation Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Plate Elevation (Y Plane)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="-0.80"
                          max="0.80"
                          value={settings.cdprConfig.plateElevation}
                          onChange={(e) => updateCDPRConfig({ plateElevation: parseFloat(e.target.value) || 0 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-0.60"
                      max="0.60"
                      step="0.01"
                      value={settings.cdprConfig.plateElevation}
                      onChange={(e) => updateCDPRConfig({ plateElevation: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                  </div>

                  {/* Plate Color */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-mono font-semibold text-slate-300">Plate Anodized Finish</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getSafeColor(settings.cdprConfig.plateColor, '#ea580c')}
                        onChange={(e) => updateCDPRConfig({ plateColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={settings.cdprConfig.plateColor}
                        onChange={(e) => updateCDPRConfig({ plateColor: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 uppercase outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Corner Pulley Frame Boundary */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Layers size={13} className="text-blue-400" />
                    <span>Frame Corner Pulley Boundary</span>
                  </span>

                  {/* Frame Width X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-red-400 font-bold">Frame Width (X Span)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.30"
                          max="2.50"
                          value={settings.cdprConfig.frameWidth}
                          onChange={(e) => updateCDPRConfig({ frameWidth: parseFloat(e.target.value) || 0.92 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.30"
                      max="2.00"
                      step="0.01"
                      value={settings.cdprConfig.frameWidth}
                      onChange={(e) => updateCDPRConfig({ frameWidth: parseFloat(e.target.value) })}
                      className="w-full accent-red-500 cursor-pointer"
                    />
                  </div>

                  {/* Frame Depth Z */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-blue-400 font-bold">Frame Depth (Z Span)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.30"
                          max="2.50"
                          value={settings.cdprConfig.frameDepth}
                          onChange={(e) => updateCDPRConfig({ frameDepth: parseFloat(e.target.value) || 0.92 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.30"
                      max="2.00"
                      step="0.01"
                      value={settings.cdprConfig.frameDepth}
                      onChange={(e) => updateCDPRConfig({ frameDepth: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* Pulley Elevation Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-green-400 font-bold">Corner Pulley Elevation (Y)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="-1.00"
                          max="1.50"
                          value={settings.cdprConfig.pulleyElevation}
                          onChange={(e) => updateCDPRConfig({ pulleyElevation: parseFloat(e.target.value) || 0.38 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-0.80"
                      max="1.00"
                      step="0.01"
                      value={settings.cdprConfig.pulleyElevation}
                      onChange={(e) => updateCDPRConfig({ pulleyElevation: parseFloat(e.target.value) })}
                      className="w-full accent-green-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Section 3: Winch Anchor Positions */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <RotateCw size={13} className="text-amber-400" />
                    <span>4 Frame Winch Spool Anchors</span>
                  </span>

                  {/* Winch Offset Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Winch Elevation (Y)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="-1.00"
                          max="1.00"
                          value={settings.cdprConfig.winchOffsetY}
                          onChange={(e) => updateCDPRConfig({ winchOffsetY: parseFloat(e.target.value) || -0.36 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-0.80"
                      max="0.80"
                      step="0.01"
                      value={settings.cdprConfig.winchOffsetY}
                      onChange={(e) => updateCDPRConfig({ winchOffsetY: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Winch Inset X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Winch Inset from Corner (X)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.00"
                          max="0.50"
                          value={settings.cdprConfig.winchInsetX}
                          onChange={(e) => updateCDPRConfig({ winchInsetX: parseFloat(e.target.value) || 0.05 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="0.40"
                      step="0.01"
                      value={settings.cdprConfig.winchInsetX}
                      onChange={(e) => updateCDPRConfig({ winchInsetX: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Winch Inset Z */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Winch Inset from Corner (Z)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.00"
                          max="0.50"
                          value={settings.cdprConfig.winchInsetZ}
                          onChange={(e) => updateCDPRConfig({ winchInsetZ: parseFloat(e.target.value) || 0.05 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="0.40"
                      step="0.01"
                      value={settings.cdprConfig.winchInsetZ}
                      onChange={(e) => updateCDPRConfig({ winchInsetZ: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Section 4: Motion Trajectory & Bounds */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Play size={13} className="text-emerald-400" />
                    <span>End-Effector Trajectory & Range</span>
                  </span>

                  {/* Motion Pattern Dropdown */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-slate-300">Kinematic Motion Pattern</span>
                    <select
                      value={settings.cdprConfig.motionPattern}
                      onChange={(e) => updateCDPRConfig({ motionPattern: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-950 text-xs font-mono text-white rounded-lg border border-slate-800 outline-none cursor-pointer"
                    >
                      <option value="lissajous">Harmonic Lissajous (Continuous Sweep)</option>
                      <option value="wander">Multi-Frequency Workspace Wander</option>
                      <option value="circle">Planar Circular Trajectory</option>
                      <option value="square">Perimeter Square Scan</option>
                      <option value="static">Static Rest (Neutral Center)</option>
                    </select>
                  </div>

                  {/* Travel Range X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Travel Bounds (±X)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.05"
                          max="1.00"
                          value={settings.cdprConfig.motionRangeX}
                          onChange={(e) => updateCDPRConfig({ motionRangeX: parseFloat(e.target.value) || 0.45 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.90"
                      step="0.01"
                      value={settings.cdprConfig.motionRangeX}
                      onChange={(e) => updateCDPRConfig({ motionRangeX: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Travel Range Z */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Travel Bounds (±Z)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.05"
                          max="1.00"
                          value={settings.cdprConfig.motionRangeZ}
                          onChange={(e) => updateCDPRConfig({ motionRangeZ: parseFloat(e.target.value) || 0.45 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.90"
                      step="0.01"
                      value={settings.cdprConfig.motionRangeZ}
                      onChange={(e) => updateCDPRConfig({ motionRangeZ: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Speed Multiplier */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Motion Speed</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10.0"
                          value={settings.cdprConfig.motionSpeed}
                          onChange={(e) => updateCDPRConfig({ motionSpeed: parseFloat(e.target.value) || 1.0 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-emerald-400 font-bold rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">x</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="4.0"
                      step="0.1"
                      value={settings.cdprConfig.motionSpeed}
                      onChange={(e) => updateCDPRConfig({ motionSpeed: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Section 5: Cable Visuals */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Palette size={13} className="text-sky-400" />
                    <span>Cable Aesthetics & Boundaries</span>
                  </span>

                  {/* Cable Color */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-slate-300">Driven Cable Color</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getSafeColor(settings.cdprConfig.cableColor, '#38bdf8')}
                        onChange={(e) => updateCDPRConfig({ cableColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={settings.cdprConfig.cableColor}
                        onChange={(e) => updateCDPRConfig({ cableColor: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 uppercase outline-none"
                      />
                    </div>
                  </div>

                  {/* Toggle Workspace Boundary Box */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-mono text-slate-300">Show Workspace Travel Bounds</span>
                    <button
                      onClick={() => updateCDPRConfig({ showWorkspaceBoundary: !settings.cdprConfig.showWorkspaceBoundary })}
                      className={`px-3 py-1 rounded text-xs font-mono cursor-pointer transition-all ${
                        settings.cdprConfig.showWorkspaceBoundary
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {settings.cdprConfig.showWorkspaceBoundary ? 'VISIBLE' : 'HIDDEN'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: EXPORT */}
            {activeTab === 'export' && (
              <div className="space-y-6">
                {/* 1:1 Instant Poster Pre-Rendering Section */}
                <div className="bg-slate-950/80 rounded-xl p-4 border border-blue-500/30 space-y-3.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera size={16} className="text-blue-400" />
                      <span className="text-xs font-mono font-bold text-white">Instant Model Posters (1:1 Match)</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold">
                      0% GPU Load
                    </span>
                  </div>

                  <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                    Bakes transparent PNG posters matching the live website camera (<code className="text-slate-300">FOV 34°</code>, <code className="text-slate-300">[4.6, 3.2, 5.0]</code>) and lighting for instant scrolling with zero GPU lag.
                  </p>

                  {exportProgress && (
                    <div className="p-2.5 bg-blue-950/70 border border-blue-500/50 rounded-lg text-xs font-mono text-blue-200 flex items-center gap-2 animate-fade-in">
                      <Sparkles size={14} className="text-blue-400 shrink-0 animate-spin" />
                      <span>{exportProgress}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    <button
                      onClick={() => captureCurrentPoster()}
                      disabled={isExportingPosters}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-700 disabled:opacity-50"
                    >
                      <Camera size={13} className="text-blue-400" />
                      <span>📸 Snapshot Active Model ({activeModelId})</span>
                    </button>

                    <button
                      onClick={handleExportAllPosters}
                      disabled={isExportingPosters}
                      className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                    >
                      <Sparkles size={13} />
                      <span>⚡ Batch Export All 11 Models</span>
                    </button>
                  </div>

                  <p className="text-[10px] font-mono text-slate-500">
                    Place exported files directly into <code className="text-slate-400">public/posters/</code> to activate instant static previews across the entire website.
                  </p>
                </div>

                {/* TypeScript Code Export Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-300">Generated TypeScript Snippet</span>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition-all cursor-pointer shadow-lg shadow-blue-500/20"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-80">
                      <code>{generatedCode}</code>
                    </pre>
                  </div>

                  <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
                    Paste this snippet directly into your model component (e.g. <code className="text-slate-300">CableRobotModel.tsx</code> or <code className="text-slate-300">PingPongRobotModel.tsx</code>) to permanently bake in these calibrations!
                  </p>
                </div>
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
};
