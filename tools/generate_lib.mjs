// Shared pieces of the level generator: worlds, composer, solver.
// Used by generate.mjs (build) and debug_chapter.mjs (diagnosis).

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SEGMENTS, H } from './segments.mjs';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const Sim = require(join(__dir, '../js/sim.js'));



// deterministic rng
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const WORLDS = [
  { name: 'RUNNER',    verb: 'jump',  speed: 4.0, trolls: false, ceiling: false },
  { name: 'LIAR',      verb: 'jump',  speed: 4.3, trolls: true,  ceiling: false },
  { name: 'CEILING',   verb: 'flip',  speed: 4.2, trolls: false, ceiling: true },
  { name: 'TWO-FACED', verb: 'flip',  speed: 4.5, trolls: true,  ceiling: true },
  { name: 'GHOST',     verb: 'dash',  speed: 4.8, trolls: false, ceiling: false },
  { name: 'THRUST',    verb: 'float', speed: 4.2, trolls: false, ceiling: true },
  { name: 'PATIENCE',  verb: 'stop',  speed: 4.5, trolls: true,  ceiling: false },
  { name: 'DOUBLES',   verb: 'jump2', speed: 5.2, trolls: true,  ceiling: false },
  { name: 'BABEL',     verb: 'mix',   speed: 5.2, trolls: true,  ceiling: false },
  { name: 'HELL',      verb: 'mix',   speed: 5.8, trolls: true,  ceiling: false }
];

export const NAMES = [
  ['warmup', 'baby steps', 'stroll', 'hop in', 'first blood', 'pace', 'skip', 'stride', 'clean run', 'graduation'],
  ['trust me', 'nothing here', 'oops', 'liar liar', 'gotcha', 'fine print', 'red herring', 'bait', 'sike', 'fool me twice'],
  ['heads up', 'upside', 'ceiling fan', 'other side', 'vertigo', 'flip off', 'gravity bill', 'both floors', 'rotation', 'downside up'],
  ['two floors', 'double cross', 'mirror trap', 'faithless', 'turncoat', 'whiplash', 'ping pong', 'yo-yo', 'spin cycle', 'coin flip'],
  ['phase one', 'through it', 'ghosted', 'blink', 'clip', 'no-clip', 'walls are fake', 'passing through', 'untouchable', 'phantom mile'],
  ['liftoff', 'hover', 'cave in', 'stalactite', 'airborne', 'turbulence', 'low fuel', 'squeeze', 'updraft', 'terminal velocity'],
  ['red light', 'wait for it', 'patience', 'traffic', 'metronome', 'window', 'toll booth', 'timing belt', 'green light', 'now or never'],
  ['double up', 'twice shy', 'second wind', 'two-step', 'leapfrog', 'triple threat', 'long haul', 'airtime', 'encore', 'stunt double'],
  ['babel', 'polyglot', 'code switch', 'lost in translation', 'tongue twister', 'dialect', 'grammar', 'syntax error', 'fluent', 'rosetta'],
  ['knocking', 'doorstep', 'brimstone', 'inferno', 'ninth circle', 'no mercy', 'last words', 'point of no return', 'the wall', 'HUNDO']
];

export const PAD_CHAR = { jump: 'J', jump2: 'K', flip: 'F', dash: 'D', float: 'L', stop: 'P' };
export const MIX_VERBS = ['jump', 'flip', 'dash', 'jump2', 'stop'];

// reject chapters the solver can clear with too few taps - those are the
// "ride one lane the whole way" degenerates
export function minTaps(verb, nSegs) {
  if (verb === 'float') return 20;
  if (verb === 'flip') return 4;
  if (verb === 'stop') return 2;
  return Math.max(2, nSegs - 2);
}

export function flat(w, ceiling) {
  const rows = [];
  for (let y = 0; y < H; y++) {
    let c = '.';
    if (y >= 12) c = '#';
    else if (ceiling && y <= 1) c = '#';
    rows.push(c.repeat(w));
  }
  return rows;
}

export function hcat(a, b) {
  return a.map((row, i) => row + b[i]);
}

export function setChar(rows, x, y, c) {
  rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1);
}

export function pick(pool, rnd) { return pool[Math.floor(rnd() * pool.length)]; }

