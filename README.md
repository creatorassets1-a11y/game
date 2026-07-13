# LOCKSTEP

*they move when you move*

A turn-locked dungeon of **100 rooms**. The world is frozen until you take a
step — then everything answers at once. The hound lunges. Your mimic copies
your exact move. The mirror-wraith does the opposite. The warden's eye
counts to four. And the floor? The floor might be lying.

**Play:** open `index.html` in any browser. Arrows/WASD to step, space to
wait, on phones swipe to step and tap to wait. No build, no dependencies.

## How it plays

Every room is a small machine and the monsters are its moving parts:

- **Hounds** chase you greedily. Pits and spikes don't chase anyone — walk
  the hound into them.
- **Mimics** copy your every move, step for step. To kill your mimic you
  have to walk *yourself* in a way that walks *it* somewhere fatal.
- **Mirrors** do the exact opposite. Two wrongs, routed correctly, make a
  right.
- **Wardens** never move, but every fourth step they fire down their row
  and column. Count. Or hide behind a boulder.
- **Boulders** push (sokoban rules), crush monsters, plug pits, block beams.
- **Ice** doesn't stop for you. **Crumble tiles** are one-use.
  **Keys** open doors, once.
- And world 9 is called LIES: pressure runes disguised as floor, exits that
  aren't, statues that wake up.

Undo (`Z`) is always available — this is chess, not a rhythm game. But
deaths are counted forever, and each room's **par is the provably optimal
move count**: matching it earns 3 stars. 300 stars exist. Good luck.

## The worlds

1. **STEPS** — learn that the world moves in lockstep
2. **HOUNDS** — bait
3. **MIMICS** — you are your own worst enemy
4. **MIRRORS** — and your opposite is no better
5. **WARDENS** — count to four, forever
6. **STONES** — mass beats malice
7. **ICE** — commitment
8. **KEYS** — economy
9. **LIES** — trust nothing
10. **LOCKSTEP** — everything, all at once

## Machine-proven, mechanically honest

Rooms come from `tools/generate.mjs`, which holds each candidate to three
standards before it ships:

1. **Solvable** — proven by exhaustive breadth-first search over the full
   game state (player, monsters, boulders, keys, broken tiles), using the
   exact same simulation the game runs (`js/sim.js`).
2. **Not trivial** — minimum optimal-solution length per world.
3. **The monsters matter** — the prover re-solves each room with every
   monster deleted; if the empty room solves in the same number of moves,
   the monsters were decoration and the room is rejected.

Survivors are ranked by measured difficulty (optimal length plus how often
random play dies in there) and each world's ten rooms are picked in
ascending order — so the game gets harder because it *measurably is*, not
because the numbers went up. Par values are the true optima. The winning
move sequences live in `tools/solutions.json` and are replayed through the
real game in a browser as part of testing.

Regenerate everything with:

```
node tools/generate.mjs
```

## Controls

|            |                                  |
|------------|----------------------------------|
| step       | arrows / WASD / swipe            |
| wait       | `space` / `.` / tap              |
| undo       | `Z` / tap bottom-left            |
| restart    | `R` / tap bottom-right           |
| menu       | `esc` / tap top-left             |
| mute       | `M` / tap top-right              |

## Hosting

Static files — GitHub Pages, Netlify, Vercel, itch.io, anywhere.

---

Also in this repo, from earlier experiments: [`hundo/`](hundo/) — a
100-chapter one-button runner, and [`umbra/`](umbra/) — a LIMBO-style
silhouette platformer. Three games, one repo, escalating ambition.

## License

MIT — see LICENSE.
