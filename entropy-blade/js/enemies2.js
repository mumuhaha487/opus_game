'use strict';
// =====================================================================
//  ENEMIES (2/2) — scene-specific monsters
//   落樱古道  提灯鬼 · 天狗 · 狐火 · 竹林忍   (+ 落武者 / 甲虫 / 爆囊虫)
//   苍雪寒山  雪童子 · 冰蝠 · 霜僧 · 雪狼 · 冰弓手
//   晶渊回廊  晶蛛 · 棱镜                       (+ 浮游眼 / 盾卫 / 角兽)
//   熵能核心  熵影 · 虚触                       (+ 咒术师 / 裂隙兵 / 狙击者)
//   瘴雨沼泽  蛙武者 · 瘴菇 · 萤妖 · 泥鳄       (only its own)
//   黄沙废城  沙蝎 · 秃鹫 · 沙俑 · 沙虫         (only its own)
//   熔铸炉城  焰灵 · 熔蜥 · 铁炮兵 · 锻锤傀儡   (only its own)
// =====================================================================

// ---------------- rig looks ----------------
const TENGU_LOOK = {
  build: BUILDS.normal,
  col: { pants: '#22202c', boot: '#3a2a20', sleeve: '#ece6d8', hand: '#c8443a' },
  stance: { gl: 0, lean: 6, aF: [50, 10], aB: [110, 80], w: -40, lF: [60, 110], lB: [100, 130] },
  runArms: () => ({ aF: [50, 10], aB: [110, 80], w: -40 }),
  preBack(x, J, B, p) {
    // black crow wings
    const fl = Math.sin((p.wave || 0) * TAU) * 14 + (p.wing || 0);
    const base = { x: J.chest.x - J.fw.x * 2, y: J.chest.y - J.fw.y * 2 };
    for (let k = 1; k >= 0; k--) {
      const a0 = -150 + fl + k * 20;
      const tip = _seg(base, a0, 21 - k * 4), mid = _seg(base, a0 + 32, 14 - k * 2);
      vPoly(x, [[base.x, base.y], [tip.x, tip.y], [mid.x, mid.y + 3], [base.x + 2, base.y + 7]], k ? '#2a2236' : '#16121e');
      for (let q = 0; q < 3; q++) vLine(x, base, _seg(base, a0 + 8 + q * 9, 17 - k * 3 - q * 2), 1.2, '#3e3850');
    }
  },
  torso(x, J, B, p) {
    drawTorsoBase(x, J, B, this, p, '#ece6d8', '#b8b0a0');
    for (let k = 0; k < 3; k++) vCirc(x, J.chest.x + J.fw.x * 2.6 - J.up.x * (k * 2.6 - 2.5), J.chest.y + J.fw.y * 2.6 - J.up.y * (k * 2.6 - 2.5), 1.3, '#e8443a');
    vLine(x, { x: J.hip.x - J.fw.x * 3, y: J.hip.y - J.fw.y * 3 }, { x: J.hip.x + J.fw.x * 3, y: J.hip.y + J.fw.y * 3 }, 1.4, '#3a2a30');
  },
  head(x, J, B, p) {
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0, 4.8, '#d8443a');
      vPoly(x, [[3.4, -1.2], [10.5, 0.4], [3.6, 1.4]], '#ea5a4c');
      vPoly(x, [[-4.5, -2.5], [-9.5, -0.5], [-8.5, 4], [-4, 3.5]], '#ece6d8');
      vRect(x, -2.2, -7.4, 4.4, 3, '#16121e');
      vRect(x, 1.4, -2.4, 2.8, 0.9, '#ffffff');
      vRect(x, 2, -1.2, 1.5, 1.3, p.eye ? '#ffd23f' : '#3a1010');
    });
  },
  weapon(x, J, B, p) {
    local(x, J.hF, p.w, () => {
      x.line(-1, 0, 4, 0, 1.2, '#5a3a20');
      x.poly([[4, 0], [8, -5], [14, -4.5], [16.5, 0], [14, 4.5], [8, 5]], '#3a6a3a');
      x.line(5, 0, 15, 0, 0.8, '#7ab05a');
    });
  },
};
const NINJA_LOOK = {
  build: BUILDS.slim,
  col: { pants: '#1e2240', boot: '#141428', sleeve: '#262a4a', hand: '#1a1c30' },
  stance: { lean: 12, aF: [70, 20], aB: [110, 70], w: 160, lF: [60, 110], lB: [120, 98] },
  runArms: s => ({ aF: [150, 170], aB: [160, 175], w: 175 }),
  airArms: { aF: [20, -20], aB: [150, 120], w: -30 },
  back(x, J, B, p) { drawScarf(x, { x: J.neck.x - 1, y: J.neck.y }, p.scarf, 13, p.wave, 2.6, '#c8323a', '#7a1a22'); },
  torso(x, J, B, p) {
    drawTorsoBase(x, J, B, this, p, '#262a4a', '#181a32');
    vLine(x, { x: J.hip.x - J.fw.x * 3, y: J.hip.y - J.fw.y * 3 }, { x: J.hip.x + J.fw.x * 3, y: J.hip.y + J.fw.y * 3 }, 1.4, '#5a4a3a');
    vLine(x, { x: J.chest.x - J.fw.x * 3, y: J.chest.y - 2 }, { x: J.chest.x + J.fw.x * 3, y: J.chest.y + 1 }, 0.8, '#3a3e64');
  },
  head(x, J, B, p) {
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0, 4.8, '#262a4a');
      vRect(x, -0.5, -1.5, 5.4, 2.2, '#d8b8a0');
      vRect(x, 1.6, -1.1, 1.4, 1, p.eye ? '#ffffff' : '#262a4a'); vRect(x, 3.6, -1.1, 1, 1, p.eye ? '#ffffff' : '#262a4a');
      vPoly(x, [[-4, -2], [-8, 0], [-4, 1]], '#c8323a');
    });
  },
  weapon(x, J, B, p) {
    local(x, J.hF, p.w, () => {
      x.line(-2, 0, 1.5, 0, 1.6, '#2a2030');
      x.rect(1.5, -1.2, 1, 2.4, '#8a7a4a');
      x.poly([[2.5, -1], [11, -1.2], [13, 0.2], [11, 1], [2.5, 1]], '#c8d0e0');
    });
  },
};
const MONK_LOOK = {
  build: BUILDS.big,
  col: { pants: '#3a4458', boot: '#2a2420', sleeve: '#5a6880', hand: '#d8b090' },
  stance: { lean: 6, aF: [60, 0], aB: [100, 40], w: -80, lF: [66, 100], lB: [114, 92] },
  runArms: s => ({ aF: [60, 0], aB: [100 - 10 * s, 40], w: -80 }),
  torso(x, J, B, p) {
    drawTorsoBase(x, J, B, this, p, '#5a6880', '#3e4a60');
    vLine(x, { x: J.hip.x + J.fw.x * 4, y: J.hip.y + J.fw.y * 4 }, { x: J.neck.x - J.fw.x * 4, y: J.neck.y - J.fw.y * 4 }, 2.4, '#c8783a');
    vLine(x, { x: J.hip.x - J.fw.x * 5, y: J.hip.y - J.fw.y * 5 + 1 }, { x: J.hip.x + J.fw.x * 5, y: J.hip.y + J.fw.y * 5 + 1 }, 1.6, '#2a2e3e');
  },
  head(x, J, B, p) {
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0.6, 4.6, '#d8b090');
      vRect(x, 1.8, 0, 1.4, 1, p.eye ? '#7fd8ff' : '#5a4030'); vRect(x, 3.8, 0, 1, 1, p.eye ? '#7fd8ff' : '#5a4030');
      // wide straw kasa with snow on the brim
      vPoly(x, [[-10, -1.5], [0, -8], [10, -1.5], [8, -0.5], [-8, -0.5]], '#c8a868');
      vPoly(x, [[-10, -1.5], [0, -8], [10, -1.5], [6, -3], [-6, -3]], '#e8f0fc');
      vLine(x, { x: -6, y: -2 }, { x: 6, y: -2 }, 0.6, '#9a7a48');
    });
  },
  weapon(x, J, B, p) {
    // shakujō: long staff with jingling rings
    local(x, J.hF, p.w, () => {
      x.line(-16, 0, 24, 0, 1.8, '#6a4a2e');
      x.circ(26, 0, 3.2, '#c8d4e8'); x.circ(26, 0, 1.6, '#3a4458');
      x.circ(24, -3, 1.2, '#e8f0ff'); x.circ(24, 3, 1.2, '#e8f0ff');
    });
  },
};
const SHADE_LOOK = {
  build: BUILDS.normal, outline: '#ff3048',
  col: { pants: '#0a0610', boot: '#050208', sleeve: '#0e0a16', hand: '#120a18' },
  stance: { lean: 10, aF: [70, 40], aB: [105, 80], w: 30, lF: [70, 100], lB: [108, 92], scarf: 150 },
  runArms: s => ({ aF: [130, 160], aB: [90 - 40 * s, 40], w: 170 }),
  back(x, J, B, p) { drawScarf(x, { x: J.neck.x - 1, y: J.neck.y + 0.5 }, p.scarf, 15, p.wave, 3, '#3a0a18', '#16040a'); },
  torso(x, J, B, p) {
    drawTorsoBase(x, J, B, this, p, '#0e0a16', '#06040a');
    vLine(x, J.hip, J.neck, 0.8, '#ff3048');
  },
  head(x, J, B, p) {
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0, 5, '#0e0a16');
      vPoly(x, [[4, -1], [5, -4], [2, -6.5], [-3, -6.5], [-8, -5], [-6, -2], [-9, 0], [-5, 2], [-3, 1]], '#16101e');
      vRect(x, 2, -0.6, 1.6, 1.4, '#ff3048'); vRect(x, 4.2, -0.6, 1, 1.4, '#ff3048');
    });
  },
  weapon(x, J, B, p) {
    local(x, J.hF, p.w, () => {
      x.line(-3, 0, 1, 0, 2, '#1a1020');
      x.poly([[1.5, -1], [15, -1.2], [18, 0.4], [15, 1.2], [1.5, 1.1]], '#1a0e22');
      x.line(2, 0.9, 15, 0.9, 0.8, '#ff3048');
    });
  },
};

// ---------------- custom drawers ----------------
function drawFox(x, o) {
  const ph = o.t * TAU, run = o.run;
  const bob = run ? Math.abs(Math.sin(ph)) * 1.5 : Math.sin(ph) * 0.5;
  const cy = -10 - bob + (o.crouch ? 2 : 0) - (o.rear ? 2 : 0);
  for (let k = 0; k < 3; k++) {
    const a0 = (-160 + k * 24 + Math.sin(ph + k) * 12) * DEG;
    let px = -8, py = cy - 1;
    for (let s = 0; s < 6; s++) { const aa = a0 - s * 0.14; px += Math.cos(aa) * 2.5; py += Math.sin(aa) * 2.5; x.circ(px, py, 2.7 - s * 0.15, s > 3 ? '#fff6ea' : '#f0d8b8'); }
    x.circ(px, py, 1.9, o.fire ? '#ffffff' : '#9fd8ff');
  }
  [[-6, 0], [-3, Math.PI], [5, Math.PI * 0.5], [8, Math.PI * 1.5]].forEach(([lx, off], i) => {
    const s = run ? Math.sin(ph + off) : 0;
    x.line(lx, cy + 3, lx + s * 3 - (o.crouch ? 1 : 0), -0.5, 1.8, i % 2 ? '#d8c0a0' : '#f4e8d8');
  });
  x.ell(0, cy, 10, 5, o.rear ? -0.25 : 0, '#f4e8d8');
  x.ell(0, cy + 2, 7, 2.4, 0, '#ffffff');
  x.line(-6, cy - 3, 4, cy - 4, 1, '#e8a050');
  const hx = 10, hy = cy - 4 - (o.rear ? 3 : 0) + (o.bite ? 2 : 0);
  x.circ(hx, hy, 4, '#f4e8d8');
  x.poly([[hx + 2, hy - 1], [hx + 8, hy + (o.bite ? 2 : 1)], [hx + 2, hy + 2]], '#f4e8d8');
  x.poly([[hx - 2, hy - 3], [hx - 1, hy - 9], [hx + 1.5, hy - 3.5]], '#f4e8d8');
  x.poly([[hx + 1, hy - 3.5], [hx + 3, hy - 9], [hx + 4, hy - 3]], '#f4e8d8');
  x.poly([[hx - 1.5, hy - 4], [hx - 1, hy - 7.5], [hx + 0.6, hy - 4]], '#e85a4a');
  x.rect(hx + 1.4, hy - 1.6, 2.4, 1, o.glow ? '#ffffff' : '#e83a3a');
  x.rect(hx + 7.5, hy + 0.6, 1, 1, '#2a1a1a');
}
function drawWolf(x, o) {
  const ph = o.t * TAU, run = o.run;
  const bob = run ? Math.abs(Math.sin(ph)) * 1.6 : Math.sin(ph) * 0.4;
  const cy = -13 - bob + (o.crouch ? 3 : 0);
  const lean = o.leap ? -0.15 : o.howl ? -0.3 : 0;
  [[-9, 0], [-6, Math.PI], [7, Math.PI * 0.5], [10, Math.PI * 1.5]].forEach(([lx, off], i) => {
    const s = run ? Math.sin(ph + off) : 0, col = i % 2 ? '#6a7484' : '#9aa4b4';
    const kx = lx + s * 3, ky = cy + 7;
    x.line(lx, cy + 2, kx, ky, 2.6, col);
    x.line(kx, ky, kx - s * 2 - (o.leap ? 4 : 0), -0.5, 2, col);
  });
  x.save(); x.rotate(lean);
  x.line(-11, cy - 1, -19, cy - 5 + Math.sin(ph * 2) * 2, 3, '#8a94a4');
  x.ell(0, cy, 12, 6.5, 0, '#9aa4b4');
  x.ell(0, cy + 3, 9, 2.6, 0, '#e8eef6');
  for (let k = -8; k <= 4; k += 3) x.poly([[k, cy - 5], [k + 1.5, cy - 8], [k + 3, cy - 5]], '#7a8494');
  const hx = 12, hy = cy - 3 - (o.howl ? 4 : 0);
  x.circ(hx, hy, 4.6, '#9aa4b4');
  x.poly([[hx + 2, hy - 1.5], [hx + 9, hy + (o.howl ? -2 : 0.5)], [hx + 2, hy + 2.5]], '#aab4c4');
  x.poly([[hx - 2.5, hy - 3], [hx - 1, hy - 9], [hx + 1, hy - 3.5]], '#7a8494');
  x.rect(hx + 1.5, hy - 1.5, 2, 1.2, o.glow ? '#ffffff' : '#7fd8ff');
  x.rect(hx + 8, hy + 0.4, 1.2, 1, '#1a1a22');
  x.restore();
}
function drawYuki(x, o) {
  const cy = -7 - (o.hop ? 2 : 0), sq = o.squash || 0;
  x.rect(-3, -1.6, 2, 1.6, '#8a6a42'); x.rect(1, -1.6, 2, 1.6, '#8a6a42');
  x.ell(0, cy, 6.5 * (1 + sq * 0.2), 6.2 * (1 - sq * 0.2), 0, '#f4f8ff');
  x.poly([[-7, cy - 3], [7, cy - 3], [8.5, cy + 5], [-8.5, cy + 5]], '#a8885a');
  for (let k = -7; k <= 7; k += 2.5) x.line(k, cy - 2, k * 1.15, cy + 5, 0.6, '#7a5e3a');
  x.circ(0, cy - 6, 4.4, '#ffffff');
  x.rect(-1.6, cy - 7, 1.2, 1.5, '#1a1a2a'); x.rect(1.6, cy - 7, 1.2, 1.5, '#1a1a2a');
  x.rect(-3, cy - 5, 1.4, 0.9, '#ff9aa8'); x.rect(2.4, cy - 5, 1.4, 0.9, '#ff9aa8');
  x.ell(0, cy - 9.5, 7.5, 1.8, 0, '#c8a868'); x.poly([[-4, cy - 9.5], [0, cy - 14], [4, cy - 9.5]], '#b8985a');
  x.rect(-6, cy - 10.5, 12, 1, '#ffffff');
  if (o.throwing) { x.line(3, cy - 2, 6, cy - 10, 1.6, '#a8885a'); x.circ(6.5, cy - 11, 2.2, '#ffffff'); }
}
function drawBat(x, o) {
  const cy = -8, f = Math.sin(o.t * TAU), dive = o.dive;
  const wy = dive ? -3 : f * 5;
  const wl = dive ? 6 : 10;
  x.poly([[0, cy], [-wl, cy - 3 - wy], [-wl + 3, cy + 1 - wy * 0.3], [-4, cy + 2]], '#7fb8e8');
  x.poly([[0, cy], [wl, cy - 3 - wy], [wl - 3, cy + 1 - wy * 0.3], [4, cy + 2]], '#9fd0f4');
  x.line(-wl, cy - 3 - wy, -2, cy, 0.8, '#dff4ff'); x.line(wl, cy - 3 - wy, 2, cy, 0.8, '#dff4ff');
  x.ell(0, cy, 3, 3.6, 0, '#e8f2ff');
  x.poly([[-2, cy - 3], [-2.5, cy - 6], [-0.5, cy - 3.5]], '#dff4ff'); x.poly([[2, cy - 3], [2.5, cy - 6], [0.5, cy - 3.5]], '#dff4ff');
  x.rect(-1.6, cy - 1, 1.2, 1.2, o.glow ? '#ffffff' : '#2a8ad8'); x.rect(0.6, cy - 1, 1.2, 1.2, o.glow ? '#ffffff' : '#2a8ad8');
}
function drawSpider(x, o) {
  const ph = o.t * TAU, walk = o.walk;
  const cy = -7 - (o.leap ? 2 : 0) - (o.rear ? 2 : 0);
  for (let i = 0; i < 4; i++) {
    const lx = -5 + i * 3.5, s = walk ? Math.sin(ph + i * 1.6) : 0, out = i < 2 ? -1 : 1;
    const kx = lx + out * 5, ky = cy - 5 - Math.abs(s) * 1.5;
    x.line(lx, cy, kx, ky, 1.3, '#2a2040'); x.line(kx, ky, kx + out * 3 + s * 1.5, -0.5, 1.1, '#3a2e58');
  }
  x.ell(-6, cy - 1 - (o.rear ? 1 : 0), 7, 5.5, o.rear ? -0.3 : 0, '#3a2a5a');
  x.poly([[-10, cy - 4], [-8, cy - 11], [-6, cy - 5]], '#45f0ff'); x.poly([[-6, cy - 5], [-3, cy - 12], [-2, cy - 4]], '#b28cff');
  x.poly([[-4, cy - 5], [-2, cy - 9], [-1, cy - 4]], '#7ff7ff');
  x.ell(4, cy, 4.6, 3.6, 0, '#4a3a6a');
  x.rect(6, cy - 1.6, 1.2, 1.2, '#45f0ff'); x.rect(7.6, cy - 0.6, 1, 1, '#45f0ff'); x.rect(5.6, cy + 0.4, 1, 1, o.glow ? '#ffffff' : '#45f0ff');
  x.line(8, cy + 1.5, 9.5, cy + 3.5, 0.9, '#bff8ff');
}
function drawPrism(x, o) {
  const t = o.t, ch = o.charge || 0;
  x.rect(-10, -4, 20, 4, '#1a2a44'); x.rect(-8, -6, 16, 2, '#24385a');
  x.poly([[-6, -5], [-4.5, -34], [0, -43], [4.5, -34], [6, -5]], '#2a5a8a');
  x.poly([[0, -43], [4.5, -34], [6, -5], [1, -5]], '#5ad8f0');
  x.poly([[-6, -5], [-4.5, -34], [-2.5, -30], [-3.5, -5]], '#1c3a62');
  x.circ(0, -22, 3 + ch * 1.6, ch > 0.5 ? '#ffffff' : '#7ff7ff');
  for (let k = 0; k < 3; k++) {
    const a = t * TAU + k * TAU / 3, sx = Math.cos(a) * 11, sy = -24 + Math.sin(a) * 4;
    x.poly([[sx, sy - 3], [sx + 1.6, sy], [sx, sy + 3], [sx - 1.6, sy]], Math.sin(a) > 0 ? '#bff8ff' : '#45a8d8');
  }
}
function drawTentacle(x, o) {
  const H = 46 * (o.h === undefined ? 1 : o.h), n = 9, bend = o.bend || 0;
  x.ell(0, 0, 9, 2.2, 0, '#1a0a14');
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const sx = Math.sin(o.t * TAU + u * 3) * 4 * u + bend * u * u * 30;
    const sy = -u * H + bend * u * u * 24;
    const r = 6 - u * 4;
    x.circ(sx, sy, r, i % 2 ? '#3a1030' : '#4e1a42');
    if (i % 2 === 0 && i > 0) x.circ(sx + r * 0.4, sy, 1.1, o.glow ? '#ffffff' : '#ff3048');
  }
}

