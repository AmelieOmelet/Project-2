const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const statusEl = document.getElementById("status");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const thrustBtn = document.getElementById("thrustBtn");
const fireBtn = document.getElementById("fireBtn");
const startScreen = document.getElementById("startScreen");
const startBtn = document.getElementById("startBtn");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const SHIP_SIZE = 13;
const SHIP_THRUST = 0.10;
const SHIP_FRICTION = 0.985;
const SHIP_TURN_SPEED = 0.15;
const MAX_SHIP_SPEED = 5.8;
const BULLET_SPEED = 8;
const BULLET_LIFETIME = 66;
const BULLET_COOLDOWN = 95;
const FRENZY_DURATION_MS = 5000;
const FRENZY_FIRE_INTERVAL = 48;
const ASTEROID_BASE_SPEED = 1.2;
const INVULN_MS = 2200;
const BLINK_MS = 120;
const SHIELD_DURATION_MS = 5000;
const SHIELD_PICKUP_RADIUS = 10;
const SHIELD_PICKUP_LIFETIME = 720;
const SHIELD_SPAWN_MIN_MS = 9000;
const SHIELD_SPAWN_MAX_MS = 14000;
const SHOT_SOUND_MIN_INTERVAL_MS = 55;
const MUSIC_STEP_MS = 300;

const ASTEROID_TYPES = {
  common: { health: 1, color: "#79f2ff", accent: "#d8fdff", hitScore: 6, destroyBonus: 0 },
  dense: { health: 2, color: "#ffd166", accent: "#fff0b8", hitScore: 11, destroyBonus: 20 },
  titan: { health: 3, color: "#ff6f91", accent: "#ffd3dd", hitScore: 16, destroyBonus: 45 },
};

const LEVEL_THEMES = [
  {
    name: "Cobalt Drift",
    starColor: "246, 242, 220",
    planetInner: "#7aa6ff",
    planetMid: "#6b7cf0",
    planetOuter: "#483d8b",
    glowColor: "121, 242, 255",
    ringColor: "rgba(246, 242, 220, 0.34)",
    shootingColor: "255, 245, 200",
    planetAnchorX: 0.82,
    planetAnchorY: 0.2,
    baseShootingStars: 3,
  },
  {
    name: "Amber Belt",
    starColor: "255, 238, 191",
    planetInner: "#ffcf6a",
    planetMid: "#d98a54",
    planetOuter: "#7d3f31",
    glowColor: "255, 176, 84",
    ringColor: "rgba(255, 225, 170, 0.38)",
    shootingColor: "255, 218, 148",
    planetAnchorX: 0.17,
    planetAnchorY: 0.22,
    baseShootingStars: 4,
  },
  {
    name: "Verdant Void",
    starColor: "218, 255, 231",
    planetInner: "#8ee8ad",
    planetMid: "#3fb58f",
    planetOuter: "#1d5f57",
    glowColor: "122, 255, 181",
    ringColor: "rgba(202, 255, 231, 0.35)",
    shootingColor: "207, 255, 224",
    planetAnchorX: 0.79,
    planetAnchorY: 0.76,
    baseShootingStars: 3,
  },
  {
    name: "Crimson Night",
    starColor: "255, 222, 222",
    planetInner: "#ff8f9c",
    planetMid: "#c35674",
    planetOuter: "#60233f",
    glowColor: "255, 111, 145",
    ringColor: "rgba(255, 213, 223, 0.36)",
    shootingColor: "255, 206, 206",
    planetAnchorX: 0.24,
    planetAnchorY: 0.72,
    baseShootingStars: 5,
  },
];

let ship;
let bullets = [];
let asteroids = [];
let particles = [];
let stars = [];
let shootingStars = [];
let shieldPickups = [];
let planet;
let currentTheme = LEVEL_THEMES[0];

let score = 0;
let lives = 3;
let level = 1;
let gameOver = false;
let gameStarted = false;
let canShootAt = 0;
let frenzyUntil = 0;
let nextFrenzyScore = 1000;
let shieldUntil = 0;
let nextShieldSpawnAt = 0;
let lastTime = performance.now();
let audioCtx = null;
let nextShotSoundAt = 0;
let musicTimerId = null;
let musicStep = 0;

const keys = {
  left: false,
  right: false,
  thrust: false,
  reverseThrust: false,
  fire: false,
};

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function getAudioContext() {
  if (audioCtx) return audioCtx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioCtx = new AudioContextClass();
  return audioCtx;
}

function unlockAudio() {
  const ac = getAudioContext();
  if (!ac) return;
  if (ac.state !== "running") {
    ac.resume().catch(() => {});
  }
}

