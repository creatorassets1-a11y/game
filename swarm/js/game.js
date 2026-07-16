// SWARM!! - a very loud horde survival game.
// Everything here is tuned for one thing: making every frame feel like a
// tiny celebration. Sprites are pre-rendered cartoon blobs, damage numbers
// pop, gems vacuum, combos escalate, and the screen is never quite still.

(() => {
'use strict';

const W = 960, H = 540;
const WORLD = 2300;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', fit);
fit();

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);

// ---- save -----------------------------------------------------------------
const save = {
  get coins() { return +(localStorage.getItem('sw_coins') || 0); },
  set coins(v) { localStorage.setItem('sw_coins', Math.floor(v)); },
  get owned() { try { return JSON.parse(localStorage.getItem('sw_owned') || '["pip"]'); } catch (e) { return ['pip']; } },
  set owned(v) { localStorage.setItem('sw_owned', JSON.stringify(v)); },
  get best() { return +(localStorage.getItem('sw_best') || 0); },
  set best(v) { localStorage.setItem('sw_best', v); },
  get charId() { return localStorage.getItem('sw_char') || 'pip'; },
  set charId(v) { localStorage.setItem('sw_char', v); }
};

// ---- sprite factory ----------------------------------------------------------
// every creature is a chunky blob with an outline, a belly, and big eyes.
// pre-rendered at 2x so the whole horde is just drawImage.
const sprites = {};

function blobSprite(key, r, col, dark, opts = {}) {
  if (sprites[key]) return sprites[key];
  const S = 2, pad = 14;
  const cv = document.createElement('canvas');
  cv.width = cv.height = (r + pad) * 2 * S;
  const c = cv.getContext('2d');
  c.scale(S, S);
  c.translate(r + pad, r + pad);
  const flash = opts.flash;

  // feet
  c.fillStyle = flash ? '#fff' : dark;
  c.beginPath();
  c.ellipse(-r * 0.45, r * 0.82, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
  c.ellipse(r * 0.45, r * 0.82, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
  c.fill();

  // body: squished circle with outline
  c.fillStyle = flash ? '#fff' : col;
  c.strokeStyle = flash ? '#fff' : dark;
  c.lineWidth = 3.5;
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  c.fill();
  c.stroke();
  if (opts.elite && !flash) {
    c.strokeStyle = '#ffd23f';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, 0, r + 3, r * 0.92 + 3, 0, 0, Math.PI * 2);
    c.stroke();
  }

  if (!flash) {
    // belly
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(0, r * 0.35, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    // spikes for some
    if (opts.spiky) {
      c.fillStyle = dark;
      for (let i = -2; i <= 2; i++) {
        c.beginPath();
        c.moveTo(i * r * 0.3 - r * 0.12, -r * 0.75);
        c.lineTo(i * r * 0.3, -r * 1.18);
        c.lineTo(i * r * 0.3 + r * 0.12, -r * 0.75);
        c.fill();
      }
    }
    // eyes
    const er = Math.max(3.4, r * 0.24);
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(-r * 0.34, -r * 0.18, er, 0, Math.PI * 2);
    c.arc(r * 0.34, -r * 0.18, er, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#232333';
    c.beginPath();
    c.arc(-r * 0.34 + er * 0.25, -r * 0.18 + er * 0.2, er * 0.45, 0, Math.PI * 2);
    c.arc(r * 0.34 + er * 0.25, -r * 0.18 + er * 0.2, er * 0.45, 0, Math.PI * 2);
    c.fill();
    // angry brows for monsters, teeth for big ones
    if (opts.angry) {
      c.strokeStyle = '#232333';
      c.lineWidth = Math.max(2, r * 0.12);
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(-r * 0.55, -r * 0.52); c.lineTo(-r * 0.15, -r * 0.38);
      c.moveTo(r * 0.55, -r * 0.52); c.lineTo(r * 0.15, -r * 0.38);
      c.stroke();
    }
    if (opts.teeth) {
      c.fillStyle = '#fff';
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(i * r * 0.28 - r * 0.1, r * 0.28);
        c.lineTo(i * r * 0.28, r * 0.52);
        c.lineTo(i * r * 0.28 + r * 0.1, r * 0.28);
        c.fill();
      }
    }
    if (opts.crownd) {
      c.fillStyle = '#f4c542';
      c.strokeStyle = '#b8860b';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-r * 0.5, -r * 0.8);
      c.lineTo(-r * 0.5, -r * 1.25); c.lineTo(-r * 0.25, -r * 1.0);
      c.lineTo(0, -r * 1.3); c.lineTo(r * 0.25, -r * 1.0);
      c.lineTo(r * 0.5, -r * 1.25); c.lineTo(r * 0.5, -r * 0.8);
      c.closePath();
      c.fill(); c.stroke();
    }
  }
  sprites[key] = { cv, r: r + pad, S };
  return sprites[key];
}

function heroSprite(ch, flash) {
  const key = 'hero_' + ch.id + (flash ? '_f' : '');
  if (sprites[key]) return sprites[key];
  const r = 20, S = 2, pad = 20;
  const cv = document.createElement('canvas');
  cv.width = cv.height = (r + pad) * 2 * S;
  const c = cv.getContext('2d');
  c.scale(S, S);
  c.translate(r + pad, r + pad + 4);
  const dark = '#2a2a3a';
  c.fillStyle = flash ? '#fff' : dark;
  c.beginPath();
  c.ellipse(-r * 0.4, r * 0.8, r * 0.28, r * 0.18, 0, 0, Math.PI * 2);
  c.ellipse(r * 0.4, r * 0.8, r * 0.28, r * 0.18, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = flash ? '#fff' : ch.body;
  c.strokeStyle = flash ? '#fff' : dark;
  c.lineWidth = 3.5;
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.95, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();
  if (!flash) {
    c.fillStyle = ch.belly;
    c.beginPath();
    c.ellipse(0, r * 0.38, r * 0.52, r * 0.36, 0, 0, Math.PI * 2);
    c.fill();
    // eyes: friendly, big
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(-7, -5, 6, 0, Math.PI * 2); c.arc(7, -5, 6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#232333';
    c.beginPath(); c.arc(-5.6, -4, 3, 0, Math.PI * 2); c.arc(8.4, -4, 3, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(-6.4, -5, 1.1, 0, Math.PI * 2); c.arc(7.6, -5, 1.1, 0, Math.PI * 2); c.fill();
    // smile
    c.strokeStyle = '#232333';
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, 2, 5, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke();
    // hat
    c.strokeStyle = dark;
    c.fillStyle = ch.hatCol;
    c.lineWidth = 3;
    if (ch.hat === 'wizard') {
      c.beginPath();
      c.moveTo(-13, -13); c.lineTo(13, -13); c.lineTo(2, -34);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.arc(2, -34, 3.4, 0, Math.PI * 2); c.fill();
    } else if (ch.hat === 'ears') {
      c.beginPath();
      c.moveTo(-14, -10); c.lineTo(-10, -26); c.lineTo(-2, -14);
      c.moveTo(14, -10); c.lineTo(10, -26); c.lineTo(2, -14);
      c.fill(); c.stroke();
    } else if (ch.hat === 'round') {
      c.beginPath(); c.arc(-12, -14, 5, 0, Math.PI * 2); c.arc(12, -14, 5, 0, Math.PI * 2); c.fill(); c.stroke();
    } else if (ch.hat === 'antenna') {
      c.beginPath(); c.moveTo(0, -17); c.lineTo(0, -30); c.stroke();
      c.fillStyle = '#ff5f5f';
      c.beginPath(); c.arc(0, -32, 4, 0, Math.PI * 2); c.fill();
    } else if (ch.hat === 'cat') {
      c.beginPath();
      c.moveTo(-15, -8); c.lineTo(-12, -24); c.lineTo(-3, -13);
      c.moveTo(15, -8); c.lineTo(12, -24); c.lineTo(3, -13);
      c.fill(); c.stroke();
    } else if (ch.hat === 'crown') {
      c.fillStyle = '#f4c542';
      c.beginPath();
      c.moveTo(-11, -13); c.lineTo(-11, -26); c.lineTo(-5, -19); c.lineTo(0, -28);
      c.lineTo(5, -19); c.lineTo(11, -26); c.lineTo(11, -13);
      c.closePath(); c.fill(); c.stroke();
    }
  }
  sprites[key] = { cv, r: r + pad, S };
  return sprites[key];
}

function sawSprite() {
  if (sprites.saw) return sprites.saw;
  const r = 15, S = 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = r * 2 * S + 8;
  const c = cv.getContext('2d');
  c.scale(S, S);
  c.translate(r + 2, r + 2);
  c.fillStyle = '#dfe8ff';
  c.strokeStyle = '#5f74d8';
  c.lineWidth = 2.5;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    c.lineTo(Math.cos(a + 0.22) * r * 0.55, Math.sin(a + 0.22) * r * 0.55);
  }
  c.closePath();
  c.fill(); c.stroke();
  sprites.saw = { cv, r: r + 2, S };
  return sprites.saw;
}

function drawSprite(sp, x, y, scale = 1, rot = 0, squash = 1) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.scale(scale, scale * squash);
  ctx.drawImage(sp.cv, -sp.r, -sp.r, sp.r * 2, sp.r * 2);
  ctx.restore();
}

// ---- input --------------------------------------------------------------------
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  Snd.unlock();
  if (e.code === 'KeyM') Snd.toggleMute();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state === 'play') state = 'pause';
    else if (state === 'pause') state = 'play';
  }
  if (state === 'levelup' && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
    pickCard(+e.code.slice(5) - 1);
  }
  if ((state === 'title' || state === 'dead' || state === 'victory') && (e.code === 'Enter' || e.code === 'Space')) {
    uiAction();
  }
  if (state === 'title') {
    if (e.code === 'ArrowLeft') { charSel = (charSel + DATA.CHARS.length - 1) % DATA.CHARS.length; Snd.ui(); }
    if (e.code === 'ArrowRight') { charSel = (charSel + 1) % DATA.CHARS.length; Snd.ui(); }
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// pointer: drag anywhere = move stick; taps on UI
let stick = null;   // {ox,oy,dx,dy}
let tap = null;
function cpos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  Snd.unlock();
  const p = cpos(e);
  if (state === 'play') stick = { ox: p.x, oy: p.y, dx: 0, dy: 0, id: e.pointerId };
  tap = p;
});
canvas.addEventListener('pointermove', e => {
  if (stick && e.pointerId === stick.id) {
    const p = cpos(e);
    stick.dx = p.x - stick.ox;
    stick.dy = p.y - stick.oy;
    const m = Math.hypot(stick.dx, stick.dy);
    if (m > 46) { stick.dx *= 46 / m; stick.dy *= 46 / m; }
  }
});
window.addEventListener('pointerup', e => {
  if (stick && e.pointerId === stick.id) stick = null;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---- game state ------------------------------------------------------------------
let state = 'title';
let frame = 0;
let charSel = Math.max(0, DATA.CHARS.findIndex(c => c.id === save.charId));
let shake = 0, flashRed = 0, slowmo = 0;

let P = null;           // player
let enemies = [], bullets = [], orbs = [], parts = [], dnums = [], beams = [], spits = [];
let boss = null;
let wave = 1, waveT = 0, waveSplash = 0, spawnT = 0, betweenT = 0;
let kills = 0, runCoins = 0, combo = 0, comboT = 0, comboBest = 0;
let cards = [], cardAnim = 0;
let deadT = 0, victoryT = 0;
let titleHorde = [];

function newRun() {
  const ch = DATA.CHARS[charSel];
  P = {
    ch, x: WORLD / 2, y: WORLD / 2, r: 17,
    hp: ch.hp, maxHp: ch.hp,
    speed: 2.6 * ch.speed, dmgMul: ch.dmg,
    xp: 0, level: 1, need: 6,
    weapons: {}, passives: {},
    timers: {}, orbitA: 0, face: 1, iv: 0, moving: 0
  };
  P.weapons[ch.start] = 1;
  if (ch.extraStart) P.weapons[ch.extraStart] = 1;
  enemies = []; bullets = []; orbs = []; parts = []; dnums = []; beams = []; spits = [];
  boss = null;
  wave = 1; waveT = 0; waveSplash = 90; spawnT = 0; betweenT = 0;
  kills = 0; runCoins = 0; combo = 0; comboT = 0; comboBest = 0;
  slowmo = 0;
  state = 'play';
  Snd.music(0);
}

function uiAction() {
  if (state === 'title') tryStart();
  else if (state === 'dead' || state === 'victory') { bankAndTitle(); }
}
function tryStart() {
  const ch = DATA.CHARS[charSel];
  if (save.owned.includes(ch.id)) {
    save.charId = ch.id;
    Snd.go();
    newRun();
  } else if (save.coins >= ch.cost) {
    save.coins = save.coins - ch.cost;
    save.owned = [...save.owned, ch.id];
    Snd.buy();
  } else Snd.deny();
}
function bankAndTitle() {
  save.coins = save.coins + runCoins;
  save.best = Math.max(save.best, wave);
  state = 'title';
  Snd.music(-1);
}

// ---- juice helpers -----------------------------------------------------------------
function burst(x, y, n, col, spd = 4, grav = 0.12) {
  for (let i = 0; i < n && parts.length < 500; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rnd(0.4, 1) * spd;
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, g: grav, life: rnd(18, 40), col, r: rnd(2, 5) });
  }
}
function dnum(x, y, v, col, big) {
  if (dnums.length > 60) dnums.shift();
  dnums.push({ x: x + rnd(-8, 8), y, vy: -1.6, life: 38, v: Math.round(v), col: col || '#fff', big });
}
function ring(x, y, col) {
  parts.push({ x, y, ring: true, r: 6, vr: 3.2, life: 18, col });
}

