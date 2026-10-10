const enc = new TextEncoder();
export const ITERATIONS = 100000;
export const SESSION_SECONDS = 2592000;
export const USERNAME = /^[A-Za-z0-9_]{3,16}$/;
const UID = /^[a-f0-9]{32}$/;
const DUMMY_SALT = new Uint8Array(16);

export function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unbase64(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('encoding');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
export const randomBytes = n => crypto.getRandomValues(new Uint8Array(n));
export const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export function equal32(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < 32; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}
export async function passwordHash(password, pepper, salt = DUMMY_SALT, iter = ITERATIONS) {
  const k = await hmac(pepper, password);
  const key = await crypto.subtle.importKey('raw', k, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
export function passwordValid(password) {
  return typeof password === 'string' && [...password].length >= 8 && [...password].length <= 64;
}
export async function signSession(user, secret, expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS) {
  const payload = b64url(enc.encode(JSON.stringify({ u: user.uid, n: user.name.toLowerCase(), v: user.sv, e: expires })));
  return payload + '.' + b64url(await hmac(secret, payload));
}
export function sessionCookie(token = '', clear = false) {
  return `__Host-gsid=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_SECONDS}`;
}
export async function verifySession(request, env) {
  let p;
  try {
    const token = (request.headers.get('Cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith('__Host-gsid='))?.slice(12);
    if (!token || token.length > 1024) return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !equal32(await hmac(env.AUTH_SECRET, parts[0]), unbase64(parts[1]))) return null;
    p = JSON.parse(new TextDecoder().decode(unbase64(parts[0])));
    if (!UID.test(p.u) || !USERNAME.test(p.n) || p.n !== p.n.toLowerCase() || !Number.isSafeInteger(p.v) || !Number.isSafeInteger(p.e) || p.e <= Date.now() / 1000) return null;
  } catch { return null; }
  const object = await env.ACCOUNTS.get(`users/${p.n}.json`);
  if (!object) return null;
  const user = await object.json();
  if (user.uid !== p.u || user.sv !== p.v) return null;
  return { user, expires: p.e };
}