function playTone({
  type = "square",
  freq = 440,
  endFreq = freq,
  duration = 0.09,
  volume = 0.04,
  attack = 0.004,
  release = 0.06,
}) {
  const ac = getAudioContext();
  if (!ac || ac.state !== "running") return;

  const now = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

  osc.connect(gain);
  gain.connect(ac.destination);

  osc.start(now);
  osc.stop(now + duration + release + 0.01);
}

function playShotSound() {
  const now = performance.now();
  if (now < nextShotSoundAt) return;
  nextShotSoundAt = now + SHOT_SOUND_MIN_INTERVAL_MS;
  playTone({ type: "square", freq: 620, endFreq: 420, duration: 0.05, volume: 0.028, release: 0.04 });
}

function playAsteroidHitSound() {
  playTone({ type: "triangle", freq: 300, endFreq: 180, duration: 0.07, volume: 0.03, release: 0.05 });
}

function playAsteroidBreakSound() {
  playTone({ type: "sawtooth", freq: 190, endFreq: 78, duration: 0.12, volume: 0.035, release: 0.08 });
}

function playShieldPickupSound() {
  playTone({ type: "sine", freq: 540, endFreq: 880, duration: 0.11, volume: 0.035, release: 0.06 });
  playTone({ type: "triangle", freq: 740, endFreq: 1120, duration: 0.09, volume: 0.02, release: 0.06 });
}

function playDamageSound() {
  playTone({ type: "sawtooth", freq: 240, endFreq: 95, duration: 0.16, volume: 0.04, release: 0.1 });
}

function playLevelUpSound() {
  playTone({ type: "triangle", freq: 360, endFreq: 720, duration: 0.1, volume: 0.028, release: 0.05 });
}

function playGameOverSound() {
  playTone({ type: "square", freq: 190, endFreq: 60, duration: 0.26, volume: 0.045, release: 0.15 });
}

function pitchShift(baseFreq, semitones) {
  return baseFreq * 2 ** (semitones / 12);
}

function tickSynthMusic() {
  if (!gameStarted || gameOver) return;

  const progression = [
    { root: 196.0, bass: 98.0, chordSemitones: [0, 4, 7, 11] },
    { root: 220.0, bass: 110.0, chordSemitones: [0, 4, 7, 11] },
    { root: 246.94, bass: 123.47, chordSemitones: [0, 4, 7, 10] },
    { root: 174.61, bass: 87.31, chordSemitones: [0, 3, 7, 10] },
  ];
  const leadPattern = [7, null, 11, null, 12, null, 11, null, 7, null, 4, null, 2, null, 4, null];
  const sparklePattern = [12, 7, 11, 7, 9, 7, 4, 7];

  const barIndex = Math.floor(musicStep / 16) % progression.length;
  const stepInBar = musicStep % 16;
  const sparkleStep = musicStep % 8;
  const section = progression[barIndex];
  const leadOffset = leadPattern[stepInBar];

  if (stepInBar === 0 || stepInBar === 8) {
    for (const semi of section.chordSemitones) {
      const note = pitchShift(section.root, semi);
      playTone({
        type: "sine",
        freq: note,
        endFreq: note * 1.002,
        duration: 1.15,
        volume: 0.0065,
        attack: 0.12,
        release: 0.34,
      });
    }
  }

  if (stepInBar % 8 === 0) {
    playTone({
      type: "triangle",
      freq: section.bass,
      endFreq: section.bass * 0.992,
      duration: 0.6,
      volume: 0.013,
      attack: 0.04,
      release: 0.28,
    });
  }

  if (stepInBar % 4 === 2) {
    const sparkleSemi = sparklePattern[sparkleStep];
    const sparkle = pitchShift(section.root, sparkleSemi);
    playTone({
      type: "sine",
      freq: sparkle,
      endFreq: sparkle * 1.003,
      duration: 0.18,
      volume: 0.006,
      attack: 0.03,
      release: 0.12,
    });
  }

  if (leadOffset !== null) {
    const lead = pitchShift(section.root, leadOffset);
    playTone({
      type: "sine",
      freq: lead,
      endFreq: lead * 1.002,
      duration: 0.32,
      volume: 0.0075,
      attack: 0.05,
      release: 0.16,
    });
  }

  musicStep += 1;
}

function startSynthMusic() {
  unlockAudio();
  if (musicTimerId || !gameStarted || gameOver) return;
  musicStep = 0;
  tickSynthMusic();
  musicTimerId = window.setInterval(tickSynthMusic, MUSIC_STEP_MS);
}

