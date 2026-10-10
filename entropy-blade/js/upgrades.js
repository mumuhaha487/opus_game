'use strict';
// =====================================================================
//  UPGRADES — 刻印 (sigils): seven original styles built around this
//  game's own action mechanics, plus style resonance, icons, talents
// =====================================================================
const SCHOOLS = {
  gale: { name: '疾风印', col: '#7fe8c8', icon: 'wing', reso: '疾风共鸣：冲刺次数 +1，冲刺恢复速度 +25%' },
  flow: { name: '连舞印', col: '#ffb84a', icon: 'fist', reso: '连舞共鸣：所有终结技必定暴击' },
  echo: { name: '残响印', col: '#9aa8ff', icon: 'eye', reso: '残响共鸣：回声几率 +15%，回声伤害 +30%' },
  charge: { name: '蓄势印', col: '#ff7a5a', icon: 'burst', reso: '蓄势共鸣：解锁二段蓄力，蓄力期间霸体' },
  hunt: { name: '猎杀印', col: '#ff4a6a', icon: 'skull', reso: '猎杀共鸣：击杀回复 2 生命，对被猎印标记的敌人伤害 +10%' },
  guard: { name: '守御印', col: '#7fb8ff', icon: 'shield', reso: '守御共鸣：每个房间开始时获得 15 点护盾，极限闪避判定 +30%' },
  relic: { name: '灵器印', col: '#c88aff', icon: 'orb', reso: '灵器共鸣：所有灵器的攻击频率 +30%' },
  core: { name: '本源', col: '#e8e0ff', icon: 'star', reso: '' },
};
const RARITY = [null,
  { name: '普通', col: '#c8c8dc', w: 60 },
  { name: '稀有', col: '#5aa8ff', w: 27 },
  { name: '史诗', col: '#c46aff', w: 10 },
  { name: '传说', col: '#ffc83a', w: 3 },
];
const UPG = {};
function U(o) { UPG[o.id] = o; }
const lvv = (arr, lv) => arr[Math.min(arr.length, lv) - 1];

// ---------- shared helpers ----------
function procChance(p, c) { return Math.random() < c * p.hero.procMul; }
function relicMul(p) { return p.flags.relicMaster ? 1.6 : 1; }
function relicRate(p) { return p.flags.relicReso ? 1.3 : 1; }
function sigilBurst(p, x, y, r, mult, col, o = {}) {
  explodeP(x, y, r, mult, Object.assign({ c: col, src: 'proc', shake: 0.15, sound: o.sound || 'explode', pitch: o.pitch || 1.4 }, o));
}

// =========================== 疾风印 GALE ===========================
U({ id: 'gale_swift', school: 'gale', name: '疾行', rarity: 1, max: 3, icon: 'feather',
  desc: lv => `移动速度 +${lv * 8}%，冲刺恢复速度 +${lv * 15}%`,
  apply(p, lv, s) { s.speedMul += 0.08 * lv; s.dashCD /= 1 + 0.15 * lv; } });
U({ id: 'gale_slip', school: 'gale', name: '掠影', rarity: 1, max: 3, icon: 'wing',
  desc: lv => `冲刺穿过敌人时对其造成 ${[60, 90, 120][lv - 1]}% 攻击力伤害`,
  apply(p, lv) {
    const m = [0.6, 0.9, 1.2][lv - 1];
    p.on('onDashEnd', p => {
      const x0 = Math.min(p.dashX0, p.x) - 10, x1 = Math.max(p.dashX0, p.x) + 10;
      const list = enemiesInRect(x0, p.y - 40, x1 - x0, 44);
      for (const e of list) { FX.slash(e.x, e.cy, { r: 14, a0: -40, a1: 40, th: 4, c: '#7fe8c8', f: p.face, sy: 0.3, dur: 0.14 }); hitEnemy(p, e, { dmg: p.atk * m, kx: 30, ky: -60, stun: 0.3, dir: p.face, src: 'proc', noProc: true, fxc: '#7fe8c8', sfx: false }); }
      if (list.length) Sound.play('swoosh', { x: p.x, pitch: 1.3 });
    });
  } });
U({ id: 'gale_momentum', school: 'gale', name: '乘势', rarity: 2, max: 2, icon: 'wing',
  desc: lv => `冲刺后 1.2 秒内，攻击伤害 +${[35, 60][lv - 1]}%`,
  apply(p, lv) {
    const m = 1 + [0.35, 0.6][lv - 1];
    p.on('onDash', p => { p.counters.momT = G.time + 1.2 + 0.19; });
    p.on('modDmg', p => (G.time < (p.counters.momT || 0) ? m : 1));
  } });
U({ id: 'gale_gust', school: 'gale', name: '回风刃', rarity: 2, max: 2, icon: 'wave',
  desc: lv => `冲刺结束时向前方射出贯穿的风刃（${[90, 140][lv - 1]}% 攻击力）`,
  apply(p, lv) {
    const m = [0.9, 1.4][lv - 1];
    p.on('onDashEnd', p => { waveProj(p, { dmg: m, sp: 460, c: '#7fe8c8', hh: 12, src: 'proc', life: 0.6, skill: false }); Sound.play('swoosh', { x: p.x, pitch: 0.9 }); });
  } });
U({ id: 'gale_feather', school: 'gale', name: '浮羽', rarity: 2, max: 1, icon: 'feather',
  desc: () => '空中跳跃次数 +1，空中造成的伤害 +20%',
  apply(p, lv, s) { s.jumps += 1; s.airDmg *= 1.2; } });
U({ id: 'gale_mirage', school: 'gale', name: '残像', rarity: 3, max: 1, icon: 'eye',
  desc: () => '极限闪避时原地留下残像，0.6 秒后爆炸造成 250% 攻击力伤害；子弹时间 +0.5 秒',
  apply(p, lv, s) {
    s.witch += 0.5;
    p.on('onPerfect', p => {
      const fr = p.frame(), x = p.x, y = p.y, f = p.face;
      addZone({
        x, y, life: 0.6,
        drawFn(ctx, gctx, x2, y2, z) { drawFrame(ctx, fr, p.spr.ox, p.spr.oy, x2, y2, f < 0, { tint: '#7fe8c8', alpha: 0.5 + 0.4 * Math.sin(z.t * 30) }); },
        onEnd() { sigilBurst(p, x, y - 16, 48, 2.5, '#7fe8c8', { sound: 'void' }); },
      });
    });
  } });
