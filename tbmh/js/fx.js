'use strict';
// =====================================================================
//  FX — everything that pops, flies, flashes or shakes. Coordinates are
//  strip pixels (x right, y down, ground at GY). Driven by battle events.
// =====================================================================
const FX = (() => {
  const parts = [], nums = [], coins = [], beams = [], arcs = [], rings = [], bolts = [], meteors = [], banners = [], sparks = [], icons = [], chests = [], zaps = [], rains = [];
  const st = { shake: 0, hitstop: 0, flash: 0, flashColor: PAL.white, goldPulse: 0, expPulse: 0, chestPulse: 0, poster: null, pending: [] };
  const ELEM_COL = { fire: PAL.orange, ice: PAL.cyan, light: PAL.yellow, poison: PAL.green, holy: PAL.cream };
  let opts = { shake: 1, nums: 1, fx: 1 };
  const R = Math.random;
  const cap = (list, n) => { if (list.length > n) list.splice(0, list.length - n); };

  function burst(x, y, n, colors, o = {}) {
    if (!opts.fx) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = (o.dir ?? -Math.PI / 2) + (R() - 0.5) * (o.spread ?? Math.PI * 2), s = (o.speed ?? 70) * (0.4 + R() * 0.8);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: o.g ?? 260, life: (o.life ?? 0.45) * (0.6 + R() * 0.6), max: 0, c: colors[i % colors.length], sz: o.size ?? (R() < 0.3 ? 2 : 1), ground: o.ground ?? true });
      parts[parts.length - 1].max = parts[parts.length - 1].life;
    }
    cap(parts, 700);
  }
  function number(x, y, text, o = {}) {
    if (!opts.nums && !o.always) return;
    nums.push({ x: x + (R() - 0.5) * 6, y, vx: (R() - 0.3) * 30, vy: -(o.big ? 95 : 70), life: o.life ?? (o.big ? 0.9 : 0.7), t: 0, text, color: o.color || PAL.white, shade: o.shade, big: !!o.big, outline: o.outline });
    cap(nums, 60);
  }
  function shatter(img, x, y, flip) {
    if (!img) return;
    const px = Spr.pixelsOf(img), n = opts.fx ? px.length : Math.ceil(px.length / 3);
    for (let i = 0; i < n; i++) {
      const [sx, sy, c] = px[opts.fx ? i : i * 3];
      const lx = flip ? img.width - sx : sx;
      const ax = x - img.ox + lx, ay = y - img.oy + sy;
      const a = Math.atan2(ay - (y - img.oy / 2), ax - x) + (R() - 0.5);
      parts.push({ x: ax, y: ay, vx: Math.cos(a) * (30 + R() * 60), vy: Math.sin(a) * (30 + R() * 60) - 50, g: 320, life: 0.5 + R() * 0.5, max: 1, c, sz: 2, ground: true });
    }
    cap(parts, 900);
  }
  function coinBurst(x, y, n, hx, hy) {
    for (let i = 0; i < n; i++) coins.push({ x, y: y - 6, vx: -30 + R() * 110, vy: -90 - R() * 80, t: 0, f: R() * 4, hx, hy, state: 0 });
    cap(coins, 160);
  }
  function banner(text, o = {}) {
    const same = banners.find(b => b.text === text && b.sub === (o.sub || ''));
    if (same) { same.t = Math.min(same.t, 0.2); return; }
    banners.push({ text, sub: o.sub || '', color: o.color || PAL.yellow, life: o.life || 2.2, t: 0, big: o.big !== false });
    cap(banners, 2);
  }
  function update(dt, hx, hy) {
    st.shake = Math.max(0, st.shake - dt * 2.4);
    st.flash = Math.max(0, st.flash - dt * 3);
    st.goldPulse = Math.max(0, st.goldPulse - dt * 4); st.expPulse = Math.max(0, st.expPulse - dt * 3); st.chestPulse = Math.max(0, st.chestPulse - dt * 3);
    // chests: pop out, bounce, then fly up to the tray in the top bar
    for (const c of chests) {
      c.t += dt;
      if (c.state === 0) {
        c.vy += 420 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y > GY - 1) { c.y = GY - 1; c.vy *= -0.4; c.vx *= 0.6; if (Math.abs(c.vy) < 30) c.vy = 0; }
        if (c.t > 0.75) { c.state = 1; c.t = 0; }
      } else { const k = Ease.inQuad(Math.min(1, c.t / 0.5)); c.x = lerp(c.x, c.tx, k * 0.25); c.y = lerp(c.y, -14, k * 0.25); if (c.t > 0.6) { c.done = true; st.chestPulse = 1; } }
    }
    filt(chests, c => !c.done);
    for (const z of zaps) z.t += dt;
    filt(zaps, z => z.t < z.life);
    for (const r of rains) { r.t += dt; r.drop -= dt; if (r.drop <= 0 && r.t < r.life) { r.drop = 0.05; r.list.push({ x: r.x + (R() - 0.5) * 100, y: -6, v: 260 + R() * 80 }); } for (const d of r.list) d.y += d.v * dt; r.list = r.list.filter(d => d.y < GY); }
    filt(rains, r => r.t < r.life + 0.6);
    for (const p of parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.ground && p.y > GY + 2 && p.vy > 0) { p.y = GY + 2; p.vy *= -0.35; p.vx *= 0.6; }
    }
    filt(parts, p => p.life > 0);
    for (const n of nums) { n.t += dt; n.vy += 170 * dt; n.x += n.vx * dt; n.y += n.vy * dt * (n.t < 0.15 ? 1 : 0.5); n.life -= dt; }
    filt(nums, n => n.life > 0);
    let arrived = 0;
    for (const c of coins) {
      c.t += dt; c.f += dt * 12;
      if (c.state === 0) {
        c.vy += 420 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.y > GY - 1) { c.y = GY - 1; c.vy *= -0.45; c.vx *= 0.7; if (Math.abs(c.vy) < 30) c.vy = 0; }
        if (c.t > 0.55 + R() * 0.2) c.state = 1;
      } else {
        const dx = hx - c.x, dy = hy - 10 - c.y, d = Math.hypot(dx, dy), sp = 140 + c.t * 420;
        if (d < 6) { c.done = true; arrived++; continue; }
        c.x += (dx / d) * sp * dt; c.y += (dy / d) * sp * dt;
      }
    }
    filt(coins, c => !c.done);
    if (arrived) { st.goldPulse = 1; Sound.coin(arrived); for (let i = 0; i < Math.min(arrived, 3); i++) sparks.push({ x: hx + (R() - 0.5) * 8, y: hy - 12 - R() * 8, life: 0.25 }); }
    for (const s of sparks) s.life -= dt;
    filt(sparks, s => s.life > 0);
    for (const b of beams) b.t += dt;
    filt(beams, b => b.t < b.life);
    for (const a of arcs) a.t += dt;
    filt(arcs, a => a.t < a.life);
    for (const r of rings) { r.t += dt; r.r += r.vr * dt; }
    filt(rings, r => r.t < r.life);
    for (const b of bolts) b.t += dt;
    filt(bolts, b => b.t < b.life);
    for (const m of meteors) m.t += dt;
    filt(meteors, m => m.t < m.delay + 0.36);
    for (const b of banners) b.t += dt;
    filt(banners, b => b.t < b.life);
    for (const i of icons) { i.t += dt; }
    filt(icons, i => i.t < i.life);
    if (st.poster) { st.poster.t += dt; if (st.poster.leaving && st.poster.t > 0.5) st.poster = null; }
  }
  function filt(list, keep) { let j = 0; for (let i = 0; i < list.length; i++) if (keep(list[i])) list[j++] = list[i]; list.length = j; }

  // ---------- drawing ----------
  function drawWorld(ctx, t) {
    // loot beams behind actors
    for (const b of beams) {
      const k = b.t / b.life, a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      const col = RARITY[b.r].color, glow = RARITY[b.r].glow, h = b.r >= 3 ? GY : 60 + b.r * 16;
      ctx.globalAlpha = 0.35 * a; ctx.fillStyle = col; ctx.fillRect(Math.round(b.x) - 4, GY - h, 9, h);
      ctx.globalAlpha = 0.7 * a; ctx.fillStyle = glow; ctx.fillRect(Math.round(b.x) - 1, GY - h, 3, h);
      ctx.globalAlpha = a;
      for (let i = 0; i < 4; i++) { const yy = GY - ((t * 60 + i * 23) % h); ctx.fillStyle = glow; ctx.fillRect(Math.round(b.x) - 3 + ((i * 5) % 7), Math.round(yy), 1, 2); }
      ctx.globalAlpha = 1;
    }
    for (const c of chests) Spr.draw(ctx, Spr.get('chest', 0, String(c.k)), c.x, c.y);
    for (const r of rains) for (const d of r.list) { ctx.fillStyle = PAL.cream; ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 5); ctx.fillStyle = PAL.mist; ctx.fillRect(Math.round(d.x), Math.round(d.y) + 5, 1, 2); }
    for (const z of meteors) {
      if (z.t < z.delay) continue;
      const k = (z.t - z.delay) / 0.34, mx = z.x + 60 * (1 - k), my = -10 + (GY - 6 + 10) * k;
      for (let i = 1; i < 6; i++) { ctx.fillStyle = i < 3 ? PAL.yellow : PAL.orange; ctx.fillRect(Math.round(mx + i * 4), Math.round(my - i * 5), 3 - (i >> 1), 3 - (i >> 1)); }
      Spr.draw(ctx, Spr.get('p_fireball'), mx, my);
    }
  }
  function drawOver(ctx, t) {
    for (const a of arcs) drawArc(ctx, a);
    for (const z of zaps) {
      if (Math.floor(z.t * 30) % 3 === 2) continue;
      const rnd = RNG(z.seed), n = Math.max(2, Math.floor(Math.abs(z.x1 - z.x0) / 10));
      let px = z.x0, py = z.y0;
      for (let i = 1; i <= n; i++) { const nx = lerp(z.x0, z.x1, i / n), ny = lerp(z.y0, z.y1, i / n) + (i < n ? rnd.int(-5, 5) : 0); Paint2.line(ctx, px, py, nx, ny, z.color, 2); Paint2.line(ctx, px, py, nx, ny, PAL.white, 1); px = nx; py = ny; }
    }
    for (const r of rings) {
      const k = r.t / r.life;
      ctx.fillStyle = r.color; ctx.globalAlpha = 1 - k;
      const n = Math.max(12, Math.floor(r.r * 1.4));
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; ctx.fillRect(Math.round(r.x + Math.cos(a) * r.r), Math.round(r.y + Math.sin(a) * r.r * (r.flat ? 0.35 : 1)), r.thorn && i % 3 === 0 ? 2 : 1, r.thorn && i % 3 === 0 ? 2 : 1); }
      ctx.globalAlpha = 1;
    }
    for (const b of bolts) {
      const k = b.t / b.life; if (k > 0.8 && (Math.floor(b.t * 30) % 2)) continue;
      let x = b.x, y = -2;
      const seg = 10, rnd = RNG(b.seed);
      while (y < b.y) {
        const nx = x + rnd.int(-6, 6), ny = Math.min(b.y, y + seg);
        Paint2.line(ctx, x, y, nx, ny, b.color || PAL.yellow, 2); Paint2.line(ctx, x, y, nx, ny, PAL.white, 1);
        x = nx; y = ny;
      }
      Paint2.ellipse(ctx, x, b.y, 10, 3, rgba(PAL.yellow, 0.6));
    }
    for (const p of parts) {
      ctx.globalAlpha = p.life < 0.15 ? p.life / 0.15 : 1;
      ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.sz, p.sz);
    }
    ctx.globalAlpha = 1;
    for (const c of coins) Spr.draw(ctx, Spr.get('coin', Math.floor(c.f) % 4), c.x, c.y);
    for (const s of sparks) { ctx.fillStyle = PAL.yellow; ctx.fillRect(Math.round(s.x), Math.round(s.y) - 1, 1, 3); ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1); }
    for (const i of icons) {
      const k = i.t / i.life, y = i.y - 18 * Ease.outCubic(Math.min(1, i.t / 0.4));
      ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      Frame.rarity(ctx, Math.round(i.x - 10), Math.round(y - 10), 20, 20, i.r, t);
      ctx.drawImage(i.img, Math.round(i.x - i.img.width / 2), Math.round(y - i.img.height / 2));
      ctx.globalAlpha = 1;
    }
    for (const n of nums) {
      const a = n.life < 0.2 ? n.life / 0.2 : 1, s = n.t < 0.08 ? 1 : 1;
      ctx.globalAlpha = a;
      Digits.draw(ctx, n.text, n.x, n.y, { color: n.color, big: n.big, shade: n.shade, outline: n.outline });
      ctx.globalAlpha = 1;
    }
  }
  function drawArc(ctx, a) {
    // pixel crescent sweeping from top to bottom in front of the hunter
    const k = a.t / a.life, col = RARITY[a.r || 0].glow, edge = RARITY[a.r || 0].color;
    const rad = a.big ? 34 : 18, sweep = Math.min(1, k * 2.2);
    const from = -1.2, to = from + 2.4 * sweep;
    ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
    for (let r = rad - (a.big ? 6 : 3); r <= rad; r++) {
      const n = Math.floor(r * 2.6);
      for (let i = 0; i <= n; i++) {
        const ang = from + (to - from) * (i / n);
        if (ang < to - 2.0) continue;
        ctx.fillStyle = r >= rad - 1 ? PAL.white : r === rad - 2 ? col : edge;
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * r), Math.round(a.y + Math.sin(ang) * r * 0.9), 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }
  // banners and the WANTED poster draw in screen space (after the shake offset is removed)
  function drawHud(ctx, w, t) {
    if (st.flash > 0) { ctx.fillStyle = rgba(st.flashColor, Math.min(0.5, st.flash * 0.5)); ctx.fillRect(0, 0, w, SH); }
    let stack = 40;
    banners.forEach((b, i) => {
      const k = b.t / b.life, inn = Math.min(1, b.t / 0.2), out = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      const y = stack - (1 - Ease.outBack(inn)) * 10;
      stack += (b.sub ? 34 : 20) + 4;
      ctx.globalAlpha = out;
      const tw = Math.max(Text.width(b.text, 12), b.sub ? Text.width(b.sub, 12) : 0) + 24, h = b.sub ? 34 : 20;
      const bx = Math.round(w / 2 - tw / 2);
      ctx.fillStyle = rgba(PAL.ink, 0.82); ctx.fillRect(bx, y - 4, tw, h);
      ctx.fillStyle = b.color; ctx.fillRect(bx, y - 4, tw, 1); ctx.fillRect(bx, y - 5 + h, tw, 1);
      Text.draw(ctx, b.text, w / 2, y, { color: b.color, align: 'center', outline: PAL.ink });
      if (b.sub) Text.draw(ctx, b.sub, w / 2, y + 15, { color: PAL.cream, align: 'center' });
      ctx.globalAlpha = 1;
    });
  }

  // ---------- event hookup ----------
  function attach(b, view) {
    const ev = b.ev;
    const sx = m => view.hx + m.x, sy = m => GY - (m.y || 0) - (m.boss ? 22 : 10);
    ev.on('hit', (m, dmg, crit, kind, elem) => {
      const x = sx(m), y = sy(m) - 6;
      if (kind === 'burn') { number(x, y, fmt(dmg), { color: PAL.orange }); return; }
      const col = ELEM_COL[elem] || (kind === 'thorns' ? PAL.green : kind === 'skill' ? PAL.cyan : kind === 'ember' ? PAL.orange : kind === 'proc' ? PAL.mist : PAL.white);
      if (crit) {
        number(x, y - 4, fmt(dmg) + '!', { color: PAL.yellow, shade: PAL.orange, outline: PAL.wine, big: true });
        st.shake = Math.min(1, st.shake + 0.35); st.hitstop = 0.05;
        burst(x, y + 4, 10, [PAL.white, PAL.yellow, PAL.orange], { speed: 110, life: 0.35 });
      } else {
        number(x, y, fmt(dmg), { color: col });
        burst(x, y + 6, 4, [PAL.white, col === PAL.white ? PAL.mist : col], { speed: 70, life: 0.25 });
      }
      Sound.hit(crit, kind);
    });
    ev.on('kill', m => {
      const img = Scene.mobSprite(m, view.t);
      shatter(img, sx(m), GY - (m.y || 0), false);
      if (m.boss) { st.shake = 1; st.flash = 1; st.flashColor = PAL.white; Sound.play('bossdie'); }
      else Sound.play('die');
    });
    ev.on('escape', m => { burst(sx(m), GY - 4, 8, [PAL.mist, PAL.white], { speed: 40 }); });
    ev.on('gold', (g, m, n) => {
      coinBurst(sx(m), GY - (m.y || 0) - 8, n, view.hx, GY);
      number(sx(m), sy(m) - 12, '+' + fmt(g), { color: PAL.yellow, shade: PAL.amber, life: 0.6 });
    });
    ev.on('chestDrop', (ch, m) => {
      const x = sx(m);
      chests.push({ x, y: GY - (m.y || 0) - 10, vx: -20 + R() * 50, vy: -150, t: 0, k: ch.k, state: 0, tx: 150 });
      beams.push({ x, r: [1, 3, 4][ch.k], t: 0, life: 1.2 });
      Sound.chest(ch.k);
    });
    // what came out of an opened chest
    ev.on('open', res => {
      const top = res.items.reduce((a, x) => Math.max(a, x.it.g), 0);
      if (top >= 5) { st.flash = 1; st.flashColor = GRADES[top].color; const it = res.items.find(x => x.it.g === top).it; banner(GRADES[top].name + '装备', { sub: Loot.name(it) + (it.lg ? ' · ' + LEGENDS[it.lg].name : ''), color: GRADES[top].color, life: 2.4 }); }
      Sound.drop(top);
    });
    ev.on('swing', (n, fam) => {
      if (fam && !FAMS[fam].melee) { Sound.play(fam === 'staff' ? 'zap' : 'bow'); return; }
      st.pending.push({ t: 0.06, fn: () => { arcs.push({ x: view.hx + 10, y: GY - 12, t: 0, life: 0.18, r: b.s.eq.main ? Math.min(4, b.s.eq.main.g) : 0 }); Sound.play('swing'); } });
    });
    ev.on('block', () => { rings.push({ x: view.hx - 4, y: GY - 12, r: 3, vr: 50, t: 0, life: 0.25, color: PAL.cyan }); Sound.play('block'); });
    ev.on('levelUp', lv => { st.expPulse = 1; banner('升级', { sub: `猎人等级 ${lv} · 技能点 +1`, color: PAL.cyan, life: 1.8 }); rings.push({ x: view.hx, y: GY - 12, r: 4, vr: 90, t: 0, life: 0.6, color: PAL.cyan }); burst(view.hx, GY - 14, 20, [PAL.cyan, PAL.white, PAL.blue], { speed: 90, g: -60, life: 0.7 }); Sound.play('level'); });
    ev.on('champ', m => banner(m.champ.name, { sub: `头目 · ${AURAS[m.champ.aura].name}：${AURAS[m.champ.aura].text}`, color: View.AURA_COLOR[m.champ.aura] || PAL.amber, life: 2.2 }));
    ev.on('pet', id => { banner('新宠物', { sub: PETS[id].name, color: PAL.pink, life: 2.2 }); Sound.play('rune'); });
    ev.on('ach', a => { banner('成就达成', { sub: a.name, color: PAL.yellow, life: 2.2 }); Sound.play('rune'); });
    ev.on('cubeLv', lv => { const f = CUBE_FUNCS.find(x => x.lv === lv); banner('魔方升级', { sub: f ? `${lv} 级 · 解锁「${f.name}」` : `${lv} 级`, color: PAL.magenta, life: 1.8 }); });
    ev.on('needWanted', d => banner('缺少通缉令', { sub: `刷第 9 关攒${DIFFS[d].name}通缉令`, color: PAL.amber, life: 2.2 }));
    ev.on('newDiff', d => { st.flash = 1; st.flashColor = DIFFS[d].color; banner(`${DIFFS[d].name}难度`, { sub: '同样的九个地域，更强的怪物与更好的掉落', color: DIFFS[d].color, life: 3 }); });
    ev.on('hurt', (dmg, src, kind) => {
      number(view.hx, GY - 30, '-' + fmt(dmg), { color: PAL.red, shade: PAL.wine });
      burst(view.hx + 4, GY - 12, 5, [PAL.red, PAL.wine], { speed: 60 });
      if (kind === 'slam' || kind === 'bolt') { st.shake = Math.min(1, st.shake + 0.6); Sound.play('slam'); } else Sound.play('hurt');
    });
    ev.on('cast', (id, echo) => {
      if (opts.nums) icons.push({ x: view.hx, y: GY - 34, r: echo ? 3 : 2, img: Spr.get(SKILLS[id].icon), t: 0, life: 0.7 });
      Sound.cast(id);
    });
    ev.on('fx', (kind, d) => {
      const hx = view.hx;
      switch (kind) {
        case 'cleave': arcs.push({ x: hx + 14, y: GY - 14, t: 0, life: 0.28, r: 2, big: true }); st.shake = Math.min(1, st.shake + 0.3); burst(hx + 40, GY, 18, [PAL.tan, PAL.brown, PAL.white], { dir: -Math.PI / 2, spread: 1.4, speed: 120 }); break;
        case 'thunder': bolts.push({ x: hx + d.x, y: GY - (d.y || 0) - 6, t: 0, life: 0.35, seed: (Math.random() * 1e9) | 0 }); st.flash = 0.6; st.flashColor = PAL.yellow; st.shake = Math.min(1, st.shake + 0.5); break;
        case 'zap': zaps.push({ x0: hx + d.from, y0: GY - 14, x1: hx + d.to, y1: GY - 12, t: 0, life: 0.22, color: PAL.yellow, seed: (R() * 1e9) | 0 }); Sound.play('zap'); break;
        case 'split': zaps.push({ x0: hx + d.from, y0: GY - 12, x1: hx + d.to, y1: GY - 12, t: 0, life: 0.15, color: PAL.cream, seed: (R() * 1e9) | 0 }); break;
        case 'spin': rings.push({ x: hx, y: GY - 10, r: d.r * 0.6, vr: 30, t: 0, life: d.t, color: PAL.mist, flat: true }); Sound.play('swing'); break;
        case 'rain': rains.push({ x: hx + d.x, t: 0, life: d.t, drop: 0, list: [] }); break;
        case 'blast': rings.push({ x: hx + d.x, y: GY - 8, r: 4, vr: 140, t: 0, life: 0.3, color: PAL.orange }); burst(hx + d.x, GY - 8, 14, [PAL.yellow, PAL.orange, PAL.red], { speed: 110 }); st.shake = Math.min(1, st.shake + 0.25); Sound.play('boom'); break;
        case 'boom': rings.push({ x: hx + d.x, y: GY - 10, r: 3, vr: 110, t: 0, life: 0.22, color: PAL.yellow }); break;
        case 'snipe': rings.push({ x: hx + d.x, y: GY - 14, r: 14, vr: -50, t: 0, life: 0.3, color: PAL.red }); break;
        case 'beamArrow': beams.push({ x: hx + 120, r: 2, t: 0, life: 0.4 }); parts.push({ x: hx + 10, y: GY - 13, vx: 900, vy: 0, g: 0, life: 0.5, max: 0.5, c: PAL.white, sz: 2, ground: false }); break;
        case 'wave': arcs.push({ x: hx + d.x + 14, y: GY - 12, t: 0, life: 0.25, r: 2 }); break;
        case 'bash': rings.push({ x: hx + d.x, y: GY - 12, r: 3, vr: 80, t: 0, life: 0.25, color: PAL.cyan }); st.shake = Math.min(1, st.shake + 0.3); break;
        case 'throwaxe': for (let i = 0; i < 6; i++) parts.push({ x: hx + 10 + i * (d.x / 6), y: GY - 16 - Math.sin(i / 5 * Math.PI) * 10, vx: 0, vy: 0, g: 0, life: 0.25 + i * 0.03, max: 0.4, c: PAL.cyan, sz: 1, ground: false }); break;
        case 'rage': rings.push({ x: hx, y: GY - 12, r: 4, vr: 60, t: 0, life: 0.4, color: PAL.red }); break;
        case 'hydra': burst(hx - 16, GY - 8, 14, [PAL.orange, PAL.yellow], { speed: 60 }); break;
        case 'prayer': burst(hx, GY - 20, 14, [PAL.cream, PAL.yellow, PAL.white], { speed: 40, g: -50, life: 0.8 }); break;
        case 'aegis': rings.push({ x: hx, y: GY - 12, r: 6, vr: 40, t: 0, life: 0.5, color: PAL.cyan }); break;
        case 'smite': bolts.push({ x: hx + d.x, y: GY - 8, t: 0, life: 0.3, seed: (R() * 1e9) | 0, color: PAL.cream }); st.flash = 0.4; st.flashColor = PAL.cream; break;
        case 'warcry': rings.push({ x: hx, y: GY - 16, r: 4, vr: 120, t: 0, life: 0.4, color: PAL.red }); break;
        case 'mobBlock': rings.push({ x: hx + d.x, y: GY - 14, r: 2, vr: 30, t: 0, life: 0.2, color: PAL.steel }); break;
        case 'mobHeal': burst(hx + d.x, GY - 16, 8, [PAL.green, PAL.white], { speed: 30, g: -60 }); break;
        case 'arcane': rings.push({ x: hx + d.x, y: GY - 14, r: 6, vr: 220, t: 0, life: 0.45, color: PAL.magenta }); st.shake = Math.min(1, st.shake + 0.4); break;
        case 'rift': st.shake = 1; st.flash = 0.8; st.flashColor = PAL.magenta; rings.push({ x: hx, y: GY - 10, r: 30, vr: -60, t: 0, life: 0.4, color: PAL.magenta }); break;
        case 'darkbeam': beams.push({ x: hx + 40, r: 6, t: 0, life: 1.6 }); zaps.push({ x0: hx + d.x - 20, y0: GY - 40, x1: hx + 4, y1: GY - 12, t: 0, life: 1.4, color: PAL.magenta, seed: 7 }); break;
        case 'bolt': bolts.push({ x: hx + 2, y: GY - 6, t: 0, life: 0.4, seed: (Math.random() * 1e9) | 0, color: PAL.cyan }); st.flash = 0.7; st.flashColor = PAL.cyan; break;
        case 'meteor': meteors.push({ x: hx + d.x, t: 0, delay: d.delay }); break;
        case 'meteorHit': rings.push({ x: hx + d.x, y: GY - 2, r: 4, vr: 120, t: 0, life: 0.3, color: PAL.orange, flat: true }); burst(hx + d.x, GY - 4, 16, [PAL.yellow, PAL.orange, PAL.red], { speed: 120, dir: -Math.PI / 2, spread: 2 }); st.shake = Math.min(1, st.shake + 0.35); Sound.play('boom'); break;
        case 'bastion': rings.push({ x: hx, y: GY - 12, r: 6, vr: 40, t: 0, life: 0.5, color: PAL.cyan }); break;
        case 'nova': { const c1 = d && d.color === 'ice' ? PAL.cyan : d && d.color === 'holy' ? PAL.cream : PAL.green; rings.push({ x: hx, y: GY - 10, r: 6, vr: 260, t: 0, life: 0.45, color: c1, thorn: true }); rings.push({ x: hx, y: GY - 10, r: 2, vr: 180, t: 0, life: 0.45, color: PAL.white, thorn: true }); st.shake = Math.min(1, st.shake + 0.3); break; }
        case 'gale': for (let i = 0; i < 6; i++) parts.push({ x: hx - 10 - i * 4, y: GY - 8 - i * 3, vx: -80, vy: 0, g: 0, life: 0.4, max: 0.4, c: PAL.cyan, sz: 1, ground: false }); break;
        case 'soul': burst(hx + d.x, GY - 14, 14, [PAL.magenta, PAL.pink, PAL.plum], { speed: 90 }); for (let i = 0; i < 8; i++) parts.push({ x: hx + d.x, y: GY - 14, vx: -(hx + d.x - hx) * 2 * (0.6 + Math.random() * 0.6), vy: -40 + Math.random() * 30, g: 40, life: 0.5, max: 0.5, c: PAL.pink, sz: 2, ground: false }); break;
        case 'snare': case 'snap': burst(hx + (d ? d.x : 40), GY - 2, 8, [PAL.steel, PAL.white], { speed: 60, dir: -Math.PI / 2, spread: 1.6 }); if (kind === 'snap') Sound.play('snap'); break;
        case 'storm': for (let i = 0; i < 10; i++) coinBurst(hx + 20, GY - 30, 1, hx, GY); break;
        case 'execute': arcs.push({ x: hx + d.x - 6, y: GY - 20, t: 0, life: 0.3, r: 4, big: true }); st.flash = 0.5; st.flashColor = PAL.red; st.shake = Math.min(1, st.shake + 0.5); break;
        case 'stab': burst(hx + d.x, GY - 12, 3, [PAL.white, PAL.cyan], { speed: 90, dir: 0, spread: 0.6 }); Sound.play('stab'); break;
        case 'pierce': burst(hx + d.x + 12, GY - 12, 6, [PAL.white, PAL.cyan], { speed: 160, dir: 0, spread: 0.3 }); break;
        case 'crush': st.shake = Math.min(1, st.shake + 0.4); rings.push({ x: hx + d.x, y: GY - 12, r: 4, vr: 90, t: 0, life: 0.25, color: PAL.red }); break;
        case 'stun': rings.push({ x: hx + d.x, y: GY - 30, r: 4, vr: 16, t: 0, life: 0.4, color: PAL.yellow, flat: true }); break;
        case 'ember': rings.push({ x: hx + d.x, y: GY - 10, r: 4, vr: 160, t: 0, life: 0.35, color: PAL.orange }); burst(hx + d.x, GY - 10, 14, [PAL.yellow, PAL.orange, PAL.rust], { speed: 120 }); break;
        case 'slam': case 'dive': case 'spike': st.shake = 1; burst(hx + 6, GY, 18, [PAL.tan, PAL.brown, PAL.white], { speed: 130, dir: -Math.PI / 2, spread: 2 }); break;
        case 'erupt': break;
        case 'roots': case 'web': burst(hx, GY - 4, 10, kind === 'web' ? [PAL.white, PAL.mist] : [PAL.leaf, PAL.bark], { speed: 50 }); break;
        case 'howl': rings.push({ x: hx + d.x, y: GY - 24, r: 6, vr: 200, t: 0, life: 0.5, color: PAL.cyan }); Sound.play('howl'); break;
        case 'curse': rings.push({ x: hx, y: GY - 14, r: 20, vr: -40, t: 0, life: 0.4, color: PAL.magenta }); break;
        case 'harden': rings.push({ x: hx + d.x, y: GY - 24, r: 30, vr: -60, t: 0, life: 0.4, color: PAL.orange }); break;
        case 'drain': burst(hx + d.x, GY - 30, 10, [PAL.green, PAL.yellow], { speed: 40, g: -40 }); break;
        case 'summon': burst(hx + d.x, GY - 20, 16, [PAL.magenta, PAL.pink], { speed: 100 }); break;
      }
    });
    ev.on('telegraph', (m, k) => { rings.push({ x: view.hx + m.x, y: GY - 2, r: 30, vr: -40, t: 0, life: 0.6, color: PAL.red, flat: true }); Sound.play('warn'); });
    ev.on('bossIntro', (m, bounty) => { st.poster = { m, bounty, t: 0, leaving: false }; Sound.play('boss'); });
    ev.on('bossStart', () => { if (st.poster) { st.poster.leaving = true; st.poster.t = 0; } });
    ev.on('bossKill', (m, time) => { banner('悬赏完成', { sub: `${m.d.name} · ${time.toFixed(1)} 秒`, color: PAL.yellow }); Sound.play('fanfare'); });
    ev.on('bossFail', reason => { st.poster = null; banner(reason === 'time' ? '悬赏超时' : '狩猎失败', { sub: b.mode.kind === 'main' ? '退回第 9 关刷关，变强了再来' : '', color: PAL.red }); Sound.play('fail'); });
    // boss stages are announced by the WANTED poster instead
    ev.on('stage', (d, a, s) => { if (b.mode.kind !== 'main' || s === STAGES) return; banner(`${DIFFS[d].name} ${a}-${s}`, { sub: s === 1 ? '进入 ' + ACTS[a - 1].name : ACTS[a - 1].name, color: PAL.cream, life: 1.6 }); });
    ev.on('record', (d, a, s) => { if (s === STAGES) banner(`${ACTS[a - 1].name}通关`, { sub: a === ACT_COUNT ? `${DIFFS[d].name}难度全部通关` :'下一个地域开放了', color: PAL.yellow, life: 2.4 }); });
    ev.on('down', () => { banner('猎人倒下了', { color: PAL.red, life: 1.6 }); Sound.play('down'); });
    ev.on('revive', () => { st.flash = 1; st.flashColor = PAL.yellow; banner('不灭', { color: PAL.yellow, life: 1.2 }); });
    ev.on('undying', () => { st.flash = 0.8; st.flashColor = PAL.amber; banner('不屈', { color: PAL.amber, life: 1.2 }); });
    ev.on('autoRetry', () => banner('重整旗鼓', { sub: '重新向前推进', color: PAL.magenta, life: 1.6 }));
    ev.on('retreat', () => banner('暂避锋芒', { sub: '退回上一关刷装备', color: PAL.orange, life: 1.8 }));
    ev.on('modeStart', k => banner(MODES[k].name, { color: PAL.yellow, life: 1.6 }));
    ev.on('elite', () => {});
  }
  function tickPending(dt) { for (const p of st.pending) { p.t -= dt; if (p.t <= 0) p.fn(); } filt(st.pending, p => p.t > 0); }
  function clear() { for (const l of [parts, nums, coins, beams, arcs, rings, bolts, meteors, banners, sparks, icons, chests, zaps, rains]) l.length = 0; st.poster = null; st.pending.length = 0; }
  return { st, update, drawWorld, drawOver, drawHud, attach, burst, number, banner, tickPending, clear, set opts(o) { opts = o; }, get opts() { return opts; } };
})();
