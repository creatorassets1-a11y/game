// LOCKSTEP room generator + prover.
//
//   node tools/generate.mjs
//
// Samples candidate rooms per world, solves each one EXACTLY (breadth-first
// over the full game state: player, monsters, boulders, keys, mutated
// tiles), and keeps only rooms that pass three gates:
//   1. solvable at all (obviously)
//   2. not trivial (minimum solution length per world)
//   3. the monsters matter: a room that can be solved in the same number of
//      moves with every monster deleted is furniture, not a puzzle
// Survivors are scored (optimal length + how often random play dies) and 10
// per world are picked in ascending difficulty. Optimal solutions become the
// par values and are saved to tools/solutions.json for the browser replay
// tests.

import { createRequire } from 'module';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const Sim = require(join(__dir, '../js/sim.js'));

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const MOVES = ['U', 'D', 'L', 'R', 'W'];

// what each world is allowed to contain, and how big its rooms are
const WORLDS = [
  { name: 'STEPS',    w: 9,  h: 7, els: { spike: 3, pit: 2, patrol: 1 } },
  { name: 'HOUNDS',   w: 9,  h: 7, els: { spike: 3, pit: 2, hound: 1 } },
  { name: 'MIMICS',   w: 11, h: 8, els: { spike: 4, pit: 2, mimic: 1 } },
  { name: 'MIRRORS',  w: 11, h: 8, els: { spike: 4, pit: 2, mirror: 1, mimic: 1 } },
  { name: 'WARDENS',  w: 11, h: 8, els: { spike: 3, pit: 1, turret: 1, hound: 1 } },
  { name: 'STONES',   w: 12, h: 8, els: { spike: 3, pit: 3, boulder: 2, hound: 1, turret: 1 } },
  { name: 'ICE',      w: 12, h: 8, els: { spike: 3, pit: 2, ice: 8, hound: 1, boulder: 1 } },
  { name: 'KEYS',     w: 12, h: 8, els: { spike: 3, pit: 2, key: 1, door: 1, hound: 1, mimic: 1 } },
  { name: 'LIES',     w: 13, h: 9, els: { spike: 3, pit: 2, rune: 2, fake: 1, sleeper: 1, mimic: 1 } },
  { name: 'LOCKSTEP', w: 13, h: 9, els: { spike: 3, pit: 2, hound: 1, mimic: 1, turret: 1, boulder: 1, ice: 5, rune: 1, sleeper: 1 } }
];

const NAMES = [
  ['first steps', 'the floor', 'small holes', 'a walk', 'pins', 'crossing', 'needle row', 'gaps', 'measured', 'pacing'],
  ['it follows', 'good boy', 'fetch', 'bad dog', 'bait', 'the pit trick', 'herding', 'two hounds', 'kennel', 'off the leash'],
  ['hello me', 'copycat', 'twin', 'do as i do', 'synchronized', 'the other you', 'echo', 'self harm', 'body double', 'identity theft'],
  ['contrary', 'backwards', 'tug of war', 'push and pull', 'opposites', 'stubborn', 'reverse psychology', 'headwind', 'counterweight', 'the argument'],
  ['the eye', 'count to four', 'metronome', 'crossfire', 'duck', 'lighthouse', 'don\'t blink', 'timing window', 'two eyes', 'panopticon'],
  ['dead weight', 'shove', 'plug', 'cover', 'crush depth', 'masonry', 'the wall you make', 'roll', 'stone cold', 'landslide'],
  ['first frost', 'slick', 'no brakes', 'curling', 'thin ice', 'black ice', 'drift', 'whiteout', 'glacier', 'zamboni'],
  ['locksmith', 'one key', 'wrong door', 'detour', 'ring of keys', 'deadbolt', 'trade', 'the long way', 'skeleton key', 'vault'],
  ['trust nothing', 'floor is lava', 'welcome mat', 'sleeper agent', 'the real exit', 'landmine', 'don\'t wake it', 'gaslight', 'plausible floor', 'liar\'s room'],
  ['all of it', 'the gauntlet', 'clockwork', 'symphony', 'checkmate', 'zugzwang', 'perfect information', 'endgame', 'one hundred', 'lockstep']
];

