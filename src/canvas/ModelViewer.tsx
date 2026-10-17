import * as THREE from 'three';
import React, { Suspense, useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { POSTER_VERSION, preloadModelAssets } from './ModelPreloadManager';
import { useTheme } from '../context/ThemeContext';
import { Pause, Play, RotateCcw } from 'lucide-react';

interface ModelViewerProps {
  modelType: string;
  isActive?: boolean;
  isNearby?: boolean;
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

// Frame-accurate draw detector: confirms WebGL has drawn targetFrames in the active or warm-up loop
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
  isNearby = false,
  isSettled = true,
  isHovered = false,
  className = 'h-[340px] sm:h-[480px] md:h-[560px] w-full',
  allowZoom = false,
}) => {
  const { theme, isThemeTransitioning } = useTheme();
  const isDark = theme === 'dark';
  const [isRotating, setIsRotating] = useState(true);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [isPrewarmed, setIsPrewarmed] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [shouldMountWebGL, setShouldMountWebGL] = useState(false);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
      setIsTouchDevice(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  const [isMobileWidth, setIsMobileWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const handleResize = () => {
      setIsMobileWidth(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobileMode = !allowZoom && (isTouchDevice || isMobileWidth);

  // Dynamically scale DPR inversely to container height so 1px WebGL line thickness
  // mathematically matches the scaled 784px static poster PNG on all devices and screen resolutions.
  // Lock the canvas frame buffer height to 784px: DPR = 784 / height (clamped safely between 1.0 and 3.0).
  const [dynamicDpr, setDynamicDpr] = useState<number>(() => {
    if (typeof window === 'undefined') return 1.6;
    const isMobile = window.innerWidth < 768;
    const h = isMobile ? (window.innerWidth < 480 ? 270 : 310) : 490;
    return Math.min(3.0, Math.max(1.0, +(784 / h).toFixed(2)));
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
          const calculated = Math.min(3.0, Math.max(1.0, +(784 / height).toFixed(2)));
          setDynamicDpr((prev) => (Math.abs(prev - calculated) > 0.05 ? calculated : prev));
        }
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Handle reload/navigation: cleanly hide 3D canvas before WebGL context is destroyed to prevent white flash
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (containerRef.current) {
        containerRef.current.style.opacity = '0';
      }
    };
    const handleRestore = () => {
      if (containerRef.current) {
        containerRef.current.style.opacity = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pageshow', handleRestore);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        handleRestore();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pageshow', handleRestore);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Ensure assets are high-priority preloaded whenever active, nearby, or opened in modal
  useEffect(() => {
    if (isActive || isNearby || allowZoom) {
      preloadModelAssets(modelType, isDark, 'high');
    }
  }, [isActive, isNearby, allowZoom, modelType, isDark]);

  // Re-warm dormant pre-mounted canvases if theme changes while inactive
  useEffect(() => {
    if (!isActive && !allowZoom && shouldMountWebGL) {
      setIsPrewarmed(false);
      setIsCanvasReady(false);
    }
  }, [isDark, isActive, allowZoom, shouldMountWebGL]);

  // Manage WebGL mounting:
  // - Only mount WebGL when the card is active and settled (or in allowZoom modal view)
  // - Keeps previously mounted cards resident while nearby with frameloop="never" (0% CPU, instant scroll-back)
  // - Unmounts WebGL cleanly when card moves far outside proximity ring to free GPU memory
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (allowZoom) {
      timer = setTimeout(() => {
        setShouldMountWebGL(true);
      }, 180);
    } else if (isActive) {
      if (isSettled) {
        setShouldMountWebGL(true);
      }
    } else if (!isNearby) {
      // Card left proximity ring: unmount WebGL far off-screen
      timer = setTimeout(() => {
        setShouldMountWebGL(false);
        setIsPrewarmed(false);
        setIsCanvasReady(false);
      }, 420);
    }
    return () => clearTimeout(timer);
  }, [isActive, isNearby, isSettled, allowZoom]);

  // Reset active reveal state, camera view, zoom status, and controls ONLY when model becomes inactive
  useEffect(() => {
    if (!isActive && !allowZoom) {
      setIsCanvasReady(false);
      setResetTrigger((prev) => prev + 1);
      setIsRotating(true);
      setIsAnimationPlaying(true);
      setIsZoomedIn(false);
    }
  }, [isActive, allowZoom]);

  const isActiveAndSettled = allowZoom || (isActive && isSettled);
  const isDrawingActiveReveal = shouldMountWebGL && isActiveAndSettled && !isCanvasReady;
  const showLiveCanvas = isActiveAndSettled && isCanvasReady;
  const isAnimationsStarted = showLiveCanvas;

  // Image Paths (theme-specific with fallback)
  const themeSuffix = isDark ? 'dark' : 'light';
  const [bpFallback, setBpFallback] = useState(false);
  const [shadedFallback, setShadedFallback] = useState(false);

  const bpPosterPath = `${
    bpFallback
      ? `./posters/${modelType}-blueprint.png`
      : `./posters/${modelType}-blueprint-${themeSuffix}.png`
  }?v=${POSTER_VERSION}`;

  const shadedPosterPath = `${
    shadedFallback
      ? `./posters/${modelType}-shaded.png`
      : `./posters/${modelType}-shaded-${themeSuffix}.png`
  }?v=${POSTER_VERSION}`;

  const handleCanvasInteraction = () => {
    if (allowZoom) {
      setIsRotating(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ touchAction: allowZoom ? 'none' : 'pan-y' }}
      className={`relative ${className} select-none pointer-events-auto flex items-center justify-center overflow-hidden`}
    >
      {/* 1. LAYER 0: BLUEPRINT (Visible when Inactive) */}
      <img
        src={bpPosterPath}
        alt={`${modelType} blueprint`}
        onError={() => setBpFallback(true)}
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none pointer-events-none select-none z-0 transition-opacity duration-150 ease-in-out ${
          isActive || allowZoom ? 'opacity-0' : 'opacity-100'
        }`}
        loading={isActive ? 'eager' : 'lazy'}
        decoding="async"
      />

      {/* 2. LAYER 1: SHADED STATIC (Instant Solid Underlay, cuts to 3D canvas once WebGL is ready) */}
      <img
        src={shadedPosterPath}
        alt={`${modelType} shaded`}
        onError={() => setShadedFallback(true)}
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none pointer-events-none select-none z-10 ${
          showLiveCanvas
            ? 'opacity-0 pointer-events-none'
            : isActive || allowZoom
            ? 'opacity-100'
            : 'opacity-0 transition-opacity duration-150 ease-in-out'
        }`}
        loading={isActive || allowZoom ? 'eager' : 'lazy'}
        // Lowercase attribute passes straight through to the DOM in React 18 (LCP hint)
        {...({ fetchpriority: isActive ? 'high' : 'auto' } as Record<string, string>)}
        decoding="async"
      />

      {/* 3. LAYER 2: LIVE WEBGL CANVAS (Instant cut at rest pose, then animates with zero ghosting) */}
      {shouldMountWebGL && (
        <div
          className={`absolute inset-0 w-full h-full z-20 ${
            showLiveCanvas ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <Canvas
            className={
              allowZoom
                ? "grab-cursor"
                : isMobileMode
                ? "cursor-pointer !touch-pan-y"
                : "grab-cursor !touch-pan-y"
            }
            style={{ background: 'transparent' }}
            frameloop={showLiveCanvas || isDrawingActiveReveal ? 'always' : 'never'}
            dpr={dynamicDpr}
            gl={{
              antialias: true,
              alpha: true,
              powerPreference: 'high-performance',
              preserveDrawingBuffer: false,
            }}
            onCreated={({ gl }) => {
              gl.setClearColor(0x000000, 0);
              gl.domElement.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                setShouldMountWebGL(false);
                setIsCanvasReady(false);
              });
            }}
            onWheel={handleCanvasInteraction}
          >
            <PerspectiveCamera
              makeDefault
              position={[4.6, 3.2, 5.0]}
              fov={34}
              near={0.1}
              far={1000}
              onUpdate={(c) => c.lookAt(0, 0, 0)}
            />

            <ambientLight intensity={isDark ? 0.95 : 1.05} />
            <directionalLight position={[6, 8, 5]} intensity={1.5} castShadow={!isMobileMode} />
            <directionalLight position={[-6, -3, -5]} intensity={0.4} />

            <Suspense fallback={null}>
              <ModelErrorBoundary>
                <ModelRenderer
                  modelType={modelType}
                  isActive={isActiveAndSettled}
                  isHovered={isHovered}
                  isRotating={isAnimationPlaying && isRotating && isAnimationsStarted && !isThemeTransitioning}
                  isAnimating={isAnimationPlaying && isAnimationsStarted && !isThemeTransitioning}
                />
              </ModelErrorBoundary>
              <CanvasDrawDetector
                active={isDrawingActiveReveal}
                targetFrames={isPrewarmed ? 1 : 2}
                onDrawn={() => {
                  setIsCanvasReady(true);
                  setIsPrewarmed(true);
                }}
              />
            </Suspense>
            <CameraResetController resetTrigger={resetTrigger} />
            <CameraStateDetector onZoomChange={setIsZoomedIn} />

            {/* OrbitControls intercepts native touchstart events via addEventListener, which hijacks scrolling.
                To completely fix mobile scrolling, we conditionally unmount OrbitControls when on the main page (allowZoom=false) on touch devices or mobile viewports! */}
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
                onStart={handleCanvasInteraction}
              />
            )}
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
            className="btn-ripple group px-3 py-1.5 rounded bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200 backdrop-blur-sm cursor-pointer flex items-center justify-center gap-1.5 text-xs font-mono font-medium w-[80px] shrink-0 select-none"
            title={isAnimationPlaying ? 'Pause 3D animation and rotation' : 'Play 3D animation and rotation'}
          >
            <span className="w-3.5 flex items-center justify-center shrink-0">
              {isAnimationPlaying ? (
                <Pause size={12} className="text-blue-600 dark:text-blue-400" />
              ) : (
                <Play size={12} className="text-amber-600 dark:text-amber-400" />
              )}
            </span>
            <span className="w-[36px] text-left shrink-0">
              {isAnimationPlaying ? 'Pause' : 'Play'}
            </span>
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
              className="btn-ripple group px-3 py-1.5 rounded bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200 backdrop-blur-sm cursor-pointer flex items-center gap-1.5 text-xs font-mono font-medium"
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
