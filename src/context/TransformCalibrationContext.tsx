import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface PartColorInfo {
  index: number;
  name: string;
  color: string;
}

export type AnimationType = 'none' | 'continuous-spin' | 'oscillate-rotation' | 'linear-reciprocate';
export type PivotMode = 'center-of-mass' | 'custom' | 'origin';

export interface PartAnimationConfig {
  type: AnimationType;
  axis: 'x' | 'y' | 'z';
  direction: 1 | -1; // 1 = Clockwise / Forward, -1 = Counter-Clockwise / Reverse
  speed: number;
  amplitude: number; // in degrees for rotation, or centimeters for linear
  phase: number; // in degrees
  pivotMode: PivotMode;
  pivotX: number; // in cm
  pivotY: number;
  pivotZ: number;
}

export interface CDPRConfig {
  enabled: boolean;
  plateSize: number;
  plateThickness: number;
  plateElevation: number;
  plateColor: string;
  frameWidth: number;
  frameDepth: number;
  pulleyElevation: number;
  winchOffsetY: number;
  winchInsetX: number;
  winchInsetZ: number;
  motionRangeX: number;
  motionRangeZ: number;
  motionSpeed: number;
  motionPattern: 'lissajous' | 'wander' | 'circle' | 'square' | 'static';
  cableColor: string;
  cableThickness: number;
  showWorkspaceBoundary: boolean;
}

export const DEFAULT_CDPR_CONFIG: CDPRConfig = {
  enabled: true,
  plateSize: 0.20,
  plateThickness: 0.015,
  plateElevation: 0.00,
  plateColor: '#ea580c',
  frameWidth: 0.95,
  frameDepth: 0.95,
  pulleyElevation: 0.40,
  winchOffsetY: -0.38,
  winchInsetX: 0.05,
  winchInsetZ: 0.05,
  motionRangeX: 0.48,
  motionRangeZ: 0.48,
  motionSpeed: 1.0,
  motionPattern: 'lissajous',
  cableColor: '#38bdf8',
  cableThickness: 1.5,
  showWorkspaceBoundary: true,
};

export interface TransformSettings {
  modelId: string;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  rotX: number; // in degrees
  rotY: number;
  rotZ: number;
  scale: number;
  autoRotate: boolean;
  rotationSpeed: number;
  showGizmo: boolean;
  colorOverrides: Record<number, string>; // partIndex -> hex color
  animationOverrides: Record<number, PartAnimationConfig>; // partIndex -> animation config
  nameOverrides: Record<number, string>; // partIndex -> custom user renamed string
  cdprConfig: CDPRConfig;
}

