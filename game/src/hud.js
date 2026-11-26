// SKYHAWK HUD: lit instruments over the 3D view — altitude, speed and heading
// on the glass, a compass strip, an attitude ball, fuel and throttle, the
// objective line, the timer and the score. All DOM + one small canvas, so the
// instruments stay sharp at any window size and read well in a screenshot.

const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this.altEl = document.getElementById('hud-alt');
    this.spdEl = document.getElementById('hud-spd');
    this.hdgEl = document.getElementById('hud-hdg');
    this.vsEl = document.getElementById('hud-vs');
    this.fuelEl = document.getElementById('hud-fuel-fill');
    this.fuelText = document.getElementById('hud-fuel-text');
    this.thrEl = document.getElementById('hud-thr-fill');
    this.objEl = document.getElementById('hud-objective');
    this.timerEl = document.getElementById('hud-timer');
    this.scoreEl = document.getElementById('hud-score');
    this.msgEl = document.getElementById('hud-message');
    this.warnEl = document.getElementById('hud-warn');
    this.compassEl = document.getElementById('hud-compass');
    this.attCanvas = document.getElementById('hud-attitude');
    this.attCtx = this.attCanvas.getContext('2d');
  }

  static formatTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // heading in degrees 0..360, 0 = north (-Z in world space)
  static headingDeg(headingRad) {
    const deg = ((-headingRad * 180) / Math.PI) % 360;
    return (deg + 360) % 360;
  }

  update(flight, missions, dt) {
    const hdg = Hud.headingDeg(flight.heading);
    this.altEl.textContent = `${Math.max(0, Math.round(flight.position.y * 3.28))} ft`;
    this.spdEl.textContent = `${Math.round(flight.speed * 1.94)} kt`;
    const point = COMPASS_POINTS[Math.round(hdg / 45) % 8];
    this.hdgEl.textContent = `${String(Math.round(hdg)).padStart(3, '0')}° ${point}`;
    const vs = flight.verticalSpeed * 196.85; // m/s to ft/min
    this.vsEl.textContent = `${vs >= 0 ? '+' : ''}${Math.round(vs)} fpm`;
    const fuelPct = Math.max(0, (flight.fuel / 100) * 100);
    this.fuelEl.style.width = `${fuelPct}%`;
    this.fuelEl.classList.toggle('low', fuelPct < 25);
    this.fuelText.textContent = `FUEL ${Math.round(fuelPct)}%`;
    this.thrEl.style.width = `${Math.round(flight.throttle * 100)}%`;
    this.objEl.textContent = missions.objectiveText();
    this.timerEl.textContent = Hud.formatTime(missions.timeLeft);
    this.scoreEl.textContent = `SCORE ${missions.score}`;
    this.msgEl.textContent = missions.messageTimer > 0 ? missions.message : '';
    const warn = [];
    if (flight.stalled) warn.push('STALL — NOSE DOWN, FULL THROTTLE');
    if (flight.engineOut) warn.push('ENGINE OUT');
    if (fuelPct < 25 && fuelPct > 0) warn.push('LOW FUEL');
    this.warnEl.textContent = warn.join('  •  ');
    this.drawCompass(hdg);
    this.drawAttitude(flight);
  }

  drawCompass(hdg) {
    // a strip of ticks centred on the current heading
    const ticks = [];
    for (let d = -60; d <= 60; d += 15) {
      const a = (Math.round(hdg) + d + 360) % 360;
      const label = a % 45 === 0 ? COMPASS_POINTS[Math.round(a / 45) % 8] : String(a).padStart(3, '0');
      ticks.push({ off: d, label, major: a % 45 === 0 });
    }
    let html = '';
    for (const t of ticks) {
      const left = 50 + t.off * 0.8;
      html += `<span class="tick${t.major ? ' major' : ''}" style="left:${left}%">${t.label}</span>`;
    }
    this.compassEl.innerHTML = html + '<span class="needle">▲</span>';
  }

  drawAttitude(flight) {
    const ctx = this.attCtx;
    const w = this.attCanvas.width;
    const h = this.attCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, Math.PI * 2);
    ctx.clip();
    // sky and ground, rolled with the plane and pitched with it
    ctx.translate(cx, cy);
    ctx.rotate(flight.roll);
    const pitchPx = Math.max(-40, Math.min(40, flight.pitch * 90));
    ctx.translate(0, pitchPx);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-60, -110, 120, 110);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-60, 0, 120, 110);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-60, 0);
    ctx.lineTo(60, 0);
    ctx.stroke();
    ctx.restore();
    // fixed wings + centre dot (the plane's own attitude mark)
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy);
    ctx.lineTo(cx - 12, cy);
    ctx.moveTo(cx + 12, cy);
    ctx.lineTo(cx + 34, cy);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    // ring around the ball
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 52, 0, Math.PI * 2);
    ctx.stroke();
  }
}
