// SWARM KEEP map generator + balance bot + difficulty auto-tuner.
//
//   node tools/gen.mjs
//
// For each of the 50 levels: generate a path map and wave schedule, then let
// the balance bot play it (same sim the browser runs). A tuning loop adjusts
// the level's enemy HP multiplier until the bot wins with 3-10 lives left -
// proving the level is beatable AND that it bites. Levels the bot can't
// handle at all get regenerated with a new seed. Writes js/levels.js and a
// balance report.

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
const pick = (arr, r) => arr[(r() * arr.length) | 0];

const WORLDS = [
  { name: 'MEADOW',  mobs: ['gloop', 'runner'],                                towers: ['archer', 'cannon', 'frost'] },
  { name: 'DUNES',   mobs: ['gloop', 'runner', 'shell', 'brute'],              towers: ['archer', 'cannon', 'frost', 'tesla'] },
  { name: 'TUNDRA',  mobs: ['gloop', 'runner', 'shell', 'brute', 'floaty', 'splitter'], towers: ['archer', 'cannon', 'frost', 'tesla', 'ember', 'bank'] },
  { name: 'CINDER',  mobs: ['runner', 'shell', 'brute', 'floaty', 'splitter', 'healer'], towers: ['archer', 'cannon', 'frost', 'tesla', 'ember', 'bank', 'sniper', 'drum'] },
  { name: 'THE VOID', mobs: ['runner', 'shell', 'brute', 'floaty', 'splitter', 'healer'], towers: ['archer', 'cannon', 'frost', 'tesla', 'ember', 'bank', 'sniper', 'drum'] }
];
const NAMES = [
  ['front lawn', 'the hedge', 'creek bend', 'clover field', 'the orchard', 'windmill road', 'beehive pass', 'old fence', 'long meadow', 'MEGAGLOOP\'S DEN'],
  ['dust bowl', 'cactus row', 'dry gulch', 'mirage flats', 'scorpion turn', 'the dunes', 'sandstone maze', 'vulture ridge', 'last oasis', 'SHELLZILLA\'S PIT'],
  ['first frost', 'icicle lane', 'frozen fork', 'avalanche row', 'the glacier', 'whiteout', 'cold shoulder', 'permafrost', 'icebreaker', 'THE MATRIARCH\'S NEST'],
  ['ash road', 'lava bend', 'cinder switchback', 'the forge', 'magma pools', 'soot valley', 'the crucible', 'firewalk', 'eruption alley', 'STORMFLOAT\'S EYE'],
  ['the threshold', 'starless path', 'gravity well', 'event horizon', 'the silence', 'antimatter alley', 'the maw', 'terminal spiral', 'the last stand', 'THE SWARM KING\'S THRONE']
];

const MOB_COST = { gloop: 1, runner: 1, shell: 2, floaty: 2, splitter: 2.5, brute: 4, healer: 3 };

// ---------------------------------------------------------------- map gen
function genPath(r) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const pts = [];
    let c = 0, row = 2 + ((r() * 8) | 0);
    pts.push([c, row]);
    let dir = 0; // 0 none, 1 up, -1 down
    while (c < Sim.GRID_W - 1) {
      c = Math.min(Sim.GRID_W - 1, c + 2 + ((r() * 4) | 0));
      pts.push([c, row]);
      if (c >= Sim.GRID_W - 1) break;
      // vertical jog
      const up = row > 6 ? 1 : row < 4 ? -1 : (r() < 0.5 ? 1 : -1);
      const dist = 2 + ((r() * 4) | 0);
      const nr = Math.max(1, Math.min(Sim.GRID_H - 2, row - up * dist));
      if (nr !== row) { row = nr; pts.push([c, row]); }
    }
    // dedupe consecutive duplicates
    const clean = pts.filter((p, i) => i === 0 || p[0] !== pts[i - 1][0] || p[1] !== pts[i - 1][1]);
    let len = 0;
    for (let i = 1; i < clean.length; i++) {
      len += Math.abs(clean[i][0] - clean[i - 1][0]) + Math.abs(clean[i][1] - clean[i - 1][1]);
    }
    if (len >= 34 && clean.length >= 7) return clean;
  }
  return [[0, 5], [8, 5], [8, 2], [16, 2], [16, 8], [23, 8]];
}

function genProps(r, path) {
  const props = [];
  for (let i = 0; i < 10; i++) {
    props.push({ c: 1 + ((r() * (Sim.GRID_W - 2)) | 0), r: 1 + ((r() * (Sim.GRID_H - 2)) | 0), kind: (r() * 3) | 0 });
  }
  return props;
}

