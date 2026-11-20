import * as THREE from 'three';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Create 4-band cel shading ramp with smoothstep-beveled transitions so curved
// surfaces keep crisp bands while rotating flat faces glide cleanly without popping.
export function createToonGradientMap(): THREE.DataTexture {
  const width = 256;
  const colors = new Uint8Array(width * 4);
  const w = 0.055;

  for (let i = 0; i < width; i++) {
    const u = i / (width - 1);
    let v = 65;
    v += (95 - 65) * smoothstep(0.22 - w, 0.22 + w, u);
    v += (175 - 95) * smoothstep(0.50 - w, 0.50 + w, u);
    v += (255 - 175) * smoothstep(0.79 - w, 0.79 + w, u);

    const byte = Math.round(v);
    const idx = i * 4;
    colors[idx] = byte;
    colors[idx + 1] = byte;
    colors[idx + 2] = byte;
    colors[idx + 3] = 255;
  }

  const texture = new THREE.DataTexture(colors, width, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
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
