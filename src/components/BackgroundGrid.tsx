import React, { useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';

export const BackgroundGrid: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      draw();
    };

    const draw = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.clearRect(0, 0, width, height);

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

    window.addEventListener('resize', resize);
    window.addEventListener('scroll', handleScroll, { passive: true });
    resize();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ width: '100vw', height: '100vh' }}
      />
    </div>
  );
};