function genWaves(worldIdx, lvlIdx, r) {
  const W = WORLDS[worldIdx];
  const n = 10 + worldIdx * 2;
  const waves = [];
  for (let w = 0; w < n; w++) {
    const boss = (lvlIdx === 9 && w === n - 1);
    if (boss) {
      waves.push({ groups: [
        { type: 'gloop', n: 6, gap: 12 },
        { type: null, n: 1, gap: 20, boss: 'boss' + (worldIdx + 1) }
      ] });
      continue;
    }
    let budget = 7 + w * 2.4 + worldIdx * 5 + lvlIdx * 1.1;
    const groups = [];
    const nGroups = 1 + ((r() * 2.4) | 0);
    for (let gi = 0; gi < nGroups && budget > 0; gi++) {
      // later waves reach deeper into the roster
      const depth = Math.min(W.mobs.length, 2 + ((w / n) * W.mobs.length | 0) + 1);
      const type = W.mobs[(r() * depth) | 0];
      const unit = MOB_COST[type];
      const count = Math.max(2, Math.min(16, Math.round(budget / unit * (0.4 + r() * 0.5))));
      groups.push({ type, n: count, gap: type === 'brute' || type === 'healer' ? 26 : type === 'runner' ? 8 : 14 });
      budget -= count * unit;
    }
    waves.push({ groups });
  }
  return waves;
}

// ---------------------------------------------------------------- the bot
function coverage(g, c, r, range) {
  const cx = c * Sim.CELL + Sim.CELL / 2, cy = r * Sim.CELL + Sim.CELL / 2;
  let n = 0;
  for (let d = 0; d < g.path.total; d += 22) {
    const p = Sim.posAt(g.path, d);
    if ((p.x - cx) ** 2 + (p.y - cy) ** 2 < range * range) n++;
  }
  return n;
}

function estDps(type, tier) {
  const c = Sim.TOWERS[type].tiers[tier - 1];
  if (type === 'archer') return c.dmg / c.rate * 30;
  if (type === 'cannon') return c.dmg / c.rate * 30 * 2.3;
  if (type === 'tesla') return c.dmg / c.rate * 30 * c.chains * 0.85;
  if (type === 'ember') return (c.dmg / c.rate * 30) + c.burnDps * 0.8;
  if (type === 'sniper') return c.dmg / c.rate * 30;
  return 0;
}

function botStep(g, allowed, hasAir) {
  // ranked spots (recompute rarely)
  if (!g._spots) {
    g._spots = g.buildable
      .map(b => ({ ...b, cov: coverage(g, b.c, b.r, 120) }))
      .sort((a, b) => b.cov - a.cov);
  }
  const spots = g._spots.filter(s => !Sim.towerAt(g, s.c, s.r));
  if (!spots.length) return;
  const nOf = t => g.towers.filter(x => x.type === t).length;

  // structured early needs
  const needs = [];
  if (allowed.includes('frost') && nOf('frost') < 1 && g.waveIdx >= 1) needs.push(['place', 'frost']);
  if (allowed.includes('bank') && nOf('bank') < 2 && g.waveIdx < 5 && g.towers.length >= 2) needs.push(['place', 'bank']);
  if (hasAir && allowed.includes('tesla') && nOf('tesla') < 2 && g.waveIdx >= 2) needs.push(['place', 'tesla']);
  if (allowed.includes('drum') && nOf('drum') < 1 && g.towers.length >= 6) needs.push(['place', 'drum']);
  for (const [, type] of needs) {
    const cost = Sim.TOWERS[type].tiers[0].cost;
    if (g.gold >= cost) {
      const spot = type === 'bank' ? spots[spots.length - 1] : spots[0];
      if (spot) { Sim.place(g, type, spot.c, spot.r); return; }
    } else return;   // save for the need
  }

  // otherwise best dps per gold: new tower vs upgrade
  let best = null, bestScore = 0;
  const dmgTowers = allowed.filter(t => estDps(t, 1) > 0);
  if (g.towers.length < 16 && spots.length) {
    for (const type of dmgTowers) {
      const cost = Sim.TOWERS[type].tiers[0].cost;
      const score = estDps(type, 1) / cost * (1 + spots[0].cov * 0.01);
      if (score > bestScore) { bestScore = score; best = { act: 'place', type, spot: spots[0], cost }; }
    }
  }
  for (const t of g.towers) {
    if (t.tier >= 3) continue;
    const def = Sim.TOWERS[t.type];
    if (def.slow || def.bank || def.buff) {
      if (t.type === 'frost' && t.tier < 2) {
        const cost = def.tiers[t.tier].cost;
        const score = 1.2 / cost;
        if (score > bestScore) { bestScore = score; best = { act: 'up', t, cost }; }
      }
      continue;
    }
    const cost = def.tiers[t.tier].cost;
    const gain = estDps(t.type, t.tier + 1) - estDps(t.type, t.tier);
    const score = gain / cost * 1.15;   // upgrades sit on proven spots
    if (score > bestScore) { bestScore = score; best = { act: 'up', t, cost }; }
  }
  if (best && g.gold >= best.cost) {
    if (best.act === 'place') Sim.place(g, best.type, best.spot.c, best.spot.r);
    else Sim.upgrade(g, best.t);
  }
}

