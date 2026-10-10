'use strict';
// =====================================================================
//  AUDIO — fully synthesized SFX + tracker-style music sequencer
// =====================================================================
const Sound = (() => {
  let ctx = null;
  let master, comp, sfxBus, musicBus, sfxRev, musRev, musDelay, noiseBuf, distCurve;
  let listenerX = W / 2;
  const lastPlay = {};

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { return false; }
    master = ctx.createGain(); master.gain.value = 0.9;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    applyVolumes();

    // reverbs
    const mkRev = (sec, decay, out, wet) => {
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * sec);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      conv.buffer = buf;
      const inp = ctx.createGain();
      const g = ctx.createGain(); g.gain.value = wet;
      inp.connect(conv); conv.connect(g); g.connect(out);
      return inp;
    };
    sfxRev = mkRev(1.6, 3, sfxBus, 0.35);
    musRev = mkRev(2.6, 2.4, musicBus, 0.45);
    // music delay (dotted eighth set per song)
    musDelay = ctx.createGain();
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.38;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    musDelay.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(wet); wet.connect(musicBus);
    musDelay._dl = dl;

    // noise buffer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // distortion
    distCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; distCurve[i] = Math.tanh(x * 3.2); }
    return true;
  }
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  function applyVolumes() {
    if (!ctx) return;
    const s = Save.data.settings;
    musicBus.gain.setTargetAtTime(s.music * 0.95, ctx.currentTime, 0.05);
    sfxBus.gain.setTargetAtTime(s.sfx * 0.9, ctx.currentTime, 0.05);
  }

  // ---------- primitives ----------
  function panNode(pan, out) {
    if (!pan || !ctx.createStereoPanner) return out;
    const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(out); return p;
  }
  function tone(o) {
    const t = o.t, dur = o.dur || 0.1;
    const osc = ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.slide || dur));
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.a || 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol, t + a);
    if (o.hold) g.gain.setValueAtTime(o.vol, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; if (o.q) f.Q.value = o.q; node.connect(f); node = f; }
    if (o.hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; }
    if (o.dist) { const ws = ctx.createWaveShaper(); ws.curve = distCurve; node.connect(ws); node = ws; }
    if (o.vib) {
      const l = ctx.createOscillator(); l.frequency.value = o.vib[0];
      const lg = ctx.createGain(); lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    node.connect(g);
    const out = o.out || sfxBus;
    g.connect(panNode(o.pan, out));
    if (o.rev) { const rg = ctx.createGain(); rg.gain.value = o.rev; g.connect(rg); rg.connect(o.revBus || sfxRev); }
    osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }
  function noise(o) {
    const t = o.t, dur = o.dur || 0.1;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.slide || dur));
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    const a = o.a || 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol, t + a);
    if (o.hold) g.gain.setValueAtTime(o.vol, t + a + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g);
    const out = o.out || sfxBus;
    g.connect(panNode(o.pan, out));
    if (o.rev) { const rg = ctx.createGain(); rg.gain.value = o.rev; g.connect(rg); rg.connect(o.revBus || sfxRev); }
    const off = Math.random() * 1.5;
    src.start(t, off, dur + 0.05);
    return src;
  }

  // ---------- SFX library ----------
  const SFX = {
    slash(t, p, pan) {
      noise({ t, dur: 0.14, vol: 0.32, type: 'bandpass', f: 1500 * p, f2: 5200 * p, q: 1.3, pan });
      tone({ t, type: 'sine', f: 1100 * p, f2: 380 * p, dur: 0.09, vol: 0.05, pan });
    },
    slashHeavy(t, p, pan) {
      noise({ t, dur: 0.24, vol: 0.38, type: 'bandpass', f: 700 * p, f2: 3800 * p, q: 1.1, pan, rev: 0.15 });
      tone({ t, type: 'sawtooth', f: 240 * p, f2: 70, dur: 0.18, vol: 0.09, lp: 900, pan });
    },
    hit(t, p, pan) {
      tone({ t, type: 'sine', f: 210 * p, f2: 55, dur: 0.12, vol: 0.42, pan });
      noise({ t, dur: 0.07, vol: 0.3, type: 'lowpass', f: 4200, f2: 500, pan });
      tone({ t, type: 'square', f: 130 * p, f2: 60, dur: 0.05, vol: 0.06, lp: 1500, pan });
    },
    hitHeavy(t, p, pan) {
      tone({ t, type: 'sine', f: 170 * p, f2: 38, dur: 0.22, vol: 0.55, pan });
      noise({ t, dur: 0.16, vol: 0.4, type: 'lowpass', f: 5000, f2: 300, pan, rev: 0.2 });
      tone({ t, type: 'square', f: 90 * p, f2: 40, dur: 0.12, vol: 0.12, dist: true, lp: 1800, pan });
    },
    crit(t, p, pan) {
      SFX.hit(t, p, pan);
      tone({ t, type: 'triangle', f: 1760, f2: 1720, dur: 0.3, vol: 0.1, pan, rev: 0.3 });
      tone({ t: t + 0.01, type: 'sine', f: 2637, dur: 0.22, vol: 0.06, pan });
    },
    shoot(t, p, pan) {
      tone({ t, type: 'square', f: 1300 * p, f2: 260, dur: 0.07, vol: 0.075, lp: 4000, pan });
      noise({ t, dur: 0.045, vol: 0.12, type: 'highpass', f: 2500, pan });
    },
    shotgun(t, p, pan) {
      noise({ t, dur: 0.32, vol: 0.45, type: 'lowpass', f: 5000, f2: 250, pan, rev: 0.2 });
      tone({ t, type: 'sine', f: 140, f2: 38, dur: 0.22, vol: 0.45, pan });
    },
    explode(t, p, pan) {
      noise({ t, dur: 0.75, vol: 0.55, type: 'lowpass', f: 2600 * p, f2: 90, pan, rev: 0.3 });
      tone({ t, type: 'sine', f: 95 * p, f2: 28, dur: 0.55, vol: 0.55, pan });
      tone({ t, type: 'square', f: 60, f2: 30, dur: 0.3, vol: 0.12, dist: true, lp: 700, pan });
    },
    jump(t, p, pan) { tone({ t, type: 'square', f: 280 * p, f2: 560 * p, dur: 0.09, vol: 0.055, lp: 2200, pan }); },
    djump(t, p, pan) {
      tone({ t, type: 'triangle', f: 420 * p, f2: 950 * p, dur: 0.13, vol: 0.09, pan });
      noise({ t, dur: 0.12, vol: 0.08, type: 'bandpass', f: 2200, f2: 4000, pan });
    },
    land(t, p, pan) {
      noise({ t, dur: 0.07, vol: 0.16, type: 'lowpass', f: 900, pan });
      tone({ t, type: 'sine', f: 130, f2: 60, dur: 0.07, vol: 0.12, pan });
    },
    dash(t, p, pan) {
      noise({ t, dur: 0.24, vol: 0.28, type: 'bandpass', f: 600 * p, f2: 3600 * p, slide: 0.12, q: 0.8, pan });
      tone({ t, type: 'sine', f: 320 * p, f2: 980 * p, dur: 0.14, vol: 0.04, pan });
    },
    hurt(t, p, pan) {
      tone({ t, type: 'sawtooth', f: 560, f2: 110, dur: 0.26, vol: 0.13, lp: 2200, pan });
      noise({ t, dur: 0.15, vol: 0.22, type: 'lowpass', f: 3000, f2: 400, pan });
      tone({ t, type: 'sine', f: 160, f2: 45, dur: 0.18, vol: 0.4, pan });
    },
    enemyDie(t, p, pan) {
      noise({ t, dur: 0.38, vol: 0.28, type: 'bandpass', f: 1500 * p, f2: 160, q: 1.4, pan, rev: 0.2 });
      tone({ t, type: 'square', f: 520 * p, f2: 90, dur: 0.24, vol: 0.06, lp: 2500, pan });
      tone({ t, type: 'sine', f: 120, f2: 40, dur: 0.2, vol: 0.3, pan });
    },
    coin(t, p, pan) {
      tone({ t, type: 'square', f: 988 * p, dur: 0.06, vol: 0.04, lp: 5000, pan });
      tone({ t: t + 0.05, type: 'square', f: 1319 * p, dur: 0.14, vol: 0.04, lp: 5000, pan });
    },
    pickup(t, p, pan) {
      [523, 659, 784, 1047].forEach((f, i) => tone({ t: t + i * 0.05, type: 'triangle', f: f * p, dur: 0.16, vol: 0.09, pan, rev: 0.2 }));
    },
    upgrade(t) {
      [523, 659, 784, 988, 1319, 1568].forEach((f, i) => tone({ t: t + i * 0.035, type: 'sine', f, dur: 1.3, vol: 0.05, rev: 0.6 }));
      noise({ t, dur: 0.9, vol: 0.08, type: 'highpass', f: 2000, f2: 9000, rev: 0.5 });
    },
    select(t) { tone({ t, type: 'triangle', f: 760, dur: 0.05, vol: 0.06 }); },
    confirm(t) {
      tone({ t, type: 'square', f: 660, dur: 0.06, vol: 0.05, lp: 3500 });
      tone({ t: t + 0.06, type: 'square', f: 990, dur: 0.12, vol: 0.05, lp: 3500, rev: 0.2 });
    },
    cancel(t) { tone({ t, type: 'square', f: 480, f2: 300, dur: 0.1, vol: 0.05, lp: 3000 }); },
    error(t) { tone({ t, type: 'square', f: 140, dur: 0.18, vol: 0.07, lp: 1200 }); tone({ t: t + 0.09, type: 'square', f: 110, dur: 0.16, vol: 0.06, lp: 1200 }); },
    door(t) {
      noise({ t, dur: 0.7, vol: 0.18, type: 'bandpass', f: 300, f2: 2600, q: 0.7, rev: 0.4 });
      [262, 392, 523, 784].forEach((f, i) => tone({ t: t + 0.05 + i * 0.06, type: 'sine', f, dur: 0.9, vol: 0.05, rev: 0.5 }));
    },
    spawn(t, p, pan) {
      tone({ t, type: 'sine', f: 180 * p, f2: 900 * p, dur: 0.55, vol: 0.06, pan, rev: 0.3 });
      noise({ t, dur: 0.45, vol: 0.05, type: 'highpass', f: 800, f2: 6000, pan });
    },
    thunder(t, p, pan) {
      noise({ t, dur: 0.1, vol: 0.38, type: 'highpass', f: 1800, pan });
      noise({ t: t + 0.02, dur: 0.85, vol: 0.32, type: 'lowpass', f: 600, f2: 120, pan, rev: 0.35 });
      tone({ t, type: 'square', f: 70, f2: 40, dur: 0.3, vol: 0.08, dist: true, lp: 600, pan });
    },
    zap(t, p, pan) {
      tone({ t, type: 'sawtooth', f: 1800 * p, f2: 400, dur: 0.09, vol: 0.06, pan });
      noise({ t, dur: 0.07, vol: 0.12, type: 'highpass', f: 4000, pan });
    },
    fire(t, p, pan) {
      noise({ t, dur: 0.42, vol: 0.22, type: 'bandpass', f: 800 * p, f2: 300, q: 0.6, pan });
      tone({ t, type: 'sine', f: 110, f2: 55, dur: 0.3, vol: 0.18, pan });
    },
    ice(t, p, pan) {
      [2093, 2637, 3136].forEach((f, i) => tone({ t: t + i * 0.025, type: 'triangle', f: f * p, dur: 0.3, vol: 0.045, pan, rev: 0.3 }));
      noise({ t, dur: 0.12, vol: 0.14, type: 'highpass', f: 6000, pan });
    },
    shatter(t, p, pan) {
      noise({ t, dur: 0.3, vol: 0.3, type: 'highpass', f: 3000, f2: 1200, pan, rev: 0.3 });
      [1568, 2349, 3136, 3951].forEach((f, i) => tone({ t: t + i * 0.02, type: 'triangle', f: f * rand(0.97, 1.03), dur: 0.35, vol: 0.04, pan }));
    },
    void(t, p, pan) {
      tone({ t, type: 'sine', f: 620 * p, f2: 70, dur: 0.55, vol: 0.14, pan, rev: 0.4 });
      tone({ t, type: 'triangle', f: 310 * p, f2: 40, dur: 0.55, vol: 0.1, vib: [18, 30], pan });
    },
    heal(t) {
      tone({ t, type: 'sine', f: 523, f2: 1047, dur: 0.5, vol: 0.09, rev: 0.4 });
      tone({ t: t + 0.08, type: 'triangle', f: 659, f2: 1319, dur: 0.5, vol: 0.06, rev: 0.4 });
    },
    ultCharge(t) {
      tone({ t, type: 'sawtooth', f: 70, f2: 900, dur: 0.9, vol: 0.1, lp: 3000, rev: 0.3 });
      noise({ t, dur: 0.9, vol: 0.12, type: 'bandpass', f: 300, f2: 6000, q: 2 });
    },
    ultBoom(t) {
      SFX.explode(t, 0.8, 0);
      tone({ t, type: 'sawtooth', f: 55, f2: 30, dur: 1.2, vol: 0.15, dist: true, lp: 800 });
      [262, 330, 392, 523].forEach(f => tone({ t, type: 'sawtooth', f, dur: 1.1, vol: 0.03, lp: 2000, rev: 0.5 }));
    },
    roar(t) {
      tone({ t, type: 'sawtooth', f: 72, f2: 50, dur: 1.5, vol: 0.2, lp: 700, vib: [7, 9], dist: true, hold: 0.6 });
      tone({ t, type: 'sawtooth', f: 76, f2: 52, dur: 1.5, vol: 0.16, lp: 600, vib: [5, 11], hold: 0.6 });
      noise({ t, dur: 1.3, vol: 0.25, type: 'lowpass', f: 700, f2: 200, hold: 0.5, rev: 0.4 });
    },
    warn(t, p, pan) {
      tone({ t, type: 'square', f: 1500 * p, dur: 0.05, vol: 0.035, pan });
      tone({ t: t + 0.07, type: 'square', f: 1500 * p, dur: 0.05, vol: 0.035, pan });
    },
    clank(t, p, pan) {
      tone({ t, type: 'square', f: 1850 * p, dur: 0.16, vol: 0.06, pan, rev: 0.3 });
      tone({ t, type: 'square', f: 2770 * p, dur: 0.12, vol: 0.045, pan });
      noise({ t, dur: 0.05, vol: 0.2, type: 'highpass', f: 3000, pan });
    },
    laser(t, p, pan) {
      tone({ t, type: 'sawtooth', f: 900 * p, f2: 200, dur: 0.18, vol: 0.07, lp: 3500, pan });
      tone({ t, type: 'square', f: 1350 * p, f2: 300, dur: 0.14, vol: 0.04, pan });
    },
    beam(t, p, pan) {
      tone({ t, type: 'sawtooth', f: 110, dur: 1.6, vol: 0.12, lp: 1400, vib: [30, 8], hold: 1.1, rev: 0.3 });
      tone({ t, type: 'square', f: 55, dur: 1.6, vol: 0.08, lp: 600, hold: 1.1 });
      noise({ t, dur: 1.6, vol: 0.18, type: 'bandpass', f: 1800, q: 0.5, hold: 1.1 });
    },
    charge(t, p, pan) { tone({ t, type: 'sawtooth', f: 90, f2: 320, dur: 0.45, vol: 0.08, lp: 1400, pan }); },
    swoosh(t, p, pan) { noise({ t, dur: 0.09, vol: 0.18, type: 'bandpass', f: 3000 * p, f2: 7000, q: 2, pan }); },
    clear(t) {
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ t: t + i * 0.07, type: 'square', f, dur: 0.25, vol: 0.045, lp: 4000, rev: 0.3 }));
    },
    bossDie(t) {
      for (let i = 0; i < 5; i++) SFX.explode(t + i * 0.28, 0.8 + i * 0.1, rand(-0.5, 0.5));
      tone({ t, type: 'sawtooth', f: 400, f2: 30, dur: 2.2, vol: 0.12, lp: 1500, rev: 0.6 });
    },
    blip(t) { tone({ t, type: 'square', f: 1300, dur: 0.025, vol: 0.025, lp: 4000 }); },
    buy(t) { SFX.coin(t, 1, 0); SFX.coin(t + 0.08, 1.2, 0); SFX.pickup(t + 0.1, 1, 0); },
    chest(t) {
      noise({ t, dur: 0.3, vol: 0.15, type: 'lowpass', f: 1200 });
      [392, 523, 659, 784, 1047].forEach((f, i) => tone({ t: t + 0.15 + i * 0.05, type: 'triangle', f, dur: 0.4, vol: 0.07, rev: 0.4 }));
    },
    gong(t) {
      [98, 196, 247, 294].forEach(f => tone({ t, type: 'sine', f, dur: 2.5, vol: 0.12, rev: 0.6 }));
      noise({ t, dur: 0.5, vol: 0.1, type: 'lowpass', f: 600 });
    },
    stomp(t, p, pan) {
      tone({ t, type: 'sine', f: 110 * p, f2: 30, dur: 0.35, vol: 0.55, pan });
      noise({ t, dur: 0.3, vol: 0.35, type: 'lowpass', f: 1200, f2: 100, pan, rev: 0.2 });
    },
    shield(t, p, pan) {
      tone({ t, type: 'triangle', f: 880, f2: 1760, dur: 0.25, vol: 0.07, pan, rev: 0.3 });
      noise({ t, dur: 0.2, vol: 0.08, type: 'highpass', f: 5000, pan });
    },
    perfect(t, p, pan) { // 见切: reversed swell + crystalline chime
      noise({ t, dur: 0.35, vol: 0.18, type: 'bandpass', f: 6000, f2: 900, q: 1.5, pan });
      [1568, 2093, 2637].forEach((f, i) => tone({ t: t + 0.03 + i * 0.03, type: 'sine', f, dur: 0.9, vol: 0.07, pan, rev: 0.6 }));
      tone({ t, type: 'sine', f: 120, f2: 60, dur: 0.4, vol: 0.25, pan });
    },
    parry(t, p, pan) {
      tone({ t, type: 'square', f: 2400 * p, dur: 0.22, vol: 0.06, pan, rev: 0.4 });
      tone({ t, type: 'triangle', f: 3600 * p, dur: 0.35, vol: 0.06, pan, rev: 0.5 });
      noise({ t, dur: 0.08, vol: 0.3, type: 'highpass', f: 3500, pan });
      tone({ t, type: 'sine', f: 180, f2: 80, dur: 0.2, vol: 0.3, pan });
    },
    chargeLv(t, p, pan) {
      tone({ t, type: 'triangle', f: 880 * p, f2: 1320 * p, dur: 0.18, vol: 0.08, pan, rev: 0.3 });
      tone({ t: t + 0.05, type: 'sine', f: 1760 * p, dur: 0.3, vol: 0.05, pan, rev: 0.4 });
    },
    teleport(t, p, pan) {
      tone({ t, type: 'sine', f: 1500 * p, f2: 200, dur: 0.25, vol: 0.08, pan });
      noise({ t, dur: 0.2, vol: 0.1, type: 'bandpass', f: 4000, f2: 800, pan });
    },
    // a spear thrust: a narrow, rising hiss with a glint on top
    thrust(t, p, pan) {
      noise({ t, dur: 0.09, vol: 0.28, type: 'bandpass', f: 2600 * p, f2: 6200 * p, q: 2.2, pan });
      tone({ t, type: 'triangle', f: 900 * p, f2: 1700 * p, dur: 0.06, vol: 0.05, pan });
    },
    // water bursting up: a falling wash of noise and a few bubbles
    splash(t, p, pan) {
      noise({ t, dur: 0.34, vol: 0.3, type: 'lowpass', f: 2600 * p, f2: 420, q: 0.8, pan, rev: 0.25 });
      for (let i = 0; i < 3; i++) tone({ t: t + 0.03 + i * 0.045, type: 'sine', f: (480 + i * 230) * p, f2: (900 + i * 320) * p, dur: 0.07, vol: 0.06, pan });
    },
  };
  const throttle = { hit: 0.035, hitHeavy: 0.05, crit: 0.05, slash: 0.03, shoot: 0.04, enemyDie: 0.05, coin: 0.04, zap: 0.05, fire: 0.12, ice: 0.08, explode: 0.06, thunder: 0.08, swoosh: 0.03, warn: 0.15, land: 0.08, clank: 0.08, thrust: 0.03, splash: 0.08 };

  function play(name, opts = {}) {
    if (!ctx || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = ctx.currentTime;
    const th = throttle[name] || 0.02;
    if (lastPlay[name] && now - lastPlay[name] < th) return;
    lastPlay[name] = now;
    let pan = 0;
    if (opts.x !== undefined) pan = clamp((opts.x - listenerX) / 260, -1, 1) * 0.7;
    const p = (opts.pitch || 1) * (opts.vary === false ? 1 : rand(0.94, 1.06));
    try { fn(now + 0.005, p, pan); } catch (e) { if (window.__debugAudio) console.error('sfx', name, e); }
  }

  // =================================================================
  //  MUSIC
  // =================================================================
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const midiCache = {};
  function midi(n) {
    if (midiCache[n] !== undefined) return midiCache[n];
    const m = n.match(/^([A-G][#b]?)(-?\d)$/);
    const v = m ? NOTE[m[1]] + (parseInt(m[2], 10) + 1) * 12 : null;
    midiCache[n] = v; return v;
  }
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);
  const QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], sus4: [0, 5, 7], sus2: [0, 2, 7], m9: [0, 3, 7, 14], add9: [0, 4, 7, 14] };
  function chord(sym) {
    const m = sym.match(/^([A-G][#b]?)(.*)$/);
    return { root: NOTE[m[1]], iv: QUAL[m[2]] || QUAL[''] };
  }
  function chordTones(ch, base) { // ascending list of chord tones starting at octave `base`
    const out = [];
    for (let o = 0; o < 3; o++) for (const iv of ch.iv) out.push((base + 1) * 12 + ch.root + iv + o * 12);
    return out.sort((a, b) => a - b);
  }

  const DRUMS = {
    none: {},
    taikoA: { k: 'x.......x.......', s: '........x.......' },
    taiko: { k: 'x..x....x.x.....', s: '....x.......x...', h: '..x...x...x...x.' },
    taikoB: { k: 'x..x..x.x.x.x...', s: '....x..x....x.xx', h: 'x.x.x.x.x.x.x.x.' },
    intro: { k: 'x.......x.......', h: '....x.......x...' },
    synth: { k: 'x.......x..x....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    four: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', o: '..............x.' },
    drive: { k: 'x..x..x.x..x..x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
    half: { k: 'x.........x.....', s: '........x.......', h: 'x...x...x...x...' },
    gallop: { k: 'x.xx.xx.x.xx.xx.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '...............x' },
    shaker: { k: 'x.......x.......', s: '........x.......', h: '.xxx.xxx.xxx.xxx' },
    lofi: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    fill: { k: 'x...x...x...x.x.', s: '....x...x.xxxxxx', h: 'x.x.x.x.x.x.....' },
  };
  const BASS = {
    pulse8: 'R.R.R.R.R.R.R.R.',
    oct8: 'R.O.R.O.R.O.R.O.',
    long: 'R---------------',
    drive16: 'RRRRRRRRRRRRRRRR',
    gallop: 'R.RR.RR.R.RR.RR.',
    synco: 'R..R..R.R..R.O..',
    walk: 'R---F---O---F---',
    half: 'R-------F-------',
  };
  const ARP = {
    up16: '0123012301230123',
    updown: '0123432101234321',
    up8: '0.1.2.3.0.1.2.3.',
    bell: '0...2...4...2...',
    wide: '0.2.4.6.4.2.0.2.',
  };

  // Lead melodies: one string per bar, 16 tokens. '-' = hold, '.' = rest
  const SONGS = {
    bamboo: {
      bpm: 106, kit: 'taiko', inst: { lead: 'shaku', arp: 'koto', bass: 'sub' }, delay: 0.75,
      sections: {
        I: { chords: ['Am', 'Am', 'F', 'G'], drums: 'taikoA', bass: 'long', arp: 'bell', pad: true },
        A: {
          chords: ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'Am'], drums: 'taiko', bass: 'half', arp: 'up8', pad: true, lead: [
            'A4 - - - C5 - D5 - E5 - - - - - D5 -',
            'C5 - - - - - A4 - G4 - - - A4 - - -',
            'D5 - - - E5 - G5 - E5 - - - D5 - - -',
            'E5 - - - - - - - . . B4 - D5 - E5 -',
            'A5 - - - G5 - E5 - D5 - - - E5 - - -',
            'C5 - - - D5 - C5 - A4 - - - G4 - - -',
            'A4 - - - C5 - D5 - G5 - - - E5 - D5 -',
            'E5 - - - - - D5 - C5 - - - A4 - - -',
          ]
        },
        B: {
          chords: ['Dm', 'Am', 'C', 'G', 'Dm', 'Am', 'Em', 'Em'], drums: 'taikoB', bass: 'walk', arp: 'updown', pad: true, lead: [
            'D5 - - - F5 - A5 - G5 - - - F5 - D5 -',
            'E5 - - - - - C5 - A4 - - - C5 - E5 -',
            'G5 - - - E5 - D5 - C5 - - - D5 - E5 -',
            'D5 - - - - - - - B4 - - - G4 - - -',
            'D5 - - - F5 - A5 - C6 - - - A5 - G5 -',
            'A5 - - - G5 - E5 - C5 - - - E5 - - -',
            'G5 - - - E5 - D5 - B4 - - - D5 - - -',
            'E5 - - - - - - - . . . . E4 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    title: {
      bpm: 84, kit: 'taiko', inst: { lead: 'shaku', arp: 'koto', bass: 'sub' }, delay: 0.75,
      sections: {
        I: { chords: ['Am', 'F', 'C', 'G'], drums: 'none', bass: 'long', arp: 'bell', pad: true },
        A: {
          chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'], drums: 'half', bass: 'half', arp: 'bell', pad: true, lead: [
            'E5 - - - - - - - D5 - - - C5 - - -',
            'A4 - - - - - - - - - - - . . . .',
            'G4 - - - C5 - - - E5 - - - D5 - - -',
            'D5 - - - - - - - B4 - - - . . . .',
            'E5 - - - A5 - - - G5 - - - E5 - - -',
            'F5 - - - E5 - - - C5 - - - A4 - - -',
            'B4 - - - D5 - - - G5 - - - F5 - - -',
            'E5 - - - - - - - G#4 - - - B4 - - -',
          ]
        },
      }, order: ['I', 'A', 'A', 'I'],
    },
    crystal: {
      bpm: 100, inst: { lead: 'flute', arp: 'bell', bass: 'sub' }, delay: 0.75,
      sections: {
        I: { chords: ['Dm', 'Bb', 'Gm', 'A'], drums: 'none', bass: 'long', arp: 'bell', pad: true },
        A: {
          chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'C', 'Bb', 'A'], drums: 'shaker', bass: 'walk', arp: 'updown', pad: true, lead: [
            'D5 - - - - - F5 - A5 - - - - - G5 -',
            'F5 - - - - - - - D5 - - - - - - -',
            'G5 - - - Bb5 - - - A5 - - - G5 - - -',
            'E5 - - - - - - - C#5 - - - - - - -',
            'D5 - - - F5 - - - A5 - - - D6 - - -',
            'C6 - - - - - Bb5 - A5 - - - G5 - - -',
            'F5 - - - G5 - - - D5 - - - Bb4 - - -',
            'A4 - - - C#5 - - - E5 - - - A5 - - -',
          ]
        },
        B: {
          chords: ['Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'Eb', 'A'], drums: 'half', bass: 'half', arp: 'up16', pad: true, lead: [
            'Bb5 - - - A5 - G5 - - - D5 - - - - -',
            'F5 - - - - - E5 - D5 - - - - - - -',
            'D5 - - - F5 - Bb5 - - - A5 - - - F5 -',
            'E5 - - - - - - - - - - - . . . .',
            'G5 - - - Bb5 - D6 - - - C6 - Bb5 - A5 -',
            'A5 - - - - - F5 - - - D5 - - - - -',
            'G5 - - - - - Eb5 - - - Bb4 - - - G4 -',
            'A4 - - - - - - - C#5 - - - E5 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A'],
    },
    core: {
      bpm: 138, inst: { lead: 'square', arp: 'pulse', bass: 'saw' }, delay: 0.75,
      sections: {
        I: { chords: ['Em', 'Em', 'C', 'B'], drums: 'intro', bass: 'drive16', arp: 'up16' },
        A: {
          chords: ['Em', 'C', 'D', 'B', 'Em', 'F', 'Em', 'B'], drums: 'drive', bass: 'drive16', arp: 'up16', lead: [
            'E5 - - B4 - - E5 - G5 - - - F#5 - E5 -',
            'G5 - - - - - E5 - C5 - - - E5 - G5 -',
            'A5 - - - F#5 - - - D5 - - - F#5 - A5 -',
            'B5 - - - - - - - A5 - G5 - F#5 - D#5 -',
            'E5 - - - G5 - B5 - - - A5 - G5 - - -',
            'F5 - - - A5 - C6 - - - B5 - A5 - - -',
            'G5 - - - F#5 - E5 - - - D5 - E5 - - -',
            'D#5 - - - - - F#5 - - - B5 - - - - -',
          ]
        },
        B: {
          chords: ['C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'], drums: 'four', bass: 'oct8', arp: 'updown', pad: true, lead: [
            'E5 - - - - - G5 - - - C6 - - - B5 -',
            'A5 - - - - - F#5 - - - D5 - - - - -',
            'E5 - - - G5 - - - B5 - - - E6 - - -',
            'D6 - - - B5 - - - G5 - - - E5 - - -',
            'C6 - - - B5 - G5 - - - E5 - G5 - C6 -',
            'D6 - - - - - A5 - - - F#5 - - - D5 -',
            'D#5 - - - F#5 - - - B5 - - - A5 - - -',
            'F#5 - - - - - - - D#5 - - - - - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    // 苍雪寒山 — hushed hirajoshi on koto and shakuhachi over bell arps
    snow: {
      bpm: 92, kit: 'taiko', inst: { lead: 'shaku', arp: 'bell', bass: 'sub' }, delay: 0.75,
      sections: {
        I: { chords: ['Dm', 'Bb', 'Dm', 'A'], drums: 'none', bass: 'long', arp: 'bell', pad: true },
        A: {
          chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'F', 'Bb', 'A'], drums: 'taikoA', bass: 'half', arp: 'bell', pad: true, lead: [
            'D5 - - - E5 - F5 - - - A5 - - - - -',
            'Bb5 - - - A5 - - - F5 - - - - - - -',
            'G5 - - - F5 - E5 - D5 - - - - - . .',
            'E5 - - - - - - - A4 - - - - - - -',
            'D5 - - - F5 - A5 - - - D6 - - - - -',
            'C6 - - - A5 - - - F5 - - - A5 - - -',
            'Bb5 - - - A5 - F5 - - - E5 - D5 - - -',
            'E5 - - - - - - - C#5 - - - - - - -',
          ]
        },
        B: {
          chords: ['Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'Eb', 'A'], drums: 'half', bass: 'walk', arp: 'updown', pad: true, lead: [
            'G5 - - - Bb5 - - - A5 - - - F5 - - -',
            'D5 - - - - - E5 - F5 - - - - - - -',
            'F5 - - - G5 - - - Bb5 - - - A5 - G5 -',
            'A5 - - - - - - - E5 - - - - - - -',
            'D6 - - - - - Bb5 - A5 - - - G5 - - -',
            'F5 - - - - - E5 - D5 - - - - - - -',
            'Eb5 - - - G5 - - - Bb5 - - - G5 - - -',
            'A5 - - - - - - - C#5 - - - E5 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A'],
    },
    // 雪女 — a cold, racing koto duel
    bossSnow: {
      bpm: 144, kit: 'taiko', inst: { lead: 'koto', arp: 'bell', bass: 'saw' }, delay: 0.5,
      sections: {
        I: { chords: ['Dm', 'Dm', 'Bb', 'A'], drums: 'drive', bass: 'gallop', arp: 'up16' },
        A: {
          chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'], drums: 'gallop', bass: 'gallop', arp: 'up16', lead: [
            'D6 - A5 - F5 - A5 - D6 - E6 - F6 - E6 -',
            'D6 - - - Bb5 - - - F5 - - - D5 - - -',
            'E5 - G5 - C6 - - - E6 - D6 - C6 - G5 -',
            'A5 - - - - - - - C#6 - - - E6 - - -',
            'F6 - E6 - D6 - A5 - F5 - A5 - D6 - - -',
            'D6 - - - F6 - - - Bb5 - - - D6 - - -',
            'G5 - Bb5 - D6 - G6 - F6 - E6 - D6 - Bb5 -',
            'A5 - - - - - - - E5 - - - C#5 - - -',
          ]
        },
        B: {
          chords: ['Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'Eb', 'A'], drums: 'four', bass: 'drive16', arp: 'updown', pad: true, lead: [
            'Bb5 - - - A5 - G5 - - - D5 - - - - -',
            'F5 - - - - - E5 - D5 - - - - - - -',
            'D5 - - - F5 - Bb5 - - - A5 - - - F5 -',
            'E5 - - - - - - - C#5 - - - - - - -',
            'G5 - - - Bb5 - D6 - - - C6 - Bb5 - A5 -',
            'A5 - - - - - F5 - - - D5 - - - - -',
            'G5 - - - - - Eb5 - - - Bb4 - - - G4 -',
            'A4 - - - - - - - C#5 - - - E5 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    boss: {
      bpm: 150, kit: 'taiko', inst: { lead: 'saw', arp: 'pulse', bass: 'saw' }, delay: 0.5,
      sections: {
        I: { chords: ['Cm', 'Cm', 'Ab', 'G'], drums: 'drive', bass: 'gallop' },
        A: {
          chords: ['Cm', 'Ab', 'Bb', 'G', 'Cm', 'Ab', 'Fm', 'G'], drums: 'gallop', bass: 'gallop', arp: 'up16', lead: [
            'C5 - - - Eb5 - G5 - - - F5 - Eb5 - D5 -',
            'Eb5 - - - - - C5 - - - Ab4 - - - C5 -',
            'D5 - - - F5 - Bb5 - - - Ab5 - G5 - F5 -',
            'G5 - - - - - - - D5 - - - B4 - - -',
            'C6 - - - Bb5 - G5 - - - Eb5 - G5 - C6 -',
            'Ab5 - - - G5 - Eb5 - - - C5 - Eb5 - Ab5 -',
            'F5 - - - Ab5 - C6 - - - Bb5 - Ab5 - F5 -',
            'G5 - - - B5 - D6 - - - - - B5 - - -',
          ]
        },
        B: {
          chords: ['Fm', 'Cm', 'Ab', 'G', 'Fm', 'Cm', 'D', 'G'], drums: 'four', bass: 'drive16', arp: 'updown', pad: true, lead: [
            'Ab5 - - - - - G5 - F5 - - - - - C5 -',
            'Eb5 - - - - - D5 - C5 - - - G4 - - -',
            'C5 - - - Eb5 - Ab5 - - - G5 - F5 - Eb5 -',
            'D5 - - - - - - - B4 - - - D5 - - -',
            'F5 - - - Ab5 - C6 - - - Db6 - C6 - Ab5 -',
            'G5 - - - - - Eb5 - - - C5 - Eb5 - G5 -',
            'F#5 - - - A5 - - - D6 - - - C6 - - -',
            'B5 - - - - - - - G5 - - - D5 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    final: {
      bpm: 158, inst: { lead: 'saw', arp: 'pulse', bass: 'saw' }, delay: 0.5,
      sections: {
        A: {
          chords: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'D', 'B'], drums: 'drive', bass: 'gallop', arp: 'up16', lead: [
            'B5 - - - - - G5 - E5 - - - G5 - B5 -',
            'C6 - - - - - B5 - G5 - - - E5 - - -',
            'A5 - - - C6 - E6 - - - D6 - C6 - B5 -',
            'B5 - - - - - - - F#5 - - - D#5 - - -',
            'E6 - - - D6 - B5 - - - G5 - B5 - E6 -',
            'E6 - - - D6 - C6 - - - G5 - - - E5 -',
            'F#5 - - - A5 - D6 - - - C6 - A5 - F#5 -',
            'D#6 - - - - - B5 - - - F#5 - - - - -',
          ]
        },
        B: { chords: ['Em', 'Em', 'C', 'B'], drums: 'half', bass: 'long', arp: 'up16', pad: true },
        C: { chords: ['Am', 'B', 'Em', 'Em'], drums: 'fill', bass: 'drive16', arp: 'updown' },
      }, order: ['A', 'A', 'B', 'C', 'A'],
    },
    // 瘴雨沼泽 — a slow, damp lament: flute over plucked koto
    mire: {
      bpm: 84, inst: { lead: 'flute', arp: 'koto', bass: 'sub' }, delay: 0.75,
      sections: {
        I: { chords: ['Em', 'C', 'Em', 'B'], drums: 'none', bass: 'long', arp: 'bell', pad: true },
        A: {
          chords: ['Em', 'C', 'Am', 'B', 'Em', 'G', 'Am', 'B'], drums: 'half', bass: 'half', arp: 'up8', pad: true, lead: [
            'E5 - - - - - G5 - F#5 - - - E5 - - -',
            'C5 - - - - - - - E5 - - - D5 - C5 -',
            'A4 - - - C5 - E5 - - - D5 - C5 - - -',
            'B4 - - - - - - - D#5 - - - F#5 - - -',
            'G5 - - - - - F#5 - E5 - - - B4 - - -',
            'D5 - - - - - B4 - G4 - - - B4 - D5 -',
            'C5 - - - - - B4 - A4 - - - E5 - - -',
            'D#5 - - - - - - - B4 - - - - - - -',
          ]
        },
        B: {
          chords: ['Am', 'Em', 'C', 'B', 'Am', 'Em', 'F', 'B'], drums: 'lofi', bass: 'walk', arp: 'updown', pad: true, lead: [
            'A5 - - - G5 - E5 - - - C5 - - - - -',
            'B4 - - - - - E5 - G5 - - - - - - -',
            'E5 - - - G5 - - - C6 - - - B5 - A5 -',
            'B5 - - - - - - - F#5 - - - - - - -',
            'C6 - - - B5 - A5 - - - E5 - - - - -',
            'G5 - - - - - E5 - B4 - - - - - - -',
            'A5 - - - - - F5 - C5 - - - A4 - - -',
            'B4 - - - - - - - D#5 - - - F#5 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A'],
    },
    // 黄沙废城 — a caravan's phrygian-dominant march on drums and a reedy flute
    dune: {
      bpm: 112, kit: 'taiko', inst: { lead: 'flute', arp: 'koto', bass: 'saw' }, delay: 0.5,
      sections: {
        I: { chords: ['E', 'F', 'E', 'F'], drums: 'taikoA', bass: 'long', arp: 'bell' },
        A: {
          chords: ['E', 'F', 'Dm', 'E', 'Am', 'G', 'F', 'E'], drums: 'gallop', bass: 'pulse8', arp: 'up8', lead: [
            'E5 - F5 - G#5 - - - A5 - G#5 - F5 - E5 -',
            'F5 - - - - - E5 - D5 - - - C5 - - -',
            'D5 - E5 - F5 - - - A5 - - - G#5 - F5 -',
            'E5 - - - - - - - . . B4 - C5 - D5 -',
            'E5 - - - A5 - - - C6 - B5 - A5 - - -',
            'G5 - - - - - F5 - E5 - D5 - - - - -',
            'F5 - - - E5 - D5 - C5 - - - D5 - - -',
            'E5 - - - - - - - G#4 - - - B4 - - -',
          ]
        },
        B: {
          chords: ['Am', 'Dm', 'E', 'E', 'Am', 'Dm', 'F', 'E'], drums: 'taikoB', bass: 'synco', arp: 'updown', pad: true, lead: [
            'A5 - - - C6 - B5 - A5 - - - G#5 - - -',
            'F5 - - - A5 - - - D6 - - - C6 - B5 -',
            'G#5 - - - - - B5 - E6 - - - - - - -',
            'D6 - C6 - B5 - A5 - G#5 - - - - - - -',
            'A5 - - - E5 - - - A5 - B5 - C6 - - -',
            'D6 - - - C6 - A5 - F5 - - - - - - -',
            'A5 - - - G#5 - F5 - E5 - - - F5 - - -',
            'E5 - - - - - - - - - - - . . . .',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    // 熔铸炉城 — hammering four-on-the-floor, a square lead like struck iron
    forge: {
      bpm: 124, inst: { lead: 'square', arp: 'bell', bass: 'saw' }, delay: 0.5,
      sections: {
        I: { chords: ['Dm', 'Dm', 'Bb', 'A'], drums: 'synth', bass: 'oct8', arp: 'bell' },
        A: {
          chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'], drums: 'four', bass: 'oct8', arp: 'up16', lead: [
            'D5 - - D5 - - F5 - A5 - - - G5 - F5 -',
            'F5 - - - D5 - - - Bb4 - - - D5 - - -',
            'E5 - - E5 - - G5 - C6 - - - Bb5 - A5 -',
            'A5 - - - - - - - C#5 - - - E5 - - -',
            'D6 - - - C6 - A5 - - - F5 - A5 - D6 -',
            'D6 - - - Bb5 - - - F5 - - - D5 - - -',
            'G5 - - - Bb5 - D6 - - - C6 - Bb5 - G5 -',
            'A5 - - - - - - - E5 - - - C#5 - - -',
          ]
        },
        B: {
          chords: ['Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'Eb', 'A'], drums: 'drive', bass: 'drive16', arp: 'updown', pad: true, lead: [
            'G5 - - - - - Bb5 - D6 - - - - - C6 -',
            'A5 - - - - - F5 - D5 - - - - - - -',
            'F5 - - - G5 - - - Bb5 - - - A5 - G5 -',
            'E5 - - - - - - - C#5 - - - - - - -',
            'G5 - - - Bb5 - - - D6 - - - Eb6 - D6 -',
            'D6 - - - A5 - - - F5 - - - D5 - - -',
            'Eb5 - - - G5 - - - Bb5 - - - G5 - - -',
            'A5 - - - - - - - C#6 - - - E6 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    // 蟾仙·大蟇 — a lurching, heavy swamp march
    bossMire: {
      bpm: 136, kit: 'taiko', inst: { lead: 'saw', arp: 'koto', bass: 'saw' }, delay: 0.5,
      sections: {
        I: { chords: ['Em', 'Em', 'C', 'B'], drums: 'drive', bass: 'gallop' },
        A: {
          chords: ['Em', 'C', 'D', 'B', 'Em', 'C', 'Am', 'B'], drums: 'taikoB', bass: 'gallop', arp: 'up16', lead: [
            'E5 - - - G5 - B5 - - - A5 - G5 - F#5 -',
            'G5 - - - - - E5 - - - C5 - - - E5 -',
            'F#5 - - - A5 - D6 - - - C6 - B5 - A5 -',
            'B5 - - - - - - - F#5 - - - D#5 - - -',
            'E6 - - - D6 - B5 - - - G5 - B5 - E6 -',
            'C6 - - - B5 - G5 - - - E5 - G5 - C6 -',
            'A5 - - - C6 - E6 - - - D6 - C6 - A5 -',
            'B5 - - - D#6 - F#6 - - - - - D#6 - - -',
          ]
        },
        B: {
          chords: ['Am', 'Em', 'C', 'B', 'Am', 'Em', 'F', 'B'], drums: 'four', bass: 'drive16', arp: 'updown', pad: true, lead: [
            'C6 - - - - - B5 - A5 - - - - - E5 -',
            'G5 - - - - - F#5 - E5 - - - B4 - - -',
            'E5 - - - G5 - C6 - - - B5 - A5 - G5 -',
            'F#5 - - - - - - - D#5 - - - F#5 - - -',
            'A5 - - - C6 - E6 - - - F6 - E6 - C6 -',
            'B5 - - - - - G5 - - - E5 - G5 - B5 -',
            'A5 - - - C6 - - - F6 - - - E6 - - -',
            'D#6 - - - - - - - B5 - - - F#5 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    // 流沙蝎后 — a frantic phrygian-dominant chase on koto
    bossDune: {
      bpm: 150, kit: 'taiko', inst: { lead: 'koto', arp: 'pulse', bass: 'saw' }, delay: 0.5,
      sections: {
        I: { chords: ['A', 'Bb', 'A', 'Bb'], drums: 'drive', bass: 'gallop', arp: 'up16' },
        A: {
          chords: ['A', 'Bb', 'Gm', 'A', 'Dm', 'C', 'Bb', 'A'], drums: 'gallop', bass: 'gallop', arp: 'up16', lead: [
            'A5 - Bb5 - C#6 - - - D6 - C#6 - Bb5 - A5 -',
            'Bb5 - - - - - A5 - G5 - - - F5 - - -',
            'G5 - A5 - Bb5 - - - D6 - - - C#6 - Bb5 -',
            'A5 - - - - - - - E5 - - - C#5 - - -',
            'D6 - - - F6 - - - A6 - G6 - F6 - E6 -',
            'E6 - - - - - C6 - G5 - - - E5 - - -',
            'D6 - - - C6 - Bb5 - A5 - - - G5 - - -',
            'A5 - - - C#6 - - - E6 - - - - - - -',
          ]
        },
        B: {
          chords: ['Dm', 'A', 'Bb', 'A', 'Dm', 'A', 'Gm', 'A'], drums: 'four', bass: 'drive16', arp: 'updown', pad: true, lead: [
            'F6 - - - E6 - D6 - - - A5 - - - - -',
            'C#6 - - - - - E6 - A5 - - - - - - -',
            'D6 - - - Bb5 - - - F5 - - - G5 - A5 -',
            'A5 - - - - - - - C#6 - - - - - - -',
            'D6 - F6 - A6 - - - G6 - F6 - E6 - D6 -',
            'C#6 - - - - - A5 - E5 - - - - - - -',
            'Bb5 - - - D6 - - - G5 - - - Bb5 - - -',
            'A5 - - - - - - - C#6 - - - E6 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    // 炎铸巨像 — pounding anvil rhythm under a driving square lead
    bossForge: {
      bpm: 154, inst: { lead: 'square', arp: 'pulse', bass: 'saw' }, delay: 0.5,
      sections: {
        I: { chords: ['F#m', 'F#m', 'D', 'C#'], drums: 'drive', bass: 'drive16', arp: 'up16' },
        A: {
          chords: ['F#m', 'D', 'E', 'C#', 'F#m', 'D', 'Bm', 'C#'], drums: 'four', bass: 'oct8', arp: 'up16', lead: [
            'F#5 - - F#5 - - A5 - C#6 - - - B5 - A5 -',
            'A5 - - - F#5 - - - D5 - - - F#5 - - -',
            'G#5 - - G#5 - - B5 - E6 - - - D6 - C#6 -',
            'C#6 - - - - - - - G#5 - - - F5 - - -',
            'F#6 - - - E6 - C#6 - - - A5 - C#6 - F#6 -',
            'F#6 - - - D6 - - - A5 - - - F#5 - - -',
            'B5 - - - D6 - F#6 - - - E6 - D6 - B5 -',
            'C#6 - - - - - - - G#5 - - - C#6 - - -',
          ]
        },
        B: {
          chords: ['Bm', 'F#m', 'D', 'C#', 'Bm', 'F#m', 'G', 'C#'], drums: 'drive', bass: 'drive16', arp: 'updown', pad: true, lead: [
            'D6 - - - - - C#6 - B5 - - - - - F#5 -',
            'A5 - - - - - G#5 - F#5 - - - - - - -',
            'F#5 - - - A5 - - - D6 - - - C#6 - B5 -',
            'G#5 - - - - - - - F5 - - - - - - -',
            'B5 - - - D6 - - - F#6 - - - G6 - F#6 -',
            'F#6 - - - C#6 - - - A5 - - - F#5 - - -',
            'G5 - - - B5 - - - D6 - - - B5 - - -',
            'C#6 - - - - - - - F6 - - - G#6 - - -',
          ]
        },
      }, order: ['I', 'A', 'B', 'A', 'B'],
    },
    rest: {
      bpm: 88, inst: { lead: 'keys', arp: 'keys', bass: 'sub' }, delay: 0.75,
      sections: {
        A: {
          chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], drums: 'lofi', bass: 'walk', arp: 'up8', pad: true, lead: [
            'A5 - - - - - G5 - E5 - - - - - - -',
            'G5 - - - - - - - D5 - - - - - - -',
            'F5 - - - E5 - - - D5 - - - C5 - - -',
            'E5 - - - - - - - - - - - . . . .',
          ]
        },
        B: { chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], drums: 'lofi', bass: 'walk', arp: 'up8', pad: true },
      }, order: ['B', 'A', 'A', 'B'],
    },
    victory: {
      bpm: 128, once: true, inst: { lead: 'square', arp: 'pulse', bass: 'saw' }, delay: 0.75,
      sections: {
        A: {
          chords: ['C', 'F', 'G', 'C'], drums: 'four', bass: 'oct8', arp: 'up16', pad: true, lead: [
            'C5 - E5 - G5 - C6 - - - G5 - C6 - E6 -',
            'F5 - - - A5 - C6 - - - A5 - F5 - - -',
            'G5 - - - B5 - D6 - - - B5 - G5 - D6 -',
            'C6 - - - - - - - - - - - - - - -',
          ]
        },
      }, order: ['A'],
    },
    gameover: {
      bpm: 70, once: true, inst: { lead: 'flute', arp: 'bell', bass: 'sub' }, delay: 0.75,
      sections: {
        A: {
          chords: ['Am', 'F', 'Dm', 'E'], drums: 'none', bass: 'long', arp: 'bell', pad: true, lead: [
            'E5 - - - D5 - - - C5 - - - B4 - - -',
            'A4 - - - - - - - C5 - - - - - - -',
            'F4 - - - A4 - - - D5 - - - C5 - - -',
            'B4 - - - - - - - G#4 - - - - - - -',
          ]
        },
      }, order: ['A'],
    },
  };

  // ---------- instruments ----------
  let songBus = null;
  function iBass(kind, m, t, d) {
    const f = mf(m);
    if (kind === 'sub') {
      tone({ t, type: 'triangle', f, dur: d, vol: 0.2, a: 0.01, hold: d * 0.6, out: songBus });
      tone({ t, type: 'sine', f: f / 2, dur: d, vol: 0.14, a: 0.01, hold: d * 0.6, out: songBus });
      return;
    }
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    o1.frequency.value = f; o2.frequency.value = f / 2; o1.detune.value = 6;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6;
    fl.frequency.setValueAtTime(180, t);
    fl.frequency.linearRampToValueAtTime(1100, t + 0.012);
    fl.frequency.exponentialRampToValueAtTime(260, t + Math.min(0.25, d));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.13, t + 0.006);
    g.gain.setValueAtTime(0.11, t + d * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(songBus);
    o1.start(t); o2.start(t); o1.stop(t + d + 0.03); o2.stop(t + d + 0.03);
  }
  function iArp(kind, m, t, d) {
    const f = mf(m);
    if (kind === 'bell') {
      tone({ t, type: 'triangle', f, dur: 0.9, vol: 0.05, out: songBus, rev: 0.5, revBus: musRev });
      tone({ t, type: 'sine', f: f * 2, dur: 0.5, vol: 0.025, out: songBus });
    } else if (kind === 'keys') {
      tone({ t, type: 'sine', f, dur: 0.7, vol: 0.06, out: songBus, rev: 0.3, revBus: musRev, vib: [5, 2] });
      tone({ t, type: 'triangle', f: f * 2, dur: 0.25, vol: 0.015, out: songBus });
    } else if (kind === 'koto') {
      // plucked string: bright attack, quick pitch settle, long soft decay
      tone({ t, type: 'triangle', f: f * 1.012, f2: f, slide: 0.03, dur: 0.8, vol: 0.06, a: 0.002, out: songBus, rev: 0.35, revBus: musRev });
      tone({ t, type: 'square', f: f * 2, dur: 0.12, vol: 0.012, lp: 3000, out: songBus });
      tone({ t, type: 'sine', f: f * 3, dur: 0.18, vol: 0.01, out: musDelay });
    } else {
      tone({ t, type: 'square', f, dur: 0.13, vol: 0.032, lp: 3200, out: songBus });
      tone({ t, type: 'square', f, dur: 0.13, vol: 0.012, lp: 2400, out: musDelay });
    }
  }
  function iLead(kind, m, t, d) {
    const f = mf(m);
    if (kind === 'flute') {
      tone({ t, type: 'triangle', f, dur: d + 0.15, vol: 0.075, a: 0.04, hold: d * 0.7, vib: [5, 4], out: songBus, rev: 0.4, revBus: musRev });
      tone({ t, type: 'sine', f: f * 2, dur: d + 0.1, vol: 0.015, a: 0.05, hold: d * 0.6, out: songBus });
      return;
    }
    if (kind === 'keys') {
      tone({ t, type: 'sine', f, dur: d + 0.5, vol: 0.07, a: 0.005, out: songBus, rev: 0.4, revBus: musRev });
      tone({ t, type: 'triangle', f: f * 2, dur: 0.4, vol: 0.02, out: songBus });
      return;
    }
    if (kind === 'koto') {
      // koto lead: hard pluck with a bend-down, re-plucked on long notes
      const plucks = Math.max(1, Math.min(4, Math.round(d / 0.22)));
      for (let k = 0; k < plucks; k++) {
        const tk = t + k * (d / plucks), v = k ? 0.05 : 0.085;
        tone({ t: tk, type: 'triangle', f: f * 1.02, f2: f, slide: 0.04, dur: 0.55, vol: v, a: 0.002, out: songBus, rev: 0.35, revBus: musRev });
        tone({ t: tk, type: 'square', f: f * 2, dur: 0.08, vol: v * 0.22, lp: 3400, out: songBus });
      }
      tone({ t, type: 'sine', f: f * 2, dur: 0.3, vol: 0.015, out: musDelay });
      return;
    }
    if (kind === 'shaku') {
      // bamboo flute: breathy attack, scoop up into the note, delayed vibrato
      tone({ t, type: 'triangle', f: f * 0.97, f2: f, slide: 0.08, dur: d + 0.2, vol: 0.08, a: 0.06, hold: d * 0.7, vib: [5.2, 5], out: songBus, rev: 0.5, revBus: musRev });
      tone({ t, type: 'sine', f: f * 2, dur: d + 0.15, vol: 0.012, a: 0.08, hold: d * 0.5, out: songBus });
      noise({ t, dur: Math.min(0.35, d), vol: 0.018, type: 'bandpass', f: f * 2, q: 6, out: songBus });
      tone({ t, type: 'triangle', f, dur: d, vol: 0.012, a: 0.06, hold: d * 0.5, out: musDelay });
      return;
    }
    const type = kind === 'square' ? 'square' : 'sawtooth';
    const vol = kind === 'square' ? 0.035 : 0.04;
    for (const det of [-7, 7]) {
      tone({ t, type, f, detune: det, dur: d + 0.08, vol, a: 0.008, hold: d * 0.75, lp: 2600, vib: [5.5, 3], out: songBus, rev: 0.25, revBus: musRev });
    }
    tone({ t, type, f, dur: d + 0.08, vol: 0.012, a: 0.008, hold: d * 0.6, lp: 2000, out: musDelay });
  }
  function iPad(notes, t, d) {
    for (const m of notes) {
      for (const det of [-9, 9]) {
        tone({ t, type: 'sawtooth', f: mf(m), detune: det, dur: d + 0.4, vol: 0.012, a: 0.35, hold: d - 0.3, lp: 1100, out: songBus, rev: 0.6, revBus: musRev });
      }
    }
  }
  function dKick(t) {
    tone({ t, type: 'sine', f: 155, f2: 42, slide: 0.11, dur: 0.18, vol: 0.5, out: songBus });
    tone({ t, type: 'square', f: 900, f2: 200, dur: 0.012, vol: 0.06, out: songBus });
  }
  function dSnare(t) {
    noise({ t, dur: 0.16, vol: 0.2, type: 'bandpass', f: 1900, q: 0.7, out: songBus, rev: 0.3, revBus: musRev });
    tone({ t, type: 'triangle', f: 210, f2: 150, dur: 0.07, vol: 0.12, out: songBus });
  }
  function dTaiko(t, accent) {
    tone({ t, type: 'sine', f: accent ? 105 : 120, f2: 52, slide: 0.18, dur: 0.42, vol: accent ? 0.55 : 0.42, out: songBus, rev: 0.25, revBus: musRev });
    noise({ t, dur: 0.12, vol: 0.12, type: 'lowpass', f: 900, out: songBus });
  }
  function dRim(t) {
    tone({ t, type: 'square', f: 1250, dur: 0.035, vol: 0.05, lp: 2800, out: songBus });
    tone({ t, type: 'triangle', f: 820, dur: 0.06, vol: 0.05, out: songBus, rev: 0.3, revBus: musRev });
  }
  function dShaker(t, acc) {
    noise({ t, dur: 0.05, vol: acc ? 0.035 : 0.022, type: 'highpass', f: 6000, out: songBus });
  }
  function dHat(t, open, acc) {
    noise({ t, dur: open ? 0.16 : 0.035, vol: (open ? 0.05 : 0.04) * (acc ? 1.4 : 1), type: 'highpass', f: 7500, out: songBus });
  }

  // ---------- sequencer ----------
  const tokCache = new Map();
  const seq = { song: null, name: null, sec: 0, bar: 0, step: 0, nextT: 0, stepDur: 0.125, done: false };
  function playSong(name) {
    if (!ctx) { seq.pending = name; return; }
    if (seq.name === name && !seq.done) return;
    const now = ctx.currentTime;
    if (songBus) {
      const old = songBus;
      old.gain.setTargetAtTime(0, now, 0.35);
      setTimeout(() => { try { old.disconnect(); } catch (e) { /* already gone */ } }, 2500);
    }
    seq.name = name;
    seq.song = SONGS[name] || null;
    seq.done = false;
    if (!seq.song) { songBus = null; return; }
    songBus = ctx.createGain();
    songBus.gain.value = 0.0001;
    songBus.gain.setTargetAtTime(1, now + 0.3, 0.3);
    songBus.connect(musicBus);
    seq.sec = 0; seq.bar = 0; seq.step = 0;
    seq.stepDur = 60 / seq.song.bpm / 4;
    seq.nextT = now + 0.35;
    musDelay._dl.delayTime.setValueAtTime((60 / seq.song.bpm) * (seq.song.delay || 0.75), now);
  }
  function stopSong() {
    if (!ctx) return;
    if (songBus) { const old = songBus; old.gain.setTargetAtTime(0, ctx.currentTime, 0.4); setTimeout(() => { try { old.disconnect(); } catch (e) { /* noop */ } }, 2500); }
    songBus = null; seq.song = null; seq.name = null;
  }
  function holdLen(str, i, isTokens) {
    let n = 1;
    for (let j = i + 1; j < 16; j++) { const c = isTokens ? str[j] : str[j]; if (c === '-') n++; else break; }
    return n;
  }
  function scheduleStep(t) {
    const S = seq.song;
    const secName = S.order[seq.sec];
    const sec = S.sections[secName];
    const step = seq.step, bar = seq.bar;
    const ch = chord(sec.chords[bar % sec.chords.length]);
    const sd = seq.stepDur;
    // drums
    const dp = DRUMS[sec.drums || 'none'];
    if (S.kit === 'taiko') {
      if (dp.k && dp.k[step] === 'x') dTaiko(t, step % 8 === 0);
      if (dp.s && dp.s[step] === 'x') dRim(t);
      if (dp.h && dp.h[step] === 'x') dShaker(t, step % 4 === 0);
    } else {
      if (dp.k && dp.k[step] === 'x') dKick(t);
      if (dp.s && dp.s[step] === 'x') dSnare(t);
      if (dp.h && dp.h[step] === 'x') dHat(t, false, step % 4 === 0);
      if (dp.o && dp.o[step] === 'x') dHat(t, true);
    }
    // bass
    if (sec.bass) {
      const bp = BASS[sec.bass];
      const c = bp[step];
      if (c !== '.' && c !== '-') {
        let m = 36 + ch.root; if (ch.root > 6) m -= 12;
        if (c === 'O') m += 12; else if (c === 'F') m += 7; else if (c === 'T') m += ch.iv[1];
        iBass(S.inst.bass, m, t, holdLen(bp, step) * sd * 0.92);
      }
    }
    // arp
    if (sec.arp) {
      const ap = ARP[sec.arp];
      const c = ap[step];
      if (c !== '.') {
        const tones = chordTones(ch, S.inst.arp === 'bell' ? 4 : 4);
        const m = tones[parseInt(c, 10) % tones.length];
        iArp(S.inst.arp, m, t, sd);
      }
    }
    // pad
    if (sec.pad && step === 0) {
      const tones = chordTones(ch, 3).slice(0, ch.iv.length);
      iPad(tones, t, sd * 16);
    }
    // lead
    if (sec.lead) {
      const line = sec.lead[bar % sec.lead.length];
      if (line) {
        let tok = tokCache.get(line);
        if (!tok) { tok = line.split(/\s+/); tokCache.set(line, tok); }
        const n = tok[step];
        if (n && n !== '-' && n !== '.') {
          const m = midi(n);
          if (m !== null) iLead(S.inst.lead, m, t, holdLen(tok, step, true) * sd);
        }
      }
    }
  }
  function advance() {
    const S = seq.song;
    seq.step++;
    if (seq.step >= 16) {
      seq.step = 0; seq.bar++;
      const sec = S.sections[S.order[seq.sec]];
      if (seq.bar >= sec.chords.length * (sec.repeat || 1)) {
        seq.bar = 0; seq.sec++;
        if (seq.sec >= S.order.length) {
          if (S.once) { seq.done = true; seq.song = null; return; }
          seq.sec = 0;
        }
      }
    }
  }
  function tick() {
    if (!ctx || !seq.song || ctx.state !== 'running') return;
    if (seq.nextT < ctx.currentTime - 0.3) seq.nextT = ctx.currentTime + 0.05; // recovered from a stall
    while (seq.song && seq.nextT < ctx.currentTime + 0.14) {
      try { scheduleStep(seq.nextT); } catch (e) { if (window.__debugAudio) console.error('music step', seq.name, e); }
      seq.nextT += seq.stepDur;
      advance();
    }
  }
  setInterval(tick, 30);

  let analyser = null;
  function debugLevel() { // test helper: peak / rms of the final mix
    if (!ctx) return null;
    if (!analyser) { analyser = ctx.createAnalyser(); analyser.fftSize = 2048; comp.connect(analyser); }
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let pk = 0, s = 0;
    for (const v of buf) { pk = Math.max(pk, Math.abs(v)); s += v * v; }
    return { peak: +pk.toFixed(3), rms: +Math.sqrt(s / buf.length).toFixed(3) };
  }

  return {
    debugLevel,
    unlock,
    play,
    music: name => { if (!ctx) { seq.pending = name; return; } playSong(name); },
    stopMusic: stopSong,
    applyVolumes,
    setListener(x) { listenerX = x; },
    get ready() { return !!ctx && ctx.state === 'running'; },
    get current() { return seq.name; },
    resumePending() { if (seq.pending && ctx) { const p = seq.pending; seq.pending = null; playSong(p); } },
  };
})();
