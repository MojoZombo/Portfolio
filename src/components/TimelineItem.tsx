import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Project } from '../types/project';
import { ModelViewer } from '../canvas/ModelViewer';
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
  /** Custom translation distance for 3D model (default: 160px, positive = right, negative = left) */
  modelTranslateX?: number;
  /** Custom translation distance for text card (default: -24px, negative = left, positive = right) */
  textTranslateX?: number;
  /** Optional custom vertical translation distance for 3D model */
  modelTranslateY?: number;
  /** Optional custom vertical translation distance for text card */
  textTranslateY?: number;
}

const TimelineItemComponent: React.FC<TimelineItemProps> = ({
  project,
  index = 0,
  onSelect,
  onVisible,
  modelTranslateX,
  textTranslateX,
  modelTranslateY,
  textTranslateY,
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

  const itemRef = useRef<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useState(index === 0);
  const isActiveRef = useRef(index === 0);
  const [isSettled, setIsSettled] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const updateDimensions = () => {
      setIsDesktop(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const docCenterYRef = useRef(0);

  const measureDocCenter = useCallback(() => {
    const el = itemRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    docCenterYRef.current = rect.top + (window.scrollY || window.pageYOffset || 0) + rect.height / 2;
  }, []);

  useEffect(() => {
    let ticking = false;

    // Detect active center zone using instant arithmetic against cached position (ZERO reflows)
    const checkVisibility = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (docCenterYRef.current === 0) {
            measureDocCenter();
          }

          const windowHeight = window.innerHeight;
          const currentDocCenter = (window.scrollY || window.pageYOffset || 0) + windowHeight / 2;
          const distance = Math.abs(docCenterYRef.current - currentDocCenter);

          // Adaptive threshold for mobile vs desktop with compact spacing
          const isMobileDevice = window.innerWidth < 768;
          const enterThreshold = windowHeight * (isMobileDevice ? 0.26 : 0.22);
          const exitThreshold = windowHeight * (isMobileDevice ? 0.36 : 0.32);

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

    return () => {
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', handleResize);
    };
  }, [project.id, onVisible, measureDocCenter]);

  return (
    <section
      id={`project-${project.id}`}
      ref={itemRef}
      className="relative min-h-[360px] sm:min-h-[420px] md:min-h-[44vh] flex items-center justify-center py-3 sm:py-5 md:py-8 overflow-visible"
    >
      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-center overflow-visible gap-4 md:gap-0">
        
        {/* Project Header / Details:
            - Desktop: Floats on left and slides in dynamically when active in center view
            - Mobile: Positioned cleanly above the 3D model with transparent background, animating in when active
        */}
        <motion.div
          initial={false}
          animate={{
            opacity: isActive ? 1 : 0,
            x: isDesktop ? (isActive ? 0 : textShiftX) : (isActive ? 0 : -20),
            y: isDesktop ? (isActive ? 0 : textShiftY) : (isActive ? 0 : -8),
            pointerEvents: isActive ? 'auto' : 'none',
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full md:w-5/12 md:absolute md:left-4 lg:left-8 z-20"
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
              <span className="font-mono text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                {project.date.toUpperCase()}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              {project.title}
            </h2>

            {/* Single clean button to open details */}
            <div className="pt-1">
              <button
                onClick={() => onSelect(project)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded text-xs font-mono font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 transition-colors cursor-pointer touch-manipulation"
              >
                <span>View Project Details</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={false}
          animate={{
            x: isDesktop && isActive ? modelShiftX : 0,
            y: isDesktop && isActive ? modelShiftY : 0,
          }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          onAnimationStart={() => {
            setIsSettled(false);
          }}
          onAnimationComplete={() => {
            if (isActiveRef.current) {
              setIsSettled(true);
            }
          }}
          className="w-full flex items-center justify-center overflow-visible will-change-transform"
        >
          <div className="w-full max-w-2xl flex items-center justify-center overflow-visible">
            <ModelViewer
              modelType={project.modelType}
              isActive={isActive}
              isSettled={!isDesktop || isSettled}
              className="h-[270px] xs:h-[310px] sm:h-[400px] md:h-[490px] w-full"
            />
          </div>
        </motion.div>

      </div>
    </section>
  );
};

export const TimelineItem = React.memo(TimelineItemComponent);
