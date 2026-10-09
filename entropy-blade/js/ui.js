'use strict';
// =====================================================================
//  UI — menus, HUD, overlays (drawn on the 960x540 UI canvas)
// =====================================================================
const UI = {
  t: 0, screen: 'press', sel: 0, heroSel: 0, setSel: 0, talSel: 0, pauseSel: 0, howPage: 0,
  regions: [], newRegions: [], hover: null, confirm: null, endScreen: null,
  hp: { trail: 1 }, showcase: { i: 0, t: 0 }, comboPop: 0, lastCombo: 0,
};

// ---------- drawing helpers ----------
const uctx = Gfx.uctx;
function T(str, x, y, o) { return Text.draw(uctx, str, x, y, o); }
function panel(x, y, w, h, o = {}) {
  const c = uctx;
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  c.globalAlpha = o.alpha !== undefined ? o.alpha : 0.88;
  c.fillStyle = o.bg || '#0b0716';
  c.fillRect(x + 2, y, w - 4, h); c.fillRect(x, y + 2, w, h - 4);
  c.globalAlpha = 1;
  const bc = o.border || '#3a2f5c';
  c.fillStyle = bc;
  c.fillRect(x + 2, y, w - 4, 2); c.fillRect(x + 2, y + h - 2, w - 4, 2);
  c.fillRect(x, y + 2, 2, h - 4); c.fillRect(x + w - 2, y + 2, 2, h - 4);
  if (o.corner) { c.fillStyle = o.corner; c.fillRect(x, y, 6, 2); c.fillRect(x, y, 2, 6); c.fillRect(x + w - 6, y + h - 2, 6, 2); c.fillRect(x + w - 2, y + h - 6, 2, 6); }
}
function bar(x, y, w, h, frac, col, o = {}) {
  const c = uctx;
  c.fillStyle = '#05030a'; c.fillRect(x - 2, y - 2, w + 4, h + 4);
  c.fillStyle = o.bg || '#2a1430'; c.fillRect(x, y, w, h);
  if (o.trail !== undefined) { c.fillStyle = '#ffffff'; c.fillRect(x, y, Math.round(w * clamp(o.trail, 0, 1)), h); }
  c.fillStyle = col; c.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), h);
  c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(x, y, Math.round(w * clamp(frac, 0, 1)), Math.max(1, h >> 2));
}
function region(x, y, w, h, data) { UI.newRegions.push(Object.assign({ x, y, w, h }, data)); }
function keyCap(x, y, label, col = '#ffffff') {
  const w = Math.max(14, Text.measure(label, 8) + 6);
  uctx.fillStyle = '#05030a'; uctx.fillRect(x - 1, y - 1, w + 2, 14);
  uctx.fillStyle = '#2a2244'; uctx.fillRect(x, y, w, 12);
  uctx.fillStyle = '#4a3f78'; uctx.fillRect(x, y + 10, w, 2);
  T(label, x + w / 2, y + 1, { size: 8, color: col, align: 'center' });
  return w;
}
// a control hint: key cap on keyboard / pad, the matching button glyph on touch
const CTRL_ICON = { jump: 'jump', dash: 'dash', skill: 'wave', ult: 'star', interact: 'hand', pause: 'pause' };
function ctrlCap(x, y, action, col = '#ffffff') {
  if (!TouchUI.enabled) return keyCap(x, y, Input.keyName(action), col);
  let ic = CTRL_ICON[action];
  if (action === 'attack') ic = G.player && G.player.heroId === 'eve' ? 'gun' : G.player && G.player.heroId === 'gao' ? 'fist' : 'sword';
  uctx.fillStyle = '#05030a'; uctx.fillRect(x - 1, y - 3, 18, 18);
  uctx.fillStyle = '#2a2244'; uctx.fillRect(x, y - 2, 16, 16);
  uctx.drawImage(iconOf(ic || 'star', col), x, y - 2);
  return 16;
}
// painted portrait (立绘) on the hi-res art layer, punched through the UI canvas.
// win: normalized square window of the art (default: all of it); gray: 0..1 desaturation
function drawArt(id, x, y, size, o = {}) {
  uctx.clearRect(x, y, size, size);
  const c = Gfx.artCtx();
  c.save();
  if (o.alpha !== undefined) c.globalAlpha = o.alpha;
  c.fillStyle = '#05030a'; c.fillRect(x, y, size, size);
  c.drawImage(Portraits.get(id, o.win, size * Gfx.artScale), x, y, size, size);
  if (o.gray) { c.globalCompositeOperation = 'saturation'; c.globalAlpha = o.gray; c.fillStyle = '#808080'; c.fillRect(x, y, size, size); }
  c.restore();
}
function drawSpriteUI(fr, ox, oy, x, y, s, flip, alpha) {
  uctx.imageSmoothingEnabled = false;
  uctx.save();
  uctx.globalAlpha = alpha === undefined ? 1 : alpha;
  uctx.translate(Math.round(x), Math.round(y));
  uctx.scale(flip ? -s : s, s);
  uctx.drawImage(fr, -ox, -oy);
  uctx.restore();
}
function glowText(str, x, y, o) {
  const c = o.glow || o.color, s = o.scale || 1;
  const a = o.alpha === undefined ? 1 : o.alpha;
  T(str, x + s, y + s, Object.assign({}, o, { color: c, outline: c, alpha: a * 0.85 }));
  T(str, x, y, Object.assign({}, o, { outline: '#0a0612' }));
}
// one line that fits in w px, ending in … when cut
function fitText(str, w, size = 12) {
  if (Text.measure(str, size) <= w) return str;
  let s = str;
  while (s.length > 1 && Text.measure(s + '…', size) > w) s = s.slice(0, -1);
  return s + '…';
}
// slanted score digits (最高评分 on the select card, 本局评分 on the result screen)
function scoreDigits(v, x, y, s, col, alpha = 1, align = 'left') {
  const k = 0.2, cy = y + 6 * s;
  uctx.save();
  uctx.transform(1, 0, -k, 1, k * cy, 0);
  T(String(v), x, y, { size: 12, scale: s, color: col, outline: '#0a0612', alpha, align });
  uctx.restore();
}

// =====================================================================
//  INPUT HANDLING PER SCREEN
// =====================================================================
const TITLE_ITEMS = ['开始游戏', '劫难挑战', '熵能天赋', '操作说明', '游戏设置'];
const SETTINGS = [
  { id: 'music', name: '音乐音量', type: 'slider' },
  { id: 'sfx', name: '音效音量', type: 'slider' },
  { id: 'shake', name: '屏幕震动', type: 'slider' },
  { id: 'glow', name: '辉光强度', type: 'slider' },
  { id: 'lighting', name: '动态光照', type: 'toggle' },
  { id: 'numbers', name: '伤害数字', type: 'toggle' },
  { id: 'pixelPerfect', name: '整数倍像素缩放', type: 'toggle' },
  { id: 'fullscreen', name: '全屏模式', type: 'action' },
  { id: 'reset', name: '清除存档', type: 'action' },
  { id: 'back', name: '返回', type: 'action' },
];
function navV(n, cur) {
  if (Input.hit('mup')) { Sound.play('select'); return (cur + n - 1) % n; }
  if (Input.hit('mdown')) { Sound.play('select'); return (cur + 1) % n; }
  return cur;
}
function navH(n, cur) {
  if (Input.hit('mleft')) { Sound.play('select'); return (cur + n - 1) % n; }
  if (Input.hit('mright')) { Sound.play('select'); return (cur + 1) % n; }
  return cur;
}
UI.update = function (dt) {
  this.t += dt;
  this.regions = this.newRegions; this.newRegions = [];
  const m = Input.mouse;
  this.hover = null;
  for (const r of this.regions) if (m.x >= r.x && m.x < r.x + r.w && m.y >= r.y && m.y < r.y + r.h) this.hover = r;
  if (G.trans) return;
  if (this.hover && m.moved && this.hover.onHover) this.hover.onHover();
  const click = m.clicked && this.hover && this.hover.onClick ? this.hover : null;
  if (click) { click.onClick(); return; }
  if (G.state === 'title') this.updTitle(dt);
  else if (G.state === 'play' && G.overlay) this.updOverlay(dt);
  else if (G.state === 'gameover' || G.state === 'victory') this.updEnd(dt);
};
UI.go = function (screen) { this.screen = screen; this.sel = 0; Sound.play('confirm'); };
UI.titleAction = function (i) {
  if (i === 0 || i === 1) {
    this.screen = 'select'; this.hardMode = i === 1; this.modeId = Save.data.lastMode; this.modeSel = this.modeId === 'hard' ? 1 : 0;
    this.heroSel = Save.data.lastChar || 0; this.showcase = { i: 0, t: 0 }; Sound.play('confirm');
    for (const id of HERO_ORDER) { const w = this.selWeapon(id).id; if (!SPR[id] || SPR[id].weapon !== w) bakeHero(id, w); }
  }
  else if (i === 2) this.go('talents');
  else if (i === 3) { this.go('howto'); this.howPage = 0; }
  else if (i === 4) { this.go('settings'); this.setSel = 0; }
};
UI.selectMode = function (i) {
  this.modeSel = i; this.modeId = i === 1 ? 'hard' : 'normal'; this.hardMode = false;
  this.startGame();
};
UI.startGame = function () {
  if (this.screen === 'select') {
    this.screen = this.hardMode ? 'trial' : 'mode';
    if (this.hardMode) this.trialSel = this.trialSel || 0;
    Sound.play('confirm'); return;
  }
  Sound.play('confirm'); Sound.play('door');
  const id = HERO_ORDER[this.heroSel];
  const wid = this.selWeapon(id).id;
  const trial = this.hardMode ? Object.assign({}, Save.data.trialSel) : null;
  if (trial) Save.write();
  const mode = this.hardMode ? 'trial' : this.modeId;
  transition(() => startRun(id, wid, trial, mode));
};
UI.trialAdjust = function (i, dir) {
  const c = CURSES[i], sel = Save.data.trialSel;
  const n = c.pts.length, cur = sel[c.id] || 0;
  sel[c.id] = dir === 0 ? (cur + 1) % (n + 1) : clamp(cur + dir, 0, n);
  if (!sel[c.id]) delete sel[c.id];
  Sound.play(sel[c.id] ? 'select' : 'cancel');
};
UI.selWeapon = function (id) {
  const list = heroWeapons(id);
  if (!this.weaponSel) {
    this.weaponSel = {};
    const lw = Save.data.lastWeapon || {};
    for (const h of HERO_ORDER) this.weaponSel[h] = Math.max(0, heroWeapons(h).findIndex(w => w.id === lw[h]));
  }
  return list[(this.weaponSel[id] || 0) % list.length];
};
UI.cycleWeapon = function (dir) {
  const id = HERO_ORDER[this.heroSel], n = heroWeapons(id).length;
  this.selWeapon(id);
  this.weaponSel[id] = (this.weaponSel[id] + dir + n) % n;
  bakeHero(id, this.selWeapon(id).id);
  this.showcase = { i: 0, t: 0 };
  Sound.play('select');
};
UI.settingAction = function (s, dir) {
  const st = Save.data.settings;
  if (s.type === 'slider') {
    if (dir) { st[s.id] = clamp(Math.round((st[s.id] + dir * 0.1) * 10) / 10, 0, 1); Sound.play('select'); }
  } else if (s.type === 'toggle') { st[s.id] = !st[s.id]; Sound.play('select'); if (s.id === 'pixelPerfect') Gfx.resize(); }
  else if (s.id === 'fullscreen') {
    try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) { /* not allowed */ }
    Sound.play('confirm');
  } else if (s.id === 'reset') {
    this.confirm = { text: '确定要清除全部存档（熵晶、天赋、记录）吗？', yes: () => { Save.reset(); Sound.play('cancel'); }, sel: 1 };
  } else if (s.id === 'back') { this.backFromSettings(); }
  Sound.applyVolumes();
  Save.write();
};
UI.backFromSettings = function () {
  Sound.play('cancel');
  if (G.state === 'play') { G.overlay = { kind: 'pause', t: 1 }; this.pauseSel = 0; }
  else { this.screen = 'title'; this.sel = 4; }
};
UI.updTitle = function (dt) {
  if (this.confirm) { this.updConfirm(); return; }
  switch (this.screen) {
    case 'press':
      if (Input.any || Input.mouse.clicked) { Sound.unlock(); Sound.resumePending(); Sound.music('title'); Sound.play('confirm'); this.screen = 'title'; this.sel = 0; }
      break;
    case 'title':
      this.sel = navV(TITLE_ITEMS.length, this.sel);
      if (Input.hit('ok')) this.titleAction(this.sel);
      break;
    case 'mode':
      this.modeSel = navH(2, this.modeSel);
      if (Input.hit('ok')) this.selectMode(this.modeSel);
      if (Input.hit('cancel')) { this.screen = 'select'; Sound.play('cancel'); }
      break;
    case 'select':
      this.heroSel = navH(3, this.heroSel);
      if (Input.hit('mleft') || Input.hit('mright')) this.showcase = { i: 0, t: 0 };
      if (Input.hit('mup')) this.cycleWeapon(-1);
      if (Input.hit('mdown')) this.cycleWeapon(1);
      if (Input.hit('ok')) this.startGame();
      if (Input.hit('cancel')) { this.screen = 'title'; this.sel = this.hardMode ? 1 : 0; Sound.play('cancel'); }
      break;
    case 'trial': {
      const n = CURSES.length;
      this.trialSel = navV(n + 1, this.trialSel || 0);
      if (this.trialSel < n) {
        if (Input.hit('mleft')) this.trialAdjust(this.trialSel, -1);
        if (Input.hit('mright')) this.trialAdjust(this.trialSel, 1);
      }
      if (Input.hit('ok')) { if (this.trialSel === n) this.startGame(); else this.trialAdjust(this.trialSel, 0); }
      if (Input.hit('alt')) this.startGame();
      if (Input.hit('cancel')) { this.screen = 'select'; Sound.play('cancel'); }
      break;
    }
    case 'talents': {
      const n = TALENTS.length;
      if (Input.hit('mup')) { this.talSel = (this.talSel + n - 2) % n; Sound.play('select'); }
      if (Input.hit('mdown')) { this.talSel = (this.talSel + 2) % n; Sound.play('select'); }
      if (Input.hit('mleft') || Input.hit('mright')) { this.talSel ^= 1; Sound.play('select'); }
      if (Input.hit('ok')) this.buyTalent(TALENTS[this.talSel]);
      if (Input.hit('cancel')) { this.screen = 'title'; this.sel = 2; Sound.play('cancel'); }
      break;
    }
    case 'howto':
      if (Input.hit('mleft') || Input.hit('mright')) { this.howPage ^= 1; Sound.play('select'); }
      if (Input.hit('cancel') || Input.hit('ok')) { this.screen = 'title'; this.sel = 3; Sound.play('cancel'); }
      break;
    case 'settings':
      this.updSettings();
      break;
  }
};
UI.updSettings = function () {
  this.setSel = navV(SETTINGS.length, this.setSel);
  const s = SETTINGS[this.setSel];
  if (Input.hit('mleft')) this.settingAction(s, -1);
  if (Input.hit('mright')) this.settingAction(s, 1);
  if (Input.hit('ok') && s.type !== 'slider') this.settingAction(s, 0);
  if (Input.hit('cancel')) this.backFromSettings();
};
UI.buyTalent = function (t) {
  if (Talents.buy(t)) { Sound.play('upgrade'); this.talFlash = { id: t.id, t: 0 }; }
  else Sound.play('error');
};
UI.updConfirm = function () {
  const c = this.confirm;
  if (Input.hit('mleft') || Input.hit('mright') || Input.hit('mup') || Input.hit('mdown')) { c.sel ^= 1; Sound.play('select'); }
  if (Input.hit('ok')) { const yes = c.sel === 0; this.confirm = null; if (yes) c.yes(); else Sound.play('cancel'); }
  else if (Input.hit('cancel')) { this.confirm = null; Sound.play('cancel'); }
};
UI.pauseItems = () => ['继续游戏', '游戏设置', '放弃本局', '返回标题'];
UI.pauseAction = function (i) {
  if (i === 0) { G.overlay = null; Sound.play('cancel'); }
  else if (i === 1) { G.overlay = { kind: 'settings' }; this.setSel = 0; Sound.play('confirm'); }
  else if (i === 2) this.confirm = { text: '放弃本局？本局获得的熵晶仍会保留。', yes: () => { G.overlay = null; G.player.hp = 0; G.player.die(); G.deathT = 1.5; }, sel: 1 };
  else if (i === 3) this.confirm = { text: '返回标题？本局进度将丢失（熵晶会保留）。', yes: () => { Save.data.crystals += G.run.crystals; Save.write(); G.overlay = null; UI.toTitle(); }, sel: 1 };
};
UI.toTitle = function () {
  transition(() => { G.state = 'title'; this.screen = 'title'; this.sel = 0; clearWorld(); G.player = null; Sound.music('title'); });
};
UI.updOverlay = function (dt) {
  const o = G.overlay;
  o.t = (o.t || 0) + dt;
  if (this.confirm) { this.updConfirm(); return; }
  if (o.kind === 'pick') {
    o.sel = navH(o.items.length, o.sel);
    if (Input.hit('ok') && o.t > 0.35) this.pickItem(o.sel);
    if (Input.hit('alt') && o.reroll && G.run.rerolls > 0 && o.t > 0.2) this.reroll();
  } else if (o.kind === 'dialog') {
    o.sel = navV(o.choices.length, o.sel);
    if (Input.hit('ok') && o.t > 0.3) this.pickDialog(o.sel);
  } else if (o.kind === 'pause') {
    this.pauseSel = navV(4, this.pauseSel);
    if (Input.hit('mright') || Input.hit('tab')) { this.pauseTab = ((this.pauseTab || 0) + 1) % 3; Sound.play('select'); }
    if (Input.hit('mleft')) { this.pauseTab = ((this.pauseTab || 0) + 2) % 3; Sound.play('select'); }
    if (Input.hit('ok')) this.pauseAction(this.pauseSel);
    if (Input.hit('cancel') || (Input.hit('pause') && o.t > 0.1)) { G.overlay = null; Sound.play('cancel'); }
  } else if (o.kind === 'settings') {
    this.updSettings();
  }
};
UI.pickItem = function (i) {
  const o = G.overlay, it = o.items[i];
  if (!it) return;
  G.overlay = null;
  Sound.play('confirm');
  const p = G.player, col = it.view.col;
  FX.ring(p.x, p.cy, 4, 50, col, 0.5, 3);
  FX.burst(p.x, p.cy, { n: 30, c: [col, '#ffffff'], sp: [40, 200], glow: true });
  it.take();
};
UI.reroll = function () {
  const o = G.overlay;
  G.run.rerolls--;
  const items = o.reroll();
  if (items.length) o.items = items;
  o.t = 0.1; o.sel = 0;
  Sound.play('upgrade');
};
UI.pickDialog = function (i) {
  const c = G.overlay.choices[i];
  if (!c.ok) { Sound.play('error'); return; }
  G.overlay = null;
  Sound.play('confirm');
  c.fn();
};
UI.updEnd = function (dt) {
  const e = this.endScreen;
  if (!e) return;
  e.t += dt;
  if (e.t < 1.2) return;
  e.sel = navH(2, e.sel);
  if (Input.hit('ok')) this.endAction(e.sel);
};
UI.endAction = function (i) {
  Sound.play('confirm');
  if (i === 0) {
    const r = G.run, trial = r.hard ? Object.assign({}, r.hard.sel) : null;
    const id = r.heroId, weapon = r.weaponId, mode = r.mode;
    if (!trial) {
      this.heroSel = HERO_ORDER.indexOf(id); this.selWeapon(id);
      this.weaponSel[id] = Math.max(0, heroWeapons(id).findIndex(w => w.id === weapon));
      this.hardMode = false; this.modeId = mode; this.modeSel = mode === 'hard' ? 1 : 0;
      this.showcase = { i: 0, t: 0 };
      transition(() => {
        G.state = 'title'; G.overlay = null; this.screen = 'mode'; clearWorld(); G.player = null; Sound.music('title');
      });
      return;
    }
    transition(() => startRun(id, weapon, trial, mode));
  }
  else this.toTitle();
};

