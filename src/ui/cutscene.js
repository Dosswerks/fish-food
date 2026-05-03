/**
 * Cutscene player. Displays a sequence of static frames with text overlays.
 * Supports skip input and crossfade transitions.
 */

/** Default cutscene data for MVP. */
export const CUTSCENES = {
  intro: {
    frames: [
      { bg: '#1a5a8a', text: ['In the vast blue ocean, a little goldfish', 'swam happily with its family.'] },
      { bg: '#2a3a5a', text: ['One day, a net swept through the water...', 'and everything changed.'] },
      { bg: '#3a2a2a', text: ['Trapped in a small tank on a kitchen counter,', 'the goldfish dreamed of the sea.'] },
      { bg: '#1a3a5c', text: ['But this little fish had a plan.', 'Tank by tank, it would find its way home.'] },
    ],
  },
  ending: {
    frames: [
      { bg: '#1a5a8a', text: ['After a long journey through many tanks,', 'the goldfish could smell the ocean.'] },
      { bg: '#2a6a9a', text: ['With one final leap...', ''] },
      { bg: '#0a4a7a', text: ['SPLASH!', 'The little fish was home at last.'] },
      { bg: '#0a3a6a', text: ['The End', 'Thank you for playing Fish Food!'] },
    ],
  },
};

export class CutscenePlayer {
  constructor() {
    this._frames = [];
    this._currentFrame = 0;
    this._frameTimer = 0;
    this._frameDuration = 4; // seconds per frame
    this._fadeTimer = 0;
    this._fadeDuration = 0.5;
    this._fading = false;
    this._done = false;
  }

  /**
   * Start a cutscene.
   * @param {string} cutsceneId - Key into CUTSCENES
   */
  start(cutsceneId) {
    const data = CUTSCENES[cutsceneId];
    if (!data) { this._done = true; return; }
    this._frames = data.frames;
    this._currentFrame = 0;
    this._frameTimer = 0;
    this._fadeTimer = 0;
    this._fading = false;
    this._done = false;
  }

  /** Skip the entire cutscene. */
  skip() { this._done = true; }

  /** Whether the cutscene has finished. */
  isDone() { return this._done; }

  /**
   * Update cutscene timing.
   * @param {number} dt - Delta time in seconds
   * @param {boolean} skipPressed - Whether skip input was pressed
   */
  update(dt, skipPressed) {
    if (this._done) return;
    if (skipPressed) { this._done = true; return; }

    if (this._fading) {
      this._fadeTimer += dt;
      if (this._fadeTimer >= this._fadeDuration) {
        this._fading = false;
        this._currentFrame++;
        this._frameTimer = 0;
        if (this._currentFrame >= this._frames.length) {
          this._done = true;
        }
      }
      return;
    }

    this._frameTimer += dt;
    if (this._frameTimer >= this._frameDuration) {
      this._fading = true;
      this._fadeTimer = 0;
    }
  }

  /**
   * Render the current cutscene frame.
   */
  render(ctx, canvasW, canvasH) {
    if (this._done || this._frames.length === 0) return;

    const frame = this._frames[this._currentFrame];
    if (!frame) return;

    // Background
    ctx.fillStyle = frame.bg || '#000';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    const textY = canvasH * 0.7;
    if (frame.text[0]) ctx.fillText(frame.text[0], canvasW / 2, textY);
    if (frame.text[1]) ctx.fillText(frame.text[1], canvasW / 2, textY + 32);

    // Crossfade overlay during transition
    if (this._fading) {
      const alpha = this._fadeTimer / this._fadeDuration;
      ctx.fillStyle = '#000';
      ctx.globalAlpha = alpha;
      ctx.fillRect(0, 0, canvasW, canvasH);
      ctx.globalAlpha = 1.0;
    }

    // Skip hint
    ctx.fillStyle = '#666';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Press Space to skip', canvasW - 20, canvasH - 20);
  }
}
