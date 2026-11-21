import React, { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { Project } from '../types/project';
import { ModelViewer } from '../canvas/ModelViewer';
import type { ScrollExitState } from '../canvas/ModelCanvas';
import { preloadModelAssets } from '../canvas/ModelPreloadManager';
import { useTheme } from '../context/ThemeContext';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { CompanyLogo } from './CompanyLogo';

// Default animation translation distances in both directions
export const DEFAULT_MODEL_TRANSLATE_X = 160; // Direction: Right (+X)
export const DEFAULT_TEXT_TRANSLATE_X = -24;  // Direction: Left (-X)
export const DEFAULT_MODEL_TRANSLATE_Y = 0;
export const DEFAULT_TEXT_TRANSLATE_Y = 0;

interface TimelineItemProps {
  project: Project;
  index: number;
  onSelect: (project: Project) => void;
  onVisible: (id: string) => void;
  isPausedByModal?: boolean;
  /** Custom translation distance for 3D model (default: 160px, positive = right, negative = left) */
  modelTranslateX?: number;
  /** Custom translation distance for text card (default: -24px, negative = left, positive = right) */
  textTranslateX?: number;
  /** Optional custom vertical translation distance for 3D model */
  modelTranslateY?: number;
  /** Optional custom vertical translation distance for text card */
  textTranslateY?: number;
  mobileIsActive?: boolean;
  onRegisterMobileRefs?: (
    index: number,
    modelEl: HTMLDivElement | null,
    titleEl: HTMLDivElement | null
  ) => void;
  onMobileTitleMeasure?: (index: number, height: number) => void;
}

const TimelineItemComponent: React.FC<TimelineItemProps> = ({
  project,
  index = 0,
  onSelect,
  onVisible,
  isPausedByModal = false,
  modelTranslateX,
  textTranslateX,
  modelTranslateY,
  textTranslateY,
  mobileIsActive,
  onRegisterMobileRefs,
  onMobileTitleMeasure,
}) => {
  // Resolve custom translation distances for both directions:
  // Priority: Prop override > Project level setting > Default distance
  const modelShiftX =
    modelTranslateX ??
    project.modelTranslateX ??
    project.animationTranslation?.modelX ??
    DEFAULT_MODEL_TRANSLATE_X;

  const textShiftX =
    textTranslateX ??
    project.textTranslateX ??
    project.animationTranslation?.textX ??
    DEFAULT_TEXT_TRANSLATE_X;

  const modelShiftY =
    modelTranslateY ??
    project.modelTranslateY ??
    project.animationTranslation?.modelY ??
    DEFAULT_MODEL_TRANSLATE_Y;

  const textShiftY =
    textTranslateY ??
    project.textTranslateY ??
    project.animationTranslation?.textY ??
    DEFAULT_TEXT_TRANSLATE_Y;

  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const itemRef = useRef<HTMLDivElement | null>(null);
  const titleBlockRef = useRef<HTMLDivElement | null>(null);
  const modelPushRef = useRef<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useState(index === 0);
  const isActiveRef = useRef(index === 0);
  const [isNearby, setIsNearby] = useState(index <= 1);
  const isNearbyRef = useRef(index <= 1);
  const [isOnScreen, setIsOnScreen] = useState(index <= 1);
  const isOnScreenRef = useRef(index <= 1);
  const [isSettled, setIsSettled] = useState(index === 0);
  const scrollExitRef = useRef<ScrollExitState>({ scrollExit: 0 });
  const preloadStageRef = useRef<0 | 1 | 2>(0); // 0: none, 1: outer ring, 2: inner ring (high priority)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );

  const effectiveIsActive = isDesktop ? isActive : (mobileIsActive ?? isActive);
  isActiveRef.current = effectiveIsActive;

  useLayoutEffect(() => {
    if (isDesktop || !onRegisterMobileRefs) return;
    onRegisterMobileRefs(index, modelPushRef.current, titleBlockRef.current);
    return () => {
      onRegisterMobileRefs(index, null, null);
    };
  }, [isDesktop, index, onRegisterMobileRefs]);

  useLayoutEffect(() => {
    if (isDesktop || !onMobileTitleMeasure) return;
    const el = titleBlockRef.current;
    if (!el) return;

    const measureTitle = () => {
      const h = el.offsetHeight;
      if (h > 0) {
        onMobileTitleMeasure(index, h);
      }
    };

    measureTitle();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measureTitle);
      ro.observe(el);
    }

    window.addEventListener('resize', measureTitle, { passive: true });
    const fonts = (document as any).fonts;
    if (fonts?.ready) {
      fonts.ready.then(measureTitle);
    }

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measureTitle);
    };
  }, [isDesktop, index, project.title, project.company, project.date, onMobileTitleMeasure]);

  // Immediately pre-warm top 2 timeline items on initial boot
  useEffect(() => {
    if (index <= 1) {
      preloadStageRef.current = 2;
      preloadModelAssets(project.modelType, isDark, 'high');
    } else if (index === 2) {
      preloadStageRef.current = Math.max(preloadStageRef.current, 1) as 0 | 1 | 2;
      preloadModelAssets(project.modelType, isDark, 'low');
    }
  }, [index, project.modelType, isDark]);

  useEffect(() => {
    const updateDimensions = () => {
      setIsDesktop(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Mobile-only tap detection:
  // Tapping the 3D model in mobile mode opens detail view (onSelect(project)).
  // Strictly ignores scrolling gestures (touch delta > 8px, scroll delta > 6px, duration > 350ms).
  // Desktop mode is strictly excluded (isDesktop === true returns immediately).
  const touchStartRef = useRef<{ x: number; y: number; time: number; scrollY: number } | null>(null);
  const touchMovedRef = useRef<boolean>(false);
  const lastTapHandledRef = useRef<number>(0);
  const mouseDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleModelTouchStart = (e: React.TouchEvent) => {
    if (isDesktop) return;
    if (e.touches.length !== 1) {
      touchMovedRef.current = true;
      touchStartRef.current = null;
      return;
    }
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      scrollY: window.scrollY || window.pageYOffset || 0,
    };
    touchMovedRef.current = false;
  };

  const handleModelTouchMove = (e: React.TouchEvent) => {
    if (isDesktop) return;
    if (!touchStartRef.current || e.touches.length !== 1) {
      touchMovedRef.current = true;
      return;
    }
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    if (dx > 8 || dy > 8) {
      touchMovedRef.current = true;
    }
  };

  const handleModelTouchEnd = (e: React.TouchEvent) => {
    if (isDesktop) return;
    if (!touchStartRef.current) return;

    const startInfo = touchStartRef.current;
    touchStartRef.current = null;

    if (touchMovedRef.current) return;

    const duration = Date.now() - startInfo.time;
    if (duration > 350) return;

    const currentScrollY = window.scrollY || window.pageYOffset || 0;
    if (Math.abs(currentScrollY - startInfo.scrollY) > 6) return;

    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0];
      const endDx = Math.abs(touch.clientX - startInfo.x);
      const endDy = Math.abs(touch.clientY - startInfo.y);
      if (endDx > 8 || endDy > 8) return;
    }

    lastTapHandledRef.current = Date.now();
    if (e.cancelable) {
      e.preventDefault();
    }
    onSelect(project);
  };

  const handleModelTouchCancel = () => {
    touchMovedRef.current = true;
    touchStartRef.current = null;
  };

  const handleModelMouseDown = (e: React.MouseEvent) => {
    if (isDesktop) return;
    mouseDownPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  };

  const handleModelClick = (e: React.MouseEvent) => {
    if (isDesktop) return;

    // Debounce synthetic click if touch tap was already handled
    if (Date.now() - lastTapHandledRef.current < 600) {
      return;
    }

    // If mouse was dragged (e.g. testing in responsive view with mouse), do not trigger
    if (mouseDownPosRef.current) {
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
      const duration = Date.now() - mouseDownPosRef.current.time;
      mouseDownPosRef.current = null;
      if (dx > 8 || dy > 8 || duration > 400) return;
    }

    onSelect(project);
  };

  const handleModelKeyDown = (e: React.KeyboardEvent) => {
    if (isDesktop) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(project);
    }
  };

  const docCenterYRef = useRef(0);
  const halfHeightRef = useRef(260);

  const measureDocCenter = useCallback(() => {
    const el = itemRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    docCenterYRef.current = rect.top + (window.scrollY || window.pageYOffset || 0) + rect.height / 2;
    halfHeightRef.current = rect.height / 2;
  }, []);

  useEffect(() => {
    let ticking = false;

    // Detect active center zone and predictive preload rings using instant arithmetic against cached position (ZERO reflows)
    const checkVisibility = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (docCenterYRef.current === 0) {
            measureDocCenter();
          }

          const windowHeight = window.innerHeight;
          const currentDocCenter = (window.scrollY || window.pageYOffset || 0) + windowHeight / 2;
          const distance = Math.abs(docCenterYRef.current - currentDocCenter);

          // Two-ring predictive preloading:
          // Inner ring (< 0.95 * vh): high-priority preload (adjacent items N-1, N+1)
          // Outer ring (< 1.85 * vh): idle low-priority preload (2-3 items ahead)
          if (distance < windowHeight * 0.95) {
            if (preloadStageRef.current < 2) {
              preloadStageRef.current = 2;
              preloadModelAssets(project.modelType, isDarkRef.current, 'high');
            }
          } else if (distance < windowHeight * 1.85) {
            if (preloadStageRef.current < 1) {
              preloadStageRef.current = 1;
              preloadModelAssets(project.modelType, isDarkRef.current, 'low');
            }
          }

          // Adaptive threshold for mobile vs desktop with compact spacing
          const isMobileDevice = window.innerWidth < 768;
          const enterThreshold = windowHeight * 0.22;
          const exitThreshold = isMobileDevice ? Math.min(windowHeight * 0.24, 180) : windowHeight * 0.32;

          const scrollExitEnd = isMobileDevice ? Math.min(windowHeight * 0.50, 380) : windowHeight * 0.50;
          scrollExitRef.current.scrollExit = Math.max(
            0,
            Math.min(1, (distance - exitThreshold) / Math.max(1, scrollExitEnd - exitThreshold))
          );

          // Full-card viewport retention ring with hysteresis: never reset while visible on-screen
          const onScreenEnterThreshold = windowHeight * 0.5 + halfHeightRef.current + (isMobileDevice ? 200 : 40);
          const onScreenExitThreshold = windowHeight * 0.5 + halfHeightRef.current + (isMobileDevice ? 280 : 120);
          let nextOnScreen = isOnScreenRef.current;
          if (distance < onScreenEnterThreshold) {
            nextOnScreen = true;
          } else if (distance > onScreenExitThreshold) {
            nextOnScreen = false;
          }
          if (nextOnScreen !== isOnScreenRef.current) {
            isOnScreenRef.current = nextOnScreen;
            setIsOnScreen(nextOnScreen);
          }

          // Proximity pre-mount ring (adjacent cards N-1 and N+1) strictly outside viewport ring
          const nearbyEnterThreshold = Math.max(windowHeight * 1.15, onScreenExitThreshold + 80);
          const nearbyExitThreshold = Math.max(windowHeight * 1.35, onScreenExitThreshold + 160);
          let nextNearby = isNearbyRef.current;
          if (distance < nearbyEnterThreshold) {
            nextNearby = true;
          } else if (distance > nearbyExitThreshold) {
            nextNearby = false;
          }
          if (nextNearby !== isNearbyRef.current) {
            isNearbyRef.current = nextNearby;
            setIsNearby(nextNearby);
          }

          if (!isMobileDevice) {
            let nextActive = isActiveRef.current;
            if (distance < enterThreshold) {
              nextActive = true;
            } else if (distance > exitThreshold) {
              nextActive = false;
            }

            if (nextActive !== isActiveRef.current) {
              isActiveRef.current = nextActive;
              setIsActive(nextActive);
              setIsSettled(false);
              if (nextActive) {
                onVisible(project.id);
              }
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    const handleResize = () => {
      measureDocCenter();
      checkVisibility();
    };

    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    measureDocCenter();
    checkVisibility();

    // Re-verify measurement when web fonts finish rendering to prevent layout drift
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => {
        measureDocCenter();
        checkVisibility();
      });
    }

    return () => {
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', handleResize);
    };
  }, [project.id, project.modelType, onVisible, measureDocCenter]);

  return (
    <section
      id={`project-${project.id}`}
      ref={itemRef}
      className={`relative min-h-0 md:min-h-[44vh] flex items-center justify-center py-1 sm:py-2 md:py-8 overflow-visible pointer-events-none ${
        effectiveIsActive ? 'z-20' : 'z-10'
      }`}
    >
      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-center overflow-visible">
        
        {/* Project Header / Details:
            - Desktop: Floats on left and slides in dynamically when active in center view
            - Mobile: Unveils inside the scroll-scrubbed pocket opened above the active model
            - Compositor-driven: Uses native GPU CSS transforms without main-thread React churn
        */}
        <div
          ref={titleBlockRef}
          aria-hidden={!effectiveIsActive}
          style={
            isDesktop
              ? {
                  transform: `translate3d(${effectiveIsActive ? 0 : textShiftX}px, ${effectiveIsActive ? 0 : textShiftY}px, 0)`,
                  opacity: effectiveIsActive ? 1 : 0,
                  pointerEvents: effectiveIsActive ? 'auto' : 'none',
                  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                  willChange: 'transform, opacity',
                }
              : {
                  transformOrigin: 'left bottom',
                  willChange: 'transform, opacity',
                }
          }
          className="absolute top-1 left-4 right-4 sm:left-6 sm:right-6 md:top-auto md:right-auto md:w-5/12 md:left-4 lg:left-8 z-30 md:z-20 will-change-transform transform-gpu"
        >
          <div className="space-y-2.5 p-0">
            {/* Company Badge & Date */}
            <div className="flex flex-wrap items-center gap-2">
              {project.company && (
                <CompanyLogo
                  company={project.company}
                  logoUrl={project.companyLogo}
                  companyUrl={project.companyUrl}
                  size="sm"
                />
              )}
              <span className="font-mono text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium select-text">
                {project.date.toUpperCase()}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight select-text">
              {project.title}
            </h2>

            {/* Single clean button to open details */}
            <div className="pt-1">
              <button
                type="button"
                tabIndex={effectiveIsActive ? 0 : -1}
                onClick={() => onSelect(project)}
                className="btn-ripple inline-flex items-center gap-2 px-3.5 py-2 rounded text-xs font-mono font-medium bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span>View Project Details</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={modelPushRef}
          className="w-full flex items-center justify-center overflow-visible will-change-transform pointer-events-auto"
        >
          <motion.div
            initial={false}
            animate={{
              x: isDesktop && effectiveIsActive ? modelShiftX : 0,
              y: isDesktop && effectiveIsActive ? modelShiftY : 0,
            }}
            transition={{ duration: 0.38, ease: [0.25, 0.9, 0.3, 1] }}
            onAnimationStart={() => {
              setIsSettled(false);
            }}
            onAnimationComplete={() => {
              if (isActiveRef.current) {
                setIsSettled(true);
              }
            }}
            className="w-full flex items-center justify-center overflow-visible will-change-transform relative"
          >
            <div
              className={`relative w-full max-w-2xl flex items-center justify-center overflow-visible ${
                !isDesktop ? 'cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500' : ''
              }`}
              onClick={handleModelClick}
              onTouchStart={handleModelTouchStart}
              onTouchMove={handleModelTouchMove}
              onTouchEnd={handleModelTouchEnd}
              onTouchCancel={handleModelTouchCancel}
              onMouseDown={handleModelMouseDown}
              role={!isDesktop ? 'button' : undefined}
              tabIndex={!isDesktop ? 0 : undefined}
              aria-label={!isDesktop ? `View details for ${project.title}` : undefined}
              onKeyDown={!isDesktop ? handleModelKeyDown : undefined}
            >
              <ModelViewer
                modelType={project.modelType}
                isActive={effectiveIsActive}
                isNearby={isNearby}
                isOnScreen={isOnScreen}
                isSettled={!isDesktop || isSettled}
                isPaused={isPausedByModal}
                scrollExitRef={scrollExitRef}
                className="h-[270px] xs:h-[310px] sm:h-[400px] md:h-[490px] w-full"
              />
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
};

export const TimelineItem = React.memo(TimelineItemComponent);