function stopSynthMusic() {
  if (!musicTimerId) return;
  window.clearInterval(musicTimerId);
  musicTimerId = null;
}

function wrap(obj) {
  if (obj.x < 0) obj.x += WIDTH;
  if (obj.x > WIDTH) obj.x -= WIDTH;
  if (obj.y < 0) obj.y += HEIGHT;
  if (obj.y > HEIGHT) obj.y -= HEIGHT;
}

function createShip() {
  return {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    invulnerableUntil: performance.now() + INVULN_MS,
    blinkUntil: performance.now() + INVULN_MS,
  };
}

function createAsteroid(x, y, radius = 44) {
  const angle = randomBetween(0, Math.PI * 2);
  const difficultyScale = getDifficultyScale();
  const speed = randomBetween(ASTEROID_BASE_SPEED, ASTEROID_BASE_SPEED + 0.8 + level * 0.08) * difficultyScale.speed;
  const vertices = Math.floor(randomBetween(8, 13));
  const variance = randomBetween(0.27, 0.46);
  const type = pickAsteroidType(radius);
  const definition = ASTEROID_TYPES[type];

  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius,
    rotation: randomBetween(-0.015, 0.015) * difficultyScale.rotation,
    angle: randomBetween(0, Math.PI * 2),
    type,
    health: definition.health,
    maxHealth: definition.health,
    shape: Array.from({ length: vertices }, (_, i) => {
      const pct = i / vertices;
      return {
        angle: pct * Math.PI * 2,
        offset: randomBetween(1 - variance, 1 + variance),
      };
    }),
  };
}

function getThemeForLevel(currentLevel) {
  return LEVEL_THEMES[(currentLevel - 1) % LEVEL_THEMES.length];
}

function getDifficultyScale() {
  return {
    speed: 1 + (level - 1) * 0.08,
    rotation: 1 + (level - 1) * 0.06,
  };
}

function getAsteroidSpawnCount() {
  return 4 + level + Math.floor(level / 2);
}

function pickAsteroidType(radius) {
  const roll = Math.random();
  const levelFactor = Math.min(0.5, level * 0.04);

  if (radius >= 34 && roll < 0.12 + levelFactor) return "titan";
  if (roll < 0.48 + levelFactor * 0.8) return "dense";
  return "common";
}

function downgradeAsteroidType(type) {
  if (type === "titan") return "dense";
  if (type === "dense") return "common";
  return "common";
}

function spawnAsteroids(count) {
  const next = [];
  for (let i = 0; i < count; i += 1) {
    let x;
    let y;
    do {
      x = randomBetween(0, WIDTH);
      y = randomBetween(0, HEIGHT);
    } while (Math.hypot(x - ship.x, y - ship.y) < 160);
    next.push(createAsteroid(x, y, randomBetween(44, 62)));
  }
  asteroids = next;
}

function setupLevelBackground() {
  currentTheme = getThemeForLevel(level);

  const starCount = Math.min(180, 100 + level * 10);
  stars = Array.from({ length: starCount }, () => ({
    x: randomBetween(0, WIDTH),
    y: randomBetween(0, HEIGHT),
    r: randomBetween(0.4, 2.1),
    twinkle: randomBetween(0, Math.PI * 2),
    speed: randomBetween(0.003, 0.02) * (1 + level * 0.03),
  }));

  planet = {
    x: WIDTH * currentTheme.planetAnchorX,
    y: HEIGHT * currentTheme.planetAnchorY,
    radius: randomBetween(56, 82),
  };

  const shootingStarCount = Math.min(9, currentTheme.baseShootingStars + Math.floor(level / 2));
  shootingStars = Array.from({ length: shootingStarCount }, () => spawnShootingStar(true));
}

function spawnShootingStar(initial = false) {
  const difficultyScale = getDifficultyScale();
  const delay = initial ? randomBetween(20, 250) : randomBetween(70, 240);
  return {
    x: randomBetween(-WIDTH * 0.25, WIDTH * 0.8),
    y: randomBetween(-HEIGHT * 0.3, HEIGHT * 0.35),
    vx: randomBetween(4.8, 7.2) * (0.9 + level * 0.03) * difficultyScale.speed,
    vy: randomBetween(2.1, 3.8) * (0.92 + level * 0.028),
    length: randomBetween(44, 88),
    life: delay,
    active: initial ? Math.random() > 0.55 : true,
  };
}

function queueNextShieldSpawn(now = performance.now()) {
  nextShieldSpawnAt = now + randomBetween(SHIELD_SPAWN_MIN_MS, SHIELD_SPAWN_MAX_MS);
}

