/* =========================================================
   audio.js —— 全部声音由 WebAudio 实时合成（无外部音频文件）
   列车环境音 / 发车旋律式巡检预告 / 剪切粘贴 / 印章 / BGM
   ========================================================= */
(function () {
  'use strict';
  const A = (G.audio = {});
  let ctx = null, master, sfxGain, bgmGain, ambGain, noiseBuf = null;
  A.ready = false;

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.connect(master);
      bgmGain = ctx.createGain(); bgmGain.connect(master);
      ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // 棕噪声
      A.ready = true;
      A.applyVolume();
      setInterval(schedBgm, 90);
    } catch (e) { console.warn('audio init failed', e); }
  };
  A.applyVolume = function () {
    if (!ctx) return;
    sfxGain.gain.value = G.settings.sfx;
    bgmGain.gain.value = G.settings.bgm * 0.55;
  };

  function env(g, t, a, d, peak = 1, sus = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus || 0.0001), t + a + d);
  }
  function osc(type, freq, t, dur, vol = 0.2, dest = sfxGain, detune = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    o.connect(g); g.connect(dest);
    env(g, t, 0.005, dur, vol);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function noise(t, dur, vol = 0.2, type = 'lowpass', freq = 1200, q = 0.7, dest = sfxGain, white = false) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    s.connect(f); f.connect(g); g.connect(dest);
    env(g, t, 0.004, dur, vol);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    if (white) s.playbackRate.value = 4;
    return { s, f, g };
  }
  // 钟琴音色（发车旋律）
  function bell(freq, t, dur = 0.9, vol = 0.18, dest = sfxGain) {
    osc('sine', freq, t, dur, vol, dest);
    osc('sine', freq * 2.01, t, dur * 0.5, vol * 0.35, dest);
    osc('triangle', freq * 3.0, t, dur * 0.18, vol * 0.12, dest);
  }
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

  // ---------- 音效 ----------
  const SFX = {
    cut(t) { noise(t, 0.09, 0.35, 'highpass', 2500, 0.8); noise(t + 0.05, 0.07, 0.2, 'bandpass', 4200, 2); },
    paste(t) { noise(t, 0.05, 0.3, 'lowpass', 900); osc('square', 220, t, 0.05, 0.05); osc('triangle', 660, t + 0.02, 0.08, 0.08); },
    select(t) { osc('square', 880, t, 0.03, 0.04); },
    blip(t) { osc('square', 600 + Math.random() * 60, t, 0.02, 0.02); },
    deny(t) { osc('square', 160, t, 0.08, 0.06); osc('square', 120, t + 0.08, 0.12, 0.06); },
    stamp(t) { noise(t, 0.12, 0.55, 'lowpass', 500); osc('sine', 70, t, 0.18, 0.35); noise(t + 0.02, 0.05, 0.2, 'highpass', 3000); },
    door(t) { noise(t, 0.5, 0.18, 'bandpass', 600, 1.2); },
    pinpon(t) { bell(N(76), t, 0.6, 0.16); bell(N(72), t + 0.35, 0.9, 0.16); },
    tick(t) { osc('square', 2200, t, 0.012, 0.03); },
    boom(t) { noise(t, 1.6, 0.9, 'lowpass', 900); osc('sine', 48, t, 1.2, 0.6); noise(t, 0.4, 0.5, 'highpass', 1500); },
    pop(t) { osc('sine', 900, t, 0.06, 0.15); osc('sine', 1400, t + 0.02, 0.04, 0.08); },
    splash(t) { noise(t, 0.3, 0.25, 'bandpass', 1400, 1.5); },
    shatter(t) { for (let i = 0; i < 6; i++) osc('triangle', 1800 + Math.random() * 2400, t + i * 0.03, 0.12, 0.05); noise(t, 0.25, 0.25, 'highpass', 3000); },
    rewind(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.6); o.connect(g); g.connect(sfxGain); env(g, t, 0.01, 0.6, 0.06); o.start(t); o.stop(t + 0.7); },
    react(t) { [0, 4, 7, 12].forEach((n, i) => osc('square', N(72 + n), t + i * 0.06, 0.12, 0.05)); },
    discover(t) { [0, 4, 7, 11, 14].forEach((n, i) => bell(N(79 + n), t + i * 0.07, 0.5, 0.08)); },
    alert(t) { osc('square', 330, t, 0.12, 0.07); osc('square', 330, t + 0.18, 0.12, 0.07); },
    punch(t) { noise(t, 0.08, 0.5, 'lowpass', 700); osc('sine', 110, t, 0.08, 0.3); },
    float(t) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.4); o.connect(g); g.connect(sfxGain); env(g, t, 0.02, 0.4, 0.08); o.start(t); o.stop(t + 0.5); },
    magnet(t) { osc('sawtooth', 55, t, 0.5, 0.05); osc('sawtooth', 56, t, 0.5, 0.05); },
    erase(t) { noise(t, 0.35, 0.3, 'highpass', 5000); },
    copy(t) { osc('square', 520, t, 0.05, 0.05); osc('square', 780, t + 0.06, 0.05, 0.05); },
    step(t) { noise(t, 0.03, 0.06, 'lowpass', 300); },
    hic(t) { osc('triangle', 500, t, 0.05, 0.08); osc('triangle', 820, t + 0.05, 0.06, 0.06); },
    snore(t) { noise(t, 0.6, 0.06, 'lowpass', 260, 4); },
    glitch(t) { for (let i = 0; i < 5; i++) osc('square', 100 + Math.random() * 1500, t + i * 0.04, 0.03, 0.04); },
    page(t) { noise(t, 0.18, 0.18, 'bandpass', 2200, 0.6); },
    yoshi(t) { bell(N(84), t, 0.25, 0.1); bell(N(91), t + 0.1, 0.4, 0.1); },
  };
  A.sfx = function (name, delay = 0) {
    if (!ctx || !SFX[name]) return;
    try { SFX[name](ctx.currentTime + 0.01 + delay); } catch (e) { /* ignore */ }
  };

  // 巡检预告：原创“发车旋律”（8 小节内的钟琴短句）
  A.melody = function (kind = 'scan') {
    if (!ctx) return;
    const t = ctx.currentTime + 0.05;
    const seqs = {
      scan: [[72, 0], [76, 0.18], [79, 0.36], [84, 0.54], [83, 0.9], [79, 1.08], [81, 1.26], [76, 1.62], [77, 1.8], [79, 1.98], [72, 2.34]],
      start: [[67, 0], [72, 0.2], [76, 0.4], [74, 0.7], [72, 0.9], [79, 1.2]],
      danger: [[72, 0], [71, 0.15], [72, 0.3], [71, 0.45], [67, 0.6]],
      clear: [[79, 0], [84, 0.12], [88, 0.24], [91, 0.36]],
    };
    for (const [n, dt] of seqs[kind] || seqs.scan) bell(N(n), t + dt, 0.8, 0.13);
  };

  // ---------- 列车环境音 ----------
  let ambSrc = null, clackTimer = 0, ambOn = false, ambLevel = 0.5;
  A.ambient = function (on, level = 0.5) {
    if (!ctx) return;
    ambLevel = level;
    if (on && !ambSrc) {
      ambSrc = ctx.createBufferSource(); ambSrc.buffer = noiseBuf; ambSrc.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 170;
      ambSrc.connect(f); f.connect(ambGain); ambSrc.start();
    }
    ambOn = on;
    ambGain.gain.setTargetAtTime(on ? 0.22 * level * G.settings.sfx : 0, ctx.currentTime, 0.4);
  };
  A.tickAmbient = function () {};
  A.clack = function () {
    if (!ctx || !ambOn) return;
    {
      const t = ctx.currentTime + 0.02, v = 0.13 * ambLevel;
      noise(t, 0.06, v, 'lowpass', 420); osc('sine', 62, t, 0.07, v * 0.9);
      noise(t + 0.17, 0.06, v * 0.85, 'lowpass', 380); osc('sine', 58, t + 0.17, 0.07, v * 0.8);
    }
  };

  // ---------- BGM（极简音序器） ----------
  const SONGS = {
    night: { bpm: 72, bars: [[57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65], [52, 55, 59, 62]], mel: [76, null, 72, null, 74, null, 71, null, 72, null, 69, null, 71, 72, 74, null], lead: 'triangle', vol: 0.5 },
    tense: { bpm: 96, bars: [[57, 60, 64], [57, 60, 63], [53, 57, 60], [52, 56, 59]], mel: [69, null, 72, 71, null, 69, 68, null, 69, null, 64, null, 65, 64, 62, null], lead: 'square', vol: 0.38 },
    carnival: { bpm: 132, bars: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], mel: [72, 74, 76, 79, 76, 74, 72, null, 77, 76, 74, 72, 74, null, 67, null], lead: 'square', vol: 0.32 },
    finale: { bpm: 112, bars: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], mel: [76, 76, 74, 72, 74, null, 67, null, 72, 72, 71, 69, 71, null, 64, null], lead: 'sawtooth', vol: 0.22 },
    dawn: { bpm: 80, bars: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], mel: [79, null, 76, null, 77, 79, 81, null, 79, null, 76, null, 74, null, 72, null], lead: 'triangle', vol: 0.5 },
  };
  let song = null, songName = '', nextNote = 0, step = 0;
  A.music = function (name) {
    if (name === songName) return;
    songName = name; song = SONGS[name] || null; step = 0;
    if (ctx) nextNote = ctx.currentTime + 0.1;
  };
  function schedBgm() {
    if (!ctx || !song || G.paused === true && G.pauseMusic) return;
    const spb = 60 / song.bpm / 2; // 八分音符
    while (nextNote < ctx.currentTime + 0.25) {
      const bar = song.bars[Math.floor(step / 8) % song.bars.length];
      const t = nextNote;
      if (step % 8 === 0) {
        for (const n of bar) osc('triangle', N(n), t, spb * 7.5, 0.035 * song.vol, bgmGain);
        osc('sine', N(bar[0] - 12), t, spb * 3.5, 0.09 * song.vol, bgmGain);
      }
      if (step % 8 === 4) osc('sine', N(bar[0] - 12), t, spb * 3.5, 0.07 * song.vol, bgmGain);
      const m = song.mel[step % song.mel.length];
      if (m != null && (Math.floor(step / 16) % 2 === 1 || song.bpm > 100)) osc(song.lead, N(m), t, spb * 0.9, 0.03 * song.vol, bgmGain);
      if (song.bpm > 100 && step % 2 === 0) noise(t, 0.03, 0.04 * song.vol, 'highpass', 6000, 0.7, bgmGain);
      nextNote += spb; step++;
    }
  }

  // ---------- 日语广播（可选，系统 TTS） ----------
  let jaVoice = null;
  function pickVoice() {
    try {
      const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      jaVoice = vs.find((v) => /ja/i.test(v.lang) && /female|haruka|nanami|kyoko|ayumi|o-ren/i.test(v.name)) || vs.find((v) => /ja/i.test(v.lang)) || null;
    } catch (e) { jaVoice = null; }
  }
  if (window.speechSynthesis) { pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* ignore */ } }
  A.hasVoice = () => !!jaVoice;
  A.say = function (jp) {
    if (!G.settings.voice || !jaVoice || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(jp.replace(/[「」]/g, ''));
      u.voice = jaVoice; u.lang = jaVoice.lang; u.rate = 1.0; u.pitch = 1.1; u.volume = Math.min(1, G.settings.sfx + 0.1);
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  };
  A.hush = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { /* ignore */ } };
})();
