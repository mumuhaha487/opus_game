'use strict';
// =====================================================================
//  HUB — renders GAME.INC.RE from HUB_CATALOG: the live hot-games
//  carousel, every game grouped by category, likes and game details.
//  DOM is built with createElement/textContent only.
// =====================================================================
(() => {
  const CAT = window.HUB_CATALOG, GAMES = CAT.games, CATS = CAT.categories;
  // GameAccount is a top-level const in account-core.js, so it is not a window property
  const A = typeof GameAccount !== 'undefined' ? GameAccount : null, FILE = !A || A.file;
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const catOf = id => CATS.find(c => c.id === id) || { id, name: '其它', en: 'OTHER', color: '#a99cc4', desc: '' };
  const S = { likes: {}, mine: { guest: [], user: null }, loaded: false, slide: 0, order: [], cat: 'all', sort: 'new', q: '', paused: 0, hover: false };

  // ---------- tiny DOM helpers ----------
  function el(tag, o = {}, kids = []) {
    const n = document.createElement(tag);
    if (o.cls) n.className = o.cls;
    if (o.text !== undefined) n.textContent = o.text;
    if (o.style) for (const k in o.style) n.style.setProperty(k, o.style[k]);
    if (o.attrs) for (const k in o.attrs) n.setAttribute(k, o.attrs[k]);
    for (const k of kids) if (k) n.append(k);
    return n;
  }
  // pixel icons: rows of characters, one SVG path per color key
  function pix(rows, colors, cls) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', `0 0 ${rows[0].length} ${rows.length}`); s.setAttribute('shape-rendering', 'crispEdges'); s.setAttribute('aria-hidden', 'true');
    for (const key in colors) {
      let d = '';
      rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === key) { let w = 1; while (r[x + w] === key) w++; d += `M${x} ${y}h${w}v1h-${w}z`; x += w - 1; } });
      const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d);
      if (colors[key].startsWith('.')) p.setAttribute('class', colors[key].slice(1)); else p.setAttribute('fill', colors[key]);
      s.append(p);
    }
    if (cls) s.setAttribute('class', cls);
    return s;
  }
  const HEART = ['.oo...oo.', 'offo.offo', 'ofhfofffo', 'offfffffo', '.offfffo.', '..offfo..', '...ofo...', '....o....'];
  const heart = () => pix(HEART, { o: '.o', f: '.f', h: '.h' });
  const flame = () => pix(['....o.....', '...oo.....', '...ooo....', '..oooo.o..', '..oooooo..', '.oooooooo.', '.oooyyooo.', 'oooyyyyooo', 'oooyyyyooo', 'ooooyyoooo', '.oooooooo.', '..oooooo..'], { o: '#e0485e', y: '#f2c66d' });
  const playIcon = () => pix(['..................', '..................', '..................', '..................', '......aa..........', '......aaaa........', '......aaaaaa......', '......aaaaaaaa....', '......aaaaaaaaa...', '......aaaaaaaaa...', '......aaaaaaaa....', '......aaaaaa......', '......aaaa........', '......aa..........'], { a: '#f2c66d' });
  const arrow = () => pix(['aa......', 'aaaa....', 'aaaaaa..', 'aaaaaaaa', 'aaaaaa..', 'aaaa....', 'aa......'], { a: '#2a1608' });
  const PLAT = {
    keyboard: ['键盘', ['aaaaaaaaaaaa', 'abababababba', 'aaaaaaaaaaaa', 'abbababababa', 'aaaaaaaaaaaa', 'aaaaaaaaaaaa', 'aabbbbbbbbaa', 'aaaaaaaaaaaa']],
    gamepad: ['手柄', ['..aaaaaaaa..', '.aaaaaaaaaa.', 'aabaaaaabaaa', 'abbbaaaababa', 'aabaaaaabaaa', 'aaaaaaaaaaaa', 'aaa......aaa', 'aa........aa']],
    touch: ['触屏', ['.aaaaaaaaaa.', 'abbbbbbbbbba', 'abbbbbabbbba', 'abbbbbabbbba', 'abbbbaaabbba', 'abbbbbbbbbba', 'abbbbbbbbbba', '.aaaaaaaaaa.']],
    mouse: ['鼠标', ['....aaaa....', '...aabaaa...', '...aabaaa...', '...aaaaaa...', '...aaaaaa...', '...aaaaaa...', '...aaaaaa...', '....aaaa....']],
    pip: ['置顶小窗', ['aaaaaaaaaaaa', 'abbbbbbbbbba', 'abbbbbbbbbba', 'abbbbbbaaaba', 'abbbbbbaaaba', 'abbbbbbbbbba', 'aaaaaaaaaaaa', '............']],
  };

  // ---------- popularity ----------
  const NEW_DAYS = 14;
  const age = g => (Date.now() - Date.parse(g.released + 'T00:00:00+08:00')) / 864e5;
  const isNew = g => age(g) < NEW_DAYS;
  const likesOf = id => S.likes[id] || { total: 0, week: 0 };
  // weekly likes count double; a game is boosted for its first two weeks
  const heat = g => { const l = likesOf(g.id); return l.week * 2 + l.total + (isNew(g) ? 10 : 0); };
  const byHeat = (a, b) => heat(b) - heat(a) || (a.released < b.released ? 1 : a.released > b.released ? -1 : 0) || a.no - b.no;
  const hotOrder = () => GAMES.slice().sort(byHeat).slice(0, 6).map(g => g.id);

  // ---------- like buttons ----------
  const likeEls = new Map(); // id -> [{ btn, num }]
  const heatEls = new Map();
  const logged = () => Array.isArray(S.mine.user);
  const liked = id => (logged() ? S.mine.user.includes(id) : S.mine.guest.includes(id));
  function likeTitle(id) {
    if (FILE) return '在线版可以点赞';
    if (!S.loaded) return '正在读取点赞';
    if (logged()) return liked(id) ? '今天已经点过赞了，明天再来' : '点赞（今天还能点 1 次）';
    return liked(id) ? '今天已经点过赞了 · 登录账号后还能再点一次' : '点赞（今天还能点 1 次）';
  }
  function likeButton(g) {
    const num = el('b', { text: '·' });
    const btn = el('button', { cls: 'like px', attrs: { type: 'button', 'data-id': g.id } }, [heart(), num]);
    btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); like(g.id); });
    if (!likeEls.has(g.id)) likeEls.set(g.id, []);
    likeEls.get(g.id).push({ btn, num });
    paintLike(g.id);
    return btn;
  }
  function heatLabel(g) {
    const b = el('b', { text: '·' }), n = el('span', { cls: 'heat' }, [flame(), document.createTextNode('热度 '), b]);
    if (!heatEls.has(g.id)) heatEls.set(g.id, []);
    heatEls.get(g.id).push(b);
    b.textContent = S.loaded ? String(heat(g)) : '·';
    return n;
  }
  function paintLike(id, bump) {
    for (const { btn, num } of likeEls.get(id) || []) {
      if (!btn.isConnected && !document.getElementById('gd').contains(btn)) continue;
      const on = S.loaded && liked(id);
      btn.classList.toggle('on', on);
      btn.classList.toggle('off', FILE);
      btn.disabled = FILE || !S.loaded || on;
      btn.title = likeTitle(id);
      btn.setAttribute('aria-label', `点赞 ${GAMES.find(g => g.id === id).name}，共 ${likesOf(id).total} 个赞`);
      btn.setAttribute('aria-pressed', String(on));
      num.textContent = FILE ? '—' : S.loaded ? String(likesOf(id).total) : '·';
      if (bump) { btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump'); }
    }
    const g = GAMES.find(x => x.id === id);
    for (const b of heatEls.get(id) || []) b.textContent = S.loaded ? String(heat(g)) : '·';
  }
  function paintAll() { for (const g of GAMES) paintLike(g.id); }
  function burst(btn) {
    if (reduce) return;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, sp = el('i', { cls: 'sp', style: { '--dx': Math.round(Math.cos(a) * 22) + 'px', '--dy': Math.round(Math.sin(a) * 18) + 'px' } });
      btn.append(sp); setTimeout(() => sp.remove(), 650);
    }
  }
  let toastTimer = 0;
  function toast(text) { const t = $('toast'); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
  function apply(data) {
    if (!data) return;
    if (data.games) for (const id in data.games) S.likes[id] = data.games[id];
    if (data.game && data.count) S.likes[data.game] = data.count;
    if (data.mine) S.mine = { guest: data.mine.guest || [], user: Array.isArray(data.mine.user) ? data.mine.user : null };
    S.loaded = true;
  }
  async function like(id) {
    if (FILE || !S.loaded || liked(id)) return;
    for (const { btn } of likeEls.get(id) || []) btn.disabled = true;
    try {
      const r = await A.request('/api/like/' + encodeURIComponent(id), 'POST', {});
      apply(r);
      paintLike(id, true);
      for (const { btn } of likeEls.get(id) || []) if (btn.isConnected) burst(btn);
      toast(logged() ? '点赞成功，明天还能再来' : '点赞成功 · 登录账号后今天还能再点一次');
      reorderSoon();
    } catch (e) {
      if (e && e.data && e.data.error === 'already_liked') { apply(e.data); toast(logged() ? '今天已经点过赞了' : '这个网络今天已经点过赞了，登录账号后还能再点一次'); }
      else toast(e && e.data && e.data.error === 'rate_limited' ? '操作太频繁，请稍后再试' : '无法连接服务器，请稍后再试');
      paintLike(id);
    }
  }
  async function refresh() {
    if (FILE) { paintAll(); return; }
    try { apply(await A.request('/api/likes')); paintAll(); reorderSoon(); } catch { /* keep the last numbers */ }
  }

  // ---------- carousel ----------
  const track = $('car-track'), dots = $('car-dots'), prog = $('car-prog'), num = $('car-num'), car = $('car');
  const DUR = 6500;
  let tick = 0, lastT = 0, slides = [];
  function cover(g, cls, opts = {}) {
    const a = el('a', { cls, attrs: { href: g.href, 'aria-label': '开始游戏：' + g.name } });
    a.append(el('img', { attrs: { src: g.cover, alt: g.coverAlt || g.name, width: '960', height: '540', loading: opts.lazy ? 'lazy' : 'eager', decoding: 'async' } }));
    a.append(el('span', { cls: 'play', attrs: { 'aria-hidden': 'true' } }, [playIcon()]));
    if (opts.rank) a.append(el('span', { cls: 'rank px' }, [document.createTextNode('热度 '), el('b', { text: 'No.' + opts.rank })]));
    if (isNew(g)) a.append(el('span', { cls: 'ribbon', text: '新作' }));
    return a;
  }
  function kicker(g) {
    const c = catOf(g.category);
    return el('div', { cls: 'kicker px' }, [el('span', { cls: 'cat', text: c.name, style: { '--cc': c.color } }), isNew(g) ? el('span', { cls: 'badge', text: 'NEW' }) : null, el('span', { text: 'No.' + String(g.no).padStart(3, '0') })]);
  }
  const tags = g => el('ul', { cls: 'tags px' }, g.tags.map(t => el('li', { text: t })));
  function playBtn(g, small) { return el('a', { cls: 'btn px' + (small ? ' sm' : ''), attrs: { href: g.href } }, [arrow(), document.createTextNode(small ? '开始' : '开始游戏')]); }
  function detailBtn(g) { const b = el('button', { cls: 'ghost', text: '详情', attrs: { type: 'button' } }); b.addEventListener('click', () => openDetail(g)); return b; }
  function buildCarousel() {
    const keep = S.order[S.slide];
    S.order = hotOrder();
    S.slide = Math.max(0, S.order.indexOf(keep));
    track.replaceChildren(); dots.replaceChildren(); slides = [];
    S.order.forEach((id, i) => {
      const g = GAMES.find(x => x.id === id);
      const info = el('div', { cls: 's-info' }, [
        kicker(g),
        el('h3', { cls: 'px', text: g.name }, [el('small', { text: g.en })]),
        el('p', { cls: 'pitch', text: g.pitch }),
        tags(g),
        el('div', { cls: 'meta px' }, [likeButton(g), heatLabel(g)]),
        el('div', { cls: 'acts' }, [playBtn(g), detailBtn(g)]),
      ]);
      const li = el('li', { cls: 'slide', style: { '--c': g.accent }, attrs: { 'aria-roledescription': 'slide', 'aria-label': `${i + 1} / ${S.order.length}：${g.name}` } }, [cover(g, 's-cover', { rank: i + 1 }), info]);
      track.append(li); slides.push(li);
      const d = el('button', { attrs: { type: 'button', 'aria-label': `第 ${i + 1} 款：${g.name}` }, style: { '--c': g.accent } });
      d.addEventListener('click', () => go(i, true));
      dots.append(el('li', {}, [d]));
    });
    go(S.slide, false, true);
  }
  function go(i, user, instant) {
    const n = S.order.length;
    S.slide = (i + n) % n;
    if (instant) { track.style.transition = 'none'; requestAnimationFrame(() => { track.style.transition = ''; }); }
    track.style.transform = `translateX(${-S.slide * 100}%)`;
    slides.forEach((s, k) => { s.inert = k !== S.slide; s.setAttribute('aria-hidden', String(k !== S.slide)); });
    [...dots.querySelectorAll('button')].forEach((d, k) => d.setAttribute('aria-current', String(k === S.slide)));
    num.replaceChildren(el('b', { text: String(S.slide + 1) }), document.createTextNode(' / ' + n));
    tick = 0;
    if (user) S.paused = Math.max(S.paused, 0);
  }
  $('car-prev').addEventListener('click', () => go(S.slide - 1, true));
  $('car-next').addEventListener('click', () => go(S.slide + 1, true));
  car.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { go(S.slide - 1, true); e.preventDefault(); } else if (e.key === 'ArrowRight') { go(S.slide + 1, true); e.preventDefault(); } });
  car.addEventListener('mouseenter', () => { S.hover = true; });
  car.addEventListener('mouseleave', () => { S.hover = false; });
  car.addEventListener('focusin', () => { S.hover = true; });
  car.addEventListener('focusout', () => { S.hover = false; });
  // swipe on touch
  let sx = null, sy = 0;
  car.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
  car.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) go(S.slide + (dx < 0 ? 1 : -1), true);
  });
  function loop(t) {
    const dt = lastT ? t - lastT : 0; lastT = t;
    const hold = S.hover || document.hidden || $('gd').open || $('acct').open || reduce || S.order.length < 2;
    if (!hold) { tick += dt; if (tick >= DUR) go(S.slide + 1); }
    prog.style.width = (Math.min(1, tick / DUR) * 100).toFixed(1) + '%';
    requestAnimationFrame(loop);
  }
  // rebuild only when the ranking actually changed and nobody is looking at a slide
  let reorderTimer = 0;
  function reorderSoon() {
    clearTimeout(reorderTimer);
    reorderTimer = setTimeout(() => {
      const next = hotOrder();
      if (next.join() === S.order.join()) { paintAll(); return; }
      if (S.hover) { reorderSoon(); return; }
      likeEls.clear(); heatEls.clear();
      buildCarousel(); renderAll();
    }, 400);
  }

  // ---------- all games ----------
  const SORTS = [['new', '最新'], ['hot', '最热'], ['no', '编号']];
  function chips() {
    const box = $('chips'); box.replaceChildren();
    const make = (id, label, n, color) => {
      const b = el('button', { cls: 'chip', attrs: { type: 'button', 'aria-pressed': String(S.cat === id) }, style: color ? { '--cc': color } : {} }, [el('i'), document.createTextNode(label + ' '), el('em', { text: String(n) })]);
      b.addEventListener('click', () => { S.cat = id; chips(); renderAll(); });
      box.append(b);
    };
    make('all', '全部', GAMES.length);
    for (const c of CATS) { const n = GAMES.filter(g => g.category === c.id).length; if (n) make(c.id, c.name, n, c.color); }
    const sort = $('sort'); sort.replaceChildren();
    for (const [id, label] of SORTS) {
      const b = el('button', { cls: 'chip', text: label, attrs: { type: 'button', 'aria-pressed': String(S.sort === id) } });
      b.addEventListener('click', () => { S.sort = id; chips(); renderAll(); });
      sort.append(b);
    }
  }
  function card(g, solo) {
    const c = catOf(g.category);
    const name = el('h3', { cls: 'px', text: g.name }, [el('small', { text: g.en })]);
    return el('article', { cls: 'card frame', style: { '--c': g.accent }, attrs: { id: 'g-' + g.id } }, [
      cover(g, 'c-cover', { lazy: true }),
      el('div', { cls: 'c-body' }, [
        el('div', { cls: 'c-top' }, [name, el('span', { cls: 'cat px', text: c.name, style: { '--cc': c.color } })]),
        el('p', { cls: 'pitch', text: g.pitch }),
        tags(g),
        solo && g.facts ? el('dl', { cls: 'facts px' }, g.facts.map(([k, v]) => el('div', {}, [el('dt', { text: k }), el('dd', { text: v })]))) : null,
        el('div', { cls: 'c-foot' }, [el('div', {}, [likeButton(g), heatLabel(g)]), el('div', {}, [detailBtn(g), playBtn(g, true)])]),
      ]),
    ]);
  }
  function renderAll() {
    const q = S.q.trim().toLowerCase();
    const hay = g => [g.name, g.en, g.short || '', g.pitch, catOf(g.category).name, ...g.tags].join(' ').toLowerCase();
    const list = GAMES.filter(g => (S.cat === 'all' || g.category === S.cat) && (!q || hay(g).includes(q)));
    const sorter = { new: (a, b) => (a.released < b.released ? 1 : a.released > b.released ? -1 : b.no - a.no), hot: byHeat, no: (a, b) => a.no - b.no }[S.sort];
    list.sort(sorter);
    const box = $('groups'); box.replaceChildren();
    $('all-count').textContent = q || S.cat !== 'all' ? `${list.length} / ${GAMES.length} 款` : `${GAMES.length} 款`;
    if (!list.length) { box.append(el('p', { cls: 'empty px', text: '没有找到相关的游戏，换个关键词试试' })); return; }
    const cats = S.cat === 'all' ? CATS.filter(c => list.some(g => g.category === c.id)) : [catOf(S.cat)];
    const orphan = list.filter(g => !CATS.some(c => c.id === g.category));
    if (orphan.length) cats.push(catOf('other'));
    for (const c of cats) {
      const items = c.id === 'other' ? orphan : list.filter(g => g.category === c.id);
      box.append(el('section', { cls: 'group', style: { '--cc': c.color }, attrs: { 'aria-label': c.name } }, [
        el('div', { cls: 'g-hd px' }, [el('h3', { text: c.name }), el('small', { text: c.en }), el('span', { text: items.length + ' 款' }), c.desc ? el('p', { text: c.desc }) : null]),
        el('div', { cls: 'grid' + (items.length === 1 ? ' solo' : '') }, items.map(g => card(g, items.length === 1))),
      ]));
    }
  }
  $('q').addEventListener('input', e => { S.q = e.target.value; renderAll(); });

  // ---------- detail dialog ----------
  function openDetail(g) {
    const box = $('gd-in'), dlg = $('gd');
    const close = el('button', { cls: 'x gd-close', attrs: { type: 'button', 'aria-label': '关闭' } }, [pix(['aa....aa', '.aa..aa.', '..aaaa..', '...aa...', '..aaaa..', '.aa..aa.', 'aa....aa', '........'], { a: '#a99cc4' })]);
    close.addEventListener('click', () => dlg.close());
    const top = el('div', { cls: 'gd-top', style: { '--c': g.accent } }, [
      cover(g, 's-cover'),
      el('div', { cls: 'gd-side' }, [kicker(g), el('h2', { cls: 'px', text: g.name, attrs: { id: 'gd-title' } }, [el('small', { text: g.en })]), el('p', { cls: 'pitch', text: g.pitch }), tags(g), el('div', { cls: 'meta px' }, [likeButton(g), heatLabel(g)]), el('div', { cls: 'acts' }, [playBtn(g)])]),
    ]);
    const body = el('div', { cls: 'gd-body' });
    if (g.cast && g.cast.length) {
      body.append(el('ul', { cls: 'cast px' }, g.cast.map(c => el('li', { style: { '--cc': c.color } }, [
        el('span', { cls: 'pan' + (c.pixel ? ' pixel' : '') }, [el('img', { attrs: { src: c.img, alt: c.name + '的立绘', width: '480', height: '480', loading: 'lazy' } })]),
        el('b', { text: c.name }), el('span', { cls: 'sub', text: c.sub }),
      ]))));
    }
    body.append(el('p', { cls: 'desc', text: g.desc }));
    if (g.facts) body.append(el('dl', { cls: 'facts px' }, g.facts.map(([k, v]) => el('div', {}, [el('dt', { text: k }), el('dd', { text: v })]))));
    if (g.platforms) body.append(el('div', { cls: 'plat px' }, g.platforms.map(p => el('span', {}, [pix(PLAT[p][1], { a: '#a99cc4', b: '#1a1424' }), document.createTextNode(PLAT[p][0])]))));
    if (g.keys) body.append(el('div', { cls: 'keylist px' }, g.keys.flatMap(([k, v]) => [el('div', {}, k.split(' ').map(x => el('kbd', { text: x }))), el('span', { text: v })])));
    if (g.hint) body.append(el('p', { cls: 'hint px', text: g.hint }));
    box.replaceChildren(close, top, body);
    dlg.showModal();
    close.focus();
  }
  $('gd').addEventListener('click', e => { if (e.target === $('gd')) $('gd').close(); });
  $('gd').addEventListener('close', () => { for (const [id, list] of likeEls) likeEls.set(id, list.filter(x => x.btn.isConnected)); });

  // ---------- boot ----------
  const cnt = $('count');
  cnt.replaceChildren(document.createTextNode('已收录 '), el('b', { text: String(GAMES.length) }), document.createTextNode(' 款 · 持续更新'));
  chips(); buildCarousel(); renderAll();
  requestAnimationFrame(loop);
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 45000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  $('acct').addEventListener('close', refresh);
  if (A) A.onProfileChange(refresh);
})();