function spawnShieldPickup() {
  let x;
  let y;
  do {
    x = randomBetween(30, WIDTH - 30);
    y = randomBetween(30, HEIGHT - 30);
  } while (Math.hypot(x - ship.x, y - ship.y) < 140);

  shieldPickups.push({
    x,
    y,
    vx: randomBetween(-0.35, 0.35),
    vy: randomBetween(-0.35, 0.35),
    r: SHIELD_PICKUP_RADIUS,
    life: SHIELD_PICKUP_LIFETIME,
    phase: randomBetween(0, Math.PI * 2),
  });
}

function updateShootingStars(dt) {
  for (let i = 0; i < shootingStars.length; i += 1) {
    const star = shootingStars[i];
    if (!star.active) {
      star.life -= dt;
      if (star.life <= 0) {
        shootingStars[i] = spawnShootingStar();
      }
      continue;
    }

    star.x += star.vx * dt;
    star.y += star.vy * dt;
    star.life -= dt;

    if (star.x > WIDTH + 150 || star.y > HEIGHT + 150 || star.life <= 0) {
      shootingStars[i] = spawnShootingStar();
    }
  }
}

function fireBullet(cooldown = BULLET_COOLDOWN) {
  const now = performance.now();
  if (now < canShootAt || gameOver) return;
  canShootAt = now + cooldown;

  const dirX = Math.cos(ship.angle);
  const dirY = Math.sin(ship.angle);
  const sideX = -dirY;
  const sideY = dirX;
  const forwardOffset = SHIP_SIZE * 1.35;
  const sideOffset = SHIP_SIZE * 0.46;

  const launcherOffsets = [-sideOffset, sideOffset];
  for (const offset of launcherOffsets) {
    bullets.push({
      x: ship.x + dirX * forwardOffset + sideX * offset,
      y: ship.y + dirY * forwardOffset + sideY * offset,
      vx: ship.vx + dirX * BULLET_SPEED,
      vy: ship.vy + dirY * BULLET_SPEED,
      life: BULLET_LIFETIME,
    });
  }

  playShotSound();
}

function explode(x, y, amount = 16, color = "#ffd166") {
  for (let i = 0; i < amount; i += 1) {
    particles.push({
      x,
      y,
      vx: randomBetween(-2.6, 2.6),
      vy: randomBetween(-2.6, 2.6),
      life: randomBetween(22, 44),
      maxLife: 44,
      color,
    });
  }
}

function splitAsteroid(index) {
  const asteroid = asteroids[index];
  const r = asteroid.radius;
  const definition = ASTEROID_TYPES[asteroid.type] || ASTEROID_TYPES.common;

  asteroid.health -= 1;
  score += definition.hitScore;

  if (asteroid.health > 0) {
    explode(asteroid.x, asteroid.y, 8, definition.accent);
    playAsteroidHitSound();
    return;
  }

  score += definition.destroyBonus;

  if (r > 30) {
    const childType = downgradeAsteroidType(asteroid.type);
    const childA = createAsteroid(asteroid.x, asteroid.y, r * 0.62);
    const childB = createAsteroid(asteroid.x, asteroid.y, r * 0.62);
    childA.type = childType;
    childA.health = ASTEROID_TYPES[childType].health;
    childA.maxHealth = ASTEROID_TYPES[childType].health;
    childB.type = childType;
    childB.health = ASTEROID_TYPES[childType].health;
    childB.maxHealth = ASTEROID_TYPES[childType].health;
    asteroids.push(childA);
    asteroids.push(childB);
  } else if (r > 18) {
    const childType = downgradeAsteroidType(asteroid.type);
    const childA = createAsteroid(asteroid.x, asteroid.y, r * 0.58);
    const childB = createAsteroid(asteroid.x, asteroid.y, r * 0.58);
    childA.type = childType;
    childA.health = ASTEROID_TYPES[childType].health;
    childA.maxHealth = ASTEROID_TYPES[childType].health;
    childB.type = childType;
    childB.health = ASTEROID_TYPES[childType].health;
    childB.maxHealth = ASTEROID_TYPES[childType].health;
    asteroids.push(childA);
    asteroids.push(childB);
  } else {
    score += 30;
  }

  explode(asteroid.x, asteroid.y, 18, definition.color);
  playAsteroidBreakSound();
  asteroids.splice(index, 1);
}

