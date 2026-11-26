// SKYHAWK flight model: an arcade plane with real habits — it stalls when slow,
// turns by banking, and sinks when the wing quits. Pure math, no rendering here.

import * as THREE from 'three';
import { CONFIG } from './config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

export class FlightModel {
  constructor(terrainHeightAt) {
    this.terrainHeightAt = terrainHeightAt;
    this.reset();
  }

  reset() {
    const r = CONFIG.runway;
    this.position = new THREE.Vector3(r.x, 2.2, r.z);
    // Nose down the strip: forward (-sin h, -cos h) must equal the strip's
    // direction (cos r.heading, sin r.heading).
    this.heading = Math.atan2(-Math.cos(r.heading), -Math.sin(r.heading));
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.verticalSpeed = 0;
    this.onGround = true;
    this.fuel = CONFIG.fuelMax;
    this.engineOut = false;
    this.crashed = false;
    this.landed = false;
    this.stalled = false;
    this.windGust = 0;
    this.time = 0;
  }

  // Put the plane in the air at a chosen spot (used by missions and photo shots).
  place(x, y, z, heading, speed) {
    this.position.set(x, y, z);
    this.heading = heading;
    this.pitch = 0;
    this.roll = 0;
    this.speed = speed;
    this.throttle = 0.65;
    this.onGround = false;
    this.crashed = false;
    this.landed = false;
  }

  // One step of flight. `ctl` is { pitch, roll, rudder, throttleUp, throttleDown }
  // with pitch/roll in -1..1. Returns events: { stalled, crashed, landed }.
  step(dt, ctl) {
    this.time += dt;
    const events = { stalled: false, crashed: false, landed: false };
    if (this.crashed) return events;

    // --- throttle ---
    if (ctl.throttleUp) this.throttle = clamp(this.throttle + dt * 0.55, 0, 1);
    if (ctl.throttleDown) this.throttle = clamp(this.throttle - dt * 0.7, 0, 1);
    if (this.fuel <= 0) {
      this.throttle = 0;
      this.engineOut = true;
    }

    // --- speed chases the throttle, with drag ---
    const target = this.throttle * CONFIG.maxSpeed;
    this.speed = lerp(this.speed, target, 1 - Math.exp(-CONFIG.accelRate * dt));
    if (this.onGround) this.speed = Math.min(this.speed, 48); // rolling resistance

    // --- control authority fades as speed falls ---
    const authority = clamp((this.speed - 8) / (CONFIG.cruiseSpeed - 8), 0.15, 1);

    // --- pitch and roll ---
    const pitchRate = ctl.pitch * CONFIG.pitchRate * authority;
    const rollRate = ctl.roll * CONFIG.rollRate * authority;
    this.pitch = clamp(this.pitch + pitchRate * dt, -0.6, 0.6);
    this.roll = clamp(this.roll + rollRate * dt, -CONFIG.maxBank, CONFIG.maxBank);
    // The wing levels itself gently when the stick is centred.
    if (Math.abs(ctl.roll) < 0.05) this.roll = lerp(this.roll, 0, 1 - Math.exp(-0.9 * dt));
    if (Math.abs(ctl.pitch) < 0.05 && !this.onGround) this.pitch = lerp(this.pitch, 0, 1 - Math.exp(-0.5 * dt));

    // --- heading: a banked turn, plus rudder ---
    const turnRate = -Math.tan(this.roll) * CONFIG.turnAuthority / Math.max(this.speed, 12);
    this.heading += (turnRate + ctl.rudder * CONFIG.rudderRate * authority) * dt;

    // --- wind gusts nudge the nose a little, but they wobble fast enough to
    // average to nothing: the plane holds its heading when the stick is centred.
    this.windGust = Math.sin(this.time * 1.3) * 0.008 + Math.sin(this.time * 0.53 + 2.0) * 0.006;
    this.heading += this.windGust * dt * (this.position.y / 220 + 0.2);

    // --- lift, sink, stall ---
    this.stalled = this.speed < CONFIG.stallSpeed && !this.onGround;
    if (this.stalled) events.stalled = true;
    const climb = Math.sin(this.pitch) * this.speed;
    const sink = this.stalled ? (CONFIG.stallSpeed - this.speed) * CONFIG.dragSink : 0;
    this.verticalSpeed = climb - sink;

    // --- lift-off: enough speed and a pull on the stick and the wheels leave the strip ---
    if (this.onGround && this.speed > CONFIG.stallSpeed && this.pitch > 0.06) {
      this.liftOff();
    }

    // --- move ---
    const forward = new THREE.Vector3(
      -Math.sin(this.heading) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.heading) * Math.cos(this.pitch),
    );
    this.position.addScaledVector(forward, this.speed * dt);
    // Climb rides on the forward vector's Y; verticalSpeed is only for the HUD
    // and the landing checks, so it is never added again here.
    this.position.y = Math.max(this.position.y, 0.4);

    // --- ground ---
    const ground = this.terrainHeightAt(this.position.x, this.position.z);
    if (this.position.y <= ground + 1.2) {
      this.position.y = ground + 1.2;
      if (!this.onGround) {
        const landing = this.tryLanding(ground);
        if (landing === 'landed') {
          events.landed = true;
        } else if (landing === 'crash') {
          this.crashed = true;
          events.crashed = true;
        }
      }
      if (this.onGround) {
        // rolling along the ground: scrub speed, stay level
        this.speed = lerp(this.speed, 0, 1 - Math.exp(-0.6 * dt));
        this.pitch = lerp(this.pitch, 0, 1 - Math.exp(-4 * dt));
        this.roll = lerp(this.roll, 0, 1 - Math.exp(-4 * dt));
        if (this.speed < 0.5) this.speed = 0;
      }
    }
    return events;
  }

  // Called the moment the wheels touch. Returns 'landed', 'crash' or 'bounce'.
  tryLanding(ground) {
    const r = CONFIG.runway;
    const onStrip = this.onRunway();
    const gentle = Math.abs(this.verticalSpeed) < CONFIG.hardLandingVs;
    const slow = this.speed < CONFIG.safeLandingSpeed;
    const level = Math.abs(this.roll) < CONFIG.safeLandingRoll && Math.abs(this.pitch) < CONFIG.safeLandingPitch;
    if (onStrip && gentle && slow && level) {
      this.onGround = true;
      this.landed = true;
      this.fuel = CONFIG.fuelMax; // the strip crew refuels you
      this.engineOut = false;
      return 'landed';
    }
    // Off the strip, a gentle slow touch is a bounce, not a fireball: the
    // pilot skips back into the air and can try again. Only a fast hit or a
    // hard slam is a crash.
    if (this.speed > 40 || !gentle) return 'crash';
    this.position.y = ground + 3.5; // a soft touch on rough ground: skip back into the air
    return 'bounce';
  }

  // Is the plane over the runway rectangle (a little margin allowed)?
  onRunway() {
    const r = CONFIG.runway;
    const dx = this.position.x - r.x;
    const dz = this.position.z - r.z;
    const c = Math.cos(-r.heading);
    const s = Math.sin(-r.heading);
    const along = dx * c - dz * s;
    const across = dx * s + dz * c;
    return Math.abs(along) < r.length / 2 + 6 && Math.abs(across) < r.width / 2 + 6;
  }

  liftOff() {
    this.onGround = false;
    this.landed = false;
  }
}
