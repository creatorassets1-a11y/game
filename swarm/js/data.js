// SWARM!! content tables: characters, weapons, passives, enemies, waves.

const CHARS = [
  { id: 'pip',   name: 'PIP',        cost: 0,     body: '#8ec5ff', belly: '#e8f4ff', hat: 'wizard', hatCol: '#4f6df5', hp: 100, speed: 1.0, dmg: 1.0, start: 'bolt',   blurb: 'the little wizard. balanced and brave.' },
  { id: 'fang',  name: 'FANG',       cost: 600,   body: '#b48cff', belly: '#efe6ff', hat: 'ears',   hatCol: '#7c4fe0', hp: 85,  speed: 1.15, dmg: 1.0, start: 'boomer', blurb: 'fast. flappy. throws things that come back.' },
  { id: 'bruno', name: 'BRUNO',      cost: 1500,  body: '#ffb066', belly: '#ffe8cc', hat: 'round',  hatCol: '#c96f2f', hp: 150, speed: 0.85, dmg: 1.1, start: 'nova',   blurb: 'a bear. hugs everything at once.' },
  { id: 'zappy', name: 'ZAPPY',      cost: 3000,  body: '#7ff0d3', belly: '#e2fff6', hat: 'antenna',hatCol: '#28b498', hp: 90,  speed: 1.0, dmg: 1.15, start: 'zap',    blurb: 'a robot who never learned indoor voice.' },
  { id: 'miso',  name: 'MISO',       cost: 6000,  body: '#606878', belly: '#c8cdd8', hat: 'cat',    hatCol: '#3a4150', hp: 80,  speed: 1.3, dmg: 1.1, start: 'blades', blurb: 'ninja cat. nine lives, spends them fast.' },
  { id: 'glorp', name: 'KING GLORP', cost: 15000, body: '#9be06e', belly: '#eaffd6', hat: 'crown',  hatCol: '#f4c542', hp: 130, speed: 1.1, dmg: 1.25, start: 'bolt',  blurb: 'the monsters\' own king. switched sides.', extraStart: 'nova' }
];

const WEAPONS = {
  bolt:   { name: 'Zap Bolt',    icon: '✦', desc: 'fires at the nearest monster',
            lv: [ { rate: 34, n: 1, dmg: 10, spd: 8 }, { rate: 30, n: 2, dmg: 11, spd: 8 }, { rate: 26, n: 2, dmg: 13, spd: 9 }, { rate: 22, n: 3, dmg: 15, spd: 9 }, { rate: 16, n: 4, dmg: 18, spd: 10 } ] },
  blades: { name: 'Orbit Blades', icon: '❋', desc: 'saws circle around you',
            lv: [ { n: 2, r: 62, dmg: 8, rot: 0.055 }, { n: 3, r: 66, dmg: 9, rot: 0.06 }, { n: 3, r: 74, dmg: 11, rot: 0.068 }, { n: 4, r: 80, dmg: 13, rot: 0.075 }, { n: 6, r: 88, dmg: 16, rot: 0.085 } ] },
  nova:   { name: 'Ring Nova',   icon: '◎', desc: 'periodic blast in all directions',
            lv: [ { rate: 110, n: 8, dmg: 9, spd: 5 }, { rate: 100, n: 10, dmg: 10, spd: 5.4 }, { rate: 90, n: 12, dmg: 12, spd: 5.8 }, { rate: 78, n: 14, dmg: 14, spd: 6.2 }, { rate: 62, n: 18, dmg: 17, spd: 7 } ] },
  zap:    { name: 'Chain Zap',   icon: '⌁', desc: 'lightning that jumps between monsters',
            lv: [ { rate: 55, chains: 3, dmg: 12 }, { rate: 50, chains: 4, dmg: 14 }, { rate: 44, chains: 5, dmg: 16 }, { rate: 38, chains: 6, dmg: 19 }, { rate: 30, chains: 8, dmg: 23 } ] },
  boomer: { name: 'Boomerang',   icon: '➰', desc: 'pierces through, then comes back',
            lv: [ { rate: 58, n: 1, dmg: 14, spd: 7 }, { rate: 52, n: 1, dmg: 17, spd: 7.5 }, { rate: 46, n: 2, dmg: 19, spd: 8 }, { rate: 40, n: 2, dmg: 23, spd: 8.5 }, { rate: 32, n: 3, dmg: 28, spd: 9 } ] }
};

const PASSIVES = {
  boots:  { name: 'Zoom Boots',   icon: '➜', desc: '+12% move speed', max: 4 },
  magnet: { name: 'Gem Magnet',   icon: '◉', desc: 'gems fly to you from further away', max: 4 },
  heart:  { name: 'Big Heart',    icon: '♥', desc: '+25 max HP and heal 25', max: 4 },
  fist:   { name: 'Power Fist',   icon: '✊', desc: '+15% damage', max: 4 },
  clock:  { name: 'Fast Hands',   icon: '⏱', desc: 'weapons fire 12% faster', max: 4 },
  star:   { name: 'Lucky Star',   icon: '★', desc: '+20% XP from gems', max: 3 }
};