function loseLife() {
  lives -= 1;
  explode(ship.x, ship.y, 32, "#ff6f91");
  playDamageSound();

  if (lives <= 0) {
    gameOver = true;
    statusEl.textContent = "regress back in time by pressing enter";
    playGameOverSound();
    stopSynthMusic();
    return;
  }

  ship = createShip();
  statusEl.textContent = "Hull hit. Repositioning...";
}

function nextLevelIfNeeded() {
  if (asteroids.length > 0) return;
  level += 1;
  setupLevelBackground();
  statusEl.textContent = `Wave ${level} incoming. Theme: ${currentTheme.name}`;
  playLevelUpSound();
  spawnAsteroids(getAsteroidSpawnCount());
}

function resetGame() {
  ship = createShip();
  bullets = [];
  asteroids = [];
  particles = [];
  shieldPickups = [];
  score = 0;
  lives = 3;
  level = 1;
  gameOver = false;
  canShootAt = 0;
  frenzyUntil = 0;
  nextFrenzyScore = 1000;
  shieldUntil = 0;
  queueNextShieldSpawn();
  setupLevelBackground();
  statusEl.textContent = `Clear the field. Theme: ${currentTheme.name}`;
  spawnAsteroids(getAsteroidSpawnCount());
  startSynthMusic();
}

function clearInputState() {
  keys.left = false;
  keys.right = false;
  keys.thrust = false;
  keys.reverseThrust = false;
  keys.fire = false;
}

function showStartScreen() {
  gameStarted = false;
  clearInputState();
  stopSynthMusic();
  statusEl.textContent = "Press Start to launch.";
  if (startScreen) startScreen.hidden = false;
}

function startGame() {
  if (gameStarted) return;
  unlockAudio();
  gameStarted = true;
  clearInputState();
  if (startScreen) startScreen.hidden = true;
  resetGame();
  startSynthMusic();
}

function update(dt) {
  const now = performance.now();

  if (!gameStarted) {
    scoreEl.textContent = String(score);
    livesEl.textContent = String(lives);
    levelEl.textContent = String(level);
    return;
  }

  if (!gameOver) {
    if (keys.left) ship.vx -= SHIP_THRUST * dt;
    if (keys.right) ship.vx += SHIP_THRUST * dt;
    if (keys.thrust) ship.vy -= SHIP_THRUST * dt;
    if (keys.reverseThrust) ship.vy += SHIP_THRUST * dt;

    const speed = Math.hypot(ship.vx, ship.vy);
    if (speed > MAX_SHIP_SPEED) {
      ship.vx = (ship.vx / speed) * MAX_SHIP_SPEED;
      ship.vy = (ship.vy / speed) * MAX_SHIP_SPEED;
    }

    ship.vx *= SHIP_FRICTION;
    ship.vy *= SHIP_FRICTION;

    const movementSpeed = Math.hypot(ship.vx, ship.vy);
    if (movementSpeed > 0.02) {
      ship.angle = Math.atan2(ship.vy, ship.vx);
    }

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    wrap(ship);

    if (keys.fire) fireBullet();
  }

  bullets = bullets.filter((bullet) => bullet.life > 0);
  for (const bullet of bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.x < 0 || bullet.x > WIDTH || bullet.y < 0 || bullet.y > HEIGHT) {
      bullet.life = 0;
    }
  }

  for (const asteroid of asteroids) {
    asteroid.x += asteroid.vx * dt;
    asteroid.y += asteroid.vy * dt;
    asteroid.angle += asteroid.rotation * dt;
    wrap(asteroid);
  }

  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }

  shieldPickups = shieldPickups.filter((pickup) => pickup.life > 0);
  for (const pickup of shieldPickups) {
    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;
    pickup.life -= dt;
    pickup.phase += 0.06 * dt;
    wrap(pickup);
  }

  if (!gameOver && shieldPickups.length === 0 && now >= nextShieldSpawnAt) {
    spawnShieldPickup();
    queueNextShieldSpawn(now);
  }

  for (let i = shieldPickups.length - 1; i >= 0; i -= 1) {
    const pickup = shieldPickups[i];
    if (Math.hypot(ship.x - pickup.x, ship.y - pickup.y) < SHIP_SIZE + pickup.r + 3) {
      shieldPickups.splice(i, 1);
      shieldUntil = Math.max(shieldUntil, now + SHIELD_DURATION_MS);
      statusEl.textContent = "Shield online: immunity for 5 seconds.";
      explode(ship.x, ship.y, 12, "#79f2ff");
      playShieldPickupSound();
      queueNextShieldSpawn(now);
    }
  }

  updateShootingStars(dt);

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    for (let j = asteroids.length - 1; j >= 0; j -= 1) {
      if (Math.hypot(bullets[i].x - asteroids[j].x, bullets[i].y - asteroids[j].y) < asteroids[j].radius + 3) {
        bullets.splice(i, 1);
        splitAsteroid(j);
        break;
      }
    }
  }

  while (score >= nextFrenzyScore) {
    frenzyUntil = now + FRENZY_DURATION_MS;
    nextFrenzyScore += 1000;
  }

  if (!gameOver && now < frenzyUntil) {
    fireBullet(FRENZY_FIRE_INTERVAL);
  }

  const invulnerable = now < ship.invulnerableUntil || now < shieldUntil;
  if (!gameOver && !invulnerable) {
    for (const asteroid of asteroids) {
      if (Math.hypot(ship.x - asteroid.x, ship.y - asteroid.y) < asteroid.radius + SHIP_SIZE * 0.85) {
        loseLife();
        break;
      }
    }
  }

  nextLevelIfNeeded();

  scoreEl.textContent = String(score);
  livesEl.textContent = String(lives);
  levelEl.textContent = String(level);
}

