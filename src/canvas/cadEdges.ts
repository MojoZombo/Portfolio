import React, { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CAD_LINE_HEIGHT_RATIO } from './stageConfig';

const ORIGINAL_LINE_LAYER = 31;
const DEFAULT_CAMERA_LAYER = 0;

const BLUEPRINT_LINE_DARK = new THREE.Color('#94A8C4');
const BLUEPRINT_LINE_LIGHT = new THREE.Color('#1E293B');

const QUAD_POSITIONS = new Float32Array([
  -1, 0, 0,
   1, 0, 0,
  -1, 1, 0,
   1, 1, 0,
]);
const QUAD_INDICES = new Uint16Array([0, 1, 2, 2, 1, 3]);

const CAD_EDGE_VERTEX_SHADER = /* glsl */ `
  uniform vec2 uResolution;
  uniform float uLineWidthPx;

  attribute vec3 instanceStart;
  attribute vec3 instanceEnd;

  void trimSegment(const in vec4 start, inout vec4 end) {
    float a = projectionMatrix[2][2];
    float b = projectionMatrix[3][2];
    float nearEstimate = -0.5 * b / a;
    float denom = end.z - start.z;
    if (abs(denom) > 1e-6) {
      float alpha = (nearEstimate - start.z) / denom;
      end.xyz = mix(start.xyz, end.xyz, alpha);
    }
  }

  void main() {
    vec4 start = modelViewMatrix * vec4(instanceStart, 1.0);
    vec4 end = modelViewMatrix * vec4(instanceEnd, 1.0);

    bool perspective = (projectionMatrix[2][3] == -1.0);
    if (perspective) {
      if (start.z >= 0.0 && end.z >= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        return;
      }
      if (start.z < 0.0 && end.z >= 0.0) {
        trimSegment(start, end);
      } else if (end.z < 0.0 && start.z >= 0.0) {
        trimSegment(end, start);
      }
    }

    vec4 clipStart = projectionMatrix * start;
    vec4 clipEnd = projectionMatrix * end;

    if (clipStart.w <= 1e-5 || clipEnd.w <= 1e-5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec2 ndcStart = clipStart.xy / clipStart.w;
    vec2 ndcEnd = clipEnd.xy / clipEnd.w;

    vec2 screenDelta = (ndcEnd - ndcStart) * (0.5 * uResolution);
    float segLenPx = length(screenDelta);
    if (segLenPx < 1e-4) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    vec2 dirPx = screenDelta / segLenPx;
    vec2 normalPx = vec2(-dirPx.y, dirPx.x);

    float halfWidthPx = 0.5 * uLineWidthPx;
    float capPx = 0.35 * halfWidthPx;
    vec2 offsetPx =
      normalPx * (position.x * halfWidthPx) +
      dirPx * ((position.y < 0.5 ? -1.0 : 1.0) * capPx);

    vec4 clip = (position.y < 0.5) ? clipStart : clipEnd;
    clip.xy += (offsetPx * 2.0 / uResolution) * clip.w;
    gl_Position = clip;
  }
`;

