// SWARM KEEP - deterministic tower defense core.
// Same code runs the game in the browser and the balance bot in Node: every
// level ships only after the bot has beaten it, and every level's difficulty
// was auto-tuned against that bot. 30 logic ticks per second, all randomness
// through a seeded rng, so a given level plays out identically everywhere.

(function (root) {
'use strict';

const TPS = 30;
const CELL = 40;
const GRID_W = 24, GRID_H = 12;
const LIVES = 20;

// ---- towers -----------------------------------------------------------------
// three tiers each; cost is per-tier (buy = tier 1, then two upgrades)
const TOWERS = {
  archer: {
    name: 'Pea Archer', icon: '🏹', air: true,
    desc: 'cheap, quick, reliable',
    tiers: [
      { cost: 70,  dmg: 6,  rate: 18, range: 115 },
      { cost: 90,  dmg: 10, rate: 15, range: 130 },
      { cost: 160, dmg: 17, rate: 11, range: 150 }
    ]
  },
  cannon: {
    name: 'Boom Cannon', icon: '💣', air: false, splash: 55,
    desc: 'slow shells, big splash. ground only',
    tiers: [
      { cost: 160, dmg: 16, rate: 48, range: 125 },
      { cost: 190, dmg: 26, rate: 42, range: 140 },
      { cost: 330, dmg: 44, rate: 34, range: 155 }
    ]
  },
  frost: {
    name: 'Frost Prism', icon: '❄', air: true, slow: true,
    desc: 'chills everything near it. no damage',
    tiers: [
      { cost: 90,  slowPct: 0.32, range: 95 },
      { cost: 110, slowPct: 0.42, range: 115 },
      { cost: 200, slowPct: 0.52, range: 135 }
    ]
  },
  tesla: {
    name: 'Tesla Spire', icon: '⌁', air: true, chain: true,
    desc: 'lightning that jumps between monsters',
    tiers: [
      { cost: 200, dmg: 9,  rate: 26, range: 110, chains: 3 },
      { cost: 240, dmg: 13, rate: 22, range: 125, chains: 4 },
      { cost: 420, dmg: 19, rate: 17, range: 140, chains: 6 }
    ]
  },
  ember: {
    name: 'Ember Totem', icon: '🔥', air: false, burn: true,
    desc: 'sets monsters on fire. ground only',
    tiers: [
      { cost: 140, dmg: 4, rate: 24, range: 100, burnDps: 6,  burnT: 60 },
      { cost: 170, dmg: 6, rate: 20, range: 112, burnDps: 10, burnT: 75 },
      { cost: 300, dmg: 9, rate: 16, range: 126, burnDps: 16, burnT: 90 }
    ]
  },
  sniper: {
    name: 'Longshot', icon: '🎯', air: true, snipe: true,
    desc: 'whole-map range, hunts the biggest monster',
    tiers: [
      { cost: 240, dmg: 60,  rate: 75, range: 9999 },
      { cost: 300, dmg: 110, rate: 65, range: 9999 },
      { cost: 520, dmg: 200, rate: 52, range: 9999 }
    ]
  },
  bank: {
    name: 'Honey Bank', icon: '🍯', air: false, bank: true,
    desc: 'pays out gold when a wave ends',
    tiers: [
      { cost: 150, payout: 45 },
      { cost: 180, payout: 85 },
      { cost: 280, payout: 150 }
    ]
  },
  drum: {
    name: 'War Drum', icon: '🥁', air: false, buff: true,
    desc: 'nearby towers shoot faster',
    tiers: [
      { cost: 180, buffPct: 0.22, range: 105 },
      { cost: 220, buffPct: 0.32, range: 125 },
      { cost: 380, buffPct: 0.45, range: 145 }
    ]
  }
};

// ---- enemies -----------------------------------------------------------------
const ENEMIES = {
  gloop:   { hp: 34,  speed: 1.05, bounty: 4,  lives: 1, r: 15, col: '#7ed957', dark: '#3f9032' },
  runner:  { hp: 24,  speed: 1.9,  bounty: 4,  lives: 1, r: 12, col: '#ffd23f', dark: '#c99a17' },
  brute:   { hp: 190, speed: 0.62, bounty: 12, lives: 2, r: 24, col: '#ff6b6b', dark: '#b83b3b' },
  shell:   { hp: 80,  speed: 0.85, bounty: 8,  lives: 1, r: 17, col: '#8f9bb3', dark: '#5a647a', armor: 5 },
  floaty:  { hp: 46,  speed: 1.15, bounty: 7,  lives: 1, r: 14, col: '#c47aff', dark: '#8a48c9', air: true },
  healer:  { hp: 95,  speed: 0.8,  bounty: 11, lives: 1, r: 17, col: '#ff9ad5', dark: '#c9569a', heal: 14, healR: 90, healEvery: 50 },
  splitter:{ hp: 90,  speed: 0.8,  bounty: 9,  lives: 1, r: 19, col: '#5fd8e8', dark: '#2f98a8', splits: 'runner', splitN: 2 }
};

const BOSSES = [
  { id: 'boss1', name: 'MEGAGLOOP',    base: 'gloop',  hp: 1500,  speed: 0.5,  bounty: 120, lives: 5, r: 44 },
  { id: 'boss2', name: 'SHELLZILLA',   base: 'shell',  hp: 3600,  speed: 0.45, bounty: 170, lives: 5, r: 46, armor: 10 },
  { id: 'boss3', name: 'THE MATRIARCH',base: 'healer', hp: 6500,  speed: 0.5,  bounty: 230, lives: 5, r: 48, heal: 60, healR: 130, healEvery: 45 },
  { id: 'boss4', name: 'STORMFLOAT',   base: 'floaty', hp: 9000,  speed: 0.55, bounty: 300, lives: 5, r: 46, air: true },
  { id: 'boss5', name: 'THE SWARM KING', base: 'brute', hp: 16000, speed: 0.42, bounty: 500, lives: 10, r: 54, armor: 6 }
];

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- level geometry ------------------------------------------------------------
function buildPath(points) {
  // grid points -> pixel polyline with cumulative distances
  const px = points.map(([c, r]) => [c * CELL + CELL / 2, r * CELL + CELL / 2]);
  const segs = [];
  let total = 0;
  for (let i = 0; i < px.length - 1; i++) {
    const [x1, y1] = px[i], [x2, y2] = px[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    segs.push({ x1, y1, x2, y2, len, start: total });
    total += len;
  }
  return { px, segs, total };
}

function posAt(path, d) {
  if (d <= 0) { const s = path.segs[0]; return { x: s.x1, y: s.y1 }; }
  for (const s of path.segs) {
    if (d <= s.start + s.len) {
      const k = (d - s.start) / s.len;
      return { x: s.x1 + (s.x2 - s.x1) * k, y: s.y1 + (s.y2 - s.y1) * k };
    }
  }
  const s = path.segs[path.segs.length - 1];
  return { x: s.x2, y: s.y2 };
}

function buildableCells(path, props) {
  const cells = [];
  const blocked = new Set(props.map(p => p.c + ',' + p.r));
  for (let r = 0; r < GRID_H; r++) {
    for (let c = 0; c < GRID_W; c++) {
      const cx = c * CELL + CELL / 2, cy = r * CELL + CELL / 2;
      let ok = !blocked.has(c + ',' + r);
      if (ok) {
        for (const s of path.segs) {
          // distance from cell centre to segment
          const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
          const t = Math.max(0, Math.min(1, ((cx - s.x1) * dx + (cy - s.y1) * dy) / (s.len * s.len)));
          const px = s.x1 + dx * t, py = s.y1 + dy * t;
          if ((cx - px) * (cx - px) + (cy - py) * (cy - py) < 34 * 34) { ok = false; break; }
        }
      }
      if (ok) cells.push({ c, r });
    }
  }
  return cells;
}

// ---- game state ------------------------------------------------------------------
function createGame(level) {
  const path = buildPath(level.path);
  const g = {
    level, path,
    buildable: buildableCells(path, level.props || []),
    rng: mulberry32(level.seed || 1),
    gold: level.gold,
    lives: LIVES,
    tick: 0,
    waveIdx: -1,             // -1 = before first wave
    waveActive: false,
    spawnQueue: [],
    towers: [],
    mobs: [],
    shots: [],
    events: [],              // renderer drains these
    checkpoints: {},         // waveIdx -> snapshot (taken at waves 5,10,15 cleared)
    over: false, won: false,
    leaked: 0, killsTotal: 0
  };
  return g;
}

function towerAt(g, c, r) {
  return g.towers.find(t => t.c === c && t.r === r) || null;
}
function canBuild(g, c, r) {
  return !towerAt(g, c, r) && g.buildable.some(b => b.c === c && b.r === r);
}
function place(g, type, c, r) {
  const def = TOWERS[type];
  if (!def || !canBuild(g, c, r)) return false;
  const cost = def.tiers[0].cost;
  if (g.gold < cost) return false;
  g.gold -= cost;
  g.towers.push({ type, c, r, x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, tier: 1, cd: 0, spent: cost, kills: 0 });
  g.events.push({ t: 'place', c, r, type });
  return true;
}
function upgrade(g, tower) {
  const def = TOWERS[tower.type];
  if (tower.tier >= 3) return false;
  const cost = def.tiers[tower.tier].cost;
  if (g.gold < cost) return false;
  g.gold -= cost;
  tower.tier++;
  tower.spent += cost;
  g.events.push({ t: 'upgrade', c: tower.c, r: tower.r });
  return true;
}
function sell(g, tower) {
  const i = g.towers.indexOf(tower);
  if (i < 0) return false;
  g.gold += Math.floor(tower.spent * 0.7);
  g.towers.splice(i, 1);
  g.events.push({ t: 'sell', c: tower.c, r: tower.r });
  return true;
}

// ---- waves --------------------------------------------------------------------
function startWave(g) {
  if (g.waveActive || g.over) return false;
  g.waveIdx++;
  if (g.waveIdx >= g.level.waves.length) return false;
  const wave = g.level.waves[g.waveIdx];
  g.spawnQueue = [];
  let t = 0;
  for (const grp of wave.groups) {
    for (let i = 0; i < grp.n; i++) {
      g.spawnQueue.push({ at: t, type: grp.type, boss: grp.boss });
      t += grp.gap;
    }
    t += 18;
  }
  g.waveActive = true;
  g.events.push({ t: 'wave', n: g.waveIdx + 1 });
  return true;
}

function spawnMob(g, type, bossId) {
  let def, boss = null;
  if (bossId) {
    boss = BOSSES.find(b => b.id === bossId);
    def = { ...ENEMIES[boss.base], ...boss };
  } else def = ENEMIES[type];
  const hpMul = g.level.hpMul * (1 + g.waveIdx * 0.075);
  g.mobs.push({
    type: bossId || type,
    x: 0, y: 0, d: -g.rng() * 12,
    hp: def.hp * (bossId ? g.level.bossMul || 1 : hpMul),
    maxHp: def.hp * (bossId ? g.level.bossMul || 1 : hpMul),
    speed: def.speed, baseSpeed: def.speed,
    bounty: def.bounty, livesCost: def.lives,
    r: def.r, armor: def.armor || 0,
    air: !!def.air, heal: def.heal, healR: def.healR, healEvery: def.healEvery, healCd: 40,
    splits: def.splits, splitN: def.splitN,
    boss: !!bossId, name: boss && boss.name,
    burnDps: 0, burnT: 0, chill: 0, wob: g.rng() * 9
  });
}

// ---- damage -----------------------------------------------------------------------
function hurt(g, m, dmg, kind) {
  const eff = Math.max(1, dmg - (kind === 'burn' ? 0 : m.armor));
  m.hp -= eff;
  g.events.push({ t: 'hit', x: m.x, y: m.y, v: Math.round(eff), kind });
  if (m.hp <= 0 && !m.deadM) {
    m.deadM = true;
    g.gold += m.bounty;
    g.killsTotal++;
    g.events.push({ t: 'die', x: m.x, y: m.y, type: m.type, bounty: m.bounty, boss: m.boss });
    if (m.splits) {
      for (let i = 0; i < m.splitN; i++) {
        const c = ENEMIES[m.splits];
        g.mobs.push({
          type: m.splits, x: m.x, y: m.y, d: m.d - 6 - i * 8,
          hp: c.hp * g.level.hpMul, maxHp: c.hp * g.level.hpMul,
          speed: c.speed, baseSpeed: c.speed, bounty: c.bounty, livesCost: c.lives,
          r: c.r, armor: 0, air: false, burnDps: 0, burnT: 0, chill: 0, wob: g.rng() * 9
        });
      }
    }
  }
}

// ---- tick ------------------------------------------------------------------------
function tickGame(g) {
  if (g.over) return;
  g.tick++;

  // spawn
  if (g.waveActive) {
    for (let i = g.spawnQueue.length - 1; i >= 0; i--) {
      const s = g.spawnQueue[i];
      if (s.at-- <= 0) {
        spawnMob(g, s.type, s.boss);
        g.spawnQueue.splice(i, 1);
      }
    }
  }

  // mobs
  for (let i = g.mobs.length - 1; i >= 0; i--) {
    const m = g.mobs[i];
    if (m.deadM) { g.mobs.splice(i, 1); continue; }
    // chill decays, burn ticks
    if (m.chill > 0) m.chill--;
    if (m.burnT > 0) {
      m.burnT--;
      if (g.tick % 15 === 0) hurt(g, m, m.burnDps, 'burn');
      if (m.deadM) { g.mobs.splice(i, 1); continue; }
    }
    // healers pulse
    if (m.heal && --m.healCd <= 0) {
      m.healCd = m.healEvery;
      for (const o of g.mobs) {
        if (o === m || o.deadM) continue;
        if ((o.x - m.x) ** 2 + (o.y - m.y) ** 2 < m.healR * m.healR) {
          o.hp = Math.min(o.maxHp, o.hp + m.heal);
        }
      }
      g.events.push({ t: 'healpulse', x: m.x, y: m.y, r: m.healR });
    }
    const slow = m.chill > 0 ? m.slowPct || 0.35 : 0;
    m.d += m.baseSpeed * (1 - slow) * (CELL / 30) * 1.35;
    const p = posAt(g.path, m.d);
    m.x = p.x; m.y = p.y;
    if (m.d >= g.path.total) {
      g.lives -= m.livesCost;
      g.leaked++;
      g.mobs.splice(i, 1);
      g.events.push({ t: 'leak', lives: g.lives, big: m.boss });
      if (g.lives <= 0) {
        g.lives = 0;
        g.over = true;
        g.events.push({ t: 'defeat' });
        return;
      }
    }
  }

  // frost + drum auras (recomputed cheaply every 5 ticks)
  if (g.tick % 5 === 0) {
    for (const t of g.towers) {
      if (t.type !== 'frost') continue;
      const conf = TOWERS.frost.tiers[t.tier - 1];
      for (const m of g.mobs) {
        if ((m.x - t.x) ** 2 + (m.y - t.y) ** 2 < conf.range * conf.range) {
          m.chill = 8;
          m.slowPct = conf.slowPct;
        }
      }
    }
  }

  // towers fire
  for (const t of g.towers) {
    const def = TOWERS[t.type];
    if (def.slow || def.bank || def.buff) continue;
    const conf = def.tiers[t.tier - 1];
    let rate = conf.rate;
    // drums
    for (const d of g.towers) {
      if (d.type !== 'drum') continue;
      const dc = TOWERS.drum.tiers[d.tier - 1];
      if ((d.x - t.x) ** 2 + (d.y - t.y) ** 2 < dc.range * dc.range) {
        rate = Math.max(4, Math.round(rate * (1 - dc.buffPct)));
        break;
      }
    }
    if (--t.cd > 0) continue;

    // pick a target
    let target = null, bestD = def.snipe ? -1 : Infinity;
    for (const m of g.mobs) {
      if (m.deadM || m.d < 0) continue;
      if (m.air && !def.air) continue;
      const dd = (m.x - t.x) ** 2 + (m.y - t.y) ** 2;
      if (dd > conf.range * conf.range) continue;
      if (def.snipe) { if (m.hp > bestD) { bestD = m.hp; target = m; } }
      else if (g.path.total - m.d < bestD) { bestD = g.path.total - m.d; target = m; }
    }
    if (!target) continue;
    t.cd = rate;

    if (def.chain) {
      const conf2 = conf;
      let cur = target, hitSet = new Set();
      const pts = [{ x: t.x, y: t.y }];
      for (let c = 0; c < conf2.chains && cur; c++) {
        hitSet.add(cur);
        pts.push({ x: cur.x, y: cur.y });
        hurt(g, cur, conf2.dmg, 'zap');
        let nxt = null, nd = 120 * 120;
        for (const m of g.mobs) {
          if (m.deadM || hitSet.has(m) || m.d < 0) continue;
          const dd = (m.x - cur.x) ** 2 + (m.y - cur.y) ** 2;
          if (dd < nd) { nd = dd; nxt = m; }
        }
        cur = nxt;
      }
      g.events.push({ t: 'chain', pts });
    } else if (def.snipe) {
      hurt(g, target, conf.dmg, 'snipe');
      g.events.push({ t: 'snipe', x1: t.x, y1: t.y, x2: target.x, y2: target.y });
      t.kills += target.deadM ? 1 : 0;
    } else {
      // projectile
      g.shots.push({
        x: t.x, y: t.y - 12, target, dmg: conf.dmg,
        splash: def.splash || 0, burn: def.burn ? conf : null,
        spd: 9, kind: t.type
      });
      g.events.push({ t: 'shoot', x: t.x, y: t.y, kind: t.type });
    }
  }

  // projectiles
  for (let i = g.shots.length - 1; i >= 0; i--) {
    const s = g.shots[i];
    const m = s.target;
    if (!m || m.deadM) {
      // retarget nearest else fizzle
      let nt = null, nd = 90 * 90;
      for (const o of g.mobs) {
        if (o.deadM) continue;
        const dd = (o.x - s.x) ** 2 + (o.y - s.y) ** 2;
        if (dd < nd) { nd = dd; nt = o; }
      }
      if (!nt) { g.shots.splice(i, 1); continue; }
      s.target = nt;
      continue;
    }
    const dx = m.x - s.x, dy = m.y - s.y;
    const dd = Math.hypot(dx, dy);
    if (dd < 10 + m.r) {
      if (s.splash) {
        g.events.push({ t: 'boom', x: m.x, y: m.y, r: s.splash });
        for (const o of g.mobs) {
          if (o.deadM || o.air) continue;
          if ((o.x - m.x) ** 2 + (o.y - m.y) ** 2 < s.splash * s.splash) hurt(g, o, s.dmg, 'boom');
        }
      } else {
        hurt(g, m, s.dmg, s.kind);
        if (s.burn) { m.burnDps = s.burn.burnDps; m.burnT = s.burn.burnT; }
      }
      g.shots.splice(i, 1);
      continue;
    }
    s.x += dx / dd * s.spd;
    s.y += dy / dd * s.spd;
  }

  // wave cleared?
  if (g.waveActive && !g.spawnQueue.length && !g.mobs.length) {
    g.waveActive = false;
    // bank payouts
    for (const t of g.towers) {
      if (t.type !== 'bank') continue;
      const pay = TOWERS.bank.tiers[t.tier - 1].payout;
      g.gold += pay;
      g.events.push({ t: 'payout', x: t.x, y: t.y, v: pay });
    }
    g.gold += 25 + g.waveIdx * 3;
    g.events.push({ t: 'waveClear', n: g.waveIdx + 1 });
    // checkpoint after waves 5, 10, 15
    const cleared = g.waveIdx + 1;
    if (cleared % 5 === 0 && cleared < g.level.waves.length) {
      g.checkpoints[cleared] = snapshot(g);
      g.events.push({ t: 'checkpoint', wave: cleared });
    }
    if (g.waveIdx + 1 >= g.level.waves.length) {
      g.over = true; g.won = true;
      g.events.push({ t: 'victory', lives: g.lives });
    }
  }
}

// ---- checkpoints -----------------------------------------------------------------
function snapshot(g) {
  return {
    gold: g.gold, lives: g.lives, waveIdx: g.waveIdx, leaked: g.leaked, killsTotal: g.killsTotal,
    towers: g.towers.map(t => ({ ...t }))
  };
}
function restore(g, snap) {
  g.gold = snap.gold;
  g.lives = snap.lives;
  g.waveIdx = snap.waveIdx;
  g.leaked = snap.leaked;
  g.killsTotal = snap.killsTotal;
  g.towers = snap.towers.map(t => ({ ...t, cd: 0 }));
  g.mobs = []; g.shots = []; g.spawnQueue = [];
  g.waveActive = false;
  g.over = false; g.won = false;
  g.events.push({ t: 'restored', wave: snap.waveIdx + 1 });
}
function latestCheckpoint(g) {
  const keys = Object.keys(g.checkpoints).map(Number).sort((a, b) => b - a);
  return keys.length ? g.checkpoints[keys[0]] : null;
}

const Sim = {
  TPS, CELL, GRID_W, GRID_H, LIVES, TOWERS, ENEMIES, BOSSES,
  createGame, tickGame, place, upgrade, sell, towerAt, canBuild,
  startWave, posAt, snapshot, restore, latestCheckpoint
};
if (typeof module !== 'undefined' && module.exports) module.exports = Sim;
else root.Sim = Sim;

})(typeof window !== 'undefined' ? window : globalThis);
