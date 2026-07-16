// SWARM KEEP - renderer, UI and juice. The rules live in sim.js.

(() => {
'use strict';

const W = 960, H = 540;
const CELL = Sim.CELL;
const PLAY_H = 480;              // map area; bottom 60px is the tower bar
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

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);

// world themes: ground light/dark, path, edge, accent
const THEMES = [
  { g1: '#7ec850', g2: '#74bd48', path: '#d9b380', edge: '#a8834f', sky: '#3ec6ff', prop: 'tree' },
  { g1: '#e8c46a', g2: '#dfba5e', path: '#c98d4a', edge: '#96612c', sky: '#ffb45e', prop: 'cactus' },
  { g1: '#bcd8e8', g2: '#aecfe2', path: '#e8f2fa', edge: '#7fa8c0', sky: '#a8d8f0', prop: 'pine' },
  { g1: '#6b5350', g2: '#615a4a', path: '#3a3230', edge: '#c9542f', sky: '#ff7f50', prop: 'rock' },
  { g1: '#3a3354', g2: '#332d4c', path: '#59527a', edge: '#8f7fd8', sky: '#1c1440', prop: 'crystal' }
];
const WORLD_NAMES = ['MEADOW', 'DUNES', 'TUNDRA', 'CINDER', 'THE VOID'];

// ---- save -----------------------------------------------------------------
const save = {
  get stars() { try { return JSON.parse(localStorage.getItem('sk_stars') || '{}'); } catch (e) { return {}; } },
  set stars(v) { localStorage.setItem('sk_stars', JSON.stringify(v)); },
  get unlocked() { return +(localStorage.getItem('sk_unlocked') || 0); },
  set unlocked(v) { localStorage.setItem('sk_unlocked', v); }
};

// ---- state -----------------------------------------------------------------
let state = 'title';        // title | map | play
let frame = 0;
let lvlIdx = 0;
let G = null;               // sim game
let speed = 1;
let selCard = null;         // tower type being placed
let selTower = null;        // placed tower selected
let pointer = { x: 0, y: 0 };
let taps = [];
let shake = 0;
let fx = [], dnums = [], coinsFx = [], chains = [], snipes = [], booms = [];
let banner = null, checkpointToast = 0;
let overOverlay = null;     // {won, stars} | {won:false}
let mapScroll = 0;
let titleT = 0;

// ---- sprites (blob factory, from the SWARM!! family) --------------------------
const sprites = {};
function blobSprite(key, r, col, dark, opts = {}) {
  if (sprites[key]) return sprites[key];
  const S = 2, pad = Math.ceil(r * 0.7) + 8;
  const cv = document.createElement('canvas');
  cv.width = cv.height = (r + pad) * 2 * S;
  const c = cv.getContext('2d');
  c.scale(S, S);
  c.translate(r + pad, r + pad);
  c.fillStyle = dark;
  c.beginPath();
  c.ellipse(-r * 0.45, r * 0.8, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
  c.ellipse(r * 0.45, r * 0.8, r * 0.3, r * 0.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = col;
  c.strokeStyle = dark;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  c.fill(); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath();
  c.ellipse(0, r * 0.35, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
  c.fill();
  if (opts.wings) {
    c.fillStyle = 'rgba(255,255,255,0.75)';
    c.strokeStyle = dark;
    c.lineWidth = 2;
    for (const s of [-1, 1]) {
      c.beginPath();
      c.ellipse(s * r * 0.95, -r * 0.25, r * 0.42, r * 0.22, s * 0.5, 0, Math.PI * 2);
      c.fill(); c.stroke();
    }
  }
  const er = Math.max(3.2, r * 0.22);
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(-r * 0.32, -r * 0.18, er, 0, Math.PI * 2);
  c.arc(r * 0.32, -r * 0.18, er, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#232333';
  c.beginPath();
  c.arc(-r * 0.32 + er * 0.3, -r * 0.16, er * 0.45, 0, Math.PI * 2);
  c.arc(r * 0.32 + er * 0.3, -r * 0.16, er * 0.45, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#232333';
  c.lineWidth = Math.max(2, r * 0.1);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(-r * 0.52, -r * 0.5); c.lineTo(-r * 0.14, -r * 0.36);
  c.moveTo(r * 0.52, -r * 0.5); c.lineTo(r * 0.14, -r * 0.36);
  c.stroke();
  if (r > 16) {
    c.fillStyle = '#fff';
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(i * r * 0.26 - r * 0.09, r * 0.3);
      c.lineTo(i * r * 0.26, r * 0.5);
      c.lineTo(i * r * 0.26 + r * 0.09, r * 0.3);
      c.fill();
    }
  }
  if (opts.crown) {
    c.fillStyle = '#f4c542';
    c.strokeStyle = '#b8860b';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-r * 0.5, -r * 0.75);
    c.lineTo(-r * 0.5, -r * 1.15); c.lineTo(-r * 0.25, -r * 0.92);
    c.lineTo(0, -r * 1.2); c.lineTo(r * 0.25, -r * 0.92);
    c.lineTo(r * 0.5, -r * 1.15); c.lineTo(r * 0.5, -r * 0.75);
    c.closePath();
    c.fill(); c.stroke();
  }
  if (opts.shell) {
    c.strokeStyle = dark;
    c.lineWidth = 2.5;
    c.beginPath();
    c.arc(0, -r * 0.1, r * 0.72, Math.PI * 1.15, Math.PI * 1.85);
    c.stroke();
    c.beginPath();
    c.arc(0, -r * 0.1, r * 0.5, Math.PI * 1.2, Math.PI * 1.8);
    c.stroke();
  }
  if (opts.cross) {
    c.fillStyle = '#fff';
    c.fillRect(-r * 0.12, -r * 0.62, r * 0.24, r * 0.5);
    c.fillRect(-r * 0.25, -r * 0.5, r * 0.5, r * 0.24);
  }
  sprites[key] = { cv, r: r + pad };
  return sprites[key];
}
function mobSprite(m) {
  const base = Sim.ENEMIES[m.type] || {};
  const col = base.col || Sim.ENEMIES[Sim.BOSSES.find(b => b.id === m.type)?.base || 'gloop'].col;
  const dark = base.dark || '#333';
  return blobSprite(m.type + '_' + m.r, m.r, col, dark, {
    wings: m.air, crown: m.boss, shell: m.type === 'shell' || m.type === 'boss2', cross: (m.heal && !m.boss) || m.type === 'boss3'
  });
}
function drawSpriteAt(sp, x, y, squash = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  ctx.drawImage(sp.cv, -sp.r, -sp.r, sp.r * 2, sp.r * 2);
  ctx.restore();
}

// ---- tower drawing (vector, grows with tier) -----------------------------------
function drawTower(t, x, y, ghost) {
  const tier = t.tier || 1;
  const s = 0.85 + tier * 0.12;
  ctx.save();
  ctx.translate(x, y + 6);
  ctx.scale(s, s);
  if (ghost) ctx.globalAlpha = 0.6;
  const type = t.type;
  // base pad
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 17, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const wob = Math.sin(frame * 0.05 + x) * 1;
  if (type === 'archer') {
    ctx.fillStyle = '#a8743c'; ctx.strokeStyle = '#6b4820'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-11, -16, 22, 28, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c98f4f';
    ctx.beginPath(); ctx.roundRect(-14, -24, 28, 10, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f2e2c0'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -19, 8, -1.2, 1.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0, -11); ctx.stroke();
  } else if (type === 'cannon') {
    ctx.fillStyle = '#5a647a'; ctx.strokeStyle = '#39404f'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#39404f';
    ctx.beginPath(); ctx.roundRect(-6, -26, 12, 20, 4); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'frost') {
    ctx.fillStyle = '#bfe8ff'; ctx.strokeStyle = '#5fa8d8'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -28 + wob); ctx.lineTo(10, -6); ctx.lineTo(0, 12); ctx.lineTo(-10, -6);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.moveTo(0, -22 + wob); ctx.lineTo(4, -6); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
  } else if (type === 'tesla') {
    ctx.fillStyle = '#7a5c9e'; ctx.strokeStyle = '#4d3a66'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-9, -8, 18, 20, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#caa8ff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -16, 8, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
    ctx.fillStyle = frame % 20 < 10 ? '#f0e0ff' : '#caa8ff';
    ctx.beginPath(); ctx.arc(0, -18, 4, 0, Math.PI * 2); ctx.fill();
  } else if (type === 'ember') {
    ctx.fillStyle = '#8a4a2a'; ctx.strokeStyle = '#5c2f18'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-8, -18, 16, 30, 4); ctx.fill(); ctx.stroke();
    const fl = 1 + Math.sin(frame * 0.2) * 0.15;
    ctx.fillStyle = '#ff9a3c';
    ctx.beginPath();
    ctx.moveTo(0, -34 * fl); ctx.quadraticCurveTo(9, -22, 0, -14); ctx.quadraticCurveTo(-9, -22, 0, -34 * fl);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(0, -27 * fl); ctx.quadraticCurveTo(5, -20, 0, -16); ctx.quadraticCurveTo(-5, -20, 0, -27 * fl);
    ctx.fill();
  } else if (type === 'sniper') {
    ctx.strokeStyle = '#6b4820'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-10, 12); ctx.lineTo(-6, -18); ctx.moveTo(10, 12); ctx.lineTo(6, -18);
    ctx.stroke();
    ctx.fillStyle = '#a8743c';
    ctx.beginPath(); ctx.roundRect(-13, -28, 26, 12, 3); ctx.fill();
    ctx.strokeRect(-13, -28, 26, 12);
    ctx.fillStyle = '#39404f';
    ctx.fillRect(2, -25, 16, 4);
  } else if (type === 'bank') {
    ctx.fillStyle = '#ffbb42'; ctx.strokeStyle = '#b8791b'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-12, 10); ctx.quadraticCurveTo(-16, -8, -7, -14);
    ctx.lineTo(7, -14); ctx.quadraticCurveTo(16, -8, 12, 10);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8791b';
    ctx.beginPath(); ctx.roundRect(-8, -19, 16, 6, 2); ctx.fill();
    ctx.fillStyle = '#7a4f0f';
    ctx.font = '900 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', 0, 2);
  } else if (type === 'drum') {
    ctx.fillStyle = '#c9542f'; ctx.strokeStyle = '#8a331a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-13, -10, 26, 22, 5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f2e2c0';
    ctx.beginPath(); ctx.ellipse(0, -10, 13, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const hit = frame % 30 < 4 ? -3 : 0;
    ctx.strokeStyle = '#6b4820'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-8, -24); ctx.lineTo(-3, -12 + hit);
    ctx.moveTo(8, -24); ctx.lineTo(3, -12 + hit);
    ctx.stroke();
  }
  // tier pips
  if (!ghost && tier > 1) {
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#8a6a10';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < tier - 1; i++) {
      const sx = (i - (tier - 2) / 2) * 10;
      ctx.beginPath();
      ctx.moveTo(sx, -34); ctx.lineTo(sx + 3, -28); ctx.lineTo(sx - 3, -28);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- input --------------------------------------------------------------------
function cpos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
canvas.addEventListener('pointermove', e => { pointer = cpos(e); });
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  Snd.unlock();
  taps.push(cpos(e));
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  Snd.unlock();
  if (e.code === 'KeyM') Snd.toggleMute();
  if (state === 'play') {
    if (e.code === 'Space') { e.preventDefault(); trySendWave(); }
    if (e.code === 'KeyF') speed = speed === 1 ? 2 : 1;
    if (e.code === 'Escape') { if (selCard || selTower) { selCard = selTower = null; } else exitToMap(); }
  } else if (e.code === 'Enter' || e.code === 'Space') {
    if (state === 'title') { state = 'map'; Snd.go(); }
  }
});
window.addEventListener('wheel', e => {
  if (state === 'map') mapScroll = clamp(mapScroll + e.deltaY * 0.5, 0, 320);
});