U({ id: 'gale_eye', school: 'gale', name: '风暴之眼', rarity: 4, max: 1, icon: 'storm',
  desc: () => '每次冲刺获得 1 层风势（最多 5 层，4 秒内未冲刺则消散，每层伤害 +6%）；满层时冲刺会卷起吸引敌人的旋风',
  apply(p) {
    p.on('onDash', p => {
      if (G.time > (p.counters.gustT || 0)) p.counters.gust = 0;
      p.counters.gust = Math.min(5, (p.counters.gust || 0) + 1);
      p.counters.gustT = G.time + 4;
      if (p.counters.gust >= 5) {
        p.counters.gust = 0;
        const x = p.x, y = p.cy;
        Sound.play('swoosh', { x, pitch: 0.5 });
        addZone({
          x, y, life: 2.2, tick: 0.2,
          onTick(z) { for (const e of enemiesNear(z.x, z.y, 64)) hitEnemy(p, e, { dmg: p.atk * 0.45, kx: 0, ky: -80, stun: 0.25, dir: 1, src: 'proc', noProc: true, sfx: false, fxc: '#7fe8c8' }); },
          upd(z, dt) {
            for (const e of enemiesNear(z.x, z.y, 120)) if (!e.boss) { e.vx += (z.x - e.x) * 5 * dt; if (e.flying) e.vy += (z.y - e.cy) * 5 * dt; }
            for (let i = 0; i < 3; i++) { const a = z.t * 12 + i * 2.1, r = 10 + (z.t * 40 + i * 13) % 40; FX.add({ k: 'px', x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r * 0.5 - r * 0.4, vx: 0, vy: -30, life: 0.25, s: 1.5, c: pick(['#7fe8c8', '#ffffff']), glow: true }); }
          },
        });
      }
    });
    p.on('modDmg', p => (G.time < (p.counters.gustT || 0) ? 1 + 0.06 * (p.counters.gust || 0) : 1));
  } });

// =========================== 连舞印 FLOW ===========================
U({ id: 'flow_rhythm', school: 'flow', name: '节拍', rarity: 1, max: 3, icon: 'fist',
  desc: lv => `连击数每 10 点，伤害 +${[3, 4, 5][lv - 1]}%（上限 +${[30, 40, 50][lv - 1]}%）`,
  apply(p, lv) { const k = [0.03, 0.04, 0.05][lv - 1]; p.on('modDmg', p => 1 + Math.min(10, Math.floor(p.combo / 10)) * k); } });
U({ id: 'flow_sustain', school: 'flow', name: '余韵', rarity: 1, max: 1, icon: 'clock',
  desc: () => '连击计时 +2 秒；受击时连击数不再清零，只会减半',
  apply(p, lv, s) { s.comboTime += 2; p.flags.keepCombo = true; } });
U({ id: 'flow_finale', school: 'flow', name: '终曲', rarity: 2, max: 2, icon: 'burst',
  desc: lv => `终结技（连段末段、蓄力技、下劈落地、派生终段）伤害 +${[40, 70][lv - 1]}%，并震出冲击环（${[100, 150][lv - 1]}% 攻击力）`,
  apply(p, lv) {
    const m = 1 + [0.4, 0.7][lv - 1], r = [1, 1.5][lv - 1];
    p.on('modDmg', (p, e, h) => (h.finisher ? m : 1));
    p.on('onFinisher', (p, e) => { const x = e ? e.x : p.x + p.face * 20, y = e ? e.cy : p.cy; FX.ring(x, y, 6, 50, '#ffb84a', 0.35, 4); sigilBurst(p, x, y, 46, r, '#ffb84a', { sound: false }); });
  } });
U({ id: 'flow_hundred', school: 'flow', name: '百花缭乱', rarity: 3, max: 2, icon: 'flower',
  desc: lv => `每 ${[25, 18][lv - 1]} 次命中，对周围敌人发动 8 次斩舞（各 80% 攻击力）`,
  apply(p, lv) {
    const n = [25, 18][lv - 1];
    p.on('onHit', (p, e, h) => {
      if (h.src === 'proc') return;
      p.counters.hundred = (p.counters.hundred || 0) + 1;
      if (p.counters.hundred < n) return;
      p.counters.hundred = 0;
      FX.text(p.x, p.y - p.h - 12, '百花缭乱', '#ffb84a', { size: 8 });
      for (let i = 0; i < 8; i++) later(i * 0.05, () => {
        const list = enemiesNear(p.x, p.cy, 130);
        if (!list.length) return;
        const t = pick(list), a = rand(0, 180);
        FX.slash(t.x, t.cy, { r: 18, a0: a - 60, a1: a + 60, th: 4, c: '#ffb84a', f: 1, sy: 0.3, rot: a, dur: 0.14 });
        hitEnemy(p, t, { dmg: p.atk * 0.8, kx: 10, ky: -40, stun: 0.3, dir: 1, src: 'proc', noProc: true, fxc: '#ffb84a', sfx: false });
        Sound.play('swoosh', { x: t.x, pitch: rand(1, 1.4) });
      });
    });
  } });
U({ id: 'flow_trance', school: 'flow', name: '忘我', rarity: 2, max: 1, icon: 'eye',
  desc: () => '连击数 ≥ 30 时，攻击速度 +18%，移动速度 +10%',
  apply(p) { p.on('tick', p => { if (p.combo >= 30) { p.dyn.atk *= 1.18; p.dyn.spd *= 1.1; } }); } });
U({ id: 'flow_crescendo', school: 'flow', name: '渐强', rarity: 4, max: 1, icon: 'crown',
  desc: () => '房间内仍有敌人时，连击数不会衰减；连击数 ≥ 50 时，每次命中必定暴击',
  apply(p) { p.flags.comboFreeze = true; p.on('onHit', p => { if (p.combo >= 50) p.counters.nextCrit = 1; }); } });

// =========================== 残响印 ECHO ===========================
U({ id: 'echo_repeat', school: 'echo', name: '回声', rarity: 1, max: 3, icon: 'eye',
  desc: lv => `命中时有 ${[15, 22, 30][lv - 1]}% 几率在 0.25 秒后产生回声，再造成该次伤害的 60%`,
  apply(p, lv, s) {
    s.echo += [0.15, 0.22, 0.3][lv - 1];
  } });
U({ id: 'echo_shadow', school: 'echo', name: '影随', rarity: 2, max: 2, icon: 'eye',
  desc: lv => `施放秘技 0.5 秒后，影子在原地爆发，造成 ${[150, 250][lv - 1]}% 攻击力范围伤害`,
  apply(p, lv) {
    const m = [1.5, 2.5][lv - 1];
    p.on('onSkill', p => {
      const fr = p.frame(), x = p.x, y = p.y, f = p.face;
      addZone({ x, y, life: 0.5, drawFn(ctx, gctx, x2, y2, z) { drawFrame(ctx, fr, p.spr.ox, p.spr.oy, x2, y2, f < 0, { tint: '#9aa8ff', alpha: 0.6 * (1 - z.t * 1.5) + 0.2 }); }, onEnd() { sigilBurst(p, x, y - 16, 56, m, '#9aa8ff', { sound: 'void' }); } });
    });
  } });
