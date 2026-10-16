import React from 'react';
import { useGLTF } from '@react-three/drei';

// Use self-hosted Draco WASM decoder for all GLB models (eliminates external gstatic CDN fetches)
useGLTF.setDecoderPath('./draco/gltf/');

export const POSTER_VERSION = '20261012-v4';

export interface ModelComponentProps {
  isActive?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
  isAnimating?: boolean;
}

interface ModelAssetEntry {
  glbPath?: string;
  loader: () => Promise<{ default: React.ComponentType<ModelComponentProps> }>;
}

const MODEL_REGISTRY: Record<string, ModelAssetEntry> = {
  'tesla-actuator': {
    loader: () => import('./models/TeslaActuatorModel').then((m) => ({ default: m.TeslaActuatorModel })),
  },
  'inductive-robot': {
    loader: () => import('./models/InductiveRobotModel').then((m) => ({ default: m.InductiveRobotModel })),
  },
  'robot-hand': {
    glbPath: './models/HandSplit.glb',
    loader: () => import('./models/RobotHandModel').then((m) => ({ default: m.RobotHandModel })),
  },
  'cable-robot-2': {
    glbPath: './models/CableRobotV2Decimated.glb',
    loader: () => import('./models/CableRobotModel').then((m) => ({ default: m.CableRobotModel })),
  },
  'ping-pong': {
    glbPath: './models/pingpongtest.glb',
    loader: () => import('./models/PingPongRobotModel').then((m) => ({ default: m.PingPongRobotModel })),
  },
  'catamaran': {
    glbPath: './models/Sailboat.glb',
    loader: () => import('./models/CatamaranModel').then((m) => ({ default: m.CatamaranModel })),
  },
  'drone-catch': {
    glbPath: './models/CableRobotWinchV2.glb',
    loader: () => import('./models/WinchCatchModel').then((m) => ({ default: m.WinchCatchModel })),
  },
  'outrigger': {
    loader: () => import('./models/OutriggerModel').then((m) => ({ default: m.OutriggerModel })),
  },
  'modular-gripper': {
    glbPath: './models/RaiseGripper.glb',
    loader: () => import('./models/ModularGripperModel').then((m) => ({ default: m.ModularGripperModel })),
  },
  'underwater-robot': {
    glbPath: './models/underwater-robot-split.glb',
    loader: () => import('./models/UnderwaterRobotModel').then((m) => ({ default: m.UnderwaterRobotModel })),
  },
  'anti-tangle-winch': {
    glbPath: './models/Winch.glb',
    loader: () => import('./models/AntiTangleWinchModel').then((m) => ({ default: m.AntiTangleWinchModel })),
  },
  'bottle-scrubber': {
    glbPath: './models/Scrubtious.glb',
    loader: () => import('./models/BottleScrubberModel').then((m) => ({ default: m.BottleScrubberModel })),
  },
  'ftc-robot': {
    loader: () => import('./models/FTCRobotModel').then((m) => ({ default: m.FTCRobotModel })),
  },
};

// Resolved component cache: avoids React.lazy 1-frame Suspense flash when chunk is already warm
const resolvedComponentCache = new Map<string, React.ComponentType<ModelComponentProps>>();
const inFlightChunkPromises = new Map<string, Promise<{ default: React.ComponentType<ModelComponentProps> }>>();
const preloadedGLBs = new Set<string>();
const decodedPosterUrls = new Map<string, HTMLImageElement>();

/**
 * Returns the synchronously cached React component if already loaded, or null if not yet resolved.
 */
export function getCachedModelComponent(modelType: string): React.ComponentType<ModelComponentProps> | null {
  return resolvedComponentCache.get(modelType) || null;
}

/**
 * Loads the model's code-split JS module and caches the resolved component for synchronous access.
 */
export function loadModelComponentChunk(
  modelType: string
): Promise<{ default: React.ComponentType<ModelComponentProps> }> {
  const key = MODEL_REGISTRY[modelType] ? modelType : 'robot-hand';
  const existingPromise = inFlightChunkPromises.get(key);
  if (existingPromise) {
    return existingPromise;
  }

  const entry = MODEL_REGISTRY[key];
  const promise = entry.loader().then((mod) => {
    resolvedComponentCache.set(key, mod.default);
    return mod;
  });

  inFlightChunkPromises.set(key, promise);
  return promise;
}

/**
 * Pre-fetches and decodes the 2D static shaded and blueprint poster images into bitmap memory
 * so switching to active state composites in <1ms with zero main-thread image decode pause.
 */
export function preloadPosterImages(modelType: string, isDark: boolean): void {
  if (typeof window === 'undefined' || typeof Image === 'undefined') return;

  const themeSuffix = isDark ? 'dark' : 'light';
  const urls = [
    `./posters/${modelType}-shaded-${themeSuffix}.png?v=${POSTER_VERSION}`,
    `./posters/${modelType}-blueprint-${themeSuffix}.png?v=${POSTER_VERSION}`,
  ];

  for (const url of urls) {
    if (decodedPosterUrls.has(url)) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    decodedPosterUrls.set(url, img);
    if (typeof img.decode === 'function') {
      img.decode().catch(() => {
        // Fallback silently if theme-specific poster falls back to generic
      });
    }
  }
}

/**
 * Preloads the GLB binary into useGLTF's suspend cache using matching cache keys.
 */
export function preloadModelGLB(modelType: string): void {
  const entry = MODEL_REGISTRY[modelType];
  if (!entry || !entry.glbPath) return;
  if (preloadedGLBs.has(modelType)) return;

  preloadedGLBs.add(modelType);
  useGLTF.preload(entry.glbPath);
}

const idleQueue: Array<() => void> = [];
let isIdleScheduled = false;

function scheduleIdleFlush() {
  if (isIdleScheduled || idleQueue.length === 0) return;
  isIdleScheduled = true;

  const runNext = (deadline?: { timeRemaining: () => number; didTimeout: boolean }) => {
    isIdleScheduled = false;
    while (idleQueue.length > 0) {
      const task = idleQueue.shift();
      if (task) task();
      if (deadline && deadline.timeRemaining() < 4) {
        break;
      }
    }
    if (idleQueue.length > 0) {
      scheduleIdleFlush();
    }
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runNext, { timeout: 300 });
  } else {
    setTimeout(() => runNext(), 16);
  }
}

/**
 * Two-stage predictive preloader for timeline items:
 * - 'high' priority (active or adjacent N-1 / N+1): immediately pre-decodes posters, loads JS chunk, and preloads GLB.
 * - 'low' priority (outer viewport ring): queues JS chunk, GLB preload, and poster decode into idle callbacks.
 */
export function preloadModelAssets(
  modelType: string,
  isDark: boolean,
  priority: 'high' | 'low' = 'low'
): void {
  // Always start poster decode right away (asynchronous off-thread in modern browsers)
  preloadPosterImages(modelType, isDark);

  if (priority === 'high') {
    loadModelComponentChunk(modelType);
    preloadModelGLB(modelType);
    return;
  }

  idleQueue.push(() => {
    loadModelComponentChunk(modelType);
    preloadModelGLB(modelType);
  });
  scheduleIdleFlush();
}