// =====================================================================
//  DRAW
// =====================================================================
UI.draw = function () {
  uctx.setTransform(1, 0, 0, 1, 0, 0);
  uctx.clearRect(0, 0, UW, UH);
  Gfx.artBegin();
  uctx.imageSmoothingEnabled = false;
  if (G.state === 'boot') this.drawBoot();
  else if (G.state === 'title') {
    if (this.screen === 'press' || this.screen === 'title') this.drawTitle();
    else if (this.screen === 'mode') this.drawMode();
    else if (this.screen === 'select') this.drawSelect();
    else if (this.screen === 'trial') this.drawTrial();
    else if (this.screen === 'talents') this.drawTalents();
    else if (this.screen === 'howto') this.drawHowto();
    else if (this.screen === 'settings') this.drawSettings();
  } else if (G.state === 'play') {
    this.drawHUD();
    if (G.overlay) this.drawOverlay();
  } else if (G.state === 'gameover' || G.state === 'victory') this.drawEnd();
  if (this.confirm) this.drawConfirm();
  // touch: an on-screen back button for menus that otherwise need ESC
  if (TouchUI.enabled && G.state === 'title' && !['press', 'title'].includes(this.screen) && !this.confirm) {
    region(6, 4, 52, 40, { onClick: () => { Input.virt('Escape', true); this.updTitle(0); Input.virt('Escape', false); } });
    panel(10, 8, 44, 32, { border: '#ff8a9a', corner: '#ffffff' });
    uctx.drawImage(iconOf('back', '#ffd0d8'), 16, 8, 32, 32);
  }
  if (G.trans) this.drawTrans();
};
UI.drawBoot = function () {
  uctx.fillStyle = '#000'; uctx.fillRect(0, 0, UW, UH);
  const p = G.bootProgress || 0;
  T('正在构筑熵能世界……', UW / 2, UH / 2 - 30, { color: '#b9a9ff', align: 'center' });
  bar(UW / 2 - 150, UH / 2, 300, 6, p, '#ff4fd8');
};

// ---------- TITLE ----------
UI.drawLogo = function (y) {
  const t = this.t;
  const cx = UW / 2;
  // glitch slices
  const gl = Math.sin(t * 13) > 0.97 ? rand(-6, 6) : 0;
  const s = 6;
  const w = Text.measure('熵刃', 12) * s;
  glowText('熵刃', cx + gl, y, { size: 12, scale: s, color: '#ffffff', glow: '#ff3b5c', align: 'center' });
  T('熵刃', cx - 3 + gl * 2, y, { size: 12, scale: s, color: '#ff2f6a', align: 'center', alpha: 0.25 });
  T('熵刃', cx + 3 - gl, y, { size: 12, scale: s, color: '#ffb070', align: 'center', alpha: 0.25 });
  // light sweep across the logo (only touches already-drawn pixels)
  const ph = (t % 4.5) / 4.5;
  if (ph < 0.3) {
    const bx = cx - w / 2 - 60 + (w + 120) * (ph / 0.3);
    uctx.save();
    uctx.globalCompositeOperation = 'source-atop';
    uctx.globalAlpha = 0.75;
    uctx.fillStyle = '#ffffff';
    uctx.beginPath(); uctx.moveTo(bx, y - 6); uctx.lineTo(bx + 26, y - 6); uctx.lineTo(bx - 4, y + 84); uctx.lineTo(bx - 30, y + 84); uctx.closePath(); uctx.fill();
    uctx.restore();
  }
  uctx.fillStyle = '#ff3b5c'; uctx.fillRect(cx - w / 2 - 20, y + 84, w + 40, 2);
  T('ENTROPY  BLADE', cx, y + 92, { size: 12, scale: 2, color: '#e8e0ff', align: 'center', outline: '#12081c' });
  T('—— 像素横版动作 · 熵能肉鸽 ——', cx, y + 126, { color: '#9a8acb', align: 'center' });
};
UI.drawTitle = function () {
  this.drawLogo(60);
  if (this.screen === 'press') {
    const a = 0.5 + 0.5 * Math.sin(this.t * 4);
    T('按任意键开始', UW / 2, 400, { scale: 2, color: '#ffffff', align: 'center', alpha: a, outline: '#12081c' });
    T('PRESS ANY KEY', UW / 2, 432, { color: '#9a8acb', align: 'center', alpha: a });
  } else {
    const x = UW / 2, y0 = 290;
    TITLE_ITEMS.forEach((it, i) => {
      const sel = this.sel === i;
      const y = y0 + i * 40;
      region(x - 120, y - 4, 240, 34, { onHover: () => { if (this.sel !== i) { this.sel = i; Sound.play('select'); } }, onClick: () => this.titleAction(i) });
      if (sel) {
        uctx.fillStyle = 'rgba(255,59,92,0.18)'; uctx.fillRect(x - 130, y - 4, 260, 32);
        uctx.fillStyle = '#ff3b5c'; uctx.fillRect(x - 130, y - 4, 3, 32); uctx.fillRect(x + 127, y - 4, 3, 32);
        T('▶', x - 112 + Math.sin(this.t * 8) * 3, y + 2, { scale: 2, color: '#ff3b5c' });
      }
      T(it, x, y + 2, { scale: 2, color: sel ? '#ffffff' : '#8a7aa8', align: 'center', outline: '#0a0612' });
    });
  }
  // footer
  uctx.fillStyle = 'rgba(5,3,10,0.7)'; uctx.fillRect(0, UH - 30, UW, 30);
  uctx.drawImage(iconOf('shard', '#b46cff'), 16, UH - 23);
  T(`熵晶 ${Save.data.crystals}`, 38, UH - 22, { color: '#d8c0ff' });
  const st = Save.data.stats;
  T(`挑战 ${st.runs} 次 · 通关 ${st.wins} 次`, 160, UH - 22, { color: '#7a6a98' });
  if (Save.data.titles.includes('劫主')) T('称号「劫主」', 416, UH - 22, { color: '#ffd23f' });
  T('↑↓ 选择   ENTER / J 确认   ESC 返回', UW - 16, UH - 22, { color: '#7a6a98', align: 'right' });
};

UI.drawMode = function () {
  uctx.fillStyle = 'rgba(5,2,12,0.82)'; uctx.fillRect(0, 0, UW, UH);
  T('开始游戏', UW / 2, 24, { scale: 2, color: '#ffffff', align: 'center', outline: '#12081c' });
  ['normal', 'hard'].forEach((id, i) => {
    const x = 54 + i * 442, y = 82, w = 410, h = 412, selected = this.modeSel === i;
    const col = i === 0 ? '#7fe8c8' : '#ff8a9a';
    region(x, y, w, h, { onHover: () => { if (this.modeSel !== i) { this.modeSel = i; Sound.play('select'); } }, onClick: () => this.selectMode(i) });
    panel(x, y, w, h, { border: selected ? col : '#3a2f5c', bg: selected ? '#161322' : '#0b0716' });
    T(DIFFICULTIES[id].name, x + w / 2, y + 24, { scale: 2, color: selected ? '#ffffff' : '#9a8aac', align: 'center' });
    difficultyBuffs(id).forEach((desc, j) => {
      const ry = y + 80 + j * 38;
      if (j % 2 === 0) { uctx.fillStyle = 'rgba(255,255,255,0.03)'; uctx.fillRect(x + 12, ry - 6, w - 24, 36); }
      Text.wrap(desc, w - 48).forEach((line, k) => T(line, x + 24, ry + k * 14, { color: selected ? '#e8e0ff' : '#9a8aac' }));
    });
  });
};

