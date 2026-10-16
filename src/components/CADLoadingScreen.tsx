import React, { useEffect, useState, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

export const CADLoadingScreen: React.FC = () => {
  const { active, progress, total, loaded } = useProgress();
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const maxProgressRef = useRef(0);
  const hasExitedRef = useRef(false);

  // Helper to trigger 100% completion and fade out
  const triggerExit = (delayMs = 80) => {
    if (hasExitedRef.current) return;
    hasExitedRef.current = true;
    maxProgressRef.current = 100;
    setDisplayProgress(100);
    setTimeout(() => {
      setIsDone(true);
    }, delayMs);
  };

  // 1. Monotonically track actual 3D asset progress (never goes backwards)
  useEffect(() => {
    if (hasExitedRef.current) return;

    if (total > 0 && typeof progress === 'number' && !isNaN(progress)) {
      const rounded = Math.min(100, Math.max(0, Math.round(progress)));
      if (rounded > maxProgressRef.current) {
        maxProgressRef.current = rounded;
        setDisplayProgress(rounded);
      }

      // If Drei reports loading has completed, exit immediately
      if (progress >= 100 || (!active && loaded >= total)) {
        triggerExit(80);
      }
    }
  }, [active, progress, total, loaded]);

  // 2. Fast-path for procedural models, memory/HTTP cached assets, or quick network
  useEffect(() => {
    if (hasExitedRef.current) return;

    // Small tick (50ms) to allow Three.js canvas to register any initial GLB asset requests
    const checkTimer = setTimeout(() => {
      if (hasExitedRef.current) return;

      // If no assets were queued or everything is already resolved
      if (total === 0 || (!active && loaded >= total)) {
        triggerExit(60);
      }
    }, 50);

    // Safety timeout: never hang or block user on slow/offline connections (> 2.5s)
    const safetyTimer = setTimeout(() => {
      triggerExit(60);
    }, 2500);

    return () => {
      clearTimeout(checkTimer);
      clearTimeout(safetyTimer);
    };
  }, [total, active, loaded]);

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
                transition={{ ease: 'easeOut', duration: 0.15 }}
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
