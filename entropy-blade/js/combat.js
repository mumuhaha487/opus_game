'use strict';
// =====================================================================
//  COMBAT — entities, hitboxes, damage pipeline, statuses, projectiles, zones
// =====================================================================
let UID = 0;
class Ent {
  constructor(x, y, w, h) {
    this.id = ++UID; this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0; this.face = 1; this.onGround = false; this.dead = false; this.flash = 0;
  }
  get cx() { return this.x; }
  get cy() { return this.y - this.h / 2; }
  hurtbox() { return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h }; }
}

const ELEM_COL = { fire: '#ff8a2a', ice: '#7ff0ff', thunder: '#ffe14a', void: '#b46cff', blood: '#ff3b5c', none: '#ffffff' };

// ---------- hitboxes ----------
const Combat = {
  boxes: [],
  clear() { this.boxes.length = 0; },
  // rel = [x0, y0, w, h] in facing-right local coords relative to owner feet
  box(owner, team, rel, hit, dur, o = {}) {
    // 刃长 and other reach effects: the player's boxes grow forward (and a little in height)
    const k = team === 'p' && owner && owner === G.player && owner.reach ? owner.reach(hit.wx === undefined ? null : hit.wx) : 1;
    if (k > 1) { const [x0, y0, w, h] = rel, nh = h * (1 + (k - 1) * 0.5); rel = [x0 < 0 ? x0 * k : x0, y0 - (nh - h) / 2, w * k, nh]; }
    const b = { owner, team, rel, hit, life: dur, follow: o.follow !== false, hits: new Map(), multi: o.multi || 0, x: 0, y: 0, w: rel[2], h: rel[3], face: owner ? owner.face : 1, onHit: o.onHit };
    this.place(b);
    this.boxes.push(b);
    return b;
  },
  // world-space box
  area(team, x, y, w, h, hit, dur, o = {}) {
    const b = { owner: o.owner || null, team, rel: null, hit, life: dur, follow: false, hits: new Map(), multi: o.multi || 0, x, y, w, h, face: o.face || 1, onHit: o.onHit };
    this.boxes.push(b);
    return b;
  },
  place(b) {
    if (!b.rel || !b.owner) return;
    const f = b.follow ? b.owner.face : b.face;
    const [x0, y0, w, h] = b.rel;
    b.x = f > 0 ? b.owner.x + x0 : b.owner.x - x0 - w;
    b.y = b.owner.y + y0; b.w = w; b.h = h; b.face = f;
  },
  update(dt) {
    for (let i = this.boxes.length - 1; i >= 0; i--) {
      const b = this.boxes[i];
      b.life -= dt;
      if (b.life <= 0 || (b.owner && b.owner.dead && b.team === 'e')) { this.boxes.splice(i, 1); continue; }
      if (b.follow) this.place(b);
      const now = G.time;
      if (b.team === 'p') {
        for (const e of G.enemies) {
          if (e.dead || e.spawning || e.intangible) continue;
          const last = b.hits.get(e.id);
          if (last !== undefined && (!b.multi || now - last < b.multi)) continue;
          if (!overlap(b, e.hurtbox())) continue;
          b.hits.set(e.id, now);
          const h = Object.assign({}, b.hit);
          if (h.radial) h.dir = sign(e.x - (b.owner ? b.owner.x : b.x + b.w / 2)) || 1;
          else if (!h.dir) h.dir = b.face;
          hitEnemy(G.player, e, h, clamp(e.x, b.x, b.x + b.w), clamp(e.cy, b.y, b.y + b.h));
          if (b.onHit) b.onHit(e, b);
        }
      } else if (b.team === 'e') {
        const p = G.player;
        if (p && !p.dead) {
          const last = b.hits.get(p.id);
          if (last !== undefined && (!b.multi || now - last < b.multi)) continue;
          if (!overlap(b, p.hurtbox())) continue;
          b.hits.set(p.id, now);
          if (hurtPlayer(b.hit.dmg, b.owner ? b.owner.x : b.x + b.w / 2, b.hit)) {
            if (b.hit.chill) p.chill(b.hit.chill);
            if (b.onHit) b.onHit(p, b);
          }
        }
      }
    }
  },
  debugDraw(ctx, cx, cy) {
    for (const b of this.boxes) { ctx.strokeStyle = b.team === 'p' ? '#0f0' : '#f00'; ctx.strokeRect(b.x - cx + 0.5, b.y - cy + 0.5, b.w, b.h); }
  },
};

