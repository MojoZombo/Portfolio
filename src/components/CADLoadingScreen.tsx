import React, { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

export const CADLoadingScreen: React.FC = () => {
  const { active, progress } = useProgress();
  const [isDone, setIsDone] = useState(false);

  // Guaranteed max 500ms duration so loading screen never hangs or blocks the UI
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDone(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // When assets are ready before the timeout, fade out smoothly
  useEffect(() => {
    if (!active || progress >= 100) {
      const exitTimer = setTimeout(() => {
        setIsDone(true);
      }, 100);
      return () => clearTimeout(exitTimer);
    }
  }, [active, progress]);

  const displayProgress = Math.min(100, Math.round(progress || 100));

  return (
    <AnimatePresence>
      {!isDone && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950 text-slate-100 select-none overflow-hidden"
        >
          <div className="w-full max-w-xs px-6 flex flex-col items-center space-y-4">
            {/* Minimal Monospace Title */}
            <div className="flex items-center justify-between w-full font-mono text-[11px] tracking-wider text-slate-400">
              <span className="font-semibold text-slate-200">JADEN FANN</span>
              <span className="text-slate-400">{displayProgress.toString().padStart(3, ' ')}%</span>
            </div>

            {/* Hairline Minimal Progress Bar */}
            <div className="relative w-full h-[1.5px] bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-slate-200 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${displayProgress}%` }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>

            {/* Subtle Status Line */}
            <div className="flex items-center justify-between w-full font-mono text-[10px] text-slate-500">
              <span>INITIALIZING 3D CAD</span>
              <span className="tracking-widest">PORTFOLIO</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
