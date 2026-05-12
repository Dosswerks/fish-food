/**
 * Render layer manager. Draws all game elements in z-order.
 * Uses placeholder shapes with themed colors until sprite art is available.
 */

const THEME_COLORS = {
  // World 1: Fresh Water
  freshwater_1:    { water: '#1a3a5c', border: '#88aacc', gravel: '#8a7a5a', plant: '#2a6a3a' },
  freshwater_2:    { water: '#1a4060', border: '#7799bb', gravel: '#7a6a4a', plant: '#3a7a4a' },
  freshwater_3:    { water: '#1a3555', border: '#6688aa', gravel: '#8a8a5a', plant: '#2a5a2a' },
  // World 2: Salt Water
  saltwater_1:     { water: '#0a3a6c', border: '#4488bb', gravel: '#5a7a8a', plant: '#2a7a6a' },
  saltwater_2:     { water: '#0a3060', border: '#5599cc', gravel: '#6a8a7a', plant: '#3a8a7a' },
  saltwater_3:     { water: '#0a2a5a', border: '#3377aa', gravel: '#4a6a7a', plant: '#2a6a5a' },
  // World 3: Neglected Tanks
  neglected_1:     { water: '#2a3a2a', border: '#556644', gravel: '#4a4a3a', plant: '#3a5a2a' },
  neglected_2:     { water: '#2a3520', border: '#4a5533', gravel: '#3a3a2a', plant: '#4a6a3a' },
  neglected_3:     { water: '#1a2a1a', border: '#3a4422', gravel: '#3a3a3a', plant: '#2a4a1a' },
  // World 4: Pet Store Tanks
  petstore_1:      { water: '#1a4a6c', border: '#99bbdd', gravel: '#7a8a6a', plant: '#3a7a4a' },
  petstore_2:      { water: '#1a3a5a', border: '#88aacc', gravel: '#6a7a5a', plant: '#4a8a5a' },
  petstore_3:      { water: '#1a4060', border: '#77aacc', gravel: '#7a7a6a', plant: '#3a6a3a' },
  // Bonus: Living Room
  living_room:     { water: '#1a3a5c', border: '#aaccee', gravel: '#9a8a6a', plant: '#4a8a4a' },
};

const COLORS = {
  player: '#ff9900',
  foodPellet: '#ffee00',
  rottenFood: '#665500',
  predator_patrol: '#cc0000',
  predator_chase: '#ff3300',
  predator_ambush: '#880044',
  hazard: '#666666',
  pump: '#4488cc',
  exitZone: '#00ff88',
  entranceZone: '#88ccff',
  bonusPickup_speed_boost: '#ff00ff',
  bonusPickup_energy_shield: '#00ccff',
  bonusPickup_stress_relief: '#44ff44',
  suctionZone: '#aa00aa',
};

export class Renderer {
  constructor(ctx, camera) {
    this._ctx = ctx;
    this._camera = camera;
    this._animSystem = null;
    this._bgImages = {}; // cache: theme -> HTMLImageElement
    this._bgLoading = {}; // track in-flight loads
  }

  /** Set animation system reference. */
  setAnimationSystem(anim) { this._animSystem = anim; }

  /**
   * Load a background image for a given theme.
   * Images are cached after first load.
   */
  _loadBgImage(theme) {
    if (this._bgImages[theme] || this._bgLoading[theme]) return;
    this._bgLoading[theme] = true;
    const img = new Image();
    img.src = `src/assets/backgrounds/${theme}.png`;
    img.onload = () => {
      this._bgImages[theme] = img;
      delete this._bgLoading[theme];
    };
    img.onerror = () => {
      console.warn(`Renderer: background image not found for theme "${theme}"`);
      delete this._bgLoading[theme];
    };
  }

  /** Draw the full frame. */
  render(gameState) {
    const ctx = this._ctx;
    this._camera.clear(ctx);
    this._camera.applyTransform(ctx);

    this._drawBackground(ctx, gameState);
    this._drawDecorations(ctx, gameState);
    this._drawCurrents(ctx, gameState);
    this._drawHazards(ctx, gameState);
    this._drawItems(ctx, gameState);
    this._drawPredators(ctx, gameState);
    this._drawPlayer(ctx, gameState);

    this._camera.resetTransform(ctx);
  }

  _getTheme(gs) {
    const theme = gs.levelConfig?.tankTheme || 'freshwater_1';
    return THEME_COLORS[theme] || THEME_COLORS.freshwater_1;
  }

