/**
 * Cutscene player. Displays a sequence of frames with optional video and text.
 * Videos play in a centered "window" with text displayed below.
 * Supports skip input and crossfade transitions.
 */

/** Default cutscene data.
 * Each frame can have:
 *   bg: background color (used when no video, or as letterbox color)
 *   text: [line1, line2] — displayed below the video window
 *   video: path to MP4 file (optional) — plays in the centered window
 */
export const CUTSCENES = {
  intro: {
    frames: [
      { bg: '#1a5a8a', text: ['In the big, big river, a little goldfish', 'swam happily with its family.'] },
      { bg: '#2a3a5a', video: 'src/assets/video/intro-02.mp4', text: ['One day, a net swept through the water...', 'and everything changed.'] },
      { bg: '#3a2a2a', text: ['Trapped in a small tank in a pet shop,', 'the goldfish dreamed of the river.'] },
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
    this._frameDuration = 4; // seconds per frame (non-video frames)
    this._fadeTimer = 0;
    this._fadeDuration = 0.5;
    this._fading = false;
    this._done = false;
    this._videoElement = null;
    this._videoReady = false;
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
    this._loadVideoForFrame(0);
  }

  /** Skip the entire cutscene. */
  skip() {
    this._stopVideo();
    this._done = true;
  }

  /** Whether the cutscene has finished. */
  isDone() { return this._done; }

  /**
   * Update cutscene timing.
   * @param {number} dt - Delta time in seconds
   * @param {boolean} skipPressed - Whether skip input was pressed
   */
  update(dt, skipPressed) {
    if (this._done) return;
    if (skipPressed) { this.skip(); return; }

    if (this._fading) {
      this._fadeTimer += dt;
      if (this._fadeTimer >= this._fadeDuration) {
        this._fading = false;
        this._stopVideo();
        this._currentFrame++;
        this._frameTimer = 0;
        if (this._currentFrame >= this._frames.length) {
          this._done = true;
        } else {
          this._loadVideoForFrame(this._currentFrame);
        }
      }
      return;
    }

    this._frameTimer += dt;

    // For video frames, wait for video to end (or use frameDuration as fallback)
    const frame = this._frames[this._currentFrame];
    const hasVideo = frame && frame.video && this._videoElement;
    let shouldAdvance = false;

    if (hasVideo && this._videoReady) {
      // Advance when video ends, or after frameDuration as safety
      if (this._videoElement.ended || this._frameTimer >= Math.max(this._frameDuration, this._videoElement.duration || 99)) {
        shouldAdvance = true;
      }
    } else {
      if (this._frameTimer >= this._frameDuration) {
        shouldAdvance = true;
      }
    }

    if (shouldAdvance) {
      this._fading = true;
      this._fadeTimer = 0;
    }
  }

  /**
   * Render the current cutscene frame.
   * Layout: video window centered in upper 65%, text below.
   */
  render(ctx, canvasW, canvasH) {
    if (this._done || this._frames.length === 0) return;

    const frame = this._frames[this._currentFrame];
    if (!frame) return;

    const dpr = window.devicePixelRatio || 1;
    const sw = canvasW / dpr;
    const sh = canvasH / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = frame.bg || '#000';
    ctx.fillRect(0, 0, sw, sh);

    // Video window (448x672 aspect ratio = 2:3, portrait)
    if (frame.video && this._videoElement && this._videoReady) {
      const videoAspect = 448 / 672; // width/height
      const windowMaxH = sh * 0.6;
      const windowMaxW = sw * 0.7;
      // Fit video within the window area
      let drawH = windowMaxH;
      let drawW = drawH * videoAspect;
      if (drawW > windowMaxW) {
        drawW = windowMaxW;
        drawH = drawW / videoAspect;
      }
      const drawX = (sw - drawW) / 2;
      const drawY = sh * 0.05;

      // Draw video frame
      ctx.drawImage(this._videoElement, drawX, drawY, drawW, drawH);

      // Border around video window
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, drawW, drawH);
    }

    // Text — larger, positioned below video window
    const textY = frame.video ? sh * 0.75 : sh * 0.45;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    if (frame.text[0]) ctx.fillText(frame.text[0], sw / 2, textY);
    if (frame.text[1]) {
      ctx.font = '26px sans-serif';
      ctx.fillText(frame.text[1], sw / 2, textY + 40);
    }

    // Crossfade overlay during transition
    if (this._fading) {
      const alpha = this._fadeTimer / this._fadeDuration;
      ctx.fillStyle = '#000';
      ctx.globalAlpha = alpha;
      ctx.fillRect(0, 0, sw, sh);
      ctx.globalAlpha = 1.0;
    }

    // Skip hint
    ctx.fillStyle = '#666';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Press Space to skip', sw - 20, sh - 20);
  }

  /** Load video for a frame if it has one. */
  _loadVideoForFrame(index) {
    this._stopVideo();
    const frame = this._frames[index];
    if (!frame || !frame.video) return;

    const video = document.createElement('video');
    video.src = frame.video;
    video.muted = true; // cutscene audio handled separately if needed
    video.playsInline = true;
    video.preload = 'auto';
    this._videoElement = video;
    this._videoReady = false;

    video.addEventListener('canplay', () => {
      this._videoReady = true;
      video.play().catch(() => { /* autoplay blocked, still show frame */ });
    }, { once: true });

    video.addEventListener('error', () => {
      console.warn(`Cutscene video failed to load: ${frame.video}`);
      this._videoReady = false;
    }, { once: true });

    video.load();
  }

  /** Stop and clean up current video. */
  _stopVideo() {
    if (this._videoElement) {
      this._videoElement.pause();
      this._videoElement.src = '';
      this._videoElement.load(); // release resources
      this._videoElement = null;
      this._videoReady = false;
    }
  }
}
