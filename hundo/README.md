# HUNDO

*100 rooms. one button. no mercy.*

A one-button gauntlet across **100 chapters** that keeps changing what the
button does — and keeps lying to you about everything else.

**Play:** open `index.html` in any browser. One tap is the entire control
scheme, so it plays identically on desktop (space / click) and phones
(touch). No build, no dependencies.

## The gimmick

Your square runs forward on its own. You have one button. What the button
*means* depends on where you are:

| world | chapters | the button |
|---|---|---|
| 1 · RUNNER | 1–10 | tap = **jump** |
| 2 · LIAR | 11–20 | jump, but the level cheats |
| 3 · CEILING | 21–30 | tap = **flip gravity** |
| 4 · TWO-FACED | 31–40 | gravity, plus lies |
| 5 · GHOST | 41–50 | tap = **phase dash** through anything |
| 6 · THRUST | 51–60 | hold = **jetpack** |
| 7 · PATIENCE | 61–70 | hold = **freeze** (the saws don't) |
| 8 · DOUBLES | 71–80 | jump, twice, fast |
| 9 · BABEL | 81–90 | the verb changes **mid-level** |
| 10 · HELL | 91–100 | everything. at speed. good luck |

Difficulty ramps within every world and across the whole run — wider gaps,
faster scroll, tighter timings, nastier combinations.

The lies: spikes that pop up behind a trigger you can't see, walls that
turn out to be holograms, spikes that turn out to be paint, and finish
gates that are not the finish gate.

## Every chapter is provably beatable

The levels are composed by `tools/generate.mjs`, and the generator will not
ship a chapter it cannot beat: it runs a breadth-first search over the real
game simulation (`js/sim.js` — the same code the game executes) until it
finds a working tap sequence. Unbeatable compositions get thrown away and
regenerated. The winning tap scripts are kept in `tools/solutions.json` and
replayed in a real browser as part of testing.

So when you die for the 40th time: it's you.

- Instant respawn, attempt counter, per-chapter progress bar with your best
  distance ghosted in.
- Progress saves automatically (localStorage). Chapter select on the menu.
- Procedural synthwave soundtrack that gets faster and busier per world —
  no audio files, everything is synthesized live.

## Controls

|            |                             |
|------------|-----------------------------|
| the button | `space` / `↑` / `W` / click / tap |
| restart    | `R`                         |
| menu       | `esc`                       |
| mute       | `M`                         |

## Hosting

Static files. GitHub Pages (Settings → Pages → deploy from branch),
Netlify, itch.io — anywhere.

## Regenerating / adding levels

```
node tools/generate.mjs
```

Segment patterns live in `tools/segments.mjs` on a simple ASCII grid.
Add patterns, re-run the generator, and it will only emit chapters it can
prove are beatable.

---

Also in this repo: [`umbra/`](umbra/) — a slower, darker LIMBO-style
puzzle-platformer from an earlier experiment. Different game, same
one-sitting spirit.

## License

MIT — see LICENSE.
