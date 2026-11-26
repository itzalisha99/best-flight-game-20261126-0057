// SKYHAWK terrain: one tropical island, built from a seeded heightfield so the
// ground the plane flies over and the ground it can crash into are the same math.
// Island: green hills, sandy beach ring, blue sea, a flat runway shelf, palms,
// drifting clouds and a gradient sky dome. Everything is low-poly flat-shaded.

import * as THREE from 'three';
import { CONFIG } from './config.js';

// --- a small deterministic value-noise field (no library, same on every run) ---
function hash2(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) {
  return t * t * (3 - 2 * t);
}
function valueNoise(x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const a = hash2(xi, zi);
  const b = hash2(xi + 1, zi);
  const c = hash2(xi, zi + 1);
  const d = hash2(xi + 1, zi + 1);
  const u = smooth(xf);
  const v = smooth(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) {
  return (
    valueNoise(x, z) * 0.55 +
    valueNoise(x * 2.1 + 7.3, z * 2.1 + 3.1) * 0.28 +
    valueNoise(x * 4.3 + 13.7, z * 4.3 + 9.2) * 0.17
  );
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Height of the island at world (x, z). Sea is 0; the beach ring is ~1; hills rise inland.
export function terrainHeightAt(x, z) {
  const r = CONFIG.runway;
  const dist = Math.hypot(x, z);
  const falloff = clamp01(1 - (dist - CONFIG.islandRadius * 0.55) / (CONFIG.islandRadius * 0.45));
  const hills = fbm(x * 0.004 + 3.7, z * 0.004 + 8.2);
  let h = Math.pow(hills, 1.6) * 95 * falloff;
  if (dist > CONFIG.islandRadius) h = 0; // open sea
  else if (dist > CONFIG.islandRadius * 0.93) h = Math.min(h, 1.2); // sand ring
  // Flatten a shelf for the runway so landings are fair.
  const dx = x - r.x;
  const dz = z - r.z;
  const c = Math.cos(-r.heading);
  const s = Math.sin(-r.heading);
  const along = dx * c - dz * s;
  const across = dx * s + dz * c;
  if (Math.abs(along) < r.length / 2 + 40 && Math.abs(across) < r.width / 2 + 40) {
    const edge = Math.max(Math.abs(along) / (r.length / 2 + 40), Math.abs(across) / (r.width / 2 + 40));
    const blend = smooth(clamp01((edge - 0.55) / 0.45));
    h = h * blend + 2.0 * (1 - blend);
  }
  return h;
}

function heightColor(h, dist) {
  // sand, grass, deep green, rock — one flat style for the whole island
  if (h < 1.6) return [0.93, 0.83, 0.58];
  if (h < 14) return [0.42, 0.66, 0.32];
  if (h < 42) return [0.24, 0.52, 0.26];
  if (h < 70) return [0.35, 0.38, 0.30];
  return [0.55, 0.52, 0.48];
}

export function buildTerrain(scene) {
  const group = new THREE.Group();

  // --- island ground: a displaced plane with vertex colours ---
  const size = CONFIG.terrainSize;
  const seg = CONFIG.terrainSegments;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = terrainHeightAt(x, z);
    pos.setY(i, h);
    const [r, g, b] = heightColor(h, Math.hypot(x, z));
    const shade = 0.92 + fbm(x * 0.02, z * 0.02) * 0.16;
    colors[i * 3] = r * shade;
    colors[i * 3 + 1] = g * shade;
    colors[i * 3 + 2] = b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }),
  );
  group.add(ground);

  // --- sea: a big translucent plane just under the beach ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 2.4, size * 2.4),
    new THREE.MeshStandardMaterial({ color: 0x1e6f9e, transparent: true, opacity: 0.88, roughness: 0.25, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0.4;
  group.add(sea);

  // --- runway: dark strip + white centre dashes + threshold bars ---
  const r = CONFIG.runway;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(r.length, r.width),
    new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.rotation.z = -r.heading;
  strip.position.set(r.x, 2.15, r.z);
  group.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f5e8 });
  for (let d = -r.length / 2 + 18; d < r.length / 2 - 10; d += 26) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(12, 1.4), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = -r.heading;
    const c = Math.cos(r.heading);
    const s = Math.sin(r.heading);
    dash.position.set(r.x + d * c, 2.2, r.z + d * s);
    group.add(dash);
  }

  // --- palms: instanced trunks + canopies, scattered on the grass, never on the strip ---
  const palmSpots = [];
  let guard = 0;
  while (palmSpots.length < 130 && guard++ < 4000) {
    const a = hash2(guard, 5.5) * Math.PI * 2;
    const d = 120 + hash2(guard, 9.1) * (CONFIG.islandRadius - 150);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const h = terrainHeightAt(x, z);
    if (h < 3 || h > 46) continue;
    const dx = x - r.x;
    const dz = z - r.z;
    if (Math.abs(dx) < r.length / 2 + 30 && Math.abs(dz) < r.width / 2 + 30) continue;
    palmSpots.push({ x, z, h, s: 0.8 + hash2(guard, 2.2) * 0.7, lean: (hash2(guard, 4.4) - 0.5) * 0.25 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 5);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1, flatShading: true });
  const canopyGeo = new THREE.ConeGeometry(3.2, 4.5, 6);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f7d3a, roughness: 1, flatShading: true });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, palmSpots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  palmSpots.forEach((p, i) => {
    e.set(p.lean, hash2(i, 1.1) * Math.PI * 2, 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(p.x, p.h + 3.2 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    trunks.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(p.x, p.h + 7.6 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    canopies.setMatrixAt(i, m);
  });
  group.add(trunks);
  group.add(canopies);

  // --- clouds: flat-shaded puffs drifting slowly ---
  const cloudGeo = new THREE.SphereGeometry(1, 7, 5);
  cloudGeo.scale(1.8, 0.55, 1.2);
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
  const clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, 20);
  const cloudData = [];
  for (let i = 0; i < 20; i++) {
    const a = hash2(i, 7.7) * Math.PI * 2;
    const d = 150 + hash2(i, 3.3) * 900;
    // small and high: rings fly at 85–175 m, clouds sit above them
    cloudData.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 210 + hash2(i, 6.6) * 110, s: 8 + hash2(i, 8.8) * 9, drift: 1.5 + hash2(i, 2.9) * 2.5 });
  }
  clouds.userData.cloudData = cloudData;
  group.add(clouds);

  // --- sky dome: a gradient sphere so the horizon never looks empty ---
  const skyGeo = new THREE.SphereGeometry(2400, 24, 12);
  const skyColors = new Float32Array(skyGeo.attributes.position.count * 3);
  const top = [0.36, 0.62, 0.92];
  const horizon = [0.82, 0.9, 0.96];
  for (let i = 0; i < skyGeo.attributes.position.count; i++) {
    const y = skyGeo.attributes.position.getY(i) / 2400;
    const t = clamp01(y * 1.4 + 0.25);
    skyColors[i * 3] = horizon[0] + (top[0] - horizon[0]) * t;
    skyColors[i * 3 + 1] = horizon[1] + (top[1] - horizon[1]) * t;
    skyColors[i * 3 + 2] = horizon[2] + (top[2] - horizon[2]) * t;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);

  // --- sun: a warm disc low in the east ---
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(55, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sun.position.set(1500, 420, -900);
  sun.lookAt(0, 0, 0);
  group.add(sun);

  scene.add(group);
  return {
    group,
    clouds,
    update(dt, time) {
      // clouds drift with the wind
      const data = clouds.userData.cloudData;
      for (let i = 0; i < data.length; i++) {
        const c = data[i];
        c.x += c.drift * dt;
        if (c.x > 1300) c.x = -1300;
        e.set(0, 0, 0);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(c.x, c.y, c.z), q, new THREE.Vector3(c.s, c.s, c.s));
        clouds.setMatrixAt(i, m);
      }
      clouds.instanceMatrix.needsUpdate = true;
    },
  };
}
