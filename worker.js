// GAME.INC.RE on Cloudflare Workers: static assets from dist/, the API from server/.
import { handle } from './server/api.js';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/')) return handle(request, env);
    return env.ASSETS.fetch(request);
  },
};
