import { io } from 'socket.io-client';
export const B = process.env.BASE || 'http://localhost:3000';
export const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; };
export async function login(email, password = 'demo1234') {
  const r = await fetch(`${B}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return { status: r.status, cookie: (r.headers.get('set-cookie') || '').split(';')[0], body: await r.json() };
}
export const req = (path, cookie = '', opts = {}) => fetch(`${B}${path}`, { redirect: 'manual', ...opts, headers: { cookie, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
export const json = async (path, cookie) => (await req(path, cookie)).json();
export const post = (path, cookie, body) => req(path, cookie, { method: 'POST', body: body && JSON.stringify(body) });
export const next = (s, ev, ms = 3000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error(`timeout waiting for ${ev}`)), ms); s.once(ev, (x) => { clearTimeout(t); res(x); }); });
export const connect = (cookie) => new Promise((res, rej) => { const s = io(B, { extraHeaders: { cookie }, transports: ['websocket'] }); s.on('connect', () => res(s)); s.on('connect_error', rej); });
export const mailFor = async (to) => (await json('/api/mailbox')).emails.filter((e) => e.to === to);
export const tokenOf = (email) => new URL(email.actionUrl).searchParams.get('token');
