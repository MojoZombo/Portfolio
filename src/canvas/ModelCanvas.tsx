import * as THREE from 'three';
import React, { Suspense, useRef, useEffect, useLayoutEffect, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useStore, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { CADEdgeManager, CADEdgeRegistry, syncCADEdges } from './cadEdges';
import { CAD_CAMERA_FOV, CAD_CAMERA_POSITION, CADStageLights } from './stageConfig';

// Ensure self-hosted Draco WASM decoder is configured before any model mounts
useGLTF.setDecoderPath('./draco/gltf/');

const DEFAULT_CAMERA_POS = new THREE.Vector3(...CAD_CAMERA_POSITION);
const DEFAULT_SPHERICAL = new THREE.Spherical().setFromVector3(DEFAULT_CAMERA_POS);
const DEFAULT_RADIUS = DEFAULT_SPHERICAL.radius;
const DEFAULT_POLAR_ANGLE = DEFAULT_SPHERICAL.phi;
const DEFAULT_AZIMUTH_ANGLE = DEFAULT_SPHERICAL.theta;

export interface PointerHoverState {
  hovered: boolean;
  x: number;
  y: number;
}

export interface ScrollExitState {
  scrollExit: number;
}

const BLUEPRINT_FILL_DARK = new THREE.Color('#233247');
const BLUEPRINT_FILL_LIGHT = new THREE.Color('#FFFFFF');
const BLUEPRINT_LINE_DARK = new THREE.Color('#94A8C4');
const BLUEPRINT_LINE_LIGHT = new THREE.Color('#1E293B');

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _baseYawQuat = new THREE.Quaternion();
const _yawTiltQuat = new THREE.Quaternion();
const _pitchTiltQuat = new THREE.Quaternion();
const _camOffset = new THREE.Vector3();
const _camSpherical = new THREE.Spherical();
const _zeroTarget = new THREE.Vector3(0, 0, 0);

class ModelErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn('Model rendering issue caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}

function CanvasDrawDetector({
  active,
  targetFrames = 2,
  onDrawn,
}: {
  active: boolean;
  targetFrames?: number;
  onDrawn: () => void;
}) {
  const frameCount = useRef(0);

  useEffect(() => {
    if (!active) {
      frameCount.current = 0;
    }
  }, [active]);

  useFrame(() => {
    if (!active) {
      frameCount.current = 0;
      return;
    }
    frameCount.current++;
    if (frameCount.current >= targetFrames) {
      onDrawn();
    }
  });
  return null;
}

function CameraResetController({
  resetTrigger,
  allowZoom,
  isDragging,
  onResetComplete,
}: {
  resetTrigger: number;
  allowZoom: boolean;
  isDragging: boolean;
  onResetComplete: () => void;
}) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls as any);

  const isResettingRef = useRef(false);
  const lastHandledTriggerRef = useRef(0);
  const onResetCompleteRef = useRef(onResetComplete);
  onResetCompleteRef.current = onResetComplete;
  const rVelRef = useRef(0);
  const phiVelRef = useRef(0);
  const thetaVelRef = useRef(0);
  const targetVelRef = useRef(new THREE.Vector3());
  const offsetRef = useRef(new THREE.Vector3());
  const sphericalRef = useRef(new THREE.Spherical());
  const targetErrRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (resetTrigger <= 0 || resetTrigger === lastHandledTriggerRef.current) return;
    lastHandledTriggerRef.current = resetTrigger;

    if (!allowZoom) {
      isResettingRef.current = false;
      camera.position.copy(DEFAULT_CAMERA_POS);
      camera.lookAt(0, 0, 0);
      if (controls) {
        controls.target.set(0, 0, 0);
        if (controls.reset) {
          controls.reset();
        }
        controls.update();
      }
      onResetCompleteRef.current();
      return;
    }

    rVelRef.current = 0;
    phiVelRef.current = 0;
    thetaVelRef.current = 0;
    targetVelRef.current.set(0, 0, 0);
    isResettingRef.current = true;
  }, [resetTrigger, allowZoom, camera, controls]);

  useEffect(() => {
    if (isDragging && isResettingRef.current) {
      isResettingRef.current = false;
      onResetCompleteRef.current();
    }
  }, [isDragging]);

  useFrame((_, rawDelta) => {
    if (!isResettingRef.current) return;

    const delta = Math.min(rawDelta, 0.035);
    const omega = 3.2;

    const target: THREE.Vector3 | undefined = controls?.target;
    const activeTarget = target ?? _zeroTarget;
    offsetRef.current.copy(camera.position).sub(activeTarget);
    sphericalRef.current.setFromVector3(offsetRef.current);

    const radiusError = DEFAULT_RADIUS - sphericalRef.current.radius;
    const phiError = DEFAULT_POLAR_ANGLE - sphericalRef.current.phi;
    let thetaError = DEFAULT_AZIMUTH_ANGLE - sphericalRef.current.theta;
    thetaError = Math.atan2(Math.sin(thetaError), Math.cos(thetaError));
    targetErrRef.current.copy(activeTarget).negate();

    const rAccel = omega * omega * radiusError - 2 * omega * rVelRef.current;
    rVelRef.current += rAccel * delta;
    sphericalRef.current.radius = Math.max(0.5, sphericalRef.current.radius + rVelRef.current * delta);

    const phiAccel = omega * omega * phiError - 2 * omega * phiVelRef.current;
    phiVelRef.current += phiAccel * delta;
    sphericalRef.current.phi = THREE.MathUtils.clamp(
      sphericalRef.current.phi + phiVelRef.current * delta,
      0.01,
      Math.PI / 1.05
    );

    const thetaAccel = omega * omega * thetaError - 2 * omega * thetaVelRef.current;
    thetaVelRef.current += thetaAccel * delta;
    sphericalRef.current.theta += thetaVelRef.current * delta;

    if (target) {
      const txAccel = omega * omega * targetErrRef.current.x - 2 * omega * targetVelRef.current.x;
      const tyAccel = omega * omega * targetErrRef.current.y - 2 * omega * targetVelRef.current.y;
      const tzAccel = omega * omega * targetErrRef.current.z - 2 * omega * targetVelRef.current.z;
      targetVelRef.current.x += txAccel * delta;
      targetVelRef.current.y += tyAccel * delta;
      targetVelRef.current.z += tzAccel * delta;
      target.addScaledVector(targetVelRef.current, delta);
    }

    const donePos =
      Math.abs(radiusError) < 0.002 &&
      Math.abs(phiError) < 0.002 &&
      Math.abs(thetaError) < 0.002 &&
      targetErrRef.current.length() < 0.002;
    const doneVel =
      Math.abs(rVelRef.current) < 0.004 &&
      Math.abs(phiVelRef.current) < 0.004 &&
      Math.abs(thetaVelRef.current) < 0.004 &&
      targetVelRef.current.length() < 0.004;

    if (donePos && doneVel) {
      camera.position.copy(DEFAULT_CAMERA_POS);
      if (controls) {
        controls.target.set(0, 0, 0);
        camera.lookAt(0, 0, 0);
        controls.update();
      } else {
        camera.lookAt(0, 0, 0);
      }
      isResettingRef.current = false;
      onResetCompleteRef.current();
      return;
    }

    camera.position.copy(activeTarget).add(offsetRef.current.setFromSpherical(sphericalRef.current));
    camera.lookAt(activeTarget);
  });

  return null;
}

