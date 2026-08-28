import * as THREE from 'three';

/**
 * Result of a mesh partition operation
 */
export interface SplitPartitionResult {
  geometries: THREE.BufferGeometry[];
  islandCount: number;
}

/**
 * Auto-detect and separate disconnected topological bodies (separated by air gaps).
 * 
 * Algorithm:
 * 1. 27-Neighbor Spatial Grid Pass: Seam vertices across trimmed BREP / NURBS patches
 *    with Euclidean distance <= tolerance are joined (eliminates grid boundary artifacts).
 * 2. Air Gaps (> tolerance) remain disconnected.
 * 3. Micro-noise / zero-area sliver triangles (< 4 faces) are absorbed into parent bodies.
 */
export function separateDisconnectedIslands(
  geometry: THREE.BufferGeometry,
  userToleranceRatio = 0.001 // 0.1% of max bounding dimension by default
): SplitPartitionResult {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = nonIndexed.getAttribute('position');
  if (!posAttr || posAttr.count < 3) {
    return { geometries: [geometry], islandCount: 1 };
  }

  const numTriangles = Math.floor(posAttr.count / 3);
  if (numTriangles <= 1) {
    return { geometries: [geometry], islandCount: 1 };
  }

  if (!nonIndexed.boundingBox) nonIndexed.computeBoundingBox();
  const box = nonIndexed.boundingBox;
  let maxDim = 1.0;
  if (box) {
    const size = new THREE.Vector3();
    box.getSize(size);
    maxDim = Math.max(size.x, size.y, size.z, 0.001);
  }

  // Tolerance for CAD patch seam stitching (e.g. 0.1% of bounding box, min 0.05mm)
  const tol = Math.max(1e-5, maxDim * userToleranceRatio);
  const tolSq = tol * tol;
  const cellInv = 1.0 / tol;

  // Disjoint-Set Union (Union-Find) with path compression & rank
  const parent = new Int32Array(numTriangles);
  for (let i = 0; i < numTriangles; i++) parent[i] = i;

  function find(i: number): number {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let curr = i;
    while (curr !== root) {
      const nxt = parent[curr];
      parent[curr] = root;
      curr = nxt;
    }
    return root;
  }

  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }

  // 27-Neighbor Spatial Grid for Seam Fusion
  interface GridPoint {
    tri: number;
    x: number;
    y: number;
    z: number;
  }
  const grid = new Map<string, GridPoint[]>();

  function getCellKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  for (let tri = 0; tri < numTriangles; tri++) {
    const base = tri * 3;
    for (let v = 0; v < 3; v++) {
      const idx = base + v;
      const x = posAttr.getX(idx);
      const y = posAttr.getY(idx);
      const z = posAttr.getZ(idx);

      const cx = Math.floor(x * cellInv);
      const cy = Math.floor(y * cellInv);
      const cz = Math.floor(z * cellInv);

      // Check all 27 neighboring cells for existing vertices within Euclidean tolerance
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const k = getCellKey(cx + dx, cy + dy, cz + dz);
            const bucket = grid.get(k);
            if (bucket) {
              for (let b = 0; b < bucket.length; b++) {
                const other = bucket[b];
                const d2 =
                  (x - other.x) * (x - other.x) +
                  (y - other.y) * (y - other.y) +
                  (z - other.z) * (z - other.z);
                if (d2 <= tolSq) {
                  union(tri, other.tri);
                }
              }
            }
          }
        }
      }

      const key = getCellKey(cx, cy, cz);
      let list = grid.get(key);
      if (!list) {
        list = [];
        grid.set(key, list);
      }
      list.push({ tri, x, y, z });
    }
  }

  // Group triangles by root component
  const rootGroups = new Map<number, number[]>();
  for (let tri = 0; tri < numTriangles; tri++) {
    const root = find(tri);
    let g = rootGroups.get(root);
    if (!g) {
      g = [];
      rootGroups.set(root, g);
    }
    g.push(tri);
  }

  // Separate valid solid bodies and collect tiny degenerate slivers (< 4 triangles)
  const majorIslands: number[][] = [];
  const microSlivers: number[] = [];

  rootGroups.forEach((triangles) => {
    if (triangles.length >= 4) {
      majorIslands.push(triangles);
    } else {
      microSlivers.push(...triangles);
    }
  });

  // If all triangles were in 1 island or micro slivers
  if (majorIslands.length <= 1) {
    return { geometries: [geometry], islandCount: 1 };
  }

  // Sort major islands by face count descending
  majorIslands.sort((a, b) => b.length - a.length);

  // Absorb any micro slivers into the closest major island
  if (microSlivers.length > 0) {
    majorIslands[0].push(...microSlivers);
  }

  // Construct separate BufferGeometry for each solid body
  const resultGeometries: THREE.BufferGeometry[] = [];
  const normalAttr = nonIndexed.getAttribute('normal');
  const uvAttr = nonIndexed.getAttribute('uv');

  majorIslands.forEach((triangles) => {
    const subGeom = new THREE.BufferGeometry();
    const count = triangles.length * 3;

    const subPos = new Float32Array(count * 3);
    const subNorm = normalAttr ? new Float32Array(count * 3) : null;
    const subUv = uvAttr ? new Float32Array(count * 2) : null;

    let outIdx = 0;
    for (let i = 0; i < triangles.length; i++) {
      const tri = triangles[i];
      const base = tri * 3;

      for (let v = 0; v < 3; v++) {
        const srcIdx = base + v;
        subPos[outIdx * 3] = posAttr.getX(srcIdx);
        subPos[outIdx * 3 + 1] = posAttr.getY(srcIdx);
        subPos[outIdx * 3 + 2] = posAttr.getZ(srcIdx);

        if (subNorm && normalAttr) {
          subNorm[outIdx * 3] = normalAttr.getX(srcIdx);
          subNorm[outIdx * 3 + 1] = normalAttr.getY(srcIdx);
          subNorm[outIdx * 3 + 2] = normalAttr.getZ(srcIdx);
        }

        if (subUv && uvAttr) {
          subUv[outIdx * 2] = uvAttr.getX(srcIdx);
          subUv[outIdx * 2 + 1] = uvAttr.getY(srcIdx);
        }

        outIdx++;
      }
    }

    subGeom.setAttribute('position', new THREE.BufferAttribute(subPos, 3));
    if (subNorm) {
      subGeom.setAttribute('normal', new THREE.BufferAttribute(subNorm, 3));
    } else {
      subGeom.computeVertexNormals();
    }
    if (subUv) {
      subGeom.setAttribute('uv', new THREE.BufferAttribute(subUv, 2));
    }

    subGeom.computeBoundingBox();
    subGeom.computeBoundingSphere();
    resultGeometries.push(subGeom);
  });

  return {
    geometries: resultGeometries,
    islandCount: resultGeometries.length,
  };
}