// ---------- damage to enemies ----------
function hitEnemy(p, e, h, hx, hy) {
  if (!e || e.dead || e.spawning || (e.intangible && !h.dot)) return 0;
  // the 武学 this hit came from may carry its own signature effects
  const perks = p && h.wx && p.wxPerksOf ? p.wxPerksOf(h.wx) : null;
  if (perks) { h = Object.assign({}, h); for (const pk of perks) if (pk.pre) pk.pre(p, e, h); }
  let dmg = h.dmg;
  let crit = false;
  let blocked = false;
  if (h.execute && !e.boss) {
    dmg = e.hp;
  } else {
    if (p && !h.noCrit) {
      let cc = p.stats.crit + (h.critBonus || 0);
      if (p.counters.nextCrit) { cc = 1; if (!h.dot) p.counters.nextCrit = 0; }
      if (Math.random() < cc) crit = true;
    }
    if (crit) dmg *= p.stats.critDmg + (h.critDmgBonus || 0);
    if (p) dmg *= p.damageMult(e, h);
    dmg *= e.takenMult(h);
    if (e.blocks && e.blocks(h, p ? p.x : hx)) { blocked = true; dmg *= 0.15; }
    if (e.shield > 0 && !h.dot) {
      const ab = Math.min(e.shield, dmg * 0.8);
      e.shield -= ab; dmg -= ab;
      if (e.shield <= 0) { FX.ring(e.x, e.cy, 6, 30, '#7fd8ff', 0.3, 3); Sound.play('shatter', { x: e.x }); }
    }
  }
  dmg = Math.max(1, dmg);
  e.hp -= dmg;
  e.lastHitT = G.time;
  if (!h.dot) e.flash = 0.08;
  const col = h.fxc || ELEM_COL[h.elem || 'none'];
  if (!h.dot) {
    const big = crit || h.heavy;
    if (blocked) {
      FX.sparks(hx, hy, h.dir > 0 ? Math.PI : 0, '#ffe9a0', 7, [120, 260], 0.8);
      FX.flash(hx, hy, 6, '#ffffff', 0.08);
      Sound.play('clank', { x: e.x });
    } else {
      FX.hitSpark(hx, hy, h.dir || 1, col, big);
      if (h.sfx !== false) Sound.play(crit ? 'crit' : (h.heavy ? 'hitHeavy' : (h.sfx || 'hit')), { x: e.x });
    }
    const hs = blocked ? 2 : Math.round((h.hs || 0) * (crit ? 1.4 : 1));
    if (hs > 0) G.hitstop(hs);
    if (h.heavy || crit) Cam.shake(h.heavy ? 0.28 : 0.16);
    else Cam.shake(0.05);
    if (h.kx) Cam.push((h.dir || 1) * (h.heavy ? 2.5 : 1), 0);
    e.onHurt(h, dmg, p ? p.x : hx, blocked);
  }
  FX.num(e.x, e.y - e.h, dmg, { crit, c: h.numc || (h.dot ? col : undefined), big: h.heavy && !h.dot });
  if (p) {
    p.dealt += dmg;
    if (!h.dot && !h.noCombo) p.addCombo();
    // free, cooldown-less 技能 (U) hits charge 灵力 at 40% so spamming them can't feed 秘技 endlessly
    if (!h.noEnergy) p.gainMana((h.dot ? 0.1 : h.energy !== undefined ? h.energy : 1) * (h.wx && h.wx.fam === 'u' ? 0.4 : 1) * p.hero.energyRate * 0.9);
    if (h.status && !e.dead) applyStatus(e, h.status[0], h.status[1], h.status[2]);
    if (!h.noProc && !h.dot) {
      p.fire('onHit', e, h, dmg, crit);
      if (crit) p.fire('onCrit', e, h, dmg);
    }
    if (perks) for (const pk of perks) if (pk.hit) pk.hit(p, e, h, dmg, crit);
  }
  if (e.hp <= 0 && !e.dead) {
    e.die(h);
    // (a foe that cheated death is not a kill)
    if (e.dead) {
      if (p) p.fire('onKill', e, h);
      if (perks) for (const pk of perks) if (pk.kill) pk.kill(p, e, h);
    }
  }
  return dmg;
}