function CameraStateDetector({
  onCameraMove,
}: {
  onCameraMove: (isMoved: boolean) => void;
}) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls as any);
  const isMovedRef = useRef(false);

  useFrame(() => {
    const moved =
      camera.position.distanceTo(DEFAULT_CAMERA_POS) > 0.35 ||
      Boolean(controls?.target && controls.target.length() > 0.1);
    if (moved !== isMovedRef.current) {
      isMovedRef.current = moved;
      onCameraMove(moved);
    }
  });

  return null;
}

function CameraPolarReturnController({
  active,
}: {
  active: boolean;
}) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls as any);
  const phiVelocityRef = useRef(0);

  useEffect(() => {
    if (!active) {
      phiVelocityRef.current = 0;
    }
  }, [active]);

  useFrame((_, rawDelta) => {
    if (!active) {
      phiVelocityRef.current = 0;
      return;
    }

    const target: THREE.Vector3 = controls?.target ?? _zeroTarget;
    _camOffset.copy(camera.position).sub(target);
    _camSpherical.setFromVector3(_camOffset);

    const phiError = DEFAULT_POLAR_ANGLE - _camSpherical.phi;
    if (Math.abs(phiError) < 0.0008 && Math.abs(phiVelocityRef.current) < 0.001) {
      phiVelocityRef.current = 0;
      return;
    }

    const delta = Math.min(rawDelta, 0.035);
    const omega = 2.6;
    const accel = omega * omega * phiError - 2 * omega * phiVelocityRef.current;
    phiVelocityRef.current += accel * delta;

    const nextPhi = THREE.MathUtils.clamp(
      _camSpherical.phi + phiVelocityRef.current * delta,
      0.01,
      Math.PI / 1.05
    );

    if (
      Math.abs(DEFAULT_POLAR_ANGLE - nextPhi) < 0.0005 &&
      Math.abs(phiVelocityRef.current) < 0.002
    ) {
      _camSpherical.phi = DEFAULT_POLAR_ANGLE;
      phiVelocityRef.current = 0;
    } else {
      _camSpherical.phi = nextPhi;
    }

    camera.position.copy(target).add(_camOffset.setFromSpherical(_camSpherical));
    camera.lookAt(target);
  });

  return null;
}

