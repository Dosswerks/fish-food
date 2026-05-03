/**
 * HUD overlay: energy bar, stress indicator, exit threshold.
 * Renders in screen space (topmost layer).
 */
export class HUD {
  constructor(camera, stringTable) {
    this._camera = camera;
    this._strings = stringTable;
    this._energyFlash = 0;    // >0 green, <0 red
    this._flashTimer = 0;
  }

  /** Trigger energy change flash. */
  flashEnergy(gained) {
    this._energyFlash = gained ? 1 : -1;
    this._flashTimer = 0.2; // seconds
  }

  /**
   * Render HUD elements.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} state - { energy, stress, stressEnabled, exitThreshold }
   */
  render(ctx, state) {
    const cw = this._camera._canvas.width;
    const ch = this._camera._canvas.height;
    const scale = this._camera.getScale();
    const baseSize = Math.max(14, 14 * (scale / (window.devicePixelRatio || 1)));

    // Energy bar
    const barW = 200 * (scale / (window.devicePixelRatio || 1));
    const barH = 18 * (scale / (window.devicePixelRatio || 1));
    const barX = cw / 2 - barW / 2;
    const barY = ch - barH - 20 * (scale / (window.devicePixelRatio || 1));

    // Reduce opacity when energy > 80%
    const alpha = state.energy > 80 ? 0.5 : 1.0;
    ctx.globalAlpha = alpha;

    // Bar background
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);

    // Energy fill
    let fillColor = '#22cc44';
    if (this._flashTimer > 0) {
      fillColor = this._energyFlash > 0 ? '#44ff66' : '#ff4444';
    }
    if (state.energy < 20) fillColor = '#cc4422';
    ctx.fillStyle = fillColor;
    ctx.fillRect(barX, barY, barW * (state.energy / 100), barH);

    // Exit threshold marker
    if (state.exitThreshold !== undefined) {
      const markerX = barX + barW * (state.exitThreshold / 100);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(markerX, barY - 4);
      ctx.lineTo(markerX, barY + barH + 4);
      ctx.stroke();
    }

    // Bar border
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Energy text
    ctx.fillStyle = '#fff';
    ctx.font = `${baseSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Energy: ${Math.round(state.energy)}`, cw / 2, barY - 6);

    ctx.globalAlpha = 1.0;

    // Stress indicator
    if (state.stressEnabled && state.stress !== undefined) {
      const stressBarW = barW * 0.6;
      const stressBarH = barH * 0.7;
      const stressX = cw / 2 - stressBarW / 2;
      const stressY = barY - barH - 24 * (scale / (window.devicePixelRatio || 1));

      ctx.fillStyle = '#333';
      ctx.fillRect(stressX, stressY, stressBarW, stressBarH);

      const stressPct = state.stress / 100;
      const stressColor = stressPct > 0.75 ? '#ff2222' : stressPct > 0.5 ? '#ff8800' : stressPct > 0.25 ? '#ffcc00' : '#88cc88';
      ctx.fillStyle = stressColor;
      ctx.fillRect(stressX, stressY, stressBarW * stressPct, stressBarH);

      ctx.strokeStyle = '#aaa';
      ctx.strokeRect(stressX, stressY, stressBarW, stressBarH);

      ctx.fillStyle = '#fff';
      ctx.font = `${baseSize * 0.8}px sans-serif`;
      ctx.fillText(`Stress: ${Math.round(state.stress)}`, cw / 2, stressY - 4);
    }
  }

  update(dt) {
    if (this._flashTimer > 0) {
      this._flashTimer -= dt;
    }
  }
}
