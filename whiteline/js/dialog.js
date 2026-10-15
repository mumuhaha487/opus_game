/* =========================================================
   dialog.js —— 对话框（打字机效果 / 头像 / 选项），Promise 驱动
   G.dlg.say(who, text, opts) / G.dlg.choose(who, text, choices)
   who: 角色 id（nana/kuro/tanaka/shira/shiori/insp）| 'sys'（系统广播）| 'note'（铅笔字条）| null
   ========================================================= */
(function () {
  'use strict';
  const U = G.util;
  const D = (G.dlg = { open: false, queue: Promise.resolve() });
  let el, nameEl, textEl, choicesEl, nextEl, ptCv, ptCtx, ptBox;
  let typing = null, resolveFn = null, fullText = '', shown = 0, skipReq = false;

  D.init = function () {
    el = document.getElementById('dialog');
    nameEl = document.getElementById('dlg-name');
    textEl = document.getElementById('dlg-text');
    choicesEl = document.getElementById('dlg-choices');
    nextEl = document.getElementById('dlg-next');
    ptCv = document.getElementById('dlg-pt'); ptCtx = ptCv.getContext('2d'); ptCtx.imageSmoothingEnabled = false;
    ptBox = el.querySelector('.dlg-portrait');
    el.addEventListener('pointerdown', (ev) => { if (ev.target.closest('.dlg-choice')) return; ev.preventDefault(); D.advance(); });
  };
  const NAMES = { sys: '运行管理AI「白线」', note: '铅笔字迹', insp: '检札员' };
  const PT = { nana: 'pt_nana', kuro: 'pt_kuro', tanaka: 'pt_tanaka', shira: 'pt_shira', shiori: 'pt_shiori', sys: 'pt_system', insp: 'pt_system' };

  function render(str) {
    // 简单标记：{jp:…} 日语（另色）、*…* 强调、(…) 旁白
    return U.esc(str).replace(/\{jp:(.*?)\}/g, '<span class="jp">$1</span>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\[\[(.*?)\]\]/g, '<span class="note">$1</span>');
  }
  function plain(str) { return str.replace(/\{jp:(.*?)\}/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1'); }

  // 对话排队：新对话不会打断正在进行的对话；时间重置时 flush 掉过期的对话
  D.epoch = 0;
  D.show = function (who, text, opts = {}) {
    const ep = D.epoch;
    const p = D.queue.then(() => (ep === D.epoch ? showNow(who, text, opts) : undefined));
    D.queue = p.catch(() => {});
    return p;
  };
  D.flush = function () { D.epoch++; const r = resolveFn; resolveFn = null; D.close(); if (r) r(); };
  function showNow(who, text, opts = {}) {
    return new Promise((res) => {
      G.ui.closeInspectorForDialog && G.ui.closeInspectorForDialog();
      D.open = true; G.game && (G.game.dlgOpen = true);
      el.classList.remove('hidden', 'sys', 'pencil');
      if (who === 'sys') el.classList.add('sys');
      if (who === 'note') el.classList.add('pencil');
      const ch = G.CHARS[who];
      nameEl.textContent = opts.name || (ch ? ch.full : NAMES[who] || '');
      const pt = opts.pt || PT[who];
      if (pt && G.gfx.img[pt]) { ptBox.classList.remove('none'); ptCtx.clearRect(0, 0, 72, 72); ptCtx.drawImage(G.gfx.img[pt], 0, 0); }
      else ptBox.classList.add('none');
      choicesEl.innerHTML = ''; nextEl.style.visibility = 'hidden';
      fullText = text; shown = 0; skipReq = false; resolveFn = res;
      G.ui.positionDialog();
      const speed = [0.05, 0.03, 0.018, 0.004][G.settings.textSpeed] || 0.02;
      const chars = [...plain(text)];
      clearInterval(typing);
      const tick = () => {
        if (skipReq) shown = chars.length; else shown++;
        // 渲染：按纯文本长度截断标记文本
        textEl.innerHTML = render(truncateMarked(text, shown));
        if (shown % 2 === 0 && who !== 'note') G.audio.sfx('blip');
        if (shown >= chars.length) {
          clearInterval(typing); typing = null;
          if (opts.choices) showChoices(opts.choices);
          else nextEl.style.visibility = 'visible';
          if (opts.auto) setTimeout(() => { if (resolveFn === res) D.finish(); }, opts.auto * 1000);
        }
      };
      typing = setInterval(tick, speed * 1000);
      tick();
      if (D.auto) setTimeout(() => { if (resolveFn !== res) return; if (opts.choices) { const c = opts.choices[D.autoChoice || 0]; const r = resolveFn; resolveFn = null; D.close(); r(c && c.value != null ? c.value : D.autoChoice || 0); } else D.finish(); }, 40);
      if (opts.voice) G.audio.say(opts.voice);
    });
  }
  function truncateMarked(text, n) {
    let out = '', count = 0, i = 0;
    while (i < text.length && count < n) {
      if (text.startsWith('{jp:', i)) { const j = text.indexOf('}', i); const inner = text.slice(i + 4, j); const take = [...inner].slice(0, n - count).join(''); out += '{jp:' + take + '}'; count += [...take].length; i = j + 1; continue; }
      if (text[i] === '*') { const j = text.indexOf('*', i + 1); if (j > i) { const inner = text.slice(i + 1, j); const take = [...inner].slice(0, n - count).join(''); out += '*' + take + '*'; count += [...take].length; i = j + 1; continue; } }
      if (text.startsWith('[[', i)) { const j = text.indexOf(']]', i); if (j > i) { const inner = text.slice(i + 2, j); const take = [...inner].slice(0, n - count).join(''); out += '[[' + take + ']]'; count += [...take].length; i = j + 2; continue; } }
      const cp = text.codePointAt(i); const chr = String.fromCodePoint(cp); out += chr; i += chr.length; count++;
    }
    return out;
  }
  function showChoices(list) {
    choicesEl.innerHTML = '';
    list.forEach((c, i) => {
      const b = U.el('button', 'dlg-choice', U.esc(c.text || c));
      b.addEventListener('click', (ev) => { ev.stopPropagation(); G.audio.sfx('select'); const r = resolveFn; resolveFn = null; D.close(); r && r(c.value != null ? c.value : i); });
      choicesEl.appendChild(b);
    });
    const first = choicesEl.querySelector('button'); if (first && !('ontouchstart' in window)) first.focus();
  }
  D.advance = function () {
    if (typing) { skipReq = true; return; }
    if (choicesEl.children.length) return;
    D.finish();
  };
  D.finish = function () { const r = resolveFn; resolveFn = null; D.close(); r && r(); };
  D.close = function () { el.classList.add('hidden'); D.open = false; if (G.game) G.game.dlgOpen = false; clearInterval(typing); typing = null; };

  // 串行对话：await G.dlg.say(...)
  D.say = function (who, text, opts) { return D.show(who, text, opts); };
  D.choose = function (who, text, choices, opts = {}) { return D.show(who, text, Object.assign({}, opts, { choices })); };
  // 批量：[[who, text], ...]
  D.seq = async function (lines) { for (const l of lines) { if (typeof l === 'function') { await l(); continue; } await D.say(l[0], l[1], l[2] || {}); } };
  D.isOpen = () => D.open;
})();