export function composeChapter(worldIdx, ci, seed, difficultyDrop) {
  const W = WORLDS[worldIdx];
  const rnd = rng(seed);
  const nSegs = Math.min(4 + Math.floor(ci / 2) + Math.floor(worldIdx / 4), 9);
  let maxTier = Math.min(4, 1 + Math.floor(ci / 3) + Math.floor(worldIdx / 3)) - difficultyDrop;
  maxTier = Math.max(0, maxTier);
  const minTier = Math.max(0, maxTier - 2);
  const speed = +(W.speed + ci * 0.08 - difficultyDrop * 0.15).toFixed(2);

  let rows = flat(6, W.ceiling);
  let curVerb = W.verb === 'mix' ? 'jump' : W.verb;
  const startVerb = curVerb;

  for (let s = 0; s < nSegs; s++) {
    // ramp tier across the chapter
    const tier = Math.min(maxTier, minTier + Math.floor((s / Math.max(1, nSegs - 1)) * (maxTier - minTier) + rnd() * 1.2));
    let verb = curVerb;
    if (W.verb === 'mix') verb = pick(MIX_VERBS, rnd);

    let pool = SEGMENTS.filter(sg =>
      (sg.verb === verb || sg.verb === 'any') &&
      sg.tier <= tier && sg.tier >= Math.max(0, tier - 1) &&
      (W.trolls || !sg.troll));
    if (!pool.length) pool = SEGMENTS.filter(sg => sg.verb === verb && sg.tier <= tier);
    if (!pool.length) pool = SEGMENTS.filter(sg => sg.verb === verb);
    const sg = pick(pool, rnd);

    // connector, with a verb pad if the verb changes
    const conn = flat(verb !== curVerb ? 5 : 3, W.ceiling && sg.ceiling);
    if (verb !== curVerb) setChar(conn, 2, 11, PAD_CHAR[verb]);
    curVerb = verb;

    rows = hcat(rows, conn);
    rows = hcat(rows, sg.build());
  }

  rows = hcat(rows, flat(8, false));
  return {
    name: NAMES[worldIdx][ci],
    world: worldIdx + 1,
    verb: startVerb,
    speed,
    segs: nSegs,
    map: rows
  };
}

// ---------------------------------------------------------------- solver
export function hashState(lv, st, withTime) {
  let h;
  if (st.verb === 'stop') {
    // stop doesn't use jump buffers, coyote time or dash state - fold those
    // out or the x-position/saw-phase cross product explodes the search
    h = (st.x / 4 | 0) + '|' + (st.y / 4 | 0) + '|' + (st.vy | 0) + '|' +
      st.grav + '|s|' + (st.grounded ? 1 : 0) + '|' + (st._held ? 1 : 0);
  } else {
    h = (st.x * 2 | 0) + '|' + (st.y * 2 | 0) + '|' + (st.vy * 2 | 0) + '|' +
      st.grav + '|' + st.verb + '|' + st.dashT + '|' + st.dashCd + '|' +
      (st.canAir ? 1 : 0) + (st.grounded ? 1 : 0) + '|' + st.coyote + '|' + st.buffer +
      '|' + (st._held ? 1 : 0);
  }
  if (withTime) h += '|' + (st.t % Sim.SAW_PERIOD);
  const ck = Object.keys(st.crumbled);
  if (ck.length) h += '|' + ck.join(',');
  return h;
}

export function cloneState(st) {
  const c = { ...st };
  c.crumbled = { ...st.crumbled };
  c.touched = { ...st.touched };
  c.usedPads = { ...st.usedPads };
  return c;
}

export function solve(def, maxNodes = 3000000) {
  // best-first by x-progress, complete BECAUSE there is no time cap:
  // a time-based prune poisons the dedup table (pruned wait-chains claim
  // hash slots that healthy paths then dedup against - this deadlocked the
  // stop-verb worlds). wait chains terminate naturally instead: after one
  // full saw period at a given spot every phase is a dedup hit.
  const lv = Sim.parseLevel(def);
  const hasMoving = lv.saws.some(s => s.move);
  const st0 = Sim.newState(lv);
  Sim.settle(lv, st0);

  const seen = new Set([hashState(lv, st0, hasMoving)]);
  const buckets = [];   // FIFO per bucket, so same-progress states explore in
  let hi = 0;           // time order and solutions stay near-minimal
  const push = (node) => {
    const b = Math.max(0, node.st.x / 16 | 0);
    (buckets[b] || (buckets[b] = { a: [], h: 0 })).a.push(node);
    if (b > hi) hi = b;
  };
  push({ st: st0, parent: null, bit: 0 });

  let nodes = 0;
  while (nodes < maxNodes) {
    let b = hi;
    while (b >= 0 && (!buckets[b] || buckets[b].h >= buckets[b].a.length)) b--;
    if (b < 0) return null;
    hi = b;
    const node = buckets[b].a[buckets[b].h++];
    for (const bit of [0, 1]) {
      const st = cloneState(node.st);
      Sim.step(lv, st, !!bit);
      nodes++;
      if (st.dead) continue;
      if (st.won) return traceBits(node, bit);
      const h = hashState(lv, st, hasMoving);
      if (seen.has(h)) continue;
      seen.add(h);
      push({ st, parent: node, bit });
    }
  }
  return null;
}

function traceBits(node, bit) {
  const bits = [bit];
  let n = node;
  while (n.parent) { bits.push(n.bit); n = n.parent; }
  bits.reverse();
  return bits;
}

export function replayWins(def, bits) {
  const lv = Sim.parseLevel(def);
  const st = Sim.newState(lv);
  Sim.settle(lv, st);
  for (let i = 0; i < bits.length; i++) {
    Sim.step(lv, st, !!bits[i]);
    if (st.dead) return false;
    if (st.won) return true;
  }
  return st.won;
}

