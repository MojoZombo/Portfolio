import React from 'react';

export const POSTER_STAGE_HEIGHT = 490;
export const POSTER_BAKE_DPR = 2.0;
export const POSTER_BUFFER_HEIGHT = Math.round(POSTER_STAGE_HEIGHT * POSTER_BAKE_DPR);

export const CAD_LINE_HEIGHT_RATIO = 1.15 / 784;
export const MAX_LIVE_DPR = 3.0;

export const CAD_CAMERA_POSITION: [number, number, number] = [4.6, 3.2, 5.0];
export const CAD_CAMERA_FOV = 34;

/**
 * Returns the device's native pixel ratio capped for responsive high-DPI WebGL rendering.
 */
export function getNativeDpr(): number {
  if (typeof window === 'undefined') {
    return 1;
  }
  return Math.min(MAX_LIVE_DPR, Math.max(1, window.devicePixelRatio || 1));
}

/**
 * Shared lighting rig for live WebGL viewports, baked posters, and CAD studio
 * previews so static posters and live 3D cel shading never drift apart.
 */
export const CADStageLights: React.FC<{ isDark: boolean }> = ({ isDark }) => (
  <>
    <ambientLight color="#e2e8f0" intensity={isDark ? 0.65 : 0.72} />
    <directionalLight position={[-3.8, 9.2, 5.0]} intensity={2.95} color="#ffffff" />
  </>
);
