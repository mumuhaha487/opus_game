// GAME.INC.RE on Cloudflare Workers: static assets from dist/, the API from server/.
import { handle } from './server/api.js';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    // ctx: lets the API finish a batched usage write after the response (ctx.waitUntil)
    if (pathname === '/api' || pathname.startsWith('/api/')) return handle(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};
