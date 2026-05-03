/**
 * Translates keyboard and touch input into movement commands.
 * Supports input buffering (100ms window).
 */
export class InputSystem {
  constructor() {
    this._keys = {};
    this._justPressed = {};
    this._enabled = true;
    this._mode = 'hold'; // 'hold' | 'toggle'
    this._sensitivity = 1.0;
    this._toggleDir = { x: 0, y: 0 };
    this._bufferWindow = 100; // ms
    this._buffer = []; // { direction, time }

    // Touch state
    this._touchActive = false;
    this._touchStart = { x: 0, y: 0 };
    this._touchCurrent = { x: 0, y: 0 };
    this._touchDir = { x: 0, y: 0 };
    this._touchTapped = false;
    this._touchDeadzone = 15; // px

    // Keyboard
    this._onKeyDown = (e) => {
      if (!this._enabled) return;
      this._keys[e.code] = true;
      this._justPressed[e.code] = true;
      this._buffer.push({ code: e.code, time: performance.now() });
    };
    this._onKeyUp = (e) => {
      this._keys[e.code] = false;
    };

    // Touch
    this._onTouchStart = (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      const t = e.touches[0];
      this._touchActive = true;
      this._touchStart = { x: t.clientX, y: t.clientY };
      this._touchCurrent = { x: t.clientX, y: t.clientY };
      this._touchDir = { x: 0, y: 0 };
    };
    this._onTouchMove = (e) => {
      if (!this._touchActive) return;
      e.preventDefault();
      const t = e.touches[0];
      this._touchCurrent = { x: t.clientX, y: t.clientY };
      const dx = this._touchCurrent.x - this._touchStart.x;
      const dy = this._touchCurrent.y - this._touchStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > this._touchDeadzone) {
        this._touchDir = { x: dx / dist, y: dy / dist };
      } else {
        this._touchDir = { x: 0, y: 0 };
      }
    };
    this._onTouchEnd = (e) => {
      e.preventDefault();
      const dx = this._touchCurrent.x - this._touchStart.x;
      const dy = this._touchCurrent.y - this._touchStart.y;
      if (Math.sqrt(dx * dx + dy * dy) < this._touchDeadzone) {
        this._touchTapped = true; // treat as confirm/any press
      }
      this._touchActive = false;
      this._touchDir = { x: 0, y: 0 };
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('touchstart', this._onTouchStart, { passive: false });
    window.addEventListener('touchmove', this._onTouchMove, { passive: false });
    window.addEventListener('touchend', this._onTouchEnd, { passive: false });
  }

  /** Poll current input state. Returns normalized direction vector. */
  getDirection() {
    if (!this._enabled) return { x: 0, y: 0 };

    // Keyboard
    let x = 0, y = 0;
    if (this._keys['ArrowLeft'] || this._keys['KeyA']) x -= 1;
    if (this._keys['ArrowRight'] || this._keys['KeyD']) x += 1;
    if (this._keys['ArrowUp'] || this._keys['KeyW']) y -= 1;
    if (this._keys['ArrowDown'] || this._keys['KeyS']) y += 1;

    // Touch override
    if (this._touchActive && (this._touchDir.x !== 0 || this._touchDir.y !== 0)) {
      x = this._touchDir.x;
      y = this._touchDir.y;
    }

    // Normalize diagonal movement
    const len = Math.sqrt(x * x + y * y);
    if (len > 0) {
      x /= len;
      y /= len;
    }

    return { x: x * this._sensitivity, y: y * this._sensitivity };
  }

  /** Check if pause was pressed this frame. */
  isPausePressed() {
    return !!this._justPressed['Escape'];
  }

  /** Check if confirm was pressed this frame. */
  isConfirmPressed() {
    return !!(this._justPressed['Space'] || this._justPressed['Enter'] || this._touchTapped);
  }

  /** Check if any key was pressed this frame. */
  isAnyPressed() {
    return Object.keys(this._justPressed).length > 0 || this._touchTapped;
  }

  /** Set input mode: 'hold' | 'toggle'. */
  setInputMode(mode) { this._mode = mode; }

  /** Set sensitivity multiplier. */
  setSensitivity(value) { this._sensitivity = Math.max(0.1, Math.min(2.0, value)); }

  /** Enable/disable input processing. */
  setEnabled(enabled) { this._enabled = enabled; }

  /** Clear per-frame state. Call at end of each tick. */
  flush() {
    this._justPressed = {};
    this._touchTapped = false;
    // Prune old buffer entries
    const now = performance.now();
    this._buffer = this._buffer.filter(b => now - b.time < this._bufferWindow);
  }

  /** Clean up event listeners. */
  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
  }
}
