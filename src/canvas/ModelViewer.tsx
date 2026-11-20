import React, { Suspense, lazy, useState, useRef, useEffect } from 'react';
import { POSTER_VERSION, preloadModelAssets } from './ModelPreloadManager';
import { useTheme } from '../context/ThemeContext';
import { Pause, Play, RotateCcw } from 'lucide-react';

const LazyModelCanvas = lazy(() =>
  import('./ModelCanvas').then((m) => ({ default: m.ModelCanvas }))
);

interface ModelViewerProps {
  modelType: string;
  isActive?: boolean;
  isNearby?: boolean;
  isSettled?: boolean;
  isHovered?: boolean;
  isPaused?: boolean;
  isAnimationPlaying?: boolean;
  onToggleAnimation?: (playing: boolean) => void;
  className?: string;
  allowZoom?: boolean;
}

const computeCappedDpr = (mobile: boolean): number => {
  const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  return Math.min(Math.max(1.0, raw), mobile ? 1.75 : 2.0);
};

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelType,
  isActive = false,
  isNearby = false,
  isSettled = true,
  isHovered = false,
  isPaused = false,
  isAnimationPlaying: isAnimationPlayingProp,
  onToggleAnimation,
  className = 'h-[340px] sm:h-[480px] md:h-[560px] w-full',
  allowZoom = false,
}) => {
  const { theme, isThemeTransitioning } = useTheme();
  const isDark = theme === 'dark';

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const [isRotating, setIsRotating] = useState(() => !prefersReducedMotion);
  const [internalAnimationPlaying, setInternalAnimationPlaying] = useState(() => !prefersReducedMotion);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isCameraMoved, setIsCameraMoved] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isPrewarmed, setIsPrewarmed] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [shouldMountWebGL, setShouldMountWebGL] = useState(false);

  const effectiveAnimationPlaying =
    isAnimationPlayingProp !== undefined ? isAnimationPlayingProp : internalAnimationPlaying;

  useEffect(() => {
    if (isAnimationPlayingProp !== undefined) {
      setIsRotating(isAnimationPlayingProp && !prefersReducedMotion);
    }
  }, [isAnimationPlayingProp, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsRotating(false);
      setInternalAnimationPlaying(false);
    }
  }, [prefersReducedMotion]);

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
  const [dynamicDpr, setDynamicDpr] = useState<number>(() =>
    computeCappedDpr(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  );

  useEffect(() => {
    const handleResize = () => {
      const mobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
      setIsMobileWidth(mobile);
      setDynamicDpr(computeCappedDpr(mobile));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobileMode = !allowZoom && (isTouchDevice || isMobileWidth);

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
      setIsRotating(!prefersReducedMotion);
      setInternalAnimationPlaying(!prefersReducedMotion);
      setIsCameraMoved(false);
      setHasInteracted(false);
    }
  }, [isActive, allowZoom, prefersReducedMotion]);

  const isActiveAndSettled = allowZoom || (isActive && isSettled);
  const isDrawingActiveReveal = shouldMountWebGL && isActiveAndSettled && !isCanvasReady;
  const showLiveCanvas = isActiveAndSettled && isCanvasReady;
  const isAnimationsStarted = showLiveCanvas;

  // Image Paths (theme-specific with fallback)
  const themeSuffix = isDark ? 'dark' : 'light';
  const [bpFallback, setBpFallback] = useState(false);
  const [shadedFallback, setShadedFallback] = useState(false);

  useEffect(() => {
    setBpFallback(false);
    setShadedFallback(false);
  }, [modelType, isDark]);

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
    setIsRotating(false);
    setHasInteracted(true);
  };

  const handleTogglePlay = () => {
    const next = !effectiveAnimationPlaying;
    if (onToggleAnimation) {
      onToggleAnimation(next);
    } else {
      setInternalAnimationPlaying(next);
    }
    setIsRotating(next);
  };

  const handleResetView = () => {
    setResetTrigger((prev) => prev + 1);
    setIsCameraMoved(false);
    const shouldAnimate = !prefersReducedMotion;
    if (onToggleAnimation) {
      onToggleAnimation(shouldAnimate);
    } else {
      setInternalAnimationPlaying(shouldAnimate);
    }
    setIsRotating(shouldAnimate);
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
        {...({ fetchpriority: isActive ? 'high' : 'auto' } as Record<string, string>)}
        decoding="async"
      />

      {/* 3. LAYER 2: LIVE WEBGL CANVAS (Lazy-loaded once WebGL mounts) */}
      {shouldMountWebGL && (
        <div
          className={`absolute inset-0 w-full h-full z-20 ${
            showLiveCanvas ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <Suspense fallback={null}>
            <LazyModelCanvas
              modelType={modelType}
              isDark={isDark}
              allowZoom={allowZoom}
              isPaused={isPaused}
              isMobileMode={isMobileMode}
              isTouchDevice={isTouchDevice}
              isMobileWidth={isMobileWidth}
              dynamicDpr={dynamicDpr}
              showLiveCanvas={showLiveCanvas}
              isDrawingActiveReveal={isDrawingActiveReveal}
              isActiveAndSettled={isActiveAndSettled}
              isHovered={isHovered}
              isAnimationPlaying={effectiveAnimationPlaying}
              isRotating={isRotating}
              isAnimationsStarted={isAnimationsStarted}
              isThemeTransitioning={isThemeTransitioning}
              isPrewarmed={isPrewarmed}
              resetTrigger={resetTrigger}
              onDrawn={() => {
                setIsCanvasReady(true);
                setIsPrewarmed(true);
              }}
              onCameraMove={setIsCameraMoved}
              onContextLost={() => {
                setIsCanvasReady(false);
              }}
              onContextRestored={() => {
                setIsPrewarmed(false);
                setIsCanvasReady(false);
              }}
              onCanvasInteraction={handleCanvasInteraction}
            />
          </Suspense>
        </div>
      )}

      {/* Subtle Interaction Hint Pill (fades away once user orbits or zooms) */}
      {(allowZoom || !isMobileMode) && showLiveCanvas && !isPaused && (
        <div
          className={`absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-30 pointer-events-none select-none px-2.5 py-1 rounded bg-slate-900/75 text-white dark:bg-slate-900/90 dark:text-slate-200 backdrop-blur-sm text-[11px] font-mono transition-opacity duration-300 ${
            hasInteracted ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {allowZoom
            ? isTouchDevice
              ? 'Drag to orbit · Pinch to zoom'
              : 'Drag to orbit · Scroll to zoom'
            : 'Drag to orbit'}
        </div>
      )}

      {/* Interactive Controls in Corner */}
      {allowZoom && (
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-30 flex items-center gap-2 pointer-events-auto select-none">
          {/* Pause / Play Animation Button */}
          <button
            type="button"
            onClick={handleTogglePlay}
            className="btn-ripple group px-3 py-1.5 rounded bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200 backdrop-blur-sm cursor-pointer flex items-center justify-center gap-1.5 text-xs font-mono font-medium w-[80px] shrink-0 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={effectiveAnimationPlaying ? 'Pause 3D animation and rotation' : 'Play 3D animation and rotation'}
          >
            <span className="w-3.5 flex items-center justify-center shrink-0">
              {effectiveAnimationPlaying ? (
                <Pause size={12} className="text-blue-600 dark:text-blue-400" />
              ) : (
                <Play size={12} className="text-amber-600 dark:text-amber-400" />
              )}
            </span>
            <span className="w-[36px] text-left shrink-0">
              {effectiveAnimationPlaying ? 'Pause' : 'Play'}
            </span>
          </button>

          {/* Reset Model / Camera View Button (Appears whenever camera has been orbited, panned, or zoomed) */}
          {isCameraMoved && (
            <button
              type="button"
              onClick={handleResetView}
              className="btn-ripple group px-3 py-1.5 rounded bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200 backdrop-blur-sm cursor-pointer flex items-center gap-1.5 text-xs font-mono font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              title="Reset 3D model view"
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
