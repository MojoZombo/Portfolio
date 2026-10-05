import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (event?: React.MouseEvent | MouseEvent | { clientX: number; clientY: number }) => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const getThemeButtonOrigin = (): { x: number; y: number } => {
  if (typeof document === 'undefined') return { x: 0, y: 0 };
  const btn = document.querySelector<HTMLElement>(
    'button[data-theme-toggle="true"], button[title*="Toggle Light"], button[title*="Toggle Canvas Theme"]'
  );
  if (btn) {
    const rect = btn.getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  }
  return {
    x: Math.round(window.innerWidth - 40),
    y: 40,
  };
};

const getCurrentRadius = (): number | null => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    const cs = window.getComputedStyle(document.documentElement, '::view-transition-new(root)').clipPath;
    const match = cs && cs.match(/circle\(([\d.]+)px/);
    if (match) return parseFloat(match[1]);
  } catch {}
  return null;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('cad-theme-v2');
    return (saved === 'light' || saved === 'dark') ? saved : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    
    // Ensure root and body retain theme background to prevent default white flash on reload
    const bg = theme === 'dark' ? '#141C28' : '#F8FAFC';
    root.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    
    localStorage.setItem('cad-theme-v2', theme);
    localStorage.setItem('cad-theme', theme);
  }, [theme]);

  const activeTransitionRef = useRef<any>(null);
  const activeAnimRef = useRef<Animation | null>(null);
  const directionRef = useRef<'idle' | 'forward' | 'reverse'>('idle');
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const endRadiusRef = useRef<number>(0);
  const sourceThemeRef = useRef<Theme>('light');
  const targetThemeRef = useRef<Theme>('dark');
  const lastToggleCallRef = useRef<number>(0);

  const updateRootDOM = (t: Theme) => {
    const root = document.documentElement;
    const bg = t === 'dark' ? '#141C28' : '#F8FAFC';
    if (t === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    root.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    localStorage.setItem('cad-theme-v2', t);
    localStorage.setItem('cad-theme', t);
  };

  // The header toggle is lifted into its own live view-transition layer (see .theme-toggle-vt in index.css)
  // so its ripple keeps animating during the page wipe. Its colors/icon follow `data-toggle-theme` on <html>
  // rather than the live theme, and that attribute is only swapped once the button's own tap ripple has
  // fully covered it â€” so the ripple fades out onto the correct color instead of the button snapping.
  const TOGGLE_SWAP_DELAY = 0; // swap right away; CSS eases the colors and crossfades the icon
  const toggleSwapTimerRef = useRef<number | null>(null);
  const setToggleDisplay = (t: Theme) => {
    if (toggleSwapTimerRef.current !== null) window.clearTimeout(toggleSwapTimerRef.current);
    toggleSwapTimerRef.current = null;
    document.documentElement.setAttribute('data-toggle-theme', t);
  };
  const scheduleToggleDisplay = (t: Theme) => {
    if (toggleSwapTimerRef.current !== null) window.clearTimeout(toggleSwapTimerRef.current);
    toggleSwapTimerRef.current = window.setTimeout(() => {
      toggleSwapTimerRef.current = null;
      document.documentElement.setAttribute('data-toggle-theme', t);
    }, TOGGLE_SWAP_DELAY);
  };

  useEffect(() => {
    if (toggleSwapTimerRef.current === null) setToggleDisplay(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = (_event?: React.MouseEvent | MouseEvent | { clientX: number; clientY: number }) => {
    const now = performance.now();
    if (now - lastToggleCallRef.current < 80) return;
    lastToggleCallRef.current = now;

    // If View Transitions API is not supported or user prefers reduced motion, switch directly
    if (
      typeof document === 'undefined' ||
      !('startViewTransition' in document) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      scheduleToggleDisplay(nextTheme);
      setTheme(nextTheme);
      return;
    }

    const isAnimActive = activeAnimRef.current && activeAnimRef.current.playState !== 'finished';

    // 1. MID-TRANSITION REVERSAL: If moving forward, smoothly reverse back to source theme from current screen position
    if (activeTransitionRef.current && isAnimActive && activeAnimRef.current && directionRef.current === 'forward') {
      const r = getCurrentRadius() ?? (endRadiusRef.current * 0.5);
      const currentAnim = activeAnimRef.current;
      if (currentAnim) currentAnim.cancel();
      directionRef.current = 'reverse';

      // Live DOM is already targetTheme; ::view-transition-old(root) is sourceTheme.
      // Shrink ::view-transition-new(root) smoothly back into the origin button.
      const revDuration = Math.round(Math.max(280, 440 * (r / endRadiusRef.current)));
      const revAnim = document.documentElement.animate(
        {
          clipPath: [
            `circle(${r}px at ${originRef.current.x}px ${originRef.current.y}px)`,
            `circle(0px at ${originRef.current.x}px ${originRef.current.y}px)`,
          ],
        },
        {
          duration: revDuration,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        }
      );

      // Only once the circle has shrunk to 0px (completely hidden), update the DOM and state to sourceTheme
      revAnim.onfinish = () => {
        if (directionRef.current === 'reverse') {
          const desiredTheme = sourceThemeRef.current;
          updateRootDOM(desiredTheme);
          flushSync(() => {
            setTheme(desiredTheme);
          });

          // Conclude the view transition cleanly now that live DOM is restored
          try {
            activeTransitionRef.current?.skipTransition();
          } catch {}
          activeTransitionRef.current = null;
          activeAnimRef.current = null;
          directionRef.current = 'idle';

          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              document.documentElement.classList.remove('is-theme-transitioning');
            });
          });
        }
      };
      scheduleToggleDisplay(sourceThemeRef.current);
      activeAnimRef.current = revAnim;
      return;
    }

    // 2. MID-TRANSITION UN-REVERSAL: If currently reversing, smoothly expand forward again to target theme
    if (activeTransitionRef.current && isAnimActive && activeAnimRef.current && directionRef.current === 'reverse') {
      const r = getCurrentRadius() ?? 50;
      const currentAnim = activeAnimRef.current;
      if (currentAnim) currentAnim.cancel();
      directionRef.current = 'forward';

      // Live DOM is already targetTheme, so we can expand straight back out
      const remainingRatio = Math.max(0.1, (endRadiusRef.current - r) / endRadiusRef.current);
      const fwdDuration = Math.round(Math.max(280, 520 * remainingRatio));
      const fwdAnim = document.documentElement.animate(
        {
          clipPath: [
            `circle(${r}px at ${originRef.current.x}px ${originRef.current.y}px)`,
            `circle(${endRadiusRef.current}px at ${originRef.current.x}px ${originRef.current.y}px)`,
          ],
        },
        {
          duration: fwdDuration,
          easing: 'cubic-bezier(0.2, 0.85, 0.32, 1)',
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        }
      );
      scheduleToggleDisplay(targetThemeRef.current);
      activeAnimRef.current = fwdAnim;
      return;
    }

    // Clean up lingering finished transition if still clearing
    if (activeTransitionRef.current && !isAnimActive) {
      try { activeTransitionRef.current.skipTransition(); } catch {}
      activeTransitionRef.current = null;
      activeAnimRef.current = null;
      directionRef.current = 'idle';
    }

    // 3. START FRESH TRANSITION
    const currentTheme = theme;
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    sourceThemeRef.current = currentTheme;
    targetThemeRef.current = nextTheme;
    directionRef.current = 'forward';

    // Strictly lock expansion origin directly to the theme toggle button center
    const origin = getThemeButtonOrigin();
    originRef.current = origin;

    // Measure exact viewport dimensions: accounts for mobile dynamic browser toolbars and virtual viewports
    const viewportWidth = Math.max(
      window.innerWidth || 0,
      document.documentElement.clientWidth || 0
    );
    const viewportHeight = Math.max(
      window.innerHeight || 0,
      document.documentElement.clientHeight || 0,
      window.visualViewport?.height || 0
    );

    // Calculate maximum distance to the furthest screen corner
    const maxDistX = Math.max(origin.x, viewportWidth - origin.x);
    const maxDistY = Math.max(origin.y, viewportHeight - origin.y);
    const cornerDistance = Math.hypot(maxDistX, maxDistY);

    // Add a calibrated 24px safety buffer so the expanding circle comfortably sweeps past all 4 screen corners
    // on tall phone screens before the animation settles, with zero over-inflation on desktop
    const endRadius = Math.ceil(cornerDistance + 24);
    endRadiusRef.current = endRadius;

    // Calibrate timing and easing to screen size for silky smooth transitions
    const isMobile = viewportWidth < 640;
    const isTablet = viewportWidth >= 640 && viewportWidth < 1024;
    const isLargeDesktop = viewportWidth >= 1920;

    const duration = isMobile ? 520 : isTablet ? 580 : isLargeDesktop ? 700 : 640;
    const easing = 'cubic-bezier(0.2, 0.85, 0.32, 1)';

    // Button keeps showing the current theme until its tap ripple covers it, then swaps underneath
    setToggleDisplay(currentTheme);
    scheduleToggleDisplay(nextTheme);

    const transition = (document as any).startViewTransition(() => {
      // Suppress concurrent CSS transitions and synchronously update root DOM inside the transition callback
      document.documentElement.classList.add('is-theme-transitioning');
      updateRootDOM(nextTheme);
      flushSync(() => {
        setTheme(nextTheme);
      });
    });

    activeTransitionRef.current = transition;

    transition.ready.then(() => {
      if (activeTransitionRef.current !== transition || directionRef.current !== 'forward') return;

      const clipPath = [
        `circle(0px at ${origin.x}px ${origin.y}px)`,
        `circle(${endRadius}px at ${origin.x}px ${origin.y}px)`,
      ];

      const anim = document.documentElement.animate(
        {
          clipPath,
        },
        {
          duration,
          easing,
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        }
      );
      activeAnimRef.current = anim;
    }).catch(() => {});

    transition.finished
      .catch(() => {})
      .finally(() => {
        if (activeTransitionRef.current === transition) {
          activeTransitionRef.current = null;
          activeAnimRef.current = null;
          directionRef.current = 'idle';
        }
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            document.documentElement.classList.remove('is-theme-transitioning');
          });
        });
      });
  };

  const handleSetTheme = (newTheme: Theme) => {
    setToggleDisplay(newTheme);
    if (activeTransitionRef.current) {
      try { activeTransitionRef.current.skipTransition(); } catch {}
      activeTransitionRef.current = null;
      activeAnimRef.current = null;
      directionRef.current = 'idle';
    }
    setTheme(newTheme);
  };

  useEffect(() => {
    let lastInterceptTimestamp = 0;

    const handleWindowIntercept = (e: MouseEvent | PointerEvent) => {
      // Only intercept if an in-flight view transition is currently animating
      if (!activeTransitionRef.current) return;

      const now = performance.now();
      if (now - lastInterceptTimestamp < 120) return;

      const toggleButtons = document.querySelectorAll<HTMLElement>(
        'button[data-theme-toggle="true"], button[title*="Toggle Light"], button[title*="Toggle Canvas Theme"]'
      );

      for (let i = 0; i < toggleButtons.length; i++) {
        const btn = toggleButtons[i];
        const rect = btn.getBoundingClientRect();
        const margin = 12;
        if (
          e.clientX >= rect.left - margin &&
          e.clientX <= rect.right + margin &&
          e.clientY >= rect.top - margin &&
          e.clientY <= rect.bottom + margin
        ) {
          lastInterceptTimestamp = now;
          e.preventDefault();
          e.stopPropagation();
          toggleTheme(e);
          break;
        }
      }
    };

    window.addEventListener('click', handleWindowIntercept, true);

    // Clicks during a view transition hit <html>, so double/triple clicks would select page text.
    // Suppress multi-click selection while the wipe runs and briefly after it ends.
    let lastWipeActiveAt = 0;
    const handleMouseDownGuard = (e: MouseEvent) => {
      const now = performance.now();
      if (activeTransitionRef.current || document.documentElement.classList.contains('is-theme-transitioning')) {
        lastWipeActiveAt = now;
      }
      if (e.detail > 1 && now - lastWipeActiveAt < 600) {
        e.preventDefault();
        window.getSelection()?.removeAllRanges();
      }
    };
    window.addEventListener('mousedown', handleMouseDownGuard, true);

    return () => {
      window.removeEventListener('click', handleWindowIntercept, true);
      window.removeEventListener('mousedown', handleMouseDownGuard, true);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: handleSetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
