import React, { Suspense, lazy, useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { PointerHoverState, ScrollExitState } from './ModelCanvas';
import { POSTER_VERSION, preloadModelAssets } from './ModelPreloadManager';
import { getNativeDpr } from './stageConfig';
import { useTheme } from '../context/ThemeContext';
import { Pause, Play, RotateCcw } from 'lucide-react';

const LazyModelCanvas = lazy(() =>
  import('./ModelCanvas').then((m) => ({ default: m.ModelCanvas }))
);

interface ModelViewerProps {
  modelType: string;
  isActive?: boolean;
  isNearby?: boolean;
  isOnScreen?: boolean;
  isSettled?: boolean;
  isHovered?: boolean;
  isPaused?: boolean;
  isAnimationPlaying?: boolean;
  onToggleAnimation?: (playing: boolean) => void;
  scrollExitRef?: React.MutableRefObject<ScrollExitState>;
  className?: string;
  allowZoom?: boolean;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelType,
  isActive = false,
  isNearby = false,
  isOnScreen = true,
  isSettled = true,
  isHovered = false,
  isPaused = false,
  isAnimationPlaying: isAnimationPlayingProp,
  onToggleAnimation,
  scrollExitRef,
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

  const [internalAnimationPlaying, setInternalAnimationPlaying] = useState(() => !prefersReducedMotion);
  const [isDragging, setIsDragging] = useState(false);
  const [isRotationHeld, setIsRotationHeld] = useState(false);
  const [isResettingView, setIsResettingView] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [isCameraMoved, setIsCameraMoved] = useState(false);
  const [isPrewarmed, setIsPrewarmed] = useState(false);
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [isFrozenBlueprint, setIsFrozenBlueprint] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resumeRotateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerHoverRef = useRef<PointerHoverState>({ hovered: false, x: 0, y: 0 });

  const [shouldMountWebGL, setShouldMountWebGL] = useState(false);

  const effectiveAnimationPlaying =
    isAnimationPlayingProp !== undefined ? isAnimationPlayingProp : internalAnimationPlaying;

  useEffect(() => {
    if (prefersReducedMotion) {
      setInternalAnimationPlaying(false);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (resumeRotateTimerRef.current) {
        clearTimeout(resumeRotateTimerRef.current);
      }
    };
  }, []);

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
  const [nativeDpr, setNativeDpr] = useState<number>(() => getNativeDpr());

  useEffect(() => {
    const handleResize = () => {
      const mobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
      setIsMobileWidth(mobile);
      const nextDpr = getNativeDpr();
      setNativeDpr((prev) => (Math.abs(prev - nextDpr) > 0.01 ? nextDpr : prev));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const syncDpr = () => {
      const nextDpr = getNativeDpr();
      setNativeDpr((prev) => (Math.abs(prev - nextDpr) > 0.01 ? nextDpr : prev));
    };
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    mq.addEventListener('change', syncDpr);
    return () => mq.removeEventListener('change', syncDpr);
  }, [nativeDpr]);

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

  const prevIsDarkRef = useRef(isDark);

  // Re-warm dormant off-screen canvases when theme changes while out of view
  useEffect(() => {
    const themeChanged = prevIsDarkRef.current !== isDark;
    prevIsDarkRef.current = isDark;
    if (themeChanged && !isActive && !allowZoom && !isOnScreen && shouldMountWebGL) {
      setIsPrewarmed(false);
      setIsCanvasReady(false);
      setIsFrozenBlueprint(false);
    }
  }, [isDark, isActive, allowZoom, isOnScreen, shouldMountWebGL]);

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
        if (isMobileMode && !shouldMountWebGL) {
          // Defer brand-new mobile WebGL mount until parting/title reveal finishes (Layer 1 2x shaded poster covers seamlessly)
          timer = setTimeout(() => {
            setShouldMountWebGL(true);
          }, 240);
        } else {
          setShouldMountWebGL(true);
        }
      }
    } else if (!isNearby && !isOnScreen) {
      // Card left proximity ring: unmount WebGL far off-screen
      timer = setTimeout(() => {
        setShouldMountWebGL(false);
        setIsPrewarmed(false);
        setIsCanvasReady(false);
        setIsFrozenBlueprint(false);
      }, 420);
    }
    return () => clearTimeout(timer);
  }, [isActive, isNearby, isOnScreen, isSettled, allowZoom, isMobileMode, shouldMountWebGL]);

  const isActiveAndSettled = allowZoom || (isActive && isSettled);
  const isRetainingLiveCanvas = !allowZoom && isCanvasReady && isOnScreen;
  const isMorphingToBlueprint = !allowZoom && !isActive && isCanvasReady && isOnScreen;
  const showLiveCanvas = allowZoom ? isCanvasReady : isCanvasReady && (isActiveAndSettled || isOnScreen);
  const keepModelShaded = isActiveAndSettled || isRetainingLiveCanvas;
  const isDrawingActiveReveal = shouldMountWebGL && isActiveAndSettled && !isCanvasReady;
  const isAnimationsStarted = isActiveAndSettled && isCanvasReady;
  const isCanvasRotating =
    effectiveAnimationPlaying &&
    !prefersReducedMotion &&
    !isDragging &&
    !(allowZoom && isRotationHeld) &&
    (isAnimationsStarted || (isMorphingToBlueprint && !isFrozenBlueprint));

  const handleBlueprintSettled = useCallback(() => {
    setIsFrozenBlueprint(true);
  }, []);

  // Coordinate in-place morph re-entry when scrolling back and silent reset once off-screen
  useEffect(() => {
    if (allowZoom) return;

    if (isActive) {
      setIsFrozenBlueprint(false);
      return;
    }

    if (resumeRotateTimerRef.current) {
      clearTimeout(resumeRotateTimerRef.current);
      resumeRotateTimerRef.current = null;
    }
    setIsDragging(false);
    pointerHoverRef.current.hovered = false;

    if (!isOnScreen) {
      setIsFrozenBlueprint(false);
      setIsCanvasReady(false);
      setResetTrigger((prev) => prev + 1);
      setIsRotationHeld(false);
      setIsResettingView(false);
      setInternalAnimationPlaying(!prefersReducedMotion);
      setIsCameraMoved(false);
    }
  }, [isActive, isOnScreen, allowZoom, prefersReducedMotion]);

  // Image Paths (theme-specific with fallback)
  const themeSuffix = isDark ? 'dark' : 'light';
  const [bpFallback, setBpFallback] = useState(false);
  const [shadedFallback, setShadedFallback] = useState(false);
  const [isShadedLoaded, setIsShadedLoaded] = useState(false);
  const shadedImgRef = useRef<HTMLImageElement | null>(null);

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

  useLayoutEffect(() => {
    const img = shadedImgRef.current;
    setIsShadedLoaded(Boolean(img && img.complete && img.naturalWidth > 0));
  }, [shadedPosterPath]);

  const handleDragStart = () => {
    if (resumeRotateTimerRef.current) {
      clearTimeout(resumeRotateTimerRef.current);
      resumeRotateTimerRef.current = null;
    }
    setIsDragging(true);
    if (allowZoom) {
      setIsRotationHeld(true);
      setIsResettingView(false);
    }
  };

  const handleDragEnd = () => {
    if (resumeRotateTimerRef.current) {
      clearTimeout(resumeRotateTimerRef.current);
      resumeRotateTimerRef.current = null;
    }
    if (allowZoom) {
      setIsDragging(false);
      return;
    }
    resumeRotateTimerRef.current = setTimeout(() => {
      resumeRotateTimerRef.current = null;
      setIsDragging(false);
    }, 350);
  };

  const handleTogglePlay = () => {
    const next = !effectiveAnimationPlaying;
    if (onToggleAnimation) {
      onToggleAnimation(next);
    } else {
      setInternalAnimationPlaying(next);
    }
  };

  const handleResetView = () => {
    if (resumeRotateTimerRef.current) {
      clearTimeout(resumeRotateTimerRef.current);
      resumeRotateTimerRef.current = null;
    }
    setIsDragging(false);
    setIsRotationHeld(false);
    if (allowZoom) {
      setIsResettingView(true);
    }
    setResetTrigger((prev) => prev + 1);
    setIsCameraMoved(false);
    const shouldAnimate = !prefersReducedMotion;
    if (onToggleAnimation) {
      onToggleAnimation(shouldAnimate);
    } else {
      setInternalAnimationPlaying(shouldAnimate);
    }
  };

  const updatePointerHover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / rect.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / rect.height) * 2 - 1));
    pointerHoverRef.current = { hovered: true, x: nx, y: ny };
  };

  const clearPointerHover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') return;
    pointerHoverRef.current.hovered = false;
  };

  return (
    <div
      ref={containerRef}
      onPointerEnter={updatePointerHover}
      onPointerMove={updatePointerHover}
      onPointerLeave={clearPointerHover}
      onPointerCancel={clearPointerHover}
      style={{ touchAction: allowZoom ? 'none' : 'pan-y' }}
      className={`relative ${className} select-none pointer-events-auto flex items-center justify-center overflow-hidden`}
    >
      {/* 1. LAYER 0: BLUEPRINT (Visible when Inactive / Off-screen) */}
      <img
        src={bpPosterPath}
        alt={`${modelType} blueprint`}
        onError={() => setBpFallback(true)}
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none pointer-events-none select-none z-0 ${
          showLiveCanvas
            ? 'opacity-0'
            : (isActive || allowZoom) && isShadedLoaded
            ? 'opacity-0 transition-opacity duration-300 ease-out'
            : 'opacity-100 transition-opacity duration-300 ease-out'
        }`}
        loading={isActive || isNearby || isOnScreen || allowZoom ? 'eager' : 'lazy'}
        decoding="async"
      />

      {/* 2. LAYER 1: SHADED STATIC (Instant Solid Underlay, cuts to 3D canvas once WebGL is ready) */}
      <img
        ref={shadedImgRef}
        src={shadedPosterPath}
        alt={`${modelType} shaded`}
        onLoad={() => setIsShadedLoaded(true)}
        onError={() => setShadedFallback(true)}
        className={`absolute top-0 left-1/2 -translate-x-1/2 h-full w-auto max-w-none pointer-events-none select-none z-10 ${
          showLiveCanvas
            ? 'opacity-0 pointer-events-none'
            : allowZoom
            ? 'opacity-100'
            : isActive
            ? 'opacity-100 transition-opacity duration-300 ease-out'
            : 'opacity-0 transition-opacity duration-300 ease-out'
        }`}
        loading={isActive || isNearby || isOnScreen || allowZoom ? 'eager' : 'lazy'}
        {...({ fetchpriority: isActive ? 'high' : 'auto' } as Record<string, string>)}
        decoding="async"
      />

      {/* 3. LAYER 2: LIVE WEBGL CANVAS (Lazy-loaded once WebGL mounts) */}
      {shouldMountWebGL && (
        <div
          className={`absolute inset-0 w-full h-full z-20 ${
            showLiveCanvas
              ? isMorphingToBlueprint
                ? 'opacity-100 pointer-events-none'
                : 'opacity-100'
              : 'opacity-0 pointer-events-none'
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
              dynamicDpr={nativeDpr}
              showLiveCanvas={showLiveCanvas}
              isDrawingActiveReveal={isDrawingActiveReveal}
              isActiveAndSettled={keepModelShaded}
              isMorphingToBlueprint={isMorphingToBlueprint}
              isFrozenBlueprint={isFrozenBlueprint}
              isHovered={isHovered}
              isAnimationPlaying={effectiveAnimationPlaying}
              isRotating={isCanvasRotating}
              isDragging={isDragging}
              disableHoverTilt={allowZoom && isRotationHeld}
              prefersReducedMotion={prefersReducedMotion}
              isAnimationsStarted={isAnimationsStarted}
              isThemeTransitioning={isThemeTransitioning}
              isPrewarmed={isPrewarmed}
              resetTrigger={resetTrigger}
              pointerHoverRef={pointerHoverRef}
              scrollExitRef={scrollExitRef}
              onDrawn={() => {
                setIsCanvasReady(true);
                setIsPrewarmed(true);
              }}
              onBlueprintSettled={handleBlueprintSettled}
              onCameraMove={setIsCameraMoved}
              onResetComplete={() => {
                setIsResettingView(false);
              }}
              onContextLost={() => {
                setIsFrozenBlueprint(false);
                setIsCanvasReady(false);
              }}
              onContextRestored={() => {
                setIsFrozenBlueprint(false);
                setIsPrewarmed(false);
                setIsCanvasReady(false);
              }}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          </Suspense>
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

          {/* Reset Model / Camera View Button (Appears whenever camera or rotation was manually changed) */}
          {(isCameraMoved || isRotationHeld) && !isResettingView && (
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