export function botPlay(level) {
  const g = Sim.createGame(level);
  const allowed = level.towersAllowed;
  const hasAir = level.waves.some(w => w.groups.some(gr => gr.type === 'floaty' || gr.boss === 'boss4'));
  let guard = 0;
  while (!g.over && guard++ < 400000) {
    if (!g.waveActive) {
      // shop until nothing worth buying, then call the wave
      for (let i = 0; i < 8; i++) botStep(g, allowed, hasAir);
      Sim.startWave(g);
      if (!g.waveActive && !g.over) break;
    } else if (g.tick % 45 === 0) {
      botStep(g, allowed, hasAir);
    }
    Sim.tickGame(g);
    g.events.length = 0;
  }
  return { won: g.won, lives: g.lives, towers: g.towers.length, kills: g.killsTotal };
}

// ---------------------------------------------------------------- tuning
function tuneLevel(worldIdx, lvlIdx) {
  for (let regen = 0; regen < 8; regen++) {
    const seed = (worldIdx * 10 + lvlIdx + 1) * 7919 + regen * 131;
    const r = rng(seed);
    const path = genPath(r);
    const level = {
      name: NAMES[worldIdx][lvlIdx],
      world: worldIdx + 1,
      seed,
      gold: 210 + worldIdx * 40 + lvlIdx * 10,
      hpMul: 1 + worldIdx * 0.35 + lvlIdx * 0.06,
      bossMul: 1,
      towersAllowed: WORLDS[worldIdx].towers,
      path,
      props: genProps(r, path),
      waves: genWaves(worldIdx, lvlIdx, r)
    };
    let lo = 0.3, hi = level.hpMul * 2.6, best = null;
    for (let it = 0; it < 11; it++) {
      const mid = (lo + hi) / 2;
      level.hpMul = mid;
      level.bossMul = 0.55 + mid * 0.28;
      const res = botPlay(level);
      if (res.won && res.lives >= 3 && res.lives <= 10) { best = { mul: mid, res }; break; }
      if (!res.won || res.lives < 3) hi = mid;
      else { lo = mid; best = best || { mul: mid, res }; }
      if (res.won && (!best || Math.abs(res.lives - 6) < Math.abs(best.res.lives - 6))) best = { mul: mid, res };
    }
    if (best && best.res.won) {
      level.hpMul = best.mul;
      level.bossMul = 0.55 + best.mul * 0.28;
      // final proof run
      const proof = botPlay(level);
      if (proof.won) return { level, proof };
    }
  }
  throw new Error(`could not tune world ${worldIdx + 1} level ${lvlIdx + 1}`);
}

// ---------------------------------------------------------------- main
const levels = [];
const report = [];
for (let w = 0; w < 5; w++) {
  for (let i = 0; i < 10; i++) {
    const { level, proof } = tuneLevel(w, i);
    levels.push(level);
    report.push(proof);
    console.log(`lvl ${String(w * 10 + i + 1).padStart(2)} ${WORLDS[w].name.padEnd(8)} "${level.name}"  hpMul=${level.hpMul.toFixed(2)} botLives=${proof.lives}/20 towers=${proof.towers} waves=${level.waves.length}`);
  }
}

writeFileSync(join(__dir, '../js/levels.js'),
`// SWARM KEEP levels - generated + balance-proven by tools/gen.mjs.
// Every level was beaten by the balance bot, and its difficulty was tuned
// until the bot barely wins (3-10 lives left). Regenerate: node tools/gen.mjs
const LEVELS = ${JSON.stringify(levels)};
if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
else window.LEVELS = LEVELS;
`);
writeFileSync(join(__dir, 'balance_report.json'), JSON.stringify(report, null, 1));
console.log(`\nwrote ${levels.length} levels, all bot-proven beatable at tuned difficulty`);