// ---------------- baking ----------------
function bakeEnemies2() {
  const rig = (name, L, extra, w, h, ox, oy) => bakeRig(name, L, Object.assign({
    idle: { n: 4, gen: 'idle', loop: true, fps: 6 }, walk: { n: 8, gen: 'run', loop: true, fps: 12 }, hurt: { n: 1, gen: 'hurt' }, fall: { n: 1, gen: 'fall' },
  }, extra), w, h, ox, oy);
  const hover = (L, t) => fullPose(L, { wave: t, y: Math.sin(t * TAU) * 1.2 });
  rig('tengu', TENGU_LOOK, {
    idle: { n: 6, loop: true, fps: 10, gen: hover }, walk: { n: 6, loop: true, fps: 10, gen: hover },
    wind: { n: 2, loop: true, fps: 8, gen: (L, t) => fullPose(L, { lean: -8, aF: [-130, -150], w: -165, wave: t, wing: -10 }) },
    fan: { n: 3, fps: 18, gen: (L, t) => fullPose(L, { lean: lerp(-6, 22, t), aF: [lerp(-120, 30, t), lerp(-140, 40, t)], w: lerp(-160, 40, t), wave: 0.25, wing: 10 }) },
    dive: { n: 2, loop: true, fps: 14, gen: (L, t) => fullPose(L, { lean: 55, aF: [150, 170], aB: [160, 175], w: 170, lF: [140, 160], lB: [150, 170], wave: t * 0.3, wing: 34 }) },
  });
  rig('ninja', NINJA_LOOK, {
    wind: { n: 1, gen: L => fullPose(L, { lean: 26, aF: [150, 120], w: 130, lF: [25, 120], lB: [150, 104] }) },
    throw: { n: 2, fps: 14, gen: (L, t) => fullPose(L, { lean: lerp(10, 22, t), aF: [lerp(-60, 0, t), lerp(-90, -10, t)], w: lerp(-120, -10, t), lF: [50, 100], lB: [125, 98] }) },
    slash: { n: 3, fps: 20, gen: (L, t) => fullPose(L, { lean: lerp(4, 26, t), aF: [lerp(-80, 50, t), lerp(-60, 70, t)], w: lerp(-80, 90, t), lF: [40, 98], lB: [135, 100] }) },
    flip: { n: 2, loop: true, fps: 10, gen: (L, t) => fullPose(L, { gl: 0, lean: -40 - t * 120, aF: [60, 20], aB: [100, 60], lF: [10, 100], lB: [40, 120] }) },
  });
  rig('monk', MONK_LOOK, {
    wind: { n: 1, gen: L => fullPose(L, { lean: -10, aF: [-140, -150], aB: [-120, -130], w: -170 }) },
    sweep: { n: 3, fps: 18, gen: (L, t) => fullPose(L, { lean: lerp(-6, 24, t), aF: [lerp(-120, 30, t), lerp(-110, 40, t)], aB: [lerp(-100, 40, t), lerp(-90, 50, t)], w: lerp(-160, 20, t), lF: [40, 100], lB: [130, 100] }) },
    slamw: { n: 1, gen: L => fullPose(L, { lean: -14, aF: [-110, -95], aB: [-100, -90], w: -95 }) },
    slam: { n: 1, gen: L => fullPose(L, { lean: 34, aF: [70, 90], aB: [80, 95], w: 90, lF: [30, 120], lB: [150, 110] }) },
    spin: { n: 4, loop: true, fps: 16, gen: (L, t) => fullPose(L, { lean: 4, aF: [20, 0], aB: [40, 10], w: t * 360, lF: [62, 100], lB: [116, 92] }) },
  }, 96, 72, 48, 64);
  rig('shade', SHADE_LOOK, {
    wind: { n: 1, gen: L => fullPose(L, { lean: 30, aF: [140, 170], aB: [120, 160], w: 180, lF: [25, 115], lB: [150, 110] }) },
    slash: { n: 3, fps: 22, gen: (L, t) => fullPose(L, { lean: lerp(20, 40, t), aF: [lerp(140, -10, t), lerp(170, 0, t)], w: lerp(180, -10, t), lF: [15, 86], lB: [155, 145] }) },
    slash2: { n: 3, fps: 22, gen: (L, t) => fullPose(L, { lean: lerp(30, 6, t), aF: [lerp(40, -80, t), lerp(50, -95, t)], w: lerp(60, -100, t), lF: [60, 100], lB: [115, 95] }) },
  });
  bakeCustom('kitsune', 44, 34, 20, 32, {
    idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawFox(x, { t }) },
    walk: { n: 6, loop: true, fps: 14, draw: (x, t) => drawFox(x, { t, run: true }) },
    cast: { n: 2, loop: true, fps: 10, draw: (x, t, i) => drawFox(x, { t, rear: true, fire: i === 0 }) },
    bite: { n: 1, draw: x => drawFox(x, { t: 0.2, crouch: true, bite: true, glow: true }) },
    hurt: { n: 1, draw: x => drawFox(x, { t: 0.1, crouch: true }) },
  });
  bakeCustom('wolf', 56, 36, 26, 34, {
    idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawWolf(x, { t }) },
    walk: { n: 6, loop: true, fps: 14, draw: (x, t) => drawWolf(x, { t, run: true }) },
    crouch: { n: 2, loop: true, fps: 12, draw: (x, t, i) => drawWolf(x, { t, crouch: true, glow: i === 0 }) },
    leap: { n: 1, draw: x => drawWolf(x, { t: 0.3, leap: true, run: true }) },
    howl: { n: 2, loop: true, fps: 6, draw: (x, t) => drawWolf(x, { t, howl: true }) },
    hurt: { n: 1, draw: x => drawWolf(x, { t: 0, crouch: true }) },
  });
  bakeCustom('yukiko', 28, 28, 14, 26, {
    idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawYuki(x, { t, squash: Math.max(0, Math.sin(t * TAU)) * 0.4 }) },
    hop: { n: 1, draw: x => drawYuki(x, { t: 0, hop: true, squash: -0.3 }) },
    throw: { n: 2, loop: true, fps: 8, draw: (x, t, i) => drawYuki(x, { t, throwing: true, squash: i * 0.2 }) },
    hurt: { n: 1, draw: x => drawYuki(x, { t: 0, squash: 0.5 }) },
  });
  bakeCustom('icebat', 28, 22, 14, 16, {
    idle: { n: 4, loop: true, fps: 14, draw: (x, t) => drawBat(x, { t }) },
    dive: { n: 1, draw: x => drawBat(x, { t: 0, dive: true, glow: true }) },
    hurt: { n: 1, draw: x => drawBat(x, { t: 0.25 }) },
  });
  bakeCustom('spider', 40, 28, 20, 26, {
    idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawSpider(x, { t }) },
    walk: { n: 6, loop: true, fps: 14, draw: (x, t) => drawSpider(x, { t, walk: true }) },
    spit: { n: 2, loop: true, fps: 12, draw: (x, t, i) => drawSpider(x, { t, rear: true, glow: i === 0 }) },
    leap: { n: 1, draw: x => drawSpider(x, { t: 0.4, leap: true, walk: true }) },
    hurt: { n: 1, draw: x => drawSpider(x, { t: 0 }) },
  });
  bakeCustom('prism', 36, 52, 18, 50, {
    idle: { n: 8, loop: true, fps: 8, draw: (x, t) => drawPrism(x, { t }) },
    charge: { n: 4, loop: true, fps: 14, draw: (x, t, i) => drawPrism(x, { t, charge: i % 2 }) },
    hurt: { n: 1, draw: x => drawPrism(x, { t: 0, charge: 1 }) },
  });
  bakeCustom('tentacle', 48, 64, 18, 60, {
    idle: { n: 6, loop: true, fps: 8, draw: (x, t) => drawTentacle(x, { t }) },
    rise: { n: 4, fps: 12, draw: (x, t) => drawTentacle(x, { t: 0, h: 0.25 + t * 0.75 }) },
    sink: { n: 4, fps: 10, draw: (x, t) => drawTentacle(x, { t: 0, h: 1 - t * 0.8 }) },
    slam: { n: 3, fps: 14, draw: (x, t) => drawTentacle(x, { t: 0, bend: t, glow: true }) },
    hurt: { n: 1, draw: x => drawTentacle(x, { t: 0.1, glow: true }) },
  });
  bakeMapMonsters();
}

// ---------------- shared hazards ----------------
function firePatch(e, x, y) {
  if (y > G.room.ph - 2) return;
  Sound.play('fire', { x });
  addZone({
    x, y, life: 2.4, tick: 0.45,
    onTick(z) { const p = G.player; if (p && !p.dead && Math.abs(p.x - z.x) < 18 && p.y > z.y - 6 && p.y < z.y + 4) hurtPlayer(e.D.dmg * 0.6 * e.dmgMul, z.x, { noStagger: true }); },
    upd(z) { if (Math.random() < 0.7) FX.fire(z.x + rand(-14, 14), z.y - 1, 1); Light.add(z.x, z.y - 6, 60, '#ff8a3a', 0.6); },
  });
}
function icePillar(e, x) {
  const gy = G.room.floorBelow(x, e.y - 30);
  if (Math.abs(gy - e.y) > 50 || x < 2.5 * TILE || x > G.room.pw - 2.5 * TILE) return;
  FX.circle(x, gy, 9, '#bfe6ff', 0.35, { sy: 0.4, a: 0.6, pulse: true, layer: 0 });
  later(0.35, () => {
    Sound.play('shatter', { x, pitch: 1.4 });
    FX.customDraw(x, gy, 0.55, (ctx, gctx, X, Y, t) => {
      const h = 32 * (t < 0.15 ? t / 0.15 : 1) * (t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1);
      ctx.fillStyle = '#9fc8ec'; ctx.beginPath(); ctx.moveTo(X - 7, Y); ctx.lineTo(X - 1, Y - h); ctx.lineTo(X + 6, Y); ctx.fill();
      ctx.fillStyle = '#eef8ff'; ctx.beginPath(); ctx.moveTo(X - 1, Y); ctx.lineTo(X - 1, Y - h); ctx.lineTo(X + 2, Y); ctx.fill();
      gctx.fillStyle = '#9fd8ff'; gctx.globalAlpha = 0.6; gctx.fillRect(X - 4, Y - h, 8, h); gctx.globalAlpha = 1;
    });
    Combat.area('e', x - 7, gy - 32, 14, 32, { dmg: e.D.dmg * 0.8 * e.dmgMul, chill: 1.5 }, 0.25, { owner: e });
  });
}

