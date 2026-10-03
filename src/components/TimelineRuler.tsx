import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Project } from '../types/project';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface TimelineRulerProps {
  projects: Project[];
  activeId: string | null;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ projects, activeId }) => {
  const rulerRef = useRef<HTMLElement>(null);
  const [isOverlapping, setIsOverlapping] = useState(false);
  const [trackLeft, setTrackLeft] = useState(72);
  const targetProgress = useMotionValue(0);
  
  // High-performance spring interpolation with calibrated damping
  const smoothProgress = useSpring(targetProgress, {
    stiffness: 260,
    damping: 28,
    restDelta: 0.0001,
  });

  const topPercent = useTransform(smoothProgress, (v: number) => `${Math.min(100, Math.max(0, v * 100))}%`);
  const offsetsRef = React.useRef<{ centerDocY: number }[]>([]);

  // Calculate dynamic track position closer to center projects
  const updateTrackPosition = useCallback(() => {
    const width = window.innerWidth;
    // On wide screens (>= 1440px): 72px; on standard desktop (1024-1439px): 56px; on tablet: 48px
    const pos = width >= 1440 ? 72 : width >= 1024 ? 56 : 48;
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

  const checkOverlap = useCallback(() => {
    const rulerEl = rulerRef.current;
    if (!rulerEl) return;

    const rulerRect = rulerEl.getBoundingClientRect();
    if (rulerRect.width === 0 || rulerRect.height === 0) return;

    // Buffer margin so ruler fades out cleanly before text directly touches it
    const margin = 12;
    const rulerTop = rulerRect.top - margin;
    const rulerBottom = rulerRect.bottom + margin;
    const rulerLeft = rulerRect.left - margin;
    // Active content boundary is calibrated to trackLeft + milestone text width (~48px)
    const contentRight = rulerRect.left + trackLeft + 48;
    const rulerRight = Math.min(rulerRect.right, contentRight) + margin;

    // Text elements across header and main that could overlap with the timeline
    const textEls = document.querySelectorAll(
      'header p, header span, header a, main h2, main p, main span, main button, main a'
    );

    let overlap = false;
    for (let i = 0; i < textEls.length; i++) {
      const el = textEls[i] as HTMLElement;
      if (!el.offsetParent && el.offsetWidth === 0 && el.offsetHeight === 0) continue;

      const rect = el.getBoundingClientRect();
      // Skip elements outside the vertical viewport
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;

      const intersectsX = rect.left < rulerRight && rect.right > rulerLeft;
      const intersectsY = rect.top < rulerBottom && rect.bottom > rulerTop;

      if (intersectsX && intersectsY) {
        overlap = true;
        break;
      }
    }

    setIsOverlapping(overlap);
  }, [trackLeft]);

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

    const handleUpdate = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        updateProgress();
        checkOverlap();
      });
    };

    const handleResize = () => {
      updateTrackPosition();
      measureOffsets();
      handleUpdate();
    };

    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    // Initial setup
    updateTrackPosition();
    measureOffsets();
    handleUpdate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleResize);
    };
  }, [measureOffsets, updateProgress, checkOverlap, updateTrackPosition]);

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
    <aside
      ref={rulerRef}
      className={`fixed left-0 top-36 md:top-40 bottom-16 w-32 z-30 hidden md:flex flex-col justify-between select-none pointer-events-none font-mono text-[10px] transition-opacity duration-300 ease-out ${
        isOverlapping ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Dynamic Vertical Ruler Track - Positioned closer to center projects */}
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
                key={project.id}
                onClick={() => scrollToProject(project.id)}
                className={`group flex items-center text-left transition-colors py-0.5 cursor-pointer w-fit self-start ${
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
