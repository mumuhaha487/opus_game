import { handle } from '../../server/api.js';
export const onRequest = ({ request, env }) => handle(request, env);
