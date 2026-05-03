/**
 * Debug overlay for level design iteration.
 * Shows real-time game state values and FPS counter.
 * Activated via URL parameter: ?debug=1 or ?level=N
 */
export class DebugOverlay {
  constructor() {
    this._enabled = false;
    this._fps = 0;
    this._frameCount = 0;
    this._fpsTimer = 0;
    this._lastTime = performance.now();
  }

  /** Check URL params and enable if debug mode requested. */
  init() {
    const params = new URLSearchParams(window.location.search);
    this._enabled = params.has('debug') || params.has('level');
    return this._enabled;
  }

  /** Get level index from URL param, or -1 if not specified. */
  getLevelOverride() {
    const params = new URLSearchParams(window.location.search);
    const level = params.get('level');
    return level !== null ? parseInt(level, 10) : -1;
  }

  isEnabled() { return this._enabled; }

  /** Call each frame to track FPS. */
  updateFPS() {
    this._frameCount++;
    const now = performance.now();
    this._fpsTimer += now - this._lastTime;
    this._lastTime = now;
    if (this._fpsTimer >= 1000) {
      this._fps = this._frameCount;
      this._frameCount = 0;
      this._fpsTimer = 0;
    }
  }

  /**
   * Render the debug overlay.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} canvasW
   * @param {number} canvasH
   * @param {object} data - Debug data to display
   */
  render(ctx, canvasW, canvasH, data) {
    if (!this._enabled) return;

    this.updateFPS();

    const x = 10;
    let y = 60;
    const lineH = 16;

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x - 4, y - 14, 260, lineH * 12 + 8);

    ctx.fillStyle = '#0f0';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';

    const lines = [
      `FPS: ${this._fps}`,
      `State: ${data.state || '?'}`,
      `Level: ${data.levelIndex ?? '?'} (${data.tankTheme || '?'})`,
      `Pos: ${data.playerX?.toFixed(1)}, ${data.playerY?.toFixed(1)}`,
      `Vel: ${data.velX?.toFixed(1)}, ${data.velY?.toFixed(1)} (${data.speed?.toFixed(1)})`,
      `Energy: ${data.energy?.toFixed(1)}`,
      `Stress: ${data.stress?.toFixed(1)} [${data.stressTier || 'off'}]`,
      `Food: ${data.foodCount ?? 0} active`,
      `Predators: ${data.predatorCount ?? 0}`,
      `Entities: ${data.entityCount ?? 0} pooled`,
      `Bonuses: ${data.bonusCount ?? 0} | Shield: ${data.shieldTimer?.toFixed(1) || '0'} | Speed: ${data.speedTimer?.toFixed(1) || '0'}`,
    ];

    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += lineH;
    }
  }
}