U({ id: 'echo_resonate', school: 'echo', name: '共振', rarity: 2, max: 2, icon: 'ring',
  desc: lv => `连续命中同一个敌人 6 次时，引发共振爆发（${[220, 320][lv - 1]}% 攻击力）`,
  apply(p, lv) {
    const m = [2.2, 3.2][lv - 1];
    p.on('onHit', (p, e, h) => {
      if (h.src === 'proc') return;
      if (p.counters.resT === e.id) p.counters.resN = (p.counters.resN || 0) + 1; else { p.counters.resT = e.id; p.counters.resN = 1; }
      if (p.counters.resN >= 6) { p.counters.resN = 0; FX.ring(e.x, e.cy, 4, 34, '#9aa8ff', 0.3, 3); sigilBurst(p, e.x, e.cy, 36, m, '#9aa8ff', { sound: 'void', pitch: 1.6 }); }
    });
  } });
U({ id: 'echo_cycle', school: 'echo', name: '轮回', rarity: 1, max: 2, icon: 'clock',
  desc: lv => `施放秘技后 3 秒内施放另一种秘技，返还其 ${[40, 70][lv - 1]}% 灵力消耗`,
  apply(p, lv) {
    const v = [0.4, 0.7][lv - 1];
    p.on('onSkill', (p, s, slot, cost) => {
      if (s.follow) return;
      const c = p.counters;
      if (cost && c.cycleT && G.time - c.cycleT < 3 && c.cycleId !== s.id) {
        p.mana = Math.min(p.stats.maxMana, p.mana + cost * v);
        FX.text(p.x, p.y - p.h - 14, '轮回', '#9aa8ff', { size: 8 });
      }
      c.cycleT = G.time; c.cycleId = s.id;
    });
  } });
U({ id: 'echo_twin', school: 'echo', name: '双生奥义', rarity: 3, max: 1, icon: 'star',
  desc: () => '奥义（↓ + I）结束约 1 秒后，残影再度斩击画面内所有敌人（400% 攻击力）',
  apply(p) {
    p.on('onUlt', p => later((p.move ? p.move.m.dur : 2) + 0.9, () => {
      if (p.dead) return;
      FX.screenFlash('#9aa8ff', 0.4, 0.3); Sound.play('ultBoom');
      for (const e of liveEnemies().filter(onScreen)) { FX.slash(e.x, e.cy, { r: 26, a0: -70, a1: 70, th: 7, c: '#9aa8ff', f: 1, rot: rand(-40, 40), dur: 0.22 }); hitEnemy(p, e, { dmg: p.atk * 4, kx: 0, ky: -200, launch: true, stun: 0.6, dir: 1, src: 'ult', noProc: true, heavy: true, fxc: '#9aa8ff' }); }
    }));
  } });
U({ id: 'echo_eternal', school: 'echo', name: '永劫回响', rarity: 4, max: 1, icon: 'crown',
  desc: () => '回声几率 +20%；每第 10 次命中，回复 12 点灵力',
  apply(p, lv, s) {
    s.echo += 0.2;
    p.on('onHit', (p, e, h) => {
      if (h.src === 'proc') return;
      p.counters.eternal = (p.counters.eternal || 0) + 1;
      if (p.counters.eternal >= 10) {
        p.counters.eternal = 0;
        p.gainMana(12);
        FX.text(p.x, p.y - p.h - 12, '回响', '#9aa8ff', { size: 8 }); Sound.play('pickup', { x: p.x, pitch: 1.6 });
      }
    });
  } });

// =========================== 蓄势印 CHARGE ===========================
U({ id: 'chg_heavy', school: 'charge', name: '千钧', rarity: 1, max: 3, icon: 'burst',
  desc: lv => `蓄力攻击伤害 +${[35, 60, 85][lv - 1]}%`,
  apply(p, lv, s) { s.chargeDmg += [0.35, 0.6, 0.85][lv - 1]; } });
U({ id: 'chg_quick', school: 'charge', name: '迅蓄', rarity: 1, max: 2, icon: 'clock',
  desc: lv => `蓄力速度 +${lv * 35}%`,
  apply(p, lv, s) { s.chargeSpeed += 0.35 * lv; } });
U({ id: 'chg_still', school: 'charge', name: '静心', rarity: 2, max: 2, icon: 'eye',
  desc: lv => `1.5 秒未出招时进入静心状态，下一次命中伤害 +${[80, 130][lv - 1]}%`,
  apply(p, lv) {
    const m = 1 + [0.8, 1.3][lv - 1];
    p.on('onMove', p => { p.counters.lastAtk = G.time; });
    p.on('tick', p => { if (!p.counters.still && G.time - (p.counters.lastAtk || 0) > 1.5) { p.counters.still = true; FX.ring(p.x, p.cy, 18, 4, '#ff7a5a', 0.25, 1); } });
    p.on('modDmg', (p, e, h) => (p.counters.still && h.src !== 'proc' ? m : 1));
    p.on('onHit', (p, e, h) => { if (h.src !== 'proc') p.counters.still = false; });
    p.on('draw', (p, ctx, gctx, cx, cy) => { if (p.counters.still && Math.floor(G.time * 6) % 2) { gctx.fillStyle = '#ff7a5a'; gctx.fillRect(Math.round(p.x - cx) - 2, Math.round(p.y - p.h - cy) - 8, 4, 4); } });
  } });
U({ id: 'chg_quake', school: 'charge', name: '余震', rarity: 2, max: 2, icon: 'spike',
  desc: lv => `蓄力技与下劈落地后，留下余震地带，再震荡 3 次（各 ${[60, 90][lv - 1]}% 攻击力）`,
  apply(p, lv) {
    const m = [0.6, 0.9][lv - 1];
    const quake = p => {
      const x = p.x + p.face * 16, y = G.room.floorBelow(p.x, p.y - 10);
      let n = 0;
      addZone({ x, y, life: 1.05, tick: 0.33, onTick(z) { if (n++ === 0) return; FX.shock(z.x, z.y, '#ff7a5a', 46); for (const e of enemiesNear(z.x, z.y - 10, 50)) hitEnemy(p, e, { dmg: p.atk * m, kx: 0, ky: -200, launch: true, stun: 0.4, dir: 1, src: 'proc', noProc: true, sfx: false, fxc: '#ff7a5a' }); Sound.play('stomp', { x: z.x, pitch: 1.3 }); } });
    };
    p.on('onCharge', p => later(0.3, () => quake(p)));
    p.on('onPlunge', quake);
  } });
U({ id: 'chg_armor', school: 'charge', name: '不动', rarity: 1, max: 1, icon: 'shield',
  desc: () => '蓄力期间获得霸体，受到的伤害 -50%',
  apply(p, lv, s) { s.chargeArmor = true; } });
