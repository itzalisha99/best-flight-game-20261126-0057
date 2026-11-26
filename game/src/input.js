// SKYHAWK input: keyboard + mouse, one small state object the flight model reads.
// Keys: W/S throttle, arrows pitch + roll, A/D rudder, C camera, P pause, R restart,
// 1/2/3 pick a mission on the title screen, Enter starts. Mouse: hold left button
// and drag to steer (horizontal = bank, vertical = pitch).

const KEYMAP = {
  KeyW: 'throttleUp',
  KeyS: 'throttleDown',
  ArrowUp: 'pitchDown',
  ArrowDown: 'pitchUp',
  ArrowLeft: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyA: 'rudderLeft',
  KeyD: 'rudderRight',
};

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered keys, consumed once per frame
    this.mouseDown = false;
    this.mouseDX = 0; // accumulated drag since last frame
    this.mouseDY = 0;
    this._canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => {
      if (e.button === 0) this.mouseDown = true;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
    };
    this._onMouseMove = (e) => {
      if (!this.mouseDown) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
  }

  action(name) {
    for (const [code, act] of Object.entries(KEYMAP)) {
      if (act === name && this.keys.has(code)) return true;
    }
    return false;
  }

  // True once, on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Mouse drag for this frame, then cleared. Scaled to roughly -1..1.
  takeMouseSteer() {
    const dx = Math.max(-1, Math.min(1, this.mouseDX / 120));
    const dy = Math.max(-1, Math.min(1, this.mouseDY / 120));
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() {
    this.pressed.clear();
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this._canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('blur', this._onBlur);
  }
}
