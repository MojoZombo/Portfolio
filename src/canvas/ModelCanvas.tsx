import * as THREE from 'three';
import React, { Suspense, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { CAD_CAMERA_FOV, CAD_CAMERA_POSITION, CADStageLights } from './stageConfig';

// Ensure self-hosted Draco WASM decoder is configured before any model mounts
useGLTF.setDecoderPath('./draco/gltf/');

const DEFAULT_CAMERA_POS = new THREE.Vector3(...CAD_CAMERA_POSITION);

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
  isAnimationsStarted: boolean;
  isThemeTransitioning: boolean;
  isPrewarmed: boolean;
  resetTrigger: number;
  onDrawn: () => void;
  onCameraMove: (isMoved: boolean) => void;
  onContextLost: () => void;
  onContextRestored: () => void;
  onCanvasInteraction: () => void;
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
  isAnimationsStarted,
  isThemeTransitioning,
  isPrewarmed,
  resetTrigger,
  onDrawn,
  onCameraMove,
  onContextLost,
  onContextRestored,
  onCanvasInteraction,
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
      onWheel={onCanvasInteraction}
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
          <ModelRenderer
            modelType={modelType}
            isActive={isActiveAndSettled}
            isHovered={isHovered}
            isRotating={!isPaused && isAnimationPlaying && isRotating && isAnimationsStarted && !isThemeTransitioning}
            isAnimating={!isPaused && isAnimationPlaying && isAnimationsStarted && !isThemeTransitioning}
          />
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
          onStart={onCanvasInteraction}
        />
      )}
    </Canvas>
  );
};
