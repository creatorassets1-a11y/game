// LOCKSTEP - the turn engine. Nothing in the world moves until you do;
// when you step, everything answers. Pure and deterministic: the renderer
// animates it and the room prover (tools/) searches it exhaustively.
//
// Grid characters:
//   # wall        . floor       ^ spikes      O pit         % crumble
//   ~ ice         + pressure rune (a trap that looks like floor)
//   E exit        F fake exit   K key         D locked door
//   B boulder     P player
//   c hound (chases)            s sleeper hound (statue until close)
//   m mimic (copies your move)  r mirror (does the opposite)
//   h patrol (horizontal)       v patrol (vertical)
//   t turret (counts turns, then fires down its row and column)
//
// Moves: 'U' 'D' 'L' 'R' 'W' (wait).

(function (root) {
'use strict';

const DIRS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0], W: [0, 0] };
const TURRET_PERIOD = 4;   // 0,1 idle - 2 charge - 3 fire

function parseRoom(def) {
  const rows = def.map;
  const h = rows.length, w = rows[0].length;
  const tiles = [];          // static-ish layer, mutated copies live in state
  const ents = [];
  let px = 1, py = 1;
  for (let y = 0; y < h; y++) {
    const line = [];
    for (let x = 0; x < w; x++) {
      let c = rows[y][x];
      if (c === 'P') { px = x; py = y; c = '.'; }
      else if ('csmrhvt'.includes(c)) {
        ents.push({
          kind: c === 'h' || c === 'v' ? 'patrol' : c === 'c' ? 'hound' : c === 's' ? 'sleeper' : c === 'm' ? 'mimic' : c === 'r' ? 'mirror' : 'turret',
          x, y,
          dir: c === 'h' ? 1 : c === 'v' ? 1 : 0,
          axis: c === 'h' ? 'h' : c === 'v' ? 'v' : null,
          awake: c !== 's'
        });
        c = '.';
      } else if (c === 'B') {
        ents.push({ kind: 'boulder', x, y, awake: true });
        c = '.';
      }
      line.push(c);
    }
    tiles.push(line);
  }
  return { def, w, h, tiles, ents, px, py, par: def.par || 0 };
}

function newState(room) {
  return {
    px: room.px, py: room.py,
    ents: room.ents.map(e => ({ ...e })),
    tiles: room.tiles.map(r => r.slice()),
    keys: 0,
    turn: 0,
    dead: false, deadBy: '',
    won: false,
    ev: []               // events for the renderer, cleared each step
  };
}

function tileAt(st, x, y) {
  if (y < 0 || y >= st.tiles.length || x < 0 || x >= st.tiles[0].length) return '#';
  return st.tiles[y][x];
}

function entAt(st, x, y, skip) {
  for (const e of st.ents) {
    if (e === skip || e.deadE) continue;
    if (e.x === x && e.y === y) return e;
  }
  return null;
}

function blocksEnemy(st, x, y, self) {
  const t = tileAt(st, x, y);
  if (t === '#' || t === 'D') return true;
  const o = entAt(st, x, y, self);
  if (o && o.kind !== 'boulder') return true;   // enemies never stack
  if (o && o.kind === 'boulder') return true;   // or shove boulders
  return false;
}

// what happens when an enemy enters a tile
function enemyEnter(st, e, x, y) {
  const t = tileAt(st, x, y);
  e.x = x; e.y = y;
  if (t === '^' || t === 'O' || t === '+') {
    e.deadE = true;
    st.ev.push({ t: 'entDie', x, y, kind: e.kind });
    if (t === '+') { st.tiles[y][x] = '^'; st.ev.push({ t: 'rune', x, y }); }
  }
  if (!e.deadE && x === st.px && y === st.py) {
    st.dead = true; st.deadBy = e.kind;
  }
}

