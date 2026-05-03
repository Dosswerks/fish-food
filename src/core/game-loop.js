/**
 * Fixed-timestep game loop with interpolated rendering.
 * Simulation runs at 60Hz; rendering runs at display refresh rate.
 */
export class GameLoop {
  /**
   * @param {object} opts
   * @param {function(number)} opts.update - Called each sim tick with dt in seconds
   * @param {function(number)} opts.render - Called each frame with interpolation alpha [0,1]
   * @param {number} [opts.timestep=1000/60] - Sim timestep in ms
   */
  constructor({ update, render, timestep = 1000 / 60 }) {
    this._update = update;
    this._render = render;
    this._timestep = timestep;
    this._dtSeconds = timestep / 1000;
    this._running = false;
    this._paused = false;
    this._rafId = null;
    this._lastTime = 0;
    this._accumulator = 0;
    this._timeScale = 1.0;
    this._timeScaleTimer = 0;
    this._timeScaleRestore = 1.0;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._paused = false;
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._tick(this._lastTime);
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  pause() { this._paused = true; }
  resume() { this._paused = false; this._lastTime = performance.now(); this._accumulator = 0; }

  /**
   * Set a time-scale factor for hitstop effects.
   * @param {number} scale - Time scale multiplier (0.0–1.0)
   * @param {number} duration - Duration in ms before restoring to 1.0
   */
  setTimeScale(scale, duration) {
    this._timeScaleRestore = this._timeScale;
    this._timeScale = scale;
    this._timeScaleTimer = duration;
  }

  /** @private */
  _tick(now) {
    if (!this._running) return;
    this._rafId = requestAnimationFrame((t) => this._tick(t));

    let frameTime = now - this._lastTime;
    this._lastTime = now;

    // Cap frame time to prevent spiral of death (e.g. tab was backgrounded)
    if (frameTime > 250) frameTime = 250;

    // Handle time scale restoration
    if (this._timeScaleTimer > 0) {
      this._timeScaleTimer -= frameTime;
      if (this._timeScaleTimer <= 0) {
        this._timeScale = this._timeScaleRestore;
        this._timeScaleTimer = 0;
      }
    }

    if (this._paused) {
      // Still render while paused so UI is visible
      this._render(1.0);
      return;
    }

    this._accumulator += frameTime * this._timeScale;

    // Run simulation steps
    while (this._accumulator >= this._timestep) {
      this._update(this._dtSeconds);
      this._accumulator -= this._timestep;
    }

    // Interpolation alpha for smooth rendering
    const alpha = this._accumulator / this._timestep;
    this._render(alpha);
  }
}
