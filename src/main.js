/**
 * Fish Food — Main entry point.
 * Wires all systems together and runs the game.
 */
import { GameLoop } from './core/game-loop.js';
import { GameStateManager, States } from './core/state-manager.js';
import { Renderer } from './core/renderer.js';
import { InputSystem } from './systems/input.js';
import { EnergySystem } from './systems/energy.js';
import { MomentumSystem } from './systems/momentum.js';
import { CollisionSystem } from './systems/collision.js';
import { StressSystem } from './systems/stress.js';
import { EntityPool } from './systems/entity-pool.js';
import { CameraSystem } from './systems/camera.js';
import { SaveSystem } from './systems/save.js';
import { FeedbackSystem } from './systems/feedback.js';
import { TutorialSystem } from './systems/tutorial.js';
import { DifficultySystem } from './systems/difficulty.js';
import { AnalyticsSystem } from './systems/analytics.js';
import { StringTable } from './config/string-table.js';
import { LevelLoader } from './config/level-loader.js';
import { HUD } from './ui/hud.js';
import { SettingsMenu } from './ui/settings-menu.js';
import { CutscenePlayer } from './ui/cutscene.js';
import { createPredator } from './entities/predator.js';
import { createHazards, findClearFoodX } from './entities/hazard.js';
import { trySpawnBonus, updateBonuses, BONUS_DURATIONS, SPEED_BOOST_MULTIPLIER, STRESS_RELIEF_AMOUNT } from './entities/bonus.js';
import { AudioSystem } from './systems/audio.js';
import { AnimationSystem } from './systems/animation.js';
import { DebugOverlay } from './ui/debug-overlay.js';
import { validateLevel } from './config/level-validator.js';

// ── Bootstrap ──────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const camera = new CameraSystem(canvas);
const input = new InputSystem();
const energy = new EnergySystem();
const momentum = new MomentumSystem();
const collision = new CollisionSystem();
const stress = new StressSystem();
const entityPool = new EntityPool();
const save = new SaveSystem();
const strings = new StringTable();
const levelLoader = new LevelLoader();
const stateManager = new GameStateManager();
const renderer = new Renderer(ctx, camera);
const hud = new HUD(camera, strings);
const feedback = new FeedbackSystem();
const difficulty = new DifficultySystem();
const analytics = new AnalyticsSystem(false);
const cutscene = new CutscenePlayer();
const audio = new AudioSystem();
const animation = new AnimationSystem();
const debug = new DebugOverlay();
renderer.setAnimationSystem(animation);
let tutorial; // initialized after strings load
let settingsMenu; // initialized after strings load
let audioInitialized = false;

// ── Title Logo ─────────────────────────────────────────────
const titleLogo = new Image();
titleLogo.src = 'src/assets/fish_food_logo.png';

// ── Game State ─────────────────────────────────────────────
const gs = {
  player: null,
  levelConfig: null,
  predators: [],
  hazards: [],
  foodPellets: [],
  bonusPickups: [],
  foodSpawnTimer: 0,
  activeEffects: { speedBoost: 0, energyShield: 0 },
  previousStressTier: 'low',
  menuSelection: 0,
  showingNarrative: false,
  narrativeTimer: 0,
  droppingIn: false,
  dropVelocity: 0,
  dropBubbles: [],
  confirmingNewGame: false,
  levelSelectActive: false,
  levelSelectIndex: 0,
  completionSummaryShown: false,
};

const LEVEL_PATHS = [
  // World 1: Fresh Water
  'src/config/levels/level-01.json',
  'src/config/levels/level-02.json',
  'src/config/levels/level-03.json',
  // World 2: Salt Water
  'src/config/levels/level-04.json',
  'src/config/levels/level-05.json',
  'src/config/levels/level-06.json',
  // World 3: Neglected Tanks
  'src/config/levels/level-07.json',
  'src/config/levels/level-08.json',
  'src/config/levels/level-09.json',
  // World 4: Pet Store Tanks
  'src/config/levels/level-10.json',
  'src/config/levels/level-11.json',
  'src/config/levels/level-12.json',
  // Bonus: Living Room
  'src/config/levels/level-13.json',
];

const WORLDS = [
  { name: 'Fresh Water', tanks: [0, 1, 2] },
  { name: 'Salt Water', tanks: [3, 4, 5] },
  { name: 'Neglected Tanks', tanks: [6, 7, 8] },
  { name: 'Pet Store Tanks', tanks: [9, 10, 11] },
  { name: 'Living Room (Bonus)', tanks: [12] },
];

// ── Level Loading ──────────────────────────────────────────
async function loadLevel(index) {
  if (index >= LEVEL_PATHS.length) {
    // Game complete — show ending cutscene
    cutscene.start('ending');
    stateManager.transition(States.CUTSCENE);
    return;
  }
  try {
    const config = await levelLoader.load(LEVEL_PATHS[index]);
    gs.levelConfig = config;
    camera.setTankDimensions(config.tankDimensions.width, config.tankDimensions.height);

    // Set difficulty
    difficulty.setTier(config.difficultyTier || 1);

    // Reset systems
    energy.reset(config.startingEnergy);
    stress.reset();
    momentum.reset(config.playerStartPosition);
    entityPool.resetAll();
    feedback.clear();

    // Player
    gs.player = {
      position: { ...config.playerStartPosition },
      boundingBox: { x: config.playerStartPosition.x, y: config.playerStartPosition.y, w: 32, h: 24 },
      facingRight: true,
      animationState: 'idle',
    };

    // Predators
    gs.predators = (config.predators || []).map(p => createPredator(p));

    // Hazards
    gs.hazards = createHazards(config.hazards || []);

    // Reset food & bonuses
    gs.foodPellets = [];
    gs.bonusPickups = [];
    gs.foodSpawnTimer = 0;
    gs.activeEffects = { speedBoost: 0, energyShield: 0 };
    gs.previousStressTier = 'low';
    gs.showingNarrative = false;
    gs.narrativeTimer = 0;
    gs.droppingIn = true;
    gs.dropVelocity = 0;
    gs.dropElapsed = 0;

    stateManager.loadLevel(index);
    analytics.levelStart(index);
    // Music will start during the drop-in phase if config.musicFile is set
  } catch (err) {
    console.error('Failed to load level:', err);
    stateManager.transition(States.MAIN_MENU);
  }
}

