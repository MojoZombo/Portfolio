import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export const BackgroundGrid: React.FC = () => {
  const { theme } = useTheme();
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect active scrolling vs idle reading state for vignette transitions
  useEffect(() => {
    let lastScrollY = window.scrollY || window.pageYOffset || 0;

    const handleScrollActivity = () => {
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      if (Math.abs(currentScrollY - lastScrollY) > 0.5) {
        setIsScrolling(true);
        lastScrollY = currentScrollY;

        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // Wait 140ms idle after the last scroll event before smoothly returning
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 140);
      }
    };

    window.addEventListener('scroll', handleScrollActivity, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScrollActivity);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const transition = {
    duration: isScrolling ? 0.35 : 1.15,
    ease: [0.16, 1, 0.3, 1],
  };

  const isDark = theme === 'dark';

  return (
    <>
      {/* 1. Underlying Scrolling CAD Grid Pattern
          Positioned absolute across the full document height so that on mobile and desktop,
          it scrolls directly in the GPU compositor in 100% lockstep with text and images,
          with zero JavaScript lag or stutter. */}
      <div
        className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden select-none"
        aria-hidden="true"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(to right, rgba(148, 163, 184, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.08) 1px, transparent 1px)'
            : 'linear-gradient(to right, rgba(15, 23, 42, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* 2. Viewport-Fixed Vignette & Dynamic Edge Fades */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden w-full h-full select-none">
        {/* Dynamic Radial Vignette Overlay:
            - When idle: gently encloses and focuses the center reading area
            - When scrolling: animatedly scales outward (moves away) and softens
            - When scrolling stops: slowly and smoothly glides back to its resting frame
        */}
        <motion.div
          initial={false}
          animate={{
            scale: isScrolling ? 1.22 : 1.0,
            opacity: isScrolling ? 0.45 : 1.0,
          }}
          transition={transition}
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isDark
              ? 'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(20,28,40,0) 25%, rgba(20,28,40,0.85) 75%, rgba(20,28,40,1) 95%)'
              : 'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(248,250,252,0) 25%, rgba(248,250,252,0.85) 75%, rgba(248,250,252,1) 95%)',
          }}
        />

        {/* Top Edge Fade */}
        <motion.div
          initial={false}
          animate={{
            y: isScrolling ? -36 : 0,
            opacity: isScrolling ? 0.35 : 1,
          }}
          transition={transition}
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-50 dark:from-[#141C28] via-slate-50/70 dark:via-[#141C28]/70 to-transparent pointer-events-none"
        />
        {/* Bottom Edge Fade */}
        <motion.div
          initial={false}
          animate={{
            y: isScrolling ? 36 : 0,
            opacity: isScrolling ? 0.35 : 1,
          }}
          transition={transition}
          className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-50 dark:from-[#141C28] via-slate-50/70 dark:via-[#141C28]/70 to-transparent pointer-events-none"
        />
        {/* Left Edge Fade */}
        <motion.div
          initial={false}
          animate={{
            x: isScrolling ? -32 : 0,
            opacity: isScrolling ? 0.35 : 1,
          }}
          transition={transition}
          className="absolute inset-y-0 left-0 w-24 sm:w-32 bg-gradient-to-r from-slate-50 dark:from-[#141C28] to-transparent pointer-events-none"
        />
        {/* Right Edge Fade */}
        <motion.div
          initial={false}
          animate={{
            x: isScrolling ? 32 : 0,
            opacity: isScrolling ? 0.35 : 1,
          }}
          transition={transition}
          className="absolute inset-y-0 right-0 w-24 sm:w-32 bg-gradient-to-l from-slate-50 dark:from-[#141C28] to-transparent pointer-events-none"
        />
      </div>
    </>
  );
};