// status effects: stun (can't act), slow (fraction), mark (猎印), echo streaks
function applyStatus(e, type, a, b) {
  if (!e || e.dead || e.intangible) return;
  const st = e.st;
  const res = e.boss ? 0.35 : 1;
  switch (type) {
    case 'stun':
      if (st.stun <= 0) FX.text(e.x, e.y - e.h - 8, '眩晕', '#ffe14a', { size: 8, life: 0.6 });
      st.stun = Math.max(st.stun, a * res);
      break;
    case 'slow':
      st.slow = Math.max(st.slow, a * (e.boss ? 0.5 : 1)); st.slowT = Math.max(st.slowT, b || 1);
      break;
    case 'mark':
      st.mark = Math.max(st.mark, a || 6);
      break;
    case 'vuln':
      st.vulnT = Math.max(st.vulnT, a || 3);
      break;
    case 'shade': // 影印 (凛·影缝)
      if (!(st.shade > 0)) FX.text(e.x, e.y - e.h - 8, '影印', '#c08aff', { size: 8, life: 0.6 });
      st.shade = Math.max(st.shade || 0, a || 6);
      break;
    case 'burn': // a = seconds, b = player attack multiplier per 0.5s tick
      if (!(st.burn > 0)) { st.burnTick = 0.5; FX.text(e.x, e.y - e.h - 8, '燃烧', '#ff8a3a', { size: 8, life: 0.6 }); }
      st.burn = Math.max(st.burn || 0, a || 3);
      st.burnDmg = Math.max(st.burn > 0 ? st.burnDmg || 0 : 0, (b || 0.25) * (G.player ? G.player.atk : 10));
      break;
  }
}
function newStatus() { return { stun: 0, slow: 0, slowT: 0, mark: 0, vulnT: 0, streak: 0, streakId: 0, shade: 0, burn: 0, burnDmg: 0, burnTick: 0 }; }
function tickStatus(e, dt) {
  const st = e.st;
  if (st.stun > 0) st.stun -= dt;
  if (st.slowT > 0) { st.slowT -= dt; if (st.slowT <= 0) st.slow = 0; }
  if (st.mark > 0) st.mark -= dt;
  if (st.vulnT > 0) st.vulnT -= dt;
  if (st.shade > 0) st.shade -= dt;
  if (st.burn > 0) {
    st.burn -= dt; st.burnTick -= dt;
    if (Math.random() < 0.3) FX.fire(e.x + rand(-e.w / 2, e.w / 2), e.y - rand(4, e.h), 1);
    if (st.burnTick <= 0 && !e.dead && G.player) {
      st.burnTick = 0.5;
      hitEnemy(G.player, e, { dmg: st.burnDmg, kx: 0, ky: 0, stun: 0, dot: true, dir: 1, src: 'proc', noProc: true, fxc: '#ff8a3a', numc: '#ff9a3a', sfx: false });
    }
    if (st.burn <= 0) st.burnDmg = 0;
  }
}