// ---------------- definitions ----------------
Object.assign(ENEMY_DEFS, {
  lantern: { name: '提灯鬼', hp: 36, w: 16, h: 18, speed: 70, kb: 1.2, poise: 0, gold: [3, 5], dmg: 10, spr: 'drone0', cost: 2, flying: true },
  tengu: { name: '天狗', hp: 58, w: 14, h: 28, speed: 110, kb: 1, poise: 0, gold: [4, 7], dmg: 13, spr: 'tengu', cost: 2.6, flying: true },
  kitsune: {
    name: '狐火', hp: 52, w: 20, h: 16, speed: 120, kb: 1.1, poise: 0, gold: [4, 7], dmg: 12, spr: 'kitsune', cost: 2.4,
    // 幻身: sometimes melts into foxfire instead of flinching
    preHurt(e) { if (!['vanish', 'appear'].includes(e.state) && G.time - (e.lastBlink || -9) > 3 && chance(0.3)) { e.lastBlink = G.time; FX.burst(e.x, e.cy, { n: 14, c: ['#9fd8ff', '#ffffff'], sp: [30, 110], glow: true }); FX.text(e.x, e.y - e.h - 8, '幻身', '#9fd8ff', { size: 8 }); e.cancelAttack(); e.setState('vanish', 'idle'); Sound.play('teleport', { x: e.x, pitch: 1.5 }); return true; } return false; },
  },
  ninja: { name: '竹林忍', hp: 46, w: 12, h: 28, speed: 112, kb: 1.1, poise: 0, gold: [4, 6], dmg: 12, spr: 'ninja', cost: 2.2 },
  yukiko: { name: '雪童子', hp: 26, w: 12, h: 14, speed: 60, kb: 1.4, poise: 0, gold: [2, 4], dmg: 8, spr: 'yukiko', cost: 1.2, onDeath(e) { FX.burst(e.x, e.cy, { n: 16, c: ['#ffffff', '#dff4ff', '#a8885a'], sp: [30, 120], g: 200, life: [0.3, 0.7] }); } },
  icebat: { name: '冰蝠', hp: 20, w: 14, h: 12, speed: 120, kb: 1.4, poise: 0, gold: [2, 3], dmg: 9, spr: 'icebat', cost: 0.9, flying: true },
  monk: { name: '霜僧', hp: 165, w: 20, h: 34, speed: 38, kb: 0.4, poise: 8, gold: [7, 11], dmg: 18, spr: 'monk', cost: 4 },
  wolf: { name: '雪狼', hp: 62, w: 26, h: 18, speed: 108, kb: 0.9, poise: 0, gold: [4, 7], dmg: 13, spr: 'wolf', cost: 2 },
  spider: {
    name: '晶蛛', hp: 54, w: 22, h: 14, speed: 78, kb: 1.1, poise: 0, gold: [4, 6], dmg: 11, spr: 'spider', cost: 2.2,
    // 碎晶: bursts into crystal shards on death
    onDeath(e) { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.45; e.shot(e.x, e.cy - 4, a, 150, { kind: 'shard', r: 2.5, c: '#7ff7ff', c2: '#ffffff', life: 0.9, grav: 300, dmg: e.D.dmg * 0.5 }); } Sound.play('shatter', { x: e.x }); },
  },
  prism: { name: '棱镜', hp: 130, w: 16, h: 40, speed: 0, kb: 0, poise: 99, gold: [6, 9], dmg: 16, spr: 'prism', cost: 3.2 },
  shade: {
    name: '熵影', hp: 74, w: 14, h: 30, speed: 92, kb: 1, poise: 0, gold: [5, 8], dmg: 14, spr: 'shade', cost: 2.8,
    // 裂影: splits off a weaker copy once when wounded
    preHurt(e) {
      if (e.copy || e.split || e.hp > e.maxHp * 0.6 || !chance(0.6)) return false;
      e.split = true;
      const m = new Enemy('shade', clamp(e.x - e.face * 24, 3 * TILE, G.room.pw - 3 * TILE), e.y, { noSpawn: true });
      m.copy = true; m.hp = m.maxHp = Math.round(e.maxHp * 0.4); m.cd = 0.8; m.face = e.face;
      G.enemies.push(m);
      FX.burst(m.x, m.cy, { n: 16, c: ['#ff3048', '#000000', '#ffd0d8'], sp: [30, 120], glow: true });
      FX.text(e.x, e.y - e.h - 8, '裂影', '#ff3048', { size: 8 });
      Sound.play('void', { x: e.x, pitch: 1.4 });
      return false;
    },
  },
  tentacle: { name: '虚触', hp: 84, w: 16, h: 44, speed: 0, kb: 0, poise: 99, gold: [5, 8], dmg: 16, spr: 'tentacle', cost: 3 },
});

