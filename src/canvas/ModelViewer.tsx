import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { useTheme } from '../context/ThemeContext';
import { Pause, RotateCw } from 'lucide-react';

interface ModelViewerProps {
  modelType: string;
  isActive?: boolean;
  isHovered?: boolean;
  className?: string;
  allowZoom?: boolean;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelType,
  isActive = false,
  isHovered = false,
  className = 'h-[500px] sm:h-[580px] w-full',
  allowZoom = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isRotating, setIsRotating] = useState(true);

  // Auto-stop rotation when user drags or zooms the canvas
  const handleCanvasInteraction = () => {
    if (allowZoom) {
      setIsRotating(false);
    }
  };

  return (
    <div className={`relative ${className} select-none pointer-events-auto flex items-center justify-center overflow-visible`}>
      <Canvas
        className="grab-cursor"
        gl={{ antialias: true, alpha: true }}
        onWheel={handleCanvasInteraction}
      >
        {/* Unified Stable Perspective Camera (Zero jumping or unmounting during mode transitions) */}
        <PerspectiveCamera
          makeDefault
          position={[4.6, 3.2, 5.0]}
          fov={34}
          near={0.1}
          far={1000}
        />

        {/* Calibrated lighting for crisp toon shadows and vibrant material colors */}
        <ambientLight intensity={isDark ? (isActive ? 0.95 : 0.85) : (isActive ? 1.05 : 0.95)} />
        <directionalLight position={[6, 8, 5]} intensity={isActive ? 1.5 : 1.2} castShadow />
        <directionalLight position={[-6, -3, -5]} intensity={0.4} />

        <Suspense fallback={null}>
          <ModelRenderer
            modelType={modelType}
            isActive={isActive}
            isHovered={isHovered}
            isRotating={isRotating}
          />
        </Suspense>

        <OrbitControls
          target={[0, 0, 0]}
          enableZoom={allowZoom}
          enablePan={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 1.8}
          dampingFactor={0.08}
          onStart={handleCanvasInteraction}
        />
      </Canvas>

      {/* Floating Turntable Control Button in Detail View */}
      {allowZoom && (
        <div className="absolute bottom-3 left-3 z-30 pointer-events-auto">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsRotating((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-semibold shadow-lg backdrop-blur-md border transition-all cursor-pointer select-none ${
              isRotating
                ? 'bg-white/90 dark:bg-slate-900/90 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:scale-105'
                : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 ring-2 ring-blue-400/40 shadow-blue-500/25 scale-105'
            }`}
            title={isRotating ? 'Pause Turntable Rotation' : 'Resume Turntable Rotation'}
          >
            {isRotating ? (
              <>
                <Pause size={12} className="text-amber-500" />
                <span>Pause Spin</span>
              </>
            ) : (
              <>
                <RotateCw size={12} className="text-white" />
                <span>Resume Rotation</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