U({ id: 'chg_titan', school: 'charge', name: '撼岳', rarity: 4, max: 1, icon: 'crown',
  desc: () => '解锁二段蓄力；二段蓄力技额外释放横贯画面的冲击（400% 攻击力），并直接击破首领韧性',
  apply(p, lv, s) {
    s.charge2 = true;
    p.on('onCharge', (p, lvC) => {
      if (lvC !== 2) return;
      later(0.25, () => {
        FX.screenFlash('#ff7a5a', 0.35, 0.3); Cam.shake(0.7); Sound.play('ultBoom');
        FX.add({ k: 'beam', x: Cam.x, y: p.y - 14, len: W, w: 10, ang: 0, c: '#ff7a5a', life: 0.4 });
        for (const e of liveEnemies().filter(onScreen)) {
          if (Math.abs(e.y - p.y) > 80) continue;
          hitEnemy(p, e, { dmg: p.atk * 4, kx: 0, ky: -300, launch: true, stun: 0.8, dir: 1, src: 'proc', noProc: true, heavy: true, fxc: '#ff7a5a' });
          if (e.boss) { e.poiseDmg = e.D.poise + 1; e.onHurt({ heavy: true, dir: 1 }); }
        }
      });
    });
  } });

// =========================== 猎杀印 HUNT ===========================
U({ id: 'hunt_mark', school: 'hunt', name: '猎印', rarity: 1, max: 3, icon: 'skull',
  desc: lv => `首次命中敌人时打上猎印；被标记的敌人受到的伤害 +${[15, 25, 35][lv - 1]}%`,
  apply(p, lv) {
    const m = 1 + [0.15, 0.25, 0.35][lv - 1];
    p.on('onHit', (p, e) => { if (!(e.st.mark > 0)) applyStatus(e, 'mark', 99); });
    p.on('modDmg', (p, e) => (e && e.st.mark > 0 ? m * (p.flags.huntReso ? 1.1 : 1) : 1));
  } });
U({ id: 'hunt_exec', school: 'hunt', name: '斩杀', rarity: 2, max: 2, icon: 'sword',
  desc: lv => `命中后若非首领敌人的生命低于 ${[12, 18][lv - 1]}%，立即将其斩杀`,
  apply(p, lv) {
    const th = [0.12, 0.18][lv - 1];
    p.on('onHit', (p, e) => {
      if (e.boss || e.dead || e.hp <= 0 || e.hp > e.maxHp * th) return;
      FX.text(e.x, e.y - e.h - 10, '斩', '#ff4a6a', { size: 12, life: 0.7 });
      FX.slash(e.x, e.cy, { r: 20, a0: -60, a1: 60, th: 6, c: '#ff4a6a', f: 1, rot: 45, dur: 0.2 });
      hitEnemy(p, e, { dmg: e.hp * 50 + 999, noCrit: true, noProc: true, kx: 80, ky: -200, launch: true, stun: 0.5, dir: p.face, src: 'proc', fxc: '#ff4a6a', sfx: 'crit' });
    });
  } });
U({ id: 'hunt_feast', school: 'hunt', name: '嗜战', rarity: 1, max: 3, icon: 'drop',
  desc: lv => `击杀敌人时回复 ${lv + 1} 点生命与 6 点灵力`,
  apply(p, lv) { p.on('onKill', p => { p.heal(lv + 1, true); p.gainMana(6); }); } });
U({ id: 'hunt_chain', school: 'hunt', name: '连猎', rarity: 2, max: 1, icon: 'chain',
  desc: () => '击杀敌人后，下一次命中必定暴击',
  apply(p) { p.on('onKill', p => { p.counters.nextCrit = 1; }); } });
U({ id: 'hunt_air', school: 'hunt', name: '破绽', rarity: 2, max: 2, icon: 'eye',
  desc: lv => `对浮空、硬直或眩晕中的敌人伤害 +${[25, 40][lv - 1]}%`,
  apply(p, lv) {
    const m = 1 + [0.25, 0.4][lv - 1];
    p.on('modDmg', (p, e) => (e && (!e.onGround || e.state === 'hurt' || e.state === 'stagger' || e.st.stun > 0) ? m : 1));
  } });
U({ id: 'hunt_predator', school: 'hunt', name: '掠食者', rarity: 4, max: 1, icon: 'crown',
  desc: () => '本房间内每次击杀使伤害 +4%（上限 +40%），且每次击杀回复 5 点灵力',
  apply(p) {
    p.on('onRoomStart', p => { p.counters.pred = 0; });
    p.on('onKill', p => { p.counters.pred = Math.min(10, (p.counters.pred || 0) + 1); p.gainMana(5); });
    p.on('modDmg', p => 1 + 0.04 * (p.counters.pred || 0));
  } });

// =========================== 守御印 GUARD ===========================
U({ id: 'guard_tough', school: 'guard', name: '铁骨', rarity: 1, max: 3, icon: 'heart',
  desc: lv => `最大生命 +${lv * 20}`,
  apply(p, lv, s) { s.maxHp += 20 * lv; } });
U({ id: 'guard_charm', school: 'guard', name: '护身符', rarity: 1, max: 2, icon: 'shield',
  desc: lv => `每个房间开始时，以及每次极限闪避后，获得 ${[12, 20][lv - 1]} 点护盾`,
  apply(p, lv) {
    const v = [12, 20][lv - 1];
    const give = p => { if (p.shield < v) { p.shield = v; Sound.play('shield', { x: p.x }); } };
    p.on('onRoomStart', give); p.on('onPerfect', give);
  } });
U({ id: 'guard_counter', school: 'guard', name: '后发制人', rarity: 2, max: 2, icon: 'fist',
  desc: lv => `见切反击伤害 +${[60, 100][lv - 1]}%，命中后回复 ${[3, 5][lv - 1]} 点生命`,
  apply(p, lv, s) {
    s.counterDmg += [0.6, 1.0][lv - 1];
    const hp = [3, 5][lv - 1];
    p.on('onHit', (p, e, h) => { if (h.src === 'counter' && G.time - (p.counters.cHeal || 0) > 0.5) { p.counters.cHeal = G.time; p.heal(hp); } });
  } });
U({ id: 'guard_thorn', school: 'guard', name: '荆棘甲', rarity: 2, max: 1, icon: 'spike',
  desc: () => '受到伤害时，对周围敌人造成 250% 攻击力伤害并将其击退，且无敌时间 +0.5 秒',
  apply(p) { p.on('onHurt', (p, dmg, o) => { if (o && o.dot) return; p.inv += 0.5; sigilBurst(p, p.x, p.cy, 56, 2.5, '#7fb8ff', { kx: 260, ky: -180, sound: 'clank' }); }); } });
U({ id: 'guard_endure', school: 'guard', name: '不屈', rarity: 3, max: 1, icon: 'phoenix',
  desc: () => '每个房间一次：受到致命伤害时保留 1 点生命，并获得 2 秒无敌',
  apply(p) {
    p.on('onRoomStart', p => { p.counters.endured = false; });
    p.reviveFns = p.reviveFns || [];
    p.reviveFns.length = 0;
    p.reviveFns.push(p => {
      if (p.counters.endured) return false;
      p.counters.endured = true; p.hp = 1; p.inv = 2;
      FX.text(p.x, p.y - 44, '不屈', '#7fb8ff', { size: 12, life: 1.2 });
      FX.ring(p.x, p.cy, 4, 50, '#7fb8ff', 0.5, 4); Sound.play('gong');
      return true;
    });
  } });
