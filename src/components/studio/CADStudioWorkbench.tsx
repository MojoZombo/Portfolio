import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, PerspectiveCamera, OrthographicCamera, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { projectsData } from '../../data/projectsData';
import { ModelRenderer } from '../../canvas/ModelRenderer';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration, SplitPartRecord, AxisAlignment, PartColorInfo, TransformSettings, PartAnimationConfig, AnimationType } from '../../context/TransformCalibrationContext';
import { CADCuttingPlaneGizmo } from '../../canvas/CADCuttingPlaneGizmo';
import { separateDisconnectedIslands, sliceGeometryByPlane, computeGeometryCenterOfMass, getAssemblyRoot } from '../../utils/meshSplitter';
import {
  Palette,
  Play,
  Pause,
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
  Zap,
  Eye,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Plus,
  Trash2,
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
  isPlaying = false,
  soloPartIndex = null,
  availableParts = [],
}: {
  onSceneReady: (scene: THREE.Scene) => void;
  onEngineReady?: (handles: { scene: THREE.Scene; camera: THREE.Camera; gl: THREE.WebGLRenderer }) => void;
  selectedPartIndex: number | null;
  colorOverrides: Record<number, string>;
  animationOverrides: Record<number, any>;
  isPlaying?: boolean;
  soloPartIndex?: number | null;
  availableParts?: PartColorInfo[];
}) {
  const { scene, camera, gl } = useThree();
  const localTimeRef = useRef(0);

  useEffect(() => {
    onSceneReady(scene);
    if (onEngineReady) {
      onEngineReady({ scene, camera, gl });
    }
  }, [scene, camera, gl, onSceneReady, onEngineReady]);

  // Live update highlight glow, colors, and live kinematics for all CAD parts and dynamically split sub-meshes
  useFrame((_state, delta) => {
    if (isPlaying) {
      localTimeRef.current += Math.min(delta, 0.035);
    }
    // When paused (not isPlaying), force time to 0 so all parts are cleanly at rest pose
    const time = isPlaying ? localTimeRef.current : 0;

    const isHelperOrGizmo = (obj: THREE.Object3D): boolean => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (!m.name || m.name === 'undefined' || (m.geometry?.attributes?.position?.count && m.geometry.attributes.position.count <= 4)) {
          return true;
        }
      }
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (
          cur.name.includes('Gizmo') ||
          cur.name.includes('TransformGizmo') ||
          cur.name.includes('Helper') ||
          cur.name.includes('Grid') ||
          cur.name.includes('Line') ||
          cur.name.includes('Pivot') ||
          cur.userData?.isHelper ||
          cur.userData?.isVisualizer
        ) {
          return true;
        }
        cur = cur.parent;
      }
      return false;
    };

    // Collect all CAD meshes into an indexed map for instant O(1) recursive lookups
    const meshMap = new Map<number, THREE.Mesh>();
    let partFallbackIdx = 0;
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && !(child instanceof THREE.LineSegments)) {
        const mesh = child as THREE.Mesh;
        if (!isHelperOrGizmo(mesh)) {
          const currentIdx =
            mesh.userData.cadPartIndex !== undefined
              ? mesh.userData.cadPartIndex
              : mesh.userData.partIndex !== undefined
              ? mesh.userData.partIndex
              : partFallbackIdx;

          mesh.userData.partIndex = currentIdx;
          mesh.userData.cadPartIndex = currentIdx;
          mesh.userData.isCadMesh = true;

          // 1. Initial transform capture for robust kinematics
          if (!mesh.userData.initialPos || !(mesh.userData.initialPos instanceof THREE.Vector3)) {
            mesh.userData.initialPos = mesh.position.clone();
            mesh.userData.initialRot = mesh.rotation.clone();
            mesh.userData.initialQuat = mesh.quaternion.clone();
            mesh.userData.initialScale = mesh.scale.clone();
          }

          // 2. Center of mass calculation in parent space (with scale correction)
          if (!mesh.userData.geomCom || !(mesh.userData.geomCom instanceof THREE.Vector3)) {
            mesh.userData.geomCom = computeGeometryCenterOfMass(mesh.geometry);
          }
          if (!mesh.userData.centerOfMass || !(mesh.userData.centerOfMass instanceof THREE.Vector3)) {
            const gCom = mesh.userData.geomCom as THREE.Vector3;
            const scaled = gCom.clone().multiply(mesh.userData.initialScale || mesh.scale);
            mesh.userData.centerOfMass = (mesh.userData.initialPos as THREE.Vector3)
              .clone()
              .add(scaled.applyQuaternion(mesh.userData.initialQuat as THREE.Quaternion));
          }

          // 3. Highlight glow & Color override sync
          const isSelected = selectedPartIndex === currentIdx;
          const overrideColor = colorOverrides[currentIdx];

          const mat = mesh.material;
          if (mat) {
            const syncMaterial = (m: THREE.Material) => {
              if ((m as THREE.MeshToonMaterial).isMeshToonMaterial) {
                const tm = m as THREE.MeshToonMaterial;
                if (!tm.userData.originalColor) {
                  const partInfo = availableParts.find((p) => p.index === currentIdx);
                  tm.userData.originalColor = partInfo?.color || ('#' + tm.color.getHexString());
                }

                if (isSelected) {
                  tm.color.set('#38bdf8');
                  tm.emissive.set('#0284c7');
                } else {
                  const restoredColor = overrideColor || tm.userData.originalColor || '#d6d1c8';
                  tm.color.set(restoredColor);
                  tm.emissive.set('#000000');
                }
              }
            };

            if (Array.isArray(mat)) {
              mat.forEach(syncMaterial);
            } else {
              syncMaterial(mat);
            }
          }

          meshMap.set(currentIdx, mesh);
          partFallbackIdx++;
        }
      }
    });

    // 4. Hierarchical Forward Kinematics Engine (with memoization and full multi-level parent chaining)
    const frameComputed = new Map<
      number,
      { pos: THREE.Vector3; quat: THREE.Quaternion; deltaPos: THREE.Vector3; deltaQuat: THREE.Quaternion }
    >();

    const solveKinematics = (
      pIdx: number,
      visited = new Set<number>()
    ): { pos: THREE.Vector3; quat: THREE.Quaternion; deltaPos: THREE.Vector3; deltaQuat: THREE.Quaternion } | null => {
      if (frameComputed.has(pIdx)) {
        return frameComputed.get(pIdx)!;
      }
      if (visited.has(pIdx)) {
        return null; // loop protection
      }
      visited.add(pIdx);

      const pMesh = meshMap.get(pIdx);
      if (!pMesh || !pMesh.userData.initialPos) return null;

      const pAnim = animationOverrides[pIdx];
      const pParentIdx = pAnim?.parentPartIndex;

      let pBasePos = (pMesh.userData.initialPos as THREE.Vector3).clone();
      let pBaseQuat = (pMesh.userData.initialQuat as THREE.Quaternion).clone();
      let pParentDeltaQuat = new THREE.Quaternion();

      if (pParentIdx !== undefined && pParentIdx !== null && pParentIdx !== pIdx) {
        const parentResult = solveKinematics(pParentIdx, visited);
        if (parentResult) {
          pParentDeltaQuat = parentResult.deltaQuat.clone();
          const parentMesh = meshMap.get(pParentIdx);
          const parentInitialPos = parentMesh?.userData.initialPos
            ? (parentMesh.userData.initialPos as THREE.Vector3).clone()
            : new THREE.Vector3();

          const relOffset = (pMesh.userData.initialPos as THREE.Vector3).clone().sub(parentInitialPos);
          pBasePos = parentResult.pos.clone().add(relOffset.applyQuaternion(pParentDeltaQuat));
          pBaseQuat = pParentDeltaQuat.clone().multiply(pMesh.userData.initialQuat as THREE.Quaternion);
        }
      }

      let cPos = pBasePos.clone();
      let cQuat = pBaseQuat.clone();
      let pAccDeltaQuat = pParentDeltaQuat.clone();

      const restingCom = pBasePos.clone().add(
        (pMesh.userData.centerOfMass as THREE.Vector3)
          .clone()
          .sub(pMesh.userData.initialPos as THREE.Vector3)
          .applyQuaternion(pParentDeltaQuat)
      );
      pMesh.userData.restingCom = restingCom;
      pMesh.userData.restingPos = pBasePos.clone();
      pMesh.userData.parentDeltaQuat = pParentDeltaQuat.clone();

      // Check if this part should be animated under Solo mode
      let shouldAnimate = true;
      if (soloPartIndex !== null && soloPartIndex !== undefined) {
        if (pIdx !== soloPartIndex) {
          // Check if pIdx is an ancestor that soloPartIndex depends on
          let isAncestor = false;
          let curParent = animationOverrides[soloPartIndex]?.parentPartIndex;
          while (curParent !== undefined && curParent !== null) {
            if (curParent === pIdx) {
              isAncestor = true;
              break;
            }
            curParent = animationOverrides[curParent]?.parentPartIndex;
          }
          if (!isAncestor) {
            shouldAnimate = false;
          }
        }
      }

      if (shouldAnimate && pAnim && pAnim.type !== 'none') {
        const applyPAnim = (animConfig: any) => {
          if (!animConfig || animConfig.type === 'none') return;
          if (animConfig.type === 'multi' && Array.isArray(animConfig.subAnimations)) {
            animConfig.subAnimations.forEach(applyPAnim);
            return;
          }
          const phaseRad = ((animConfig.phase || 0) * Math.PI) / 180;
          const rawAxis = new THREE.Vector3(
            animConfig.axis === 'x' ? 1 : 0,
            animConfig.axis === 'y' ? 1 : 0,
            animConfig.axis === 'z' ? 1 : 0
          );
          const alignment = animConfig.axisAlignment || 'model';
          const parentWorldQuat = new THREE.Quaternion();
          if (pMesh.parent) {
            pMesh.parent.getWorldQuaternion(parentWorldQuat);
          }

          // Custom axis orientation offset in degrees (Pitch X, Yaw Y, Roll Z)
          const rotXRad = ((animConfig.axisRotX || 0) * Math.PI) / 180;
          const rotYRad = ((animConfig.axisRotY || 0) * Math.PI) / 180;
          const rotZRad = ((animConfig.axisRotZ || 0) * Math.PI) / 180;
          const customAxisQuat = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(rotXRad, rotYRad, rotZRad, 'XYZ')
          );
          const orientedAxis = rawAxis.clone().applyQuaternion(customAxisQuat);

          let axisVec: THREE.Vector3;
          let pivotOffset: THREE.Vector3;

          const rawPivotOffset = new THREE.Vector3(
            (animConfig.pivotX || 0) / 100,
            (animConfig.pivotY || 0) / 100,
            (animConfig.pivotZ || 0) / 100
          );

          if (alignment === 'global') {
            // Global world axis: rotate oriented axis into mesh parent local space
            axisVec = orientedAxis.clone().applyQuaternion(parentWorldQuat.clone().invert());
            pivotOffset = rawPivotOffset.clone().applyQuaternion(parentWorldQuat.clone().invert());
          } else if (alignment === 'part') {
            // Part's transform axis: align with the part's initial local orientation
            axisVec = orientedAxis.clone().applyQuaternion(pBaseQuat);
            pivotOffset = rawPivotOffset.clone().applyQuaternion(pBaseQuat);
          } else {
            // 'model': Calibrated model frame (matches mesh.parent coordinate frame)
            axisVec = orientedAxis.clone().applyQuaternion(pParentDeltaQuat);
            pivotOffset = rawPivotOffset.clone().applyQuaternion(pParentDeltaQuat);
          }

          const dir = animConfig.direction ?? 1;
          const omega = ((animConfig.speed || 0) * Math.PI * 2) / 60;

          if (animConfig.type === 'continuous-spin' || animConfig.type === 'oscillate-rotation') {
            const pivotMode = animConfig.pivotMode || 'center-of-mass';
            let pivot = pBasePos.clone().add(
              (pMesh.userData.centerOfMass as THREE.Vector3)
                .clone()
                .sub(pMesh.userData.initialPos as THREE.Vector3)
                .applyQuaternion(pAccDeltaQuat)
            );
            const translationDelta = cPos.clone().sub(pBasePos);
            pivot.add(translationDelta);

            if (pivotMode === 'origin') {
              pivot.copy(pBasePos).add(translationDelta);
            } else if (pivotMode === 'custom') {
              pivot.add(pivotOffset);
            }

            pMesh.userData.hingePivot = pivot.clone();
            pMesh.userData.hingeAxis = axisVec.clone();

            const angle = !isPlaying
              ? 0
              : animConfig.type === 'continuous-spin'
              ? time * omega * dir
              : Math.sin(time * omega + phaseRad) *
                (((animConfig.amplitude || 30) * Math.PI) / 180) *
                dir;
            const qDelta = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
            cQuat = qDelta.clone().multiply(cQuat);
            cPos.sub(pivot).applyQuaternion(qDelta).add(pivot);
            pAccDeltaQuat = qDelta.clone().multiply(pAccDeltaQuat);
          } else if (animConfig.type === 'linear-reciprocate') {
            const distPosM = (animConfig.amplitudePositive !== undefined ? animConfig.amplitudePositive : (animConfig.amplitude || 10)) / 100;
            const distNegM = (animConfig.amplitudeNegative !== undefined ? animConfig.amplitudeNegative : (animConfig.amplitude || 10)) / 100;
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
            cPos.add(displacement);
          }
        };
        applyPAnim(pAnim);
      }

      const result = {
        pos: cPos,
        quat: cQuat,
        deltaPos: cPos.clone().sub(pMesh.userData.initialPos as THREE.Vector3),
        deltaQuat: cQuat.clone().multiply((pMesh.userData.initialQuat as THREE.Quaternion).clone().invert()),
      };

      frameComputed.set(pIdx, result);
      return result;
    };

    meshMap.forEach((mesh, pIdx) => {
      const result = solveKinematics(pIdx);
      // Skip position/quaternion writes for meshes managed by their own
      // model component's useFrame kinematics (e.g. WinchCatchModel, CatamaranModel).
      // StudioSceneBridge still handles highlight glow & color sync above.
      if (result && !mesh.userData.hasOwnKinematics) {
        mesh.position.copy(result.pos);
        mesh.quaternion.copy(result.quat);
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
    updatePartVisibility,
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
    movePart,
    reorderParts,
    resetPartOrder,
  } = useTransformCalibration();

  const [activeTab, setActiveTab] = useState<'transform' | 'colors' | 'splitter' | 'kinematics' | 'cdpr' | 'export'>('transform');
  const [partSearch, setPartSearch] = useState('');
  const [renderMode, setRenderMode] = useState<'shaded' | 'blueprint'>('shaded');
  const [isOrthographic, setIsOrthographic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  const [draggedPartIndex, setDraggedPartIndex] = useState<number | null>(null);
  const [dragOverPartIndex, setDragOverPartIndex] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  const [tempPartName, setTempPartName] = useState('');
  const [splitFeedback, setSplitFeedback] = useState<string | null>(null);
  const [splitToleranceRatio, setSplitToleranceRatio] = useState<number>(0.001);
  const studioEngineRef = useRef<{ scene: THREE.Scene; camera: THREE.Camera; gl: THREE.WebGLRenderer } | null>(null);
  const [isExportingPosters, setIsExportingPosters] = useState(false);
  const [exportProgress, setExportProgress] = useState<string | null>(null);

  // Animation Playback & Pivot Drag State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSolo, setIsSolo] = useState(false);
  const [isDraggingGizmo, setIsDraggingGizmo] = useState(false);
  const [gizmoControlMode, setGizmoControlMode] = useState<'translate' | 'rotate'>('translate');
  const [activeLayerIndex, setActiveLayerIndex] = useState<number>(0);
  const [collapsedLayers, setCollapsedLayers] = useState<Record<number, boolean>>({});
  const orbitControlsRef = useRef<any>(null);

  useEffect(() => {
    setActiveLayerIndex(0);
  }, [selectedPartIndex]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__STUDIO_DEBUG__ = {
        updatePartAnimation,
        setSelectedPartIndex,
        settings,
        setIsPlaying,
        isPlaying,
      };
    }
  }, [updatePartAnimation, setSelectedPartIndex, settings, isPlaying]);

  // Auto-pause to rest pose whenever switching parts so the new part can be aligned in rest pose
  useEffect(() => {
    setIsPlaying(false);
  }, [selectedPartIndex]);

  // Spacebar shortcut to toggle play/pause preview
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleExportGLB = () => {
    if (!sceneRef.current) return;
    
    setExportProgress('Baking meshes and exporting to GLB...');
    setIsExportingPosters(true);

    const exportGroup = new THREE.Group();
    exportGroup.name = activeModelId + '_split';
    
    sceneRef.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && (child.userData?.isCadMesh || child.userData?.partIndex !== undefined)) {
        const mesh = child as THREE.Mesh;
        // Skip helpers, gizmos, grids, and stray helper planes
        if (
          !mesh.name ||
          mesh.name === 'undefined' ||
          mesh.name.includes('Helper') ||
          mesh.name.includes('Gizmo') ||
          mesh.name.includes('Grid') ||
          mesh.name.includes('mesh_47') ||
          (mesh.geometry?.attributes?.position?.count && mesh.geometry.attributes.position.count <= 4)
        ) return;

        const clone = mesh.clone();
        
        // Clean up runtime internal animation / kinematics state from userData before exporting GLB
        // so re-imported models don't have non-serializable or stale transform cache in node.extras
        if (clone.userData) {
          clone.userData = {
            name: mesh.name,
            cadPartIndex: mesh.userData.cadPartIndex,
            partIndex: mesh.userData.partIndex,
            isCadMesh: true,
          };
        }
        const worldPos = new THREE.Vector3();
        const worldQuat = new THREE.Quaternion();
        const worldScale = new THREE.Vector3();
        mesh.getWorldPosition(worldPos);
        mesh.getWorldQuaternion(worldQuat);
        mesh.getWorldScale(worldScale);
        
        clone.position.copy(worldPos);
        clone.quaternion.copy(worldQuat);
        clone.scale.copy(worldScale);
        
        // Ensure proper materials (convert toon/basic to standard for export compatibility)
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            clone.material = mesh.material.map(m => {
              const baseMat = m as THREE.MeshStandardMaterial | THREE.MeshToonMaterial | THREE.MeshBasicMaterial;
              return new THREE.MeshStandardMaterial({ color: baseMat.color || new THREE.Color('#cbd5e1') });
            });
          } else {
            const baseMat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshToonMaterial | THREE.MeshBasicMaterial;
            clone.material = new THREE.MeshStandardMaterial({ color: baseMat.color || new THREE.Color('#cbd5e1') });
          }
        }
        
        // Remove children lines (blueprints, cel shading borders)
        clone.children = clone.children.filter(c => !(c instanceof THREE.LineSegments));
        
        exportGroup.add(clone);
      }
    });

    try {
      const exporter = new GLTFExporter();
      exporter.parse(
        exportGroup,
        (gltf) => {
          const blob = new Blob([gltf as ArrayBuffer], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${activeModelId}-split.glb`;
          link.click();
          URL.revokeObjectURL(url);
          setExportProgress(`✅ Downloaded ${activeModelId}-split.glb`);
          setTimeout(() => setExportProgress(null), 4000);
          setIsExportingPosters(false);
        },
        (error) => {
          console.error('Export GLB error:', error);
          setExportProgress('❌ Export GLB failed');
          setIsExportingPosters(false);
          setTimeout(() => setExportProgress(null), 4000);
        },
        { binary: true }
      );
    } catch (e) {
      console.error(e);
      setExportProgress('❌ Export GLB failed');
      setIsExportingPosters(false);
      setTimeout(() => setExportProgress(null), 4000);
    }
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

  // Multi-layer simultaneous animation helpers
  const handleAddOrConvertToMulti = () => {
    if (selectedPartIndex === null) return;
    if (!activeAnim || activeAnim.type === 'none') {
      const defaultLayer1: PartAnimationConfig = {
        type: 'linear-reciprocate',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 2.0,
        amplitude: 10,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      };
      const defaultLayer2: PartAnimationConfig = {
        type: 'continuous-spin',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
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
      };
      updatePartAnimation(selectedPartIndex, {
        type: 'multi',
        subAnimations: [defaultLayer1, defaultLayer2],
      });
      setActiveLayerIndex(1);
      return;
    }

    if (activeAnim.type !== 'multi') {
      const currentLayer1: PartAnimationConfig = {
        type: activeAnim.type,
        axis: activeAnim.axis || 'z',
        axisAlignment: activeAnim.axisAlignment || 'model',
        axisRotX: activeAnim.axisRotX || 0,
        axisRotY: activeAnim.axisRotY || 0,
        axisRotZ: activeAnim.axisRotZ || 0,
        direction: activeAnim.direction ?? 1,
        speed: activeAnim.speed || (activeAnim.type === 'linear-reciprocate' ? 2.0 : 60),
        amplitude: activeAnim.amplitude || (activeAnim.type === 'linear-reciprocate' ? 10 : 35),
        amplitudePositive: activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10),
        amplitudeNegative: activeAnim.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim.amplitude || 10),
        phase: activeAnim.phase || 0,
        pivotMode: activeAnim.pivotMode || 'center-of-mass',
        pivotX: activeAnim.pivotX || 0,
        pivotY: activeAnim.pivotY || 0,
        pivotZ: activeAnim.pivotZ || 0,
      };

      const complementaryType: AnimationType = activeAnim.type === 'linear-reciprocate' ? 'continuous-spin' : 'linear-reciprocate';
      const newLayer2: PartAnimationConfig = {
        type: complementaryType,
        axis: activeAnim.axis || 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: complementaryType === 'linear-reciprocate' ? 2.0 : 60,
        amplitude: complementaryType === 'linear-reciprocate' ? 10 : 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      };

      updatePartAnimation(selectedPartIndex, {
        type: 'multi',
        subAnimations: [currentLayer1, newLayer2],
      });
      setActiveLayerIndex(1);
    } else {
      const currentSubs = activeAnim.subAnimations || [];
      const lastSub = currentSubs[currentSubs.length - 1];
      const complementaryType: AnimationType = lastSub?.type === 'linear-reciprocate' ? 'continuous-spin' : 'linear-reciprocate';
      const newLayer: PartAnimationConfig = {
        type: complementaryType,
        axis: lastSub?.axis || 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: complementaryType === 'linear-reciprocate' ? 2.0 : 60,
        amplitude: complementaryType === 'linear-reciprocate' ? 10 : 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      };
      updatePartAnimation(selectedPartIndex, {
        subAnimations: [...currentSubs, newLayer],
      });
      setActiveLayerIndex(currentSubs.length);
    }
  };

  const handleUpdateSubAnimation = (subIdx: number, updates: Partial<PartAnimationConfig>) => {
    if (selectedPartIndex === null || !activeAnim?.subAnimations) return;
    const currentSubs = [...activeAnim.subAnimations];
    currentSubs[subIdx] = { ...currentSubs[subIdx], ...updates };
    updatePartAnimation(selectedPartIndex, { subAnimations: currentSubs });
  };

  const handleRemoveSubAnimation = (subIdx: number) => {
    if (selectedPartIndex === null || !activeAnim?.subAnimations) return;
    const currentSubs = [...activeAnim.subAnimations];
    currentSubs.splice(subIdx, 1);
    if (currentSubs.length === 0) {
      resetPartAnimation(selectedPartIndex);
    } else {
      updatePartAnimation(selectedPartIndex, { subAnimations: currentSubs });
      if (activeLayerIndex >= currentSubs.length) {
        setActiveLayerIndex(Math.max(0, currentSubs.length - 1));
      }
    }
  };

  const handleDuplicateSubAnimation = (subIdx: number) => {
    if (selectedPartIndex === null || !activeAnim?.subAnimations) return;
    const target = activeAnim.subAnimations[subIdx];
    if (!target) return;
    const clone = { ...target };
    const currentSubs = [...activeAnim.subAnimations];
    currentSubs.splice(subIdx + 1, 0, clone);
    updatePartAnimation(selectedPartIndex, { subAnimations: currentSubs });
    setActiveLayerIndex(subIdx + 1);
  };

  const handleMoveSubAnimation = (subIdx: number, direction: 'up' | 'down') => {
    if (selectedPartIndex === null || !activeAnim?.subAnimations) return;
    const currentSubs = [...activeAnim.subAnimations];
    const targetIdx = direction === 'up' ? subIdx - 1 : subIdx + 1;
    if (targetIdx < 0 || targetIdx >= currentSubs.length) return;
    const temp = currentSubs[subIdx];
    currentSubs[subIdx] = currentSubs[targetIdx];
    currentSubs[targetIdx] = temp;
    updatePartAnimation(selectedPartIndex, { subAnimations: currentSubs });
    setActiveLayerIndex(targetIdx);
  };

  // Code generator with custom names and comments
  const generatedCode = useMemo(() => {
    const rotRadX = (settings.rotX * Math.PI) / 180;
    const rotRadY = (settings.rotY * Math.PI) / 180;
    const rotRadZ = (settings.rotZ * Math.PI) / 180;

    let output = `// Optimal CAD Alignment Settings for [${activeModelId}]:
`;
    output += `const offset: [number, number, number] = [${settings.offsetX.toFixed(2)}, ${settings.offsetY.toFixed(2)}, ${settings.offsetZ.toFixed(2)}];
`;
    output += `const rotation: [number, number, number] = [${rotRadX.toFixed(3)}, ${rotRadY.toFixed(3)}, ${rotRadZ.toFixed(3)}]; // [${settings.rotX}°, ${settings.rotY}°, ${settings.rotZ}°]
`;
    output += `const scale = ${settings.scale.toFixed(2)};
`;

    if (Object.keys(settings.colorOverrides).length > 0) {
      output += `
// Custom Part Color Overrides:
`;
      output += `const partColorOverrides: Record<number, string> = {
`;
      for (const [idxStr, color] of Object.entries(settings.colorOverrides)) {
        const idx = parseInt(idxStr);
        const name = availableParts.find((p) => p.index === idx)?.name || `Part #${idx}`;
        output += `  ${idx}: '${color}', // ${name}
`;
      }
      output += `};
`;
    }

    if (Object.keys(settings.visibilityOverrides).length > 0) {
      output += `
// Hidden Parts:
`;
      output += `const partVisibilityOverrides: Record<number, boolean> = {
`;
      for (const [idxStr, isVisible] of Object.entries(settings.visibilityOverrides)) {
        if (isVisible === false) {
          const idx = parseInt(idxStr);
          const name = availableParts.find((p) => p.index === idx)?.name || `Part #${idx}`;
          output += `  ${idx}: false, // ${name}
`;
        }
      }
      output += `};
`;
    }

    const activeAnimationEntries = Object.entries(settings.animationOverrides).filter(
      ([_, anim]) => anim && (anim.type !== 'none' || (anim.parentPartIndex !== undefined && anim.parentPartIndex !== null))
    );
    if (activeAnimationEntries.length > 0) {
      const cleanedOverrides: Record<string, any> = {};
      for (const [idx, anim] of activeAnimationEntries) {
        cleanedOverrides[idx] = anim;
      }
      output += `
// Custom Part Animations:
`;
      output += `const partAnimationOverrides = ${JSON.stringify(cleanedOverrides, null, 2)};
`;
    }

    if (activeModelId === 'cable-robot-2') {
      output += `
// CDPR 4-Cable Robot Kinematics Config:
`;
      output += `const cdprConfig = ${JSON.stringify(settings.cdprConfig, null, 2)};
`;
    }

    if (settings.partOrder && settings.partOrder.length > 0) {
      output += `
// Custom Assembly Tree Part Order:
`;
      output += `const customPartOrder = ${JSON.stringify(settings.partOrder)};
`;
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
            <div className="flex items-center gap-2">
              {settings.partOrder && settings.partOrder.length > 0 && (
                <button
                  onClick={resetPartOrder}
                  className="text-[10px] font-mono text-slate-400 hover:text-amber-400 underline cursor-pointer"
                  title="Reset part hierarchy to default order"
                >
                  Reset Order
                </button>
              )}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {availableParts.length} parts
              </span>
            </div>
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

          {/* Parts List with Drag-and-Drop & Inline Rename */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredParts.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-500">
                No parts detected
              </div>
            ) : (
              filteredParts.map((part, partIdxInFiltered) => {
                const isSelected = selectedPartIndex === part.index;
                const isEditing = editingPartIndex === part.index;
                const activeColor = settings.colorOverrides[part.index] || part.color;
                const hasAnim = settings.animationOverrides[part.index] && settings.animationOverrides[part.index].type !== 'none';
                const isBeingDragged = draggedPartIndex === part.index;
                const isDragTarget = dragOverPartIndex === part.index;

                return (
                  <div
                    key={part.index}
                    draggable={!isEditing}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(part.index));
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedPartIndex(part.index);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverPartIndex !== part.index) {
                        setDragOverPartIndex(part.index);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverPartIndex === part.index) {
                        setDragOverPartIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverPartIndex(null);
                      setDraggedPartIndex(null);
                      const draggedIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                      if (!isNaN(draggedIdx) && draggedIdx !== part.index) {
                        const currentOrder = availableParts.map((p) => p.index);
                        const fromIdx = currentOrder.indexOf(draggedIdx);
                        const toIdx = currentOrder.indexOf(part.index);
                        if (fromIdx !== -1 && toIdx !== -1) {
                          const newOrder = [...currentOrder];
                          newOrder.splice(fromIdx, 1);
                          newOrder.splice(toIdx, 0, draggedIdx);
                          reorderParts(newOrder);
                        }
                      }
                    }}
                    onDragEnd={() => {
                      setDraggedPartIndex(null);
                      setDragOverPartIndex(null);
                    }}
                    className={`group relative rounded-lg text-xs font-mono flex items-center justify-between transition-all ${
                      isBeingDragged ? 'opacity-40' : ''
                    } ${
                      isDragTarget ? 'border-t-2 border-t-blue-400 bg-blue-950/40' : ''
                    } ${
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
                        <div className="flex items-center flex-1 min-w-0">
                          <div
                            className={`pl-1.5 pr-0.5 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity ${
                              isSelected ? 'text-white/70' : 'text-slate-500 hover:text-slate-200'
                            }`}
                            title="Drag to reorder part in tree"
                          >
                            <GripVertical size={12} />
                          </div>

                          <button
                            onClick={() => {
                              setSelectedPartIndex(isSelected ? null : part.index);
                              if (!isSelected && activeTab === 'transform') {
                                setActiveTab('colors');
                              }
                            }}
                            className="flex-1 text-left px-1.5 py-2 flex items-center gap-2 truncate cursor-pointer"
                          >
                            <span
                              className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-inner"
                              style={{ backgroundColor: activeColor }}
                            />
                            <span className="truncate">{part.name}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1 pr-2 shrink-0">
                          {/* Up / Down Move Buttons */}
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                movePart(part.index, 'up');
                              }}
                              disabled={partIdxInFiltered === 0}
                              className={`p-1 rounded hover:bg-black/20 transition-colors ${
                                isSelected ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-white'
                              } disabled:opacity-20 disabled:cursor-not-allowed`}
                              title="Move Up in Tree"
                            >
                              <ChevronUp size={12} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                movePart(part.index, 'down');
                              }}
                              disabled={partIdxInFiltered === filteredParts.length - 1}
                              className={`p-1 rounded hover:bg-black/20 transition-colors ${
                                isSelected ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-white'
                              } disabled:opacity-20 disabled:cursor-not-allowed`}
                              title="Move Down in Tree"
                            >
                              <ChevronDown size={12} />
                            </button>
                          </div>

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
            <InteractiveStudioPivotGizmo
              selectedPartIndex={selectedPartIndex}
              activeAnim={
                activeAnim?.type === 'multi' && activeAnim.subAnimations?.length
                  ? activeAnim.subAnimations[activeLayerIndex] || activeAnim.subAnimations[0]
                  : activeAnim
              }
              gizmoMode={gizmoControlMode}
              modelSettings={settings}
              onUpdatePivot={(update) => {
                if (activeAnim?.type === 'multi' && activeAnim.subAnimations) {
                  const targetIdx = activeLayerIndex < activeAnim.subAnimations.length ? activeLayerIndex : 0;
                  handleUpdateSubAnimation(targetIdx, update);
                } else {
                  updatePartAnimation(selectedPartIndex!, update);
                }
              }}
              onDragStart={() => {
                setIsPlaying(false);
                setIsDraggingGizmo(true);
              }}
              onDragEnd={() => {
                setIsDraggingGizmo(false);
              }}
            />

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
                isRotating={settings.autoRotate && !isDraggingGizmo}
                isAnimating={isPlaying}
              />
            </Suspense>

            {/* Scene Bridge for Dynamic Live Splitting & Material Synchronization */}
            <StudioSceneBridge
              onSceneReady={(sc) => {
                sceneRef.current = sc;
                if (typeof window !== 'undefined') (window as any).__STUDIO_SCENE__ = sc;
              }}
              onEngineReady={(handles) => {
                studioEngineRef.current = handles;
              }}
              selectedPartIndex={selectedPartIndex}
              colorOverrides={settings.colorOverrides}
              animationOverrides={settings.animationOverrides}
              isPlaying={isPlaying}
              soloPartIndex={isSolo ? selectedPartIndex : null}
              availableParts={availableParts}
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
              ref={orbitControlsRef}
              enabled={!isDraggingGizmo}
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

          {/* Overlay Floating Control Pills */}
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
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

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-xs font-semibold shadow-xl backdrop-blur-md border transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Toggle Animation Play/Pause (Spacebar)"
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} className="fill-current" />}
              <span>{isPlaying ? 'Animation Playing' : 'Animation Paused (Rest Pose)'}</span>
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

                    {/* Visibility Toggle */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <Eye size={14} className={settings.visibilityOverrides[selectedPartIndex] !== false ? 'text-emerald-400' : 'text-red-400'} />
                        <span className="text-slate-300 font-medium">Render Part in Scene</span>
                      </div>
                      <button
                        onClick={() => updatePartVisibility(selectedPartIndex, settings.visibilityOverrides[selectedPartIndex] === false)}
                        className={`px-3 py-1 rounded-lg border text-xs font-mono transition-colors ${
                          settings.visibilityOverrides[selectedPartIndex] !== false
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-red-500/20 text-red-300 border-red-500/40'
                        }`}
                      >
                        {settings.visibilityOverrides[selectedPartIndex] !== false ? 'VISIBLE' : 'HIDDEN'}
                      </button>
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

                    {/* Rigid Group Parent */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono font-semibold text-slate-300">Rigid Group Parent</span>
                      <select
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono"
                        value={activeAnim?.parentPartIndex ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                          updatePartAnimation(selectedPartIndex, { parentPartIndex: val });
                        }}
                      >
                        <option value="">None (Root)</option>
                        {availableParts
                          .filter((p) => p.index !== selectedPartIndex)
                          .map((p) => (
                            <option key={p.index} value={p.index}>#{p.index} - {p.name}</option>
                          ))}
                      </select>
                    </div>

                    {/* Motion Type */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono font-semibold text-slate-300">Animation Type</span>
                      <select
                        value={activeAnim?.type || 'none'}
                        onChange={(e) => {
                          const newType = e.target.value as AnimationType;
                          if (newType === 'multi') {
                            handleAddOrConvertToMulti();
                          } else if (newType === 'none') {
                            resetPartAnimation(selectedPartIndex);
                          } else {
                            updatePartAnimation(selectedPartIndex, {
                              type: newType,
                              axis: activeAnim?.axis || 'x',
                              speed: activeAnim?.speed || (newType === 'linear-reciprocate' ? 2.0 : 60),
                              direction: activeAnim?.direction || 1,
                              amplitude: activeAnim?.amplitude || (newType === 'linear-reciprocate' ? 10 : 35),
                              amplitudePositive: activeAnim?.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim?.amplitude || 10),
                              amplitudeNegative: activeAnim?.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim?.amplitude || 10),
                              phase: activeAnim?.phase || 0,
                              pivotMode: activeAnim?.pivotMode || 'center-of-mass',
                              pivotX: activeAnim?.pivotX || 0,
                              pivotY: activeAnim?.pivotY || 0,
                              pivotZ: activeAnim?.pivotZ || 0,
                            });
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-950 text-xs font-mono text-white rounded-lg border border-slate-800 outline-none cursor-pointer"
                      >
                        <option value="none">No Motion (Static)</option>
                        <option value="continuous-spin">Continuous Spin (Rotary RPM)</option>
                        <option value="oscillate-rotation">Oscillating Rotation (Sweep)</option>
                        <option value="linear-reciprocate">Linear Reciprocating (Stroke)</option>
                        <option value="multi">Multiple Layers (Multi-Axis Compound)</option>
                      </select>
                    </div>

                    {/* Master Playback & Solo Controls */}
                    {activeAnim && activeAnim.type !== 'none' && (
                      <div className="flex items-center gap-2 p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setIsPlaying(!isPlaying)}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer shadow-sm ${
                            isPlaying
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-900/30'
                              : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-900/30'
                          }`}
                        >
                          {isPlaying ? <Pause size={14} /> : <Play size={14} className="fill-current" />}
                          <span>{isPlaying ? 'Pause (Rest Pose)' : 'Play / Test Motion'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsSolo(!isSolo)}
                          title="Solo: only animate the selected part"
                          className={`px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all border cursor-pointer ${
                            isSolo
                              ? 'bg-amber-600 text-white border-amber-500 shadow-amber-900/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                          }`}
                        >
                          Solo
                        </button>
                      </div>
                    )}

                    {/* COMPOUND / MULTI-ANIMATION LAYERS INSPECTOR */}
                    {activeAnim && activeAnim.type === 'multi' && (
                      <div className="space-y-3.5 pt-1">
                        <div className="flex justify-between items-center bg-slate-900/90 p-2.5 rounded-xl border border-blue-500/30">
                          <div className="space-y-0.5">
                            <span className="text-xs font-mono font-bold text-blue-400 flex items-center gap-1.5">
                              <Layers size={14} />
                              <span>Simultaneous Layers ({(activeAnim.subAnimations || []).length})</span>
                            </span>
                            <p className="text-[10px] font-mono text-slate-400">
                              Runs all motions concurrently (e.g. translate + rotate)
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddOrConvertToMulti}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-[11px] font-mono font-bold text-white transition-colors flex items-center gap-1 shadow cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>Add Layer</span>
                          </button>
                        </div>

                        <div className="space-y-3">
                          {activeAnim.subAnimations?.map((subAnim, subIdx) => {
                            const isCollapsed = collapsedLayers[subIdx] === true;
                            const isActiveGizmo = activeLayerIndex === subIdx;
                            const subAxis = subAnim.axis || 'z';
                            const axisBg = subAxis === 'x' ? 'text-red-400' : subAxis === 'y' ? 'text-green-400' : 'text-blue-400';
                            const typeName =
                              subAnim.type === 'linear-reciprocate'
                                ? 'Linear Stroke'
                                : subAnim.type === 'continuous-spin'
                                ? 'Continuous Spin'
                                : 'Oscillating Sweep';

                            return (
                              <div
                                key={subIdx}
                                className={`rounded-xl border transition-all ${
                                  isActiveGizmo
                                    ? 'bg-slate-900 border-blue-500/60 shadow-lg shadow-blue-950/40'
                                    : 'bg-slate-900/70 border-slate-800'
                                }`}
                              >
                                {/* Card Header */}
                                <div className="p-2.5 flex items-center justify-between gap-2 border-b border-slate-800/80">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div className="flex flex-col">
                                      <button
                                        type="button"
                                        disabled={subIdx === 0}
                                        onClick={() => handleMoveSubAnimation(subIdx, 'up')}
                                        className="text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer p-0.5"
                                        title="Move Layer Up"
                                      >
                                        <ChevronUp size={11} />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={subIdx === (activeAnim.subAnimations?.length || 1) - 1}
                                        onClick={() => handleMoveSubAnimation(subIdx, 'down')}
                                        className="text-slate-500 hover:text-white disabled:opacity-20 cursor-pointer p-0.5"
                                        title="Move Layer Down"
                                      >
                                        <ChevronDown size={11} />
                                      </button>
                                    </div>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-slate-300 shrink-0">
                                      #{subIdx + 1}
                                    </span>
                                    <span className="text-xs font-mono font-bold text-white truncate">
                                      {typeName}
                                    </span>
                                    <span className={`text-[10px] font-mono font-bold uppercase ${axisBg} shrink-0`}>
                                      [{subAxis}]
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => setActiveLayerIndex(subIdx)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                                        isActiveGizmo
                                          ? 'bg-blue-600 text-white shadow'
                                          : 'bg-slate-800 text-slate-400 hover:text-white'
                                      }`}
                                      title={isActiveGizmo ? 'Active 3D Viewport Gizmo' : 'Click to target with 3D Gizmo'}
                                    >
                                      <Crosshair size={10} />
                                      <span>{isActiveGizmo ? 'Gizmo Active' : 'Gizmo'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateSubAnimation(subIdx)}
                                      className="p-1 text-slate-400 hover:text-white cursor-pointer transition-colors"
                                      title="Duplicate Layer"
                                    >
                                      <Copy size={12} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSubAnimation(subIdx)}
                                      className="p-1 text-red-400 hover:text-red-300 cursor-pointer transition-colors"
                                      title="Delete Layer"
                                    >
                                      <Trash2 size={12} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setCollapsedLayers((prev) => ({ ...prev, [subIdx]: !prev[subIdx] }))}
                                      className="p-1 text-slate-400 hover:text-white cursor-pointer transition-colors"
                                      title={isCollapsed ? 'Expand Layer' : 'Collapse Layer'}
                                    >
                                      {isCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                                    </button>
                                  </div>
                                </div>

                                {/* Card Body (Expanded) */}
                                {!isCollapsed && (
                                  <div className="p-3 space-y-3">
                                    {/* Sub Anim Type */}
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-mono font-semibold text-slate-400">Layer Motion Type</span>
                                      <select
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono cursor-pointer"
                                        value={subAnim.type}
                                        onChange={(e) => {
                                          const newT = e.target.value as AnimationType;
                                          handleUpdateSubAnimation(subIdx, {
                                            type: newT,
                                            speed: subAnim.speed || (newT === 'linear-reciprocate' ? 2.0 : 60),
                                            amplitude: subAnim.amplitude || (newT === 'linear-reciprocate' ? 10 : 35),
                                          });
                                        }}
                                      >
                                        <option value="continuous-spin">Continuous Spin (Rotary RPM)</option>
                                        <option value="oscillate-rotation">Oscillating Rotation (Sweep)</option>
                                        <option value="linear-reciprocate">Linear Reciprocating (Stroke)</option>
                                      </select>
                                    </div>

                                    {/* Motion Axis */}
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-mono font-semibold text-slate-400">Motion Axis</span>
                                      <div className="flex gap-1.5">
                                        {(['x', 'y', 'z'] as const).map((ax) => (
                                          <button
                                            key={ax}
                                            type="button"
                                            onClick={() => handleUpdateSubAnimation(subIdx, { axis: ax })}
                                            className={`flex-1 py-1 rounded text-[11px] font-mono font-bold uppercase transition-all cursor-pointer ${
                                              (subAnim.axis || 'z') === ax
                                                ? ax === 'x' ? 'bg-red-600 text-white' : ax === 'y' ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
                                                : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                          >
                                            {ax}-Axis
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Reference Frame */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center text-[10px] font-mono">
                                        <span className="text-slate-400 font-semibold">Reference Frame</span>
                                        <span className="text-slate-500">
                                          {(subAnim.axisAlignment || 'model') === 'model' ? 'Assembly Model' : subAnim.axisAlignment === 'part' ? 'Part Transform' : 'Global World'}
                                        </span>
                                      </div>
                                      <div className="flex gap-1.5">
                                        {[
                                          { id: 'model', label: 'Assembly' },
                                          { id: 'part', label: 'Part' },
                                          { id: 'global', label: 'Global' },
                                        ].map((f) => (
                                          <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => handleUpdateSubAnimation(subIdx, { axisAlignment: f.id as any })}
                                            className={`flex-1 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                                              (subAnim.axisAlignment || 'model') === f.id
                                                ? 'bg-indigo-600 text-white font-bold'
                                                : 'bg-slate-800 text-slate-400 hover:text-white'
                                            }`}
                                          >
                                            {f.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Direction */}
                                    <div className="space-y-1">
                                      <span className="text-[10px] font-mono font-semibold text-slate-400">Direction</span>
                                      <div className="flex gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateSubAnimation(subIdx, { direction: 1 })}
                                          className={`flex-1 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                                            (subAnim.direction ?? 1) === 1 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                                          }`}
                                        >
                                          Forward / CW (+1)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateSubAnimation(subIdx, { direction: -1 })}
                                          className={`flex-1 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                                            subAnim.direction === -1 ? 'bg-blue-600 text-white font-bold' : 'bg-slate-800 text-slate-400'
                                          }`}
                                        >
                                          Reverse / CCW (-1)
                                        </button>
                                      </div>
                                    </div>

                                    {/* Speed / Frequency */}
                                    <div className="space-y-1">
                                      <div className="flex justify-between items-center text-[10px] font-mono">
                                        <span className="text-slate-400 font-semibold">
                                          {subAnim.type === 'linear-reciprocate' ? 'Stroke Frequency' : 'Motion Speed'}
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            min="0.1"
                                            max={subAnim.type === 'linear-reciprocate' ? '60' : '10000'}
                                            step={subAnim.type === 'linear-reciprocate' ? '0.1' : '1'}
                                            value={subAnim.speed || 0}
                                            onChange={(e) => handleUpdateSubAnimation(subIdx, { speed: parseFloat(e.target.value) || 0 })}
                                            className="w-16 px-1.5 py-0.5 bg-slate-950 text-xs font-mono text-amber-400 font-bold rounded border border-slate-800 text-right outline-none"
                                          />
                                          <span className="text-slate-400 text-[10px]">
                                            {subAnim.type === 'linear-reciprocate' ? 'Hz' : 'RPM'}
                                          </span>
                                        </div>
                                      </div>
                                      <input
                                        type="range"
                                        min={subAnim.type === 'linear-reciprocate' ? '0.2' : '1'}
                                        max={subAnim.type === 'linear-reciprocate' ? '20' : '3000'}
                                        step={subAnim.type === 'linear-reciprocate' ? '0.1' : '1'}
                                        value={subAnim.speed || 0}
                                        onChange={(e) => handleUpdateSubAnimation(subIdx, { speed: parseFloat(e.target.value) || 0 })}
                                        className="w-full accent-amber-500 cursor-pointer"
                                      />
                                    </div>

                                    {/* Linear Reciprocating Distances */}
                                    {subAnim.type === 'linear-reciprocate' && (
                                      <div className="space-y-2 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
                                        <div className="flex justify-between items-center text-[10px] font-mono">
                                          <span className="font-semibold text-amber-400">Stroke Distances</span>
                                          <span className="text-slate-400">
                                            Total: {(
                                              (subAnim.amplitudePositive !== undefined ? subAnim.amplitudePositive : (subAnim.amplitude || 10)) +
                                              (subAnim.amplitudeNegative !== undefined ? subAnim.amplitudeNegative : (subAnim.amplitude || 10))
                                            ).toFixed(1)} cm
                                          </span>
                                        </div>
                                        <div className="space-y-1">
                                          <div className="flex justify-between items-center text-[10px] font-mono">
                                            <span className="text-slate-300 flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                              <span>Forward (+{(subAnim.axis || 'z').toUpperCase()})</span>
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max="200"
                                                step="0.5"
                                                value={subAnim.amplitudePositive !== undefined ? subAnim.amplitudePositive : (subAnim.amplitude || 10)}
                                                onChange={(e) => handleUpdateSubAnimation(subIdx, { amplitudePositive: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                className="w-14 px-1 py-0.5 bg-slate-950 text-[11px] font-mono text-emerald-400 font-bold rounded border border-slate-800 text-right outline-none"
                                              />
                                              <span className="text-slate-400 text-[10px]">cm</span>
                                            </div>
                                          </div>
                                          <input
                                            type="range"
                                            min="0"
                                            max="50"
                                            step="0.5"
                                            value={subAnim.amplitudePositive !== undefined ? subAnim.amplitudePositive : (subAnim.amplitude || 10)}
                                            onChange={(e) => handleUpdateSubAnimation(subIdx, { amplitudePositive: parseFloat(e.target.value) })}
                                            className="w-full accent-emerald-500 cursor-pointer"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <div className="flex justify-between items-center text-[10px] font-mono">
                                            <span className="text-slate-300 flex items-center gap-1">
                                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                              <span>Reverse (-{(subAnim.axis || 'z').toUpperCase()})</span>
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <input
                                                type="number"
                                                min="0"
                                                max="200"
                                                step="0.5"
                                                value={subAnim.amplitudeNegative !== undefined ? subAnim.amplitudeNegative : (subAnim.amplitude || 10)}
                                                onChange={(e) => handleUpdateSubAnimation(subIdx, { amplitudeNegative: Math.max(0, parseFloat(e.target.value) || 0) })}
                                                className="w-14 px-1 py-0.5 bg-slate-950 text-[11px] font-mono text-rose-400 font-bold rounded border border-slate-800 text-right outline-none"
                                              />
                                              <span className="text-slate-400 text-[10px]">cm</span>
                                            </div>
                                          </div>
                                          <input
                                            type="range"
                                            min="0"
                                            max="50"
                                            step="0.5"
                                            value={subAnim.amplitudeNegative !== undefined ? subAnim.amplitudeNegative : (subAnim.amplitude || 10)}
                                            onChange={(e) => handleUpdateSubAnimation(subIdx, { amplitudeNegative: parseFloat(e.target.value) })}
                                            className="w-full accent-rose-500 cursor-pointer"
                                          />
                                        </div>
                                        <div className="flex gap-1 pt-0.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const val = subAnim.amplitudePositive !== undefined ? subAnim.amplitudePositive : (subAnim.amplitude || 10);
                                              handleUpdateSubAnimation(subIdx, { amplitudePositive: val, amplitudeNegative: val });
                                            }}
                                            className="flex-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-mono cursor-pointer"
                                          >
                                            Symmetric
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const val = subAnim.amplitudePositive !== undefined ? subAnim.amplitudePositive : (subAnim.amplitude || 10);
                                              handleUpdateSubAnimation(subIdx, { amplitudePositive: val || 10, amplitudeNegative: 0 });
                                            }}
                                            className="flex-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-mono cursor-pointer"
                                          >
                                            Forward Only
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const val = subAnim.amplitudeNegative !== undefined ? subAnim.amplitudeNegative : (subAnim.amplitude || 10);
                                              handleUpdateSubAnimation(subIdx, { amplitudePositive: 0, amplitudeNegative: val || 10 });
                                            }}
                                            className="flex-1 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] font-mono cursor-pointer"
                                          >
                                            Reverse Only
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Oscillating Sweep Angle */}
                                    {subAnim.type === 'oscillate-rotation' && (
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[10px] font-mono">
                                          <span className="text-slate-400 font-semibold">Sweep Angle (±)</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min="1"
                                              max="360"
                                              step="1"
                                              value={subAnim.amplitude || 35}
                                              onChange={(e) => handleUpdateSubAnimation(subIdx, { amplitude: parseFloat(e.target.value) || 0 })}
                                              className="w-14 px-1 py-0.5 bg-slate-950 text-xs font-mono text-amber-400 font-bold rounded border border-slate-800 text-right outline-none"
                                            />
                                            <span className="text-slate-400 text-[10px]">deg</span>
                                          </div>
                                        </div>
                                        <input
                                          type="range"
                                          min="1"
                                          max="180"
                                          step="1"
                                          value={subAnim.amplitude || 35}
                                          onChange={(e) => handleUpdateSubAnimation(subIdx, { amplitude: parseFloat(e.target.value) || 0 })}
                                          className="w-full accent-amber-500 cursor-pointer"
                                        />
                                      </div>
                                    )}

                                    {/* Phase Offset */}
                                    {(subAnim.type === 'oscillate-rotation' || subAnim.type === 'linear-reciprocate') && (
                                      <div className="space-y-1">
                                        <div className="flex justify-between items-center text-[10px] font-mono">
                                          <span className="text-slate-400 font-semibold">Phase Offset</span>
                                          <div className="flex items-center gap-1">
                                            <input
                                              type="number"
                                              min="0"
                                              max="360"
                                              step="5"
                                              value={subAnim.phase || 0}
                                              onChange={(e) => handleUpdateSubAnimation(subIdx, { phase: parseFloat(e.target.value) || 0 })}
                                              className="w-14 px-1 py-0.5 bg-slate-950 text-xs font-mono text-amber-400 font-bold rounded border border-slate-800 text-right outline-none"
                                            />
                                            <span className="text-slate-400 text-[10px]">deg</span>
                                          </div>
                                        </div>
                                        <input
                                          type="range"
                                          min="0"
                                          max="360"
                                          step="5"
                                          value={subAnim.phase || 0}
                                          onChange={(e) => handleUpdateSubAnimation(subIdx, { phase: parseFloat(e.target.value) || 0 })}
                                          className="w-full accent-amber-500 cursor-pointer"
                                        />
                                      </div>
                                    )}

                                    {/* Axis Custom Rotation Offsets in 3D */}
                                    <div className="space-y-1.5 p-2 bg-slate-950/60 rounded-lg border border-slate-800">
                                      <div className="flex justify-between items-center text-[10px] font-mono">
                                        <span className="font-semibold text-slate-400 flex items-center gap-1">
                                          <RotateCw size={11} className="text-purple-400" />
                                          <span>Axis Tilt Angles</span>
                                        </span>
                                        <span className="text-purple-300">
                                          {subAnim.axisRotX || 0}°, {subAnim.axisRotY || 0}°, {subAnim.axisRotZ || 0}°
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-1.5">
                                        {[
                                          { key: 'axisRotX', label: 'Pitch X', color: 'text-red-400' },
                                          { key: 'axisRotY', label: 'Yaw Y', color: 'text-green-400' },
                                          { key: 'axisRotZ', label: 'Roll Z', color: 'text-blue-400' },
                                        ].map((axisField) => {
                                          const val = (subAnim as any)[axisField.key] || 0;
                                          return (
                                            <div key={axisField.key} className="space-y-0.5">
                                              <span className={`text-[9px] font-mono ${axisField.color}`}>{axisField.label}</span>
                                              <div className="flex items-center bg-slate-800 rounded border border-slate-700">
                                                <button
                                                  type="button"
                                                  onClick={() => handleUpdateSubAnimation(subIdx, { [axisField.key]: ((val - 15 + 360) % 360) })}
                                                  className="px-1 py-0.5 text-slate-400 hover:text-white text-[9px] cursor-pointer"
                                                >
                                                  -
                                                </button>
                                                <input
                                                  type="number"
                                                  value={val}
                                                  onChange={(e) => handleUpdateSubAnimation(subIdx, { [axisField.key]: parseFloat(e.target.value) || 0 })}
                                                  className="w-full bg-transparent text-center text-[10px] font-mono text-white focus:outline-none"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => handleUpdateSubAnimation(subIdx, { [axisField.key]: ((val + 15) % 360) })}
                                                  className="px-1 py-0.5 text-slate-400 hover:text-white text-[9px] cursor-pointer"
                                                >
                                                  +
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>

                                    {/* Pivot Axis Center */}
                                    <div className="space-y-1.5 border-t border-slate-800/80 pt-2">
                                      <span className="text-[10px] font-mono font-semibold text-slate-400">Pivot Axis Center</span>
                                      <div className="flex gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateSubAnimation(subIdx, { pivotMode: 'center-of-mass' })}
                                          className={`flex-1 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                                            (subAnim.pivotMode || 'center-of-mass') === 'center-of-mass'
                                              ? 'bg-emerald-600 text-white font-bold'
                                              : 'bg-slate-800 text-slate-400'
                                          }`}
                                        >
                                          Center of Mass
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateSubAnimation(subIdx, { pivotMode: 'custom' })}
                                          className={`flex-1 py-1 rounded text-[10px] font-mono transition-all cursor-pointer ${
                                            subAnim.pivotMode === 'custom'
                                              ? 'bg-blue-600 text-white font-bold'
                                              : 'bg-slate-800 text-slate-400'
                                          }`}
                                        >
                                          Custom Offset
                                        </button>
                                      </div>

                                      {subAnim.pivotMode === 'custom' && (
                                        <div className="space-y-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800 mt-1">
                                          {['pivotX', 'pivotY', 'pivotZ'].map((pKey, i) => {
                                            const label = ['Pivot X (cm)', 'Pivot Y (cm)', 'Pivot Z (cm)'][i];
                                            const val = (subAnim as any)[pKey] || 0;
                                            return (
                                              <div key={pKey} className="space-y-1">
                                                <div className="flex justify-between items-center text-[9px] font-mono">
                                                  <span className="text-slate-400">{label}</span>
                                                  <input
                                                    type="number"
                                                    step="0.5"
                                                    value={val}
                                                    onChange={(e) => handleUpdateSubAnimation(subIdx, { [pKey]: parseFloat(e.target.value) || 0 })}
                                                    className="w-14 px-1 py-0.5 bg-slate-950 text-[10px] font-mono text-white rounded border border-slate-800 text-right outline-none"
                                                  />
                                                </div>
                                                <input
                                                  type="range"
                                                  min="-100"
                                                  max="100"
                                                  step="0.5"
                                                  value={val}
                                                  onChange={(e) => handleUpdateSubAnimation(subIdx, { [pKey]: parseFloat(e.target.value) || 0 })}
                                                  className="w-full accent-blue-500 cursor-pointer"
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SINGLE ANIMATION CONTROLS (with instant compound addition button) */}
                    {activeAnim && activeAnim.type !== 'none' && activeAnim.type !== 'multi' && (
                      <>
                        {/* Compound Motion Conversion Prompt */}
                        <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-blue-950/60 to-purple-950/60 rounded-xl border border-blue-500/30">
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-mono font-bold text-white flex items-center gap-1.5">
                              <Layers size={13} className="text-blue-400" />
                              <span>Simultaneous Motion</span>
                            </span>
                            <p className="text-[10px] font-mono text-slate-400">
                              Combine translation + rotation concurrently
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddOrConvertToMulti}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-mono font-bold flex items-center gap-1 shadow transition-colors cursor-pointer"
                          >
                            <Plus size={12} />
                            <span>+ Add Layer</span>
                          </button>
                        </div>

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

                        {/* Axis Alignment / Reference Frame */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="font-semibold text-slate-300">Axis Reference Frame</span>
                            <span className="text-[10px] text-slate-400">
                              {(activeAnim.axisAlignment || 'model') === 'model' ? 'Assembly Model' : activeAnim.axisAlignment === 'part' ? 'Part Transform' : 'Global World'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => updatePartAnimation(selectedPartIndex, { axisAlignment: 'model' })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                (activeAnim.axisAlignment || 'model') === 'model'
                                  ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              Assembly Axis
                            </button>
                            <button
                              type="button"
                              onClick={() => updatePartAnimation(selectedPartIndex, { axisAlignment: 'part' })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.axisAlignment === 'part'
                                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              Part Transform
                            </button>
                            <button
                              type="button"
                              onClick={() => updatePartAnimation(selectedPartIndex, { axisAlignment: 'global' })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.axisAlignment === 'global'
                                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              Global Axis
                            </button>
                          </div>
                        </div>

                        {/* 3D Viewport Gizmo Mode: Translate vs Rotate */}
                        <div className="space-y-1.5 p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                              <Crosshair size={13} className="text-blue-400" />
                              3D Viewport Tool
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {gizmoControlMode === 'translate' ? 'Move Pivot Position' : 'Rotate Axis Angle'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setGizmoControlMode('translate')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                gizmoControlMode === 'translate'
                                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <Move size={12} />
                              Translate Pivot
                            </button>
                            <button
                              type="button"
                              onClick={() => setGizmoControlMode('rotate')}
                              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                gizmoControlMode === 'rotate'
                                  ? 'bg-purple-600 text-white font-semibold shadow-sm'
                                  : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              <RotateCw size={12} />
                              Rotate Axis
                            </button>
                          </div>
                        </div>

                        {/* Axis Custom Rotation / Angle Offsets */}
                        <div className="space-y-2 p-2.5 bg-slate-900/40 rounded-xl border border-slate-800/80">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                              <RotateCw size={13} className="text-purple-400" />
                              Axis Rotation Angles
                            </span>
                            <span className="text-[10px] text-purple-300 font-mono">
                              {activeAnim.axisRotX || 0}°, {activeAnim.axisRotY || 0}°, {activeAnim.axisRotZ || 0}°
                            </span>
                          </div>

                          {/* X / Y / Z Angle Rows */}
                          <div className="grid grid-cols-3 gap-2">
                            {/* Pitch / X */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-mono text-red-400">
                                <span>Pitch (X°)</span>
                              </div>
                              <div className="flex items-center bg-slate-800 rounded border border-slate-700">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotX: ((activeAnim.axisRotX || 0) - 15 + 360) % 360,
                                    })
                                  }
                                  className="px-1.5 py-1 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                                  title="-15°"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={activeAnim.axisRotX || 0}
                                  onChange={(e) =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotX: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full bg-transparent text-center text-xs font-mono text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotX: ((activeAnim.axisRotX || 0) + 15) % 360,
                                    })
                                  }
                                  className="px-1.5 py-1 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                                  title="+15°"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Yaw / Y */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-mono text-green-400">
                                <span>Yaw (Y°)</span>
                              </div>
                              <div className="flex items-center bg-slate-800 rounded border border-slate-700">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotY: ((activeAnim.axisRotY || 0) - 15 + 360) % 360,
                                    })
                                  }
                                  className="px-1.5 py-1 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                                  title="-15°"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={activeAnim.axisRotY || 0}
                                  onChange={(e) =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotY: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full bg-transparent text-center text-xs font-mono text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotY: ((activeAnim.axisRotY || 0) + 15) % 360,
                                    })
                                  }
                                  className="px-1.5 py-1 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                                  title="+15°"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Roll / Z */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-mono text-blue-400">
                                <span>Roll (Z°)</span>
                              </div>
                              <div className="flex items-center bg-slate-800 rounded border border-slate-700">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotZ: ((activeAnim.axisRotZ || 0) - 15 + 360) % 360,
                                    })
                                  }
                                  className="px-1.5 py-1 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                                  title="-15°"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  value={activeAnim.axisRotZ || 0}
                                  onChange={(e) =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotZ: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full bg-transparent text-center text-xs font-mono text-white focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    updatePartAnimation(selectedPartIndex, {
                                      axisRotZ: ((activeAnim.axisRotZ || 0) + 15) % 360,
                                    })
                                  }
                                  className="px-1.5 py-1 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                                  title="+15°"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Quick Angle Presets & Reset */}
                          <div className="flex flex-wrap gap-1 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                updatePartAnimation(selectedPartIndex, {
                                  axisRotX: 0,
                                  axisRotY: 0,
                                  axisRotZ: 0,
                                })
                              }
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 rounded cursor-pointer transition-colors"
                            >
                              Reset (0°)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updatePartAnimation(selectedPartIndex, {
                                  axisRotX: ((activeAnim.axisRotX || 0) + 45) % 360,
                                })
                              }
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-red-300 rounded cursor-pointer transition-colors"
                            >
                              +45° X
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updatePartAnimation(selectedPartIndex, {
                                  axisRotY: ((activeAnim.axisRotY || 0) + 45) % 360,
                                })
                              }
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-green-300 rounded cursor-pointer transition-colors"
                            >
                              +45° Y
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updatePartAnimation(selectedPartIndex, {
                                  axisRotZ: ((activeAnim.axisRotZ || 0) + 45) % 360,
                                })
                              }
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-blue-300 rounded cursor-pointer transition-colors"
                            >
                              +45° Z
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updatePartAnimation(selectedPartIndex, {
                                  axisRotX: ((activeAnim.axisRotX || 0) + 90) % 360,
                                })
                              }
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-red-300 rounded cursor-pointer transition-colors"
                            >
                              +90° X
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updatePartAnimation(selectedPartIndex, {
                                  axisRotY: ((activeAnim.axisRotY || 0) + 90) % 360,
                                })
                              }
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-green-300 rounded cursor-pointer transition-colors"
                            >
                              +90° Y
                            </button>
                          </div>
                        </div>

                        {/* Direction */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-mono font-semibold text-slate-300">Motion Direction</span>
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

                        {/* Speed / Frequency with Direct Input */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-slate-300 font-semibold">
                              {activeAnim.type === 'linear-reciprocate' ? 'Stroke Frequency' : 'Motion Speed'}
                            </span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0.1"
                                max={activeAnim.type === 'linear-reciprocate' ? '60' : '10000'}
                                step={activeAnim.type === 'linear-reciprocate' ? '0.1' : '1'}
                                value={activeAnim.speed}
                                onChange={(e) => updatePartAnimation(selectedPartIndex, { speed: parseFloat(e.target.value) || 0 })}
                                className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-amber-400 font-bold rounded border border-slate-800 text-right outline-none"
                              />
                              <span className="text-slate-400 text-[11px]">
                                {activeAnim.type === 'linear-reciprocate' ? 'Hz' : 'RPM'}
                              </span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min={activeAnim.type === 'linear-reciprocate' ? '0.2' : '1'}
                            max={activeAnim.type === 'linear-reciprocate' ? '20' : '3000'}
                            step={activeAnim.type === 'linear-reciprocate' ? '0.1' : '1'}
                            value={activeAnim.speed}
                            onChange={(e) => updatePartAnimation(selectedPartIndex, { speed: parseFloat(e.target.value) })}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>

                        {/* Custom Translation Distances in Both Directions */}
                        {activeAnim.type === 'linear-reciprocate' && (
                          <div className="space-y-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-mono font-semibold text-amber-400">
                                Translation Distances (Both Directions)
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                Total: {(
                                  (activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10)) +
                                  (activeAnim.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim.amplitude || 10))
                                ).toFixed(1)} cm
                              </span>
                            </div>

                            {/* Positive / Forward Stroke Distance (+ Axis) */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs font-mono">
                                <span className="text-slate-300 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                  <span>Forward Distance (+{activeAnim.axis.toUpperCase()})</span>
                                </span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="200"
                                    step="0.5"
                                    value={activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10)}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      updatePartAnimation(selectedPartIndex, { amplitudePositive: val });
                                    }}
                                    className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-emerald-400 font-bold rounded border border-slate-800 text-right outline-none"
                                  />
                                  <span className="text-slate-400 text-[11px]">cm</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="50"
                                step="0.5"
                                value={activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10)}
                                onChange={(e) =>
                                  updatePartAnimation(selectedPartIndex, { amplitudePositive: parseFloat(e.target.value) })
                                }
                                className="w-full accent-emerald-500 cursor-pointer"
                              />
                            </div>

                            {/* Negative / Reverse Stroke Distance (- Axis) */}
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs font-mono">
                                <span className="text-slate-300 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                                  <span>Reverse Distance (-{activeAnim.axis.toUpperCase()})</span>
                                </span>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="0"
                                    max="200"
                                    step="0.5"
                                    value={activeAnim.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim.amplitude || 10)}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseFloat(e.target.value) || 0);
                                      updatePartAnimation(selectedPartIndex, { amplitudeNegative: val });
                                    }}
                                    className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-rose-400 font-bold rounded border border-slate-800 text-right outline-none"
                                  />
                                  <span className="text-slate-400 text-[11px]">cm</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="50"
                                step="0.5"
                                value={activeAnim.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim.amplitude || 10)}
                                onChange={(e) =>
                                  updatePartAnimation(selectedPartIndex, { amplitudeNegative: parseFloat(e.target.value) })
                                }
                                className="w-full accent-rose-500 cursor-pointer"
                              />
                            </div>

                            {/* Quick Presets */}
                            <div className="flex gap-1.5 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  const currentPos = activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10);
                                  updatePartAnimation(selectedPartIndex, { amplitudePositive: currentPos, amplitudeNegative: currentPos });
                                }}
                                className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono transition-colors"
                              >
                                Symmetric
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentPos = activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10);
                                  updatePartAnimation(selectedPartIndex, { amplitudePositive: currentPos || 10, amplitudeNegative: 0 });
                                }}
                                className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono transition-colors"
                              >
                                Forward Only
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentNeg = activeAnim.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim.amplitude || 10);
                                  updatePartAnimation(selectedPartIndex, { amplitudePositive: 0, amplitudeNegative: currentNeg || 10 });
                                }}
                                className="flex-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-mono transition-colors"
                              >
                                Reverse Only
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Angle Sweep for Oscillating Rotation */}
                        {activeAnim.type === 'oscillate-rotation' && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className="text-slate-300 font-semibold">Sweep Angle (±)</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="1"
                                  max="360"
                                  step="1"
                                  value={activeAnim.amplitude || 35}
                                  onChange={(e) => updatePartAnimation(selectedPartIndex, { amplitude: parseFloat(e.target.value) || 0 })}
                                  className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-amber-400 font-bold rounded border border-slate-800 text-right outline-none"
                                />
                                <span className="text-slate-400 text-[11px]">deg</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="180"
                              step="1"
                              value={activeAnim.amplitude || 35}
                              onChange={(e) => updatePartAnimation(selectedPartIndex, { amplitude: parseFloat(e.target.value) })}
                              className="w-full accent-amber-500 cursor-pointer"
                            />
                          </div>
                        )}

                        {/* Phase Offset for harmonic animations */}
                        {(activeAnim.type === 'oscillate-rotation' || activeAnim.type === 'linear-reciprocate') && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs font-mono">
                              <span className="text-slate-300 font-semibold">Phase Offset</span>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="360"
                                  step="5"
                                  value={activeAnim.phase || 0}
                                  onChange={(e) => updatePartAnimation(selectedPartIndex, { phase: parseFloat(e.target.value) || 0 })}
                                  className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-amber-400 font-bold rounded border border-slate-800 text-right outline-none"
                                />
                                <span className="text-slate-400 text-[11px]">deg</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="360"
                              step="5"
                              value={activeAnim.phase || 0}
                              onChange={(e) => updatePartAnimation(selectedPartIndex, { phase: parseFloat(e.target.value) })}
                              className="w-full accent-amber-500 cursor-pointer"
                            />
                          </div>
                        )}

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
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-400 bg-blue-950/40 px-2 py-1 rounded-lg border border-blue-900/40 mb-2">
                              <Crosshair size={12} className="shrink-0" />
                              <span>Drag 3D arrows directly on the pivot in the canvas, or tweak below:</span>
                            </div>
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
                                        onChange={(e) => {
                                          if (isPlaying) setIsPlaying(false);
                                          updatePartAnimation(selectedPartIndex, { [pKey]: parseFloat(e.target.value) || 0 });
                                        }}
                                        className="w-16 px-1.5 py-0.5 bg-slate-950 text-[11px] font-mono text-white rounded border border-slate-800 text-right outline-none"
                                      />
                                      <span className="text-slate-400">cm</span>
                                    </div>
                                  </div>
                                  <input
                                    type="range"
                                    min="-100"
                                    max="100"
                                    step="0.5"
                                    value={val}
                                    onChange={(e) => {
                                      if (isPlaying) setIsPlaying(false);
                                      updatePartAnimation(selectedPartIndex, { [pKey]: parseFloat(e.target.value) || 0 });
                                    }}
                                    className="w-full accent-blue-500 cursor-pointer"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                      </>
                    )}

                    {/* Global Part Motion Reset (available for both single and multi animations) */}
                    {activeAnim && activeAnim.type !== 'none' && (
                      <button
                        type="button"
                        onClick={() => resetPartAnimation(selectedPartIndex)}
                        className="w-full py-2 rounded-lg text-xs font-mono font-bold text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 transition-colors cursor-pointer"
                      >
                        Remove All Motion from this Part
                      </button>
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
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm border border-slate-700 disabled:opacity-50"
                    >
                      <Sparkles size={13} className="text-purple-400" />
                      <span>⚡ Batch Export All Posters</span>
                    </button>

                    <button
                      onClick={handleExportGLB}
                      disabled={isExportingPosters}
                      className="w-full py-2.5 px-3 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50 mt-1"
                    >
                      <Zap size={13} />
                      <span>📦 Export Split Model as .GLB</span>
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
interface InteractiveStudioPivotGizmoProps {
  selectedPartIndex: number | null;
  activeAnim: any;
  gizmoMode: 'translate' | 'rotate';
  modelSettings?: TransformSettings;
  onUpdatePivot: (update: Partial<any>) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function InteractiveStudioPivotGizmo({
  selectedPartIndex,
  activeAnim,
  gizmoMode,
  modelSettings: _modelSettings,
  onUpdatePivot,
  onDragStart,
  onDragEnd,
}: InteractiveStudioPivotGizmoProps) {
  const { scene } = useThree();
  const anchorRef = useRef<THREE.Group>(null!);
  const transformRef = useRef<any>(null);
  const isDraggingRef = useRef<boolean>(false);
  const onDragStartRef = useRef(onDragStart);
  const onDragEndRef = useRef(onDragEnd);
  onDragStartRef.current = onDragStart;
  onDragEndRef.current = onDragEnd;

  // Frame update to sync anchor position and orientation when NOT dragging
  useFrame(() => {
    if (!anchorRef.current || selectedPartIndex === null || !activeAnim || activeAnim.type === 'none') {
      if (anchorRef.current) anchorRef.current.visible = false;
      return;
    }

    if (isDraggingRef.current) {
      // While dragging, TransformControls moves/rotates anchorRef directly in world space
      return;
    }

    let targetMesh: THREE.Mesh | null = null;
    scene.traverse((child) => {
      if ((child as any).isMesh && (
        child.userData.cadPartIndex === selectedPartIndex || 
        child.userData.partIndex === selectedPartIndex || 
        child.userData.subPartIndex === selectedPartIndex
      )) {
        targetMesh = child as THREE.Mesh;
      }
    });

    if (targetMesh) {
      anchorRef.current.visible = true;
      const t = targetMesh as THREE.Mesh;
      t.updateWorldMatrix(true, false);

      const getSafeVec3 = (v: any): THREE.Vector3 | null => {
        if (!v) return null;
        if (v instanceof THREE.Vector3) return v.clone();
        if (typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') {
          return new THREE.Vector3(v.x, v.y, v.z);
        }
        return null;
      };

      let geomCom: THREE.Vector3;
      const parsedGeomCom = getSafeVec3(t.userData.geomCom);
      if (parsedGeomCom) {
        geomCom = parsedGeomCom;
      } else if (t.geometry) {
        geomCom = computeGeometryCenterOfMass(t.geometry);
        t.userData.geomCom = geomCom;
      } else {
        geomCom = new THREE.Vector3();
      }

      // Resting world center of mass in assembly coordinates (incorporating turntable and model hierarchy, without part's own oscillation)
      let worldCom: THREE.Vector3;
      const restingComVec = getSafeVec3(t.userData.restingCom);
      const centerOfMassVec = getSafeVec3(t.userData.centerOfMass);
      if (restingComVec && t.parent) {
        t.parent.updateWorldMatrix(true, false);
        worldCom = restingComVec.applyMatrix4(t.parent.matrixWorld);
      } else if (centerOfMassVec && t.parent) {
        t.parent.updateWorldMatrix(true, false);
        worldCom = centerOfMassVec.applyMatrix4(t.parent.matrixWorld);
      } else {
        worldCom = geomCom.clone().applyMatrix4(t.matrixWorld);
      }

      const assemblyRoot = getAssemblyRoot(t);
      assemblyRoot.updateWorldMatrix(true, false);
      const modelScale = assemblyRoot.getWorldScale(new THREE.Vector3()).x || 1;

      const alignment: AxisAlignment = activeAnim.axisAlignment || 'model';
      const rawOffset = new THREE.Vector3(
        (activeAnim.pivotX || 0) / 100,
        (activeAnim.pivotY || 0) / 100,
        (activeAnim.pivotZ || 0) / 100
      );

      // Custom axis rotation quaternion from (axisRotX, axisRotY, axisRotZ)
      const rotXRad = ((activeAnim.axisRotX || 0) * Math.PI) / 180;
      const rotYRad = ((activeAnim.axisRotY || 0) * Math.PI) / 180;
      const rotZRad = ((activeAnim.axisRotZ || 0) * Math.PI) / 180;
      const customAxisQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotXRad, rotYRad, rotZRad, 'XYZ')
      );

      let baseQuat = new THREE.Quaternion();

      if (alignment === 'global') {
        baseQuat.set(0, 0, 0, 1);
      } else if (alignment === 'part') {
        // Part's resting orientation (only rotated by parent rigid group and turntable, NOT part's own oscillation)
        if (t.userData.initialQuat && t.parent) {
          const parentWorldQuat = new THREE.Quaternion();
          t.parent.getWorldQuaternion(parentWorldQuat);
          const parentDeltaQuat = (t.userData.parentDeltaQuat as THREE.Quaternion) || new THREE.Quaternion();
          baseQuat = parentWorldQuat.clone().multiply(parentDeltaQuat).multiply(t.userData.initialQuat as THREE.Quaternion);
        } else {
          t.getWorldQuaternion(baseQuat);
        }
      } else {
        // 'model': Overall Assembly Model coordinate frame (includes calibration rotation and parent parts)
        if (t.parent) {
          t.parent.getWorldQuaternion(baseQuat);
          const parentDeltaQuat = (t.userData.parentDeltaQuat as THREE.Quaternion) || new THREE.Quaternion();
          baseQuat.multiply(parentDeltaQuat);
        } else {
          assemblyRoot.getWorldQuaternion(baseQuat);
        }
      }

      // World-space offset scaled by model scale
      const worldOffset = rawOffset.clone().multiplyScalar(modelScale).applyQuaternion(baseQuat);

      // Combine reference frame with custom axis rotation angles
      const gizmoQuat = baseQuat.clone().multiply(customAxisQuat);

      let worldPivot: THREE.Vector3;
      if (t.userData.hingePivot && t.parent && (activeAnim.type === 'oscillate-rotation' || activeAnim.type === 'continuous-spin')) {
        t.parent.updateWorldMatrix(true, false);
        worldPivot = (t.userData.hingePivot as THREE.Vector3).clone().applyMatrix4(t.parent.matrixWorld);
      } else if (activeAnim.pivotMode === 'custom') {
        worldPivot = worldCom.clone().add(worldOffset);
      } else if (activeAnim.pivotMode === 'origin') {
        if (t.userData.restingPos && t.parent) {
          t.parent.updateWorldMatrix(true, false);
          worldPivot = (t.userData.restingPos as THREE.Vector3).clone().applyMatrix4(t.parent.matrixWorld);
        } else if (t.userData.initialPos && t.parent) {
          t.parent.updateWorldMatrix(true, false);
          worldPivot = (t.userData.initialPos as THREE.Vector3).clone().applyMatrix4(t.parent.matrixWorld);
        } else {
          const meshWorldPos = new THREE.Vector3();
          t.getWorldPosition(meshWorldPos);
          worldPivot = meshWorldPos;
        }
      } else {
        // 'center-of-mass'
        worldPivot = worldCom.clone();
      }

      anchorRef.current.position.copy(worldPivot);
      anchorRef.current.quaternion.copy(gizmoQuat);
    } else {
      anchorRef.current.visible = false;
    }
  });

  const handleMouseDown = () => {
    isDraggingRef.current = true;
    onDragStartRef.current();
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    onDragEndRef.current();
  };

  const handleObjectChange = () => {
    if (!isDraggingRef.current || !anchorRef.current || selectedPartIndex === null || !activeAnim) return;

    let targetMesh: THREE.Mesh | null = null;
    scene.traverse((child) => {
      if ((child as any).isMesh && (
        child.userData.cadPartIndex === selectedPartIndex || 
        child.userData.partIndex === selectedPartIndex || 
        child.userData.subPartIndex === selectedPartIndex
      )) {
        targetMesh = child as THREE.Mesh;
      }
    });
    if (!targetMesh) return;

    const t = targetMesh as THREE.Mesh;
    t.updateWorldMatrix(true, false);

    const assemblyRoot = getAssemblyRoot(t);
    assemblyRoot.updateWorldMatrix(true, false);
    const modelScale = assemblyRoot.getWorldScale(new THREE.Vector3()).x || 1;

    const alignment: AxisAlignment = activeAnim.axisAlignment || 'model';
    let baseQuat = new THREE.Quaternion();

    if (alignment === 'global') {
      baseQuat.set(0, 0, 0, 1);
    } else if (alignment === 'part') {
      if (t.userData.initialQuat && t.parent) {
        const parentWorldQuat = new THREE.Quaternion();
        t.parent.getWorldQuaternion(parentWorldQuat);
        const parentDeltaQuat = (t.userData.parentDeltaQuat as THREE.Quaternion) || new THREE.Quaternion();
        baseQuat = parentWorldQuat.clone().multiply(parentDeltaQuat).multiply(t.userData.initialQuat as THREE.Quaternion);
      } else {
        t.getWorldQuaternion(baseQuat);
      }
    } else {
      // 'model': Overall Assembly Model coordinate frame (includes calibration rotation and parent parts)
      if (t.parent) {
        t.parent.getWorldQuaternion(baseQuat);
        const parentDeltaQuat = (t.userData.parentDeltaQuat as THREE.Quaternion) || new THREE.Quaternion();
        baseQuat.multiply(parentDeltaQuat);
      } else {
        assemblyRoot.getWorldQuaternion(baseQuat);
      }
    }

    if (gizmoMode === 'rotate') {
      // Rotating the axis: compute new custom rotation relative to baseQuat
      const newCustomQuat = baseQuat.clone().invert().multiply(anchorRef.current.quaternion);
      const euler = new THREE.Euler().setFromQuaternion(newCustomQuat, 'XYZ');
      const rX = Math.round((euler.x * 180) / Math.PI);
      const rY = Math.round((euler.y * 180) / Math.PI);
      const rZ = Math.round((euler.z * 180) / Math.PI);

      if (rX !== (activeAnim.axisRotX || 0) || rY !== (activeAnim.axisRotY || 0) || rZ !== (activeAnim.axisRotZ || 0)) {
        onUpdatePivot({ axisRotX: rX, axisRotY: rY, axisRotZ: rZ });
      }
      const getSafeVec3 = (v: any): THREE.Vector3 | null => {
        if (!v) return null;
        if (v instanceof THREE.Vector3) return v.clone();
        if (typeof v.x === 'number' && typeof v.y === 'number' && typeof v.z === 'number') {
          return new THREE.Vector3(v.x, v.y, v.z);
        }
        return null;
      };

      let geomCom: THREE.Vector3;
      const parsedGeomCom = getSafeVec3(t.userData.geomCom);
      if (parsedGeomCom) {
        geomCom = parsedGeomCom;
      } else if (t.geometry) {
        geomCom = computeGeometryCenterOfMass(t.geometry);
        t.userData.geomCom = geomCom;
      } else {
        geomCom = new THREE.Vector3();
      }

      let worldCom: THREE.Vector3;
      const restingComVec = getSafeVec3(t.userData.restingCom);
      const centerOfMassVec = getSafeVec3(t.userData.centerOfMass);
      if (restingComVec && t.parent) {
        t.parent.updateWorldMatrix(true, false);
        worldCom = restingComVec.applyMatrix4(t.parent.matrixWorld);
      } else if (centerOfMassVec && t.parent) {
        t.parent.updateWorldMatrix(true, false);
        worldCom = centerOfMassVec.applyMatrix4(t.parent.matrixWorld);
      } else {
        worldCom = geomCom.clone().applyMatrix4(t.matrixWorld);
      }

      const newWorldPivot = anchorRef.current.position.clone();
      const newWorldOffset = newWorldPivot.sub(worldCom);

      const localOffset = newWorldOffset.clone().applyQuaternion(baseQuat.clone().invert()).divideScalar(modelScale);

      const pX = Math.round(localOffset.x * 100 * 2) / 2;
      const pY = Math.round(localOffset.y * 100 * 2) / 2;
      const pZ = Math.round(localOffset.z * 100 * 2) / 2;

      if (pX !== activeAnim.pivotX || pY !== activeAnim.pivotY || pZ !== activeAnim.pivotZ) {
        onUpdatePivot({ pivotX: pX, pivotY: pY, pivotZ: pZ });
      }
    }
  };

  if (selectedPartIndex === null || !activeAnim || activeAnim.type === 'none') return null;

  const axis = activeAnim.axis || 'z';
  const axisColor = axis === 'x' ? '#ef4444' : axis === 'y' ? '#22c55e' : '#3b82f6';
  const amplitude = activeAnim.amplitude || 35;
  const sweepRad = (amplitude * 2 * Math.PI) / 180;
  const startRad = (-amplitude * Math.PI) / 180;
  const alignment: AxisAlignment = activeAnim.axisAlignment || 'model';

  return (
    <>
      <group ref={anchorRef} name="InteractivePivotGizmo_Group" userData={{ isHelper: true, isVisualizer: true }}>
        {/* Pivot Center Sphere */}
        <mesh name="InteractivePivotGizmo_Sphere" userData={{ isHelper: true }}>
          <sphereGeometry args={[0.025, 16, 16]} />
          <meshBasicMaterial color="#ef4444" depthTest={false} transparent opacity={0.9} />
        </mesh>

        {/* RGB Coordinate Axes */}
        <axesHelper args={[0.2]} />

        {/* Active Rotation Axis Guide Line (pointing along chosen axis) */}
        <group
          rotation={
            axis === 'x'
              ? [0, 0, Math.PI / 2]
              : axis === 'z'
              ? [Math.PI / 2, 0, 0]
              : [0, 0, 0]
          }
        >
          <mesh userData={{ isHelper: true }}>
            <cylinderGeometry args={[0.003, 0.003, 1.2, 16]} />
            <meshBasicMaterial color={axisColor} depthTest={false} transparent opacity={0.85} />
          </mesh>
        </group>

        {/* Visual Rotation Sweep Arc */}
        {(activeAnim.type === 'oscillate-rotation' || activeAnim.type === 'continuous-spin') && (
          <group
            rotation={
              axis === 'x'
                ? [0, Math.PI / 2, 0]
                : axis === 'y'
                ? [Math.PI / 2, 0, 0]
                : [0, 0, 0]
            }
          >
            <mesh userData={{ isHelper: true }}>
              <ringGeometry
                args={[
                  0.06,
                  0.18,
                  32,
                  1,
                  activeAnim.type === 'continuous-spin' ? 0 : startRad,
                  activeAnim.type === 'continuous-spin' ? Math.PI * 2 : sweepRad,
                ]}
              />
              <meshBasicMaterial
                color={axisColor}
                side={THREE.DoubleSide}
                depthTest={false}
                transparent
                opacity={0.35}
              />
            </mesh>
          </group>
        )}
      </group>

      {/* Attach TransformControls directly to anchorRef:
          - If gizmoMode === 'rotate', allow rotating the axis in all pivot modes
          - If gizmoMode === 'translate', allow translating when in custom pivot mode */}
      {(gizmoMode === 'rotate' || activeAnim.pivotMode === 'custom') && (
        <TransformControls
          ref={transformRef}
          object={anchorRef}
          mode={gizmoMode}
          size={0.65}
          space={gizmoMode === 'rotate' ? 'local' : (alignment === 'global' ? 'world' : 'local')}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onObjectChange={handleObjectChange}
        />
      )}
    </>
  );
}