function drawShip(now) {
  const invulnerable = now < ship.blinkUntil;
  if (invulnerable && Math.floor(now / BLINK_MS) % 2 === 0) {
    return;
  }

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle + Math.PI / 2);

  const pixel = 2;
  const sprite = [
    "00011111110000",
    "00111111111100",
    "00111111111100",
    "00112222221100",
    "00122300232100",
    "00122300232100",
    "00012222221000",
    "00004444440000",
    "00045555554000",
    "00045566554000",
    "00045566554000",
    "00045555554000",
    "00005555550000",
    "00077000770000",
    "00077000770000",
  ];
  const palette = {
    "0": null,
    "1": "#0f1328",
    "2": "#f6d8c5",
    "3": "#1e2138",
    "4": "#ece8f2",
    "5": "#1a203a",
    "6": "#7b8ab0",
    "7": "#79f2ff",
  };

  const rows = sprite.length;
  const cols = sprite[0].length;
  const offsetX = -((cols * pixel) / 2);
  const offsetY = -((rows * pixel) / 2);

  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const color = palette[sprite[y][x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(offsetX + x * pixel, offsetY + y * pixel, pixel, pixel);
    }
  }

  if (keys.thrust && !gameOver) {
    const flameY = offsetY + rows * pixel + randomBetween(0.2, 1.7);
    ctx.fillStyle = "#ff9f68";
    ctx.fillRect(-pixel * 0.5, flameY, pixel, pixel * 1.9);
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-pixel * 0.28, flameY + pixel * 0.4, pixel * 0.56, pixel * 1.25);
  }

  ctx.restore();

  if (now < shieldUntil) {
    const pulse = 0.65 + Math.sin(now * 0.012) * 0.2;
    ctx.save();
    ctx.strokeStyle = `rgba(121, 242, 255, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, SHIP_SIZE + 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(246, 242, 220, 0.32)";
    ctx.beginPath();
    ctx.arc(ship.x, ship.y, SHIP_SIZE + 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.restore();
}

function drawAsteroid(asteroid) {
  const definition = ASTEROID_TYPES[asteroid.type] || ASTEROID_TYPES.common;
  const damagePct = 1 - asteroid.health / asteroid.maxHealth;

  ctx.save();
  ctx.translate(asteroid.x, asteroid.y);
  ctx.rotate(asteroid.angle);
  ctx.strokeStyle = definition.color;
  ctx.lineWidth = 2;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.06 + damagePct * 0.18})`;
  ctx.beginPath();

  asteroid.shape.forEach((point, index) => {
    const px = Math.cos(point.angle) * asteroid.radius * point.offset;
    const py = Math.sin(point.angle) * asteroid.radius * point.offset;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (damagePct > 0.01) {
    ctx.strokeStyle = definition.accent;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-asteroid.radius * 0.3, -asteroid.radius * 0.15);
    ctx.lineTo(asteroid.radius * 0.05, asteroid.radius * 0.05);
    ctx.lineTo(asteroid.radius * 0.3, -asteroid.radius * 0.18);
    ctx.stroke();
  }

  ctx.restore();
}

function draw(now) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const planetGlow = ctx.createRadialGradient(
    planet.x,
    planet.y,
    planet.radius * 0.2,
    planet.x,
    planet.y,
    planet.radius * 1.7
  );
  planetGlow.addColorStop(0, `rgba(${currentTheme.glowColor}, 0.5)`);
  planetGlow.addColorStop(1, `rgba(${currentTheme.glowColor}, 0)`);
  ctx.fillStyle = planetGlow;
  ctx.beginPath();
  ctx.arc(planet.x, planet.y, planet.radius * 1.7, 0, Math.PI * 2);
  ctx.fill();

  const planetFill = ctx.createLinearGradient(
    planet.x - planet.radius,
    planet.y - planet.radius,
    planet.x + planet.radius,
    planet.y + planet.radius
  );
  planetFill.addColorStop(0, currentTheme.planetInner);
  planetFill.addColorStop(0.5, currentTheme.planetMid);
  planetFill.addColorStop(1, currentTheme.planetOuter);
  ctx.fillStyle = planetFill;
  ctx.beginPath();
  ctx.arc(planet.x, planet.y, planet.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = currentTheme.ringColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(planet.x + planet.radius * 0.12, planet.y - 4, planet.radius * 1.28, planet.radius * 0.36, -0.32, 0, Math.PI * 2);
  ctx.stroke();

  for (const s of shootingStars) {
    if (!s.active) continue;
    const angle = Math.atan2(s.vy, s.vx);
    const tailX = s.x - Math.cos(angle) * s.length;
    const tailY = s.y - Math.sin(angle) * s.length;

    const trail = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
    trail.addColorStop(0, `rgba(${currentTheme.shootingColor}, 0.95)`);
    trail.addColorStop(1, `rgba(${currentTheme.shootingColor}, 0)`);

    ctx.strokeStyle = trail;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();
  }

  for (const star of stars) {
    const alpha = 0.2 + Math.abs(Math.sin(now * star.speed + star.twinkle)) * 0.8;
    ctx.fillStyle = `rgba(${currentTheme.starColor}, ${alpha})`;
    ctx.fillRect(star.x, star.y, star.r, star.r);
  }

  for (const asteroid of asteroids) {
    drawAsteroid(asteroid);
  }

  ctx.fillStyle = "#ffd166";
  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const pickup of shieldPickups) {
    const glow = 0.28 + Math.abs(Math.sin(pickup.phase)) * 0.35;
    ctx.fillStyle = `rgba(121, 242, 255, ${glow})`;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, pickup.r + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(246, 242, 220, 0.95)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, pickup.r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(121, 242, 255, 0.92)";
    ctx.beginPath();
    ctx.arc(pickup.x, pickup.y, pickup.r * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = `${p.color}${Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0")}`;
    ctx.fillRect(p.x, p.y, 2.4, 2.4);
  }

  drawShip(now);

  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.translate(WIDTH / 2 - 190, HEIGHT / 2 + 10);
    ctx.rotate(-0.22);

    // Handheld clock body glow.
    const clockGlow = ctx.createRadialGradient(0, 0, 12, 0, 0, 98);
    clockGlow.addColorStop(0, "rgba(255, 209, 102, 0.28)");
    clockGlow.addColorStop(1, "rgba(255, 209, 102, 0)");
    ctx.fillStyle = clockGlow;
    ctx.beginPath();
    ctx.arc(0, 0, 98, 0, Math.PI * 2);
    ctx.fill();

    // Clock casing.
    ctx.fillStyle = "rgba(10, 15, 30, 0.72)";
    ctx.strokeStyle = "rgba(255, 209, 102, 0.84)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Crown and handheld ring.
    ctx.fillStyle = "rgba(255, 209, 102, 0.75)";
    ctx.beginPath();
    ctx.arc(0, -79, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(246, 242, 220, 0.78)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -96, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Face and hour ticks.
    ctx.fillStyle = "rgba(246, 242, 220, 0.09)";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(121, 242, 255, 0.5)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 12; i += 1) {
      const angle = (Math.PI * 2 * i) / 12;
      const x0 = Math.cos(angle) * 42;
      const y0 = Math.sin(angle) * 42;
      const x1 = Math.cos(angle) * 50;
      const y1 = Math.sin(angle) * 50;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // Clock hands with slow drift to feel alive.
    const secondAngle = now * 0.003;
    const minuteAngle = now * 0.00035;
    ctx.strokeStyle = "rgba(246, 242, 220, 0.95)";
    ctx.lineCap = "round";

    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(minuteAngle) * 26, Math.sin(minuteAngle) * 26);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255, 111, 145, 0.92)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(secondAngle) * 40, Math.sin(secondAngle) * 40);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 209, 102, 0.96)";
    ctx.beginPath();
    ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Handle silhouette so it reads as handheld.
    ctx.fillStyle = "rgba(246, 242, 220, 0.13)";
    ctx.beginPath();
    ctx.moveTo(58, 50);
    ctx.quadraticCurveTo(104, 66, 122, 102);
    ctx.quadraticCurveTo(98, 111, 72, 86);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    ctx.fillStyle = "#ffd166";
    ctx.textAlign = "center";
    ctx.font = "700 42px Audiowide";
    ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 8);
    ctx.fillStyle = "#f6f2dc";
    ctx.font = "400 20px Space Mono";
    ctx.fillText("regress back in time by pressing enter", WIDTH / 2, HEIGHT / 2 + 34);
  }
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 16.6667, 2.2);
  lastTime = now;

  update(dt);
  draw(now);

  requestAnimationFrame(loop);
}

