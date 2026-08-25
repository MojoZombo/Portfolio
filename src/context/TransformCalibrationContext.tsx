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

const initialSettings: TransformSettings = {
  modelId: '',
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  scale: 1.0,
  autoRotate: true,
  rotationSpeed: 0.6,
  showGizmo: true,
  colorOverrides: {},
  animationOverrides: {},
  nameOverrides: {},
  cdprConfig: DEFAULT_CDPR_CONFIG,
};

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
  const [settings, setSettings] = useState<TransformSettings>(initialSettings);

  // Register a model with its specific default alignment, colors and animation kinematics
  const registerModel = useCallback((defaults: RegisteredModelDefaults) => {
    setModelRegistry((prev) => ({
      ...prev,
      [defaults.modelId]: defaults,
    }));

    setSettings((currentSettings) => {
      // If no model is set yet, or if the registering model is currently active, populate its settings immediately
      if (!currentSettings.modelId || currentSettings.modelId === defaults.modelId) {
        return {
          modelId: defaults.modelId,
          offsetX: defaults.offset[0],
          offsetY: defaults.offset[1],
          offsetZ: defaults.offset[2],
          rotX: defaults.rotation[0],
          rotY: defaults.rotation[1],
          rotZ: defaults.rotation[2],
          scale: defaults.scale,
          autoRotate: true,
          rotationSpeed: 0.6,
          showGizmo: true,
          colorOverrides: defaults.defaultColors || {},
          animationOverrides: defaults.defaultAnimations || {},
          nameOverrides: {},
          cdprConfig: defaults.defaultCDPRConfig || DEFAULT_CDPR_CONFIG,
        };
      }
      return currentSettings;
    });
  }, []);

  // When switching active model, populate settings from registry
  useEffect(() => {
    const activeDefaults = modelRegistry[activeModelId];
    if (activeDefaults) {
      setSettings({
        modelId: activeModelId,
        offsetX: activeDefaults.offset[0],
        offsetY: activeDefaults.offset[1],
        offsetZ: activeDefaults.offset[2],
        rotX: activeDefaults.rotation[0],
        rotY: activeDefaults.rotation[1],
        rotZ: activeDefaults.rotation[2],
        scale: activeDefaults.scale,
        autoRotate: true,
        rotationSpeed: 0.6,
        showGizmo: true,
        colorOverrides: activeDefaults.defaultColors || {},
        animationOverrides: activeDefaults.defaultAnimations || {},
        nameOverrides: {},
        cdprConfig: activeDefaults.defaultCDPRConfig || DEFAULT_CDPR_CONFIG,
      });
    }
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
    const activeDefaults = modelRegistry[activeModelId];
    if (activeDefaults) {
      setSettings((prev) => ({
        ...prev,
        offsetX: activeDefaults.offset[0],
        offsetY: activeDefaults.offset[1],
        offsetZ: activeDefaults.offset[2],
        rotX: activeDefaults.rotation[0],
        rotY: activeDefaults.rotation[1],
        rotZ: activeDefaults.rotation[2],
        scale: activeDefaults.scale,
        colorOverrides: activeDefaults.defaultColors || {},
        animationOverrides: activeDefaults.defaultAnimations || {},
        nameOverrides: {},
        cdprConfig: activeDefaults.defaultCDPRConfig || DEFAULT_CDPR_CONFIG,
      }));
    }
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