interface InteractiveModelStageProps {
  stageGroupRef: React.MutableRefObject<THREE.Group | null>;
  allowZoom: boolean;
  showLiveCanvas: boolean;
  isActiveAndSettled: boolean;
  isMorphingToBlueprint: boolean;
  isRotating: boolean;
  isAnimating: boolean;
  isDragging: boolean;
  disableHoverTilt: boolean;
  isPaused: boolean;
  prefersReducedMotion: boolean;
  resetTrigger: number;
  pointerHoverRef: React.MutableRefObject<PointerHoverState>;
  children: ReactNode;
}

/**
 * Adds stage-level hover spin braking, gentle coast-down on exit,
 * and camera-aligned pointer parallax tilt without modifying individual model files.
 */
function InteractiveModelStage({
  stageGroupRef,
  allowZoom,
  showLiveCanvas,
  isActiveAndSettled,
  isMorphingToBlueprint,
  isRotating,
  isAnimating,
  isDragging,
  disableHoverTilt,
  isPaused,
  prefersReducedMotion,
  resetTrigger,
  pointerHoverRef,
  children,
}: InteractiveModelStageProps) {
  const baseYawRef = useRef(0);
  const spinRampRef = useRef(0);
  const hoverBrakeRef = useRef(0);
  const currentYawTiltRef = useRef(0);
  const currentPitchTiltRef = useRef(0);

  useEffect(() => {
    if (!isActiveAndSettled) {
      baseYawRef.current = 0;
      spinRampRef.current = 0;
      hoverBrakeRef.current = 0;
      currentYawTiltRef.current = 0;
      currentPitchTiltRef.current = 0;
      stageGroupRef.current?.quaternion.identity();
    }
  }, [isActiveAndSettled, stageGroupRef]);

  useEffect(() => {
    if (resetTrigger > 0 && !allowZoom) {
      baseYawRef.current = 0;
      spinRampRef.current = 0;
      hoverBrakeRef.current = 0;
      currentYawTiltRef.current = 0;
      currentPitchTiltRef.current = 0;
      stageGroupRef.current?.quaternion.identity();
    }
  }, [resetTrigger, allowZoom, stageGroupRef]);

  useFrame(({ camera }, rawDelta) => {
    const stage = stageGroupRef.current;
    if (!stage) return;

    if (!showLiveCanvas) {
      stage.quaternion.identity();
      return;
    }

    const delta = Math.min(rawDelta, 0.035);

    if (isMorphingToBlueprint) {
      spinRampRef.current = 0;
      hoverBrakeRef.current = THREE.MathUtils.damp(hoverBrakeRef.current, 0, 4.0, delta);
      if (hoverBrakeRef.current > 0.0005) {
        baseYawRef.current -= delta * hoverBrakeRef.current;
      }

      currentYawTiltRef.current = THREE.MathUtils.damp(currentYawTiltRef.current, 0, 6.5, delta);
      currentPitchTiltRef.current = THREE.MathUtils.damp(currentPitchTiltRef.current, 0, 6.5, delta);
    } else {
      if (isRotating && isAnimating && !isPaused) {
        spinRampRef.current = Math.min(1, spinRampRef.current + delta / 1.2);
      } else {
        spinRampRef.current = 0;
      }

      const isHoverBraking =
        isRotating &&
        isAnimating &&
        !isPaused &&
        !isDragging &&
        !prefersReducedMotion &&
        pointerHoverRef.current.hovered;
      const hoverTarget = isHoverBraking ? 0.11 * spinRampRef.current : 0;
      hoverBrakeRef.current = THREE.MathUtils.damp(hoverBrakeRef.current, hoverTarget, 6.0, delta);

      if (hoverBrakeRef.current > 0.0005) {
        baseYawRef.current -= delta * hoverBrakeRef.current;
      }

      const tiltActive =
        showLiveCanvas &&
        !disableHoverTilt &&
        !isPaused &&
        !isDragging &&
        !prefersReducedMotion &&
        pointerHoverRef.current.hovered;
      const targetYawTilt = tiltActive ? pointerHoverRef.current.x * 0.095 : 0;
      const targetPitchTilt = tiltActive ? pointerHoverRef.current.y * 0.070 : 0;
      currentYawTiltRef.current = THREE.MathUtils.damp(currentYawTiltRef.current, targetYawTilt, 6.5, delta);
      currentPitchTiltRef.current = THREE.MathUtils.damp(currentPitchTiltRef.current, targetPitchTilt, 6.5, delta);
    }

    _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    _camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    _baseYawQuat.setFromAxisAngle(WORLD_UP, baseYawRef.current);
    _yawTiltQuat.setFromAxisAngle(_camUp, currentYawTiltRef.current);
    _pitchTiltQuat.setFromAxisAngle(_camRight, currentPitchTiltRef.current);

    stage.quaternion.copy(_yawTiltQuat).multiply(_pitchTiltQuat).multiply(_baseYawQuat);
  });

  return <group ref={stageGroupRef}>{children}</group>;
}

