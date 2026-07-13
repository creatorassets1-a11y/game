// Segment library for the level generator. Each segment is a short slice of
// level built on a 14-row grid. Segments start and end on plain ground so the
// composer can chain them in any order.
//
// Grid legend (see js/sim.js): # solid, - oneway, ^v<> spikes, * saw,
// H/V moving saw, % crumble, = bounce pad, g gravity pad, T popup-spike
// trigger, W phantom wall, ! fake spikes, X fake finish gate,
// J/K/F/D/L/P verb pads.

export const H = 14;
export const GROUND = 12;   // top row of the floor

function grid(w, opts = {}) {
  const g = Array.from({ length: H }, () => new Array(w).fill('.'));
  for (let x = 0; x < w; x++) { g[12][x] = '#'; g[13][x] = '#'; }
  if (opts.ceiling) for (let x = 0; x < w; x++) { g[0][x] = '#'; g[1][x] = '#'; }
  return g;
}
const fin = g => g.map(r => r.join(''));

// helpers
function pit(g, x0, x1) { for (let x = x0; x <= x1; x++) { g[12][x] = '.'; g[13][x] = '.'; } }
function spikes(g, x0, n, row = 11) { for (let i = 0; i < n; i++) g[row][x0 + i] = '^'; }
function ceilSpikes(g, x0, n, row = 2) { for (let i = 0; i < n; i++) g[row][x0 + i] = 'v'; }
function block(g, x0, x1, y0, y1, c = '#') {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c;
}

// A segment def: { verb, tier, w, build() -> rows }
// tier 0 = warmup ... 4 = cruel
export const SEGMENTS = [];
function seg(verb, tier, w, build, opts = {}) {
  SEGMENTS.push({ verb, tier, w, build, ...opts });
}

// ---------------------------------------------------------------- JUMP
seg('jump', 0, 9, () => { const g = grid(9); spikes(g, 4, 1); return fin(g); });
seg('jump', 0, 12, () => { const g = grid(12); spikes(g, 4, 1); spikes(g, 8, 1); return fin(g); });
seg('jump', 1, 10, () => { const g = grid(10); spikes(g, 4, 2); return fin(g); });
seg('jump', 1, 10, () => { const g = grid(10); pit(g, 4, 5); return fin(g); });
seg('jump', 1, 11, () => { const g = grid(11); block(g, 5, 6, 11, 11); return fin(g); });
seg('jump', 2, 12, () => { const g = grid(12); spikes(g, 4, 2); spikes(g, 8, 1); return fin(g); });
seg('jump', 2, 12, () => { const g = grid(12); pit(g, 4, 7); block(g, 5, 6, 11, 11); return fin(g); });
seg('jump', 2, 12, () => {
  const g = grid(12); block(g, 5, 7, 11, 11); spikes(g, 5, 3, 10); return fin(g);
});
seg('jump', 3, 13, () => { const g = grid(13); spikes(g, 4, 2); spikes(g, 8, 2); return fin(g); });
seg('jump', 3, 12, () => {
  const g = grid(12); pit(g, 4, 8); for (let x = 4; x <= 8; x++) g[11][x] = '%'; return fin(g);
});
seg('jump', 3, 12, () => { const g = grid(12); g[9][6] = '*'; spikes(g, 6, 1); return fin(g); });
seg('jump', 4, 14, () => {
  const g = grid(14); spikes(g, 3, 2); spikes(g, 7, 1); spikes(g, 10, 2); return fin(g);
});
seg('jump', 4, 13, () => {
  const g = grid(13); pit(g, 4, 9); block(g, 6, 6, 11, 11); g[8][6] = 'V'; return fin(g);
});
seg('jump', 4, 13, () => {
  const g = grid(13); spikes(g, 4, 2); block(g, 8, 9, 11, 11); spikes(g, 8, 2, 10); return fin(g);
});
// jump trolls
seg('jump', 2, 12, () => { const g = grid(12); g[11][4] = 'T'; return fin(g); }, { troll: true });
seg('jump', 2, 12, () => {
  const g = grid(12); g[11][4] = '!'; g[11][5] = '!'; spikes(g, 9, 1); return fin(g);
}, { troll: true });
seg('jump', 3, 12, () => {
  const g = grid(12); block(g, 6, 6, 8, 11, 'W'); spikes(g, 9, 1); return fin(g);
}, { troll: true });
seg('jump', 3, 13, () => {
  const g = grid(13); g[11][4] = 'T'; spikes(g, 9, 1); return fin(g);
}, { troll: true });
seg('jump', 4, 12, () => { const g = grid(12); g[5][5] = 'X'; g[11][8] = 'T'; return fin(g); }, { troll: true });