// ---------------- AI ----------------
Object.assign(AI, {
  // 提灯鬼: lobs fireballs that leave burning ground
  lantern(e, dt) {
    const t = e.toTarget(), p = t.p;
    const side = e.x < p.x ? -1 : 1;
    const tx = p.x + side * 80, ty = p.y - 64 + Math.sin(G.time * 1.6 + e.id) * 12;
    e.faceTarget();
    switch (e.state) {
      case 'idle':
        e.vx = approach(e.vx, clamp((tx - e.x) * 1.6, -e.D.speed, e.D.speed) * e.speedMul, 240 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 1.6, -70, 70), 240 * dt);
        e.setAnim('idle');
        if (e.cd <= 0 && G.room.los(e.x, e.cy, p.x, p.cy)) { e.setState('aim', 'aim'); e.telegraph(0.55); }
        break;
      case 'aim':
        e.vx = approach(e.vx, 0, 300 * dt); e.vy = approach(e.vy, 0, 300 * dt);
        if (e.stT > 0.55) {
          const T = 0.8, dx = p.x - e.x;
          const pr = e.shot(e.x + e.face * 6, e.cy, 0, 0, { kind: 'fireball', r: 3.5, grav: 520, life: 3, light: 50 });
          pr.vx = dx / T; pr.vy = (p.y - 4 - e.cy - 0.5 * 520 * T * T) / T;
          pr.onDie = q => firePatch(e, q.x, G.room.floorBelow(q.x, q.y - 10));
          Sound.play('fire', { x: e.x, pitch: 1.2 });
          e.setState('idle', 'idle'); e.cd = rand(2.2, 3.0);
        }
        break;
      default: e.setState('idle', 'idle');
    }
  },
  // 天狗: gale fan that shoves you away, and diving kicks
  tengu(e, dt) {
    const t = e.toTarget(), p = t.p;
    const side = e.x < p.x ? -1 : 1;
    switch (e.state) {
      case 'idle': {
        e.faceTarget();
        const tx = p.x + side * 110, ty = p.y - 80 + Math.sin(G.time * 2 + e.id) * 14;
        e.vx = approach(e.vx, clamp((tx - e.x) * 1.8, -e.D.speed, e.D.speed) * e.speedMul, 260 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 1.8, -90, 90), 260 * dt);
        e.setAnim('idle');
        if (e.cd <= 0) {
          if (chance(0.5) && t.d < 220) { e.setState('dwind', 'wind'); e.telegraph(0.55); e.tx = p.x; e.ty = p.y - 10; }
          else { e.setState('fwind', 'wind'); e.telegraph(0.45); }
        }
        break;
      }
      case 'fwind':
        e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, 0, 400 * dt); e.faceTarget();
        if (e.stT > 0.45) {
          e.setState('fan', 'fan');
          const a = Math.atan2(p.cy - e.cy, p.x - e.x);
          e.shot(e.x + e.face * 10, e.cy, a, 210, { kind: 'wave', r: 6, hh: 12, c: '#c8ffe8', c2: '#ffffff', ghost: true, life: 2.2, push: 280, light: 50 });
          FX.slash(e.x + e.face * 8, e.cy, { r: 18, a0: -100, a1: 80, th: 5, c: '#c8ffe8', f: e.face, dur: 0.2 });
          Sound.play('swoosh', { x: e.x, pitch: 0.7 });
        }
        break;
      case 'fan':
        if (e.stT > 0.4) { e.setState('idle', 'idle'); e.cd = rand(1.8, 2.6); }
        break;
      case 'dwind':
        e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, -30, 400 * dt); e.faceTarget();
        e.tx = lerp(e.tx, p.x, 0.06); e.ty = lerp(e.ty, p.y - 10, 0.06);
        if (e.stT > 0.55) {
          e.setState('dive', 'dive');
          const a = Math.atan2(e.ty - e.cy, e.tx - e.x);
          e.vx = Math.cos(a) * 370; e.vy = Math.sin(a) * 370; e.face = sign(e.vx) || e.face;
          e.dbox = e.attackBox([-10, -18, 22, 20], e.D.dmg, 0.6);
          Sound.play('dash', { x: e.x, pitch: 1.2 });
        }
        break;
      case 'dive':
        if (Math.random() < 0.6) FX.ghost(e.frame(), e.spr.ox, e.spr.oy, e.x, e.y, e.face < 0, '#c8ffe8', 0.2, 0.4);
        if (e.stT > 0.55 || e.onGround || e.hitWall) { if (e.dbox) e.dbox.life = 0; e.setState('rise', 'idle'); e.vy = -170; e.vx *= 0.3; }
        break;
      case 'rise':
        e.vy = approach(e.vy, -50, 300 * dt); e.vx = approach(e.vx, 0, 200 * dt);
        if (e.stT > 0.7) { e.setState('idle', 'idle'); e.cd = rand(1.6, 2.4); }
        break;
      default: e.setState('idle', 'idle');
    }
  },
  // 狐火: orbiting foxfire volleys, vanishing ambush bites
  kitsune(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget(); e.blink = 0; e.intangible = false;
        const dir = t.d < 90 ? -e.face : t.d > 150 ? e.face : 0;
        const can = dir === 0 || groundAhead(e, dir, G.room);
        e.vx = approach(e.vx, can ? dir * e.D.speed * e.speedMul : 0, 500 * dt);
        e.setAnim(Math.abs(e.vx) > 6 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround) {
          if (chance(0.55)) { e.setState('fire', 'cast'); e.telegraph(0.5); e.wn = 0; Sound.play('fire', { x: e.x, pitch: 1.8 }); }
          else { e.setState('vanish', 'idle'); Sound.play('teleport', { x: e.x, pitch: 1.5 }); }
        }
        break;
      }
      case 'fire':
        e.vx = approach(e.vx, 0, 600 * dt); e.faceTarget();
        if (e.stT > 0.7 + e.wn * 0.24 && e.wn < 3) {
          const k = e.wn++;
          const ox = e.x + Math.cos(G.time * 6 + k * 2.1) * 12, oy = e.cy - 12 + Math.sin(G.time * 6 + k * 2.1) * 6;
          const a = Math.atan2(p.cy - oy, p.x - ox) + (k - 1) * 0.3;
          e.shot(ox, oy, a, 125, { kind: 'orb', r: 3.5, c: '#9fd8ff', c2: '#ffffff', homing: 1.7, life: 3.2, light: 60 });
          Sound.play('fire', { x: e.x, pitch: 1.6 });
        }
        if (e.stT > 1.6) { e.setState('walk', 'idle'); e.cd = rand(1.8, 2.6); }
        break;
      case 'vanish':
        e.blink = Math.max(0.05, 1 - e.stT / 0.3); e.intangible = true; e.vx = 0;
        if (e.stT > 0.3) {
          const side = -(p.face || 1);
          e.x = clamp(p.x + side * 36, 3 * TILE, G.room.pw - 3 * TILE);
          e.y = G.room.floorBelow(e.x, p.y - 20); e.vy = 0;
          e.face = sign(p.x - e.x) || 1;
          FX.burst(e.x, e.cy, { n: 16, c: ['#9fd8ff', '#ffffff'], sp: [30, 110], glow: true });
          e.setState('appear', 'cast'); e.telegraph(0.32);
        }
        break;
      case 'appear':
        e.blink = Math.max(0.05, Math.min(1, e.stT / 0.15)); e.intangible = false;
        if (e.stT > 0.34) { e.blink = 0; e.setState('bite', 'bite'); e.vx = e.face * 210; e.attackBox([-4, -16, 26, 16], e.D.dmg, 0.15); Sound.play('slash', { x: e.x, pitch: 1.5 }); }
        break;
      case 'bite':
        e.vx = approach(e.vx, 0, 700 * dt);
        if (e.stT > 0.45) { e.setState('walk', 'idle'); e.cd = rand(1.4, 2.2); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 竹林忍: kunai fans, smoke-bomb ambushes, dodges your swings
  ninja(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget(); e.blink = 0; e.intangible = false;
        if (p.state === 'move' && t.d < 48 && Math.abs(t.dy) < 30 && e.onGround && G.time - (e.evadeT || -9) > 2.4 && chance(0.4)) {
          e.evadeT = G.time; e.setState('flip', 'flip'); e.vy = -290; e.vx = -e.face * 170; Sound.play('jump', { x: e.x, pitch: 1.4 }); break;
        }
        const dir = t.d > 130 ? e.face : t.d < 60 ? -e.face : 0;
        const can = dir === 0 || canWalk(e, dir, G.room);
        e.vx = approach(e.vx, can ? dir * e.D.speed * e.speedMul : 0, 700 * dt);
        e.setAnim(Math.abs(e.vx) > 6 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround) {
          if (t.d < 190 && chance(0.55)) { e.setState('kwind', 'wind'); e.telegraph(0.35); }
          else { e.setState('smoke', 'wind'); e.puffed = false; }
        }
        break;
      }
      case 'kwind':
        e.vx = 0; e.faceTarget();
        if (e.stT > 0.35) {
          const a = Math.atan2(p.cy - (e.y - 20), p.x - e.x);
          for (const da of [-0.16, 0, 0.16]) e.shot(e.x + e.face * 8, e.y - 20, a + da, 300, { kind: 'shard', r: 2, c: '#c8d0e0', c2: '#ffffff', life: 1.4, dmg: e.D.dmg * 0.7 });
          Sound.play('swoosh', { x: e.x, pitch: 1.6 });
          e.setState('throw', 'throw');
        }
        break;
      case 'throw':
        if (e.stT > 0.35) { e.setState('walk', 'idle'); e.cd = rand(1.4, 2.2); }
        break;
      case 'smoke':
        e.vx = 0;
        if (!e.puffed) { e.puffed = true; FX.burst(e.x, e.cy, { n: 24, c: ['#8a8aa0', '#c8c8d8', '#5a5a70'], sp: [20, 90], life: [0.4, 0.8], s: [2, 4] }); Sound.play('void', { x: e.x, pitch: 1.8 }); }
        e.blink = Math.max(0.05, 1 - e.stT / 0.25); e.intangible = e.stT > 0.1;
        if (e.stT > 0.5) {
          const side = -(p.face || 1);
          e.x = clamp(p.x + side * 30, 3 * TILE, G.room.pw - 3 * TILE);
          e.y = G.room.floorBelow(e.x, p.y - 20); e.vy = 0;
          e.face = sign(p.x - e.x) || 1;
          FX.burst(e.x, e.cy, { n: 18, c: ['#8a8aa0', '#c8c8d8'], sp: [20, 80], life: [0.3, 0.6], s: [2, 3] });
          e.blink = 0; e.intangible = false;
          e.setState('ambush', 'wind'); e.telegraph(0.28);
        }
        break;
      case 'ambush':
        e.vx = 0;
        if (e.stT > 0.28) {
          e.setState('slash', 'slash'); e.vx = e.face * 160;
          e.attackBox([-2, -32, 34, 30], e.D.dmg, 0.12);
          FX.slash(e.x + e.face * 6, e.y - 18, { r: 18, a0: -110, a1: 70, th: 5, c: '#c8d0e0', f: e.face, dur: 0.16 });
          Sound.play('slash', { x: e.x, pitch: 1.1 });
        }
        break;
      case 'slash':
        e.vx = approach(e.vx, 0, 900 * dt);
        if (e.stT > 0.4) { e.setState('walk', 'idle'); e.cd = rand(1.2, 2.0); }
        break;
      case 'flip':
        if (e.onGround && e.stT > 0.15) { e.setState('walk', 'idle'); e.cd = Math.min(e.cd, 0.3); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 雪童子: hops about lobbing chilling snowballs
  yukiko(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (e.onGround) {
          e.vx = approach(e.vx, 0, 800 * dt);
          e.hopT = (e.hopT === undefined ? rand(0.3, 0.7) : e.hopT) - dt;
          if (e.hopT <= 0) {
            e.hopT = rand(0.5, 0.9);
            const dir = t.d < 70 ? -e.face : t.d > 160 ? e.face : (chance(0.5) ? 1 : -1);
            if (groundAhead(e, dir, G.room) || chance(0.3)) { e.vy = -220; e.vx = dir * 90 * e.speedMul; Sound.play('jump', { x: e.x, pitch: 1.8 }); }
          }
        }
        e.setAnim(e.onGround ? 'idle' : 'hop');
        if (e.cd <= 0 && e.onGround) { e.setState('wind', 'throw'); e.telegraph(0.35); }
        break;
      }
      case 'wind':
        e.vx = 0; e.faceTarget();
        if (e.stT > 0.35) {
          const n = chance(0.4) ? 2 : 1;
          for (let i = 0; i < n; i++) {
            const T = 0.65 + i * 0.14, dx = p.x - e.x + rand(-12, 12);
            const pr = e.shot(e.x + e.face * 4, e.y - 14, 0, 0, { kind: 'orb', r: 3, c: '#ffffff', c2: '#dff4ff', grav: 600, life: 3, chill: 1.4, light: 20 });
            pr.vx = dx / T; pr.vy = (p.cy - (e.y - 14) - 0.5 * 600 * T * T) / T;
            pr.onDie = q => FX.burst(q.x, q.y, { n: 8, c: ['#ffffff', '#dff4ff'], sp: [30, 90], life: [0.2, 0.4] });
          }
          Sound.play('swoosh', { x: e.x, pitch: 1.6 });
          e.setState('rec', 'idle');
        }
        break;
      case 'rec':
        if (e.stT > 0.4) { e.setState('walk', 'idle'); e.cd = rand(1.6, 2.4); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 冰蝠: circling swarm that swoops through you
  icebat(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': {
        e.ang = (e.ang === undefined ? rand(0, TAU) : e.ang) + dt * 1.7;
        const tx = p.x + Math.cos(e.ang) * 90, ty = p.y - 72 + Math.sin(e.ang * 2) * 18;
        e.vx = approach(e.vx, clamp((tx - e.x) * 2, -e.D.speed, e.D.speed) * e.speedMul, 320 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 2, -100, 100), 320 * dt);
        e.faceTarget(); e.setAnim('idle');
        if (e.cd <= 0) { e.setState('aim', 'idle'); e.telegraph(0.4); }
        break;
      }
      case 'aim':
        e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, -30, 400 * dt); e.faceTarget();
        if (e.stT > 0.4) { e.setState('swoop', 'dive'); e.sw = sign(p.x - e.x) || e.face; e.face = e.sw; e.sbox = e.attackBox([-8, -14, 16, 14], e.D.dmg, 1.0, { chill: 0.9 }); Sound.play('swoosh', { x: e.x, pitch: 1.8 }); }
        break;
      case 'swoop': {
        const k = clamp(e.stT / 0.9, 0, 1);
        e.vx = e.sw * 230 * e.speedMul; e.vy = lerp(270, -270, k);
        if (e.stT > 0.9 || e.hitWall) { if (e.sbox) e.sbox.life = 0; e.setState('idle', 'idle'); e.cd = rand(1.6, 2.6); }
        break;
      }
      default: e.setState('idle', 'idle');
    }
  },
  // 霜僧: wide staff sweeps, ice-pillar lines, a guarding staff whirl
  monk(e, dt) {
    const t = e.toTarget(), p = t.p;
    const sweep = () => {
      e.setState('sweep', 'sweep');
      e.attackBox([-24, -42, 78, 42], e.D.dmg, 0.16, { chill: 0.8 });
      FX.slash(e.x + e.face * 10, e.y - 20, { r: 40, a0: -150, a1: 40, th: 8, c: '#bfe6ff', f: e.face, dur: 0.24, sy: 0.6 });
      Sound.play('slashHeavy', { x: e.x, pitch: 0.7 }); Cam.shake(0.15);
    };
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (e.cd <= 0) {
          const r = Math.random();
          if (t.d < 58 && Math.abs(t.dy) < 34 && r < 0.5) { e.setState('swind', 'wind'); e.telegraph(0.6); e.vx = 0; break; }
          if (t.d < 230 && Math.abs(t.dy) < 50 && r < 0.82) { e.setState('pwind', 'slamw'); e.telegraph(0.7); e.vx = 0; break; }
          e.setState('spin', 'spin'); e.vx = 0; Sound.play('swoosh', { x: e.x, pitch: 0.6 }); break;
        }
        const want = t.d > 44 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 300 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 4 ? 'walk' : 'idle');
        break;
      }
      case 'swind': e.vx = 0; if (e.stT > 0.6) sweep(); break;
      case 'sweep': if (e.stT > 0.5) e.setState('rec', 'idle'); break;
      case 'pwind':
        e.vx = 0;
        if (e.stT > 0.7) {
          e.setState('slam', 'slam'); Cam.shake(0.25); Sound.play('stomp', { x: e.x });
          FX.shock(e.x + e.face * 18, e.y, '#bfe6ff', 30);
          const dir = e.face, x0 = e.x;
          for (let i = 0; i < 6; i++) later(i * 0.09, () => { if (!e.dead) icePillar(e, x0 + dir * (28 + i * 22)); });
        }
        break;
      case 'slam': if (e.stT > 0.7) e.setState('rec', 'idle'); break;
      case 'spin':
        e.faceTarget(); e.vx = 0;
        if (Math.random() < 0.5) FX.slash(e.x + e.face * 10, e.y - 22, { r: 16, a0: -180, a1: 180, th: 3, c: '#bfe6ff', f: 1, sy: 1, dur: 0.1 });
        if (Math.random() < 0.15) Sound.play('swoosh', { x: e.x, pitch: rand(0.8, 1.1) });
        if (e.stT > 1.25) sweep();
        break;
      case 'rec': if (e.stT > 0.8) { e.setState('walk', 'idle'); e.cd = rand(1.4, 2.2); } break;
      default: e.setState('walk', 'idle');
    }
  },
  // 雪狼: pouncing pack hunters; a howl hastens the whole pack
  wolf(e, dt) {
    const t = e.toTarget(), p = t.p;
    const haste = G.time < (e.hasteT || 0) ? 1.35 : 1;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        const want = t.d > 50 ? e.face * e.D.speed * e.speedMul * haste : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 600 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 6 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround) {
          const pack = G.enemies.filter(o => o !== e && !o.dead && o.type === 'wolf');
          if (pack.length && G.time - (e.howlT || -9) > 8 && chance(0.4)) { e.howlT = G.time; e.howled = false; e.setState('howl', 'howl'); Sound.play('roar', { x: e.x, pitch: 1.9 }); break; }
          if (t.d < 130 && Math.abs(t.dy) < 50) { e.setState('crouch', 'crouch'); e.telegraph(0.42 / haste); e.vx = 0; }
        }
        break;
      }
      case 'crouch':
        e.vx = 0;
        if (e.stT > 0.42 / haste) { e.setState('pounce', 'leap'); e.vx = e.face * clamp(t.d * 2.4, 160, 310); e.vy = -240; e.attackBox([-12, -18, 28, 18], e.D.dmg, 0.8); Sound.play('jump', { x: e.x, pitch: 0.8 }); }
        break;
      case 'pounce':
        if (e.onGround && e.stT > 0.1) { e.cancelAttack(); e.setState('rec', 'idle'); }
        break;
      case 'howl':
        e.vx = 0;
        if (e.stT > 0.25 && !e.howled) {
          e.howled = true;
          FX.ring(e.x, e.cy, 6, 90, '#9fd8ff', 0.5, 3);
          for (const o of G.enemies) if (!o.dead && o.type === 'wolf' && dist(o.x, o.y, e.x, e.y) < 240) { o.hasteT = G.time + 4.5; FX.text(o.x, o.y - o.h - 8, '狼嚎', '#9fd8ff', { size: 8 }); }
        }
        if (e.stT > 0.85) { e.setState('walk', 'idle'); e.cd = rand(0.5, 1.0); }
        break;
      case 'rec':
        e.vx = approach(e.vx, 0, 700 * dt);
        if (e.stT > 0.45 / haste) { e.setState('walk', 'idle'); e.cd = rand(0.9, 1.6) / haste; }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 晶蛛: web spit that chills, leaping bites
  spider(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        const want = t.d > 80 ? e.face * e.D.speed * e.speedMul : t.d < 50 ? -e.face * e.D.speed * 0.6 : 0;
        e.vx = canWalk(e, sign(want) || e.face, G.room) ? approach(e.vx, want, 500 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 5 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround) {
          if (t.d < 100 && Math.abs(t.dy) < 40) { e.setState('crouch', 'spit'); e.telegraph(0.35); e.vx = 0; }
          else if (t.d < 250) { e.setState('spit', 'spit'); e.telegraph(0.4); e.vx = 0; }
        }
        break;
      }
      case 'spit':
        e.vx = 0; e.faceTarget();
        if (e.stT > 0.4) {
          const a = Math.atan2(p.cy - (e.y - 8), p.x - e.x);
          e.shot(e.x + e.face * 8, e.y - 8, a, 190, { kind: 'orb', r: 3.6, c: '#c8f4ff', c2: '#ffffff', chill: 1.8, life: 2.4, light: 30 });
          Sound.play('ice', { x: e.x, pitch: 1.4 });
          e.setState('rec', 'idle');
        }
        break;
      case 'crouch':
        e.vx = 0;
        if (e.stT > 0.35) { e.setState('leap', 'leap'); e.vx = e.face * clamp(t.d * 2.2, 120, 250); e.vy = -250; e.attackBox([-10, -14, 22, 16], e.D.dmg, 0.9); Sound.play('jump', { x: e.x, pitch: 0.9 }); }
        break;
      case 'leap':
        if (e.onGround && e.stT > 0.1) { e.cancelAttack(); e.setState('rec', 'idle'); e.vx = 0; }
        break;
      case 'rec':
        e.vx = approach(e.vx, 0, 600 * dt);
        if (e.stT > 0.55) { e.setState('walk', 'idle'); e.cd = rand(1.3, 2.1); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 棱镜: stationary crystal that locks on and fires a piercing beam
  prism(e, dt) {
    const t = e.toTarget(), p = t.p;
    e.vx = 0;
    switch (e.state) {
      case 'idle': case 'walk':
        e.setAnim('idle');
        if (t.d < 64 && G.time - (e.novaT || -9) > 3.5) { e.novaT = G.time; e.setState('nova', 'charge'); e.telegraph(0.5); break; }
        if (e.cd <= 0 && t.d < 340) { e.setState('aim', 'charge'); e.aimX = p.x; e.aimY = p.cy; e.warned = false; Sound.play('charge', { x: e.x, pitch: 1.6 }); }
        break;
      case 'aim':
        if (e.stT < 0.95) { e.aimX = lerp(e.aimX, p.x, 0.09); e.aimY = lerp(e.aimY, p.cy, 0.09); }
        if (e.stT > 0.95 && !e.warned) { e.warned = true; e.telegraph(0.3); }
        if (e.stT > 1.25) {
          const ox = e.x, oy = e.y - 22, a = Math.atan2(e.aimY - oy, e.aimX - ox);
          let len = 0;
          for (; len < 440; len += 6) if (G.room.solidPx(ox + Math.cos(a) * len, oy + Math.sin(a) * len)) break;
          FX.beam(ox, oy, len, 5, a, '#7ff7ff', 0.3); FX.beam(ox, oy, len, 1.5, a, '#ffffff', 0.35);
          Sound.play('laser', { x: e.x, pitch: 0.9 });
          const pl = G.player, rx = pl.x - ox, ry = pl.cy - oy, along = rx * Math.cos(a) + ry * Math.sin(a);
          if (along > 0 && along < len && Math.abs(rx * Math.sin(a) - ry * Math.cos(a)) < 9) hurtPlayer(e.D.dmg * e.dmgMul, ox);
          e.setState('rec', 'idle');
        }
        break;
      case 'nova':
        if (e.stT > 0.5) {
          for (let i = 0; i < 10; i++) { const a = i * TAU / 10; e.shot(e.x, e.y - 22, a, 130, { kind: 'shard', r: 2.6, c: '#7ff7ff', c2: '#ffffff', life: 1.6, dmg: e.D.dmg * 0.6 }); }
          Sound.play('shatter', { x: e.x, pitch: 1.2 });
          e.setState('rec', 'idle');
        }
        break;
      case 'rec':
        if (e.stT > 0.8) { e.setState('idle', 'idle'); e.cd = rand(1.8, 2.6); }
        break;
      default: e.setState('idle', 'idle');
    }
  },
  // 熵影: blinks in front of you for a two-hit combo, hurls void crescents
  shade(e, dt) {
    const t = e.toTarget(), p = t.p;
    const cut = (anim, dmgMul) => {
      e.setState(anim === 'slash' ? 'cut1' : 'cut2', anim); e.vx = e.face * 150;
      e.attackBox([-2, -34, 38, 32], e.D.dmg * dmgMul, 0.12);
      FX.slash(e.x + e.face * 6, e.y - 18, { r: 20, a0: anim === 'slash' ? -40 : 90, a1: anim === 'slash' ? 40 : -110, th: 6, c: '#ff3048', f: e.face, dur: 0.16 });
      Sound.play('slash', { x: e.x, pitch: 0.8 });
    };
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget(); e.blink = e.copy ? 0.7 : 0; e.intangible = false;
        const want = t.d > 40 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 600 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 6 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround) {
          if (t.d > 120 && chance(0.45)) { e.setState('wwind', 'wind'); e.telegraph(0.45); }
          else { e.setState('blink', 'idle'); Sound.play('teleport', { x: e.x, pitch: 0.7 }); }
        }
        break;
      }
      case 'wwind':
        e.vx = 0; e.faceTarget();
        if (e.stT > 0.45) {
          e.shot(e.x + e.face * 12, e.y - 18, e.face > 0 ? 0 : Math.PI, 240, { kind: 'wave', r: 6, hh: 13, c: '#ff3048', c2: '#ffd0d8', ghost: true, life: 2.0, light: 50 });
          Sound.play('slashHeavy', { x: e.x, pitch: 0.9 });
          e.setState('rec', 'slash');
        }
        break;
      case 'blink':
        e.blink = Math.max(0.05, 1 - e.stT / 0.25); e.intangible = true; e.vx = 0;
        if (e.stT > 0.25) {
          e.x = clamp(p.x + (p.face || 1) * 32, 3 * TILE, G.room.pw - 3 * TILE);
          e.y = G.room.floorBelow(e.x, p.y - 20); e.vy = 0;
          e.face = sign(p.x - e.x) || 1;
          FX.burst(e.x, e.cy, { n: 14, c: ['#ff3048', '#000000'], sp: [30, 100], glow: true });
          e.blink = e.copy ? 0.7 : 0; e.intangible = false;
          e.setState('cwind', 'wind'); e.telegraph(0.3);
        }
        break;
      case 'cwind': e.vx = 0; if (e.stT > 0.3) cut('slash', 1); break;
      case 'cut1': e.vx = approach(e.vx, 0, 900 * dt); if (e.stT > 0.22) cut('slash2', 1.1); break;
      case 'cut2': e.vx = approach(e.vx, 0, 900 * dt); if (e.stT > 0.3) e.setState('rec', 'idle'); break;
      case 'rec':
        e.vx = approach(e.vx, 0, 900 * dt);
        if (e.stT > 0.6) { e.setState('walk', 'idle'); e.cd = rand(1.3, 2.1); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 虚触: burrows, erupts under you, slams, then sinks again
  tentacle(e, dt) {
    const t = e.toTarget(), p = t.p;
    e.vx = 0;
    switch (e.state) {
      case 'idle': case 'walk': e.setState('sink', 'sink'); break;
      case 'under':
        e.hidden = true; e.intangible = true;
        if (e.stT > 0.7) {
          const x = clamp(p.x + rand(-36, 36), 3 * TILE, G.room.pw - 3 * TILE);
          const gy = G.room.floorBelow(x, p.y - 30);
          e.x = x; e.y = gy; e.vy = 0; e.face = sign(p.x - x) || 1;
          FX.circle(x, gy, 16, '#ff3048', 0.7, { sy: 0.3, a: 0.6, pulse: true, layer: 0 });
          Sound.play('warn', { x });
          e.setState('mark');
        }
        break;
      case 'mark':
        if (Math.random() < 0.5) FX.debris(e.x + rand(-8, 8), e.y - 2, ['#4e1a42', '#1a0a14'], 1);
        if (e.stT > 0.7) {
          e.hidden = false; e.intangible = false;
          e.setState('rise', 'rise');
          e.attackBox([-11, -52, 22, 52], e.D.dmg, 0.2);
          Sound.play('stomp', { x: e.x, pitch: 1.4 }); FX.debris(e.x, e.y - 2, ['#4e1a42', '#ff3048', '#1a0a14'], 10); Cam.shake(0.2);
        }
        break;
      case 'rise': if (e.stT > 0.35) { e.setState('sway', 'idle'); e.cd = rand(0.7, 1.2); } break;
      case 'sway':
        e.faceTarget();
        if (e.cd <= 0) { e.setState('swind', 'idle'); e.telegraph(0.5); }
        else if (e.stT > 3) e.setState('sink', 'sink');
        break;
      case 'swind': e.faceTarget(); if (e.stT > 0.5) { e.setState('slam', 'slam'); e.attackBox([0, -40, 58, 42], e.D.dmg * 1.2, 0.15); Cam.shake(0.25); Sound.play('stomp', { x: e.x }); FX.shock(e.x + e.face * 40, e.y, '#ff3048', 30); } break;
      case 'slam': if (e.stT > 0.65) e.setState('sink', 'sink'); break;
      case 'sink': if (e.stT > 0.4) { e.hidden = true; e.intangible = true; e.setState('under'); } break;
      default: e.setState('under');
    }
  },
});

