import React from 'react';
import { Project } from '../types/project';

interface QuickNavProps {
  projects: Project[];
}

export const QuickNav: React.FC<QuickNavProps> = ({ projects }) => {
  const years = Array.from(new Set(projects.map((p) => p.year))).sort((a, b) => b - a);

  const scrollToYear = (year: number) => {
    const firstProject = projects.find((p) => p.year === year);
    if (firstProject) {
      const el = document.getElementById(`project-${firstProject.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav className="fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-30 hidden xl:flex flex-col items-end gap-2 font-mono text-[11px] select-none">
      <div className="p-2 rounded-lg bg-white/80 dark:bg-cad-surface/80 backdrop-blur-md border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col items-center gap-3">
        <button
          onClick={scrollToTop}
          className="text-slate-400 hover:text-blue-500 transition-colors p-1"
          title="Scroll to Top"
        >
          ▲
        </button>

        <div className="w-4 h-px bg-slate-200 dark:bg-slate-700" />

        {years.map((year) => (
          <button
            key={year}
            onClick={() => scrollToYear(year)}
            className="px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 transition-all"
          >
            {year}
          </button>
        ))}
      </div>
    </nav>
  );
};
