# SWARM KEEP

*the swarm is back. this time, you build.*

A bright cartoon tower defense: **50 levels across 5 worlds**, 8 towers,
7 monster types, a boss at the end of every world, and — because losing a
17-wave level to the last wave should never mean starting over —
**checkpoints every 5 waves**.

**Play:** open `index.html`. Everything is taps/clicks: pick a tower card,
tap the grass, press START. Identical on phone and desktop. No build, no
dependencies.

## The game

- **8 towers**, each with 3 upgrade tiers that physically grow:
  Pea Archer · Boom Cannon (splash, ground only) · Frost Prism (slows) ·
  Tesla Spire (chain lightning) · Ember Totem (burn) · Longshot (map-wide
  sniper) · Honey Bank (gold per wave) · War Drum (fire-rate aura)
- **7 monsters**: gloops, runners, armored shells, flying floaties (bring
  anti-air!), healers, splitters, brutes — plus five named world bosses
  ending with **THE SWARM KING**
- **Checkpoints:** cleared wave 5/10/15 saves your towers, gold and lives.
  Defeat offers *RETRY FROM WAVE N* instead of a restart.
- Stars per level (keep all 20 lives for 3★), 150 stars total, level-select
  map across 5 themed worlds: Meadow, Dunes, Tundra, Cinder, The Void.
- 2× speed toggle, sell/upgrade, early-wave banking strategy, juice
  everywhere: pops, coin arcs, chain lightning, wave banners, fireworks.

## Every level is balance-proven

`tools/gen.mjs` generates each map, then a **balance bot plays it using the
exact simulation the game runs** (`js/sim.js` is shared, deterministic and
seeded). A tuning loop adjusts each level's monster HP until the bot *barely
wins* — finishing with 3-10 of 20 lives. That means every level shipped is:

1. **beatable** — the bot beat it, with the tower set you have,
2. **challenging** — the bot nearly didn't,
3. **fairly ramped** — the difficulty curve is measured, not guessed.

The bot's results live in `tools/balance_report.json`. Regenerate all 50
levels with `node tools/gen.mjs`.

On top of that, the browser test suite (Playwright) verifies the real game:
an in-page bot beats level 1 through the public API, the checkpoint
save/restore round-trips after a real defeat, the gold economy balances to
the coin, mobile taps place towers, and a heavy world-4 fight stays fast.

## Controls

|             |                                   |
|-------------|-----------------------------------|
| everything  | tap / click                       |
| send wave   | START button / `space`            |
| 2× speed    | speed chip / `F`                  |
| deselect / back | `esc`                         |
| mute        | `M`                               |

## Hosting

Static files — Vercel, GitHub Pages, itch.io, anywhere.

---

The rest of the arcade, from earlier experiments:
[`swarm/`](swarm/) horde survival · [`lockstep/`](lockstep/) turn-locked
dungeon · [`hundo/`](hundo/) one-button gauntlet · [`umbra/`](umbra/)
LIMBO-style platformer.

## License

MIT — see LICENSE.
