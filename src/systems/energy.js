/**
 * Manages Player_Fish energy value clamped to [0, 100].
 */
export class EnergySystem {
  constructor() {
    this._energy = 50;
    this._graceTimer = 0;
    this._gracePeriod = 5; // seconds at 0 energy before game over
  }

  setEnergy(value) { this._energy = Math.max(0, Math.min(100, value)); }
  getEnergy() { return this._energy; }

  /** Add energy (from food collection). Returns actual amount added. */
  addEnergy(amount) {
    const before = this._energy;
    this._energy = Math.min(100, this._energy + amount);
    if (this._energy > 0) this._graceTimer = 0;
    return this._energy - before;
  }

  /** Drain energy. Returns actual amount drained. */
  drainEnergy(amount) {
    const before = this._energy;
    this._energy = Math.max(0, this._energy - amount);
    return before - this._energy;
  }

  /** Check if energy meets the exit threshold. */
  meetsExitThreshold(threshold) { return this._energy >= threshold; }

  /** Update grace period timer. Returns true if game over should trigger. */
  updateGracePeriod(dt) {
    if (this._energy > 0) { this._graceTimer = 0; return false; }
    this._graceTimer += dt;
    return this._graceTimer >= this._gracePeriod;
  }

  /** True when energy is 0 (low-energy mode). */
  isDepleted() { return this._energy <= 0; }

  /** Reset for new level with starting energy. */
  reset(startingEnergy = 50) {
    this._energy = startingEnergy;
    this._graceTimer = 0;
  }
}
