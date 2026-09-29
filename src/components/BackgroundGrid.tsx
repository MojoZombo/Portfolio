import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

export const BackgroundGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect active scrolling vs idle reading state
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const getDimensions = () => {
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      return { width, height, dpr };
    };

    const draw = () => {
      const { width, height, dpr } = getDimensions();
      if (width <= 0 || height <= 0) return;

      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);

      // Ensure canvas backing buffer strictly matches DOM dimensions
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }

      // 1. Fully reset transform and clear 100% of backing buffer (eliminates frozen edge strips)
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // 2. Set DPR transform for crisp, high-DPI rendering
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const isDark = theme === 'dark';
      const gridSize = 48; // Clean, uniform grid spacing

      // Vertical scroll offset
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const offsetY = -(scrollY % gridSize);

      // Single, uniform, subtle grid color & weight
      const gridColor = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.06)';

      ctx.lineWidth = 1;
      ctx.strokeStyle = gridColor;
      ctx.beginPath();

      // Vertical lines
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }

      // Horizontal lines (scrolling with page)
      for (let y = offsetY; y <= height + gridSize; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    };

    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      draw();
    };

    // Use ResizeObserver on container so any CSS layout / orientation change updates immediately
    const ro = new ResizeObserver(() => {
      draw();
    });

    if (containerRef.current) {
      ro.observe(containerRef.current);
    } else {
      ro.observe(canvas);
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial draw & delayed layout confirmation
    draw();
    const t1 = setTimeout(draw, 50);
    const t2 = setTimeout(draw, 250);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(t1);
      clearTimeout(t2);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  // Dynamic animation transition:
  // When scrolling: responsive 0.35s ease-out to animatedly expand and move away
  // When stopping: silky 1.15s gentle ease-out to slowly glide back into place
  const transition = {
    duration: isScrolling ? 0.35 : 1.15,
    ease: [0.16, 1, 0.3, 1],
  };

  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden w-full h-full select-none"
    >
      {/* 1. Underlying Scrolling CAD Grid Canvas with safety feather */}
      <div
        className="w-full h-full"
        style={{
          maskImage: 'radial-gradient(ellipse 95% 92% at 50% 50%, #000 65%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 95% 92% at 50% 50%, #000 65%, transparent 100%)',
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>

      {/* 2. Dynamic Radial Vignette Overlay:
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

      {/* 3. Perimeter Edge Fades:
          - Dynamically move outward away from the viewport edges during scroll
          - Slowly glide back in when scroll ceases
      */}
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
  );
};
