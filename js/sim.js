// HUNDO - core simulation. Pure and deterministic: the renderer draws it,
// and the level solver (tools/) proves every chapter beatable with it.
// One input bit per frame. That's the whole game.

(function (root) {
'use strict';

const TILE = 32;
const P = 24;                 // player square
const GRAV = 0.62;
const MAXFALL = 13;
const JUMP_V = -9.6;
const PAD_V = -14.2;
const COYOTE = 5;
const BUFFER = 6;
const DASH_T = 12;            // frames of dash
const DASH_MUL = 2.2;
const FLOAT_THRUST = 1.35;
const FLOAT_CAP = -6.4;
const SAW_R = 13;
const SAW_PERIOD = 120;
const SAW_RANGE = 64;
const KILL_PAD = 5;           // hitbox forgiveness on each side

// verbs: what the button means this chapter
// jump  - tap to jump
// jump2 - tap to jump, one extra jump in the air
// flip  - tap to flip gravity (only while standing)
// dash  - tap to phase forward through anything
// float - hold to thrust upward
// stop  - hold to stand still (the world keeps moving)

function parseLevel(def) {
  const rows = def.map;
  const h = rows.length, w = rows[0].length;
  const solids = [];        // static solid grid, 1/0
  const oneways = [];
  const spikes = [];        // {x,y,dir}
  const saws = [];          // {cx,cy,move:'','h','v'}
  const crumbles = [];      // {tx,ty} indexed
  const pads = [];          // {tx,ty,kind:'bounce'|'grav'|verb}
  const popups = [];        // troll: {trigX, cols:[tx,tx+1], ty}
  const phantoms = [];      // troll: fake walls {tx,ty}
  const fakespikes = [];    // troll: harmless
  const fakeExits = [];     // troll: lethal portal {tx}
  let startX = TILE * 2;

  for (let ty = 0; ty < h; ty++) {
    solids.push(new Array(w).fill(0));
    oneways.push(new Array(w).fill(0));
  }
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const c = rows[ty][tx];
      const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
      switch (c) {
        case '#': solids[ty][tx] = 1; break;
        case '-': oneways[ty][tx] = 1; break;
        case '^': spikes.push({ tx, ty, dir: 0 }); break;
        case 'v': spikes.push({ tx, ty, dir: 1 }); break;
        case '<': spikes.push({ tx, ty, dir: 2 }); break;
        case '>': spikes.push({ tx, ty, dir: 3 }); break;
        case '!': fakespikes.push({ tx, ty }); break;
        case '*': saws.push({ cx, cy, move: '' }); break;
        case 'H': saws.push({ cx, cy, move: 'h' }); break;
        case 'V': saws.push({ cx, cy, move: 'v' }); break;
        case '%': crumbles.push({ tx, ty }); break;
        case '=': pads.push({ tx, ty, kind: 'bounce' }); break;
        case 'g': pads.push({ tx, ty, kind: 'grav' }); break;
        case 'J': pads.push({ tx, ty, kind: 'jump' }); break;
        case 'K': pads.push({ tx, ty, kind: 'jump2' }); break;
        case 'F': pads.push({ tx, ty, kind: 'flip' }); break;
        case 'D': pads.push({ tx, ty, kind: 'dash' }); break;
        case 'L': pads.push({ tx, ty, kind: 'float' }); break;
        case 'P': pads.push({ tx, ty, kind: 'stop' }); break;
        case 'T': popups.push({ tx, ty }); break;
        case 'W': phantoms.push({ tx, ty }); break;
        case 'X': fakeExits.push({ tx, ty }); break;
        case 'S': startX = tx * TILE + 4; break;
      }
    }
  }
  // popup spikes: appear on the two columns after their trigger column,
  // planted on the first solid below the trigger row
  for (const p of popups) {
    p.trigX = (p.tx + 1) * TILE;   // becomes lethal once the player passes this
    p.cols = [p.tx + 2, p.tx + 3];
  }
  return {
    def, w, h, solids, oneways, spikes, saws, crumbles, pads,
    popups, phantoms, fakespikes, fakeExits,
    startX,
    finishX: (w - 2) * TILE,
    speed: def.speed,
    verb: def.verb,
    pxw: w * TILE, pxh: h * TILE
  };
}