// ---------- HERO SELECT ----------
// a carousel of slanted art panels: the picked hero stands lit in the middle, the others wait dimmed at the sides
const sc0 = {};
function selGeo(s) {
  const a = Math.min(1, Math.abs(s));
  const top = lerp(38, 60, a), bot = lerp(406, 392, a);
  return { s, a, top, bot, w: lerp(300, 212, a), cx: 480 + s * 290, sk: (bot - top) * 0.15, fade: clamp((1.5 - Math.abs(s)) / 0.42, 0, 1) };
}
function selPath(c, g) {
  const l = g.cx - g.w / 2, r = g.cx + g.w / 2, k = g.sk / 2;
  c.beginPath(); c.moveTo(l + k, g.top); c.lineTo(r + k, g.top); c.lineTo(r - k, g.bot); c.lineTo(l - k, g.bot); c.closePath();
}
UI.drawSelect = function () {
  const n = HERO_ORDER.length;
  // ease the carousel toward the pick (the short way round)
  if (this.selRot === undefined) this.selRot = this.heroSel;
  let d = this.heroSel - this.selRot; d -= Math.round(d / n) * n;
  this.selRot = Math.abs(d) < 0.002 ? this.heroSel : this.selRot + d * 0.16;
  const id = HERO_ORDER[this.heroSel], h = HEROES[id], W0 = this.selWeapon(id);
  const c = Gfx.artCtx(), t = this.t;
  // backdrop: deep indigo, drifting light shafts, the picked hero's color pooling behind the middle
  const bg = c.createLinearGradient(0, 0, 0, UH);
  bg.addColorStop(0, '#0e0c22'); bg.addColorStop(0.55, '#171537'); bg.addColorStop(1, '#06050e');
  c.fillStyle = bg; c.fillRect(0, 0, UW, UH);
  const pool = c.createRadialGradient(480, 240, 20, 480, 240, 380);
  pool.addColorStop(0, rgba(h.color, 0.3)); pool.addColorStop(1, rgba(h.color, 0));
  c.fillStyle = pool; c.fillRect(0, 0, UW, UH);
  c.save(); c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 8; k++) {
    const x = ((k * 173 + t * 12) % 1240) - 140, w = 20 + (k % 3) * 14;
    c.fillStyle = `rgba(110,100,255,${0.02 + 0.012 * (k % 3)})`;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + w, 0); c.lineTo(x + w - 80, UH); c.lineTo(x - 80, UH); c.fill();
  }
  c.restore();
  // empty slots at the screen edges, waiting for heroes to come
  for (const s of [-1.68, 1.68]) {
    const g = selGeo(s);
    selPath(c, g); c.fillStyle = 'rgba(9,8,24,0.85)'; c.fill();
    c.lineWidth = 1.5; c.strokeStyle = '#25224c'; c.stroke();
  }
  // panels, far ones first
  const cards = HERO_ORDER.map((hid, i) => { let s = i - this.selRot; s -= Math.round(s / n) * n; return { hid, i, s, g: selGeo(s) }; })
    .sort((a, b) => Math.abs(b.s) - Math.abs(a.s));
  for (const o of cards) {
    const g = o.g, q = 1 - g.a, H = HEROES[o.hid], meta = PORTRAIT_META[o.hid];
    if (g.fade <= 0) continue;
    const L = g.cx - g.w / 2 - g.sk / 2, R = g.cx + g.w / 2 + g.sk / 2, ph = g.bot - g.top;
    c.save(); c.globalAlpha = g.fade;
    c.save(); c.translate(7, 9); selPath(c, g); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill(); c.restore();
    selPath(c, g); c.save(); c.clip();
    c.fillStyle = '#07060f'; c.fillRect(L, g.top, R - L, ph);
    // the painting, scaled to the panel's height and framed on the face (with a touch of parallax)
    const as = ph * 1.04;
    const ax = clamp(g.cx - meta.focus[0] * as - o.s * 24, R - as, L);
    c.drawImage(Portraits.get(o.hid, null, 383 * Gfx.artScale), ax, g.top - (as - ph) * 0.3, as, as);
    if (g.a > 0) {
      // waiting heroes: drained and sunk into the indigo
      c.globalCompositeOperation = 'saturation'; c.globalAlpha = g.fade * 0.75 * g.a; c.fillStyle = '#808080'; c.fillRect(L, g.top, R - L, ph);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = g.fade * 0.55 * g.a; c.fillStyle = '#12103a'; c.fillRect(L, g.top, R - L, ph);
      c.globalAlpha = g.fade;
    }
    if (q > 0) {
      // the pick: shade for the name plate, shade for the pedestal, a light sweep now and then
      const top = c.createLinearGradient(0, g.top, 0, g.top + 96);
      top.addColorStop(0, `rgba(5,3,12,${0.78 * q})`); top.addColorStop(1, 'rgba(5,3,12,0)');
      c.fillStyle = top; c.fillRect(L, g.top, R - L, 96);
      const bot = c.createLinearGradient(0, g.bot - 60, 0, g.bot);
      bot.addColorStop(0, 'rgba(5,3,12,0)'); bot.addColorStop(1, `rgba(5,3,12,${0.7 * q})`);
      c.fillStyle = bot; c.fillRect(L, g.bot - 60, R - L, 60);
      const sw = (t % 5.5) / 5.5;
      if (sw < 0.22) {
        const x = lerp(L - 120, R + 60, sw / 0.22);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = g.fade * 0.16 * q; c.fillStyle = '#ffffff';
        c.beginPath(); c.moveTo(x + 40, g.top); c.lineTo(x + 90, g.top); c.lineTo(x + 10, g.bot); c.lineTo(x - 40, g.bot); c.fill();
        c.globalCompositeOperation = 'source-over'; c.globalAlpha = g.fade;
      }
    }
    c.restore();
    // frame: a glowing rim on the pick, a dim edge with one colored accent on the others
    if (q > 0.01) {
      c.globalCompositeOperation = 'lighter';
      for (const [lw, al] of [[14, 0.05], [8, 0.1], [4, 0.24]]) { selPath(c, g); c.lineWidth = lw; c.strokeStyle = rgba(H.color, al * q); c.stroke(); }
      c.globalCompositeOperation = 'source-over';
    }
    selPath(c, g); c.lineWidth = 1.5; c.strokeStyle = q > 0.5 ? H.color : '#2e2a5c'; c.stroke();
    if (g.a > 0.01) {
      c.globalAlpha = g.fade * 0.7 * g.a; c.lineWidth = 2; c.strokeStyle = H.color;
      c.beginPath(); c.moveTo(g.cx - g.w / 2 + g.sk / 2, g.top); c.lineTo(g.cx - g.w / 2 + g.sk / 2 - g.sk * 0.35, g.top + ph * 0.35); c.stroke();
      c.globalAlpha = g.fade;
    }
    if (q > 0.01) portraitMotes(c, meta.fx, L - 10, g.top, R - L + 20, ph, t, 18, q);
    c.restore();
  }
  // pedestal under the pick, carrying the weapon chooser
  {
    const pg = c.createLinearGradient(300, 0, 660, 0);
    pg.addColorStop(0, rgba(h.color, 0)); pg.addColorStop(0.5, rgba(h.color, 0.95)); pg.addColorStop(1, rgba(h.color, 0));
    c.fillStyle = 'rgba(8,6,20,0.92)';
    c.beginPath(); c.moveTo(344, 411); c.lineTo(616, 411); c.lineTo(602, 434); c.lineTo(358, 434); c.closePath(); c.fill();
    c.lineWidth = 1; c.strokeStyle = rgba(h.color, 0.55); c.stroke();
    c.fillStyle = pg; c.fillRect(290, 409, 380, 2);
  }

  // ---- UI layer: names, records, weapon, info ----
  const title = this.hardMode ? '劫难挑战 · 选择角色与武器' : '选择角色与武器';
  T(title, TouchUI.enabled ? 66 : 24, 10, { scale: 2, color: this.hardMode ? '#ff8a9a' : '#ffffff', outline: '#12081c' });
  for (const o of cards) {
    const g = o.g, H = HEROES[o.hid], lx = g.cx - g.w / 2 + g.sk / 2, rx = g.cx + g.w / 2 + g.sk / 2;
    if (g.fade <= 0) continue;
    if (g.a < 0.5) {
      // the pick: name plate top-left, best score top-right
      const ta = clamp(1 - g.a * 2.5, 0, 1);
      T(H.name, lx + 14, g.top + 12, { scale: 3, color: '#ffffff', outline: '#0a0612', alpha: ta });
      T(`${H.en} · ${H.title}`, lx + 12, g.top + 54, { color: H.color, outline: '#0a0612', alpha: ta });
      T(H.role, lx + 10, g.top + 70, { size: 8, color: '#c8c0e0', outline: '#0a0612', alpha: ta });
      const best = (Save.data.heroBest || {})[o.hid];
      uctx.globalAlpha = ta;
      uctx.fillStyle = '#ffd23f'; uctx.fillRect(rx - 74, g.top + 10, 60, 16);
      uctx.fillStyle = '#b8862f'; uctx.fillRect(rx - 74, g.top + 24, 60, 2);
      uctx.globalAlpha = 1;
      T('最高评分', rx - 44, g.top + 11, { color: '#2a1608', align: 'center', alpha: ta });
      scoreDigits(best || '----', rx - 16, g.top + 32, 2, best ? '#ffffff' : '#8a84b0', ta, 'right');
      region(g.cx - g.w / 2, g.top, g.w, g.bot - g.top, { onClick: () => this.startGame() });
    } else {
      const ta = g.fade * 0.85;
      T(H.name, lx + 12, g.top + 10, { scale: 2, color: '#b8b2dc', outline: '#0a0612', alpha: ta });
      T(H.en, lx + 14 + Text.measure(H.name, 12) * 2 + 6, g.top + 22, { size: 8, color: H.color, alpha: ta });
      region(g.cx - g.w / 2 + 14, g.top, g.w - 28, g.bot - g.top, { onClick: () => { this.heroSel = o.i; this.showcase = { i: 0, t: 0 }; Sound.play('select'); } });
    }
  }
  {
    // weapon chooser: ◀ icon name ▶, with one pip per weapon
    const wl = heroWeapons(id), wi = wl.indexOf(W0), label = `${W0.name} · ${W0.type}`;
    const lw = 20 + Text.measure(label, 12), wx = 480 - lw / 2;
    uctx.drawImage(iconOf(W0.icon, W0.col), wx, 414);
    T(label, wx + 20, 415, { color: W0.col, outline: '#05030a' });
    const pulse = 0.6 + 0.4 * Math.sin(t * 5);
    T('◀', 372, 415, { color: '#ffffff', alpha: pulse }); T('▶', 576, 415, { color: '#ffffff', alpha: pulse });
    for (let k = 0; k < wl.length; k++) { uctx.fillStyle = k === wi ? W0.col : '#3a3466'; uctx.fillRect(480 - wl.length * 6 + k * 12, 400, 9, 3); }
    region(356, 409, 44, 28, { onClick: () => this.cycleWeapon(-1) });
    region(560, 409, 44, 28, { onClick: () => this.cycleWeapon(1) });
    region(400, 409, 160, 28, { onClick: () => this.cycleWeapon(1) });
  }
  const x0 = 24, by = 440, bw = 912, bh = 80;
  panel(x0, by, bw, bh, { border: h.color, alpha: 0.9 });
  const stats = [['生命', h.hp / 130], ['攻击', h.atk / 12], ['速度', (h.speed - 100) / 45], ['射程', id === 'eve' ? 1 : id === 'rin' ? 0.45 : 0.3]];
  stats.forEach(([nm, v], k) => {
    const sy = by + 6 + k * 17;
    T(nm, x0 + 14, sy, { color: '#8a7aa8' });
    for (let q = 0; q < 10; q++) { uctx.fillStyle = q < Math.round(v * 10) ? h.color : '#2a2244'; uctx.fillRect(x0 + 46 + q * 10, sy + 4, 8, 6); }
  });
  // move showcase inset (right end of the info panel): the picked hero runs through their kit
  const iw = 156, ix = x0 + bw - iw - 6, iy = by + 5, ih = bh - 10;
  {
    const spr = SPR[id];
    const c2 = h.moves[h.combo].next, c3 = h.moves[c2].next;
    if (!sc0[id]) {
      const arts = Object.values(ARTS).filter(a => a.hero === id);
      const sk = Object.values(SKILLS).filter(s => s.hero === id && s.def && !s.ult).map(s => s.move);
      sc0[id] = [h.combo, c2, c3, h.moves[c3].next, ...arts[0].moves, 'charge1', sk[0], ...arts[2].moves.slice(0, 3), sk[2], 'counter', ...arts[4].moves.slice(0, 2), 'idle'];
    }
    const seq = sc0[id], sc = this.showcase;
    sc.t += 1 / 60;
    const anim = seq[sc.i % seq.length], A = spr.anims[anim];
    const dur = A.timed ? A.frames.length / ANIM_FPS + 0.15 : 0.8;
    if (sc.t > dur) { sc.t = 0; sc.i++; }
    const fr = A.timed ? A.frames[Math.min(A.frames.length - 1, Math.floor(sc.t * ANIM_FPS))] : animFrame(spr, anim, sc.t);
    uctx.fillStyle = '#05030a'; uctx.fillRect(ix - 1, iy - 1, iw + 2, ih + 2);
    uctx.fillStyle = '#0e0a1c'; uctx.fillRect(ix, iy, iw, ih);
    uctx.fillStyle = rgba(h.color, 0.18); uctx.fillRect(ix, iy + ih - 10, iw, 10);
    uctx.save(); uctx.beginPath(); uctx.rect(ix, iy, iw, ih); uctx.clip();
    drawSpriteUI(fr, spr.ox, spr.oy, ix + iw / 2 - 16, iy + ih - 10, 2, false, 1);
    uctx.restore();
    const lb = h.moves[anim] && h.moves[anim].label;
    if (lb) T(lb, ix + iw - 5, iy + 3, { size: 8, color: h.color, align: 'right', outline: '#05030a' });
  }
  const mx = x0 + 170, tw = ix - 12 - mx;
  const nMoves = Object.keys(h.moves).filter(k => k !== 'plungeLand').length;
  const nArt = Object.values(ARTS).filter(a => a.hero === id).length;
  const nSk = Object.values(SKILLS).filter(s => s.hero === id).length;
  const nU = Object.values(USKILLS).filter(s => s.hero === id).length;
  T(fitText(h.desc, tw), mx, by + 4, { color: '#ffffff' });
  uctx.drawImage(iconOf(W0.icon, W0.col), mx - 2, by + 18);
  T(`${W0.name} · ${W0.type}`, mx + 18, by + 19, { color: W0.col });
  const wx = mx + 18 + Text.measure(`${W0.name} · ${W0.type}`, 12) + 10;
  T(fitText(W0.desc, mx + tw - wx), wx, by + 19, { color: '#c8c0e0' });
  const us = U_SLOTS.map(sl => { const U = Object.values(USKILLS).find(s => s.hero === id && s.slot === sl.id); return U ? `${sl.input} ${U.name}` : ''; });
  T(fitText('技能  ' + us.join('  '), tw), mx, by + 34, { color: WX_FAM.u.col });
  const secs = SECRET_SLOTS.map(sl => { const S = Object.values(SKILLS).find(s => s.hero === id && s.slot === sl.id && s.def); return S ? `${sl.input} ${S.name}` : ''; });
  T(fitText('秘技  ' + secs.join('  '), tw), mx, by + 49, { color: '#7fd8ff' });
  T(fitText(`招式 ${nMoves} · 武技 ${nArt} · 技能 ${nU} · 秘技 ${nSk} · 武器 ${heroWeapons(id).length}     每门武学的等级上限与进阶效果各不相同`, tw, 8), mx, by + 66, { size: 8, color: '#ffb08a' });
  T(TouchUI.enabled ? `点按两侧角色切换 · 点按中间角色${this.hardMode ? '进入劫难契约' : '选择难度'} · 点按 ◀ ▶ 切换武器` : `←→ 角色   ↑↓ 武器   ENTER / J ${this.hardMode ? '下一步：劫难契约' : '下一步：选择难度'}   ESC 返回`, UW / 2, UH - 13, { color: '#7a6a98', align: 'center' });
};