// ---------------- per-type overlays ----------------
Object.assign(EXTRA_DRAW, {
  kitsune(e, ctx, gctx, x, y) {
    if (e.state !== 'fire') return;
    for (let k = e.wn; k < 3; k++) {
      const a = G.time * 6 + k * 2.1, ox = x + Math.cos(a) * 12, oy = y - e.h - 12 + Math.sin(a) * 6;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(ox) - 1, Math.round(oy) - 1, 3, 3);
      gctx.fillStyle = '#9fd8ff'; gctx.fillRect(Math.round(ox) - 3, Math.round(oy) - 3, 7, 7);
      Light.add(e.x + Math.cos(a) * 12, e.y - e.h - 12, 30, '#9fd8ff', 0.6);
    }
  },
  wolf(e, ctx, gctx, x, y) {
    if (G.time < (e.hasteT || 0) && Math.random() < 0.5) FX.add({ k: 'px', x: e.x + rand(-10, 10), y: e.y - rand(4, 16), vx: -e.face * 40, vy: -10, life: 0.25, s: 1.5, c: '#9fd8ff', glow: true });
  },
  prism(e, ctx, gctx, x, y) {
    Light.add(e.x, e.y - 22, 60, '#7ff7ff', 0.6);
    if (e.state !== 'aim') return;
    const sx = x, sy = y - 22, a = Math.atan2(e.aimY - Cam.ry - sy, e.aimX - Cam.rx - sx);
    const lock = e.stT > 0.95;
    ctx.globalAlpha = lock ? (Math.floor(G.time * 30) % 2 ? 0.9 : 0.4) : 0.4;
    ctx.strokeStyle = lock ? '#ffffff' : '#7ff7ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a) * 440, sy + Math.sin(a) * 440); ctx.stroke();
    ctx.globalAlpha = 1;
  },
  monk(e, ctx, gctx, x, y) {
    if (e.state === 'spin') { ctx.globalAlpha = 0.35; ctx.strokeStyle = '#bfe6ff'; ctx.beginPath(); ctx.arc(x + e.face * 10, y - 22, 16, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  },
  shade(e, ctx, gctx, x, y) { Light.add(e.x, e.cy, 40, '#ff3048', 0.4); },
});

// =====================================================================
//  THE ALTERNATIVE MAPS' MONSTERS
//   瘴雨沼泽  蛙武者 (tongue lash) · 瘴菇 (spore clouds) · 萤妖 (swarming darts) · 泥鳄 (swims under the mud)
//   黄沙废城  沙蝎 (venom sting) · 秃鹫 (swoops, drops bones) · 沙俑 (re-forms once) · 沙虫 (tunnels, erupts)
//   熔铸炉城  焰灵 (ember streams) · 熔蜥 (fire breath) · 铁炮兵 (mortar) · 锻锤傀儡 (slam, then an open furnace)
// =====================================================================
const SCORP_PAL = { body: '#b8843a', dark: '#6a4420', hi: '#f0c878', sting: '#ff5a3a' };

// ---------------- 瘴雨沼泽 sprites ----------------
function drawFrogger(x, o) {
  const t = o.t, crouch = o.crouch ? 2 : 0, hop = o.hop;
  const cy = -9 + crouch * 0.6 - (hop ? 3 : 0) + (o.idle ? Math.sin(t * TAU) * 0.4 : 0);
  if (hop) { x.line(-5, cy + 3, -12, cy + 8, 2.4, '#3e6a2a'); x.line(-12, cy + 8, -15, cy + 10, 2, '#3e6a2a'); }
  else { x.ell(-5, cy + 5 + crouch * 0.3, 5, 3.4, 0, '#3e6a2a'); x.line(-9, -1, -2, -1, 2, '#2e5220'); }
  x.ell(0, cy, 8, 6.5, -0.15, '#5e9a3a');
  x.ell(1, cy + 2.5, 6, 3.5, 0, '#d8d89a');
  x.line(4, cy + 3, 6, -1 - (hop ? 2 : 0), 2, '#4e8030');
  x.line(-6, cy + 1, 6, cy + 3, 1.4, '#a8342a');
  const hy = cy - 5 - (o.tongue ? 1 : 0);
  x.ell(4, hy, 6.5, 4.4, 0, '#5e9a3a');
  if (o.tongue) x.poly([[3, hy + 1], [11, hy - 0.5], [11, hy + 3.5], [3, hy + 3]], '#3a1a20');
  else x.line(1, hy + 2, 10, hy + 1.5, 0.8, '#2e4a1e');
  x.circ(2, hy - 4, 2.4, '#5e9a3a'); x.circ(7, hy - 4, 2.4, '#5e9a3a');
  x.rect(2.5, hy - 5, 1.4, 1.6, o.glow ? '#ffffff' : '#ffd23f'); x.rect(7.5, hy - 5, 1.4, 1.6, o.glow ? '#ffffff' : '#ffd23f');
  // straw kasa and a short blade at the hip
  x.poly([[-4, hy - 6], [5, hy - 12], [14, hy - 6], [12, hy - 5], [-2, hy - 5]], '#c8a868');
  x.line(-3, hy - 6, 13, hy - 6, 0.6, '#8a6a3a');
  x.line(-7, cy - 1, -13, cy - 7, 1.2, '#c8d0e0'); x.rect(-7, cy - 2, 2, 2, '#3a2a20');
}
function drawPuffcap(x, o) {
  const t = o.t, sq = o.puff ? 0.25 : Math.max(0, Math.sin(t * TAU)) * 0.08;
  const bob = o.walk ? Math.abs(Math.sin(t * TAU * 2)) : 0;
  for (const lx of [-3, 3]) x.rect(lx - 1, -4 + (o.walk ? Math.sin(t * TAU * 2 + lx) : 0), 2.4, 4, '#c8c0a0');
  x.rect(-4, -12 - bob, 8, 9, '#e0d8b8'); x.rect(-4, -12 - bob, 2, 9, '#f4eed8');
  x.rect(1, -10 - bob, 1.6, 1.6, o.glow ? '#ffffff' : '#2a1a2a'); x.rect(-2.4, -10 - bob, 1.4, 1.6, o.glow ? '#ffffff' : '#2a1a2a');
  const cw = 11 * (1 + sq), ch = 7 * (1 - sq);
  x.ell(0, -14 - bob, cw, ch, 0, '#6a3a8a');
  x.ell(-1, -15.5 - bob, cw * 0.8, ch * 0.6, 0, '#8a52aa');
  for (const [sx, sy] of [[-6, -15], [3, -17], [7, -13], [-2, -19]]) x.circ(sx * (1 + sq), sy - bob, 1.4, '#d8f070');
  x.rect(-cw, -14 - bob, cw * 2, 1, '#4a2a5e');
}
function drawFirefly(x, o) {
  const cy = -7, f = Math.sin(o.t * TAU * 2), st = o.dash ? 1.5 : 1;
  x.ell(-1, cy - 3 - f * 1.5, 4, 2 + Math.abs(f), -0.4, '#cfe8d8');
  x.ell(2, cy - 3 + f * 1.5, 3.5, 2 + Math.abs(f), 0.4, '#e8f8f0');
  x.ell(2.5, cy, 2.6, 2.2, 0, '#2a2a1a');
  x.ell(-2.5 * st, cy + 0.5, 3.6 * st, 2.8, 0, o.glow ? '#ffffff' : '#d8f060');
  x.ell(-3 * st, cy + 0.5, 2 * st, 1.5, 0, '#ffffaa');
  x.rect(4, cy - 1, 1.2, 1.2, '#ff5a2a');
  x.line(4, cy - 1.5, 6.5, cy - 4, 0.6, '#2a2a1a');
}
function drawGator(x, o) {
  const t = o.t, walk = o.walk, ph = t * TAU;
  const cy = -6 + (o.sub ? 4 : 0);
  if (!o.sub) [[-10, 0], [-6, Math.PI], [8, Math.PI * 0.5], [12, Math.PI * 1.5]].forEach(([lx, off], i) => {
    const s = walk ? Math.sin(ph + off) * 2.5 : 0;
    x.line(lx, cy + 2, lx + s, 0, 2.4, i % 2 ? '#3a4a26' : '#4a5c30');
  });
  for (let k = 0; k < 6; k++) x.circ(-14 - k * 3, cy + k * 0.4 + Math.sin(ph + k * 0.6) * (walk ? 1 : 0.4), 3.6 - k * 0.5, '#4a5c30');
  x.ell(0, cy, 15, 5, 0, '#56693a');
  x.ell(0, cy + 2, 12, 2.4, 0, '#b8b080');
  for (let k = -12; k <= 10; k += 3) x.poly([[k, cy - 4], [k + 1.5, cy - 6.5], [k + 3, cy - 4]], '#3a4a26');
  // long snout; the lower jaw drops for the bite
  x.save(); x.translate(13, cy - 1);
  x.poly([[0, -3], [17, -2], [18, 0], [0, 1]], '#56693a');
  x.save(); x.rotate(o.bite ? 0.45 : 0.04); x.poly([[0, 1], [16, 1.5], [16, 3], [0, 3.5]], '#4a5c30'); for (let k = 3; k < 16; k += 3) x.rect(k, 0.4, 1, 1.2, '#efe2c8'); x.restore();
  for (let k = 3; k < 17; k += 3) x.rect(k, -0.4, 1, 1.2, '#efe2c8');
  x.circ(3, -3.4, 2, '#56693a'); x.rect(3, -4.6, 1.6, 1.4, o.glow ? '#ffffff' : '#ffd23f');
  x.restore();
}
// ---------------- 黄沙废城 sprites ----------------
function drawScorp(x, o, P) {
  const ph = o.t * TAU, walk = o.walk, cy = -6;
  for (let i = 0; i < 4; i++) {
    const lx = -5 + i * 3.5, s = walk ? Math.sin(ph * 2 + i * 1.7) * 1.5 : 0;
    x.line(lx, cy + 1, lx - 3 + s, -0.5, 1.2, P.dark); x.line(lx, cy + 1, lx + 3 - s, -0.5, 1.2, P.dark);
  }
  x.ell(0, cy, 8, 3.6, 0, P.body);
  for (let k = -6; k <= 4; k += 3) x.rect(k, cy - 3, 1, 5, P.dark);
  const cl = o.sting ? 2 : 0;
  x.line(6, cy, 11 + cl, cy - 1, 1.6, P.body);
  x.ell(13 + cl, cy - 1.5, 3, 2, 0.3, P.body); x.line(13 + cl, cy - 2.5, 16 + cl, cy - 3.5, 1, P.hi);
  // the tail arcs over the back, then snaps forward to sting
  const pts = o.sting ? [[-7, cy - 1], [-9, cy - 7], [-6, cy - 13], [1, cy - 16], [8, cy - 14], [12, cy - 10]] : [[-7, cy - 1], [-11, cy - 6], [-10, cy - 12], [-5, cy - 16], [0, cy - 15], [2, cy - 12]];
  for (let k = 0; k < pts.length - 1; k++) x.line(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], 2.6 - k * 0.25, k % 2 ? P.body : P.dark);
  const tip = pts[pts.length - 1];
  x.poly([[tip[0], tip[1]], [tip[0] + 3, tip[1] + 3], [tip[0] - 1, tip[1] + 2]], P.sting);
  x.rect(5, cy - 2.5, 1.2, 1.2, o.glow ? '#ffffff' : '#1a1008');
}
function drawVulture(x, o) {
  const cy = -10, f = o.dive ? -0.6 : Math.sin(o.t * TAU), wy = o.dive ? 2 : f * 6;
  x.poly([[-2, cy - 1], [-16, cy - 6 - wy], [-20, cy - 2 - wy * 0.6], [-12, cy + 2], [-3, cy + 2]], '#3a2a20');
  x.ell(0, cy + 1, 7, 4, 0.1, '#4a3626');
  x.poly([[-6, cy + 2], [-12, cy + 6], [-5, cy + 4]], '#3a2a20');
  x.ell(5, cy - 1, 3.6, 3, 0, '#e8dcc8');
  x.line(6, cy - 2, 9, cy - 6, 1.6, '#d89a8a');
  x.circ(10, cy - 6.5, 2.2, '#d89a8a');
  x.poly([[11.5, cy - 7], [15, cy - 5.5], [11.8, cy - 5]], '#e8c060');
  x.rect(10.2, cy - 7.4, 1, 1, o.glow ? '#ffffff' : '#2a1010');
  x.poly([[0, cy], [12, cy - 8 - wy], [6, cy - 12 - wy * 1.2], [-6, cy - 10 - wy], [-4, cy - 1]], '#5a4430');
  for (let k = 0; k < 3; k++) x.line(-4 + k * 4, cy - 2, -6 + k * 5, cy - 10 - wy, 0.8, '#2a1e14');
  x.line(1, cy + 4, 2, cy + 7, 1, '#c8a040'); x.line(-1, cy + 4, -1, cy + 7, 1, '#c8a040');
}
// 沙俑: a clay soldier of the buried city, halberd in hand
const TERRA_LOOK = {
  build: BUILDS.normal,
  col: { pants: '#9a6a40', boot: '#6a4428', sleeve: '#b07a48', hand: '#a87444' },
  kneePad: '#8a5a34',
  stance: { lean: 6, aF: [40, 0], aB: [110, 80], w: -10, lF: [68, 100], lB: [112, 92] },
  runArms: s => ({ aF: [40 + 10 * s, 0], aB: [110 - 20 * s, 80], w: -10 }),
  torso(x, J, B, p) {
    drawTorsoBase(x, J, B, this, p, '#b07a48', '#8a5a34');
    for (let k = 0; k < 3; k++) {
      const u = 2 + k * 3;
      vLine(x, { x: J.hip.x - J.fw.x * 3 + J.up.x * u, y: J.hip.y - J.fw.y * 3 + J.up.y * u }, { x: J.hip.x + J.fw.x * 4 + J.up.x * u, y: J.hip.y + J.fw.y * 4 + J.up.y * u }, 0.8, '#6a4428');
    }
    vCirc(x, J.sF.x, J.sF.y, 2.4, '#c8945c');
  },
  head(x, J, B, p) {
    local(x, J.head, J.headA / DEG, () => {
      vCirc(x, 0, 0, 4.8, '#c8945c');
      vPoly(x, [[-5, -2], [-3, -6], [3, -6.5], [5, -3]], '#8a5a34');
      vRect(x, -1, -9, 2.4, 3, '#8a5a34');
      vRect(x, 1.6, -1, 1.6, 1, p.eye ? '#ffd060' : '#5a3a20'); vRect(x, 3.6, -1, 1, 1, p.eye ? '#ffd060' : '#5a3a20');
      vRect(x, 2, 2, 3, 0.8, '#8a5a34');
    });
  },
  weapon(x, J, B, p) {
    local(x, J.hF, p.w, () => {
      x.line(-14, 0, 22, 0, 1.6, '#5a3a20');
      x.poly([[22, -2], [28, 0], [22, 2]], '#c8b8a0');
      x.poly([[17, 0], [19, -6], [21, 0]], '#c8b8a0');
      x.rect(14, -1.5, 2, 3, '#b8342a');
    });
  },
};
function drawWorm(x, o) {
  const H = 44 * (o.h === undefined ? 1 : o.h), n = 8, lean = o.lean || 0;
  x.ell(0, 0, 11, 2.6, 0, '#8a6438');
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), r = 7 - u * 1.6;
    const sx = Math.sin(o.t * TAU + u * 2.5) * 3 * u + lean * u * u * 10, sy = -u * H;
    x.circ(sx, sy, r, i % 2 ? '#b8845a' : '#a87048');
    x.rect(sx - r, sy, r * 2, 1, '#7a4a2c');
  }
  // a ring of teeth that opens to spit
  const hx = Math.sin(o.t * TAU + 2.5) * 3 + lean * 10, hy = -H - 4, mr = o.open ? 4 : 2.6;
  x.circ(hx, hy, 6.5, '#c8945c');
  x.circ(hx + 1, hy, o.open ? 4 : 2.4, '#3a1a10');
  for (let k = 0; k < 6; k++) { const a = k * TAU / 6; x.rect(hx + 1 + Math.cos(a) * mr - 0.5, hy + Math.sin(a) * mr - 0.5, 1, 1, '#efe2c8'); }
}
// ---------------- 熔铸炉城 sprites ----------------
function drawCinder(x, o) {
  const t = o.t, cy = -12 + Math.sin(t * TAU) * 1.2, fl = Math.sin(t * TAU * 3);
  x.poly([[-6, cy + 6], [-8, cy - 2], [-4, cy - 8 + fl], [-1, cy - 14 - fl * 1.5], [2, cy - 9], [5, cy - 13 + fl], [7, cy - 3], [6, cy + 6], [0, cy + 9]], '#ff6a1a');
  x.poly([[-4, cy + 5], [-5, cy - 1], [-2, cy - 6], [1, cy - 10 - fl], [3, cy - 4], [4, cy + 5], [0, cy + 7]], '#ffb347');
  x.ell(0, cy + 2, 3, 3.6, 0, '#fff0b0');
  // a cracked iron mask
  x.ell(1.5, cy - 1, 4, 3.6, 0, '#3a3438');
  const eye = o.glow || o.cast ? '#ffffff' : '#ffd36a';
  x.rect(1, cy - 2, 1.6, 1.2, eye); x.rect(3.6, cy - 2, 1.2, 1.2, eye);
  x.line(0, cy - 4, 2, cy + 1, 0.6, '#ff8a3a');
  if (o.cast) x.circ(8, cy - 2, 2.6, '#ffffff');
}
function drawSalamander(x, o) {
  const ph = o.t * TAU, run = o.walk, cy = -5;
  [[-7, 0], [-4, Math.PI], [5, Math.PI * 0.5], [8, Math.PI * 1.5]].forEach(([lx, off], i) => {
    const s = run ? Math.sin(ph * 1.5 + off) * 2.4 : 0;
    x.line(lx, cy + 1, lx + s + (i < 2 ? -2 : 2), 0, 1.6, '#5a2a1a');
  });
  for (let k = 0; k < 6; k++) x.circ(-10 - k * 2.6, cy + Math.sin(ph * 1.5 + k * 0.7) * (run ? 1.5 : 0.6), 2.6 - k * 0.35, k % 2 ? '#7a3a1e' : '#8a4222');
  x.ell(0, cy, 10, 3.6, 0, '#8a4222');
  for (let k = -7; k <= 5; k += 3) x.rect(k, cy - 3.6, 2, 2, o.glow ? '#ffffff' : '#ff8a2a');
  x.ell(0, cy + 1.5, 8, 1.6, 0, '#d8a050');
  const open = o.breathe ? 1 : 0;
  x.ell(11, cy - 1, 4.6, 3, 0, '#8a4222');
  x.poly([[13, cy - 1], [17, cy - 0.5 - open], [13, cy + 1]], '#8a4222');
  if (open) x.poly([[13, cy + 0.5], [17, cy + 1.5], [13, cy + 2]], '#7a3a1e');
  x.rect(11, cy - 3, 1.4, 1.2, '#ffd36a');
}
function drawCannoneer(x, o) {
  const ph = o.t * TAU, walk = o.walk, bob = walk ? Math.abs(Math.sin(ph)) : 0;
  for (const [lx, off] of [[-3, 0], [3, Math.PI]]) { const s = walk ? Math.sin(ph + off) * 2 : 0; x.rect(lx - 1.5 + s, -8, 3.4, 8, '#2a2628'); x.rect(lx - 2 + s, -1.6, 5, 1.6, '#1a1618'); }
  const by = -8 - bob;
  x.ell(0, by - 7, 7, 8, 0, '#5a4a3a'); x.rect(-7, by - 9, 14, 3, '#8a6a3a');
  x.circ(1, by - 16, 4.6, '#4a4448'); x.rect(-4, by - 16, 10, 1.6, '#2a2628'); x.rect(1.5, by - 16, 3, 1, o.glow ? '#ffffff' : '#ffb347');
  // the mortar on its shoulder tilts up to aim
  x.save(); x.translate(-1, by - 12); x.rotate((o.aim ? -50 : o.fire ? -40 : -20) * DEG);
  x.rect(-4, -4, 16, 8, '#3a3438'); x.rect(10, -5, 4, 10, '#2a2628'); x.rect(-4, -4, 16, 2, '#6a6268');
  if (o.fire) x.circ(15, 0, 4, '#ffd36a');
  x.restore();
  x.rect(-9, by - 6, 4, 6, '#3a3438');
}
function drawHammerbot(x, o) {
  const ph = o.t * TAU, walk = o.walk, bob = walk ? Math.abs(Math.sin(ph)) * 1.2 : 0;
  for (const [lx, off] of [[-6, 0], [5, Math.PI]]) {
    const s = walk ? Math.sin(ph + off) * 2 : 0;
    x.rect(lx - 2 + s, -10, 5, 10, '#3a3438'); x.rect(lx - 3 + s, -2, 7, 2, '#2a2628');
  }
  const by = -12 - bob;
  // boiler body with a furnace window
  x.rect(-11, by - 22, 22, 22, '#4a4448'); x.rect(-11, by - 22, 22, 2, '#6a6268'); x.rect(-11, by - 2, 22, 2, '#2a2628');
  for (const [rx, ry] of [[-9, -20], [8, -20], [-9, -4], [8, -4]]) x.rect(rx, by + ry, 1.4, 1.4, '#8a8088');
  x.rect(-6, by - 15, 12, 8, '#1a1416');
  x.rect(-5, by - 14, 10, 6, o.vent ? '#ffffff' : '#ff7a2a'); x.rect(-5, by - 10, 10, 2, '#ffd36a');
  if (!o.vent) for (let k = -4; k <= 4; k += 3) x.rect(k, by - 14, 1, 6, '#2a2628');
  x.rect(-9, by - 28, 5, 6, '#3a3438'); x.rect(-10, by - 29, 7, 2, '#2a2628');
  x.rect(2, by - 26, 7, 4, '#3a3438'); x.rect(6, by - 25, 2, 2, o.glow ? '#ffffff' : '#ffd36a');
  // the hammer arm swings around the shoulder
  x.save(); x.translate(8, by - 18); x.rotate((o.arm === undefined ? 60 : o.arm) * DEG);
  x.rect(0, -2, 16, 4, '#3a3438'); x.rect(14, -2.5, 3, 5, '#2a2628');
  x.rect(16, -8, 9, 16, '#5a5258'); x.rect(16, -8, 9, 2, '#8a8088'); x.rect(23, -8, 2, 16, '#3a3438');
  x.restore();
  x.line(-10, by - 16, -14, by - 6, 3, '#3a3438');
}