// ---- level flow ------------------------------------------------------------------
function startLevel(i) {
  lvlIdx = i;
  G = Sim.createGame(LEVELS[i]);
  speed = 1;
  selCard = selTower = null;
  fx = []; dnums = []; coinsFx = []; chains = []; snipes = []; booms = [];
  overOverlay = null;
  banner = { text: LEVELS[i].name.toUpperCase(), sub: 'wave 1 of ' + LEVELS[i].waves.length + ' — build, then press START', t: 150 };
  state = 'play';
  Snd.music(LEVELS[i].world - 1);
}
function exitToMap() {
  state = 'map';
  Snd.music(-1);
}
function trySendWave() {
  if (!G.waveActive && !G.over && Sim.startWave(G)) Snd.wave();
}

// ---- event drain -> fx --------------------------------------------------------------
function drainEvents() {
  for (const ev of G.events) {
    if (ev.t === 'hit') {
      if (dnums.length < 50 && (ev.v > 8 || frame % 2 === 0)) dnums.push({ x: ev.x + rnd(-6, 6), y: ev.y - 14, vy: -1.2, life: 26, v: ev.v, col: ev.kind === 'burn' ? '#ff9a3c' : '#fff' });
    } else if (ev.t === 'die') {
      const base = Sim.ENEMIES[ev.type] || {};
      pop(ev.x, ev.y, base.col || '#c47aff', ev.boss ? 40 : 12);
      coinsFx.push({ x: ev.x, y: ev.y, t: 0, v: ev.bounty });
      if (ev.boss) { shake = 14; Snd.bossDie(); }
      else Snd.squish();
    } else if (ev.t === 'shoot') {
      if (ev.kind === 'cannon') Snd.thunk();
      else Snd.pew();
    } else if (ev.t === 'chain') {
      chains.push({ pts: ev.pts, life: 8 });
      Snd.zap();
    } else if (ev.t === 'snipe') {
      snipes.push({ ...ev, life: 8 });
      Snd.snipe();
    } else if (ev.t === 'boom') {
      booms.push({ x: ev.x, y: ev.y, r: 6, max: ev.r, life: 12 });
      shake = Math.min(shake + 2, 8);
      Snd.boom();
    } else if (ev.t === 'leak') {
      shake = Math.min(shake + (ev.big ? 10 : 4), 12);
      Snd.leak();
    } else if (ev.t === 'wave') {
      banner = { text: 'WAVE ' + ev.n, sub: '', t: 70 };
    } else if (ev.t === 'waveClear') {
      Snd.coin();
    } else if (ev.t === 'checkpoint') {
      checkpointToast = 130;
      Snd.checkpoint();
    } else if (ev.t === 'payout') {
      coinsFx.push({ x: ev.x, y: ev.y, t: 0, v: ev.v });
      Snd.coin();
    } else if (ev.t === 'healpulse') {
      booms.push({ x: ev.x, y: ev.y, r: 8, max: ev.r, life: 14, heal: true });
    } else if (ev.t === 'victory') {
      const stars = G.lives >= 20 ? 3 : G.lives >= 12 ? 2 : 1;
      const all = save.stars;
      all[lvlIdx] = Math.max(all[lvlIdx] || 0, stars);
      save.stars = all;
      save.unlocked = Math.max(save.unlocked, Math.min(lvlIdx + 1, LEVELS.length - 1));
      overOverlay = { won: true, stars, t: 0 };
      Snd.victory();
      Snd.music(-1);
    } else if (ev.t === 'defeat') {
      overOverlay = { won: false, t: 0, cp: Sim.latestCheckpoint(G) };
      Snd.defeat();
      Snd.music(-1);
    } else if (ev.t === 'place') {
      pop(ev.c * CELL + CELL / 2, ev.r * CELL + CELL / 2, '#fff', 8);
      Snd.place();
    } else if (ev.t === 'upgrade') {
      pop(ev.c * CELL + CELL / 2, ev.r * CELL + CELL / 2, '#ffd23f', 14);
      Snd.upgrade();
    } else if (ev.t === 'restored') {
      banner = { text: 'BACK TO WAVE ' + (ev.wave + 1), sub: 'checkpoint restored', t: 110 };
    }
  }
  G.events.length = 0;
}

