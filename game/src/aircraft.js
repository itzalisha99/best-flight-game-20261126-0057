// SKYHAWK aircraft: the plane itself, built from primitives so it looks built,
// not drawn — cream fuselage, teal wings, orange stripe, glass canopy, a prop
// that spins with the throttle, and landing gear for the runway moments.

import * as THREE from 'three';

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, flatShading: true, ...opts });
}

export function buildAircraft() {
  const plane = new THREE.Group();
  const cream = mat(0xf2ead8);
  const teal = mat(0x1f7a6e);
  const orange = mat(0xe8642a);
  const dark = mat(0x2b2f36);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1c2f45, roughness: 0.08, metalness: 0.6 });

  // fuselage: a stretched capsule, nose pointing -Z (three.js forward)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 4.2, 6, 10), cream);
  body.rotation.x = Math.PI / 2;
  body.position.z = 0.2;
  plane.add(body);

  // orange stripe along the fuselage
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.87, 0.87, 3.4, 10, 1, true, 0, Math.PI * 2), orange);
  stripe.rotation.x = Math.PI / 2;
  stripe.position.set(0, -0.18, 0.6);
  stripe.scale.set(1, 1, 0.45);
  plane.add(stripe);

  // nose cone + spinner
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.1, 10), orange);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -2.85;
  plane.add(nose);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.7, 8), dark);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -3.6;
  plane.add(spinner);

  // prop: two blades on a hub, spins with throttle
  const prop = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(0.28, 2.6, 0.1);
  const blade1 = new THREE.Mesh(bladeGeo, dark);
  const blade2 = new THREE.Mesh(bladeGeo, dark);
  blade2.rotation.z = Math.PI / 2;
  prop.add(blade1);
  prop.add(blade2);
  prop.position.z = -3.55;
  plane.add(prop);

  // canopy: a glass bubble on top, ahead of the wing
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 8), glass);
  canopy.scale.set(1, 0.75, 1.7);
  canopy.position.set(0, 0.72, -0.9);
  plane.add(canopy);

  // main wing: a tapered box (scaled), teal with cream tips
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.22, 1.7), teal);
  wing.position.set(0, 0.05, -0.4);
  plane.add(wing);
  const tipGeo = new THREE.BoxGeometry(0.7, 0.24, 1.7);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(tipGeo, orange);
    tip.position.set(side * 4.6, 0.05, -0.4);
    plane.add(tip);
  }

  // tail: horizontal stabiliser + vertical fin
  const stab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.16, 1.0), teal);
  stab.position.set(0, 0.18, 2.5);
  plane.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 1.3), orange);
  fin.position.set(0, 0.75, 2.45);
  plane.add(fin);

  // landing gear: two wheels + a tail wheel
  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 6), dark);
    strut.position.set(side * 0.75, -0.75, -0.7);
    plane.add(strut);
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(side * 0.75, -1.2, -0.7);
    plane.add(wheel);
  }

  // navigation lights: red left, green right, white tail
  const lightGeo = new THREE.SphereGeometry(0.09, 6, 6);
  const navL = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  navL.position.set(-4.6, 0.05, -0.4);
  const navR = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  navR.position.set(4.6, 0.05, -0.4);
  const navT = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  navT.position.set(0, 0.2, 3.1);
  plane.add(navL, navR, navT);

  // the plane reads bigger in the chase camera than its true 9-metre span
  plane.scale.setScalar(1.25);

  return {
    group: plane,
    prop,
    // Called every frame: bank the model with the flight state, spin the prop.
    update(flight, dt) {
      plane.position.copy(flight.position);
      plane.rotation.order = 'YXZ';
      plane.rotation.y = flight.heading;
      plane.rotation.x = -flight.pitch;
      plane.rotation.z = flight.roll;
      prop.rotation.z += dt * (4 + flight.throttle * 55);
    },
  };
}
