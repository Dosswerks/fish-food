/**
 * Audio system using Web Audio API.
 * Plays background music and sound effects with volume controls.
 * Gracefully handles missing audio assets.
 */
export class AudioSystem {
  constructor() {
    this._ctx = null; // AudioContext, created on first user interaction
    this._masterGain = null;
    this._musicGain = null;
    this._sfxGain = null;
    this._muted = false;
    this._volumes = { master: 1.0, music: 0.7, sfx: 1.0 };
    this._currentMusic = null;
    this._musicSource = null;
    this._bufferCache = {};
    this._initialized = false;
  }

  /** Initialize AudioContext on first user gesture. */
  _ensureContext() {
    if (this._ctx) return true;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._masterGain = this._ctx.createGain();
      this._musicGain = this._ctx.createGain();
      this._sfxGain = this._ctx.createGain();
      this._musicGain.connect(this._masterGain);
      this._sfxGain.connect(this._masterGain);
      this._masterGain.connect(this._ctx.destination);
      this._applyVolumes();
      this._initialized = true;
      return true;
    } catch (e) {
      console.warn('AudioSystem: Web Audio API not available', e);
      return false;
    }
  }

  _applyVolumes() {
    if (!this._masterGain) return;
    const m = this._muted ? 0 : this._volumes.master;
    this._masterGain.gain.setValueAtTime(m, this._ctx.currentTime);
    this._musicGain.gain.setValueAtTime(this._volumes.music, this._ctx.currentTime);
    this._sfxGain.gain.setValueAtTime(this._volumes.sfx, this._ctx.currentTime);
  }

  setMasterVolume(v) { this._volumes.master = v; this._applyVolumes(); }
  setMusicVolume(v) { this._volumes.music = v; this._applyVolumes(); }
  setSfxVolume(v) { this._volumes.sfx = v; this._applyVolumes(); }
  setMuted(m) { this._muted = m; this._applyVolumes(); }

  /**
   * Load an audio file into the buffer cache.
   * @param {string} key - Cache key
   * @param {string} url - Audio file URL
   */
  async loadSound(key, url) {
    if (!this._ensureContext()) return;
    if (this._bufferCache[key]) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);
      this._bufferCache[key] = audioBuffer;
    } catch (e) {
      console.warn(`AudioSystem: failed to load ${url}`, e);
    }
  }

  /**
   * Play a one-shot sound effect.
   * @param {string} key - Buffer cache key
   */
  playSfx(key) {
    if (!this._ensureContext()) return;
    const buffer = this._bufferCache[key];
    if (!buffer) return; // gracefully skip missing audio
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this._sfxGain);
    source.start(0);
  }

  /**
   * Play a procedurally generated tone as a sound effect placeholder.
   * @param {number} freq - Frequency in Hz
   * @param {number} duration - Duration in seconds
   * @param {string} [type='sine'] - Oscillator type
   */
  playTone(freq, duration = 0.1, type = 'sine') {
    if (!this._ensureContext()) return;
    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this._ctx.currentTime);
    gain.gain.setValueAtTime(0.3, this._ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this._sfxGain);
    osc.start(this._ctx.currentTime);
    osc.stop(this._ctx.currentTime + duration);
  }

  /**
   * Play a music file from a URL path (looped).
   * Falls back to level-01 music if the file is not found.
   * @param {string} url - Path to the audio file
   */
  async playMusicFile(url) {
    if (!this._ensureContext()) return;
    this.stopMusic();
    // Cancellation: each call gets a unique token; if a newer call arrives, the old one won't start playback
    const token = Symbol();
    this._musicLoadToken = token;
    try {
      const response = await fetch(url);
      if (this._musicLoadToken !== token) return; // superseded by newer call
      if (!response.ok) {
        // Fallback to level-01 music
        if (url !== 'src/assets/music/level-01.mp3') {
          console.warn(`AudioSystem: music file not found: ${url}, falling back to level-01`);
          return this.playMusicFile('src/assets/music/level-01.mp3');
        }
        console.warn(`AudioSystem: no music available`);
        return;
      }
      const arrayBuffer = await response.arrayBuffer();
      if (this._musicLoadToken !== token) return; // superseded
      const audioBuffer = await this._ctx.decodeAudioData(arrayBuffer);
      if (this._musicLoadToken !== token) return; // superseded
      const source = this._ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(this._musicGain);
      source.start(0);
      this._musicSource = source;
      this._currentMusic = url;
    } catch (e) {
      if (this._musicLoadToken !== token) return;
      // Fallback to level-01 music
      if (url !== 'src/assets/music/level-01.mp3') {
        console.warn(`AudioSystem: failed to play ${url}, falling back to level-01`);
        return this.playMusicFile('src/assets/music/level-01.mp3');
      }
      console.warn(`AudioSystem: failed to play music`, e);
    }
  }

  /**
   * Play a procedural music loop (placeholder until real music assets).
   * Generates a simple ambient pad.
   * @param {string} theme - Tank theme identifier (unused for now)
   */
  playMusic(theme) {
    if (!this._ensureContext()) return;
    this.stopMusic();
    // Simple ambient pad using oscillators
    const now = this._ctx.currentTime;
    const notes = [220, 277, 330]; // A3, C#4, E4 (A major chord)
    this._musicOscillators = notes.map(freq => {
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.06, now);
      osc.connect(gain);
      gain.connect(this._musicGain);
      osc.start(now);
      return { osc, gain };
    });
    this._currentMusic = theme;
  }

  /** Stop current music. */
  stopMusic() {
    this._musicLoadToken = null; // cancel any in-flight load
    if (this._musicSource) {
      try {
        this._musicSource.stop();
      } catch (e) { /* already stopped */ }
      this._musicSource = null;
    }
    if (this._musicOscillators) {
      const now = this._ctx?.currentTime || 0;
      for (const { osc, gain } of this._musicOscillators) {
        try {
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          osc.stop(now + 0.5);
        } catch (e) { /* already stopped */ }
      }
      this._musicOscillators = null;
    }
    this._currentMusic = null;
  }

  /** Reduce music volume (for pause state). */
  duckMusic() {
    if (!this._musicGain) return;
    this._musicGain.gain.setValueAtTime(this._volumes.music * 0.2, this._ctx.currentTime);
  }

  /** Restore music volume. */
  unduckMusic() {
    if (!this._musicGain) return;
    this._musicGain.gain.setValueAtTime(this._volumes.music, this._ctx.currentTime);
  }

  /**
   * Connect a video/audio element to the SFX gain node so its audio
   * respects master and SFX volume controls.
   * @param {HTMLMediaElement} mediaElement - Video or audio element
   * @returns {MediaElementAudioSourceNode|null} The source node (caller should keep reference)
   */
  connectMediaElement(mediaElement) {
    if (!this._ensureContext()) return null;
    try {
      const source = this._ctx.createMediaElementSource(mediaElement);
      source.connect(this._sfxGain);
      return source;
    } catch (e) {
      console.warn('AudioSystem: failed to connect media element', e);
      return null;
    }
  }

  /**
   * Get the AudioContext (for external use like cutscene music).
   * @returns {AudioContext|null}
   */
  getContext() {
    this._ensureContext();
    return this._ctx;
  }

  /**
   * Get the music gain node (for routing cutscene music).
   * @returns {GainNode|null}
   */
  getMusicGain() {
    return this._musicGain;
  }

  /** Apply settings from settings menu. */
  applySettings(settings) {
    this.setMasterVolume(settings.masterVolume);
    this.setMusicVolume(settings.musicVolume);
    this.setSfxVolume(settings.sfxVolume);
    this.setMuted(settings.muted);
  }
}