U({ id: 'guard_fortress', school: 'guard', name: '磐石', rarity: 4, max: 1, icon: 'crown',
  desc: () => '受到的伤害 -25%；生命高于 70% 时，造成的伤害 +20%',
  apply(p, lv, s) { s.armor = 1 - (1 - s.armor) * 0.75; p.on('modDmg', p => (p.hp > p.maxHp * 0.7 ? 1.2 : 1)); } });

// =========================== 灵器印 RELIC ===========================
U({ id: 'relic_blades', school: 'relic', name: '飞刃环', rarity: 2, max: 3, icon: 'ring',
  desc: lv => `${lv + 1} 柄飞刃环绕自身，触碰敌人造成 50% 攻击力伤害`,
  apply(p, lv) {
    const n = lv + 1;
    const pos = [];
    p.on('tick', (p, dt) => {
      p.counters.orbA = (p.counters.orbA || 0) + dt * 3.4 * relicRate(p);
      pos.length = 0;
      for (let i = 0; i < n; i++) {
        const a = p.counters.orbA + i * TAU / n;
        const x = p.x + Math.cos(a) * 26, y = p.cy + Math.sin(a) * 14;
        pos.push([x, y, a]);
        for (const e of G.enemies) {
          if (e.dead || e.spawning) continue;
          const key = 'bl' + e.id;
          if (G.time - (p.counters[key] || 0) < 0.45 / relicRate(p)) continue;
          const hb = e.hurtbox();
          if (x > hb.x - 3 && x < hb.x + hb.w + 3 && y > hb.y - 3 && y < hb.y + hb.h + 3) {
            p.counters[key] = G.time;
            hitEnemy(p, e, { dmg: p.atk * 0.5 * relicMul(p), kx: 40, ky: -40, stun: 0.15, dir: sign(e.x - p.x) || 1, src: 'proc', noProc: true, sfx: false, energy: 0.3, fxc: '#c88aff' });
            Sound.play('swoosh', { x, pitch: 1.6 });
          }
        }
      }
    });
    p.on('draw', (p, ctx, gctx, cx, cy) => {
      for (const [x, y, a] of pos) {
        const X = Math.round(x - cx), Y = Math.round(y - cy);
        ctx.save(); ctx.translate(X, Y); ctx.rotate(a * 3);
        ctx.fillStyle = '#e8dcff'; ctx.fillRect(-4, -1, 8, 2); ctx.fillStyle = '#c88aff'; ctx.fillRect(-4, -1, 2, 2);
        ctx.restore();
        gctx.fillStyle = '#c88aff'; gctx.fillRect(X - 3, Y - 3, 6, 6);
      }
    });
  } });
U({ id: 'relic_fox', school: 'relic', name: '灵狐', rarity: 3, max: 2, icon: 'fox',
  desc: lv => `召唤灵狐随行，每 ${[1.2, 0.9][lv - 1]} 秒扑向附近的敌人造成 130% 攻击力伤害`,
  apply(p, lv) {
    const iv = [1.2, 0.9][lv - 1];
    const F = p.counters.fox || (p.counters.fox = { x: p.x, y: p.y - 20, t: 0, atk: 0, face: 1 });
    p.on('tick', (p, dt) => {
      F.t += dt; F.atk -= dt * relicRate(p);
      if (F.dash > 0) {
        F.dash -= dt;
        F.x = lerp(F.x, F.tx, Math.min(1, dt * 18)); F.y = lerp(F.y, F.ty, Math.min(1, dt * 18));
        if (F.dash <= 0 && F.target && !F.target.dead) {
          hitEnemy(p, F.target, { dmg: p.atk * 1.3 * relicMul(p), kx: 80 * F.face, ky: -120, stun: 0.35, dir: F.face, src: 'proc', noProc: true, sfx: 'hit', fxc: '#c88aff' });
          if (p.flags.relicMaster) applyStatus(F.target, 'stun', 0.6);
        }
        return;
      }
      const hx = p.x - p.face * 18, hy = p.y - 22 + Math.sin(F.t * 3) * 3;
      F.x = lerp(F.x, hx, Math.min(1, dt * 5)); F.y = lerp(F.y, hy, Math.min(1, dt * 5));
      F.face = sign(p.x - F.x) || p.face;
      if (F.atk <= 0) {
        const e = nearestEnemy(p.x, p.cy, 150);
        if (e) { F.atk = iv; F.target = e; F.tx = e.x; F.ty = e.cy; F.dash = 0.12; F.face = sign(e.x - F.x) || 1; Sound.play('swoosh', { x: F.x, pitch: 1.7 }); }
      }
    });
    p.on('draw', (p, ctx, gctx, cx, cy) => {
      const X = Math.round(F.x - cx), Y = Math.round(F.y - cy), f = F.face;
      ctx.fillStyle = '#f4eaff';
      ctx.fillRect(X - 5, Y - 2, 9, 4); ctx.fillRect(X + f * 3, Y - 5, 4, 4);
      ctx.fillRect(X + f * 4, Y - 7, 1, 2); ctx.fillRect(X + f * 6, Y - 7, 1, 2);
      ctx.fillStyle = '#c88aff'; ctx.fillRect(X - f * 9, Y - 4 + Math.round(Math.sin(F.t * 8)), 5, 3);
      ctx.fillStyle = '#5a2a8a'; ctx.fillRect(X + f * 5, Y - 4, 1, 1);
      gctx.fillStyle = '#c88aff'; gctx.fillRect(X - 7, Y - 6, 14, 10);
      Light.add(F.x, F.y, 40, '#c88aff', 0.5);
    });
  } });
U({ id: 'relic_talisman', school: 'relic', name: '追魂符', rarity: 1, max: 2, icon: 'scroll',
  desc: lv => `每 ${[4, 3][lv - 1]} 秒自动射出一枚追踪符咒（${[150, 200][lv - 1]}% 攻击力）`,
  apply(p, lv) {
    const iv = [4, 3][lv - 1], m = [1.5, 2.0][lv - 1];
    p.on('tick', (p, dt) => {
      p.counters.tal = (p.counters.tal || 0) - dt * relicRate(p);
      if (p.counters.tal > 0) return;
      const e = nearestEnemy(p.x, p.cy, 260);
      if (!e) return;
      p.counters.tal = iv;
      const n = p.flags.relicMaster ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.8;
        G.projs.push(new Proj({ team: 'p', x: p.x, y: p.y - 30, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, kind: 'talisman', r: 3, c: '#c88aff', life: 2.5, homing: 6, homeDelay: 0.1, accel: 0.9, ghost: true, light: 30, hit: { dmg: p.atk * m * relicMul(p), kx: 60, ky: -80, stun: 0.3, src: 'proc', noProc: true, fxc: '#c88aff' } }));
      }
      Sound.play('swoosh', { x: p.x, pitch: 1.2 });
    });
  } });
