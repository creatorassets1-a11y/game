// SWARM KEEP audio - cheerful battle-march music per world + arcade SFX.
// All synthesized, no files.

const Snd = (() => {
  let ctx = null, master = null, musicBus = null;
  let muted = false, world = -1;
  let stepIdx = 0, nextT = 0, timer = null;

  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  const ROOTS = [130.81, 146.83, 123.47, 110, 98];
  const BASS = [0, 0, 7, 0, 5, 5, 0, 0, 4, 4, 9, 7, 5, 5, 7, 7];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.36;
      musicBus.connect(master);
    } catch (e) { return false; }
    return true;
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.16);
  }
  function snare(t) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(t);
  }
  function bass(t, semi, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'square';
    o.frequency.value = ROOTS[world] / 2 * Math.pow(2, semi / 12);
    f.type = 'lowpass'; f.frequency.value = 460;
    g.gain.setValueAtTime(0.17, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function lead(t, semi, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = world >= 3 ? 'sawtooth' : 'triangle';
    o.frequency.value = ROOTS[world] * 2 * Math.pow(2, semi / 12);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.004, t + dur);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function schedule() {
    if (world < 0) return;
    const bpm = 108 + world * 7;
    const ahead = ctx.currentTime + 0.18;
    while (nextT < ahead) {
      const s = stepIdx % 16;
      const six = 60 / bpm / 4;
      if (s % 4 === 0) kick(nextT);
      if (s % 8 === 4) snare(nextT);
      if (s % 2 === 0) bass(nextT, BASS[s], six * 2);
      const bar = (stepIdx / 16 | 0) % 4;
      if (s % 4 === 2 && bar % 2 === 1) lead(nextT, SCALE[(stepIdx * 3 + bar) % SCALE.length], six * 3);
      nextT += six;
      stepIdx++;
    }
    timer = setTimeout(schedule, 55);
  }

  function blip(freq, dur, type, vol, slide) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function nz(dur, vol, freq, q) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  let lastPew = 0, lastSquish = 0;

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    music(w) {
      if (!ensure()) return;
      world = w;
      if (timer) clearTimeout(timer);
      if (w < 0) return;
      stepIdx = 0;
      nextT = ctx.currentTime + 0.05;
      schedule();
    },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    isMuted() { return muted; },

    pew()     { const n = performance.now(); if (n - lastPew < 80) return; lastPew = n; blip(760, 0.05, 'square', 0.05, 300); },
    thunk()   { blip(160, 0.12, 'sine', 0.16, 60); },
    boom()    { nz(0.2, 0.22, 350, 0.8); blip(90, 0.2, 'sine', 0.2, 40); },
    zap()     { nz(0.07, 0.09, 3000, 3); },
    snipe()   { blip(1200, 0.1, 'sawtooth', 0.08, 200); },
    squish()  { const n = performance.now(); if (n - lastSquish < 70) return; lastSquish = n; blip(230 + Math.random() * 120, 0.08, 'triangle', 0.12, 70); },
    coin()    { blip(1320, 0.05, 'square', 0.07); setTimeout(() => blip(1760, 0.08, 'square', 0.06), 40); },
    leak()    { blip(300, 0.25, 'sawtooth', 0.2, 90); nz(0.15, 0.12, 500, 1); },
    place()   { blip(400, 0.09, 'triangle', 0.14, 600); nz(0.08, 0.1, 900, 1.5); },
    upgrade() { [520, 660, 880].forEach((f, i) => setTimeout(() => blip(f, 0.1, 'square', 0.1), i * 60)); },
    wave()    { blip(392, 0.1, 'square', 0.1); setTimeout(() => blip(523, 0.16, 'square', 0.1), 90); },
    checkpoint() { blip(660, 0.12, 'sine', 0.12, 880); setTimeout(() => blip(990, 0.2, 'sine', 0.1), 110); },
    victory() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'square', 0.12), i * 120)); },
    defeat()  { [400, 320, 240, 160].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'sawtooth', 0.15, f * 0.7), i * 160)); },
    bossDie() { [200, 150, 100, 70].forEach((f, i) => setTimeout(() => { blip(f, 0.3, 'sawtooth', 0.18, f * 0.5); nz(0.2, 0.18, 480, 1); }, i * 110)); },
    deny()    { blip(180, 0.12, 'square', 0.1, 130); },
    ui()      { blip(500, 0.04, 'square', 0.05); },
    go()      { blip(600, 0.1, 'square', 0.1, 900); }
  };
})();