// ---- combat ---------------------------------------------------------------------
function hurtEnemy(e, dmg, kx, ky) {
  dmg *= P.dmgMul * (1 + 0.15 * (P.passives.fist || 0));
  e.hp -= dmg;
  e.flash = 5;
  e.x += (kx || 0) * 2; e.y += (ky || 0) * 2;
  dnum(e.x, e.y - e.r, dmg, e.elite ? '#ffd23f' : '#fff');
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.deadE) return;
  e.deadE = true;
  kills++;
  combo++; comboT = 72;
  comboBest = Math.max(comboBest, combo);
  Snd.squish();
  burst(e.x, e.y, e.boss ? 60 : e.elite ? 22 : 10, e.col, e.boss ? 8 : 4);
  ring(e.x, e.y, e.col);
  shake = Math.min(shake + (e.boss ? 14 : e.elite ? 3 : 1.2), 16);
  // gems + coins
  const nx = e.xp * (e.elite ? 4 : 1) * (e.boss ? 30 : 1);
  for (let i = 0; i < Math.min(nx, 14); i++) {
    orbs.push({ x: e.x + rnd(-14, 14), y: e.y + rnd(-14, 14), kind: 'gem', v: Math.ceil(nx / Math.min(nx, 14)), vx: rnd(-2, 2), vy: rnd(-3, 0), t: 0 });
  }
  const coins = (Math.random() < e.coin ? 1 : 0) + (e.elite ? 3 : 0) + (e.boss ? 40 : 0);
  for (let i = 0; i < coins; i++) {
    orbs.push({ x: e.x + rnd(-16, 16), y: e.y + rnd(-16, 16), kind: 'coin', v: e.boss ? 5 : 1, vx: rnd(-2, 2), vy: rnd(-3, 0), t: 0 });
  }
  if (Math.random() < 0.03 + (e.boss ? 1 : 0)) {
    orbs.push({ x: e.x, y: e.y, kind: 'heart', v: 20, vx: 0, vy: -2, t: 0 });
  }
  if (e.kind === 'split' && !e.boss) {
    for (const s of [-1, 1]) {
      spawnEnemy('runner', e.x + s * 14, e.y, 0.7);
    }
  }
  if (e.boss) {
    boss = null;
    slowmo = 40;
    Snd.bossDie();
  }
}

