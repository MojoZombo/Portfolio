import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createToonGradientMap } from '../materials';
import { useTheme } from '../../context/ThemeContext';
import { useTransformCalibration, PartColorInfo, PartAnimationConfig } from '../../context/TransformCalibrationContext';
import { CADPivotGizmo } from '../CADPivotGizmo';
import { computeGeometryCenterOfMass, splitAllMultiMaterialMeshes, getAssemblyRoot } from '../../utils/meshSplitter';

interface ModelProps {
  isActive?: boolean;
  isAnimating?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
}

interface MeshNodeInfo {
  mesh: THREE.Mesh;
  initialPos: THREE.Vector3;
  initialRot: THREE.Euler;
  initialQuat: THREE.Quaternion;
  centerOfMass: THREE.Vector3;
  index: number;
}

const toonGradient = createToonGradientMap();

// Optimal Calibrated Defaults for Winch Catch
const DEFAULT_OFFSET: [number, number, number] = [0.00, 0.32, 0.00];
const DEFAULT_ROTATION_DEG: [number, number, number] = [0.00, 38.00, 0.00];
const DEFAULT_SCALE = 1.00;

// Baked Custom Part Color Overrides for Winch
const DEFAULT_PART_COLORS: Record<number, string> = (() => {
  const colors: Record<number, string> = {
    0: '#64748b', // mesh_0
    1: '#d97706', // mesh_0_1
    2: '#ea580c', // mesh_0_12 (lead screw / gear)
    3: '#059669', // Mesh_13 (guide bracket)
    4: '#059669', // Mesh_13_1 (guide bracket)
    5: '#1e293b', // mesh_0_13_(Body_B)
    6: '#64748b', // mesh_0_13_(Body_C)
    7: '#707070', // mesh_0_15 (winch frame)
    8: '#cbd5e1', // mesh_0_16
    9: '#475569', // mesh_0_16001
    10: '#475569', // mesh_0_16002
    11: '#475569', // mesh_0_16003
    12: '#ea580c', // mesh_0_16004
    13: '#059669', // mesh_0_16005
    14: '#059669', // mesh_0_16006
    16: '#cbd5e1', // mesh_0_16008
    17: '#c19a6b', // mesh_0_16009
    18: '#64748b', // mesh_0_16010
    19: '#1e293b', // mesh_0_16011
    113: '#f2f5f7', // mesh_0_2 (motor front / body silver)
    114: '#adadad', // mesh_0_3 (motor junction box)
    115: '#d5d9e3', // mesh_0_4 (motor stator housing)
    116: '#1e293b', // mesh_0_5
    117: '#475569', // mesh_0_6
    118: '#bbbbbb', // mesh_0_7
    120: '#1e293b', // mesh_0_8_(Body_B)
    121: '#00c4f5', // Mesh_20 (linear carriage block)
    123: '#ea580c', // mesh_0_8_(Body_D)
    124: '#38bdf8', // mesh_0_8_(Body_E)
    126: '#3b82f6', // mesh_0_8_(Body_G)
    127: '#475569', // mesh_0_8_(Body_H)
    128: '#c19a6b', // mesh_0_8_(Body_I)
    130: '#98befb', // mesh_0_8_(Body_K)
  };
  for (let i = 133; i <= 374; i++) {
    colors[i] = '#475569';
  }
  return colors;
})();

// Fallback color mapping by mesh name for robustness across mesh indexing
const DEFAULT_PART_NAME_COLORS: Record<string, string> = {
  'mesh_0': '#64748b',
  'mesh_0_1': '#d97706',
  'mesh_0_12': '#ea580c',
  'Mesh_13': '#059669',
  'Mesh_13_1': '#059669',
  'mesh_0_13_(Body_B)': '#1e293b',
  'mesh_0_13_(Body_C)': '#64748b',
  'mesh_0_15': '#707070',
  'mesh_0_2': '#f2f5f7',
  'mesh_0_3': '#adadad',
  'mesh_0_4': '#d5d9e3',
  'mesh_0_5': '#1e293b',
  'mesh_0_6': '#475569',
  'mesh_0_7': '#bbbbbb',
  'mesh_0_8_(Body_B)': '#1e293b',
  'Mesh_20': '#00c4f5',
  'mesh_0_8_(Body_D)': '#ea580c',
  'mesh_0_8_(Body_E)': '#38bdf8',
  'mesh_0_8_(Body_G)': '#3b82f6',
  'mesh_0_8_(Body_H)': '#475569',
  'mesh_0_8_(Body_I)': '#c19a6b',
  'mesh_0_8_(Body_K)': '#98befb',
};

