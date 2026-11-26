// SKYHAWK rings: glowing checkpoint hoops. The next ring pulses amber and
// wears a floating arrow; passed rings turn green; later rings stay dim blue.
// Flying through the next ring's centre is the whole game of Ring Run and Courier.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Rings {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.nextIndex = 0;
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  clear() {
    for (const ring of this.list) {
      this.group.remove(ring.mesh);
      this.group.remove(ring.glow);
      ring.mesh.geometry.dispose();
      ring.mesh.material.dispose();
      ring.glow.material.dispose();
    }
    this.list = [];
    this.nextIndex = 0;
  }

  // Lay a course: `points` is an array of {x, y, z}. Ring i faces ring i+1.
  setCourse(points) {
    this.clear();
    points.forEach((p, i) => {
      const next = points[(i + 1) % points.length];
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(CONFIG.ringRadius, CONFIG.ringTube, 10, 28),
        new THREE.MeshStandardMaterial({
          color: 0x2b6cb0,
          emissive: 0x1a4a7a,
          emissiveIntensity: 0.7,
          roughness: 0.4,
          metalness: 0.2,
        }),
      );
      mesh.position.set(p.x, p.y, p.z);
      mesh.lookAt(next.x, next.y, next.z);
      // a soft halo sprite so the ring reads from far away
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          color: 0x66aaff,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
        }),
      );
      glow.scale.set(30, 30, 1);
      glow.position.copy(mesh.position);
      this.group.add(mesh);
      this.group.add(glow);
      this.list.push({ mesh, glow, pos: new THREE.Vector3(p.x, p.y, p.z), passed: false });
    });
  }

  // Returns the ring just passed, or null.
  checkPass(position) {
    const ring = this.list[this.nextIndex];
    if (!ring || ring.passed) return null;
    if (position.distanceTo(ring.pos) < CONFIG.ringRadius - 1.5) {
      ring.passed = true;
      ring.mesh.material.color.set(0x2fae5f);
      ring.mesh.material.emissive.set(0x1d7a3d);
      ring.glow.material.color.set(0x55ff88);
      this.nextIndex++;
      return ring;
    }
    return null;
  }

  get next() {
    return this.list[this.nextIndex] || null;
  }

  get done() {
    return this.nextIndex >= this.list.length;
  }

  get passedCount() {
    return this.nextIndex;
  }

  update(dt, time) {
    // the next ring breathes; the rest sit still
    this.list.forEach((ring, i) => {
      if (i === this.nextIndex) {
        const pulse = 1 + Math.sin(time * 5) * 0.12;
        ring.mesh.scale.set(pulse, pulse, pulse);
        ring.mesh.material.color.set(0xff8c1a);
        ring.mesh.material.emissive.set(0xcc5a00);
        ring.mesh.material.emissiveIntensity = 1.1 + Math.sin(time * 5) * 0.4;
        ring.glow.material.color.set(0xffaa33);
        ring.glow.material.opacity = 0.2 + Math.sin(time * 5) * 0.05;
      } else if (!ring.passed) {
        ring.mesh.scale.set(1, 1, 1);
      }
    });
  }
}

// A ring course around the island: up the beach, over the hills, back to the strip.
export function islandRingCourse(count, altitude = 110) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.35;
    const radius = 300 + (i % 2) * 140;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const y = altitude + Math.sin(i * 1.7) * 45;
    pts.push({ x, y, z });
  }
  return pts;
}
