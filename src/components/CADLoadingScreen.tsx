import React, { useEffect, useState, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

export const CADLoadingScreen: React.FC = () => {
  const { active, progress, total } = useProgress();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const maxProgressRef = useRef(0);
  const hasStartedRef = useRef(false);

  // Track Drei progress monotonically (strictly non-decreasing, never goes backwards)
  useEffect(() => {
    if (active || total > 0) {
      hasStartedRef.current = true;
    }

    if (hasStartedRef.current && typeof progress === 'number' && !isNaN(progress)) {
      const rounded = Math.min(100, Math.max(0, Math.round(progress)));
      if (rounded > maxProgressRef.current) {
        maxProgressRef.current = rounded;
        setDisplayProgress(rounded);
      }
    }
  }, [active, progress, total]);

  // Smooth cadence ticker: guarantees steady forward progress even during asset discovery/gaps
  useEffect(() => {
    const startTime = Date.now();
    const minDuration = 450; // smooth forward ramp over 450ms

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const timePercent = Math.min(95, Math.round((elapsed / minDuration) * 95));

      if (timePercent > maxProgressRef.current) {
        maxProgressRef.current = timePercent;
        setDisplayProgress(timePercent);
      }
    }, 25);

    return () => clearInterval(interval);
  }, []);

  // Completion controller: once assets complete or maximum duration reached, snap to 100% and fade out
  useEffect(() => {
    let exitTimer: ReturnType<typeof setTimeout>;

    const completeAndExit = () => {
      maxProgressRef.current = 100;
      setDisplayProgress(100);
      exitTimer = setTimeout(() => {
        setIsDone(true);
      }, 140);
    };

    // If Drei reports all assets finished loading
    if (hasStartedRef.current && (!active || progress >= 100)) {
      completeAndExit();
      return () => clearTimeout(exitTimer);
    }

    // Safety timeout: never block UI for more than 550ms regardless of network state
    const safetyTimer = setTimeout(() => {
      completeAndExit();
    }, 550);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(safetyTimer);
    };
  }, [active, progress]);

  return (
    <AnimatePresence>
      {!isDone && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-50 dark:bg-[#141C28] text-slate-900 dark:text-slate-100 select-none overflow-hidden transition-colors duration-300"
        >
          <div className="w-full max-w-xs px-6 flex flex-col items-center space-y-4">
            {/* Minimal Monospace Title */}
            <div className="flex items-center justify-between w-full font-mono text-[11px] tracking-wider text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-200">JADEN FANN</span>
              <span className="text-slate-500 dark:text-slate-400">{displayProgress.toString().padStart(3, ' ')}%</span>
            </div>

            {/* Hairline Minimal Progress Bar */}
            <div className="relative w-full h-[1.5px] bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-slate-900 dark:bg-slate-200 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${displayProgress}%` }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>

            {/* Subtle Status Line */}
            <div className="flex items-center justify-between w-full font-mono text-[10px] text-slate-400 dark:text-slate-500">
              <span>INITIALIZING 3D CAD</span>
              <span className="tracking-widest">PORTFOLIO</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
