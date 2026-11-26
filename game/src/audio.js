// SKYHAWK audio: every sound is synthesized with WebAudio — an engine hum
// that follows the throttle, wind that follows the airspeed, a chime for a
// ring, a thud for a crash. No audio files, no network, nothing to ship.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.windSource = null;
    this.windGain = null;
    this.muted = false;
    this.started = false;
  }

  // Browsers only let audio start after a user gesture: call from the first
  // click or keypress on the title screen.
  start() {
    if (this.started) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    this.started = true;

    // engine: two detuned saws through a low-pass, pitch follows throttle
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const engineOsc2 = this.ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55 * 1.01;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
    engineOsc2.start();
    this._engineOsc2 = engineOsc2;

    // wind: looped noise through a band-pass, loudness follows airspeed
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = buffer;
    this.windSource.loop = true;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0;
    this.windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    this.windSource.start();
  }

  // Called every frame with the flight state.
  update(throttle, speed, flying) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const engineLevel = this.muted || !flying ? 0 : 0.03 + throttle * 0.05;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(48 + throttle * 70, t, 0.1);
    this._engineOsc2.frequency.setTargetAtTime((48 + throttle * 70) * 1.01, t, 0.1);
    const windLevel = this.muted || !flying ? 0 : Math.min(0.12, (speed / 92) * 0.12);
    this.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
  }

  chime() {
    if (!this.started || this.muted) return;
    const t = this.ctx.currentTime;
    [880, 1318].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.18, t + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.08 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t + i * 0.08);
      osc.stop(t + i * 0.08 + 0.55);
    });
  }

  thud() {
    if (!this.started || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}