// ── Food Spawning ──────────────────────────────────────────
function spawnFood() {
  const config = gs.levelConfig;
  if (!config) return;
  const pellet = entityPool.acquire('foodPellet');
  if (!pellet) return;
  let x = Math.random() * (config.tankDimensions.width - 24) + 6;
  // Reposition if overlapping a hazard
  x = findClearFoodX(x, config.tankDimensions.width, gs.hazards);
  pellet.position.x = x;
  pellet.position.y = 0;
  pellet.boundingBox = { x, y: 0, w: 12, h: 12 };
  pellet.isRotten = false;
  pellet.fallSpeed = 40 + Math.random() * 20;
  pellet.collisionType = 'food';
  gs.foodPellets.push(pellet);
}

// ── Star Rating Calculation ────────────────────────────────
function calculateStars(config, timeSpent, energyRemaining, rottenFoodHits) {
  let stars = 1;
  if (timeSpent <= config.targetSessionLength) stars++;
  if (energyRemaining >= config.exitEnergyThreshold * 1.5 && rottenFoodHits === 0) stars++;
  return stars;
}

// ── Update (60Hz) ──────────────────────────────────────────
function update(dt) {
  const state = stateManager.getState();

  // ── Cutscene state ──
  if (state === States.CUTSCENE) {
    cutscene.update(dt, input.isConfirmPressed());
    if (cutscene.isDone()) {
      // After intro → play level 1; after ending → main menu
      const saveData = save.load();
      if (saveData && saveData.currentLevel >= LEVEL_PATHS.length) {
        stateManager.transition(States.MAIN_MENU);
      } else {
        const lvl = saveData ? saveData.currentLevel : 0;
        loadLevel(lvl);
        stateManager.transition(States.PLAYING);
      }
    }
    input.flush();
    return;
  }

  // ── Settings state ──
  if (state === States.SETTINGS) {
    const result = settingsMenu.handleInput(input);
    if (result === 'back') {
      // Return to wherever we came from
      const params = stateManager.getParams();
      if (params.from === 'paused') {
        stateManager.transition(States.PAUSED);
      } else {
        stateManager.transition(States.MAIN_MENU);
      }
      // Apply settings
      const s = settingsMenu.getSettings();
      feedback.setMotionReduction(s.motionReduction);
      input.setInputMode(s.inputMode);
      input.setSensitivity(s.inputSensitivity);
      audio.applySettings(s);
    }
    input.flush();
    return;
  }

  // ── Main Menu ──
  if (state === States.MAIN_MENU) {
    const dir = input.getDirection();
    const hasSave = save.hasSaveData();
    const saveData = hasSave ? save.load() : null;
    const hasCompleted = saveData && saveData.completedLevels && saveData.completedLevels.length > 0;

    // New game — clear save and start immediately
    if (gs.confirmingNewGame) {
      gs.confirmingNewGame = false;
      save.clearSave();
      tutorial?.reset();
      cutscene.start('intro');
      stateManager.transition(States.CUTSCENE);
      input.flush();
      return;
    }

    // Level select screen
    if (gs.levelSelectActive) {
      const completed = saveData ? saveData.completedLevels : [];
      if (dir.x > 0.5) gs.levelSelectIndex = Math.min(LEVEL_PATHS.length - 1, gs.levelSelectIndex + 1);
      if (dir.x < -0.5) gs.levelSelectIndex = Math.max(0, gs.levelSelectIndex - 1);
      if (input.isConfirmPressed() && completed.includes(gs.levelSelectIndex)) {
        loadLevel(gs.levelSelectIndex);
        gs.levelSelectActive = false;
        stateManager.transition(States.PLAYING);
      }
      if (input.isPausePressed()) gs.levelSelectActive = false;
      input.flush();
      return;
    }

    // Build menu items dynamically
    const menuItems = [];
    menuItems.push(hasSave ? 'new_game' : 'start');

    if (dir.y < -0.5 && (input._justPressed['ArrowUp'] || input._justPressed['KeyW'])) {
      gs.menuSelection = Math.max(0, gs.menuSelection - 1);
    }
    if (dir.y > 0.5 && (input._justPressed['ArrowDown'] || input._justPressed['KeyS'])) {
      gs.menuSelection = Math.min(menuItems.length - 1, gs.menuSelection + 1);
    }
    gs.menuSelection = Math.min(gs.menuSelection, menuItems.length - 1);

    // Mouse click hit detection for menu items
    const clickPos = input.getMouseClickPos();
    if (clickPos) {
      // Menu renders in CSS pixel space, click is already in CSS pixels
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      const menuStartY = sh * 0.55;
      const itemSpacing = 50;
      for (let i = 0; i < menuItems.length; i++) {
        const itemY = menuStartY + i * itemSpacing;
        const hitTop = itemY - 25;
        const hitBottom = itemY + 15;
        const hitLeft = sw / 2 - 200;
        const hitRight = sw / 2 + 200;
        if (clickPos.x >= hitLeft && clickPos.x <= hitRight &&
            clickPos.y >= hitTop && clickPos.y <= hitBottom) {
          gs.menuSelection = i;
          break;
        }
      }
    }

    if (input.isConfirmPressed()) {
      const selected = menuItems[gs.menuSelection];
      if (selected === 'start') {
        cutscene.start('intro');
        stateManager.transition(States.CUTSCENE);
      } else if (selected === 'new_game') {
        gs.confirmingNewGame = true;
      }
    }
    input.flush();
    return;
  }

  // ── Game Over ──
  if (state === States.GAME_OVER) {
    if (input.isConfirmPressed()) {
      loadLevel(stateManager.getCurrentLevelIndex());
      stateManager.transition(States.PLAYING);
    }
    input.flush();
    return;
  }

  // ── Progress Map ──
  if (state === States.PROGRESS_MAP) {
    if (input.isAnyPressed()) {
      const nextLevel = stateManager.getCurrentLevelIndex() + 1;
      if (nextLevel < LEVEL_PATHS.length) {
        loadLevel(nextLevel);
        stateManager.transition(States.PLAYING);
      } else {
        // All levels done — ending cutscene
        cutscene.start('ending');
        stateManager.transition(States.CUTSCENE);
      }
    }
    input.flush();
    return;
  }

  if (state !== States.PLAYING) {
    input.flush();
    return;
  }

  // ── Drop-in phase ──
  if (gs.droppingIn) {
    const config = gs.levelConfig;
    if (config && gs.player) {
      // Track elapsed time in drop-in phase
      if (gs.dropElapsed === undefined) gs.dropElapsed = 0;
      gs.dropElapsed += dt;

      // Play splash sound at the start of drop-in
      if (gs.dropElapsed <= dt * 2) {
        audio.playTone(180, 0.25, 'triangle'); // splash thud
        setTimeout(() => audio.playTone(400, 0.1, 'sine'), 50); // splash sparkle
        // Also play the level's music file if configured
        if (config.musicFile) {
          audio.playMusicFile(config.musicFile);
        }
      }

      // Curved arc: accelerate downward and drift rightward
      gs.dropVelocity += 400 * dt; // gravity (softer for arc feel)
      const horizontalDrift = 120 * dt; // drift right
      gs.player.position.y += gs.dropVelocity * dt;
      gs.player.position.x += horizontalDrift;

      // Clamp within tank bounds
      const tw = config.tankDimensions.width;
      const th = config.tankDimensions.height;
      if (gs.player.position.x > tw - 32) gs.player.position.x = tw - 32;
      if (gs.player.position.y > th - 24) gs.player.position.y = th - 24;

      gs.player.boundingBox.x = gs.player.position.x;
      gs.player.boundingBox.y = gs.player.position.y;
      gs.player.facingRight = true;

      // Spawn wake bubbles behind the player (only for first 3 seconds)
      if (!gs.dropBubbles) gs.dropBubbles = [];
      if (gs.dropElapsed < 3.0) {
        gs.dropBubbles.push({
          x: gs.player.position.x + 8 + (Math.random() - 0.5) * 10,
          y: gs.player.position.y + 12 + (Math.random() - 0.5) * 6,
          radius: 2 + Math.random() * 3,
          alpha: 0.6,
          vy: -(20 + Math.random() * 30), // float upward
        });
      }

      // Update existing bubbles
      for (let i = gs.dropBubbles.length - 1; i >= 0; i--) {
        const b = gs.dropBubbles[i];
        b.y += b.vy * dt;
        b.alpha -= 1.2 * dt;
        if (b.alpha <= 0) gs.dropBubbles.splice(i, 1);
      }

      // Decelerate and land smoothly when reaching target depth
      if (gs.player.position.y >= 120) {
        gs.dropVelocity *= 0.7; // stronger damping for reliable landing
        if (gs.dropVelocity < 20) {
          gs.droppingIn = false;
          gs.dropVelocity = 0;
          gs.dropElapsed = undefined;
          gs.dropBubbles = []; // clear bubble trail
          momentum.reset({ x: gs.player.position.x, y: gs.player.position.y });
        }
      }

      // Safety: force-end drop-in after 4 seconds regardless
      if (gs.dropElapsed >= 4.0) {
        gs.droppingIn = false;
        gs.dropVelocity = 0;
        gs.dropElapsed = undefined;
        gs.dropBubbles = [];
        if (gs.player.position.y < 120) gs.player.position.y = 120;
        gs.player.boundingBox.x = gs.player.position.x;
        gs.player.boundingBox.y = gs.player.position.y;
        momentum.reset({ x: gs.player.position.x, y: gs.player.position.y });
      }
    }
    input.flush();
    return;
  }

  // ── Narrative overlay ──
  if (gs.showingNarrative) {
    gs.narrativeTimer -= dt;
    if (gs.narrativeTimer <= 0 || input.isAnyPressed()) {
      gs.showingNarrative = false;
    }
    // Don't block gameplay — narrative displays as overlay while action continues
  }

  // ── Tutorial — auto-dismiss after timeout, never blocks gameplay ──
  if (tutorial && tutorial.isBlocking()) {
    if (!gs._tutorialDisplayTimer) gs._tutorialDisplayTimer = 4.0;
    gs._tutorialDisplayTimer -= dt;
    if (gs._tutorialDisplayTimer <= 0 || input.isAnyPressed()) {
      tutorial.dismiss();
      gs._tutorialDisplayTimer = 0;
    }
  } else {
    gs._tutorialDisplayTimer = 0;
  }

  // ── Pause check ──
  if (input.isPausePressed()) {
    stateManager.transition(States.PAUSED);
    input.flush();
    return;
  }

  const config = gs.levelConfig;
  if (!config || !gs.player) { input.flush(); return; }

  // ── Tutorial triggers ──
  if (tutorial) {
    if (!tutorial.hasShown('movement')) tutorial.tryShow('movement');
    if (energy.getEnergy() < 50 && !tutorial.hasShown('energy_warning')) tutorial.tryShow('energy_warning');
  }

  // 1. Input
  const dir = input.getDirection();
  const isMoving = dir.x !== 0 || dir.y !== 0;

  // 2. Physics
  if (isMoving) {
    momentum.applyInput(dir, dt);
  }
  // Gentle downward drift (gravity/sinking) when not actively swimming up
  if (!isMoving || dir.y >= 0) {
    momentum.applyForce({ x: 0, y: 10 * dt });
  }
  // Apply currents
  if (config.pumps) {
    for (const pump of config.pumps) {
      const aoe = pump.areaOfEffect;
      const px = gs.player.position.x + 16;
      const py = gs.player.position.y + 12;
      if (px > aoe.x && px < aoe.x + aoe.w && py > aoe.y && py < aoe.y + aoe.h) {
        momentum.applyForce({
          x: pump.direction.x * pump.strength * dt * 60,
          y: pump.direction.y * pump.strength * dt * 60,
        });
      }
    }
  }
  momentum.applyDrag(dt);
  // Speed factor
  let speedFactor = 1.0;
  if (energy.isDepleted()) speedFactor = momentum.getLowEnergyFactor();
  if (gs.activeEffects.speedBoost > 0) speedFactor *= SPEED_BOOST_MULTIPLIER;
  // Stress responsiveness reduction
  if (stress.getThresholdTier() === 'critical') speedFactor *= 0.8;
  else if (stress.getThresholdTier() === 'high') speedFactor *= 0.9;
  momentum.clampVelocity(speedFactor);
  momentum.integrate(dt);

  // 3. Collision — boundaries (bounce off walls, flip direction)
  const bounds = collision.confineToBounds(
    { x: momentum.position.x, y: momentum.position.y, w: 32, h: 24 },
    config.tankDimensions.width, config.tankDimensions.height
  );
  momentum.position.x = bounds.x;
  momentum.position.y = bounds.y;
  for (const n of bounds.normals) {
    // Bounce: reflect velocity and reduce by bounce factor
    const bounceFactor = 0.5;
    if (n.x !== 0) {
      momentum.velocity.x = -momentum.velocity.x * bounceFactor;
      gs.player.facingRight = momentum.velocity.x >= 0;
    }
    if (n.y !== 0) {
      momentum.velocity.y = -momentum.velocity.y * bounceFactor;
    }
  }

  // Collision — static hazards
  const staticHazards = gs.hazards.filter(h => h.collisionType === 'hazard');
  if (staticHazards.length > 0) {
    const resolved = collision.resolveStaticCollisions(
      { x: momentum.position.x, y: momentum.position.y, w: 32, h: 24 },
      staticHazards
    );
    momentum.position.x = resolved.x;
    momentum.position.y = resolved.y;
    for (const n of resolved.normals) momentum.resolveCollision(n);
  }

  // Sync player position (store previous for interpolation)
  gs.player.prevPosition = { x: gs.player.position.x, y: gs.player.position.y };
  gs.player.position.x = momentum.position.x;
  gs.player.position.y = momentum.position.y;
  gs.player.boundingBox.x = momentum.position.x;
  gs.player.boundingBox.y = momentum.position.y;
  gs.player.facingRight = momentum.getVelocity().x >= 0;

  // 4. Food spawning & update
  gs.foodSpawnTimer += dt;
  if (gs.foodSpawnTimer >= config.foodSpawnRate) {
    gs.foodSpawnTimer = 0;
    spawnFood();
    // Tutorial: first food
    if (tutorial && !tutorial.hasShown('food')) tutorial.tryShow('food');
    // Bonus pickup chance
    const bonus = trySpawnBonus(config.bonusPickupSpawnChance || 0,
      config.tankDimensions.width, config.tankDimensions.height);
    if (bonus) gs.bonusPickups.push(bonus);
  }

  // Update food pellets
  for (let i = gs.foodPellets.length - 1; i >= 0; i--) {
    const f = gs.foodPellets[i];
    if (!f.active) { gs.foodPellets.splice(i, 1); continue; }
    if (!f.isRotten) {
      f.position.y += f.fallSpeed * dt;
      if (config.pumps) {
        for (const pump of config.pumps) {
          const aoe = pump.areaOfEffect;
          if (f.position.x > aoe.x && f.position.x < aoe.x + aoe.w &&
              f.position.y > aoe.y && f.position.y < aoe.y + aoe.h) {
            f.position.x += pump.direction.x * pump.strength * dt * 30;
            f.position.y += pump.direction.y * pump.strength * dt * 30;
          }
        }
      }
      f.boundingBox.x = f.position.x;
      f.boundingBox.y = f.position.y;
      if (f.position.y + 12 >= config.tankDimensions.height) {
        f.position.y = config.tankDimensions.height - 12;
        f.isRotten = true;
        f.collisionType = 'rottenFood';
      }
    }
  }

  // Update bonus pickups
  updateBonuses(gs.bonusPickups, dt);

  // Update active bonus effect timers
  if (gs.activeEffects.speedBoost > 0) gs.activeEffects.speedBoost -= dt;
  if (gs.activeEffects.energyShield > 0) gs.activeEffects.energyShield -= dt;

  // 5. Collision — player vs entities
  const allCollidables = [...gs.foodPellets, ...gs.predators, ...gs.bonusPickups];
  const events = collision.checkCollisions(gs.player, allCollidables);
  for (const evt of events) {
    switch (evt.type) {
      case 'food':
        energy.addEnergy(config.foodEnergyValue);
        hud.flashEnergy(true);
        feedback.trigger('food_pickup');
        audio.playTone(880, 0.08, 'sine'); // pickup chime
        animation.play('player', 'player_eating'); // squash-and-stretch
        analytics.trackFood();
        entityPool.release(evt.entity);
        evt.entity.active = false;
        break;
      case 'rottenFood':
        if (gs.activeEffects.energyShield > 0) break; // shield blocks rotten food
        energy.drainEnergy(config.rottenFoodPenalty);
        hud.flashEnergy(false);
        feedback.trigger('rotten_food');
        audio.playTone(220, 0.15, 'sawtooth'); // warning buzz
        analytics.trackRottenFood();
        if (tutorial && !tutorial.hasShown('rotten_food')) tutorial.tryShow('rotten_food');
        entityPool.release(evt.entity);
        evt.entity.active = false;
        break;
      case 'predator':
        feedback.trigger('predator_hit');
        audio.playTone(150, 0.3, 'square'); // death thud
        analytics.trackPredatorHit();
        gameLoop.setTimeScale(0.2, 100); // hitstop
        stateManager.transition(States.GAME_OVER, { cause: 'eaten' });
        analytics.gameOver(config.levelIndex, 'eaten');
        break;
      case 'bonus': {
        const b = evt.entity;
        feedback.trigger('bonus_pickup');
        audio.playTone(1200, 0.12, 'sine'); // bonus chime
        analytics.trackBonus();
        if (b.type === 'speed_boost') {
          gs.activeEffects.speedBoost = BONUS_DURATIONS.speed_boost;
        } else if (b.type === 'energy_shield') {
          gs.activeEffects.energyShield = BONUS_DURATIONS.energy_shield;
        } else if (b.type === 'stress_relief') {
          stress.reduceStress(STRESS_RELIEF_AMOUNT);
        }
        b.active = false;
        break;
      }
    }
  }

  // Suction zones
  for (const h of gs.hazards) {
    if (h.collisionType !== 'suction') continue;
    const cx = h.boundingBox.x + h.boundingBox.w / 2;
    const cy = h.boundingBox.y + h.boundingBox.h / 2;
    const px = gs.player.position.x + 16;
    const py = gs.player.position.y + 12;
    const dx = cx - px;
    const dy = cy - py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = h.suctionRadius || 100;
    if (dist < radius) {
      const pullStrength = (1 - dist / radius) * (h.suctionStrength || 200);
      momentum.applyForce({ x: (dx / dist) * pullStrength * dt, y: (dy / dist) * pullStrength * dt });
      if (dist < 15) {
        feedback.trigger('predator_hit');
        stateManager.transition(States.GAME_OVER, { cause: 'hazard' });
        analytics.gameOver(config.levelIndex, 'hazard');
      }
    }
  }

  // 6. Predator proximity feedback
  const playerCenter = { x: gs.player.position.x + 16, y: gs.player.position.y + 12 };
  for (const pred of gs.predators) {
    const dist = pred._distanceTo(playerCenter);
    if (dist < 80) {
      feedback.trigger('predator_proximity', { intensity: (1 - dist / 80) * 0.4 });
      stress.addStress(5 * dt); // near-miss stress
    }
  }

  // 7. Exit zone check
  const ex = config.exitZone;
  const pb = gs.player.boundingBox;
  if (collision.testAABB(pb, ex)) {
    if (tutorial && !tutorial.hasShown('exit')) tutorial.tryShow('exit');
    const meetsEnergy = energy.meetsExitThreshold(config.exitEnergyThreshold);
    const meetsSpeed = momentum.getSpeed() >= config.exitMomentumThreshold * 60;
    if (meetsEnergy && meetsSpeed) {
      // Successful exit
      analytics.trackExitAttempt(true);
      const timeSpent = (Date.now() - (analytics._levelStats?.startTime || Date.now())) / 1000;
      const stars = calculateStars(config, timeSpent, energy.getEnergy(), analytics._levelStats?.rottenFoodHits || 0);
      const saveData = save.load() || save.getDefault();
      if (!saveData.completedLevels.includes(config.levelIndex)) {
        saveData.completedLevels.push(config.levelIndex);
      }
      saveData.currentLevel = config.levelIndex + 1;
      // Star rating
      const prevStars = saveData.starRatings[config.levelIndex] || 0;
      if (stars > prevStars) saveData.starRatings[config.levelIndex] = stars;
      save.save(saveData);
      analytics.levelComplete(config.levelIndex);
      audio.playTone(660, 0.1, 'sine');
      setTimeout(() => audio.playTone(880, 0.1, 'sine'), 100);
      setTimeout(() => audio.playTone(1100, 0.15, 'sine'), 200);
      stateManager.transition(States.LEVEL_TRANSITION);
      setTimeout(() => {
        if (stateManager.getState() === States.LEVEL_TRANSITION) {
          stateManager.transition(States.PROGRESS_MAP);
        }
      }, 1200);
    } else {
      analytics.trackExitAttempt(false);
      feedback.trigger('exit_fail');
      audio.playTone(200, 0.2, 'triangle'); // fail thud
    }
  }

  // 8. Stress (acts as a timer — always active)
  stress.update(dt, config.stressRate || 2.0);
  analytics.trackStress(stress.getStress());
  // Stress tier feedback
  const tier = stress.getThresholdTier();
  if (tier !== gs.previousStressTier) {
    if (tier === 'medium') feedback.trigger('stress_low');
    else if (tier === 'high') feedback.trigger('stress_medium');
    else if (tier === 'critical') feedback.trigger('stress_high');
    feedback.trigger('stress_threshold');
    gs.previousStressTier = tier;
  }
  if (tutorial && !tutorial.hasShown('stress') && stress.getStress() > 10) {
    tutorial.tryShow('stress');
  }
  if (stress.isMaxed()) {
    stateManager.transition(States.GAME_OVER, { cause: 'stress' });
    analytics.gameOver(config.levelIndex, 'stress');
  }

  // 10. Predator AI
  for (const pred of gs.predators) {
    pred.update(dt, playerCenter, config.exitZone);
    if (tutorial && !tutorial.hasShown('predator') && pred.isAware) {
      tutorial.tryShow('predator');
    }
  }

  // 11. Animation, Feedback & HUD update
  // Update player animation state
  const playerAnimState = energy.getEnergy() < 20 ? 'low_energy' : isMoving ? 'swimming' : 'idle';
  gs.player.animationState = playerAnimState;
  animation.play('player', `player_${playerAnimState}`);
  // Update predator animations
  for (const pred of gs.predators) {
    animation.play(pred.id || `pred_${gs.predators.indexOf(pred)}`, `predator_${pred.animationState}`);
  }
  animation.update(dt);
  feedback.update(dt);
  hud.update(dt);

  input.flush();
}

