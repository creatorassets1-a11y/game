// LOCKSTEP audio. A slow dark drum chamber: deep toms on a per-world pulse,
// a drone underneath, drips in the dark, and a synchronized THOOM every time
// the world takes its step with you. All synthesized, no files.

const Snd = (() => {
  let ctx = null, master = null, musicBus = null;
  let muted = false, running = false;
  let stepIdx = 0, nextT = 0, timer = null, dripTimer = null;
  let cfg = null;

  const ROOTS = [55, 49, 58.27, 43.65, 61.74, 51.91, 65.41, 46.25, 55, 41.2];

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.5;
      musicBus.connect(master);
    } catch (e) { return false; }
    return true;
  }

  function tom(t, freq, vol, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(t, dur, vol, freq, q, dest) {
    const buf = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || master);
    src.start(t);
  }

  function bell(t, freq, vol, dur) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq;
    o2.frequency.value = freq * 2.76;   // bell-ish inharmonic partial
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicBus);
    o.start(t); o2.start(t); o.stop(t + dur); o2.stop(t + dur);
  }

  function schedule() {
    if (!running) return;
    const ahead = ctx.currentTime + 0.2;
    while (nextT < ahead) {
      const s = stepIdx % 16;
      const beat = 60 / cfg.bpm / 2;   // eighth notes
      if (cfg.kick[s]) tom(nextT, 62, 0.7, 0.35);
      if (cfg.rim[s]) noise(nextT, 0.03, 0.09, 2200, 4, musicBus);
      if (s === 0 || s === 8) tom(nextT, cfg.root * 1.5, 0.12, 1.4);
      if (cfg.bells && s === 14 && (stepIdx / 16 | 0) % 2 === 1) {
        bell(nextT, cfg.root * 4 * [1, 1.189, 1.335, 1.498][(stepIdx / 16 | 0) % 4], 0.06, 1.8);
      }
      nextT += beat;
      stepIdx++;
    }
    timer = setTimeout(schedule, 60);
  }

  function startDrips() {
    const drip = () => {
      if (!running || !ctx) return;
      const t = ctx.currentTime + 0.01;
      const f = 900 + Math.random() * 1600;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.07);
      g.gain.setValueAtTime(0.045, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.1);
      dripTimer = setTimeout(drip, 2500 + Math.random() * 6000);
    };
    dripTimer = setTimeout(drip, 2000);
  }

  // drone that lives under everything while music runs
  let droneNodes = null;
  function startDrone(root) {
    stopDrone();
    const g = ctx.createGain(); g.gain.value = 0.05;
    const o1 = ctx.createOscillator(); o1.frequency.value = root;
    const o2 = ctx.createOscillator(); o2.frequency.value = root * 1.005;
    o1.connect(g); o2.connect(g); g.connect(musicBus);
    o1.start(); o2.start();
    droneNodes = [o1, o2, g];
  }
  function stopDrone() {
    if (droneNodes) { try { droneNodes[0].stop(); droneNodes[1].stop(); } catch (e) {} droneNodes = null; }
  }

  function hit(freq, dur, vol, slide, type) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function nz(dur, vol, freq, q) {
    if (!ensure() || muted) return;
    noise(ctx.currentTime, dur, vol, freq, q);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); },
    start(worldIdx) {
      if (!ensure()) return;
      this.stop();
      cfg = {
        bpm: 64 + worldIdx * 3.5,
        root: ROOTS[worldIdx % ROOTS.length],
        kick: worldIdx < 4 ? [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0]
                           : [1,0,0,1, 0,0,1,0, 1,0,0,0, 1,0,1,0],
        rim: [0,0,1,0, 1,0,0,1, 0,1,0,0, 1,0,0,1],
        bells: worldIdx >= 2
      };
      stepIdx = 0;
      nextT = ctx.currentTime + 0.05;
      running = true;
      startDrone(cfg.root);
      schedule();
      startDrips();
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      if (dripTimer) clearTimeout(dripTimer);
      if (ctx) stopDrone();
    },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.55; return muted; },
    isMuted() { return muted; },

    // the signature: every step, the whole room answers
    thoom()   { hit(70, 0.16, 0.5, 40); nz(0.09, 0.12, 240, 0.8); },
    bump()    { nz(0.06, 0.16, 160, 1.2); },
    key()     { hit(880, 0.2, 0.12, 1320); hit(1320, 0.3, 0.08); },
    unlock()  { nz(0.15, 0.25, 500, 2); hit(220, 0.2, 0.2, 110); },
    push()    { nz(0.22, 0.2, 180, 0.7); },
    crush()   { nz(0.18, 0.3, 300, 1); hit(150, 0.2, 0.2, 60); },
    fill()    { hit(180, 0.3, 0.25, 60); nz(0.25, 0.2, 400, 0.8); },
    entDie()  { nz(0.14, 0.22, 900, 1.5); hit(400, 0.15, 0.12, 120); },
    wake()    { hit(90, 0.5, 0.25, 190, 'sawtooth'); },
    charge()  { hit(300, 0.4, 0.08, 900, 'triangle'); },
    fire()    { nz(0.2, 0.3, 2400, 3); hit(1200, 0.18, 0.15, 200, 'sawtooth'); },
    rune()    { nz(0.08, 0.3, 3000, 5); hit(500, 0.3, 0.2, 100, 'square'); },
    slide()   { nz(0.18, 0.1, 800, 0.6); },
    death()   { hit(120, 0.6, 0.4, 30); nz(0.4, 0.35, 350, 0.5); },
    undo()    { hit(600, 0.14, 0.1, 300, 'triangle'); },
    win()     { hit(523, 0.3, 0.14, 1046); setTimeout(() => hit(784, 0.5, 0.12), 120); nz(0.5, 0.1, 1200, 0.6); },
    uiMove()  { hit(300, 0.04, 0.05, 0, 'square'); },
    uiGo()    { hit(440, 0.1, 0.1, 660, 'square'); }
  };
})();
