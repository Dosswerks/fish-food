/**
 * Camera system: fixed camera, proportional scaling, letterboxing.
 */
export class CameraSystem {
  constructor(canvas) {
    this._canvas = canvas;
    this._tankW = 1280;
    this._tankH = 720;
    this._padding = 0;
    this._scale = 1;
    this._offsetX = 0;
    this._offsetY = 0;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  setTankDimensions(w, h) {
    this._tankW = w;
    this._tankH = h;
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    this._canvas.width = screenW * dpr;
    this._canvas.height = screenH * dpr;

    // Scale tank to fit screen with letterboxing
    const scaleX = screenW / this._tankW;
    const scaleY = screenH / this._tankH;
    this._scale = Math.min(scaleX, scaleY) * dpr;

    const scaledW = this._tankW * this._scale;
    const scaledH = this._tankH * this._scale;
    this._offsetX = (this._canvas.width - scaledW) / 2;
    this._offsetY = (this._canvas.height - scaledH) / 2;
  }

  /** Apply camera transform to canvas context. */
  applyTransform(ctx) {
    ctx.setTransform(this._scale, 0, 0, this._scale, this._offsetX, this._offsetY);
  }

  /** Reset transform for HUD / screen-space rendering. */
  resetTransform(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Clear the full canvas (letterbox bars are black). */
  clear(ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
  }

  getTankWidth() { return this._tankW; }
  getTankHeight() { return this._tankH; }
  getScale() { return this._scale; }

  destroy() { window.removeEventListener('resize', this._onResize); }
}