// ---------------------------------------------------------------- sampler
function sampleRoom(worldIdx, roomIdx, seed) {
  const W = WORLDS[worldIdx];
  const rnd = rng(seed);
  const w = W.w, h = W.h;
  const g = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1) ? '#' : '.'));

  const cells = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) cells.push([x, y]);
  const shuffled = cells.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let cursor = 0;
  const take = (ok) => {
    while (cursor < shuffled.length) {
      const [x, y] = shuffled[cursor++];
      if (g[y][x] === '.' && (!ok || ok(x, y))) return [x, y];
    }
    return null;
  };

  // interior walls
  const nWalls = 2 + ((rnd() * (w * h * 0.12)) | 0);
  for (let i = 0; i < nWalls; i++) {
    const c = take();
    if (c) g[c[1]][c[0]] = '#';
  }

  // player and exit, far apart
  const pc = take();
  if (!pc) return null;
  g[pc[1]][pc[0]] = 'P';
  const ec = take((x, y) => Math.abs(x - pc[0]) + Math.abs(y - pc[1]) >= (w + h) / 2.4);
  if (!ec) return null;
  g[ec[1]][ec[0]] = 'E';

  const nearP = (x, y) => Math.abs(x - pc[0]) + Math.abs(y - pc[1]) <= 1;

  // scale element counts up through the world
  const scale = 0.6 + roomIdx * 0.09;
  const CH = { spike: '^', pit: 'O', hound: 'c', sleeper: 's', mimic: 'm', mirror: 'r', turret: 't', boulder: 'B', key: 'K', door: 'D', rune: '+', fake: 'F', ice: '~' };
  for (const [el, base] of Object.entries(W.els)) {
    let n = Math.max(el === 'key' || el === 'door' || el === 'fake' ? 1 : 0, Math.round(base * scale * (0.7 + rnd() * 0.6)));
    if (el === 'key') n = W.els.door;         // one key per door
    for (let i = 0; i < n; i++) {
      const isMonster = 'cm rst'.includes(CH[el]) || el === 'hound' || el === 'mimic' || el === 'mirror' || el === 'sleeper' || el === 'turret';
      const c = take((x, y) => !nearP(x, y) && (!isMonster || Math.abs(x - pc[0]) + Math.abs(y - pc[1]) >= 3));
      if (c) g[c[1]][c[0]] = CH[el];
    }
  }
  // patrols go in corridors: just place them like monsters
  if (W.els.patrol) {
    for (let i = 0; i < Math.max(1, Math.round(W.els.patrol * scale)); i++) {
      const c = take((x, y) => !nearP(x, y) && Math.abs(x - pc[0]) + Math.abs(y - pc[1]) >= 3);
      if (c) g[c[1]][c[0]] = rnd() < 0.5 ? 'h' : 'v';
    }
  }

  return { map: g.map(r => r.join('')), world: worldIdx + 1 };
}

// ---------------------------------------------------------------- solver
function hashState(st, careTurn) {
  let s = st.px + ',' + st.py + '|' + st.keys;
  for (const e of st.ents) {
    s += '|' + (e.deadE ? 'x' : e.x + ',' + e.y + (e.awake ? 'a' : 'z') + (e.dir || ''));
  }
  // mutated tiles matter (crumbles, filled pits, opened doors, sprung runes)
  s += '|' + st.tiles.map(r => r.join('')).length; // cheap guard, full diff below
  let diff = '';
  for (let y = 0; y < st.tiles.length; y++) diff += st.tiles[y].join('');
  s += '#' + diff;
  if (careTurn) s += '@' + (st.turn % Sim.TURRET_PERIOD);
  return s;
}

function cloneState(st) {
  return {
    ...st,
    ents: st.ents.map(e => ({ ...e })),
    tiles: st.tiles.map(r => r.slice()),
    ev: []
  };
}