// ── Render ─────────────────────────────────────────────────
function render(alpha) {
  const state = stateManager.getState();
  const cw = canvas.width;
  const ch = canvas.height;

  // ── Cutscene ──
  if (state === States.CUTSCENE) {
    camera.clear(ctx);
    camera.resetTransform(ctx);
    cutscene.render(ctx, cw, ch);
    return;
  }

  // ── Settings ──
  if (state === States.SETTINGS) {
    camera.clear(ctx);
    camera.resetTransform(ctx);
    settingsMenu.render(ctx, cw, ch);
    return;
  }

  // ── Main Menu ──
  if (state === States.MAIN_MENU) {
    camera.clear(ctx);
    camera.resetTransform(ctx);
    const dpr = window.devicePixelRatio || 1;
    // Scale context so we can use CSS-pixel font sizes
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sw = cw / dpr; // screen width in CSS pixels
    const sh = ch / dpr; // screen height in CSS pixels

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, sw, sh);

    // Level select sub-screen
    if (gs.levelSelectActive) {
      ctx.fillStyle = '#88ccff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(strings.get('menu.level_select'), sw / 2, 40);
      const saveData = save.load();
      const completed = saveData ? saveData.completedLevels : [];
      const starRatings = saveData ? (saveData.starRatings || {}) : {};

      // Draw worlds with grouped tanks
      let worldY = 70;
      const boxSize = 50;
      const boxGap = 10;
      for (const world of WORLDS) {
        // World label
        ctx.fillStyle = '#88ccff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(world.name, 30, worldY + 14);

        // Tank boxes
        const startX = 200;
        for (let t = 0; t < world.tanks.length; t++) {
          const tankIdx = world.tanks[t];
          const x = startX + t * (boxSize + boxGap);
          const y = worldY;
          const unlocked = completed.includes(tankIdx);
          const selected = tankIdx === gs.levelSelectIndex;
          ctx.fillStyle = unlocked ? (selected ? '#ffcc00' : '#22cc44') : '#333';
          ctx.fillRect(x, y, boxSize, boxSize);
          ctx.strokeStyle = selected ? '#fff' : '#555';
          ctx.lineWidth = selected ? 3 : 1;
          ctx.strokeRect(x, y, boxSize, boxSize);
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${tankIdx + 1}`, x + boxSize / 2, y + 22);
          if (unlocked && starRatings[tankIdx]) {
            ctx.fillStyle = '#ffcc00';
            ctx.font = '11px sans-serif';
            ctx.fillText('★'.repeat(starRatings[tankIdx]) + '☆'.repeat(3 - starRatings[tankIdx]), x + boxSize / 2, y + 40);
          }
          if (!unlocked) {
            ctx.fillStyle = '#666';
            ctx.font = '14px sans-serif';
            ctx.fillText('🔒', x + boxSize / 2, y + 35);
          }
        }
        worldY += boxSize + 16;
      }

      ctx.fillStyle = '#888';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('←→ Select   Enter Play   Esc Back', sw / 2, sh - 30);
      return;
    }

    // New game confirmation dialog
    // Title logo (600x600, centered)
    if (titleLogo.complete && titleLogo.naturalWidth > 0) {
      const logoSize = 600;
      const scale = Math.min(sw * 0.5 / logoSize, (sh * 0.4) / logoSize);
      const drawW = logoSize * scale;
      const drawH = logoSize * scale;
      ctx.drawImage(titleLogo, sw / 2 - drawW / 2, 20, drawW, drawH);
    } else {
      // Fallback text while logo loads
      ctx.fillStyle = '#ff9900';
      ctx.font = 'bold 48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Fish Food', sw / 2, sh / 3);
    }

    // Build menu items dynamically
    const hasSave = save.hasSaveData();
    const saveData = hasSave ? save.load() : null;
    const hasCompleted = saveData && saveData.completedLevels && saveData.completedLevels.length > 0;
    const menuLabels = [];
    menuLabels.push(hasSave ? strings.get('menu.new_game') : strings.get('menu.start'));

    for (let i = 0; i < menuLabels.length; i++) {
      const selected = i === gs.menuSelection;
      ctx.fillStyle = selected ? '#ffcc00' : '#ccc';
      ctx.font = selected ? 'bold 32px sans-serif' : '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(menuLabels[i], sw / 2, sh * 0.55 + i * 50);
    }
    ctx.fillStyle = '#666';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Developer Note: To jump to a tank, add "index.html?level=0" to the URL (0-12).', sw / 2, sh * 0.55 + menuLabels.length * 50 + 30);
    // Version
    ctx.fillStyle = '#444';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('v0.1.0-mvp', sw - 12, sh - 10);
    return;
  }

  // ── Game Over ──
  if (state === States.GAME_OVER) {
    camera.clear(ctx);
    camera.resetTransform(ctx);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    const cause = stateManager.getParams().cause || 'unknown';
    ctx.fillText(strings.get(`gameover.${cause}`), cw / 2, ch / 2 - 30);
    ctx.fillStyle = '#ffcc00';
    ctx.font = '20px sans-serif';
    ctx.fillText(strings.get('gameover.encourage'), cw / 2, ch / 2 + 10);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Press Space to ${strings.get('menu.retry')}`, cw / 2, ch / 2 + 50);
    return;
  }

  // ── Progress Map ──
  if (state === States.PROGRESS_MAP) {
    camera.clear(ctx);
    camera.resetTransform(ctx);
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sw = cw / dpr;
    const sh = ch / dpr;

    ctx.fillStyle = '#0a2a4a';
    ctx.fillRect(0, 0, sw, sh);

    const levelCount = LEVEL_PATHS.length;
    const currentLevel = stateManager.getCurrentLevelIndex() + 1;
    const saveData = save.load();
    const completed = saveData ? saveData.completedLevels : [];
    const starRatings = saveData ? (saveData.starRatings || {}) : {};
    const allComplete = completed.length >= levelCount;

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(allComplete ? 'Game Complete!' : 'Progress Map', sw / 2, 40);

    // Completion summary
    if (allComplete) {
      let totalStars = 0;
      for (let i = 0; i < levelCount; i++) totalStars += (starRatings[i] || 0);
      const maxStars = levelCount * 3;
      ctx.fillStyle = '#ffcc00';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Total Stars: ${totalStars} / ${maxStars}`, sw / 2, 65);
    }

    // World-grouped level grid (centered, no world names, hide bonus level)
    const visibleWorlds = WORLDS.slice(0, -1); // hide the bonus world
    const boxSize = 50;
    const boxGap = 12;
    const totalWorldRows = visibleWorlds.length;
    const maxTanksPerRow = Math.max(...visibleWorlds.map(w => w.tanks.length));
    const gridWidth = maxTanksPerRow * (boxSize + boxGap) - boxGap;
    const gridHeight = totalWorldRows * (boxSize + 20) - 20;
    const gridStartY = (sh - gridHeight) / 2 + 10;

    let worldY = gridStartY;
    for (const world of visibleWorlds) {
      // Tank boxes for this world (centered horizontally)
      const rowWidth = world.tanks.length * (boxSize + boxGap) - boxGap;
      const startX = (sw - rowWidth) / 2;
      for (let t = 0; t < world.tanks.length; t++) {
        const tankIdx = world.tanks[t];
        const x = startX + t * (boxSize + boxGap);
        const y = worldY;
        const isCompleted = completed.includes(tankIdx);
        const isCurrent = tankIdx === currentLevel;
        ctx.fillStyle = isCompleted ? '#22cc44' : isCurrent ? '#ffcc00' : '#333';
        ctx.fillRect(x, y, boxSize, boxSize);
        ctx.strokeStyle = isCurrent ? '#fff' : '#555';
        ctx.lineWidth = isCurrent ? 2 : 1;
        ctx.strokeRect(x, y, boxSize, boxSize);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tankIdx + 1}`, x + boxSize / 2, y + 22);
        if (isCompleted && starRatings[tankIdx]) {
          ctx.fillStyle = '#ffcc00';
          ctx.font = '11px sans-serif';
          ctx.fillText('★'.repeat(starRatings[tankIdx]) + '☆'.repeat(3 - starRatings[tankIdx]), x + boxSize / 2, y + 40);
        }
      }
      worldY += boxSize + 20;
    }

    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press any key to continue', sw / 2, sh - 30);
    return;
  }

  // ── Level Transition ──
  if (state === States.LEVEL_TRANSITION) {
    camera.clear(ctx);
    camera.resetTransform(ctx);
    ctx.fillStyle = '#0a3a5a';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#44ff88';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Level Complete!', cw / 2, ch / 2 - 10);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('🐟', cw / 2, ch / 2 + 30);
    return;
  }

  // ── Paused ──
  if (state === States.PAUSED) {
    renderer.render(gs);
    camera.resetTransform(ctx);
    hud.render(ctx, {
      energy: energy.getEnergy(), stress: stress.getStress(),
      exitThreshold: gs.levelConfig?.exitEnergyThreshold,
    });
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', cw / 2, ch / 2 - 40);
    ctx.font = '18px sans-serif';
    const pauseItems = ['Resume (Esc)', 'Restart Level (R)', 'Settings (S)', 'Quit to Menu (Q)'];
    for (let i = 0; i < pauseItems.length; i++) {
      ctx.fillStyle = '#ccc';
      ctx.fillText(pauseItems[i], cw / 2, ch / 2 + i * 30);
    }
    return;
  }

  // ── Playing state ──
  if (state === States.PLAYING) {
    // Apply screen shake offset
    const shake = feedback.getShakeOffset();
    renderer.render(gs);

    // Drop-in wake bubbles (rendered in game space)
    if (gs.dropBubbles && gs.dropBubbles.length > 0) {
      camera.applyTransform(ctx);
      for (const b of gs.dropBubbles) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${b.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      camera.resetTransform(ctx);
    }

    // Feedback overlays (in game space)
    camera.applyTransform(ctx);
    if (shake.x !== 0 || shake.y !== 0) {
      ctx.translate(shake.x, shake.y);
    }
    camera.resetTransform(ctx);

    // Feedback screen effects
    feedback.render(ctx, cw, ch);

    // HUD
    hud.render(ctx, {
      energy: energy.getEnergy(),
      stress: stress.getStress(),
      exitThreshold: gs.levelConfig?.exitEnergyThreshold,
    });

    // Tutorial overlay
    if (tutorial && tutorial.isBlocking()) {
      tutorial.render(ctx, cw, ch);
    }

    // Active bonus indicator
    if (gs.activeEffects.speedBoost > 0) {
      ctx.fillStyle = '#ff00ff';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`⚡ Speed Boost: ${gs.activeEffects.speedBoost.toFixed(1)}s`, 12, 24);
    }
    if (gs.activeEffects.energyShield > 0) {
      ctx.fillStyle = '#00ccff';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`🛡 Energy Shield: ${gs.activeEffects.energyShield.toFixed(1)}s`, 12, 42);
    }

    // Debug overlay
    if (debug.isEnabled()) {
      debug.render(ctx, cw, ch, {
        state: stateManager.getState(),
        levelIndex: stateManager.getCurrentLevelIndex(),
        tankTheme: gs.levelConfig?.tankTheme,
        worldName: gs.levelConfig?.worldName,
        playerX: gs.player?.position.x,
        playerY: gs.player?.position.y,
        velX: momentum.getVelocity().x,
        velY: momentum.getVelocity().y,
        speed: momentum.getSpeed(),
        energy: energy.getEnergy(),
        stress: stress.getStress(),
        stressTier: gs.levelConfig?.stressEnabled ? stress.getThresholdTier() : 'off',
        foodCount: gs.foodPellets.filter(f => f.active).length,
        predatorCount: gs.predators.length,
        entityCount: entityPool.getActiveCount('foodPellet') + entityPool.getActiveCount('rottenFood') + entityPool.getActiveCount('particle'),
        bonusCount: gs.bonusPickups.length,
        shieldTimer: gs.activeEffects.energyShield,
        speedTimer: gs.activeEffects.speedBoost,
      });
    }
  }
}