function newState(lv) {
  // find start ground: drop from top at startX
  return {
    t: 0,
    x: lv.startX,
    y: 0,
    vy: 0,
    grav: 1,
    verb: lv.verb,
    grounded: false,
    coyote: 0,
    buffer: 0,
    canAir: false,      // spare air jump for jump2
    dashT: 0,
    dashCd: 0,
    crumbled: {},       // tileKey -> frame it broke
    touched: {},        // crumble contact timers
    usedPads: {},
    dead: false,
    deadBy: '',
    won: false,
    // events for the renderer (cleared each step)
    ev: null
  };
}

const key = (tx, ty) => tx + ',' + ty;

function solidAt(lv, st, tx, ty) {
  if (tx < 0 || ty < 0 || ty >= lv.h) return false;
  if (tx >= lv.w) return false;
  if (lv.solids[ty][tx]) {
    return true;
  }
  return false;
}

function crumbleAt(lv, st, tx, ty) {
  for (const c of lv.crumbles) {
    if (c.tx === tx && c.ty === ty && !st.crumbled[key(tx, ty)]) return true;
  }
  return false;
}

function isSolid(lv, st, tx, ty) {
  return solidAt(lv, st, tx, ty) || crumbleAt(lv, st, tx, ty);
}

function sawPos(lv, saw, t) {
  if (!saw.move) return { x: saw.cx, y: saw.cy };
  const ph = ((saw.cx * 7 + saw.cy * 13) % SAW_PERIOD + t) % SAW_PERIOD;
  const d = Math.sin(ph / SAW_PERIOD * Math.PI * 2) * SAW_RANGE;
  return saw.move === 'h' ? { x: saw.cx + d, y: saw.cy } : { x: saw.cx, y: saw.cy + d };
}

function rectHit(px, py, rx, ry, rw, rh) {
  return px + P - KILL_PAD > rx && px + KILL_PAD < rx + rw &&
         py + P - KILL_PAD > ry && py + KILL_PAD < ry + rh;
}

