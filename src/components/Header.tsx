import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, FileText, ExternalLink } from 'lucide-react';

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="relative z-30 w-full bg-transparent pt-10 pb-4 transition-colors">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Jaden Fann
            </h1>
            <p className="text-xs sm:text-sm font-mono text-blue-600 dark:text-blue-400 font-semibold">
              Mechanical Engineer @ Blue Origin // UC Berkeley M.S. Mechanical Engineering
            </p>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
              Mechanical Engineer at Blue Origin designing actuation mechanisms for the Blue Moon Lunar Lander MK II. UC Berkeley M.S. and B.S. in Mechanical Engineering with experience spanning Tesla, Sentien Robotics, Raise Robotics, and Group14 Technologies specializing in electromechanical mechanisms, robotics, and design for manufacturing.
            </p>
            
            {/* Quick contact / education tags */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              <span>📍 Seattle, WA</span>
              <span>🎓 UC Berkeley M.S. ME ('25)</span>
              <a
                href="mailto:fann@berkeley.edu"
                className="hover:text-blue-500 transition-colors"
              >
                ✉️ fann@berkeley.edu
              </a>
              <a
                href="https://linkedin.com/in/jadenfann"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-blue-500 transition-colors inline-flex items-center gap-0.5"
              >
                <span>🔗 LinkedIn</span>
              </a>
            </div>
          </div>

          {/* Quick Action Links & Theme Toggle */}
          <div className="flex items-center gap-3 font-mono text-xs shrink-0">
            <a
              href="./Jaden_Fann_Resume.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-medium transition-colors shadow-sm cursor-pointer"
            >
              <FileText size={13} />
              <span>Resume PDF</span>
            </a>

            <a
              href="https://showspace.so/s/jadenfann"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors"
            >
              <ExternalLink size={13} />
              <span>Showspace</span>
            </a>

            <button
              onClick={toggleTheme}
              className="p-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
              title="Toggle Light / Dark Mode"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
