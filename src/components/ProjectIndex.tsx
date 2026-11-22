import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Project } from '../types/project';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { X } from 'lucide-react';

interface ProjectIndexProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (project: Project, index: number) => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

const DESKTOP_PANEL_WIDTH = 300;
const DESKTOP_ANCHOR_GAP = 10;
const DESKTOP_VIEWPORT_PAD = 16;
const DESKTOP_BOTTOM_PAD = 18;
const HEADER_TRACK_DURATION_MS = 560;

function measureDesktopAnchorPosition(anchorEl: HTMLElement | null): {
  top: number;
  right: number;
  maxHeight: number;
} {
  if (typeof window === 'undefined') {
    return { top: 96, right: 24, maxHeight: 540 };
  }
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  if (!anchorEl) {
    return {
      top: 96,
      right: 24,
      maxHeight: Math.max(200, window.innerHeight - 114),
    };
  }
  const rect = anchorEl.getBoundingClientRect();
  const rawRight = viewportWidth - rect.right;
  const right = Math.max(
    DESKTOP_VIEWPORT_PAD,
    Math.min(viewportWidth - DESKTOP_PANEL_WIDTH - DESKTOP_VIEWPORT_PAD, Math.round(rawRight))
  );
  const top = Math.max(DESKTOP_VIEWPORT_PAD, Math.round(rect.bottom + DESKTOP_ANCHOR_GAP));
  const maxHeight = Math.max(200, Math.round(window.innerHeight - top - DESKTOP_BOTTOM_PAD));
  return { top, right, maxHeight };
}

export const ProjectIndex: React.FC<ProjectIndexProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
  anchorRef,
}) => {
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragControls = useDragControls();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const updateViewport = () => {
      setIsMobile(typeof window !== 'undefined' ? window.innerWidth < 640 : false);
    };
    updateViewport();
    window.addEventListener('resize', updateViewport, { passive: true });
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useLayoutEffect(() => {
    const clearDesktopStyles = () => {
      const panel = panelRef.current;
      if (!panel) return;
      panel.style.top = '';
      panel.style.right = '';
      panel.style.maxHeight = '';
    };

    if (!isOpen || isMobile) {
      clearDesktopStyles();
      return;
    }

    const applyPosition = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const { top, right, maxHeight } = measureDesktopAnchorPosition(anchorRef?.current ?? null);
      panel.style.top = `${top}px`;
      panel.style.right = `${right}px`;
      panel.style.maxHeight = `${maxHeight}px`;
    };

    applyPosition();

    let rafId = 0;
    let trackingUntil = 0;

    const stepTracking = () => {
      applyPosition();
      if (performance.now() < trackingUntil) {
        rafId = window.requestAnimationFrame(stepTracking);
      } else {
        rafId = 0;
      }
    };

    const startTracking = () => {
      trackingUntil = performance.now() + HEADER_TRACK_DURATION_MS;
      if (!rafId) {
        rafId = window.requestAnimationFrame(stepTracking);
      }
    };

    // Track Header's 500ms translate3d transition if opened right after a scroll transition or scrolled while open
    startTracking();

    const handleScroll = () => {
      startTracking();
    };
    const handleResize = () => {
      applyPosition();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      clearDesktopStyles();
    };
  }, [isOpen, isMobile, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    if (isMobile) {
      document.body.style.overflow = 'hidden';
    }

    const rafId = window.requestAnimationFrame(() => {
      activeRowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
      if (isMobile) {
        document.body.style.overflow = prevOverflow;
      }
    };
  }, [isOpen, isMobile, onClose]);

  const initialDesktopPos =
    isOpen && !isMobile ? measureDesktopAnchorPosition(anchorRef?.current ?? null) : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="project-index-backdrop"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 z-[45] sm:z-[38] bg-slate-900/25 dark:bg-black/55 backdrop-blur-[2px]"
          />

          <motion.div
            ref={panelRef}
            key="project-index-panel"
            role="dialog"
            aria-modal={isMobile}
            aria-label="Project list"
            drag={isMobile ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 1 }}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if (isMobile && (info.offset.y > 72 || info.velocity.y > 420)) {
                onClose();
              }
            }}
            initial={
              isMobile
                ? { y: '100%', opacity: 1, scale: 1 }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            animate={
              isMobile
                ? { y: 0, opacity: 1, scale: 1 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              isMobile
                ? { y: '100%', opacity: 1, scale: 1 }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            transition={
              isMobile
                ? { duration: 0.26, ease: [0.16, 1, 0.3, 1] }
                : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
            }
            style={
              !isMobile && initialDesktopPos
                ? {
                    top: `${initialDesktopPos.top}px`,
                    right: `${initialDesktopPos.right}px`,
                    maxHeight: `${initialDesktopPos.maxHeight}px`,
                    transformOrigin: 'top right',
                  }
                : undefined
            }
            className="fixed z-[46] inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:w-[300px] max-h-[78dvh] flex flex-col rounded-t-2xl sm:rounded-xl overflow-visible sm:overflow-hidden bg-white dark:bg-[#0c121e] text-slate-900 dark:text-slate-100"
          >
            {/* Mobile-only concise draggable header */}
            <div
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                dragControls.start(e);
              }}
              className="sm:hidden rounded-t-2xl bg-slate-100 dark:bg-slate-950 px-3 pt-1.5 pb-1.5 shrink-0 select-none touch-none cursor-grab active:cursor-grabbing"
            >
              <div
                aria-hidden="true"
                className="w-8 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mb-1.5"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-slate-800 dark:text-slate-100">
                  Projects
                </span>

                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close project list"
                  title="Close"
                  className="btn-ripple w-7 h-7 p-0 flex items-center justify-center rounded text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Project Rows */}
            <nav
              aria-label="Jump to project"
              className="overflow-y-auto overscroll-contain p-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-1"
            >
              {projects.map((project, index) => {
                const isActive = project.id === activeProjectId;

                return (
                  <button
                    key={project.id}
                    ref={isActive ? activeRowRef : undefined}
                    type="button"
                    onClick={() => onSelectProject(project, index)}
                    className={`group w-full text-left flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isActive
                        ? 'bg-slate-100 dark:bg-slate-800/90'
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold leading-tight text-slate-900 dark:text-slate-100 truncate">
                        {project.title}
                      </div>
                      {project.company && (
                        <div className="text-[10px] font-mono leading-tight text-slate-500 dark:text-slate-400 truncate">
                          {project.company}
                        </div>
                      )}
                    </div>

                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Solid overscroll skirt so pulling the mobile sheet upward continues the list background instead of showing backdrop */}
            <div
              aria-hidden="true"
              className="sm:hidden absolute left-0 right-0 top-[calc(100%-1px)] h-40 bg-white dark:bg-[#0c121e] pointer-events-none"
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