function hurtPlayer(dmg) {
  if (P.iv > 0) return;
  P.hp -= dmg;
  P.iv = 40;
  flashRed = 14;
  shake = Math.min(shake + 6, 16);
  combo = 0;
  Snd.hurt();
  burst(P.x, P.y, 10, '#ff6b6b', 4);
  if (P.hp <= 0) {
    state = 'dead';
    deadT = 0;
    slowmo = 0;
    burst(P.x, P.y, 50, P.ch.body, 7);
    Snd.dead();
    Snd.music(-1);
  }
}

// ---- spawning ---------------------------------------------------------------------
function spawnEnemy(type, x, y, hpMul = 1, elite = false) {
  if (enemies.length > 240) return;
  const t = DATA.ENEMIES[type];
  const conf = DATA.waveConf(wave);
  const r = t.r * (elite ? 1.5 : 1);
  enemies.push({
    type, kind: t.kind, x, y, r,
    hp: t.hp * conf.hpScale * hpMul * (elite ? 6 : 1),
    maxHp: t.hp * conf.hpScale * hpMul * (elite ? 6 : 1),
    speed: t.speed * rnd(0.9, 1.1),
    dmg: t.dmg * conf.dmgScale,
    xp: t.xp, coin: t.coin, col: t.col, dark: t.dark,
    elite, flash: 0, t: rnd(0, 99), spitT: rnd(40, 90)
  });
}

function spawnEdge(type, elite) {
  // just outside the camera view
  const camX = clamp(P.x - W / 2, 0, WORLD - W), camY = clamp(P.y - H / 2, 0, WORLD - H);
  const side = (Math.random() * 4) | 0;
  let x, y;
  if (side === 0) { x = camX + rnd(0, W); y = camY - 40; }
  else if (side === 1) { x = camX + rnd(0, W); y = camY + H + 40; }
  else if (side === 2) { x = camX - 40; y = camY + rnd(0, H); }
  else { x = camX + W + 40; y = camY + rnd(0, H); }
  spawnEnemy(type, clamp(x, 20, WORLD - 20), clamp(y, 20, WORLD - 20), 1, elite);
}

function pickType(mix) {
  let tot = 0;
  for (const k in mix) tot += mix[k];
  let r = Math.random() * tot;
  for (const k in mix) { r -= mix[k]; if (r <= 0) return k; }
  return 'gloop';
}

function spawnBoss(bdef) {
  const t = DATA.ENEMIES[bdef.base];
  const conf = DATA.waveConf(wave);
  boss = {
    type: bdef.base, kind: 'boss', pattern: bdef.pattern, name: bdef.name,
    x: P.x, y: P.y - 340, r: bdef.r,
    hp: bdef.hp * (1 + wave * 0.01), maxHp: bdef.hp * (1 + wave * 0.01),
    speed: bdef.speed, dmg: t.dmg * conf.dmgScale * 2,
    xp: t.xp, coin: 1, col: t.col, dark: t.dark,
    elite: true, boss: true, flash: 0, t: 0, spitT: 60, chargeT: 0, cvx: 0, cvy: 0
  };
  boss.y = clamp(boss.y, 80, WORLD - 80);
  enemies.push(boss);
  Snd.bossRoar();
  shake = 14;
}

// ---- weapons ----------------------------------------------------------------------
function nearestEnemy(x, y, maxD) {
  let best = null, bd = (maxD || 1e9) * (maxD || 1e9);
  for (const e of enemies) {
    if (e.deadE) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function fireWeapons() {
  const speedUp = 1 - 0.12 * (P.passives.clock || 0);
  for (const [id, lvl] of Object.entries(P.weapons)) {
    const conf = DATA.WEAPONS[id].lv[lvl - 1];
    P.timers[id] = (P.timers[id] || 0) - 1;
    if (id === 'blades') continue;   // continuous
    if (P.timers[id] > 0) continue;

    if (id === 'bolt') {
      const t = nearestEnemy(P.x, P.y, 460);
      if (!t) continue;
      P.timers[id] = conf.rate * speedUp;
      for (let i = 0; i < conf.n; i++) {
        const a = Math.atan2(t.y - P.y, t.x - P.x) + (i - (conf.n - 1) / 2) * 0.14;
        bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * conf.spd, vy: Math.sin(a) * conf.spd, dmg: conf.dmg, life: 70, kind: 'bolt' });
      }
      Snd.pew();
    } else if (id === 'nova') {
      if (!enemies.length) continue;
      P.timers[id] = conf.rate * speedUp;
      for (let i = 0; i < conf.n; i++) {
        const a = (i / conf.n) * Math.PI * 2 + P.orbitA;
        bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * conf.spd, vy: Math.sin(a) * conf.spd, dmg: conf.dmg, life: 55, kind: 'nova' });
      }
      ring(P.x, P.y, '#8ec5ff');
      Snd.nova();
    } else if (id === 'zap') {
      const t = nearestEnemy(P.x, P.y, 420);
      if (!t) continue;
      P.timers[id] = conf.rate * speedUp;
      let cur = t, prev = { x: P.x, y: P.y };
      const hit = new Set();
      const pts = [{ x: P.x, y: P.y }];
      for (let c = 0; c < conf.chains && cur; c++) {
        hit.add(cur);
        pts.push({ x: cur.x, y: cur.y });
        hurtEnemy(cur, conf.dmg, 0, 0);
        burst(cur.x, cur.y, 3, '#aef3ff', 3);
        prev = cur;
        let nxt = null, bd = 200 * 200;
        for (const e of enemies) {
          if (e.deadE || hit.has(e)) continue;
          const d = dist2(prev.x, prev.y, e.x, e.y);
          if (d < bd) { bd = d; nxt = e; }
        }
        cur = nxt;
      }
      beams.push({ pts, life: 9 });
      Snd.zap();
    } else if (id === 'boomer') {
      const t = nearestEnemy(P.x, P.y, 480);
      if (!t) continue;
      P.timers[id] = conf.rate * speedUp;
      for (let i = 0; i < conf.n; i++) {
        const a = Math.atan2(t.y - P.y, t.x - P.x) + i * 0.5 - (conf.n - 1) * 0.25;
        bullets.push({ x: P.x, y: P.y, vx: Math.cos(a) * conf.spd, vy: Math.sin(a) * conf.spd, dmg: conf.dmg, life: 999, kind: 'boomer', phase: 0, rot: 0, hitCd: {} });
      }
      Snd.whoosh();
    }
  }
}

// ---- level ups ---------------------------------------------------------------------
function xpNeed(l) { return Math.floor(6 + l * 4 + l * l * 0.9); }