function pop(x, y, col, n) {
  for (let i = 0; i < n && fx.length < 320; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = rnd(1, 4);
    fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.5, g: 0.15, life: rnd(18, 34), col, r: rnd(2, 4.5) });
  }
}

// ---- update -----------------------------------------------------------------------
function update() {
  frame++;
  if (shake > 0) shake *= 0.85;
  if (checkpointToast > 0) checkpointToast--;
  if (banner && --banner.t <= 0) banner = null;

  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--;
    if (p.life <= 0) fx.splice(i, 1);
  }
  for (let i = dnums.length - 1; i >= 0; i--) {
    const d = dnums[i];
    d.y += d.vy; d.life--;
    if (d.life <= 0) dnums.splice(i, 1);
  }
  for (let i = coinsFx.length - 1; i >= 0; i--) {
    const c = coinsFx[i];
    c.t += 0.06;
    if (c.t >= 1) coinsFx.splice(i, 1);
  }
  for (let i = chains.length - 1; i >= 0; i--) if (--chains[i].life <= 0) chains.splice(i, 1);
  for (let i = snipes.length - 1; i >= 0; i--) if (--snipes[i].life <= 0) snipes.splice(i, 1);
  for (let i = booms.length - 1; i >= 0; i--) {
    const b = booms[i];
    b.r += (b.max - b.r) * 0.3;
    if (--b.life <= 0) booms.splice(i, 1);
  }

  if (state === 'title') { titleT++; handleTitleTaps(); return; }
  if (state === 'map') { handleMapTaps(); return; }

  // play
  if (!overOverlay) {
    // logic at 30tps: every other frame at 1x, every frame at 2x
    const ticks = speed === 2 ? 1 : (frame % 2 === 0 ? 1 : 0);
    for (let i = 0; i < ticks; i++) {
      Sim.tickGame(G);
      drainEvents();
      if (overOverlay) break;
    }
  } else overOverlay.t++;

  handlePlayTaps();
}

