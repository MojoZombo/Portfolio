import * as THREE from 'three';
import React, { Suspense, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { CAD_CAMERA_FOV, CAD_CAMERA_POSITION, CADStageLights } from './stageConfig';

// Ensure self-hosted Draco WASM decoder is configured before any model mounts
useGLTF.setDecoderPath('./draco/gltf/');

const DEFAULT_CAMERA_POS = new THREE.Vector3(...CAD_CAMERA_POSITION);

export interface PointerHoverState {
  hovered: boolean;
  x: number;
  y: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _camRight = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _baseYawQuat = new THREE.Quaternion();
const _yawTiltQuat = new THREE.Quaternion();
const _pitchTiltQuat = new THREE.Quaternion();

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

function CameraResetController({ resetTrigger }: { resetTrigger: number }) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls as any);

  useEffect(() => {
    if (resetTrigger > 0) {
      camera.position.copy(DEFAULT_CAMERA_POS);
      camera.lookAt(0, 0, 0);
      if (controls) {
        controls.target.set(0, 0, 0);
        if (controls.reset) {
          controls.reset();
        }
        controls.update();
      }
    }
  }, [resetTrigger, camera, controls]);

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

interface InteractiveModelStageProps {
  showLiveCanvas: boolean;
  isActiveAndSettled: boolean;
  isRotating: boolean;
  isAnimating: boolean;
  isDragging: boolean;
  isPaused: boolean;
  prefersReducedMotion: boolean;
  resetTrigger: number;
  pointerHoverRef: React.MutableRefObject<PointerHoverState>;
  children: ReactNode;
}

/**
 * Adds stage-level activation turntable nudge, gentle hover spin braking, and
 * camera-aligned pointer parallax tilt without modifying individual model files.
 */
function InteractiveModelStage({
  showLiveCanvas,
  isActiveAndSettled,
  isRotating,
  isAnimating,
  isDragging,
  isPaused,
  prefersReducedMotion,
  resetTrigger,
  pointerHoverRef,
  children,
}: InteractiveModelStageProps) {
  const stageRef = useRef<THREE.Group>(null);
  const baseYawRef = useRef(0);
  const nudgeTimeRef = useRef(0);
  const nudgeActiveRef = useRef(false);
  const hasTriggeredNudgeRef = useRef(false);
  const spinRampRef = useRef(0);
  const hoverBrakeRef = useRef(0);
  const currentYawTiltRef = useRef(0);
  const currentPitchTiltRef = useRef(0);

  useEffect(() => {
    if (!isActiveAndSettled) {
      baseYawRef.current = 0;
      nudgeTimeRef.current = 0;
      nudgeActiveRef.current = false;
      hasTriggeredNudgeRef.current = false;
      spinRampRef.current = 0;
      hoverBrakeRef.current = 0;
      currentYawTiltRef.current = 0;
      currentPitchTiltRef.current = 0;
      stageRef.current?.quaternion.identity();
    }
  }, [isActiveAndSettled]);

  useEffect(() => {
    if (resetTrigger > 0) {
      baseYawRef.current = 0;
      nudgeTimeRef.current = 0;
      nudgeActiveRef.current = false;
      currentYawTiltRef.current = 0;
      currentPitchTiltRef.current = 0;
      stageRef.current?.quaternion.identity();
    }
  }, [resetTrigger]);

  useFrame(({ camera }, rawDelta) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (!showLiveCanvas) {
      stage.quaternion.identity();
      return;
    }

    const delta = Math.min(rawDelta, 0.035);

    if (!hasTriggeredNudgeRef.current) {
      hasTriggeredNudgeRef.current = true;
      if (!prefersReducedMotion && !isPaused && isAnimating) {
        nudgeActiveRef.current = true;
        nudgeTimeRef.current = 0;
      }
    }

    if (isDragging || !isAnimating || isPaused) {
      nudgeActiveRef.current = false;
    }

    if (nudgeActiveRef.current) {
      nudgeTimeRef.current += delta;
      const t = nudgeTimeRef.current;
      const tau = 0.22;
      const omega = 0.50 * (t / tau) * Math.exp(1 - t / tau);
      baseYawRef.current += delta * omega;
      if (t > 1.8) {
        nudgeActiveRef.current = false;
      }
    }

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
      !nudgeActiveRef.current &&
      pointerHoverRef.current.hovered;
    const targetBrake = isHoverBraking ? 0.11 * spinRampRef.current : 0;
    hoverBrakeRef.current = THREE.MathUtils.damp(hoverBrakeRef.current, targetBrake, 5.0, delta);
    baseYawRef.current -= delta * hoverBrakeRef.current;

    const tiltActive =
      showLiveCanvas &&
      !isPaused &&
      !isDragging &&
      !prefersReducedMotion &&
      pointerHoverRef.current.hovered;
    const targetYawTilt = tiltActive ? pointerHoverRef.current.x * 0.095 : 0;
    const targetPitchTilt = tiltActive ? pointerHoverRef.current.y * 0.070 : 0;
    currentYawTiltRef.current = THREE.MathUtils.damp(currentYawTiltRef.current, targetYawTilt, 6.5, delta);
    currentPitchTiltRef.current = THREE.MathUtils.damp(currentPitchTiltRef.current, targetPitchTilt, 6.5, delta);

    _camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    _camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    _baseYawQuat.setFromAxisAngle(WORLD_UP, baseYawRef.current);
    _yawTiltQuat.setFromAxisAngle(_camUp, currentYawTiltRef.current);
    _pitchTiltQuat.setFromAxisAngle(_camRight, currentPitchTiltRef.current);

    stage.quaternion.copy(_yawTiltQuat).multiply(_pitchTiltQuat).multiply(_baseYawQuat);
  });

  return <group ref={stageRef}>{children}</group>;
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
  isHovered: boolean;
  isAnimationPlaying: boolean;
  isRotating: boolean;
  isDragging: boolean;
  prefersReducedMotion: boolean;
  isAnimationsStarted: boolean;
  isThemeTransitioning: boolean;
  isPrewarmed: boolean;
  resetTrigger: number;
  pointerHoverRef: React.MutableRefObject<PointerHoverState>;
  onDrawn: () => void;
  onCameraMove: (isMoved: boolean) => void;
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
  isHovered,
  isAnimationPlaying,
  isRotating,
  isDragging,
  prefersReducedMotion,
  isAnimationsStarted,
  isThemeTransitioning,
  isPrewarmed,
  resetTrigger,
  pointerHoverRef,
  onDrawn,
  onCameraMove,
  onContextLost,
  onContextRestored,
  onDragStart,
  onDragEnd,
}) => {
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
      frameloop={!isPaused && (showLiveCanvas || isDrawingActiveReveal) ? 'always' : 'never'}
      dpr={dynamicDpr}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
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
            showLiveCanvas={showLiveCanvas}
            isActiveAndSettled={isActiveAndSettled}
            isRotating={isRotating}
            isAnimating={!isPaused && isAnimationPlaying && isAnimationsStarted && !isThemeTransitioning}
            isDragging={isDragging}
            isPaused={isPaused}
            prefersReducedMotion={prefersReducedMotion}
            resetTrigger={resetTrigger}
            pointerHoverRef={pointerHoverRef}
          >
            <ModelRenderer
              modelType={modelType}
              isActive={isActiveAndSettled}
              isHovered={isHovered}
              isRotating={!isPaused && isAnimationPlaying && isRotating && isAnimationsStarted && !isThemeTransitioning}
              isAnimating={!isPaused && isAnimationPlaying && isAnimationsStarted && !isThemeTransitioning}
            />
          </InteractiveModelStage>
        </ModelErrorBoundary>
        <CanvasDrawDetector
          active={isDrawingActiveReveal && !isPaused}
          targetFrames={isPrewarmed ? 1 : 2}
          onDrawn={onDrawn}
        />
      </Suspense>
      <CameraResetController resetTrigger={resetTrigger} />
      <CameraStateDetector onCameraMove={onCameraMove} />

      {(allowZoom || (!isTouchDevice && !isMobileWidth)) && (
        <OrbitControls
          target={[0, 0, 0]}
          enableZoom={allowZoom}
          enablePan={allowZoom}
          enableRotate={true}
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