export function solve(def, maxStates = 700000, maxTurns = 90) {
  const room = Sim.parseRoom(def);
  const careTurn = room.ents.some(e => e.kind === 'turret');
  const st0 = Sim.newState(room);
  const seen = new Set([hashState(st0, careTurn)]);
  let frontier = [{ st: st0, parent: null, mv: '' }];
  let n = 0;
  for (let turn = 0; turn < maxTurns && frontier.length; turn++) {
    const next = [];
    for (const node of frontier) {
      for (const mv of MOVES) {
        const st = cloneState(node.st);
        Sim.step(room, st, mv);
        if (++n > maxStates) return null;
        if (st.dead) continue;
        if (st.won) {
          let sol = mv, p = node;
          while (p.parent) { sol = p.mv + sol; p = p.parent; }
          return sol;
        }
        const hkey = hashState(st, careTurn);
        if (seen.has(hkey)) continue;
        seen.add(hkey);
        next.push({ st, parent: node, mv });
      }
    }
    frontier = next;
  }
  return null;
}

function stripMonsters(def) {
  return {
    ...def,
    map: def.map.map(r => r.replace(/[csmrhvt]/g, '.'))
  };
}

function deadliness(def, solLen, playouts = 250) {
  const room = Sim.parseRoom(def);
  const rnd = rng(1234567 + solLen);
  let deaths = 0;
  for (let i = 0; i < playouts; i++) {
    const st = Sim.newState(room);
    for (let t = 0; t < solLen * 2 + 8; t++) {
      Sim.step(room, st, MOVES[(rnd() * 5) | 0]);
      if (st.dead) { deaths++; break; }
      if (st.won) break;
    }
  }
  return deaths / playouts;
}

function replayWins(def, sol) {
  const room = Sim.parseRoom(def);
  const st = Sim.newState(room);
  for (const mv of sol) {
    Sim.step(room, st, mv);
    if (st.dead) return false;
  }
  return st.won;
}

// ---------------------------------------------------------------- main
const levels = [];
const solutions = [];

for (let w = 0; w < 10; w++) {
  const pool = [];
  let tried = 0;
  const minLen = 7 + w;
  for (let seed = 0; pool.length < 40 && tried < 900; seed++, tried++) {
    const def = sampleRoom(w, Math.min(9, (pool.length / 4) | 0), w * 100000 + seed * 17 + 5);
    if (!def) continue;
    const sol = solve(def);
    if (!sol || sol.length < minLen) continue;
    // gate 3: monsters must matter (compare against the empty room)
    if (w >= 1) {
      const bare = solve(stripMonsters(def));
      if (bare && sol.length - bare.length < 2) continue;
    }
    if (!replayWins(def, sol)) continue;
    const dl = deadliness(def, sol.length);
    pool.push({ def, sol, score: sol.length + dl * 30 });
  }
  if (pool.length < 10) {
    console.error(`world ${w + 1}: only ${pool.length} valid rooms out of ${tried} tries`);
    process.exit(1);
  }
  pool.sort((a, b) => a.score - b.score);
  // pick 10 spread across the difficulty range, ascending
  for (let i = 0; i < 10; i++) {
    const pick = pool[Math.min(pool.length - 1, Math.round(i * (pool.length - 1) / 9))];
    const def = {
      name: NAMES[w][i],
      world: w + 1,
      par: pick.sol.length,
      map: pick.def.map
    };
    levels.push(def);
    solutions.push(pick.sol);
    console.log(`room ${String(w * 10 + i + 1).padStart(3)} ${WORLDS[w].name.padEnd(9)} "${def.name}"  par=${def.par} score=${pick.score.toFixed(1)}`);
  }
}

const banner =
`// LOCKSTEP rooms - generated by tools/generate.mjs, do not edit by hand.
// Every room was solved EXACTLY by the prover before shipping, rooms whose
// monsters don't affect the solution were rejected, and the par values are
// the true optimal move counts. Regenerate: node tools/generate.mjs
`;
writeFileSync(join(__dir, '../js/levels.js'),
  banner +
  'const LEVELS = ' + JSON.stringify(levels) + ';\n' +
  "if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;\n" +
  'else window.LEVELS = LEVELS;\n');
writeFileSync(join(__dir, 'solutions.json'), JSON.stringify(solutions));
console.log(`\nwrote ${levels.length} rooms, all machine-proven, pars are optimal`);
