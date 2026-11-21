import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, FileText, MapPin, GraduationCap, Mail, Linkedin, ArrowUpRight, Copy, Check } from 'lucide-react';

export const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  const titleAnchorRef = useRef<HTMLDivElement>(null);
  const buttonsAnchorRef = useRef<HTMLDivElement>(null);
  const fixedTitleRef = useRef<HTMLDivElement>(null);
  const fixedButtonsRef = useRef<HTMLDivElement>(null);
  const titleBackdropRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isScrolled, setIsScrolled] = useState(() =>
    typeof window !== 'undefined' ? (window.scrollY || window.pageYOffset || 0) > 12 : false
  );
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    let animId = 0;
    let isCancelled = false;
    let lastScrolledState: boolean | null = null;

    const updatePositions = (force = false, animate = false) => {
      if (isCancelled) return;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const scrolled = scrollY > 12;

      // Skip getBoundingClientRect layout calculations once locked into top corners
      if (!force && scrolled && lastScrolledState === true) {
        return;
      }
      lastScrolledState = scrolled;
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
      const transitionValue = animate ? 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
      fixedTitle.style.transition = transitionValue;
      fixedButtons.style.transition = transitionValue;

      if (scrolled) {
        // Slide smoothly to the spaced corner targets
        fixedTitle.style.transform = `translate3d(${cornerLeft}px, ${cornerTop}px, 0)`;
        fixedButtons.style.transform = `translate3d(${targetButtonsX}px, ${cornerTop}px, 0)`;

        if (titleBackdropRef.current) {
          titleBackdropRef.current.style.transition = animate ? 'opacity 300ms ease' : 'none';
          titleBackdropRef.current.style.opacity = '1';
          titleBackdropRef.current.style.backdropFilter = 'blur(12px)';
          titleBackdropRef.current.style.setProperty('-webkit-backdrop-filter', 'blur(12px)');
        }
      } else {
        // Return smoothly to original header position above description
        fixedTitle.style.transform = `translate3d(${titleRect.left.toFixed(2)}px, ${titleRect.top.toFixed(2)}px, 0)`;
        fixedButtons.style.transform = `translate3d(${buttonsRect.left.toFixed(2)}px, ${buttonsRect.top.toFixed(2)}px, 0)`;

        if (titleBackdropRef.current) {
          titleBackdropRef.current.style.transition = animate ? 'opacity 300ms ease' : 'none';
          titleBackdropRef.current.style.opacity = '0';
          titleBackdropRef.current.style.backdropFilter = 'none';
          titleBackdropRef.current.style.setProperty('-webkit-backdrop-filter', 'none');
        }
      }
    };

    const handleScroll = () => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(() => updatePositions(false, true));
    };

    const handleResize = () => {
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(() => updatePositions(true, false));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    updatePositions(true, false);

    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(() => {
        if (!isCancelled) {
          updatePositions(true, false);
        }
      });
    }

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleTitleClick = () => {
    if (window.scrollY > 12) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCopyEmail = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText('fann@berkeley.edu').catch(() => {});
    }
    setCopiedEmail(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopiedEmail(false);
    }, 1800);
  };

  return (
    <>
      {/* Full-width mobile frosted backdrop bar when scrolled so wireframes never collide with sticky header */}
      <div
        aria-hidden="true"
        className={`fixed top-0 inset-x-0 h-[96px] bg-slate-50/75 dark:bg-[#141C28]/75 backdrop-blur-sm mobile-header-fade z-[35] pointer-events-none transition-opacity duration-300 sm:hidden ${
          isScrolled ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fixed Floating Name that slides smoothly to the top-left */}
      <div
        ref={fixedTitleRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 40 }}
        className="pointer-events-none will-change-transform"
      >
        <div
          className={`relative pointer-events-auto inline-flex items-center px-2.5 py-1 -mx-2.5 -my-1 rounded-lg ${
            isScrolled ? 'select-none' : 'select-text'
          }`}
        >
          {/* Subtle backdrop layer active only when scrolled in the corner */}
          <div
            ref={titleBackdropRef}
            className="hidden sm:block absolute inset-0 rounded-lg bg-slate-50/90 dark:bg-[#141C28]/90 pointer-events-none opacity-0"
          />
          <h1 className="relative z-10 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {isScrolled ? (
              <button
                type="button"
                onClick={handleTitleClick}
                aria-label="Scroll to top"
                title="Click to scroll to top"
                className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded text-left"
              >
                Jaden Fann
              </button>
            ) : (
              'Jaden Fann'
            )}
          </h1>
        </div>
      </div>

      {/* Fixed Floating Buttons that slide smoothly to the top-right - No separate background */}
      <div
        ref={fixedButtonsRef}
        style={{ position: 'fixed', top: 0, left: 0, zIndex: 40 }}
        className="pointer-events-none will-change-transform"
      >
        <div className="pointer-events-auto flex items-center gap-2.5 font-mono text-xs shrink-0 select-none">
          <a
            href="#resume"
            onClick={(e) => {
              e.preventDefault();
              if (window.location.hash !== '#resume') {
                window.history.pushState(null, '', '#resume');
                window.dispatchEvent(new HashChangeEvent('hashchange'));
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="btn-ripple inline-flex items-center gap-1.5 px-3 py-2 rounded bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <FileText size={13} />
            <span>Resume</span>
          </a>

          <button
            type="button"
            onClick={toggleTheme}
            onMouseDown={(e) => {
              e.preventDefault();
              // Rapid double/triple clicks can otherwise select nearby header text
              if (e.detail > 1) window.getSelection()?.removeAllRanges();
            }}
            onDoubleClick={() => window.getSelection()?.removeAllRanges()}
            data-theme-toggle="true"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="btn-ripple theme-toggle-vt w-[30px] h-[30px] p-0 flex items-center justify-center rounded bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title="Toggle Light / Dark Mode"
          >
            <Sun size={14} className="theme-icon-sun pointer-events-none" />
            <Moon size={14} className="theme-icon-moon pointer-events-none" />
          </button>
        </div>
      </div>

      {/* Main Header Container in document flow - spaced generously from top on big screens */}
      <header className="relative z-30 w-full bg-transparent pt-10 sm:pt-14 md:pt-16 pb-4 pointer-events-none">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pointer-events-auto">
          {/* Top Row: Always Name on the Left, Buttons on the Right regardless of screen size */}
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Anchor Placeholder for Title to maintain exact height and alignment */}
            <div ref={titleAnchorRef} aria-hidden="true" className="invisible select-none pointer-events-none">
              <span className="block text-2xl sm:text-3xl font-bold tracking-tight">
                Jaden Fann
              </span>
            </div>

            {/* Anchor Placeholder for Buttons - stays strictly on the right */}
            <div ref={buttonsAnchorRef} aria-hidden="true" className="invisible select-none pointer-events-none flex items-center gap-2.5 font-mono text-xs shrink-0">
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
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} className="text-slate-400 dark:text-slate-500" />
                <span>Seattle, WA</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap size={13} className="text-slate-400 dark:text-slate-500" />
                <span>UC Berkeley M.S. ME ('25)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <a
                  href="mailto:fann@berkeley.edu"
                  className="hover:text-blue-500 hover:underline underline-offset-2 inline-flex items-center gap-1.5 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Mail size={12} className="text-slate-400 dark:text-slate-500" />
                  <span>fann@berkeley.edu</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  aria-label="Copy email address"
                  title="Copy email address"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200/70 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {copiedEmail ? (
                    <>
                      <Check size={10} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={10} />
                      <span className="text-[10px]">Copy</span>
                    </>
                  )}
                </button>
              </span>
              <a
                href="https://linkedin.com/in/jadenfann"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline underline-offset-4 decoration-blue-500/60 hover:decoration-blue-500 font-semibold rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