// enemy archetypes; hp/speed get scaled by wave
const ENEMIES = {
  gloop:    { r: 16, hp: 18,  speed: 0.9,  dmg: 8,  xp: 1, coin: 0.08, col: '#7ed957', dark: '#3f9032', kind: 'chase' },
  runner:   { r: 12, hp: 10,  speed: 1.9,  dmg: 6,  xp: 1, coin: 0.06, col: '#ffd23f', dark: '#c99a17', kind: 'chase' },
  brute:    { r: 26, hp: 70,  speed: 0.55, dmg: 16, xp: 3, coin: 0.25, col: '#ff6b6b', dark: '#b83b3b', kind: 'chase' },
  spitter:  { r: 15, hp: 26,  speed: 0.8,  dmg: 7,  xp: 2, coin: 0.15, col: '#c47aff', dark: '#8a48c9', kind: 'spit' },
  splitter: { r: 20, hp: 34,  speed: 0.75, dmg: 10, xp: 2, coin: 0.18, col: '#5fd8e8', dark: '#2f98a8', kind: 'split' },
  ghost:    { r: 14, hp: 22,  speed: 1.25, dmg: 9,  xp: 2, coin: 0.12, col: '#cfd6ff', dark: '#8a93cc', kind: 'weave' }
};

const BOSSES = [
  { at: 10,  name: 'MEGAGLOOP',      base: 'gloop',    r: 60, hp: 900,   speed: 0.7,  pattern: 'charge' },
  { at: 20,  name: 'THE YOLK',       base: 'runner',   r: 54, hp: 1600,  speed: 1.0,  pattern: 'spawn' },
  { at: 30,  name: 'SPIT LORD',      base: 'spitter',  r: 62, hp: 2600,  speed: 0.6,  pattern: 'radial' },
  { at: 40,  name: 'BIG BROTHER',    base: 'brute',    r: 74, hp: 4200,  speed: 0.5,  pattern: 'charge' },
  { at: 50,  name: 'THE DIVIDED',    base: 'splitter', r: 64, hp: 5600,  speed: 0.75, pattern: 'spawn' },
  { at: 60,  name: 'POLTERGLOOP',    base: 'ghost',    r: 58, hp: 7200,  speed: 1.1,  pattern: 'weave' },
  { at: 70,  name: 'DOUBLE YOLK',    base: 'runner',   r: 66, hp: 9000,  speed: 1.15, pattern: 'radial' },
  { at: 80,  name: 'GRAND SPITTER',  base: 'spitter',  r: 72, hp: 11500, speed: 0.65, pattern: 'radial' },
  { at: 90,  name: 'THE WALL',       base: 'brute',    r: 88, hp: 15000, speed: 0.45, pattern: 'charge' },
  { at: 100, name: 'THE SWARM KING', base: 'gloop',    r: 96, hp: 22000, speed: 0.8,  pattern: 'all' }
];

// wave recipe: which enemies exist from which wave, weighted
const WAVE_MIX = [
  { from: 1,  mix: { gloop: 10 } },
  { from: 3,  mix: { gloop: 8, runner: 3 } },
  { from: 6,  mix: { gloop: 7, runner: 5 } },
  { from: 9,  mix: { gloop: 6, runner: 5, brute: 1 } },
  { from: 13, mix: { gloop: 5, runner: 5, brute: 2, spitter: 2 } },
  { from: 18, mix: { gloop: 4, runner: 5, brute: 3, spitter: 3 } },
  { from: 24, mix: { gloop: 4, runner: 4, brute: 3, spitter: 3, splitter: 2 } },
  { from: 32, mix: { gloop: 3, runner: 4, brute: 3, spitter: 3, splitter: 3, ghost: 2 } },
  { from: 45, mix: { runner: 4, brute: 4, spitter: 4, splitter: 3, ghost: 3 } },
  { from: 60, mix: { runner: 4, brute: 5, spitter: 4, splitter: 4, ghost: 4 } },
  { from: 80, mix: { runner: 5, brute: 6, spitter: 5, splitter: 5, ghost: 5 } }
];

function waveConf(w) {
  let mix = WAVE_MIX[0].mix;
  for (const m of WAVE_MIX) if (w >= m.from) mix = m.mix;
  return {
    mix,
    dur: 60 * (w < 5 ? 16 : 20),                    // frames per wave
    spawnEvery: Math.max(6, Math.round(34 - w * 0.55)),
    batch: 1 + Math.floor(w / 12),
    hpScale: 1 + (w - 1) * 0.16 + Math.pow(Math.max(0, w - 40) * 0.05, 2),
    dmgScale: 1 + (w - 1) * 0.02,
    elite: w >= 15 ? Math.min(0.12, 0.02 + w * 0.001) : 0,
    boss: BOSSES.find(b => b.at === w) || null
  };
}

const DATA = { CHARS, WEAPONS, PASSIVES, ENEMIES, BOSSES, waveConf };
if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
else window.DATA = DATA;