const CAD_EDGE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;

  void main() {
    gl_FragColor = vec4(uColor, uAlpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

interface InstancedSegmentBuild {
  geometry: THREE.InstancedBufferGeometry;
  instanceBuffer: THREE.InstancedInterleavedBuffer;
  sharedSourceBuffer: boolean;
  sourcePosAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  lastVersion: number;
}

interface CADEdgeEntry {
  line: THREE.LineSegments;
  sourceGeometry: THREE.BufferGeometry;
  sourcePosAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  edgeGeom: THREE.InstancedBufferGeometry;
  instanceBuffer: THREE.InstancedInterleavedBuffer;
  sharedSourceBuffer: boolean;
  lastVersion: number;
  material: THREE.ShaderMaterial;
  quadMesh: THREE.Mesh;
}

export class CADEdgeRegistry {
  entries = new Map<THREE.LineSegments, CADEdgeEntry>();
  seenLines = new Set<THREE.LineSegments>();
  staleLines: THREE.LineSegments[] = [];
  offsetAppliedMaterials = new WeakSet<THREE.Material>();
  drawSize = new THREE.Vector2(1, 1);
}

function buildInstancedSegmentGeometry(sourceGeom: THREE.BufferGeometry): InstancedSegmentBuild | null {
  const posAttr = sourceGeom.attributes?.position;
  if (!posAttr || posAttr.count < 2) {
    return null;
  }

  const indexAttr = sourceGeom.index;
  const isPlainVec3Float =
    !indexAttr &&
    !(posAttr as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute &&
    posAttr.array instanceof Float32Array &&
    posAttr.itemSize === 3 &&
    posAttr.count % 2 === 0 &&
    posAttr.array.length === posAttr.count * 3;

  let segArray: Float32Array;
  let segmentCount: number;
  let sharedSourceBuffer = false;

  if (isPlainVec3Float) {
    segArray = posAttr.array as Float32Array;
    segmentCount = posAttr.count / 2;
    sharedSourceBuffer = true;
  } else if (indexAttr) {
    segmentCount = Math.floor(indexAttr.count / 2);
    if (segmentCount <= 0) return null;
    segArray = new Float32Array(segmentCount * 6);
    for (let i = 0; i < segmentCount; i++) {
      const i0 = indexAttr.getX(i * 2);
      const i1 = indexAttr.getX(i * 2 + 1);
      const base = i * 6;
      segArray[base] = posAttr.getX(i0);
      segArray[base + 1] = posAttr.getY(i0);
      segArray[base + 2] = posAttr.getZ(i0);
      segArray[base + 3] = posAttr.getX(i1);
      segArray[base + 4] = posAttr.getY(i1);
      segArray[base + 5] = posAttr.getZ(i1);
    }
  } else {
    segmentCount = Math.floor(posAttr.count / 2);
    if (segmentCount <= 0) return null;
    segArray = new Float32Array(segmentCount * 6);
    for (let i = 0; i < segmentCount; i++) {
      const v0 = i * 2;
      const v1 = v0 + 1;
      const base = i * 6;
      segArray[base] = posAttr.getX(v0);
      segArray[base + 1] = posAttr.getY(v0);
      segArray[base + 2] = posAttr.getZ(v0);
      segArray[base + 3] = posAttr.getX(v1);
      segArray[base + 4] = posAttr.getY(v1);
      segArray[base + 5] = posAttr.getZ(v1);
    }
  }

  if (segmentCount <= 0) {
    return null;
  }

  const edgeGeom = new THREE.InstancedBufferGeometry();
  edgeGeom.setIndex(new THREE.BufferAttribute(QUAD_INDICES, 1));
  edgeGeom.setAttribute('position', new THREE.Float32BufferAttribute(QUAD_POSITIONS, 3));

  const instanceBuffer = new THREE.InstancedInterleavedBuffer(segArray, 6, 1);
  edgeGeom.setAttribute('instanceStart', new THREE.InterleavedBufferAttribute(instanceBuffer, 3, 0));
  edgeGeom.setAttribute('instanceEnd', new THREE.InterleavedBufferAttribute(instanceBuffer, 3, 3));
  edgeGeom.instanceCount = segmentCount;

  return {
    geometry: edgeGeom,
    instanceBuffer,
    sharedSourceBuffer,
    sourcePosAttr: posAttr,
    lastVersion: (posAttr as THREE.BufferAttribute).version ?? 0,
  };
}

function createCADEdgeShaderMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#0A0E14') },
      uAlpha: { value: 1.0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uLineWidthPx: { value: 1.0 },
    },
    vertexShader: CAD_EDGE_VERTEX_SHADER,
    fragmentShader: CAD_EDGE_FRAGMENT_SHADER,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    toneMapped: true,
    transparent: false,
    stencilWrite: false,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.ReplaceStencilOp,
  });
}

function applyPolygonOffsetIfNeeded(mat: THREE.Material, registry: CADEdgeRegistry) {
  if (!(mat instanceof THREE.MeshToonMaterial) || registry.offsetAppliedMaterials.has(mat)) {
    return;
  }
  registry.offsetAppliedMaterials.add(mat);
  if (!mat.polygonOffset) {
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1;
    mat.polygonOffsetUnits = 1;
  }
}

function isEligibleCADLineSegments(obj: THREE.Object3D): obj is THREE.LineSegments {
  if (!(obj as THREE.LineSegments).isLineSegments) return false;
  const line = obj as THREE.LineSegments;
  if (line.userData?.skipCadEdgeUpgrade === true) return false;
  if (!(line.material instanceof THREE.LineBasicMaterial)) return false;
  if (line.material.vertexColors === true) return false;
  const posAttr = line.geometry?.attributes?.position;
  if (!posAttr || posAttr.count < 2) return false;
  return true;
}