// ---------- 劫难契约 ----------
UI.drawTrial = function () {
  uctx.fillStyle = 'rgba(8,2,10,0.82)'; uctx.fillRect(0, 0, UW, UH);
  const sel = Save.data.trialSel, pts = trialPoints(sel), rk = trialRank(pts);
  const h = HEROES[HERO_ORDER[this.heroSel]], W0 = this.selWeapon(h.id);
  glowText('劫难契约', 40, 14, { scale: 2, color: '#ffffff', glow: '#ff3048' });
  T(`${h.name} · ${W0.name}${W0.type}  —  自选劫数，劫难值越高，福缘越厚`, 40, 50, { color: '#c8b0c8' });
  // curses
  const x0 = 30, y0 = 76, rw = 560, rh = 32;
  CURSES.forEach((c, i) => {
    const y = y0 + i * rh, lv = sel[c.id] || 0, on = lv > 0, cur = this.trialSel === i;
    region(x0, y, rw, rh - 2, { onHover: () => { if (this.trialSel !== i) { this.trialSel = i; Sound.play('select'); } }, onClick: () => { this.trialSel = i; this.trialAdjust(i, 0); } });
    uctx.fillStyle = cur ? 'rgba(255,48,72,0.18)' : i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0)';
    uctx.fillRect(x0, y, rw, rh - 2);
    if (cur) { uctx.fillStyle = '#ff3048'; uctx.fillRect(x0, y, 3, rh - 2); }
    uctx.drawImage(iconOf(c.icon, on ? '#ff5a6a' : '#5a4a68'), x0 + 10, y + 7);
    T(c.name, x0 + 34, y + 8, { color: on ? '#ffffff' : '#9a8aac' });
    for (let k = 0; k < c.pts.length; k++) { uctx.fillStyle = k < lv ? '#ff3048' : '#2a2034'; uctx.fillRect(x0 + 110 + k * 12, y + 12, 9, 6); }
    T(c.desc(Math.max(1, lv)), x0 + 154, y + 8, { color: on ? '#ffd0d8' : '#6a5a78' });
    T(on ? `+${c.pts[lv - 1]}` : c.pts.map(v => '+' + v).join('/'), x0 + rw - 10, y + 8, { color: on ? '#ff8a9a' : '#5a4a68', align: 'right' });
  });
  // start button
  {
    const y = y0 + CURSES.length * rh + 4, cur = this.trialSel === CURSES.length;
    region(x0, y, rw, 30, { onHover: () => { this.trialSel = CURSES.length; }, onClick: () => { this.trialSel = CURSES.length; this.startGame(); } });
    panel(x0, y, rw, 30, { border: cur ? '#ff3048' : '#4a3048', bg: cur ? '#2a0a14' : '#0b0716' });
    T(`以「${rk.name}」之身出发  (劫难值 ${pts})`, x0 + rw / 2, y + 8, { color: cur ? '#ffffff' : '#c8a0b0', align: 'center' });
  }
  // right column: score + boons
  const rx = 610, rwid = 320;
  panel(rx, 76, rwid, 432, { border: rk.col });
  T('劫难值', rx + 18, 88, { color: '#c8b0c8' });
  T(String(pts), rx + 18, 106, { scale: 4, color: rk.col, outline: '#0a0612' });
  T(rk.name, rx + rwid - 18, 120, { scale: 2, color: rk.col, align: 'right', outline: '#0a0612' });
  const cfg = trialConfig(sel);
  T(`熵晶倍率 ×${cfg.crystalMul.toFixed(2)}`, rx + 18, 164, { color: '#d8c0ff' });
  if (Save.data.stats.bestTrial) T(`最高通关劫难值 ${Save.data.stats.bestTrial}`, rx + rwid - 18, 164, { color: '#8a7aa8', align: 'right' });
  T('福缘（劫难值达到即生效）', rx + 18, 188, { color: '#ffffff' });
  const boonRows = BOONS.map(b => ({ boon: b, lines: Text.wrap(b.name, rwid - 98) }));
  const heights = boonRows.map(b => Math.max(26, b.lines.length * 14 + 4));
  const gap = Math.max(0, Math.min(6, (288 - heights.reduce((sum, h) => sum + h, 0)) / boonRows.length));
  let by = 210;
  boonRows.forEach(({ boon: b, lines }, i) => {
    const y = by, got = pts >= b.pts;
    by += heights[i] + gap;
    uctx.fillStyle = got ? rgba(rk.col, 0.15) : 'rgba(0,0,0,0)'; uctx.fillRect(rx + 10, y - 4, rwid - 20, heights[i] + gap - 2);
    uctx.drawImage(iconOf(b.icon, got ? '#ffd23f' : '#4a3f5a'), rx + 16, y);
    T(String(b.pts), rx + 46, y + 1, { color: got ? '#ffd23f' : '#5a4f6a' });
    lines.forEach((line, j) => T(line, rx + 72, y + 1 + j * 14, { color: got ? '#ffffff' : '#6a5a78' }));
  });
  T('↑↓ 选择   ←→ / ENTER 调整劫数   选「出发」或按 R 开始   ESC 返回', UW / 2, UH - 14, { color: '#7a6a98', align: 'center' });
};

// ---------- TALENTS ----------
UI.drawTalents = function () {
  uctx.fillStyle = 'rgba(5,2,12,0.7)'; uctx.fillRect(0, 0, UW, UH);
  T('熵能天赋', UW / 2, 22, { scale: 2, color: '#ffffff', align: 'center', outline: '#12081c' });
  T('以熵晶永久强化你的力量。熵晶在每次挑战中获得，即使失败也会保留。', UW / 2, 56, { color: '#9a8acb', align: 'center' });
  uctx.drawImage(iconOf('shard', '#b46cff'), UW / 2 - 50, 78);
  T(`${Save.data.crystals}`, UW / 2 - 28, 79, { color: '#e0c8ff', scale: 1 });
  const cw = 400, chh = 64, x0 = (UW - cw * 2 - 20) / 2, y0 = 104;
  TALENTS.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = x0 + col * (cw + 20), y = y0 + row * (chh + 10);
    const lv = Talents.lv(t.id), max = lv >= t.max, cost = max ? 0 : t.cost(lv);
    const sel = this.talSel === i;
    region(x, y, cw, chh, { onHover: () => { if (this.talSel !== i) { this.talSel = i; Sound.play('select'); } }, onClick: () => { this.talSel = i; this.buyTalent(t); } });
    const fl = this.talFlash && this.talFlash.id === t.id ? Math.max(0, 1 - (this.t - (this.talFlash.t0 || (this.talFlash.t0 = this.t))) * 2) : 0;
    panel(x, y, cw, chh, { border: sel ? t.col : '#2a2244', bg: fl > 0 ? mix('#0b0716', t.col, fl * 0.5) : '#0b0716' });
    uctx.drawImage(iconOf(t.icon, t.col), x + 12, y + 12, 32, 32);
    T(t.name, x + 56, y + 10, { color: '#ffffff' });
    for (let k = 0; k < t.max; k++) { uctx.fillStyle = k < lv ? t.col : '#2a2244'; uctx.fillRect(x + 56 + Text.measure(t.name, 12) + 10 + k * 12, y + 14, 8, 6); }
    T(t.desc(Math.max(1, lv + (max ? 0 : 1))) + (max ? '' : lv ? '（下一级）' : ''), x + 56, y + 32, { color: '#9a8acb' });
    if (max) T('已满级', x + cw - 14, y + 10, { color: '#6aff8a', align: 'right' });
    else T(`${cost}`, x + cw - 14, y + 10, { color: Save.data.crystals >= cost ? '#e0c8ff' : '#ff5a5a', align: 'right' });
  });
  T('方向键 选择   ENTER / J 购买   ESC 返回', UW / 2, UH - 20, { color: '#7a6a98', align: 'center' });
};

// ---------- HOW TO ----------
UI.drawHowto = function () {
  uctx.fillStyle = 'rgba(5,2,12,0.82)'; uctx.fillRect(0, 0, UW, UH);
  T(this.howPage ? '战斗指南' : '操作说明', UW / 2, 22, { scale: 2, color: '#ffffff', align: 'center', outline: '#12081c' });
  if (this.howPage === 0) {
    const rows = [
      ['移动', 'A / D   或   ← / →', '左摇杆 / 十字键'],
      ['跳跃 · 二段跳 · 蹬墙跳', 'K   或   Space / Z', 'A'],
      ['攻击（连按连段）', 'J   或   X', 'X'],
      ['蓄力攻击', '长按 J', '长按 X'],
      ['武技：上段 / 下段', '↑ + J   /   ↓ + J', '↑ / ↓ + X'],
      ['冲刺（无敌）· 突进武技', 'L / Shift，冲刺中按 J', 'B / RB，冲刺中 X'],
      ['技能（远程，不耗灵力）', 'U', 'LB'],
      ['技能：上 / 下 / 冲刺', '↑ + U   /   ↓ + U   /   冲刺中 U', '↑ / ↓ + LB，冲刺中 LB'],
      ['秘技：静止 / 移动 / 空中', 'I   /   ← → + I   /   空中 I', 'Y（同左）'],
      ['秘技：上 / 下（奥义）', '↑ + I   /   ↓ + I', '↑ / ↓ + Y'],
      ['互动 / 进门 / 拾取', 'E   或   F', '十字键↑ / R3'],
      ['穿过平台', '↓ + 跳跃', '↓ + A'],
      ['暂停（含招式表）', 'ESC / P', 'START'],
    ];
    panel(110, 66, 740, 400, { border: '#3a2f5c' });
    T('动作', 140, 80, { color: '#ff3b5c' }); T('键盘', 400, 80, { color: '#ff3b5c' }); T('手柄', 680, 80, { color: '#ff3b5c' });
    rows.forEach((r, i) => {
      const y = 104 + i * 28;
      if (i % 2 === 0) { uctx.fillStyle = 'rgba(255,255,255,0.03)'; uctx.fillRect(120, y - 5, 720, 26); }
      T(r[0], 140, y, { color: '#e8e0ff' }); T(r[1], 400, y, { color: '#ffd36a' }); T(r[2], 680, y, { color: '#7ff7ff' });
    });
  } else {
    const tips = [
      ['见切', '在敌人攻击即将命中的瞬间冲刺，触发子弹时间；随后按攻击发动必暴击的反击。'],
      ['武学', '武技 / 技能 / 秘技同属武学。每门有自己的等级上限（1–3 级）和独有的进阶效果，卡牌上写明每一级给什么。'],
      ['武技（方向 + 攻击）', '↑ / ↓ / 冲刺中 + 攻击各有一门武技，升级逐步解锁派生、连段、终式，前一招后继续按攻击接出。'],
      ['技能（U + 方向）', 'U 是不耗灵力的远程技能，↑ / ↓ / 冲刺 + U 各是另一招，没有冷却，收招即可再放；解锁后施放中再按 U 出下一段，换方向则改出该方向的技能。'],
      ['秘技（I + 方向）', '静止、移动、↑、↓、空中各一招，消耗灵力；↓ + I 是奥义。解锁派生后，施放中再按 I 接出派生招式。'],
      ['灵力', '蓝条会自然恢复，命中敌人、极限闪避也会回复（技能命中回得少一些）。灵力不足时秘技无法施放。'],
      ['武器', '出发前用 ↑↓ 选择武器，每把武器改变属性与战斗特性（如散射、落雷、燃烧）。'],
      ['刻印 · 共鸣', '七大印系各有玩法，同一印系拥有 3 种刻印时触发共鸣。'],
      ['熵晶 · 地图', '熵晶用于天赋强化，失败也会保留。每局的每一关会从两三张地图里抽一张，每张图都有专属敌人与首领。'],
    ];
    panel(90, 66, 780, 400, { border: '#3a2f5c' });
    tips.forEach((tp, i) => {
      const y = 80 + i * 43;
      uctx.drawImage(iconOf(['eye', 'scroll', 'fist', 'wave', 'star', 'orb', 'sword', 'ring', 'shard'][i], ['#9ab8ff', '#ff8a5a', '#ff8a5a', '#7fe8a8', '#5ad8ff', '#3a8cff', '#ffd23f', '#c46aff', '#b46cff'][i]), 112, y);
      T(tp[0], 140, y, { color: '#ffffff' });
      Text.wrap(tp[1], 710).slice(0, 2).forEach((l, k) => T(l, 140, y + 15 + k * 14, { color: '#9a8acb' }));
    });
  }
  region(UW / 2 - 120, UH - 36, 240, 30, { onClick: () => { this.howPage ^= 1; Sound.play('select'); } });
  T(TouchUI.enabled ? '点按此处翻页' : '←→ 翻页   ESC 返回', UW / 2, UH - 22, { color: '#7a6a98', align: 'center' });
};

