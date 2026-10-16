import React, { lazy } from 'react';
import {
  getCachedModelComponent,
  loadModelComponentChunk,
  ModelComponentProps,
} from './ModelPreloadManager';

// Lazy fallbacks sharing the exact same module promises as ModelPreloadManager
const lazyModelComponents: Record<string, React.LazyExoticComponent<React.ComponentType<ModelComponentProps>>> = {
  'tesla-actuator': lazy(() => loadModelComponentChunk('tesla-actuator')),
  'inductive-robot': lazy(() => loadModelComponentChunk('inductive-robot')),
  'robot-hand': lazy(() => loadModelComponentChunk('robot-hand')),
  'cable-robot-2': lazy(() => loadModelComponentChunk('cable-robot-2')),
  'ping-pong': lazy(() => loadModelComponentChunk('ping-pong')),
  'catamaran': lazy(() => loadModelComponentChunk('catamaran')),
  'drone-catch': lazy(() => loadModelComponentChunk('drone-catch')),
  'outrigger': lazy(() => loadModelComponentChunk('outrigger')),
  'modular-gripper': lazy(() => loadModelComponentChunk('modular-gripper')),
  'underwater-robot': lazy(() => loadModelComponentChunk('underwater-robot')),
  'anti-tangle-winch': lazy(() => loadModelComponentChunk('anti-tangle-winch')),
  'bottle-scrubber': lazy(() => loadModelComponentChunk('bottle-scrubber')),
  'ftc-robot': lazy(() => loadModelComponentChunk('ftc-robot')),
};

interface ModelRendererProps {
  modelType: string;
  isActive?: boolean;
  isHovered?: boolean;
  isRotating?: boolean;
  isAnimating?: boolean;
}

export const ModelRenderer: React.FC<ModelRendererProps> = ({
  modelType,
  isActive = false,
  isHovered = false,
  isRotating = true,
  isAnimating = true,
}) => {
  const props: ModelComponentProps = { isActive, isHovered, isRotating, isAnimating };

  // Fast path: if chunk was already preloaded by ModelPreloadManager, render synchronously
  // without triggering a 1-frame React.lazy Suspense boundary delay.
  const CachedComponent = getCachedModelComponent(modelType);
  if (CachedComponent) {
    return <CachedComponent {...props} />;
  }

  const LazyComponent = lazyModelComponents[modelType] || lazyModelComponents['robot-hand'];
  return <LazyComponent {...props} />;
};
