import React, { useEffect, useCallback } from 'react';
import { Project } from '../types/project';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TimelineRulerProps {
  projects: Project[];
  activeId: string | null;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ projects, activeId }) => {
  const targetProgress = useMotionValue(0);
  
  // High-performance spring interpolation with calibrated damping
  const smoothProgress = useSpring(targetProgress, {
    stiffness: 260,
    damping: 28,
    restDelta: 0.0001,
  });

  const topPercent = useTransform(smoothProgress, (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`);

  const updateProgress = useCallback(() => {
    const n = projects.length;
    if (n <= 1) {
      targetProgress.set(0);
      return;
    }

    const viewportCenter = window.innerHeight / 2;
    const projectCenters: number[] = [];

    for (let i = 0; i < n; i++) {
      const el = document.getElementById(`project-${projects[i].id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        projectCenters.push(rect.top + rect.height / 2);
      } else {
        projectCenters.push(0);
      }
    }

    // Above the first project (header area)
    if (projectCenters[0] >= viewportCenter) {
      targetProgress.set(0);
      return;
    }

    // Below the last project (footer area)
    if (projectCenters[n - 1] <= viewportCenter) {
      targetProgress.set(1);
      return;
    }

    // Find which two projects we are currently between and smoothly interpolate
    for (let i = 0; i < n - 1; i++) {
      const topCenter = projectCenters[i];
      const bottomCenter = projectCenters[i + 1];

      if (topCenter <= viewportCenter && viewportCenter <= bottomCenter) {
        const span = bottomCenter - topCenter;
        const ratio = span > 0 ? (viewportCenter - topCenter) / span : 0;
        const fractionalIndex = i + ratio;
        targetProgress.set(fractionalIndex / (n - 1));
        return;
      }
    }
  }, [projects, targetProgress]);

  useEffect(() => {
    let animationFrameId: number;

    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    updateProgress();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [updateProgress]);

  const scrollToProject = (id: string) => {
    const el = document.getElementById(`project-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Helper to format ruler date label
  const formatRulerDate = (dateStr: string) => {
    const parts = dateStr.includes('–') ? dateStr.split('–')[1].trim().split(' ') : dateStr.split(' ');
    const month = parts[0] || '';
    const year = parts[1] ? `'${parts[1].slice(2)}` : '';
    return { month, year };
  };

  return (
    <aside className="fixed left-4 sm:left-8 top-28 bottom-16 w-16 z-20 hidden md:flex flex-col justify-between select-none pointer-events-none font-mono text-[10px]">
      {/* Dynamic Vertical Ruler Track */}
      <div className="relative h-full w-full py-2">
        {/* Track Line Container (matches milestone button vertical centers) */}
        <div className="absolute left-[12px] -translate-x-1/2 top-2 bottom-2 w-[1.5px] bg-slate-200 dark:bg-slate-800 rounded-full" />

        {/* Dynamic Smooth Spring Cursor Indicator Dot */}
        <div className="absolute left-0 right-0 top-2 bottom-2 pointer-events-none">
          <motion.div
            className="absolute left-[12px] -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center z-20"
            style={{ top: topPercent }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-slate-200 ring-4 ring-blue-500/25 dark:ring-slate-400/25 shadow-sm transition-transform duration-200 hover:scale-125" />
          </motion.div>
        </div>

        {/* Date Milestones along the Ruler */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between pointer-events-auto pl-5">
          {projects.map((project) => {
            const isActive = project.id === activeId;
            const { month, year } = formatRulerDate(project.date);

            return (
              <button
                key={project.id}
                onClick={() => scrollToProject(project.id)}
                className={`group flex items-center text-left transition-all py-0.5 cursor-pointer ${
                  isActive
                    ? 'text-blue-600 dark:text-slate-100 font-bold scale-105'
                    : 'text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <div className="flex flex-col leading-none">
                  <span className="text-[9px] tracking-tighter">
                    {month}
                  </span>
                  <span className="text-[10px] font-semibold">
                    {year}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