function bakeMapMonsters() {
  bakeCustom('frogger', 36, 34, 16, 31, {
    idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawFrogger(x, { t, idle: true }) },
    hop: { n: 1, draw: x => drawFrogger(x, { t: 0, hop: true }) },
    crouch: { n: 2, loop: true, fps: 12, draw: (x, t, i) => drawFrogger(x, { t, crouch: true, glow: i === 0 }) },
    tongue: { n: 1, draw: x => drawFrogger(x, { t: 0, tongue: true }) },
    hurt: { n: 1, draw: x => drawFrogger(x, { t: 0.25, crouch: true }) },
  });
  bakeCustom('puffcap', 30, 32, 15, 30, {
    idle: { n: 4, loop: true, fps: 5, draw: (x, t) => drawPuffcap(x, { t }) },
    walk: { n: 4, loop: true, fps: 8, draw: (x, t) => drawPuffcap(x, { t, walk: true }) },
    puff: { n: 2, loop: true, fps: 10, draw: (x, t, i) => drawPuffcap(x, { t, puff: true, glow: i === 0 }) },
    hurt: { n: 1, draw: x => drawPuffcap(x, { t: 0, puff: true }) },
  });
  bakeCustom('firefly', 24, 20, 12, 16, {
    idle: { n: 4, loop: true, fps: 16, draw: (x, t) => drawFirefly(x, { t }) },
    aim: { n: 2, loop: true, fps: 14, draw: (x, t, i) => drawFirefly(x, { t, glow: i === 0 }) },
    dash: { n: 2, loop: true, fps: 20, draw: (x, t) => drawFirefly(x, { t, dash: true, glow: true }) },
    hurt: { n: 1, draw: x => drawFirefly(x, { t: 0.2 }) },
  });
  bakeCustom('gator', 72, 32, 34, 28, {
    idle: { n: 4, loop: true, fps: 5, draw: (x, t) => drawGator(x, { t }) },
    walk: { n: 6, loop: true, fps: 10, draw: (x, t) => drawGator(x, { t, walk: true }) },
    sub: { n: 2, loop: true, fps: 6, draw: (x, t) => drawGator(x, { t, sub: true }) },
    windup: { n: 2, loop: true, fps: 12, draw: (x, t, i) => drawGator(x, { t, bite: true, glow: i === 0 }) },
    bite: { n: 1, draw: x => drawGator(x, { t: 0, bite: true, walk: true }) },
    hurt: { n: 1, draw: x => drawGator(x, { t: 0.1 }) },
  });
  bakeCustom('scorp', 42, 30, 18, 27, {
    idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawScorp(x, { t }, SCORP_PAL) },
    walk: { n: 6, loop: true, fps: 14, draw: (x, t) => drawScorp(x, { t, walk: true }, SCORP_PAL) },
    wind: { n: 2, loop: true, fps: 12, draw: (x, t, i) => drawScorp(x, { t, glow: i === 0 }, SCORP_PAL) },
    sting: { n: 1, draw: x => drawScorp(x, { t: 0, sting: true }, SCORP_PAL) },
    hurt: { n: 1, draw: x => drawScorp(x, { t: 0.25 }, SCORP_PAL) },
  });
  bakeCustom('vulture', 50, 34, 25, 24, {
    idle: { n: 6, loop: true, fps: 8, draw: (x, t) => drawVulture(x, { t }) },
    aim: { n: 2, loop: true, fps: 12, draw: (x, t, i) => drawVulture(x, { t, glow: i === 0 }) },
    dive: { n: 1, draw: x => drawVulture(x, { t: 0, dive: true, glow: true }) },
    hurt: { n: 1, draw: x => drawVulture(x, { t: 0.4 }) },
  });
  bakeRig('sandman', TERRA_LOOK, {
    idle: { n: 4, gen: 'idle', loop: true, fps: 6 }, walk: { n: 8, gen: 'run', loop: true, fps: 10 }, hurt: { n: 1, gen: 'hurt' }, fall: { n: 1, gen: 'fall' },
    wind: { n: 1, gen: L => fullPose(L, { lean: -8, aF: [150, 170], w: -5, aB: [120, 100], lF: [70, 100], lB: [115, 95] }) },
    thrust: { n: 1, gen: L => fullPose(L, { lean: 26, aF: [0, 0], w: 0, aB: [150, 160], lF: [25, 88], lB: [150, 140] }) },
  });
  bakeCustom('sandworm', 44, 66, 20, 62, {
    idle: { n: 6, loop: true, fps: 8, draw: (x, t) => drawWorm(x, { t }) },
    rise: { n: 4, fps: 14, draw: (x, t) => drawWorm(x, { t: 0, h: 0.2 + t * 0.8 }) },
    sink: { n: 4, fps: 12, draw: (x, t) => drawWorm(x, { t: 0, h: 1 - t * 0.85 }) },
    spit: { n: 2, loop: true, fps: 10, draw: (x, t) => drawWorm(x, { t, open: true, lean: 0.6 }) },
    hurt: { n: 1, draw: x => drawWorm(x, { t: 0.1, lean: -0.4 }) },
  });
  bakeCustom('cinder', 28, 32, 14, 28, {
    idle: { n: 6, loop: true, fps: 12, draw: (x, t) => drawCinder(x, { t }) },
    cast: { n: 2, loop: true, fps: 14, draw: (x, t, i) => drawCinder(x, { t, cast: true, glow: i === 0 }) },
    hurt: { n: 1, draw: x => drawCinder(x, { t: 0.3, glow: true }) },
  });
  bakeCustom('salamander', 48, 22, 24, 19, {
    idle: { n: 4, loop: true, fps: 6, draw: (x, t) => drawSalamander(x, { t }) },
    walk: { n: 6, loop: true, fps: 16, draw: (x, t) => drawSalamander(x, { t, walk: true }) },
    wind: { n: 2, loop: true, fps: 12, draw: (x, t, i) => drawSalamander(x, { t, breathe: true, glow: i === 0 }) },
    breathe: { n: 2, loop: true, fps: 12, draw: (x, t) => drawSalamander(x, { t, breathe: true, glow: true }) },
    hurt: { n: 1, draw: x => drawSalamander(x, { t: 0.2 }) },
  });
  bakeCustom('cannoneer', 42, 42, 19, 38, {
    idle: { n: 4, loop: true, fps: 5, draw: (x, t) => drawCannoneer(x, { t }) },
    walk: { n: 6, loop: true, fps: 10, draw: (x, t) => drawCannoneer(x, { t, walk: true }) },
    aim: { n: 2, loop: true, fps: 10, draw: (x, t, i) => drawCannoneer(x, { t, aim: true, glow: i === 0 }) },
    fire: { n: 1, draw: x => drawCannoneer(x, { t: 0, fire: true }) },
    hurt: { n: 1, draw: x => drawCannoneer(x, { t: 0.3 }) },
  });
  bakeCustom('hammerbot', 70, 66, 28, 62, {
    idle: { n: 4, loop: true, fps: 5, draw: (x, t) => drawHammerbot(x, { t, arm: 60 }) },
    walk: { n: 6, loop: true, fps: 8, draw: (x, t) => drawHammerbot(x, { t, walk: true, arm: 55 + Math.sin(t * TAU) * 8 }) },
    raise: { n: 2, loop: true, fps: 10, draw: (x, t, i) => drawHammerbot(x, { t, arm: -115, glow: i === 0 }) },
    slam: { n: 1, draw: x => drawHammerbot(x, { t: 0, arm: 80 }) },
    vent: { n: 2, loop: true, fps: 8, draw: (x, t, i) => drawHammerbot(x, { t, arm: 85, vent: i === 0 }) },
    hurt: { n: 1, draw: x => drawHammerbot(x, { t: 0.2, arm: 70 }) },
  });
}

