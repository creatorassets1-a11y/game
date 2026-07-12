# UMBRA

*a small dark game*

A monochrome puzzle-platformer about a pair of eyes lost in the dark.
Twelve chapters. Every trap is fair. Every death is your fault.

Inspired by the "trial and death" design of games like LIMBO: the world
never explains itself, but it never lies to you either. Look before you
step. Bait the things that want to kill you. Push the box.

**Play it:** open `index.html` in a browser. That's it — no build, no
dependencies, one canvas and three script files.

## Controls

|            |                      |
|------------|----------------------|
| move       | `A` `D` or arrow keys |
| jump       | `W` / `space` / up   |
| grab / use | hold `E` or `shift`  |
| restart    | `R`                  |
| mute       | `M`                  |
| menu       | `esc`                |

Works on touch screens too — buttons appear when you tap.

## The chapters

Each one introduces one idea, then twists it.

1. **Waking** — learn to walk. And that the ground has teeth.
2. **The Box** — crates go where you push them. And where you pull them.
3. **Teeth** — bear traps hide in the grass. Some things can be sprung from a distance.
4. **The Press** — the ceiling comes down. Rhythm is everything.
5. **Weight** — pressure plates hold doors open. So does anything heavy.
6. **Needles** — dart throwers, and the fine art of hiding behind furniture.
7. **Undertow** — you can't swim. Crates float. Water rises.
8. **Pendulums** — swinging blades over spike pits, timed badly on purpose.
9. **Current** — electrified floors, and a lever that doesn't stay pulled.
10. **Vertigo** — a long climb on platforms that don't want to hold you.
11. **The Machine** — everything above, at once.
12. **Light** — walk out.

Progress saves automatically (localStorage). Checkpoints are generous
because dying is how you learn, not how you're punished.

## Hosting it

It's a static page. Drop it on GitHub Pages
(Settings → Pages → deploy from branch), Netlify, itch.io, anywhere.

## Tweaking levels

All the level data lives in `js/levels.js` as plain rectangles, with the
movement limits documented at the top of the file (how far a jump reaches,
how tall a wall must be to block you, and so on). Add a chapter by adding
an object to the array — the menu picks it up automatically.

## License

MIT — see LICENSE.