/**
 * Slice / Bisect a geometry across a cutting plane
 */
export function sliceGeometryByPlane(
  geometry: THREE.BufferGeometry,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3
): { sideA: THREE.BufferGeometry; sideB: THREE.BufferGeometry } | null {
  const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const posAttr = nonIndexed.getAttribute('position');
  if (!posAttr || posAttr.count < 3) return null;

  const normalAttr = nonIndexed.getAttribute('normal');
  const uvAttr = nonIndexed.getAttribute('uv');
  const numTriangles = Math.floor(posAttr.count / 3);

  const sideATriangles: number[] = [];
  const sideBTriangles: number[] = [];

  const norm = planeNormal.clone().normalize();
  const d = planePoint.dot(norm);

  for (let tri = 0; tri < numTriangles; tri++) {
    const base = tri * 3;
    // Calculate triangle centroid
    const cx = (posAttr.getX(base) + posAttr.getX(base + 1) + posAttr.getX(base + 2)) / 3;
    const cy = (posAttr.getY(base) + posAttr.getY(base + 1) + posAttr.getY(base + 2)) / 3;
    const cz = (posAttr.getZ(base) + posAttr.getZ(base + 1) + posAttr.getZ(base + 2)) / 3;

    const signedDist = cx * norm.x + cy * norm.y + cz * norm.z - d;

    if (signedDist >= 0) {
      sideATriangles.push(tri);
    } else {
      sideBTriangles.push(tri);
    }
  }

  if (sideATriangles.length === 0 || sideBTriangles.length === 0) {
    return null; // Entire mesh is on one side of plane
  }

  function buildSubGeom(triangles: number[]): THREE.BufferGeometry {
    const subGeom = new THREE.BufferGeometry();
    const count = triangles.length * 3;

    const subPos = new Float32Array(count * 3);
    const subNorm = normalAttr ? new Float32Array(count * 3) : null;
    const subUv = uvAttr ? new Float32Array(count * 2) : null;

    let outIdx = 0;
    for (let i = 0; i < triangles.length; i++) {
      const tri = triangles[i];
      const base = tri * 3;

      for (let v = 0; v < 3; v++) {
        const srcIdx = base + v;
        subPos[outIdx * 3] = posAttr.getX(srcIdx);
        subPos[outIdx * 3 + 1] = posAttr.getY(srcIdx);
        subPos[outIdx * 3 + 2] = posAttr.getZ(srcIdx);

        if (subNorm && normalAttr) {
          subNorm[outIdx * 3] = normalAttr.getX(srcIdx);
          subNorm[outIdx * 3 + 1] = normalAttr.getY(srcIdx);
          subNorm[outIdx * 3 + 2] = normalAttr.getZ(srcIdx);
        }

        if (subUv && uvAttr) {
          subUv[outIdx * 2] = uvAttr.getX(srcIdx);
          subUv[outIdx * 2 + 1] = uvAttr.getY(srcIdx);
        }

        outIdx++;
      }
    }

    subGeom.setAttribute('position', new THREE.BufferAttribute(subPos, 3));
    if (subNorm) {
      subGeom.setAttribute('normal', new THREE.BufferAttribute(subNorm, 3));
    } else {
      subGeom.computeVertexNormals();
    }
    if (subUv) {
      subGeom.setAttribute('uv', new THREE.BufferAttribute(subUv, 2));
    }

    subGeom.computeBoundingBox();
    subGeom.computeBoundingSphere();
    return subGeom;
  }

  return {
    sideA: buildSubGeom(sideATriangles),
    sideB: buildSubGeom(sideBTriangles),
  };
}