function gainXp(v) {
  P.xp += v * (1 + 0.2 * (P.passives.star || 0));
  if (P.xp >= P.need) {
    P.xp -= P.need;
    P.level++;
    P.need = xpNeed(P.level);
    openCards();
  }
}

function openCards() {
  const opts = [];
  const wIds = Object.keys(P.weapons);
  // weapon upgrades
  for (const id of wIds) if (P.weapons[id] < 5) opts.push({ kind: 'w', id, lvl: P.weapons[id] + 1 });
  // new weapons (max 4)
  if (wIds.length < 4) {
    for (const id of Object.keys(DATA.WEAPONS)) if (!P.weapons[id]) opts.push({ kind: 'w', id, lvl: 1 });
  }
  // passives
  for (const [id, p] of Object.entries(DATA.PASSIVES)) {
    if ((P.passives[id] || 0) < p.max) opts.push({ kind: 'p', id, lvl: (P.passives[id] || 0) + 1 });
  }
  // shuffle, take 3
  for (let i = opts.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  cards = opts.slice(0, 3);
  if (!cards.length) { gainHeal(30); return; }
  cardAnim = 0;
  state = 'levelup';
  Snd.levelup();
  burst(P.x, P.y, 30, '#ffd23f', 6);
}

function gainHeal(v) {
  P.hp = Math.min(P.maxHp, P.hp + v);
  dnum(P.x, P.y - 24, v, '#7ed957', true);
}

function pickCard(i) {
  const c = cards[i];
  if (!c) return;
  if (c.kind === 'w') P.weapons[c.id] = c.lvl;
  else {
    P.passives[c.id] = c.lvl;
    if (c.id === 'heart') { P.maxHp += 25; gainHeal(25); }
    if (c.id === 'boots') P.speed = 2.6 * P.ch.speed * (1 + 0.12 * P.passives.boots);
  }
  Snd.pick();
  state = 'play';
}

// ---- update -----------------------------------------------------------------------
function update() {
  frame++;
  if (shake > 0) shake *= 0.86;
  if (flashRed > 0) flashRed--;

  if (state === 'title') { updateTitle(); return; }
  if (state === 'pause' || state === 'levelup') { cardAnim = Math.min(1, cardAnim + 0.08); handleUiTap(); return; }
  if (state === 'dead' || state === 'victory') {
    deadT++;
    if (tap && deadT > 40) { tap = null; bankAndTitle(); }
    tap = null;
    updateParts();
    return;
  }

  // slow motion after boss kills
  if (slowmo > 0) { slowmo--; if (frame % 2 === 0) { updateParts(); return; } }

  // ---- player movement ----
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (stick) { mx = stick.dx / 46; my = stick.dy / 46; }
  const mm = Math.hypot(mx, my);
  if (mm > 1) { mx /= mm; my /= mm; }
  P.x = clamp(P.x + mx * P.speed, 24, WORLD - 24);
  P.y = clamp(P.y + my * P.speed, 24, WORLD - 24);
  P.moving = mm;
  if (mx) P.face = Math.sign(mx);
  if (P.iv > 0) P.iv--;
  P.orbitA += 0.05;

  fireWeapons();

  // ---- blades (continuous) ----
  if (P.weapons.blades) {
    const conf = DATA.WEAPONS.blades.lv[P.weapons.blades - 1];
    const rot = P.orbitA * (conf.rot / 0.05);
    for (let i = 0; i < conf.n; i++) {
      const a = rot + (i / conf.n) * Math.PI * 2;
      const bx = P.x + Math.cos(a) * conf.r, by = P.y + Math.sin(a) * conf.r;
      for (const e of enemies) {
        if (e.deadE || e.hitBlade > 0) continue;
        if (dist2(bx, by, e.x, e.y) < (16 + e.r) * (16 + e.r)) {
          hurtEnemy(e, conf.dmg, (e.x - P.x) * 0.02, (e.y - P.y) * 0.02);
          e.hitBlade = 14;
        }
      }
    }
    for (const e of enemies) if (e.hitBlade > 0) e.hitBlade--;
  }

  // ---- bullets ----
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.kind === 'boomer') {
      b.phase++;
      b.rot += 0.35;
      if (b.phase > 26) {
        const a = Math.atan2(P.y - b.y, P.x - b.x);
        b.vx += Math.cos(a) * 0.7; b.vy += Math.sin(a) * 0.7;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 9) { b.vx *= 9 / sp; b.vy *= 9 / sp; }
        if (b.phase > 34 && dist2(b.x, b.y, P.x, P.y) < 30 * 30) { bullets.splice(i, 1); continue; }
      }
      for (const k in b.hitCd) { if (--b.hitCd[k] <= 0) delete b.hitCd[k]; }
    }
    b.x += b.vx; b.y += b.vy;
    b.life--;
    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD || b.y > WORLD) { bullets.splice(i, 1); continue; }
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j];
      if (e.deadE) continue;
      if (dist2(b.x, b.y, e.x, e.y) < (e.r + 7) * (e.r + 7)) {
        if (b.kind === 'boomer') {
          const key = j;
          if (b.hitCd[key]) continue;
          b.hitCd[key] = 20;
          hurtEnemy(e, b.dmg, b.vx * 0.1, b.vy * 0.1);
        } else {
          hurtEnemy(e, b.dmg, b.vx * 0.15, b.vy * 0.15);
          burst(b.x, b.y, 4, '#fff2b0', 3);
          bullets.splice(i, 1);
        }
        break;
      }
    }
  }

  // ---- enemies ----
  const grid = new Map();   // soft separation buckets
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.deadE) { enemies.splice(i, 1); continue; }
    e.t++;
    if (e.flash > 0) e.flash--;

    let ax = P.x - e.x, ay = P.y - e.y;
    const d = Math.hypot(ax, ay) || 1;
    ax /= d; ay /= d;
    let sp = e.speed;

    if (e.boss) {
      updateBoss(e, ax, ay, d);
    } else if (e.kind === 'spit') {
      if (d < 240) { ax = -ax * 0.4; ay = -ay * 0.4; }
      if (--e.spitT <= 0 && d < 430) {
        e.spitT = 110 + rnd(0, 40);
        const a = Math.atan2(P.y - e.y, P.x - e.x);
        spits.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3.4, vy: Math.sin(a) * 3.4, dmg: e.dmg, life: 160 });
        Snd.spit();
      }
      e.x += ax * sp; e.y += ay * sp;
    } else if (e.kind === 'weave') {
      const wob = Math.sin(e.t * 0.08) * 1.4;
      e.x += (ax + -ay * wob * 0.6) * sp;
      e.y += (ay + ax * wob * 0.6) * sp;
    } else {
      e.x += ax * sp; e.y += ay * sp;
    }

    // soft separation
    const gk = ((e.x / 56) | 0) + ',' + ((e.y / 56) | 0);
    const cell = grid.get(gk);
    if (cell) {
      const o = cell;
      const dd = dist2(e.x, e.y, o.x, o.y);
      const rr = (e.r + o.r) * 0.7;
      if (dd < rr * rr && dd > 0.01) {
        const m = Math.sqrt(dd);
        const push = (rr - m) * 0.25;
        e.x += (e.x - o.x) / m * push; e.y += (e.y - o.y) / m * push;
      }
    }
    grid.set(gk, e);

    // touch the player
    if (dist2(e.x, e.y, P.x, P.y) < (e.r + P.r - 4) * (e.r + P.r - 4)) {
      hurtPlayer(e.dmg);
      e.x -= ax * 10; e.y -= ay * 10;
    }
  }

  // ---- spit projectiles ----
  for (let i = spits.length - 1; i >= 0; i--) {
    const s = spits[i];
    s.x += s.vx; s.y += s.vy; s.life--;
    if (s.life <= 0) { spits.splice(i, 1); continue; }
    if (dist2(s.x, s.y, P.x, P.y) < (P.r + 6) * (P.r + 6)) {
      hurtPlayer(s.dmg);
      spits.splice(i, 1);
    }
  }

  // ---- orbs (gems, coins, hearts) ----
  const magR = 70 + (P.passives.magnet || 0) * 55;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.t++;
    o.x += o.vx; o.y += o.vy;
    o.vx *= 0.9; o.vy *= 0.9;
    const d = dist2(o.x, o.y, P.x, P.y);
    if (d < magR * magR || o.pulled) {
      o.pulled = true;
      const m = Math.sqrt(d) || 1;
      o.x += (P.x - o.x) / m * 7.5;
      o.y += (P.y - o.y) / m * 7.5;
    }
    if (d < 24 * 24) {
      orbs.splice(i, 1);
      if (o.kind === 'gem') { gainXp(o.v); Snd.gem(); }
      else if (o.kind === 'coin') { runCoins += o.v; Snd.coin(); dnum(P.x, P.y - 30, o.v, '#ffd23f'); }
      else { gainHeal(o.v); Snd.heal(); }
    }
  }
  if (orbs.length > 260) orbs.splice(0, orbs.length - 260);

  // ---- combo ----
  if (comboT > 0) { comboT--; if (comboT === 0) combo = 0; }

  // ---- wave director ----
  const conf = DATA.waveConf(wave);
  if (betweenT > 0) {
    betweenT--;
    if (betweenT === 0) {
      wave++;
      waveT = 0;
      waveSplash = 80;
      gainHeal(10);
      if (wave > 100) { state = 'victory'; deadT = 0; Snd.victory(); Snd.music(-1); return; }
      const c2 = DATA.waveConf(wave);
      if (c2.boss) spawnBoss(c2.boss);
      Snd.wave();
      if (wave % 10 === 1) Snd.music(((wave / 10) | 0) % 5);
    }
  } else {
    waveT++;
    if (--spawnT <= 0 && enemies.length < 240) {
      spawnT = conf.spawnEvery;
      for (let i = 0; i < conf.batch; i++) {
        spawnEdge(pickType(conf.mix), Math.random() < conf.elite);
      }
    }
    const done = conf.boss ? !boss && waveT > 90 : waveT >= conf.dur;
    if (done) betweenT = 100;
  }
  if (waveSplash > 0) waveSplash--;

  updateParts();
  tap = null;
}

