import React from 'react';

export const POSTER_STAGE_HEIGHT = 490;
export const POSTER_BAKE_DPR = 1.6;
export const POSTER_BUFFER_HEIGHT = Math.round(POSTER_STAGE_HEIGHT * POSTER_BAKE_DPR);

export const CAD_CAMERA_POSITION: [number, number, number] = [4.6, 3.2, 5.0];
export const CAD_CAMERA_FOV = 34;

/**
 * Matches live WebGL canvas backing height to the baked 784px poster PNG so 1px
 * WebGL edge lines render at identical screen thickness across all viewports.
 */
export function computeMatchedDpr(containerHeight: number): number {
  if (!containerHeight || containerHeight <= 0) {
    return POSTER_BAKE_DPR;
  }
  return Math.min(3.0, Math.max(1.0, +(POSTER_BUFFER_HEIGHT / containerHeight).toFixed(2)));
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
