// DESIGN §6：常驻视图、replaceState 导航、各视图滚动恢复及指定的切换动效。
export class Navigation {
  constructor(views, onRoute) {
    this.views = views; this.onRoute = onRoute; this.positions = new Map(); this.revision = 0;
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#/"]');
      if (!link || event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); this.go(link.getAttribute('href'));
    });
    window.addEventListener('hashchange', () => onRoute());
  }
  go(hash) { history.replaceState(null, '', hash); this.onRoute(); }
  async show(id, key) {
    const revision = ++this.revision, previous = this.views[this.active], next = this.views[id];
    if (!next) return;
    if (this.key) this.positions.set(this.key, window.scrollY);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (previous && previous !== next && !reduced) {
      await previous.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120 }).finished.catch(() => {});
    }
    if (revision !== this.revision) return;
    for (const view of Object.values(this.views)) view.hidden = view !== next;
    this.active = id; this.key = key;
    window.scrollTo({ top: this.positions.get(key) || 0, behavior: 'instant' });
    next.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: reduced ? 80 : 180, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
  }
}
