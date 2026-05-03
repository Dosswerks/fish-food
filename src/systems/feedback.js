/**
 * Manages visual feedback with priority-based effect stacking.
 * Priority: game_over(4) > predator_proximity(3) > stress(2) > pickup(1)
 * Max 2 simultaneous screen-space overlays.
 */
export class FeedbackSystem {
  constructor() {
    this._effects = [];
    this._motionReduction = false;
    this._screenShake = { x: 0, y: 0, timer: 0, intensity: 0 };
  }

  /** Queue a feedback event. */
  trigger(eventType, params = {}) {
    const effect = this._createEffect(eventType, params);
    if (effect) {
      this._effects.push(effect);
      // Sort by priority descending, keep max 2 overlays
      this._effects.sort((a, b) => b.priority - a.priority);
      while (this._effects.length > 2) this._effects.pop();
    }
  }

  _createEffect(type, params) {
    switch (type) {
      case 'food_pickup':
        return { type, priority: 1, timer: 0.15, maxTime: 0.15, color: '#ffee00', alpha: 0.3 };
      case 'rotten_food':
        if (!this._motionReduction) this._shake(0.2, 4);
        return { type, priority: 1, timer: 0.25, maxTime: 0.25, color: '#884400', alpha: 0.3 };
      case 'predator_hit':
        if (!this._motionReduction) this._shake(0.3, 8);
        return { type, priority: 4, timer: 0.4, maxTime: 0.4, color: '#ff0000', alpha: 0.5 };
      case 'predator_proximity':
        return { type, priority: 3, timer: 0.5, maxTime: 0.5, color: '#ff0000',
                 alpha: Math.min(0.4, (params.intensity || 0.2)) };
      case 'stress_low':
        return { type, priority: 2, timer: 1.0, maxTime: 1.0, color: '#ffcc00', alpha: 0.1,
                 desaturation: 0.2 };
      case 'stress_medium':
        if (!this._motionReduction) this._shake(0.1, 2);
        return { type, priority: 2, timer: 1.0, maxTime: 1.0, color: '#ff8800', alpha: 0.15,
                 desaturation: 0.4 };
      case 'stress_high':
        if (!this._motionReduction) this._shake(0.15, 4);
        return { type, priority: 2, timer: 1.0, maxTime: 1.0, color: '#ff2200', alpha: 0.25,
                 desaturation: 0.6 };
      case 'exit_fail':
        if (!this._motionReduction) this._shake(0.15, 3);
        return { type, priority: 1, timer: 0.3, maxTime: 0.3, color: '#ff8800', alpha: 0.2 };
      case 'bonus_pickup':
        return { type, priority: 1, timer: 0.3, maxTime: 0.3, color: '#ff00ff', alpha: 0.3 };
      case 'predator_escape':
        return { type, priority: 1, timer: 0.3, maxTime: 0.3, color: '#00ff44', alpha: 0.2 };
      case 'stress_threshold':
        if (!this._motionReduction) this._shake(0.1, 3);
        return { type, priority: 2, timer: 0.2, maxTime: 0.2, color: '#ff4400', alpha: 0.3 };
      default:
        return null;
    }
  }

  _shake(duration, intensity) {
    this._screenShake.timer = duration;
    this._screenShake.intensity = intensity;
  }

  /** Update active effects. */
  update(dt) {
    for (let i = this._effects.length - 1; i >= 0; i--) {
      this._effects[i].timer -= dt;
      if (this._effects[i].timer <= 0) this._effects.splice(i, 1);
    }
    if (this._screenShake.timer > 0) {
      this._screenShake.timer -= dt;
      this._screenShake.x = (Math.random() - 0.5) * 2 * this._screenShake.intensity;
      this._screenShake.y = (Math.random() - 0.5) * 2 * this._screenShake.intensity;
      if (this._screenShake.timer <= 0) {
        this._screenShake.x = 0;
        this._screenShake.y = 0;
      }
    }
  }

  /** Render active visual effects to canvas. */
  render(ctx, canvasW, canvasH) {
    // Screen shake offset (applied by caller to camera)
    // Vignette / color overlays
    for (const effect of this._effects) {
      const progress = effect.timer / effect.maxTime;
      const alpha = effect.alpha * progress;
      if (this._motionReduction) {
        // Static border flash instead of overlay
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 6;
        ctx.globalAlpha = alpha;
        ctx.strokeRect(3, 3, canvasW - 6, canvasH - 6);
        ctx.globalAlpha = 1.0;
      } else {
        // Vignette overlay
        ctx.fillStyle = effect.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.globalAlpha = 1.0;
      }
    }
  }

  /** Get current screen shake offset. */
  getShakeOffset() {
    if (this._motionReduction) return { x: 0, y: 0 };
    return { x: this._screenShake.x, y: this._screenShake.y };
  }

  /** Set motion reduction mode. */
  setMotionReduction(enabled) { this._motionReduction = enabled; }

  /** Clear all active effects. */
  clear() { this._effects = []; this._screenShake = { x: 0, y: 0, timer: 0, intensity: 0 }; }
}
