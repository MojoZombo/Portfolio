import React, { useEffect, useRef, useState } from 'react';
import { Project } from '../types/project';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { ArrowUpRight, X } from 'lucide-react';

interface ProjectIndexProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (project: Project, index: number) => void;
}

export const ProjectIndex: React.FC<ProjectIndexProps> = ({
  isOpen,
  onClose,
  projects,
  activeProjectId,
  onSelectProject,
}) => {
  const activeRowRef = useRef<HTMLButtonElement | null>(null);
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
                ? { y: '100%' }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            animate={
              isMobile
                ? { y: 0 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={
              isMobile
                ? { y: '100%' }
                : { opacity: 0, y: -6, scale: 0.98 }
            }
            transition={
              isMobile
                ? { duration: 0.26, ease: [0.16, 1, 0.3, 1] }
                : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }
            }
            className="fixed z-[45] inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-[92px] md:top-[106px] sm:right-6 lg:right-14 min-[1440px]:right-[72px] sm:w-[300px] max-h-[78dvh] sm:max-h-[calc(100vh-124px)] flex flex-col rounded-t-2xl sm:rounded-xl overflow-hidden bg-white dark:bg-[#0c121e] text-slate-900 dark:text-slate-100"
          >
            {/* Mobile-only concise draggable header */}
            <div
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                dragControls.start(e);
              }}
              className="sm:hidden bg-slate-100 dark:bg-slate-950 px-3 pt-1.5 pb-1.5 shrink-0 select-none touch-none cursor-grab active:cursor-grabbing"
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
                const metaLabel = project.company
                  ? `${project.company} · ${project.date}`
                  : project.date;

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
                      <div className="text-[10px] font-mono leading-tight text-slate-500 dark:text-slate-400 truncate">
                        {metaLabel}
                      </div>
                    </div>

                    {isActive ? (
                      <span
                        aria-hidden="true"
                        className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"
                      />
                    ) : (
                      <ArrowUpRight
                        size={12}
                        className="text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 shrink-0 transition-colors"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