// ---------- SETTINGS ----------
UI.drawSettings = function () {
  uctx.fillStyle = 'rgba(5,2,12,0.82)'; uctx.fillRect(0, 0, UW, UH);
  T('游戏设置', UW / 2, 30, { scale: 2, color: '#ffffff', align: 'center', outline: '#12081c' });
  const st = Save.data.settings;
  const x = UW / 2 - 220, w = 440;
  SETTINGS.forEach((s, i) => {
    const y = 90 + i * 38;
    const sel = this.setSel === i;
    region(x, y - 6, w, 32, { onHover: () => { if (this.setSel !== i) { this.setSel = i; Sound.play('select'); } }, onClick: () => { this.setSel = i; if (s.type === 'slider') { const fx = (Input.mouse.x - (x + 220)) / 180; if (fx >= 0 && fx <= 1) { st[s.id] = Math.round(fx * 10) / 10; Sound.applyVolumes(); Save.write(); Sound.play('select'); } } else this.settingAction(s, 0); } });
    if (sel) { uctx.fillStyle = 'rgba(255,59,92,0.15)'; uctx.fillRect(x, y - 6, w, 32); uctx.fillStyle = '#ff3b5c'; uctx.fillRect(x, y - 6, 3, 32); }
    T(s.name, x + 16, y, { color: sel ? '#ffffff' : '#9a8acb' });
    if (s.type === 'slider') {
      bar(x + 220, y + 4, 180, 8, st[s.id], sel ? '#ff3b5c' : '#7a6a98');
      T(Math.round(st[s.id] * 100) + '%', x + w + 8, y, { color: '#e8e0ff' });
    } else if (s.type === 'toggle') {
      T(st[s.id] ? '开启' : '关闭', x + w - 16, y, { color: st[s.id] ? '#6aff8a' : '#ff5a5a', align: 'right' });
    } else if (s.id === 'fullscreen') T(document.fullscreenElement ? '退出' : '进入', x + w - 16, y, { color: '#ffd36a', align: 'right' });
  });
  T('↑↓ 选择   ←→ 调整   ENTER 确认   ESC 返回', UW / 2, UH - 22, { color: '#7a6a98', align: 'center' });
};

// ---------- CONFIRM ----------
UI.drawConfirm = function () {
  const c = this.confirm;
  uctx.fillStyle = 'rgba(0,0,0,0.6)'; uctx.fillRect(0, 0, UW, UH);
  panel(UW / 2 - 240, UH / 2 - 70, 480, 140, { border: '#ff3b5c', corner: '#ffffff' });
  T(c.text, UW / 2, UH / 2 - 44, { color: '#ffffff', align: 'center' });
  ['确定', '取消'].forEach((s, i) => {
    const x = UW / 2 - 110 + i * 120, y = UH / 2 + 10;
    const sel = c.sel === i;
    region(x, y, 100, 32, { onHover: () => { c.sel = i; }, onClick: () => { this.confirm = null; if (i === 0) c.yes(); else Sound.play('cancel'); } });
    panel(x, y, 100, 32, { border: sel ? '#ff3b5c' : '#3a2f5c', bg: sel ? '#2a0a18' : '#0b0716' });
    T(s, x + 50, y + 9, { color: sel ? '#ffffff' : '#9a8acb', align: 'center' });
  });
};

