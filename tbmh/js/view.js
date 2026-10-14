'use strict';
// =====================================================================
//  VIEW — the battle strip (the party, monsters, HUD) and the top bar
// =====================================================================
const View = (() => {
  const v = { hx: 170, t: 0, w: 640, strip: null, sc: null, gold: 0, kpm: 0 };
  function ensure(w) { if (!v.strip || v.strip.width !== w) { v.strip = mkCanvas(w, SH); v.sc = v.strip.getContext('2d'); v.sc.imageSmoothingEnabled = false; } }
  const groupOf = it => MATERIAL_GROUP(tierOf(it.l, tiersFor(it.t)));

  function heroPose(b, h, t) {
    const S = h.S;
    if (h.down) return 'down';
    if (h.hurt > 0.08) return 'hurt';
    if (h.spin > 0) return Math.floor(t * 14) % 2 ? 'strike' : 'raise';
    if (h.swing) {
      if (h.cls === 'sorcerer') return 'cast';
      if (!S.melee) return h.swingT < 0.09 ? 'aim' : h.swingT < 0.22 ? 'loose' : 'aim';
      if (h.swingT < 0.06) return 'raise'; if (h.swingT < 0.2) return 'strike';
    }
    if (h.cast > 0.08) return 'cast';
    if (b.phase === 'march' || b.walking) return 'run' + (Math.floor(t * (b.phase === 'march' ? 13 : 9) + h.slot) % 4);
    if (!S.melee && b.phase === 'fight' && b.front()) return 'aim';
    return Math.floor(t * 1.6 + h.slot * 0.5) % 2 ? 'idle1' : 'idle0';
  }
  const TURN = { raise: 2, strike: 1 };
  const MELEE_ICON = { knight: 'w_sword', slayer: 'w_axe', priest: 'w_scepter' };
  function drawHero(c, b, s, h, t) {
    const pose = heroPose(b, h, t), H = s.heroes[h.cls];
    if (!H) return;
    const coat = H.eq.armor ? 'g' + groupOf(H.eq.armor) : 'none';
    const img = Spr.hero(pose, coat, LOOK[h.cls]);
    // a melee hero behind the front steps forward to swing
    const x = v.hx + h.x + (h.lunge > 0 && h.S.melee ? Math.round(Math.sin((0.3 - h.lunge) / 0.3 * Math.PI) * 10) : 0), y = GY;
    const flip = h.spin > 0 && Math.floor(t * 7) % 2 === 1;
    Paint2.dither(c, x - 7, GY, 15, 2, PAL.ink, 0);
    if (h.inv > 0 && Math.floor(t * 20) % 2) return;
    const main = pose !== 'down' ? H.eq.weapon : null, off = pose !== 'down' ? H.eq.offhand : null;
    const hand = img.hand ? [x - img.ox + img.hand[0], y - img.oy + img.hand[1]] : [x + 6, y - 9];
    // off-hand behind the body: shield, quiver, bolt case, hatchet, floating orb or tome
    if (off) {
      const ot = off.t, bobY = Math.round(Math.sin(t * 2.4 + h.slot) * 2);
      if (ot === 'shield') Spr.draw(c, Spr.held('h_shield', off), x - 5, y - 10);
      else if (ot === 'arrow') Spr.draw(c, Spr.held('h_quiver', off), x - 6, y - 15);
      else if (ot === 'bolt') Spr.draw(c, Spr.held('h_bolts', off), x - 5, y - 7);
      else if (ot === 'hatchet') Spr.draw(c, Spr.held('h_hatchet', off), x - 5, y - 8);
      else if (ot === 'orb') { const o = Spr.icon('h_orb', off.g, 0, off.el); Spr.draw(c, o, x - 11, y - 26 + bobY); c.fillStyle = rgba(ELEM[off.el].color, 0.35); c.fillRect(x - 13, y - 28 + bobY, 5, 5); }
      else if (ot === 'tome') Spr.draw(c, Spr.held('h_tome', off), x - 12, y - 22 + bobY);
    }
    if (h.b.swift > 0 || h.b.quick > 0) Spr.draw(c, img, x - 4, y, { tint: PAL.cyan, alpha: 0.35 });
    if (h.b.blood > 0) Spr.draw(c, img, x - 3, y, { tint: PAL.red, alpha: 0.35 });
    const wpn = main && MELEE_ICON[h.cls] ? Spr.weapon(TYPES[main.t].icon, main.g, groupOf(main), TURN[pose] ?? 0) : null;
    if (wpn && pose === 'raise') Spr.draw(c, wpn, hand[0], hand[1]);
    Spr.draw(c, img, x, y, { white: h.hurt > 0.1, flip });
    if (wpn && pose !== 'raise') Spr.draw(c, wpn, hand[0], hand[1], { white: h.hurt > 0.1 });
    if (main && h.cls === 'ranger') Spr.draw(c, Spr.held('h_bow', main), hand[0] + 1, hand[1] + (pose === 'aim' || pose === 'loose' ? 0 : 2));
    if (main && h.cls === 'hunter') Spr.draw(c, Spr.held('h_xbow', main), hand[0], hand[1]);
    if (main && h.cls === 'sorcerer') { Spr.draw(c, Spr.icon('h_staff', main.g, groupOf(main), h.S.elem), hand[0], hand[1] + 2); if (pose === 'cast') { c.fillStyle = rgba(ELEM[h.S.elem].color, 0.5); c.fillRect(hand[0] - 3, hand[1] - 13, 7, 7); } }
    if (h.down) return;
    // buffs
    if (h.shield > 0) {
      const r = 14, n = 36, a0 = t * 2;
      c.fillStyle = PAL.cyan;
      for (let i = 0; i < n; i++) if ((i + Math.floor(t * 10)) % 5) { const a = a0 + (i / n) * TAU; c.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 11 + Math.sin(a) * r), 1, 1); }
    }
    if (h.b.blade > 0 && Math.floor(t * 8) % 2) { c.fillStyle = PAL.yellow; c.fillRect(x - 8, y - 24, 1, 3); c.fillRect(x + 8, y - 22, 1, 3); }
    if (h.b.wrath > 0) { c.fillStyle = Math.floor(t * 10) % 2 ? PAL.yellow : PAL.white; c.fillRect(x - 1 + Math.round(Math.sin(t * 9) * 4), y - 28, 2, 2); }
    if (b.buffs.cry > 0 && Math.floor(t * 8) % 2) { c.fillStyle = PAL.red; c.fillRect(x - 9, y - 22, 1, 3); c.fillRect(x + 9, y - 20, 1, 3); }
    if (b.buffs.sanct > 0) { c.fillStyle = PAL.cream; for (let i = 0; i < 3; i++) { const yy = Math.round(y - 4 - ((t * 30 + i * 9 + h.slot * 5) % 26)); c.fillRect(x - 8 + i * 8, yy, 1, 2); } }
    Frame.bar(c, x - 10, y - 30, 21, 4, h.hp / h.S.maxHp, PAL.green, { back: PAL.wine });
  }
  function drawParty(c, b, s, t) {
    // pet trots behind the formation
    if (s.pets.cur && PETS[s.pets.cur]) {
      const P = PETS[s.pets.cur], pimg = Spr.get(P.spr, Math.floor(t * 4) % Math.max(1, Spr.frames(P.spr)));
      const last = b.team[b.team.length - 1];
      const px = v.hx + (last ? last.x : 0) - 22, fly = /bat|wisp|eye|drake|skull|sword|butterfly/.test(P.spr);
      const py = GY - (fly ? 14 + Math.round(Math.sin(t * 3) * 2) : 0) - (b.phase === 'march' ? Math.abs(Math.round(Math.sin(t * 12) * 2)) : 0);
      Spr.draw(c, pimg, px, py);
    }
    for (const z of b.summons) {
      const x = Math.round(v.hx + z.x);
      if (z.kind === 'hydra') Spr.draw(c, Spr.get('hydra'), x, GY + Math.round(Math.sin(t * 6)));
      else Spr.draw(c, Spr.get('turret'), x, GY);
    }
    // back to front so the front hero overlaps
    for (let i = b.team.length - 1; i >= 0; i--) drawHero(c, b, s, b.team[i], t);
    if (b.debuff.slow > 0) Spr.draw(c, Spr.tint(Spr.get('i_spd'), PAL.cyan), v.hx + b.frontX() - 4, GY - 40);
    if (b.debuff.curse > 0) Spr.draw(c, Spr.tint(Spr.get('i_skull'), PAL.magenta), v.hx + b.frontX() + 4, GY - 40);
  }
  const AURA_COLOR = { rally: PAL.amber, swift: PAL.cyan, vigor: PAL.green, arcane: PAL.magenta, stone: PAL.steel, ward: PAL.blue, thorny: PAL.leaf, fury: PAL.red, vampiric: PAL.wine };
  function drawMob(c, b, m, t) {
    const img = Scene.mobSprite(m, t);
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
    if (m.elite || m.champ || m.harden > 0 || m.tele || (m.boss && m.bossKind === 'stage')) {
      const col = m.tele ? (Math.floor(t * 16) % 2 ? PAL.red : PAL.yellow) : m.harden > 0 ? PAL.orange : m.champ ? AURA_COLOR[m.champ.aura] || PAL.amber : m.boss ? PAL.amber : PAL.amber;
      const g = Spr.tint(img, col);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) Spr.draw(c, g, x + dx, y + dy);
    }
    Spr.draw(c, img, x, y, { white: m.flash > 0 });
    if (m.frozen > 0) Spr.draw(c, img, x, y, { tint: PAL.cyan, alpha: 0.5 });
    else if (m.chill > 0) Spr.draw(c, img, x, y, { tint: PAL.cyan, alpha: 0.25 });
    if (m.burn > 0 && Math.floor(t * 12) % 2) Spr.draw(c, img, x, y, { tint: PAL.orange, alpha: 0.35 });
    const top = y - img.oy;
    if (m.shock > 0 && Math.floor(t * 10) % 3 === 0) { c.fillStyle = PAL.yellow; c.fillRect(Math.round(x - 4 + Math.sin(t * 20) * 4), Math.round(top + 4), 1, 3); }
    if (m.bleed > 0 && Math.floor(t * 6) % 2) { c.fillStyle = PAL.red; c.fillRect(Math.round(x + 2), Math.round(top + 6 + (t * 20) % 8), 1, 2); }
    if (m.skewer) { c.fillStyle = PAL.cream; for (let i = 0; i < Math.min(5, m.skewer); i++) c.fillRect(Math.round(x - 6 + i * 3), Math.round(top + 8), 1, 3); }
    if (m.stun > 0 && m.frozen <= 0) for (let i = 0; i < 3; i++) { const a = t * 6 + i * 2.1; c.fillStyle = PAL.yellow; c.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(top - 3 + Math.sin(a) * 2), 2, 1); }
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
    // the party's arrows, bolts and spells
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
      if (z.kind === 'orb') {
        Paint2.circle(c, x, GY - 8, 6, PAL.blue); Paint2.circle(c, x, GY - 8, 4, PAL.cyan); c.fillStyle = PAL.white; c.fillRect(x - 2, GY - 11, 2, 2);
        continue;
      }
      c.fillStyle = PAL.ink; c.fillRect(x - 7, GY - 3, 15, 4);
      c.fillStyle = PAL.steel; c.fillRect(x - 6, GY - 2, 13, 2);
      c.fillStyle = PAL.yellow; for (let i = -6; i <= 6; i += 3) c.fillRect(x + i, GY - 4, 1, 2);
      if (Math.floor(t * 4) % 2) { c.fillStyle = PAL.cyan; c.fillRect(x, GY - 1, 1, 1); }
    }
  }

  // ---------- strip ----------
  function strip(ctx, X, Y, w, b, s, t, dt) {
    ensure(w); v.w = w; v.hx = w >= 600 ? 190 : 104; v.t = t;
    const c = v.sc;
    const bio = stageDef(b.where.a, b.where.s).scene;
    const moving = b.wipeT > 0 ? 0 : b.phase === 'march' ? RUN_SPEED * (1 + b.P.move) : b.walking ? WALK_SPEED * (1 + b.P.move) : 0;
    c.globalAlpha = 1;
    Scene.background(c, w, bio, b.where.d, dt, moving, t);
    FX.drawWorld(c, t);
    const mobs = b.mobs.slice().sort((a, b2) => (b2.y ? 1 : 0) - (a.y ? 1 : 0) || b2.x - a.x);
    for (const m of mobs) drawMob(c, b, m, t);
    drawParty(c, b, s, t);
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
    const P = s.prog, D = DIFFS[P.d];
    // where we are (top-left)
    const lw = Text.draw(ctx, `${D.name} ${P.a}-${P.s}`, 6, 4, { color: D.color, outline: PAL.ink });
    Text.draw(ctx, stageDef(P.a, P.s).name + (P.farm ? ' · 刷关' : ''), 12 + lw, 4, { color: P.farm ? PAL.cyan : PAL.cream, outline: PAL.ink });
    if (P.s < STAGES) {
      const total = b.wavePlan().waves, bw = Math.min(120, w * 0.22);
      Frame.bar(ctx, 6, 19, bw, 6, (P.w - 1) / total, PAL.amber, { back: PAL.night });
      const last = P.w >= total;
      ctx.globalAlpha = last ? 1 : 0.45; ctx.drawImage(last && Math.floor(t * 4) % 2 ? Spr.tint(Spr.get('i_skull'), PAL.red) : Spr.get('i_skull'), bw + 10, 18); ctx.globalAlpha = 1;
      Text.draw(ctx, `${P.w}/${total}`, bw + 22, 17, { size: 8, color: PAL.cream, outline: PAL.ink });
    } else Text.draw(ctx, '悬赏首领', 6, 18, { color: PAL.red, outline: PAL.ink });
    // push / farm switch (top-right)
    const bx = w - 98, by = 4, farm = P.farm;
    if (UI.toggle('push', bx, by, 46, 16, '推进', !farm, { kindOn: 'green', tip: ['推进：清完一关自动前往下一关', '快捷键 P'] })) Game.setFarm(false);
    if (UI.toggle('farm', bx + 48, by, 46, 16, '刷关', farm, { kindOn: 'blue', tip: ['刷关：反复刷当前这一关，稳定攒装备和金币', '快捷键 P'] })) Game.setFarm(true);
    if (farm && P.auto) Text.draw(ctx, `再刷 ${Math.max(0, 3 - P.clears)} 次后重新推进`, w - 6, 22, { align: 'right', color: PAL.magenta, outline: PAL.ink });
    // boss / champion bar
    const boss = b.boss && !b.boss.dead && b.phase !== 'march' ? b.boss : null;
    const champ = !boss ? b.mobs.find(x => x.champ && !x.dead && x.x < w - v.hx) : null;
    const big = boss || champ;
    if (big) {
      const bw = Math.min(250, w - 250), bx2 = Math.round(w / 2 - bw / 2 + 10), by2 = 5;
      const name = boss ? boss.d.name : big.champ.name;
      Text.draw(ctx, name, bx2, by2 - 1, { color: boss ? (boss.bossKind === 'act' ? PAL.yellow : PAL.amber) : AURA_COLOR[big.champ.aura] || PAL.amber, outline: PAL.ink });
      if (champ) Text.draw(ctx, AURAS[champ.champ.aura].name, bx2 + Text.width(name) + 6, by2 - 1, { color: PAL.steel, outline: PAL.ink });
      Text.draw(ctx, fmt(big.hp) + ' / ' + fmt(big.maxHp), bx2 + bw, by2, { align: 'right', size: 8, color: PAL.cream, outline: PAL.ink });
      Frame.bar(ctx, bx2, by2 + 13, bw, 6, big.hp / big.maxHp, boss ? PAL.red : PAL.amber);
      if (boss && boss.bossKind === 'act') {
        const tk = b.bossT / b.bossMax, low = b.bossT < 10;
        Frame.bar(ctx, bx2, by2 + 20, bw, 4, tk, low && Math.floor(t * 4) % 2 ? PAL.red : PAL.amber);
        Text.draw(ctx, clock(b.bossT), bx2 + bw + 4, by2 + 15, { color: low ? PAL.red : PAL.cream, outline: PAL.ink });
      }
    }
    // the party: one card per hero
    const n = Math.max(1, b.team.length), cw = Math.min(156, Math.floor((w - 8) / n));
    b.team.forEach((h, i) => heroCard(ctx, b, s, h, 4 + i * cw, SH - 32, cw - 4, t));
    if (Game.toast) {
      const tt = Game.toast, tw = Text.width(tt.text) + 16;
      ctx.globalAlpha = Math.min(1, tt.life * 2);
      Frame.panel(ctx, Math.round(w / 2 - tw / 2), SH - 52, tw, 18, { fill: PAL.ink, hi: tt.color });
      Text.draw(ctx, tt.text, w / 2, SH - 49, { align: 'center', color: tt.color });
      ctx.globalAlpha = 1;
    }
  }
  // avatar, level, life, experience, the active skills with their cooldowns
  function heroCard(ctx, b, s, h, x, y, w, t) {
    const H = s.heroes[h.cls], S = h.S;
    if (!H) return;
    const st = UI.hit('hc' + h.cls, x, y, 30, 30);
    Frame.rarity(ctx, x, y, 30, 30, h.slot === 0 ? 3 : 1, t);
    const mini = Portraits.mini(h.cls);
    ctx.globalAlpha = h.down ? 0.3 : 1; ctx.drawImage(mini, x + 1, y + 1, 28, 28); ctx.globalAlpha = 1;
    if (h.hurt > 0.1) { ctx.fillStyle = rgba(PAL.red, 0.35); ctx.fillRect(x + 1, y + 1, 28, 28); }
    const lvTxt = String(H.lv), lvW = Text.width(lvTxt, 8) + 6;
    Frame.panel(ctx, x + 30 - lvW, y + 21, lvW, 10, { fill: PAL.navy, hi: PAL.blue });
    Text.draw(ctx, lvTxt, x + 30 - lvW / 2, y + 22, { align: 'center', size: 8, color: PAL.white });
    if (st.click) { Game.selectHero(h.cls); Game.openTab('gear'); }
    if (st.hover) UI.setTip([{ text: `${CLASSES[h.cls].hero} · ${CLASSES[h.cls].name}`, color: PAL.amber }, `Lv.${H.lv} · 生命 ${fmt(Math.max(0, h.hp))}/${fmt(S.maxHp)}`, `攻击 ${fmt(S.atk)} · 攻速 ${S.aspd.toFixed(2)}`, { text: '点击查看装备', color: PAL.steel }]);
    const acts = h.acts, nS = acts.length, sw = 19;
    const bw = Math.max(24, w - 34 - nS * sw);
    const bx = x + 33;
    // name on top, then life and experience, all inside the card
    Text.draw(ctx, CLASSES[h.cls].hero, bx, y, { color: h.down ? PAL.slate : PAL.cream, outline: PAL.ink });
    Frame.bar(ctx, bx, y + 14, bw, 8, h.hp / S.maxHp, h.down ? PAL.slate : PAL.green, { back: PAL.wine });
    if (h.shield > 0) { ctx.fillStyle = PAL.cyan; ctx.fillRect(bx + 1, y + 15, Math.round((bw - 2) * clamp(h.shield / S.maxHp, 0, 1)), 2); }
    if (bw >= 50) Text.draw(ctx, h.down ? '倒下' : fmt(Math.max(0, h.hp)), bx + bw / 2, y + 13, { align: 'center', size: 8, color: PAL.white, outline: PAL.ink });
    Frame.bar(ctx, bx, y + 23, bw, 3, H.lv >= HERO_MAX_LEVEL ? 1 : H.exp / expNeed(H.lv), PAL.cyan, { back: PAL.ink });
    let sx = bx + bw + 3;
    for (const id of acts) {
      const k = ACTIVES[id], sy = y + 8;
      ctx.fillStyle = PAL.ink; ctx.fillRect(sx, sy, 18, 18);
      ctx.drawImage(Spr.get(k.icon), sx + 1, sy + 1);
      if (k.type === 'cd') {
        const cd = h.cds[id] || 0, max = k.cd * (1 - S.cdr) / S.cast;
        if (cd > 0) {
          const q = clamp(cd / max, 0, 1);
          ctx.fillStyle = rgba(PAL.ink, 0.7); ctx.fillRect(sx + 1, sy + 1, 16, Math.ceil(16 * q));
          if (cd >= 1) Text.draw(ctx, String(Math.ceil(cd)), sx + 9, sy + 4, { align: 'center', size: 8, color: PAL.white, outline: PAL.ink });
        } else if (Math.floor(t * 3) % 2) { ctx.fillStyle = PAL.yellow; Frame.ring(ctx, sx, sy, 18, 18); }
      } else if (k.type === 'ac') {
        const left = k.every - (h.count % k.every);
        Text.draw(ctx, String(left), sx + 16, sy + 9, { align: 'right', size: 8, color: PAL.amber, outline: PAL.ink });
      } else { ctx.fillStyle = PAL.green; Frame.ring(ctx, sx, sy, 18, 18); }
      sx += sw;
    }
  }
  // the WANTED poster that drops in when an act boss appears
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
    chip('i_gold', fmt(v.gold), PAL.yellow, FX.st.goldPulse, ['金币：符文树、魔方的合成 / 制作 / 拆除 / 供奉'], null, 'gold');
    // the three chest kinds, each with its own capacity
    CHESTS.forEach((C, k) => {
      const n = chestCount(s, k), cap = chestCap(s, k);
      chip(Spr.get('i_chest', 0, String(k)), `${n}/${cap}`, n >= cap ? PAL.red : n ? PAL.cream : PAL.steel, k === 0 ? FX.st.chestPulse || 0 : 0,
        [C.name + `：${n}/${cap}`, n >= cap ? '满了：新掉落的会丢失' : '点开装备页打开宝箱'], () => { Game.openTab('gear'); Panels.UI_ST.gear.view = 'chest'; }, 'ch' + k);
    });
    if (!narrow) chip('i_wanted9', String(s.mats[`stone${s.prog.d}`] || 0), DIFFS[s.prog.d].color, 0, [`${DIFFS[s.prog.d].name}通缉令：再次挑战已击败的悬赏首领`, '只有打赢才消耗'], null, 'stone');
    let rx = w - 4;
    const btn = (id, ic, tip, fn) => { rx -= 18; if (UI.button(id, rx, 1, 17, 16, '', { icon: ic, tip })) fn(); rx -= 2; };
    if (Game.touch) btn('tfull', 'i_full', ['全屏横屏'], () => Game.toggleFull());
    else btn('tmini', 'i_pip', ['挂件小窗（M）'], () => Game.toggleMini());
    btn('tsnd', 'i_sound', [s.opts.music + s.opts.sfx > 0 ? '静音' : '开启声音'], () => Game.toggleMute());
    btn('thome', 'i_home', ['回到 GAME.INC.RE 主页'], () => Game.askHome());
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