// ---------- damage to the player ----------
function hurtPlayer(dmg, srcX, o = {}) {
  const p = G.player;
  if (!p || p.dead || G.state !== 'play' || G.god) return false;
  // Existing poison and a committed grab cannot be dodged after they have landed.
  if (!o.dot && !o.unavoidable) {
    // 极限闪避: attack arrives during the first frames of a dash
    if (p.isPerfectWindow()) { p.perfectDodge(srcX); return false; }
    // parry stances (e.g. 燕返架势)
    if (p.move && p.move.m.parry && p.move.t >= p.move.m.parry[0] && p.move.t <= p.move.m.parry[1]) { p.move.m.onParry(p, srcX); return false; }
    if (p.inv > 0 || p.ghost) return false;
  }
  dmg *= G.run ? G.run.dmgTakenMult : 1;
  dmg *= 1 - p.stats.armor;
  if (p.armorT > 0) dmg *= 0.6;
  if (p.state === 'charge' && p.stats.chargeArmor) dmg *= 0.5;
  if (p.ironT > 0) {
    dmg *= 0.6;
    // 金刚身 answers blows: a poison tick is softened like any damage but sets off neither the burst nor 金身
    if (!o.dot) {
      if (G.time - (p.counters.ironT || 0) > 0.4) {
        p.counters.ironT = G.time;
        explodeP(p.x, p.cy, 46, 1.5 * skMul(p, 'gao_iron'), { c: '#ffd36a', kx: 260, ky: -200, src: 'skill', wx: { fam: 'sk', id: 'gao_iron' }, shake: 0.3, noProc: false });
      }
      // 金身 (金刚身's signature): blows taken feed 灵力
      if ((p.wxPerksOf({ fam: 'sk', id: 'gao_iron' }) || []).includes(WX_PERKS.jinshen)) { p.gainMana(4); FX.text(p.x, p.y - p.h - 6, '+4', '#7fd8ff', { size: 8 }); }
    }
  }
  if (p.counters.wxGuardT > G.time) dmg *= 0.6;                     // 霸王余威
  dmg = Math.max(1, Math.round(dmg));
  if (p.shield > 0) {
    const ab = Math.min(p.shield, dmg);
    p.shield -= ab; dmg -= ab;
    FX.ring(p.x, p.cy, 8, 22, '#9ff4ff', 0.25, 2);
    Sound.play('shield', { x: p.x });
    if (dmg <= 0) { if (!o.dot) p.inv = 0.5; return true; }
  }
  if (o.nonlethal) dmg = Math.min(dmg, Math.max(0, p.hp - 1));
  if (dmg <= 0) return true;
  p.hp -= dmg;
  G.stats.dmgTaken += dmg;
  FX.num(p.x, p.y - p.h, dmg, { c: o.numc || '#ff4a5a', big: !o.dot });
  if (!o.dot) {
    p.inv = 1.0;
    p.hurtFlash = 0.25;
    p.resetCombo();
    FX.hitSpark(p.x, p.cy, sign(p.x - srcX) || 1, '#ff4a5a', true);
    FX.screenFlash('#ff1030', 0.25, 0.3);
    Sound.play('hurt', { x: p.x });
    Cam.shake(0.4);
    G.hitstop(5);
  }
  if (!o.dot && !p.superArmor() && !o.noStagger) {
    p.state = 'hurt'; p.hurtT = 0.3; p.move = null;
    p.vx = (sign(p.x - srcX) || -p.face) * 170; p.vy = -200;
  }
  // every loss of health is reported; o tells reactions whether it was a blow or a poison tick
  p.fire('onHurt', dmg, o);
  if (p.hp <= 0) p.die();
  return true;
}