function tryPushBoulder(st, b, dx, dy) {
  const nx = b.x + dx, ny = b.y + dy;
  const t = tileAt(st, nx, ny);
  if (t === '#' || t === 'D') return false;
  const o = entAt(st, nx, ny, b);
  if (o && o.kind === 'boulder') return false;
  if (o) {
    // crunch. satisfying.
    o.deadE = true;
    st.ev.push({ t: 'crush', x: nx, y: ny, kind: o.kind });
  }
  b.x = nx; b.y = ny;
  st.ev.push({ t: 'push', x: nx, y: ny });
  if (t === 'O') {
    // boulder fills the pit: both become plain floor
    b.deadE = true;
    st.tiles[ny][nx] = '.';
    st.ev.push({ t: 'fill', x: nx, y: ny });
  } else if (t === '~') {
    // boulders skid on ice
    let cx = nx, cy = ny;
    while (tileAt(st, cx + dx, cy + dy) === '~' && !entAt(st, cx + dx, cy + dy, b)) { cx += dx; cy += dy; }
    // may slide off the ice onto one more regular tile
    const ox = cx + dx, oy = cy + dy;
    const ot = tileAt(st, ox, oy);
    if (ot !== '#' && ot !== 'D' && !entAt(st, ox, oy, b) && tileAt(st, cx, cy) === '~') {
      cx = ox; cy = oy;
      if (ot === 'O') { b.deadE = true; st.tiles[oy][ox] = '.'; st.ev.push({ t: 'fill', x: ox, y: oy }); }
    }
    b.x = cx; b.y = cy;
  }
  return true;
}

// player tries to enter a cell; returns false if blocked
function playerEnter(st, x, y, dx, dy) {
  const t = tileAt(st, x, y);
  if (t === '#') return false;
  if (t === 'D') {
    if (st.keys > 0) {
      st.keys--;
      st.tiles[y][x] = '.';
      st.ev.push({ t: 'unlock', x, y });
      return true;      // door opens, player steps in
    }
    return false;
  }
  const o = entAt(st, x, y);
  if (o && o.kind === 'boulder') {
    if (!tryPushBoulder(st, o, dx, dy)) return false;
  } else if (o) {
    // walking into a monster is a choice
    st.dead = true; st.deadBy = o.kind;
  }
  return true;
}

// effects of the player standing on a tile after moving into it
function playerLand(st) {
  const t = tileAt(st, st.px, st.py);
  if (t === '^') { st.dead = true; st.deadBy = 'spikes'; }
  else if (t === 'O') { st.dead = true; st.deadBy = 'pit'; }
  else if (t === '+') {
    st.tiles[st.py][st.px] = '^';
    st.ev.push({ t: 'rune', x: st.px, y: st.py });
    st.dead = true; st.deadBy = 'rune';
  }
  else if (t === 'K') { st.keys++; st.tiles[st.py][st.px] = '.'; st.ev.push({ t: 'key' }); }
  else if (t === 'E') { st.won = true; }
  else if (t === 'F') { st.dead = true; st.deadBy = 'fakeexit'; st.ev.push({ t: 'fake', x: st.px, y: st.py }); }
}

