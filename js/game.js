// LOCKSTEP - renderer, input, menu. The rules live in sim.js; this file
// gives them stone, torchlight and consequences.

(() => {
'use strict';

const W = 960, H = 540;
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

// stone tints per world: [hue, sat, accent hue]
const PALS = [
  [220, 8, 36], [15, 14, 20], [270, 10, 300], [200, 12, 180], [45, 12, 55],
  [100, 8, 90], [195, 22, 200], [35, 16, 46], [330, 10, 350], [0, 16, 10]
];
const WORLD_NAMES = ['STEPS', 'HOUNDS', 'MIMICS', 'MIRRORS', 'WARDENS', 'STONES', 'ICE', 'KEYS', 'LIES', 'LOCKSTEP'];
const WORLD_HINTS = [
  'they move when you move',
  'hounds chase. pits are hungry',
  'it copies your every move',
  'it does the opposite',
  'the eye fires every fourth step',
  'stones crush, plug and shield',
  'ice does not stop for you',
  'keys open doors. once',
  'the room is lying to you',
  'everything. all at once'
];

// ---- save -------------------------------------------------------------------
const save = {
  get unlocked() { return Math.min(+(localStorage.getItem('ls_unlocked') || 0), LEVELS.length - 1); },
  set unlocked(v) { localStorage.setItem('ls_unlocked', v); },
  get stars() { try { return JSON.parse(localStorage.getItem('ls_stars') || '{}'); } catch (e) { return {}; } },
  set stars(v) { localStorage.setItem('ls_stars', JSON.stringify(v)); },
  get deaths() { return +(localStorage.getItem('ls_deaths') || 0); },
  set deaths(v) { localStorage.setItem('ls_deaths', v); }
};

// ---- state --------------------------------------------------------------------
let state = 'menu';
let frame = 0;
let roomIdx = 0;
let room = null, st = null;
let history = [];
let moves = 0, deathsHere = 0;
let anim = null;              // {t0, prev:{px,py,ents:[{x,y,deadE}]}, events}
let moveQueue = [];
let deadT = 0, winT = 0, introT = 0;
let shake = 0;
let particles = [];
let revealedFakes = {};       // roomIdx -> Set of "x,y" fake exits found
let menuSel = 0, menuScroll = 0;
let replayMoves = null, replayAt = 0;

const cellSizeFor = (r) => Math.min(54, Math.floor(840 / r.w), Math.floor(420 / r.h));
let CELL = 54, BX = 0, BY = 0;

function pal() { return PALS[(LEVELS[roomIdx].world - 1) % PALS.length]; }

function loadRoom(i) {
  roomIdx = i;
  room = Sim.parseRoom(LEVELS[i]);
  st = Sim.newState(room);
  history = [];
  moves = 0; deathsHere = 0;
  anim = null; moveQueue = [];
  deadT = 0; winT = 0; introT = 90;
  particles = [];
  CELL = cellSizeFor(room);
  BX = (W - room.w * CELL) / 2;
  BY = (H - room.h * CELL) / 2 + 14;
  Snd.start(LEVELS[i].world - 1);
  state = 'play';
}

function cloneSt(s) {
  return { ...s, ents: s.ents.map(e => ({ ...e })), tiles: s.tiles.map(r => r.slice()), ev: [] };
}

function doMove(mv) {
  if (st.dead || st.won) return;
  history.push(cloneSt(st));
  if (history.length > 400) history.shift();
  const prev = { px: st.px, py: st.py, ents: st.ents.map(e => ({ x: e.x, y: e.y, deadE: e.deadE })) };
  Sim.step(room, st, mv);
  moves++;
  anim = { t0: performance.now(), prev, events: st.ev.slice() };
  Snd.thoom();
  shake = Math.min(shake + 1.2, 3);
  for (const ev of st.ev) {
    if (ev.t === 'bump') Snd.bump();
    else if (ev.t === 'key') Snd.key();
    else if (ev.t === 'unlock') Snd.unlock();
    else if (ev.t === 'push') Snd.push();
    else if (ev.t === 'crush') { Snd.crush(); burst(ev.x, ev.y, 14, 1); }
    else if (ev.t === 'fill') { Snd.fill(); burst(ev.x, ev.y, 10, 0); }
    else if (ev.t === 'entDie') { Snd.entDie(); burst(ev.x, ev.y, 14, 1); }
    else if (ev.t === 'wake') Snd.wake();
    else if (ev.t === 'charge') Snd.charge();
    else if (ev.t === 'fire') { Snd.fire(); shake = 5; }
    else if (ev.t === 'rune') { Snd.rune(); burst(ev.x, ev.y, 8, 1); }
    else if (ev.t === 'crumble') burst(ev.x, ev.y, 8, 0);
    else if (ev.t === 'fake') {
      (revealedFakes[roomIdx] = revealedFakes[roomIdx] || {})[ev.x + ',' + ev.y] = 1;
    }
  }
  if (st.dead) {
    Snd.death();
    shake = 8;
    deadT = 0;
    deathsHere++;
    save.deaths = save.deaths + 1;
    burst(st.px, st.py, 26, 2);
  }
  if (st.won) {
    Snd.win();
    winT = 0;
    const starsGot = moves <= room.par ? 3 : moves <= room.par + 3 ? 2 : 1;
    const all = save.stars;
    all[roomIdx] = Math.max(all[roomIdx] || 0, starsGot);
    save.stars = all;
    save.unlocked = Math.max(save.unlocked, Math.min(roomIdx + 1, LEVELS.length - 1));
  }
}

function undo() {
  if (!history.length || st.won) return;
  st = history.pop();
  moves = Math.max(0, moves - 1);
  anim = null;
  deadT = 0;
  Snd.undo();
}

function restart() {
  st = Sim.newState(room);
  history = [];
  moves = 0;
  anim = null; moveQueue = [];
  deadT = 0;
  Snd.undo();
}

function burst(cx, cy, n, kind) {
  const [h1, s1, h2] = pal();
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 1 + Math.random() * 3;
    particles.push({
      x: BX + (cx + 0.5) * CELL, y: BY + (cy + 0.5) * CELL,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1,
      life: 25 + Math.random() * 25, r: 1.5 + Math.random() * 3,
      col: kind === 2 ? '#e8e4da' : kind === 1 ? `hsl(${h2} 70% 60%)` : `hsl(${h1} ${s1}% 40%)`
    });
  }
}

// ---- input --------------------------------------------------------------------
window.addEventListener('keydown', e => {
  Snd.unlock();
  if (e.repeat) { if (state === 'play') e.preventDefault(); return; }
  if (state === 'menu') { menuKeys(e.code); return; }
  if (state === 'win') {
    if (e.code === 'Enter' || e.code === 'Space') { advance(); }
    return;
  }
  if (state === 'end') { if (e.code === 'Enter' || e.code === 'Space') toMenu(); return; }
  const map = {
    ArrowUp: 'U', KeyW: 'U', ArrowDown: 'D', KeyS: 'D',
    ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R',
    Space: 'W', Period: 'W'
  };
  if (map[e.code]) { e.preventDefault(); queueMove(map[e.code]); }
  if (e.code === 'KeyZ') undo();
  if (e.code === 'KeyR') restart();
  if (e.code === 'Escape') toMenu();
  if (e.code === 'KeyM') Snd.toggleMute();
});

function queueMove(mv) {
  if (moveQueue.length < 2) moveQueue.push(mv);
}

// touch: swipe = step, tap = wait, buttons for undo/restart
let touchStart = null;
let pointer = { x: 0, y: 0, tapped: false };
function cpos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  Snd.unlock();
  touchStart = cpos(e);
  touchStart.t = performance.now();
});
canvas.addEventListener('pointerup', e => {
  if (!touchStart) return;
  const p = cpos(e);
  const dx = p.x - touchStart.x, dy = p.y - touchStart.y;
  const dist = Math.hypot(dx, dy);
  if (state === 'menu') { pointer = { x: p.x, y: p.y, tapped: true }; touchStart = null; return; }
  if (state === 'win') { advance(); touchStart = null; return; }
  if (state === 'end') { toMenu(); touchStart = null; return; }
  if (dist > 24) {
    queueMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'));
  } else {
    // tap: buttons first, otherwise wait
    if (p.y < 40 && p.x > W - 60) Snd.toggleMute();
    else if (p.y > H - 52 && p.x < 90) undo();
    else if (p.y > H - 52 && p.x > W - 90) restart();
    else if (p.y < 40 && p.x < 90) toMenu();
    else queueMove('W');
  }
  touchStart = null;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

function advance() {
  if (roomIdx + 1 >= LEVELS.length) state = 'end';
  else loadRoom(roomIdx + 1);
}
function toMenu() {
  state = 'menu';
  menuSel = roomIdx;
  Snd.stop();
}

// ---- update --------------------------------------------------------------------
function update() {
  frame++;
  if (shake > 0) shake *= 0.85;
  if (introT > 0) introT--;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  if (state !== 'play') return;

  if (replayMoves && !st.dead && !st.won) {
    if (frame % 9 === 0 && replayAt < replayMoves.length) {
      doMove(replayMoves[replayAt++]);
    }
    return;
  }

  const animating = anim && performance.now() - anim.t0 < 105;
  if (!animating && moveQueue.length && !st.dead && !st.won) {
    doMove(moveQueue.shift());
  }
  if (st.dead) deadT++;
  if (st.won) {
    winT++;
    if (winT > 10) state = 'win';   // hand input over to the CLEAR card
  }
}

// ---- menu -------------------------------------------------------------------
const GRID = { cols: 10, cw: 78, ch: 35, x0: 96, y0: 150 };
function cellRect(i) {
  const col = i % GRID.cols, row = (i / GRID.cols) | 0;
  return { x: GRID.x0 + col * GRID.cw, y: GRID.y0 + row * GRID.ch - menuScroll, w: GRID.cw - 10, h: GRID.ch - 9 };
}
function menuKeys(code) {
  const before = menuSel;
  if (code === 'ArrowLeft' || code === 'KeyA') menuSel = Math.max(0, menuSel - 1);
  if (code === 'ArrowRight' || code === 'KeyD') menuSel = Math.min(save.unlocked, menuSel + 1);
  if (code === 'ArrowUp' || code === 'KeyW') menuSel = Math.max(0, menuSel - 10);
  if (code === 'ArrowDown' || code === 'KeyS') menuSel = Math.min(save.unlocked, menuSel + 10);
  if (menuSel !== before) Snd.uiMove();
  if (code === 'Enter' || code === 'Space') { Snd.uiGo(); loadRoom(menuSel); }
  if (code === 'KeyM') Snd.toggleMute();
}
function updateMenu() {
  const target = Math.max(0, ((menuSel / 10) | 0) * GRID.ch - 105);
  menuScroll += (target - menuScroll) * 0.15;
  if (pointer.tapped) {
    pointer.tapped = false;
    for (let i = 0; i < LEVELS.length; i++) {
      const r = cellRect(i);
      if (pointer.x > r.x && pointer.x < r.x + r.w && pointer.y > r.y && pointer.y < r.y + r.h) {
        if (i <= save.unlocked) { Snd.uiGo(); loadRoom(i); }
        return;
      }
    }
  }
}

// ---- drawing helpers ------------------------------------------------------------
function cellXY(x, y) { return [BX + x * CELL, BY + y * CELL]; }

function lerpPos(e, prevE, k) {
  if (!prevE) return [e.x, e.y];
  return [prevE.x + (e.x - prevE.x) * k, prevE.y + (e.y - prevE.y) * k];
}

function eyes(cx, cy, r, look) {
  ctx.fillStyle = '#f5f2e8';
  ctx.shadowColor = '#fffef0';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(cx - r + (look ? look[0] : 0), cy + (look ? look[1] : 0), r * 0.42, 0, Math.PI * 2);
  ctx.arc(cx + r + (look ? look[0] : 0), cy + (look ? look[1] : 0), r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ---- main draw --------------------------------------------------------------------
function draw() {
  if (state === 'menu') { updateMenu(); drawMenu(); return; }
  if (state === 'end') { drawEnd(); return; }

  const [h1, s1, h2] = pal();
  const k = anim ? Math.min(1, (performance.now() - anim.t0) / 105) : 1;
  const ease = 1 - Math.pow(1 - k, 3);

  // chamber background
  const g = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 620);
  g.addColorStop(0, `hsl(${h1} ${s1}% 13%)`);
  g.addColorStop(1, `hsl(${h1} ${s1 + 4}% 4%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // dust motes
  for (let i = 0; i < 14; i++) {
    const mx = ((i * 173 + frame * (0.1 + i % 3 * 0.06)) % (W + 60)) - 30;
    const my = 40 + (i * 97) % (H - 80) + Math.sin(frame * 0.008 + i) * 10;
    ctx.fillStyle = `hsla(${h2} 40% 70% / ${0.03 + (i % 3) * 0.015})`;
    ctx.fillRect(mx, my, 2, 2);
  }

  ctx.save();
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
  ctx.translate(sx, sy);

  // board shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.roundRect(BX - 10, BY - 10, room.w * CELL + 20, room.h * CELL + 24, 10);
  ctx.fill();

  drawTiles(h1, s1, h2);
  drawBeamTelegraph(h2);
  drawEntities(h1, s1, h2, ease);
  ctx.restore();

  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 20);
    ctx.fillStyle = p.col;
    ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
  }
  ctx.globalAlpha = 1;

  drawHud(h1, h2);
}

function drawTiles(h1, s1, h2) {
  for (let y = 0; y < room.h; y++) {
    for (let x = 0; x < room.w; x++) {
      const t = st.tiles[y][x];
      const [px, py] = cellXY(x, y);
      const n = ((x * 73856093 ^ y * 19349663) % 7) - 3;   // per-cell shade
      if (t === '#') continue;   // walls drawn after (raised)

      // base floor
      ctx.fillStyle = `hsl(${h1} ${s1}% ${20 + n}%)`;
      ctx.fillRect(px, py, CELL, CELL);
      ctx.strokeStyle = `hsla(${h1} ${s1}% 8% / 0.7)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, CELL - 1, CELL - 1);

      if (t === 'O') {
        const pg = ctx.createRadialGradient(px + CELL / 2, py + CELL / 2, 2, px + CELL / 2, py + CELL / 2, CELL * 0.55);
        pg.addColorStop(0, '#000');
        pg.addColorStop(0.8, '#050508');
        pg.addColorStop(1, `hsl(${h1} ${s1}% 12%)`);
        ctx.fillStyle = pg;
        ctx.fillRect(px, py, CELL, CELL);
      } else if (t === '^') {
        drawSpikes(px, py);
      } else if (t === '%') {
        ctx.strokeStyle = `hsla(${h1} ${s1}% 40% / 0.8)`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(px + CELL * 0.25, py + 3); ctx.lineTo(px + CELL * 0.45, py + CELL * 0.5); ctx.lineTo(px + CELL * 0.3, py + CELL - 3);
        ctx.moveTo(px + CELL * 0.7, py + 4); ctx.lineTo(px + CELL * 0.6, py + CELL * 0.55);
        ctx.stroke();
      } else if (t === '~') {
        ctx.fillStyle = `hsla(205 60% 70% / 0.24)`;
        ctx.fillRect(px, py, CELL, CELL);
        ctx.strokeStyle = 'hsla(200 80% 85% / 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(px + 6, py + CELL - 8); ctx.lineTo(px + CELL - 12, py + 8);
        ctx.moveTo(px + CELL * 0.55, py + CELL - 6); ctx.lineTo(px + CELL - 6, py + CELL * 0.55);
        ctx.stroke();
      } else if (t === '+') {
        // the lie: almost invisible. a patient eye catches the shimmer
        const sh = 0.05 + 0.05 * Math.sin(frame * 0.03 + x * 3 + y * 7);
        ctx.strokeStyle = `hsla(${h2} 80% 70% / ${sh})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.26, 0, Math.PI * 2);
        ctx.moveTo(px + CELL * 0.35, py + CELL * 0.5); ctx.lineTo(px + CELL * 0.65, py + CELL * 0.5);
        ctx.stroke();
      } else if (t === 'K') {
        ctx.save();
        ctx.translate(px + CELL / 2, py + CELL / 2 + Math.sin(frame * 0.07) * 2);
        ctx.strokeStyle = `hsl(${h2} 85% 65%)`;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-4, 0, 4.5, 0, Math.PI * 2);
        ctx.moveTo(0, 0); ctx.lineTo(10, 0);
        ctx.moveTo(7, 0); ctx.lineTo(7, 4);
        ctx.moveTo(10, 0); ctx.lineTo(10, 4);
        ctx.stroke();
        ctx.restore();
      } else if (t === 'D') {
        ctx.fillStyle = `hsl(${h1} ${s1}% 26%)`;
        ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        ctx.strokeStyle = `hsl(${h2} 60% 55%)`;
        ctx.lineWidth = 2;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(px + (CELL / 4) * i, py + 4); ctx.lineTo(px + (CELL / 4) * i, py + CELL - 4);
          ctx.stroke();
        }
        ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
      } else if (t === 'E' || t === 'F') {
        const revealed = t === 'F' && revealedFakes[roomIdx] && revealedFakes[roomIdx][x + ',' + y];
        drawPortal(px, py, h2, revealed);
      }
    }
  }
  // raised walls, painted top-to-bottom so lips overlap right
  for (let y = 0; y < room.h; y++) {
    for (let x = 0; x < room.w; x++) {
      if (st.tiles[y][x] !== '#') continue;
      const [px, py] = cellXY(x, y);
      const n = ((x * 2654435761 ^ y * 40503) % 6) - 3;
      const lift = 7;
      ctx.fillStyle = `hsl(${h1} ${s1}% ${32 + n}%)`;
      ctx.fillRect(px, py - lift, CELL, CELL);
      ctx.strokeStyle = `hsla(${h1} ${s1}% 50% / 0.25)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py - lift + 0.5, CELL - 1, CELL - 1);
      const below = y + 1 >= room.h ? '#' : st.tiles[y + 1][x];
      if (below !== '#') {
        ctx.fillStyle = `hsl(${h1} ${s1}% ${16 + n}%)`;
        ctx.fillRect(px, py + CELL - lift, CELL, lift);
      }
    }
  }
}

function drawSpikes(px, py) {
  const [h1, s1] = pal();
  ctx.fillStyle = `hsl(${h1} ${s1 + 6}% 55%)`;
  ctx.strokeStyle = `hsl(${h1} ${s1}% 30%)`;
  ctx.lineWidth = 1;
  const n = 3;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cx = px + CELL * (0.22 + i * 0.28), cy = py + CELL * (0.24 + j * 0.28);
      const r = CELL * 0.11;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r);
      ctx.lineTo(cx, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawPortal(px, py, h2, broken) {
  const cx = px + CELL / 2, cy = py + CELL / 2;
  if (broken) {
    ctx.strokeStyle = 'hsla(0 0% 45% / 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.32, 0.4, Math.PI * 1.7);
    ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8);
    ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8);
    ctx.stroke();
    return;
  }
  const pg = ctx.createRadialGradient(cx, cy, 2, cx, cy, CELL * 0.42);
  pg.addColorStop(0, `hsla(${h2} 90% 78% / 0.95)`);
  pg.addColorStop(0.7, `hsla(${h2} 80% 55% / 0.5)`);
  pg.addColorStop(1, 'hsla(0 0% 0% / 0)');
  ctx.fillStyle = pg;
  ctx.fillRect(px, py, CELL, CELL);
  ctx.strokeStyle = `hsl(${h2} 85% 75%)`;
  ctx.lineWidth = 2;
  ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, CELL * 0.3 + Math.sin(frame * 0.08) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBeamTelegraph(h2) {
  // when a turret is charging, paint its firing lanes
  const phase = st.turn % Sim.TURRET_PERIOD;
  if (phase !== Sim.TURRET_PERIOD - 2) return;
  for (const e of st.ents) {
    if (e.deadE || e.kind !== 'turret') continue;
    for (const [cx, cy] of Sim.beamCells(st, e)) {
      const [px, py] = cellXY(cx, cy);
      ctx.fillStyle = `hsla(${h2} 90% 60% / ${0.13 + 0.08 * Math.sin(frame * 0.3)})`;
      ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
    }
  }
}

function drawEntities(h1, s1, h2, ease) {
  // beams flash right after firing
  if (anim && anim.events.some(e => e.t === 'fire') && performance.now() - anim.t0 < 130) {
    for (const e of st.ents) {
      if (e.deadE || e.kind !== 'turret') continue;
      for (const [cx, cy] of Sim.beamCells(st, e)) {
        const [px, py] = cellXY(cx, cy);
        ctx.fillStyle = `hsla(${h2} 100% 72% / 0.75)`;
        ctx.fillRect(px + 4, py + CELL / 2 - 4, CELL - 8, 8);
        ctx.fillRect(px + CELL / 2 - 4, py + 4, 8, CELL - 8);
      }
    }
  }

  const prevs = anim ? anim.prev.ents : null;
  st.ents.forEach((e, i) => {
    if (e.deadE) return;
    const prevE = prevs ? prevs[i] : null;
    const [gx, gy] = lerpPos(e, prevE && !prevE.deadE ? prevE : null, ease);
    const [px, py] = cellXY(gx, gy);
    const cx = px + CELL / 2, cy = py + CELL / 2;
    const hop = Math.sin(ease * Math.PI) * (prevE && (prevE.x !== e.x || prevE.y !== e.y) ? 4 : 0);

    if (e.kind === 'boulder') {
      ctx.fillStyle = `hsl(${h1} ${s1}% 38%)`;
      ctx.strokeStyle = `hsl(${h1} ${s1}% 22%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, CELL * 0.36, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.strokeStyle = `hsla(${h1} ${s1}% 55% / 0.5)`;
      ctx.beginPath();
      ctx.arc(cx - 3, cy - 5, CELL * 0.18, 0.8, 2.6);
      ctx.stroke();
    } else if (e.kind === 'turret') {
      const phase = st.turn % Sim.TURRET_PERIOD;
      ctx.fillStyle = `hsl(${h1} ${s1}% 30%)`;
      ctx.strokeStyle = `hsl(${h1} ${s1}% 15%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - CELL * 0.4);
      ctx.lineTo(cx + CELL * 0.28, cy + CELL * 0.38);
      ctx.lineTo(cx - CELL * 0.28, cy + CELL * 0.38);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // the eye opens as it charges
      const open = phase === Sim.TURRET_PERIOD - 2 ? 1 : phase === Sim.TURRET_PERIOD - 3 ? 0.4 : 0.15;
      ctx.fillStyle = `hsl(${h2} 95% ${55 + open * 20}%)`;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = open * 14;
      ctx.beginPath();
      ctx.ellipse(cx, cy, CELL * 0.14, CELL * 0.14 * open + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (e.kind === 'hound' || e.kind === 'sleeper') {
      const asleep = e.kind === 'sleeper' && !e.awake;
      ctx.fillStyle = asleep ? `hsl(${h1} ${s1}% 34%)` : `hsl(${h2} 60% 42%)`;
      ctx.strokeStyle = asleep ? `hsl(${h1} ${s1}% 20%)` : `hsl(${h2} 70% 25%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy - hop, CELL * 0.32, CELL * 0.27, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      // bristles
      ctx.beginPath();
      for (let a = -2.2; a <= -0.9; a += 0.45) {
        ctx.moveTo(cx + Math.cos(a) * CELL * 0.28, cy - hop + Math.sin(a) * CELL * 0.24);
        ctx.lineTo(cx + Math.cos(a) * CELL * 0.45, cy - hop + Math.sin(a) * CELL * 0.4);
      }
      ctx.stroke();
      if (!asleep) {
        eyes(cx, cy - hop - 2, 4.5, [Math.sign(st.px - e.x) * 1.2, Math.sign(st.py - e.y) * 1.2]);
        // teeth
        ctx.fillStyle = '#efe9dc';
        for (let tx = -6; tx <= 6; tx += 4) {
          ctx.beginPath();
          ctx.moveTo(cx + tx - 1.5, cy - hop + 6);
          ctx.lineTo(cx + tx, cy - hop + 10);
          ctx.lineTo(cx + tx + 1.5, cy - hop + 6);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = `hsla(${h1} ${s1}% 15% / 0.9)`;
        ctx.fillRect(cx - 6, cy - 4, 4, 1.6);
        ctx.fillRect(cx + 2, cy - 4, 4, 1.6);
      }
    } else if (e.kind === 'mimic' || e.kind === 'mirror') {
      // your shape, wrong color. mirrors hang upside down.
      ctx.save();
      ctx.translate(cx, cy - hop);
      if (e.kind === 'mirror') ctx.scale(1, -1);
      ctx.fillStyle = '#0d0c12';
      ctx.strokeStyle = `hsl(${h2} 55% 45%)`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -1, CELL * 0.27, Math.PI, 0);
      ctx.lineTo(CELL * 0.27, CELL * 0.3);
      ctx.lineTo(0, CELL * 0.18);
      ctx.lineTo(-CELL * 0.27, CELL * 0.3);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      eyes(0, -4, 4.5, null);
      ctx.restore();
    }
  });

  // player last, on top
  const prevP = anim ? anim.prev : null;
  const pk = prevP ? ease : 1;
  const gx = prevP ? prevP.px + (st.px - prevP.px) * pk : st.px;
  const gy = prevP ? prevP.py + (st.py - prevP.py) * pk : st.py;
  const [px, py] = cellXY(gx, gy);
  const cx = px + CELL / 2, cy = py + CELL / 2;
  const hop = prevP && (prevP.px !== st.px || prevP.py !== st.py) ? Math.sin(pk * Math.PI) * 5 : 0;

  if (!st.dead || deadT < 4) {
    const breathe = Math.sin(frame * 0.06) * 1.2;
    ctx.fillStyle = '#ddd6c6';
    ctx.strokeStyle = '#8d8571';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 1 - hop, CELL * 0.27 + breathe * 0.3, Math.PI, 0);
    ctx.lineTo(cx + CELL * 0.27, cy + CELL * 0.3 - hop);
    ctx.lineTo(cx, cy + CELL * 0.18 - hop);
    ctx.lineTo(cx - CELL * 0.27, cy + CELL * 0.3 - hop);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    eyes(cx, cy - 4 - hop, 4.5, null);
  }

  // keys held float by the player
  for (let i = 0; i < st.keys; i++) {
    ctx.strokeStyle = `hsl(${h2} 85% 65%)`;
    ctx.lineWidth = 2;
    const ky = cy - CELL * 0.55 - i * 8 + Math.sin(frame * 0.1 + i) * 2;
    ctx.beginPath();
    ctx.arc(cx - 3, ky, 3, 0, Math.PI * 2);
    ctx.moveTo(cx, ky); ctx.lineTo(cx + 7, ky);
    ctx.moveTo(cx + 5, ky); ctx.lineTo(cx + 5, ky + 3);
    ctx.stroke();
  }
}

// ---- HUD ------------------------------------------------------------------------
function drawHud(h1, h2) {
  const L = LEVELS[roomIdx];
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(235,230,215,0.9)';
  ctx.font = '600 16px Georgia, serif';
  ctx.fillText(String(roomIdx + 1).padStart(3, '0') + ' · ' + L.name, 16, 28);
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = 'rgba(235,230,215,0.5)';
  ctx.fillText('esc', 16, 46);

  ctx.textAlign = 'right';
  ctx.fillStyle = moves > room.par ? 'rgba(235,200,160,0.85)' : 'rgba(235,230,215,0.85)';
  ctx.font = '600 16px Georgia, serif';
  ctx.fillText('moves ' + moves + ' / par ' + room.par, W - 16, 28);
  if (deathsHere > 0) {
    ctx.fillStyle = 'rgba(235,230,215,0.4)';
    ctx.font = '13px Georgia, serif';
    ctx.fillText(deathsHere + (deathsHere === 1 ? ' death' : ' deaths'), W - 16, 46);
  }

  // touch buttons
  ctx.font = '13px Georgia, serif';
  ctx.fillStyle = 'rgba(235,230,215,0.4)';
  ctx.textAlign = 'left';
  ctx.fillText('↺ undo (Z)', 14, H - 20);
  ctx.textAlign = 'right';
  ctx.fillText('restart (R) ⟳', W - 14, H - 20);

  if (introT > 0) {
    const a = Math.min(1, introT > 60 ? (90 - introT) / 25 : introT / 35);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#efeadb';
    ctx.font = '600 30px Georgia, serif';
    ctx.fillText(L.name.toUpperCase(), W / 2, 66);
    ctx.font = 'italic 16px Georgia, serif';
    ctx.fillStyle = `hsl(${h2} 60% 70%)`;
    ctx.fillText(WORLD_HINTS[L.world - 1], W / 2, 90);
    ctx.globalAlpha = 1;
  }

  if (st.dead) {
    ctx.fillStyle = `rgba(140,20,30,${Math.min(0.35, deadT * 0.02)})`;
    ctx.fillRect(0, 0, W, H);
    if (deadT > 14) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(240,235,220,0.95)';
      ctx.font = '600 26px Georgia, serif';
      const by = { hound: 'the hound got you', sleeper: 'it woke up', mimic: 'you walked yourself into that', mirror: 'it went the other way', beam: 'you lost count', spikes: 'spikes', pit: 'long way down', rune: 'the floor lied', fakeexit: 'wrong door', patrol: 'stepped on' };
      ctx.fillText(by[st.deadBy] || 'dead', W / 2, H / 2 - 6);
      ctx.font = '15px Georgia, serif';
      ctx.fillStyle = 'rgba(240,235,220,0.6)';
      ctx.fillText('Z undo · R restart · swipe to keep going', W / 2, H / 2 + 20);
    }
  }

  if (st.won) {
    ctx.fillStyle = 'rgba(8,6,4,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0ead9';
    ctx.font = '600 40px Georgia, serif';
    ctx.fillText('CLEAR', W / 2, H * 0.4);
    const starsGot = moves <= room.par ? 3 : moves <= room.par + 3 ? 2 : 1;
    ctx.font = '30px Georgia, serif';
    ctx.fillStyle = `hsl(${h2} 80% 65%)`;
    ctx.fillText('★'.repeat(starsGot) + '☆'.repeat(3 - starsGot), W / 2, H * 0.5);
    ctx.font = '16px Georgia, serif';
    ctx.fillStyle = 'rgba(240,235,220,0.75)';
    ctx.fillText(moves + ' moves' + (moves <= room.par ? ' — perfect' : ' · par ' + room.par), W / 2, H * 0.575);
    const pulse = 0.4 + 0.25 * Math.sin(frame * 0.09);
    ctx.fillStyle = `rgba(240,235,220,${pulse})`;
    ctx.font = '15px Georgia, serif';
    ctx.fillText(roomIdx + 1 >= LEVELS.length ? 'tap — one last thing' : 'tap for room ' + (roomIdx + 2), W / 2, H * 0.66);
  }

  if (Snd.isMuted()) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(235,230,215,0.35)';
    ctx.font = '12px Georgia, serif';
    ctx.fillText('muted [M]', W - 14, 14);
  }
}

// ---- menu / end -------------------------------------------------------------------
function drawMenu() {
  const g = ctx.createRadialGradient(W / 2, H * 0.3, 40, W / 2, H / 2, 640);
  g.addColorStop(0, 'hsl(30 8% 12%)');
  g.addColorStop(1, 'hsl(30 10% 4%)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ece5d3';
  ctx.font = '600 54px Georgia, serif';
  ctx.fillText('L O C K S T E P', W / 2, 76);
  ctx.font = 'italic 16px Georgia, serif';
  ctx.fillStyle = 'rgba(220,210,190,0.6)';
  ctx.fillText('they move when you move', W / 2, 103);

  const stars = save.stars;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 128, W, 330);
  ctx.clip();
  for (let i = 0; i < LEVELS.length; i++) {
    const r = cellRect(i);
    if (r.y < 100 || r.y > 470) continue;
    const wIdx = LEVELS[i].world - 1;
    const [h1, s1, h2] = PALS[wIdx];
    const unlocked = i <= save.unlocked;
    const got = stars[i] || 0;
    const sel = i === menuSel;
    // stone tablet
    ctx.fillStyle = unlocked ? `hsl(${h1} ${s1}% ${got ? 26 : 18}%)` : 'hsl(0 0% 9%)';
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 4);
    ctx.fill();
    if (sel && unlocked) {
      ctx.strokeStyle = '#efe8d5';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = unlocked ? `hsla(${h1} ${s1}% 45% / 0.6)` : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.fillStyle = unlocked ? 'rgba(238,232,216,0.9)' : 'rgba(255,255,255,0.18)';
    ctx.font = '600 13px Georgia, serif';
    ctx.fillText(unlocked ? String(i + 1) : '·', r.x + r.w / 2, r.y + 15);
    if (got) {
      ctx.fillStyle = `hsl(${h2} 80% 65%)`;
      ctx.font = '8px Georgia, serif';
      ctx.fillText('★'.repeat(got), r.x + r.w / 2, r.y + 24);
    }
  }
  ctx.restore();

  const selL = LEVELS[Math.min(menuSel, LEVELS.length - 1)];
  const [, , sh2] = PALS[selL.world - 1];
  ctx.fillStyle = `hsl(${sh2} 60% 65%)`;
  ctx.font = '600 16px Georgia, serif';
  ctx.fillText('WORLD ' + selL.world + ' — ' + WORLD_NAMES[selL.world - 1] + '   ·   ' + WORLD_HINTS[selL.world - 1], W / 2, 482);

  ctx.fillStyle = 'rgba(220,210,190,0.5)';
  ctx.font = '13px Georgia, serif';
  ctx.fillText('arrows / swipe = step · space / tap = wait · Z undo · R restart · M mute', W / 2, 508);
  const total = Object.values(stars).reduce((a, b) => a + b, 0);
  ctx.fillStyle = 'rgba(220,210,190,0.35)';
  ctx.fillText(total + ' / 300 stars · ' + save.deaths + ' deaths', W / 2, 527);
}

function drawEnd() {
  ctx.fillStyle = 'hsl(30 10% 5%)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ece5d3';
  ctx.font = '600 58px Georgia, serif';
  ctx.fillText('L O C K S T E P', W / 2, H * 0.38);
  ctx.font = 'italic 18px Georgia, serif';
  ctx.fillStyle = 'rgba(220,210,190,0.75)';
  const total = Object.values(save.stars).reduce((a, b) => a + b, 0);
  ctx.fillText('one hundred rooms. ' + save.deaths + ' deaths. ' + total + ' / 300 stars.', W / 2, H * 0.5);
  ctx.fillText('nothing moves now. it is finally quiet.', W / 2, H * 0.57);
  const pulse = 0.4 + 0.25 * Math.sin(frame * 0.08);
  ctx.fillStyle = `rgba(236,229,211,${pulse})`;
  ctx.font = '15px Georgia, serif';
  ctx.fillText('tap to return', W / 2, H * 0.68);
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
menuSel = save.unlocked;
requestAnimationFrame(loop);

// dev/test hook
window.__lockstep = {
  state: () => state,
  room: () => roomIdx,
  st: () => st,
  moves: () => moves,
  load(i) { loadRoom(i); },
  move(mv) { doMove(mv); },
  replay(movesStr) { restart(); replayMoves = movesStr; replayAt = 0; },
  stopReplay() { replayMoves = null; },
  fastReplay(movesStr) {
    restart();
    for (const mv of movesStr) { doMove(mv); if (st.dead || st.won) break; }
    anim = null;
  },
  undo() { undo(); }
};

})();
