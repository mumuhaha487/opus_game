'use strict';
// =====================================================================
//  HEROES (2/4) — EVE, the gunslinger witch
// =====================================================================
const E_AIM = { aF: [0, 0], aB: [2, 2], w: 0, w2: 2 };
const E_AIR = { gl: 0, lF: [60, 120], lB: [110, 140] };
const EVE_C = '#ffd84a', EVE_C2 = '#5ad8ff';

function eveOrbShot(p, o) {
  const hit = p.makeHit({ dmg: o.dmg, kx: 80, ky: -60, stun: 0.4, hs: 2, src: o.src || 'skill', fxc: o.c, skill: o.skill, art: o.art, uskill: o.uskill, wx: o.wx });
  const boom = q => {
    if (q.boomed) return; q.boomed = true;
    explodeP(q.x, q.y, o.r || 50, o.boom, { c: o.c, src: o.src || 'skill', ky: -240, kx: 160, shake: 0.35, noProc: false, sound: 'explode', pitch: 1.1, wx: hit.wx });
    if (o.shards) for (let i = 0; i < o.shards; i++) {
      const a = i * TAU / o.shards;
      G.projs.push(new Proj({ team: 'p', x: q.x, y: q.y, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, kind: 'shard', r: 2.5, c: o.c, c2: '#ffffff', life: 0.45, hit: p.makeHit({ dmg: o.shardDmg || 0.5, kx: 40, ky: -40, stun: 0.2, src: o.src || 'skill', wx: hit.wx }) }));
    }
  };
  const pr = new Proj({
    team: 'p', x: p.x + p.face * 16, y: p.y - 22, vx: p.face * (o.sp || 320), vy: o.vy || 0, grav: o.grav || 0, kind: o.kind || 'orb', r: o.size || 6, c: o.c, c2: '#ffffff',
    life: o.life || 1, hit, pierce: o.pierce || 0, light: 80, trail: 0.6,
    onDie: boom, upd: q => { if (q.t > (o.fuse || 9) && !q.boomed) { boom(q); q.life = 0; } },
  });
  G.projs.push(pr);
  return pr;
}

