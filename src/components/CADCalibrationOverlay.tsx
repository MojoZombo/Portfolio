import React, { useState } from 'react';
import { useTransformCalibration, AnimationType, PivotMode } from '../context/TransformCalibrationContext';
import {
  Sliders,
  X,
  RotateCcw,
  Copy,
  Check,
  Eye,
  EyeOff,
  Play,
  Pause,
  Palette,
  Sparkles,
  Hash,
  Activity,
  Zap,
  Crosshair,
  RotateCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Quick Preset Engineering Palettes
const PRESET_PALETTE = [
  { name: 'Alloy 6061', color: '#cbd5e1' },
  { name: 'Charcoal', color: '#1e293b' },
  { name: 'Gold Anodize', color: '#ca8a04' },
  { name: 'Safety Orange', color: '#ea580c' },
  { name: 'Robotics Blue', color: '#2563eb' },
  { name: 'Emerald', color: '#059669' },
  { name: 'Delrin White', color: '#f8fafc' },
  { name: 'Warning Red', color: '#dc2626' },
];

function sanitizeHex(val: string): string {
  let clean = val.trim();
  if (!clean.startsWith('#')) {
    clean = '#' + clean;
  }
  return clean;
}

function isValidHex(hex: string): boolean {
  return /^#([0-9A-F]{3}){1,2}$/i.test(hex);
}

export const CADCalibrationOverlay: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    activeModelId,
    selectedPartIndex,
    setSelectedPartIndex,
    settings,
    availableParts,
    updateSetting,
    updatePartColor,
    updatePartAnimation,
    resetPartAnimation,
    resetSettings,
  } = useTransformCalibration();

  const [copied, setCopied] = useState(false);
  const [hexInputMap, setHexInputMap] = useState<Record<number, string>>({});

  const copyConfigCode = () => {
    const hasColorOverrides = Object.keys(settings.colorOverrides).length > 0;
    const hasAnimOverrides = Object.keys(settings.animationOverrides).length > 0;
    
    let code = `// Optimal CAD Alignment Settings for [${activeModelId}]:
const offset: [number, number, number] = [${settings.offsetX.toFixed(2)}, ${settings.offsetY.toFixed(2)}, ${settings.offsetZ.toFixed(2)}];
const rotation: [number, number, number] = [${((settings.rotX * Math.PI) / 180).toFixed(3)}, ${((settings.rotY * Math.PI) / 180).toFixed(3)}, ${((settings.rotZ * Math.PI) / 180).toFixed(3)}]; // [${settings.rotX}°, ${settings.rotY}°, ${settings.rotZ}°]
const scale = ${settings.scale.toFixed(2)};`;

    if (hasColorOverrides) {
      code += `\n\n// Custom Part Color Overrides:
const partColorOverrides: Record<number, string> = ${JSON.stringify(settings.colorOverrides, null, 2)};`;
    }

    if (hasAnimOverrides) {
      code += `\n\n// Custom Part Animations:
const partAnimationOverrides = ${JSON.stringify(settings.animationOverrides, null, 2)};`;
    }

    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHexChange = (partIndex: number, rawValue: string) => {
    setHexInputMap((prev) => ({ ...prev, [partIndex]: rawValue }));
    const formatted = sanitizeHex(rawValue);
    if (isValidHex(formatted)) {
      updatePartColor(partIndex, formatted.toLowerCase());
    }
  };

  const selectedPart = selectedPartIndex !== null ? availableParts[selectedPartIndex] : null;
  const selectedPartColor = selectedPartIndex !== null
    ? (settings.colorOverrides[selectedPartIndex] || selectedPart?.color || '#cbd5e1')
    : '';

  const activeAnim = selectedPartIndex !== null
    ? settings.animationOverrides[selectedPartIndex] || {
        type: 'none' as AnimationType,
        axis: 'z' as const,
        direction: 1 as (1 | -1),
        speed: 10,
        amplitude: 35,
        phase: 0,
        pivotMode: 'center-of-mass' as PivotMode,
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      }
    : null;

  return (
    <>
      {/* Floating Activator Button (Bottom Right) */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-xs font-semibold shadow-xl border transition-all cursor-pointer ${
            isOpen
              ? 'bg-blue-600 text-white border-blue-500 ring-2 ring-blue-400/30'
              : 'bg-white/90 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:scale-105'
          }`}
          title="Toggle 3D CAD Pivot, Color & Animation Tool (Shortcut: Shift + C)"
        >
          <Sliders size={14} className={isOpen ? 'animate-spin' : ''} />
          <span>{isOpen ? 'Close Align Tool' : 'Align 3D Pivot'}</span>
          <span className="hidden sm:inline-block px-1.5 py-0.2 rounded bg-black/10 dark:bg-white/10 text-[10px]">
            ⇧C
          </span>
        </button>
      </div>

      {/* Floating GUI Calibration Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-20 right-5 z-40 w-80 sm:w-[450px] max-h-[84vh] overflow-y-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-900 dark:text-slate-100 font-mono text-xs select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
                <div>
                  <h3 className="font-bold text-sm leading-tight">CAD PIVOT, COLOR & KINEMATICS</h3>
                  <p className="text-[10px] text-blue-500 font-semibold uppercase">
                    ACTIVE: {activeModelId || 'CAD MODEL'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedPartIndex(null);
                  setIsOpen(false);
                }}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Quick Actions Bar */}
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => updateSetting('showGizmo', !settings.showGizmo)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  {settings.showGizmo ? <Eye size={12} className="text-emerald-500" /> : <EyeOff size={12} />}
                  <span>{settings.showGizmo ? 'Gizmo ON' : 'Gizmo OFF'}</span>
                </button>

                <button
                  onClick={() => updateSetting('autoRotate', !settings.autoRotate)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                >
                  {settings.autoRotate ? <Pause size={12} className="text-amber-500" /> : <Play size={12} />}
                  <span>{settings.autoRotate ? 'Pause Spin' : 'Test Spin'}</span>
                </button>

                <button
                  onClick={resetSettings}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer"
                  title="Reset to model defaults"
                >
                  <RotateCcw size={12} />
                  <span>Reset All</span>
                </button>
              </div>

              {/* 1. Pivot Point Shift (X, Y, Z Offsets) */}
              <div className="space-y-2.5">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  1. Shift Assembly Pivot Point (Offsets)
                </span>
                
                {/* Offset X */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-red-500 font-bold">X Offset (Lateral)</span>
                    <span>{settings.offsetX.toFixed(2)} m</span>
                  </div>
                  <input
                    type="range"
                    min="-4.0"
                    max="4.0"
                    step="0.05"
                    value={settings.offsetX}
                    onChange={(e) => updateSetting('offsetX', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                </div>

                {/* Offset Y */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-emerald-500 font-bold">Y Offset (Height / Vertical)</span>
                    <span>{settings.offsetY.toFixed(2)} m</span>
                  </div>
                  <input
                    type="range"
                    min="-4.0"
                    max="4.0"
                    step="0.05"
                    value={settings.offsetY}
                    onChange={(e) => updateSetting('offsetY', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Offset Z */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-blue-500 font-bold">Z Offset (Depth)</span>
                    <span>{settings.offsetZ.toFixed(2)} m</span>
                  </div>
                  <input
                    type="range"
                    min="-4.0"
                    max="4.0"
                    step="0.05"
                    value={settings.offsetZ}
                    onChange={(e) => updateSetting('offsetZ', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>
              </div>

              {/* 2. Resting Orientation (Rotations in Degrees) */}
              <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  2. Resting Orientation (Degrees)
                </span>

                {/* Rot X */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span>Pitch (X Rotation)</span>
                    <span>{settings.rotX}°</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={settings.rotX}
                    onChange={(e) => updateSetting('rotX', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Rot Y */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span>Yaw (Y Rotation)</span>
                    <span>{settings.rotY}°</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={settings.rotY}
                    onChange={(e) => updateSetting('rotY', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Rot Z */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span>Roll (Z Rotation)</span>
                    <span>{settings.rotZ}°</span>
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={settings.rotZ}
                    onChange={(e) => updateSetting('rotZ', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              {/* 3. Model Scale & Spin Speed */}
              <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  3. Size & Spin Speed
                </span>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span>Scale Multiplier</span>
                    <span>{settings.scale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={settings.scale}
                    onChange={(e) => updateSetting('scale', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span>Turntable Speed</span>
                    <span>{settings.rotationSpeed.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={settings.rotationSpeed}
                    onChange={(e) => updateSetting('rotationSpeed', parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              {/* 4. Part Color Customizer */}
              <div className="space-y-2.5 border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette size={13} className="text-pink-500" />
                    <span>4. Custom Part Colors ({availableParts.length} Parts)</span>
                  </span>
                </div>

                {/* Preset Chips & Direct Hex Bar */}
                <div className="space-y-2 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 flex items-center gap-1 font-semibold">
                      <Sparkles size={11} className="text-amber-400" />
                      <span>
                        {selectedPartIndex !== null
                          ? `Selected in 3D: Part #${selectedPartIndex + 1}`
                          : 'Click a part to highlight in 3D, recolor or animate:'}
                      </span>
                    </span>
                    {selectedPartIndex !== null && (
                      <button
                        onClick={() => setSelectedPartIndex(null)}
                        className="text-[9px] text-blue-500 hover:underline cursor-pointer"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  {/* Active Selected Part Direct Hex Input Bar */}
                  {selectedPartIndex !== null && (
                    <div className="flex items-center gap-2 p-1.5 rounded-md bg-blue-50/80 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-700">
                      <Hash size={13} className="text-blue-500 shrink-0" />
                      <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold shrink-0">
                        Part #{selectedPartIndex + 1} Hex:
                      </span>
                      <input
                        type="text"
                        value={hexInputMap[selectedPartIndex] ?? selectedPartColor}
                        onChange={(e) => handleHexChange(selectedPartIndex, e.target.value)}
                        placeholder="#1e293b"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-0.5 text-xs font-mono uppercase text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        maxLength={7}
                      />
                      <input
                        type="color"
                        value={isValidHex(selectedPartColor) ? selectedPartColor : '#cbd5e1'}
                        onChange={(e) => {
                          updatePartColor(selectedPartIndex, e.target.value);
                          setHexInputMap((prev) => ({ ...prev, [selectedPartIndex]: e.target.value }));
                        }}
                        className="w-6 h-6 rounded border border-slate-300 dark:border-slate-600 cursor-pointer p-0 bg-transparent"
                      />
                    </div>
                  )}

                  {/* Preset Engineering Color Chips */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {PRESET_PALETTE.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          if (selectedPartIndex !== null) {
                            updatePartColor(selectedPartIndex, preset.color);
                            setHexInputMap((prev) => ({ ...prev, [selectedPartIndex]: preset.color }));
                          }
                        }}
                        className="group flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px] hover:scale-105 transition-all cursor-pointer shadow-xs"
                        title={`Apply ${preset.name} (${preset.color})`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: preset.color }}
                        />
                        <span className="text-slate-600 dark:text-slate-300">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scrollable Part Color Items List with Animation Badge */}
                {availableParts.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 border border-slate-200 dark:border-slate-800 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-900/50">
                    {availableParts.map((part) => {
                      const activeColor = settings.colorOverrides[part.index] || part.color;
                      const isSelected = selectedPartIndex === part.index;
                      const currentHexText = hexInputMap[part.index] ?? activeColor;
                      const hasAnim = settings.animationOverrides[part.index] && settings.animationOverrides[part.index].type !== 'none';

                      return (
                        <div
                          key={part.index}
                          onClick={() => setSelectedPartIndex(isSelected ? null : part.index)}
                          className={`flex items-center justify-between p-1.5 rounded-md border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-100/80 dark:bg-blue-900/40 border-blue-500 ring-2 ring-blue-500/30'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                            }`}>
                              #{(part.index + 1).toString().padStart(2, '0')}
                            </span>
                            <span className="text-[11px] truncate font-medium text-slate-700 dark:text-slate-200">
                              {part.name}
                            </span>
                            {hasAnim && (
                              <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[9px] font-bold flex items-center gap-0.5">
                                <Zap size={9} />
                                <span>ANIM</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={currentHexText}
                              onChange={(e) => handleHexChange(part.index, e.target.value)}
                              onFocus={() => setSelectedPartIndex(part.index)}
                              className="w-16 px-1 py-0.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[10px] font-mono uppercase text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center"
                              maxLength={7}
                              placeholder="#000000"
                            />
                            <input
                              type="color"
                              value={isValidHex(activeColor) ? activeColor : '#cbd5e1'}
                              onChange={(e) => {
                                setSelectedPartIndex(part.index);
                                updatePartColor(part.index, e.target.value);
                                setHexInputMap((prev) => ({ ...prev, [part.index]: e.target.value }));
                              }}
                              className="w-5 h-5 rounded border border-slate-300 dark:border-slate-600 cursor-pointer p-0 bg-transparent"
                              title={`Pick color for ${part.name}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-400 p-2 text-center">
                    Scroll into active focus on a model to inspect its parts.
                  </div>
                )}
              </div>

              {/* 5. Part Kinematics, Animation & Pivot Center Controls */}
              <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Activity size={13} className="text-amber-500" />
                    <span>5. Part Kinematics & Rotation Center</span>
                  </span>
                  {selectedPartIndex !== null && activeAnim && activeAnim.type !== 'none' && (
                    <button
                      onClick={() => resetPartAnimation(selectedPartIndex)}
                      className="text-[10px] text-red-500 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RotateCcw size={10} />
                      <span>Reset Motion</span>
                    </button>
                  )}
                </div>

                {selectedPartIndex !== null && activeAnim ? (
                  <div className="space-y-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-400/30 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 truncate">
                        Kinematics for Part #{selectedPartIndex + 1}: {selectedPart?.name}
                      </span>
                    </div>

                    {/* Animation Mode Selector */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold block">
                        Motion Type:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'none', label: 'Static (None)' },
                          { id: 'continuous-spin', label: 'Continuous Spin 🔄' },
                          { id: 'oscillate-rotation', label: 'Oscillate Angle ↔️' },
                          { id: 'linear-reciprocate', label: 'Linear Piston ↕️' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            onClick={() =>
                              updatePartAnimation(selectedPartIndex, { type: m.id as AnimationType })
                            }
                            className={`px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all cursor-pointer text-left ${
                              activeAnim.type === m.id
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Motion Settings if active */}
                    {activeAnim.type !== 'none' && (
                      <div className="space-y-3 pt-2 border-t border-amber-400/20">
                        {/* Axis & Direction Row */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                              Axis:
                            </span>
                            <div className="flex gap-1">
                              {(['x', 'y', 'z'] as const).map((axis) => (
                                <button
                                  key={axis}
                                  onClick={() => updatePartAnimation(selectedPartIndex, { axis })}
                                  className={`w-7 h-6 rounded text-[10px] font-bold uppercase transition-all cursor-pointer ${
                                    activeAnim.axis === axis
                                      ? axis === 'x'
                                        ? 'bg-red-500 text-white'
                                        : axis === 'y'
                                        ? 'bg-emerald-500 text-white'
                                        : 'bg-blue-500 text-white'
                                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {axis}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Spin Direction Reverse Button */}
                          <button
                            onClick={() =>
                              updatePartAnimation(selectedPartIndex, {
                                direction: (activeAnim.direction === 1 ? -1 : 1),
                              })
                            }
                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                              activeAnim.direction === -1
                                ? 'bg-amber-600 text-white border-amber-500'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                            title="Toggle Spin Direction (Clockwise vs Counter-Clockwise)"
                          >
                            <RotateCw size={11} className={activeAnim.direction === -1 ? 'rotate-180' : ''} />
                            <span>{activeAnim.direction === -1 ? 'Reverse (CCW ↺)' : 'Forward (CW ↻)'}</span>
                          </button>
                        </div>

                        {/* Pivot Point of Rotation / Center of Mass Selector */}
                        <div className="space-y-1.5 pt-1 border-t border-amber-400/20">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Crosshair size={11} />
                            <span>Rotation Center / Pivot Point:</span>
                          </span>

                          <div className="grid grid-cols-3 gap-1">
                            {[
                              { id: 'center-of-mass', label: 'Center of Mass 🎯' },
                              { id: 'custom', label: 'Custom Pivot 📍' },
                              { id: 'origin', label: 'Assembly (0,0,0)' },
                            ].map((p) => (
                              <button
                                key={p.id}
                                onClick={() =>
                                  updatePartAnimation(selectedPartIndex, { pivotMode: p.id as PivotMode })
                                }
                                className={`px-1 py-1 rounded text-[9px] font-semibold text-center transition-all cursor-pointer truncate ${
                                  activeAnim.pivotMode === p.id
                                    ? 'bg-amber-600 text-white shadow-xs font-bold'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                }`}
                                title={p.label}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>

                          {/* Custom Pivot Offset Sliders (cm) */}
                          {activeAnim.pivotMode === 'custom' && (
                            <div className="space-y-1.5 p-2 rounded-lg bg-white/70 dark:bg-slate-900/70 border border-amber-400/30">
                              <span className="text-[9px] text-slate-400 font-semibold block">
                                Fine-tune Part Pivot Point (cm):
                              </span>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px]">
                                  <span className="text-red-500 font-bold">Pivot X Offset</span>
                                  <span>{activeAnim.pivotX} cm</span>
                                </div>
                                <input
                                  type="range"
                                  min="-50"
                                  max="50"
                                  step="1"
                                  value={activeAnim.pivotX}
                                  onChange={(e) =>
                                    updatePartAnimation(selectedPartIndex, { pivotX: parseInt(e.target.value) })
                                  }
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded appearance-none cursor-pointer accent-red-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px]">
                                  <span className="text-emerald-500 font-bold">Pivot Y Offset</span>
                                  <span>{activeAnim.pivotY} cm</span>
                                </div>
                                <input
                                  type="range"
                                  min="-50"
                                  max="50"
                                  step="1"
                                  value={activeAnim.pivotY}
                                  onChange={(e) =>
                                    updatePartAnimation(selectedPartIndex, { pivotY: parseInt(e.target.value) })
                                  }
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded appearance-none cursor-pointer accent-emerald-500"
                                />
                              </div>

                              <div className="space-y-1">
                                <div className="flex justify-between text-[9px]">
                                  <span className="text-blue-500 font-bold">Pivot Z Offset</span>
                                  <span>{activeAnim.pivotZ} cm</span>
                                </div>
                                <input
                                  type="range"
                                  min="-50"
                                  max="50"
                                  step="1"
                                  value={activeAnim.pivotZ}
                                  onChange={(e) =>
                                    updatePartAnimation(selectedPartIndex, { pivotZ: parseInt(e.target.value) })
                                  }
                                  className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded appearance-none cursor-pointer accent-blue-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Motion Speed in RPM Slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span>
                              {activeAnim.type === 'linear-reciprocate' ? 'Stroke Frequency' : 'Rotational Speed'}
                            </span>
                            <span className="font-bold text-amber-500">
                              {activeAnim.type === 'linear-reciprocate'
                                ? `${activeAnim.speed.toFixed(1)} Hz`
                                : `${activeAnim.speed.toFixed(1)} RPM`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="60.0"
                            step="0.2"
                            value={activeAnim.speed}
                            onChange={(e) =>
                              updatePartAnimation(selectedPartIndex, { speed: parseFloat(e.target.value) })
                            }
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>

                        {/* Amplitude / Stroke Sliders */}
                        {activeAnim.type === 'linear-reciprocate' ? (
                          <div className="space-y-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between text-[10px] font-semibold text-amber-500">
                              <span>Translation Distances</span>
                              <span>
                                Total: {(
                                  (activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10)) +
                                  (activeAnim.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim.amplitude || 10))
                                ).toFixed(1)} cm
                              </span>
                            </div>

                            {/* Forward Distance (+ Axis) */}
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Forward (+{activeAnim.axis.toUpperCase()})</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10)} cm
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="50"
                                step="0.5"
                                value={activeAnim.amplitudePositive !== undefined ? activeAnim.amplitudePositive : (activeAnim.amplitude || 10)}
                                onChange={(e) =>
                                  updatePartAnimation(selectedPartIndex, { amplitudePositive: parseFloat(e.target.value) })
                                }
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                              />
                            </div>

                            {/* Reverse Distance (- Axis) */}
                            <div className="space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="text-rose-600 dark:text-rose-400 font-medium">Reverse (-{activeAnim.axis.toUpperCase()})</span>
                                <span className="font-bold text-rose-600 dark:text-rose-400">
                                  {activeAnim.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim.amplitude || 10)} cm
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="50"
                                step="0.5"
                                value={activeAnim.amplitudeNegative !== undefined ? activeAnim.amplitudeNegative : (activeAnim.amplitude || 10)}
                                onChange={(e) =>
                                  updatePartAnimation(selectedPartIndex, { amplitudeNegative: parseFloat(e.target.value) })
                                }
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
                              />
                            </div>
                          </div>
                        ) : activeAnim.type === 'oscillate-rotation' ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span>Angle Amplitude</span>
                              <span className="font-bold text-amber-500">{activeAnim.amplitude}°</span>
                            </div>
                            <input
                              type="range"
                              min="5"
                              max="180"
                              step="5"
                              value={activeAnim.amplitude}
                              onChange={(e) =>
                                updatePartAnimation(selectedPartIndex, { amplitude: parseFloat(e.target.value) })
                              }
                              className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                          </div>
                        ) : null}

                        {/* Phase Offset Slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px]">
                            <span>Wave Phase Offset</span>
                            <span className="font-bold text-amber-500">{activeAnim.phase}°</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="360"
                            step="15"
                            value={activeAnim.phase}
                            onChange={(e) =>
                              updatePartAnimation(selectedPartIndex, { phase: parseInt(e.target.value) })
                            }
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-center text-[10px] text-slate-400">
                    Click any part in section 4 above to configure its real-time kinematics and motion.
                  </div>
                )}
              </div>

              {/* Copy Lock-in Code */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={copyConfigCode}
                  className="w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied Alignment, Colors & Motion!' : 'Copy Code Values'}</span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