function setButtonHold(button, keyName) {
  const start = (event) => {
    event.preventDefault();
    unlockAudio();
    keys[keyName] = true;
  };
  const stop = (event) => {
    event.preventDefault();
    keys[keyName] = false;
  };

  button.addEventListener("pointerdown", start);
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointerleave", stop);
  button.addEventListener("pointercancel", stop);
}

const SCROLL_BLOCK_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

document.addEventListener(
  "keydown",
  (event) => {
    if (SCROLL_BLOCK_KEYS.has(event.code)) {
      event.preventDefault();
    }
  },
  { capture: true }
);

document.addEventListener(
  "keyup",
  (event) => {
    if (SCROLL_BLOCK_KEYS.has(event.code)) {
      event.preventDefault();
    }
  },
  { capture: true }
);

window.addEventListener("keydown", (event) => {
  unlockAudio();
  if (event.repeat) return;

  if (!gameStarted && (event.code === "Enter" || event.code === "Space")) {
    event.preventDefault();
    startGame();
    return;
  }

  if (
    event.code === "Numpad4" ||
    event.code === "Numpad6" ||
    event.code === "ArrowLeft" ||
    event.code === "ArrowRight" ||
    event.code === "ArrowUp" ||
    event.code === "ArrowDown" ||
    event.code === "KeyW" ||
    event.code === "KeyA" ||
    event.code === "KeyS" ||
    event.code === "KeyD" ||
    event.code === "Space"
  ) {
    event.preventDefault();
  }

  if (event.code === "Numpad4") keys.left = true;
  if (event.code === "Numpad6") keys.right = true;
  if (event.code === "ArrowLeft") keys.left = true;
  if (event.code === "ArrowRight") keys.right = true;
  if (event.code === "ArrowUp") keys.thrust = true;
  if (event.code === "ArrowDown") keys.reverseThrust = true;
  if (event.code === "KeyW") keys.thrust = true;
  if (event.code === "KeyS") keys.reverseThrust = true;
  if (event.code === "KeyA") keys.left = true;
  if (event.code === "KeyD") keys.right = true;
  if (event.code === "Space") {
    event.preventDefault();
    keys.fire = true;
    fireBullet();
  }
  if (event.code === "Enter" && gameOver) {
    resetGame();
  }
});

