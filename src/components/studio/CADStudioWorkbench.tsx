import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, OrthographicCamera, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { projectsData } from '../../data/projectsData';
import { ModelRenderer } from '../../canvas/ModelRenderer';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration } from '../../context/TransformCalibrationContext';
import {
  Palette,
  Play,
  Copy,
  Check,
  Sun,
  Moon,
  Move,
  RotateCw,
  Box,
  Layers,
  ArrowLeft,
  Cpu,
  RefreshCw,
  Search,
  Edit2,
} from 'lucide-react';

interface StudioProps {
  onExit: () => void;
}

// Preset Metallic / Anodized Palette
const COLOR_PRESETS = [
  { name: 'Titanium Gray', hex: '#64748b' },
  { name: 'Slate Steel', hex: '#475569' },
  { name: 'Anodized Blue', hex: '#3b82f6' },
  { name: 'Sky Cyan', hex: '#0284c7' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Safety Orange', hex: '#ea580c' },
  { name: 'Amber Gold', hex: '#d97706' },
  { name: 'Crimson Red', hex: '#dc2626' },
  { name: 'Brass / Bronze', hex: '#c19a6b' },
  { name: 'Carbon Black', hex: '#1e293b' },
  { name: 'Powder White', hex: '#f8fafc' },
  { name: 'Raw Aluminum', hex: '#cbd5e1' },
];

function getSafeColor(hex: string | undefined, fallback = '#cbd5e1'): string {
  if (!hex || typeof hex !== 'string') return fallback;
  const trimmed = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return fallback;
}

export const CADStudioWorkbench: React.FC<StudioProps> = ({ onExit }) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const {
    activeModelId,
    setActiveModelId,
    selectedPartIndex,
    setSelectedPartIndex,
    settings,
    availableParts,
    updateSetting,
    updatePartColor,
    updatePartAnimation,
    updatePartName,
    updateCDPRConfig,
    resetPartAnimation,
    resetSettings,
    setIsOpen,
  } = useTransformCalibration();

  const [activeTab, setActiveTab] = useState<'transform' | 'colors' | 'kinematics' | 'cdpr' | 'export'>('transform');
  const [partSearch, setPartSearch] = useState('');
  const [renderMode, setRenderMode] = useState<'shaded' | 'blueprint'>('shaded');
  const [isOrthographic, setIsOrthographic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);
  const [tempPartName, setTempPartName] = useState('');

  // Ensure calibration context is active in Studio
  useEffect(() => {
    setIsOpen(true);
    return () => setIsOpen(false);
  }, [setIsOpen]);

  // Model list
  const modelsList = useMemo(() => {
    return projectsData.map((p) => ({
      id: p.modelType,
      title: p.title,
      company: p.company,
    }));
  }, []);

  const activeProject = useMemo(() => {
    return projectsData.find((p) => p.modelType === activeModelId) || projectsData[0];
  }, [activeModelId]);

  // Filtered parts tree
  const filteredParts = useMemo(() => {
    if (!partSearch.trim()) return availableParts;
    return availableParts.filter(
      (p) =>
        p.name.toLowerCase().includes(partSearch.toLowerCase()) ||
        p.index.toString().includes(partSearch)
    );
  }, [availableParts, partSearch]);

  const activeAnim = useMemo(() => {
    if (selectedPartIndex === null) return null;
    return settings.animationOverrides[selectedPartIndex] || null;
  }, [selectedPartIndex, settings.animationOverrides]);

  const selectedPart = useMemo(() => {
    if (selectedPartIndex === null) return null;
    return availableParts.find((p) => p.index === selectedPartIndex) || null;
  }, [selectedPartIndex, availableParts]);

  // Code generator with custom names and comments
  const generatedCode = useMemo(() => {
    const rotRadX = (settings.rotX * Math.PI) / 180;
    const rotRadY = (settings.rotY * Math.PI) / 180;
    const rotRadZ = (settings.rotZ * Math.PI) / 180;

    let output = `// Optimal CAD Alignment Settings for [${activeModelId}]:\n`;
    output += `const offset: [number, number, number] = [${settings.offsetX.toFixed(2)}, ${settings.offsetY.toFixed(2)}, ${settings.offsetZ.toFixed(2)}];\n`;
    output += `const rotation: [number, number, number] = [${rotRadX.toFixed(3)}, ${rotRadY.toFixed(3)}, ${rotRadZ.toFixed(3)}]; // [${settings.rotX}°, ${settings.rotY}°, ${settings.rotZ}°]\n`;
    output += `const scale = ${settings.scale.toFixed(2)};\n`;

    if (Object.keys(settings.colorOverrides).length > 0) {
      output += `\n// Custom Part Color Overrides:\n`;
      output += `const partColorOverrides: Record<number, string> = {\n`;
      for (const [idxStr, color] of Object.entries(settings.colorOverrides)) {
        const idx = parseInt(idxStr);
        const name = availableParts.find((p) => p.index === idx)?.name || `Part #${idx}`;
        output += `  ${idx}: '${color}', // ${name}\n`;
      }
      output += `};\n`;
    }

    if (Object.keys(settings.animationOverrides).length > 0) {
      output += `\n// Custom Part Animations:\n`;
      output += `const partAnimationOverrides = ${JSON.stringify(settings.animationOverrides, null, 2)};\n`;
    }

    if (activeModelId === 'cable-robot-2') {
      output += `\n// CDPR 4-Cable Robot Kinematics Config:\n`;
      output += `const cdprConfig = ${JSON.stringify(settings.cdprConfig, null, 2)};\n`;
    }

    return output;
  }, [activeModelId, settings, availableParts]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveRename = (index: number) => {
    if (tempPartName.trim()) {
      updatePartName(index, tempPartName.trim());
    }
    setEditingPartIndex(null);
    setTempPartName('');
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-950 text-slate-100 font-sans select-none overflow-hidden">
      
      {/* 1. TOP STUDIO TOOLBAR */}
      <header className="h-14 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-4 flex items-center justify-between z-30 shrink-0">
        
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} />
            <span>Return to Portfolio</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Cpu size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white font-mono flex items-center gap-2">
                <span>CAD STUDIO WORKBENCH</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400 text-[10px] font-mono border border-blue-500/30">PRO</span>
              </h1>
            </div>
          </div>
        </div>

        {/* Center: Model Selector Dropdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700">
            <Box size={14} className="text-blue-400" />
            <select
              value={activeModelId}
              onChange={(e) => {
                setActiveModelId(e.target.value);
                setSelectedPartIndex(null);
              }}
              className="bg-transparent text-xs font-mono font-semibold text-white outline-none cursor-pointer pr-2"
            >
              {modelsList.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                  {m.title} ({m.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Render Toggles & Theme */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Mode Switcher */}
          <div className="flex bg-slate-800/80 p-0.5 rounded-lg border border-slate-700/80">
            <button
              onClick={() => setRenderMode('shaded')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                renderMode === 'shaded' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Cel-Shaded
            </button>
            <button
              onClick={() => setRenderMode('blueprint')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                renderMode === 'blueprint' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Blueprint
            </button>
          </div>

          {/* Camera Projection */}
          <button
            onClick={() => setIsOrthographic((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg border transition-all ${
              isOrthographic
                ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Isometric Orthographic vs Perspective Camera"
          >
            {isOrthographic ? 'Isometric (Ortho)' : 'Perspective'}
          </button>

          {/* Grid Toggle */}
          <button
            onClick={() => setShowGrid((prev) => !prev)}
            className={`p-1.5 rounded-lg border transition-all ${
              showGrid
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle Ground Grid"
          >
            <Layers size={14} />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Toggle Canvas Theme"
          >
            {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-blue-400" />}
          </button>
        </div>
      </header>

      {/* 2. MAIN STUDIO BODY (3-PANEL EXPANSIVE WORKBENCH) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT PANEL: HIERARCHY & ASSEMBLY PART TREE */}
        <aside className="w-72 bg-slate-900/60 backdrop-blur border-r border-slate-800 flex flex-col z-20 shrink-0">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono font-bold tracking-wider text-slate-300 flex items-center gap-1.5">
              <Layers size={13} className="text-blue-400" />
              <span>ASSEMBLY TREE</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              {availableParts.length} parts
            </span>
          </div>

          {/* Part Search */}
          <div className="p-2 border-b border-slate-800/60">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter parts by name or #..."
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                className="w-full pl-7 pr-3 py-1.5 bg-slate-950/80 text-xs font-mono text-slate-200 rounded-lg border border-slate-800 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Parts List with Inline Rename */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredParts.length === 0 ? (
              <div className="p-4 text-center text-xs font-mono text-slate-500">
                No parts detected
              </div>
            ) : (
              filteredParts.map((part) => {
                const isSelected = selectedPartIndex === part.index;
                const isEditing = editingPartIndex === part.index;
                const activeColor = settings.colorOverrides[part.index] || part.color;
                const hasAnim = settings.animationOverrides[part.index] && settings.animationOverrides[part.index].type !== 'none';

                return (
                  <div
                    key={part.index}
                    className={`group relative rounded-lg text-xs font-mono flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md font-semibold'
                        : 'hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1 w-full p-1.5">
                        <input
                          type="text"
                          value={tempPartName}
                          autoFocus
                          onChange={(e) => setTempPartName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveRename(part.index);
                            if (e.key === 'Escape') setEditingPartIndex(null);
                          }}
                          className="flex-1 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-blue-400 outline-none"
                        />
                        <button
                          onClick={() => handleSaveRename(part.index)}
                          className="p-1 rounded bg-blue-500 text-white hover:bg-blue-400 cursor-pointer"
                        >
                          <Check size={11} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPartIndex(isSelected ? null : part.index);
                            if (!isSelected && activeTab === 'transform') {
                              setActiveTab('colors');
                            }
                          }}
                          className="flex-1 text-left px-2.5 py-2 flex items-center gap-2 truncate cursor-pointer"
                        >
                          <span
                            className="w-3 h-3 rounded-full shrink-0 border border-white/20 shadow-inner"
                            style={{ backgroundColor: activeColor }}
                          />
                          <span className="truncate">{part.name}</span>
                        </button>

                        <div className="flex items-center gap-1 pr-2 shrink-0">
                          {hasAnim && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Animated" />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingPartIndex(part.index);
                              setTempPartName(part.name);
                            }}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/20 transition-opacity cursor-pointer ${
                              isSelected ? 'text-white' : 'text-slate-400 hover:text-white'
                            }`}
                            title="Rename Part"
                          >
                            <Edit2 size={11} />
                          </button>
                          <span className="text-[10px] opacity-60">#{part.index}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Quick selection bar */}
          {selectedPartIndex !== null && (
            <div className="p-2.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 truncate max-w-[170px]">
                Selected: <span className="text-blue-400 font-semibold">{selectedPart?.name}</span>
              </span>
              <button
                onClick={() => setSelectedPartIndex(null)}
                className="text-slate-400 hover:text-white underline cursor-pointer text-[11px]"
              >
                Deselect
              </button>
            </div>
          )}
        </aside>

        {/* CENTER VIEWPORT: EXPANSIVE 3D WORKSPACE */}
        <main className="flex-1 relative flex items-center justify-center bg-slate-950 overflow-hidden">
          
          {/* Subtle Background Radial Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-950/20 via-slate-950/80 to-slate-950 pointer-events-none" />

          {/* 3D Canvas with Direct Click Selection */}
          <Canvas
            className="grab-cursor"
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          >
            {isOrthographic ? (
              <OrthographicCamera
                makeDefault
                position={[5, 4, 5]}
                zoom={90}
                near={-100}
                far={1000}
              />
            ) : (
              <PerspectiveCamera
                makeDefault
                position={[5.5, 3.8, 5.5]}
                fov={38}
                near={0.1}
                far={1000}
              />
            )}

            {/* Studio Lighting */}
            <ambientLight intensity={isDark ? (renderMode === 'shaded' ? 1.0 : 0.8) : 1.1} />
            <directionalLight position={[8, 12, 8]} intensity={renderMode === 'shaded' ? 1.6 : 1.2} castShadow />
            <directionalLight position={[-8, -4, -6]} intensity={0.5} />

            {/* Ground Drafting Grid */}
            {showGrid && (
              <Grid
                position={[0, -1.8, 0]}
                args={[20, 20]}
                cellSize={0.5}
                cellThickness={1}
                cellColor={isDark ? '#334155' : '#94a3b8'}
                sectionSize={2.0}
                sectionThickness={1.5}
                sectionColor={isDark ? '#3b82f6' : '#2563eb'}
                fadeDistance={15}
                fadeStrength={1}
              />
            )}

            <Suspense fallback={null}>
              <ModelRenderer
                modelType={activeModelId}
                isActive={renderMode === 'shaded'}
                isHovered={false}
                isRotating={settings.autoRotate}
              />
            </Suspense>

            {/* Interactive Orientation Gizmo Cube in Top-Right */}
            <GizmoHelper alignment="top-right" margin={[70, 70]}>
              <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="#ffffff" />
            </GizmoHelper>

            <OrbitControls
              target={[0, 0, 0]}
              enableZoom={true}
              enablePan={true}
              dampingFactor={0.08}
              minPolarAngle={0}
              maxPolarAngle={Math.PI / 1.05}
            />
          </Canvas>

          {/* Overlay Model Info Badge */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur px-3 py-2 rounded-xl border border-slate-800 shadow-xl space-y-0.5 pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs font-bold text-white tracking-tight">{activeProject.title}</span>
              </div>
              <p className="font-mono text-[10px] text-slate-400">
                SCALE: {settings.scale.toFixed(2)}x • ROT: [{settings.rotX}°, {settings.rotY}°, {settings.rotZ}°]
              </p>
            </div>
          </div>

          {/* Overlay Turntable Pause/Play Floating Pill */}
          <div className="absolute bottom-4 left-4 z-10">
            <button
              onClick={() => updateSetting('autoRotate', !settings.autoRotate)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-xs font-semibold shadow-xl backdrop-blur-md border transition-all cursor-pointer ${
                settings.autoRotate
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-blue-500/20'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <RotateCw size={13} className={settings.autoRotate ? 'animate-spin' : ''} />
              <span>{settings.autoRotate ? 'Auto-Spin Active' : 'Turntable Paused'}</span>
            </button>
          </div>
        </main>

        {/* RIGHT PANEL: INSPECTOR & STUDIO CONTROLS */}
        <aside className="w-80 sm:w-96 bg-slate-900/80 backdrop-blur border-l border-slate-800 flex flex-col z-20 shrink-0">
          
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 gap-1">
            <button
              onClick={() => setActiveTab('transform')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'transform'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Move size={13} />
              <span>Transform</span>
            </button>

            <button
              onClick={() => setActiveTab('colors')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'colors'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Palette size={13} />
              <span>Colors</span>
            </button>

            <button
              onClick={() => setActiveTab('kinematics')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'kinematics'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Play size={13} />
              <span>Motion</span>
            </button>

            {activeModelId === 'cable-robot-2' && (
              <button
                onClick={() => setActiveTab('cdpr')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                  activeTab === 'cdpr'
                    ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 shadow-sm font-semibold'
                    : 'text-amber-400 hover:text-amber-200'
                }`}
              >
                <Cpu size={13} />
                <span>CDPR Rig</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('export')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-mono font-medium transition-all ${
                activeTab === 'export'
                  ? 'bg-slate-800 text-white border border-slate-700 shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Copy size={13} />
              <span>Export</span>
            </button>
          </div>

          {/* Tab Content Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* TAB 1: TRANSFORMS */}
            {activeTab === 'transform' && (
              <div className="space-y-6">
                
                {/* Scale */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center font-mono text-xs">
                    <span className="font-semibold text-slate-200">Scale Factor</span>
                    <span className="text-blue-400">{settings.scale.toFixed(2)}x</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0.1"
                      max="15.0"
                      step="0.05"
                      value={settings.scale}
                      onChange={(e) => updateSetting('scale', parseFloat(e.target.value))}
                      className="flex-1 accent-blue-500 cursor-pointer"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={settings.scale}
                      onChange={(e) => updateSetting('scale', parseFloat(e.target.value) || 1)}
                      className="w-16 px-2 py-1 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right"
                    />
                  </div>
                </div>

                {/* Rotation X / Y / Z with Direct Inputs & 90° Snap Buttons */}
                <div className="space-y-4 border-t border-slate-800 pt-4">
                  <span className="text-xs font-mono font-semibold uppercase text-slate-400">Rotation (Degrees)</span>
                  
                  {/* Rot X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-red-400 font-bold">X-Axis Rotation</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={settings.rotX}
                          onChange={(e) => updateSetting('rotX', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right focus:border-red-500 outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">°</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={settings.rotX}
                        onChange={(e) => updateSetting('rotX', parseInt(e.target.value))}
                        className="flex-1 accent-red-500 cursor-pointer"
                      />
                      <button
                        onClick={() => updateSetting('rotX', (settings.rotX - 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        -90°
                      </button>
                      <button
                        onClick={() => updateSetting('rotX', (settings.rotX + 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        +90°
                      </button>
                    </div>
                  </div>

                  {/* Rot Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-green-400 font-bold">Y-Axis Rotation</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={settings.rotY}
                          onChange={(e) => updateSetting('rotY', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right focus:border-green-500 outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">°</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={settings.rotY}
                        onChange={(e) => updateSetting('rotY', parseInt(e.target.value))}
                        className="flex-1 accent-green-500 cursor-pointer"
                      />
                      <button
                        onClick={() => updateSetting('rotY', (settings.rotY - 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        -90°
                      </button>
                      <button
                        onClick={() => updateSetting('rotY', (settings.rotY + 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        +90°
                      </button>
                    </div>
                  </div>

                  {/* Rot Z */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-blue-400 font-bold">Z-Axis Rotation</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={settings.rotZ}
                          onChange={(e) => updateSetting('rotZ', parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right focus:border-blue-500 outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">°</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        step="1"
                        value={settings.rotZ}
                        onChange={(e) => updateSetting('rotZ', parseInt(e.target.value))}
                        className="flex-1 accent-blue-500 cursor-pointer"
                      />
                      <button
                        onClick={() => updateSetting('rotZ', (settings.rotZ - 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        -90°
                      </button>
                      <button
                        onClick={() => updateSetting('rotZ', (settings.rotZ + 90) % 360)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono cursor-pointer"
                      >
                        +90°
                      </button>
                    </div>
                  </div>
                </div>

                {/* Position Offset X / Y / Z with Direct Inputs */}
                <div className="space-y-4 border-t border-slate-800 pt-4">
                  <span className="text-xs font-mono font-semibold uppercase text-slate-400">Position Offset (Meters)</span>
                  
                  {['offsetX', 'offsetY', 'offsetZ'].map((axisKey, idx) => {
                    const label = ['Offset X', 'Offset Y', 'Offset Z'][idx];
                    const color = ['text-red-400', 'text-green-400', 'text-blue-400'][idx];
                    const val = settings[axisKey as keyof typeof settings] as number;

                    return (
                      <div key={axisKey} className="space-y-1.5">
                        <div className="flex justify-between items-center font-mono text-[11px]">
                          <span className={`${color} font-bold`}>{label}</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step="0.01"
                              value={val}
                              onChange={(e) => updateSetting(axisKey as any, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right focus:border-blue-500 outline-none"
                            />
                            <span className="text-slate-400 text-[11px]">m</span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min="-3.0"
                          max="3.0"
                          step="0.01"
                          value={val}
                          onChange={(e) => updateSetting(axisKey as any, parseFloat(e.target.value))}
                          className="w-full accent-slate-400 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Reset button */}
                <div className="pt-2">
                  <button
                    onClick={resetSettings}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    <span>Reset Transforms to Defaults</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: PART COLORS & MATERIALS */}
            {activeTab === 'colors' && (
              <div className="space-y-5">
                {selectedPartIndex === null ? (
                  <div className="bg-slate-950/60 rounded-xl p-4 text-center border border-slate-800 space-y-2">
                    <Palette size={24} className="mx-auto text-blue-400 opacity-60" />
                    <p className="text-xs font-mono text-slate-300 font-semibold">Select a Part from the Assembly Tree</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Choose any component on the left list to inspect its material, rename it, or customize its color.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Part Name & Rename Field */}
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-blue-400">Selected Component</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={selectedPart?.name || ''}
                          onChange={(e) => updatePartName(selectedPartIndex, e.target.value)}
                          placeholder="Part Name..."
                          className="flex-1 px-2.5 py-1.5 bg-slate-950 text-xs font-mono font-bold text-white rounded-lg border border-slate-700 outline-none focus:border-blue-500"
                        />
                        <span className="text-[10px] font-mono text-slate-400 px-2 py-1 bg-slate-900 rounded">
                          #{selectedPartIndex}
                        </span>
                      </div>
                    </div>

                    {/* Color Input */}
                    <div className="space-y-2">
                      <span className="text-xs font-mono font-semibold text-slate-300">Custom Hex Color</span>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={getSafeColor(settings.colorOverrides[selectedPartIndex] || selectedPart?.color)}
                          onChange={(e) => updatePartColor(selectedPartIndex, e.target.value)}
                          className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                        />
                        <input
                          type="text"
                          value={settings.colorOverrides[selectedPartIndex] || ''}
                          placeholder={selectedPart?.color || '#RRGGBB'}
                          onChange={(e) => updatePartColor(selectedPartIndex, e.target.value)}
                          className="flex-1 px-3 py-2 bg-slate-950 text-xs font-mono text-white rounded-lg border border-slate-800 outline-none uppercase"
                        />
                      </div>
                    </div>

                    {/* Color Presets */}
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-mono font-semibold text-slate-400">Preset Anodized Palettes</span>
                      <div className="grid grid-cols-4 gap-2">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.hex}
                            onClick={() => updatePartColor(selectedPartIndex, preset.hex)}
                            className="group flex flex-col items-center gap-1 p-2 rounded-lg bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-600 transition-all cursor-pointer"
                            title={preset.name}
                          >
                            <span
                              className="w-6 h-6 rounded-md shadow-md border border-white/20"
                              style={{ backgroundColor: preset.hex }}
                            />
                            <span className="text-[9px] font-mono text-slate-400 truncate max-w-full">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: KINEMATICS & MOTION */}
            {activeTab === 'kinematics' && (
              <div className="space-y-5">
                {selectedPartIndex === null ? (
                  <div className="bg-slate-950/60 rounded-xl p-4 text-center border border-slate-800 space-y-2">
                    <Play size={24} className="mx-auto text-amber-400 opacity-60" />
                    <p className="text-xs font-mono text-slate-300 font-semibold">Select a Part to Animate</p>
                    <p className="text-[11px] font-mono text-slate-500">
                      Pick any component from the assembly tree on the left to assign rotary RPM, oscillation sweep, or linear stroke.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Part Name Header */}
                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Kinematics Node</span>
                      <h4 className="text-xs font-bold text-white font-mono truncate">
                        {selectedPart?.name || `Part #${selectedPartIndex}`}
                      </h4>
                    </div>

                    {/* Motion Type */}
                    <div className="space-y-1.5">
                      <span className="text-xs font-mono font-semibold text-slate-300">Animation Type</span>
                      <select
                        value={activeAnim?.type || 'none'}
                        onChange={(e) =>
                          updatePartAnimation(selectedPartIndex, {
                            type: e.target.value as any,
                            axis: activeAnim?.axis || 'x',
                            speed: activeAnim?.speed || 60,
                            direction: activeAnim?.direction || 1,
                            amplitude: activeAnim?.amplitude || 35,
                            phase: activeAnim?.phase || 0,
                            pivotMode: activeAnim?.pivotMode || 'center-of-mass',
                            pivotX: activeAnim?.pivotX || 0,
                            pivotY: activeAnim?.pivotY || 0,
                            pivotZ: activeAnim?.pivotZ || 0,
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-950 text-xs font-mono text-white rounded-lg border border-slate-800 outline-none cursor-pointer"
                      >
                        <option value="none">No Motion (Static)</option>
                        <option value="continuous-spin">Continuous Spin (Rotary RPM)</option>
                        <option value="oscillate-rotation">Oscillating Rotation (Sweep)</option>
                        <option value="linear-reciprocate">Linear Reciprocating (Stroke)</option>
                      </select>
                    </div>

                    {activeAnim && activeAnim.type !== 'none' && (
                      <>
                        {/* Axis */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-mono font-semibold text-slate-300">Rotation / Motion Axis</span>
                          <div className="flex gap-2">
                            {(['x', 'y', 'z'] as const).map((ax) => (
                              <button
                                key={ax}
                                onClick={() => updatePartAnimation(selectedPartIndex, { axis: ax })}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-mono uppercase font-bold transition-all cursor-pointer ${
                                  activeAnim.axis === ax
                                    ? ax === 'x'
                                    ? 'bg-red-600 text-white'
                                    : ax === 'y'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-blue-600 text-white'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                {ax}-Axis
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Direction */}
                        <div className="space-y-1.5">
                          <span className="text-xs font-mono font-semibold text-slate-300">Spin Direction</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePartAnimation(selectedPartIndex, { direction: 1 })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.direction === 1
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Forward / CW (+1)
                            </button>
                            <button
                              onClick={() => updatePartAnimation(selectedPartIndex, { direction: -1 })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.direction === -1
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Reverse / CCW (-1)
                            </button>
                          </div>
                        </div>

                        {/* Speed in RPM with Direct Input */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs font-mono">
                            <span className="text-slate-300 font-semibold">Motion Speed</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="10000"
                                step="1"
                                value={activeAnim.speed}
                                onChange={(e) => updatePartAnimation(selectedPartIndex, { speed: parseFloat(e.target.value) || 0 })}
                                className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-amber-400 font-bold rounded border border-slate-800 text-right outline-none"
                              />
                              <span className="text-slate-400 text-[11px]">RPM</span>
                            </div>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="3000"
                            step="1"
                            value={activeAnim.speed}
                            onChange={(e) => updatePartAnimation(selectedPartIndex, { speed: parseFloat(e.target.value) })}
                            className="w-full accent-amber-500 cursor-pointer"
                          />
                        </div>

                        {/* Pivot Center Mode */}
                        <div className="space-y-2 border-t border-slate-800 pt-3">
                          <span className="text-xs font-mono font-semibold text-slate-300">Pivot Axis Center</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => updatePartAnimation(selectedPartIndex, { pivotMode: 'center-of-mass' })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.pivotMode === 'center-of-mass'
                                  ? 'bg-emerald-600 text-white font-semibold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Center of Mass
                            </button>
                            <button
                              onClick={() => updatePartAnimation(selectedPartIndex, { pivotMode: 'custom' })}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                activeAnim.pivotMode === 'custom'
                                  ? 'bg-blue-600 text-white font-semibold'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              Custom Offset
                            </button>
                          </div>
                        </div>

                        {/* Custom Pivot XYZ with Direct Inputs */}
                        {activeAnim.pivotMode === 'custom' && (
                          <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                            {['pivotX', 'pivotY', 'pivotZ'].map((pKey, idx) => {
                              const label = ['Pivot X (cm)', 'Pivot Y (cm)', 'Pivot Z (cm)'][idx];
                              const val = (activeAnim as any)[pKey] || 0;
                              return (
                                <div key={pKey} className="space-y-1.5">
                                  <div className="flex justify-between items-center font-mono text-[10px]">
                                    <span className="text-slate-400">{label}</span>
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.5"
                                        value={val}
                                        onChange={(e) =>
                                          updatePartAnimation(selectedPartIndex, { [pKey]: parseFloat(e.target.value) || 0 })
                                        }
                                        className="w-16 px-1.5 py-0.5 bg-slate-950 text-[11px] font-mono text-white rounded border border-slate-800 text-right outline-none"
                                      />
                                      <span className="text-slate-400">cm</span>
                                    </div>
                                  </div>
                                  <input
                                    type="range"
                                    min="-100"
                                    max="100"
                                    step="1"
                                    value={val}
                                    onChange={(e) =>
                                      updatePartAnimation(selectedPartIndex, { [pKey]: parseInt(e.target.value) })
                                    }
                                    className="w-full accent-blue-500 cursor-pointer"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <button
                          onClick={() => resetPartAnimation(selectedPartIndex)}
                          className="w-full py-1.5 rounded-lg text-xs font-mono text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 transition-colors cursor-pointer"
                        >
                          Remove Animation from this Part
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: CDPR CABLE ROBOT RIG & KINEMATICS */}
            {activeTab === 'cdpr' && (
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="bg-amber-950/40 p-3.5 rounded-xl border border-amber-800/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5">
                      <Cpu size={14} className="text-amber-400" />
                      <span>CDPR 4-CABLE KINEMATICS RIG</span>
                    </span>
                    <button
                      onClick={() => updateCDPRConfig({ enabled: !settings.cdprConfig.enabled })}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition-all ${
                        settings.cdprConfig.enabled
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {settings.cdprConfig.enabled ? 'RIG ACTIVE' : 'DISABLED'}
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-amber-200/70">
                    Real-time inverse kinematics simulation with dynamic end-effector plate and 8 driven cable spans.
                  </p>
                </div>

                {/* Section 1: End-Effector Central Plate */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Box size={13} className="text-orange-400" />
                    <span>End-Effector Central Plate</span>
                  </span>

                  {/* Plate Size */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Plate Width / Length</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.05"
                          max="0.80"
                          value={settings.cdprConfig.plateSize}
                          onChange={(e) => updateCDPRConfig({ plateSize: parseFloat(e.target.value) || 0.18 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.60"
                      step="0.01"
                      value={settings.cdprConfig.plateSize}
                      onChange={(e) => updateCDPRConfig({ plateSize: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                  </div>

                  {/* Plate Thickness */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Plate Thickness</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.002"
                          min="0.004"
                          max="0.08"
                          value={settings.cdprConfig.plateThickness}
                          onChange={(e) => updateCDPRConfig({ plateThickness: parseFloat(e.target.value) || 0.012 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.005"
                      max="0.05"
                      step="0.002"
                      value={settings.cdprConfig.plateThickness}
                      onChange={(e) => updateCDPRConfig({ plateThickness: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                  </div>

                  {/* Plate Elevation Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Plate Elevation (Y Plane)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="-0.80"
                          max="0.80"
                          value={settings.cdprConfig.plateElevation}
                          onChange={(e) => updateCDPRConfig({ plateElevation: parseFloat(e.target.value) || 0 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-0.60"
                      max="0.60"
                      step="0.01"
                      value={settings.cdprConfig.plateElevation}
                      onChange={(e) => updateCDPRConfig({ plateElevation: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500 cursor-pointer"
                    />
                  </div>

                  {/* Plate Color */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-mono font-semibold text-slate-300">Plate Anodized Finish</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getSafeColor(settings.cdprConfig.plateColor, '#ea580c')}
                        onChange={(e) => updateCDPRConfig({ plateColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={settings.cdprConfig.plateColor}
                        onChange={(e) => updateCDPRConfig({ plateColor: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 uppercase outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Corner Pulley Frame Boundary */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Layers size={13} className="text-blue-400" />
                    <span>Frame Corner Pulley Boundary</span>
                  </span>

                  {/* Frame Width X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-red-400 font-bold">Frame Width (X Span)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.30"
                          max="2.50"
                          value={settings.cdprConfig.frameWidth}
                          onChange={(e) => updateCDPRConfig({ frameWidth: parseFloat(e.target.value) || 0.92 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.30"
                      max="2.00"
                      step="0.01"
                      value={settings.cdprConfig.frameWidth}
                      onChange={(e) => updateCDPRConfig({ frameWidth: parseFloat(e.target.value) })}
                      className="w-full accent-red-500 cursor-pointer"
                    />
                  </div>

                  {/* Frame Depth Z */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-blue-400 font-bold">Frame Depth (Z Span)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.30"
                          max="2.50"
                          value={settings.cdprConfig.frameDepth}
                          onChange={(e) => updateCDPRConfig({ frameDepth: parseFloat(e.target.value) || 0.92 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.30"
                      max="2.00"
                      step="0.01"
                      value={settings.cdprConfig.frameDepth}
                      onChange={(e) => updateCDPRConfig({ frameDepth: parseFloat(e.target.value) })}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  {/* Pulley Elevation Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-green-400 font-bold">Corner Pulley Elevation (Y)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="-1.00"
                          max="1.50"
                          value={settings.cdprConfig.pulleyElevation}
                          onChange={(e) => updateCDPRConfig({ pulleyElevation: parseFloat(e.target.value) || 0.38 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-0.80"
                      max="1.00"
                      step="0.01"
                      value={settings.cdprConfig.pulleyElevation}
                      onChange={(e) => updateCDPRConfig({ pulleyElevation: parseFloat(e.target.value) })}
                      className="w-full accent-green-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Section 3: Winch Anchor Positions */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <RotateCw size={13} className="text-amber-400" />
                    <span>4 Frame Winch Spool Anchors</span>
                  </span>

                  {/* Winch Offset Y */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Winch Elevation (Y)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="-1.00"
                          max="1.00"
                          value={settings.cdprConfig.winchOffsetY}
                          onChange={(e) => updateCDPRConfig({ winchOffsetY: parseFloat(e.target.value) || -0.36 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="-0.80"
                      max="0.80"
                      step="0.01"
                      value={settings.cdprConfig.winchOffsetY}
                      onChange={(e) => updateCDPRConfig({ winchOffsetY: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Winch Inset X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Winch Inset from Corner (X)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.00"
                          max="0.50"
                          value={settings.cdprConfig.winchInsetX}
                          onChange={(e) => updateCDPRConfig({ winchInsetX: parseFloat(e.target.value) || 0.05 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="0.40"
                      step="0.01"
                      value={settings.cdprConfig.winchInsetX}
                      onChange={(e) => updateCDPRConfig({ winchInsetX: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Winch Inset Z */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Winch Inset from Corner (Z)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.00"
                          max="0.50"
                          value={settings.cdprConfig.winchInsetZ}
                          onChange={(e) => updateCDPRConfig({ winchInsetZ: parseFloat(e.target.value) || 0.05 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.00"
                      max="0.40"
                      step="0.01"
                      value={settings.cdprConfig.winchInsetZ}
                      onChange={(e) => updateCDPRConfig({ winchInsetZ: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Section 4: Motion Trajectory & Bounds */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Play size={13} className="text-emerald-400" />
                    <span>End-Effector Trajectory & Range</span>
                  </span>

                  {/* Motion Pattern Dropdown */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-slate-300">Kinematic Motion Pattern</span>
                    <select
                      value={settings.cdprConfig.motionPattern}
                      onChange={(e) => updateCDPRConfig({ motionPattern: e.target.value as any })}
                      className="w-full px-3 py-2 bg-slate-950 text-xs font-mono text-white rounded-lg border border-slate-800 outline-none cursor-pointer"
                    >
                      <option value="lissajous">Harmonic Lissajous (Continuous Sweep)</option>
                      <option value="wander">Multi-Frequency Workspace Wander</option>
                      <option value="circle">Planar Circular Trajectory</option>
                      <option value="square">Perimeter Square Scan</option>
                      <option value="static">Static Rest (Neutral Center)</option>
                    </select>
                  </div>

                  {/* Travel Range X */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Travel Bounds (±X)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.05"
                          max="1.00"
                          value={settings.cdprConfig.motionRangeX}
                          onChange={(e) => updateCDPRConfig({ motionRangeX: parseFloat(e.target.value) || 0.45 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.90"
                      step="0.01"
                      value={settings.cdprConfig.motionRangeX}
                      onChange={(e) => updateCDPRConfig({ motionRangeX: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Travel Range Z */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Travel Bounds (±Z)</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.05"
                          max="1.00"
                          value={settings.cdprConfig.motionRangeZ}
                          onChange={(e) => updateCDPRConfig({ motionRangeZ: parseFloat(e.target.value) || 0.45 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">m</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.90"
                      step="0.01"
                      value={settings.cdprConfig.motionRangeZ}
                      onChange={(e) => updateCDPRConfig({ motionRangeZ: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Speed Multiplier */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-300">Motion Speed</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="10.0"
                          value={settings.cdprConfig.motionSpeed}
                          onChange={(e) => updateCDPRConfig({ motionSpeed: parseFloat(e.target.value) || 1.0 })}
                          className="w-18 px-2 py-0.5 bg-slate-950 text-xs font-mono text-emerald-400 font-bold rounded border border-slate-800 text-right outline-none"
                        />
                        <span className="text-slate-400 text-[11px]">x</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="4.0"
                      step="0.1"
                      value={settings.cdprConfig.motionSpeed}
                      onChange={(e) => updateCDPRConfig({ motionSpeed: parseFloat(e.target.value) })}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Section 5: Cable Visuals */}
                <div className="space-y-4 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-xs font-mono font-bold uppercase text-slate-300 flex items-center gap-1.5">
                    <Palette size={13} className="text-sky-400" />
                    <span>Cable Aesthetics & Boundaries</span>
                  </span>

                  {/* Cable Color */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-slate-300">Driven Cable Color</span>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={getSafeColor(settings.cdprConfig.cableColor, '#38bdf8')}
                        onChange={(e) => updateCDPRConfig({ cableColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                      />
                      <input
                        type="text"
                        value={settings.cdprConfig.cableColor}
                        onChange={(e) => updateCDPRConfig({ cableColor: e.target.value })}
                        className="flex-1 px-3 py-1.5 bg-slate-950 text-xs font-mono text-white rounded border border-slate-800 uppercase outline-none"
                      />
                    </div>
                  </div>

                  {/* Toggle Workspace Boundary Box */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-mono text-slate-300">Show Workspace Travel Bounds</span>
                    <button
                      onClick={() => updateCDPRConfig({ showWorkspaceBoundary: !settings.cdprConfig.showWorkspaceBoundary })}
                      className={`px-3 py-1 rounded text-xs font-mono cursor-pointer transition-all ${
                        settings.cdprConfig.showWorkspaceBoundary
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {settings.cdprConfig.showWorkspaceBoundary ? 'VISIBLE' : 'HIDDEN'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: EXPORT */}
            {activeTab === 'export' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-300">Generated TypeScript Snippet</span>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition-all cursor-pointer shadow-lg shadow-blue-500/20"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                  </button>
                </div>

                <div className="relative">
                  <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-96">
                    <code>{generatedCode}</code>
                  </pre>
                </div>

                <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
                  Paste this snippet directly into your model component (e.g. <code className="text-slate-300">CableRobotModel.tsx</code> or <code className="text-slate-300">PingPongRobotModel.tsx</code>) to permanently bake in these calibrations!
                </p>
              </div>
            )}

          </div>
        </aside>

      </div>
    </div>
  );
};