// ---- tap handling ---------------------------------------------------------------
function handleTitleTaps() {
  if (taps.length) { taps = []; state = 'map'; Snd.go(); }
}

const MAP_NODE = i => {
  const w = (i / 10) | 0, k = i % 10;
  const col = k % 5, row = (k / 5) | 0;
  return { x: 150 + col * 160 + (row % 2 ? 40 : 0), y: 130 + w * 150 + row * 62 - mapScroll };
};
function handleMapTaps() {
  for (const p of taps) {
    if (p.y < 60 && p.x < 120) { state = 'title'; break; }
    for (let i = 0; i < LEVELS.length; i++) {
      const n = MAP_NODE(i);
      if ((p.x - n.x) ** 2 + (p.y - n.y) ** 2 < 34 * 34) {
        if (i <= save.unlocked) { startLevel(i); Snd.go(); }
        else Snd.deny();
        break;
      }
    }
  }
  taps = [];
  // gentle autoscroll toward current progress on entry
}

function cardRects() {
  const types = LEVELS[lvlIdx].towersAllowed;
  const cw = 74;
  const x0 = 12;
  return types.map((t, i) => ({ type: t, x: x0 + i * (cw + 6), y: PLAY_H + 6, w: cw, h: 48 }));
}

function handlePlayTaps() {
  for (const p of taps) {
    if (overOverlay) {
      if (overOverlay.t < 30) continue;
      if (overOverlay.won) {
        if (lvlIdx + 1 < LEVELS.length && lvlIdx + 1 <= save.unlocked) startLevel(lvlIdx + 1);
        else exitToMap();
      } else {
        // defeat: retry from checkpoint (left half) or restart (right half)
        if (overOverlay.cp && p.x < W / 2) {
          Sim.restore(G, overOverlay.cp);
          overOverlay = null;
          drainEvents();
          Snd.music(LEVELS[lvlIdx].world - 1);
        } else {
          startLevel(lvlIdx);
        }
      }
      continue;
    }
    // top bar buttons
    if (p.y < 40) {
      if (p.x > W - 60) { speed = speed === 1 ? 2 : 1; Snd.ui(); continue; }
      if (p.x < 60) { exitToMap(); continue; }
    }
    // start wave button
    if (!G.waveActive && p.x > W - 150 && p.y > PLAY_H - 64 && p.y < PLAY_H - 8) { trySendWave(); continue; }
    // tower bar
    if (p.y >= PLAY_H) {
      let hit = false;
      for (const cRect of cardRects()) {
        if (p.x >= cRect.x && p.x <= cRect.x + cRect.w && p.y >= cRect.y && p.y <= cRect.y + cRect.h) {
          selCard = selCard === cRect.type ? null : cRect.type;
          selTower = null;
          Snd.ui();
          hit = true;
          break;
        }
      }
      if (!hit) { selCard = null; }
      continue;
    }
    // upgrade panel taps (when a tower is selected)
    if (selTower) {
      const px = clamp(selTower.x, 90, W - 90);
      const py = selTower.y < 120 ? selTower.y + 58 : selTower.y - 92;
      if (p.x > px - 88 && p.x < px + 88 && p.y > py && p.y < py + 66) {
        if (p.x < px) {
          if (Sim.upgrade(G, selTower)) drainEvents(); else Snd.deny();
        } else {
          Sim.sell(G, selTower);
          drainEvents();
          selTower = null;
        }
        continue;
      }
    }
    // map area: place or select
    const c = (p.x / CELL) | 0, r = (p.y / CELL) | 0;
    if (selCard) {
      const cost = Sim.TOWERS[selCard].tiers[0].cost;
      if (G.gold >= cost && Sim.canBuild(G, c, r)) {
        Sim.place(G, selCard, c, r);
        drainEvents();
        if (G.gold < cost) selCard = null;
      } else Snd.deny();
    } else {
      selTower = Sim.towerAt(G, c, r);
      if (selTower) Snd.ui();
    }
  }
  taps = [];
}

// ---- drawing -------------------------------------------------------------------------
function draw() {
  if (state === 'title') { drawTitle(); return; }
  if (state === 'map') { drawMap(); return; }
  drawPlay();
}