// bounce pad bits (jump worlds, tier 2+)
seg('jump', 2, 12, () => {
  const g = grid(12); g[11][4] = '='; block(g, 6, 8, 7, 7); spikes(g, 6, 3, 11); return fin(g);
});
seg('jump', 3, 14, () => {
  const g = grid(14); g[11][4] = '='; block(g, 7, 9, 6, 6); spikes(g, 6, 5, 11); ceilSpikes(g, 7, 2, 3); return fin(g);
});

// ---------------------------------------------------------------- JUMP2
seg('jump2', 1, 12, () => { const g = grid(12); pit(g, 4, 8); return fin(g); });
seg('jump2', 2, 14, () => { const g = grid(14); pit(g, 4, 10); return fin(g); });
seg('jump2', 2, 12, () => { const g = grid(12); spikes(g, 4, 3); return fin(g); });
seg('jump2', 3, 14, () => { const g = grid(14); spikes(g, 4, 2); spikes(g, 9, 2); return fin(g); });
seg('jump2', 3, 14, () => {
  const g = grid(14); pit(g, 4, 10); g[8][7] = '*'; return fin(g);
});
seg('jump2', 4, 15, () => {
  const g = grid(15); pit(g, 3, 11); block(g, 7, 7, 11, 11); spikes(g, 7, 1, 10); return fin(g);
});
seg('jump2', 4, 14, () => {
  const g = grid(14); spikes(g, 3, 3); block(g, 9, 10, 11, 11); spikes(g, 9, 2, 10); return fin(g);
});
seg('jump2', 3, 13, () => { const g = grid(13); g[11][4] = 'T'; g[11][8] = 'T'; return fin(g); }, { troll: true });

// ---------------------------------------------------------------- FLIP
// flip segments carry their own ceiling. every segment must contest BOTH
// lanes, otherwise the whole chapter can be ridden on one surface.
// segments always end with two clean columns so you can get back to the
// floor before the corridor runs out.
seg('flip', 0, 12, () => {
  const g = grid(12, { ceiling: true }); spikes(g, 3, 1); ceilSpikes(g, 7, 1); return fin(g);
}, { ceiling: true });
seg('flip', 1, 13, () => {
  const g = grid(13, { ceiling: true }); spikes(g, 3, 2); ceilSpikes(g, 8, 2); return fin(g);
}, { ceiling: true });
seg('flip', 2, 14, () => {
  const g = grid(14, { ceiling: true }); spikes(g, 3, 4); ceilSpikes(g, 8, 4); return fin(g);
}, { ceiling: true });
seg('flip', 2, 13, () => {
  const g = grid(13, { ceiling: true }); pit(g, 3, 6); ceilSpikes(g, 8, 2); return fin(g);
}, { ceiling: true });
seg('flip', 3, 15, () => {
  const g = grid(15, { ceiling: true });
  spikes(g, 3, 3); ceilSpikes(g, 6, 3); spikes(g, 9, 3); ceilSpikes(g, 12, 1); return fin(g);
}, { ceiling: true });
seg('flip', 3, 13, () => {
  const g = grid(13, { ceiling: true }); g[2][6] = '*'; spikes(g, 5, 3); return fin(g);
}, { ceiling: true });
seg('flip', 4, 16, () => {
  const g = grid(16, { ceiling: true });
  spikes(g, 3, 2); ceilSpikes(g, 5, 3); spikes(g, 8, 3); ceilSpikes(g, 12, 2); return fin(g);
}, { ceiling: true });
seg('flip', 4, 13, () => {
  const g = grid(13, { ceiling: true });
  for (let x = 4; x <= 8; x++) g[1][x] = '%';
  spikes(g, 4, 5); ceilSpikes(g, 10, 1); return fin(g);
}, { ceiling: true });
seg('flip', 2, 13, () => {
  const g = grid(13, { ceiling: true }); g[11][4] = 'T'; ceilSpikes(g, 9, 1); return fin(g);
}, { ceiling: true, troll: true });
seg('flip', 3, 13, () => {
  const g = grid(13, { ceiling: true }); block(g, 6, 6, 6, 11, 'W'); spikes(g, 8, 2); ceilSpikes(g, 4, 1); return fin(g);
}, { ceiling: true, troll: true });

