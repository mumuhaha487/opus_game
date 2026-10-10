'use strict';
// =====================================================================
//  SOUND — chip-style sound effects and looping 8-bit tunes, all
//  synthesized in WebAudio (pulse, triangle and noise voices)
// =====================================================================
const Sound = (() => {
  let ac = null, out, sfxBus, musBus, noiseBuf, pulse25, pulse12;
  const vol = { sfx: 0.7, music: 0.45 };
  const last = {};
  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    out = ac.createDynamicsCompressor(); out.threshold.value = -14; out.ratio.value = 4; out.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(out);
    musBus = ac.createGain(); musBus.connect(out);
    setVolume(vol.sfx, vol.music);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const pw = duty => { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(Math.PI * k * duty); return ac.createPeriodicWave(re, im); };
    pulse25 = pw(0.25); pulse12 = pw(0.125);
    return true;
  }
  function unlock() {
    if (!init()) return;
    if (ac.state !== 'running') ac.resume().catch(() => {});
    if (music.def && !music.timer) { music.next = ac.currentTime + 0.1; music.timer = setInterval(schedule, 40); }
  }
  function setVolume(sfx, music) {
    vol.sfx = sfx; vol.music = music;
    if (!ac) return;
    sfxBus.gain.setTargetAtTime(sfx * 0.55, ac.currentTime, 0.02);
    musBus.gain.setTargetAtTime(music * 0.32, ac.currentTime, 0.05);
  }
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);
  // one oscillator note with a quick attack and exponential tail
  function tone(o) {
    const t = ac.currentTime + (o.at || 0), dur = o.dur || 0.1;
    const osc = ac.createOscillator(), g = ac.createGain();
    if (o.wave === 'p25') osc.setPeriodicWave(pulse25); else if (o.wave === 'p12') osc.setPeriodicWave(pulse12); else osc.type = o.wave || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.slide || dur));
    const v = (o.vol ?? 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + dur + 0.02);
  }
  function noise(o) {
    const t = ac.currentTime + (o.at || 0), dur = o.dur || 0.1;
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
    const f = ac.createBiquadFilter(); f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.freq || 2000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.3, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }
  const SFX = {
    swing: () => noise({ dur: 0.06, freq: 3000, f1: 900, type: 'bandpass', vol: 0.12 }),
    hit: () => { tone({ f: 220, f1: 90, dur: 0.06, wave: 'square', vol: 0.12 }); noise({ dur: 0.04, freq: 1500, vol: 0.12 }); },
    crit: () => { tone({ f: 660, f1: 160, dur: 0.12, wave: 'p25', vol: 0.18 }); noise({ dur: 0.1, freq: 800, vol: 0.25, type: 'lowpass' }); tone({ f: 1320, dur: 0.05, wave: 'p12', vol: 0.08, at: 0.02 }); },
    skillhit: () => { tone({ f: 520, f1: 260, dur: 0.07, wave: 'p25', vol: 0.1 }); },
    thorns: () => tone({ f: 900, f1: 1300, dur: 0.05, wave: 'p12', vol: 0.06 }),
    die: () => { tone({ f: 440, f1: 110, dur: 0.14, wave: 'p25', vol: 0.12 }); noise({ dur: 0.12, freq: 600, vol: 0.12, type: 'lowpass' }); },
    bossdie: () => { for (let i = 0; i < 5; i++) noise({ dur: 0.35, freq: 900 - i * 120, vol: 0.3, type: 'lowpass', at: i * 0.12 }); tone({ f: 220, f1: 40, dur: 0.9, wave: 'triangle', vol: 0.4 }); },
    coin: () => { tone({ f: 988, dur: 0.05, wave: 'p25', vol: 0.09 }); tone({ f: 1319, dur: 0.12, wave: 'p25', vol: 0.09, at: 0.05 }); },
    hurt: () => { tone({ f: 160, f1: 70, dur: 0.1, wave: 'square', vol: 0.12 }); },
    slam: () => { noise({ dur: 0.4, freq: 500, f1: 80, vol: 0.5, type: 'lowpass' }); tone({ f: 90, f1: 35, dur: 0.35, wave: 'triangle', vol: 0.5 }); },
    boom: () => { noise({ dur: 0.3, freq: 1200, f1: 120, vol: 0.32, type: 'lowpass' }); tone({ f: 120, f1: 40, dur: 0.25, wave: 'triangle', vol: 0.3 }); },
    warn: () => { tone({ f: 880, dur: 0.07, wave: 'p25', vol: 0.12 }); tone({ f: 880, dur: 0.07, wave: 'p25', vol: 0.12, at: 0.12 }); },
    boss: () => { [0, 3, 6, 9].forEach((s, i) => tone({ f: midi(45 + s), dur: 0.22, wave: 'p25', vol: 0.18, at: i * 0.14 })); noise({ dur: 0.5, freq: 300, vol: 0.18, type: 'lowpass', at: 0.56 }); },
    fanfare: () => { [60, 64, 67, 72, 67, 72].forEach((n, i) => tone({ f: midi(n + 12), dur: i === 5 ? 0.5 : 0.12, wave: 'p25', vol: 0.16, at: i * 0.1 })); [48, 55, 60].forEach((n, i) => tone({ f: midi(n), dur: 0.6, wave: 'triangle', vol: 0.3, at: 0.3 + i * 0.05 })); },
    fail: () => { [64, 62, 59, 55].forEach((n, i) => tone({ f: midi(n), dur: 0.2, wave: 'p25', vol: 0.14, at: i * 0.14 })); },
    down: () => { tone({ f: 392, f1: 98, dur: 0.6, wave: 'p25', vol: 0.16 }); },
    snap: () => { noise({ dur: 0.05, freq: 4000, vol: 0.3 }); tone({ f: 300, f1: 120, dur: 0.08, wave: 'square', vol: 0.15 }); },
    stab: () => noise({ dur: 0.03, freq: 5000, vol: 0.12 }),
    howl: () => { tone({ f: 300, f1: 700, slide: 0.3, dur: 0.6, wave: 'triangle', vol: 0.25 }); },
    click: () => tone({ f: 1200, dur: 0.03, wave: 'p12', vol: 0.08 }),
    tab: () => tone({ f: 700, f1: 900, dur: 0.05, wave: 'p25', vol: 0.08 }),
    buy: () => { tone({ f: 660, dur: 0.05, wave: 'p25', vol: 0.1 }); tone({ f: 990, dur: 0.08, wave: 'p25', vol: 0.1, at: 0.05 }); },
    nope: () => tone({ f: 150, dur: 0.1, wave: 'square', vol: 0.1 }),
    equip: () => { noise({ dur: 0.08, freq: 2500, type: 'bandpass', vol: 0.15 }); tone({ f: 523, dur: 0.06, wave: 'p25', vol: 0.1, at: 0.04 }); tone({ f: 784, dur: 0.1, wave: 'p25', vol: 0.1, at: 0.1 }); },
    salvage: () => { noise({ dur: 0.15, freq: 1800, f1: 400, type: 'bandpass', vol: 0.18 }); tone({ f: 330, f1: 660, dur: 0.12, wave: 'p12', vol: 0.06 }); },
    forge: () => { noise({ dur: 0.05, freq: 3000, vol: 0.3 }); tone({ f: 1760, f1: 1500, dur: 0.3, wave: 'triangle', vol: 0.15 }); tone({ f: 2637, dur: 0.25, wave: 'triangle', vol: 0.07, at: 0.02 }); },
    level: () => { [72, 76, 79, 84].forEach((n, i) => tone({ f: midi(n), dur: 0.1, wave: 'p25', vol: 0.12, at: i * 0.06 })); },
    prestige: () => { for (let i = 0; i < 8; i++) tone({ f: midi(60 + [0, 4, 7, 12, 16, 19, 24, 28][i]), dur: 0.3, wave: 'p25', vol: 0.12, at: i * 0.08 }); },
    rune: () => { [76, 83, 88].forEach((n, i) => tone({ f: midi(n), dur: 0.25, wave: 'triangle', vol: 0.18, at: i * 0.07 })); },
    bow: () => { noise({ dur: 0.05, freq: 2400, f1: 900, type: 'bandpass', vol: 0.1 }); tone({ f: 330, f1: 200, dur: 0.06, wave: 'triangle', vol: 0.08 }); },
    zap: () => { tone({ f: 1400, f1: 500, dur: 0.07, wave: 'p12', vol: 0.06 }); noise({ dur: 0.05, freq: 5000, vol: 0.06 }); },
    block: () => { tone({ f: 1100, f1: 900, dur: 0.06, wave: 'triangle', vol: 0.12 }); noise({ dur: 0.04, freq: 4000, vol: 0.1 }); },
    chest0: () => { tone({ f: 523, dur: 0.06, wave: 'p25', vol: 0.08 }); tone({ f: 659, dur: 0.08, wave: 'p25', vol: 0.08, at: 0.06 }); },
    chest1: () => { [60, 64, 67].forEach((n, i) => tone({ f: midi(n + 12), dur: 0.1, wave: 'p25', vol: 0.1, at: i * 0.06 })); },
    chest2: () => { [60, 64, 67, 72].forEach((n, i) => tone({ f: midi(n + 12), dur: 0.14, wave: 'triangle', vol: 0.16, at: i * 0.07 })); noise({ dur: 0.5, freq: 6000, vol: 0.05, at: 0.1 }); },
    open: () => { noise({ dur: 0.12, freq: 1200, f1: 3000, type: 'bandpass', vol: 0.18 }); tone({ f: 392, f1: 784, dur: 0.15, wave: 'p25', vol: 0.1, at: 0.05 }); },
  };
  // a rising arpeggio per grade; from 传说 on it rings out over a low drone
  const DROP_NOTES = [[72], [72, 76], [72, 76, 79], [72, 76, 79, 83], [72, 76, 79, 84, 88, 91]];
  function drop(r) {
    if (!ac || vol.sfx <= 0) return;
    const notes = r < 5 ? DROP_NOTES[r] : [72, 76, 79, 84, 88, 91, 96].slice(0, 2 + r);
    notes.forEach((n, i) => tone({ f: midi(n + (r >= 7 ? 2 : 0)), dur: r >= 4 ? 0.35 : 0.14, wave: r >= 3 ? 'triangle' : 'p25', vol: r >= 3 ? 0.22 : 0.1, at: i * (r >= 4 ? 0.09 : 0.06) }));
    if (r >= 4) { noise({ dur: 0.8, freq: 6000, vol: 0.08, at: 0.1 }); tone({ f: midi(48 - (r >= 7 ? 5 : 0)), dur: 1 + (r - 4) * 0.2, wave: 'triangle', vol: 0.3 }); }
  }
  function chest(k) { play('chest' + k, { gap: 0.08 }); }
  function play(name, o) {
    if (!ac || vol.sfx <= 0 || !SFX[name]) return;
    const now = ac.currentTime, gap = (o && o.gap) || 0.03;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    SFX[name]();
  }
  function hit(crit, kind) {
    if (crit) play('crit', { gap: 0.05 });
    else if (kind === 'thorns') play('thorns', { gap: 0.08 });
    else if (kind === 'skill') play('skillhit', { gap: 0.05 });
    else if (kind !== 'burn') play('hit', { gap: 0.04 });
  }
  function coin(n) { play('coin', { gap: 0.06 }); }
  function cast(id) {
    if (!ac || vol.sfx <= 0) return;
    const base = { cleave: 50, bash: 46, bladestorm: 62, execute: 38, whirl: 58, throwaxe: 60, crush: 40, rage: 44, multishot: 66, pierceshot: 70, arrowrain: 64, gale: 67, blastbolt: 43, snipe: 74, snare: 48, repeater: 61, fireball: 47, chainlight: 69, frostnova: 76, hydra: 41, smite: 55, prayer: 72, aegis: 57, holynova: 63, warcry: 45, storm: 72, soul: 52 }[id] || 60;
    tone({ f: midi(base + 12), f1: midi(base + 24), dur: 0.18, wave: 'p25', vol: 0.12 });
    noise({ dur: 0.2, freq: 1200, f1: 5000, type: 'bandpass', vol: 0.1 });
    if (id === 'warcry') tone({ f: 110, f1: 220, dur: 0.4, wave: 'square', vol: 0.18 });
    if (id === 'chainlight' || id === 'smite') { noise({ dur: 0.4, freq: 4000, f1: 300, vol: 0.3, at: 0.02 }); }
  }

  // ---------- music: procedural chiptune per area ----------
  const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 4, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11] };
  const SONGS = {
    meadow: { bpm: 112, root: 60, scale: 'major', prog: [0, 4, 5, 3], seed: 11, drums: 1 },
    grove: { bpm: 96, root: 57, scale: 'dorian', prog: [0, 6, 3, 4], seed: 23, drums: 1 },
    desert: { bpm: 104, root: 62, scale: 'phryg', prog: [0, 1, 0, 6], seed: 37, drums: 1 },
    tundra: { bpm: 84, root: 64, scale: 'minor', prog: [0, 5, 2, 6], seed: 41, drums: 0 },
    caldera: { bpm: 128, root: 52, scale: 'minor', prog: [0, 0, 5, 6], seed: 53, drums: 2 },
    marsh: { bpm: 80, root: 57, scale: 'minor', prog: [0, 3, 5, 4], seed: 67, drums: 0 },
    cavern: { bpm: 92, root: 59, scale: 'lydian', prog: [0, 1, 4, 0], seed: 71, drums: 1 },
    isles: { bpm: 120, root: 65, scale: 'major', prog: [0, 3, 4, 0], seed: 83, drums: 1 },
    abyss: { bpm: 100, root: 50, scale: 'phryg', prog: [0, 1, 5, 4], seed: 89, drums: 2 },
    boss: { bpm: 144, root: 57, scale: 'minor', prog: [0, 5, 6, 4], seed: 97, drums: 2 },
    mine: { bpm: 156, root: 60, scale: 'major', prog: [0, 3, 4, 4], seed: 101, drums: 2 },
  };
  function compose(def) {
    const rng = RNG(def.seed), sc = SCALES[def.scale];
    const deg = d => { const o = Math.floor(d / 7); return def.root + sc[((d % 7) + 7) % 7] + o * 12; };
    const bars = [];
    // two phrases: A A' over the progression, lead walks chord tones
    const rhythm = [[1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0], [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0], [1, 0, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 0]];
    let cur = 7;
    for (let phrase = 0; phrase < 2; phrase++) for (let b = 0; b < 4; b++) {
      const chord = def.prog[b], r = rhythm[(b + phrase) % rhythm.length], lead = [];
      for (let s = 0; s < 16; s++) {
        if (!r[s]) { lead.push(null); continue; }
        const tones = [chord, chord + 2, chord + 4, chord + 7].map(x => x + 7);
        if (rng.next() < 0.6) cur = tones.reduce((a, t) => (Math.abs(t - cur) < Math.abs(a - cur) ? t : a), tones[0]) + (rng.chance(0.5) ? 0 : rng.pick([-1, 1, 2]));
        else cur += rng.pick([-2, -1, 1, 2]);
        cur = clamp(cur, 4, 14);
        lead.push(phrase && b === 3 && s > 11 ? deg(chord + 7) : deg(cur));
      }
      bars.push({ chord, lead, bass: deg(chord - 7), arp: [0, 2, 4, 2].map(x => deg(chord + x)) });
    }
    return bars;
  }
  const music = { name: null, bars: null, def: null, step: 0, next: 0, timer: null };
  function setMusic(name) {
    if (music.name === name) return;
    music.name = name;
    music.def = SONGS[name] || null; music.bars = music.def ? compose(music.def) : null; music.step = 0;
    if (!ac) return;
    music.next = ac.currentTime + 0.1;
    if (!music.timer) music.timer = setInterval(schedule, 40);
  }
  function schedule() {
    if (!ac || !music.bars || vol.music <= 0) { if (ac) music.next = ac.currentTime + 0.1; return; }
    const spb = 60 / music.def.bpm / 4;
    if (music.next < ac.currentTime - 0.5) music.next = ac.currentTime + 0.05;
    // background tabs only wake timers about once a second, so schedule further ahead there
    const horizon = document.hidden ? 1.6 : 0.2;
    while (music.next < ac.currentTime + horizon) {
      const at = music.next - ac.currentTime;
      const bar = music.bars[Math.floor(music.step / 16) % music.bars.length], s = music.step % 16, d = music.def;
      const b = musBus;
      if (bar.lead[s]) tone({ f: midi(bar.lead[s]), dur: spb * 1.8, wave: 'p25', vol: 0.11, at, bus: b });
      if (s % 2 === 0) tone({ f: midi(bar.arp[(s / 2) % 4] + 12), dur: spb * 0.9, wave: 'p12', vol: 0.045, at, bus: b });
      if (s === 0 || s === 6 || s === 8 || s === 14) tone({ f: midi(bar.bass), dur: spb * 1.7, wave: 'triangle', vol: 0.32, at, bus: b });
      if (d.drums) {
        if (s === 0 || s === 8 || (d.drums > 1 && s === 10)) tone({ f: 140, f1: 45, dur: 0.12, wave: 'sine', vol: 0.45, at, bus: b });
        if (s === 4 || s === 12) noise({ dur: 0.08, freq: 1800, vol: 0.12, at, bus: b, type: 'bandpass' });
        if (s % 2 === 1 || d.drums > 1) noise({ dur: 0.025, freq: 7000, vol: 0.05, at, bus: b });
      } else if (s % 4 === 2) noise({ dur: 0.02, freq: 8000, vol: 0.03, at, bus: b });
      music.next += spb; music.step++;
    }
  }
  return { unlock, play, hit, coin, cast, drop, chest, setMusic, setVolume, get ready() { return !!ac; }, get ctx() { return ac; } };
})();