function updateBoss(e, ax, ay, d) {
  if (e.pattern === 'charge' || e.pattern === 'all') {
    if (e.chargeT > 0) {
      e.chargeT--;
      e.x += e.cvx; e.y += e.cvy;
      e.x = clamp(e.x, e.r, WORLD - e.r); e.y = clamp(e.y, e.r, WORLD - e.r);
    } else if (e.t % 160 === 120) {
      e.chargeT = 34;
      e.cvx = ax * e.speed * 7; e.cvy = ay * e.speed * 7;
      Snd.bossRoar();
    } else {
      e.x += ax * e.speed; e.y += ay * e.speed;
    }
  } else {
    e.x += ax * e.speed * (e.pattern === 'weave' ? (1 + Math.sin(e.t * 0.05)) : 1);
    e.y += ay * e.speed;
  }
  if ((e.pattern === 'radial' || e.pattern === 'all') && e.t % 130 === 60) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      spits.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, dmg: e.dmg * 0.6, life: 150 });
    }
    Snd.spit();
  }
  if ((e.pattern === 'spawn' || e.pattern === 'all') && e.t % 150 === 80) {
    for (let i = 0; i < 4; i++) spawnEnemy('runner', e.x + rnd(-40, 40), e.y + rnd(-40, 40), 0.8);
  }
}

function updateParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (p.ring) { p.r += p.vr; p.life--; }
    else { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; }
    if (p.life <= 0) parts.splice(i, 1);
  }
  for (let i = dnums.length - 1; i >= 0; i--) {
    const d = dnums[i];
    d.y += d.vy; d.vy *= 0.95; d.life--;
    if (d.life <= 0) dnums.splice(i, 1);
  }
  for (let i = beams.length - 1; i >= 0; i--) {
    if (--beams[i].life <= 0) beams.splice(i, 1);
  }
}

function handleUiTap() {
  if (!tap) return;
  const p = tap; tap = null;
  if (state === 'levelup') {
    for (let i = 0; i < cards.length; i++) {
      const cx = W / 2 + (i - (cards.length - 1) / 2) * 220;
      if (Math.abs(p.x - cx) < 100 && Math.abs(p.y - H / 2) < 140) { pickCard(i); return; }
    }
  } else if (state === 'pause') {
    state = 'play';
  }
}

// ---- title -----------------------------------------------------------------------
function updateTitle() {
  if (titleHorde.length < 24) {
    const types = Object.keys(DATA.ENEMIES);
    titleHorde.push({
      type: types[(Math.random() * types.length) | 0],
      x: -60, y: rnd(H * 0.55, H * 0.9), sp: rnd(0.5, 1.4), ph: rnd(0, 9)
    });
  }
  for (let i = titleHorde.length - 1; i >= 0; i--) {
    const m = titleHorde[i];
    m.x += m.sp;
    if (m.x > W + 60) titleHorde.splice(i, 1);
  }
  if (tap) {
    const p = tap; tap = null;
    // arrows
    if (Math.abs(p.y - 348) < 60) {
      if (Math.abs(p.x - (W / 2 - 190)) < 40) { charSel = (charSel + DATA.CHARS.length - 1) % DATA.CHARS.length; Snd.ui(); return; }
      if (Math.abs(p.x - (W / 2 + 190)) < 40) { charSel = (charSel + 1) % DATA.CHARS.length; Snd.ui(); return; }
    }
    // play button
    if (Math.abs(p.x - W / 2) < 130 && Math.abs(p.y - 476) < 34) { tryStart(); return; }
    tryStart();
  }
}