/**
 * Morphs cel-shaded materials in-place into unlit blueprint fills while
 * coasting rotation settles, and keeps frozen canvases synced on theme toggles.
 */
function CADBlueprintMorphController({
  isActiveAndSettled,
  isMorphingToBlueprint,
  isFrozenBlueprint,
  showLiveCanvas,
  isDark,
  isPaused,
  prefersReducedMotion,
  stageGroupRef,
  blueprintMixRef,
  cadEdgeRegistryRef,
  scrollExitRef,
  onBlueprintSettled,
}: {
  isActiveAndSettled: boolean;
  isMorphingToBlueprint: boolean;
  isFrozenBlueprint: boolean;
  showLiveCanvas: boolean;
  isDark: boolean;
  isPaused: boolean;
  prefersReducedMotion: boolean;
  stageGroupRef: React.MutableRefObject<THREE.Group | null>;
  blueprintMixRef: React.MutableRefObject<number>;
  cadEdgeRegistryRef: React.MutableRefObject<CADEdgeRegistry | null>;
  scrollExitRef?: React.MutableRefObject<ScrollExitState>;
  onBlueprintSettled: () => void;
}) {
  const { scene } = useThree();
  const store = useStore();
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;
  const isStaticCanvasRef = useRef(showLiveCanvas && (isFrozenBlueprint || isPaused));
  isStaticCanvasRef.current = showLiveCanvas && (isFrozenBlueprint || isPaused);
  const morphProgressRef = useRef(0);
  const exitElapsedRef = useRef(0);
  const settledFramesRef = useRef(0);
  const prevChildYawRef = useRef<number | null>(null);
  const originalColorsRef = useRef(new WeakMap<THREE.Material, THREE.Color>());
  const mutatedMaterialsRef = useRef(new Set<THREE.Material>());
  const onBlueprintSettledRef = useRef(onBlueprintSettled);
  onBlueprintSettledRef.current = onBlueprintSettled;

  const restoreMaterials = useCallback(() => {
    mutatedMaterialsRef.current.forEach((mat) => {
      const orig = originalColorsRef.current.get(mat);
      if (mat instanceof THREE.MeshToonMaterial) {
        if (orig) mat.color.copy(orig);
        mat.emissive.setRGB(0, 0, 0);
      } else if (mat instanceof THREE.MeshBasicMaterial) {
        if (orig) mat.color.copy(orig);
      }
    });
    mutatedMaterialsRef.current.clear();
  }, []);

  const applyMaterials = useCallback(
    (mix: number, dark: boolean) => {
      if (mix <= 0.0001) {
        restoreMaterials();
        return;
      }

      const bpFill = dark ? BLUEPRINT_FILL_DARK : BLUEPRINT_FILL_LIGHT;
      const bpLine = dark ? BLUEPRINT_LINE_DARK : BLUEPRINT_LINE_LIGHT;

      const applySingleMat = (mat: THREE.Material | null | undefined) => {
        if (!mat) return;
        if (mat instanceof THREE.MeshToonMaterial) {
          let orig = originalColorsRef.current.get(mat);
          if (!orig) {
            orig = mat.color.clone();
            originalColorsRef.current.set(mat, orig);
          }
          mutatedMaterialsRef.current.add(mat);
          mat.color.copy(orig).multiplyScalar(1 - mix);
          mat.emissive.copy(bpFill).multiplyScalar(mix);
        } else if (mat instanceof THREE.MeshBasicMaterial && !mat.polygonOffset) {
          let orig = originalColorsRef.current.get(mat);
          if (!orig) {
            orig = mat.color.clone();
            originalColorsRef.current.set(mat, orig);
          }
          mutatedMaterialsRef.current.add(mat);
          mat.color.copy(orig).lerp(bpLine, mix);
        }
      };

      scene.traverse((obj) => {
        if (obj.userData?.isCadEdgeQuad) return;
        if ((obj as THREE.Mesh).isMesh && !(obj as THREE.Line).isLine) {
          const mat = (obj as THREE.Mesh).material;
          if (Array.isArray(mat)) {
            for (let i = 0; i < mat.length; i++) {
              applySingleMat(mat[i]);
            }
          } else {
            applySingleMat(mat);
          }
        }
      });
    },
    [scene, restoreMaterials]
  );

  useEffect(() => {
    if (!isActiveAndSettled) {
      morphProgressRef.current = 0;
      blueprintMixRef.current = 0;
      exitElapsedRef.current = 0;
      settledFramesRef.current = 0;
      prevChildYawRef.current = null;
      restoreMaterials();
    }
  }, [isActiveAndSettled, blueprintMixRef, restoreMaterials]);

  useEffect(() => {
    return () => {
      restoreMaterials();
    };
  }, [restoreMaterials]);

  const repaintStaticFrame = useCallback(() => {
    const state = store.getState();
    if (state.size.width <= 0 || state.size.height <= 0) return;
    if (state.gl.getContext().isContextLost()) return;
    const mix = blueprintMixRef.current;
    if (mix > 0.001) {
      applyMaterials(mix, isDarkRef.current);
    }
    if (cadEdgeRegistryRef.current) {
      syncCADEdges(state.scene, state.gl, cadEdgeRegistryRef.current, mix, isDarkRef.current);
    }
    state.gl.render(state.scene, state.camera);
  }, [store, applyMaterials, blueprintMixRef, cadEdgeRegistryRef]);

  useLayoutEffect(() => {
    let prevWidth = store.getState().size.width;
    let prevHeight = store.getState().size.height;
    let prevDpr = store.getState().viewport.dpr;

    return store.subscribe((state) => {
      const { width, height } = state.size;
      const dpr = state.viewport.dpr;
      if (width === prevWidth && height === prevHeight && dpr === prevDpr) return;
      prevWidth = width;
      prevHeight = height;
      prevDpr = dpr;
      if (isStaticCanvasRef.current) {
        repaintStaticFrame();
      }
    });
  }, [store, repaintStaticFrame]);

  useLayoutEffect(() => {
    if (showLiveCanvas && (isFrozenBlueprint || isPaused)) {
      repaintStaticFrame();
    }
  }, [isDark, isFrozenBlueprint, isPaused, showLiveCanvas, repaintStaticFrame]);

  useFrame((_, rawDelta) => {
    if (!isActiveAndSettled || isFrozenBlueprint) return;

    const delta = Math.min(rawDelta, 0.035);

    if (isMorphingToBlueprint) {
      exitElapsedRef.current += delta;
      if (prefersReducedMotion) {
        morphProgressRef.current = 1;
      } else {
        const scrollHint = scrollExitRef?.current.scrollExit ?? 0;
        const rate = 1 / 0.30 + scrollHint * 2.2;
        morphProgressRef.current = Math.min(1, morphProgressRef.current + delta * rate);
      }
    } else {
      exitElapsedRef.current = 0;
      settledFramesRef.current = 0;
      prevChildYawRef.current = null;
      if (prefersReducedMotion) {
        morphProgressRef.current = 0;
      } else {
        morphProgressRef.current = Math.max(0, morphProgressRef.current - delta / 0.26);
      }
    }

    const p = morphProgressRef.current;
    const mix = p * p * (3 - 2 * p);
    blueprintMixRef.current = mix;
    applyMaterials(mix, isDark);

    if (isMorphingToBlueprint) {
      const childYaw = stageGroupRef.current?.children[0]?.rotation.y ?? 0;
      const yawSpeed =
        prevChildYawRef.current === null
          ? Infinity
          : Math.abs(childYaw - prevChildYawRef.current) / Math.max(delta, 0.001);
      prevChildYawRef.current = childYaw;

      const rotationSettled =
        prefersReducedMotion || yawSpeed < 0.02 || exitElapsedRef.current >= 0.45;

      if (mix >= 0.999 && rotationSettled) {
        settledFramesRef.current += 1;
        if (settledFramesRef.current === 2) {
          onBlueprintSettledRef.current();
        }
      } else {
        settledFramesRef.current = 0;
      }
    }
  });

  return null;
}

