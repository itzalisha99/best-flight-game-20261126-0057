// SKYHAWK — Island Courier: every tuning number lives here, one place.
// Units: metres, metres per second, radians, seconds.

export const CONFIG = {
  // --- aircraft ---
  maxSpeed: 92, // m/s at full throttle
  cruiseSpeed: 55,
  stallSpeed: 26, // below this the wing stops flying and the plane sinks
  accelRate: 0.35, // how fast speed chases throttle * maxSpeed
  pitchRate: 0.95, // rad/s at full stick
  rollRate: 2.4, // rad/s at full stick
  maxBank: 1.15, // rad, the steepest bank the plane holds
  turnAuthority: 9.81, // g, coordinated-turn yaw rate = tan(bank) * g / speed
  rudderRate: 0.35, // rad/s of extra yaw from A / D
  dragSink: 0.9, // extra sink per m/s under stall speed

  // --- fuel & damage ---
  fuelMax: 100,
  fuelBurnIdle: 0.22, // units per second
  fuelBurnFull: 1.05, // extra units per second at full throttle
  fuelCanBonus: 35,
  crashSpeed: 15, // hitting terrain or water above this speed is a crash
  hardLandingVs: 6.0, // vertical speed above this on touchdown is a crash
  safeLandingSpeed: 52, // must be slower than this to land
  safeLandingRoll: 0.35, // rad of bank allowed on touchdown
  safeLandingPitch: 0.25, // rad of pitch allowed on touchdown

  // --- world ---
  islandRadius: 620, // metres from the island centre to the beach
  seaLevel: 0,
  terrainSize: 1600, // the heightfield spans this many metres
  terrainSegments: 128,
  runway: {
    // a flat strip on the island's south-west shelf
    x: -260,
    z: 300,
    length: 260,
    width: 26,
    heading: 0.35, // rad, the strip's direction
  },
  startAltitude: 130,

  // --- rings ---
  ringRadius: 14,
  ringTube: 1.1,

  // --- camera ---
  chaseDistance: 12,
  chaseHeight: 4,
  chaseStiffness: 5.5, // lerp rate of the chase camera
  fovBase: 62,
  fovKick: 10, // extra field of view at top speed

  // --- missions ---
  missions: [
    {
      id: 'rings',
      name: 'RING RUN',
      blurb: 'Thread all 8 rings around the island. Fastest clean run wins.',
      ringCount: 8,
      fuelDrain: 1.0,
      timeLimit: 240,
    },
    {
      id: 'landing',
      name: 'RUNWAY TOUCH',
      blurb: 'Take off, fly the circuit, and land back on the strip. Gentle wins.',
      ringCount: 3,
      fuelDrain: 1.0,
      timeLimit: 300,
    },
    {
      id: 'courier',
      name: 'STORM COURIER',
      blurb: 'Deliver through 5 rings on a thirsty tank. Grab fuel cans on the way.',
      ringCount: 5,
      fuelDrain: 2.1,
      fuelCans: 4,
      timeLimit: 300,
    },
  ],
};