// ---------------- hazards of the alternative maps ----------------
// lingering spore cloud: hurts the player standing in it
function sporeCloud(e, x, y, r = 24, life = 2.2) {
  const dmg = e.D.dmg * 0.5 * e.dmgMul;
  addZone({
    x, y, life, tick: 0.45, r,
    onTick(z) { const p = G.player; if (p && !p.dead && dist(p.x, p.cy, z.x, z.y) < z.r + 6) hurtPlayer(dmg, z.x, { noStagger: true }); },
    upd(z) { if (Math.random() < 0.5) FX.add({ k: 'px', x: z.x + rand(-z.r, z.r), y: z.y + rand(-z.r * 0.6, z.r * 0.4), vx: rand(-8, 8), vy: -rand(4, 16), life: 0.6, s: rand(2, 3.5), c: pick(['#b8f060', '#8ac040', '#d8f090']), glow: true }); },
    drawFn(ctx, gctx, X, Y, z) {
      const a = Math.min(1, z.t * 4, z.life * 1.5);
      ctx.globalAlpha = 0.28 * a; ctx.fillStyle = '#9ad050';
      ctx.beginPath(); ctx.ellipse(X, Y, z.r, z.r * 0.7, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      gctx.globalAlpha = 0.25 * a; gctx.fillStyle = '#b8f060'; gctx.beginPath(); gctx.ellipse(X, Y, z.r * 0.8, z.r * 0.5, 0, 0, TAU); gctx.fill(); gctx.globalAlpha = 1;
    },
  });
}
// 蝎毒: poison that ticks for a few seconds (never lethal on its own)
function venom(p, secs, dmg) {
  if (!p || p.dead || G.god) return;
  if (p.venomZ && G.zones.includes(p.venomZ)) { p.venomZ.life = Math.max(p.venomZ.life, secs); return; }
  FX.text(p.x, p.y - p.h - 10, '中毒', '#b8f060', { size: 8 });
  p.venomZ = addZone({
    x: p.x, y: p.cy, life: secs, tick: 0.8, tt: 0.8,
    onTick() { if (!p.dead) hurtPlayer(dmg, p.x, { dot: true, nonlethal: true, numc: '#b8f060' }); },
    upd(z) { z.x = p.x; z.y = p.cy; if (Math.random() < 0.3) FX.add({ k: 'px', x: p.x + rand(-5, 5), y: p.y - rand(4, 26), vx: 0, vy: -20, life: 0.4, s: 1.5, c: '#b8f060', glow: true }); },
    onEnd() { p.venomZ = null; },
  });
}

Object.assign(ENEMY_DEFS, {
  // 瘴雨沼泽
  frogger: { name: '蛙武者', hp: 52, w: 16, h: 18, speed: 70, kb: 1.1, poise: 0, gold: [3, 6], dmg: 11, spr: 'frogger', cost: 2 },
  puffcap: {
    name: '瘴菇', hp: 42, w: 14, h: 20, speed: 32, kb: 1.2, poise: 0, gold: [2, 5], dmg: 9, spr: 'puffcap', cost: 1.5,
    // 余瘴: leaves a spore cloud where it falls
    onDeath(e) { sporeCloud(e, e.x, e.y - 10, 26, 2.4); },
  },
  firefly: { name: '萤妖', hp: 18, w: 10, h: 10, speed: 120, kb: 1.5, poise: 0, gold: [1, 3], dmg: 8, spr: 'firefly', cost: 1, flying: true, fodder: true },
  gator: { name: '泥鳄', hp: 140, w: 34, h: 14, speed: 48, kb: 0.5, poise: 6, gold: [6, 10], dmg: 17, spr: 'gator', cost: 3.2 },
  // 黄沙废城
  scorp: { name: '沙蝎', hp: 46, w: 18, h: 12, speed: 84, kb: 1.1, poise: 0, gold: [3, 6], dmg: 12, spr: 'scorp', cost: 1.6 },
  vulture: { name: '秃鹫', hp: 48, w: 18, h: 14, speed: 115, kb: 1.2, poise: 0, gold: [4, 7], dmg: 13, spr: 'vulture', cost: 2.2, flying: true },
  sandman: {
    name: '沙俑', hp: 72, w: 14, h: 30, speed: 56, kb: 0.9, poise: 0, gold: [5, 8], dmg: 14, spr: 'sandman', cost: 2.6,
    // 复形: the first death leaves a sand heap that re-forms unless you break it in time
    preDie(e, h) {
      if (e.reformed || h.execute) return false;
      e.reformed = true; e.hp = 1;
      e.cancelAttack(); e.setState('crumble'); e.hidden = true; e.vx = 0; e.h = 10;
      FX.burst(e.x, e.y - 12, { n: 18, c: ['#e0b070', '#c8945c', '#8a6440'], sp: [30, 120], g: 300, life: [0.3, 0.7], s: [1, 3] });
      FX.text(e.x, e.y - 30, '复形', '#ffd070', { size: 8 });
      Sound.play('stomp', { x: e.x, pitch: 1.6 });
      return true;
    },
    preHurt(e) { return e.state === 'crumble'; },
  },
  sandworm: { name: '沙虫', hp: 96, w: 18, h: 42, speed: 0, kb: 0, poise: 99, gold: [5, 9], dmg: 16, spr: 'sandworm', cost: 3 },
  // 熔铸炉城
  cinder: { name: '焰灵', hp: 42, w: 12, h: 16, speed: 90, kb: 1.2, poise: 0, gold: [4, 6], dmg: 11, spr: 'cinder', cost: 2, flying: true },
  salamander: { name: '熔蜥', hp: 60, w: 24, h: 12, speed: 115, kb: 1, poise: 0, gold: [4, 7], dmg: 12, spr: 'salamander', cost: 2.4 },
  cannoneer: { name: '铁炮兵', hp: 84, w: 16, h: 26, speed: 40, kb: 0.8, poise: 0, gold: [6, 9], dmg: 15, spr: 'cannoneer', cost: 3 },
  hammerbot: {
    name: '锻锤傀儡', hp: 200, w: 24, h: 38, speed: 32, kb: 0.3, poise: 9, gold: [8, 12], dmg: 20, spr: 'hammerbot', cost: 4,
    // 散热: after each slam the furnace hangs open and takes +60% damage
    taken(e) { return e.state === 'vent' ? 1.6 : 1; },
  },
});

Object.assign(AI, {
  // 蛙武者: hops about; a crouch, then a long tongue that drags you in
  frogger(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (e.onGround) {
          e.vx = approach(e.vx, 0, 900 * dt);
          if (e.cd <= 0 && t.d < 130 && Math.abs(t.dy) < 34) { e.setState('crouch', 'crouch'); e.telegraph(0.45); e.vx = 0; break; }
          e.hopT = (e.hopT === undefined ? rand(0.2, 0.6) : e.hopT) - dt;
          if (e.hopT <= 0) {
            e.hopT = rand(0.55, 0.9);
            const dir = t.d < 60 ? -e.face : e.face;
            if (canWalk(e, dir, G.room) || chance(0.4)) {
              e.vy = -250; e.vx = dir * 110 * e.speedMul;
              if (t.d < 70 && dir === e.face) e.attackBox([-8, -16, 18, 18], e.D.dmg * 0.7, 0.45);   // a hop onto you is a stomp
              Sound.play('jump', { x: e.x, pitch: 1.5 });
            }
          }
        }
        e.setAnim(e.onGround ? 'idle' : 'hop');
        break;
      }
      case 'crouch':
        e.vx = 0; e.faceTarget();
        if (e.stT > 0.45) { e.setState('lash', 'tongue'); e.tongue = 0; e.tdir = e.face; e.licked = false; Sound.play('swoosh', { x: e.x, pitch: 1.9 }); }
        break;
      case 'lash': {
        // shoots out to 96 px, then snaps back
        const k = e.stT < 0.16 ? e.stT / 0.16 : Math.max(0, 1 - (e.stT - 0.24) / 0.18);
        e.tongue = 96 * k;
        const ty = e.y - 12;
        if (!e.licked && e.stT < 0.3 && Math.abs(p.cy - ty) < 14 && (p.x - e.x) * e.tdir > 0 && Math.abs(p.x - e.x) < e.tongue + 4) {
          e.licked = true;
          if (hurtPlayer(e.D.dmg * e.dmgMul, e.x)) { p.vx = -e.tdir * 260; p.vy = -140; FX.text(p.x, p.y - p.h - 8, '舌缚', '#ff8aa0', { size: 8 }); }
        }
        if (e.stT > 0.45) { e.tongue = 0; e.setState('rec', 'idle'); }
        break;
      }
      case 'rec':
        e.vx = approach(e.vx, 0, 700 * dt);
        if (e.stT > 0.5) { e.setState('walk', 'idle'); e.cd = rand(1.4, 2.2); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 瘴菇: waddles in range and lobs spore pods; up close it fogs itself
  puffcap(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        const want = t.d > 90 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 300 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 4 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround && t.d < 230) { e.setState('puff', 'puff'); e.telegraph(0.55); e.vx = 0; e.near = t.d < 46; }
        break;
      }
      case 'puff':
        e.vx = 0;
        if (e.stT > 0.55) {
          if (e.near) sporeCloud(e, e.x, e.y - 10, 30, 2.0);
          else for (let i = 0; i < 3; i++) {
            const T = 0.7 + i * 0.12, dx = p.x - e.x + (i - 1) * 34, sy = e.y - 16;
            const pr = e.shot(e.x, sy, 0, 0, { kind: 'orb', r: 3, c: '#b8f060', c2: '#ffffff', grav: 520, life: 3, light: 30 });
            pr.vx = dx / T; pr.vy = (p.y - 6 - sy - 0.5 * 520 * T * T) / T;
            pr.onDie = q => sporeCloud(e, q.x, G.room.floorBelow(q.x, q.y - 10) - 10, 22, 1.8);
          }
          FX.burst(e.x, e.y - 18, { n: 10, c: ['#b8f060', '#d8f090'], sp: [20, 70], life: [0.3, 0.6] });
          Sound.play('void', { x: e.x, pitch: 1.9 });
          e.setState('rec', 'idle');
        }
        break;
      case 'rec':
        if (e.stT > 0.7) { e.setState('walk', 'idle'); e.cd = rand(2.0, 2.8); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 萤妖: circles you in a loose swarm, then darts straight through
  firefly(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': {
        e.ang = (e.ang === undefined ? rand(0, TAU) : e.ang) + dt * 2.2;
        const tx = p.x + Math.cos(e.ang) * 70, ty = p.y - 50 + Math.sin(e.ang * 1.6) * 22;
        e.vx = approach(e.vx, clamp((tx - e.x) * 2.2, -e.D.speed, e.D.speed) * e.speedMul, 360 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 2.2, -110, 110), 360 * dt);
        e.faceTarget(); e.setAnim('idle');
        if (e.cd <= 0 && G.room.los(e.x, e.cy, p.x, p.cy)) { e.setState('aim', 'aim'); e.telegraph(0.5); }
        break;
      }
      case 'aim':
        e.vx = approach(e.vx, 0, 500 * dt); e.vy = approach(e.vy, 0, 500 * dt); e.faceTarget();
        if (e.stT > 0.5) {
          const a = Math.atan2(p.cy - e.cy, p.x - e.x);
          e.vx = Math.cos(a) * 300; e.vy = Math.sin(a) * 300; e.face = sign(e.vx) || e.face;
          e.dbox = e.attackBox([-6, -10, 12, 10], e.D.dmg, 0.5);
          e.setState('dash', 'dash'); Sound.play('swoosh', { x: e.x, pitch: 2.1 });
        }
        break;
      case 'dash':
        if (Math.random() < 0.6) FX.add({ k: 'px', x: e.x, y: e.cy, vx: 0, vy: 0, life: 0.3, s: 2, c: '#d8f060', glow: true, add: true });
        if (e.stT > 0.5 || e.hitWall || e.onGround) { if (e.dbox) e.dbox.life = 0; e.setState('idle', 'idle'); e.vx *= 0.3; e.vy = -60; e.cd = rand(1.6, 2.6); }
        break;
      default: e.setState('idle', 'idle');
    }
  },
  // 泥鳄: bites up close; from afar it sinks into the mud and surfaces under you
  gator(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget(); e.hidden = false; e.intangible = false;
        if (e.cd <= 0 && e.onGround) {
          if (t.d < 70 && Math.abs(t.dy) < 30) { e.setState('bwind', 'windup'); e.telegraph(0.5); e.vx = 0; break; }
          if (t.d > 90) {
            e.setState('dive', 'sub'); e.vx = 0;
            Sound.play('swoosh', { x: e.x, pitch: 0.5 });
            FX.burst(e.x, e.y - 2, { n: 12, c: ['#4a5232', '#7a8a52', '#2e3220'], sp: [30, 100], g: 400, life: [0.3, 0.6] });
            break;
          }
        }
        const want = t.d > 50 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 300 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 4 ? 'walk' : 'idle');
        break;
      }
      case 'dive':
        e.vx = 0;
        if (e.stT > 0.35) { e.hidden = true; e.intangible = true; e.setState('swim'); }
        break;
      case 'swim': {
        const dir = sign(p.x - e.x) || e.face;
        e.face = dir; e.vx = groundAhead(e, dir, G.room) || canWalk(e, dir, G.room) ? dir * 150 * e.speedMul : 0;
        if (Math.random() < 0.5) FX.add({ k: 'px', x: e.x + rand(-10, 10), y: e.y - 1, vx: rand(-20, 20), vy: -rand(20, 60), g: 400, life: 0.35, s: 2, c: pick(['#4a5232', '#7a8a52']) });
        if (Math.abs(p.x - e.x) < 14 || e.stT > 1.8) { e.vx = 0; e.setState('lurk'); e.telegraph(0.45); FX.circle(e.x, e.y, 18, '#b8f060', 0.45, { sy: 0.3, a: 0.5, pulse: true, layer: 0 }); }
        break;
      }
      case 'lurk':
        e.vx = 0;
        if (e.stT > 0.45) {
          e.hidden = false; e.intangible = false;
          e.setState('erupt', 'bite'); e.vy = -200;
          e.attackBox([-18, -30, 50, 32], e.D.dmg * 1.15, 0.2, { onHit: pl => { pl.vy = -360; } });
          FX.burst(e.x, e.y - 4, { n: 20, c: ['#4a5232', '#7a8a52', '#d8f090'], sp: [40, 160], g: 400, life: [0.3, 0.7], s: [1, 3] });
          Sound.play('stomp', { x: e.x, pitch: 1.2 }); Cam.shake(0.2);
        }
        break;
      case 'erupt':
        if (e.onGround && e.stT > 0.2) e.setState('rec', 'idle');
        break;
      case 'bwind':
        e.vx = 0;
        if (e.stT > 0.5) { e.setState('bite', 'bite'); e.vx = e.face * 230; e.attackBox([6, -16, 34, 16], e.D.dmg, 0.18); Sound.play('slash', { x: e.x, pitch: 0.7 }); }
        break;
      case 'bite':
        e.vx = approach(e.vx, 0, 600 * dt);
        if (e.stT > 0.35) e.setState('rec', 'idle');
        break;
      case 'rec':
        e.vx = approach(e.vx, 0, 600 * dt);
        if (e.stT > 0.7) { e.setState('walk', 'idle'); e.cd = rand(1.6, 2.4); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 沙蝎: closes in, stings (poison) and skips back out
  scorp(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        const want = t.d > 46 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 600 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 5 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround && t.d < 64 && Math.abs(t.dy) < 34) { e.setState('wind', 'wind'); e.telegraph(0.38); e.vx = 0; }
        break;
      }
      case 'wind':
        e.vx = 0; e.faceTarget();
        if (e.stT > 0.38) {
          e.setState('sting', 'sting'); e.vx = e.face * 140;
          e.attackBox([0, -24, 36, 24], e.D.dmg, 0.14, { onHit: pl => venom(pl, 3.2, e.D.dmg * 0.2 * e.dmgMul) });
          Sound.play('slash', { x: e.x, pitch: 1.4 });
        }
        break;
      case 'sting':
        e.vx = approach(e.vx, 0, 900 * dt);
        if (e.stT > 0.25) { e.setState('back', 'walk'); e.vx = -e.face * 150; e.vy = -150; }
        break;
      case 'back':
        if (e.onGround && e.stT > 0.15) e.setState('rec', 'idle');
        break;
      case 'rec':
        e.vx = approach(e.vx, 0, 700 * dt);
        if (e.stT > 0.5) { e.setState('walk', 'idle'); e.cd = rand(1.1, 1.8); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 秃鹫: soars high, swoops through you in a falling arc, or lets a bone drop
  vulture(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': {
        e.ang = (e.ang === undefined ? rand(0, TAU) : e.ang) + dt * 1.1;
        const tx = p.x + Math.cos(e.ang) * 120, ty = p.y - 110 + Math.sin(e.ang * 2) * 12;
        e.vx = approach(e.vx, clamp((tx - e.x) * 1.4, -e.D.speed, e.D.speed) * e.speedMul, 240 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 1.4, -90, 90), 240 * dt);
        e.face = sign(e.vx) || e.face; e.setAnim('idle');
        if (e.cd <= 0) {
          if (chance(0.4) && Math.abs(p.x - e.x) < 60) { e.setState('drop', 'aim'); e.telegraph(0.3); }
          else { e.setState('aim', 'aim'); e.telegraph(0.5); e.tx = p.x; e.ty = p.y; }
        }
        break;
      }
      case 'aim':
        e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, -20, 400 * dt); e.faceTarget();
        e.tx = lerp(e.tx, p.x, 0.08); e.ty = lerp(e.ty, p.y, 0.08);
        if (e.stT > 0.5) {
          e.sdir = sign(e.tx - e.x) || e.face; e.face = e.sdir;
          e.sdx = Math.max(90, Math.abs(e.tx - e.x)) * 2; e.sdy = Math.max(30, e.ty - 6 - e.y);
          e.sbox = e.attackBox([-10, -14, 22, 16], e.D.dmg, 1.0);
          e.setState('swoop', 'dive'); Sound.play('swoosh', { x: e.x, pitch: 0.9 });
        }
        break;
      case 'swoop': {
        // a half-sine dive: down through your height and back up the far side
        const k = clamp(e.stT / 0.9, 0, 1);
        e.vx = e.sdir * e.sdx / 0.9; e.vy = e.sdy * Math.PI / 0.9 * Math.cos(k * Math.PI);
        if (e.stT > 0.9 || e.hitWall) { if (e.sbox) e.sbox.life = 0; e.setState('idle', 'idle'); e.cd = rand(1.8, 2.8); }
        break;
      }
      case 'drop':
        e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, 0, 400 * dt);
        if (e.stT > 0.3) {
          e.shot(e.x, e.y + 2, Math.PI / 2, 60, { kind: 'shard', r: 3, c: '#efe2c8', c2: '#ffffff', grav: 700, life: 2, spin: 12, dmg: e.D.dmg * 0.9 });
          Sound.play('swoosh', { x: e.x, pitch: 1.4 });
          e.setState('idle', 'idle'); e.cd = rand(1.4, 2.2);
        }
        break;
      default: e.setState('idle', 'idle');
    }
  },
  // 沙俑: steady halberd thrusts; 复形 (see its def) gives it a second life
  sandman(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (e.cd <= 0 && t.d < 78 && Math.abs(t.dy) < 30) { e.setState('wind', 'wind'); e.telegraph(0.5); e.vx = 0; break; }
        const want = t.d > 60 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 500 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 5 ? 'walk' : 'idle');
        break;
      }
      case 'wind':
        e.vx = 0;
        if (e.stT > 0.5) {
          e.setState('thrust', 'thrust'); e.vx = e.face * 200;
          e.attackBox([0, -24, 56, 12], e.D.dmg, 0.14);
          FX.add({ k: 'streak', x: e.x + e.face * 40, y: e.y - 18, vx: e.face * 900, vy: 0, life: 0.1, c: '#ffd070', len: 0.03, w: 2 });
          Sound.play('slash', { x: e.x, pitch: 1.0 });
        }
        break;
      case 'thrust':
        e.vx = approach(e.vx, 0, 900 * dt);
        if (e.stT > 0.45) { e.setState('walk', 'idle'); e.cd = rand(1.3, 2.0); }
        break;
      case 'crumble':
        e.vx = 0;
        if (Math.random() < 0.15) FX.add({ k: 'px', x: e.x + rand(-8, 8), y: e.y - rand(2, 8), vx: 0, vy: -rand(10, 30), life: 0.4, s: 1.5, c: '#e0b070' });
        if (e.stT > 2.6) {
          e.hidden = false; e.h = e.D.h; e.hp = Math.max(e.hp, Math.round(e.maxHp * 0.5));
          e.setState('rise', 'wind'); e.cd = 0.8;
          FX.burst(e.x, e.cy, { n: 16, c: ['#e0b070', '#c8945c'], sp: [20, 80], g: -40, life: [0.3, 0.6] });
          FX.text(e.x, e.y - e.h - 6, '重塑', '#ffd070', { size: 8 });
          Sound.play('teleport', { x: e.x, pitch: 0.6 });
        }
        break;
      case 'rise':
        if (e.stT > 0.5) e.setState('walk', 'idle');
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 沙虫: a mound of sand slides toward you, erupts, spits grit twice, sinks again
  sandworm(e, dt) {
    const t = e.toTarget(), p = t.p;
    if (e.state !== 'travel') e.vx = 0;
    switch (e.state) {
      case 'idle': case 'walk': e.setState('sink', 'sink'); break;
      case 'sink': if (e.stT > 0.4) { e.hidden = true; e.intangible = true; e.setState('travel'); } break;
      case 'travel': {
        const dir = sign(p.x - e.x) || 1;
        e.vx = groundAhead(e, dir, G.room) ? approach(e.vx, dir * 130, 400 * dt) : 0;
        if (Math.random() < 0.6) FX.add({ k: 'px', x: e.x + rand(-8, 8), y: e.y - 1, vx: rand(-30, 30), vy: -rand(30, 90), g: 400, life: 0.4, s: 2, c: pick(['#e0b070', '#c8945c', '#f4d8a0']) });
        if (Math.abs(p.x - e.x) < 18 || e.stT > 2.4) { e.vx = 0; e.setState('mark'); FX.circle(e.x, e.y, 16, '#ffc850', 0.6, { sy: 0.3, a: 0.6, pulse: true, layer: 0 }); Sound.play('warn', { x: e.x }); }
        break;
      }
      case 'mark':
        if (Math.random() < 0.5) FX.debris(e.x + rand(-8, 8), e.y - 2, ['#e0b070', '#8a6438'], 1);
        if (e.stT > 0.6) {
          e.hidden = false; e.intangible = false;
          e.setState('rise', 'rise');
          e.attackBox([-12, -54, 24, 54], e.D.dmg, 0.2, { onHit: pl => { pl.vy = -380; } });
          Sound.play('stomp', { x: e.x, pitch: 1.2 }); FX.debris(e.x, e.y - 2, ['#e0b070', '#8a6438', '#ffffff'], 12); Cam.shake(0.2);
        }
        break;
      case 'rise': if (e.stT > 0.35) { e.setState('sway', 'idle'); e.cd = rand(0.5, 0.9); e.spat = 0; } break;
      case 'sway':
        e.faceTarget();
        if (e.cd <= 0 && e.spat < 2) { e.setState('spit', 'spit'); e.telegraph(0.35); }
        else if (e.stT > 2.4 || e.spat >= 2) e.setState('sink', 'sink');
        break;
      case 'spit':
        e.faceTarget();
        if (e.stT > 0.35) {
          const T = 0.75, sy = e.y - 50, dx = p.x - e.x;
          const pr = e.shot(e.x, sy, 0, 0, { kind: 'orb', r: 4, c: '#e0b070', c2: '#fff0c8', grav: 480, life: 3, light: 20 });
          pr.vx = dx / T; pr.vy = (p.cy - sy - 0.5 * 480 * T * T) / T;
          pr.onDie = q => { for (let i = 0; i < 5; i++) e.shot(q.x, q.y - 4, -Math.PI / 2 + (i - 2) * 0.5, 140, { kind: 'shard', r: 2, c: '#f4d8a0', c2: '#ffffff', life: 0.6, grav: 400, dmg: e.D.dmg * 0.4 }); };
          Sound.play('swoosh', { x: e.x, pitch: 0.8 });
          e.spat++; e.setState('sway', 'idle'); e.cd = rand(0.7, 1.1);
        }
        break;
      default: e.setState('sink', 'sink');
    }
  },
  // 焰灵: hovers out of reach and fires a rapid stream of embers
  cinder(e, dt) {
    const t = e.toTarget(), p = t.p, side = e.x < p.x ? -1 : 1;
    switch (e.state) {
      case 'idle': {
        const tx = p.x + side * 100, ty = p.y - 56 + Math.sin(G.time * 2.4 + e.id) * 16;
        e.vx = approach(e.vx, clamp((tx - e.x) * 1.8, -e.D.speed, e.D.speed) * e.speedMul, 260 * dt);
        e.vy = approach(e.vy, clamp((ty - e.y) * 1.8, -80, 80), 260 * dt);
        e.faceTarget(); e.setAnim('idle');
        if (Math.random() < 0.3) FX.fire(e.x + rand(-4, 4), e.y - rand(4, 14), 1);
        if (e.cd <= 0 && G.room.los(e.x, e.cy, p.x, p.cy)) { e.setState('cast', 'cast'); e.telegraph(0.5); e.n = 0; }
        break;
      }
      case 'cast':
        e.vx = approach(e.vx, 0, 400 * dt); e.vy = approach(e.vy, 0, 400 * dt); e.faceTarget();
        if (e.stT > 0.5 + e.n * 0.13 && e.n < 4) {
          e.n++;
          const a = Math.atan2(p.cy - e.cy, p.x - e.x) + rand(-0.06, 0.06);
          e.shot(e.x + e.face * 6, e.cy, a, 230, { kind: 'fireball', r: 2.6, life: 2, light: 40, dmg: e.D.dmg * 0.7 });
          Sound.play('fire', { x: e.x, pitch: 1.6 });
        }
        if (e.stT > 1.2) { e.setState('idle', 'idle'); e.cd = rand(2.0, 2.8); }
        break;
      default: e.setState('idle', 'idle');
    }
  },
  // 熔蜥: skitters to mid range and breathes a cone of fire that leaves the ground burning
  salamander(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        const want = t.d > 70 ? e.face * e.D.speed * e.speedMul : t.d < 40 ? -e.face * e.D.speed * 0.6 : 0;
        e.vx = canWalk(e, sign(want) || e.face, G.room) ? approach(e.vx, want, 800 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 5 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround && t.d < 100 && Math.abs(t.dy) < 30) { e.setState('wind', 'wind'); e.telegraph(0.4); e.vx = 0; }
        break;
      }
      case 'wind':
        e.vx = 0; e.faceTarget();
        if (e.stT > 0.4) { e.setState('breathe', 'breathe'); e.attackBox([8, -18, 64, 18], e.D.dmg * 0.6, 0.6, { multi: 0.25 }); Sound.play('fire', { x: e.x, pitch: 0.9 }); }
        break;
      case 'breathe':
        e.vx = 0;
        for (let i = 0; i < 2; i++) FX.add({ k: 'px', x: e.x + e.face * 14, y: e.y - 5, vx: e.face * rand(140, 260), vy: rand(-50, 20), life: rand(0.2, 0.35), s: rand(2, 4), c: pick(['#ffd36a', '#ff8a2a', '#ff5a1a']), glow: true, add: true, shrink: true });
        Light.add(e.x + e.face * 40, e.y - 8, 70, '#ff8a3a', 0.8);
        if (e.stT > 0.6) { const fx = e.x + e.face * 56; firePatch(e, fx, G.room.floorBelow(fx, e.y - 10)); e.setState('rec', 'idle'); }
        break;
      case 'rec':
        if (e.stT > 0.6) { e.setState('walk', 'idle'); e.cd = rand(1.6, 2.4); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 铁炮兵: keeps its distance and shells the spot you stand on; shoves you off if you crowd it
  cannoneer(e, dt) {
    const t = e.toTarget(), p = t.p;
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (t.d < 46 && Math.abs(t.dy) < 30 && e.cd <= 0.6) { e.setState('bash', 'fire'); e.telegraph(0.3); e.vx = 0; e.bashed = false; break; }
        const dir = t.d < 120 ? -e.face : t.d > 240 ? e.face : 0;
        const can = dir !== 0 && canWalk(e, dir, G.room);
        e.vx = approach(e.vx, can ? dir * e.D.speed * e.speedMul : 0, 400 * dt);
        e.setAnim(Math.abs(e.vx) > 4 ? 'walk' : 'idle');
        if (e.cd <= 0 && e.onGround) { e.setState('aim', 'aim'); e.vx = 0; e.tx = p.x; e.ty = G.room.floorBelow(p.x, p.y - 10); e.warned = false; Sound.play('charge', { x: e.x, pitch: 1.2 }); }
        break;
      }
      case 'aim':
        e.vx = 0; e.faceTarget();
        if (e.stT < 0.55) { e.tx = lerp(e.tx, p.x, 0.1); e.ty = G.room.floorBelow(e.tx, p.y - 10); }
        if (e.stT > 0.55 && !e.warned) { e.warned = true; warnMarker(e.tx, e.ty, 26, '#ff7a2a', 1.0); }
        if (e.stT > 0.75) {
          const T = 0.95, sx = e.x - e.face * 2, sy = e.y - 30, tx = e.tx, ty = e.ty;
          const pr = e.shot(sx, sy, 0, 0, { kind: 'fireball', r: 3.6, grav: 600, life: 3, ghost: true, light: 30, noHit: true });
          pr.vx = (tx - sx) / T; pr.vy = (ty - sy - 0.5 * 600 * T * T) / T;
          pr.upd = q => { if (q.vy > 0 && q.y >= ty - 4) { q.life = 0; explodeE(tx, ty - 6, 30, e.D.dmg * e.dmgMul, { c: '#ff7a2a' }); firePatch(e, tx, ty); } };
          Sound.play('explode', { x: e.x, pitch: 0.7 }); FX.flash(sx + e.face * 10, sy - 6, 8, '#ffd36a', 0.1);
          e.setState('recoil', 'fire'); e.vx = -e.face * 60;
        }
        break;
      case 'recoil':
        e.vx = approach(e.vx, 0, 400 * dt);
        if (e.stT > 0.6) { e.setState('walk', 'idle'); e.cd = rand(2.2, 3.0); }
        break;
      case 'bash':
        e.vx = 0;
        if (e.stT > 0.3 && !e.bashed) { e.bashed = true; e.attackBox([0, -26, 26, 26], e.D.dmg * 0.8, 0.12, { onHit: pl => { pl.vx = e.face * 260; } }); Sound.play('hitHeavy', { x: e.x, pitch: 0.8 }); }
        if (e.stT > 0.7) { e.setState('walk', 'idle'); e.cd = Math.max(e.cd, 0.8); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
  // 锻锤傀儡: plods in, raises the hammer, slams (shockwaves both ways), then vents its furnace
  hammerbot(e, dt) {
    const t = e.toTarget();
    switch (e.state) {
      case 'idle': case 'walk': {
        e.faceTarget();
        if (e.cd <= 0 && t.d < 76 && Math.abs(t.dy) < 40) { e.setState('raise', 'raise'); e.telegraph(0.8); e.vx = 0; Sound.play('charge', { x: e.x, pitch: 0.7 }); break; }
        const want = t.d > 50 ? e.face * e.D.speed * e.speedMul : 0;
        e.vx = canWalk(e, e.face, G.room) ? approach(e.vx, want, 200 * dt) : 0;
        e.setAnim(Math.abs(e.vx) > 3 ? 'walk' : 'idle');
        break;
      }
      case 'raise':
        e.vx = 0;
        if (e.stT > 0.8) {
          e.setState('slam', 'slam');
          const fx = e.x + e.face * 34;
          e.attackBox([10, -40, 44, 40], e.D.dmg, 0.14);
          FX.shock(fx, e.y, '#ff8a3a', 34); FX.debris(fx, e.y - 2, ['#5a5258', '#ff8a3a', '#ffd36a'], 10);
          Sound.play('stomp', { x: e.x }); Sound.play('clank', { x: e.x, pitch: 0.6 }); Cam.shake(0.35);
          later(0.05, () => { if (!e.dead) { eShockwave(e, fx, e.y, 1, e.D.dmg * 0.55 * e.dmgMul); eShockwave(e, fx, e.y, -1, e.D.dmg * 0.55 * e.dmgMul); } });
        }
        break;
      case 'slam':
        if (e.stT > 0.35) { e.setState('vent', 'vent'); FX.text(e.x, e.y - e.h - 8, '散热', '#ffd36a', { size: 8 }); Sound.play('void', { x: e.x, pitch: 0.5 }); }
        break;
      case 'vent':
        if (Math.random() < 0.4) FX.add({ k: 'px', x: e.x + rand(-6, 6), y: e.y - 30, vx: rand(-20, 20), vy: -rand(40, 90), life: 0.6, s: rand(2, 4), c: pick(['#c8c0c0', '#8a8088', '#e8e0e0']) });
        if (e.stT > 1.3) { e.setState('walk', 'idle'); e.cd = rand(1.4, 2.0); }
        break;
      default: e.setState('walk', 'idle');
    }
  },
});