HEROES.eve = {
  id: 'eve', name: '伊芙', en: 'EVE', title: '星弹魔女', role: '远程 · 爆发',
  color: EVE_C, color2: EVE_C2,
  desc: '浪迹江湖的魔弹术士，以双枪施展星辰之力。速射、魔导弹与机关并用。',
  hp: 85, atk: 9, speed: 142, crit: 0.08, armor: 0, energyRate: 0.8, procMul: 0.6,
  hurt: [12, 30],
  startSkill: 'eve_missile',
  ultName: '湮灭光炮', ultDesc: '展开魔导炮，向前方释放持续的毁灭光束。',
  combo: 'shot1', air: 'ashot1',
  look: 'eve',
  holdPose: s => ({ lean: 4, ...E_AIM, aF: [s * 2, s * 2], lF: [60, 105], lB: [120, 95], scarf: 120 + s * 6 }),
  wallPose: { gl: 0, lean: -4, aF: [20, 0], aB: [170, 160], w: 0, w2: 160, lF: [80, 130], lB: [120, 160], scarf: 100 },
  moves: {
    // ---------------- ground combo ----------------
    shot1: {
      label: '速射', dur: 0.16, cancel: 0.1, light: true,
      keys: [[0, { aF: [0, 0], w: 0, lean: 4 }], [0.03, { aF: [-10, -14], w: -14, lean: 0 }], [0.16, { aF: [0, 0], w: 0 }]],
      ev: [[0.02, p => hShoot(p, { ox: 16, oy: -21, ang: rand(-2, 2) })]],
      next: 'shot2',
    },
    shot2: {
      label: '交替射击', dur: 0.16, cancel: 0.1, light: true,
      keys: [[0, { aB: [0, 0], w2: 0, aF: [50, 10], w: 10 }], [0.03, { aB: [-10, -14], w2: -14 }], [0.16, { aB: [0, 0], w2: 0 }]],
      ev: [[0.02, p => hShoot(p, { ox: 14, oy: -21, ang: rand(-2, 2) })]],
      next: 'shot3', delay: 'shotB1',
    },
    shot3: {
      label: '扇形三连', dur: 0.26, cancel: 0.18, light: true,
      keys: [[0, { ...E_AIM, lean: 4 }], [0.04, { aF: [-12, -15], aB: [-10, -14], w: -15, w2: -14, lean: -2 }], [0.26, { aF: [0, 0], aB: [0, 0], w: 0, w2: 0 }]],
      ev: [[0.03, p => { for (const a of [-9, 0, 9]) hShoot(p, { ox: 16, oy: -21, ang: a, dmg: 0.5, silent: a !== 0 }); }]],
      next: 'shot4',
    },
    shot4: {
      label: '霰弹轰击', dur: 0.42, cancel: 0.3,
      keys: [
        [0, { lean: 10, aF: [10, 5], aB: [15, 10], w: 5, w2: 10, lF: [60, 100], lB: [120, 100] }],
        [0.06, { lean: -12, aF: [-25, -35], aB: [-20, -30], w: -35, w2: -30, lF: [75, 100], lB: [105, 95] }, 'outCubic'],
        [0.42, { lean: 2, aF: [30, 0], aB: [50, 20], w: 0, w2: 10 }],
      ],
      hits: [{ t: 0.05, d: 0.07, box: [4, -38, 48, 32], dmg: 1.9, kb: [330, -110], stun: 0.5, hs: 6, heavy: true, finisher: true, src: 'heavy' }],
      ev: [[0.05, p => {
        const x = p.x + p.face * 18, y = p.y - 22;
        Sound.play('shotgun', { x });
        FX.flash(x, y, 10, '#ffe9a0', 0.1);
        FX.sparks(x, y, p.face > 0 ? 0 : Math.PI, EVE_C, 14, [260, 520], 0.35);
        FX.burst(x, y, { n: 10, c: [EVE_C, '#ffffff', '#ff9a3a'], sp: [80, 220], ang: p.face > 0 ? 0 : Math.PI, spread: 0.4, glow: true });
        p.vx = -p.face * 160;
        Cam.push(-p.face * 3, 0);
      }]],
      next: 'shot5', nextReq: 'combo5',
    },
    shot5: {
      label: '终式·星环踢', dur: 0.6, cancel: 0.46,
      keys: [
        [0, { lean: 10, lF: [60, 110], lB: [120, 100] }],
        [0.08, { gl: 0.3, lean: -20, lF: [-10, 20], lB: [120, 130], aF: [-60, -70], aB: [140, 150], w: -70, w2: 150 }, 'outCubic'],
        [0.2, { gl: 0.3, lean: 20, lF: [150, 170], lB: [60, 90], aF: [180, 190], aB: [20, 0], w: 190, w2: 0 }],
        [0.6, { lean: 2 }],
      ],
      hits: [{ t: 0.08, d: 0.14, box: [-30, -46, 60, 48], dmg: 1.5, kb: [220, -280], stun: 0.7, hs: 6, heavy: true, launch: true, radial: true, finisher: true, src: 'heavy' }],
      ev: [
        [0.04, p => { p.vy = -160; Sound.play('swoosh', { x: p.x, pitch: 0.8 }); }],
        [0.1, p => {
          for (let i = 0; i < 10; i++) {
            const a = i * 36;
            hShoot(p, { ox: 0, oy: -22, ang: a, dmg: 0.45, silent: i > 0, sp: 480 });
          }
          FX.ring(p.x, p.cy, 4, 40, EVE_C, 0.3, 3);
          Sound.play('shotgun', { x: p.x, pitch: 1.3 });
        }],
      ],
    },
    // ---------------- delayed branch ----------------
    shotB1: {
      label: '派生·连锁速射', dur: 0.36, cancel: 0.3,
      keys: altKeys(6, 0.055, { ...E_AIM, lean: 6, aB: [5, 5], w2: 5 }, { aF: [-10, -14], w: -14, aB: [-6, -10], w2: -10, lean: 2 }),
      ev: Array.from({ length: 5 }, (_, i) => [0.02 + i * 0.055, p => hShoot(p, { ox: i % 2 ? 14 : 16, oy: -21, ang: rand(-4, 4), dmg: 0.5, silent: i % 2 === 1, pitch: 1.2 })]),
      next: 'shotB2',
    },
    shotB2: {
      label: '派生·膝撞', dur: 0.42, cancel: 0.3,
      keys: [
        [0, { lean: -6, lF: [60, 110], lB: [120, 100], aF: [60, 30], aB: [80, 40] }],
        [0.06, { gl: 0.3, lean: -14, lF: [-20, 60], lB: [110, 100], aF: [100, 60], aB: [120, 80], w: 60, w2: 80 }, 'outCubic'],
        [0.42, { lean: 0 }],
      ],
      vel: [[0.02, 0.1, 140]],
      hits: [{ t: 0.05, d: 0.07, box: [-2, -42, 30, 32], dmg: 1.4, kb: [60, -390], stun: 0.7, hs: 5, launch: true }],
      ev: [[0.05, p => { p.vy = -170; Sound.play('hitHeavy', { x: p.x, pitch: 1.3 }); hPunchFx(p, 12, -24, true, EVE_C2); }]],
    },
    // ---------------- directional / special ----------------
    low: {
      label: '滑铲', dur: 0.46, cancel: 0.34,
      keys: [
        [0, { lean: -30, lF: [0, 8], lB: [60, 120], aF: [120, 140], aB: [150, 170], w: 140, w2: 170 }],
        [0.3, { lean: -30, lF: [0, 8], lB: [60, 120], aF: [120, 140], aB: [150, 170], w: 140, w2: 170 }],
        [0.46, { lean: 2 }],
      ],
      vel: [[0, 0.28, 280]],
      hits: [{ t: 0.03, d: 0.24, box: [0, -14, 30, 16], dmg: 1.1, kb: [80, -290], stun: 0.7, hs: 3, launch: true }],
      update(p, mv) { if (mv.t < 0.28 && Math.random() < 0.7) FX.dust(p.x + p.face * 6, p.y, 1, -p.face); },
      ev: [[0, p => Sound.play('dash', { x: p.x, pitch: 0.9 })]],
    },
    rise: {
      label: '空翻踢', dur: 0.48, cancel: 0.34,
      keys: [
        [0, { lean: 10, lF: [50, 110], lB: [120, 100] }],
        [0.08, { gl: 0.4, lean: -30, lF: [-70, -50], lB: [110, 120], aF: [-60, -70], aB: [120, 100], w: -70, w2: 100 }, 'outCubic'],
        [0.25, { gl: 0, lean: -20, lF: [-20, 10], lB: [100, 130], aF: [-80, -85], w: -85 }],
        [0.48, { gl: 0, lean: 0, lF: [60, 110], lB: [110, 130], aF: [20, 0], w: 0 }],
      ],
      hits: [{ t: 0.06, d: 0.1, box: [-4, -52, 32, 54], dmg: 1.1, kb: [40, -430], stun: 0.7, hs: 4, launch: true }],
      ev: [
        [0.06, p => { p.vy = -360; Sound.play('slash', { x: p.x, pitch: 1.4 }); hSlash(p, { x: 6, y: -16, r: 20, a0: 90, a1: -100, th: 6, c: EVE_C2 }); }],
        [0.16, p => hShoot(p, { ox: 8, oy: -30, ang: -75 })],
        [0.24, p => hShoot(p, { ox: 8, oy: -30, ang: -82 })],
      ],
    },
    dashAtk: {
      label: '穿梭射击', dur: 0.34, cancel: 0.22, grav: 0,
      keys: [[0, { ...E_AIM, lean: 20, lF: [40, 100], lB: [140, 130] }], [0.34, { ...E_AIM, lean: 10 }]],
      vel: [[0, 0.16, 380, 0]],
      ev: [0.02, 0.07, 0.12].map((t, i) => [t, p => hShoot(p, { ox: 16, oy: -20, ang: rand(-3, 3), dmg: 0.7, pierce: 1, silent: i > 0 })]),
      next: 'dashAtk2', nextReq: 'dashChain',
    },
    dashAtk2: {
      label: '追风·回旋踢', dur: 0.46, cancel: 0.32,
      keys: [
        [0, { lean: 10, lF: [60, 110], lB: [120, 100] }],
        [0.06, { gl: 0.3, lean: -18, lF: [-30, 0], lB: [120, 130], aF: [-60, -70], aB: [140, 150], w: -70, w2: 150 }, 'outCubic'],
        [0.46, { gl: 0, lean: 0 }],
      ],
      hits: [{ t: 0.05, d: 0.12, box: [-26, -46, 52, 48], dmg: 1.3, kb: [120, -380], stun: 0.7, hs: 5, launch: true, radial: true }],
      ev: [[0.05, p => { p.vy = -240; Sound.play('swoosh', { x: p.x }); hSlash(p, { x: 0, y: -24, r: 22, a0: -180, a1: 180, th: 5, c: EVE_C2, sy: 0.6 }); }]],
    },
    charge1: {
      label: '蓄力·魔导弹', dur: 0.42, cancel: 0.3, noAtkSpeed: true,
      keys: [[0, { ...E_AIM, lean: 6 }], [0.05, { aF: [-22, -30], aB: [-18, -26], w: -30, w2: -26, lean: -14 }, 'outCubic'], [0.42, { ...E_AIM }]],
      ev: [[0.04, p => {
        hShoot(p, { ox: 18, oy: -21, dmg: 2.4, r: 4, len: 26, sp: 720, pierce: 99, ghost: true, kx: 220, ky: -60, src: 'charge', c: EVE_C2, life: 0.7, hs: 4 });
        Sound.play('shotgun', { x: p.x, pitch: 1.5 });
        p.vx = -p.face * 140; Cam.push(-p.face * 3, 0);
      }]],
    },
    charge2: {
      label: '极·星爆弹', dur: 0.56, cancel: 0.42, noAtkSpeed: true,
      keys: [[0, { ...E_AIM, lean: 6, big: true }], [0.06, { aF: [-26, -34], aB: [-22, -30], w: -34, w2: -30, lean: -18, big: true }, 'outCubic'], [0.56, { ...E_AIM }]],
      ev: [[0.06, p => {
        eveOrbShot(p, { dmg: 1.2, boom: 3.0, r: 64, c: EVE_C2, sp: 300, size: 7, shards: 8, fuse: 0.85, src: 'charge', kind: 'orb' });
        Sound.play('explode', { x: p.x, pitch: 1.8 });
        p.vx = -p.face * 180; Cam.shake(0.25);
      }]],
    },
    counter: {
      label: '瞬身连射', dur: 0.55, cancel: 0.4, grav: 0, noAtkSpeed: true,
      keys: [[0, { ...E_AIM, lean: 4 }], ...altKeys(4, 0.05, { ...E_AIM, lean: 4 }, { aF: [-12, -16], w: -16, aB: [-10, -14], w2: -14, lean: 0 }), [0.28, { lean: -10, lF: [-30, 10], lB: [110, 120] }, 'outCubic'], [0.55, { lean: 2 }]],
      onStart(p) { teleportBehind(p, 190); p.inv = Math.max(p.inv, 0.5); },
      ev: [
        ...[0.04, 0.09, 0.14, 0.19].map((t, i) => [t, p => hShoot(p, { ox: 14, oy: -21, ang: rand(-3, 3), dmg: 0.8, critBonus: 1, src: 'counter', silent: i > 0, c: EVE_C2 })]),
        [0.28, p => { Sound.play('hitHeavy', { x: p.x }); hPunchFx(p, 14, -18, true, EVE_C2); }],
      ],
      hits: [{ t: 0.28, d: 0.07, box: [-2, -36, 34, 32], dmg: 1.4, kb: [260, -280], stun: 0.7, hs: 7, heavy: true, launch: true, critBonus: 1, src: 'counter', finisher: true }],
    },
    // ---------------- air ----------------
    ashot1: {
      label: '空·速射', dur: 0.16, cancel: 0.1, air: true, grav: 0.1,
      keys: [[0, { ...E_AIR, aF: [8, 8], w: 8 }], [0.03, { ...E_AIR, aF: [-4, -6], w: -6 }], [0.16, { ...E_AIR, aF: [8, 8], w: 8 }]],
      ev: [[0.02, p => hShoot(p, { ox: 15, oy: -20, ang: 8 })]],
      next: 'ashot2',
    },
    ashot2: {
      label: '空·交替', dur: 0.16, cancel: 0.1, air: true, grav: 0.1,
      keys: [[0, { ...E_AIR, aB: [8, 8], w2: 8, aF: [40, 20], w: 20 }], [0.03, { ...E_AIR, aB: [-4, -6], w2: -6 }], [0.16, { ...E_AIR, aB: [8, 8], w2: 8 }]],
      ev: [[0.02, p => hShoot(p, { ox: 13, oy: -20, ang: 8 })]],
      next: 'ashot3',
    },
    ashot3: {
      label: '空·俯射', dur: 0.32, cancel: 0.24, air: true, grav: 0.15,
      keys: [[0, { ...E_AIR, aF: [35, 35], aB: [40, 40], w: 35, w2: 40, lean: 10, lF: [50, 120] }], [0.05, { ...E_AIR, aF: [20, 20], aB: [25, 25], w: 20, w2: 25, lean: -6 }], [0.32, { ...E_AIR, aF: [35, 35], w: 35 }]],
      ev: [[0.04, p => { hShoot(p, { ox: 14, oy: -16, ang: 35, dmg: 0.8, kx: 60, ky: 120 }); hShoot(p, { ox: 12, oy: -14, ang: 42, dmg: 0.8, kx: 60, ky: 120, silent: true }); p.vy = -60; }]],
    },
    airRise: {
      label: '空·飞踢', dur: 0.42, cancel: 0.3, air: true, grav: 1,
      keys: [[0, { ...E_AIR, lean: 10 }], [0.06, { gl: 0, lean: -26, lF: [-70, -50], lB: [110, 130], aF: [-60, -70], w: -70 }, 'outCubic'], [0.42, { ...E_AIR, lean: 0 }]],
      hits: [{ t: 0.05, d: 0.1, box: [-4, -50, 32, 50], dmg: 1.0, kb: [40, -400], stun: 0.6, hs: 3, launch: true }],
      ev: [[0.05, p => { p.vy = -330; Sound.play('swoosh', { x: p.x, pitch: 1.2 }); hSlash(p, { x: 6, y: -18, r: 20, a0: 90, a1: -100, th: 6, c: EVE_C2 }); }], [0.14, p => hShoot(p, { ox: 8, oy: -30, ang: -80 })]],
    },
    plunge: {
      label: '空·弹雨', dur: 0.62, cancel: 0.5, air: true, grav: 0.25,
      keys: [[0, { gl: 0, lean: 10, aF: [70, 80], aB: [80, 95], w: 80, w2: 95, lF: [40, 110], lB: [120, 140] }], [0.62, { gl: 0, lean: 10, aF: [70, 80], aB: [80, 95], w: 80, w2: 95, lF: [40, 110], lB: [120, 140] }]],
      onStart(p) { p.vy = -80; },
      ev: Array.from({ length: 9 }, (_, i) => [0.04 + i * 0.055, p => hShoot(p, { ox: 6, oy: -12, ang: rand(60, 120), dmg: 0.45, sp: 520, silent: i % 2 === 1 })]),
    },

    // =============== SKILLS ===============
    sk_missile: {
      label: '追踪弹幕', dur: 0.46, cancel: 0.36, noAtkSpeed: true, skill: 'eve_missile',
      keys: [[0, { lean: -8, aF: [-40, -60], aB: [-50, -70], w: -60, w2: -70 }], [0.46, { lean: -8, aF: [-40, -60], aB: [-50, -70], w: -60, w2: -70 }]],
      ev: Array.from({ length: 10 }, (_, i) => [0.05 + i * 0.03, p => {
        const lv = p.skillLv('eve_missile');
        if (i >= (lv >= 2 ? 10 : 6)) return;
        const a = (-70 + rand(-25, 25)) * DEG;
        const hit = p.makeHit({ dmg: 1.0, kx: 80, ky: -80, stun: 0.35, hs: 1, src: 'skill', fxc: EVE_C2, skill: 'eve_missile' });
        G.projs.push(new Proj({
          team: 'p', x: p.x + p.face * 4, y: p.y - 28, vx: Math.cos(a) * 240 * p.face, vy: Math.sin(a) * 240, r: 3, kind: 'missile', c: EVE_C2,
          homing: 7, homeDelay: 0.15, accel: 0.8, life: 2.2, hit, light: 30,
          onDie: pr => explodeP(pr.x, pr.y, lv >= 3 ? 34 : 22, 0.6 * skMul(p, 'eve_missile'), { c: EVE_C2, sound: 'explode', pitch: 1.6, shake: 0.06, src: 'skill', wx: pr.hit.wx }),
        }));
        Sound.play('shoot', { x: p.x, pitch: 0.7 });
      }]),
    },
    sk_grenade: {
      label: '爆裂榴弹', dur: 0.42, cancel: 0.3, skill: 'eve_grenade',
      keys: [[0, { lean: -10, aF: [160, 120], w: 120, aB: [60, 20] }], [0.08, { lean: 14, aF: [-40, -50], w: -50 }, 'outCubic'], [0.42, { lean: 2 }]],
      ev: [[0.08, p => {
        const lv = p.skillLv('eve_grenade');
        const throwOne = (vx, vy, big) => {
          const hit = p.makeHit({ dmg: 0.6, kx: 60, ky: -60, stun: 0.3, src: 'skill', skill: 'eve_grenade' });
          G.projs.push(new Proj({
            team: 'p', x: p.x + p.face * 10, y: p.y - 26, vx: vx * p.face, vy, grav: 700, kind: 'orb', r: big ? 4 : 3, c: '#ff8a3a', c2: '#ffe0a0', life: 2.5, hit, light: 40, trail: 0.5, tc: '#8a8aa8',
            onDie: q => {
              explodeP(q.x, q.y, big ? 56 : 34, (big ? 2.6 : 1.2) * skMul(p, 'eve_grenade'), { c: '#ff8a3a', ky: -300, kx: 180, shake: big ? 0.45 : 0.15, src: 'skill', noProc: false, wx: q.hit.wx });
              if (lv >= 3 && big) addZone({ x: q.x, y: q.y, life: 2, tick: 0.3, onTick(z) { for (const e of enemiesNear(z.x, z.y, 40)) hitEnemy(p, e, p.makeHit({ dmg: 0.35, kx: 0, ky: 0, stun: 0.1, dot: true, src: 'skill', skill: 'eve_grenade', numc: '#ff9a3a' })); }, upd(z) { if (Math.random() < 0.8) FX.fire(z.x + rand(-30, 30), z.y + rand(-4, 4), 1); Light.add(z.x, z.y, 80, '#ff7a2a', 0.6); } });
            },
          }));
        };
        throwOne(230, -280, true);
        if (lv >= 2) { throwOne(150, -320, false); throwOne(310, -240, false); }
        Sound.play('swoosh', { x: p.x, pitch: 0.7 });
      }]],
    },
    sk_backflip: {
      label: '后跃速射', dur: 0.6, cancel: 0.48, grav: 0.8, skill: 'eve_backflip',
      keys: [
        [0, { lean: 10, ...E_AIM }],
        [0.1, { gl: 0, lean: -40, lF: [-30, 40], lB: [60, 120], aF: [30, 30], aB: [40, 40], w: 30, w2: 40 }, 'outCubic'],
        [0.4, { gl: 0, lean: -10, lF: [40, 110], lB: [110, 140], aF: [40, 40], aB: [45, 45], w: 40, w2: 45 }],
        [0.6, { lean: 2 }],
      ],
      onStart(p) { p.vy = -320; p.vx = -p.face * 200; p.inv = Math.max(p.inv, 0.35); },
      ev: Array.from({ length: 6 }, (_, i) => [0.1 + i * 0.05, p => {
        const lv = p.skillLv('eve_backflip');
        const pr = hShoot(p, { ox: 10, oy: -20, ang: 22 + i * 4, dmg: 0.85, silent: i % 2 === 1, skill: 'eve_backflip', src: 'skill' });
        if (lv >= 3) pr.onDie = q => explodeP(q.x, q.y, 18, 0.5, { c: EVE_C, sound: false, shake: 0.03, src: 'skill', wx: q.hit.wx });
        if (lv >= 2 && i % 2 === 0) hShoot(p, { ox: 10, oy: -18, ang: 30 + i * 4, dmg: 0.6, silent: true, skill: 'eve_backflip', src: 'skill' });
      }]),
      update(p, mv) { if (mv.t < 0.4) p.vx = approach(p.vx, -p.face * 120, 600 / 60); },
    },
    sk_mine: {
      label: '束缚地雷', dur: 0.36, cancel: 0.24, skill: 'eve_mine',
      keys: [[0, { lean: 20, aF: [80, 100], w: 100, lF: [30, 120], lB: [150, 100] }], [0.36, { lean: 4 }]],
      ev: [[0.1, p => {
        const lv = p.skillLv('eve_mine');
        const maxN = lv >= 2 ? 3 : 2;
        const mines = G.zones.filter(z => z.mine);
        if (mines.length >= maxN) mines[0].life = 0.01;
        const x = p.x + p.face * 10, y = G.room.floorBelow(p.x, p.y - 4);
        const r = lv >= 3 ? 60 : 46;
        Sound.play('clank', { x, pitch: 1.6 });
        addZone({
          x, y, life: 10, mine: true, tick: 0.1, armed: 0.4,
          onTick(z) {
            if (z.t < z.armed || z.done) return;
            if (enemiesNear(z.x, z.y - 8, 26).length) {
              z.done = true; z.life = 0.01;
              explodeP(z.x, z.y - 6, r, 2.4 * skMul(p, 'eve_mine'), { c: EVE_C2, ky: -260, kx: 100, shake: 0.35, src: 'skill', noProc: false, wx: { fam: 'sk', id: 'eve_mine' } });
              for (const e of enemiesNear(z.x, z.y - 6, r)) applyStatus(e, 'stun', 1.5);
              FX.ring(z.x, z.y - 6, 4, r, '#bff8ff', 0.4, 3);
            }
          },
          drawFn(ctx, gctx, x2, y2, z) {
            const blink = Math.floor(z.t * (z.t < z.armed ? 4 : 8)) % 2;
            ctx.fillStyle = '#2a3048'; ctx.fillRect(x2 - 5, y2 - 3, 10, 3);
            ctx.fillStyle = blink ? EVE_C2 : '#1a6a8a'; ctx.fillRect(x2 - 1, y2 - 5, 3, 2);
            if (blink) { gctx.fillStyle = EVE_C2; gctx.fillRect(x2 - 3, y2 - 7, 6, 5); }
          },
        });
      }]],
    },
    sk_snipe: {
      label: '魔弹狙击', dur: 0.9, cancel: 0.76, noAtkSpeed: true, skill: 'eve_snipe',
      keys: [[0, { ...E_AIM, lean: 2, lF: [55, 115], lB: [125, 95], big: true }], [0.48, { ...E_AIM, lean: 2, lF: [55, 115], lB: [125, 95], big: true }], [0.53, { aF: [-24, -30], w: -30, aB: [-20, -26], w2: -26, lean: -16, big: true }, 'outCubic'], [0.9, { ...E_AIM }]],
      onStart(p) { p.vx = 0; p.armorT = 0.5; Sound.play('charge', { x: p.x, pitch: 1.4 }); },
      update(p, mv) {
        if (mv.t < 0.48) {
          const y = p.y - 21;
          FX.add({ k: 'tline', x: p.x + p.face * 18, y, x2: p.x + p.face * 420, y2: y, c: EVE_C2, life: 1 / 50, a: 0.5 });
        }
      },
      ev: [[0.5, p => {
        const lv = p.skillLv('eve_snipe');
        const f = p.face, x0 = p.x + f * 16, y = p.y - 21;
        let x1 = x0;
        for (let d = 0; d < 440; d += 6) { const nx = x0 + f * d; if (G.room.solidPx(nx, y)) break; x1 = nx; }
        const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
        for (const e of enemiesInRect(lo, y - 8, hi - lo, 16)) {
          hitEnemy(p, e, p.makeHit({ dmg: 4.0, kx: 260, ky: -120, stun: 0.8, hs: 0, heavy: true, critBonus: 0.3, dir: f, src: 'skill' }));
          if (lv >= 3) explodeP(e.x, e.cy, 30, 1.0 * skMul(p, 'eve_snipe'), { c: EVE_C2, sound: false, shake: 0.1, src: 'skill' });
        }
        FX.add({ k: 'beam', x: lo, y, len: hi - lo, w: 5, ang: 0, c: EVE_C2, life: 0.3 });
        FX.add({ k: 'beam', x: lo, y, len: hi - lo, w: 1.5, ang: 0, c: '#ffffff', life: 0.4 });
        FX.flash(x0, y, 12, '#ffffff', 0.12);
        G.hitstop(6); Cam.shake(0.45); Cam.push(-f * 5, 0);
        Sound.play('shotgun', { x: p.x, pitch: 0.7 }); Sound.play('laser', { x: p.x, pitch: 0.5 });
        p.vx = -f * 200;
      }]],
    },
    sk_kata: {
      label: '枪舞', dur: 1.45, cancel: 9, armor: true, skill: 'eve_kata',
      durFn: p => p.skillLv('eve_kata') >= 3 ? 1.45 : 1.0,
      keys: altKeys(14, 0.1, { lean: 0, aF: [0, 0], aB: [180, 180], w: 0, w2: 180, lF: [70, 100], lB: [110, 95] }, { lean: 0, aF: [-90, -90], aB: [90, 90], w: -90, w2: 90, lF: [80, 100], lB: [100, 95] }),
      update(p, mv, dt) {
        mv.ft = (mv.ft || 0) - dt;
        if (mv.ft <= 0) {
          mv.ft = p.skillLv('eve_kata') >= 2 ? 0.045 : 0.06;
          mv.ang = (mv.ang || 0) + 47;
          for (const off of [0, 180]) {
            const a = (mv.ang + off) % 360;
            hShoot(p, { ox: 0, oy: -20, ang: a, dmg: 0.35, silent: off > 0 || Math.random() < 0.5, sp: 460, src: 'skill', skill: 'eve_kata' });
          }
        }
      },
    },
    sk_turret: {
      label: '浮游炮台', dur: 0.36, cancel: 0.24, skill: 'eve_turret',
      keys: [[0, { lean: -6, aF: [-60, -80], w: -80 }], [0.36, { lean: 2 }]],
      ev: [[0.1, p => {
        const lv = p.skillLv('eve_turret');
        for (const z of G.zones) if (z.turret) z.life = 0.01;
        Sound.play('clank', { x: p.x, pitch: 1.2 }); Sound.play('pickup', { x: p.x, pitch: 1.3 });
        addZone({
          x: p.x - p.face * 10, y: p.y - 40, life: lv >= 3 ? 10 : 7, tick: lv >= 3 ? 0.25 : 0.35, turret: true,
          onTick(z) {
            const e = nearestEnemy(z.x, z.y, 240);
            if (!e) return;
            const a = Math.atan2(e.cy - z.y, e.x - z.x);
            z.aim = a;
            const n = lv >= 2 ? 2 : 1;
            for (let i = 0; i < n; i++) {
              const aa = a + (i - (n - 1) / 2) * 0.12;
              const hit = p.makeHit({ dmg: 0.5, kx: 40, ky: -20, stun: 0.15, hs: 0, src: 'skill', skill: 'eve_turret', energy: 0.3 });
              G.projs.push(new Proj({ team: 'p', x: z.x, y: z.y, vx: Math.cos(aa) * 500, vy: Math.sin(aa) * 500, kind: 'bullet', r: 1.4, c: EVE_C2, c2: '#ffffff', life: 0.6, hit, len: 9, light: 0 }));
            }
            Sound.play('shoot', { x: z.x, pitch: 1.5 });
          },
          upd(z, dt) {
            const tx = p.x - p.face * 18, ty = p.y - 44 + Math.sin(z.t * 3) * 3;
            z.x = lerp(z.x, tx, dt * 3); z.y = lerp(z.y, ty, dt * 3);
            Light.add(z.x, z.y, 50, EVE_C2, 0.6);
          },
          drawFn(ctx, gctx, x2, y2, z) {
            ctx.fillStyle = '#2a3048'; ctx.fillRect(Math.round(x2 - 5), Math.round(y2 - 4), 10, 8);
            ctx.fillStyle = '#5a6488'; ctx.fillRect(Math.round(x2 - 5), Math.round(y2 - 4), 10, 2);
            const a = z.aim || 0;
            ctx.strokeStyle = '#c8d0e0'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 + Math.cos(a) * 7, y2 + Math.sin(a) * 7); ctx.stroke();
            ctx.fillStyle = EVE_C2; ctx.fillRect(Math.round(x2 - 1), Math.round(y2 - 1), 2, 2);
            gctx.fillStyle = EVE_C2; gctx.fillRect(Math.round(x2 - 3), Math.round(y2 + 3), 6, 3);
          },
        });
      }]],
    },
    sk_rain: {
      label: '星落弹雨', dur: 1.0, cancel: 0.85, grav: 0, skill: 'eve_rain',
      keys: [
        [0, { lean: 10, lF: [30, 120], lB: [150, 100] }],
        [0.15, { gl: 0, lean: 0, aF: [70, 80], aB: [80, 95], w: 80, w2: 95, lF: [40, 110], lB: [120, 140] }],
        [1.0, { gl: 0, lean: 0, aF: [70, 80], aB: [80, 95], w: 80, w2: 95, lF: [40, 110], lB: [120, 140] }],
      ],
      onStart(p) { p.inv = Math.max(p.inv, 0.6); },
      ev: [
        [0.03, p => { p.vy = -470; Sound.play('jump', { x: p.x, pitch: 0.8 }); }],
        ...Array.from({ length: 14 }, (_, i) => [0.3 + i * 0.035, p => hShoot(p, { ox: rand(-6, 6), oy: -10, ang: rand(55, 125), dmg: 0.42, sp: 560, silent: i % 3 > 0, skill: 'eve_rain', src: 'skill' })]),
        [0.82, p => { if (p.skillLv('eve_rain') >= 3) { const pr = hShoot(p, { ox: 0, oy: -10, ang: 90, dmg: 1.5, r: 4, len: 20, sp: 700, skill: 'eve_rain', src: 'skill', c: EVE_C2 }); pr.onDie = q => explodeP(q.x, q.y, 56, 2.2 * skMul(p, 'eve_rain'), { c: EVE_C2, src: 'skill', shake: 0.4, wx: q.hit.wx }); } }],
      ],
      update(p, mv) {
        if (mv.t > 0.12 && mv.t < 0.3) p.vy *= 0.85;
        else if (mv.t >= 0.3 && mv.t < 0.85) p.vy = Math.min(p.vy + 400 / 60, 40);
        else if (mv.t >= 0.85) p.vy = Math.min(p.vy + 1100 / 60, 400);
        if (p.skillLv('eve_rain') >= 2 && mv.t >= 0.3 && mv.t < 0.8 && Math.random() < 0.35) hShoot(p, { ox: rand(-8, 8), oy: -10, ang: rand(70, 110), dmg: 0.3, sp: 560, silent: true, skill: 'eve_rain', src: 'skill' });
      },
    },

    // =============== ULTIMATE ===============
    ult: {
      label: '湮灭光炮', dur: 2.15, cancel: 99, ult: true, grav: 0, noAtkSpeed: true,
      keys: [
        [0, { lean: -6, ...E_AIM, w2: 5, aB: [5, 5], lF: [60, 105], lB: [120, 95], big: true }],
        [0.4, { lean: -6, ...E_AIM, w2: 5, aB: [5, 5], lF: [60, 105], lB: [120, 95] }],
        [0.45, { lean: -16, aF: [-6, -6], aB: [-2, -2], w: -6, w2: -2, lF: [70, 105], lB: [115, 95] }],
        [2.15, { lean: -10, ...E_AIM, aB: [5, 5], w2: 5 }],
      ],
      onStart(p) { p.vx = 0; p.vy = 0; G.cinematic(0.4); Sound.play('ultCharge'); },
      update(p, mv) {
        if (mv.t < 0.4) {
          const a = rand(0, TAU), r = rand(20, 40);
          FX.add({ k: 'px', x: p.x + p.face * 18 + Math.cos(a) * r, y: p.y - 22 + Math.sin(a) * r, vx: -Math.cos(a) * r * 4, vy: -Math.sin(a) * r * 4, life: 0.22, s: 2, c: pick([EVE_C, EVE_C2, '#ffffff']), glow: true, add: true });
        }
      },
      ev: [[0.42, p => {
        Sound.play('ultBoom'); Sound.play('beam');
        G.dim = 1.6;
        const y = p.y - 22, f = p.face;
        addZone({
          x: p.x + f * 16, y, life: 1.6, tick: 0.07,
          onTick(z) {
            const x0 = f > 0 ? z.x : z.x - 520;
            for (const e of enemiesInRect(x0, y - 20, 520, 40)) hitEnemy(p, e, p.makeHit({ dmg: 0.5, kx: 70, ky: -20, stun: 0.3, hs: 0, dir: f, src: 'ult', energy: 0, sfx: chance(0.3) ? 'hit' : false }));
            Cam.shake(0.12);
          },
          upd(z) {
            z.x = p.x + f * 16;
            Light.add(z.x + f * 120, y, 260, EVE_C, 1);
            if (Math.random() < 0.9) FX.add({ k: 'streak', x: z.x + f * rand(0, 400), y: y + rand(-14, 14), vx: f * rand(600, 1200), vy: 0, life: 0.15, c: pick(['#ffffff', EVE_C, EVE_C2]), len: 0.03 });
          },
          drawFn(ctx, gctx, x, yy, z) {
            const a = Math.min(1, z.life / 0.25) * Math.min(1, z.t / 0.08);
            const w = 30 + Math.sin(z.t * 50) * 3;
            const len = 520, X0 = f > 0 ? x : x - len;
            ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
            ctx.fillStyle = '#ff9a2e'; ctx.fillRect(X0, yy - w / 2, len, w);
            ctx.fillStyle = EVE_C; ctx.fillRect(X0, yy - w / 3, len, w / 1.5);
            ctx.fillStyle = '#ffffff'; ctx.fillRect(X0, yy - w / 7, len, w / 3.5);
            ctx.beginPath(); ctx.arc(x, yy, w * 0.6, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
            gctx.globalAlpha = a; gctx.fillStyle = '#ffb347'; gctx.fillRect(X0, yy - w, len, w * 2); gctx.globalAlpha = 1;
          },
        });
      }]],
    },
  },
};
