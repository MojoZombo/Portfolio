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

      // Soft Radial Vignette Fade at the screen edges
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.35,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.8
      );

      if (isDark) {
        gradient.addColorStop(0, 'rgba(20, 28, 40, 0)');
        gradient.addColorStop(0.7, 'rgba(20, 28, 40, 0.35)');
        gradient.addColorStop(1, 'rgba(20, 28, 40, 0.95)');
      } else {
        gradient.addColorStop(0, 'rgba(248, 250, 252, 0)');
        gradient.addColorStop(0.7, 'rgba(248, 250, 252, 0.35)');
        gradient.addColorStop(1, 'rgba(248, 250, 252, 0.95)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
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
    <div ref={containerRef} className="fixed inset-0 pointer-events-none z-0 overflow-hidden w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
};
