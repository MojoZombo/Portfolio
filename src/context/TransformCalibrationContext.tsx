import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

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
  axisAlignment?: AxisAlignment; // 'part' = Part's Transform Axis, 'global' = Global World Axis, 'model' = CAD Model Root
  axisRotX?: number; // Custom axis rotation offset around X in degrees
  axisRotY?: number; // Custom axis rotation offset around Y in degrees
  axisRotZ?: number; // Custom axis rotation offset around Z in degrees
  direction: 1 | -1; // 1 = Clockwise / Forward, -1 = Counter-Clockwise / Reverse
  speed: number;
  amplitude: number; // in degrees for rotation, or fallback centimeters for linear
  amplitudePositive?: number; // Custom translation distance in positive/forward direction (in cm)
  amplitudeNegative?: number; // Custom translation distance in negative/reverse direction (in cm)
  phase: number; // in degrees
  pivotMode: PivotMode;
  pivotX: number; // in cm
  pivotY: number; // in cm
  pivotZ: number; // in cm
  parentPartIndex?: number | null; // Attached parent link for kinematic rigid grouping
  subAnimations?: PartAnimationConfig[]; // Used when type is 'multi'
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
  rotation: [number, number, number]; // in degrees
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
  rotX: number; // in degrees
  rotY: number;
  rotZ: number;
  scale: number;
  autoRotate: boolean;
  rotationSpeed: number;
  showGizmo: boolean;
  colorOverrides: Record<number, string>; // partIndex -> hex color
  visibilityOverrides: Record<number, boolean>; // partIndex -> isVisible
  animationOverrides: Record<number, PartAnimationConfig>; // partIndex -> animation config
  nameOverrides: Record<number, string>; // partIndex -> custom user renamed string
  cdprConfig: CDPRConfig;
  partOrder?: number[]; // custom ordering of part indices in assembly tree
}

