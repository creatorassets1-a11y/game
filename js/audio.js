// SWARM!! audio: fast happy battle music that picks up steam every ten
// waves, plus a bag of arcade SFX. All WebAudio, no files.

const Snd = (() => {
  let ctx = null, master = null, musicBus = null;
  let muted = false, tier = -1;
  let stepIdx = 0, nextT = 0, timer = null;

  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];  // major pentatonic
  const ROOT = 130.81; // C3

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.42;
      musicBus.connect(master);
    } catch (e) { return false; }
    return true;
  }

  function kick(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.18);
  }
  function snare(t) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.09, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(t);
  }
  function hat(t) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.025, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 8000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(t);
  }
  function bass(t, semi, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'square';
    o.frequency.value = ROOT / 2 * Math.pow(2, semi / 12);
    f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 4;
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.02, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function lead(t, semi, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = ROOT * 2 * Math.pow(2, semi / 12);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.004, t + dur);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  const BASSLINE = [0, 0, 7, 0, 5, 5, 0, 0, 9, 9, 7, 5, 4, 4, 7, 7];

  function schedule() {
    if (tier < 0) return;
    const bpm = 128 + tier * 8;
    const ahead = ctx.currentTime + 0.18;
    while (nextT < ahead) {
      const s = stepIdx % 16;
      const sixteenth = 60 / bpm / 4;
      kickPattern(s, nextT);
      if (s % 8 === 4) snare(nextT);
      if (tier >= 1 && s % 2 === 1) hat(nextT);
      if (s % 2 === 0) bass(nextT, BASSLINE[s], sixteenth * 2.2);
      if (tier >= 2) {
        const bar = (stepIdx / 16 | 0) % 4;
        if (s % 4 === 2 || (tier >= 3 && s % 4 === 0)) {
          lead(nextT, SCALE[(stepIdx * 5 + bar * 3) % SCALE.length], sixteenth * 3);
        }
      }
      nextT += sixteenth;
      stepIdx++;
    }
    timer = setTimeout(schedule, 50);
  }
  function kickPattern(s, t) {
    if (s % 4 === 0) kick(t);
    if (tier >= 3 && s === 14) kick(t);
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

  // rate-limit the spammy ones so 30 kills a second doesn't clip
  let lastPew = 0, lastSquish = 0, lastGem = 0;

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    music(t) {
      if (!ensure()) return;
      tier = t;
      if (t < 0) { if (timer) clearTimeout(timer); return; }
      if (timer) clearTimeout(timer);
      stepIdx = 0;
      nextT = ctx.currentTime + 0.05;
      schedule();
    },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    isMuted() { return muted; },

    pew()    { const n = performance.now(); if (n - lastPew < 70) return; lastPew = n; blip(880, 0.07, 'square', 0.06, 220); },
    nova()   { blip(300, 0.18, 'sawtooth', 0.1, 90); },
    zap()    { nz(0.1, 0.12, 3200, 3); blip(1400, 0.09, 'sawtooth', 0.06, 300); },
    whoosh() { nz(0.12, 0.08, 900, 1.2); },
    spit()   { blip(500, 0.1, 'triangle', 0.08, 180); },
    squish() { const n = performance.now(); if (n - lastSquish < 60) return; lastSquish = n; blip(240 + Math.random() * 120, 0.09, 'triangle', 0.14, 70); nz(0.05, 0.1, 700, 1); },
    hurt()   { blip(180, 0.16, 'sawtooth', 0.2, 60); nz(0.1, 0.15, 400, 1); },
    dead()   { blip(300, 0.7, 'sawtooth', 0.25, 40); nz(0.5, 0.3, 300, 0.6); },
    gem()    { const n = performance.now(); if (n - lastGem < 50) return; lastGem = n; blip(1100 + Math.random() * 300, 0.06, 'sine', 0.08, 1700); },
    coin()   { blip(1320, 0.05, 'square', 0.09); setTimeout(() => blip(1760, 0.09, 'square', 0.08), 45); },
    heal()   { blip(660, 0.15, 'sine', 0.12, 990); },
    levelup(){ [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'square', 0.12), i * 70)); },
    pick()   { blip(700, 0.1, 'square', 0.1, 1050); },
    wave()   { blip(392, 0.12, 'square', 0.1); setTimeout(() => blip(523, 0.18, 'square', 0.1), 100); },
    bossRoar(){ blip(90, 0.6, 'sawtooth', 0.3, 45); nz(0.4, 0.2, 250, 0.7); },
    bossDie() { [200, 160, 120, 80].forEach((f, i) => setTimeout(() => { blip(f, 0.3, 'sawtooth', 0.2, f * 0.5); nz(0.2, 0.2, 500, 1); }, i * 120)); },
    victory() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'square', 0.12), i * 130)); },
    ui()     { blip(500, 0.05, 'square', 0.06); },
    go()     { blip(600, 0.1, 'square', 0.1, 900); },
    buy()    { blip(880, 0.08, 'square', 0.1); setTimeout(() => blip(1174, 0.12, 'square', 0.1), 70); setTimeout(() => blip(1568, 0.16, 'square', 0.1), 140); },
    deny()   { blip(200, 0.15, 'square', 0.12, 140); }
  };
})();