U({ id: 'relic_lantern', school: 'relic', name: '魂灯', rarity: 1, max: 1, icon: 'flame',
  desc: () => '敌人消散时留下魂火，拾取后回复 2 点生命与 6 点灵力',
  apply(p) { p.on('onKill', (p, e) => { if (e) G.pickups.push(new Pickup('soul', e.x, e.cy)); }); } });
U({ id: 'relic_bell', school: 'relic', name: '镇魂铃', rarity: 2, max: 2, icon: 'bell',
  desc: lv => `命中时有 ${[8, 14][lv - 1]}% 几率摇响铜铃，眩晕周围敌人 1 秒`,
  apply(p, lv) {
    const c = [0.08, 0.14][lv - 1];
    p.on('onHit', (p, e, h) => {
      if (h.src === 'proc' || !procChance(p, c) || G.time - (p.counters.bell || 0) < 0.8) return;
      p.counters.bell = G.time;
      FX.ring(e.x, e.cy, 4, 60, '#c88aff', 0.45, 2); FX.ring(e.x, e.cy, 4, 40, '#ffffff', 0.35, 1);
      Sound.play('gong', { x: e.x, pitch: 2.2 });
      for (const t of enemiesNear(e.x, e.cy, 60)) applyStatus(t, 'stun', 1);
    });
  } });
U({ id: 'relic_master', school: 'relic', name: '器灵通明', rarity: 4, max: 1, icon: 'crown',
  desc: () => '所有灵器伤害 +60%；追魂符一次射出两枚；灵狐的扑击附带眩晕',
  apply(p) { p.flags.relicMaster = true; } });

// =========================== 本源 CORE ===========================
U({ id: 'core_power', school: 'core', name: '力', rarity: 1, max: 5, icon: 'sword',
  desc: () => '攻击力 +10%', apply(p, lv, s) { s.atkMul += 0.1 * lv; } });
U({ id: 'core_keen', school: 'core', name: '锐', rarity: 1, max: 3, icon: 'eye',
  desc: () => '暴击率 +6%，暴击伤害 +15%', apply(p, lv, s) { s.crit += 0.06 * lv; s.critDmg += 0.15 * lv; } });
U({ id: 'core_focus', school: 'core', name: '专注', rarity: 2, max: 2, icon: 'clock',
  desc: lv => `秘技灵力消耗 -${[12, 22][lv - 1]}%，秘技伤害 +${[20, 35][lv - 1]}%`,
  apply(p, lv, s) { s.costMul *= [0.88, 0.78][lv - 1]; s.skillDmg += [0.2, 0.35][lv - 1]; } });
U({ id: 'core_spirit', school: 'core', name: '气', rarity: 1, max: 3, icon: 'orb',
  desc: () => '灵力上限 +15，灵力获取 +20%', apply(p, lv, s) { s.maxMana += 15 * lv; s.manaMul += 0.2 * lv; } });
U({ id: 'core_greed', school: 'core', name: '贪', rarity: 1, max: 3, icon: 'coin',
  desc: () => '金币获取 +30%', apply(p, lv, s) { s.goldMul += 0.3 * lv; } });
U({ id: 'core_ult', school: 'core', name: '奥义精通', rarity: 2, max: 2, icon: 'star',
  desc: lv => `奥义（↓ + I）伤害 +${[30, 60][lv - 1]}%，进入新房间时回复 30 点灵力`,
  apply(p, lv, s) { s.ultDmg += 0.3 * lv; p.on('onRoomStart', p => p.gainMana(30)); } });

// ---------- echo resolution (shared by every echo source) ----------
function tryEcho(p, e, h) {
  const ch = p.stats.echo + (p.flags.echoReso ? 0.15 : 0);
  if (ch <= 0 || h.src === 'proc' || h.dot || h.echo || !procChance(p, ch)) return;
  const dmg = h.dmg * 0.6 * (p.flags.echoReso ? 1.3 : 1);
  later(0.25, () => {
    if (e.dead) return;
    FX.slash(e.x, e.cy, { r: 16, a0: -60, a1: 60, th: 4, c: '#9aa8ff', f: -(h.dir || 1), rot: rand(-30, 30), dur: 0.16 });
    hitEnemy(p, e, { dmg, kx: 0, ky: -20, stun: 0.15, dir: h.dir || 1, src: 'proc', noProc: true, echo: true, fxc: '#9aa8ff', sfx: 'swoosh' });
  });
}

// ---------- resonance ----------
function schoolCount(p, school) { let n = 0; for (const id in p.mods) if (UPG[id] && UPG[id].school === school) n++; return n; }
function applyResonance(p, s) {
  p.resonance = [];
  const has = sc => schoolCount(p, sc) >= 3;
  if (s.echo > 0 || has('echo')) p.on('onHit', (p, e, h) => tryEcho(p, e, h));
  if (has('gale')) { s.dashes += 1; s.dashCD /= 1.25; p.resonance.push('gale'); }
  if (has('flow')) { p.on('modHit', (p, h) => { if (h.finisher) h.critBonus = 1; }); p.resonance.push('flow'); }
  if (has('echo')) { p.flags.echoReso = true; p.resonance.push('echo'); }
  if (has('charge')) { s.charge2 = true; s.chargeArmor = true; p.resonance.push('charge'); }
  if (has('hunt')) { p.flags.huntReso = true; p.on('onKill', p => p.heal(2, true)); p.resonance.push('hunt'); }
  if (has('guard')) { s.pdWindow *= 1.3; p.on('onRoomStart', p => { p.shield = Math.max(p.shield, 15); }); p.resonance.push('guard'); }
  if (has('relic')) { p.flags.relicReso = true; p.resonance.push('relic'); }
}

// ---------- offers ----------
function rollSigils(p, n = 3, o = {}) {
  const pool = Object.values(UPG).filter(u => (p.mods[u.id] || 0) < u.max && (!o.school || u.school === o.school) && (!o.owned || p.mods[u.id]));
  const out = [];
  const minR = o.minRarity || 1;
  const bonus = o.rarityBonus || 0;
  let guard = 0;
  while (out.length < n && guard++ < 200) {
    const rr = Math.random() * 100;
    let rar = 1;
    const w4 = RARITY[4].w + bonus * 2, w3 = RARITY[3].w + bonus * 4, w2 = RARITY[2].w + bonus * 4;
    if (rr < w4) rar = 4; else if (rr < w4 + w3) rar = 3; else if (rr < w4 + w3 + w2) rar = 2;
    rar = Math.max(rar, minR);
    let cands = pool.filter(u => u.rarity === rar && !out.includes(u));
    if (!cands.length) cands = pool.filter(u => !out.includes(u) && u.rarity >= minR);
    if (!cands.length) cands = pool.filter(u => !out.includes(u));
    if (!cands.length) break;
    let tot = 0;
    const ws = cands.map(u => { const w = (schoolCount(p, u.school) > 0 && u.school !== 'core' ? 1.8 : 1) * (p.mods[u.id] ? 1.3 : 1); tot += w; return w; });
    let r = Math.random() * tot, pickU = cands[0];
    for (let i = 0; i < cands.length; i++) { r -= ws[i]; if (r <= 0) { pickU = cands[i]; break; } }
    out.push(pickU);
  }
  return out;
}
function takeSigil(p, u) {
  p.mods[u.id] = (p.mods[u.id] || 0) + 1;
  const before = p.resonance ? p.resonance.length : 0;
  p.recalc();
  if (u.onPick) u.onPick(p, p.mods[u.id]);
  G.stats.blessings++;
  if (p.resonance.length > before) {
    const sc = p.resonance[p.resonance.length - 1];
    G.toast(`${SCHOOLS[sc].name}·共鸣 激活！`, SCHOOLS[sc].col, SCHOOLS[sc].reso);
    Sound.play('upgrade');
  }
}
function sigilView(u, p) {
  const lv = p.mods[u.id] || 0;
  const sc = SCHOOLS[u.school];
  return { tag: `${RARITY[u.rarity].name} · ${sc.name}`, name: u.name, icon: u.icon, col: sc.col, frame: RARITY[u.rarity].col, lvText: lv ? `Lv${lv} → ${lv + 1}` : '新', desc: u.desc(lv + 1), school: u.school, sub: null };
}

