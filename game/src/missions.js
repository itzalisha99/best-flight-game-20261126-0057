// SKYHAWK missions: three sorties with different goals, one shared flight.
// RING RUN — thread 8 rings against the clock. RUNWAY TOUCH — take off, fly the
// circuit, land back on the strip. STORM COURIER — 5 rings on a thirsty tank,
// fuel cans keep you flying. Fuel and damage turn every sortie into decisions.

import { CONFIG } from './config.js';
import { islandRingCourse } from './rings.js';

export const MISSION_STATE = {
  IDLE: 'idle',
  FLYING: 'flying',
  DONE: 'done',
  CRASHED: 'crashed',
  OUT_OF_FUEL: 'out-of-fuel',
  TIME_UP: 'time-up',
};

export class Missions {
  constructor(flight, rings, effects) {
    this.flight = flight;
    this.rings = rings;
    this.effects = effects;
    this.index = 0;
    this.state = MISSION_STATE.IDLE;
    this.score = 0;
    this.elapsed = 0;
    this.message = '';
    this.messageTimer = 0;
    this.lapRings = 0;
  }

  get def() {
    return CONFIG.missions[this.index];
  }

  get name() {
    return this.def.name;
  }

  start(index) {
    this.index = index;
    this.state = MISSION_STATE.FLYING;
    this.score = 0;
    this.elapsed = 0;
    this.lapRings = 0;
    this.message = '';
    this.flight.reset();
    const def = this.def;
    if (def.id === 'landing') {
      // already on the strip: throttle up and go
      this.rings.setCourse(islandRingCourse(3, 120));
      this.say('Take off, fly the circuit, land back on the strip.');
    } else if (def.id === 'courier') {
      this.flight.place(-420, 150, -80, 2.2, 55);
      this.rings.setCourse(islandRingCourse(def.ringCount, 130));
      const cans = islandRingCourse(def.fuelCans, 120).map((p) => ({ x: p.x * 0.8, y: p.y, z: p.z * 0.8 }));
      this.effects.setFuelCans(cans);
      this.say('Deliver through 5 rings. Grab the yellow fuel cans!');
    } else {
      this.flight.place(-420, 150, -80, 2.2, 55);
      this.rings.setCourse(islandRingCourse(def.ringCount, 130));
      this.say('Thread all 8 rings. Fast and clean wins.');
    }
  }

  say(text, seconds = 4) {
    this.message = text;
    this.messageTimer = seconds;
  }

  step(dt) {
    if (this.state !== MISSION_STATE.FLYING) return;
    this.elapsed += dt;
    if (this.messageTimer > 0) this.messageTimer -= dt;

    // fuel burns with the throttle; empty tank means a dead stick
    const def = this.def;
    const burn = (CONFIG.fuelBurnIdle + this.flight.throttle * CONFIG.fuelBurnFull) * def.fuelDrain * dt;
    this.flight.fuel = Math.max(0, this.flight.fuel - burn);
    if (this.flight.fuel <= 0 && !this.flight.onGround) {
      this.state = MISSION_STATE.OUT_OF_FUEL;
      this.say('Out of fuel! Glide it down gently.', 6);
    }

    // ring passes score
    const passed = this.rings.checkPass(this.flight.position);
    if (passed) {
      this.score += 100;
      this.lapRings++;
      this.effects.ringPass(passed.pos);
      if (this.rings.done) {
        this.finish();
      } else {
        this.say(`Ring ${this.rings.passedCount} of ${this.rings.list.length} — nice flying!`, 2.5);
      }
    }

    // fuel cans (Courier)
    const bonus = this.effects.checkFuelPickup(this.flight.position);
    if (bonus > 0) {
      this.flight.fuel = Math.min(CONFIG.fuelMax, this.flight.fuel + bonus);
      this.score += 25;
      this.say(`Fuel +${bonus}!`, 2.5);
    }

    // landing mission: a clean touchdown on the strip ends it
    if (def.id === 'landing' && this.flight.landed && this.flight.onGround && this.flight.speed < 5) {
      this.finish();
    }

    // clock
    if (this.elapsed > def.timeLimit) {
      this.state = MISSION_STATE.TIME_UP;
      this.say('Time up! The sortie is over.', 6);
    }
  }

  onCrash() {
    if (this.state !== MISSION_STATE.FLYING) return;
    this.state = MISSION_STATE.CRASHED;
    this.score = Math.max(0, this.score - 50);
    this.say('Crashed! Press R to fly again.', 8);
  }

  finish() {
    this.state = MISSION_STATE.DONE;
    const timeBonus = Math.max(0, Math.round((this.def.timeLimit - this.elapsed) * 2));
    this.score += timeBonus;
    this.say(`Mission complete! Time bonus +${timeBonus}.`, 8);
  }

  // What the HUD's objective line shows.
  objectiveText() {
    const def = this.def;
    if (this.state === MISSION_STATE.IDLE) return 'Pick a mission — 1, 2 or 3';
    if (def.id === 'landing') {
      if (this.flight.onGround && this.flight.speed < 2 && this.elapsed < 2) return 'Throttle up (W), pull back to lift off';
      if (!this.flight.landed) return `Fly the circuit, then land on the strip (${this.rings.passedCount}/3 rings)`;
      return 'Down safe! Taxi to a stop.';
    }
    return `Rings ${this.rings.passedCount}/${this.rings.list.length} — ${def.name}`;
  }

  get timeLeft() {
    return Math.max(0, this.def.timeLimit - this.elapsed);
  }
}