function step(room, st, move) {
  if (st.dead || st.won) return st;
  st.ev = [];
  const [dx, dy] = DIRS[move] || [0, 0];
  const fromX = st.px, fromY = st.py;
  const wasCrumble = tileAt(st, fromX, fromY) === '%';

  // ---- player ------------------------------------------------------------
  if (dx || dy) {
    if (playerEnter(st, st.px + dx, st.py + dy, dx, dy)) {
      st.px += dx; st.py += dy;
      playerLand(st);
      // ice: keep sliding until something stops you
      let guard = 0;
      while (!st.dead && !st.won && tileAt(st, st.px, st.py) === '~' && guard++ < 32) {
        const nx = st.px + dx, ny = st.py + dy;
        const t = tileAt(st, nx, ny);
        if (t === '#') break;
        if (t === 'D' && st.keys === 0) break;
        const o = entAt(st, nx, ny);
        if (o && o.kind === 'boulder') { if (!tryPushBoulder(st, o, dx, dy)) break; }
        else if (o) { st.dead = true; st.deadBy = o.kind; break; }
        if (t === 'D') { st.keys--; st.tiles[ny][nx] = '.'; }
        st.px = nx; st.py = ny;
        playerLand(st);
      }
    } else {
      st.ev.push({ t: 'bump' });
    }
  }

  // crumble the tile we left
  if (wasCrumble && (st.px !== fromX || st.py !== fromY)) {
    st.tiles[fromY][fromX] = 'O';
    st.ev.push({ t: 'crumble', x: fromX, y: fromY });
  }

  if (st.won) { st.turn++; return st; }

  // ---- the world answers --------------------------------------------------
  for (const e of st.ents) {
    if (e.deadE || st.dead) continue;
    if (e.kind === 'boulder' || e.kind === 'turret') continue;

    if (e.kind === 'sleeper' && !e.awake) {
      if (Math.abs(e.x - st.px) + Math.abs(e.y - st.py) <= 3) {
        e.awake = true;
        st.ev.push({ t: 'wake', x: e.x, y: e.y });
      }
      continue;
    }

    let mx = 0, my = 0;
    if (e.kind === 'hound' || e.kind === 'sleeper') {
      const ddx = st.px - e.x, ddy = st.py - e.y;
      const tryMoves = Math.abs(ddx) >= Math.abs(ddy)
        ? [[Math.sign(ddx), 0], [0, Math.sign(ddy)]]
        : [[0, Math.sign(ddy)], [Math.sign(ddx), 0]];
      for (const [tx, ty] of tryMoves) {
        if ((tx || ty) && !blocksEnemy(st, e.x + tx, e.y + ty, e)) { mx = tx; my = ty; break; }
      }
    } else if (e.kind === 'mimic') {
      mx = dx; my = dy;
      if ((mx || my) && blocksEnemy(st, e.x + mx, e.y + my, e)) { mx = 0; my = 0; }
    } else if (e.kind === 'mirror') {
      mx = -dx; my = -dy;
      if ((mx || my) && blocksEnemy(st, e.x + mx, e.y + my, e)) { mx = 0; my = 0; }
    } else if (e.kind === 'patrol') {
      const [ax, ay] = e.axis === 'h' ? [1, 0] : [0, 1];
      let tx = ax * e.dir, ty = ay * e.dir;
      if (blocksEnemy(st, e.x + tx, e.y + ty, e)) { e.dir = -e.dir; tx = -tx; ty = -ty; }
      if (!blocksEnemy(st, e.x + tx, e.y + ty, e)) { mx = tx; my = ty; }
    }

    if (mx || my) enemyEnter(st, e, e.x + mx, e.y + my);
    else if (e.x === st.px && e.y === st.py && !e.deadE) {
      st.dead = true; st.deadBy = e.kind;
    }
  }

  // ---- turrets fire on their cycle ----------------------------------------
  st.turn++;
  const phase = st.turn % TURRET_PERIOD;
  for (const e of st.ents) {
    if (e.deadE || e.kind !== 'turret') continue;
    if (phase === TURRET_PERIOD - 2) st.ev.push({ t: 'charge', x: e.x, y: e.y });
    if (phase === TURRET_PERIOD - 1) {
      st.ev.push({ t: 'fire', x: e.x, y: e.y });
      for (const [bx, by] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        let cx = e.x + bx, cy = e.y + by;
        while (true) {
          const t = tileAt(st, cx, cy);
          if (t === '#' || t === 'D') break;
          const o = entAt(st, cx, cy);
          if (o && o.kind === 'boulder') break;          // boulders are cover
          if (o && o.kind !== 'turret') {
            o.deadE = true;
            st.ev.push({ t: 'entDie', x: cx, y: cy, kind: o.kind });
          }
          if (cx === st.px && cy === st.py) { st.dead = true; st.deadBy = 'beam'; }
          cx += bx; cy += by;
        }
      }
    }
  }

  return st;
}

// beam paths for the renderer (which cells a turret covers right now)
function beamCells(st, e) {
  const cells = [];
  for (const [bx, by] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let cx = e.x + bx, cy = e.y + by;
    while (true) {
      const t = tileAt(st, cx, cy);
      if (t === '#' || t === 'D') break;
      const o = entAt(st, cx, cy);
      if (o && o.kind === 'boulder') break;
      cells.push([cx, cy]);
      cx += bx; cy += by;
    }
  }
  return cells;
}

const Sim = { DIRS, TURRET_PERIOD, parseRoom, newState, step, tileAt, entAt, beamCells };
if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
else root.Sim = Sim;

})(typeof window !== 'undefined' ? window : globalThis);
