// Level data. Everything is plain rectangles + a handful of trap types.
// Coordinates are world pixels. Ground top is usually y=480 (screen is 960x540).
//
// The design rules the physics allow (keep these in mind when editing):
//   - a plain jump clears gaps up to ~110px and ledges up to ~145px
//   - with a crate (46px) you can reach walls up to ~190px
//   - walls of 230px or more are impassable without help
//   - tunnels need 55px clearance to walk, ~95px to climb over a crate inside

const LEVELS = [

// ---------------------------------------------------------------- I
{
  name: 'WAKING', num: 'I', w: 2400, h: 540,
  spawn: [110, 438],
  exit: [2240, 480],
  plats: [
    [0, 480, 760, 80],        // first ground
    [760, 530, 90, 30],       // forgiving dip, climb out
    [850, 480, 550, 80],
    [1400, 528, 92, 12],      // spike pit floor
    [1492, 480, 908, 80],
    [1800, 380, 140, 100],    // step up
    [1940, 300, 140, 180]     // higher step
  ],
  spikes: [[1400, 528, 92]],
  checks: [[1560, 438]],
  hints: [
    { x: 150, y: 420, t: '← →' },
    { x: 690, y: 400, t: 'jump' }
  ]
},

// ---------------------------------------------------------------- II
{
  name: 'THE BOX', num: 'II', w: 2600, h: 720,
  spawn: [110, 438],
  exit: [2450, 480],
  plats: [
    [0, 480, 900, 240],       // upper ground
    [900, 660, 400, 60],      // pit floor, 180 deep - needs the crate
    [1300, 480, 1300, 240],   // far side
    [1600, 300, 200, 60],     // overhang the second crate hides under
    [1850, 240, 60, 240],     // wall blocking ground route
    [1960, 340, 160, 16]      // landing shelf past the wall
  ],
  crates: [[700, 434], [1660, 434]],
  checks: [[1360, 438]],
  hints: [{ x: 700, y: 390, t: 'hold  E' }]
},

// ---------------------------------------------------------------- III
{
  name: 'TEETH', num: 'III', w: 2600, h: 540,
  spawn: [90, 438],
  exit: [2500, 480],
  grassy: true,
  plats: [
    [0, 480, 2600, 60],
    [900, 360, 300, 120],     // raised walk, the drop-off is a lesson
    [1500, 330, 500, 40]      // tunnel ceiling
  ],
  traps: [
    [600, 480],               // in the open. look at it. remember it.
    [1252, 480],              // right where you land off the ledge
    [1690, 480], [1740, 480], [1790, 480],  // tunnel row - push the crate through
    [2180, 480], [2270, 480], [2350, 480]   // weave or hop, they're visible
  ],
  crates: [[1420, 434]],
  checks: [[850, 438], [1330, 438], [2080, 438]]
},

// ---------------------------------------------------------------- IV
{
  name: 'THE PRESS', num: 'IV', w: 2800, h: 540,
  spawn: [100, 438],
  exit: [2650, 480],
  plats: [[0, 480, 2800, 60]],
  stompers: [
    { x: 660, w: 100, y: 60, min: 70, max: 420, period: 170, trip: true },
    { x: 1180, w: 90, y: 60, min: 70, max: 420, period: 175, offset: 0 },
    { x: 1380, w: 90, y: 60, min: 70, max: 420, period: 175, offset: 58 },
    { x: 1580, w: 90, y: 60, min: 70, max: 420, period: 175, offset: 116 },
    { x: 2050, w: 170, y: 60, min: 70, max: 420, period: 240, offset: 0 },
    { x: 2330, w: 80, y: 60, min: 70, max: 420, period: 130, offset: 0 },
    { x: 2470, w: 80, y: 60, min: 70, max: 420, period: 130, offset: 65 }
  ],
  checks: [[960, 438], [1780, 438]]
},

// ---------------------------------------------------------------- V
{
  name: 'WEIGHT', num: 'V', w: 2800, h: 540,
  spawn: [100, 438],
  exit: [2650, 480],
  plats: [
    [0, 480, 2800, 60],
    [1200, 400, 100, 80],     // step
    [1300, 320, 300, 20]      // ledge with the crate on it
  ],
  crates: [[500, 434], [1450, 274]],
  plates: [
    { x: 700, w: 64, y: 480, id: 'a' },
    { x: 1610, w: 70, y: 480, id: 'b' },   // drop the crate off the ledge onto this
    { x: 2000, w: 64, y: 480, id: 'c' }
  ],
  doors: [
    { x: 900, y: 240, w: 30, h: 240, id: 'a' },
    { x: 1750, y: 240, w: 30, h: 240, id: 'b' },
    { x: 2300, y: 240, w: 36, h: 240, id: 'c', slow: true }  // sprint for it
  ],
  checks: [[1000, 438], [1850, 438]]
},

// ---------------------------------------------------------------- VI
{
  name: 'NEEDLES', num: 'VI', w: 2800, h: 540,
  spawn: [100, 438],
  exit: [2700, 480],
  plats: [
    [0, 480, 2800, 60],
    [700, 420, 60, 60],       // hop blocks - darts pass underneath you
    [900, 420, 60, 60],
    [1100, 420, 60, 60],
    [1250, 360, 80, 120],     // shooter post, climb it after the shot
    [1500, 300, 620, 30],     // low corridor - use the crate as a shield
    [2120, 360, 80, 120],     // second shooter post
    [2440, 420, 50, 60]       // jump the tripwire onto this
  ],
  shooters: [
    { x: 1250, y: 452, dir: -1, every: 150 },
    { x: 2120, y: 452, dir: -1, every: 85 },
    { x: 2620, y: 452, dir: -1, trip: 2400 }   // fires when the wire at x=2400 breaks
  ],
  crates: [[1420, 434]],
  checks: [[1400, 438], [2260, 438]]
},

// ---------------------------------------------------------------- VII
{
  name: 'UNDERTOW', num: 'VII', w: 2600, h: 720,
  spawn: [100, 438],
  exit: [2400, 140],
  plats: [
    [0, 480, 800, 240],
    [800, 700, 280, 20],      // pool 1 floor
    [1080, 480, 320, 240],
    [1400, 700, 400, 20],     // pool 2 floor
    [1580, 520, 70, 20],      // stepping stone in pool 2
    [1800, 480, 800, 240],
    [2050, 380, 110, 20],     // the climb out, water chasing you
    [2250, 300, 110, 20],
    [2080, 210, 110, 20],
    [2260, 140, 340, 20]
  ],
  water: [
    { x: 800, y: 560, w: 280, h: 160 },
    { x: 1400, y: 560, w: 400, h: 160 },
    { x: 1800, y: 690, w: 800, h: 30, rise: { to: 190, speed: 0.6, trigX: 2000 } }
  ],
  crates: [[830, 500], [1430, 500], [1660, 500]],   // these float - stand on one and paddle
  checks: [[1180, 438], [1900, 438]]
},

// ---------------------------------------------------------------- VIII
{
  name: 'PENDULUMS', num: 'VIII', w: 2700, h: 540,
  spawn: [100, 438],
  exit: [2570, 480],
  plats: [
    [0, 480, 740, 60],
    [740, 528, 120, 12],
    [860, 480, 380, 60],
    [1240, 528, 120, 12],
    [1360, 480, 180, 60],
    [1540, 528, 120, 12],
    [1660, 480, 240, 60],
    [1900, 528, 400, 12],     // the long spike field, ride the platform
    [2300, 480, 400, 60]
  ],
  spikes: [[740, 528, 120], [1240, 528, 120], [1540, 528, 120], [1900, 528, 400]],
  pends: [
    { x: 800, y: 120, len: 280, amp: 0.85, period: 150, offset: 0 },
    { x: 1300, y: 120, len: 280, amp: 0.85, period: 160, offset: 40 },
    { x: 1600, y: 120, len: 280, amp: 0.85, period: 145, offset: 90 }
  ],
  movers: [
    { x: 1880, y: 440, w: 110, h: 16, dx: 1, dy: 0, dist: 400, speed: 1.6 }
  ],
  saws: [
    { x: 2380, y: 480, dx: 1, dy: 0, dist: 220, speed: 1.4, r: 26, offset: 0 }
  ],
  checks: [[1080, 438], [1740, 438], [2330, 438]]
},

// ---------------------------------------------------------------- IX
{
  name: 'CURRENT', num: 'IX', w: 2800, h: 540,
  spawn: [100, 438],
  exit: [2650, 480],
  plats: [
    [0, 480, 2800, 60],
    [1380, 380, 90, 16]       // perch for the timed lever
  ],
  efloors: [
    { x: 660, y: 480, w: 150, on: 90, off: 100, offset: 0 },
    { x: 880, y: 480, w: 150, on: 90, off: 100, offset: 63 },
    { x: 1100, y: 480, w: 150, on: 90, off: 100, offset: 126 },
    { x: 1520, y: 480, w: 420, id: 'e' }  // hot until the lever, and only briefly
  ],
  levers: [{ x: 1410, y: 380, id: 'e', timed: 260 }],
  crates: [[2050, 434]],
  plates: [{ x: 2350, w: 70, y: 480, id: 'd' }],
  doors: [{ x: 2480, y: 240, w: 30, h: 240, id: 'd' }],
  checks: [[1300, 438], [2000, 438]]
},

// ---------------------------------------------------------------- X
{
  name: 'VERTIGO', num: 'X', w: 1400, h: 1400,
  spawn: [120, 1298],
  exit: [1080, 380],
  plats: [
    [0, 1340, 1400, 60],
    [300, 1200, 110, 18],
    [500, 1090, 110, 18],
    [700, 1000, 170, 20],     // solid rest ledge (checkpoint)
    [540, 880, 110, 18],
    [330, 770, 110, 18],
    [520, 660, 110, 18],
    [700, 700, 170, 20],      // second rest ledge
    [640, 560, 110, 18],
    [430, 460, 110, 18],
    [620, 380, 110, 18],
    [820, 380, 380, 20]       // top
  ],
  collapsers: [
    [300, 1200, 110], [500, 1090, 110],
    [540, 880, 110], [330, 770, 110], [520, 660, 110],
    [640, 560, 110], [430, 460, 110], [620, 380, 110]
  ],
  spikes: [[200, 1340, 900]],
  saws: [
    { x: 470, y: 860, dx: 0, dy: 1, dist: 260, speed: 1.2, r: 24, offset: 0 },
    { x: 760, y: 460, dx: 0, dy: 1, dist: 220, speed: 1.4, r: 24, offset: 90 }
  ],
  checks: [[770, 958], [770, 658]]
},

// ---------------------------------------------------------------- XI
{
  name: 'THE MACHINE', num: 'XI', w: 3000, h: 540,
  spawn: [100, 438],
  exit: [2870, 480],
  plats: [
    [0, 480, 900, 60],
    [900, 528, 360, 12],
    [1260, 480, 1740, 60]
  ],
  spikes: [[900, 528, 360]],
  stompers: [
    { x: 500, w: 90, y: 60, min: 70, max: 420, period: 150, offset: 0 },
    { x: 680, w: 90, y: 60, min: 70, max: 420, period: 150, offset: 75 },
    { x: 2540, w: 90, y: 60, min: 70, max: 420, period: 140, offset: 20 }
  ],
  movers: [
    { x: 880, y: 440, w: 110, h: 16, dx: 1, dy: 0, dist: 370, speed: 1.7 }
  ],
  pends: [
    { x: 1080, y: 100, len: 260, amp: 0.8, period: 140, offset: 30 }
  ],
  crates: [[1500, 434]],
  plates: [{ x: 1750, w: 70, y: 480, id: 'm' }],
  doors: [{ x: 2100, y: 240, w: 34, h: 240, id: 'm', slow: true }],
  saws: [
    { x: 2230, y: 480, dx: 1, dy: 0, dist: 200, speed: 1.6, r: 26, offset: 0 }
  ],
  checks: [[1330, 438], [1920, 438]],
},

// ---------------------------------------------------------------- XII
{
  name: 'LIGHT', num: 'XII', w: 2200, h: 540,
  spawn: [100, 438],
  exit: [2080, 480],
  bright: true,               // the fog thins as you walk
  plats: [
    [0, 480, 900, 60],
    [1000, 480, 1200, 60]
  ],
  pends: [
    { x: 640, y: 120, len: 280, amp: 0.8, period: 150, offset: 0 }
  ],
  checks: [[1060, 438]]
}

];