Object.assign(EXTRA_DRAW, {
  frogger(e, ctx, gctx, x, y) {
    if (!(e.tongue > 0)) return;
    const my = Math.round(y - 12), mx = x + e.tdir * 9, tx = x + e.tdir * e.tongue;
    ctx.strokeStyle = '#e86a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(tx, my); ctx.stroke();
    ctx.fillStyle = '#ff9ab0'; ctx.fillRect(Math.round(tx) - 2, my - 2, 4, 4);
  },
  firefly(e) { Light.add(e.x, e.cy, 34, '#d8f060', 0.55); },
  gator(e, ctx, gctx, x, y) {
    // while it swims under: a wake and two yellow eyes
    if (!e.hidden) return;
    const k = Math.sin(G.time * 10);
    ctx.fillStyle = '#7a8a52'; ctx.fillRect(Math.round(x - 12), Math.round(y - 2), 24, 1);
    ctx.fillStyle = '#4a5232'; ctx.fillRect(Math.round(x - 8 + k), Math.round(y - 3), 3, 1); ctx.fillRect(Math.round(x + 5 - k), Math.round(y - 3), 3, 1);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(x + e.face * 6), Math.round(y - 4), 2, 1); ctx.fillRect(Math.round(x + e.face * 10), Math.round(y - 4), 2, 1);
  },
  sandman(e, ctx, gctx, x, y) {
    if (e.state !== 'crumble') return;
    // the sand heap, a halberd stuck in it, and a ring counting down to the re-forming
    const k = Math.min(1, e.stT / 0.3), sh = e.stT > 2.0 ? Math.sin(G.time * 30) : 0;
    ctx.fillStyle = '#8a6440'; ctx.beginPath(); ctx.ellipse(x + sh, y, 11 * k, 5 * k, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#c8945c'; ctx.beginPath(); ctx.ellipse(x - 1 + sh, y - 1, 8 * k, 3.5 * k, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(Math.round(x + 2), Math.round(y - 12), 1, 9);
    ctx.globalAlpha = 0.75; ctx.strokeStyle = '#ffd070'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y - 16, 4, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, e.stT / 2.6)); ctx.stroke();
    ctx.globalAlpha = 1;
  },
  sandworm(e, ctx, gctx, x, y) {
    if (!e.hidden) return;
    const k = Math.sin(G.time * 16);
    ctx.fillStyle = '#c8945c'; ctx.beginPath(); ctx.ellipse(x, y, 9 + k, 3, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#f4d8a0'; ctx.fillRect(Math.round(x - 5), Math.round(y - 3), 3, 1); ctx.fillRect(Math.round(x + 2), Math.round(y - 2), 3, 1);
  },
  cinder(e) { Light.add(e.x, e.cy, 54, '#ff8a3a', 0.65); },
  hammerbot(e) { Light.add(e.x, e.y - 26, e.state === 'vent' ? 90 : 46, '#ff7a2a', 0.7); },
});
