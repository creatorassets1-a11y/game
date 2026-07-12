// diagnose a single chapter: print the map, run the solver, report how far
// it got and what kept killing it.  usage: node tools/debug_chapter.mjs <world> <ci>
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const Sim = require(join(__dir, '../js/sim.js'));

const gen = await import('./generate_lib.mjs');

const w = +process.argv[2], ci = +process.argv[3];
const def = gen.composeChapter(w, ci, (w * 10 + ci + 1) * 1000 + 13, 0);
console.log(def.map.join('\n'));
console.log('verb=' + def.verb, 'speed=' + def.speed, 'w=' + def.map[0].length);

const lv = Sim.parseLevel(def);
const st0 = Sim.newState(lv);
Sim.settle(lv, st0);

const deaths = {};
let maxX = 0;
const seen = new Set();
const stack = [{ st: st0 }];
let nodes = 0;
while (stack.length && nodes < 400000) {
  const node = stack.pop();
  for (const bit of [0, 1]) {
    const st = { ...node.st, crumbled: { ...node.st.crumbled }, touched: { ...node.st.touched }, usedPads: { ...node.st.usedPads } };
    Sim.step(lv, st, !!bit);
    nodes++;
    if (st.x > maxX) maxX = st.x;
    if (st.dead) { deaths[st.deadBy + '@' + (st.x / 32 | 0)] = (deaths[st.deadBy + '@' + (st.x / 32 | 0)] || 0) + 1; continue; }
    if (st.won) { console.log('SOLVED'); process.exit(0); }
    if (st.t > 5400) continue;
    const h = (st.x * 2 | 0) + '|' + (st.y * 2 | 0) + '|' + (st.vy * 2 | 0) + '|' + st.grav + '|' + st.verb + '|' +
      st.dashT + '|' + st.dashCd + '|' + (st.canAir ? 1 : 0) + (st.grounded ? 1 : 0) + '|' + st.coyote + '|' +
      st.buffer + '|' + (st._held ? 1 : 0) + '|' + (st.t % 120);
    if (seen.has(h)) continue;
    seen.add(h);
    stack.push({ st });
  }
}
console.log('nodes=' + nodes, 'maxX=' + (maxX / 32).toFixed(1) + ' tiles of ' + lv.w);
const top = Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('top deaths:', top.map(([k, v]) => k + ' x' + v).join('  '));
