import { createContext, useContext } from 'react';

export interface PartColorInfo {
  index: number;
  name: string;
  color: string;
}

export type AnimationType = 'none' | 'continuous-spin' | 'oscillate-rotation' | 'linear-reciprocate' | 'multi';
export type PivotMode = 'center-of-mass' | 'custom' | 'origin';
export type AxisAlignment = 'part' | 'global' | 'model';

export interface PartAnimationConfig {
  type: AnimationType;
  axis: 'x' | 'y' | 'z';
  axisAlignment?: AxisAlignment;
  axisRotX?: number;
  axisRotY?: number;
  axisRotZ?: number;
  direction: 1 | -1;
  speed: number;
  amplitude: number;
  amplitudePositive?: number;
  amplitudeNegative?: number;
  phase: number;
  pivotMode: PivotMode;
  pivotX: number;
  pivotY: number;
  pivotZ: number;
  parentPartIndex?: number | null;
  subAnimations?: PartAnimationConfig[];
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

export interface RegisteredModelDefaults {
  modelId: string;
  offset: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  parts: PartColorInfo[];
  defaultColors?: Record<number, string>;
  defaultVisibility?: Record<number, boolean>;
  defaultAnimations?: Record<number, PartAnimationConfig>;
  defaultCDPRConfig?: CDPRConfig;
  defaultPartOrder?: number[];
  defaultRotationSpeed?: number;
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
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  autoRotate: boolean;
  rotationSpeed: number;
  showGizmo: boolean;
  colorOverrides: Record<number, string>;
  visibilityOverrides: Record<number, boolean>;
  animationOverrides: Record<number, PartAnimationConfig>;
  nameOverrides: Record<number, string>;
  cdprConfig: CDPRConfig;
  partOrder?: number[];
}

export interface CuttingPlaneConfig {
  active: boolean;
  targetPartIndex: number | null;
  axis: 'x' | 'y' | 'z';
  offset: number;
}

export interface SplitPartRecord {
  id: string;
  modelId: string;
  originalPartIndex: number;
  newPartIndices: number[];
  type: 'islands' | 'plane';
  timestamp: number;
}

export interface TransformCalibrationContextType {
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
  updatePartVisibility: (partIndex: number, isVisible: boolean) => void;
  updatePartAnimation: (partIndex: number, config: Partial<PartAnimationConfig>) => void;
  setPartParent: (partIndex: number, parentIndex: number | null) => void;
  updatePartName: (partIndex: number, name: string) => void;
  updateCDPRConfig: (config: Partial<CDPRConfig>) => void;
  resetPartAnimation: (partIndex: number) => void;
  resetSettings: () => void;
  cuttingPlaneConfig: CuttingPlaneConfig;
  setCuttingPlaneConfig: (config: Partial<CuttingPlaneConfig>) => void;
  registerSplitParts: (originalIndex: number, newParts: { name: string; color?: string }[], type: 'islands' | 'plane') => number[];
  splitHistory: SplitPartRecord[];
  movePart: (partIndex: number, direction: 'up' | 'down') => void;
  reorderParts: (newOrder: number[]) => void;
  resetPartOrder: () => void;
}

const noop = () => {};

const NOOP_CALIBRATION_CONTEXT: TransformCalibrationContextType = {
  isOpen: false,
  setIsOpen: noop,
  activeModelId: '',
  setActiveModelId: noop,
  selectedPartIndex: null,
  setSelectedPartIndex: noop,
  settings: {
    modelId: '',
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotX: 0,
    rotY: 0,
    rotZ: 0,
    scale: 1,
    autoRotate: true,
    rotationSpeed: 0.2,
    showGizmo: false,
    colorOverrides: {},
    visibilityOverrides: {},
    animationOverrides: {},
    nameOverrides: {},
    cdprConfig: DEFAULT_CDPR_CONFIG,
  },
  availableParts: [],
  registerModel: noop,
  updateSetting: noop,
  updatePartColor: noop,
  updatePartVisibility: noop,
  updatePartAnimation: noop,
  setPartParent: noop,
  updatePartName: noop,
  updateCDPRConfig: noop,
  resetPartAnimation: noop,
  resetSettings: noop,
  cuttingPlaneConfig: { active: false, targetPartIndex: null, axis: 'x', offset: 0 },
  setCuttingPlaneConfig: noop,
  registerSplitParts: () => [],
  splitHistory: [],
  movePart: noop,
  reorderParts: noop,
  resetPartOrder: noop,
};

export const TransformCalibrationContext = createContext<TransformCalibrationContextType>(NOOP_CALIBRATION_CONTEXT);

export const useTransformCalibration = () => useContext(TransformCalibrationContext);
