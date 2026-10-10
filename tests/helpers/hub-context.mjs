import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export const jsonResponse = (value, status = 200) => new Response(JSON.stringify(value), { status });
export const tick = () => new Promise(resolve => setImmediate(resolve));
export function hubContext({ storage = new Map(), fetcher = async () => { throw new Error('offline'); }, file = false, storageThrows = false, document } = {}) {
  const listeners = new Map(), timers = new Map(), requests = []; let timerID = 0;
  const localStorage = {
    get length() { if (storageThrows) throw new Error('storage unavailable'); return storage.size; },
    key: i => [...storage.keys()][i] ?? null,
    getItem(key) { if (storageThrows) throw new Error('storage unavailable'); return storage.get(key) ?? null; },
    setItem(key, value) { if (storageThrows) throw new Error('storage unavailable'); storage.set(key, value); },
    removeItem(key) { if (storageThrows) throw new Error('storage unavailable'); storage.delete(key); },
  };
  const context = vm.createContext({ document, location: { protocol: file ? 'file:' : 'https:' }, localStorage, AbortController,
    window: { addEventListener(kind, fn) { const callbacks = listeners.get(kind) || []; callbacks.push(fn); listeners.set(kind, callbacks); } },
    setTimeout: (fn, delay) => { const id = ++timerID; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
    fetch: async (path, options) => { requests.push({ path, ...options }); return fetcher(path, options); },
  });
  const load = name => vm.runInContext(readFileSync(new URL('../../hub/' + name + '.js', import.meta.url), 'utf8'), context, { filename: name + '.js' });
  load('account-core');
  const run = source => vm.runInContext(source, context);
  return { run, load, storage, timers, requests, event: (kind, event) => { for (const fn of listeners.get(kind) || []) fn(event); }, json: source => JSON.parse(JSON.stringify(run(source))) };
}