// =====================================================================
//  HUD
// =====================================================================
UI.drawHUD = function () {
  const p = G.player, r = G.run;
  if (!p) return;
  const cx = Cam.rx, cy = Cam.ry;
  const h = p.hero;
  // world-anchored labels: doors, prompts
  for (const it of G.inters) {
    if (it instanceof Door && it.active) {
      const L = it.label();
      const x = (it.x - cx) * 2, y = (it.y - cy) * 2 - 158;
      T(L.name, x, y, { color: L.col, align: 'center', outline: '#0a0612' });
    }
  }
  if (G.near && !G.overlay) {
    const it = G.near;
    const x = (it.x - cx) * 2, y = (it.y - it.h - cy) * 2 - 34;
    const label = it.prompt();
    if (label) {
      const kw = Text.measure(label, 12) + 34;
      panel(x - kw / 2, y - 4, kw, 24, { border: '#ffd36a' });
      if (Input.lastDevice === 'pad') keyCap(x - kw / 2 + 6, y + 1, '↑', '#ffd36a'); else ctrlCap(x - kw / 2 + 4, y + 2, 'interact', '#ffd36a');
      T(label, x - kw / 2 + 26, y + 1, { color: '#ffffff' });
    }
    if (it instanceof Pedestal && !it.sold) {
      const lines = Text.wrap(it.desc(), 230);
      const ph = 36 + lines.length * 16;
      const px = clamp(x - 125, 8, UW - 258), py = y - ph - 10;
      panel(px, py, 250, ph, { border: '#ffd23f' });
      T(it.name(), px + 12, py + 8, { color: it.item.kind === 'sigil' ? RARITY[it.item.u.rarity].col : '#ffffff' });
      lines.forEach((l, k) => T(l, px + 12, py + 28 + k * 16, { color: '#c8c0e0' }));
    }
  }
  // ---- top-left player panel ----
  panel(10, 10, 314, 76, { alpha: 0.75 });
  const hpF = p.hp / p.maxHp;
  {
    // avatar: the portrait's face; flinches and flashes when hit, red pulse when low
    uctx.fillStyle = '#05030a'; uctx.fillRect(14, 14, 68, 68);
    uctx.fillStyle = p.hurtFlash > 0 ? '#ffffff' : h.color; uctx.fillRect(15, 15, 66, 66);
    const hit = clamp((p.hurtFlash + 0.35) / 0.6, 0, 1);
    const jx = hit > 0 ? Math.round(Math.sin(this.t * 90) * 2 * hit) : 0;
    uctx.clearRect(16, 16, 64, 64);
    const ac = Gfx.artCtx();
    ac.save(); ac.beginPath(); ac.rect(16, 16, 64, 64); ac.clip();
    ac.drawImage(Portraits.get(p.heroId, PORTRAIT_META[p.heroId].face, 68 * Gfx.artScale), 14 + jx, 14, 68, 68);
    if (p.hp <= 0) { ac.globalCompositeOperation = 'saturation'; ac.fillStyle = '#808080'; ac.fillRect(16, 16, 64, 64); }
    ac.restore();
    if (hit > 0) { uctx.fillStyle = `rgba(255,40,70,${0.45 * hit})`; uctx.fillRect(16, 16, 64, 64); }
    if (p.hurtFlash > 0.15) { uctx.fillStyle = 'rgba(255,255,255,0.5)'; uctx.fillRect(16, 16, 64, 64); }
    if (hpF < 0.3) { uctx.fillStyle = `rgba(255,30,60,${0.12 + 0.12 * Math.sin(this.t * 7)})`; uctx.fillRect(16, 16, 64, 64); }
  }
  this.hp.trail = Math.max(hpF, this.hp.trail - 1 / 60 * 0.6);
  if (this.hp.trail < hpF) this.hp.trail = hpF;
  bar(90, 18, 224, 14, hpF, hpF < 0.3 ? (Math.floor(this.t * 6) % 2 ? '#ff3b5c' : '#ff8a9a') : '#ff3b5c', { trail: this.hp.trail, bg: '#2a0a18' });
  if (p.shield > 0) { uctx.fillStyle = '#7ff0ff'; uctx.fillRect(90, 18, Math.min(224, Math.round(224 * p.shield / p.maxHp)), 4); }
  T(`${Math.ceil(p.hp)} / ${p.maxHp}`, 96, 18, { size: 12, color: '#ffffff', outline: '#2a0a18' });
  // mana (灵力) with tick marks at every 10
  {
    const mx = 90, my = 40, mw = 224, mh = 7;
    const mf = p.mana / p.stats.maxMana;
    const flash = p.manaFlash > 0 && Math.floor(this.t * 16) % 2;
    bar(mx, my, mw, mh, mf, flash ? '#ff5a7a' : '#3a8cff', { bg: '#0a1430' });
    uctx.fillStyle = 'rgba(160,220,255,0.55)'; uctx.fillRect(mx, my, Math.round(mw * mf), 2);
    uctx.fillStyle = '#05030a';
    for (let v = 10; v < p.stats.maxMana; v += 10) uctx.fillRect(mx + Math.round(mw * v / p.stats.maxMana), my, 1, mh);
    const ult = p.secrets.down && SKILLS[p.secrets.down.id];
    if (ult) { const ux = mx + Math.round(mw * Math.min(1, skillCost(p, ult) / p.stats.maxMana)); uctx.fillStyle = p.mana >= skillCost(p, ult) ? '#ffffff' : '#ffd23f'; uctx.fillRect(ux - 1, my - 3, 2, mh + 6); }
    T(`${Math.floor(p.mana)}`, mx + 4, my - 2, { size: 8, color: '#e8f4ff', outline: '#0a1430' });
  }
  // dashes + weapon
  for (let i = 0; i < p.stats.dashes; i++) {
    const on = i < p.dashes;
    const x = 92 + i * 12, y = 62;
    uctx.fillStyle = on ? '#7ff0ff' : '#2a2244';
    uctx.fillRect(x + 2, y, 4, 8); uctx.fillRect(x, y + 2, 8, 4);
  }
  if (p.wpn) { uctx.drawImage(iconOf(p.wpn.icon, p.wpn.col), 232, 58); T(`${p.wpn.name}·${p.wpn.type}`, 314, 61, { size: 8, color: p.wpn.col, align: 'right' }); }
  // ---- 秘技 bar (I + direction), bottom-right ----
  {
    const now = p.onGround ? (Input.down('up') ? 'up' : Input.down('down') ? 'down' : Input.axisX() ? 'move' : 'stand') : 'air';
    const order = ['stand', 'move', 'up', 'down', 'air'];
    const sz = 34, gap = 8;
    let ax = UW - 14 - order.length * (sz + gap) + gap;
    // on touch screens the bottom-right corner belongs to the thumb buttons
    const top = TouchUI.enabled;
    const ay = top ? 92 : UH - 66;
    for (const sid of order) {
      const x = ax, y = ay, s = p.secrets[sid], sl = slotInfo(SECRET_SLOTS, sid);
      const S = s && SKILLS[s.id], cost = S ? skillCost(p, S) : 0, ok = S && p.mana >= cost, cur = sid === now;
      uctx.fillStyle = cur ? '#7fd8ff' : '#05030a'; uctx.fillRect(x - 2, y - 2, sz + 4, sz + 4);
      uctx.fillStyle = S && S.ult ? '#1c1030' : '#10142a'; uctx.fillRect(x, y, sz, sz);
      if (S) {
        if (ok && S.ult) { uctx.fillStyle = rgba(h.color, 0.25 + 0.2 * Math.sin(this.t * 6)); uctx.fillRect(x, y, sz, sz); }
        uctx.globalAlpha = ok ? 1 : 0.4;
        uctx.drawImage(iconOf(S.icon, S.ult ? h.color : '#7fd8ff'), x + 3, y + 3, 28, 28);
        uctx.globalAlpha = 1;
        if (!ok) { const f = clamp(p.mana / cost, 0, 1); uctx.fillStyle = 'rgba(0,0,0,0.55)'; uctx.fillRect(x, y, sz, Math.round(sz * (1 - f))); }
        for (let k = 0; k < wxMax(S); k++) { uctx.fillStyle = k < s.lv ? '#ffd23f' : '#2a2244'; uctx.fillRect(x + 3 + k * 5, y + sz - 5, 3, 3); }
        T(String(cost), x + sz - 2, y + sz - 10, { size: 8, color: ok ? '#bfe8ff' : '#6a7a9a', align: 'right', outline: '#05030a' });
      }
      T(sl.input, x + sz / 2, y - 12, { size: 8, color: cur ? '#ffffff' : '#7a8ab8', align: 'center' });
      if (S) T(S.name, x + sz / 2, y + sz + 4, { size: 8, color: cur ? '#e8f4ff' : '#8a8ab0', align: 'center' });
      ax += sz + gap;
    }
    // 技能 slots (U + direction, free, no cooldown), left of the 秘技 bar
    {
      const usz = 30, ugap = 8, ucur = p.uSlot(), unx = p.uNext();
      let ux = UW - 14 - order.length * (sz + gap) + gap - 20 - U_SLOTS.length * (usz + ugap) + ugap;
      const uy = ay + (sz - usz);
      for (const sl of U_SLOTS) {
        const x = ux, y = uy, s = p.uskills[sl.id], U = s && USKILLS[s.id], cur = sl.id === ucur;
        const chain = U && unx && unx.U === U;
        uctx.fillStyle = chain && Math.floor(G.time * 10) % 2 ? '#ffffff' : cur ? WX_FAM.u.col : '#05030a'; uctx.fillRect(x - 2, y - 2, usz + 4, usz + 4);
        uctx.fillStyle = '#0e1e1a'; uctx.fillRect(x, y, usz, usz);
        if (U) {
          uctx.drawImage(iconOf(U.icon, WX_FAM.u.col), x + 3, y + 3, 24, 24);
          // the next stage is open: show which one a press would give
          if (chain) T(['', '二', '三'][unx.stage], x + usz - 6, y + 2, { size: 8, color: '#ffffff', align: 'center', outline: '#05030a' });
          for (let k = 0; k < wxMax(U); k++) { uctx.fillStyle = k < s.lv ? WX_FAM.u.col : '#2a2244'; uctx.fillRect(x + 3 + k * 5, y + usz - 5, 3, 3); }
        }
        T(sl.input, x + usz / 2, y - 12, { size: 8, color: cur ? '#ffffff' : '#7ab8a0', align: 'center' });
        if (U) T(U.name, x + usz / 2, y + usz + 4, { size: 8, color: cur ? '#e8fff4' : '#8ab0a0', align: 'center' });
        ux += usz + ugap;
      }
    }
    // 武技 slots (direction + attack), one row above
    let bx = UW - 14 - 3 * 64;
    const byy = top ? ay + 64 : ay - 40;
    for (const sl of ART_SLOTS) {
      const a = p.arts[sl.id], A = a && ARTS[a.id];
      uctx.fillStyle = '#05030a'; uctx.fillRect(bx - 1, byy - 1, 20, 20);
      if (A) {
        uctx.drawImage(iconOf(A.icon, '#ff8a5a'), bx + 1, byy + 1);
        for (let k = 0; k < wxMax(A); k++) { uctx.fillStyle = k < a.lv ? '#ff8a5a' : '#2a2244'; uctx.fillRect(bx + 22 + k * 5, byy + 13, 3, 3); }
        T(A.name, bx + 22, byy + 1, { size: 8, color: '#ffc8a8' });
      } else T('—', bx + 9, byy + 3, { size: 8, color: '#4a3f6a', align: 'center' });
      T(sl.input, bx + 9, byy - 11, { size: 8, color: '#8a7a98', align: 'center' });
      bx += 64;
    }
  }
  // ---- charge gauge & counter cue (anchored to the player) ----
  {
    const px = (p.x - cx) * 2, py = (p.y - p.h - cy) * 2 - 22;
    if (p.state === 'charge') {
      const can2 = p.tech.charge2 || p.stats.charge2;
      const f = clamp(p.chargeT / (can2 ? CHARGE_L2 : CHARGE_L1), 0, 1);
      uctx.fillStyle = '#05030a'; uctx.fillRect(px - 26, py - 2, 52, 8);
      uctx.fillStyle = p.chargeLv === 2 ? '#ffffff' : p.chargeLv === 1 ? h.color : '#7a6a98';
      uctx.fillRect(px - 24, py, Math.round(48 * f), 4);
      if (can2) { uctx.fillStyle = '#ffffff'; uctx.fillRect(px - 24 + Math.round(48 * CHARGE_L1 / CHARGE_L2), py - 1, 1, 6); }
      T(p.chargeLv === 2 ? '极' : p.chargeLv === 1 ? '蓄' : '', px + 30, py - 5, { color: h.color, outline: '#0a0612' });
    }
    if (p.counterT > 0 && Math.floor(this.t * 10) % 2) {
      if (TouchUI.enabled) { T('见切！', px - 10, py - 18, { color: '#ffffff', align: 'center', outline: '#2a3a8a' }); ctrlCap(px + 22, py - 16, 'attack', '#ffffff'); }
      else T(`见切！按 ${Input.keyName('attack')} 反击`, px, py - 18, { color: '#ffffff', align: 'center', outline: '#2a3a8a' });
    }
  }
  // ---- top-right ----
  panel(UW - 170, 10, 160, 50, { alpha: 0.75 });
  uctx.drawImage(iconOf('coin', '#ffd23f'), UW - 160, 16);
  T(String(r.gold), UW - 138, 17, { color: '#ffd23f' });
  uctx.drawImage(iconOf('shard', '#b46cff'), UW - 160, 37);
  T(String(r.crystals), UW - 138, 38, { color: '#d8c0ff' });
  const tm = r.time;
  T(`${Math.floor(tm / 60)}:${String(Math.floor(tm % 60)).padStart(2, '0')}`, UW - 18, 17, { size: 8, color: '#7a6a98', align: 'right' });
  // ---- top-center progress ----
  const B = BIOMES[r.biome];
  const pw = BOSS_DEPTH * 18;
  const px0 = UW / 2 - pw / 2;
  T(`${SCENES[r.scene].label} · ${B.name}`, UW / 2, 10, { color: B.accent, align: 'center', outline: '#0a0612' });
  if (r.hard && r.hard.pts > 0) { const rk = trialRank(r.hard.pts); T(`劫 ${r.hard.pts} · ${rk.name}`, UW - 18, 64, { size: 8, color: rk.col, align: 'right', outline: '#0a0612' }); }
  for (let i = 1; i <= BOSS_DEPTH; i++) {
    const x = px0 + (i - 1) * 18, y = 30;
    const done = i < r.depth || (i === r.depth && G.rs && G.rs.cleared), cur = i === r.depth;
    if (i === BOSS_DEPTH) { uctx.drawImage(iconOf('skull', done ? '#ff3048' : cur ? '#ff8090' : '#4a3048'), x - 2, y - 4); continue; }
    uctx.fillStyle = done ? B.accent : cur ? '#ffffff' : '#2a2244';
    uctx.fillRect(x + 2, y, 8, 8);
    if (cur) { uctx.fillStyle = B.accent; uctx.fillRect(x, y + 10, 12, 2); }
  }
  // ---- blessings bottom-left ----
  const ids = Object.keys(p.mods).filter(id => UPG[id]);
  let bx = 12;
  const by = UH - 30;
  for (const sc of p.resonance || []) {
    uctx.fillStyle = SCHOOLS[sc].col;
    const a = 0.6 + 0.4 * Math.sin(this.t * 4);
    uctx.globalAlpha = a; uctx.fillRect(bx - 2, by - 22, 20, 3); uctx.globalAlpha = 1;
    T('共鸣', bx + 8, by - 36, { size: 8, color: SCHOOLS[sc].col, align: 'center' });
    bx += 24;
  }
  bx = 12;
  ids.forEach(id => {
    const u = UPG[id];
    uctx.fillStyle = '#05030a'; uctx.fillRect(bx - 2, by - 2, 20, 20);
    uctx.fillStyle = RARITY[u.rarity].col; uctx.fillRect(bx - 2, by + 16, 20, 2);
    uctx.drawImage(iconOf(u.icon, SCHOOLS[u.school].col), bx, by);
    if (p.mods[id] > 1) T(String(p.mods[id]), bx + 17, by + 8, { size: 8, color: '#ffffff', outline: '#000', align: 'right' });
    bx += 22;
  });
  // ---- combo ----
  if (p.combo >= 2) {
    if (p.combo !== this.lastCombo) { this.comboPop = 1; this.lastCombo = p.combo; }
    this.comboPop = Math.max(0, this.comboPop - 1 / 60 * 6);
    const x = UW - 30, y = TouchUI.enabled ? 230 : 170;
    const col = p.combo >= 50 ? '#ffd23f' : p.combo >= 20 ? '#ff8a2a' : '#ffffff';
    const s = 3 + (this.comboPop > 0.5 ? 1 : 0);
    T(String(p.combo), x, y - (s - 3) * 6, { scale: s, color: col, align: 'right', outline: '#12081c' });
    T('COMBO', x, y + 40, { color: col, align: 'right', outline: '#12081c' });
    uctx.fillStyle = '#2a2244'; uctx.fillRect(x - 70, y + 58, 70, 3);
    uctx.fillStyle = col; uctx.fillRect(x - 70, y + 58, Math.round(70 * clamp(p.comboT / p.stats.comboTime, 0, 1)), 3);
  } else this.lastCombo = 0;
  // ---- off-screen indicators ----
  if (!G.overlay && !G.bossIntro) {
    const edge = (wx, wy, col, label) => {
      const sx = (wx - cx) * 2, sy = (wy - cy) * 2;
      if (sx > 0 && sx < UW && sy > 0 && sy < UH) return;
      const ex = clamp(sx, 26, UW - 26), ey = clamp(sy, 90, UH - 60);
      const a = Math.atan2(sy - ey, sx - ex);
      const pulse = 0.65 + 0.35 * Math.sin(this.t * 6);
      uctx.save(); uctx.translate(ex, ey); uctx.rotate(a);
      uctx.globalAlpha = pulse; uctx.fillStyle = col;
      uctx.beginPath(); uctx.moveTo(10, 0); uctx.lineTo(-6, -7); uctx.lineTo(-2, 0); uctx.lineTo(-6, 7); uctx.closePath(); uctx.fill();
      uctx.restore(); uctx.globalAlpha = 1;
      if (label) T(label, ex + (ex > UW / 2 ? -16 : 16), ey - 6, { color: col, align: ex > UW / 2 ? 'right' : 'left', outline: '#0a0612', alpha: pulse });
    };
    for (const e of G.enemies) if (!e.dead && !e.spawning) edge(e.x, e.cy, e.boss ? '#ff3048' : '#ff5a6a');
    if (G.rs && G.rs.cleared) {
      const orb = G.inters.find(i => i instanceof Orb && i.active);
      const door = G.inters.find(i => i instanceof Door && i.active);
      if (orb) edge(orb.x, orb.y - 10, orb.info().col, orb.info().name);
      else if (door) edge(door.x, door.y - 20, '#7ff7ff', '出口');
    }
  }
  // ---- boss bar ----
  const b = G.boss;
  if (b && !b.dead && !G.bossIntro) {
    const w = 470, x = (UW - w) / 2 - 20, y = UH - 44;
    const f = b.hp / b.maxHp;
    this.bossTrail = this.bossTrail === undefined || this.bossTrail < f ? f : Math.max(f, this.bossTrail - 1 / 60 * 0.25);
    T(`${b.D.name}  ${b.D.en}`, x + w / 2, y - 22, { color: '#ffffff', align: 'center', outline: '#12081c' });
    bar(x, y, w, 12, f, b.phase > 1 ? '#ff2f4a' : '#ff5a6a', { bg: '#2a0a14', trail: this.bossTrail });
    uctx.fillStyle = '#ffffff'; uctx.fillRect(Math.round(x + w * Math.min(1, b.phase2At || 0.55)), y, 1, 12);
    if (b.type === 'king') uctx.fillRect(Math.round(x + w * 0.25), y, 1, 12);
    if (b.poiseDmg > 0) { uctx.fillStyle = '#ffd36a'; uctx.fillRect(x, y + 14, Math.round(w * Math.min(1, b.poiseDmg / b.D.poise)), 2); }
    // signature mechanic readouts
    if (b.type === 'warden') {
      const oni = b.oni > 0, ex = b.exhaust > 0;
      const f = oni ? b.oni / 6.5 : ex ? b.exhaust / 2.6 : (b.rage || 0) / 100;
      uctx.fillStyle = '#05030a'; uctx.fillRect(x - 1, y + 17, 122, 6);
      uctx.fillStyle = oni ? (Math.floor(this.t * 10) % 2 ? '#ff3a1a' : '#ffd23f') : ex ? '#8a8a9a' : '#ff6a2a';
      uctx.fillRect(x, y + 18, Math.round(120 * f), 4);
      T(oni ? '鬼化中' : ex ? '力竭' : '鬼怒', x + 128, y + 15, { size: 8, color: oni ? '#ff5a3a' : ex ? '#c8c8d8' : '#ffa060' });
    } else if (b.type === 'empress' && b.shielded) {
      T(`晶壁护体 · 晶柱 ${(b.pylons || []).filter(m => !m.dead).length}`, x, y + 16, { size: 8, color: '#7ff7ff' });
    } else if (b.type === 'king' && b.voidW > 0) {
      T('熵蚀 · 远离两侧虚空', x, y + 16, { size: 8, color: '#ff5a6a' });
    }
  }
  if (G.bossPhaseText) {
    const a = Math.min(1, G.bossPhaseText.t);
    glowText(G.bossPhaseText.text, UW / 2, 120, { scale: 3, color: '#ffffff', glow: '#ff3048', align: 'center', alpha: a });
  }
  // ---- boss intro card ----
  if (G.bossIntro && G.boss) {
    const t = G.bossIntro.t;
    const a = clamp(t - 0.5, 0, 1) * clamp((G.bossIntro.dur - t) * 2, 0, 1);
    const D = G.boss.D;
    const slide = (1 - Ease.outCubic(clamp(t - 0.5, 0, 1))) * 200;
    uctx.globalAlpha = a * 0.75; uctx.fillStyle = '#05000a'; uctx.fillRect(0, UH - 170, UW, 90); uctx.globalAlpha = 1;
    uctx.fillStyle = BIOME_GLOW[G.boss.bi]; uctx.globalAlpha = a; uctx.fillRect(0, UH - 170, UW, 2); uctx.fillRect(0, UH - 82, UW, 2); uctx.globalAlpha = 1;
    T(D.title, 80 - slide, UH - 160, { color: '#c8b8e8', alpha: a });
    glowText(D.name, 80 - slide, UH - 140, { scale: 4, color: '#ffffff', glow: BIOME_GLOW[G.boss.bi], alpha: a });
    T(D.en, 90 + Text.measure(D.name, 12) * 4 - slide, UH - 112, { scale: 2, color: BIOME_GLOW[G.boss.bi], alpha: a });
    if (D.stars) {
      const sx = UW - 400 + slide;
      T('难度', sx, UH - 160, { color: '#c8b8e8', alpha: a });
      for (let k = 0; k < 5; k++) T(k < D.stars ? '★' : '☆', sx + 40 + k * 16, UH - 160, { color: k < D.stars ? '#ffd23f' : '#4a3f5a', alpha: a });
      T(`风格 · ${D.style}`, sx + 140, UH - 160, { color: BIOME_GLOW[G.boss.bi], alpha: a });
      T(`特性「${D.trait}」`, sx, UH - 138, { color: '#ffffff', alpha: a });
      Text.wrap(D.traitDesc, 350).slice(0, 2).forEach((l, i) => T(l, sx, UH - 119 + i * 17, { color: '#d8c8e8', alpha: a }));
    }
  }
  // ---- banner ----
  if (G.banner && !G.bossIntro) {
    const bn = G.banner;
    const a = clamp(bn.t * 3, 0, 1) * clamp((3.5 - bn.t) * 1.5, 0, 1);
    const y = bn.big ? 130 : 110;
    uctx.globalAlpha = a * 0.7; uctx.fillStyle = '#05000a'; uctx.fillRect(0, y - 12, UW, bn.big ? 96 : 66); uctx.globalAlpha = 1;
    uctx.globalAlpha = a; uctx.fillStyle = bn.col; uctx.fillRect(UW / 2 - 160 * a, y - 12, 320 * a, 1); uctx.fillRect(UW / 2 - 160 * a, y + (bn.big ? 83 : 53), 320 * a, 1); uctx.globalAlpha = 1;
    glowText(bn.title, UW / 2, y, { scale: bn.big ? 4 : 2, color: '#ffffff', glow: bn.col, align: 'center', alpha: a });
    T(bn.sub, UW / 2, y + (bn.big ? 56 : 30), { color: bn.col, align: 'center', alpha: a });
  }
  // ---- toasts ----
  G.toasts.forEach((t, i) => {
    const a = clamp(t.t * 4, 0, 1) * clamp((3.2 - t.t) * 2, 0, 1);
    const y = 200 + i * 42 - Ease.outCubic(Math.min(1, t.t * 3)) * 10;
    const w = Math.max(Text.measure(t.title, 12) * 2, t.sub ? Text.measure(t.sub, 12) : 0) + 40;
    uctx.globalAlpha = a * 0.8; uctx.fillStyle = '#05000a'; uctx.fillRect(UW / 2 - w / 2, y - 6, w, t.sub ? 50 : 34); uctx.globalAlpha = 1;
    uctx.globalAlpha = a; uctx.fillStyle = t.col; uctx.fillRect(UW / 2 - w / 2, y - 6, 3, t.sub ? 50 : 34); uctx.globalAlpha = 1;
    T(t.title, UW / 2, y, { scale: 2, color: t.col, align: 'center', alpha: a, outline: '#0a0612' });
    if (t.sub) T(t.sub, UW / 2, y + 28, { color: '#d8d0f0', align: 'center', alpha: a });
  });
  // ---- control hints ----
  if (G.showHints > 0 && !G.overlay && !G.boss) {
    const a = clamp(G.showHints, 0, 1);
    const hints = [['attack', '攻击'], ['jump', '跳跃'], ['dash', '冲刺'], ['skill', '技能'], ['ult', '秘技'], ['interact', '互动']];
    let total = 0;
    for (const [k, n] of hints) total += Text.measure(n, 12) + 40;
    const cxh = UW / 2 - 70;
    let x = cxh - total / 2;
    const y = UH - 150;
    uctx.globalAlpha = a * 0.75; uctx.fillStyle = '#05000a'; uctx.fillRect(cxh - 310, y - 8, 620, 74); uctx.globalAlpha = a;
    for (const [k, n] of hints) { const w = ctrlCap(x, y, k); T(n, x + w + 4, y - 1, { color: '#e8e0ff' }); x += Text.measure(n, 12) + 40; }
    T('↑ / ↓ / 冲刺 + 攻击：武技 · U / ↑U / ↓U / 冲刺U：技能（不耗灵力，无冷却）', cxh, y + 20, { color: '#c8c0e0', align: 'center' });
    T('I + 方向：秘技（耗灵力，↓ + I 为奥义）· 施放后再按一次：下一段 · 命中瞬间冲刺：见切', cxh, y + 40, { color: '#9a8acb', align: 'center' });
    uctx.globalAlpha = 1;
  }
};

