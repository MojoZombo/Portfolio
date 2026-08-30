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
  const offsetsRef = React.useRef<{ centerDocY: number }[]>([]);

  // Cache absolute document centers on resize or DOM change (ZERO reflows during active scroll)
  const measureOffsets = useCallback(() => {
    const n = projects.length;
    const list: { centerDocY: number }[] = [];
    for (let i = 0; i < n; i++) {
      const el = document.getElementById(`project-${projects[i].id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const docTop = rect.top + window.scrollY;
        list.push({ centerDocY: docTop + rect.height / 2 });
      } else {
        list.push({ centerDocY: 0 });
      }
    }
    offsetsRef.current = list;
  }, [projects]);

  const updateProgress = useCallback(() => {
    const n = projects.length;
    if (n <= 1) {
      targetProgress.set(0);
      return;
    }

    if (offsetsRef.current.length === 0) {
      measureOffsets();
    }

    const currentDocCenter = (window.scrollY || window.pageYOffset || 0) + window.innerHeight / 2;
    const list = offsetsRef.current;
    if (!list || list.length < n) return;

    // Above the first project
    if (currentDocCenter <= list[0].centerDocY) {
      targetProgress.set(0);
      return;
    }

    // Below the last project
    if (currentDocCenter >= list[n - 1].centerDocY) {
      targetProgress.set(1);
      return;
    }

    // Binary search / bracket search for current interval
    for (let i = 0; i < n - 1; i++) {
      const topCenter = list[i].centerDocY;
      const bottomCenter = list[i + 1].centerDocY;

      if (topCenter <= currentDocCenter && currentDocCenter <= bottomCenter) {
        const span = bottomCenter - topCenter;
        const ratio = span > 0 ? (currentDocCenter - topCenter) / span : 0;
        const fractionalIndex = i + ratio;
        targetProgress.set(fractionalIndex / (n - 1));
        return;
      }
    }
  }, [projects, targetProgress, measureOffsets]);

  useEffect(() => {
    let animationFrameId: number;

    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateProgress);
    };

    const handleResize = () => {
      measureOffsets();
      handleScroll();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Initial measure after DOM settles
    measureOffsets();
    updateProgress();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [measureOffsets, updateProgress]);

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
    <aside className="fixed left-0 top-28 bottom-16 w-24 z-20 hidden md:flex flex-col justify-between select-none pointer-events-none font-mono text-[10px]">
      {/* Dynamic Vertical Ruler Track (Positioned on exact 48px grid column) */}
      <div className="relative h-full w-full py-2">
        {/* Track Line Container (exact 48px grid alignment, 1px width) */}
        <div className="absolute left-[48px] -translate-x-1/2 top-2 bottom-2 w-[1px] bg-slate-200 dark:bg-slate-800" />

        {/* Dynamic Smooth Spring Cursor Indicator Dot */}
        <div className="absolute left-0 right-0 top-2 bottom-2 pointer-events-none">
          <motion.div
            className="absolute left-[48px] -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center z-20"
            style={{ top: topPercent }}
          >
            <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-slate-200 ring-2 ring-white dark:ring-slate-900 transition-colors" />
          </motion.div>
        </div>

        {/* Date Milestones along the Ruler */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between pointer-events-auto pl-[58px]">
          {projects.map((project) => {
            const isActive = project.id === activeId;
            const { month, year } = formatRulerDate(project.date);

            return (
              <button
                key={project.id}
                onClick={() => scrollToProject(project.id)}
                className={`group flex items-center text-left transition-colors py-0.5 cursor-pointer ${
                  isActive
                    ? 'text-blue-600 dark:text-slate-100 font-bold'
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
