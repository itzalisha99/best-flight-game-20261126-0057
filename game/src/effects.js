// SKYHAWK effects: crash smoke, ring-burst sparks and the fuel-can pickups.
// All particles are plain three.js points driven in code — no textures, no files.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.fuelCans = [];
    this.canGroup = new THREE.Group();
    scene.add(this.canGroup);
  }

  // A short-lived spray of coloured points at `pos`.
  burst(pos, color, count = 90, speed = 26, life = 1.1) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      vels.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 6, Math.sin(a) * Math.cos(b) * s));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color, size: 2.2, transparent: true, opacity: 1, depthWrite: false }),
    );
    this.scene.add(points);
    this.bursts.push({ points, vels, life, age: 0 });
  }

  crash(pos) {
    this.burst(pos, 0xff7722, 130, 30, 1.4);
    this.burst(pos, 0x555555, 90, 14, 2.2);
    this.burst(pos, 0xffcc44, 60, 20, 0.9);
  }

  ringPass(pos) {
    this.burst(pos, 0x55ff88, 70, 22, 0.9);
    this.burst(pos, 0xffffff, 30, 12, 0.6);
  }

  fuelPickup(pos) {
    this.burst(pos, 0xffcc33, 50, 16, 0.8);
  }

  // Floating fuel cans for the Courier mission.
  setFuelCans(points) {
    for (const can of this.fuelCans) this.canGroup.remove(can.mesh);
    this.fuelCans = [];
    for (const p of points) {
      const mesh = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.2, 4.5, 10),
        new THREE.MeshStandardMaterial({ color: 0xffb400, emissive: 0x8a5c00, emissiveIntensity: 0.8, roughness: 0.4 }),
      );
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x333333 }),
      );
      cap.position.y = 2.8;
      mesh.add(body);
      mesh.add(cap);
      mesh.position.set(p.x, p.y, p.z);
      this.canGroup.add(mesh);
      this.fuelCans.push({ mesh, pos: new THREE.Vector3(p.x, p.y, p.z), taken: false });
    }
  }

  checkFuelPickup(position) {
    for (const can of this.fuelCans) {
      if (can.taken) continue;
      if (position.distanceTo(can.pos) < 7) {
        can.taken = true;
        this.canGroup.remove(can.mesh);
        this.fuelPickup(can.pos);
        return CONFIG.fuelCanBonus;
      }
    }
    return 0;
  }

  update(dt, time) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      const pos = b.points.geometry.attributes.position;
      for (let j = 0; j < b.vels.length; j++) {
        pos.array[j * 3] += b.vels[j].x * dt;
        pos.array[j * 3 + 1] += b.vels[j].y * dt;
        pos.array[j * 3 + 2] += b.vels[j].z * dt;
        b.vels[j].y -= 22 * dt; // gravity pulls the sparks down
      }
      pos.needsUpdate = true;
      b.points.material.opacity = Math.max(0, 1 - b.age / b.life);
      if (b.age >= b.life) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
    // fuel cans bob and spin so they catch the eye
    for (const can of this.fuelCans) {
      if (can.taken) continue;
      can.mesh.rotation.y += dt * 1.5;
      can.mesh.position.y = can.pos.y + Math.sin(time * 2 + can.pos.x) * 1.5;
    }
  }
}