export interface ModelCanvasProps {
  modelType: string;
  isDark: boolean;
  allowZoom: boolean;
  isPaused?: boolean;
  isMobileMode: boolean;
  isTouchDevice: boolean;
  isMobileWidth: boolean;
  dynamicDpr: number;
  showLiveCanvas: boolean;
  isDrawingActiveReveal: boolean;
  isActiveAndSettled: boolean;
  isMorphingToBlueprint?: boolean;
  isFrozenBlueprint?: boolean;
  isHovered: boolean;
  isAnimationPlaying: boolean;
  isRotating: boolean;
  isDragging: boolean;
  disableHoverTilt: boolean;
  prefersReducedMotion: boolean;
  isAnimationsStarted: boolean;
  isThemeTransitioning: boolean;
  isPrewarmed: boolean;
  resetTrigger: number;
  pointerHoverRef: React.MutableRefObject<PointerHoverState>;
  scrollExitRef?: React.MutableRefObject<ScrollExitState>;
  onDrawn: () => void;
  onBlueprintSettled?: () => void;
  onCameraMove: (isMoved: boolean) => void;
  onResetComplete: () => void;
  onContextLost: () => void;
  onContextRestored: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export const ModelCanvas: React.FC<ModelCanvasProps> = ({
  modelType,
  isDark,
  allowZoom,
  isPaused = false,
  isMobileMode,
  isTouchDevice,
  isMobileWidth,
  dynamicDpr,
  showLiveCanvas,
  isDrawingActiveReveal,
  isActiveAndSettled,
  isMorphingToBlueprint = false,
  isFrozenBlueprint = false,
  isHovered,
  isAnimationPlaying,
  isRotating,
  isDragging,
  disableHoverTilt,
  prefersReducedMotion,
  isAnimationsStarted,
  isThemeTransitioning,
  isPrewarmed,
  resetTrigger,
  pointerHoverRef,
  scrollExitRef,
  onDrawn,
  onBlueprintSettled,
  onCameraMove,
  onResetComplete,
  onContextLost,
  onContextRestored,
  onDragStart,
  onDragEnd,
}) => {
  const stageGroupRef = useRef<THREE.Group | null>(null);
  const blueprintMixRef = useRef(0);
  const cadEdgeRegistryRef = useRef<CADEdgeRegistry | null>(null);

  return (
    <Canvas
      className={
        allowZoom
          ? 'grab-cursor'
          : isMobileMode
          ? 'cursor-pointer !touch-pan-y'
          : 'grab-cursor !touch-pan-y'
      }
      style={{ background: 'transparent' }}
      frameloop={
        !isPaused && (isDrawingActiveReveal || (showLiveCanvas && !isFrozenBlueprint))
          ? 'always'
          : 'never'
      }
      dpr={dynamicDpr}
      gl={{
        antialias: true,
        alpha: true,
        stencil: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        const canvas = gl.domElement;
        if (!canvas.dataset.contextListenersAttached) {
          canvas.dataset.contextListenersAttached = 'true';
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault();
            onContextLost();
          });
          canvas.addEventListener('webglcontextrestored', () => {
            onContextRestored();
          });
        }
      }}
    >
      <PerspectiveCamera
        makeDefault
        position={CAD_CAMERA_POSITION}
        fov={CAD_CAMERA_FOV}
        near={0.1}
        far={1000}
        onUpdate={(c) => c.lookAt(0, 0, 0)}
      />