  _drawBackground(ctx, gs) {
    const tw = this._camera.getTankWidth();
    const th = this._camera.getTankHeight();
    const theme = this._getTheme(gs);
    const themeKey = gs.levelConfig?.tankTheme || 'freshwater_1';

    // Try to draw background image
    this._loadBgImage(themeKey);
    const bgImg = this._bgImages[themeKey];
    if (bgImg) {
      ctx.drawImage(bgImg, 0, 0, tw, th);
    } else {
      // Fallback: procedural water gradient
      const grad = ctx.createLinearGradient(0, 0, 0, th);
      grad.addColorStop(0, theme.water);
      grad.addColorStop(1, this._darken(theme.water, 30));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, tw, th);

      // Gravel bottom
      ctx.fillStyle = theme.gravel;
      ctx.fillRect(0, th - 20, tw, 20);
      // Gravel texture dots
      ctx.fillStyle = this._lighten(theme.gravel, 20);
      for (let i = 0; i < tw; i += 12) {
        const y = th - 18 + Math.sin(i * 0.7) * 4;
        ctx.beginPath();
        ctx.arc(i + 6, y + 8, 3 + Math.sin(i) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tank border
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, tw, th);

    // Exit zone (top-right corner) — pulsing diagonal triangles pointing up-right
    if (gs.levelConfig) {
      const ex = gs.levelConfig.exitZone;
      const t = performance.now() / 600;
      const cx = ex.x + ex.w / 2;
      const cy = ex.y + ex.h / 2;

      // Three isosceles triangles pointing diagonally up-right, pulsing in sequence
      for (let i = 0; i < 3; i++) {
        const phase = (t - i * 0.4) % 2;
        const alpha = phase >= 0 && phase < 1 ? 0.3 + 0.7 * Math.sin(phase * Math.PI) : 0.15;
        const offset = i * 18;
        // Each triangle offset diagonally (up-right)
        const tx = cx - 16 + offset;
        const ty = cy + 16 - offset;

        ctx.fillStyle = COLORS.exitZone;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        // Isosceles triangle pointing up-right (45 degrees)
        // Tip points up-right, base is perpendicular to that direction
        ctx.moveTo(tx + 12, ty - 12);  // tip (up-right)
        ctx.lineTo(tx - 6, ty - 2);    // base left
        ctx.lineTo(tx + 2, ty + 6);    // base right
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Label
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('JUMP TO EXIT', cx, ex.y + ex.h - 6);
    }
  }

  _drawDecorations(ctx, gs) {
    const tw = this._camera.getTankWidth();
    const th = this._camera.getTankHeight();

    // Ambient bubbles
    const t = performance.now() / 1000;
    for (let i = 0; i < 24; i++) {
      const bx = (i * 271 + t * (15 + i * 3)) % tw;
      const by = th - ((t * (25 + i * 8) + i * 120) % th);
      const radius = 2 + (i % 4);
      const wobble = Math.sin(t * 2 + i * 1.5) * 3;
      ctx.strokeStyle = `rgba(255,255,255,${0.08 + (i % 3) * 0.04})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx + wobble, by, radius, 0, Math.PI * 2);
      ctx.stroke();
      // Highlight dot on bubble
      ctx.fillStyle = `rgba(255,255,255,${0.05 + (i % 3) * 0.03})`;
      ctx.beginPath();
      ctx.arc(bx + wobble - radius * 0.3, by - radius * 0.3, radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawCurrents(ctx, gs) {
    if (!gs.levelConfig?.pumps) return;
    const t = performance.now() / 1000;
    for (const pump of gs.levelConfig.pumps) {
      const aoe = pump.areaOfEffect;
      // Current area with animated flow lines
      ctx.strokeStyle = COLORS.pump;
      ctx.globalAlpha = 0.2;
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const offset = ((t * 40 + i * 30) % aoe.w);
        const lx = aoe.x + offset;
        const ly = aoe.y + aoe.h / 2 + Math.sin(i * 2) * (aoe.h * 0.3);
        ctx.beginPath();
        ctx.moveTo(lx, ly - 5);
        ctx.lineTo(lx + pump.direction.x * 15, ly + pump.direction.y * 15);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
      // Pump body
      ctx.fillStyle = COLORS.pump;
      ctx.fillRect(pump.position.x - 12, pump.position.y - 12, 24, 24);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pump.position.x, pump.position.y);
      ctx.lineTo(pump.position.x + pump.direction.x * 18, pump.position.y + pump.direction.y * 18);
      ctx.stroke();
      // Arrowhead
      const ax = pump.position.x + pump.direction.x * 18;
      const ay = pump.position.y + pump.direction.y * 18;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ax, ay, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawHazards(ctx, gs) {
    if (!gs.hazards) return;
    for (const h of gs.hazards) {
      const bb = h.boundingBox;
      if (h.collisionType === 'suction') {
        // Suction zone: animated spiral
        const cx = bb.x + bb.w / 2;
        const cy = bb.y + bb.h / 2;
        const t = performance.now() / 500;
        ctx.strokeStyle = COLORS.suctionZone;
        ctx.lineWidth = 2;
        for (let r = 10; r < (h.suctionRadius || 100); r += 20) {
          ctx.globalAlpha = 0.15 * (1 - r / (h.suctionRadius || 100));
          ctx.beginPath();
          ctx.arc(cx, cy, r, t, t + Math.PI * 1.5);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        // Center
        ctx.fillStyle = COLORS.suctionZone;
        ctx.beginPath();
        ctx.arc(cx, cy, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Rock / static hazard
        ctx.fillStyle = COLORS.hazard;
        // Rounded rectangle for rocks
        const r = 6;
        ctx.beginPath();
        ctx.moveTo(bb.x + r, bb.y);
        ctx.lineTo(bb.x + bb.w - r, bb.y);
        ctx.quadraticCurveTo(bb.x + bb.w, bb.y, bb.x + bb.w, bb.y + r);
        ctx.lineTo(bb.x + bb.w, bb.y + bb.h - r);
        ctx.quadraticCurveTo(bb.x + bb.w, bb.y + bb.h, bb.x + bb.w - r, bb.y + bb.h);
        ctx.lineTo(bb.x + r, bb.y + bb.h);
        ctx.quadraticCurveTo(bb.x, bb.y + bb.h, bb.x, bb.y + bb.h - r);
        ctx.lineTo(bb.x, bb.y + r);
        ctx.quadraticCurveTo(bb.x, bb.y, bb.x + r, bb.y);
        ctx.closePath();
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(bb.x + 4, bb.y + 2, bb.w * 0.4, bb.h * 0.3);
      }
    }
  }

  _drawItems(ctx, gs) {
    // Food pellets
    if (gs.foodPellets) {
      for (const f of gs.foodPellets) {
        if (!f.active) continue;
        if (f.isRotten) {
          // Rotten: darker, pulsing
          const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 400);
          ctx.fillStyle = COLORS.rottenFood;
          ctx.globalAlpha = pulse;
          ctx.beginPath();
          ctx.arc(f.position.x + 6, f.position.y + 6, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
          // X mark
          ctx.strokeStyle = '#aa4400';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(f.position.x + 2, f.position.y + 2);
          ctx.lineTo(f.position.x + 10, f.position.y + 10);
          ctx.moveTo(f.position.x + 10, f.position.y + 2);
          ctx.lineTo(f.position.x + 2, f.position.y + 10);
          ctx.stroke();
        } else {
          // Falling: gentle tumble
          const rot = Math.sin(performance.now() / 300 + f.position.x) * 0.3;
          ctx.save();
          ctx.translate(f.position.x + 6, f.position.y + 6);
          ctx.rotate(rot);
          ctx.fillStyle = COLORS.foodPellet;
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          // Shine
          ctx.fillStyle = 'rgba(255,255,255,0.4)';
          ctx.beginPath();
          ctx.arc(-2, -2, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Bonus pickups
    if (gs.bonusPickups) {
      for (const b of gs.bonusPickups) {
        if (!b.active) continue;
        const colorKey = `bonusPickup_${b.type}`;
        const color = COLORS[colorKey] || '#ff00ff';
        const pulse = 1 + 0.2 * Math.sin((b.pulsePhase || 0) + performance.now() / 200);
        const cx = b.position.x + 8;
        const cy = b.position.y + 8;

        // Particle trail
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 3; i++) {
          const tx = cx + Math.sin(performance.now() / 200 + i * 2) * 6;
          const ty = cy + Math.cos(performance.now() / 300 + i * 2) * 6;
          ctx.beginPath();
          ctx.arc(tx, ty, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // Main pickup
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, 8 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const icon = b.type === 'speed_boost' ? '⚡' : b.type === 'energy_shield' ? '🛡' : '♥';
        ctx.fillText(icon, cx, cy + 4);

        // Despawn warning (blink when < 2s)
        if (b.despawnTimer < 2) {
          ctx.globalAlpha = Math.sin(performance.now() / 100) > 0 ? 1 : 0.3;
        }
        ctx.globalAlpha = 1.0;
      }
    }
  }

  _drawPredators(ctx, gs) {
    if (!gs.predators) return;
    for (const p of gs.predators) {
      const bb = p.boundingBox;
      const color = COLORS[`predator_${p.type}`] || COLORS.predator_patrol;

      // Body shape varies by type
      ctx.fillStyle = color;
      if (p.type === 'ambush' && !p._lunging) {
        // Camouflaged: semi-transparent
        ctx.globalAlpha = 0.5;
      }
      ctx.beginPath();
      ctx.ellipse(bb.x + bb.w / 2, bb.y + bb.h / 2, bb.w / 2, bb.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      // Dorsal fin
      ctx.fillStyle = this._darken(color, 20);
      const finDir = p.facingRight !== false ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(bb.x + bb.w / 2, bb.y);
      ctx.lineTo(bb.x + bb.w / 2 - 8 * finDir, bb.y - 10);
      ctx.lineTo(bb.x + bb.w / 2 + 6 * finDir, bb.y + 4);
      ctx.closePath();
      ctx.fill();

      // Eye
      ctx.fillStyle = '#fff';
      const eyeX = p.facingRight !== false ? bb.x + bb.w - 10 : bb.x + 6;
      ctx.beginPath();
      ctx.arc(eyeX, bb.y + bb.h * 0.35, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.isAware ? '#ff0000' : '#000';
      ctx.beginPath();
      ctx.arc(eyeX + (p.facingRight !== false ? 1 : -1), bb.y + bb.h * 0.35, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Mouth
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      const mouthX = p.facingRight !== false ? bb.x + bb.w - 2 : bb.x + 2;
      ctx.beginPath();
      ctx.moveTo(mouthX, bb.y + bb.h * 0.55);
      ctx.lineTo(mouthX + (p.facingRight !== false ? 4 : -4), bb.y + bb.h * 0.5);
      ctx.stroke();

      // Tail
      ctx.fillStyle = color;
      const tailX = p.facingRight !== false ? bb.x - 4 : bb.x + bb.w + 4;
      ctx.beginPath();
      ctx.moveTo(tailX, bb.y + bb.h / 2 - 10);
      ctx.lineTo(p.facingRight !== false ? bb.x + 4 : bb.x + bb.w - 4, bb.y + bb.h / 2);
      ctx.lineTo(tailX, bb.y + bb.h / 2 + 10);
      ctx.closePath();
      ctx.fill();

      // Alert indicator
      if (p.isAware) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', bb.x + bb.w / 2, bb.y - 10);
      }
    }
  }

  _drawPlayer(ctx, gs) {
    if (!gs.player) return;
    const p = gs.player;
    const bb = p.boundingBox;

    // Animation params
    let scaleX = 1, scaleY = 1, offsetY = 0, flash = false;
    if (this._animSystem) {
      const params = this._animSystem.getVisualParams('player', `player_${p.animationState || 'idle'}`);
      scaleX = params.scaleX;
      scaleY = params.scaleY;
      offsetY = params.offsetY;
      flash = params.flash;
    } else {
      // Default idle bob
      offsetY = Math.sin(performance.now() / 400) * 2;
    }

    if (flash) { ctx.globalAlpha = 0.5; }

    ctx.save();
    ctx.translate(bb.x + bb.w / 2, bb.y + bb.h / 2 + offsetY);
    ctx.scale(p.facingRight ? scaleX : -scaleX, scaleY);

    // Body
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.ellipse(0, 0, bb.w / 2, bb.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly highlight
    ctx.fillStyle = '#ffbb44';
    ctx.beginPath();
    ctx.ellipse(0, 3, bb.w / 3, bb.h / 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bb.w / 2 - 8, -bb.h / 6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(bb.w / 2 - 7, -bb.h / 6, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Dorsal fin
    ctx.fillStyle = '#dd7700';
    ctx.beginPath();
    ctx.moveTo(-2, -bb.h / 2);
    ctx.lineTo(-8, -bb.h / 2 - 8);
    ctx.lineTo(6, -bb.h / 2 + 2);
    ctx.closePath();
    ctx.fill();

    // Tail
    const tailWag = Math.sin(performance.now() / 120) * 4;
    ctx.fillStyle = '#dd7700';
    ctx.beginPath();
    ctx.moveTo(-bb.w / 2 - 4, -10 + tailWag);
    ctx.lineTo(-bb.w / 2 + 4, 0);
    ctx.lineTo(-bb.w / 2 - 4, 10 + tailWag);
    ctx.closePath();
    ctx.fill();

    // Pectoral fin
    ctx.fillStyle = '#ee8800';
    ctx.beginPath();
    ctx.ellipse(2, bb.h / 4, 5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1.0;
  }

  // ── Color utility helpers ──
  _darken(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - amount);
    const g = Math.max(0, ((num >> 8) & 0xff) - amount);
    const b = Math.max(0, (num & 0xff) - amount);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }

  _lighten(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0xff) + amount);
    const b = Math.min(255, (num & 0xff) + amount);
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
  }
}
