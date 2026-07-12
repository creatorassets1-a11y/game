// HUNDO - renderer, input, menu, game loop.
// The rules all live in sim.js; this file just makes them look good.

(() => {
'use strict';

const W = 960, H = 540;
const TILE = Sim.TILE, PSIZE = Sim.P;
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

// per-world neon palettes: [hue, accent hue]
const PALETTES = [
  [190, 320], [280, 60], [140, 260], [30, 200], [265, 160],
  [200, 40], [55, 210], [330, 180], [110, 300], [0, 55]
];
const VERB_LABEL = {
  jump: 'TAP = JUMP', jump2: 'TAP = JUMP (x2 IN AIR)', flip: 'TAP = FLIP GRAVITY',
  dash: 'TAP = PHASE DASH', float: 'HOLD = THRUST', stop: 'HOLD = FREEZE'
};
const VERB_ICON = { jump: '▲', jump2: '▲▲', flip: '⇅', dash: '»', float: '≙', stop: '■' };

// ---- save ------------------------------------------------------------------
const save = {
  get unlocked() { return Math.min(+(localStorage.getItem('hundo_unlocked') || 0), LEVELS.length - 1); },
  set unlocked(v) { localStorage.setItem('hundo_unlocked', v); },
  get done() { try { return JSON.parse(localStorage.getItem('hundo_done') || '[]'); } catch (e) { return []; } },
  set done(v) { localStorage.setItem('hundo_done', JSON.stringify(v)); },
  get deaths() { return +(localStorage.getItem('hundo_deaths') || 0); },
  set deaths(v) { localStorage.setItem('hundo_deaths', v); }
};

// ---- input -----------------------------------------------------------------
let held = false;
let pressBuf = false;       // a press survives until the next sim frame even
                            // if the finger left within a millisecond
let tapQueued = false;      // menu taps
let pointer = { x: 0, y: 0, down: false };
let replayBits = null, replayIdx = 0;   // test hook

function press() { held = true; pressBuf = true; tapQueued = true; Beat.unlock(); }
function release() { held = false; }

window.addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); press(); keyHeld = true; }
  if (e.code === 'KeyR' && state === 'play') respawn(true);
  if (e.code === 'Escape') { if (state === 'play' || state === 'win') toMenu(); }
  if (e.code === 'KeyM') Beat.toggleMute();
  if (state === 'menu') menuKeys(e.code);
});
window.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') { keyHeld = false; if (!ptrHeld) release(); }
});
let keyHeld = false, ptrHeld = false;

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const p = canvasPos(e);
  pointer = { x: p.x, y: p.y, down: true };
  ptrHeld = true;
  press();
});
window.addEventListener('pointerup', () => { ptrHeld = false; if (!keyHeld) release(); });
canvas.addEventListener('pointermove', e => {
  const p = canvasPos(e);
  pointer.x = p.x; pointer.y = p.y;
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---- state -----------------------------------------------------------------
let state = 'menu';
let frame = 0;
let chIdx = 0;
let lv = null, st = null;
let attempts = 0, sessionAttempts = 0;
let deadTimer = 0, winTimer = 0;
let introT = 0;
let shake = 0;
let flashMsg = null, flashT = 0;
let menuSel = 0, menuScroll = 0;
let particles = [];
let trail = [];
let bestX = 0;
let levelCanvas = null;
let startedAt = 0;

function pal() { return PALETTES[(LEVELS[chIdx].world - 1) % PALETTES.length]; }
function hue(a = 0) { return pal()[a ? 1 : 0]; }

function loadChapter(i) {
  chIdx = i;
  lv = Sim.parseLevel(LEVELS[i]);
  attempts = 0;
  bestX = 0;
  respawn(false);
  prerenderLevel();
  introT = 100;
  Beat.start(LEVELS[i].world - 1);
  state = 'play';
  startedAt = frame;
}

function respawn(countIt) {
  if (countIt) { attempts++; sessionAttempts++; save.deaths = save.deaths + 1; }
  st = Sim.newState(lv);
  Sim.settle(lv, st);
  deadTimer = 0;
  particles = [];
  trail = [];
  replayIdx = 0;
}

function toMenu() {
  state = 'menu';
  menuSel = chIdx;
  Beat.stop();
}

// ---- prerender the static level -------------------------------------------
function prerenderLevel() {
  levelCanvas = document.createElement('canvas');
  levelCanvas.width = lv.pxw;
  levelCanvas.height = lv.pxh;
  const c = levelCanvas.getContext('2d');
  const [h1] = pal();

  const edge = `hsl(${h1} 90% 60%)`;
  const face = `hsl(${h1} 45% 13%)`;

  // solids
  for (let ty = 0; ty < lv.h; ty++) {
    for (let tx = 0; tx < lv.w; tx++) {
      if (!lv.solids[ty][tx]) continue;
      c.fillStyle = face;
      c.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  // neon edges on exposed faces
  c.strokeStyle = edge;
  c.lineWidth = 2;
  c.shadowColor = edge;
  c.shadowBlur = 8;
  c.beginPath();
  for (let ty = 0; ty < lv.h; ty++) {
    for (let tx = 0; tx < lv.w; tx++) {
      if (!lv.solids[ty][tx]) continue;
      const x = tx * TILE, y = ty * TILE;
      if (ty === 0 || !lv.solids[ty - 1][tx]) { c.moveTo(x, y + 1); c.lineTo(x + TILE, y + 1); }
      if (ty === lv.h - 1 || !lv.solids[ty + 1][tx]) { c.moveTo(x, y + TILE - 1); c.lineTo(x + TILE, y + TILE - 1); }
      if (tx === 0 || !lv.solids[ty][tx - 1]) { c.moveTo(x + 1, y); c.lineTo(x + 1, y + TILE); }
      if (tx === lv.w - 1 || !lv.solids[ty][tx + 1]) { c.moveTo(x + TILE - 1, y); c.lineTo(x + TILE - 1, y + TILE); }
    }
  }
  c.stroke();
  c.shadowBlur = 0;

  // oneways
  c.fillStyle = edge;
  for (let ty = 0; ty < lv.h; ty++)
    for (let tx = 0; tx < lv.w; tx++)
      if (lv.oneways[ty][tx]) c.fillRect(tx * TILE + 2, ty * TILE, TILE - 4, 5);

  // spikes (and fake spikes: drawn IDENTICALLY, that's the joke)
  const spikeList = lv.spikes.concat(lv.fakespikes.map(s => ({ ...s, dir: 0 })));
  for (const s of spikeList) drawSpike(c, s.tx, s.ty, s.dir, h1);

  // phantom walls and crumbles are drawn at runtime - they change state
}

function drawSpike(c, tx, ty, dir, h1) {
  const x = tx * TILE, y = ty * TILE;
  c.fillStyle = `hsl(${h1} 80% 55%)`;
  c.shadowColor = c.fillStyle;
  c.shadowBlur = 6;
  c.beginPath();
  if (dir === 0) { c.moveTo(x + 2, y + TILE); c.lineTo(x + TILE / 2, y + 4); c.lineTo(x + TILE - 2, y + TILE); }
  else if (dir === 1) { c.moveTo(x + 2, y); c.lineTo(x + TILE / 2, y + TILE - 4); c.lineTo(x + TILE - 2, y); }
  else if (dir === 2) { c.moveTo(x + TILE, y + 2); c.lineTo(x + 4, y + TILE / 2); c.lineTo(x + TILE, y + TILE - 2); }
  else { c.moveTo(x, y + 2); c.lineTo(x + TILE - 4, y + TILE / 2); c.lineTo(x, y + TILE - 2); }
  c.closePath();
  c.fill();
  c.shadowBlur = 0;
}

// ---- particles ---------------------------------------------------------------
function burst(x, y, n, hueV, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (0.5 + Math.random()) * (spd || 4);
    particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1,
      life: 30 + Math.random() * 25, r: 2 + Math.random() * 3, hue: hueV
    });
  }
}

// ---- update -------------------------------------------------------------------
function update() {
  frame++;
  if (shake > 0) shake *= 0.86;
  if (flashT > 0) flashT--;

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  if (state === 'menu') { updateMenu(); tapQueued = false; return; }

  if (state === 'win') {
    winTimer++;
    if (winTimer > 30 && tapQueued) {
      tapQueued = false;
      if (chIdx + 1 >= LEVELS.length) state = 'end';
      else loadChapter(chIdx + 1);
    }
    tapQueued = false;
    return;
  }
  if (state === 'end') {
    if (tapQueued) { tapQueued = false; toMenu(); }
    return;
  }

  // ---- play ----
  if (introT > 0) introT--;

  if (st.dead) {
    deadTimer++;
    if (deadTimer > 32) respawn(true);
    tapQueued = false;
    return;
  }

  let input = held || pressBuf;
  pressBuf = false;
  if (replayBits) {
    input = replayIdx < replayBits.length ? replayBits[replayIdx] === '1' : false;
    replayIdx++;
  }

  const prevVerb = st.verb;
  Sim.step(lv, st, input);
  bestX = Math.max(bestX, st.x);

  // sfx + fx from sim events
  const ev = st.ev;
  if (ev === 'jump') { Beat.jump(); }
  else if (ev === 'flip') { Beat.flip(); }
  else if (ev === 'dash') { Beat.dash(); }
  else if (ev === 'thrust') { Beat.thrust(); burst(st.x + 4, st.y + PSIZE, 1, hue(1), 2); }
  else if (ev === 'land') { Beat.land(); }
  else if (ev === 'bounce') { Beat.bounce(); burst(st.x + PSIZE / 2, st.y + PSIZE, 8, hue(1), 3); }
  else if (ev === 'gravpad') { Beat.flip(); flashMsg = 'GRAVITY'; flashT = 40; }
  else if (ev && ev.startsWith('verb:')) {
    Beat.verb();
    flashMsg = VERB_LABEL[ev.slice(5)];
    flashT = 80;
    shake = 4;
  }
  if (st.verb !== prevVerb && !ev) { /* covered above */ }

  // trail
  trail.push({ x: st.x, y: st.y, t: 12, dash: st.dashT > 0 });
  if (trail.length > 40) trail.shift();
  for (const t of trail) t.t--;

  if (st.dead) {
    Beat.death();
    shake = 9;
    burst(st.x + PSIZE / 2, st.y + PSIZE / 2, 26, hue(0), 5);
    burst(st.x + PSIZE / 2, st.y + PSIZE / 2, 12, hue(1), 8);
  }
  if (st.won) {
    Beat.win();
    const done = save.done;
    if (!done.includes(chIdx)) { done.push(chIdx); save.done = done; }
    save.unlocked = Math.max(save.unlocked, Math.min(chIdx + 1, LEVELS.length - 1));
    state = 'win';
    winTimer = 0;
  }
  tapQueued = false;
}

// ---- menu -------------------------------------------------------------------
const GRID = { cols: 10, cw: 74, ch: 34, x0: 110, y0: 148 };
function cellRect(i) {
  const col = i % GRID.cols, row = (i / GRID.cols) | 0;
  return { x: GRID.x0 + col * GRID.cw, y: GRID.y0 + row * GRID.ch - menuScroll, w: GRID.cw - 8, h: GRID.ch - 8 };
}
function updateMenu() {
  const target = Math.max(0, ((menuSel / 10) | 0) * GRID.ch - 120);
  menuScroll += (target - menuScroll) * 0.15;
  if (pointer.down) {
    pointer.down = false;
    for (let i = 0; i < LEVELS.length; i++) {
      const r = cellRect(i);
      if (pointer.x > r.x && pointer.x < r.x + r.w && pointer.y > r.y && pointer.y < r.y + r.h) {
        if (i <= save.unlocked) { Beat.uiGo(); loadChapter(i); }
        return;
      }
    }
  }
}
function menuKeys(code) {
  const before = menuSel;
  if (code === 'ArrowLeft') menuSel = Math.max(0, menuSel - 1);
  if (code === 'ArrowRight') menuSel = Math.min(save.unlocked, menuSel + 1);
  if (code === 'ArrowUp') menuSel = Math.max(0, menuSel - 10);
  if (code === 'ArrowDown') menuSel = Math.min(save.unlocked, menuSel + 10);
  if (menuSel !== before) Beat.uiMove();
  if (code === 'Enter' || code === 'Space') { Beat.uiGo(); loadChapter(menuSel); }
}

// ---- drawing ------------------------------------------------------------------
function draw() {
  if (state === 'menu') { drawMenu(); return; }
  if (state === 'end') { drawEnd(); return; }

  const [h1, h2] = pal();
  const beat = Beat.phase();
  const pulse = Math.max(0, 1 - beat * 3) * 0.5;

  // camera
  const camX = Math.max(0, Math.min(st.x - W * 0.32, lv.pxw - W));
  const camY = (lv.pxh - H) / 2;
  const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;

  // bg
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `hsl(${h1} 55% ${7 + pulse * 3}%)`);
  g.addColorStop(0.65, `hsl(${(h1 + 30) % 360} 60% ${11 + pulse * 3}%)`);
  g.addColorStop(1, `hsl(${h1} 55% 5%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // horizon grid, GD-meets-synthwave
  ctx.save();
  ctx.strokeStyle = `hsla(${h2} 90% 60% / ${0.14 + pulse * 0.12})`;
  ctx.lineWidth = 1;
  const horizon = H * 0.62;
  ctx.beginPath();
  for (let i = 0; i < 14; i++) {
    const yy = horizon + Math.pow(i / 14, 1.7) * (H - horizon);
    ctx.moveTo(0, yy); ctx.lineTo(W, yy);
  }
  const gx0 = -(camX * 0.35) % 80;
  for (let x = gx0; x < W + 80; x += 80) {
    const cx2 = W / 2;
    ctx.moveTo(cx2 + (x - cx2) * 0.25, horizon);
    ctx.lineTo(x, H);
  }
  ctx.stroke();
  // floating wireframe diamonds
  for (let i = 0; i < 7; i++) {
    const px = ((i * 331 + 100) - camX * (0.15 + (i % 3) * 0.08)) % (W + 200) - 100;
    const py = 60 + (i * 73) % 190 + Math.sin(frame * 0.01 + i * 2) * 12;
    const r = 10 + (i % 3) * 8;
    ctx.strokeStyle = `hsla(${h1} 80% 65% / 0.18)`;
    ctx.beginPath();
    ctx.moveTo(px, py - r); ctx.lineTo(px + r, py); ctx.lineTo(px, py + r); ctx.lineTo(px - r, py);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(-camX + sx, -camY + sy);

  // static level
  if (levelCanvas) ctx.drawImage(levelCanvas, 0, 0);

  drawDynamic(camX, h1, h2);
  if (!st.dead) drawPlayer(h1, h2);
  for (const p of particles) {
    ctx.fillStyle = `hsla(${p.hue} 90% 65% / ${Math.min(1, p.life / 25)})`;
    ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
  }

  ctx.restore();

  drawHud(h1, h2);
}

function drawDynamic(camX, h1, h2) {
  const t = st.t;

  // phantom walls: solid-looking until you're close, then they dissolve
  for (const ph of lv.phantoms) {
    const px = ph.tx * TILE;
    const d = px - (st.x + PSIZE);
    let alpha = 1;
    if (d < 90) alpha = Math.max(0, d / 90);
    if (alpha > 0.01) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `hsl(${h1} 45% 13%)`;
      ctx.fillRect(px, ph.ty * TILE, TILE, TILE);
      ctx.strokeStyle = `hsl(${h1} 90% 60%)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, ph.ty * TILE + 1, TILE - 2, TILE - 2);
      ctx.globalAlpha = 1;
    }
  }

  // popup spikes: hidden until triggered, then snap up
  for (const p of lv.popups) {
    const active = st.x + PSIZE > p.trigX;
    if (!active) continue;
    for (const col of p.cols) drawSpike(ctx, col, p.ty, 0, h2);
  }

  // saws
  for (const s of lv.saws) {
    const pos = Sim.sawPos(lv, s, t);
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(t * 0.25);
    ctx.fillStyle = `hsl(${h2} 85% 60%)`;
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
      ctx.lineTo(Math.cos(a + 0.25) * 9, Math.sin(a + 0.25) * 9);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // crumbles: intact until touched, shake while breaking, gone after
  for (const cr of lv.crumbles) {
    const k = cr.tx + ',' + cr.ty;
    if (st.crumbled[k]) continue;
    const breaking = k in st.touched;
    const j = breaking ? (Math.random() - 0.5) * 3 : 0;
    const x = cr.tx * TILE + j, y = cr.ty * TILE;
    ctx.fillStyle = `hsl(${h1} 45% 13%)`;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = breaking ? `hsl(${h2} 90% 65%)` : `hsl(${h1} 60% 45%)`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.beginPath();
    ctx.moveTo(x + 8, y); ctx.lineTo(x + 14, y + 12); ctx.lineTo(x + 6, y + 22);
    ctx.moveTo(x + 22, y + TILE); ctx.lineTo(x + 18, y + 18);
    ctx.stroke();
  }

  // pads
  for (const pad of lv.pads) {
    const x = pad.tx * TILE, y = pad.ty * TILE;
    const used = st.usedPads[pad.tx + ',' + pad.ty];
    const bob = Math.sin(frame * 0.12 + pad.tx) * 3;
    ctx.globalAlpha = used ? 0.25 : 1;
    if (pad.kind === 'bounce') {
      ctx.fillStyle = `hsl(${h2} 95% 60%)`;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.fillRect(x + 3, y + TILE - 8, TILE - 6, 6);
      ctx.fillRect(x + 8, y + TILE - 12, TILE - 16, 4);
      ctx.shadowBlur = 0;
    } else if (pad.kind === 'grav') {
      ctx.strokeStyle = `hsl(${h2} 95% 65%)`;
      ctx.lineWidth = 3;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2 + bob, 10, 0.3, Math.PI * 2 - 0.3);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      // verb pad: a glowing card with the verb icon
      ctx.fillStyle = `hsla(${h1} 90% 60% / 0.2)`;
      ctx.strokeStyle = `hsl(${h1} 95% 68%)`;
      ctx.lineWidth = 2;
      ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 10;
      ctx.fillRect(x + 2, y - 12 + bob, TILE - 4, TILE + 4);
      ctx.strokeRect(x + 2, y - 12 + bob, TILE - 4, TILE + 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(VERB_ICON[pad.kind] || '?', x + TILE / 2, y + 10 + bob);
    }
    ctx.globalAlpha = 1;
  }

  // fake finish gates: drawn EXACTLY like the real one. forgive me.
  for (const f of lv.fakeExits) drawGate(f.tx * TILE + TILE / 2, h1, t);
  // the real finish
  drawGate(lv.finishX + TILE / 2, h1, t);
}