// Hidden Parts: Hide meshes #8-#112 that are rigid to root; display meshes in that range with a rigid parent (71, 72, 77, 78)
const DEFAULT_PART_VISIBILITY: Record<number, boolean> = (() => {
  const vis: Record<number, boolean> = { 31: false };
  for (let i = 8; i <= 112; i++) {
    // 71, 72, 77, 78 have parentPartIndex: 121 -> kept visible
    if (i !== 71 && i !== 72 && i !== 77 && i !== 78) {
      vis[i] = false;
    }
  }
  return vis;
})();

// Baked Custom Part Kinematics Animations
const DEFAULT_PART_ANIMATIONS: Record<number, PartAnimationConfig> = {
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
    phase: 0,
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
};

// Custom Assembly Tree Part Order:
const DEFAULT_PART_ORDER = [0,1,2,3,4,5,121,348,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,276,277,278,279,280,281,282,283,284,285,286,287,288,289,290,291,292,293,294,295,296,297,298,299,300,301,302,303,304,305,306,307,308,309,310,311,312,313,314,315,316,317,318,319,320,321,322,323,324,325,326,327,328,329,330,331,332,333,334,335,336,337,338,339,340,341,342,343,344,345,346,347,349,350,351,352,353,354,355,356,357,358,359,360,361,362,363,364,365,366,367,368,369,370,371,372,373,374,375,376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400];

// Shared global blueprint materials
const darkBlueprintMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#233247'),
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

const lightBlueprintMat = new THREE.MeshBasicMaterial({
  color: new THREE.Color('#FFFFFF'),
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

// Master prototype cache for Winch
let masterWinchCatchPrototype: {
  template: THREE.Group;
  originalMaterials: (THREE.Material | THREE.Material[])[];
  staticEdgesList: THREE.EdgesGeometry[];
  activeEdgesList: THREE.EdgesGeometry[];
  partsInfo: PartColorInfo[];
} | null = null;

function buildMasterWinchCatchPrototype(sourceScene: THREE.Group) {
  const template = sourceScene.clone(true);
  const originalMaterials: (THREE.Material | THREE.Material[])[] = [];
  const staticEdgesList: THREE.EdgesGeometry[] = [];
  const activeEdgesList: THREE.EdgesGeometry[] = [];
  const partsInfo: PartColorInfo[] = [];

  // Flatten hierarchy to root template to avoid local-coordinate nesting issues
  const meshesToFlatten: THREE.Mesh[] = [];
  template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && child.parent !== template) {
      meshesToFlatten.push(child as THREE.Mesh);
    }
  });
  meshesToFlatten.forEach((mesh) => {
    mesh.updateWorldMatrix(true, false);
    template.updateWorldMatrix(true, false);
    template.attach(mesh);
  });

  splitAllMultiMaterialMeshes(template);

  template.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      originalMaterials.push(mesh.material);

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          const stdMat = m as THREE.MeshStandardMaterial;
          const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length]
            || (m.name && DEFAULT_PART_NAME_COLORS[m.name])
            || (mesh.name && DEFAULT_PART_NAME_COLORS[mesh.name])
            || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
          partsInfo.push({
            index: partsInfo.length,
            name: m.name ? m.name.replace(/_\d+$/, '') : `Winch Component ${partsInfo.length + 1}`,
            color: defaultBakedColor,
          });
        });
      } else {
        const stdMat = mesh.material as THREE.MeshStandardMaterial;
        const defaultBakedColor = DEFAULT_PART_COLORS[partsInfo.length]
          || (mesh.name && DEFAULT_PART_NAME_COLORS[mesh.name])
          || (stdMat?.color ? `#${stdMat.color.getHexString()}` : '#cbd5e1');
        partsInfo.push({
          index: partsInfo.length,
          name: mesh.name || `Component ${partsInfo.length + 1}`,
          color: defaultBakedColor,
        });
      }

      try {
        const bpEdges = new THREE.EdgesGeometry(mesh.geometry, 8);
        staticEdgesList.push(bpEdges);

        const celEdges = new THREE.EdgesGeometry(mesh.geometry, 28);
        activeEdgesList.push(celEdges);
      } catch {
        // Ignore non-standard geometries
      }
    }
  });

  return {
    template,
    originalMaterials,
    staticEdgesList,
    activeEdgesList,
    partsInfo,
  };
}

