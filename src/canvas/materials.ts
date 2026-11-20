import * as THREE from 'three';

// Create discrete 4-step cel shading gradient map for crisp highlight, midtone, and shadow bands
export function createToonGradientMap(): THREE.DataTexture {
  const colors = new Uint8Array([
    65, 65, 65, 255,   // Core shadow step
    95, 95, 95, 255,   // Side shadow step
    175, 175, 175, 255, // Midtone step
    255, 255, 255, 255  // Key highlight step
  ]);

  const texture = new THREE.DataTexture(colors, 4, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

const toonGradient = createToonGradientMap();

export function getToonMaterial(
  color: string | number,
  isWireframe: boolean = false,
  wireframeColor?: string
): THREE.Material {
  if (isWireframe) {
    return new THREE.MeshBasicMaterial({
      color: wireframeColor || '#94a3b8',
      wireframe: true,
      transparent: true,
      opacity: 0.65
    });
  }

  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: toonGradient
  });
}

// Line / Outline Material for CAD drawing edge definition
export const cadOutlineMaterial = new THREE.LineBasicMaterial({
  color: new THREE.Color('#111827'),
  linewidth: 1.5,
  transparent: false
});