// ---------- icons (16x16 procedural pixel glyphs) ----------
const _iconCache = {};
function iconOf(key, col) {
  const k = key + col;
  if (_iconCache[k]) return _iconCache[k];
  const c2 = shade(col, -0.35), w = '#ffffff';
  const draw = {
    flame: x => { x.poly([[8, 1], [12, 7], [13, 11], [11, 15], [5, 15], [3, 11], [4, 7], [6, 9], [7, 5]], col); x.poly([[8, 7], [10, 11], [9, 14], [7, 14], [6, 11]], w); },
    drop: x => { x.poly([[8, 1], [12, 8], [12, 11], [10, 14], [6, 14], [4, 11], [4, 8]], col); x.rect(6, 9, 2, 3, w); },
    star: x => { x.poly([[8, 1], [10, 6], [15, 6], [11, 9], [13, 15], [8, 11], [3, 15], [5, 9], [1, 6], [6, 6]], col); x.circ(8, 8, 1.5, w); },
    sword: x => { x.line(3, 13, 13, 3, 2.2, col); x.line(4, 12, 12, 4, 0.8, w); x.line(2, 10, 6, 14, 1.6, c2); x.line(2, 14, 4, 12, 2, c2); },
    heart: x => { x.circ(5.5, 6, 3.5, col); x.circ(10.5, 6, 3.5, col); x.poly([[2, 7], [14, 7], [8, 14]], col); x.rect(4, 4, 2, 2, w); },
    wing: x => { x.poly([[2, 13], [5, 6], [10, 2], [15, 2], [12, 6], [14, 6], [10, 10], [12, 10], [7, 13]], col); x.line(4, 12, 11, 4, 1, w); },
    clock: x => { x.circ(8, 8, 6.5, col); x.circ(8, 8, 5, c2); x.line(8, 8, 8, 4, 1.2, w); x.line(8, 8, 11, 9, 1.2, w); },
    coin: x => { x.circ(8, 8, 6.5, col); x.circ(8, 8, 4.5, c2); x.rect(7, 4, 2, 8, w); },
    shield: x => { x.poly([[3, 2], [13, 2], [13, 9], [8, 15], [3, 9]], col); x.poly([[5, 4], [8, 4], [8, 12], [5, 8]], w); },
    burst: x => { for (let i = 0; i < 8; i++) { const a = i * TAU / 8; x.line(8, 8, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, i % 2 ? 1.2 : 2, col); } x.circ(8, 8, 3, w); },
    ring: x => { x.circ(8, 8, 7, col); x.circ(8, 8, 4.5, '#1a1028'); x.circ(8, 8, 2, w); },
    meteor: x => { x.line(2, 2, 9, 9, 2.4, c2); x.line(4, 1, 10, 7, 1.4, col); x.circ(10.5, 10.5, 4, col); x.circ(11, 10, 1.8, w); },
    shard: x => { x.poly([[8, 1], [12, 8], [8, 15], [4, 8]], col); x.poly([[8, 1], [8, 15], [4, 8]], c2); x.line(8, 3, 8, 12, 0.8, w); },
    spike: x => { x.poly([[2, 15], [5, 4], [7, 15]], col); x.poly([[6, 15], [9, 1], [12, 15]], col); x.poly([[11, 15], [13, 7], [15, 15]], col); x.line(9, 3, 9, 13, 0.8, w); },
    orb: x => { x.circ(8, 8, 5.5, col); x.circ(6.5, 6.5, 2, w); for (let i = 0; i < 3; i++) { const a = i * TAU / 3; x.circ(8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, 1.2, w); } },
    crown: x => { x.poly([[2, 13], [2, 5], [5, 9], [8, 3], [11, 9], [14, 5], [14, 13]], col); x.rect(2, 11, 12, 2, c2); x.circ(8, 8, 1.3, w); },
    phoenix: x => { x.poly([[8, 3], [11, 7], [15, 4], [13, 10], [8, 15], [3, 10], [1, 4], [5, 7]], col); x.circ(8, 7, 1.6, w); },
    feather: x => { x.poly([[13, 1], [15, 3], [6, 13], [3, 14], [4, 11]], col); x.line(14, 2, 3, 14, 0.8, w); },
    storm: x => { x.ell(8, 5, 6, 3.5, 0, c2); x.ell(6, 4, 3.5, 2.5, 0, col); x.poly([[9, 7], [6, 11], [8, 11], [6, 15], [11, 10], [9, 10], [11, 7]], w); },
    eye: x => { x.ell(8, 8, 7, 4, 0, col); x.circ(8, 8, 3, '#000000'); x.circ(8, 8, 1.4, w); },
    wave: x => { x.poly([[3, 1], [12, 8], [3, 15], [7, 8]], col); x.poly([[5, 4], [10, 8], [5, 12], [7, 8]], w); },
    skull: x => { x.circ(8, 7, 6, col); x.rect(5, 11, 6, 4, col); x.rect(4, 6, 3, 3, '#000'); x.rect(9, 6, 3, 3, '#000'); x.rect(6, 12, 1, 3, '#000'); x.rect(9, 12, 1, 3, '#000'); },
    fist: x => { x.rect(3, 5, 10, 8, col); x.rect(3, 3, 3, 3, col); x.rect(6, 3, 3, 3, col); x.rect(9, 3, 3, 3, col); x.rect(4, 7, 8, 1, c2); x.rect(4, 4, 1, 1, w); },
    flower: x => { for (let i = 0; i < 5; i++) { const a = i * TAU / 5 - Math.PI / 2; x.circ(8 + Math.cos(a) * 4, 8 + Math.sin(a) * 4, 3, col); } x.circ(8, 8, 2.2, w); },
    hand: x => { x.rect(4, 7, 9, 7, col); for (let i = 0; i < 4; i++) x.rect(4 + i * 2.3, 2 + (i === 0 ? 3 : 0), 1.8, 6, col); x.rect(11, 5, 2, 4, col); x.rect(5, 9, 6, 1, c2); },
    fox: x => { x.poly([[2, 9], [6, 6], [11, 6], [14, 3], [14, 8], [11, 11], [4, 12]], col); x.poly([[11, 6], [12, 1], [14, 3]], col); x.rect(12, 6, 1, 1, '#000'); x.poly([[2, 9], [0, 13], [4, 12]], w); },
    bell: x => { x.poly([[5, 3], [11, 3], [13, 12], [3, 12]], col); x.rect(2, 12, 12, 2, c2); x.circ(8, 14.5, 1.5, w); x.rect(7, 1, 2, 2, c2); },
    scroll: x => { x.rect(4, 2, 8, 12, col); x.rect(3, 2, 10, 2, c2); x.rect(3, 12, 10, 2, c2); x.rect(6, 5, 4, 1, w); x.rect(7.5, 6, 1, 5, w); },
    chain: x => { x.ell(5, 6, 3.5, 2.5, -0.7, col); x.ell(11, 10, 3.5, 2.5, -0.7, col); x.ell(5, 6, 1.6, 0.9, -0.7, '#1a1028'); x.ell(11, 10, 1.6, 0.9, -0.7, '#1a1028'); x.line(6, 8, 10, 8, 1.4, w); },
    spear: x => { x.line(2, 14, 11, 5, 1.6, c2); x.poly([[10, 6], [11, 3], [15, 1], [13, 5]], col); x.line(11, 5, 14, 2, 0.8, w); x.poly([[9, 6], [11, 8], [8, 10], [7, 8]], col); },
    dragon: x => { x.circ(3.5, 12.5, 1.5, c2); x.circ(6, 10.5, 2, col); x.circ(9, 10, 2.2, col); x.circ(11, 7.5, 2.4, col); x.ell(12.5, 4.5, 3, 2.2, -0.5, col); x.poly([[10, 3], [8.5, 0], [12, 2.5]], col); x.rect(13, 3.5, 1, 1, w); },
    // ---- control glyphs (touch buttons, menu chrome) ----
    gun: x => { x.rect(2, 5, 11, 4, col); x.rect(13, 5.5, 2, 2, c2); x.rect(3, 9, 4, 5, col); x.rect(7, 9, 3, 2.5, c2); x.rect(3, 6, 8, 1, w); x.rect(4, 11, 2, 1, c2); },
    jump: x => { x.poly([[8, 1], [14, 7], [11, 7], [8, 4], [5, 7], [2, 7]], col); x.poly([[8, 8], [14, 14], [11, 14], [8, 11], [5, 14], [2, 14]], col); x.line(8, 2.5, 12, 6.5, 0.8, w); },
    dash: x => { x.poly([[8, 3], [15, 8], [8, 13], [8, 10], [3, 10], [3, 6], [8, 6]], col); x.rect(0, 5, 2, 1, w); x.rect(0, 10, 2, 1, w); x.rect(1, 8, 1, 1, w); x.line(9, 5, 13, 8, 0.8, w); },
    pause: x => { x.rect(4, 3, 3, 10, col); x.rect(9, 3, 3, 10, col); x.rect(4, 3, 1, 10, w); x.rect(9, 3, 1, 10, w); },
    back: x => { x.poly([[1, 8], [8, 1], [8, 5], [15, 5], [15, 11], [8, 11], [8, 15]], col); x.line(2.5, 8, 8, 2.5, 0.8, w); },
    reroll: x => { for (let i = 0; i < 14; i++) { const a = -0.6 + i * 0.36; x.rect(8 + Math.cos(a) * 5.5 - 1, 8 + Math.sin(a) * 5.5 - 1, 2.2, 2.2, i > 10 ? c2 : col); } x.poly([[12, 1], [15, 6], [10, 6]], col); x.circ(8, 8, 1.5, w); },
  }[key] || (x => x.circ(8, 8, 6, col));
  const c = bakeSprite(16, 16, draw, { outline: '#0a0612' });
  _iconCache[k] = c;
  return c;
}

