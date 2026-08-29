import React, { useRef, useEffect, useState } from 'react';
import { Project } from '../types/project';
import { ModelViewer } from '../canvas/ModelViewer';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { CompanyLogo } from './CompanyLogo';

interface TimelineItemProps {
  project: Project;
  index: number;
  onSelect: (project: Project) => void;
  onVisible: (id: string) => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({ project, onSelect, onVisible }) => {
  const itemRef = useRef<HTMLDivElement | null>(null);
  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const updateDimensions = () => {
      setIsDesktop(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    let ticking = false;

    // Detect active center zone with adaptive threshold for mobile vs desktop
    const checkVisibility = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const rect = el.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const elementCenter = rect.top + rect.height / 2;
          const viewportCenter = windowHeight / 2;
          const distance = Math.abs(elementCenter - viewportCenter);

          // Adaptive threshold for mobile vs desktop with compact spacing
          const isMobileDevice = window.innerWidth < 768;
          const enterThreshold = windowHeight * (isMobileDevice ? 0.30 : 0.22);
          const exitThreshold = windowHeight * (isMobileDevice ? 0.44 : 0.32);

          let nextActive = isActiveRef.current;
          if (distance < enterThreshold) {
            nextActive = true;
          } else if (distance > exitThreshold) {
            nextActive = false;
          }

          if (nextActive !== isActiveRef.current) {
            isActiveRef.current = nextActive;
            setIsActive(nextActive);
            if (nextActive) {
              onVisible(project.id);
            }
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility);
    checkVisibility();

    return () => {
      window.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [project.id, onVisible]);

  return (
    <section
      id={`project-${project.id}`}
      ref={itemRef}
      className="relative min-h-[360px] sm:min-h-[420px] md:min-h-[44vh] flex items-center justify-center py-3 sm:py-5 md:py-8 overflow-visible"
    >
      <div className="relative w-full max-w-5xl mx-auto px-3 sm:px-6 flex flex-col md:flex-row items-center justify-center overflow-visible gap-4 md:gap-0">
        
        {/* Project Header / Details:
            - Desktop: Floats on left and slides in dynamically when active in center view
            - Mobile: Cleanly positioned above the 3D model, always visible with crisp typography
        */}
        <motion.div
          initial={false}
          animate={{
            opacity: isDesktop ? (isActive ? 1 : 0) : 1,
            x: isDesktop ? (isActive ? 0 : -24) : 0,
            pointerEvents: isDesktop ? (isActive ? 'auto' : 'none') : 'auto',
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full md:w-5/12 md:absolute md:left-4 lg:left-8 z-20"
        >
          <div className="space-y-2.5 bg-slate-50/70 dark:bg-slate-900/60 md:bg-transparent md:dark:bg-transparent backdrop-blur-sm md:backdrop-blur-none p-3.5 sm:p-4 md:p-0 rounded-2xl md:rounded-none border border-slate-200/50 dark:border-slate-800/50 md:border-0 shadow-sm md:shadow-none">
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

            {/* Subtitle */}
            <p className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400 line-clamp-2 sm:line-clamp-none">
              {project.subtitle}
            </p>

            {/* Single clean button to open details */}
            <div className="pt-1">
              <button
                onClick={() => onSelect(project)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 transition-all shadow-sm active:scale-95 cursor-pointer touch-manipulation"
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
            x: isDesktop && isActive ? 160 : 0,
          }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex items-center justify-center overflow-visible will-change-transform"
        >
          <div className="w-full max-w-2xl flex items-center justify-center overflow-visible">
            <ModelViewer
              modelType={project.modelType}
              isActive={isActive}
              className="h-[270px] xs:h-[310px] sm:h-[400px] md:h-[490px] w-full"
            />
          </div>
        </motion.div>

      </div>
    </section>
  );
};
