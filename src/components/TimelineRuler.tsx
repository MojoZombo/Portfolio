import React, { useEffect, useState } from 'react';
import { Project } from '../types/project';

interface TimelineRulerProps {
  projects: Project[];
  activeId: string | null;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ projects, activeId }) => {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress(Math.min(1, Math.max(0, window.scrollY / totalScroll)));
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToProject = (id: string) => {
    const el = document.getElementById(`project-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Helper to format ruler date label
  const formatRulerDate = (dateStr: string) => {
    // If range like "Aug 2024 – Dec 2024", take the end date "Dec 2024" or year
    const parts = dateStr.includes('–') ? dateStr.split('–')[1].trim().split(' ') : dateStr.split(' ');
    const month = parts[0] || '';
    const year = parts[1] ? `'${parts[1].slice(2)}` : '';
    return { month, year };
  };

  return (
    <aside className="fixed left-4 sm:left-8 top-28 bottom-16 w-16 z-20 hidden md:flex flex-col justify-between select-none pointer-events-none font-mono text-[10px]">
      {/* Dynamic Vertical Ruler Track */}
      <div className="relative h-full w-full">
        {/* Continuous Hairline Ruler Track Line */}
        <div className="absolute left-[12px] -translate-x-1/2 top-0 bottom-0 w-[1.5px] bg-slate-300 dark:bg-slate-800" />

        {/* Dynamic Moving Cursor Indicator Dot */}
        <div
          className="absolute left-[12px] -translate-x-1/2 w-6 h-6 -translate-y-1/2 flex items-center justify-center transition-all duration-150 ease-out z-20 pointer-events-none"
          style={{ top: `${scrollProgress * 100}%` }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-slate-300 ring-4 ring-blue-500/20 dark:ring-slate-400/20" />
        </div>

        {/* Date Milestones along the Ruler */}
        <div className="relative z-10 w-full h-full flex flex-col justify-between py-2 pointer-events-auto pl-5">
          {projects.map((project) => {
            const isActive = project.id === activeId;
            const { month, year } = formatRulerDate(project.date);

            return (
              <button
                key={project.id}
                onClick={() => scrollToProject(project.id)}
                className={`group flex items-center text-left transition-all py-0.5 ${
                  isActive
                    ? 'text-blue-600 dark:text-slate-200 font-bold scale-105'
                    : 'text-slate-400 dark:text-slate-600 hover:text-slate-700 dark:hover:text-slate-400'
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
