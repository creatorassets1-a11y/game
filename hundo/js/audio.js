// HUNDO audio: a tiny synthwave sequencer + one-shot SFX, all WebAudio,
// zero sample files. Each world gets its own tempo, root note and patterns.

const Beat = (() => {
  let ctx = null, master = null, musicBus = null, duck = null;
  let muted = false;
  let running = false;
  let worldCfg = null;
  let stepIdx = 0, nextStepTime = 0, timer = null;
  let beatT0 = 0, secPerBeat = 0.5;

  const ROOTS = [110, 98, 87.31, 110, 130.81, 98, 82.41, 110, 123.47, 92.5];
  // minor pentatonic offsets
  const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];

  function cfgFor(w) {
    const bpm = 100 + w * 6;
    const root = ROOTS[w % ROOTS.length];
    // patterns get busier in later worlds
    const kick = w < 3 ? [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0]
               : w < 7 ? [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0]
                       : [1,0,0,1, 1,0,0,0, 1,0,1,0, 1,0,0,0];
    const hat  = w < 2 ? [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0]
                       : [0,1,1,0, 1,0,1,1, 0,1,1,0, 1,0,1,1];
    const bassSteps = [0,0,3,0, 5,0,3,0, 0,0,3,0, 7,0,5,3];
    const arp = w >= 4;
    return { bpm, root, kick, hat, bassSteps, arp };
  }

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      duck = ctx.createGain();
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.55;
      musicBus.connect(duck);
      duck.connect(master);
    } catch (e) { return false; }
    return true;
  }

  function kickAt(t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.11);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.25);
    // duck the bus for the pump
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.55, t);
    duck.gain.linearRampToValueAtTime(1, t + 0.18);
  }

  function hatAt(t, open) {
    const len = open ? 0.09 : 0.03;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f); f.connect(g); g.connect(musicBus);
    src.start(t);
  }

  function bassAt(t, freq, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 6;
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    o.connect(f); f.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function arpAt(t, freq) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.002, t + 0.1);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + 0.12);
  }

  function schedule() {
    if (!running) return;
    const ahead = ctx.currentTime + 0.15;
    while (nextStepTime < ahead) {
      const s = stepIdx % 16;
      const c = worldCfg;
      if (c.kick[s]) kickAt(nextStepTime);
      if (c.hat[s]) hatAt(nextStepTime, s % 8 === 6);
      if (s % 2 === 0) {
        const off = c.bassSteps[s];
        bassAt(nextStepTime, c.root * Math.pow(2, off / 12) / 2, secPerBeat / 2);
      }
      if (c.arp && s % 2 === 1) {
        const n = PENTA[(stepIdx * 3 + (stepIdx / 16 | 0)) % PENTA.length];
        arpAt(nextStepTime, c.root * 2 * Math.pow(2, n / 12));
      }
      nextStepTime += secPerBeat / 4;
      stepIdx++;
    }
    timer = setTimeout(schedule, 40);
  }

  // ---- one shots ----------------------------------------------------------
  function blip(freq, dur, type, vol, slide) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function noiseHit(dur, vol, freq, q) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
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

  return {
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    start(worldIdx) {
      if (!ensure()) return;
      this.stop();
      worldCfg = cfgFor(worldIdx);
      secPerBeat = 60 / worldCfg.bpm;
      stepIdx = 0;
      nextStepTime = ctx.currentTime + 0.05;
      beatT0 = nextStepTime;
      running = true;
      schedule();
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
    },
    // 0..1 within the current beat, for pulsing visuals
    phase() {
      if (!ctx || !running) return 0;
      const b = (ctx.currentTime - beatT0) / secPerBeat;
      return b - Math.floor(b);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },

    tap()    { blip(700, 0.06, 'square', 0.08, 900); },
    jump()   { blip(300, 0.1, 'square', 0.1, 520); },
    flip()   { blip(500, 0.12, 'triangle', 0.14, 240); },
    dash()   { noiseHit(0.14, 0.2, 2200, 2); blip(900, 0.12, 'sawtooth', 0.07, 1600); },
    thrust() { noiseHit(0.05, 0.05, 1200, 1.5); },
    land()   { noiseHit(0.05, 0.1, 300, 1); },
    bounce() { blip(240, 0.16, 'sine', 0.18, 720); },
    verb()   { blip(520, 0.09, 'square', 0.12, 780); blip(780, 0.14, 'square', 0.1, 1040); },
    death()  { noiseHit(0.3, 0.4, 400, 0.6); blip(220, 0.3, 'sawtooth', 0.25, 40); },
    win()    { blip(523, 0.12, 'square', 0.12); setTimeout(() => blip(659, 0.12, 'square', 0.12), 90); setTimeout(() => blip(784, 0.25, 'square', 0.14), 180); },
    uiMove() { blip(400, 0.04, 'square', 0.05); },
    uiGo()   { blip(600, 0.08, 'square', 0.09, 900); }
  };
})();
