/**
 * Object pool for high-churn entities.
 * Pre-allocates and recycles Food_Pellets, Rotten_Food, and particles.
 */
export class EntityPool {
  /**
   * @param {object} config - { foodPellets: 15, rottenFood: 10, particles: 20 }
   */
  constructor(config = {}) {
    this._pools = {};
    this._active = {};
    this._maxCounts = {
      foodPellet: config.foodPellets || 15,
      rottenFood: config.rottenFood || 10,
      particle: config.particles || 20,
    };

    // Pre-allocate
    for (const type of Object.keys(this._maxCounts)) {
      this._pools[type] = [];
      this._active[type] = [];
      for (let i = 0; i < this._maxCounts[type]; i++) {
        this._pools[type].push(this._createEntity(type, i));
      }
    }
  }

  _createEntity(type, id) {
    return {
      id: `${type}_${id}`,
      type,
      active: false,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      boundingBox: { x: 0, y: 0, w: 12, h: 12 },
      spawnTime: 0,
    };
  }

  /** Acquire an entity from the pool. Recycles oldest if exhausted. */
  acquire(type) {
    if (!this._pools[type]) return null;
    let entity = this._pools[type].pop();
    if (!entity) {
      // Recycle oldest active
      if (this._active[type].length > 0) {
        entity = this._active[type].shift();
      } else {
        return null;
      }
    }
    entity.active = true;
    entity.spawnTime = performance.now();
    this._active[type].push(entity);
    return entity;
  }

  /** Release an entity back to the pool. */
  release(entity) {
    const type = entity.type;
    if (!this._active[type]) return;
    const idx = this._active[type].indexOf(entity);
    if (idx !== -1) this._active[type].splice(idx, 1);
    entity.active = false;
    this._pools[type].push(entity);
  }

  /** Get count of active entities by type. */
  getActiveCount(type) {
    return this._active[type] ? this._active[type].length : 0;
  }

  /** Get all active entities of a type. */
  getActive(type) {
    return this._active[type] || [];
  }

  /** Reset all pools (on level end). */
  resetAll() {
    for (const type of Object.keys(this._maxCounts)) {
      while (this._active[type].length > 0) {
        const entity = this._active[type].pop();
        entity.active = false;
        this._pools[type].push(entity);
      }
    }
  }
}