function drawGate(cx, h1, t) {
  ctx.save();
  const gy = lv.pxh - 2 * TILE;
  const gh = TILE * 3.2;
  const shimmer = Math.sin(t * 0.1) * 4;
  const grad = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
  grad.addColorStop(0, `hsla(${h1} 100% 70% / 0)`);
  grad.addColorStop(0.5, `hsla(${h1} 100% 75% / 0.85)`);
  grad.addColorStop(1, `hsla(${h1} 100% 70% / 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(cx - 14, gy - gh + shimmer, 28, gh - shimmer);
  ctx.strokeStyle = `hsl(${h1} 100% 80%)`;
  ctx.lineWidth = 2;
  ctx.shadowColor = ctx.strokeStyle;
  ctx.shadowBlur = 14;
  ctx.strokeRect(cx - 15, gy - gh, 30, gh);
  ctx.restore();
}

function drawPlayer(h1, h2) {
  // trail
  for (const tr of trail) {
    if (tr.t <= 0) continue;
    const a = tr.t / 14;
    ctx.fillStyle = tr.dash ? `hsla(${h2} 95% 70% / ${a * 0.5})` : `hsla(${h1} 95% 65% / ${a * 0.35})`;
    ctx.fillRect(tr.x + 3, tr.y + 3, PSIZE - 6, PSIZE - 6);
  }

  ctx.save();
  ctx.translate(st.x + PSIZE / 2, st.y + PSIZE / 2);
  // roll while airborne, like the cube
  if (!st.grounded && !st.dashT) ctx.rotate((st.t * 0.11) % (Math.PI * 2) * st.grav);
  if (st.dashT > 0) ctx.scale(1.35, 0.7);
  const grd = ctx.createLinearGradient(-12, -12, 12, 12);
  grd.addColorStop(0, `hsl(${h1} 100% 72%)`);
  grd.addColorStop(1, `hsl(${h2} 100% 62%)`);
  ctx.fillStyle = grd;
  ctx.shadowColor = `hsl(${h1} 100% 70%)`;
  ctx.shadowBlur = 14;
  const r = 5;
  ctx.beginPath();
  ctx.roundRect(-PSIZE / 2, -PSIZE / 2, PSIZE, PSIZE, r);
  ctx.fill();
  ctx.shadowBlur = 0;
  // face: two little eyes so it has a soul to lose
  ctx.fillStyle = '#0b0b12';
  const ey = st.grav > 0 ? -2 : 2;
  ctx.fillRect(1, ey - 2, 4, 4);
  ctx.fillRect(7, ey - 2, 4, 4);
  ctx.restore();
}

function drawHud(h1, h2) {
  const L = LEVELS[chIdx];
  // progress bar
  const prog = Math.min(1, st.x / lv.finishX);
  const best = Math.min(1, bestX / lv.finishX);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(200, 14, W - 400, 6);
  ctx.fillStyle = `hsla(${h2} 90% 60% / 0.45)`;
  ctx.fillRect(200, 14, (W - 400) * best, 6);
  ctx.fillStyle = `hsl(${h1} 95% 65%)`;
  ctx.fillRect(200, 14, (W - 400) * prog, 6);

  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 15px monospace';
  ctx.fillText(String(chIdx + 1).padStart(3, '0') + '  ' + L.name.toUpperCase(), 16, 26);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('attempt ' + (attempts + 1), W - 16, 26);

  // current verb chip
  ctx.textAlign = 'left';
  ctx.fillStyle = `hsla(${h1} 90% 65% / 0.9)`;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(VERB_ICON[st.verb] + ' ' + st.verb.toUpperCase(), 16, 48);

  // chapter intro card
  if (introT > 0) {
    const a = Math.min(1, introT > 70 ? (100 - introT) / 30 : introT / 40);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(L.name.toUpperCase(), W / 2, H * 0.36);
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = `hsl(${h2} 95% 70%)`;
    ctx.fillText(VERB_LABEL[LEVELS[chIdx].verb], W / 2, H * 0.44);
    ctx.globalAlpha = 1;
  }

  // verb switch / event flash
  if (flashT > 0 && flashMsg) {
    ctx.globalAlpha = Math.min(1, flashT / 20);
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = `hsl(${h2} 100% 75%)`;
    ctx.fillText(flashMsg, W / 2, H * 0.3);
    ctx.globalAlpha = 1;
  }

  if (st.dead) {
    ctx.fillStyle = `rgba(255,40,70,${Math.max(0, 0.35 - deadTimer * 0.012)})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (state === 'win') drawWinCard(h1, h2);

  if (Beat.isMuted()) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '12px monospace';
    ctx.fillText('muted [M]', W - 16, H - 14);
  }
}

