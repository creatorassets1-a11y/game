// UMBRA - a small dark puzzle game
// One canvas, no libraries. See levels.js for the chapter layouts.

(() => {
'use strict';

const W = 960, H = 540;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W; canvas.height = H;

// ---- scale canvas to window, keep aspect --------------------------------
function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width = Math.floor(W * s) + 'px';
  canvas.style.height = Math.floor(H * s) + 'px';
}
window.addEventListener('resize', fit);
fit();

// ---- input ---------------------------------------------------------------
const keys = {};
const pressed = {};   // true only on the frame the key went down

window.addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  Sfx.unlock();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

const IN = {
  left:  () => keys.ArrowLeft || keys.KeyA || touch.left,
  right: () => keys.ArrowRight || keys.KeyD || touch.right,
  jump:  () => keys.ArrowUp || keys.KeyW || keys.Space || touch.jump,
  jumpHit: () => pressed.ArrowUp || pressed.KeyW || pressed.Space || touch.jumpHit,
  grab:  () => keys.KeyE || keys.ShiftLeft || keys.ShiftRight || touch.grab,
  start: () => pressed.Enter || pressed.Space || touch.jumpHit
};

// touch controls (only shown on touch devices)
const touch = { left: false, right: false, jump: false, grab: false, jumpHit: false, active: false };
function touchZone(x, y) {
  // canvas-space coords
  if (x < W * 0.18 && y > H * 0.6) return 'left';
  if (x >= W * 0.18 && x < W * 0.36 && y > H * 0.6) return 'right';
  if (x > W * 0.82 && y > H * 0.6) return 'jump';
  if (x > W * 0.64 && x <= W * 0.82 && y > H * 0.6) return 'grab';
  return null;
}
function handleTouches(e) {
  e.preventDefault();
  touch.active = true;
  Sfx.unlock();
  const r = canvas.getBoundingClientRect();
  const prevJump = touch.jump;
  touch.left = touch.right = touch.jump = touch.grab = false;
  for (const t of e.touches) {
    const x = (t.clientX - r.left) / r.width * W;
    const y = (t.clientY - r.top) / r.height * H;
    const z = touchZone(x, y);
    if (z) touch[z] = true;
    else if (state === 'title' || state === 'end') touch.jumpHit = true;
  }
  if (touch.jump && !prevJump) touch.jumpHit = true;
}
canvas.addEventListener('touchstart', handleTouches, { passive: false });
canvas.addEventListener('touchmove', handleTouches, { passive: false });
canvas.addEventListener('touchend', handleTouches, { passive: false });

// ---- little helpers ------------------------------------------------------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function circleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}

// seeded random for backgrounds so each chapter's hills stay put
function makeRng(seed) {
  let s = seed * 2654435761 % 4294967296;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// ---- save data -----------------------------------------------------------
const save = {
  get unlocked() { return parseInt(localStorage.getItem('umbra_unlocked') || '0'); },
  set unlocked(v) { localStorage.setItem('umbra_unlocked', v); },
  get deaths() { return parseInt(localStorage.getItem('umbra_deaths') || '0'); },
  set deaths(v) { localStorage.setItem('umbra_deaths', v); }
};

// ---- game state ----------------------------------------------------------
let state = 'title';       // title | play | end
let frame = 0;
let levelIdx = 0;
let menuSel = 0;
let fade = 1;              // 1 = fully black, fading in
let fadeDir = -1;          // -1 fading in, +1 fading out
let fadeTo = null;         // callback when fully black
let playTime = 0;
let sessionDeaths = 0;
let shake = 0;

// per-level live state, rebuilt on every death
let L = null;

const P_W = 20, P_H = 42;
const GRAV = 0.55, MOVE = 3.1, JUMP = -11.6, MAXFALL = 14;

const player = {
  x: 0, y: 0, vx: 0, vy: 0,
  onGround: false, face: 1, walkT: 0,
  dead: false, deadT: 0, drown: 0,
  grabbing: null, blink: 0, stepT: 0,
  carrier: null
};

function buildLevel(idx, checkIdx) {
  const D = LEVELS[idx];
  const collapserKeys = new Set((D.collapsers || []).map(c => c[0] + ',' + c[1]));
  L = {
    D,
    // solid platforms, minus the ones that are collapsers (those get entities)
    plats: (D.plats || [])
      .filter(p => !collapserKeys.has(p[0] + ',' + p[1]))
      .map(p => ({ x: p[0], y: p[1], w: p[2], h: p[3] })),
    spikes: (D.spikes || []).map(s => ({ x: s[0], y: s[1], w: s[2] })),
    traps: (D.traps || []).map(t => ({ x: t[0] - 22, y: t[1] - 14, w: 44, h: 14, sprung: false, anim: 0 })),
    crates: (D.crates || []).map(c => ({ x: c[0], y: c[1], w: 46, h: 46, vy: 0, px: c[0], inWater: false })),
    stompers: (D.stompers || []).map(s => ({ ...s, ext: s.min, phase: s.trip ? 'wait' : 'cycle', t: s.offset || 0, vy: 0 })),
    plates: (D.plates || []).map(p => ({ ...p, down: false })),
    levers: (D.levers || []).map(l => ({ ...l, on: false, t: 0, cool: 0 })),
    doors: (D.doors || []).map(d => ({ ...d, open: 0 })),
    efloors: (D.efloors || []).map(f => ({ ...f, active: !!f.id })),
    shooters: (D.shooters || []).map(s => ({ ...s, t: s.offset || 0, cool: 0 })),
    saws: (D.saws || []).map(s => ({ ...s, t: s.offset || 0 })),
    pends: (D.pends || []).map(p => ({ ...p })),
    movers: (D.movers || []).map(m => ({ ...m, t: m.offset || 0, px: m.x, py: m.y })),
    water: (D.water || []).map(w => ({ ...w, rising: false })),
    collapsers: (D.collapsers || []).map(c => ({ x: c[0], y: c[1], w: c[2], h: 18, state: 0, t: 0, vy: 0 })),
    darts: [],
    checks: (D.checks || []).map(c => ({ x: c[0], y: c[1] })),
    checkIdx: checkIdx == null ? -1 : checkIdx,
    channels: {},
    particles: [],
    introT: 120,
    t: 0
  };
  const sp = checkIdx != null && checkIdx >= 0 ? L.checks[checkIdx] : { x: D.spawn[0], y: D.spawn[1] };
  player.x = sp.x; player.y = sp.y;
  player.vx = 0; player.vy = 0;
  player.dead = false; player.drown = 0; player.grabbing = null;
  player.face = 1; player.carrier = null;
  makeBackground(idx);
}

// ---- background (parallax silhouette hills + trees) ----------------------
let bgLayers = [];
function makeBackground(seed) {
  bgLayers = [];
  const rng = makeRng(seed + 7);
  for (let li = 0; li < 3; li++) {
    const pts = [];
    const n = 24;
    let y = 0.45 + rng() * 0.2;
    for (let i = 0; i <= n; i++) {
      y = clamp(y + (rng() - 0.5) * 0.22, 0.25, 0.85);
      pts.push(y);
    }
    const trees = [];
    const tc = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < tc; i++) {
      trees.push({ u: rng(), h: 40 + rng() * 90, w: 3 + rng() * 5, lean: (rng() - 0.5) * 0.25 });
    }
    bgLayers.push({ pts, trees, par: 0.15 + li * 0.18, tone: li });
  }
}

// ---- grain overlay -------------------------------------------------------
const grainCv = document.createElement('canvas');
grainCv.width = 160; grainCv.height = 160;
const grainCtx = grainCv.getContext('2d');
function regrain() {
  const img = grainCtx.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  grainCtx.putImageData(img, 0, 0);
}
regrain();

// drifting fog motes
const motes = [];
for (let i = 0; i < 26; i++) {
  motes.push({ x: Math.random() * W, y: Math.random() * H, r: 30 + Math.random() * 80, s: 0.1 + Math.random() * 0.25, a: 0.02 + Math.random() * 0.03 });
}

// ---- solids --------------------------------------------------------------
function getSolids(forCrate) {
  const out = [];
  for (const p of L.plats) out.push(p);
  for (const d of L.doors) {
    const sh = d.h * (1 - d.open);
    if (sh > 4) out.push({ x: d.x, y: d.y, w: d.w, h: sh, door: d });
  }
  for (const m of L.movers) out.push({ x: m.x, y: m.y, w: m.w, h: m.h, mover: m });
  for (const s of L.stompers) {
    out.push({ x: s.x, y: s.y, w: s.w, h: s.ext, stomper: s });
  }
  for (const c of L.collapsers) {
    if (c.state < 3) out.push({ x: c.x, y: c.y, w: c.w, h: c.h, collapser: c });
  }
  if (!forCrate) {
    for (const c of L.crates) out.push({ x: c.x, y: c.y, w: c.w, h: c.h, crate: c });
  }
  return out;
}

// ---- player physics ------------------------------------------------------
function movePlayer() {
  const p = player;
  let dx = 0;
  if (IN.left()) dx -= MOVE;
  if (IN.right()) dx += MOVE;
  if (dx !== 0) p.face = dx > 0 ? 1 : -1;

  // grab: latch onto an adjacent crate while E/shift held
  p.grabbing = null;
  if (IN.grab() && p.onGround) {
    for (const c of L.crates) {
      const near = p.y + P_H > c.y + 6 && p.y < c.y + c.h &&
        ((Math.abs(p.x + P_W - c.x) < 8) || (Math.abs(c.x + c.w - p.x) < 8));
      if (near) { p.grabbing = c; break; }
    }
  }

  const solids = getSolids(false);

  // standing on a floating crate? then the keys paddle it around instead
  const raft = p.carrier && p.carrier.inWater ? p.carrier : null;

  // horizontal
  if (dx !== 0 && raft) {
    moveCrateX(raft, dx * 0.42);
    p.walkT += 0.05;
  } else if (dx !== 0) {
    const speed = p.grabbing ? dx * 0.55 : dx;
    let nx = p.x + speed;
    const box = { x: nx, y: p.y, w: P_W, h: P_H };
    let blockedBy = null;
    for (const s of solids) {
      if (s.crate === p.grabbing && p.grabbing) continue;
      if (overlap(box, s)) { blockedBy = s; break; }
    }
    if (blockedBy) {
      // push a crate we walked into (jumping against one mantles instead)
      if (blockedBy.crate && !p.grabbing && p.onGround) {
        const c = blockedBy.crate;
        const push = clamp(speed, -1.6, 1.6);
        moveCrateX(c, push);
        if (frame % 14 === 0) Sfx.push();
        // walk up against it
        nx = speed > 0 ? c.x - P_W : c.x + c.w;
        const b2 = { x: nx, y: p.y, w: P_W, h: P_H };
        let ok = true;
        for (const s of solids) { if (s.crate !== c && overlap(b2, s)) { ok = false; break; } }
        if (ok) p.x = nx;
      } else {
        // mantle: grab ledges around chest height while airborne
        const top = blockedBy.y;
        if (!p.onGround && !blockedBy.stomper && top > p.y - 12 && top < p.y + 36) {
          const up = { x: p.x + speed, y: top - P_H, w: P_W, h: P_H };
          let clear = true;
          for (const s of solids) { if (overlap(up, s)) { clear = false; break; } }
          if (clear) {
            p.x = up.x; p.y = up.y; p.vy = 0;
            puff(p.x + P_W / 2, p.y + P_H, 3);
            Sfx.land();
          } else {
            wallStop(p, blockedBy, speed);
          }
        } else {
          wallStop(p, blockedBy, speed);
        }
      }
    } else {
      p.x = nx;
    }
    p.walkT += Math.abs(speed) * 0.06;
    if (p.onGround) {
      p.stepT -= Math.abs(speed);
      if (p.stepT <= 0) { Sfx.step(); p.stepT = 60; }
    }
  }

  // pulling a crate along
  if (p.grabbing && dx !== 0) {
    const c = p.grabbing;
    const want = clamp(dx * 0.55, -1.4, 1.4);
    // keep the crate glued to whichever side it's on
    const target = c.x < p.x ? p.x - c.w : p.x + P_W;
    const d = clamp(target - c.x, -2, 2);
    moveCrateX(c, Math.abs(d) > 0.1 ? d : want * 0);
  }

  // jump
  if (IN.jumpHit() && p.onGround && !p.grabbing) {
    p.vy = JUMP;
    p.onGround = false;
    Sfx.jump();
  }
  // variable height: let go early = shorter hop
  if (!IN.jump() && p.vy < -4) p.vy = -4;

  // vertical
  p.vy = Math.min(p.vy + GRAV, MAXFALL);
  let ny = p.y + p.vy;
  const boxV = { x: p.x, y: ny, w: P_W, h: P_H };
  const wasGround = p.onGround;
  p.onGround = false;
  p.carrier = null;
  for (const s of solids) {
    if (overlap(boxV, s)) {
      if (p.vy > 0 && p.y + P_H <= s.y + Math.max(p.vy, 6)) {
        ny = s.y - P_H;
        if (p.vy > 7 && !wasGround) { Sfx.land(); puff(p.x + P_W / 2, ny + P_H, 4); }
        p.vy = 0;
        p.onGround = true;
        if (s.mover) p.carrier = s.mover;
        if (s.crate) p.carrier = s.crate;
        if (s.collapser) touchCollapser(s.collapser);
      } else if (p.vy < 0 && p.y >= s.y + s.h - 8) {
        // a real head bump - we were below the solid's underside
        ny = s.y + s.h;
        p.vy = 0;
      } else if (p.vy < 0) {
        // grazed a side edge while rising, don't treat it as a ceiling
      } else {
        // squeezed
        ny = p.y;
      }
    }
  }
  p.y = ny;

  // ride whatever we're standing on
  if (p.carrier) {
    const c = p.carrier;
    const ddx = (c.x - (c.px !== undefined ? c.px : c.x));
    const ddy = (c.y - (c.py !== undefined ? c.py : c.y));
    if (ddx || ddy) {
      const box2 = { x: p.x + ddx, y: p.y + ddy, w: P_W, h: P_H };
      let ok = true;
      for (const s of solids) {
        if (s.mover === c || s.crate === c) continue;
        if (overlap(box2, s)) { ok = false; break; }
      }
      if (ok) { p.x += ddx; p.y += ddy; }
    }
  }
}

// clamp to a wall edge, but never teleport - if we're somehow embedded deep
// in a big solid (fp edge cases), just stay put and let gravity sort it out
function wallStop(p, s, speed) {
  const target = speed > 0 ? s.x - P_W : s.x + s.w;
  if (Math.abs(target - p.x) < 40) p.x = target;
}

function moveCrateX(c, dx) {
  if (dx === 0) return;
  const solids = getSolids(true);
  let nx = c.x + dx;
  const box = { x: nx, y: c.y - 0.5, w: c.w, h: c.h };
  for (const s of solids) {
    if (overlap(box, s)) {
      nx = dx > 0 ? s.x - c.w : s.x + s.w;
    }
  }
  // crates block each other
  for (const o of L.crates) {
    if (o === c) continue;
    const b2 = { x: nx, y: c.y, w: c.w, h: c.h };
    if (overlap(b2, o)) nx = dx > 0 ? o.x - c.w : o.x + o.w;
  }
  // don't shove the crate into the player - unless we're the one dragging it,
  // then just butt it up against us
  const b3 = { x: nx, y: c.y, w: c.w, h: c.h };
  if (!player.dead && overlap(b3, { x: player.x, y: player.y, w: P_W, h: P_H }) && player.carrier !== c) {
    if (player.grabbing === c) nx = dx > 0 ? player.x - c.w : player.x + P_W;
    else nx = c.x;
  }
  c.x = clamp(nx, 0, L.D.w - c.w);
}

function updateCrates() {
  for (const c of L.crates) {
    c.px = c.x; c.py = c.y;

    // water buoyancy + current
    c.inWater = false;
    for (const w of L.water) {
      const wr = waterRect(w);
      if (overlap(c, wr)) {
        c.inWater = true;
        const surface = wr.y;
        const targetTop = surface - 34;   // floats about 3/4 above
        if (c.y > targetTop) c.vy -= 0.35;
        else c.vy += 0.12;
        c.vy *= 0.9;
        // riding it pushes it under a little
        if (player.carrier === c) c.vy += 0.18;
      }
    }
    if (!c.inWater) c.vy = Math.min(c.vy + GRAV, MAXFALL);

    let ny = c.y + c.vy;
    const solids = getSolids(true);
    const box = { x: c.x, y: ny, w: c.w, h: c.h };
    for (const s of solids) {
      if (overlap(box, s)) {
        if (c.vy > 0 && c.y + c.h <= s.y + Math.max(c.vy, 6)) {
          if (c.vy > 6) Sfx.thunk();
          ny = s.y - c.h; c.vy = 0;
          if (s.collapser) touchCollapser(s.collapser);
        } else if (c.vy < 0) {
          ny = s.y + s.h; c.vy = 0;
        }
      }
    }
    for (const o of L.crates) {
      if (o === c) continue;
      const b2 = { x: c.x, y: ny, w: c.w, h: c.h };
      if (overlap(b2, o) && c.vy > 0) { ny = o.y - c.h; c.vy = 0; }
    }
    c.y = ny;

    // crates spring bear traps
    for (const t of L.traps) {
      if (!t.sprung && overlap(c, t)) { t.sprung = true; t.anim = 1; Sfx.snap(); shake = 4; }
    }
  }
}

function touchCollapser(c) {
  if (c.state === 0) { c.state = 1; c.t = 0; }
}

function waterRect(w) {
  return { x: w.x, y: w.y, w: w.w, h: w.h };
}

// ---- entity updates ------------------------------------------------------
function updateEntities() {
  L.t++;

  // channels from plates + levers
  const ch = {};
  for (const pl of L.plates) {
    const sensor = { x: pl.x, y: pl.y - 8, w: pl.w, h: 10 };
    let down = overlap(sensor, { x: player.x, y: player.y, w: P_W, h: P_H }) && !player.dead;
    for (const c of L.crates) if (overlap(sensor, c)) down = true;
    if (down && !pl.down) Sfx.click();
    pl.down = down;
    if (down) ch[pl.id] = true;
  }
  for (const lv of L.levers) {
    if (lv.cool > 0) lv.cool--;
    if (lv.timed && lv.on) {
      lv.t--;
      if (lv.t <= 0) { lv.on = false; Sfx.lever(); }
      else if (lv.t < 90 && lv.t % 18 === 0) Sfx.tick();
    }
    const near = Math.abs(player.x + P_W / 2 - lv.x) < 30 && Math.abs(player.y + P_H - lv.y) < 50;
    if (near && IN.grab() && lv.cool === 0 && !player.dead) {
      lv.on = !lv.on;
      if (lv.timed) lv.t = lv.timed;
      lv.cool = 25;
      Sfx.lever();
    }
    if (lv.on) ch[lv.id] = true;
  }
  L.channels = ch;

  // doors
  for (const d of L.doors) {
    const want = ch[d.id] ? 1 : 0;
    const before = d.open;
    if (want > d.open) d.open = Math.min(1, d.open + 0.035);
    else if (want < d.open) d.open = Math.max(0, d.open - (d.slow ? 0.006 : 0.05));
    if ((before === 0 && d.open > 0) || (before === 1 && d.open < 1)) Sfx.door();
  }

  // electric floors
  for (const f of L.efloors) {
    if (f.id) {
      f.active = !ch[f.id];
    } else {
      const t = (L.t + (f.offset || 0)) % (f.on + f.off);
      const wasActive = f.active;
      f.active = t < f.on;
      f.warn = !f.active && t > f.on + f.off - 30;
      if (f.active && !wasActive) Sfx.spark();
    }
    if (f.active && frame % 9 === 0 && Math.random() < 0.4) {
      spark(f.x + Math.random() * f.w, f.y);
    }
  }

  // stompers
  for (const s of L.stompers) {
    s.py = s.ext;
    if (s.phase === 'wait') {
      const px = player.x + P_W / 2;
      if (px > s.x - 170 && px < s.x + s.w + 80) { s.phase = 'cycle'; s.t = 0; }
    } else {
      s.t++;
      const cyc = s.t % s.period;
      if (cyc < 16) {
        // slam
        s.ext = Math.min(s.max, s.ext + 26);
        if (s.ext === s.max && s.py < s.max) { Sfx.slam(); shake = 6; puff(s.x + s.w / 2, s.y + s.ext, 6); }
      } else if (cyc < 60) {
        // sit
      } else {
        s.ext = Math.max(s.min, s.ext - 2.4);
      }
    }
    s.slamming = s.ext - s.py > 8;
  }

  // shooters + darts
  for (const s of L.shooters) {
    if (s.cool > 0) s.cool--;
    if (s.trip) {
      const crossed = (player.x + P_W > s.trip && player.x < s.trip + 4) ||
                      (player.px < s.trip && player.x + P_W > s.trip);
      if (crossed && s.cool === 0 && !player.dead) {
        fireDart(s); s.cool = 100;
      }
    } else {
      s.t++;
      if (s.t >= s.every) { s.t = 0; fireDart(s); }
    }
  }
  for (let i = L.darts.length - 1; i >= 0; i--) {
    const d = L.darts[i];
    if (d.stuck) { if (--d.life <= 0) L.darts.splice(i, 1); continue; }
    d.x += d.vx;
    const solids = getSolids(false);
    let hit = false;
    for (const s of solids) {
      if (overlap(d, s)) { hit = true; break; }
    }
    if (hit) { d.stuck = true; d.life = 40; Sfx.thunk(); continue; }
    if (d.x < -40 || d.x > L.D.w + 40) L.darts.splice(i, 1);
  }

  // saws
  for (const s of L.saws) {
    s.t += s.speed;
    const phase = ((s.t % (s.dist * 2)) + s.dist * 2) % (s.dist * 2);
    const dd = phase < s.dist ? phase : s.dist * 2 - phase;
    s.cx = s.x + s.dx * dd;
    s.cy = s.y + s.dy * dd;
    s.spin = (s.spin || 0) + 0.35;
    const px = player.x + P_W / 2;
    if (!player.dead && Math.abs(s.cx - px) < 200 && frame % 45 === 0) Sfx.saw();
  }

  // pendulums
  for (const p of L.pends) {
    const a = p.amp * Math.sin((L.t + (p.offset || 0)) * Math.PI * 2 / p.period);
    p.bx = p.x + Math.sin(a) * p.len;
    p.by = p.y + Math.cos(a) * p.len;
    p.a = a;
  }

  // movers
  for (const m of L.movers) {
    m.px = m.x; m.py = m.y;
    m.t += m.speed;
    const phase = m.t % (m.dist * 2);
    const dd = phase < m.dist ? phase : m.dist * 2 - phase;
    m.x = (m.baseX !== undefined ? m.baseX : (m.baseX = m.px)) + m.dx * dd;
    m.y = (m.baseY !== undefined ? m.baseY : (m.baseY = m.py)) + m.dy * dd;
  }

  // water rising
  for (const w of L.water) {
    if (w.rise && !w.rising && player.x > w.rise.trigX) {
      w.rising = true;
      Sfx.splash();
    }
    if (w.rising && w.y > w.rise.to) {
      const ny = w.y - w.rise.speed;
      w.h += w.y - ny;
      w.y = ny;
      if (frame % 30 === 0) Sfx.splash();
    }
  }

  // collapsers
  for (const c of L.collapsers) {
    if (c.state === 1) {
      c.t++;
      if (c.t > 32) { c.state = 2; c.vy = 0; }
    } else if (c.state === 2) {
      c.vy = Math.min(c.vy + GRAV, MAXFALL);
      c.y += c.vy;
      if (c.y > L.D.h + 60) c.state = 3;
    }
  }

  // bear trap snap animation
  for (const t of L.traps) if (t.anim > 0) t.anim = Math.max(0, t.anim - 0.08);

  // checkpoints
  for (let i = 0; i < L.checks.length; i++) {
    const c = L.checks[i];
    if (i > L.checkIdx && Math.abs(player.x - c.x) < 26 && Math.abs(player.y - c.y) < 60) {
      L.checkIdx = i;
      Sfx.check();
    }
  }

  // particles
  for (let i = L.particles.length - 1; i >= 0; i--) {
    const p = L.particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += p.g || 0;
    p.life--;
    if (p.life <= 0) L.particles.splice(i, 1);
  }
}

function fireDart(s) {
  L.darts.push({ x: s.x + (s.dir > 0 ? 10 : -10), y: s.y - 2, w: 16, h: 5, vx: s.dir * 7 });
  Sfx.dart();
}

// ---- death checks --------------------------------------------------------
function checkDeath() {
  const p = player;
  if (p.dead) return;
  const box = { x: p.x + 3, y: p.y + 3, w: P_W - 6, h: P_H - 6 };
  const feet = { x: p.x + 4, y: p.y + P_H - 8, w: P_W - 8, h: 10 };

  // fell out of the world
  if (p.y > L.D.h + 120) return die('void');

  for (const s of L.spikes) {
    if (overlap(feet, { x: s.x, y: s.y - 16, w: s.w, h: 18 })) return die('spikes');
  }
  for (const t of L.traps) {
    if (!t.sprung && overlap(feet, t)) {
      t.sprung = true; t.anim = 1; Sfx.snap();
      return die('trap');
    }
  }
  for (const s of L.stompers) {
    const body = { x: s.x, y: s.y, w: s.w, h: s.ext };
    if (s.slamming && overlap(box, body)) return die('crush');
    // squeezed between a resting stomper and the ground
    if (!s.slamming && overlap({ x: p.x + 4, y: p.y, w: P_W - 8, h: 6 }, body) && p.onGround) return die('crush');
  }
  for (const s of L.saws) {
    if (circleRect(s.cx, s.cy, s.r - 3, box)) return die('saw');
  }
  for (const pe of L.pends) {
    if (circleRect(pe.bx, pe.by, 27, box)) return die('blade');
  }
  for (const d of L.darts) {
    if (!d.stuck && overlap(d, box)) return die('dart');
  }
  for (const f of L.efloors) {
    if (f.active && overlap(feet, { x: f.x, y: f.y - 10, w: f.w, h: 12 })) return die('shock');
  }
  // drowning: head under water too long
  let submerged = false;
  for (const w of L.water) {
    const wr = waterRect(w);
    if (p.y + 8 > wr.y && overlap(box, wr)) submerged = true;
  }
  if (submerged) {
    if (p.drown === 0) { Sfx.splash(); splashFx(p.x + P_W / 2, p.y); }
    p.drown++;
    if (p.drown > 55) return die('drown');
  } else if (p.drown > 0) {
    p.drown = 0;
  }
}

function die(how) {
  const p = player;
  p.dead = true;
  p.deadT = 0;
  save.deaths = save.deaths + 1;
  sessionDeaths++;
  shake = 8;
  Sfx.death();
  // scatter the silhouette
  for (let i = 0; i < 26; i++) {
    L.particles.push({
      x: p.x + Math.random() * P_W, y: p.y + Math.random() * P_H,
      vx: (Math.random() - 0.5) * (how === 'crush' ? 7 : 4),
      vy: -Math.random() * 5 + (how === 'drown' ? 1 : 0),
      g: 0.25, life: 40 + Math.random() * 40, r: 1.5 + Math.random() * 3, dark: true
    });
  }
}

function puff(x, y, n) {
  for (let i = 0; i < n; i++) {
    L.particles.push({
      x: x + (Math.random() - 0.5) * 14, y,
      vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.8,
      life: 20 + Math.random() * 20, r: 2 + Math.random() * 3, dust: true
    });
  }
}
function spark(x, y) {
  L.particles.push({
    x, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2.5,
    g: 0.15, life: 10 + Math.random() * 12, r: 1 + Math.random(), spark: true
  });
}
function splashFx(x, y) {
  for (let i = 0; i < 10; i++) {
    L.particles.push({
      x: x + (Math.random() - 0.5) * 20, y,
      vx: (Math.random() - 0.5) * 2.5, vy: -Math.random() * 3,
      g: 0.2, life: 25, r: 1.5 + Math.random() * 2, splash: true
    });
  }
}

// ---- camera --------------------------------------------------------------
const cam = { x: 0, y: 0 };
function updateCam() {
  const tx = clamp(player.x + P_W / 2 + player.face * 60 - W / 2, 0, Math.max(0, L.D.w - W));
  const ty = clamp(player.y + P_H / 2 - H / 2 - 30, 0, Math.max(0, L.D.h - H));
  cam.x = lerp(cam.x, tx, 0.07);
  cam.y = lerp(cam.y, ty, 0.09);
}

// ---- exit / level flow ---------------------------------------------------
function checkExit() {
  const e = L.D.exit;
  const door = { x: e[0] - 22, y: e[1] - 66, w: 44, h: 66 };
  if (overlap(door, { x: player.x, y: player.y, w: P_W, h: P_H })) {
    Sfx.win();
    startFade(() => {
      if (levelIdx + 1 >= LEVELS.length) {
        state = 'end';
      } else {
        levelIdx++;
        save.unlocked = Math.max(save.unlocked, levelIdx);
        buildLevel(levelIdx, null);
      }
    });
  }
}

function startFade(cb) {
  fadeDir = 1;
  fadeTo = cb;
}

// ---- update --------------------------------------------------------------
function update() {
  frame++;
  if (frame % 4 === 0) regrain();
  if (shake > 0) shake *= 0.85;

  for (const m of motes) {
    m.x += m.s;
    if (m.x - m.r > W) m.x = -m.r;
  }

  // fading
  if (fadeDir === 1) {
    fade = Math.min(1, fade + 0.03);
    if (fade >= 1 && fadeTo) { const cb = fadeTo; fadeTo = null; cb(); fadeDir = -1; }
  } else if (fadeDir === -1 && fade > 0) {
    fade = Math.max(0, fade - 0.025);
  }

  if (state === 'title') {
    if (pressed.ArrowLeft || pressed.KeyA) { menuSel = Math.max(0, menuSel - 1); Sfx.tick(); }
    if (pressed.ArrowRight || pressed.KeyD) { menuSel = Math.min(save.unlocked, Math.min(menuSel + 1, LEVELS.length - 1)); Sfx.tick(); }
    if (IN.start() && fadeDir !== 1) {
      startFade(() => {
        state = 'play';
        levelIdx = menuSel;
        playTime = 0;
        buildLevel(levelIdx, null);
      });
    }
  } else if (state === 'play') {
    playTime++;
    if (L.introT > 0) L.introT--;

    player.px = player.x;

    if (!player.dead) {
      movePlayer();
      updateCrates();
      updateEntities();
      checkDeath();
      if (!player.dead && fadeDir !== 1) checkExit();
      player.blink = (player.blink + 1) % 210;
    } else {
      updateEntities();
      player.deadT++;
      if (player.deadT > 55) {
        buildLevel(levelIdx, L.checkIdx >= 0 ? L.checkIdx : null);
      }
    }

    updateCam();

    if (pressed.KeyR && !player.dead) die('restart');
    if (pressed.Escape) { state = 'title'; menuSel = levelIdx; fade = 1; fadeDir = -1; }
  } else if (state === 'end') {
    if (IN.start() && fadeDir !== 1) {
      startFade(() => { state = 'title'; menuSel = 0; });
    }
  }

  if (pressed.KeyM) Sfx.toggleMute();

  // clear one-frame inputs
  for (const k in pressed) pressed[k] = false;
  touch.jumpHit = false;
}

// ---- drawing -------------------------------------------------------------
function draw() {
  ctx.save();

  // ch12 walks out of the dark; brightness ramps with x
  let bright = 0;
  if (state === 'play' && L && L.D.bright) {
    bright = clamp((player.x - 300) / (L.D.w - 500), 0, 1);
  }

  drawSky(bright);

  if (state === 'title') { drawTitle(); ctx.restore(); drawGrainAndVignette(0); return; }
  if (state === 'end') { drawEnd(); ctx.restore(); drawGrainAndVignette(0); return; }

  drawParallax(bright);

  // world space
  const sx = (Math.random() - 0.5) * shake;
  const sy = (Math.random() - 0.5) * shake;
  ctx.save();
  ctx.translate(-Math.round(cam.x + sx), -Math.round(cam.y + sy));

  const ink = bright > 0 ? blend('#0d0d0d', '#3c3c3c', bright) : '#0d0d0d';
  ctx.fillStyle = ink;

  drawDoorsAndExit(ink);
  drawPlats(ink);
  drawEntities(ink, bright);
  if (!player.dead) drawPlayer(ink);
  drawParticles();
  drawWater();
  drawHints();

  ctx.restore(); // world

  drawFogFront(bright);
  drawHud();
  ctx.restore();
  drawGrainAndVignette(bright);
}

function blend(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp(pa >> 16, pb >> 16, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

function drawSky(bright) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (bright > 0) {
    g.addColorStop(0, blend('#3a3a3a', '#cfcdc6', bright));
    g.addColorStop(0.55, blend('#8a8a8a', '#f2efe6', bright));
    g.addColorStop(1, blend('#2e2e2e', '#b5b2a8', bright));
  } else {
    g.addColorStop(0, '#3a3a3a');
    g.addColorStop(0.55, '#8a8a8a');
    g.addColorStop(1, '#2e2e2e');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawParallax(bright) {
  for (const layer of bgLayers) {
    const tones = ['#6f6f6f', '#4c4c4c', '#2c2c2c'];
    let col = tones[layer.tone];
    if (bright > 0) col = blend(col, '#d8d5cc', bright * 0.8);
    ctx.fillStyle = col;
    const off = cam.x * layer.par;
    const yoff = cam.y * layer.par * 0.5;
    const span = W * 2.2;
    const n = layer.pts.length - 1;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i <= n; i++) {
      const px = (i / n) * span - (off % span);
      // draw twice for wraparound
    }
    // simpler: sample by screen x
    for (let x = 0; x <= W; x += 16) {
      const u = ((x + off) / span) % 1;
      const fi = u * n;
      const i0 = Math.floor(fi), i1 = Math.min(i0 + 1, n);
      const yv = lerp(layer.pts[i0], layer.pts[i1], fi - i0);
      ctx.lineTo(x, H * (0.35 + yv * 0.5) - yoff + layer.tone * 30);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // gaunt trees on the ridges
    for (const t of layer.trees) {
      const tx = ((t.u * span - off) % span + span) % span;
      if (tx < -20 || tx > W + 20) continue;
      const u = ((tx + off) / span) % 1;
      const fi = u * n;
      const i0 = Math.floor(fi), i1 = Math.min(i0 + 1, n);
      const baseY = H * (0.35 + lerp(layer.pts[i0], layer.pts[i1], fi - i0) * 0.5) - yoff + layer.tone * 30;
      ctx.save();
      ctx.translate(tx, baseY + 2);
      ctx.rotate(t.lean);
      ctx.fillRect(-t.w / 2, -t.h, t.w, t.h);
      // a few bare branches
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(1, t.w * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, -t.h * 0.7);
      ctx.lineTo(t.h * 0.22, -t.h * 0.95);
      ctx.moveTo(0, -t.h * 0.55);
      ctx.lineTo(-t.h * 0.2, -t.h * 0.78);
      ctx.stroke();
      ctx.restore();
    }
  }

  // soft fog band behind the play layer
  const fg = ctx.createLinearGradient(0, H * 0.4, 0, H);
  fg.addColorStop(0, 'rgba(160,160,160,0)');
  fg.addColorStop(1, 'rgba(160,160,160,0.25)');
  ctx.fillStyle = fg;
  ctx.fillRect(0, 0, W, H);
}

function drawPlats(ink) {
  ctx.fillStyle = ink;
  for (const p of L.plats) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // grass tufts along platform tops, they twitch a little
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  for (const p of L.plats) {
    if (p.h < 20) continue;
    ctx.beginPath();
    for (let x = p.x + 4; x < p.x + p.w - 4; x += 9) {
      const h = 4 + ((x * 7919) % 7);
      const sway = Math.sin(frame * 0.05 + x * 0.7) * 1.5;
      ctx.moveTo(x, p.y + 1);
      ctx.lineTo(x + sway, p.y - h);
    }
    ctx.stroke();
  }
  // collapsers
  for (const c of L.collapsers) {
    if (c.state === 3) continue;
    const jx = c.state === 1 ? (Math.random() - 0.5) * 3 : 0;
    ctx.fillStyle = ink;
    ctx.fillRect(c.x + jx, c.y, c.w, c.h);
    // cracks so they read as unstable
    ctx.strokeStyle = 'rgba(140,140,140,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c.x + jx + c.w * 0.3, c.y);
    ctx.lineTo(c.x + jx + c.w * 0.4, c.y + c.h);
    ctx.moveTo(c.x + jx + c.w * 0.7, c.y);
    ctx.lineTo(c.x + jx + c.w * 0.62, c.y + c.h);
    ctx.stroke();
  }
}

function drawDoorsAndExit(ink) {
  for (const d of L.doors) {
    const sh = d.h * (1 - d.open);
    ctx.fillStyle = ink;
    if (sh > 2) ctx.fillRect(d.x, d.y, d.w, sh);
    // frame
    ctx.fillRect(d.x - 6, d.y - 14, d.w + 12, 14);
  }
  // exit: a doorway with pale light spilling out
  const e = L.D.exit;
  const glow = ctx.createRadialGradient(e[0], e[1] - 30, 4, e[0], e[1] - 30, 90);
  glow.addColorStop(0, 'rgba(240,238,225,0.55)');
  glow.addColorStop(1, 'rgba(240,238,225,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(e[0] - 90, e[1] - 120, 180, 140);
  ctx.fillStyle = 'rgba(245,243,230,0.85)';
  ctx.fillRect(e[0] - 14, e[1] - 58, 28, 58);
  ctx.fillStyle = ink;
  ctx.fillRect(e[0] - 20, e[1] - 64, 6, 64);
  ctx.fillRect(e[0] + 14, e[1] - 64, 6, 64);
  ctx.fillRect(e[0] - 20, e[1] - 64, 40, 6);
}

function drawEntities(ink, bright) {
  // spikes
  ctx.fillStyle = ink;
  for (const s of L.spikes) {
    ctx.beginPath();
    for (let x = s.x; x < s.x + s.w; x += 14) {
      ctx.moveTo(x, s.y);
      ctx.lineTo(x + 7, s.y - 16);
      ctx.lineTo(x + 14, s.y);
    }
    ctx.fill();
  }

  // bear traps
  for (const t of L.traps) {
    ctx.fillStyle = ink;
    ctx.fillRect(t.x + 8, t.y + 10, t.w - 16, 4);
    const open = t.sprung ? 0.12 : 1;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    // two jaws with teeth
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(t.x + t.w / 2, t.y + 12);
      ctx.rotate(dir * (1.25 * open + 0.08));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(dir * 0, -20);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 4; i < 20; i += 5) {
        ctx.moveTo(0, -i);
        ctx.lineTo(dir * -4, -i - 2);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // plates
  for (const p of L.plates) {
    ctx.fillStyle = ink;
    ctx.fillRect(p.x, p.y - (p.down ? 3 : 7), p.w, p.down ? 3 : 7);
    ctx.fillRect(p.x + 6, p.y - 2, p.w - 12, 2);
  }

  // levers
  for (const lv of L.levers) {
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 4;
    ctx.fillRect(lv.x - 8, lv.y - 6, 16, 6);
    ctx.beginPath();
    ctx.moveTo(lv.x, lv.y - 4);
    const ang = lv.on ? -0.7 : 0.7;
    ctx.lineTo(lv.x + Math.sin(ang) * 22, lv.y - 4 - Math.cos(ang) * 22);
    ctx.stroke();
    if (lv.timed && lv.on && lv.t < 90 && Math.floor(frame / 9) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,250,230,0.7)';
      ctx.fillRect(lv.x - 2, lv.y - 34, 4, 4);
    }
  }

  // electric floors
  for (const f of L.efloors) {
    ctx.fillStyle = ink;
    ctx.fillRect(f.x, f.y - 4, f.w, 4);
    if (f.active) {
      ctx.strokeStyle = 'rgba(235,235,255,' + (0.4 + Math.random() * 0.5) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let x = f.x;
      ctx.moveTo(x, f.y - 6);
      while (x < f.x + f.w) {
        x += 8 + Math.random() * 14;
        ctx.lineTo(Math.min(x, f.x + f.w), f.y - 4 - Math.random() * 9);
      }
      ctx.stroke();
    } else if (f.warn && Math.floor(frame / 6) % 2 === 0) {
      ctx.fillStyle = 'rgba(235,235,255,0.25)';
      ctx.fillRect(f.x, f.y - 6, f.w, 2);
    }
  }

  // stompers
  for (const s of L.stompers) {
    ctx.fillStyle = ink;
    ctx.fillRect(s.x + s.w / 2 - 5, 0, 10, s.y + 4);   // shaft from ceiling
    ctx.fillRect(s.x, s.y, s.w, s.ext);
    // jagged underside
    ctx.beginPath();
    for (let x = s.x; x < s.x + s.w; x += 12) {
      ctx.moveTo(x, s.y + s.ext);
      ctx.lineTo(x + 6, s.y + s.ext + 8);
      ctx.lineTo(x + 12, s.y + s.ext);
    }
    ctx.fill();
    // dust trickle warns about the sleeping ones
    if (s.phase === 'wait' && frame % 20 === 0) {
      spark(s.x + Math.random() * s.w, s.y + s.ext + 8);
    }
  }

  // shooters: a carved face in the wall + the tripwire if any
  for (const s of L.shooters) {
    ctx.fillStyle = ink;
    ctx.fillRect(s.x - 6, s.y - 12, 12, 24);
    ctx.fillStyle = '#666';
    ctx.fillRect(s.x + (s.dir > 0 ? 4 : -8), s.y - 3, 4, 6);
    if (s.trip) {
      ctx.strokeStyle = 'rgba(220,220,220,' + (0.1 + 0.08 * Math.sin(frame * 0.2)) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.trip, 0);
      ctx.lineTo(s.trip, L.D.h);
      ctx.stroke();
    }
  }

  // darts
  ctx.fillStyle = ink;
  for (const d of L.darts) {
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }

  // movers
  for (const m of L.movers) {
    ctx.fillStyle = ink;
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillRect(m.x + 8, m.y + m.h, 4, 6);
    ctx.fillRect(m.x + m.w - 12, m.y + m.h, 4, 6);
  }

  // saws
  for (const s of L.saws) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, s.r - 4, 0, Math.PI * 2);
    ctx.fill();
    // teeth
    for (let i = 0; i < 10; i++) {
      const a = s.spin + (i / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(s.cx + Math.cos(a) * (s.r - 5), s.cy + Math.sin(a) * (s.r - 5));
      ctx.lineTo(s.cx + Math.cos(a + 0.18) * (s.r + 4), s.cy + Math.sin(a + 0.18) * (s.r + 4));
      ctx.lineTo(s.cx + Math.cos(a + 0.36) * (s.r - 5), s.cy + Math.sin(a + 0.36) * (s.r - 5));
      ctx.fill();
    }
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.arc(s.cx, s.cy, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // pendulums
  for (const p of L.pends) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.bx, p.by);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // the blade: a crescent
    ctx.save();
    ctx.translate(p.bx, p.by);
    ctx.rotate(-p.a);
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.arc(0, -10, 24, 0.8 * Math.PI, 0.2 * Math.PI, true);
    ctx.fill();
    ctx.restore();
  }

  // crates
  for (const c of L.crates) {
    ctx.fillStyle = ink;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(150,150,150,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x + 4, c.y + 4, c.w - 8, c.h - 8);
    ctx.beginPath();
    ctx.moveTo(c.x + 4, c.y + 4);
    ctx.lineTo(c.x + c.w - 4, c.y + c.h - 4);
    ctx.stroke();
  }

  // checkpoints: a faint firefly loitering
  for (let i = 0; i < L.checks.length; i++) {
    const c = L.checks[i];
    const bob = Math.sin(frame * 0.06 + i * 2) * 6;
    const a = i <= L.checkIdx ? 0.9 : 0.35;
    ctx.fillStyle = `rgba(250,248,230,${a})`;
    ctx.beginPath();
    ctx.arc(c.x + 10, c.y - 14 + bob, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater() {
  for (const w of L.water) {
    const wr = waterRect(w);
    const g = ctx.createLinearGradient(0, wr.y, 0, wr.y + wr.h);
    g.addColorStop(0, 'rgba(20,22,26,0.72)');
    g.addColorStop(1, 'rgba(8,9,11,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
    // surface line ripples
    ctx.strokeStyle = 'rgba(200,205,215,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = wr.x; x <= wr.x + wr.w; x += 8) {
      const y = wr.y + Math.sin(x * 0.08 + frame * 0.08) * 1.6;
      x === wr.x ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawPlayer(ink) {
  const p = player;
  const cx = p.x + P_W / 2;
  const bob = p.onGround && (IN.left() || IN.right()) ? Math.abs(Math.sin(p.walkT * 2)) * 1.5 : 0;
  const grabLean = p.grabbing ? p.face * 0.15 : 0;

  ctx.save();
  ctx.translate(cx, p.y + P_H);
  ctx.rotate(grabLean);

  ctx.fillStyle = ink;
  // legs
  const lt = p.walkT * 2;
  const stride = p.onGround && (IN.left() || IN.right()) ? 7 : (p.onGround ? 2 : 5);
  const l1 = Math.sin(lt) * stride;
  const l2 = -Math.sin(lt) * stride;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -16);
  ctx.lineTo(-2 + l1, p.onGround ? 0 : -4);
  ctx.moveTo(2, -16);
  ctx.lineTo(2 + l2, p.onGround ? 0 : -6);
  ctx.stroke();
  // torso
  ctx.beginPath();
  ctx.ellipse(0, -22 + bob, 7, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // arms
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (p.grabbing) {
    ctx.moveTo(0, -28 + bob);
    ctx.lineTo(p.face * 12, -24 + bob);
  } else if (!p.onGround) {
    ctx.moveTo(0, -28 + bob);
    ctx.lineTo(-7, -36);
    ctx.moveTo(0, -28 + bob);
    ctx.lineTo(8, -34);
  } else {
    ctx.moveTo(0, -28 + bob);
    ctx.lineTo(-3 - Math.sin(lt) * 3, -16 + bob);
    ctx.moveTo(0, -28 + bob);
    ctx.lineTo(3 + Math.sin(lt) * 3, -16 + bob);
  }
  ctx.stroke();
  // head
  ctx.beginPath();
  ctx.arc(p.face * 1.5, -38 + bob, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // the eyes. small, white, alive.
  if (p.blink < 200) {
    ctx.fillStyle = 'rgba(255,255,252,0.95)';
    ctx.shadowColor = 'rgba(255,255,240,0.9)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(p.face * 3 - 1.6, -39 + bob, 1.15, 0, Math.PI * 2);
    ctx.arc(p.face * 3 + 1.9, -39 + bob, 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of L.particles) {
    let col;
    if (p.dark) col = 'rgba(13,13,13,' + clamp(p.life / 30, 0, 1) + ')';
    else if (p.spark) col = 'rgba(240,240,255,' + clamp(p.life / 12, 0, 1) + ')';
    else if (p.splash) col = 'rgba(190,200,210,' + clamp(p.life / 20, 0, 0.8) + ')';
    else col = 'rgba(150,150,150,' + clamp(p.life / 40, 0, 0.5) + ')';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHints() {
  if (!L.D.hints) return;
  ctx.fillStyle = 'rgba(230,228,215,0.4)';
  ctx.font = 'italic 17px Georgia, serif';
  ctx.textAlign = 'center';
  for (const h of L.D.hints) {
    ctx.fillText(h.t, h.x, h.y + Math.sin(frame * 0.04) * 2);
  }
}

function drawFogFront(bright) {
  for (const m of motes) {
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    g.addColorStop(0, `rgba(170,170,170,${m.a * (1 - bright * 0.5)})`);
    g.addColorStop(1, 'rgba(170,170,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
  }
}

function drawHud() {
  // chapter intro
  if (L.introT > 0) {
    const a = clamp(L.introT > 90 ? (120 - L.introT) / 30 : L.introT / 60, 0, 1);
    ctx.fillStyle = `rgba(235,233,220,${a * 0.85})`;
    ctx.font = '26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(L.D.num + '.  ' + L.D.name, W / 2, 90);
  }
  if (Sfx.isMuted()) {
    ctx.fillStyle = 'rgba(220,220,220,0.4)';
    ctx.font = '13px Georgia, serif';
    ctx.textAlign = 'right';
    ctx.fillText('muted', W - 14, 22);
  }
  // touch buttons
  if (touch.active && state === 'play') {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    const btns = [
      [W * 0.09, H * 0.85, '◀'], [W * 0.27, H * 0.85, '▶'],
      [W * 0.73, H * 0.85, 'E'], [W * 0.91, H * 0.85, '▲']
    ];
    for (const [x, y, t] of btns) {
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '20px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText(t, x, y + 7);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
    }
  }
}

function drawGrainAndVignette(bright) {
  // film grain
  ctx.globalAlpha = 0.05;
  for (let y = 0; y < H; y += 160) {
    for (let x = 0; x < W; x += 160) {
      ctx.drawImage(grainCv, x, y);
    }
  }
  ctx.globalAlpha = 1;

  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,${0.55 - bright * 0.3})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);

  // fade
  if (fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawTitle() {
  // dark woods backdrop
  ctx.fillStyle = '#161616';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 30, W / 2, H * 0.42, 460);
  g.addColorStop(0, 'rgba(150,148,140,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  for (const m of motes) {
    const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
    mg.addColorStop(0, `rgba(120,120,120,${m.a})`);
    mg.addColorStop(1, 'rgba(120,120,120,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(238,236,225,0.92)';
  ctx.font = '74px Georgia, serif';
  ctx.fillText('U M B R A', W / 2, H * 0.36);
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillStyle = 'rgba(200,198,188,0.55)';
  ctx.fillText('a small dark game', W / 2, H * 0.44);

  // a pair of eyes watching from the edge of the frame
  if (Math.floor(frame / 160) % 4 !== 0) {
    ctx.fillStyle = 'rgba(255,255,250,0.8)';
    ctx.beginPath();
    ctx.arc(W * 0.87, H * 0.72, 2, 0, Math.PI * 2);
    ctx.arc(W * 0.87 + 9, H * 0.72, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // chapter row
  const total = LEVELS.length;
  const cw = 52;
  const x0 = W / 2 - (total * cw) / 2 + cw / 2;
  ctx.font = '17px Georgia, serif';
  for (let i = 0; i < total; i++) {
    const locked = i > save.unlocked;
    const sel = i === menuSel;
    const x = x0 + i * cw;
    const y = H * 0.60;
    if (sel) {
      ctx.strokeStyle = 'rgba(238,236,225,0.7)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 20, y - 20, 40, 30);
    }
    ctx.fillStyle = locked ? 'rgba(120,120,115,0.35)' : (sel ? 'rgba(240,238,228,0.95)' : 'rgba(200,198,190,0.6)');
    ctx.fillText(locked ? '·' : LEVELS[i].num, x, y);
  }
  ctx.fillStyle = 'rgba(190,188,178,0.5)';
  ctx.font = 'italic 15px Georgia, serif';
  ctx.fillText(LEVELS[menuSel].name.toLowerCase(), W / 2, H * 0.66);

  const pulse = 0.35 + 0.2 * Math.sin(frame * 0.05);
  ctx.fillStyle = `rgba(230,228,218,${pulse})`;
  ctx.font = '16px Georgia, serif';
  ctx.fillText(touch.active ? 'tap to begin' : 'press enter', W / 2, H * 0.78);

  ctx.fillStyle = 'rgba(150,148,140,0.4)';
  ctx.font = '12px Georgia, serif';
  ctx.fillText('move: A D / arrows      jump: W / space      grab: E / shift      restart: R      mute: M', W / 2, H * 0.9);

  if (save.deaths > 0) {
    ctx.fillStyle = 'rgba(150,148,140,0.35)';
    ctx.fillText(save.deaths + ' deaths so far', W / 2, H * 0.95);
  }
}

function drawEnd() {
  ctx.fillStyle = '#efece2';
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, 500);
  g.addColorStop(0, 'rgba(255,255,250,0.6)');
  g.addColorStop(1, 'rgba(200,196,185,0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(30,30,28,0.85)';
  ctx.font = 'italic 54px Georgia, serif';
  ctx.fillText('fin.', W / 2, H * 0.42);

  const mins = Math.floor(playTime / 3600);
  const secs = Math.floor((playTime % 3600) / 60);
  ctx.font = '17px Georgia, serif';
  ctx.fillStyle = 'rgba(60,60,55,0.7)';
  ctx.fillText(sessionDeaths + ' deaths  ·  ' + mins + 'm ' + String(secs).padStart(2, '0') + 's', W / 2, H * 0.52);

  const pulse = 0.3 + 0.15 * Math.sin(frame * 0.05);
  ctx.fillStyle = `rgba(60,60,55,${pulse})`;
  ctx.font = '15px Georgia, serif';
  ctx.fillText(touch.active ? 'tap to return' : 'press enter', W / 2, H * 0.68);
}

// ---- main loop -----------------------------------------------------------
let last = 0, acc = 0;
const STEP = 1000 / 60;
function loop(t) {
  requestAnimationFrame(loop);
  if (!last) last = t;
  acc += Math.min(t - last, 100);
  last = t;
  let n = 0;
  while (acc >= STEP && n < 4) {
    update();
    acc -= STEP;
    n++;
  }
  draw();
}

menuSel = Math.min(save.unlocked, LEVELS.length - 1);
requestAnimationFrame(loop);

// dev helper - poke at things from the console while tuning levels
window.__umbra = {
  player,
  lvl: () => L,
  state: () => state,
  level: () => levelIdx,
  warp(x, y) { player.x = x; player.y = y; player.vy = 0; }
};

})();
