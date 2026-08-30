import * as THREE from 'three';
import React, { Suspense, useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { useTheme } from '../context/ThemeContext';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface ModelViewerProps {
  modelType: string;
  isActive?: boolean;
  isSettled?: boolean;
  isHovered?: boolean;
  className?: string;
  allowZoom?: boolean;
}

// Error Boundary for resilient 3D rendering
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

// Pre-warm detector: confirms WebGL has completed shader compilation, 
// OrbitControls has settled, and all useEffects have fired (wait 3 frames)
function CanvasWarmDetector({ onDrawn }: { onDrawn: () => void }) {
  const frameCount = useRef(0);
  useFrame(() => {
    frameCount.current++;
    if (frameCount.current === 1) {
      onDrawn();
    }
  });
  return null;
}

// Camera & Orbit Reset Controller
function CameraResetController({ resetTrigger }: { resetTrigger: number }) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls as any);

  useEffect(() => {
    if (resetTrigger > 0) {
      camera.position.set(4.6, 3.2, 5.0);
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

// Camera State & Zoom Detector
function CameraStateDetector({
  onZoomChange,
}: {
  onZoomChange: (isZoomed: boolean) => void;
}) {
  const { camera } = useThree();
  const defaultDist = Math.sqrt(4.6 * 4.6 + 3.2 * 3.2 + 5.0 * 5.0); // ~7.51
  const isZoomedRef = useRef(false);

  useFrame(() => {
    const dist = camera.position.length();
    // Detect if user has zoomed in or moved camera away from default distance
    const isZoomed = dist < defaultDist - 0.35 || Math.abs(dist - defaultDist) > 0.5;
    if (isZoomed !== isZoomedRef.current) {
      isZoomedRef.current = isZoomed;
      onZoomChange(isZoomed);
    }
  });

  return null;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelType,
  isActive = false,
  isSettled = true,
  isHovered = false,
  className = 'h-[340px] sm:h-[480px] md:h-[560px] w-full',
  allowZoom = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isRotating, setIsRotating] = useState(true);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [shouldMountWebGL, setShouldMountWebGL] = useState(false);
  const [isFadeComplete, setIsFadeComplete] = useState(false);
  const [isWindowScrolling, setIsWindowScrolling] = useState(false);

  // Track window scrolling activity to guarantee 0 WebGL mount overhead while scrolling
  useEffect(() => {
    let scrollTimer: ReturnType<typeof setTimeout>;
    const handleWindowScroll = () => {
      setIsWindowScrolling(true);
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        setIsWindowScrolling(false);
      }, 120);
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      clearTimeout(scrollTimer);
    };
  }, []);

  // Mount WebGL ONLY when slide animation is finished AND user has paused scrolling
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (allowZoom) {
      // In ProjectModal, wait 250ms for modal scale-in animation to finish
      timer = setTimeout(() => {
        setShouldMountWebGL(true);
      }, 250);
    } else if (isActive && isSettled && !isWindowScrolling) {
      // Mount WebGL strictly after onAnimationComplete has fired and scroll is settled!
      timer = setTimeout(() => {
        setShouldMountWebGL(true);
      }, 60); 
    } else if (!isActive) {
      // Fast unmount when scrolling away
      timer = setTimeout(() => {
        setShouldMountWebGL(false);
        setIsCanvasReady(false);
        setIsFadeComplete(false);
      }, 150);
    }
    return () => clearTimeout(timer);
  }, [isActive, isSettled, isWindowScrolling, allowZoom]);

  // Duration for transitions: fast elegant fade in
  const fadeDuration = isActive || allowZoom ? 'duration-300' : 'duration-150';

  const showLiveCanvas = (isActive || allowZoom) && isCanvasReady;
  
  // Keep the shaded static image perfectly solid underneath WebGL while it fades in.
  // This eliminates the 'crossfade dip' where both layers would hit 50% opacity and look dark.
  // It only fades out AFTER the WebGL is 100% solid (isFadeComplete).
  // Or immediately when isActive becomes false (so it fades to blueprint).
  const showShadedStatic = (isActive || allowZoom) && !isFadeComplete;

  // Track fade completion to sync animations (350ms gives full 300ms CSS transition + 50ms visual settle buffer)
  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout>;
    if (showLiveCanvas) {
      fadeTimer = setTimeout(() => setIsFadeComplete(true), 350);
    } else {
      setIsFadeComplete(false);
    }
    return () => clearTimeout(fadeTimer);
  }, [showLiveCanvas]);

  // Image Paths (theme-specific with fallback)
  const themeSuffix = isDark ? 'dark' : 'light';
  const [bpFallback, setBpFallback] = useState(false);
  const [shadedFallback, setShadedFallback] = useState(false);

  const bpPosterPath = bpFallback
    ? `./posters/${modelType}-blueprint.png`
    : `./posters/${modelType}-blueprint-${themeSuffix}.png`;

  const shadedPosterPath = shadedFallback
    ? `./posters/${modelType}-shaded.png`
    : `./posters/${modelType}-shaded-${themeSuffix}.png`;

  const handleCanvasInteraction = () => {
    if (allowZoom) {
      setIsRotating(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ touchAction: allowZoom ? 'none' : 'pan-y' }}
      className={`relative ${className} select-none pointer-events-auto flex items-center justify-center overflow-visible`}
    >
      {/* 1. LAYER 0: BLUEPRINT (Visible when Inactive) */}
      <img
        src={bpPosterPath}
        alt={`${modelType} blueprint`}
        onError={() => setBpFallback(true)}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0 transition-opacity ${fadeDuration} ease-in-out ${
          isActive || allowZoom ? 'opacity-0' : 'opacity-100'
        }`}
        loading="lazy"
        decoding="async"
      />

      {/* 2. LAYER 1: SHADED STATIC (Instant Solid Underlay, vanishes instantly once WebGL is 100% settled) */}
      <img
        src={shadedPosterPath}
        alt={`${modelType} shaded`}
        onError={() => setShadedFallback(true)}
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-10 ${
          isFadeComplete
            ? 'opacity-0 transition-opacity duration-200 ease-out'
            : `transition-opacity ${fadeDuration} ease-in-out ${showShadedStatic ? 'opacity-100' : 'opacity-0'}`
        }`}
        loading="lazy"
        decoding="async"
      />

      {/* 3. LAYER 2: LIVE WEBGL CANVAS (Mounts delayed, fades in when ready) */}
      {shouldMountWebGL && (
        <div
          className={`absolute inset-0 w-full h-full z-20 transition-opacity ${fadeDuration} ease-in-out ${
            showLiveCanvas ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Canvas
            className="grab-cursor"
            frameloop={isActive || allowZoom || isHovered ? 'always' : 'demand'}
            dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1]}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
              preserveDrawingBuffer: true,
            }}
            onWheel={handleCanvasInteraction}
          >
            <PerspectiveCamera
              makeDefault
              position={[4.6, 3.2, 5.0]}
              fov={34}
              near={0.1}
              far={1000}
            />

            <ambientLight intensity={isDark ? (isActive ? 0.95 : 0.85) : (isActive ? 1.05 : 0.95)} />
            <directionalLight position={[6, 8, 5]} intensity={isActive ? 1.5 : 1.2} castShadow />
            <directionalLight position={[-6, -3, -5]} intensity={0.4} />

            <Suspense fallback={null}>
              <ModelErrorBoundary>
                <ModelRenderer
                  modelType={modelType}
                  isActive={isActive}
                  isHovered={isHovered}
                  isRotating={isAnimationPlaying && isRotating && isFadeComplete}
                  isAnimating={isAnimationPlaying && isFadeComplete}
                />
              </ModelErrorBoundary>
              <CanvasWarmDetector onDrawn={() => setIsCanvasReady(true)} />
            </Suspense>
            <CameraResetController resetTrigger={resetTrigger} />
            <CameraStateDetector onZoomChange={setIsZoomedIn} />

            <OrbitControls
              target={[0, 0, 0]}
              enableZoom={allowZoom}
              enablePan={allowZoom}
              autoRotate={false}
              minPolarAngle={Math.PI / 6}
              maxPolarAngle={Math.PI / 1.8}
              dampingFactor={0.08}
              touches={{
                ONE: THREE.TOUCH.ROTATE,
                TWO: allowZoom ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_PAN,
              }}
              onStart={handleCanvasInteraction}
            />
          </Canvas>
        </div>
      )}

      {/* Interactive Controls in Corner */}
      {allowZoom && (
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-30 flex items-center gap-2 pointer-events-auto select-none">
          {/* Pause / Play Animation Button */}
          <button
            type="button"
            onClick={() => {
              const next = !isAnimationPlaying;
              setIsAnimationPlaying(next);
              setIsRotating(next);
            }}
            className="px-3 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700/60 backdrop-blur-sm transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono font-medium"
            title={isAnimationPlaying ? 'Pause 3D animation and rotation' : 'Play 3D animation and rotation'}
          >
            {isAnimationPlaying ? (
              <Pause size={12} className="text-blue-600 dark:text-blue-400" />
            ) : (
              <Play size={12} className="text-amber-600 dark:text-amber-400" />
            )}
            <span>{isAnimationPlaying ? 'Pause' : 'Play'}</span>
          </button>

          {/* Reset Model / Camera View Button (Only appears if user has zoomed in / moved camera) */}
          {isZoomedIn && (
            <button
              type="button"
              onClick={() => {
                setResetTrigger((prev) => prev + 1);
                setIsZoomedIn(false);
                setIsAnimationPlaying(true);
                setIsRotating(true);
              }}
              className="px-3 py-1.5 rounded bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-900/90 dark:hover:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700/60 backdrop-blur-sm transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono font-medium"
              title="Reset 3D model zoom and position"
            >
              <RotateCcw size={12} className="text-blue-600 dark:text-blue-400" />
              <span>Reset View</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
