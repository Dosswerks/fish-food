/**
 * Physics system for Player_Fish movement.
 */
export class MomentumSystem {
  constructor(config = {}) {
    this.position = { x: 0, y: 0 };
    this.velocity = { x: 0, y: 0 };
    this._acceleration = config.acceleration || 500;  // px/s²
    this._maxSpeed = config.maxSpeed || 250;           // px/s
    this._drag = config.drag || 2.0;                   // deceleration factor (lower = smoother glide)
    this._lowEnergyFactor = config.lowEnergyFactor || 0.4;
    this._tightSpaceFactor = config.tightSpaceFactor || 0.5;
    this._horizontalTurnBoost = config.horizontalTurnBoost || 1.8;
    this._forgivenessDuration = 0.1; // 100ms
    this._forgivenessTimer = 0;
    this._lastDirX = 0;
    this._stuckTimer = 0;
    this._stuckThreshold = 1.5; // seconds
    this._nudgeForce = 80;
  }

  /**
   * Apply directional input acceleration.
   * @param {{ x: number, y: number }} direction - Normalized direction vector
   * @param {number} dt - Delta time in seconds
   */
  applyInput(direction, dt) {
    // Detect horizontal direction change for forgiveness
    if (direction.x !== 0 && Math.sign(direction.x) !== Math.sign(this._lastDirX) && this._lastDirX !== 0) {
      this._forgivenessTimer = this._forgivenessDuration;
    }
    if (direction.x !== 0) this._lastDirX = Math.sign(direction.x);

    let accelX = direction.x * this._acceleration;
    let accelY = direction.y * this._acceleration;

    // Higher turning responsiveness for horizontal changes
    if (direction.x !== 0 && Math.sign(direction.x) !== Math.sign(this.velocity.x)) {
      accelX *= this._horizontalTurnBoost;
    }

    // Forgiveness: reduce deceleration penalty during direction change
    if (this._forgivenessTimer > 0) {
      this._forgivenessTimer -= dt;
    }

    this.velocity.x += accelX * dt;
    this.velocity.y += accelY * dt;
  }

  /** Apply external force (current, suction). */
  applyForce(force) {
    this.velocity.x += force.x;
    this.velocity.y += force.y;
  }

  /** Apply drag deceleration. */
  applyDrag(dt) {
    const dragFactor = this._forgivenessTimer > 0 ? this._drag * 0.5 : this._drag;
    this.velocity.x *= Math.max(0, 1 - dragFactor * dt);
    this.velocity.y *= Math.max(0, 1 - dragFactor * dt);
  }

  /** Clamp velocity to max speed. */
  clampVelocity(maxSpeedFactor = 1.0) {
    const max = this._maxSpeed * maxSpeedFactor;
    const speed = this.getSpeed();
    if (speed > max) {
      const scale = max / speed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
    }
  }

  /** Update position from velocity. Returns new position. */
  integrate(dt) {
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    return { x: this.position.x, y: this.position.y };
  }

  getSpeed() { return Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2); }
  getVelocity() { return { ...this.velocity }; }

  /** Resolve collision by zeroing velocity in collision normal direction. */
  resolveCollision(normal) {
    if (normal.x !== 0) this.velocity.x = 0;
    if (normal.y !== 0) this.velocity.y = 0;
    this._stuckTimer = 0;
  }

  /** Update stuck timer. Returns true if nudge should be applied. */
  updateStuck(dt, isAgainstHazard) {
    if (isAgainstHazard && this.getSpeed() < 5) {
      this._stuckTimer += dt;
      if (this._stuckTimer >= this._stuckThreshold) {
        this._stuckTimer = 0;
        return true;
      }
    } else {
      this._stuckTimer = 0;
    }
    return false;
  }

  /** Apply nudge force to free stuck player. */
  applyNudge(direction) {
    this.velocity.x += direction.x * this._nudgeForce;
    this.velocity.y += direction.y * this._nudgeForce;
  }

  /** Get low-energy speed factor. */
  getLowEnergyFactor() { return this._lowEnergyFactor; }

  /** Get tight-space speed factor. */
  getTightSpaceFactor() { return this._tightSpaceFactor; }

  /** Reset for new level. */
  reset(startPos) {
    this.position = { ...startPos };
    this.velocity = { x: 0, y: 0 };
    this._stuckTimer = 0;
    this._forgivenessTimer = 0;
  }
}