// Built-in calibrated model defaults for instantaneous, zero-latency sync in Studio
const BUILTIN_MODEL_DEFAULTS: Record<string, Partial<RegisteredModelDefaults>> = {
  catamaran: {
    modelId: 'catamaran',
    offset: [-0.15, 0.03, 0.00],
    rotation: [-90, -90, 0],
    scale: 2.30,
    defaultRotationSpeed: 0.2,
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
    defaultAnimations: {
      19: {
        type: 'oscillate-rotation',
        axis: 'y',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: -10,
        amplitude: 34,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 20,
        pivotMode: 'custom',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 22,
      },
      20: {
        type: 'none',
        axis: 'y',
        axisAlignment: 'model',
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 19,
      },
      22: {
        type: 'oscillate-rotation',
        axis: 'y',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 30,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 20,
        pivotMode: 'custom',
        pivotX: 0,
        pivotY: 55,
        pivotZ: -12,
      },
      23: {
        type: 'none',
        axis: 'y',
        axisAlignment: 'model',
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 22,
      },
      24: {
        type: 'none',
        axis: 'y',
        axisAlignment: 'model',
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 22,
      },
      26: {
        type: 'none',
        axis: 'y',
        axisAlignment: 'model',
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 22,
      },
      28: {
        type: 'none',
        axis: 'y',
        axisAlignment: 'model',
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 22,
      },
      30: {
        type: 'oscillate-rotation',
        axis: 'y',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: -5,
        amplitude: 27,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'custom',
        pivotX: 0,
        pivotY: 0,
        pivotZ: -3,
      },
      33: {
        type: 'oscillate-rotation',
        axis: 'y',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: -5,
        amplitude: 27,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'custom',
        pivotX: 0,
        pivotY: 0,
        pivotZ: -3,
      },
    },
  },
  'robot-hand': {
    modelId: 'robot-hand',
    offset: [0.42, 0.51, 0.46],
    rotation: [0, -90, 0],
    scale: 0.95,
    defaultColors: {
      0: '#008c4a', // mesh1757_mesh
      3: '#3b82f6', // mesh1757_mesh_10_(Body_B)
      4: '#FDB515', // mesh1757_mesh_10_(Body_C)
      5: '#3b82f6', // mesh1757_mesh_10_(Body_D)
      6: '#3b82f6', // mesh1757_mesh_10_(Body_E)
      7: '#3b82f6', // mesh1757_mesh_10_(Body_F)
      8: '#3b82f6', // mesh1757_mesh_10_(Body_G)
      9: '#3b82f6', // mesh1757_mesh_10_(Body_H)
      10: '#3b82f6', // mesh1757_mesh_10_(Body_I)
      11: '#3b82f6', // mesh1757_mesh_10_(Body_J)
      12: '#FDB515', // mesh1757_mesh_10_(Body_K)
      13: '#3b82f6', // mesh1757_mesh_10_(Body_L)
      14: '#3b82f6', // mesh1757_mesh_10_(Body_M)
      15: '#3b82f6', // mesh1757_mesh_10_(Body_N)
      16: '#3b82f6', // mesh1757_mesh_10_(Body_O)
      17: '#FDB515', // mesh1757_mesh_10_(Body_P)
      24: '#475569', // mesh1757_mesh_15
      25: '#475569', // mesh1757_mesh_16
      26: '#475569', // mesh1757_mesh_17
      43: '#1e293b', // mesh1757_mesh_8_(Body_A)
      44: '#1e293b', // mesh1757_mesh_8_(Body_B)
      45: '#1e293b', // mesh1757_mesh_8_(Body_C)
      46: '#1e293b', // mesh1757_mesh_8_(Body_D)
      47: '#1e293b', // mesh1757_mesh_8_(Body_E)
      48: '#1e293b', // mesh1757_mesh_8_(Body_F)
      49: '#1e293b', // mesh1757_mesh_8_(Body_G)
      50: '#1e293b', // mesh1757_mesh_8_(Body_H)
      51: '#1e293b', // mesh1757_mesh_8_(Body_I)
      52: '#1e293b', // mesh1757_mesh_8_(Body_J)
      53: '#1e293b', // mesh1757_mesh_8_(Body_K)
      54: '#1e293b', // mesh1757_mesh_8_(Body_L)
      55: '#1e293b', // mesh1757_mesh_8_(Body_M)
      56: '#1e293b', // mesh1757_mesh_8_(Body_N)
      57: '#1e293b', // mesh1757_mesh_8_(Body_O)
    },
    defaultAnimations: {
      3: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 8,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 60,
        pivotMode: "custom",
        pivotX: 0,
        pivotY: -22.5,
        pivotZ: 0
      },
      4: {
        type: "oscillate-rotation",
        axis: "x",
        axisAlignment: "model",
        axisRotX: 29,
        axisRotY: -21,
        axisRotZ: -14,
        direction: 1,
        speed: 10,
        amplitude: 8,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "custom",
        pivotX: -10,
        pivotY: -9.5,
        pivotZ: 19
      },
      5: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 8,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "custom",
        pivotX: -1.5,
        pivotY: -21.5,
        pivotZ: 0
      },
      6: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 8,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 20,
        pivotMode: "custom",
        pivotX: -2,
        pivotY: -21,
        pivotZ: 0
      },
      7: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 8,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 40,
        pivotMode: "custom",
        pivotX: 0,
        pivotY: -21,
        pivotZ: 0
      },
      8: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 5,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 20,
        pivotMode: "custom",
        pivotX: -3,
        pivotY: -12.5,
        pivotZ: 0,
        parentPartIndex: 6
      },
      9: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 5,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 40,
        pivotMode: "custom",
        pivotX: 0,
        pivotY: -14,
        pivotZ: 0,
        parentPartIndex: 7
      },
      10: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 5,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 40,
        pivotMode: "custom",
        pivotX: 0,
        pivotY: -13,
        pivotZ: 0,
        parentPartIndex: 3
      },
      11: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 5,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "custom",
        pivotX: -2.5,
        pivotY: -13,
        pivotZ: 0,
        parentPartIndex: 5
      },
      12: {
        type: "oscillate-rotation",
        axis: "x",
        axisAlignment: "model",
        axisRotX: 29,
        axisRotY: -29,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 5,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "custom",
        pivotX: -5.5,
        pivotY: -6,
        pivotZ: 10.5,
        parentPartIndex: 4
      },
      13: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 2,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 60,
        pivotMode: "custom",
        pivotX: 0,
        pivotY: -10,
        pivotZ: 0,
        parentPartIndex: 10
      },
      14: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 2,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 40,
        pivotMode: "custom",
        pivotX: 0,
        pivotY: -10.5,
        pivotZ: 0,
        parentPartIndex: 9
      },
      15: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 2,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "custom",
        pivotX: -2.5,
        pivotY: -11,
        pivotZ: 0,
        parentPartIndex: 11
      },
      16: {
        type: "oscillate-rotation",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 2,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 20,
        pivotMode: "custom",
        pivotX: -3.5,
        pivotY: -11,
        pivotZ: 0,
        parentPartIndex: 8
      },
      17: {
        type: "oscillate-rotation",
        axis: "x",
        axisAlignment: "model",
        axisRotX: 29,
        axisRotY: -29,
        axisRotZ: 0,
        direction: 1,
        speed: 10,
        amplitude: 2,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "custom",
        pivotX: -5,
        pivotY: -8,
        pivotZ: 5.5,
        parentPartIndex: 12
      },
      43: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 4
      },
      44: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 12
      },
      48: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 10
      },
      49: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 5
      },
      50: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 6
      },
      52: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 3
      },
      53: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 7
      },
      54: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 9
      },
      56: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 11
      },
      57: {
        type: "none",
        axis: "z",
        axisAlignment: "model",
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: "center-of-mass",
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 8
      }
    },
    defaultPartOrder: [0,1,2,5,49,11,56,15,6,50,8,57,16,7,53,9,54,14,3,52,10,48,13,4,43,12,44,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,45,46,47,51,55,58],
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
      10: '#475569', // Mesh_108_3
      14: '#1e293b', // Rubber_Pad-1006
      16: '#475569', // Gripper_Attachment_Base-1007
      17: '#1e293b', // Rubber_Pad-1007
      18: '#cbd5e1', // XEG-64_滑塊stp-1011
      21: '#0284c7', // Part #21
      24: '#475569', // Part #24
      26: '#0284c7', // Part #26
      27: '#3b82f6', // Part #27
      28: '#0284c7', // Part #28
      32: '#3b82f6', // Part #32
      36: '#0284c7', // Part #36
      39: '#0284c7', // Part #39
      40: '#3b82f6', // Part #40
      41: '#0f172a', // Part #41
      44: '#3b82f6', // Part #44
      47: '#3b82f6', // Part #47
      48: '#475569', // Part #48
    },
    defaultAnimations: {
      0: {
        type: 'linear-reciprocate',
        axis: 'x',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 8,
        amplitude: 10,
        amplitudePositive: 0,
        amplitudeNegative: 3.5,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      14: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 0,
      },
      16: {
        type: 'linear-reciprocate',
        axis: 'x',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 8,
        amplitude: 10,
        amplitudePositive: 3.5,
        amplitudeNegative: 0,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      17: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 16,
      },
    },
  },
  'underwater-robot': {
    modelId: 'underwater-robot',
    offset: [0.00, 0.00, 0.00],
    rotation: [0.0, -59.5, 0.0],
    scale: 1.00,
    defaultColors: {
      0: '#003262', // dropperBottom-1
      1: '#FDB515', // dropperPlatform-2
      2: '#64748b', // Mesh_8
      3: '#64748b', // Mesh_8_1
      4: '#64748b', // Mesh_8_2
      11: '#003262', // Mesh_46
      12: '#003262', // Mesh_46_1
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
      28: '#003262', // Dynamic_Gripper-1 (Body A)
      29: '#64748b', // M200_Motor-1
      30: '#64748b', // Mesh_15
      31: '#64748b', // Mesh_15_1
      32: '#003262', // CameraMountBack_-_Radial-2
      33: '#475569', // CameraMountFront_-_Radial-1
      35: '#3f5b88', // Mesh_4
      37: '#FDB515', // VerticalDoubleThruster-2
      38: '#003262', // Dynamic_Gripper-1 (Body B)
      39: '#f8fafc', // Dynamic_Gripper-1 (Body C)
      40: '#475569', // Dynamic_Gripper-1 (Body D)
      41: '#059669', // Dynamic_Gripper-1 (Body E)
      42: '#dc2626', // Dynamic_Gripper-1 (Body F)
      43: '#f8fafc', // Dynamic_Gripper-1 (Body G)
      44: '#475569', // Dynamic_Gripper-1 (Body H)
      45: '#059669', // Dynamic_Gripper-1 (Body I)
      46: '#dc2626', // Dynamic_Gripper-1 (Body J)
    },
    defaultVisibility: {
      39: false, // Dynamic_Gripper-1_(Body_C)
      40: false, // Dynamic_Gripper-1_(Body_D)
      41: false, // Dynamic_Gripper-1_(Body_E)
      42: false, // Dynamic_Gripper-1_(Body_F)
      43: false, // Dynamic_Gripper-1_(Body_G)
      44: false, // Dynamic_Gripper-1_(Body_H)
      45: false, // Dynamic_Gripper-1_(Body_I)
      46: false, // Dynamic_Gripper-1_(Body_J)
    },
    defaultAnimations: {
      1: {
        type: 'oscillate-rotation',
        axis: 'y',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 5,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'custom',
        pivotX: 18,
        pivotY: 0,
        pivotZ: -7,
      },
      29: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 38,
      },
      30: {
        type: 'oscillate-rotation',
        axis: 'x',
        axisAlignment: 'part',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: -1,
        speed: 5,
        amplitude: 180,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 90,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 38,
      },
      38: {
        type: 'linear-reciprocate',
        axis: 'z',
        axisAlignment: 'part',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 5,
        amplitude: 7,
        amplitudePositive: 100,
        amplitudeNegative: 0,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
    },
  },
  'cable-robot-1': {
    modelId: 'cable-robot-1',
    offset: [0.00, 0.23, 0.00],
    rotation: [-90, 0, 0],
    scale: 1.5,
    defaultColors: {
      0: '#475569', // Mesh_0
      1: '#475569', // Mesh_0_1
      2: '#475569', // Mesh_0_2
      3: '#475569', // CONV-HDW00-065-01-1
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
    defaultColors: {
      2: '#64748b',
      5: '#64748b',
      6: '#64748b',
      7: '#475569',
      8: '#1e293b',
      34: '#475569',
      35: '#475569',
      36: '#919191',
      38: '#f8fafc',
      55: '#ff7300',
      56: '#475569',
      57: '#059669',
      58: '#dc2626',
      59: '#f8fafc',
      60: '#475569',
      61: '#059669',
      62: '#dc2626',
      63: '#f8fafc',
      64: '#475569',
      65: '#059669',
      66: '#dc2626',
      67: '#f8fafc',
      68: '#475569',
      69: '#059669',
      70: '#dc2626',
      71: '#f8fafc',
      72: '#475569',
      73: '#059669',
      74: '#dc2626',
      75: '#f8fafc',
      76: '#475569',
      77: '#059669',
      78: '#dc2626',
      79: '#f8fafc',
      80: '#475569',
      81: '#059669',
      82: '#dc2626',
      83: '#f8fafc',
      84: '#475569',
      85: '#059669',
      86: '#dc2626',
      87: '#f8fafc',
      88: '#475569',
      89: '#059669',
      90: '#dc2626',
    },
    defaultVisibility: {
      23: false,
      26: false,
      29: false,
      37: false,
      65: false,
      69: false,
    },
    defaultAnimations: {
      27: { type: 'linear-reciprocate', axis: 'y', direction: 1, speed: 100, amplitude: 10, amplitudePositive: 1, amplitudeNegative: 0, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
      31: { type: 'linear-reciprocate', axis: 'y', direction: 1, speed: 100, amplitude: 10, amplitudePositive: 1, amplitudeNegative: 0, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
      34: { type: 'linear-reciprocate', axis: 'y', direction: 1, speed: 100, amplitude: 10, amplitudePositive: 1, amplitudeNegative: 0, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
      35: { type: 'linear-reciprocate', axis: 'y', direction: 1, speed: 100, amplitude: 10, amplitudePositive: 1, amplitudeNegative: 0, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
      36: {
        type: 'multi',
        axis: 'x',
        direction: 1,
        speed: 100,
        amplitude: 10,
        amplitudePositive: 1,
        amplitudeNegative: 0,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        subAnimations: [
          { type: 'linear-reciprocate', axis: 'y', direction: 1, speed: 100, amplitude: 10, amplitudePositive: 1, amplitudeNegative: 0, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
          { type: 'oscillate-rotation', axis: 'x', direction: 1, speed: 60, amplitude: 2, amplitudePositive: 10, amplitudeNegative: 10, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
        ],
      },
      38: {
        type: 'multi',
        axis: 'z',
        direction: 1,
        speed: 60,
        amplitude: 11,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        subAnimations: [
          { type: 'oscillate-rotation', axis: 'x', direction: 1, speed: 60, amplitude: 6, amplitudePositive: 10, amplitudeNegative: 10, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
          { type: 'linear-reciprocate', axis: 'y', direction: 1, speed: 100, amplitude: 35, amplitudePositive: 1, amplitudeNegative: 0, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
          { type: 'oscillate-rotation', axis: 'z', direction: 1, speed: 60, amplitude: 2, amplitudePositive: 10, amplitudeNegative: 10, phase: 0, pivotMode: 'center-of-mass', pivotX: 0, pivotY: 0, pivotZ: 0 },
        ],
      },
    },
  },
  'drone-catch': {
    modelId: 'drone-catch',
    offset: [0.00, 0.32, 0.00],
    rotation: [0, 38, 0],
    scale: 1.00,
    defaultColors: (() => {
      const colors: Record<number, string> = {
        0: '#64748b',
        1: '#d97706',
        2: '#ea580c',
        3: '#059669',
        4: '#059669',
        5: '#1e293b',
        6: '#64748b',
        7: '#707070',
        8: '#cbd5e1',
        9: '#475569',
        10: '#475569',
        11: '#475569',
        12: '#ea580c',
        13: '#059669',
        14: '#059669',
        16: '#cbd5e1',
        17: '#c19a6b',
        18: '#64748b',
        19: '#1e293b',
        113: '#f2f5f7',
        114: '#adadad',
        115: '#d5d9e3',
        116: '#1e293b',
        117: '#475569',
        118: '#bbbbbb',
        120: '#1e293b',
        121: '#00c4f5',
        123: '#ea580c',
        124: '#38bdf8',
        126: '#3b82f6',
        127: '#475569',
        128: '#c19a6b',
        130: '#98befb',
      };
      for (let i = 133; i <= 374; i++) {
        colors[i] = '#475569';
      }
      return colors;
    })(),
    defaultVisibility: (() => {
      const vis: Record<number, boolean> = { 31: false };
      for (let i = 8; i <= 112; i++) {
        // 71, 72, 77, 78 have parentPartIndex: 121 (not rigid to root) -> kept visible
        if (i !== 71 && i !== 72 && i !== 77 && i !== 78) {
          vis[i] = false;
        }
      }
      return vis;
    })(),
    defaultAnimations: {
      1: {
        type: 'oscillate-rotation',
        axis: 'z',
        axisAlignment: 'part',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 4,
        amplitude: 3600,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      2: {
        type: 'oscillate-rotation',
        axis: 'z',
        axisAlignment: 'part',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: -1,
        speed: 4,
        amplitude: 5400,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      3: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 1,
      },
      4: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 1,
      },
      71: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      72: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      77: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      78: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      116: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 2,
      },
      119: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 2,
      },
      121: {
        type: 'linear-reciprocate',
        axis: 'z',
        axisAlignment: 'part',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 4,
        amplitude: 35,
        amplitudePositive: 60,
        amplitudeNegative: 0,
        phase: 95,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      122: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      219: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      220: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      221: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      222: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      223: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      224: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      225: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      226: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 121,
      },
      345: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 2,
      },
      346: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 2,
      },
      347: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 2,
      },
    },
    defaultPartOrder: [0,1,2,3,4,5,121,348,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,341,342,343,344,345,346,347,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400],
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
    offset: [0.00, 0.00, 0.00],
    rotation: [0, 0, 0],
    scale: 7.50,
    defaultColors: {
      0: '#cbd5e1', // newspring-1
      1: '#0d9488', // Scrub attachment jadenedit-1
      2: '#f59e0b', // Scrub+Daddy-1
      3: '#1e293b', // scrubtious (female part)Jadenedit-1
    },
    defaultAnimations: {
      0: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 1,
      },
      1: {
        type: 'multi',
        axis: 'x',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        subAnimations: [
          {
            type: 'oscillate-rotation',
            axis: 'y',
            axisAlignment: 'model',
            axisRotX: 0,
            axisRotY: 0,
            axisRotZ: 0,
            direction: 1,
            speed: 10,
            amplitude: 360,
            amplitudePositive: 0,
            amplitudeNegative: 13,
            phase: 90,
            pivotMode: 'custom',
            pivotX: 0,
            pivotY: 0,
            pivotZ: -0.4,
          },
          {
            type: 'linear-reciprocate',
            axis: 'y',
            axisAlignment: 'model',
            axisRotX: 0,
            axisRotY: 0,
            axisRotZ: 0,
            direction: 1,
            speed: 10,
            amplitude: 35,
            amplitudePositive: 0,
            amplitudeNegative: 10,
            phase: 0,
            pivotMode: 'center-of-mass',
            pivotX: 0,
            pivotY: 0,
            pivotZ: 0,
          },
        ],
      },
      2: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 1,
      },
    },
  },
  'anti-tangle-winch': {
    modelId: 'anti-tangle-winch',
    offset: [0.00, 0.00, 0.01],
    rotation: [-180, 0, 0],
    scale: 20.00,
    defaultColors: {
      0: '#475569',
      1: '#475569',
      2: '#475569',
      3: '#475569',
      4: '#475569',
      5: '#3b82f6',
      6: '#475569',
      7: '#475569',
      8: '#475569',
      9: '#475569',
      10: '#475569',
      11: '#64748b',
      12: '#475569',
      13: '#c19a6b',
      14: '#dabd9a',
      15: '#c19a6b',
      16: '#d97706',
      17: '#d97706',
      18: '#64748b',
      19: '#64748b',
      21: '#cbd5e1',
      22: '#cbd5e1',
    },
    defaultVisibility: {
      1: false,
      2: false,
      4: false,
    },
    defaultAnimations: {
      5: {
        type: 'continuous-spin',
        axis: 'x',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 8,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      13: {
        type: 'continuous-spin',
        axis: 'x',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      14: {
        type: 'continuous-spin',
        axis: 'x',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: -1,
        speed: 30,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      15: {
        type: 'continuous-spin',
        axis: 'x',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 8,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      16: {
        type: 'linear-reciprocate',
        axis: 'x',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 4,
        amplitude: 10,
        amplitudePositive: 3,
        amplitudeNegative: 0,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      },
      17: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 16,
      },
      21: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 16,
      },
      22: {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
        parentPartIndex: 16,
      },
    },
  },
  'inductive-robot': {
    modelId: 'inductive-robot',
    offset: [0.00, -0.25, 0.00],
    rotation: [0, 45, 0],
    scale: 3.5,
    defaultColors: {},
    defaultAnimations: {},
  },
  'tesla-actuator': {
    modelId: 'tesla-actuator',
    offset: [0.00, 0.00, 0.00],
    rotation: [0, -90, 0],
    scale: 8.50,
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
  const defaultVisibility = { ...(builtin?.defaultVisibility || {}), ...(registered?.defaultVisibility || {}) };
  const defaultAnimations = { ...(builtin?.defaultAnimations || {}), ...(registered?.defaultAnimations || {}) };
  const partOrder = registered?.defaultPartOrder || builtin?.defaultPartOrder || undefined;

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
    rotationSpeed: registered?.defaultRotationSpeed ?? builtin?.defaultRotationSpeed ?? 0.2,
    showGizmo: true,
    colorOverrides: defaultColors,
    visibilityOverrides: defaultVisibility,
    animationOverrides: defaultAnimations,
    nameOverrides: {},
    cdprConfig: registered?.defaultCDPRConfig || builtin?.defaultCDPRConfig || DEFAULT_CDPR_CONFIG,
    partOrder: partOrder ? [...partOrder] : undefined,
  };
}

export interface CuttingPlaneConfig {
  active: boolean;
  targetPartIndex: number | null;
  axis: 'x' | 'y' | 'z';
  offset: number; // in meters
}

export interface SplitPartRecord {
  id: string;
  modelId: string;
  originalPartIndex: number;
  newPartIndices: number[];
  type: 'islands' | 'plane';
  timestamp: number;
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

const TransformCalibrationContext = createContext<TransformCalibrationContextType | undefined>(undefined);

export const TransformCalibrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string>('robot-hand');
  const [selectedPartIndex, setSelectedPartIndex] = useState<number | null>(null);
  const [modelRegistry, setModelRegistry] = useState<Record<string, RegisteredModelDefaults>>({});
  const [settings, setSettings] = useState<TransformSettings>(() => getModelSettings('robot-hand'));
  const [dynamicExtraParts, setDynamicExtraParts] = useState<Record<string, PartColorInfo[]>>({});
  const [splitHistory, setSplitHistory] = useState<SplitPartRecord[]>([]);
  const [cuttingPlaneConfig, setCuttingPlaneConfigState] = useState<CuttingPlaneConfig>({
    active: false,
    targetPartIndex: null,
    axis: 'y',
    offset: 0,
  });

  const setCuttingPlaneConfig = (config: Partial<CuttingPlaneConfig>) => {
    setCuttingPlaneConfigState((prev) => ({ ...prev, ...config }));
  };

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

  const updatePartVisibility = (partIndex: number, isVisible: boolean) => {
    setSettings((prev) => {
      const newVisibility = { ...prev.visibilityOverrides };
      if (isVisible) {
        delete newVisibility[partIndex]; // Default is visible
      } else {
        newVisibility[partIndex] = false;
      }
      return { ...prev, visibilityOverrides: newVisibility };
    });
  };

  const updatePartAnimation = (partIndex: number, config: Partial<PartAnimationConfig>) => {
    setSettings((prev) => {
      const activeDefaults = modelRegistry[activeModelId];
      const fallback: PartAnimationConfig = activeDefaults?.defaultAnimations?.[partIndex] || {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 60,
        amplitude: 35,
        amplitudePositive: 10,
        amplitudeNegative: 10,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      };
      const current = prev.animationOverrides[partIndex] || fallback;
      const updated = { ...current, ...config };
      if (config.type && config.type !== 'multi' && !('subAnimations' in config)) {
        delete updated.subAnimations;
      }
      return {
        ...prev,
        animationOverrides: {
          ...prev.animationOverrides,
          [partIndex]: updated,
        },
      };
    });
  };

  const setPartParent = (partIndex: number, parentIndex: number | null) => {
    updatePartAnimation(partIndex, { parentPartIndex: parentIndex });
  };

  const resetPartAnimation = (partIndex: number) => {
    setSettings((prev) => {
      const copy = { ...prev.animationOverrides };
      copy[partIndex] = {
        type: 'none',
        axis: 'z',
        axisAlignment: 'model',
        axisRotX: 0,
        axisRotY: 0,
        axisRotZ: 0,
        direction: 1,
        speed: 0,
        amplitude: 0,
        amplitudePositive: 0,
        amplitudeNegative: 0,
        phase: 0,
        pivotMode: 'center-of-mass',
        pivotX: 0,
        pivotY: 0,
        pivotZ: 0,
      };
      return { ...prev, animationOverrides: copy };
    });
  };

  const registerSplitParts = (
    originalIndex: number,
    newParts: { name: string; color?: string }[],
    type: 'islands' | 'plane'
  ): number[] => {
    const activeDefaults = modelRegistry[activeModelId];
    const baseParts = activeDefaults?.parts || [];
    const extra = dynamicExtraParts[activeModelId] || [];
    const currentMaxIndex = Math.max(
      ...baseParts.map((p) => p.index),
      ...extra.map((p) => p.index),
      0
    );

    const generatedParts: PartColorInfo[] = newParts.map((np, idx) => ({
      index: currentMaxIndex + 1 + idx,
      name: np.name,
      color: np.color || '#cbd5e1',
    }));

    const newIndices = generatedParts.map((p) => p.index);

    setDynamicExtraParts((prev) => ({
      ...prev,
      [activeModelId]: [...(prev[activeModelId] || []), ...generatedParts],
    }));

    setSplitHistory((prev) => [
      ...prev,
      {
        id: `${activeModelId}-${originalIndex}-${Date.now()}`,
        modelId: activeModelId,
        originalPartIndex: originalIndex,
        newPartIndices: newIndices,
        type,
        timestamp: Date.now(),
      },
    ]);

    // Pre-populate color overrides for newly generated parts
    setSettings((prev) => {
      const newColors = { ...prev.colorOverrides };
      generatedParts.forEach((gp) => {
        if (gp.color) {
          newColors[gp.index] = gp.color;
        }
      });
      return { ...prev, colorOverrides: newColors };
    });

    return newIndices;
  };

  const resetSettings = () => {
    setSettings(getModelSettings(activeModelId, modelRegistry[activeModelId]));
    setSelectedPartIndex(null);
    setDynamicExtraParts((prev) => ({ ...prev, [activeModelId]: [] }));
    setCuttingPlaneConfigState({
      active: false,
      targetPartIndex: null,
      axis: 'y',
      offset: 0,
    });
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
  const extraParts = dynamicExtraParts[activeModelId] || [];
  const allParts = useMemo<PartColorInfo[]>(() => [...rawParts, ...extraParts], [rawParts, extraParts]);

  const movePart = useCallback((partIndex: number, direction: 'up' | 'down') => {
    setSettings((prev) => {
      const baseOrder = allParts.map((p: PartColorInfo) => p.index);
      const currentOrder = prev.partOrder && prev.partOrder.length === allParts.length
        ? [...prev.partOrder]
        : [...baseOrder];

      allParts.forEach((p: PartColorInfo) => {
        if (!currentOrder.includes(p.index)) {
          currentOrder.push(p.index);
        }
      });

      const currentIndex = currentOrder.indexOf(partIndex);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentOrder.length) return prev;

      const newOrder = [...currentOrder];
      newOrder[currentIndex] = newOrder[targetIndex];
      newOrder[targetIndex] = partIndex;

      return {
        ...prev,
        partOrder: newOrder,
      };
    });
  }, [allParts]);

  const reorderParts = useCallback((newOrder: number[]) => {
    setSettings((prev) => ({
      ...prev,
      partOrder: newOrder,
    }));
  }, []);

  const resetPartOrder = useCallback(() => {
    setSettings((prev) => {
      const next = { ...prev };
      delete next.partOrder;
      return next;
    });
  }, []);

  const availableParts: PartColorInfo[] = useMemo(() => {
    let parts: PartColorInfo[] = allParts.map((p: PartColorInfo) => ({
      ...p,
      name: settings.nameOverrides[p.index] || p.name,
    }));

    if (settings.partOrder && settings.partOrder.length > 0) {
      const orderMap = new Map<number, number>();
      settings.partOrder.forEach((idx, order) => {
        orderMap.set(idx, order);
      });
      parts = [...parts].sort((a, b) => {
        const orderA = orderMap.has(a.index) ? orderMap.get(a.index)! : 99999 + a.index;
        const orderB = orderMap.has(b.index) ? orderMap.get(b.index)! : 99999 + b.index;
        return orderA - orderB;
      });
    }

    return parts;
  }, [allParts, settings.nameOverrides, settings.partOrder]);

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
        updatePartVisibility,
        updatePartAnimation,
        setPartParent,
        updatePartName,
        updateCDPRConfig,
        resetPartAnimation,
        resetSettings,
        cuttingPlaneConfig,
        setCuttingPlaneConfig,
        registerSplitParts,
        splitHistory,
        movePart,
        reorderParts,
        resetPartOrder,
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