// ── Window blur → auto-pause ───────────────────────────────
window.addEventListener('blur', () => {
  if (stateManager.getState() === States.PLAYING) {
    stateManager.transition(States.PAUSED);
  }
});

// ── Pause/Resume via state transitions ─────────────────────
stateManager.onTransition((oldState, newState) => {
  if (newState === States.PAUSED) { audio.duckMusic(); }
  if (oldState === States.PAUSED && newState === States.PLAYING) { audio.unduckMusic(); }
  if (newState === States.MAIN_MENU) audio.stopMusic();
});

// ── Wrapped update with pause handling ─────────────────────
function wrappedUpdate(dt) {
  const state = stateManager.getState();
  if (state === States.PAUSED) {
    // Pause menu input
    if (input.isPausePressed()) {
      stateManager.transition(States.PLAYING);
    } else if (input._justPressed['KeyR']) {
      loadLevel(stateManager.getCurrentLevelIndex());
      stateManager.transition(States.PLAYING);
    } else if (input._justPressed['KeyS']) {
      stateManager.transition(States.SETTINGS, { from: 'paused' });
    } else if (input._justPressed['KeyQ']) {
      stateManager.transition(States.MAIN_MENU);
    }
    input.flush();
    return;
  }

  // Debug: N = next level, P = previous level (only in debug mode while playing)
  if (debug.isEnabled() && state === States.PLAYING) {
    if (input._justPressed['KeyN']) {
      const next = Math.min(LEVEL_PATHS.length - 1, stateManager.getCurrentLevelIndex() + 1);
      loadLevel(next);
      input.flush();
      return;
    }
    if (input._justPressed['KeyP']) {
      const prev = Math.max(0, stateManager.getCurrentLevelIndex() - 1);
      loadLevel(prev);
      input.flush();
      return;
    }
  }

  update(dt);
}

