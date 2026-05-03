/**
 * Manages stress value [0, 100] with threshold-based effects.
 */
export class StressSystem {
  constructor() {
    this._stress = 0;
  }

  getStress() { return this._stress; }

  /** Update stress by passive rate. */
  update(dt, rate) {
    this._stress = Math.min(100, this._stress + rate * dt);
  }

  /** Add event-based stress. */
  addStress(amount) {
    this._stress = Math.min(100, this._stress + amount);
  }

  /** Reduce stress (from bonus pickup). */
  reduceStress(amount) {
    this._stress = Math.max(0, this._stress - amount);
  }

  /** Check if stress has reached max (100). */
  isMaxed() { return this._stress >= 100; }

  /** Get current threshold tier. */
  getThresholdTier() {
    if (this._stress < 25) return 'low';
    if (this._stress < 50) return 'medium';
    if (this._stress < 75) return 'high';
    return 'critical';
  }

  /** Reset for new level. */
  reset() { this._stress = 0; }
}