function disposeEntry(entry: CADEdgeEntry) {
  entry.quadMesh.removeFromParent();
  entry.edgeGeom.dispose();
  entry.material.dispose();
  if (entry.line.layers) {
    entry.line.layers.set(DEFAULT_CAMERA_LAYER);
  }
}

function createOrRebuildEntry(line: THREE.LineSegments, existing?: CADEdgeEntry): CADEdgeEntry | null {
  const build = buildInstancedSegmentGeometry(line.geometry);
  if (!build) {
    if (existing) disposeEntry(existing);
    return null;
  }

  line.layers.set(ORIGINAL_LINE_LAYER);

  if (existing) {
    existing.edgeGeom.dispose();
    existing.edgeGeom = build.geometry;
    existing.instanceBuffer = build.instanceBuffer;
    existing.sharedSourceBuffer = build.sharedSourceBuffer;
    existing.sourceGeometry = line.geometry;
    existing.sourcePosAttr = build.sourcePosAttr;
    existing.lastVersion = build.lastVersion;
    existing.quadMesh.geometry = build.geometry;
    return existing;
  }

  const material = createCADEdgeShaderMaterial();
  const quadMesh = new THREE.Mesh(build.geometry, material);
  quadMesh.name = '__cad_edge_quad__';
  quadMesh.layers.set(DEFAULT_CAMERA_LAYER);
  quadMesh.renderOrder = 1;
  quadMesh.frustumCulled = false;
  quadMesh.castShadow = false;
  quadMesh.receiveShadow = false;
  quadMesh.raycast = () => {};
  quadMesh.userData.isCadEdgeQuad = true;

  line.add(quadMesh);

  return {
    line,
    sourceGeometry: line.geometry,
    sourcePosAttr: build.sourcePosAttr,
    edgeGeom: build.geometry,
    instanceBuffer: build.instanceBuffer,
    sharedSourceBuffer: build.sharedSourceBuffer,
    lastVersion: build.lastVersion,
    material,
    quadMesh,
  };
}

function syncEntryUniformsAndBuffers(
  entry: CADEdgeEntry,
  bufWidth: number,
  bufHeight: number,
  desiredPhysPx: number,
  lineWidthPx: number,
  coverageAlpha: number,
  blueprintMix = 0,
  isDark = false
) {
  const line = entry.line;
  const posAttr = line.geometry.attributes?.position;

  if (posAttr) {
    const version = (posAttr as THREE.BufferAttribute).version ?? 0;
    if (version !== entry.lastVersion) {
      entry.lastVersion = version;
      if (entry.sharedSourceBuffer) {
        entry.instanceBuffer.needsUpdate = true;
      } else {
        const rebuilt = buildInstancedSegmentGeometry(line.geometry);
        if (rebuilt) {
          entry.edgeGeom.dispose();
          entry.edgeGeom = rebuilt.geometry;
          entry.instanceBuffer = rebuilt.instanceBuffer;
          entry.sharedSourceBuffer = rebuilt.sharedSourceBuffer;
          entry.sourcePosAttr = rebuilt.sourcePosAttr;
          entry.quadMesh.geometry = rebuilt.geometry;
        }
      }
    }
  }

  const lineMat = line.material as THREE.LineBasicMaterial;
  const baseOpacity = lineMat.transparent ? lineMat.opacity : 1.0;
  const finalAlpha = coverageAlpha * baseOpacity;
  const edgeMat = entry.material;

  edgeMat.uniforms.uColor.value.copy(lineMat.color);
  if (blueprintMix > 0.0001) {
    edgeMat.uniforms.uColor.value.lerp(
      isDark ? BLUEPRINT_LINE_DARK : BLUEPRINT_LINE_LIGHT,
      blueprintMix
    );
  }
  edgeMat.uniforms.uAlpha.value = finalAlpha;
  edgeMat.uniforms.uResolution.value.set(bufWidth, bufHeight);
  edgeMat.uniforms.uLineWidthPx.value = lineWidthPx;

  if (baseOpacity < 0.999) {
    // Translucent guide lines (e.g. cable boundary guides): standard blend without writing stencil
    edgeMat.transparent = true;
    edgeMat.stencilWrite = false;
  } else if (desiredPhysPx < 0.999) {
    // Sub-pixel energy-conserving AA path: stencil prevents double-darkening at corners/vertices
    edgeMat.transparent = true;
    edgeMat.stencilWrite = true;
    edgeMat.stencilRef = 1;
    edgeMat.stencilFunc = THREE.NotEqualStencilFunc;
    edgeMat.stencilFail = THREE.KeepStencilOp;
    edgeMat.stencilZFail = THREE.KeepStencilOp;
    edgeMat.stencilZPass = THREE.ReplaceStencilOp;
  } else {
    // Full-coverage path (>= 1.0px physical line width)
    edgeMat.transparent = false;
    edgeMat.stencilWrite = false;
  }
}