window.addEventListener("keyup", (event) => {
  if (
    event.code === "Numpad4" ||
    event.code === "Numpad6" ||
    event.code === "ArrowLeft" ||
    event.code === "ArrowRight" ||
    event.code === "ArrowUp" ||
    event.code === "ArrowDown" ||
    event.code === "KeyW" ||
    event.code === "KeyA" ||
    event.code === "KeyS" ||
    event.code === "KeyD" ||
    event.code === "Space"
  ) {
    event.preventDefault();
  }

  if (event.code === "Numpad4") keys.left = false;
  if (event.code === "Numpad6") keys.right = false;
  if (event.code === "ArrowLeft") keys.left = false;
  if (event.code === "ArrowRight") keys.right = false;
  if (event.code === "ArrowUp") keys.thrust = false;
  if (event.code === "ArrowDown") keys.reverseThrust = false;
  if (event.code === "KeyW") keys.thrust = false;
  if (event.code === "KeyS") keys.reverseThrust = false;
  if (event.code === "KeyA") keys.left = false;
  if (event.code === "KeyD") keys.right = false;
  if (event.code === "Space") keys.fire = false;
});

setButtonHold(leftBtn, "left");
setButtonHold(rightBtn, "right");
setButtonHold(thrustBtn, "thrust");

fireBtn.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  unlockAudio();
  keys.fire = true;
  fireBullet();
});

fireBtn.addEventListener("pointerup", (event) => {
  event.preventDefault();
  keys.fire = false;
});

fireBtn.addEventListener("pointerleave", () => {
  keys.fire = false;
});

if (startBtn) {
  startBtn.addEventListener("click", () => {
    unlockAudio();
    startGame();
  });
}

resetGame();
showStartScreen();
requestAnimationFrame(loop);