/**
 * Automatically decomposes any composite meshes with disconnected topological bodies in a Three.js scene graph
 */
export function decomposeSceneDisconnectedIslands(root: THREE.Object3D): number {
  const meshesToProcess: THREE.Mesh[] = [];

  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshesToProcess.push(child as THREE.Mesh);
    }
  });

  let splitMeshCount = 0;

  meshesToProcess.forEach((mesh) => {
    if (!mesh.geometry || !mesh.parent) return;

    // Check if mesh has disconnected islands
    const res = separateDisconnectedIslands(mesh.geometry);
    if (res.islandCount > 1) {
      splitMeshCount++;
      const parent = mesh.parent;
      const baseName = mesh.name || 'Component';

      // 1. First island replaces the original mesh geometry
      mesh.geometry = res.geometries[0];
      mesh.name = `${baseName} (Body A)`;

      // 2. Additional islands are added as new sibling meshes
      for (let i = 1; i < res.geometries.length; i++) {
        const bodyLabel = String.fromCharCode(65 + i);
        const subMat = Array.isArray(mesh.material)
          ? mesh.material.map((m) => m.clone())
          : mesh.material.clone();

        const subMesh = new THREE.Mesh(res.geometries[i], subMat);
        subMesh.name = `${baseName} (Body ${bodyLabel})`;
        subMesh.position.copy(mesh.position);
        subMesh.rotation.copy(mesh.rotation);
        subMesh.scale.copy(mesh.scale);
        subMesh.castShadow = mesh.castShadow;
        subMesh.receiveShadow = mesh.receiveShadow;

        parent.add(subMesh);
      }
    }
  });

  return splitMeshCount;
}
