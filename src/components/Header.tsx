import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, FileText, MapPin, GraduationCap, Mail, Linkedin, ArrowUpRight } from 'lucide-react';

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  const titleAnchorRef = useRef<HTMLDivElement>(null);
  const buttonsAnchorRef = useRef<HTMLDivElement>(null);
  const fixedTitleRef = useRef<HTMLDivElement>(null);
  const fixedButtonsRef = useRef<HTMLDivElement>(null);
  const titleBackdropRef = useRef<HTMLDivElement>(null);

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let animId: number;

    const updatePositions = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const scrolled = scrollY > 12;
      setIsScrolled(scrolled);

      const titleAnchor = titleAnchorRef.current;
      const buttonsAnchor = buttonsAnchorRef.current;
      const fixedTitle = fixedTitleRef.current;
      const fixedButtons = fixedButtonsRef.current;

      if (!titleAnchor || !buttonsAnchor || !fixedTitle || !fixedButtons) return;

      const titleRect = titleAnchor.getBoundingClientRect();
      const buttonsRect = buttonsAnchor.getBoundingClientRect();
      const buttonsWidth = buttonsRect.width || 125;

      const width = window.innerWidth;
      const isMobile = width < 640;
      const isTablet = width >= 640 && width < 1024;
      const isDesktop = width >= 1024 && width < 1440;

      // Spaced further away from the top on big screens (48-50px like francescomichelini.com)
      const cornerTop = isMobile ? 16 : isTablet ? 28 : isDesktop ? 44 : 50;

      // Brought closer to center projects from the sides of the screen
      const cornerLeft = isMobile ? 16 : isTablet ? 24 : isDesktop ? 56 : 72;
      const cornerRight = isMobile ? 16 : isTablet ? 24 : isDesktop ? 56 : 72;

      const targetButtonsX = width - cornerRight - buttonsWidth;

      if (scrolled) {
        // Slide smoothly to the spaced corner targets
        fixedTitle.style.transform = `translate3d(${cornerLeft}px, ${cornerTop}px, 0)`;
        fixedButtons.style.transform = `translate3d(${targetButtonsX}px, ${cornerTop}px, 0)`;

        if (titleBackdropRef.current) {
          titleBackdropRef.current.style.opacity = '1';
          titleBackdropRef.current.style.backdropFilter = 'blur(12px)';
          titleBackdropRef.current.style.setProperty('-webkit-backdrop-filter', 'blur(12px)');
        }
      } else {
        // Return smoothly to original header position above description
        fixedTitle.style.transform = `translate3d(${titleRect.left.toFixed(2)}px, ${titleRect.top.toFixed(2)}px, 0)`;
        fixedButtons.style.transform = `translate3d(${buttonsRect.left.toFixed(2)}px, ${buttonsRect.top.toFixed(2)}px, 0)`;

        if (titleBackdropRef.current) {
          titleBackdropRef.current.style.opacity = '0';
          titleBackdropRef.current.style.backdropFilter = 'none';
          titleBackdropRef.current.style.setProperty('-webkit-backdrop-filter', 'none');
        }
      }
    };

    const handleScroll = () => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(updatePositions);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    updatePositions();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const handleTitleClick = () => {
    if (window.scrollY > 12) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Fixed Floating Name that slides smoothly to the top-left */}
      <div
        ref={fixedTitleRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 40 }}
        className="pointer-events-none will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <div
          onClick={handleTitleClick}
          className={`relative pointer-events-auto inline-flex items-center px-2.5 py-1 -mx-2.5 -my-1 rounded-lg ${
            isScrolled ? 'cursor-pointer select-none' : 'select-text'
          }`}
          title={isScrolled ? 'Click to scroll to top' : undefined}
        >
          {/* Subtle backdrop layer active only when scrolled in the corner */}
          <div
            ref={titleBackdropRef}
            className="absolute inset-0 rounded-lg bg-slate-50/90 dark:bg-[#141C28]/90 pointer-events-none opacity-0 transition-opacity duration-300"
          />
          <h1 className="relative z-10 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Jaden Fann
          </h1>
        </div>
      </div>

      {/* Fixed Floating Buttons that slide smoothly to the top-right - No separate background */}
      <div
        ref={fixedButtonsRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 40 }}
        className="pointer-events-none will-change-transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="pointer-events-auto flex items-center gap-2.5 font-mono text-xs shrink-0">
          <a
            href="#resume"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.hash !== '#resume') {
                window.history.pushState(null, '', '#resume');
                window.dispatchEvent(new HashChangeEvent('hashchange'));
              }
            }}
            className="btn-ripple inline-flex items-center gap-1.5 px-3 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium cursor-pointer"
          >
            <FileText size={13} />
            <span>Resume</span>
          </a>

          <button
            onClick={toggleTheme}
            data-theme-toggle="true"
            className="btn-ripple w-[30px] h-[30px] p-0 flex items-center justify-center rounded bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            title="Toggle Light / Dark Mode"
          >
            {theme === 'dark' ? <Sun size={14} className="pointer-events-none" /> : <Moon size={14} className="pointer-events-none" />}
          </button>
        </div>
      </div>

      {/* Main Header Container in document flow - spaced generously from top on big screens */}
      <header className="relative z-30 w-full bg-transparent pt-10 sm:pt-14 md:pt-16 pb-4 pointer-events-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pointer-events-auto">
          {/* Top Row: Always Name on the Left, Buttons on the Right regardless of screen size */}
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Anchor Placeholder for Title to maintain exact height and alignment */}
            <div ref={titleAnchorRef} className="invisible select-none pointer-events-none">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                Jaden Fann
              </h1>
            </div>

            {/* Anchor Placeholder for Buttons - stays strictly on the right */}
            <div ref={buttonsAnchorRef} className="invisible select-none pointer-events-none flex items-center gap-2.5 font-mono text-xs shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded">
                <FileText size={13} />
                <span>Resume</span>
              </div>
              <div className="w-[30px] h-[30px] flex items-center justify-center rounded">
                <Sun size={14} />
              </div>
            </div>
          </div>

          {/* Description & Contact Tags in normal document flow below the top row */}
          <div className="space-y-2 max-w-2xl pt-2">
            {/* Subtitle in normal document flow - scrolls up naturally */}
            <p className="text-xs sm:text-sm font-mono text-slate-700 dark:text-slate-300 font-semibold">
              Mechanical Engineer @ Blue Origin · UC Berkeley M.S. Mechanical Engineering
            </p>

            {/* Bio in normal document flow - scrolls up naturally */}
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
              Mechanical Engineer at Blue Origin designing actuation mechanisms for the Blue Moon Lunar Lander MK II. UC Berkeley M.S. and B.S. in Mechanical Engineering with experience spanning Tesla, Sentien Robotics, Raise Robotics, and Group14 Technologies specializing in electromechanical mechanisms and robotics.
            </p>

            {/* Quick contact / education tags in normal document flow */}
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
        </div>
      </header>
    </>
  );
};
