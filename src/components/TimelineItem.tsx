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

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    let ticking = false;

    // Detect active center zone with hysteresis to prevent rapid toggling/flashing
    const checkVisibility = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const rect = el.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const elementCenter = rect.top + rect.height / 2;
          const viewportCenter = windowHeight / 2;
          const distance = Math.abs(elementCenter - viewportCenter);

          // Hysteresis: Enter active at 18% threshold, exit only when outside 28%
          const enterThreshold = windowHeight * 0.18;
          const exitThreshold = windowHeight * 0.28;

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
      className="relative min-h-[44vh] sm:min-h-[48vh] flex items-center justify-center py-2 sm:py-3 overflow-visible"
    >
      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-center overflow-visible">
        
        {/* Dynamic Project Title & Details Button (Pops out on left when active in center) */}
        <motion.div
          initial={false}
          animate={{
            opacity: isActive ? 1 : 0,
            x: isActive ? 0 : -24,
            pointerEvents: isActive ? 'auto' : 'none',
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="w-full md:w-5/12 md:absolute md:left-4 lg:left-8 z-20"
        >
          <div className="space-y-2">
            {/* Company Badge & Date */}
            <div className="flex flex-wrap items-center gap-2">
              {project.company && (
                <CompanyLogo company={project.company} logoUrl={project.companyLogo} size="sm" />
              )}
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-medium">
                {project.date.toUpperCase()}
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              {project.title}
            </h2>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm font-mono text-slate-500 dark:text-slate-400">
              {project.subtitle}
            </p>

            {/* Single clean button to open details */}
            <div className="pt-1.5">
              <button
                onClick={() => onSelect(project)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-mono font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <span>View Project Details</span>
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* 3D Model: Shifts sideways in center focus, silky smooth 60fps transform */}
        <motion.div
          initial={false}
          animate={{
            x: isActive ? (typeof window !== 'undefined' && window.innerWidth >= 768 ? 160 : 0) : 0,
          }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex items-center justify-center overflow-visible will-change-transform"
        >
          <div className="w-full max-w-2xl flex items-center justify-center overflow-visible">
            <ModelViewer
              modelType={project.modelType}
              isActive={isActive}
              className="h-[480px] sm:h-[560px] w-full"
            />
          </div>
        </motion.div>

      </div>
    </section>
  );
};