// Built-in calibrated model defaults for instantaneous, zero-latency sync in Studio
const BUILTIN_MODEL_DEFAULTS: Record<string, Partial<RegisteredModelDefaults>> = {
  catamaran: {
    modelId: 'catamaran',
    offset: [0.00, 0.00, 0.00],
    rotation: [-90.0, 0.0, 0.0],
    scale: 2.60,
    defaultColors: {
      2: '#cbd5e1',
      3: '#cbd5e1',
      4: '#cbd5e1',
      8: '#1e293b',
      9: '#1e293b',
      10: '#1e293b',
      11: '#1e293b',
      12: '#1e293b',
      13: '#1e293b',
      14: '#3b82f6',
      15: '#3b82f6',
      16: '#3b82f6',
      17: '#3b82f6',
      18: '#0284c7',
      19: '#003262',
      20: '#FDB515',
      21: '#003262',
      22: '#003262',
      23: '#003262',
      24: '#003262',
      30: '#FDB515',
      31: '#FDB515',
      32: '#FDB515',
      33: '#FDB515',
      34: '#FDB515',
      35: '#FDB515',
    },
    defaultAnimations: {},
  },
  'robot-hand': {
    modelId: 'robot-hand',
    offset: [0.00, -0.45, 0.00],
    rotation: [0, -45, 0],
    scale: 3.5,
    defaultColors: {},
    defaultAnimations: {},
  },
  'modular-gripper': {
    modelId: 'modular-gripper',
    offset: [0.00, 0.00, 0.00],
    rotation: [0.0, 0.0, 0.0],
    scale: 8.50,
    defaultColors: {
      0: '#475569', // Gripper_Attachment_Base-1001
      7: '#3b82f6', // Mesh_108
      9: '#3b82f6', // Mesh_108_2
      14: '#1e293b', // Rubber_Pad-1006
      16: '#475569', // Gripper_Attachment_Base-1007
      17: '#1e293b', // Rubber_Pad-1007
      18: '#c19a6b', // XEG-64_滑塊stp-1011
      19: '#f25f5f', // P46_JRB_Bracket-1003
    },
    defaultAnimations: {},
  },
  'underwater-robot': {
    modelId: 'underwater-robot',
    offset: [0.00, 0.00, 0.00],
    rotation: [0.0, 0.0, 0.0],
    scale: 5.50,
    defaultColors: {
      0: '#003262', // dropperBottom-1
      1: '#FDB515', // dropperPlatform-2
      2: '#64748b', // Mesh_8
      3: '#64748b', // Mesh_8_1
      4: '#64748b', // Mesh_8_2
      11: '#003262', // Mesh_46
      13: '#FDB515', // Mesh_49
      14: '#FDB515', // Mesh_49_1
      16: '#cbd5e1', // Mesh_36_1
      19: '#cbd5e1', // Mesh_36_4
      20: '#cbd5e1', // Mesh_37
      22: '#1e293b', // Mesh_37_2
      23: '#64748b', // Mesh_37_3
      24: '#64748b', // Mesh_37_4
      25: '#64748b', // Mesh_37_5
      26: '#64748b', // Mesh_37_6
      27: '#64748b', // Mesh_37_7
      28: '#003262', // Dynamic_Gripper-1
      29: '#64748b', // M200_Motor-1
      30: '#64748b', // Mesh_15
      31: '#64748b', // Mesh_15_1
      32: '#003262', // CameraMountBack_-_Radial-2
      33: '#475569', // CameraMountFront_-_Radial-1
      35: '#3f5b88', // Mesh_4
      37: '#FDB515', // VerticalDoubleThruster-2
    },
    defaultAnimations: {},
  },
  'anti-tangle-winch': {
    modelId: 'anti-tangle-winch',
    offset: [0.00, 0.00, 0.00],
    rotation: [-180.0, 0.0, 0.0],
    scale: 18.0,
    defaultColors: {
      0: '#475569', // Mesh_0
      1: '#475569', // Mesh_0_1
      2: '#475569', // Mesh_0_2
      3: '#475569', // CONV-HDW00-065-01-1
      4: '#475569', // Mesh_4
      5: '#475569', // Mesh_4_1
      6: '#c19a6b', // Mesh_2
      7: '#f8debf', // Mesh_2_1
      8: '#c19a6b', // Mesh_2_2
      9: '#FDB515', // Mesh_2_3
      10: '#FDB515', // Mesh_2_4
      11: '#64748b', // CONV-WIN00-011-03-1
      12: '#475569', // dowel-1
      13: '#475569', // dowel-2
      14: '#f8fafc', // Retaining_Ring_45-1
      16: '#475569', // CONV-HDW00-064-01-1001
      21: '#0284c7', // Reversing_Screw_Rectangle_profile-1001
      22: '#475569', // shaft_collar_print-1001
    },
    defaultAnimations: {},
  },
  'cable-robot-2': {
    modelId: 'cable-robot-2',
    offset: [0.00, -0.10, 0.00],
    rotation: [0, 30, 0],
    scale: 1.6,
    defaultColors: {},
    defaultAnimations: {},
  },
  'ping-pong': {
    modelId: 'ping-pong',
    offset: [0.00, 0.00, 0.00],
    rotation: [0, 0, 0],
    scale: 5.50,
    defaultColors: {},
    defaultAnimations: {},
  },
  'drone-catch': {
    modelId: 'drone-catch',
    offset: [0.00, 0.00, 0.00],
    rotation: [-90, 0, 0],
    scale: 18.0,
    defaultColors: {},
    defaultAnimations: {},
  },
  outrigger: {
    modelId: 'outrigger',
    offset: [0.00, -0.20, 0.00],
    rotation: [0, 45, 0],
    scale: 1.8,
    defaultColors: {},
    defaultAnimations: {},
  },
  'bottle-scrubber': {
    modelId: 'bottle-scrubber',
    offset: [0.00, -0.30, 0.00],
    rotation: [0, 0, 0],
    scale: 2.2,
    defaultColors: {},
    defaultAnimations: {},
  },
  'ftc-robot': {
    modelId: 'ftc-robot',
    offset: [0.00, -0.20, 0.00],
    rotation: [0, 45, 0],
    scale: 1.6,
    defaultColors: {},
    defaultAnimations: {},
  },
};

function getModelSettings(modelId: string, registered?: RegisteredModelDefaults): TransformSettings {
  const builtin = BUILTIN_MODEL_DEFAULTS[modelId];
  const offset = registered?.offset || builtin?.offset || [0, 0, 0];
  const rotation = registered?.rotation || builtin?.rotation || [0, 0, 0];
  const scale = registered?.scale ?? builtin?.scale ?? 1.0;
  const defaultColors = { ...(builtin?.defaultColors || {}), ...(registered?.defaultColors || {}) };
  const defaultAnimations = { ...(builtin?.defaultAnimations || {}), ...(registered?.defaultAnimations || {}) };

  return {
    modelId,
    offsetX: offset[0],
    offsetY: offset[1],
    offsetZ: offset[2],
    rotX: rotation[0],
    rotY: rotation[1],
    rotZ: rotation[2],
    scale,
    autoRotate: true,
    rotationSpeed: 0.6,
    showGizmo: true,
    colorOverrides: defaultColors,
    animationOverrides: defaultAnimations,
    nameOverrides: {},
    cdprConfig: registered?.defaultCDPRConfig || builtin?.defaultCDPRConfig || DEFAULT_CDPR_CONFIG,
  };
}

