/**
 * Render layer manager. Draws all game elements in z-order.
 * Uses placeholder shapes with themed colors until sprite art is available.
 */

const THEME_COLORS = {
  kitchen_tank:    { water: '#1a3a5c', border: '#88aacc', gravel: '#8a7a5a', plant: '#2a6a3a' },
  pet_store_tank:  { water: '#1a4a6c', border: '#99bbdd', gravel: '#7a8a6a', plant: '#3a7a4a' },
  lab_tank:        { water: '#1a2a4c', border: '#6688aa', gravel: '#5a6a7a', plant: '#2a5a5a' },
  outdoor_pond:    { water: '#1a4a4c', border: '#6aaa8a', gravel: '#6a7a5a', plant: '#3a8a3a' },
  ocean_approach:  { water: '#0a3a6c', border: '#4488bb', gravel: '#5a7a8a', plant: '#2a7a6a' },
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
  }

  /** Set animation system reference. */
  setAnimationSystem(anim) { this._animSystem = anim; }

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
    const theme = gs.levelConfig?.tankTheme || 'kitchen_tank';
    return THEME_COLORS[theme] || THEME_COLORS.kitchen_tank;
  }

  _drawBackground(ctx, gs) {
    const tw = this._camera.getTankWidth();
    const th = this._camera.getTankHeight();
    const theme = this._getTheme(gs);

    // Water gradient
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

    // Tank border
    ctx.strokeStyle = theme.border;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, tw, th);

    // Entrance zone
    if (gs.levelConfig) {
      const ez = gs.levelConfig.entranceZone;
      ctx.fillStyle = COLORS.entranceZone;
      ctx.globalAlpha = 0.25;
      ctx.fillRect(ez.x, ez.y, ez.w, ez.h);
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.5;
      ctx.fillText('IN', ez.x + ez.w / 2, ez.y + ez.h / 2 + 3);
      ctx.globalAlpha = 1.0;

      // Exit zone with animated glow
      const ex = gs.levelConfig.exitZone;
      const pulse = 0.35 + 0.15 * Math.sin(performance.now() / 250);
      ctx.fillStyle = COLORS.exitZone;
      ctx.globalAlpha = pulse;
      ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = COLORS.exitZone;
      ctx.lineWidth = 2;
      ctx.strokeRect(ex.x, ex.y, ex.w, ex.h);
      // Arrow pointing up
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(ex.x + ex.w / 2, ex.y + 10);
      ctx.lineTo(ex.x + ex.w / 2 - 10, ex.y + 30);
      ctx.lineTo(ex.x + ex.w / 2 + 10, ex.y + 30);
      ctx.closePath();
      ctx.fill();
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', ex.x + ex.w / 2, ex.y + ex.h - 10);
    }
  }

  _drawDecorations(ctx, gs) {
    const tw = this._camera.getTankWidth();
    const th = this._camera.getTankHeight();
    const theme = this._getTheme(gs);

    // Simple plant decorations
    const plantPositions = [80, 250, 500, 780, 1050];
    for (const px of plantPositions) {
      if (px > tw) continue;
      const height = 40 + Math.sin(px * 0.3) * 20;
      const sway = Math.sin(performance.now() / 1000 + px) * 3;
      ctx.fillStyle = theme.plant;
      ctx.beginPath();
      ctx.moveTo(px - 4, th - 20);
      ctx.quadraticCurveTo(px + sway, th - 20 - height * 0.6, px + sway * 0.5 - 2, th - 20 - height);
      ctx.quadraticCurveTo(px + sway, th - 20 - height * 0.6, px + 4, th - 20);
      ctx.closePath();
      ctx.fill();
    }

    // Bubbles
    const t = performance.now() / 1000;
    for (let i = 0; i < 5; i++) {
      const bx = (i * 271 + t * 20) % tw;
      const by = th - ((t * 30 + i * 150) % th);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(bx, by, 3 + i, 0, Math.PI * 2);
      ctx.stroke();
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
