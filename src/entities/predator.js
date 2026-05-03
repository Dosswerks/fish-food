/**
 * Predator entities with type-specific AI behavior.
 */

export class Predator {
  constructor(config) {
    this.type = config.type || 'patrol';
    this.position = { ...config.patrolPath[0] };
    this.velocity = { x: 0, y: 0 };
    this.boundingBox = { x: this.position.x, y: this.position.y, w: 48, h: 32 };
    this.speed = config.speed || 1.5;
    this.detectionRadius = config.detectionRadius || 0;
    this.triggerRadius = config.triggerRadius || 0;
    this.patrolPath = config.patrolPath || [];
    this.patrolIndex = 0;
    this.isAware = false;
    this.facingRight = true;
    this.animationState = 'idle';
    this.collisionType = 'predator';
    this.active = true;
  }

  update(dt, playerPosition, exitZone) {
    // Override in subclasses
  }

  _updateBoundingBox() {
    this.boundingBox.x = this.position.x;
    this.boundingBox.y = this.position.y;
  }

  /** Check if position is inside exit zone; if so, reverse. */
  _checkExitZone(exitZone) {
    if (!exitZone) return false;
    return this.position.x + this.boundingBox.w > exitZone.x &&
           this.position.x < exitZone.x + exitZone.w &&
           this.position.y + this.boundingBox.h > exitZone.y &&
           this.position.y < exitZone.y + exitZone.h;
  }

  _distanceTo(target) {
    const dx = target.x - (this.position.x + this.boundingBox.w / 2);
    const dy = target.y - (this.position.y + this.boundingBox.h / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }
}

/** Follows a fixed patrol path at constant speed. */
export class PatrolPredator extends Predator {
  constructor(config) {
    super({ ...config, type: 'patrol' });
  }

  update(dt, playerPosition, exitZone) {
    if (this.patrolPath.length < 2) return;
    const target = this.patrolPath[this.patrolIndex];
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPath.length;
    } else {
      const speed = this.speed * 60; // convert to px/s
      this.position.x += (dx / dist) * speed * dt;
      this.position.y += (dy / dist) * speed * dt;
      this.facingRight = dx > 0;
    }

    if (this._checkExitZone(exitZone)) {
      this.patrolIndex = (this.patrolIndex + 1) % this.patrolPath.length;
    }

    this.animationState = 'patrol';
    this._updateBoundingBox();
  }
}

/** Pursues player when within detection radius. */
export class ChasePredator extends Predator {
  constructor(config) {
    super({ ...config, type: 'chase' });
  }

  update(dt, playerPosition, exitZone) {
    const dist = this._distanceTo(playerPosition);

    if (dist < this.detectionRadius) {
      this.isAware = true;
      this.animationState = 'attack';
      const dx = playerPosition.x - this.position.x;
      const dy = playerPosition.y - this.position.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const chaseSpeed = this.speed * 80;
      this.position.x += (dx / d) * chaseSpeed * dt;
      this.position.y += (dy / d) * chaseSpeed * dt;
      this.facingRight = dx > 0;
    } else {
      this.isAware = false;
      // Fall back to patrol
      if (this.patrolPath.length >= 2) {
        PatrolPredator.prototype.update.call(this, dt, playerPosition, exitZone);
      }
      this.animationState = 'patrol';
    }

    if (this._checkExitZone(exitZone)) {
      // Push back out of exit zone
      this.position.x -= (this.facingRight ? 1 : -1) * this.speed * 60 * dt;
    }

    this._updateBoundingBox();
  }
}

/** Stationary until player enters trigger radius, then lunges. */
export class AmbushPredator extends Predator {
  constructor(config) {
    super({ ...config, type: 'ambush' });
    this._lunging = false;
    this._lungeTarget = null;
    this._lungeSpeed = (config.speed || 1.5) * 150;
  }

  update(dt, playerPosition, exitZone) {
    if (this._lunging) {
      const dx = this._lungeTarget.x - this.position.x;
      const dy = this._lungeTarget.y - this.position.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 10) {
        this._lunging = false;
        this.animationState = 'idle';
      } else {
        this.position.x += (dx / d) * this._lungeSpeed * dt;
        this.position.y += (dy / d) * this._lungeSpeed * dt;
        this.facingRight = dx > 0;
      }
    } else {
      const dist = this._distanceTo(playerPosition);
      if (dist < this.triggerRadius) {
        this._lunging = true;
        this._lungeTarget = { ...playerPosition };
        this.isAware = true;
        this.animationState = 'attack';
      } else {
        this.isAware = false;
        this.animationState = 'idle';
      }
    }

    this._updateBoundingBox();
  }
}

/** Factory to create the right predator type from config. */
export function createPredator(config) {
  switch (config.type) {
    case 'chase': return new ChasePredator(config);
    case 'ambush': return new AmbushPredator(config);
    default: return new PatrolPredator(config);
  }
}
