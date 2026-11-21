import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Project } from '../types/project';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TimelineRulerProps {
  projects: Project[];
  activeId: string | null;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ projects, activeId }) => {
  const [trackLeft, setTrackLeft] = useState(72);
  const targetProgress = useMotionValue(0);

  // High-performance spring interpolation with calibrated damping
  const smoothProgress = useSpring(targetProgress, {
    stiffness: 260,
    damping: 28,
    restDelta: 0.0001,
  });

  const topPercent = useTransform(smoothProgress, (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`);
  const offsetsRef = useRef<{ centerDocY: number }[]>([]);

  // Calculate dynamic track position closer to center projects
  const updateTrackPosition = useCallback(() => {
    const width = window.innerWidth;
    const pos = width >= 1440 ? 72 : width >= 1280 ? 52 : 44;
    setTrackLeft(pos);
  }, []);

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

    if (currentDocCenter <= list[0].centerDocY) {
      targetProgress.set(0);
      return;
    }

    if (currentDocCenter >= list[n - 1].centerDocY) {
      targetProgress.set(1);
      return;
    }

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
    let animationFrameId = 0;

    const handleUpdate = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 1280) return;

      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        updateProgress();
      });
    };

    const handleResize = () => {
      updateTrackPosition();
      measureOffsets();
      handleUpdate();
    };

    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    updateTrackPosition();
    measureOffsets();
    handleUpdate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleResize);
    };
  }, [measureOffsets, updateProgress, updateTrackPosition]);

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
    <>
      {/* Wide Desktop Fixed Vertical Timeline Ruler */}
      <aside
        aria-label="Project timeline navigation"
        className="fixed left-0 top-36 md:top-40 bottom-16 w-32 z-30 hidden xl:flex flex-col justify-between select-none pointer-events-none font-mono text-[10px]"
      >
        <div className="relative h-full w-full py-2">
          {/* Track Line Container (1px width, smooth spring indicator) */}
          <div
            className="absolute -translate-x-1/2 top-2 bottom-2 w-[1px] bg-slate-200 dark:bg-slate-800 transition-[left] duration-300"
            style={{ left: `${trackLeft}px` }}
          />

          {/* Dynamic Smooth Spring Cursor Indicator Dot */}
          <div className="absolute left-0 right-0 top-2 bottom-2 pointer-events-none">
            <motion.div
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center z-20"
              style={{ left: `${trackLeft}px`, top: topPercent }}
            >
              <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-slate-200 ring-2 ring-white dark:ring-slate-900" />
            </motion.div>
          </div>

          {/* Date Milestones along the Ruler */}
          <div
            className="relative z-10 w-full h-full flex flex-col justify-between pointer-events-auto transition-[padding-left] duration-300"
            style={{ paddingLeft: `${trackLeft + 10}px` }}
          >
            {projects.map((project) => {
              const isActive = project.id === activeId;
              const { month, year } = formatRulerDate(project.date);

              return (
                <button
                  type="button"
                  key={project.id}
                  onClick={() => scrollToProject(project.id)}
                  aria-label={`Jump to ${project.title}`}
                  className={`group relative flex items-center text-left transition-colors py-0.5 cursor-pointer w-fit self-start rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
                  <span className="pointer-events-none absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-sans font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-150">
                    {project.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
};
