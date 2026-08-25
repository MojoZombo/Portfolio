import * as THREE from 'three';

// Create discrete 3-tone cel shading gradient map with bright readable shadows
export function createToonGradientMap(): THREE.DataTexture {
  const colors = new Uint8Array([
    145, 145, 145, 255, // Readable soft shadow step
    215, 215, 215, 255, // Clean midtone
    255, 255, 255, 255  // Full illumination
  ]);

  const texture = new THREE.DataTexture(colors, 3, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
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
