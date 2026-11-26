// SKYHAWK — Island Courier: boot, the frame loop, the chase camera, the
// screens (title / mission select / pause / complete / crash) and the photo
// hooks the screenshots use. This file wires the modules together; the flying,
// the world and the instruments each live in their own file.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Input } from './input.js';
import { FlightModel } from './flight.js';
import { terrainHeightAt, buildTerrain } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { Rings } from './rings.js';
import { Missions, MISSION_STATE } from './missions.js';
import { Effects } from './effects.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const SCREEN = {
  TITLE: 'title',
  FLYING: 'flying',
  PAUSED: 'paused',
  DONE: 'done',
  CRASHED: 'crashed',
};

export class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.getElementById('scene').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xc4d9e8, 500, 1900);
    this.camera = new THREE.PerspectiveCamera(CONFIG.fovBase, window.innerWidth / window.innerHeight, 0.1, 5000);
    this.camera.position.set(-260, 40, 330);

    // light: a warm sun from the east, plus a soft sky fill
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(800, 600, -400);
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x4a6b3a, 1.1));

    this.terrain = buildTerrain(this.scene);
    this.aircraft = buildAircraft();
    this.scene.add(this.aircraft.group);
    this.rings = new Rings(this.scene);
    this.effects = new Effects(this.scene);
    this.flight = new FlightModel(terrainHeightAt);
    this.missions = new Missions(this.flight, this.rings, this.effects);
    this.hud = new Hud();
    this.audio = new AudioEngine();
    this.input = new Input(this.renderer.domElement);

    this.screen = SCREEN.TITLE;
    this.cockpit = false;
    this.time = 0;
    this.camPos = new THREE.Vector3(-260, 40, 330);
    this.camLook = new THREE.Vector3(0, 10, 0);
    this.photoMode = false;
    this._lastFrame = performance.now();
    this._shake = 0;

    window.addEventListener('resize', () => this.onResize());
    this.bindScreens();
    this.showTitle();
    this.loop();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  bindScreens() {
    document.getElementById('btn-start').addEventListener('click', () => this.startMission(0));
    document.querySelectorAll('.mission-card').forEach((card) => {
      card.addEventListener('click', () => this.startMission(Number(card.dataset.mission)));
    });
    document.getElementById('btn-resume').addEventListener('click', () => this.resume());
    document.getElementById('btn-quit').addEventListener('click', () => this.showTitle());
    document.getElementById('btn-again').addEventListener('click', () => this.startMission(this.missions.index));
    document.getElementById('btn-menu').addEventListener('click', () => this.showTitle());
    document.getElementById('btn-retry').addEventListener('click', () => this.startMission(this.missions.index));
    document.getElementById('btn-crash-menu').addEventListener('click', () => this.showTitle());
  }

  showScreen(id) {
    for (const el of document.querySelectorAll('.screen')) el.classList.remove('visible');
    if (id) document.getElementById(id).classList.add('visible');
    document.getElementById('hud').classList.toggle('visible', this.screen === SCREEN.FLYING || this.screen === SCREEN.PAUSED);
  }

  showTitle() {
    this.screen = SCREEN.TITLE;
    this.missions.state = MISSION_STATE.IDLE;
    this.flight.reset();
    this.rings.clear();
    this.effects.setFuelCans([]);
    // park the camera in a slow orbit over the island for the title backdrop
    this.camPos.set(-260, 90, 420);
    this.showScreen('screen-title');
  }

  startMission(index) {
    this.audio.start();
    this.missions.start(index);
    this.screen = SCREEN.FLYING;
    this.showScreen(null);
    this.camPos.copy(this.flight.position).add(new THREE.Vector3(0, 6, 16));
  }

  resume() {
    this.screen = SCREEN.FLYING;
    this.showScreen(null);
  }

  pause() {
    this.screen = SCREEN.PAUSED;
    this.showScreen('screen-pause');
  }

  endMissionDone() {
    this.screen = SCREEN.DONE;
    document.getElementById('end-title').textContent =
      this.missions.state === MISSION_STATE.TIME_UP ? 'TIME UP' : 'MISSION COMPLETE';
    document.getElementById('end-score').textContent = `Score ${this.missions.score}  •  ${this.missions.name}  •  ${Hud.formatTime(this.missions.elapsed)}`;
    this.showScreen('screen-end');
  }

  endMissionCrashed() {
    this.screen = SCREEN.CRASHED;
    document.getElementById('crash-title').textContent = 'CRASHED';
    document.getElementById('crash-score').textContent = `Score ${this.missions.score}  •  ${this.missions.name}`;
    this.showScreen('screen-crash');
  }

  // --- per-frame input: keys, mouse drag, screen shortcuts ---
  readControls() {
    const mouse = this.input.takeMouseSteer();
    let pitch = 0;
    let roll = 0;
    if (this.input.action('pitchUp')) pitch += 1;
    if (this.input.action('pitchDown')) pitch -= 1;
    if (this.input.action('rollLeft')) roll -= 1;
    if (this.input.action('rollRight')) roll += 1;
    pitch += -mouse.dy;
    roll += mouse.dx;
    let rudder = 0;
    if (this.input.action('rudderLeft')) rudder -= 1;
    if (this.input.action('rudderRight')) rudder += 1;
    return {
      pitch: clamp(pitch, -1, 1),
      roll: clamp(roll, -1, 1),
      rudder: clamp(rudder, -1, 1),
      throttleUp: this.input.action('throttleUp'),
      throttleDown: this.input.action('throttleDown'),
    };
  }

  handleKeys() {
    if (this.input.wasPressed('KeyP') && this.screen === SCREEN.FLYING) this.pause();
    else if (this.input.wasPressed('KeyP') && this.screen === SCREEN.PAUSED) this.resume();
    if (this.input.wasPressed('KeyC') && this.screen === SCREEN.FLYING) this.cockpit = !this.cockpit;
    if (this.input.wasPressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.missions.say(muted ? 'Sound off' : 'Sound on', 1.5);
    }
    if (this.input.wasPressed('KeyR') && (this.screen === SCREEN.FLYING || this.screen === SCREEN.CRASHED || this.screen === SCREEN.DONE)) {
      this.startMission(this.missions.index);
    }
    if (this.input.wasPressed('Enter') && this.screen === SCREEN.TITLE) this.startMission(0);
    if (this.screen === SCREEN.TITLE) {
      if (this.input.wasPressed('Digit1')) this.startMission(0);
      if (this.input.wasPressed('Digit2')) this.startMission(1);
      if (this.input.wasPressed('Digit3')) this.startMission(2);
    }
    if (this.input.wasPressed('Enter') && (this.screen === SCREEN.CRASHED || this.screen === SCREEN.DONE)) {
      this.startMission(this.missions.index);
    }
  }

  // --- the chase camera: hangs behind the plane, never fights the pilot ---
  updateCamera(dt) {
    const f = this.flight;
    const forward = new THREE.Vector3(
      -Math.sin(f.heading) * Math.cos(f.pitch),
      Math.sin(f.pitch),
      -Math.cos(f.heading) * Math.cos(f.pitch),
    );
    const up = new THREE.Vector3(0, 1, 0);
    if (this.cockpit) {
      // Nose cam: ahead of the prop (which sits ~4.4 m ahead of centre at
      // the plane's 1.25x scale) and above the nose, so the blades never
      // sweep across the lens.
      const eye = f.position.clone().addScaledVector(forward, 6.5).addScaledVector(up, 1.6);
      this.camPos.lerp(eye, 1 - Math.exp(-30 * dt));
      this.camLook.lerp(f.position.clone().addScaledVector(forward, 60), 1 - Math.exp(-30 * dt));
    } else {
      const want = f.position.clone().addScaledVector(forward, -CONFIG.chaseDistance).addScaledVector(up, CONFIG.chaseHeight);
      // keep the camera out of the hills
      const ground = terrainHeightAt(want.x, want.z);
      want.y = Math.max(want.y, ground + 3);
      this.camPos.lerp(want, 1 - Math.exp(-CONFIG.chaseStiffness * dt));
      this.camLook.lerp(f.position.clone().addScaledVector(forward, 22), 1 - Math.exp(-10 * dt));
    }
    // crash shake
    if (this._shake > 0) {
      this._shake = Math.max(0, this._shake - dt * 1.4);
      this.camPos.x += (Math.random() - 0.5) * this._shake * 2;
      this.camPos.y += (Math.random() - 0.5) * this._shake * 2;
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    const targetFov = CONFIG.fovBase + (f.speed / CONFIG.maxSpeed) * CONFIG.fovKick;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();
  }

  loop() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this._lastFrame) / 1000);
    this._lastFrame = now;
    this.time += dt;

    this.handleKeys();

    if (this.screen === SCREEN.TITLE) {
      // slow title orbit: the island sells itself while you choose
      const a = this.time * 0.03;
      this.camPos.set(Math.cos(a) * 520, 130 + Math.sin(this.time * 0.1) * 12, Math.sin(a) * 520);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(0, 30, 0);
      this.terrain.update(dt, this.time);
      this.aircraft.prop.rotation.z += dt * 8;
    } else if (this.screen === SCREEN.FLYING) {
      const ctl = this.readControls();
      const events = this.flight.step(dt, ctl);
      this.missions.step(dt);
      if (events.crashed) {
        this.effects.crash(this.flight.position);
        this.audio.thud();
        this._shake = 3;
        this.missions.onCrash();
        this.endMissionCrashed();
      } else if (events.landed) {
        this.missions.say('Touchdown! Nice and gentle.', 3);
        this.audio.chime();
      }
      if (this.missions.state === MISSION_STATE.DONE) this.endMissionDone();
      if (this.missions.state === MISSION_STATE.TIME_UP && this.screen === SCREEN.FLYING) {
        this.endMissionDone();
      }
      this.updateCamera(dt);
      this.rings.update(dt, this.time);
      this.effects.update(dt, this.time);
      this.terrain.update(dt, this.time);
      this.aircraft.update(this.flight, dt);
      this.hud.update(this.flight, this.missions, dt);
      this.audio.update(this.flight.throttle, this.flight.speed, true);
      // a ring pass chimes once
      if (this._lastRingCount === undefined) this._lastRingCount = 0;
      if (this.rings.passedCount > this._lastRingCount) this.audio.chime();
      this._lastRingCount = this.rings.passedCount;
    } else {
      // paused / end screens: the world holds still, the prop idles
      this.aircraft.prop.rotation.z += dt * 2;
      this.terrain.update(dt, this.time);
    }

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
    requestAnimationFrame(() => this.loop());
  }

  // --- photo hooks: the screenshots are real renders of this same game ---
  // shot(name) poses the plane and the camera, then the caller waits for
  // window.__skyhawkReady and screenshots the canvas.
  shot(name) {
    this.audio.start();
    this.photoMode = true;
    const r = CONFIG.runway;
    if (name === 'cover') {
      this.startMission(0);
      // Fly down the runway approach: the strip dead ahead, a ring to thread,
      // the island filling the frame. The course is built from the plane's
      // own path: rings 0–2 sit behind where the plane ends up (it threads
      // them during the settle, so the HUD honestly reads 3/8), ring 3 waits
      // ~90 m ahead of the nose, the rest stretch on toward the strip.
      const planePos = new THREE.Vector3(120, 145, 430);
      const heading = 1.21; // toward the runway at (-260, 300)
      const fwd = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
      const course = [];
      const along = [30, 80, 130, 250, 400, 550, 700, 850];
      for (let i = 0; i < 8; i++) {
        const p = planePos.clone().addScaledVector(fwd, along[i]);
        p.x += Math.sin(i * 1.3) * 30;
        p.y = 145 + Math.sin(i * 1.7) * 5; // level with the plane: it threads them
        course.push({ x: p.x, y: p.y, z: p.z });
      }
      this.rings.setCourse(course);
      this.flight.place(planePos.x, planePos.y, planePos.z, heading, 62);
      this.flight.throttle = 0.72;
      this.missions.elapsed = 42.5;
      this.missions.score = 0; // the settle's three ring passes make it 300
      this.missions.say('Ring 4 of 8 — nice flying!', 30);
    } else if (name === 'landing') {
      this.startMission(1);
      // On the approach line, 200 m short of the threshold, nose down the strip.
      const stripDir = new THREE.Vector3(Math.cos(r.heading), 0, Math.sin(r.heading));
      const start = new THREE.Vector3(r.x, 45, r.z).addScaledVector(stripDir, -200);
      const runwayHeading = Math.atan2(-Math.cos(r.heading), -Math.sin(r.heading));
      this.flight.place(start.x, start.y, start.z, runwayHeading, 46);
      this.flight.throttle = 0.35;
      this.flight.pitch = -0.08;
      this.missions.elapsed = 88;
      this.missions.score = 150;
      this.missions.say('Final approach — keep it gentle.', 30);
    } else if (name === 'ring') {
      this.startMission(0);
      // Ring 1, approached from outside the island so the island is the
      // backdrop; 320 m out at 68 m/s the settle leaves the plane ~140 m short.
      const ring = this.rings.list[1];
      const outward = new THREE.Vector3(ring.pos.x, 0, ring.pos.z).normalize();
      const start = new THREE.Vector3(ring.pos.x, ring.pos.y, ring.pos.z).addScaledVector(outward, 320);
      const toRing = new THREE.Vector3().subVectors(ring.pos, start).normalize();
      const heading = Math.atan2(-toRing.x, -toRing.z);
      this.flight.place(start.x, start.y, start.z, heading, 68);
      this.flight.throttle = 0.8;
      this.missions.elapsed = 18;
      this.missions.score = 100;
      this.missions.say('Ring 2 of 8 — thread it!', 30);
      this.rings.nextIndex = 1;
      this.rings.list.forEach((rg, i) => {
        rg.passed = i < 1;
        if (i < 1) {
          rg.mesh.material.color.set(0x2fae5f);
          rg.mesh.material.emissive.set(0x1d7a3d);
        }
      });
    } else if (name === 'courier') {
      this.startMission(2);
      // Chase the first fuel can: it spins yellow ahead, a ring beyond it,
      // the island and the strip below.
      const can = this.effects.fuelCans[0];
      const toCan = new THREE.Vector3().subVectors(can.pos, new THREE.Vector3(-420, 150, -80)).normalize();
      const start = new THREE.Vector3(can.pos.x, can.pos.y, can.pos.z).addScaledVector(toCan, -200);
      const heading = Math.atan2(-toCan.x, -toCan.z);
      this.flight.place(start.x, start.y, start.z, heading, 60);
      this.flight.throttle = 0.7;
      this.missions.elapsed = 65;
      this.missions.score = 250;
      this.missions.say('Fuel can ahead — grab it!', 30);
    }
    // Advance the sim 2.5s in one tight loop (no per-tick render: software
    // GL is slow), then render once. The caller waits on __skyhawkReady.
    window.__skyhawkReady = false;
    const ctl = { pitch: 0, roll: 0, rudder: 0, throttleUp: false, throttleDown: false };
    for (let tick = 0; tick < 150; tick++) {
      this.flight.step(1 / 60, ctl);
      this.missions.step(1 / 60);
      this.updateCamera(1 / 60);
      this.rings.update(1 / 60, this.time);
      this.effects.update(1 / 60, this.time);
      this.terrain.update(1 / 60, this.time);
      this.aircraft.update(this.flight, 1 / 60);
      this.hud.update(this.flight, this.missions, 1 / 60);
    }
    this.renderer.render(this.scene, this.camera);
    window.__skyhawkReady = true;
  }
}

window.__skyhawk = new Game();
window.__skyhawkGame = window.__skyhawk;