function drawPlay() {
  const th = THEMES[LEVELS[lvlIdx].world - 1];
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.save();
  ctx.translate(sx, sy);

  // ground checker
  for (let r = 0; r < Sim.GRID_H; r++) {
    for (let c = 0; c < Sim.GRID_W; c++) {
      ctx.fillStyle = (c + r) % 2 ? th.g1 : th.g2;
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }
  // path
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = th.edge;
  ctx.lineWidth = 34;
  strokePath();
  ctx.strokeStyle = th.path;
  ctx.lineWidth = 26;
  strokePath();
  // start/end markers
  const st0 = G.path.px[0], en = G.path.px[G.path.px.length - 1];
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.arc(st0[0], st0[1], 20, 0, Math.PI * 2); ctx.fill();
  drawKeep(en[0], en[1]);

  // props
  for (const pr of LEVELS[lvlIdx].props || []) drawProp(pr, th);

  // build highlight when placing
  if (selCard) {
    ctx.globalAlpha = 0.25;
    for (const b of G.buildable) {
      if (!Sim.towerAt(G, b.c, b.r)) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(b.c * CELL + 3, b.r * CELL + 3, CELL - 6, CELL - 6);
      }
    }
    ctx.globalAlpha = 1;
  }

  // towers (sorted by y for overlap)
  const sorted = [...G.towers].sort((a, b) => a.y - b.y);
  for (const t of sorted) drawTower(t, t.x, t.y);

  // selected tower range ring + panel
  if (selTower && G.towers.includes(selTower)) {
    const conf = Sim.TOWERS[selTower.type].tiers[selTower.tier - 1];
    if (conf.range && conf.range < 999) {
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(selTower.x, selTower.y, conf.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  } else selTower = null;

  // ghost placement
  if (selCard && pointer.y < PLAY_H) {
    const c = (pointer.x / CELL) | 0, r = (pointer.y / CELL) | 0;
    const ok = Sim.canBuild(G, c, r) && G.gold >= Sim.TOWERS[selCard].tiers[0].cost;
    const gx = c * CELL + CELL / 2, gy = r * CELL + CELL / 2;
    const conf = Sim.TOWERS[selCard].tiers[0];
    if (conf.range && conf.range < 999) {
      ctx.fillStyle = ok ? 'rgba(120,255,120,0.12)' : 'rgba(255,80,80,0.12)';
      ctx.strokeStyle = ok ? 'rgba(120,255,120,0.6)' : 'rgba(255,80,80,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(gx, gy, conf.range, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    drawTower({ type: selCard, tier: 1 }, gx, gy, true);
    ctx.fillStyle = ok ? 'rgba(120,255,120,0.4)' : 'rgba(255,80,80,0.4)';
    ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
  }

  // mobs (sorted by path distance so the front of the horde draws on top)
  const mobs = [...G.mobs].sort((a, b) => a.d - b.d);
  for (const m of mobs) {
    if (m.d < 0) continue;
    const sp = mobSprite(m);
    const bob = 1 + Math.sin(G.tick * 0.25 + m.wob) * 0.07;
    const fl = m.air ? Math.sin(G.tick * 0.1 + m.wob) * 4 - 12 : 0;
    if (m.chill > 0) { ctx.filter = 'saturate(0.5) brightness(1.2)'; }
    drawSpriteAt(sp, m.x, m.y + fl, bob);
    ctx.filter = 'none';
    if (m.burnT > 0) {
      ctx.fillStyle = 'rgba(255,140,40,0.85)';
      const fh = 6 + Math.sin(G.tick * 0.4 + m.wob) * 3;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y - m.r - fh - 4 + fl);
      ctx.quadraticCurveTo(m.x + 5, m.y - m.r + fl, m.x, m.y - m.r + 3 + fl);
      ctx.quadraticCurveTo(m.x - 5, m.y - m.r + fl, m.x, m.y - m.r - fh - 4 + fl);
      ctx.fill();
    }
    // hp bar when hurt
    if (m.hp < m.maxHp) {
      const bw = m.boss ? 60 : 26;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(m.x - bw / 2, m.y - m.r - 10 + fl, bw, 4);
      ctx.fillStyle = m.boss ? '#ff5f5f' : '#7ed957';
      ctx.fillRect(m.x - bw / 2, m.y - m.r - 10 + fl, bw * clamp(m.hp / m.maxHp, 0, 1), 4);
    }
  }

  // shots
  for (const s of G.shots) {
    if (s.kind === 'cannon') {
      ctx.fillStyle = '#39404f';
      ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
    } else if (s.kind === 'ember') {
      ctx.fillStyle = '#ff9a3c';
      ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#ffe28a';
      ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // fx layers
  for (const b of booms) {
    ctx.strokeStyle = b.heal ? 'rgba(255,150,210,0.6)' : 'rgba(255,190,90,0.8)';
    ctx.lineWidth = b.heal ? 2 : 4;
    ctx.globalAlpha = b.life / 12;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const ch of chains) {
    ctx.strokeStyle = `rgba(202,168,255,${ch.life / 8})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ch.pts.forEach((p, i) => {
      const jx = i ? rnd(-3, 3) : 0, jy = i ? rnd(-3, 3) : 0;
      i ? ctx.lineTo(p.x + jx, p.y + jy) : ctx.moveTo(p.x, p.y);
    });
    ctx.stroke();
  }
  for (const s of snipes) {
    ctx.strokeStyle = `rgba(255,255,255,${s.life / 8})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1 - 20); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
  for (const p of fx) {
    ctx.globalAlpha = clamp(p.life / 22, 0, 1);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
  }
  ctx.globalAlpha = 1;
  // coins arcing to the counter
  for (const c of coinsFx) {
    const k = c.t, ex = 150, ey = 20;
    const x = c.x + (ex - c.x) * k, y = c.y + (ey - c.y) * k - Math.sin(k * Math.PI) * 60;
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#b8791b';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  // damage numbers
  ctx.textAlign = 'center';
  for (const d of dnums) {
    ctx.globalAlpha = clamp(d.life / 16, 0, 1);
    ctx.font = "900 13px 'Arial Black', sans-serif";
    ctx.strokeStyle = 'rgba(30,20,40,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeText(d.v, d.x, d.y);
    ctx.fillStyle = d.col;
    ctx.fillText(d.v, d.x, d.y);
  }
  ctx.globalAlpha = 1;

  ctx.restore();  // shake

  drawPlayHud();
  if (overOverlay) drawOverlay();
}

function strokePath() {
  ctx.beginPath();
  G.path.px.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.stroke();
}

function drawKeep(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#c8beb0';
  ctx.strokeStyle = '#7a7266';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(-24, -30, 48, 44, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7a7266';
  for (let i = -1; i <= 1; i++) ctx.fillRect(i * 14 - 5, -38, 10, 10);
  ctx.fillStyle = '#5a5248';
  ctx.beginPath(); ctx.roundRect(-9, -6, 18, 20, 8); ctx.fill();
  const fw = Math.sin(frame * 0.1) * 3;
  ctx.fillStyle = '#ff5f5f';
  ctx.beginPath();
  ctx.moveTo(0, -52); ctx.lineTo(18 + fw, -47); ctx.lineTo(0, -42);
  ctx.fill();
  ctx.strokeStyle = '#5a5248';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(0, -30); ctx.stroke();
  ctx.restore();
}

function drawProp(pr, th) {
  const x = pr.c * CELL + CELL / 2, y = pr.r * CELL + CELL / 2;
  ctx.save();
  ctx.translate(x, y);
  if (th.prop === 'tree' || th.prop === 'pine') {
    ctx.fillStyle = '#6b4820';
    ctx.fillRect(-3, 2, 6, 10);
    ctx.fillStyle = th.prop === 'pine' ? '#3f7a4f' : '#4f9e33';
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    if (th.prop === 'pine') {
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(12, 4); ctx.lineTo(-12, 4); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(6, -10); ctx.lineTo(-6, -10); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(0, -8, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  } else if (th.prop === 'cactus') {
    ctx.fillStyle = '#4f9e5f';
    ctx.strokeStyle = '#2f6e3f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-4, -16, 8, 26, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(-13, -10, 8, 5, 2.5); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.roundRect(5, -4, 8, 5, 2.5); ctx.fill(); ctx.stroke();
  } else if (th.prop === 'rock') {
    ctx.fillStyle = '#4a423e';
    ctx.strokeStyle = '#2e2926';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 8); ctx.lineTo(-8, -8); ctx.lineTo(2, -12); ctx.lineTo(12, -2); ctx.lineTo(10, 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7f50';
    ctx.fillRect(-3, -4, 4, 3);
  } else {
    ctx.fillStyle = '#8f7fd8';
    ctx.strokeStyle = '#5f4fa8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(7, -4); ctx.lineTo(0, 10); ctx.lineTo(-7, -4);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawPlayHud() {
  // bottom bar
  ctx.fillStyle = '#241f38';
  ctx.fillRect(0, PLAY_H, W, H - PLAY_H);
  for (const cRect of cardRects()) {
    const def = Sim.TOWERS[cRect.type];
    const cost = def.tiers[0].cost;
    const afford = G.gold >= cost;
    const sel = selCard === cRect.type;
    ctx.fillStyle = sel ? '#4a3e8f' : afford ? '#37304f' : '#2a2540';
    ctx.strokeStyle = sel ? '#ffd23f' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = sel ? 3 : 1.5;
    ctx.beginPath(); ctx.roundRect(cRect.x, cRect.y, cRect.w, cRect.h, 8); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = afford ? 1 : 0.45;
    drawTower({ type: cRect.type, tier: 1 }, cRect.x + 22, cRect.y + 30, false);
    ctx.textAlign = 'left';
    ctx.fillStyle = afford ? '#ffd23f' : '#8a8a9a';
    ctx.font = "900 12px 'Arial Black', sans-serif";
    ctx.fillText('●' + cost, cRect.x + 40, cRect.y + 30);
    ctx.globalAlpha = 1;
  }

  // top bar chips
  const chip = (x, w, txt, col) => {
    ctx.fillStyle = 'rgba(20,15,35,0.75)';
    ctx.beginPath(); ctx.roundRect(x, 8, w, 26, 13); ctx.fill();
    ctx.fillStyle = col;
    ctx.font = "900 14px 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(txt, x + w / 2, 26);
  };
  chip(8, 52, '‹ map', '#cfc8e8');
  chip(70, 90, '♥ ' + G.lives, G.lives <= 5 ? '#ff6b6b' : '#7ed957');
  chip(168, 100, '● ' + G.gold, '#ffd23f');
  chip(276, 120, 'wave ' + Math.max(1, G.waveIdx + 1) + '/' + LEVELS[lvlIdx].waves.length, '#fff');
  chip(W - 56, 48, speed + '×', speed === 2 ? '#54e0ff' : '#cfc8e8');

  // level name
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = "900 13px 'Arial Black', sans-serif";
  ctx.fillText(LEVELS[lvlIdx].name.toUpperCase(), W - 70, 26);

  // start wave button
  if (!G.waveActive && !G.over) {
    const bp = 1 + Math.sin(frame * 0.1) * 0.05;
    ctx.save();
    ctx.translate(W - 80, PLAY_H - 36);
    ctx.scale(bp, bp);
    const bg = ctx.createLinearGradient(0, -24, 0, 24);
    bg.addColorStop(0, '#7ed957'); bg.addColorStop(1, '#4f9e33');
    ctx.fillStyle = bg;
    ctx.strokeStyle = '#1c3312';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.roundRect(-62, -26, 124, 52, 26); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1c3312';
    ctx.font = "900 17px 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(G.waveIdx < 0 ? 'START!' : 'NEXT ▶', 0, 6);
    ctx.restore();
  }

  // selected tower panel
  if (selTower) {
    const def = Sim.TOWERS[selTower.type];
    const px = clamp(selTower.x, 90, W - 90);
    const py = selTower.y < 120 ? selTower.y + 58 : selTower.y - 92;
    ctx.fillStyle = 'rgba(20,15,35,0.92)';
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(px - 88, py, 176, 66, 10); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = "900 13px 'Arial Black', sans-serif";
    ctx.fillText(def.name + '  T' + selTower.tier, px, py + 17);
    // upgrade half
    const canUp = selTower.tier < 3;
    const upCost = canUp ? def.tiers[selTower.tier].cost : 0;
    ctx.fillStyle = canUp ? (G.gold >= upCost ? '#4f9e33' : '#3a4a30') : '#333';
    ctx.beginPath(); ctx.roundRect(px - 80, py + 26, 76, 32, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = "900 12px 'Arial Black', sans-serif";
    ctx.fillText(canUp ? '▲ ●' + upCost : 'MAX', px - 42, py + 46);
    // sell half
    ctx.fillStyle = '#8a4a2a';
    ctx.beginPath(); ctx.roundRect(px + 4, py + 26, 76, 32, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText('sell ●' + Math.floor(selTower.spent * 0.7), px + 42, py + 46);
  }

  // banner
  if (banner) {
    const a = banner.t > 40 ? 1 : banner.t / 40;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = "900 40px 'Arial Black', sans-serif";
    ctx.strokeStyle = 'rgba(20,15,35,0.9)';
    ctx.lineWidth = 7;
    ctx.strokeText(banner.text, W / 2, 120);
    ctx.fillStyle = '#fff';
    ctx.fillText(banner.text, W / 2, 120);
    if (banner.sub) {
      ctx.font = "900 15px 'Arial Black', sans-serif";
      ctx.strokeText(banner.sub, W / 2, 150);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(banner.sub, W / 2, 150);
    }
    ctx.globalAlpha = 1;
  }

  // checkpoint toast
  if (checkpointToast > 0) {
    const a = Math.min(1, checkpointToast / 30);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(20,60,30,0.9)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 150, 160, 300, 34, 17); ctx.fill();
    ctx.strokeStyle = '#7ed957'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#c8f0b0';
    ctx.font = "900 14px 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText('✓ CHECKPOINT SAVED', W / 2, 182);
    ctx.globalAlpha = 1;
  }

  // boss health strip
  const bossMob = G.mobs.find(m => m.boss);
  if (bossMob) {
    ctx.fillStyle = 'rgba(20,15,35,0.8)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 200, 44, 400, 22, 11); ctx.fill();
    ctx.fillStyle = '#ff5f5f';
    ctx.beginPath(); ctx.roundRect(W / 2 - 197, 47, 394 * clamp(bossMob.hp / bossMob.maxHp, 0, 1), 16, 8); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = "900 12px 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(bossMob.name, W / 2, 59);
  }
}

function drawOverlay() {
  const o = overOverlay;
  ctx.fillStyle = `rgba(15,10,30,${Math.min(0.8, o.t * 0.03)})`;
  ctx.fillRect(0, 0, W, H);
  if (o.t < 20) return;
  ctx.textAlign = 'center';
  if (o.won) {
    // fireworks
    if (frame % 9 === 0) pop(rnd(100, W - 100), rnd(80, 280), ['#ff5f8a', '#ffd23f', '#54e0ff', '#7ed957'][frame % 4], 20);
    for (const p of fx) {
      ctx.globalAlpha = clamp(p.life / 22, 0, 1);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    }
    ctx.globalAlpha = 1;
    ctx.font = "900 52px 'Arial Black', sans-serif";
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 8;
    ctx.strokeText('VICTORY!', W / 2, H * 0.32);
    ctx.fillStyle = '#7ed957';
    ctx.fillText('VICTORY!', W / 2, H * 0.32);
    // stars
    for (let i = 0; i < 3; i++) {
      const on = i < o.stars && o.t > 40 + i * 18;
      ctx.font = '900 54px sans-serif';
      ctx.fillStyle = on ? '#ffd23f' : 'rgba(255,255,255,0.18)';
      const bounce = on && o.t < 60 + i * 18 ? (60 + i * 18 - o.t) * 0.5 : 0;
      ctx.fillText('★', W / 2 + (i - 1) * 74, H * 0.47 - bounce);
    }
    ctx.fillStyle = '#fff';
    ctx.font = "900 17px 'Arial Black', sans-serif";
    ctx.fillText(G.lives + ' / 20 lives kept', W / 2, H * 0.57);
    const p = 0.5 + 0.3 * Math.sin(frame * 0.1);
    ctx.fillStyle = `rgba(255,255,255,${p})`;
    ctx.font = '15px sans-serif';
    ctx.fillText(lvlIdx + 1 < LEVELS.length ? 'tap for the next level' : 'tap — you finished the war', W / 2, H * 0.67);
  } else {
    ctx.font = "900 46px 'Arial Black', sans-serif";
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 8;
    ctx.strokeText('THE KEEP FELL', W / 2, H * 0.3);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText('THE KEEP FELL', W / 2, H * 0.3);
    if (o.cp) {
      // two buttons: checkpoint / restart
      ctx.fillStyle = '#4f9e33';
      ctx.beginPath(); ctx.roundRect(W / 2 - 260, H * 0.42, 240, 74, 14); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = "900 18px 'Arial Black', sans-serif";
      ctx.fillText('⚑ RETRY FROM', W / 2 - 140, H * 0.42 + 32);
      ctx.fillText('WAVE ' + (o.cp.waveIdx + 2), W / 2 - 140, H * 0.42 + 56);
      ctx.fillStyle = '#8a4a2a';
      ctx.beginPath(); ctx.roundRect(W / 2 + 20, H * 0.42, 240, 74, 14); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('⟳ RESTART', W / 2 + 140, H * 0.42 + 44);
    } else {
      const p = 0.5 + 0.3 * Math.sin(frame * 0.1);
      ctx.fillStyle = `rgba(255,255,255,${p})`;
      ctx.font = '16px sans-serif';
      ctx.fillText('tap to retry', W / 2, H * 0.5);
    }
  }
}

// ---- title + map screens --------------------------------------------------------------
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3ec6ff');
  g.addColorStop(0.62, '#8fe0ff');
  g.addColorStop(0.64, '#7ec850');
  g.addColorStop(1, '#4f9e33');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // clouds
  for (let i = 0; i < 4; i++) {
    const x = ((i * 270 + frame * 0.2) % (W + 200)) - 100;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x, 70 + i * 30, 22, 0, Math.PI * 2);
    ctx.arc(x + 25, 74 + i * 30, 16, 0, Math.PI * 2);
    ctx.arc(x - 25, 75 + i * 30, 14, 0, Math.PI * 2);
    ctx.fill();
  }
  // the keep on a hill
  ctx.fillStyle = '#6bb548';
  ctx.beginPath(); ctx.ellipse(W / 2, H * 0.76, 260, 80, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(W / 2, H * 0.62);
  ctx.scale(2.2, 2.2);
  drawKeep(0, 0);
  ctx.restore();
  // marching blobs around the hill
  for (let i = 0; i < 12; i++) {
    const t = (frame * 0.008 + i / 12) % 1;
    const a = t * Math.PI * 2;
    const x = W / 2 + Math.cos(a) * 300;
    const y = H * 0.78 + Math.sin(a) * 62;
    if (Math.sin(a) < -0.2) continue;
    const types = ['gloop', 'runner', 'brute', 'shell', 'floaty'];
    const ty = types[i % types.length];
    const e = Sim.ENEMIES[ty];
    const sp = blobSprite('t_' + ty + e.r, e.r, e.col, e.dark, { wings: e.air });
    drawSpriteAt(sp, x, y, 1 + Math.sin(frame * 0.2 + i) * 0.08);
  }
  // logo
  const word = 'SWARM KEEP';
  ctx.textAlign = 'center';
  for (let i = 0; i < word.length; i++) {
    const x = W / 2 + (i - (word.length - 1) / 2) * 52;
    const y = 110 + Math.sin(frame * 0.06 + i * 0.6) * 7;
    ctx.font = "900 64px 'Arial Black', sans-serif";
    ctx.strokeStyle = '#1c3312';
    ctx.lineWidth = 9;
    ctx.strokeText(word[i], x, y);
    const lg = ctx.createLinearGradient(0, y - 52, 0, y);
    lg.addColorStop(0, '#ffe86b');
    lg.addColorStop(1, '#ff8a3c');
    ctx.fillStyle = lg;
    ctx.fillText(word[i], x, y);
  }
  ctx.font = "900 16px 'Arial Black', sans-serif";
  ctx.fillStyle = '#1c3312';
  ctx.fillText('THE SWARM IS BACK. THIS TIME, YOU BUILD.', W / 2, 148);

  const bp = 1 + Math.sin(frame * 0.09) * 0.04;
  ctx.save();
  ctx.translate(W / 2, H - 70);
  ctx.scale(bp, bp);
  const bg = ctx.createLinearGradient(0, -30, 0, 30);
  bg.addColorStop(0, '#ffd23f'); bg.addColorStop(1, '#ff9a2f');
  ctx.fillStyle = bg;
  ctx.strokeStyle = '#1c3312';
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.roundRect(-120, -30, 240, 60, 30); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#1c3312';
  ctx.font = "900 26px 'Arial Black', sans-serif";
  ctx.fillText('TO BATTLE!', 0, 9);
  ctx.restore();

  const stars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  if (stars > 0) {
    ctx.font = "900 14px 'Arial Black', sans-serif";
    ctx.fillStyle = '#1c3312';
    ctx.fillText('★ ' + stars + ' / 150', W / 2, H - 22);
  }
}

function drawMap() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2a3a55');
  g.addColorStop(1, '#1a2438');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const stars = save.stars;
  // road between nodes
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < LEVELS.length; i++) {
    const n = MAP_NODE(i);
    i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y);
  }
  ctx.stroke();

  for (let w = 0; w < 5; w++) {
    const y0 = 82 + w * 150 - mapScroll;
    if (y0 > -40 && y0 < H) {
      const th = THEMES[w];
      ctx.fillStyle = th.g1;
      ctx.beginPath(); ctx.roundRect(40, y0 - 20, 220, 34, 17); ctx.fill();
      ctx.fillStyle = '#1c2a12';
      ctx.font = "900 16px 'Arial Black', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('WORLD ' + (w + 1) + ' · ' + WORLD_NAMES[w], 150, y0 + 3);
    }
  }
  for (let i = 0; i < LEVELS.length; i++) {
    const n = MAP_NODE(i);
    if (n.y < -40 || n.y > H + 40) continue;
    const th = THEMES[LEVELS[i].world - 1];
    const unlocked = i <= save.unlocked;
    const got = stars[i] || 0;
    ctx.fillStyle = unlocked ? th.g1 : 'rgba(255,255,255,0.1)';
    ctx.strokeStyle = i === save.unlocked ? '#ffd23f' : 'rgba(0,0,0,0.4)';
    ctx.lineWidth = i === save.unlocked ? 4 : 2.5;
    ctx.beginPath(); ctx.arc(n.x, n.y, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = unlocked ? '#1c2a12' : 'rgba(255,255,255,0.3)';
    ctx.font = "900 16px 'Arial Black', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? (i + 1) : '🔒', n.x, n.y + 6);
    if (got > 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = '11px sans-serif';
      ctx.fillText('★'.repeat(got), n.x, n.y + 22);
    }
    if (i % 10 === 9 && unlocked) {
      ctx.font = '15px sans-serif';
      ctx.fillText('👑', n.x, n.y - 30);
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = "900 14px 'Arial Black', sans-serif";
  ctx.textAlign = 'left';
  ctx.fillText('‹ TITLE', 16, 30);
  ctx.textAlign = 'right';
  const total = Object.values(stars).reduce((a, b) => a + b, 0);
  ctx.fillText('★ ' + total + ' / 150', W - 16, 30);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '12px sans-serif';
  ctx.fillText('scroll for more worlds', W / 2, H - 12);

  // touch scroll: drag handled via wheel; also auto-focus current level
  const cur = MAP_NODE(save.unlocked);
  if (cur.y > H - 80) mapScroll = clamp(mapScroll + 4, 0, 320);
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
window.__keep = {
  state: () => state,
  game: () => G,
  level: () => lvlIdx,
  start(i) { startLevel(i); },
  place(type, c, r) { const ok = Sim.place(G, type, c, r); drainEvents(); return ok; },
  upgrade(c, r) { const t = Sim.towerAt(G, c, r); const ok = t && Sim.upgrade(G, t); drainEvents(); return ok; },
  sell(c, r) { const t = Sim.towerAt(G, c, r); const ok = t && Sim.sell(G, t); drainEvents(); return ok; },
  wave() { trySendWave(); },
  fast(n) { for (let i = 0; i < n && G && !G.over; i++) { Sim.tickGame(G); drainEvents(); } },
  overlay: () => overOverlay,
  retryCheckpoint() {
    const cp = Sim.latestCheckpoint(G);
    if (cp) { Sim.restore(G, cp); overOverlay = null; drainEvents(); return true; }
    return false;
  },
  buildable: () => G.buildable
};

})();
