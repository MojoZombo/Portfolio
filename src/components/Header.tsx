import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, FileText, MapPin, GraduationCap, Mail, Linkedin, ArrowUpRight } from 'lucide-react';

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
            <p className="text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 font-semibold">
              Mechanical Engineer @ Blue Origin · UC Berkeley M.S. Mechanical Engineering
            </p>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
              Mechanical Engineer at Blue Origin designing actuation mechanisms for the Blue Moon Lunar Lander MK II. UC Berkeley M.S. and B.S. in Mechanical Engineering with experience spanning Tesla, Sentien Robotics, Raise Robotics, and Group14 Technologies specializing in electromechanical mechanisms and robotics.
            </p>
            
            {/* Quick contact / education tags */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} className="text-slate-400 dark:text-slate-500" />
                <span>Seattle, WA</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap size={13} className="text-slate-400 dark:text-slate-500" />
                <span>UC Berkeley M.S. ME ('25)</span>
              </span>
              <a
                href="mailto:fann@berkeley.edu"
                className="hover:text-blue-500 hover:underline underline-offset-2 inline-flex items-center gap-1.5"
              >
                <Mail size={12} className="text-slate-400 dark:text-slate-500" />
                <span>fann@berkeley.edu</span>
              </a>
              <a
                href="https://linkedin.com/in/jadenfann"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-4 decoration-blue-500/60 hover:decoration-blue-500 font-semibold"
              >
                <Linkedin size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span>LinkedIn</span>
                <ArrowUpRight size={11} className="opacity-80" />
              </a>
            </div>
          </div>

          {/* Quick Action Links & Theme Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs shrink-0">
            <a
              href="#resume"
              onClick={() => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-slate-900 hover:bg-blue-600 text-white dark:bg-slate-100 dark:hover:bg-blue-500 dark:text-slate-900 dark:hover:text-white font-medium cursor-pointer"
            >
              <FileText size={13} />
              <span>Resume</span>
            </a>

            <button
              onClick={toggleTheme}
              className="p-2 rounded bg-slate-200 hover:bg-blue-600 text-slate-900 hover:text-white border border-slate-300 dark:border-slate-700/80 dark:bg-slate-800 dark:hover:bg-blue-500 dark:text-slate-200 dark:hover:text-white cursor-pointer"
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
