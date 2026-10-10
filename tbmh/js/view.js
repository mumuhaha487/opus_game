'use strict';
// =====================================================================
//  VIEW — the battle strip (actors + HUD) and the top resource bar
// =====================================================================
const View = (() => {
  const v = { hx: 170, t: 0, w: 640, strip: null, sc: null, gold: 0, kpm: 0 };
  function ensure(w) { if (!v.strip || v.strip.width !== w) { v.strip = mkCanvas(w, SH); v.sc = v.strip.getContext('2d'); v.sc.imageSmoothingEnabled = false; } }
  const groupOf = it => MATERIAL_GROUP(tierOf(it.l));

  function heroPose(b, t) {
    const h = b.hero, S = b.S;
    if (h.down > 0) return 'down';
    if (h.hurt > 0.08) return 'hurt';
    if (h.spin > 0) return Math.floor(t * 14) % 2 ? 'strike' : 'raise';
    if (h.swing) {
      if (S.fam === 'staff') return 'cast';
      if (!S.melee) return h.swingT < 0.09 ? 'aim' : h.swingT < 0.22 ? 'loose' : 'aim';
      if (h.swingT < 0.06) return 'raise'; if (h.swingT < 0.2) return 'strike';
    }
    if (h.cast > 0.08) return 'cast';
    if (b.phase === 'march' || h.walking) return 'run' + (Math.floor(t * (b.phase === 'march' ? 13 : 9)) % 4);
    if (!S.melee && b.phase === 'fight' && b.front()) return 'aim';
    return Math.floor(t * 1.6) % 2 ? 'idle1' : 'idle0';
  }
  const TURN = { raise: 2, strike: 1 };
  function drawHero(c, b, s, t) {
    const pose = heroPose(b, t), sex = Game.sex(), S = b.S, h = b.hero;
    const coat = s.eq.chest ? 'g' + groupOf(s.eq.chest) : 'none';
    const img = Spr.hero(pose, coat, sex), x = v.hx, y = GY;
    const flip = h.spin > 0 && Math.floor(t * 7) % 2 === 1;
    Paint2.dither(c, x - 7, GY, 15, 2, PAL.ink, 0);
    // pet trots behind
    if (s.pets.cur && PETS[s.pets.cur]) {
      const P = PETS[s.pets.cur], pimg = Spr.get(P.spr, Math.floor(t * 4) % Math.max(1, Spr.frames(P.spr)));
      const px = x - 26, py = GY - (/bat|wisp|cloud|eye|drake|crystal/.test(P.spr) ? 14 + Math.round(Math.sin(t * 3) * 2) : 0) - (b.phase === 'march' ? Math.abs(Math.round(Math.sin(t * 12) * 2)) : 0);
      Spr.draw(c, pimg, px, py);
    }
    if (h.inv > 0 && Math.floor(t * 20) % 2) return;
    const main = pose !== 'down' ? s.eq.main : null, off = pose !== 'down' ? s.eq.off : null;
    const hand = img.hand ? [x - img.ox + img.hand[0], y - img.oy + img.hand[1]] : [x + 6, y - 9];
    // off-hand behind the body: shield, quiver, bolt case, hatchet, floating orb or tome
    if (off) {
      const ot = off.t, bobY = Math.round(Math.sin(t * 2.4) * 2);
      if (ot === 'shield') Spr.draw(c, Spr.held('h_shield', off), x - 5, y - 10);
      else if (ot === 'quiver') Spr.draw(c, Spr.held('h_quiver', off), x - 6, y - 15);
      else if (ot === 'bolts') Spr.draw(c, Spr.held('h_bolts', off), x - 5, y - 7);
      else if (ot === 'hatchet') Spr.draw(c, Spr.held('h_hatchet', off), x - 5, y - 8);
      else if (ot === 'orb') { const o = Spr.icon('h_orb', off.g, 0, off.el); Spr.draw(c, o, x - 11, y - 26 + bobY); c.fillStyle = rgba(ELEM[off.el].color, 0.35); c.fillRect(x - 13, y - 28 + bobY, 5, 5); }
      else if (ot === 'tome') Spr.draw(c, Spr.held('h_tome', off), x - 12, y - 22 + bobY);
    }
    if (b.hero.gale > 0) Spr.draw(c, img, x - 4, y, { tint: PAL.cyan, alpha: 0.35 });
    const fam = main ? TYPES[main.t].fam : null;
    const wpn = main && (fam === 'sword' || fam === 'axe' || fam === 'scepter') ? Spr.weapon(TYPES[main.t].icon, main.g, groupOf(main), TURN[pose] ?? 0) : null;
    if (wpn && pose === 'raise') Spr.draw(c, wpn, hand[0], hand[1]);
    Spr.draw(c, img, x, y, { white: h.hurt > 0.1, flip });
    if (wpn && pose !== 'raise') Spr.draw(c, wpn, hand[0], hand[1], { white: h.hurt > 0.1 });
    if (main && fam === 'bow') Spr.draw(c, Spr.held('h_bow', main), hand[0] + 1, hand[1] + (pose === 'aim' || pose === 'loose' ? 0 : 2));
    if (main && fam === 'crossbow') Spr.draw(c, Spr.held('h_xbow', main), hand[0], hand[1]);
    if (main && fam === 'staff') { Spr.draw(c, Spr.icon('h_staff', main.g, groupOf(main), S.elem), hand[0], hand[1] + 2); if (pose === 'cast') { c.fillStyle = rgba(ELEM[S.elem].color, 0.5); c.fillRect(hand[0] - 3, hand[1] - 13, 7, 7); } }
    // buffs and debuffs
    if (h.shield > 0) {
      const r = 15, n = 40, a0 = t * 2;
      c.fillStyle = PAL.cyan;
      for (let i = 0; i < n; i++) if ((i + Math.floor(t * 10)) % 5) { const a = a0 + (i / n) * TAU; c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 11 + Math.sin(a) * r), 1, 1); }
    }
    if (b.buffs.warcry > 0 && Math.floor(t * 8) % 2) { c.fillStyle = PAL.red; c.fillRect(x - 9, y - 22, 1, 3); c.fillRect(x + 9, y - 20, 1, 3); c.fillRect(x - 6, y - 27, 1, 2); }
    if (b.buffs.rage > 0) { c.fillStyle = Math.floor(t * 10) % 2 ? PAL.red : PAL.orange; c.fillRect(x - 6 + Math.round(Math.sin(t * 9) * 3), y - 26, 2, 2); c.fillRect(x + 4 + Math.round(Math.cos(t * 7) * 3), y - 22, 1, 2); }
    if (b.buffs.storm > 0) { c.fillStyle = PAL.yellow; const a = t * 5; c.fillRect(Math.round(x + Math.cos(a) * 12), Math.round(y - 12 + Math.sin(a) * 5), 2, 2); }
    if (b.buffs.prayer > 0) { c.fillStyle = PAL.cream; for (let i = 0; i < 3; i++) { const yy = Math.round(y - 4 - ((t * 30 + i * 9) % 26)); c.fillRect(x - 8 + i * 8, yy, 1, 2); } }
    if (b.buffs.hydra > 0) Spr.draw(c, Spr.get('hydra'), x - 18, GY + Math.round(Math.sin(t * 6)));
    if (b.debuff.slow > 0) Spr.draw(c, Spr.tint(Spr.get('i_spd'), PAL.cyan), x - 4, y - 34);
    if (b.debuff.curse > 0) Spr.draw(c, Spr.tint(Spr.get('i_skull'), PAL.magenta), x + 4, y - 34);
    if (h.down <= 0) Frame.bar(c, x - 10, y - 30, 21, 4, h.hp / S.maxHp, PAL.green, { back: PAL.wine });
  }
  const AURA_COLOR = { rally: PAL.amber, swift: PAL.cyan, vigor: PAL.green, arcane: PAL.magenta, stone: PAL.steel, ward: PAL.blue, thorny: PAL.leaf, fury: PAL.red, vampiric: PAL.wine };
  function drawMob(c, b, m, t) {
    let img = Scene.mobSprite(m, t);
    let x = v.hx + m.x, y = GY - (m.y || 0);
    if (m.dead) {
      if (!m.escaped) return;
      x += m.deathT * 180; y -= Math.sin(Math.min(1, m.deathT * 2) * Math.PI) * 18;
      Spr.draw(c, img, x, y, { alpha: 1 - m.deathT });
      return;
    }
    if (m.y) y += Math.round(Math.sin(t * 4 + m.id) * 2);
    if (m.d.hop && m.stun <= 0) y -= Math.round(Math.abs(Math.sin(t * 6 + m.id)) * 3);
    if (m.act > 0) x -= Math.round(Math.sin(((0.3 - m.act) / 0.3) * Math.PI) * 5);
    if (!m.y) Paint2.dither(c, Math.round(x - m.w / 2), GY, m.w, 2, PAL.ink, 1);
    if (m.champ) {
      // a champion stands in its aura
      const col = AURA_COLOR[m.champ.aura] || PAL.amber, r = m.w / 2 + 4;
      c.fillStyle = rgba(col, 0.5);
      for (let i = 0; i < 18; i++) { const a = t * 2 + (i / 18) * TAU; c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(GY - 1 + Math.sin(a) * 2), 1, 1); }
    }
    if (m.elite || m.champ || m.harden > 0 || m.tele) {
      const col = m.tele ? (Math.floor(t * 16) % 2 ? PAL.red : PAL.yellow) : m.harden > 0 ? PAL.orange : m.champ ? AURA_COLOR[m.champ.aura] || PAL.amber : PAL.amber;
      const g = Spr.tint(img, col);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) Spr.draw(c, g, x + dx, y + dy, { flip: !!m.d.flee && m.flee > 0 });
    }
    Spr.draw(c, img, x, y, { white: m.flash > 0, flip: !!m.d.flee && m.flee > 0 });
    if (m.burn > 0 && Math.floor(t * 12) % 2) Spr.draw(c, img, x, y, { tint: PAL.orange, alpha: 0.35 });
    const top = y - img.oy;
    if (m.stun > 0) for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; c.fillStyle = PAL.yellow; c.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(top - 3 + Math.sin(a) * 2), 2, 1); }
    if (m.root > 0) { c.fillStyle = PAL.leaf; for (let i = -1; i <= 1; i++) c.fillRect(Math.round(x + i * 4), GY - 4, 1, 4); }
    if (m.tele) Text.draw(c, '!', x, top - 16, { align: 'center', color: PAL.red, outline: PAL.ink });
    if (!m.boss && !m.champ && m.hp < m.maxHp) Frame.bar(c, Math.round(x - 8), Math.round(top - 5), 16, 3, m.hp / m.maxHp, m.elite ? PAL.amber : PAL.red);
    if (m.elite) { c.fillStyle = PAL.yellow; c.fillRect(Math.round(x - 2), Math.round(top - 9), 5, 2); c.fillRect(Math.round(x - 2), Math.round(top - 11), 1, 2); c.fillRect(Math.round(x), Math.round(top - 11), 1, 2); c.fillRect(Math.round(x + 2), Math.round(top - 11), 1, 2); }
    if (m.champ) c.drawImage(Spr.tint(Spr.get('i_skull'), AURA_COLOR[m.champ.aura] || PAL.amber), Math.round(x - 5), Math.round(top - 14));
  }
  function drawShots(c, b, t) {
    for (const sh of b.shots) {
      const img = Spr.get('p_' + (sh.kind === 'bomb' ? 'bombm' : sh.kind || 'sting'));
      const x = v.hx + sh.x, y = GY - (sh.y || 10) - (sh.arc || sh.kind === 'bomb' ? Math.sin(Math.min(1, sh.x / 120) * Math.PI) * 14 : 0);
      Spr.draw(c, img, x, y, { flip: true });
      if (sh.kind === 'fireball' || sh.kind === 'lava') { c.fillStyle = PAL.orange; c.fillRect(Math.round(x + 5), Math.round(y), 2, 1); c.fillStyle = PAL.yellow; c.fillRect(Math.round(x + 8 + (t * 40) % 3), Math.round(y), 1, 1); }
    }
    // the hunter's arrows, bolts and spells
    for (const a of b.arrows) {
      const tx = a.tgt && !a.tgt.dead ? a.tgt.x : a.x + 40, ty = a.tgt && !a.tgt.dead ? (a.tgt.y || 0) + 8 : 10;
      const k = clamp(a.x / Math.max(20, tx), 0, 1), x = v.hx + a.x, y = GY - lerp(a.y, ty, k);
      let img;
      if (a.kind === 'arrow' || a.kind === 'bolt' || a.kind === 'bomb' || a.kind === 'hatchet') img = Spr.get('p_' + a.kind, a.kind === 'hatchet' ? Math.floor(t * 16) % 2 : 0);
      else if (a.kind === 'fireball' || a.kind === 'hydra') img = Spr.get('p_fireball');
      else img = Spr.get('p_magic', 0, a.elem);
      Spr.draw(c, img, x, y);
      if (a.kind === 'magic' || a.kind === 'fireball') { c.fillStyle = rgba(ELEM[a.elem] ? ELEM[a.elem].color : PAL.orange, 0.5); c.fillRect(Math.round(x - 6), Math.round(y), 4, 1); }
    }
    for (const z of b.zones) {
      const x = Math.round(v.hx + z.x);
      c.fillStyle = PAL.ink; c.fillRect(x - 7, GY - 3, 15, 4);
      c.fillStyle = PAL.steel; c.fillRect(x - 6, GY - 2, 13, 2);
      c.fillStyle = PAL.mist; for (let i = -6; i <= 6; i += 3) c.fillRect(x + i, GY - 4, 1, 2);
      c.fillStyle = PAL.red; c.fillRect(x, GY - 1, 1, 1);
    }
  }

  // ---------- strip ----------
  function strip(ctx, X, Y, w, b, s, t, dt) {
    ensure(w); v.w = w; v.hx = w >= 600 ? 170 : 74; v.t = t;
    const c = v.sc;
    const bio = b.mode.kind === 'mine' ? 'cavern' : ACTS[b.where.a - 1].id;
    const moving = b.hero.down > 0 ? 0 : b.phase === 'march' ? RUN_SPEED * (1 + b.S.runSpeed) : b.hero.walking ? WALK_SPEED * (1 + b.S.runSpeed) : 0;
    c.globalAlpha = 1;
    Scene.background(c, w, bio, b.where.d, dt, moving, t);
    FX.drawWorld(c, t);
    const mobs = b.mobs.slice().sort((a, b2) => (b2.y ? 1 : 0) - (a.y ? 1 : 0) || b2.x - a.x);
    for (const m of mobs) drawMob(c, b, m, t);
    drawHero(c, b, s, t);
    drawShots(c, b, t);
    FX.drawOver(c, t);
    Scene.foreground(c, w, bio);
    const sh = FX.st.shake * FX.opts.shake;
    const ox = sh > 0.02 ? Math.round((Math.random() * 2 - 1) * sh * 5) : 0, oy = sh > 0.02 ? Math.round((Math.random() * 2 - 1) * sh * 3) : 0;
    ctx.fillStyle = PAL.ink; ctx.fillRect(X, Y, w, SH);
    ctx.drawImage(v.strip, X + ox, Y + oy);
    ctx.save(); ctx.translate(X, Y);
    ctx.beginPath(); ctx.rect(0, 0, w, SH); ctx.clip();
    hud(ctx, w, b, s, t);
    FX.drawHud(ctx, w, t);
    poster(ctx, w, b, t);
    ctx.restore();
  }
  function hud(ctx, w, b, s, t) {
    const m = b.mode, P = s.prog;
    // where we are (top-left)
    if (m.kind === 'main') {
      const D = DIFFS[P.d];
      const lw = Text.draw(ctx, `${D.name} ${P.a}-${P.s}`, 6, 4, { color: D.color, outline: PAL.ink });
      Text.draw(ctx, ACTS[P.a - 1].name + (P.farm ? ' · 刷关' : ''), 12 + lw, 4, { color: P.farm ? PAL.cyan : PAL.cream, outline: PAL.ink });
      if (P.s < STAGES) {
        const total = waveCount(P.d, P.a, P.s), bw = Math.min(120, w * 0.22);
        Frame.bar(ctx, 6, 19, bw, 6, (P.w - 1) / total, PAL.amber, { back: PAL.night });
        const last = P.w >= total;
        ctx.globalAlpha = last ? 1 : 0.45; ctx.drawImage(last && Math.floor(t * 4) % 2 ? Spr.tint(Spr.get('i_skull'), PAL.red) : Spr.get('i_skull'), bw + 10, 18); ctx.globalAlpha = 1;
        Text.draw(ctx, `${P.w}/${total}`, bw + 22, 17, { size: 8, color: PAL.cream, outline: PAL.ink });
      } else Text.draw(ctx, '悬赏首领', 6, 18, { color: PAL.red, outline: PAL.ink });
    } else if (m.kind === 'trial') {
      Text.draw(ctx, `突变试炼 · 第 ${Math.min(m.wave, TRIAL_WAVES + 1)}/${TRIAL_WAVES + 1} 波`, 6, 4, { color: PAL.magenta, outline: PAL.ink });
      Text.draw(ctx, m.muts.map(k => MUTATORS[k].name).join(' ') || '无突变', 6, 18, { color: PAL.pink, outline: PAL.ink });
    } else if (m.kind === 'mine') {
      Text.draw(ctx, `贪婪矿井 · ${clock(m.t)}`, 6, 4, { color: PAL.yellow, outline: PAL.ink });
      Text.draw(ctx, `+${fmt(m.gold)} 金币`, 6, 18, { color: PAL.amber, outline: PAL.ink });
    } else if (m.kind === 'rush') {
      Text.draw(ctx, `首领连战 · 第 ${m.n + 1} 战`, 6, 4, { color: PAL.yellow, outline: PAL.ink });
      Text.draw(ctx, `首领宝箱 +${m.n}`, 6, 18, { color: PAL.pink, outline: PAL.ink });
    }
    // push / farm switch (top-right)
    if (m.kind === 'main') {
      const bx = w - 98, by = 4, farm = P.farm;
      if (UI.toggle('push', bx, by, 46, 16, '推进', !farm, { kindOn: 'green', tip: ['推进：清完一关自动前往下一关', '快捷键 P'] })) Game.setFarm(false);
      if (UI.toggle('farm', bx + 48, by, 46, 16, '刷关', farm, { kindOn: 'blue', tip: ['刷关：反复刷当前这一关，稳定攒装备和金币', '快捷键 P'] })) Game.setFarm(true);
      if (farm && P.auto) Text.draw(ctx, `再刷 ${Math.max(0, 3 - P.clears)} 次后重新推进`, w - 6, 22, { align: 'right', color: PAL.magenta, outline: PAL.ink });
    } else if (UI.button('leave2', w - 54, 4, 50, 16, '撤退', { kind: 'red' })) Game.leaveMode();
    // boss / champion bar
    const boss = b.boss && !b.boss.dead && b.phase !== 'march' ? b.boss : null;
    const champ = !boss ? b.mobs.find(x => x.champ && !x.dead && x.x < w - v.hx) : null;
    const big = boss || champ;
    if (big) {
      const bw = Math.min(250, w - 250), bx = Math.round(w / 2 - bw / 2 + 10), by = 5;
      const name = boss ? boss.d.name : big.champ.name;
      Text.draw(ctx, name, bx, by - 1, { color: boss ? PAL.yellow : AURA_COLOR[big.champ.aura] || PAL.amber, outline: PAL.ink });
      if (champ) Text.draw(ctx, AURAS[champ.champ.aura].name, bx + Text.width(name) + 6, by - 1, { color: PAL.steel, outline: PAL.ink });
      Text.draw(ctx, fmt(big.hp) + ' / ' + fmt(big.maxHp), bx + bw, by, { align: 'right', size: 8, color: PAL.cream, outline: PAL.ink });
      Frame.bar(ctx, bx, by + 13, bw, 6, big.hp / big.maxHp, boss ? PAL.red : PAL.amber);
      if (boss) {
        const tk = b.bossT / b.bossMax, low = b.bossT < 10;
        Frame.bar(ctx, bx, by + 20, bw, 4, tk, low && Math.floor(t * 4) % 2 ? PAL.red : PAL.amber);
        Text.draw(ctx, clock(b.bossT), bx + bw + 4, by + 15, { color: low ? PAL.red : PAL.cream, outline: PAL.ink });
      }
    }
    // the hunter: avatar, level, life, experience, skills
    const S = b.S, h = b.hero, ax = 4, ay = SH - 38;
    Frame.rarity(ctx, ax, ay, 34, 34, 4, t);
    const mini = Portraits.mini(Game.sex());
    if (mini) { ctx.globalAlpha = h.down > 0 ? 0.35 : 1; ctx.drawImage(mini, ax + 1, ay + 1); ctx.globalAlpha = 1; }
    if (h.hurt > 0.1) { ctx.fillStyle = rgba(PAL.red, 0.35); ctx.fillRect(ax + 1, ay + 1, 32, 32); }
    const lvTxt = String(s.hero.lv), lvW = Text.width(lvTxt, 8) + 6;
    Frame.panel(ctx, ax + 34 - lvW, ay + 25, lvW, 10, { fill: PAL.navy, hi: PAL.blue });
    Text.draw(ctx, lvTxt, ax + 34 - lvW / 2, ay + 26, { align: 'center', size: 8, color: PAL.white });
    const hx = 42, hy = SH - 16;
    Frame.bar(ctx, hx, hy, 104, 8, h.hp / S.maxHp, PAL.green, { back: PAL.wine });
    if (h.shield > 0) { ctx.fillStyle = PAL.cyan; ctx.fillRect(hx + 1, hy + 1, Math.round(102 * clamp(h.shield / S.maxHp, 0, 1)), 2); }
    Text.draw(ctx, fmt(Math.max(0, h.hp)) + '/' + fmt(S.maxHp), hx + 52, hy - 1, { align: 'center', size: 8, color: PAL.white, outline: PAL.ink });
    const need = expNeed(s.hero.lv);
    Frame.bar(ctx, hx, hy + 9, 104, 3, s.hero.lv >= HERO.maxLevel ? 1 : s.hero.exp / need, PAL.cyan, { back: PAL.ink });
    let sx = hx + 110;
    const nS = Math.min(4, S.skillSlots);
    for (let i = 0; i < nS; i++) {
      const id = s.skills.slots[i];
      ctx.fillStyle = PAL.ink; ctx.fillRect(sx, hy - 9, 18, 18);
      if (id && skillUsable(s, id)) {
        const cd = b.cds[id] || 0, max = SKILLS[id].cd * (1 - S.cdr);
        ctx.drawImage(Spr.get(SKILLS[id].icon), sx + 1, hy - 8);
        if (cd > 0) {
          const k = clamp(cd / max, 0, 1);
          ctx.fillStyle = rgba(PAL.ink, 0.7); ctx.fillRect(sx + 1, hy - 8, 16, Math.ceil(16 * k));
          if (cd >= 1) Text.draw(ctx, String(Math.ceil(cd)), sx + 9, hy - 5, { align: 'center', size: 8, color: PAL.white, outline: PAL.ink });
        } else if (Math.floor(t * 3) % 2) { ctx.fillStyle = PAL.yellow; Frame.ring(ctx, sx, hy - 9, 18, 18); }
      } else { ctx.fillStyle = PAL.night; ctx.fillRect(sx + 1, hy - 8, 16, 16); }
      sx += 20;
    }
    let bfx = sx + 4;
    for (const [k, col, label] of [['warcry', PAL.red, '吼'], ['storm', PAL.amber, '财'], ['rage', PAL.wine, '狂'], ['prayer', PAL.cream, '祷'], ['aegis', PAL.cyan, '盾'], ['hydra', PAL.orange, '蛇']]) if (b.buffs[k] > 0) { Frame.panel(ctx, bfx, hy - 4, 14, 14, { fill: col }); Text.draw(ctx, label, bfx + 7, hy - 3, { align: 'center', color: PAL.ink }); bfx += 16; }
    if (h.gale > 0) { Frame.panel(ctx, bfx, hy - 4, 22, 14, { fill: PAL.blue }); Text.draw(ctx, '×' + h.gale, bfx + 11, hy - 1, { align: 'center', size: 8, color: PAL.white }); }
    if (Game.toast) {
      const tt = Game.toast, tw = Text.width(tt.text) + 16;
      ctx.globalAlpha = Math.min(1, tt.life * 2);
      Frame.panel(ctx, Math.round(w / 2 - tw / 2), SH - 44, tw, 18, { fill: PAL.ink, hi: tt.color });
      Text.draw(ctx, tt.text, w / 2, SH - 41, { align: 'center', color: tt.color });
      ctx.globalAlpha = 1;
    }
  }
  // the WANTED poster that drops in when a bounty boss appears
  function poster(ctx, w, b, t) {
    const P = FX.st.poster; if (!P) return;
    const m = P.m, pw = 116, ph = 114;
    let x = w / 2 - pw / 2, y;
    if (!P.leaving) y = -ph + (ph + 18) * Ease.outBack(Math.min(1, P.t / 0.45));
    else { const k = Ease.inQuad(Math.min(1, P.t / 0.45)); x = lerp(x, w + 20, k); y = 18 - k * 40; }
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = PAL.bark; ctx.fillRect(x + pw / 2 - 1, y - 6, 2, 8);
    ctx.fillStyle = PAL.ink; ctx.fillRect(x + pw / 2 - 3, y - 8, 6, 3);
    Frame.parchment(ctx, x, y, pw, ph);
    Text.draw(ctx, 'WANTED', x + pw / 2, y + 3, { align: 'center', color: PAL.wine });
    ctx.fillStyle = PAL.tan; ctx.fillRect(x + 6, y + 17, pw - 12, 50);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y + 17, pw - 12, 50); ctx.clip();
    Spr.draw(ctx, Spr.get(m.d.spr, Math.floor(t * 2) % 2), x + pw / 2, y + 64);
    ctx.restore();
    Text.draw(ctx, m.d.name, x + pw / 2, y + 69, { align: 'center', color: PAL.soil });
    const bt = '赏金 ' + fmt(P.bounty), bw = Text.width(bt) + 12;
    icon(ctx, 'i_gold', x + pw / 2 - bw / 2, y + 85);
    Text.draw(ctx, bt, x + pw / 2 - bw / 2 + 12, y + 83, { color: PAL.rust });
    Text.draw(ctx, `限时 ${Math.round(b.bossMax)} 秒`, x + pw / 2, y + 97, { align: 'center', color: PAL.bark });
  }
  const icon = (ctx, name, x, y) => ctx.drawImage(Spr.get(name), Math.round(x), Math.round(y));

  // ---------- top bar ----------
  function topBar(ctx, w, s, t, dt) {
    ctx.fillStyle = PAL.ink; ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = PAL.night; ctx.fillRect(0, 17, w, 1);
    v.gold += (s.gold - v.gold) * Math.min(1, dt * 10); if (Math.abs(s.gold - v.gold) < 1) v.gold = s.gold;
    const narrow = w < 560;
    let x = 4;
    if (!narrow) { Text.draw(ctx, 'TBMH', x, 3, { color: PAL.amber }); x += 38; }
    const chip = (ic, val, col, pulse, tip, onClick, id) => {
      const tw = Text.width(val) + 16;
      const st = onClick ? UI.hit('chip' + id, x, 2, tw, 14) : null;
      Frame.panel(ctx, x, 2, tw, 14, { fill: pulse > 0 ? mixHex(PAL.night, col, pulse * 0.4) : st && st.hover ? PAL.dusk : PAL.night, hi: PAL.dusk, lo: false });
      ctx.drawImage(typeof ic === 'string' ? Spr.get(ic) : ic, x + 3, 4);
      Text.draw(ctx, val, x + 13, 2, { color: col });
      if (tip && UI.over(x, 2, tw, 14)) UI.setTip(tip);
      if (st && st.click) onClick();
      x += tw + 3;
    };
    chip('i_gold', fmt(v.gold), PAL.yellow, FX.st.goldPulse, ['金币：符文树、部位强化、制作与重铸'], null, 'gold');
    chip('i_exp', 'Lv.' + s.hero.lv, PAL.cyan, FX.st.expPulse || 0, [`猎人等级 ${s.hero.lv}`, s.hero.lv < HERO.maxLevel ? `经验 ${fmt(s.hero.exp)} / ${fmt(expNeed(s.hero.lv))}` : '已满级', `可用技能点 ${skillFree(s)}`], () => Game.openTab('skill'), 'lv');
    const tray = s.tray.length, cap = traySize(s);
    chip('i_chest', `${tray}/${cap}`, tray >= cap ? PAL.red : tray ? PAL.cream : PAL.steel, FX.st.chestPulse || 0, ['宝箱托盘：点开装备页打开宝箱', tray >= cap ? '托盘满了，新的宝箱拿不到' : ''], () => Game.openTab('gear'), 'tray');
    if (!narrow) chip('i_wanted9', String(s.mats[`wanted_${s.prog.d}`] || 0), DIFFS[s.prog.d].color, 0, [`${DIFFS[s.prog.d].name}通缉令：再次挑战已击败的悬赏首领`, '只有打赢才消耗'], null, 'wanted');
    let rx = w - 4;
    const btn = (id, ic, tip, fn) => { rx -= 18; if (UI.button(id, rx, 1, 17, 16, '', { icon: ic, tip })) fn(); rx -= 2; };
    if (Game.touch) btn('tfull', 'i_full', ['全屏横屏'], () => Game.toggleFull());
    else btn('tmini', 'i_pip', ['挂件小窗（M）'], () => Game.toggleMini());
    btn('tsnd', 'i_sound', [s.opts.music + s.opts.sfx > 0 ? '静音' : '开启声音'], () => Game.toggleMute());
    const kpm = Game.monitor.kpm();
    const label = narrow ? `${Math.round(kpm)}/分` : `击杀/分 ${Math.round(kpm)}`;
    const lw = Text.width(label) + 34;
    rx -= lw;
    if (rx > x) {
      if (UI.over(rx, 1, lw, 16)) UI.setTip(monitorTip);
      Text.draw(ctx, label, rx, 3, { color: PAL.green });
      const bars = Game.monitor.bars(8), mx = rx + lw - 30, bmax = Math.max(1, ...bars);
      bars.forEach((n, i) => { const hh = Math.max(1, Math.round((n / bmax) * 11)); ctx.fillStyle = i === bars.length - 1 ? PAL.green : PAL.leaf; ctx.fillRect(mx + i * 3, 14 - hh, 2, hh); });
    }
  }
  const monitorTip = (ctx, x, y) => {
    const M = Game.monitor;
    const rows = [['击杀/分', Math.round(M.kpm()), PAL.green], ['金币/分', fmt(M.gpm()), PAL.yellow], ['经验/分', fmt(M.xpm()), PAL.cyan], ['宝箱/时', fmt(M.cpm() * 60), PAL.amber]];
    rows.forEach(([k, val, col], i) => { Text.draw(ctx, k, x + 6, y + 4 + i * 14, { color: PAL.steel }); Text.draw(ctx, String(val), x + 150, y + 4 + i * 14, { align: 'right', color: col }); });
    Text.draw(ctx, '最近 10 分钟（每分钟击杀）', x + 6, y + 62, { color: PAL.steel });
    const bars = M.bars(10), bmax = Math.max(1, ...bars);
    bars.forEach((n, i) => { const hh = Math.max(1, Math.round((n / bmax) * 22)); ctx.fillStyle = PAL.green; ctx.fillRect(x + 8 + i * 14, y + 100 - hh, 10, hh); });
  };
  monitorTip.w = 160; monitorTip.h = 106;
  const idle = () => {};
  return { strip, topBar, idle, v, AURA_COLOR };
})();