export const WinchCatchModel: React.FC<ModelProps> = ({
  isActive = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const cloneRef = useRef<THREE.Group | null>(null);
  const meshNodesRef = useRef<MeshNodeInfo[]>([]);
  const currentSpeedRef = useRef(0);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const {
    isOpen: isCalibrating,
    activeModelId,
    setActiveModelId,
    selectedPartIndex,
    registerModel,
    settings,
  } = useTransformCalibration();

  // Load the CAD assembly from public/models/Winch.glb
  const { scene } = useGLTF('./models/CableRobotWinchV2.glb');

  // Exact matching blueprint colors
  const blueprintLineColor = isDark ? '#94A8C4' : '#1E293B';
  const celOutlineColor = isDark ? '#0A0E14' : '#0F172A';

  // Build master prototype on first load
  if (!masterWinchCatchPrototype) {
    masterWinchCatchPrototype = buildMasterWinchCatchPrototype(scene);
  }

  // Register model defaults, colors and animations with calibration context
  useEffect(() => {
    if (masterWinchCatchPrototype) {
      registerModel({
        modelId: 'drone-catch',
        offset: DEFAULT_OFFSET,
        rotation: DEFAULT_ROTATION_DEG,
        scale: DEFAULT_SCALE,
        parts: masterWinchCatchPrototype.partsInfo,
        defaultColors: DEFAULT_PART_COLORS,
        defaultVisibility: DEFAULT_PART_VISIBILITY,
        defaultAnimations: DEFAULT_PART_ANIMATIONS,
        defaultPartOrder: DEFAULT_PART_ORDER,
      });
    }
  }, [registerModel]);

  // Set active model id ONLY when calibration drawer is open
  useEffect(() => {
    if (isActive && isCalibrating) {
      setActiveModelId('drone-catch');
    }
  }, [isActive, isCalibrating, setActiveModelId]);

  const isModelCalibrating = isCalibrating && activeModelId === 'drone-catch';

  // Create permanent scene instance ONCE
  const { centeredScene, toonMaterialsMap, blueprintEdgeLines, celEdgeLines } = useMemo(() => {
    const root = new THREE.Group();
    const pivot = new THREE.Group();
    pivotRef.current = pivot;

    const clone = masterWinchCatchPrototype!.template.clone(true);
    cloneRef.current = clone;

    const toonMap = new Map<THREE.Mesh, THREE.MeshToonMaterial | THREE.MeshToonMaterial[]>();
    const bpLines: THREE.LineSegments[] = [];
    const celLines: THREE.LineSegments[] = [];

    const bpLineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(blueprintLineColor),
      linewidth: 1,
    });

    const celLineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(celOutlineColor),
      linewidth: 1.5,
    });

    let runningPartIdx = 0;
    let meshIdx = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const currentPartStart = runningPartIdx;
        const currentMeshIdx = meshIdx;

        mesh.userData.cadPartIndex = currentPartStart;
        mesh.userData.isCadMesh = true;

        if (Array.isArray(mesh.material)) {
          const toonArr = mesh.material.map((_, subIdx) => {
            const partNum = currentPartStart + subIdx;
            const initialColor = DEFAULT_PART_COLORS[partNum]
              || (mesh.name && DEFAULT_PART_NAME_COLORS[mesh.name])
              || masterWinchCatchPrototype?.partsInfo[partNum]?.color
              || '#cbd5e1';
            return new THREE.MeshToonMaterial({
              color: new THREE.Color(initialColor),
              gradientMap: toonGradient,
            });
          });
          toonMap.set(mesh, toonArr);
          runningPartIdx += mesh.material.length;
        } else {
          const initialColor = DEFAULT_PART_COLORS[currentPartStart]
            || (mesh.name && DEFAULT_PART_NAME_COLORS[mesh.name])
            || masterWinchCatchPrototype?.partsInfo[currentPartStart]?.color
            || '#cbd5e1';
          const toon = new THREE.MeshToonMaterial({
            color: new THREE.Color(initialColor),
            gradientMap: toonGradient,
          });
          toonMap.set(mesh, toon);
          runningPartIdx += 1;
        }

        if (masterWinchCatchPrototype!.staticEdgesList[currentMeshIdx]) {
          const bpLine = new THREE.LineSegments(
            masterWinchCatchPrototype!.staticEdgesList[currentMeshIdx],
            bpLineMat
          );
          mesh.add(bpLine);
          bpLines.push(bpLine);
        }

        if (masterWinchCatchPrototype!.activeEdgesList[currentMeshIdx]) {
          const celLine = new THREE.LineSegments(
            masterWinchCatchPrototype!.activeEdgesList[currentMeshIdx],
            celLineMat
          );
          mesh.add(celLine);
          celLines.push(celLine);
        }

        meshIdx++;
      }
    });

    // 1. Center the unrotated CAD geometry inside the pivot group
    const bbox = new THREE.Box3().setFromObject(clone);
    const center = bbox.getCenter(new THREE.Vector3());
    clone.position.set(-center.x, -center.y, -center.z);

    // 2. Set initial world rotation and offset on the pivot
    pivot.rotation.set(
      (DEFAULT_ROTATION_DEG[0] * Math.PI) / 180,
      (DEFAULT_ROTATION_DEG[1] * Math.PI) / 180,
      (DEFAULT_ROTATION_DEG[2] * Math.PI) / 180
    );
    pivot.position.set(DEFAULT_OFFSET[0], DEFAULT_OFFSET[1], DEFAULT_OFFSET[2]);

    pivot.add(clone);
    root.add(pivot);

    return {
      centeredScene: root,
      toonMaterialsMap: toonMap,
      blueprintEdgeLines: bpLines,
      celEdgeLines: celLines,
    };
  }, []);

  // Collect kinematic nodes
  useEffect(() => {
    const list: MeshNodeInfo[] = [];
    let idx = 0;
    centeredScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const geomCom = computeGeometryCenterOfMass(mesh.geometry);
        const initQuat = mesh.quaternion.clone();
        const scaledCom = geomCom.clone().multiply(mesh.scale);
        const com = mesh.position.clone().add(scaledCom.applyQuaternion(initQuat));
        mesh.userData.centerOfMass = com;
        mesh.userData.hasOwnKinematics = true;
        mesh.userData.initialPos = mesh.position.clone();
        mesh.userData.initialRot = mesh.rotation.clone();
        mesh.userData.initialQuat = initQuat;

        const partIdx = mesh.userData.cadPartIndex !== undefined ? mesh.userData.cadPartIndex : idx;

        list.push({
          mesh,
          initialPos: mesh.position.clone(),
          initialRot: mesh.rotation.clone(),
          initialQuat: initQuat,
          centerOfMass: com,
          index: partIdx,
        });
        idx++;
      }
    });
    meshNodesRef.current = list;
  }, [centeredScene]);

  // Update materials, edges and selection highlights
  useEffect(() => {
    const isShaded = isActive || isModelCalibrating;

    blueprintEdgeLines.forEach((line) => {
      line.visible = !isShaded;
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.color.set(blueprintLineColor);
      }
    });

    celEdgeLines.forEach((line) => {
      line.visible = isShaded;
      if (line.material instanceof THREE.LineBasicMaterial) {
        line.material.color.set(celOutlineColor);
      }
    });

    const bpMat = isDark ? darkBlueprintMat : lightBlueprintMat;

    let partRunningIndex = 0;
    toonMaterialsMap.forEach((toonMatOrArray, mesh) => {
      let isMeshVisible = true;
      if (isShaded) {
        if (Array.isArray(toonMatOrArray)) {
          mesh.material = toonMatOrArray;
          let anySubVisible = false;
          toonMatOrArray.forEach((tm) => {
            const currentPartIdx = partRunningIndex++;
            const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
            const defaultBaked = (isModelCalibrating && settings.colorOverrides?.[currentPartIdx])
              ? settings.colorOverrides[currentPartIdx]
              : (DEFAULT_PART_COLORS[currentPartIdx]
                || (mesh.name && DEFAULT_PART_NAME_COLORS[mesh.name])
                || masterWinchCatchPrototype?.partsInfo[currentPartIdx]?.color
                || '#cbd5e1');
            const overrideHex = defaultBaked;

            const isPartVisible = isModelCalibrating 
              ? settings.visibilityOverrides?.[currentPartIdx] !== false 
              : DEFAULT_PART_VISIBILITY[currentPartIdx] !== false;
            
            if (isPartVisible) anySubVisible = true;
            tm.visible = isPartVisible;
            tm.color.set(isPartSelected ? '#38bdf8' : overrideHex);
            tm.emissive.set(isPartSelected ? '#0284c7' : '#000000');
          });
          isMeshVisible = anySubVisible;
        } else {
          const currentPartIdx = partRunningIndex++;
          const isPartSelected = isModelCalibrating && selectedPartIndex === currentPartIdx;
          const defaultBaked = (isModelCalibrating && settings.colorOverrides?.[currentPartIdx])
            ? settings.colorOverrides[currentPartIdx]
            : (DEFAULT_PART_COLORS[currentPartIdx]
              || (mesh.name && DEFAULT_PART_NAME_COLORS[mesh.name])
              || masterWinchCatchPrototype?.partsInfo[currentPartIdx]?.color
              || '#cbd5e1');
          const overrideHex = defaultBaked;

          const isPartVisible = isModelCalibrating 
            ? settings.visibilityOverrides?.[currentPartIdx] !== false 
            : DEFAULT_PART_VISIBILITY[currentPartIdx] !== false;
          
          isMeshVisible = isPartVisible;
          mesh.material = toonMatOrArray;
          toonMatOrArray.visible = isPartVisible;
          toonMatOrArray.color.set(isPartSelected ? '#38bdf8' : overrideHex);
          toonMatOrArray.emissive.set(isPartSelected ? '#0284c7' : '#000000');
        }
      } else {
        if (Array.isArray(toonMatOrArray)) {
          let anySubVisible = false;
          mesh.material = toonMatOrArray.map(() => {
            const currentPartIdx = partRunningIndex++;
            const isPartVisible = isModelCalibrating 
              ? settings.visibilityOverrides?.[currentPartIdx] !== false 
              : DEFAULT_PART_VISIBILITY[currentPartIdx] !== false;
            if (isPartVisible) anySubVisible = true;
            return bpMat;
          });
          isMeshVisible = anySubVisible;
        } else {
          const currentPartIdx = partRunningIndex++;
          const isPartVisible = isModelCalibrating 
            ? settings.visibilityOverrides?.[currentPartIdx] !== false 
            : DEFAULT_PART_VISIBILITY[currentPartIdx] !== false;
          isMeshVisible = isPartVisible;
          mesh.material = bpMat;
        }
      }
      mesh.visible = isMeshVisible;
    });
  }, [
    isActive,
    isModelCalibrating,
    isDark,
    selectedPartIndex,
    toonMaterialsMap,
    blueprintEdgeLines,
    celEdgeLines,
    blueprintLineColor,
    celOutlineColor,
    isModelCalibrating ? settings.colorOverrides : null,
    isModelCalibrating ? settings.visibilityOverrides : null,
  ]);

  // Frame loop
  const localTimeRef = useRef(0);

  useEffect(() => {
    if (!isModelCalibrating && (!isActive || !isRotating)) {
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0);
      currentSpeedRef.current = 0;
    }
    if (!isModelCalibrating && (!isActive || !isAnimating)) {
      localTimeRef.current = 0;
      if (meshNodesRef.current.length > 0) {
        meshNodesRef.current.forEach((node) => {
          node.mesh.position.copy(node.initialPos);
          node.mesh.rotation.copy(node.initialRot);
        });
      }
    }
  }, [isActive, isRotating, isAnimating, isModelCalibrating]);

  useFrame((_state, delta) => {
    delta = Math.min(delta, 0.035);
    // Always apply transform calibration directly to pivot
    if (pivotRef.current) {
      const offsetX = isModelCalibrating ? settings.offsetX : DEFAULT_OFFSET[0];
      const offsetY = isModelCalibrating ? settings.offsetY : DEFAULT_OFFSET[1];
      const offsetZ = isModelCalibrating ? settings.offsetZ : DEFAULT_OFFSET[2];
      const rotX = isModelCalibrating ? (settings.rotX * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[0] * Math.PI) / 180;
      const rotY = isModelCalibrating ? (settings.rotY * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[1] * Math.PI) / 180;
      const rotZ = isModelCalibrating ? (settings.rotZ * Math.PI) / 180 : (DEFAULT_ROTATION_DEG[2] * Math.PI) / 180;

      pivotRef.current.rotation.set(rotX, rotY, rotZ);
      pivotRef.current.position.set(offsetX, offsetY, offsetZ);
    }

    if (!isModelCalibrating && (!isActive || !isRotating)) {
      if (groupRef.current) groupRef.current.rotation.set(0, 0, 0);
      currentSpeedRef.current = 0;
    }
    if (!isModelCalibrating && (!isActive || !isAnimating)) {
      localTimeRef.current = 0;
      if (meshNodesRef.current.length > 0) {
        meshNodesRef.current.forEach((node) => {
          node.mesh.position.copy(node.initialPos);
          node.mesh.rotation.copy(node.initialRot);
        });
      }
    }

    if (!isActive && !isModelCalibrating) {
      if (groupRef.current) {
        groupRef.current.scale.setScalar(DEFAULT_SCALE);
      }
      return;
    }

    if (isAnimating && (isActive || isModelCalibrating)) {
      localTimeRef.current += delta;
    }

    const baseScale = isModelCalibrating ? settings.scale : DEFAULT_SCALE;
    if (groupRef.current) {
      groupRef.current.scale.setScalar(baseScale);
    }

    // Auto rotate parent with smooth acceleration from 0 RPM
    const maxSpeed = isModelCalibrating ? settings.rotationSpeed : 0.2;
    const targetSpeed = isModelCalibrating ? (settings.autoRotate ? maxSpeed : 0) : (isActive && isRotating && isAnimating ? maxSpeed : 0);
    currentSpeedRef.current = THREE.MathUtils.damp(currentSpeedRef.current, targetSpeed, 1.8, delta);

    if (groupRef.current && (isRotating || isModelCalibrating)) {
      if (currentSpeedRef.current > 0.001) {
        groupRef.current.rotation.y += delta * currentSpeedRef.current;
      }
    }

    const time = localTimeRef.current;
    if (isAnimating && meshNodesRef.current.length > 0) {
      const computedTransforms = new Map<
        number,
        { pos: THREE.Vector3; quat: THREE.Quaternion; deltaPos: THREE.Vector3; deltaQuat: THREE.Quaternion }
      >();

      const nodeMap = new Map<number, MeshNodeInfo>();
      meshNodesRef.current.forEach((n) => nodeMap.set(n.index, n));

      const solveKinematics = (
        partIdx: number,
        visited = new Set<number>()
      ): { pos: THREE.Vector3; quat: THREE.Quaternion; deltaPos: THREE.Vector3; deltaQuat: THREE.Quaternion } | null => {
        if (computedTransforms.has(partIdx)) {
          return computedTransforms.get(partIdx)!;
        }
        if (visited.has(partIdx)) {
          const n = nodeMap.get(partIdx);
          if (!n) return null;
          return {
            pos: n.initialPos.clone(),
            quat: n.initialQuat.clone(),
            deltaPos: new THREE.Vector3(),
            deltaQuat: new THREE.Quaternion(),
          };
        }
        visited.add(partIdx);

        const node = nodeMap.get(partIdx);
        if (!node) return null;

        const anim: PartAnimationConfig | undefined = isModelCalibrating
          ? settings.animationOverrides[node.index]
          : DEFAULT_PART_ANIMATIONS[node.index];

        const parentIdx = anim?.parentPartIndex;
        let basePos = node.initialPos.clone();
        let baseQuat = node.initialQuat.clone();
        let parentDeltaQuat = new THREE.Quaternion();

        if (parentIdx !== undefined && parentIdx !== null && parentIdx !== partIdx && nodeMap.has(parentIdx)) {
          const parentResult = solveKinematics(parentIdx, visited);
          const parentNode = nodeMap.get(parentIdx);
          if (parentResult && parentNode) {
            parentDeltaQuat = parentResult.deltaQuat;
            const relOffset = node.initialPos.clone().sub(parentNode.initialPos);
            basePos = parentResult.pos.clone().add(relOffset.clone().applyQuaternion(parentDeltaQuat));
            baseQuat = parentDeltaQuat.clone().multiply(node.initialQuat);
          }
        }

        let currentPos = basePos.clone();
        let currentQuat = baseQuat.clone();
        let accumulatedDeltaQuat = parentDeltaQuat.clone();

        const restingCom = basePos.clone().add(
          node.centerOfMass.clone().sub(node.initialPos).applyQuaternion(parentDeltaQuat)
        );
        node.mesh.userData.restingCom = restingCom;
        node.mesh.userData.restingPos = basePos.clone();
        node.mesh.userData.parentDeltaQuat = parentDeltaQuat.clone();

        if (anim && anim.type !== 'none') {
          const applyAnim = (animConfig: any) => {
            if (!animConfig || animConfig.type === 'none') return;
            if (animConfig.type === 'multi' && Array.isArray(animConfig.subAnimations)) {
              animConfig.subAnimations.forEach(applyAnim);
              return;
            }

            const phaseRad = ((animConfig.phase || 0) * Math.PI) / 180;
            const rotXRad = ((animConfig.axisRotX || 0) * Math.PI) / 180;
            const rotYRad = ((animConfig.axisRotY || 0) * Math.PI) / 180;
            const rotZRad = ((animConfig.axisRotZ || 0) * Math.PI) / 180;
            const customAxisQuat = new THREE.Quaternion().setFromEuler(
              new THREE.Euler(rotXRad, rotYRad, rotZRad, 'XYZ')
            );

            const rawAxis = new THREE.Vector3(
              animConfig.axis === 'x' ? 1 : 0,
              animConfig.axis === 'y' ? 1 : 0,
              animConfig.axis === 'z' ? 1 : 0
            );
            const orientedAxis = rawAxis.clone().applyQuaternion(customAxisQuat);
            const alignment = animConfig.axisAlignment || 'model';
            const parentWorldQuat = new THREE.Quaternion();
            if (node.mesh.parent) {
              node.mesh.parent.getWorldQuaternion(parentWorldQuat);
            }

            let axisVec: THREE.Vector3;
            let pivotOffset: THREE.Vector3;

            const rawPivotOffset = new THREE.Vector3(
              (animConfig.pivotX || 0) / 100,
              (animConfig.pivotY || 0) / 100,
              (animConfig.pivotZ || 0) / 100
            );

            if (alignment === 'global') {
              axisVec = orientedAxis.clone().applyQuaternion(parentWorldQuat.clone().invert());
              pivotOffset = rawPivotOffset.clone().applyQuaternion(parentWorldQuat.clone().invert());
            } else if (alignment === 'part') {
              axisVec = orientedAxis.clone().applyQuaternion(baseQuat);
              pivotOffset = rawPivotOffset.clone().applyQuaternion(baseQuat);
            } else {
              // 'model': Assembly Model Root frame (groupRef)
              const assemblyWorldQuat = new THREE.Quaternion();
              if (groupRef.current) {
                groupRef.current.getWorldQuaternion(assemblyWorldQuat);
              } else {
                const assemblyRoot = getAssemblyRoot(node.mesh);
                assemblyRoot.getWorldQuaternion(assemblyWorldQuat);
              }
              const assemblyToParentQuat = parentWorldQuat.clone().invert().multiply(assemblyWorldQuat);

              axisVec = orientedAxis.clone().applyQuaternion(assemblyToParentQuat).applyQuaternion(accumulatedDeltaQuat);
              pivotOffset = rawPivotOffset.clone().applyQuaternion(assemblyToParentQuat).applyQuaternion(accumulatedDeltaQuat);
            }

            const dir = animConfig.direction ?? 1;
            const omega = ((animConfig.speed || 0) * Math.PI * 2) / 60;

            if (animConfig.type === 'continuous-spin' || animConfig.type === 'oscillate-rotation') {
              const pivotMode = animConfig.pivotMode || 'center-of-mass';
              let pivot = basePos.clone().add(
                node.centerOfMass.clone().sub(node.initialPos).applyQuaternion(accumulatedDeltaQuat)
              );

              const translationDelta = currentPos.clone().sub(basePos);
              pivot.add(translationDelta);

              if (pivotMode === 'origin') {
                pivot.copy(basePos).add(translationDelta);
              } else if (pivotMode === 'custom') {
                pivot.add(pivotOffset);
              }

              node.mesh.userData.hingePivot = pivot.clone();
              node.mesh.userData.hingeAxis = axisVec.clone();

              const angle =
                animConfig.type === 'continuous-spin'
                  ? time * omega * dir
                  : Math.sin(time * omega + phaseRad) *
                    (((animConfig.amplitude || 30) * Math.PI) / 180) *
                    dir;

              const qDelta = new THREE.Quaternion().setFromAxisAngle(axisVec, angle);
              currentQuat = qDelta.clone().multiply(currentQuat);
              currentPos.sub(pivot).applyQuaternion(qDelta).add(pivot);
              accumulatedDeltaQuat = qDelta.clone().multiply(accumulatedDeltaQuat);
            } else if (animConfig.type === 'linear-reciprocate') {
              const distPosM = ((animConfig.amplitudePositive !== undefined ? animConfig.amplitudePositive : (animConfig.amplitude || 10)) / 100);
              const distNegM = ((animConfig.amplitudeNegative !== undefined ? animConfig.amplitudeNegative : (animConfig.amplitude || 10)) / 100);
              let displacementScalar = 0;
              if (isAnimating) {
                if (distNegM === 0) {
                  const progress = (1 - Math.cos(time * omega + phaseRad)) / 2;
                  displacementScalar = progress * distPosM * dir;
                } else if (distPosM === 0) {
                  const progress = (1 - Math.cos(time * omega + phaseRad)) / 2;
                  displacementScalar = -progress * distNegM * dir;
                } else {
                  const s = Math.sin(time * omega + phaseRad);
                  displacementScalar = (s >= 0 ? s * distPosM : s * distNegM) * dir;
                }
              }
              const displacement = axisVec.clone().multiplyScalar(displacementScalar);
              currentPos.add(displacement);
            }
          };

          applyAnim(anim);
        }

        node.mesh.position.copy(currentPos);
        node.mesh.quaternion.copy(currentQuat);
        node.mesh.userData.currentCom = basePos.clone().add(
          node.centerOfMass.clone().sub(node.initialPos).applyQuaternion(accumulatedDeltaQuat)
        );

        const deltaPos = currentPos.clone().sub(node.initialPos);
        const deltaQuat = currentQuat.clone().multiply(node.initialQuat.clone().invert());
        const result = { pos: currentPos, quat: currentQuat, deltaPos, deltaQuat };
        computedTransforms.set(partIdx, result);
        return result;
      };

      nodeMap.forEach((_, pIdx) => {
        solveKinematics(pIdx);
      });
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {isModelCalibrating && settings.showGizmo && <CADPivotGizmo />}
      <primitive object={centeredScene} />
    </group>
  );
};

useGLTF.preload('./models/CableRobotWinchV2.glb');