// ---------------------------------------------------------------- DASH
seg('dash', 1, 12, () => {
  const g = grid(12); for (let y = 7; y <= 11; y++) g[y][5] = '^'; return fin(g);
});
seg('dash', 2, 13, () => {
  const g = grid(13); for (let y = 6; y <= 11; y++) { g[y][5] = '^'; g[y][6] = '^'; } return fin(g);
});
seg('dash', 2, 14, () => { const g = grid(14); pit(g, 3, 10); return fin(g); });
seg('dash', 3, 15, () => {
  const g = grid(15);
  for (let y = 7; y <= 11; y++) g[y][4] = '^';
  for (let y = 7; y <= 11; y++) g[y][9] = '^';
  return fin(g);
});
seg('dash', 3, 13, () => {
  const g = grid(13); g[10][6] = '*'; g[8][6] = '*'; g[6][6] = '*'; return fin(g);
});
seg('dash', 4, 16, () => {
  const g = grid(16);
  for (let y = 6; y <= 11; y++) { g[y][4] = '^'; g[y][8] = '^'; g[y][12] = '^'; }
  return fin(g);
});
seg('dash', 4, 14, () => {
  const g = grid(14); pit(g, 3, 10); for (let y = 5; y <= 9; y++) g[y][7] = '^'; return fin(g);
});
seg('dash', 3, 13, () => {
  const g = grid(13); block(g, 5, 6, 6, 11, 'W'); for (let y = 7; y <= 11; y++) g[y][9] = '^'; return fin(g);
}, { troll: true });

// ---------------------------------------------------------------- FLOAT
// caves: these carry a ceiling too
seg('float', 1, 12, () => {
  const g = grid(12, { ceiling: true }); ceilSpikes(g, 4, 3); spikes(g, 8, 2); return fin(g);
}, { ceiling: true });
seg('float', 2, 14, () => {
  const g = grid(14, { ceiling: true });
  block(g, 4, 5, 2, 6); ceilSpikes(g, 4, 2, 7);
  block(g, 9, 10, 8, 11); spikes(g, 9, 2, 7);
  return fin(g);
}, { ceiling: true });
seg('float', 2, 12, () => {
  const g = grid(12, { ceiling: true }); pit(g, 3, 9); spikes(g, 3, 0); ceilSpikes(g, 5, 2); return fin(g);
}, { ceiling: true });
seg('float', 3, 14, () => {
  const g = grid(14, { ceiling: true });
  block(g, 4, 4, 2, 7); block(g, 8, 8, 6, 11); block(g, 12, 12, 2, 7);
  return fin(g);
}, { ceiling: true });
seg('float', 3, 13, () => {
  const g = grid(13, { ceiling: true }); g[6][6] = 'V'; ceilSpikes(g, 3, 2); spikes(g, 9, 2); return fin(g);
}, { ceiling: true });
seg('float', 4, 15, () => {
  const g = grid(15, { ceiling: true });
  block(g, 3, 3, 2, 8); block(g, 6, 6, 5, 11); block(g, 9, 9, 2, 8); block(g, 12, 12, 5, 11);
  return fin(g);
}, { ceiling: true });
seg('float', 4, 14, () => {
  const g = grid(14, { ceiling: true });
  ceilSpikes(g, 3, 8); spikes(g, 4, 7); g[6][7] = '*';
  return fin(g);
}, { ceiling: true });

// ---------------------------------------------------------------- STOP
// the stop verb cannot jump, so no ground spikes, popups, pits or walls
// here - hazards are V saws stabbing down through the path on a cycle.
// different columns run on different phases; wait for the window, commit.
// (no H saws on the ground: the blade is slower than you, you can never
// cross its track - proven impassable, see tools/ history)
seg('stop', 1, 12, () => { const g = grid(12); g[10][6] = 'V'; return fin(g); });
seg('stop', 2, 14, () => { const g = grid(14); g[10][5] = 'V'; g[10][9] = 'V'; return fin(g); });
seg('stop', 2, 14, () => { const g = grid(14); g[9][5] = 'V'; g[10][9] = 'V'; return fin(g); });
seg('stop', 3, 15, () => {
  const g = grid(15); g[10][4] = 'V'; g[10][8] = 'V'; g[10][12] = 'V'; return fin(g);
});
seg('stop', 3, 15, () => {
  const g = grid(15); g[10][4] = 'V'; g[9][8] = 'V'; g[10][12] = 'V'; return fin(g);
});
seg('stop', 4, 17, () => {
  const g = grid(17); g[10][4] = 'V'; g[10][7] = 'V'; g[10][10] = 'V'; g[10][14] = 'V'; return fin(g);
});
seg('stop', 2, 13, () => {
  const g = grid(13); g[11][4] = '!'; g[11][5] = '!'; g[10][9] = 'V'; return fin(g);
}, { troll: true });
seg('stop', 3, 13, () => {
  const g = grid(13); block(g, 6, 6, 7, 11, 'W'); g[10][9] = 'V'; return fin(g);
}, { troll: true });

// ---------------------------------------------------------------- filler
seg('any', 0, 6, () => fin(grid(6)));
seg('any', 0, 8, () => { const g = grid(8); block(g, 3, 4, 11, 11); return fin(g); });