// ---- drawing ------------------------------------------------------------------------
function draw() {
  if (state === 'title') { drawTitle(); return; }
  if (state === 'victory') { drawVictory(); return; }

  const camX = clamp(P.x - W / 2, 0, WORLD - W) + (Math.random() - 0.5) * shake;
  const camY = clamp(P.y - H / 2, 0, WORLD - H) + (Math.random() - 0.5) * shake;

  drawArena(camX, camY);

  ctx.save();
  ctx.translate(-camX, -camY);

  // orbs under everything
  for (const o of orbs) {
    if (o.kind === 'gem') {
      ctx.fillStyle = '#54e0ff';
      ctx.strokeStyle = '#1d8bb5';
      ctx.lineWidth = 1.5;
      const s = 5 + Math.sin(frame * 0.15 + o.t) * 1;
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(0.785);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.strokeRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    } else if (o.kind === 'coin') {
      ctx.fillStyle = '#ffd23f';
      ctx.strokeStyle = '#c99a17';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y, 6, 6 * Math.abs(Math.sin(frame * 0.1 + o.t * 0.3)) * 0.6 + 2.4, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = '#ff6b8a';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♥', o.x, o.y + 5 + Math.sin(frame * 0.12) * 2);
    }
  }

  // enemies
  for (const e of enemies) {
    const t = DATA.ENEMIES[e.type];
    const key = e.type + (e.elite ? '_e' : '') + '_' + Math.round(e.r);
    const sp = e.flash > 0
      ? blobSprite(key + '_f', e.r, t.col, t.dark, { flash: true, elite: e.elite })
      : blobSprite(key, e.r, t.col, t.dark, { angry: true, teeth: e.r > 18, spiky: e.type === 'runner' || e.type === 'ghost', elite: e.elite, crownd: e.boss });
    const sq = 1 + Math.sin(e.t * 0.25) * 0.06;
    if (e.type === 'ghost') ctx.globalAlpha = 0.75;
    drawSprite(sp, e.x, e.y, 1, 0, sq);
    ctx.globalAlpha = 1;
    if (e.boss) {
      // boss hp handled in HUD
    } else if (e.elite && e.hp < e.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(e.x - 18, e.y - e.r - 12, 36, 5);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(e.x - 18, e.y - e.r - 12, 36 * (e.hp / e.maxHp), 5);
    }
  }

  // spits
  for (const s of spits) {
    ctx.fillStyle = '#c47aff';
    ctx.strokeStyle = '#7a3cb8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  // bullets
  for (const b of bullets) {
    if (b.kind === 'boomer') {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.fillStyle = '#ffe28a';
      ctx.strokeStyle = '#c98a17';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, -4); ctx.lineTo(10, -4); ctx.lineTo(10, 4); ctx.lineTo(-2, 4); ctx.lineTo(-2, 12); ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();
    } else {
      const col = b.kind === 'nova' ? '#8ec5ff' : '#fff2b0';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // blades
  if (P.weapons.blades) {
    const conf = DATA.WEAPONS.blades.lv[P.weapons.blades - 1];
    const saw = sawSprite();
    const rot = P.orbitA * (conf.rot / 0.05);
    for (let i = 0; i < conf.n; i++) {
      const a = rot + (i / conf.n) * Math.PI * 2;
      drawSprite(saw, P.x + Math.cos(a) * conf.r, P.y + Math.sin(a) * conf.r, 1, frame * 0.3);
    }
  }

  // zap beams
  for (const bm of beams) {
    ctx.strokeStyle = `rgba(174,243,255,${bm.life / 9})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < bm.pts.length; i++) {
      const p = bm.pts[i];
      const jx = i === 0 ? 0 : rnd(-4, 4), jy = i === 0 ? 0 : rnd(-4, 4);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x + jx, p.y + jy);
    }
    ctx.stroke();
  }

  // player
  const hsp = heroSprite(P.ch, P.iv > 0 && (frame % 6 < 3));
  const bob = P.moving ? Math.abs(Math.sin(frame * 0.25)) * 0.1 : Math.sin(frame * 0.06) * 0.03;
  ctx.save();
  if (P.face < 0) { ctx.translate(P.x * 2, 0); ctx.scale(-1, 1); }
  drawSprite(hsp, P.x, P.y, 1, 0, 1 + bob);
  ctx.restore();

  // particles + damage numbers
  for (const p of parts) {
    if (p.ring) {
      ctx.strokeStyle = p.col;
      ctx.globalAlpha = p.life / 18;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = clamp(p.life / 25, 0, 1);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      ctx.globalAlpha = 1;
    }
  }
  ctx.textAlign = 'center';
  for (const d of dnums) {
    ctx.globalAlpha = clamp(d.life / 20, 0, 1);
    ctx.font = `900 ${d.big ? 22 : 15}px 'Arial Black', sans-serif`;
    ctx.strokeStyle = 'rgba(30,20,40,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeText(d.v, d.x, d.y);
    ctx.fillStyle = d.col;
    ctx.fillText(d.v, d.x, d.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  drawHud();

  if (flashRed > 0) {
    ctx.fillStyle = `rgba(255,40,60,${flashRed * 0.02})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (P.hp < P.maxHp * 0.3) {
    const p = 0.15 + 0.1 * Math.sin(frame * 0.15);
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
    vg.addColorStop(0, 'rgba(200,0,30,0)');
    vg.addColorStop(1, `rgba(200,0,30,${p})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  if (state === 'levelup') drawCards();
  if (state === 'pause') {
    ctx.fillStyle = 'rgba(20,15,40,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = "900 44px 'Arial Black', sans-serif";
    ctx.fillText('PAUSED', W / 2, H / 2);
    ctx.font = '16px sans-serif';
    ctx.fillText('P / esc to resume', W / 2, H / 2 + 34);
  }
  if (state === 'dead') drawDead();
}

function drawArena(camX, camY) {
  // candy grass checkerboard
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7ec850');
  g.addColorStop(1, '#5cab3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const T = 64;
  const x0 = Math.floor(camX / T) * T, y0 = Math.floor(camY / T) * T;
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = y0; y < camY + H + T; y += T) {
    for (let x = x0; x < camX + W + T; x += T) {
      if (((x / T) + (y / T)) % 2 === 0) ctx.fillRect(x - camX, y - camY, T, T);
    }
  }
  // tufts + flowers, deterministic sprinkle
  for (let y = y0; y < camY + H + T; y += T) {
    for (let x = x0; x < camX + W + T; x += T) {
      const hsh = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if (hsh % 7 === 0) {
        const fx = x - camX + (hsh % 40), fy = y - camY + (hsh % 29);
        ctx.fillStyle = hsh % 3 ? 'rgba(255,255,255,0.5)' : 'rgba(255,210,80,0.6)';
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (hsh % 5 === 0) {
        ctx.strokeStyle = 'rgba(30,90,20,0.25)';
        ctx.lineWidth = 2;
        const fx = x - camX + (hsh % 48), fy = y - camY + (hsh % 37);
        ctx.beginPath();
        ctx.moveTo(fx, fy); ctx.lineTo(fx - 3, fy - 7);
        ctx.moveTo(fx, fy); ctx.lineTo(fx + 3, fy - 8);
        ctx.stroke();
      }
    }
  }
  // world border
  ctx.strokeStyle = 'rgba(40,60,20,0.5)';
  ctx.lineWidth = 14;
  ctx.strokeRect(-camX, -camY, WORLD, WORLD);
}

function drawHud() {
  // HP bar
  const bw = 240;
  ctx.fillStyle = 'rgba(20,15,35,0.6)';
  ctx.beginPath(); ctx.roundRect(14, 12, bw, 22, 11); ctx.fill();
  const hpF = clamp(P.hp / P.maxHp, 0, 1);
  const hg = ctx.createLinearGradient(14, 0, 14 + bw, 0);
  hg.addColorStop(0, hpF > 0.3 ? '#6ee06e' : '#ff5f5f');
  hg.addColorStop(1, hpF > 0.3 ? '#2fa84f' : '#c92f2f');
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.roundRect(16, 14, (bw - 4) * hpF, 18, 9); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = "900 13px 'Arial Black', sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(P.hp) + ' / ' + P.maxHp, 14 + bw / 2, 27);

  // XP bar
  ctx.fillStyle = 'rgba(20,15,35,0.6)';
  ctx.beginPath(); ctx.roundRect(14, 40, bw, 12, 6); ctx.fill();
  ctx.fillStyle = '#54e0ff';
  ctx.beginPath(); ctx.roundRect(16, 42, (bw - 4) * clamp(P.xp / P.need, 0, 1), 8, 4); ctx.fill();
  ctx.fillStyle = '#bff0ff';
  ctx.font = '900 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LV ' + P.level, 262, 51);

  // wave + kills + coins
  ctx.textAlign = 'center';
  ctx.font = "900 26px 'Arial Black', sans-serif";
  ctx.strokeStyle = 'rgba(20,15,35,0.8)';
  ctx.lineWidth = 5;
  ctx.strokeText('WAVE ' + wave, W / 2, 34);
  ctx.fillStyle = '#fff';
  ctx.fillText('WAVE ' + wave, W / 2, 34);

  ctx.textAlign = 'right';
  ctx.font = "900 16px 'Arial Black', sans-serif";
  ctx.strokeText('☠ ' + kills, W - 16, 26);
  ctx.fillStyle = '#fff';
  ctx.fillText('☠ ' + kills, W - 16, 26);
  ctx.strokeText('● ' + runCoins, W - 16, 48);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('● ' + runCoins, W - 16, 48);

  // combo
  if (combo >= 5) {
    const tier = combo >= 40 ? 'GODLIKE!!!!' : combo >= 20 ? 'INSANE!!!' : combo >= 10 ? 'RAD!!' : 'NICE!';
    const s = 1 + Math.min(0.4, (comboT > 66 ? (72 - comboT) * 0.08 : 0));
    ctx.save();
    ctx.translate(W / 2, 72);
    ctx.scale(s, s);
    ctx.textAlign = 'center';
    ctx.font = "900 22px 'Arial Black', sans-serif";
    ctx.strokeStyle = 'rgba(20,15,35,0.8)';
    ctx.lineWidth = 5;
    ctx.strokeText(combo + ' COMBO  ' + tier, 0, 0);
    ctx.fillStyle = combo >= 20 ? '#ff5f8a' : '#ffd23f';
    ctx.fillText(combo + ' COMBO  ' + tier, 0, 0);
    ctx.restore();
  }

  // boss bar
  if (boss && !boss.deadE) {
    ctx.fillStyle = 'rgba(20,15,35,0.7)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 220, H - 44, 440, 26, 13); ctx.fill();
    ctx.fillStyle = '#ff5f5f';
    ctx.beginPath(); ctx.roundRect(W / 2 - 217, H - 41, 434 * clamp(boss.hp / boss.maxHp, 0, 1), 20, 10); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = "900 13px 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(boss.name, W / 2, H - 27);
  }

  // wave splash
  if (waveSplash > 0 && state === 'play') {
    const a = waveSplash > 60 ? (80 - waveSplash) / 20 : Math.min(1, waveSplash / 30);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    const conf = DATA.waveConf(wave);
    const txt = conf.boss ? '⚠ ' + conf.boss.name + ' ⚠' : 'WAVE ' + wave;
    ctx.font = "900 54px 'Arial Black', sans-serif";
    ctx.strokeStyle = 'rgba(20,15,35,0.9)';
    ctx.lineWidth = 8;
    ctx.strokeText(txt, W / 2, H * 0.38);
    ctx.fillStyle = conf.boss ? '#ff5f5f' : '#fff';
    ctx.fillText(txt, W / 2, H * 0.38);
    ctx.globalAlpha = 1;
  }
}

function drawCards() {
  ctx.fillStyle = 'rgba(25,18,50,0.75)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = "900 34px 'Arial Black', sans-serif";
  const wob = 1 + Math.sin(frame * 0.1) * 0.03;
  ctx.save();
  ctx.translate(W / 2, 96);
  ctx.scale(wob, wob);
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = 'rgba(20,15,35,0.9)';
  ctx.lineWidth = 6;
  ctx.strokeText('LEVEL UP!', 0, 0);
  ctx.fillText('LEVEL UP!', 0, 0);
  ctx.restore();

  const k = Math.min(1, cardAnim);
  const ease = 1 - Math.pow(1 - k, 3);
  cards.forEach((c, i) => {
    const cx = W / 2 + (i - (cards.length - 1) / 2) * 220;
    const cy = H / 2 + 20 + (1 - ease) * 300;
    const def = c.kind === 'w' ? DATA.WEAPONS[c.id] : DATA.PASSIVES[c.id];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((i - 1) * 0.03);
    // card
    const grad = ctx.createLinearGradient(0, -130, 0, 130);
    grad.addColorStop(0, c.kind === 'w' ? '#4a3e8f' : '#3e6d8f');
    grad.addColorStop(1, c.kind === 'w' ? '#2b2159' : '#20415c');
    ctx.fillStyle = grad;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(-95, -130, 190, 260, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '52px sans-serif';
    ctx.fillText(def.icon, 0, -50);
    ctx.font = "900 19px 'Arial Black', sans-serif";
    ctx.fillText(def.name, 0, 4);
    ctx.fillStyle = '#ffd23f';
    ctx.font = '900 14px sans-serif';
    ctx.fillText(c.kind === 'w' && c.lvl > 1 ? 'LV ' + c.lvl : c.kind === 'p' ? 'LV ' + c.lvl : 'NEW!', 0, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '13px sans-serif';
    wrapText(def.desc, 0, 58, 168, 17);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px sans-serif';
    ctx.fillText('[' + (i + 1) + ']', 0, 112);
    ctx.restore();
  });
}

function wrapText(txt, x, y, maxW, lh) {
  const words = txt.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW) {
      ctx.fillText(line, x, yy);
      line = w + ' ';
      yy += lh;
    } else line += w + ' ';
  }
  ctx.fillText(line.trim(), x, yy);
}

function drawDead() {
  ctx.fillStyle = `rgba(30,10,25,${Math.min(0.8, deadT * 0.02)})`;
  ctx.fillRect(0, 0, W, H);
  if (deadT < 20) return;
  ctx.textAlign = 'center';
  ctx.font = "900 52px 'Arial Black', sans-serif";
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 8;
  ctx.strokeText('YOU GOT SWARMED', W / 2, H * 0.34);
  ctx.fillStyle = '#ff5f7a';
  ctx.fillText('YOU GOT SWARMED', W / 2, H * 0.34);
  ctx.fillStyle = '#fff';
  ctx.font = "900 20px 'Arial Black', sans-serif";
  ctx.fillText('wave ' + wave + '  ·  ' + kills + ' kills  ·  best combo x' + comboBest, W / 2, H * 0.46);
  ctx.fillStyle = '#ffd23f';
  const shown = Math.min(runCoins, Math.floor((deadT - 30) * 3));
  if (shown > 0) ctx.fillText('● +' + shown + ' coins banked', W / 2, H * 0.55);
  if (wave > save.best) {
    ctx.fillStyle = '#7ef0a0';
    ctx.fillText('NEW BEST!', W / 2, H * 0.63);
  }
  const p = 0.5 + 0.3 * Math.sin(frame * 0.1);
  ctx.fillStyle = `rgba(255,255,255,${p})`;
  ctx.font = '16px sans-serif';
  ctx.fillText('tap to continue', W / 2, H * 0.74);
}

function drawVictory() {
  ctx.fillStyle = '#1c1440';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) {
    const x = (i * 127 + frame * (1 + i % 4)) % (W + 40) - 20;
    const y = (i * 251 + frame * (2 + i % 3)) % (H + 40) - 20;
    ctx.fillStyle = ['#ff5f8a', '#ffd23f', '#54e0ff', '#7ed957'][i % 4];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(i + frame * 0.05);
    ctx.fillRect(-4, -2, 8, 4);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.font = "900 58px 'Arial Black', sans-serif";
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 9;
  ctx.strokeText('YOU BEAT THE SWARM', W / 2, H * 0.4);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('YOU BEAT THE SWARM', W / 2, H * 0.4);
  ctx.fillStyle = '#fff';
  ctx.font = "900 20px 'Arial Black', sans-serif";
  ctx.fillText('all 100 waves · ' + kills + ' kills · +' + runCoins + ' coins', W / 2, H * 0.52);
  const p = 0.5 + 0.3 * Math.sin(frame * 0.1);
  ctx.fillStyle = `rgba(255,255,255,${p})`;
  ctx.font = '16px sans-serif';
  ctx.fillText('tap to return', W / 2, H * 0.64);
}

function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3ec6ff');
  g.addColorStop(0.6, '#8fe0ff');
  g.addColorStop(0.62, '#7ec850');
  g.addColorStop(1, '#4f9e33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // sun
  ctx.fillStyle = 'rgba(255,240,180,0.9)';
  ctx.beginPath(); ctx.arc(W - 130, 84, 44, 0, Math.PI * 2); ctx.fill();
  // clouds
  for (let i = 0; i < 4; i++) {
    const x = ((i * 260 + frame * 0.2) % (W + 200)) - 100;
    const y = 60 + i * 34;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 24, y + 4, 17, 0, Math.PI * 2);
    ctx.arc(x - 24, y + 5, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  // the horde marches across the bottom
  for (const m of titleHorde) {
    const t = DATA.ENEMIES[m.type];
    const sp = blobSprite('t_' + m.type + '_' + t.r, t.r, t.col, t.dark, { angry: true, teeth: t.r > 18, spiky: m.type === 'runner' });
    drawSprite(sp, m.x, m.y, 1, 0, 1 + Math.sin(frame * 0.2 + m.ph) * 0.08);
  }

  // logo: bouncing letters
  const word = 'SWARM!!';
  ctx.textAlign = 'center';
  for (let i = 0; i < word.length; i++) {
    const x = W / 2 + (i - (word.length - 1) / 2) * 62;
    const y = 118 + Math.sin(frame * 0.07 + i * 0.7) * 8;
    ctx.font = "900 76px 'Arial Black', sans-serif";
    ctx.strokeStyle = '#1c3312';
    ctx.lineWidth = 10;
    ctx.strokeText(word[i], x, y);
    const lg = ctx.createLinearGradient(0, y - 60, 0, y);
    lg.addColorStop(0, '#ffe86b');
    lg.addColorStop(1, '#ff8a3c');
    ctx.fillStyle = lg;
    ctx.fillText(word[i], x, y);
  }
  ctx.font = "900 17px 'Arial Black', sans-serif";
  ctx.fillStyle = '#1c3312';
  ctx.fillText('100 WAVES. ONE TINY HERO. INFINITE MONSTERS.', W / 2, 158);

  // character card
  const ch = DATA.CHARS[charSel];
  const owned = save.owned.includes(ch.id);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = '#1c3312';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(W / 2 - 140, 218, 280, 176, 18); ctx.fill(); ctx.stroke();
  const hsp = heroSprite(ch, false);
  drawSprite(hsp, W / 2 - 78, 300, 1.7, 0, 1 + Math.sin(frame * 0.08) * 0.05);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#1c3312';
  ctx.font = "900 24px 'Arial Black', sans-serif";
  ctx.fillText(ch.name, W / 2 - 20, 258);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#3a5230';
  wrapTextLeft(ch.blurb, W / 2 - 20, 280, 150, 15);
  // stat pips
  const stats = [['HP', ch.hp / 150], ['SPD', ch.speed / 1.3], ['DMG', ch.dmg / 1.25]];
  stats.forEach(([n, v], i) => {
    const sy = 322 + i * 20;
    ctx.fillStyle = '#3a5230';
    ctx.font = '900 11px sans-serif';
    ctx.fillText(n, W / 2 - 20, sy + 9);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(W / 2 + 14, sy, 110, 10);
    ctx.fillStyle = ['#ff6b6b', '#54e0ff', '#ffd23f'][i];
    ctx.fillRect(W / 2 + 14, sy, 110 * clamp(v, 0.1, 1), 10);
  });
  // arrows
  ctx.textAlign = 'center';
  ctx.font = "900 44px 'Arial Black', sans-serif";
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#1c3312';
  ctx.lineWidth = 6;
  ctx.strokeText('‹', W / 2 - 190, 322); ctx.fillText('‹', W / 2 - 190, 322);
  ctx.strokeText('›', W / 2 + 190, 322); ctx.fillText('›', W / 2 + 190, 322);

  // lock / price
  if (!owned) {
    ctx.fillStyle = 'rgba(30,20,20,0.55)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 140, 218, 280, 176, 18); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = "900 30px 'Arial Black', sans-serif";
    ctx.fillText('🔒', W / 2, 288);
    ctx.fillStyle = save.coins >= ch.cost ? '#ffd23f' : '#ff8a8a';
    ctx.font = "900 20px 'Arial Black', sans-serif";
    ctx.fillText('● ' + ch.cost, W / 2, 322);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(save.coins >= ch.cost ? 'tap PLAY to unlock!' : 'earn more coins!', W / 2, 348);
  }

  // play button
  const bp = 1 + Math.sin(frame * 0.09) * 0.04;
  ctx.save();
  ctx.translate(W / 2, 476);
  ctx.scale(bp, bp);
  const bg = ctx.createLinearGradient(0, -30, 0, 30);
  bg.addColorStop(0, '#ffd23f');
  bg.addColorStop(1, '#ff9a2f');
  ctx.fillStyle = bg;
  ctx.strokeStyle = '#1c3312';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(-130, -32, 260, 64, 32); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1c3312';
  ctx.font = "900 30px 'Arial Black', sans-serif";
  ctx.fillText(owned ? 'PLAY!' : (save.coins >= ch.cost ? 'UNLOCK!' : 'LOCKED'), 0, 11);
  ctx.restore();

  // footer stats
  ctx.font = "900 15px 'Arial Black', sans-serif";
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#1c3312'; ctx.lineWidth = 4;
  ctx.strokeText('● ' + save.coins, 18, 30);
  ctx.fillStyle = '#ffd23f';
  ctx.fillText('● ' + save.coins, 18, 30);
  if (save.best > 0) {
    ctx.textAlign = 'right';
    ctx.strokeText('BEST: WAVE ' + save.best, W - 18, 30);
    ctx.fillStyle = '#fff';
    ctx.fillText('BEST: WAVE ' + save.best, W - 18, 30);
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(20,40,15,0.75)';
  ctx.font = '13px sans-serif';
  ctx.fillText('move: WASD / drag · everything else is automatic · M mute', W / 2, H - 14);
}

function wrapTextLeft(txt, x, y, maxW, lh) {
  const words = txt.split(' ');
  let line = '', yy = y;
  for (const w of words) {
    if (ctx.measureText(line + w).width > maxW) {
      ctx.fillText(line, x, yy);
      line = w + ' ';
      yy += lh;
    } else line += w + ' ';
  }
  ctx.fillText(line.trim(), x, yy);
}

// ---- loop -----------------------------------------------------------------------
let last = 0, acc = 0;
const STEP = 1000 / 60;
function loop(t) {
  requestAnimationFrame(loop);
  if (!last) last = t;
  acc += Math.min(t - last, 100);
  last = t;
  let n = 0;
  while (acc >= STEP && n < 4) { update(); acc -= STEP; n++; }
  draw();
}
requestAnimationFrame(loop);

// dev/test hook
window.__swarm = {
  state: () => state,
  player: () => P,
  wave: () => wave,
  kills: () => kills,
  enemies: () => enemies.length,
  boss: () => boss,
  start(chId) {
    if (chId) charSel = Math.max(0, DATA.CHARS.findIndex(c => c.id === chId));
    newRun();
  },
  setWave(w) { wave = w; betweenT = 0; waveT = 0; const c = DATA.waveConf(w); if (c.boss) spawnBoss(c.boss); },
  fast(n) { for (let i = 0; i < n; i++) update(); },
  pick(i) { pickCard(i); },
  godmode() { P.hp = P.maxHp = 99999; }
};

})();
