# SWARM!!

*100 waves. one tiny hero. infinite monsters.*

A loud, bright, one-thumb horde-survival game. You move — everything else
is automatic. Your weapons fire themselves, monsters explode into gems and
coins, level-ups stop time and hand you loot choices, and every tenth wave
a boss with a name and a health bar comes looking for you.

**Play:** open `index.html`. WASD or drag-to-move. That's the entire
tutorial. No build, no dependencies.

## The loop

1. Monsters flood in from every edge — gloops, runners, brutes, spitters,
   splitters, ghosts, and (from wave 15) glowing elites.
2. Kills drop **XP gems** (they vacuum toward you) and **coins**.
3. Level up → pick **1 of 3 cards**: new weapons (Zap Bolt, Orbit Blades,
   Ring Nova, Chain Zap, Boomerang — each with 5 levels) or passives
   (speed, magnet, max HP, damage, fire rate, luck).
4. Every 10th wave: a **boss**. MEGAGLOOP, SPIT LORD, THE WALL... ten of
   them, up to **THE SWARM KING** at wave 100.
5. Die (you will) → your coins bank. Spend them on new heroes:

| hero | style |
|---|---|
| PIP | balanced little wizard (free) |
| FANG | fast, boomerangs |
| BRUNO | tanky bear, ring nova |
| ZAPPY | robot, chain lightning |
| MISO | ninja cat, orbit blades, very fast |
| KING GLORP | the monsters' own king, starts with two weapons |

Kill streaks build combos (NICE! → RAD!! → INSANE!!! → GODLIKE!!!!),
damage numbers pop, the screen shakes, and the music adds a layer every
ten waves. Best wave is saved forever.

## Tech notes

- Pure canvas + WebAudio, zero asset files: every creature is a
  pre-rendered cartoon blob sprite generated at load, all music and SFX
  are synthesized live.
- Simulates 240 monsters + bullets + particles at ~0.1ms per frame — a
  full-horde frame budget measured in the browser test suite.
- Verified with Playwright: autofire kills, level-up flow, boss spawn and
  death, player death flow, mobile drag input, performance smoke test,
  zero console errors.

## Controls

|        |                          |
|--------|--------------------------|
| move   | WASD / arrows / drag     |
| pause  | `P` / `esc`              |
| mute   | `M`                      |
| everything else | automatic       |

## Hosting

Static files — Vercel, GitHub Pages, itch.io, anywhere.

---

Also in this repo, from earlier experiments:
[`lockstep/`](lockstep/) — a turn-locked dungeon puzzler ·
[`hundo/`](hundo/) — a one-button gauntlet ·
[`umbra/`](umbra/) — a LIMBO-style silhouette platformer.

## License

MIT — see LICENSE.