export interface RegisteredModelDefaults {
  modelId: string;
  offset: [number, number, number];
  rotation: [number, number, number]; // in degrees
  scale: number;
  parts: PartColorInfo[];
  defaultColors?: Record<number, string>;
  defaultAnimations?: Record<number, PartAnimationConfig>;
  defaultCDPRConfig?: CDPRConfig;
}

interface TransformCalibrationContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  activeModelId: string;
  setActiveModelId: (id: string) => void;
  selectedPartIndex: number | null;
  setSelectedPartIndex: (index: number | null) => void;
  settings: TransformSettings;
  availableParts: PartColorInfo[];
  registerModel: (defaults: RegisteredModelDefaults) => void;
  updateSetting: <K extends keyof TransformSettings>(key: K, value: TransformSettings[K]) => void;
  updatePartColor: (partIndex: number, color: string) => void;
  updatePartAnimation: (partIndex: number, config: Partial<PartAnimationConfig>) => void;
  updatePartName: (partIndex: number, name: string) => void;
  updateCDPRConfig: (config: Partial<CDPRConfig>) => void;
  resetPartAnimation: (partIndex: number) => void;
  resetSettings: () => void;
}

const TransformCalibrationContext = createContext<TransformCalibrationContextType | undefined>(undefined);

export const TransformCalibrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string>('robot-hand');
  const [selectedPartIndex, setSelectedPartIndex] = useState<number | null>(null);
  const [modelRegistry, setModelRegistry] = useState<Record<string, RegisteredModelDefaults>>({});
  const [settings, setSettings] = useState<TransformSettings>(() => getModelSettings('robot-hand'));

  // Register a model with its specific default alignment, colors and animation kinematics
  const registerModel = useCallback((defaults: RegisteredModelDefaults) => {
    setModelRegistry((prev) => ({
      ...prev,
      [defaults.modelId]: defaults,
    }));

    setSettings((currentSettings) => {
      if (currentSettings.modelId === defaults.modelId) {
        return getModelSettings(defaults.modelId, defaults);
      }
      return currentSettings;
    });
  }, []);

  // When switching active model, populate settings from registry & builtin defaults
  useEffect(() => {
    setSettings(getModelSettings(activeModelId, modelRegistry[activeModelId]));
  }, [activeModelId, modelRegistry]);

  const updateSetting = <K extends keyof TransformSettings>(key: K, value: TransformSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updateCDPRConfig = (config: Partial<CDPRConfig>) => {
    setSettings((prev) => ({
      ...prev,
      cdprConfig: {
        ...prev.cdprConfig,
        ...config,
      },
    }));
  };

  const updatePartColor = (partIndex: number, color: string) => {
    setSettings((prev) => ({
      ...prev,
      colorOverrides: {
        ...prev.colorOverrides,
        [partIndex]: color,
      },
    }));
  };

  const updatePartName = (partIndex: number, name: string) => {
    setSettings((prev) => ({
      ...prev,
      nameOverrides: {
        ...prev.nameOverrides,
        [partIndex]: name,
      },
    }));
  };

  const updatePartAnimation = (partIndex: number, config: Partial<PartAnimationConfig>) => {
    setSettings((prev) => {
      const activeDefaults = modelRegistry[activeModelId];
      const fallback = activeDefaults?.defaultAnimations?.[partIndex] || {
        type: 'none',
        axis: 'z',
        direction: 1,
        speed: 2.0,
        amplitude: 35,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      };
      const current = prev.animationOverrides[partIndex] || fallback;
      return {
        ...prev,
        animationOverrides: {
          ...prev.animationOverrides,
          [partIndex]: { ...current, ...config },
        },
      };
    });
  };

  const resetPartAnimation = (partIndex: number) => {
    setSettings((prev) => {
      const activeDefaults = modelRegistry[activeModelId];
      const defaultAnim = activeDefaults?.defaultAnimations?.[partIndex];
      const copy = { ...prev.animationOverrides };
      if (defaultAnim) {
        copy[partIndex] = defaultAnim;
      } else {
        delete copy[partIndex];
      }
      return { ...prev, animationOverrides: copy };
    });
  };

  const resetSettings = () => {
    setSettings(getModelSettings(activeModelId, modelRegistry[activeModelId]));
    setSelectedPartIndex(null);
  };

  // Keyboard shortcut: Shift + C to toggle calibration tool
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const rawParts = modelRegistry[activeModelId]?.parts || [];
  const availableParts: PartColorInfo[] = rawParts.map((p) => ({
    ...p,
    name: settings.nameOverrides[p.index] || p.name,
  }));

  return (
    <TransformCalibrationContext.Provider
      value={{
        isOpen,
        setIsOpen,
        activeModelId,
        setActiveModelId,
        selectedPartIndex,
        setSelectedPartIndex,
        settings,
        availableParts,
        registerModel,
        updateSetting,
        updatePartColor,
        updatePartAnimation,
        updatePartName,
        updateCDPRConfig,
        resetPartAnimation,
        resetSettings,
      }}
    >
      {children}
    </TransformCalibrationContext.Provider>
  );
};

export const useTransformCalibration = () => {
  const context = useContext(TransformCalibrationContext);
  if (!context) {
    throw new Error('useTransformCalibration must be used within TransformCalibrationProvider');
  }
  return context;
};