      <CADStageLights isDark={isDark} />

      <Suspense fallback={null}>
        <ModelErrorBoundary>
          <InteractiveModelStage
            stageGroupRef={stageGroupRef}
            allowZoom={allowZoom}
            showLiveCanvas={showLiveCanvas}
            isActiveAndSettled={isActiveAndSettled}
            isMorphingToBlueprint={isMorphingToBlueprint}
            isRotating={isRotating}
            isAnimating={!isPaused && isAnimationPlaying && isAnimationsStarted && !isMorphingToBlueprint && !isThemeTransitioning}
            isDragging={isDragging}
            disableHoverTilt={disableHoverTilt}
            isPaused={isPaused}
            prefersReducedMotion={prefersReducedMotion}
            resetTrigger={resetTrigger}
            pointerHoverRef={pointerHoverRef}
          >
            <ModelRenderer
              modelType={modelType}
              isActive={isActiveAndSettled}
              isHovered={isHovered}
              isRotating={!isPaused && isRotating && !isThemeTransitioning}
              isAnimating={!isPaused && isAnimationPlaying && isAnimationsStarted && !isMorphingToBlueprint && !isThemeTransitioning}
            />
          </InteractiveModelStage>
        </ModelErrorBoundary>
        <CanvasDrawDetector
          active={isDrawingActiveReveal && !isPaused}
          targetFrames={isPrewarmed ? 1 : 2}
          onDrawn={onDrawn}
        />
      </Suspense>
      <CADBlueprintMorphController
        isActiveAndSettled={isActiveAndSettled}
        isMorphingToBlueprint={isMorphingToBlueprint}
        isFrozenBlueprint={isFrozenBlueprint}
        showLiveCanvas={showLiveCanvas}
        isDark={isDark}
        isPaused={isPaused}
        prefersReducedMotion={prefersReducedMotion}
        stageGroupRef={stageGroupRef}
        blueprintMixRef={blueprintMixRef}
        cadEdgeRegistryRef={cadEdgeRegistryRef}
        scrollExitRef={scrollExitRef}
        onBlueprintSettled={onBlueprintSettled ?? (() => {})}
      />
      <CADEdgeManager
        registryRef={cadEdgeRegistryRef}
        blueprintMixRef={blueprintMixRef}
        isDark={isDark}
      />
      <CameraResetController
        resetTrigger={resetTrigger}
        allowZoom={allowZoom}
        isDragging={isDragging}
        onResetComplete={onResetComplete}
      />
      <CameraStateDetector onCameraMove={onCameraMove} />
      <CameraPolarReturnController
        active={
          !allowZoom &&
          showLiveCanvas &&
          !isMorphingToBlueprint &&
          !isFrozenBlueprint &&
          !isPaused &&
          isAnimationPlaying &&
          isRotating &&
          !isDragging &&
          !isThemeTransitioning
        }
      />

      {(allowZoom || (!isTouchDevice && !isMobileWidth)) && (
        <OrbitControls
          target={[0, 0, 0]}
          enableZoom={allowZoom}
          enablePan={allowZoom}
          enableRotate={allowZoom || !isMorphingToBlueprint}
          autoRotate={false}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 1.05}
          dampingFactor={0.08}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
          onStart={onDragStart}
          onEnd={onDragEnd}
        />
      )}
    </Canvas>
  );
};
