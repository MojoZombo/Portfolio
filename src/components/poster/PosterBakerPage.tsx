import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import JSZip from 'jszip';
import { projectsData } from '../../data/projectsData';
import { ModelRenderer } from '../../canvas/ModelRenderer';
import { useTheme } from '../../context/ThemeContext';
import {
  Camera,
  Sparkles,
  Download,
  ArrowLeft,
  Sun,
  Moon,
  RefreshCw,
  Layers,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';

// Bridge to safely capture the transparent WebGL buffer from the active stage
function StageCaptureBridge({
  onRegister,
}: {
  onRegister: (captureFn: () => string | null) => void;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    onRegister(() => {
      try {
        const oldAlpha = gl.getClearAlpha();
        const oldColor = new THREE.Color();
        gl.getClearColor(oldColor);

        // Clear background to transparent alpha
        gl.setClearColor(0x000000, 0);
        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL('image/png');

        gl.setClearColor(oldColor, oldAlpha);
        return dataUrl;
      } catch (err) {
        console.error('Failed to capture WebGL canvas:', err);
        return null;
      }
    });
  }, [gl, scene, camera, onRegister]);

  return null;
}

export const PosterBakerPage: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const modelsList = projectsData.filter((p) => p.modelType);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentMode, setCurrentMode] = useState<'shaded' | 'blueprint'>('shaded');
  const [isBakingAll, setIsBakingAll] = useState(false);
  const [bakeStatus, setBakeStatus] = useState<string | null>(null);
  const [savedPosters, setSavedPosters] = useState<Record<string, string>>({});

  const captureFnRef = useRef<(() => string | null) | null>(null);
  const currentProject = modelsList[currentIndex] || modelsList[0];

  const handleRegisterCapture = useCallback((fn: () => string | null) => {
    captureFnRef.current = fn;
  }, []);

  // Save poster to server disk + state
  const savePosterFile = async (
    modelType: string,
    mode: 'shaded' | 'blueprint',
    targetTheme: 'dark' | 'light',
    dataUrl: string
  ) => {
    const filenames = [
      `${modelType}-${mode}-${targetTheme}.png`,
      `${modelType}-${mode}.png`, // Universal fallback
    ];

    setSavedPosters((prev) => {
      const next = { ...prev };
      filenames.forEach((f) => {
        next[f] = dataUrl;
      });
      return next;
    });

    for (const filename of filenames) {
      try {
        const res = await fetch('/api/save-poster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, dataUrl }),
        });
        const data = await res.json();
        if (data.success) {
          console.log(`[POSTER BAKER] Saved: public/posters/${filename}`);
        }
      } catch (e) {
        console.warn('Vite dev endpoint unavailable, stored in memory:', e);
      }
    }
  };

  // Capture current active stage frame
  const handleSnapCurrent = async (
    customMode?: 'shaded' | 'blueprint',
    customTheme?: 'dark' | 'light'
  ) => {
    const mode = customMode || currentMode;
    const tTheme = customTheme || theme;

    if (customMode && customMode !== currentMode) {
      setCurrentMode(customMode);
    }
    if (customTheme && customTheme !== theme) {
      setTheme(customTheme);
    }

    await new Promise((r) => setTimeout(r, 400));

    if (captureFnRef.current) {
      const dataUrl = captureFnRef.current();
      if (dataUrl) {
        await savePosterFile(currentProject.modelType, mode, tTheme, dataUrl);
      }
    }
  };

  // 1-Click Automated Master Baker (Bakes All 4 Schemes for All 11 Models = 44 Posters)
  const handleAutoBakeAll = async () => {
    setIsBakingAll(true);
    setBakeStatus('Initializing 1:1 Exact Photo Studio...');

    const originalTheme = theme;
    const themes: Array<'dark' | 'light'> = ['dark', 'light'];
    const modes: Array<'shaded' | 'blueprint'> = ['shaded', 'blueprint'];

    for (const t of themes) {
      setTheme(t);
      await new Promise((r) => setTimeout(r, 400));

      for (const m of modes) {
        setCurrentMode(m);
        await new Promise((r) => setTimeout(r, 400));

        for (let i = 0; i < modelsList.length; i++) {
          const p = modelsList[i];
          setCurrentIndex(i);

          setBakeStatus(
            `[Theme: ${t.toUpperCase()} | ${m.toUpperCase()}] Baking ${p.title} (${i + 1}/${modelsList.length})...`
          );

          // Allow GLTF / edges / shaders to mount and stabilize at 1:1 dimensions
          await new Promise((r) => setTimeout(r, 700));

          if (captureFnRef.current) {
            const dataUrl = captureFnRef.current();
            if (dataUrl) {
              await savePosterFile(p.modelType, m, t, dataUrl);
            }
          }
        }
      }
    }

    setTheme(originalTheme);
    setBakeStatus('🎉 All 44 posters (Light & Dark, Shaded & Blueprint) baked and saved to public/posters/!');
    setIsBakingAll(false);
    setTimeout(() => setBakeStatus(null), 8000);
  };

  // Download All as ZIP
  const handleDownloadZip = async () => {
    const zip = new JSZip();
    const entries = Object.entries(savedPosters);

    if (entries.length === 0) {
      alert('No posters captured yet! Click "⚡ 1-Click Auto-Bake All" first.');
      return;
    }

    entries.forEach(([filename, dataUrl]) => {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      zip.file(filename, base64, { base64: true });
    });

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'website-1to1-model-posters.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-500">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-mono"
          >
            <ArrowLeft size={14} />
            <span>Back to Portfolio</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-sm font-bold font-mono text-white">
              1:1 Exact Model Poster Studio
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 font-mono text-xs">
          {/* Active Theme Selector */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTheme('dark')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-bold ${
                isDark ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Moon size={12} />
              <span>Dark</span>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 font-bold ${
                !isDark ? 'bg-amber-500 text-slate-950' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Sun size={12} />
              <span>Light</span>
            </button>
          </div>

          {/* Download ZIP Button */}
          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold cursor-pointer transition-all shadow-sm"
          >
            <Download size={13} />
            <span>Download ZIP ({Object.keys(savedPosters).length})</span>
          </button>

          {/* Master 1-Click Auto-Bake Button */}
          <button
            onClick={handleAutoBakeAll}
            disabled={isBakingAll}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold cursor-pointer transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isBakingAll ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>⚡ 1-Click Auto-Bake All (44 Posters)</span>
          </button>
        </div>
      </header>

      {/* Real-Time Progress Banner */}
      {bakeStatus && (
        <div className="bg-emerald-950 border-b border-emerald-500/40 px-6 py-2.5 flex items-center justify-center gap-2 font-mono text-xs text-emerald-200 shadow-md">
          <Sparkles size={14} className="animate-spin text-emerald-400 shrink-0" />
          <span className="font-semibold">{bakeStatus}</span>
        </div>
      )}

      {/* Main Workspace: Active 3D Photo Studio Stage */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 flex flex-col gap-6">
        
        {/* Stage Controller Card */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-2xl flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                Model #{currentIndex + 1} of {modelsList.length}
              </span>
              <h2 className="text-lg font-bold text-white font-mono">
                {currentProject.title}
              </h2>
              <p className="text-xs font-mono text-slate-400">
                Type ID: <code className="text-blue-400">{currentProject.modelType}</code> | Company: {currentProject.company}
              </p>
            </div>

            {/* Mode Selector & Quick Navigation */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setCurrentMode('shaded')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                    currentMode === 'shaded'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Shaded Active
                </button>
                <button
                  onClick={() => setCurrentMode('blueprint')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${
                    currentMode === 'blueprint'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Blueprint Rest
                </button>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setCurrentIndex((prev) => (prev > 0 ? prev - 1 : modelsList.length - 1))}
                  disabled={isBakingAll}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Previous Model"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentIndex((prev) => (prev < modelsList.length - 1 ? prev + 1 : 0))}
                  disabled={isBakingAll}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Next Model"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Central 3D Stage Viewport (EXACT 1:1 Live Website max-w-2xl and h-[490px]) */}
          <div className="w-full flex items-center justify-center">
            <div className="w-full max-w-2xl h-[490px] rounded-xl bg-slate-950 border border-slate-800 relative overflow-hidden flex items-center justify-center shadow-2xl">
              {/* Subtle Drafting Backdrop Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />

              <Canvas
                className="grab-cursor w-full h-full"
                frameloop="always"
                dpr={3}
                gl={{
                  antialias: true,
                  alpha: true,
                  preserveDrawingBuffer: true,
                  powerPreference: 'high-performance',
                }}
              >
                {/* Exact Website Perspective Camera: FOV 34, Position [4.6, 3.2, 5.0], Target [0,0,0] */}
                <PerspectiveCamera
                  makeDefault
                  position={[4.6, 3.2, 5.0]}
                  fov={34}
                  near={0.1}
                  far={1000}
                />

                {/* Exact Website Lighting */}
                <ambientLight intensity={isDark ? (currentMode === 'shaded' ? 0.95 : 0.85) : (currentMode === 'shaded' ? 1.05 : 0.95)} />
                <directionalLight position={[6, 8, 5]} intensity={currentMode === 'shaded' ? 1.5 : 1.2} />
                <directionalLight position={[-6, -3, -5]} intensity={0.4} />

                <Suspense fallback={null}>
                  <ModelRenderer
                    key={`${currentProject.modelType}-${currentMode}-${theme}`}
                    modelType={currentProject.modelType}
                    isActive={currentMode === 'shaded'}
                    isHovered={false}
                    isRotating={false} // Exact static rest pose
                    isAnimating={false} // Freeze all local kinematics at t=0
                  />
                </Suspense>

                <OrbitControls
                  target={[0, 0, 0]}
                  enableZoom={true}
                  enablePan={true}
                  autoRotate={false}
                  dampingFactor={0.08}
                />

                <StageCaptureBridge onRegister={handleRegisterCapture} />
              </Canvas>

              {/* Snapshot Action Pill */}
              <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
                <button
                  onClick={() => handleSnapCurrent('shaded', isDark ? 'dark' : 'light')}
                  disabled={isBakingAll}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 disabled:opacity-50"
                >
                  <Camera size={13} />
                  <span>Snap Shaded ({isDark ? 'Dark' : 'Light'})</span>
                </button>

                <button
                  onClick={() => handleSnapCurrent('blueprint', isDark ? 'dark' : 'light')}
                  disabled={isBakingAll}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer transition-all hover:scale-105 disabled:opacity-50"
                >
                  <Camera size={13} />
                  <span>Snap Blueprint ({isDark ? 'Dark' : 'Light'})</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Visual Gallery of All 11 Models & Captured Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono text-white flex items-center gap-2">
              <Layers size={14} className="text-emerald-400" />
              <span>Captured Model Posters ({Object.keys(savedPosters).length} / {modelsList.length * 4} Files)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Target Folder: <code className="text-emerald-400">public/posters/</code>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {modelsList.map((p, idx) => {
              const isCurrent = idx === currentIndex;
              const sdDark = !!savedPosters[`${p.modelType}-shaded-dark.png`];
              const sdLight = !!savedPosters[`${p.modelType}-shaded-light.png`];
              const bpDark = !!savedPosters[`${p.modelType}-blueprint-dark.png`];
              const bpLight = !!savedPosters[`${p.modelType}-blueprint-light.png`];

              return (
                <div
                  key={p.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isCurrent
                      ? 'bg-blue-950/60 border-blue-500 shadow-md ring-2 ring-blue-500/30'
                      : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div>
                    <span className="text-xs font-mono text-slate-200 font-bold block truncate">
                      #{idx + 1} {p.title}
                    </span>
                    <span className="text-[10px] font-mono text-blue-400 block truncate">
                      {p.modelType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px]">
                    <span
                      className={`px-2 py-0.5 rounded flex items-center justify-between ${
                        sdDark ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <span>Shaded 🌙</span>
                      {sdDark && <Check size={10} />}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded flex items-center justify-between ${
                        sdLight ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <span>Shaded ☀️</span>
                      {sdLight && <Check size={10} />}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded flex items-center justify-between ${
                        bpDark ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <span>BP 🌙</span>
                      {bpDark && <Check size={10} />}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded flex items-center justify-between ${
                        bpLight ? 'bg-blue-500/20 text-blue-300 font-semibold' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <span>BP ☀️</span>
                      {bpLight && <Check size={10} />}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