function drawWinCard(h1, h2) {
  ctx.fillStyle = 'rgba(5,5,15,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = `hsl(${h1} 95% 70%)`;
  ctx.font = 'bold 44px monospace';
  ctx.fillText('CLEAR', W / 2, H * 0.4);
  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText(LEVELS[chIdx].name.toUpperCase() + '  ·  ' + (attempts + 1) + (attempts === 0 ? ' attempt' : ' attempts'), W / 2, H * 0.49);
  if (attempts === 0) {
    ctx.fillStyle = `hsl(${h2} 100% 70%)`;
    ctx.fillText('FLAWLESS', W / 2, H * 0.55);
  }
  const pulse = 0.4 + 0.25 * Math.sin(frame * 0.1);
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  ctx.font = '15px monospace';
  ctx.fillText(chIdx + 1 >= LEVELS.length ? 'tap for the truth' : 'tap for chapter ' + (chIdx + 2), W / 2, H * 0.66);
}

function drawMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0a14');
  g.addColorStop(1, '#101024');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // slow drifting grid
  ctx.strokeStyle = 'rgba(120,120,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const off = (frame * 0.3) % 40;
  for (let x = -off; x < W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = -off; y < H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 58px monospace';
  ctx.shadowColor = 'hsl(190 100% 60%)';
  ctx.shadowBlur = 24;
  ctx.fillText('HUNDO', W / 2, 78);
  ctx.shadowBlur = 0;
  ctx.font = '15px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('100 rooms · one button · no mercy', W / 2, 104);

  // chapter grid
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 130, W, 330);
  ctx.clip();
  const done = save.done;
  for (let i = 0; i < LEVELS.length; i++) {
    const r = cellRect(i);
    if (r.y < 100 || r.y > 480) continue;
    const wIdx = LEVELS[i].world - 1;
    const [h1] = PALETTES[wIdx];
    const unlocked = i <= save.unlocked;
    const isDone = done.includes(i);
    const sel = i === menuSel;
    if (isDone) {
      ctx.fillStyle = `hsla(${h1} 80% 55% / 0.85)`;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = '#0a0a14';
    } else if (unlocked) {
      ctx.strokeStyle = `hsl(${h1} 80% 60%)`;
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = `hsl(${h1} 80% 70%)`;
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
    }
    if (sel && unlocked) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    }
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? String(i + 1) : '·', r.x + r.w / 2, r.y + r.h / 2 + 5);
  }
  ctx.restore();

  // world name for selection
  const selWorld = LEVELS[Math.min(menuSel, LEVELS.length - 1)];
  const [sh] = PALETTES[selWorld.world - 1];
  ctx.textAlign = 'center';
  ctx.fillStyle = `hsl(${sh} 90% 65%)`;
  ctx.font = 'bold 16px monospace';
  const wNames = ['RUNNER', 'LIAR', 'CEILING', 'TWO-FACED', 'GHOST', 'THRUST', 'PATIENCE', 'DOUBLES', 'BABEL', 'HELL'];
  ctx.fillText('WORLD ' + selWorld.world + ' — ' + wNames[selWorld.world - 1] + '  ·  ' + VERB_LABEL[selWorld.verb], W / 2, 486);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = '13px monospace';
  ctx.fillText('tap a chapter · space/click = the button · R restart · M mute', W / 2, 512);
  if (save.deaths > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(save.deaths + ' deaths and counting', W / 2, 530);
  }
}

function drawEnd() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px monospace';
  ctx.shadowColor = 'hsl(0 100% 60%)';
  ctx.shadowBlur = 30;
  ctx.fillText('HUNDO.', W / 2, H * 0.4);
  ctx.shadowBlur = 0;
  ctx.font = '18px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('all 100. ' + save.deaths + ' deaths. you absolute menace.', W / 2, H * 0.52);
  const pulse = 0.4 + 0.25 * Math.sin(frame * 0.1);
  ctx.fillStyle = `rgba(255,255,255,${pulse})`;
  ctx.font = '15px monospace';
  ctx.fillText('tap to return', W / 2, H * 0.64);
}

// ---- loop -----------------------------------------------------------------
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

// dev/test hook: load any chapter, replay a solver tap-script, inspect state
window.__hundo = {
  state: () => state,
  chapter: () => chIdx,
  player: () => st,
  level: () => lv,
  attempts: () => attempts,
  load(i) { loadChapter(i); },
  replay(bitString) { replayBits = bitString; replayIdx = 0; respawn(false); },
  stopReplay() { replayBits = null; },
  fast(n) { for (let i = 0; i < n && state === 'play'; i++) update(); }
};

})();