// one frame. input = button held this frame (boolean).
function step(lv, st, input) {
  st.t++;
  st.ev = null;
  if (st.dead || st.won) return st;

  const wasHeld = st._held || false;
  const pressed = input && !wasHeld;
  st._held = input;

  // --- the verb ---------------------------------------------------------
  if (pressed) st.buffer = BUFFER;
  else if (st.buffer > 0) st.buffer--;

  const v = st.verb;
  if (st.dashT > 0) {
    // dashing: no gravity, double speed, phase through everything
    st.dashT--;
    st.x += lv.speed * DASH_MUL;
    if (st.dashT === 0) st.ev = 'dashEnd';
  } else {
    if (v === 'jump' || v === 'jump2') {
      if (st.buffer > 0 && (st.grounded || st.coyote > 0)) {
        st.vy = JUMP_V * st.grav;
        st.grounded = false; st.coyote = 0; st.buffer = 0;
        st.canAir = (v === 'jump2');
        st.ev = 'jump';
      } else if (st.buffer > 0 && v === 'jump2' && st.canAir) {
        st.vy = JUMP_V * st.grav;
        st.canAir = false; st.buffer = 0;
        st.ev = 'jump';
      }
    } else if (v === 'flip') {
      if (st.buffer > 0 && st.grounded) {
        st.grav = -st.grav;
        st.vy = 0;
        st.grounded = false; st.buffer = 0;
        st.ev = 'flip';
      }
    } else if (v === 'dash') {
      if (pressed && st.dashCd === 0) {
        st.dashT = DASH_T;
        st.dashCd = -1;         // re-arms on landing
        st.vy = 0;
        st.ev = 'dash';
        st.x += lv.speed * DASH_MUL;
      }
    } else if (v === 'float') {
      if (input) {
        st.vy -= FLOAT_THRUST * st.grav;
        if (st.grav > 0 && st.vy < FLOAT_CAP) st.vy = FLOAT_CAP;
        if (st.grav < 0 && st.vy > -FLOAT_CAP) st.vy = -FLOAT_CAP;
        if (st.t % 4 === 0) st.ev = 'thrust';
      }
    }
    // stop: handled below in horizontal movement

    // --- horizontal -------------------------------------------------------
    const stopped = (v === 'stop' && input && st.grounded);
    if (!stopped) st.x += lv.speed;
  }

  const dashing = st.dashT > 0;

  // wall crash (dash phases through)
  if (!dashing) {
    const front = st.x + P;
    const ftx = Math.floor(front / TILE);
    const ty0 = Math.floor((st.y + 3) / TILE);
    const ty1 = Math.floor((st.y + P - 3) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) {
      if (isSolid(lv, st, ftx, ty)) {
        st.dead = true; st.deadBy = 'wall';
        return st;
      }
    }
  }

  // --- vertical -----------------------------------------------------------
  if (!dashing) {
    st.vy += GRAV * st.grav;
    if (st.vy > MAXFALL) st.vy = MAXFALL;
    if (st.vy < -MAXFALL) st.vy = -MAXFALL;
    st.y += st.vy;
  }

  const wasGrounded = st.grounded;
  st.grounded = false;

  if (!dashing) {
    const tx0 = Math.floor((st.x + 2) / TILE);
    const tx1 = Math.floor((st.x + P - 2) / TILE);
    if (st.grav > 0) {
      // floor
      const fy = Math.floor((st.y + P) / TILE);
      for (let tx = tx0; tx <= tx1; tx++) {
        const oneway = fy >= 0 && fy < lv.h && lv.oneways[fy][tx] === 1;
        if ((isSolid(lv, st, tx, fy) || (oneway && st.vy >= 0 && st.y + P - st.vy <= fy * TILE + 6)) && st.vy >= 0) {
          st.y = fy * TILE - P;
          if (st.vy > 8) st.ev = 'land';
          st.vy = 0;
          st.grounded = true;
          if (crumbleAt(lv, st, tx, fy)) touchCrumble(st, tx, fy);
          break;
        }
      }
      // ceiling
      const cy = Math.floor(st.y / TILE);
      if (st.vy < 0) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (isSolid(lv, st, tx, cy)) { st.y = (cy + 1) * TILE; st.vy = 0; break; }
        }
      }
    } else {
      // inverted gravity: "floor" is above
      const fy = Math.floor(st.y / TILE);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (isSolid(lv, st, tx, fy) && st.vy <= 0) {
          st.y = (fy + 1) * TILE;
          if (st.vy < -8) st.ev = 'land';
          st.vy = 0;
          st.grounded = true;
          if (crumbleAt(lv, st, tx, fy)) touchCrumble(st, tx, fy);
          break;
        }
      }
      const cy = Math.floor((st.y + P) / TILE);
      if (st.vy > 0) {
        for (let tx = tx0; tx <= tx1; tx++) {
          if (isSolid(lv, st, tx, cy)) { st.y = cy * TILE - P; st.vy = 0; break; }
        }
      }
    }
  }

  if (st.grounded) {
    st.coyote = COYOTE;
    if (st.dashCd === -1) st.dashCd = 0;   // dash re-armed
  } else if (st.coyote > 0) st.coyote--;

  // crumble timers tick even after you leave
  for (const k in st.touched) {
    st.touched[k]++;
    if (st.touched[k] >= 9) {
      st.crumbled[k] = st.t;
      delete st.touched[k];
      st.ev = 'crumble';
    }
  }

  // --- pads ---------------------------------------------------------------
  const ptx0 = Math.floor(st.x / TILE), ptx1 = Math.floor((st.x + P) / TILE);
  const pty0 = Math.floor(st.y / TILE), pty1 = Math.floor((st.y + P) / TILE);
  for (const pad of lv.pads) {
    if (pad.tx < ptx0 - 1 || pad.tx > ptx1 + 1) continue;
    const k = key(pad.tx, pad.ty);
    if (st.usedPads[k]) continue;
    if (pad.tx >= ptx0 && pad.tx <= ptx1 && pad.ty >= pty0 && pad.ty <= pty1) {
      st.usedPads[k] = 1;
      if (pad.kind === 'bounce') {
        st.vy = PAD_V * st.grav;
        st.grounded = false;
        st.ev = 'bounce';
      } else if (pad.kind === 'grav') {
        st.grav = -st.grav;
        st.vy = 0;
        st.grounded = false;
        st.ev = 'gravpad';
      } else {
        st.verb = pad.kind;
        st.dashT = 0; st.dashCd = 0; st.canAir = false;
        st.grav = 1;             // pads put your feet back on the floor
        st.ev = 'verb:' + pad.kind;
      }
    }
  }

  // --- death --------------------------------------------------------------
  if (!dashing) {
    // out of the world
    if (st.y > lv.pxh + 40 || st.y < -lv.pxh * 0.5 - 40) {
      st.dead = true; st.deadBy = 'void';
      return st;
    }
    // spikes (forgiving hitbox: a slab at the spike's base)
    for (const s of lv.spikes) {
      const bx = s.tx * TILE, by = s.ty * TILE;
      let rx, ry, rw, rh;
      if (s.dir === 0) { rx = bx + 8; ry = by + 12; rw = 16; rh = 20; }        // ^
      else if (s.dir === 1) { rx = bx + 8; ry = by; rw = 16; rh = 20; }        // v
      else if (s.dir === 2) { rx = bx; ry = by + 8; rw = 20; rh = 16; }        // <
      else { rx = bx + 12; ry = by + 8; rw = 20; rh = 16; }                    // >
      if (rectHit(st.x, st.y, rx, ry, rw, rh)) {
        st.dead = true; st.deadBy = 'spike';
        return st;
      }
    }
    // popup spikes: lethal once you crossed their trigger line. surprise.
    for (const p of lv.popups) {
      if (st.x + P > p.trigX) {
        for (const col of p.cols) {
          const rx = col * TILE + 8, ry = p.ty * TILE + 12;
          if (rectHit(st.x, st.y, rx, ry, 16, 20)) {
            st.dead = true; st.deadBy = 'popup';
            return st;
          }
        }
      }
    }
    // saws
    for (const s of lv.saws) {
      const pos = sawPos(lv, s, st.t);
      const cx = st.x + P / 2, cy2 = st.y + P / 2;
      const dx = pos.x - cx, dy = pos.y - cy2;
      const rr = SAW_R + P / 2 - KILL_PAD;
      if (dx * dx + dy * dy < rr * rr) {
        st.dead = true; st.deadBy = 'saw';
        return st;
      }
    }
    // the fake finish gate. it only reaches so high - jump it. sorry.
    for (const f of lv.fakeExits) {
      if (st.x + P - KILL_PAD > f.tx * TILE + 8 && st.x + KILL_PAD < f.tx * TILE + 24 &&
          st.y + P - KILL_PAD > 336) {
        st.dead = true; st.deadBy = 'fake';
        return st;
      }
    }
  }

  // --- win ----------------------------------------------------------------
  if (st.x >= lv.finishX) {
    st.won = true;
  }
  return st;
}

function touchCrumble(st, tx, ty) {
  const k = key(tx, ty);
  if (!(k in st.touched) && !st.crumbled[k]) st.touched[k] = 0;
}

// drop the player onto the ground at the start
function settle(lv, st) {
  const tx = Math.floor((st.x + P / 2) / TILE);
  for (let ty = 0; ty < lv.h; ty++) {
    if (lv.solids[ty][tx]) {
      st.y = ty * TILE - P;
      st.grounded = true;
      return;
    }
  }
  st.y = (lv.h - 3) * TILE;
}

const Sim = { TILE, P, SAW_R, SAW_PERIOD, parseLevel, newState, step, settle, sawPos };
if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
else root.Sim = Sim;

})(typeof window !== 'undefined' ? window : globalThis);