// =====================================================================
//  OVERLAYS
// =====================================================================
UI.drawOverlay = function () {
  const o = G.overlay;
  if (o.kind === 'pick') this.drawPick(o);
  else if (o.kind === 'dialog') this.drawDialog(o);
  else if (o.kind === 'pause') this.drawPause(o);
  else if (o.kind === 'settings') this.drawSettings();
};
UI.drawPick = function (o) {
  const p = G.player;
  const k = Ease.outCubic(clamp(o.t * 3, 0, 1));
  uctx.fillStyle = `rgba(5,0,14,${0.78 * k})`; uctx.fillRect(0, 0, UW, UH);
  glowText(o.title, UW / 2, 40 - (1 - k) * 20, { scale: 2, color: '#ffffff', glow: o.items[0] ? o.items[0].view.col : '#c46aff', align: 'center', alpha: k });
  const n = o.items.length;
  const cw = 262, ch = 320, gap = 22;
  const x0 = (UW - (cw * n + gap * (n - 1))) / 2, y0 = 96;
  o.items.forEach((it, i) => {
    const v = it.view;
    const sel = o.sel === i;
    const ek = Ease.outBack(clamp(o.t * 4 - i * 0.3, 0, 1));
    if (ek <= 0) return;
    const x = x0 + i * (cw + gap), y = y0 + (1 - ek) * 60 - (sel ? 10 : 0);
    region(x, y, cw, ch, { onHover: () => { if (o.sel !== i) { o.sel = i; Sound.play('select'); } }, onClick: () => { if (o.t > 0.35) { o.sel = i; this.pickItem(i); } } });
    uctx.globalAlpha = sel ? 1 : 0.8;
    panel(x, y, cw, ch, { border: v.frame, bg: '#0a0614', alpha: 0.95, corner: sel ? '#ffffff' : null });
    uctx.fillStyle = rgba(v.col, 0.22); uctx.fillRect(x + 2, y + 2, cw - 4, 92);
    for (let q = 0; q < 6; q++) { uctx.fillStyle = rgba(v.col, 0.05 * (6 - q)); uctx.fillRect(x + 2, y + 94 + q * 3, cw - 4, 3); }
    if (sel) {
      const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
      uctx.fillStyle = rgba(v.frame, 0.4 + 0.4 * pulse);
      uctx.fillRect(x - 4, y + 8, 2, ch - 16); uctx.fillRect(x + cw + 2, y + 8, 2, ch - 16);
    }
    uctx.fillStyle = rgba(v.col, 0.25);
    uctx.beginPath(); uctx.arc(x + cw / 2, y + 50, 36 + (sel ? Math.sin(this.t * 4) * 2 : 0), 0, TAU); uctx.fill();
    uctx.drawImage(iconOf(v.icon, v.col), x + cw / 2 - 32, y + 18, 64, 64);
    T(v.lvText, x + cw - 12, y + 10, { color: v.lvText === '新' || v.lvText === '新招式' ? '#ffd23f' : '#7ff7ff', align: 'right', outline: '#0a0612' });
    T(v.name, x + cw / 2, y + 108, { scale: 2, color: '#ffffff', align: 'center', outline: '#0a0612' });
    T(v.tag, x + cw / 2, y + 140, { color: v.frame, align: 'center' });
    const lines = Text.wrap(v.desc, cw - 36);
    lines.slice(0, 6).forEach((l, q) => T(l, x + 18, y + 166 + q * 18, { color: '#e0d8f4' }));
    if (v.sub) Text.wrap(v.sub, cw - 36).slice(0, 2).forEach((l, q) => T(l, x + 18, y + ch - 52 + q * 16, { color: '#8a7aa8' }));
    if (v.school && v.school !== 'core') {
      const sc = SCHOOLS[v.school];
      const have = schoolCount(p, v.school) + (v.lvText === '新' ? 1 : 0);
      const reso = (p.resonance || []).includes(v.school);
      T(reso ? `${sc.name}共鸣 已激活` : `${sc.name}共鸣 ${Math.min(3, have)}/3`, x + cw / 2, y + ch - 30, { color: reso || have >= 3 ? sc.col : '#6a5a88', align: 'center' });
      for (let q = 0; q < 3; q++) { uctx.fillStyle = q < have || reso ? sc.col : '#2a2244'; uctx.fillRect(x + cw / 2 - 26 + q * 18, y + ch - 12, 14, 3); }
    }
    uctx.globalAlpha = 1;
  });
  let hint = TouchUI.enabled ? '点按卡牌选择' : '←→ 选择   ENTER / J 确认';
  if (o.reroll && G.run.rerolls > 0) {
    if (TouchUI.enabled) {
      region(UW / 2 + 90, UH - 62, 84, 40, { onClick: () => { if (o.t > 0.2) this.reroll(); } });
      panel(UW / 2 + 94, UH - 58, 76, 32, { border: '#9a8acb', corner: '#ffffff' });
      uctx.drawImage(iconOf('reroll', '#c8b8ff'), UW / 2 + 100, UH - 58, 32, 32);
      T(String(G.run.rerolls), UW / 2 + 152, UH - 52, { scale: 2, color: '#ffffff', align: 'center', alpha: k });
    } else hint += `   R 重掷（剩余 ${G.run.rerolls}）`;
  }
  T(hint, TouchUI.enabled && o.reroll && G.run.rerolls > 0 ? UW / 2 - 50 : UW / 2, UH - 46, { color: '#9a8acb', align: 'center', alpha: k });
  // current loadout summary
  let x = 24;
  uctx.globalAlpha = k * 0.85;
  if (p.wpn) { uctx.drawImage(iconOf(p.wpn.icon, p.wpn.col), x, UH - 26); x += 26; }
  for (const sl of ART_SLOTS) { const a = p.arts[sl.id]; if (!a) continue; uctx.drawImage(iconOf(ARTS[a.id].icon, '#ff8a5a'), x, UH - 26); T(String(a.lv), x + 18, UH - 25, { size: 8, color: '#ffc8a8' }); x += 30; }
  x += 6;
  for (const sl of U_SLOTS) { const s = p.uskills[sl.id]; if (!s) continue; uctx.drawImage(iconOf(USKILLS[s.id].icon, WX_FAM.u.col), x, UH - 26); T(String(s.lv), x + 18, UH - 25, { size: 8, color: '#c8ffe0' }); x += 30; }
  x += 6;
  for (const sl of SECRET_SLOTS) { const s = p.secrets[sl.id]; if (!s) continue; uctx.drawImage(iconOf(SKILLS[s.id].icon, '#7fd8ff'), x, UH - 26); T(String(s.lv), x + 18, UH - 25, { size: 8, color: '#bfe8ff' }); x += 30; }
  x += 10;
  for (const id of Object.keys(p.mods)) if (UPG[id]) { const u = UPG[id]; uctx.drawImage(iconOf(u.icon, SCHOOLS[u.school].col), x, UH - 26); x += 20; }
  uctx.globalAlpha = 1;
};
UI.drawDialog = function (o) {
  uctx.fillStyle = 'rgba(5,0,14,0.6)'; uctx.fillRect(0, 0, UW, UH);
  const w = 640, h = 90 + o.choices.length * 34, x = (UW - w) / 2, y = UH - h - 40;
  panel(x, y, w, h, { border: '#ff3048', corner: '#ffffff' });
  T(o.title, x + 20, y + 14, { scale: 2, color: '#ff3048', outline: '#0a0612' });
  const shown = o.text.slice(0, Math.floor(o.t * 40));
  T(shown, x + 20, y + 48, { color: '#e8e0ff' });
  o.choices.forEach((c, i) => {
    const yy = y + 76 + i * 34;
    const sel = o.sel === i;
    region(x + 14, yy - 4, w - 28, 30, { onHover: () => { o.sel = i; }, onClick: () => { o.sel = i; this.pickDialog(i); } });
    if (sel) { uctx.fillStyle = 'rgba(255,48,72,0.18)'; uctx.fillRect(x + 14, yy - 4, w - 28, 30); uctx.fillStyle = '#ff3048'; uctx.fillRect(x + 14, yy - 4, 3, 30); }
    T((sel ? '▶ ' : '   ') + c.label, x + 26, yy + 3, { color: !c.ok ? '#5a4a68' : sel ? '#ffffff' : '#b9a9d9' });
  });
};
UI.drawPause = function (o) {
  uctx.fillStyle = 'rgba(5,0,14,0.78)'; uctx.fillRect(0, 0, UW, UH);
  glowText('暂停', 120, 50, { scale: 3, color: '#ffffff', glow: '#ff3b5c' });
  this.pauseItems().forEach((s, i) => {
    const y = 140 + i * 44, sel = this.pauseSel === i;
    region(80, y - 6, 240, 36, { onHover: () => { this.pauseSel = i; }, onClick: () => this.pauseAction(i) });
    if (sel) { uctx.fillStyle = 'rgba(255,59,92,0.18)'; uctx.fillRect(80, y - 6, 240, 36); uctx.fillStyle = '#ff3b5c'; uctx.fillRect(80, y - 6, 3, 36); }
    T(s, 100, y, { scale: 2, color: sel ? '#ffffff' : '#8a7aa8' });
  });
  const p = G.player;
  const tab = this.pauseTab || 0;
  panel(370, 40, 570, 466, { border: '#3a2f5c' });
  ['构筑', '刻印', '招式表'].forEach((n, i) => {
    const x = 384 + i * 100, sel = tab === i;
    region(x, 46, 92, 24, { onClick: () => { this.pauseTab = i; Sound.play('select'); } });
    uctx.fillStyle = sel ? '#2a1830' : '#120c1e'; uctx.fillRect(x, 46, 92, 24);
    if (sel) { uctx.fillStyle = p.hero.color; uctx.fillRect(x, 68, 92, 2); }
    T(n, x + 46, 51, { color: sel ? '#ffffff' : '#7a6a98', align: 'center' });
  });
  T('←→ 切换', 926, 51, { color: '#5a4f7a', align: 'right' });
  const clip = (str, w) => { let s = str; while (Text.measure(s, 12) > w && s.length > 4) s = s.slice(0, -2); return s === str ? s : s + '…'; };
  const head = (str, y, col) => { uctx.fillStyle = rgba(col, 0.18); uctx.fillRect(382, y - 3, 546, 17); uctx.fillStyle = col; uctx.fillRect(382, y - 3, 2, 17); T(str, 390, y - 1, { color: col }); };
  if (tab === 0) {
    const s = p.stats;
    T(`攻击 ${p.atk.toFixed(1)}  暴击 ${Math.round(s.crit * 100)}%  爆伤 ${Math.round(s.critDmg * 100)}%  攻速 ${Math.round(s.atkSpeed * 100)}%  减伤 ${Math.round(s.armor * 100)}%`, 386, 78, { color: '#9a8acb' });
    T(`灵力 ${Math.floor(p.mana)} / ${s.maxMana}   恢复 ${s.manaRegen.toFixed(1)}/秒   秘技消耗 ×${s.costMul.toFixed(2)}`, 386, 94, { color: '#7fa8ff' });
    // weapon
    const Wp = p.wpn;
    head('武器', 114, Wp.col);
    uctx.drawImage(iconOf(Wp.icon, Wp.col), 388, 131);
    T(`${Wp.name} · ${Wp.type}`, 410, 132, { color: Wp.col });
    T(clip(Wp.desc, 400), 520, 132, { color: '#c8c0e0' });
    // 武学: one compact row per input — name & level, what it does now, what the next pick brings
    const nextTxt = (fam, E, lv) => (lv >= wxMax(E) ? (wxMax(E) === 1 ? '只有一级' : '已满级') : `Lv${lv + 1}：${wxText(fam, E, lv + 1, p.hero)[0].split('（')[0]}`);
    const perkTxt = (E, lv) => wxPerksAt(E, lv).map(pk => ` ·「${pk.name}」`).join('');
    const row = (y, icon, col, label, now, next) => {
      uctx.drawImage(iconOf(icon, col), 388, y - 2);
      T(label, 410, y, { color: col });
      T(clip(now + (next ? '  · ' + next : ''), 924 - 560), 560, y, { color: '#b9b0d8' });
    };
    let y = 156;
    head('武技 · ↑ / ↓ / 冲刺 + 攻击', y, WX_FAM.art.col); y += 19;
    for (const sl of ART_SLOTS) {
      const a = p.arts[sl.id];
      if (!a) { T(`[${sl.input}] 未习得 — 默认「${p.hero.moves[{ up: 'rise', down: 'low', dash: 'dashAtk' }[sl.id]].label}」，参悟武学习得`, 410, y, { color: '#5a4f7a' }); y += 21; continue; }
      const A = ARTS[a.id], names = A.moves.map(mn => p.hero.moves[mn].label);
      row(y, A.icon, '#ffc8a8', `[${sl.input}] ${A.name} ${a.lv}/${wxMax(A)}`, names.slice(0, wxAt(A, a.lv).n).join('→') + perkTxt(A, a.lv), nextTxt('art', A, a.lv));
      y += 21;
    }
    head('技能 · U + 方向（不耗灵力 · 无冷却）', y + 2, WX_FAM.u.col); y += 21;
    for (const sl of U_SLOTS) {
      const s = p.uskills[sl.id];
      if (!s) continue;
      const U = USKILLS[s.id];
      row(y, U.icon, '#c8ffe0', `[${sl.input}] ${U.name} ${s.lv}/${wxMax(U)}`, U.moves.slice(0, wxAt(U, s.lv).n).map((mn, k) => uLabel(U, k)).join('→') + perkTxt(U, s.lv), nextTxt('u', U, s.lv));
      y += 21;
    }
    head('秘技 · I + 方向（消耗灵力）', y + 2, WX_FAM.sk.col); y += 21;
    for (const sl of SECRET_SLOTS) {
      const sk = p.secrets[sl.id];
      if (!sk) continue;
      const S = SKILLS[sk.id];
      row(y, S.icon, S.ult ? p.hero.color : '#bfe8ff', `[${sl.input}] ${S.name} ${sk.lv}/${wxMax(S)}`, `灵力 ${skillCost(p, S)}${p.skFollow(S.id) ? ' · 派生「' + S.fname + '」' : ''}` + perkTxt(S, sk.lv), nextTxt('sk', S, sk.lv));
      y += 21;
    }
    const techs = Object.keys(p.tech).filter(t => p.tech[t]);
    T(techs.length ? '已解锁招式：' + techs.map(t => TECHS[t].name).join('  ') : '已解锁招式：无', 386, Math.min(y + 4, 488), { color: '#ffd23f' });
  } else if (tab === 1) {
    const ids = Object.keys(p.mods).filter(id => UPG[id]);
    let y = 80;
    T(`刻印（${ids.length}）`, 386, y, { color: '#ffffff' }); y += 22;
    const rows = Math.max(1, Math.floor((470 - y) / 34));
    const pages = Math.max(1, Math.ceil(ids.length / rows));
    const page = Math.floor(this.t / 4) % pages;
    ids.slice(page * rows, page * rows + rows).forEach(id => {
      const u = UPG[id];
      uctx.drawImage(iconOf(u.icon, SCHOOLS[u.school].col), 386, y + 2);
      T(`${u.name} Lv${p.mods[id]}`, 410, y - 2, { color: RARITY[u.rarity].col });
      T(clip(u.desc(p.mods[id]), 510), 410, y + 14, { color: '#b9a9d9' });
      y += 34;
    });
    if (pages > 1) T(`${page + 1}/${pages}`, 926, 480, { color: '#6a5a88', align: 'right' });
    (p.resonance || []).forEach((sc, i) => T(clip(SCHOOLS[sc].reso, 540), 386, 486 - i * 16, { size: 8, color: SCHOOLS[sc].col }));
  } else {
    const list = heroMoveList(p.hero, p);
    const step = list.length > 15 ? 23 : 28, nU = Object.keys(p.uskills).length;
    list.forEach(([inp, name], i) => {
      const y = 82 + i * step;
      if (i % 2 === 0) { uctx.fillStyle = 'rgba(255,255,255,0.03)'; uctx.fillRect(380, y - 5, 550, step - 2); }
      T(inp, 392, y, { color: i >= 9 + nU ? '#7fd8ff' : i >= 9 ? WX_FAM.u.col : '#ffd36a' });
      T(clip(name || '—', 384), 540, y, { color: '#e8e0ff' });
    });
  }
};

