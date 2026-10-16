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

// Pre-warm detector: confirms WebGL has completed shader compilation,
// OrbitControls has settled, and all useEffects have fired in shaded rest pose
function CanvasWarmDetector({
  active,
  isResetting,
  onResetComplete,
  onDrawn,
}: {
  active: boolean;
  isResetting: boolean;
  onResetComplete: () => void;
  onDrawn: () => void;
}) {
  const frameCount = useRef(0);

  useEffect(() => {
    if (!active || isResetting) {
      frameCount.current = 0;
    }
  }, [active, isResetting]);

  useFrame(() => {
    if (!active) {
      frameCount.current = 0;
      return;
    }
    if (isResetting) {
      frameCount.current = 0;
      onResetComplete();
      return;
    }
    frameCount.current++;
    if (frameCount.current === 2) {
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
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isRotating, setIsRotating] = useState(true);
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isResettingModel, setIsResettingModel] = useState(false);
  const needsPoseResetRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [shouldMountWebGL, setShouldMountWebGL] = useState(false);
  const [isAnimationsStarted, setIsAnimationsStarted] = useState(false);
  const [isFadeComplete, setIsFadeComplete] = useState(false);
  const [isFastScrolling, setIsFastScrolling] = useState(false);
  const [isScrollIdle, setIsScrollIdle] = useState(true);

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

  // Velocity-aware scroll tracking + scroll-idle detector (420ms quiet window so background pre-mounts never overlap slides)
  useEffect(() => {
    if (allowZoom) return;
    let fastScrollTimer: ReturnType<typeof setTimeout>;
    let idleScrollTimer: ReturnType<typeof setTimeout>;
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    let lastScrollTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    const handleWindowScroll = () => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const currentY = window.scrollY;
      const dt = Math.max(1, now - lastScrollTime);
      const velocity = Math.abs(currentY - lastScrollY) / dt;
      lastScrollY = currentY;
      lastScrollTime = now;

      setIsScrollIdle(false);
      clearTimeout(idleScrollTimer);
      idleScrollTimer = setTimeout(() => {
        setIsScrollIdle(true);
      }, 420);

      if (velocity > 1.8) {
        setIsFastScrolling(true);
        clearTimeout(fastScrollTimer);
        fastScrollTimer = setTimeout(() => {
          setIsFastScrolling(false);
        }, 65);
      }
    };

    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
      clearTimeout(fastScrollTimer);
      clearTimeout(idleScrollTimer);
    };
  }, [allowZoom]);

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
      setIsCanvasReady(false);
    }
  }, [isDark, isActive, allowZoom, shouldMountWebGL]);

  // Manage WebGL mounting, background proximity pre-warming, and post-exit pose reset
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (allowZoom) {
      timer = setTimeout(() => {
        setShouldMountWebGL(true);
      }, 180);
    } else if (isActive) {
      if (needsPoseResetRef.current) {
        // User scrolled away and came right back before background reset completed
        setIsCanvasReady(false);
        setIsResettingModel(true);
      }
      if (isSettled && !isFastScrolling) {
        setShouldMountWebGL(true);
      }
    } else {
      // Card is inactive: immediately stop animations and hide live canvas
      setIsAnimationsStarted(false);
      setIsFadeComplete(false);
      if (needsPoseResetRef.current) {
        setIsCanvasReady(false);
        setIsResettingModel(true);
      }

      if (isNearby) {
        // Mount in background once scroll has been idle for 420ms (after active card's 380ms slide finishes)
        if (isScrollIdle && !isFastScrolling) {
          setShouldMountWebGL(true);
        }
      } else {
        // Card left proximity ring: unmount WebGL after exit slide completes
        timer = setTimeout(() => {
          setShouldMountWebGL(false);
          setIsCanvasReady(false);
          setIsResettingModel(false);
          needsPoseResetRef.current = false;
        }, 420);
      }
    }
    return () => clearTimeout(timer);
  }, [isActive, isNearby, isSettled, isScrollIdle, isFastScrolling, allowZoom]);

  // Reset camera view, zoom status, and controls whenever model becomes inactive
  useEffect(() => {
    if (!isActive && !allowZoom) {
      setResetTrigger((prev) => prev + 1);
      setIsRotating(true);
      setIsAnimationPlaying(true);
      setIsZoomedIn(false);
    }
  }, [isActive, allowZoom]);

  // Duration for transitions: crisp 75ms handoff once WebGL rest-pose frame is warm
  const fadeDuration = isActive || allowZoom ? 'duration-75' : 'duration-150';

  const isActiveAndSettled = allowZoom || (isActive && isSettled);
  const canWarmInBackground = !isActive && isNearby && isScrollIdle && !isFastScrolling;
  const shouldRunWarmLoop = shouldMountWebGL && !isCanvasReady && (isActiveAndSettled || canWarmInBackground);
  const showLiveCanvas = isActiveAndSettled && isCanvasReady;

  // Keep the shaded static image perfectly solid underneath WebGL while it fades in.
  const showShadedStatic = (isActive || allowZoom) && !isFadeComplete;

  // Start rotation/kinematics 1 frame (20ms) after showLiveCanvas becomes true (since model is already at 0.000° rest pose),
  // and hide the static shaded underlay once the 75ms opacity reveal finishes (85ms).
  useEffect(() => {
    let startTimer: ReturnType<typeof setTimeout>;
    let fadeTimer: ReturnType<typeof setTimeout>;
    if (showLiveCanvas) {
      startTimer = setTimeout(() => {
        needsPoseResetRef.current = true;
        setIsAnimationsStarted(true);
      }, 20);
      fadeTimer = setTimeout(() => {
        setIsFadeComplete(true);
      }, 85);
    } else {
      setIsAnimationsStarted(false);
      setIsFadeComplete(false);
    }
    return () => {
      clearTimeout(startTimer);
      clearTimeout(fadeTimer);
    };
  }, [showLiveCanvas]);

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
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none pointer-events-none select-none z-0 transition-opacity ${fadeDuration} ease-in-out ${
          isActive || allowZoom ? 'opacity-0' : 'opacity-100'
        }`}
        loading={isActive ? 'eager' : 'lazy'}
        decoding="async"
      />

      {/* 2. LAYER 1: SHADED STATIC (Instant Solid Underlay, vanishes once WebGL is 100% settled) */}
      <img
        src={shadedPosterPath}
        alt={`${modelType} shaded`}
        onError={() => setShadedFallback(true)}
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none pointer-events-none select-none z-10 ${
          isFadeComplete
            ? 'opacity-0 transition-opacity duration-150 ease-out'
            : `transition-opacity ${fadeDuration} ease-in-out ${showShadedStatic ? 'opacity-100' : 'opacity-0'}`
        }`}
        loading={isActive || allowZoom ? 'eager' : 'lazy'}
        // Lowercase attribute passes straight through to the DOM in React 18 (LCP hint)
        {...({ fetchpriority: isActive ? 'high' : 'auto' } as Record<string, string>)}
        decoding="async"
      />

      {/* 3. LAYER 2: LIVE WEBGL CANVAS (Mounts after slide settles, fades in stationary, then animates) */}
      {shouldMountWebGL && (
        <div
          className={`absolute inset-0 w-full h-full z-20 transition-opacity ${fadeDuration} ease-in-out ${
            showLiveCanvas ? 'opacity-100' : 'opacity-0'
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
            frameloop={showLiveCanvas || shouldRunWarmLoop || isHovered ? 'always' : 'never'}
            dpr={isMobileMode ? [1, 1.25] : [1, 1.6]}
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
                setIsAnimationsStarted(false);
                setIsFadeComplete(false);
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
                  isActive={!isResettingModel}
                  isHovered={isHovered}
                  isRotating={isAnimationPlaying && isRotating && isAnimationsStarted}
                  isAnimating={isAnimationPlaying && isAnimationsStarted}
                />
              </ModelErrorBoundary>
              <CanvasWarmDetector
                active={shouldRunWarmLoop}
                isResetting={isResettingModel}
                onResetComplete={() => {
                  needsPoseResetRef.current = false;
                  setIsResettingModel(false);
                }}
                onDrawn={() => setIsCanvasReady(true)}
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