// ── Start ──────────────────────────────────────────────────
const gameLoop = new GameLoop({ update: wrappedUpdate, render });

async function init() {
  await strings.load('src/config/strings-en.json');
  tutorial = new TutorialSystem(strings, save);
  settingsMenu = new SettingsMenu(strings, save);

  // Apply saved settings
  const s = settingsMenu.getSettings();
  feedback.setMotionReduction(s.motionReduction);
  input.setInputMode(s.inputMode);
  input.setSensitivity(s.inputSensitivity);
  audio.applySettings(s);

  // Initialize audio on first user interaction
  const initAudio = () => {
    if (!audioInitialized) {
      audio._ensureContext();
      audioInitialized = true;
    }
  };
  window.addEventListener('keydown', initAudio, { once: true });
  window.addEventListener('click', initAudio, { once: true });
  window.addEventListener('touchstart', initAudio, { once: true });

  console.log('Fish Food ready 🐟');

  // Debug mode: check URL params
  debug.init();
  const levelOverride = debug.getLevelOverride();

  // Validate all levels in debug mode
  if (debug.isEnabled()) {
    console.log('Debug: validating all level configs...');
    for (const path of LEVEL_PATHS) {
      try {
        const config = await levelLoader.load(path);
        const result = validateLevel(config);
        if (!result.valid) {
          console.error(`Level validation FAILED: ${path}`, result.errors);
        }
        if (result.warnings.length > 0) {
          console.warn(`Level warnings: ${path}`, result.warnings);
        }
        if (result.valid && result.warnings.length === 0) {
          console.log(`Level OK: ${path}`);
        }
      } catch (e) {
        console.error(`Failed to load/validate ${path}:`, e);
      }
    }
  }

  if (levelOverride >= 0 && levelOverride < LEVEL_PATHS.length) {
    // Skip menus, jump straight to the specified level
    console.log(`Debug: loading level ${levelOverride} directly`);
    await loadLevel(levelOverride);
    stateManager.transition(States.PLAYING);
  }

  gameLoop.start();
}

init().catch(err => console.error('Failed to initialize:', err));

// ── Global error handler ───────────────────────────────────
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
  if (stateManager.getState() === States.PLAYING) {
    try {
      stateManager.transition(States.PAUSED);
      gameLoop.pause();
    } catch (e) { /* prevent recursive errors */ }
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