// =====================================================================
//  TALENTS — permanent meta-progression bought with 熵晶
// =====================================================================
const TALENTS = [
  { id: 'hp', name: '坚韧之躯', max: 5, icon: 'heart', col: '#ff3b5c', desc: lv => `最大生命 +${lv * 10}`, cost: lv => 30 + lv * 30 },
  { id: 'atk', name: '锋锐之心', max: 5, icon: 'sword', col: '#ffb347', desc: lv => `攻击力 +${lv * 5}%`, cost: lv => 40 + lv * 40 },
  { id: 'crit', name: '鹰眼', max: 3, icon: 'eye', col: '#ffe14a', desc: lv => `暴击率 +${lv * 3}%`, cost: lv => 50 + lv * 50 },
  { id: 'gold', name: '财富嗅觉', max: 3, icon: 'coin', col: '#ffd23f', desc: lv => `金币获取 +${lv * 10}%`, cost: lv => 40 + lv * 40 },
  { id: 'start', name: '初始资金', max: 3, icon: 'coin', col: '#ffc83a', desc: lv => `开局携带 ${lv * 50} 金币`, cost: lv => 40 + lv * 30 },
  { id: 'reroll', name: '命运重铸', max: 3, icon: 'clock', col: '#5aa8ff', desc: lv => `每局获得 ${lv} 次奖励重掷`, cost: lv => 60 + lv * 60 },
  { id: 'dash', name: '影步', max: 1, icon: 'wing', col: '#7ff0ff', desc: () => '冲刺次数 +1', cost: () => 220 },
  { id: 'revive', name: '不屈之志', max: 1, icon: 'phoenix', col: '#ffe14a', desc: () => '每局一次：死亡时以 40% 生命复苏', cost: () => 320 },
  { id: 'bless', name: '先行者', max: 1, icon: 'star', col: '#c46aff', desc: () => '开局额外获得一次刻印选择', cost: () => 160 },
  { id: 'heal', name: '休憩', max: 2, icon: 'drop', col: '#6aff8a', desc: lv => `休息点回复量 +${lv * 15}%`, cost: lv => 60 + lv * 60 },
];
const Talents = {
  lv(id) { return Save.data.talents[id] || 0; },
  values() {
    const L = id => this.lv(id);
    return { hp: L('hp') * 10, atk: L('atk') * 0.05, crit: L('crit') * 0.03, gold: L('gold') * 0.1, start: L('start') * 50, reroll: L('reroll'), dash: L('dash'), revive: L('revive'), bless: L('bless'), heal: L('heal') * 0.15 };
  },
  buy(t) {
    const lv = this.lv(t.id);
    if (lv >= t.max) return false;
    const c = t.cost(lv);
    if (Save.data.crystals < c) return false;
    Save.data.crystals -= c;
    Save.data.talents[t.id] = lv + 1;
    Save.write();
    return true;
  },
};
