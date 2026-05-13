/**
 * Cutscene player. Displays a sequence of frames with optional video and text.
 * Videos play in a centered "window" with text displayed below.
 * User manually advances panels. Supports cutscene-level music and per-video audio.
 */

/** Default cutscene data.
 * Each frame can have:
 *   bg: background color (used when no video, or as letterbox color)
 *   text: [line1, line2] — displayed below the video window
 *   video: path to MP4 file (optional) — plays in the centered window
 *
 * Each cutscene can have:
 *   music: path to audio file that plays under all panels (looped)
 */
export const CUTSCENES = {
  intro: {
    music: null, // e.g. 'src/assets/music/intro.mp3'
    frames: [
      { bg: '#1a5a8a', text: ['In the big, big river, a little goldfish', 'swam happily with its family.'] },
      { bg: '#2a3a5a', video: 'src/assets/video/intro-02.mp4', text: ['One day, a net swept through the water...', 'and everything changed.'] },
      { bg: '#3a2a2a', text: ['Trapped in a small tank in a pet shop,', 'the goldfish dreamed of the river.'] },
      { bg: '#1a3a5c', text: ['But this little fish had a plan.', 'Tank by tank, it would find its way home.'] },
    ],
  },
  ending: {
    music: null, // e.g. 'src/assets/music/ending.mp3'
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
    this._fadeTimer = 0;
    this._fadeDuration = 0.5;
    this._fading = false;
    this._done = false;
    this._videoElement = null;
    this._videoReady = false;
    this._videoSourceNode = null;
    this._audioSystem = null;
    this._cutsceneMusicSource = null;
    this._cutsceneMusicBuffer = null;
  }

  /**
   * Set the audio system reference for routing video/music audio.
   * @param {AudioSystem} audioSystem
   */
  setAudioSystem(audioSystem) {
    this._audioSystem = audioSystem;
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
    this._fadeTimer = 0;
    this._fading = false;
    this._done = false;
    this._loadVideoForFrame(0);
    this._startCutsceneMusic(data.music);
  }

  /** Skip the entire cutscene. */
  skip() {
    this._stopVideo();
    this._stopCutsceneMusic();
    this._done = true;
  }

  /** Whether the cutscene has finished. */
  isDone() { return this._done; }

  /**
   * Update cutscene timing.
   * @param {number} dt - Delta time in seconds
   * @param {boolean} advancePressed - Whether the user pressed to advance/skip
   */
  update(dt, advancePressed) {
    if (this._done) return;

    // Handle crossfade transition
    if (this._fading) {
      this._fadeTimer += dt;
      if (this._fadeTimer >= this._fadeDuration) {
        this._fading = false;
        this._stopVideo();
        this._currentFrame++;
        if (this._currentFrame >= this._frames.length) {
          this._stopCutsceneMusic();
          this._done = true;
        } else {
          this._loadVideoForFrame(this._currentFrame);
        }
      }
      return;
    }

    // User advances to next panel
    if (advancePressed) {
      this._fading = true;
      this._fadeTimer = 0;
    }
  }

  /**
   * Render the current cutscene frame.
   * Layout: video window centered in upper portion, text below.
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

    // Text — larger, positioned below video window (or centered if no video)
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

    // Advance hint
    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press Space to continue', sw / 2, sh - 25);

    // Panel indicator
    ctx.fillStyle = '#555';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${this._currentFrame + 1} / ${this._frames.length}`, sw - 20, sh - 25);
  }

  /** Load video for a frame if it has one. */
  _loadVideoForFrame(index) {
    this._stopVideo();
    const frame = this._frames[index];
    if (!frame || !frame.video) return;

    const video = document.createElement('video');
    video.src = frame.video;
    video.playsInline = true;
    video.preload = 'auto';
    video.loop = true; // loop while user is on this panel
    this._videoElement = video;
    this._videoReady = false;

    // Route video audio through the game's audio system
    if (this._audioSystem) {
      this._videoSourceNode = this._audioSystem.connectMediaElement(video);
    }

    video.addEventListener('canplay', () => {
      this._videoReady = true;
      video.play().catch(() => { /* autoplay blocked */ });
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
      this._videoSourceNode = null;
    }
  }

  /** Start cutscene background music (looped, routed through music gain). */
  async _startCutsceneMusic(musicPath) {
    this._stopCutsceneMusic();
    if (!musicPath || !this._audioSystem) return;

    const ctx = this._audioSystem.getContext();
    const musicGain = this._audioSystem.getMusicGain();
    if (!ctx || !musicGain) return;

    try {
      const response = await fetch(musicPath);
      if (!response.ok) {
        console.warn(`Cutscene music not found: ${musicPath}`);
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(musicGain);
      source.start(0);
      this._cutsceneMusicSource = source;
    } catch (e) {
      console.warn(`Cutscene music failed to load: ${musicPath}`, e);
    }
  }

  /** Stop cutscene background music. */
  _stopCutsceneMusic() {
    if (this._cutsceneMusicSource) {
      try {
        this._cutsceneMusicSource.stop();
      } catch (e) { /* already stopped */ }
      this._cutsceneMusicSource = null;
    }
  }
}
