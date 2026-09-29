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
  const buttonsBackdropRef = useRef<HTMLDivElement>(null);

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let animId: number;

    const updatePositions = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      setIsScrolled(scrollY > 20);

      const titleAnchor = titleAnchorRef.current;
      const buttonsAnchor = buttonsAnchorRef.current;
      const fixedTitle = fixedTitleRef.current;
      const fixedButtons = fixedButtonsRef.current;

      if (!titleAnchor || !buttonsAnchor || !fixedTitle || !fixedButtons) return;

      const titleRect = titleAnchor.getBoundingClientRect();
      const buttonsRect = buttonsAnchor.getBoundingClientRect();
      const buttonsWidth = buttonsRect.width || 120;

      // Responsive corner targets
      const width = window.innerWidth;
      const isMobile = width < 640;
      const isTablet = width >= 640 && width < 1024;
      const cornerLeft = isMobile ? 16 : isTablet ? 24 : 32;
      const cornerRight = isMobile ? 16 : isTablet ? 24 : 32;
      const cornerTop = isMobile ? 16 : isTablet ? 20 : 24;

      // Scroll interpolation threshold (in pixels)
      const threshold = 75;
      const progress = Math.min(1, Math.max(0, scrollY / threshold));
      // Smooth cubic ease-in-out
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Document-relative coordinates when scrollY was 0
      const titleDocTop = titleRect.top + scrollY;
      const titleDocLeft = titleRect.left;

      const buttonsDocTop = buttonsRect.top + scrollY;
      const buttonsDocLeft = buttonsRect.left;
      const targetButtonsX = width - cornerRight - buttonsWidth;

      // Current on-screen targets
      const currentTitleX = titleDocLeft * (1 - ease) + cornerLeft * ease;
      const currentTitleY = (titleDocTop - scrollY) * (1 - ease) + cornerTop * ease;

      const currentButtonsX = buttonsDocLeft * (1 - ease) + targetButtonsX * ease;
      const currentButtonsY = (buttonsDocTop - scrollY) * (1 - ease) + cornerTop * ease;

      // Hardware-accelerated GPU transforms
      fixedTitle.style.transform = `translate3d(${currentTitleX.toFixed(2)}px, ${currentTitleY.toFixed(2)}px, 0)`;
      fixedButtons.style.transform = `translate3d(${currentButtonsX.toFixed(2)}px, ${currentButtonsY.toFixed(2)}px, 0)`;

      // Dynamic corner backdrop fade
      if (titleBackdropRef.current && buttonsBackdropRef.current) {
        const bgOpacity = (ease * 0.9).toFixed(3);
        const blurAmount = (ease * 12).toFixed(1);
        titleBackdropRef.current.style.opacity = bgOpacity;
        buttonsBackdropRef.current.style.opacity = bgOpacity;
        titleBackdropRef.current.style.backdropFilter = ease > 0.05 ? `blur(${blurAmount}px)` : 'none';
        buttonsBackdropRef.current.style.backdropFilter = ease > 0.05 ? `blur(${blurAmount}px)` : 'none';
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
    if (window.scrollY > 20) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* Fixed Floating Name that slides to the top-left corner */}
      <div
        ref={fixedTitleRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 40 }}
        className="pointer-events-none will-change-transform"
      >
        <div
          onClick={handleTitleClick}
          className={`relative pointer-events-auto select-none inline-flex items-center px-2.5 py-1 -mx-2.5 -my-1 rounded-lg ${
            isScrolled ? 'cursor-pointer' : ''
          }`}
          title={isScrolled ? 'Click to scroll to top' : undefined}
        >
          {/* Subtle backdrop layer active in the corner */}
          <div
            ref={titleBackdropRef}
            className="absolute inset-0 rounded-lg bg-slate-50/90 dark:bg-[#141C28]/90 pointer-events-none opacity-0 transition-opacity duration-150"
          />
          <h1 className="relative z-10 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Jaden Fann
          </h1>
        </div>
      </div>

      {/* Fixed Floating Buttons that slide to the top-right corner */}
      <div
        ref={fixedButtonsRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 40 }}
        className="pointer-events-none will-change-transform"
      >
        <div className="relative pointer-events-auto flex items-center gap-2.5 font-mono text-xs px-2 py-1 -mx-2 -my-1 rounded-lg">
          {/* Subtle backdrop layer active in the corner */}
          <div
            ref={buttonsBackdropRef}
            className="absolute inset-0 rounded-lg bg-slate-50/90 dark:bg-[#141C28]/90 pointer-events-none opacity-0 transition-opacity duration-150"
          />
          <a
            href="#resume"
            onClick={() => {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }}
            className="relative z-10 btn-ripple inline-flex items-center gap-1.5 px-3 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium cursor-pointer"
          >
            <FileText size={13} />
            <span>Resume</span>
          </a>

          <button
            onClick={toggleTheme}
            className="relative z-10 btn-ripple p-2 rounded bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            title="Toggle Light / Dark Mode"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Main Header Container in document flow */}
      <header className="relative z-30 w-full bg-transparent pt-10 pb-4 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              {/* Anchor Placeholder for Title to maintain exact height and alignment */}
              <div ref={titleAnchorRef} className="invisible select-none pointer-events-none">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  Jaden Fann
                </h1>
              </div>

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

            {/* Anchor Placeholder for Buttons */}
            <div ref={buttonsAnchorRef} className="invisible select-none pointer-events-none flex items-center gap-2.5 font-mono text-xs shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded">
                <FileText size={13} />
                <span>Resume</span>
              </div>
              <div className="p-2 rounded">
                <Sun size={14} />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
};
