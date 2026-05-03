/**
 * Sprite-based frame animation system.
 * Manages animation states, frame advancement, and procedural effects
 * until real sprite assets are available.
 */

/** Animation clip definitions (frame count, fps, loop). */
const CLIPS = {
  // Player
  'player_idle':      { frames: 4, fps: 3, loop: true },
  'player_swimming':  { frames: 4, fps: 8, loop: true },
  'player_eating':    { frames: 3, fps: 12, loop: false },
  'player_hit':       { frames: 2, fps: 10, loop: false },
  'player_low_energy':{ frames: 4, fps: 2, loop: true },
  // Predators
  'predator_idle':    { frames: 2, fps: 2, loop: true },
  'predator_patrol':  { frames: 4, fps: 6, loop: true },
  'predator_alert':   { frames: 2, fps: 8, loop: true },
  'predator_attack':  { frames: 3, fps: 10, loop: true },
  // Food
  'food_falling':     { frames: 4, fps: 4, loop: true },
  'food_rotten':      { frames: 2, fps: 1, loop: true },
  // Pump
  'pump_active':      { frames: 3, fps: 4, loop: true },
};

export class AnimationSystem {
  constructor() {
    /** @type {Map<string, AnimState>} entity id → animation state */
    this._states = new Map();
  }

  /**
   * Register or update an entity's animation.
   * @param {string} entityId
   * @param {string} clipName - e.g. 'player_idle'
   */
  play(entityId, clipName) {
    const existing = this._states.get(entityId);
    if (existing && existing.clip === clipName) return; // already playing
    const clip = CLIPS[clipName];
    if (!clip) return;
    this._states.set(entityId, {
      clip: clipName,
      frame: 0,
      timer: 0,
      fps: clip.fps,
      frameCount: clip.frames,
      loop: clip.loop,
      done: false,
    });
  }

  /**
   * Advance all animations by dt.
   * @param {number} dt - Delta time in seconds
   */
  update(dt) {
    for (const [id, state] of this._states) {
      if (state.done) continue;
      state.timer += dt;
      const frameDuration = 1 / state.fps;
      while (state.timer >= frameDuration) {
        state.timer -= frameDuration;
        state.frame++;
        if (state.frame >= state.frameCount) {
          if (state.loop) {
            state.frame = 0;
          } else {
            state.frame = state.frameCount - 1;
            state.done = true;
          }
        }
      }
    }
  }

  /**
   * Get current frame index for an entity.
   * @param {string} entityId
   * @returns {number} Frame index, or 0 if not registered
   */
  getFrame(entityId) {
    const state = this._states.get(entityId);
    return state ? state.frame : 0;
  }

  /**
   * Check if a non-looping animation has finished.
   * @param {string} entityId
   * @returns {boolean}
   */
  isDone(entityId) {
    const state = this._states.get(entityId);
    return state ? state.done : true;
  }

  /**
   * Remove an entity's animation state.
   * @param {string} entityId
   */
  remove(entityId) {
    this._states.delete(entityId);
  }

  /** Clear all animation states. */
  clear() {
    this._states.clear();
  }

  /**
   * Apply procedural animation effects to rendering.
   * Returns transform parameters for the entity.
   * @param {string} entityId
   * @param {string} clipName
   * @returns {{ scaleX: number, scaleY: number, offsetY: number, flash: boolean }}
   */
  getVisualParams(entityId, clipName) {
    const state = this._states.get(entityId);
    const frame = state ? state.frame : 0;
    const t = state ? state.timer : 0;

    switch (clipName) {
      case 'player_idle':
        // Gentle bob
        return { scaleX: 1, scaleY: 1, offsetY: Math.sin(t * 3) * 2, flash: false };
      case 'player_swimming':
        // Tail wag via slight horizontal squash/stretch
        return { scaleX: 1 + Math.sin(t * 16) * 0.05, scaleY: 1 - Math.sin(t * 16) * 0.03, offsetY: 0, flash: false };
      case 'player_eating':
        // Squash and stretch on pickup
        const eatProgress = frame / 2;
        return { scaleX: 1 + (1 - eatProgress) * 0.15, scaleY: 1 - (1 - eatProgress) * 0.1, offsetY: 0, flash: false };
      case 'player_hit':
        // Flash and recoil
        return { scaleX: 1, scaleY: 1, offsetY: 0, flash: frame % 2 === 0 };
      case 'player_low_energy':
        // Sluggish bob
        return { scaleX: 1, scaleY: 1, offsetY: Math.sin(t * 1.5) * 1, flash: false };
      default:
        return { scaleX: 1, scaleY: 1, offsetY: 0, flash: false };
    }
  }
}