// ---------- END SCREENS ----------
UI.drawEnd = function () {
  const e = this.endScreen;
  if (!e) return;
  const k = clamp(e.t, 0, 1);
  uctx.fillStyle = e.win ? `rgba(10,6,0,${0.7 * k})` : `rgba(8,0,4,${0.8 * k})`; uctx.fillRect(0, 0, UW, UH);
  const title = e.win ? '胜 利' : '陨 落';
  const col = e.win ? '#ffd23f' : '#ff3048';
  glowText(title, UW / 2, 50, { scale: 5, color: '#ffffff', glow: col, align: 'center', alpha: k });
  T(e.win ? '熵之王已陨落，混沌归于寂静。' : '熵潮吞没了你……但回响永不消散。', UW / 2, 130, { color: '#d8d0f0', align: 'center', alpha: k });
  const r = G.run, st = G.stats, P = G.player;
  const Wp = P.wpn;
  const artTxt = ART_SLOTS.map(sl => P.arts[sl.id]).filter(Boolean).map(a => `${ARTS[a.id].name}${a.lv}`).join(' · ') || '无';
  const rows = [
    ['角色', `${HEROES[r.heroId].name} · ${HEROES[r.heroId].title}`],
    ['武器', `${Wp.name} · ${Wp.type}`],
    ['抵达', `${SCENES[r.scene].label} · ${BIOMES[r.biome].name} ${r.depth}/${BOSS_DEPTH}`],
    ['用时', `${Math.floor(r.time / 60)}分${Math.floor(r.time % 60)}秒`],
    ['击杀 / 最高连击', `${st.kills} / ${st.maxCombo}`],
    ['武技', artTxt],
    ['秘技 / 奥义施放', `${st.skills} / ${st.ults}`],
    ['刻印', `${Object.keys(P.mods).filter(id => UPG[id]).length} 枚`],
    ['击败首领', st.bosses], ['获得熵晶', r.hard ? `${r.crystals}（劫 ${r.hard.pts} · ×${r.hard.crystalMul.toFixed(2)}）` : r.crystals],
  ];
  if (r.hard) rows.splice(2, 0, ['劫难值', `${r.hard.pts} · ${trialRank(r.hard.pts).name}`]);
  // portrait beside the ledger: in full color on a win, drained of it on a loss; the run's score over the art
  const qx = 120, qs = 240, px = qx + qs + 20;
  {
    const show = clamp((e.t - 0.15) * 3, 0, 1), hc = HEROES[r.heroId].color;
    uctx.globalAlpha = show;
    uctx.fillStyle = '#05030a'; uctx.fillRect(qx - 2, 168, qs + 4, qs + 4);
    uctx.fillStyle = e.win ? col : hc; uctx.fillRect(qx - 1, 169, qs + 2, qs + 2);
    uctx.globalAlpha = 1;
    drawArt(r.heroId, qx, 170, qs, { alpha: show, gray: e.win ? 0 : 0.85 });
    if (!e.win) { uctx.fillStyle = `rgba(40,0,14,${0.35 * show})`; uctx.fillRect(qx, 170, qs, qs); }
    for (let k = 0; k < 7; k++) { uctx.fillStyle = `rgba(6,3,12,${0.1 * (k + 1) * show})`; uctx.fillRect(qx, 170 + qs - 63 + k * 9, qs, 9); }
    if (e.score !== undefined) {
      const sh = clamp((e.t - 0.9) * 3, 0, 1);
      T('本局评分', qx + 12, 170 + qs - 56, { color: '#ffd23f', outline: '#0a0612', alpha: sh });
      scoreDigits(e.score, qx + 14, 170 + qs - 40, 3, '#ffffff', sh);
      if (e.best && e.score > 0) T('新纪录', qx + qs - 10, 170 + qs - 56, { color: '#ffd23f', outline: '#0a0612', align: 'right', alpha: sh * (0.7 + 0.3 * Math.sin(e.t * 6)) });
    }
    if (e.titleAwarded) T(`获得称号「${e.titleAwarded}」`, qx + qs / 2, 426, { color: col, align: 'center', alpha: k });
  }
  panel(px, 150, 460, 300, { border: col, alpha: 0.85 * k });
  rows.forEach(([a, b], i) => {
    const show = clamp((e.t - 0.3 - i * 0.1) * 4, 0, 1);
    const ry = 162 + i * (rows.length > 10 ? 26 : 28);
    T(a, px + 30, ry, { color: '#9a8acb', alpha: show });
    T(String(b), px + 430, ry, { color: i === rows.length - 1 ? '#d8c0ff' : i === 1 ? Wp.col : '#ffffff', align: 'right', alpha: show });
  });
  // build icons strip
  {
    const show = clamp((e.t - 1.2) * 3, 0, 1);
    uctx.globalAlpha = show;
    const icons = [[Wp.icon, Wp.col]];
    for (const sl of ART_SLOTS) if (P.arts[sl.id]) icons.push([ARTS[P.arts[sl.id].id].icon, '#ff8a5a']);
    for (const sl of U_SLOTS) if (P.uskills[sl.id]) icons.push([USKILLS[P.uskills[sl.id].id].icon, WX_FAM.u.col]);
    for (const sl of SECRET_SLOTS) if (P.secrets[sl.id]) icons.push([SKILLS[P.secrets[sl.id].id].icon, '#7fd8ff']);
    for (const id of Object.keys(P.mods)) if (UPG[id]) icons.push([UPG[id].icon, SCHOOLS[UPG[id].school].col]);
    const n = Math.min(icons.length, 26), w = n * 18;
    icons.slice(0, n).forEach(([ic, c], i) => uctx.drawImage(iconOf(ic, c), UW / 2 - w / 2 + i * 18, 456));
    uctx.globalAlpha = 1;
  }
  if (e.t > 1.2) {
    ['再次挑战', '返回标题'].forEach((s, i) => {
      const x = UW / 2 - 170 + i * 180, y = 484, sel = e.sel === i;
      region(x, y, 160, 38, { onHover: () => { e.sel = i; }, onClick: () => this.endAction(i) });
      panel(x, y, 160, 38, { border: sel ? col : '#3a2f5c', bg: sel ? '#1a0a14' : '#0b0716' });
      T(s, x + 80, y + 12, { color: sel ? '#ffffff' : '#9a8acb', align: 'center' });
    });
  }
};

// ---------- TRANSITION (diamond wipe) ----------
UI.drawTrans = function () {
  const tr = G.trans;
  const k = tr.phase === 'out' ? tr.t : 1 - tr.t;
  const s = 30;
  uctx.fillStyle = '#05020a';
  for (let y = -s; y < UH + s; y += s) for (let x = -s; x < UW + s; x += s) {
    const off = (x / UW) * 0.5 + (y / UH) * 0.2;
    const r = clamp(k * 1.7 - off, 0, 1) * s * 0.75;
    if (r <= 0) continue;
    uctx.beginPath(); uctx.moveTo(x, y - r); uctx.lineTo(x + r, y); uctx.lineTo(x, y + r); uctx.lineTo(x - r, y); uctx.closePath(); uctx.fill();
  }
};
function updTransition(dt) {
  const tr = G.trans;
  if (!tr) return;
  tr.t += dt * 2.6;
  if (tr.phase === 'out' && tr.t >= 1) { tr.phase = 'in'; tr.t = 0; try { tr.cb(); } catch (e) { console.error(e); } }
  else if (tr.phase === 'in' && tr.t >= 1) G.trans = null;
}
