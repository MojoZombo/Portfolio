import * as THREE from 'three';
import React, { Suspense, useState, useRef, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { ModelRenderer } from './ModelRenderer';
import { useTheme } from '../context/ThemeContext';
import { Pause, RotateCw, Box } from 'lucide-react';

interface ModelViewerProps {
  modelType: string;
  isActive?: boolean;
  isHovered?: boolean;
  className?: string;
  allowZoom?: boolean;
}

// Error Boundary for resilient 3D rendering
class ModelErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('3D Model failed to render in Canvas:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="w-full h-full flex flex-col items-center justify-center font-mono text-xs text-slate-400 gap-2">
          <Box size={24} className="text-blue-500 opacity-60 animate-pulse" />
          <span>CAD Assembly Preview</span>
        </div>
      );
    }
    return this.props.children;
  }
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelType,
  isActive = false,
  isHovered = false,
  className = 'h-[340px] sm:h-[480px] md:h-[560px] w-full',
  allowZoom = false,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [isRotating, setIsRotating] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Lazy mount WebGL Canvas when in/near viewport (prevents iOS Safari / Mobile WebGL Context Limits)
  const [isInViewport, setIsInViewport] = useState(allowZoom);

  useEffect(() => {
    // In modal / full-screen detail view, always render immediately
    if (allowZoom) {
      setIsInViewport(true);
      return;
    }

    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      {
        rootMargin: '800px 0px', // Pre-load 800px ahead of viewport for instant appearance
        threshold: 0.01,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [allowZoom]);

  // Auto-stop rotation when user drags or zooms the canvas
  const handleCanvasInteraction = () => {
    if (allowZoom) {
      setIsRotating(false);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ touchAction: allowZoom ? 'none' : 'pan-y' }}
      className={`relative ${className} select-none pointer-events-auto flex items-center justify-center overflow-visible`}
    >
      {isInViewport ? (
        <Canvas
          className="grab-cursor"
          dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
          }}
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
            <ModelErrorBoundary>
              <ModelRenderer
                modelType={modelType}
                isActive={isActive}
                isHovered={isHovered}
                isRotating={isRotating}
              />
            </ModelErrorBoundary>
          </Suspense>

          <OrbitControls
            target={[0, 0, 0]}
            enableZoom={allowZoom}
            enablePan={allowZoom}
            autoRotate={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 1.8}
            dampingFactor={0.08}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: allowZoom ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_PAN,
            }}
            onStart={handleCanvasInteraction}
          />
        </Canvas>
      ) : (
        /* Low-overhead Blueprint Placeholder when offscreen */
        <div className="w-full h-full flex flex-col items-center justify-center opacity-40 font-mono text-[11px] text-slate-400 dark:text-slate-500">
          <div className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center">
            <Box size={20} className="text-blue-500/60" />
          </div>
        </div>
      )}

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
