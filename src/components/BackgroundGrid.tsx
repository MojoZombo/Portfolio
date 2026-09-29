import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export const BackgroundGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme } = useTheme();

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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden w-full h-full select-none"
    >
      {/* Grid Canvas with smooth elliptical radial vignette mask */}
      <div
        className="w-full h-full"
        style={{
          maskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 25%, transparent 88%)',
          WebkitMaskImage: 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 25%, transparent 88%)',
        }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </div>

      {/* Perimeter Vignette Fades into site background color */}
      {/* Top Edge Fade */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-50 dark:from-[#141C28] via-slate-50/70 dark:via-[#141C28]/70 to-transparent pointer-events-none transition-colors duration-300" />
      {/* Bottom Edge Fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-50 dark:from-[#141C28] via-slate-50/70 dark:via-[#141C28]/70 to-transparent pointer-events-none transition-colors duration-300" />
      {/* Left Edge Fade */}
      <div className="absolute inset-y-0 left-0 w-24 sm:w-32 bg-gradient-to-r from-slate-50 dark:from-[#141C28] to-transparent pointer-events-none transition-colors duration-300" />
      {/* Right Edge Fade */}
      <div className="absolute inset-y-0 right-0 w-24 sm:w-32 bg-gradient-to-l from-slate-50 dark:from-[#141C28] to-transparent pointer-events-none transition-colors duration-300" />
    </div>
  );
};
