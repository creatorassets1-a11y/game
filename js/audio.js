// tiny procedural audio - no sample files, everything is synthesized
// keeps the repo light and load instant

const Sfx = (() => {
  let ctx = null;
  let master = null;
  let muted = false;
  let ambience = null;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      startAmbience();
    } catch (e) {
      return false;
    }
    return true;
  }

  // wind + low drone. filtered noise with a slow wobble on the gain
  function startAmbience() {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // brown-ish noise
      last = (last + (Math.random() * 2 - 1) * 0.02);
      last *= 0.998;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;

    const g = ctx.createGain();
    g.gain.value = 0.16;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.07;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);

    // very quiet detuned drone underneath
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.frequency.value = 55;
    o2.frequency.value = 55.7;
    const dg = ctx.createGain();
    dg.gain.value = 0.012;
    o1.connect(dg); o2.connect(dg);
    dg.connect(master);

    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(); lfo.start(); o1.start(); o2.start();
    ambience = g;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol, freq, q) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 800;
    f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },

    step()   { noise(0.05, 0.05, 400 + Math.random() * 200, 2); },
    jump()   { noise(0.09, 0.06, 700, 1.5); },
    land()   { noise(0.08, 0.12, 250, 1); },
    grab()   { noise(0.06, 0.07, 500, 3); },
    push()   { noise(0.1, 0.03, 180, 1); },

    death() {
      noise(0.25, 0.4, 150, 0.7);
      blip(90, 0.5, 'sine', 0.35, 40);
    },
    snap()   { noise(0.06, 0.35, 1800, 4); blip(160, 0.15, 'square', 0.15, 60); }, // bear trap
    slam()   { noise(0.2, 0.35, 120, 0.8); blip(55, 0.4, 'sine', 0.3, 30); },      // stomper
    dart()   { noise(0.08, 0.15, 2400, 6); },
    thunk()  { noise(0.07, 0.2, 300, 2); },
    click()  { blip(700, 0.05, 'square', 0.08); },   // plate
    lever()  { blip(300, 0.1, 'square', 0.1, 200); noise(0.08, 0.1, 900, 3); },
    door()   { noise(0.5, 0.15, 90, 0.8); },
    spark()  { noise(0.05, 0.08, 3000, 8); },
    splash() { noise(0.25, 0.2, 600, 0.8); },
    tick()   { blip(1200, 0.03, 'square', 0.05); },
    check()  { blip(440, 0.3, 'sine', 0.07, 660); },
    win()    { blip(330, 0.6, 'sine', 0.12, 440); blip(440, 0.9, 'sine', 0.1, 550); },
    saw()    { noise(0.12, 0.1, 1600, 5); }
  };
})();