/**
 * Upgrades all eligible CAD LineSegments in the scene to resolution-independent
 * screen-space instanced edge quads and keeps uniforms/geometry synced.
 */
export function syncCADEdges(
  scene: THREE.Scene,
  gl: THREE.WebGLRenderer,
  registry: CADEdgeRegistry,
  blueprintMix = 0,
  isDark = false
) {
  gl.getDrawingBufferSize(registry.drawSize);
  const bufWidth = Math.max(1, registry.drawSize.x);
  const bufHeight = Math.max(1, registry.drawSize.y);

  const desiredPhysPx = Math.max(0.05, bufHeight * CAD_LINE_HEIGHT_RATIO);
  const lineWidthPx = Math.max(1.0, desiredPhysPx);
  const coverageAlpha = Math.min(1.0, desiredPhysPx);

  const seenLines = registry.seenLines;
  seenLines.clear();

  scene.traverse((obj) => {
    if (obj.userData?.isCadEdgeQuad) return;

    if ((obj as THREE.Mesh).isMesh && !(obj as THREE.Line).isLine) {
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        for (let i = 0; i < mat.length; i++) {
          if (mat[i]) applyPolygonOffsetIfNeeded(mat[i], registry);
        }
      } else if (mat) {
        applyPolygonOffsetIfNeeded(mat, registry);
      }
      return;
    }

    if (!isEligibleCADLineSegments(obj)) return;

    seenLines.add(obj);
    let entry = registry.entries.get(obj);
    const posAttr = obj.geometry.attributes.position;

    if (!entry || entry.sourceGeometry !== obj.geometry || entry.sourcePosAttr !== posAttr) {
      const built = createOrRebuildEntry(obj, entry);
      if (!built) {
        registry.entries.delete(obj);
        return;
      }
      entry = built;
      registry.entries.set(obj, entry);
    } else if (obj.layers.mask !== (1 << ORIGINAL_LINE_LAYER)) {
      obj.layers.set(ORIGINAL_LINE_LAYER);
    }

    syncEntryUniformsAndBuffers(
      entry,
      bufWidth,
      bufHeight,
      desiredPhysPx,
      lineWidthPx,
      coverageAlpha,
      blueprintMix,
      isDark
    );
  });

  if (registry.entries.size > seenLines.size) {
    registry.staleLines.length = 0;
    registry.entries.forEach((_, line) => {
      if (!seenLines.has(line)) {
        registry.staleLines.push(line);
      }
    });
    for (let i = 0; i < registry.staleLines.length; i++) {
      const stale = registry.staleLines[i];
      const entry = registry.entries.get(stale);
      if (entry) disposeEntry(entry);
      registry.entries.delete(stale);
    }
    registry.staleLines.length = 0;
  }

  seenLines.clear();
}

export function disposeCADEdgeRegistry(registry: CADEdgeRegistry) {
  registry.entries.forEach((entry) => disposeEntry(entry));
  registry.entries.clear();
  registry.seenLines.clear();
  registry.staleLines.length = 0;
}

export const CADEdgeManager: React.FC<{
  registryRef?: React.MutableRefObject<CADEdgeRegistry | null>;
  blueprintMixRef?: React.MutableRefObject<number>;
  isDark?: boolean;
}> = ({ registryRef, blueprintMixRef, isDark = false }) => {
  const { scene, gl } = useThree();
  const localRegistryRef = useRef<CADEdgeRegistry | null>(null);

  if (!localRegistryRef.current) {
    localRegistryRef.current = new CADEdgeRegistry();
  }

  useEffect(() => {
    const reg = localRegistryRef.current!;
    if (registryRef) {
      registryRef.current = reg;
    }
    return () => {
      disposeCADEdgeRegistry(reg);
      if (registryRef && registryRef.current === reg) {
        registryRef.current = null;
      }
    };
  }, [registryRef]);

  useFrame(() => {
    const reg = localRegistryRef.current;
    if (reg) {
      syncCADEdges(scene, gl, reg, blueprintMixRef?.current ?? 0, isDark);
    }
  });

  return null;
};
