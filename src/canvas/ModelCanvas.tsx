import * as THREE from 'three';
import React, { Suspense, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
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
  const rVelRef = useRef(0);
  const phiVelRef = useRef(0);
  const thetaVelRef = useRef(0);
  const targetVelRef = useRef(new THREE.Vector3());
  const offsetRef = useRef(new THREE.Vector3());
  const sphericalRef = useRef(new THREE.Spherical());
  const targetErrRef = useRef(new THREE.Vector3());

  useEffect(() => {
    if (resetTrigger <= 0) return;

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
      onResetComplete();
      return;
    }

    rVelRef.current = 0;
    phiVelRef.current = 0;
    thetaVelRef.current = 0;
    targetVelRef.current.set(0, 0, 0);
    isResettingRef.current = true;
  }, [resetTrigger, allowZoom, camera, controls, onResetComplete]);

  useEffect(() => {
    if (isDragging && isResettingRef.current) {
      isResettingRef.current = false;
      onResetComplete();
    }
  }, [isDragging, onResetComplete]);

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
      onResetComplete();
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
  allowZoom: boolean;
  showLiveCanvas: boolean;
  isActiveAndSettled: boolean;
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
 * Adds stage-level gentle hover spin braking and camera-aligned pointer parallax
 * tilt without modifying individual model files.
 */
function InteractiveModelStage({
  allowZoom,
  showLiveCanvas,
  isActiveAndSettled,
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
  const stageRef = useRef<THREE.Group>(null);
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
      stageRef.current?.quaternion.identity();
    }
  }, [isActiveAndSettled]);

  useEffect(() => {
    if (resetTrigger > 0 && !allowZoom) {
      baseYawRef.current = 0;
      currentYawTiltRef.current = 0;
      currentPitchTiltRef.current = 0;
      stageRef.current?.quaternion.identity();
    }
  }, [resetTrigger, allowZoom]);

  useFrame(({ camera }, rawDelta) => {
    const stage = stageRef.current;
    if (!stage) return;

    if (!showLiveCanvas) {
      stage.quaternion.identity();
      return;
    }

    const delta = Math.min(rawDelta, 0.035);

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
    const targetBrake = isHoverBraking ? 0.11 * spinRampRef.current : 0;
    hoverBrakeRef.current = THREE.MathUtils.damp(hoverBrakeRef.current, targetBrake, 5.0, delta);
    baseYawRef.current -= delta * hoverBrakeRef.current;

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
  disableHoverTilt: boolean;
  prefersReducedMotion: boolean;
  isAnimationsStarted: boolean;
  isThemeTransitioning: boolean;
  isPrewarmed: boolean;
  resetTrigger: number;
  pointerHoverRef: React.MutableRefObject<PointerHoverState>;
  onDrawn: () => void;
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
  onDrawn,
  onCameraMove,
  onResetComplete,
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
            allowZoom={allowZoom}
            showLiveCanvas={showLiveCanvas}
            isActiveAndSettled={isActiveAndSettled}
            isRotating={isRotating}
            isAnimating={!isPaused && isAnimationPlaying && isAnimationsStarted && !isThemeTransitioning}
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