// =====================================================================
//  PROJECTILES
// =====================================================================
class Proj {
  constructor(o) {
    this.id = ++UID;
    Object.assign(this, { x: 0, y: 0, vx: 0, vy: 0, r: 3, team: 'e', dmg: 5, life: 3, max: 3, kind: 'orb', c: '#ff4fd8', c2: '#ffffff', pierce: 0, grav: 0, ghost: false, homing: 0, hit: null, hits: new Set(), spin: 0, t: 0, trail: 0, light: 40 }, o);
    // signature effects of the 武学 being cast: 刃长 (reach), 星轨 (homing)
    if (this.team === 'p' && G.player && G.player.wxMod) {
      const wx = this.hit && this.hit.wx !== undefined ? this.hit.wx : null;
      const k = G.player.reach(wx), hm = G.player.wxMod('homing', wx), pm = G.player.wxMod('pierce', wx);
      if (k > 1) { this.life *= k; this.r *= 1 + (k - 1) * 0.6; if (this.hh) this.hh *= 1 + (k - 1) * 0.6; }
      if (hm) this.homing = Math.max(this.homing || 0, hm);
      if (pm) this.pierce += pm;                                       // 穿杨
    }
    this.max = this.life;
    // 劫难·箭雨: faster enemy volleys
    const H = this.team === 'e' && G.run && G.run.hard;
    if (H && H.projSpeed !== 1 && !this.grav) { this.vx *= H.projSpeed; this.vy *= H.projSpeed; this.life /= H.projSpeed; }
  }
  update(dt) {
    if (this.dead) return false;
    this.t += dt; this.life -= dt;
    if (this.life <= 0) return this.kill(false);
    if (this.homing && this.team === 'p') {
      let best = null, bd = 260;
      for (const e of G.enemies) { if (e.dead || e.spawning) continue; const d = dist(this.x, this.y, e.x, e.cy); if (d < bd) { bd = d; best = e; } }
      if (best && this.t > (this.homeDelay || 0)) {
        const sp = Math.hypot(this.vx, this.vy);
        const a = Math.atan2(this.vy, this.vx), ta = Math.atan2(best.cy - this.y, best.x - this.x);
        let da = ((ta - a + Math.PI * 3) % TAU) - Math.PI;
        const na = a + clamp(da, -this.homing * dt, this.homing * dt);
        this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
      }
    } else if (this.homing && this.team === 'e' && G.player) {
      const p = G.player, sp = Math.hypot(this.vx, this.vy);
      const a = Math.atan2(this.vy, this.vx), ta = Math.atan2(p.cy - this.y, p.x - this.x);
      let da = ((ta - a + Math.PI * 3) % TAU) - Math.PI;
      const na = a + clamp(da, -this.homing * dt, this.homing * dt);
      this.vx = Math.cos(na) * sp; this.vy = Math.sin(na) * sp;
    }
    if (this.accel) { this.vx *= 1 + this.accel * dt; this.vy *= 1 + this.accel * dt; }
    this.vy += this.grav * dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.upd) this.upd(this, dt);
    if (this.trail && Math.random() < this.trail) FX.add({ k: 'px', x: this.x, y: this.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.3, s: this.r * 0.8, c: this.tc || this.c, shrink: true, glow: true, add: true, layer: 0 });
    if (!this.ghost && G.room.solidPx(this.x, this.y)) return this.kill(true);
    if (this.x < -50 || this.x > G.room.pw + 50 || this.y > G.room.ph + 50 || this.y < -200) return this.kill(false);
    // hits
    if (this.noHit) return true;
    if (this.team === 'p') {
      for (const e of G.enemies) {
        if (e.dead || e.spawning || e.intangible || this.hits.has(e.id)) continue;
        const hb = e.hurtbox();
        if (this.x + this.r > hb.x && this.x - this.r < hb.x + hb.w && this.y + this.r > hb.y && this.y - this.r < hb.y + hb.h) {
          this.hits.add(e.id);
          const h = Object.assign({ dir: sign(this.vx) || 1 }, this.hit || { dmg: this.dmg });
          hitEnemy(G.player, e, h, this.x, this.y);
          if (this.onHit) this.onHit(this, e);
          if (this.pierce-- <= 0) return this.kill(true);
        }
      }
    } else {
      const p = G.player;
      if (p && !p.dead) {
        const hb = p.hurtbox();
        if (this.x + this.r > hb.x + 2 && this.x - this.r < hb.x + hb.w - 2 && this.y + this.r > hb.y + 2 && this.y - this.r < hb.y + hb.h) {
          if (hurtPlayer(this.dmg, this.x - this.vx, this.hitInfo || {})) {
            if (this.chill) p.chill(this.chill);
            if (this.push) { p.vx = sign(this.vx || 1) * this.push; p.vy = Math.min(p.vy, -120); }
            if (this.onHitP) this.onHitP(this, p);
            return this.pierceP ? true : this.kill(true);
          }
        }
      }
    }
    return true;
  }
  kill(impact) {
    this.dead = true;
    if (impact && this.onDie) this.onDie(this);
    else if (impact) {
      FX.burst(this.x, this.y, { n: 5, c: [this.c, this.c2], sp: [30, 110], life: [0.15, 0.35], glow: true });
      FX.flash(this.x, this.y, this.r + 3, this.c, 0.08);
    }
    return false;
  }
  draw(ctx, gctx, cx, cy) {
    const x = this.x - cx, y = this.y - cy;
    if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return;
    const a = Math.atan2(this.vy, this.vx);
    if (this.light) Light.add(this.x, this.y, this.light, this.c, 0.8);
    ctx.globalCompositeOperation = 'lighter';
    switch (this.kind) {
      case 'orb': {
        const pul = 1 + 0.15 * Math.sin(this.t * 25);
        ctx.fillStyle = this.c; ctx.beginPath(); ctx.arc(x, y, this.r * 1.5 * pul, 0, TAU); ctx.fill();
        ctx.fillStyle = this.c2; ctx.beginPath(); ctx.arc(x, y, this.r * 0.7, 0, TAU); ctx.fill();
        gctx.fillStyle = this.c; gctx.beginPath(); gctx.arc(x, y, this.r * 2.6, 0, TAU); gctx.fill();
        break;
      }
      case 'bullet': case 'streak': {
        const len = this.len || 10;
        ctx.strokeStyle = this.c; ctx.lineWidth = this.r * 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len); ctx.stroke();
        ctx.strokeStyle = this.c2; ctx.lineWidth = Math.max(1, this.r * 0.6);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(a) * len * 0.6, y - Math.sin(a) * len * 0.6); ctx.stroke();
        gctx.strokeStyle = this.c; gctx.lineWidth = this.r * 3;
        gctx.beginPath(); gctx.moveTo(x, y); gctx.lineTo(x - Math.cos(a) * len, y - Math.sin(a) * len); gctx.stroke();
        break;
      }
      case 'shard': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a + (this.spin ? this.t * this.spin : 0));
        ctx.fillStyle = this.c; ctx.beginPath(); ctx.moveTo(this.r * 2.2, 0); ctx.lineTo(0, -this.r * 0.9); ctx.lineTo(-this.r * 1.6, 0); ctx.lineTo(0, this.r * 0.9); ctx.closePath(); ctx.fill();
        ctx.fillStyle = this.c2; ctx.fillRect(-1, -1, 3, 2);
        ctx.restore();
        gctx.fillStyle = this.c; gctx.beginPath(); gctx.arc(x, y, this.r * 2, 0, TAU); gctx.fill();
        break;
      }
      case 'missile': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(a);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#d8dde8'; ctx.fillRect(-4, -1.5, 7, 3);
        ctx.fillStyle = this.c; ctx.fillRect(2, -1.5, 2, 3);
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = '#ffd36a'; ctx.fillRect(-7, -1, 3, 2);
        ctx.restore();
        gctx.fillStyle = this.c; gctx.beginPath(); gctx.arc(x, y, 5, 0, TAU); gctx.fill();
        if (Math.random() < 0.8) FX.add({ k: 'px', x: this.x - Math.cos(a) * 6, y: this.y - Math.sin(a) * 6, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.35, s: 2, c: '#8a8aa8', shrink: true, layer: 0 });
        break;
      }
      case 'talisman': { // burning paper charm
        ctx.globalCompositeOperation = 'source-over';
        ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a + Math.PI / 2 + Math.sin(this.t * 20) * 0.3);
        ctx.fillStyle = '#efe2c8'; ctx.fillRect(-2, -4, 4, 9);
        ctx.fillStyle = '#b8342a'; ctx.fillRect(-1, -3, 2, 1); ctx.fillRect(-0.5, -1, 1, 4);
        ctx.restore();
        gctx.fillStyle = this.c; gctx.fillRect(x - 3, y - 3, 6, 6);
        if (Math.random() < 0.7) FX.fire(this.x, this.y, 1);
        break;
      }
      case 'wave': { // crescent energy wave
        ctx.save(); ctx.translate(x, y); ctx.scale(sign(this.vx) || 1, 1);
        const hh = this.hh || 14;
        ctx.fillStyle = this.c;
        ctx.beginPath(); ctx.moveTo(-4, -hh); ctx.quadraticCurveTo(10, 0, -4, hh); ctx.quadraticCurveTo(3, 0, -4, -hh); ctx.fill();
        ctx.fillStyle = this.c2;
        ctx.beginPath(); ctx.moveTo(-2, -hh * 0.7); ctx.quadraticCurveTo(7, 0, -2, hh * 0.7); ctx.quadraticCurveTo(2, 0, -2, -hh * 0.7); ctx.fill();
        ctx.restore();
        gctx.fillStyle = this.c; gctx.fillRect(x - 6, y - hh, 12, hh * 2);
        break;
      }
      case 'fireball': {
        ctx.fillStyle = '#ff5a1f'; ctx.beginPath(); ctx.arc(x, y, this.r * 1.4, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(x + Math.cos(a), y + Math.sin(a), this.r * 0.8, 0, TAU); ctx.fill();
        gctx.fillStyle = '#ff7a2a'; gctx.beginPath(); gctx.arc(x, y, this.r * 3, 0, TAU); gctx.fill();
        FX.fire(this.x, this.y, 1);
        break;
      }
      case 'fist': {
        const s = this.r;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = this.c;
        ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.8, 0, 0, TAU); ctx.fill();
        ctx.fillRect(x - s * 2.2 * (sign(this.vx) || 1) - (this.vx > 0 ? 0 : 0), y - s * 0.45, s * 2.2 * (sign(this.vx) || 1), s * 0.9);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(x, y, s * 0.55, s * 0.45, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        gctx.fillStyle = this.c; gctx.beginPath(); gctx.ellipse(x, y, s * 1.6, s * 1.3, 0, 0, TAU); gctx.fill();
        break;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// =====================================================================
//  ZONES / TIMED EFFECTS
// =====================================================================
class Zone {
  constructor(o) {
    this.id = ++UID;
    Object.assign(this, { x: 0, y: 0, life: 1, t: 0, tick: 0.25, tt: 0 }, o);
    this.max = this.life;
  }
  update(dt) {
    this.t += dt; this.life -= dt; this.tt -= dt;
    if (this.upd) this.upd(this, dt);
    if (this.onTick && this.tt <= 0) { this.tt = this.tick; this.onTick(this); }
    if (this.life <= 0) { if (this.onEnd) this.onEnd(this); return false; }
    return true;
  }
  draw(ctx, gctx, cx, cy) { if (this.drawFn) this.drawFn(ctx, gctx, this.x - cx, this.y - cy, this); }
}
function addZone(o) { const z = new Zone(o); G.zones.push(z); return z; }
function later(t, fn) { G.timers.push({ t, fn }); }

// enemies within a radius of a point (by hurtbox center)
function enemiesNear(x, y, r, filter) {
  const out = [];
  for (const e of G.enemies) {
    if (e.dead || e.spawning || e.intangible) continue;
    if (dist(x, y, e.x, e.cy) <= r + Math.max(e.w, e.h) * 0.4 && (!filter || filter(e))) out.push(e);
  }
  return out;
}
function enemiesInRect(x, y, w, h) {
  return G.enemies.filter(e => !e.dead && !e.spawning && !e.intangible && overlap({ x, y, w, h }, e.hurtbox()));
}
// circular player-team explosion
function explodeP(x, y, r, dmgMult, o = {}) {
  const p = G.player;
  const wx = o.wx !== undefined ? o.wx : p && p.moveWx ? p.moveWx(p.move && p.move.m, o) : null;
  if (p && p.reach) r *= p.reach(wx);
  const col = o.c || '#ffb347';
  FX.flash(x, y, r * 0.42, col, 0.1);
  FX.ring(x, y, r * 0.2, r, col, 0.3, 3);
  FX.burst(x, y, { n: Math.round(r / 2), c: [col, '#ffffff', o.c2 || col], sp: [60, r * 6], life: [0.25, 0.6], glow: true, s: [1, 3] });
  if (o.sound !== false) Sound.play(o.sound || 'explode', { x, pitch: o.pitch || 1.3 });
  Cam.shake(o.shake || 0.15);
  Light.add(x, y, r * 3, col, 1);
  for (const e of enemiesNear(x, y, r)) {
    hitEnemy(p, e, { dmg: p.atk * dmgMult, kx: o.kx || 120, ky: o.ky || -140, launch: !!o.launch || (o.ky || -140) < -250, stun: o.stun || 0.35, hs: o.hs || 0, dir: sign(e.x - x) || 1, noProc: o.noProc !== false, heavy: !!o.heavy, sfx: false, src: o.src || 'proc', fxc: col, wx });
    if (o.status) applyStatus(e, o.status[0], o.status[1], o.status[2]);
  }
}
// enemy-team explosion
function explodeE(x, y, r, dmg, o = {}) {
  const col = o.c || '#ff5a3a';
  FX.flash(x, y, r * 0.42, col, 0.1);
  FX.ring(x, y, r * 0.2, r, col, 0.3, 3);
  FX.burst(x, y, { n: Math.round(r / 2), c: [col, '#ffd36a', '#ffffff'], sp: [60, r * 6], life: [0.25, 0.6], glow: true, s: [1, 3] });
  Sound.play('explode', { x, pitch: o.pitch || 1.1 });
  Cam.shake(0.2);
  Light.add(x, y, r * 3, col, 1);
  const p = G.player;
  if (p && !p.dead && dist(x, y, p.x, p.cy) < r + 8) hurtPlayer(dmg, x);
  if (o.hurtsEnemies) for (const e of enemiesNear(x, y, r)) if (e !== o.self) hitEnemy(p, e, { dmg: o.hurtsEnemies, kx: 160, ky: -200, stun: 0.5, dir: sign(e.x - x) || 1, noProc: true, noEnergy: true, sfx: false });
}
