import { Temporal } from 'temporal-polyfill';
import { LEGAL_VERSION, legalSnapshot } from './legal.mjs';

const COOKIE = 'jm_privacy';
const DAYS = 180;
const reply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
const now = () => Temporal.Now.instant();
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
const hash = text => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(hex);
async function key(env) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function readCookie(req, env) {
  if (!env.SESSION_SECRET) return null;
  const value = (req.headers.get('cookie') || '').split(';').map(item => item.trim()).find(item => item.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  if (!value || value.length > 2000) return null;
  try {
    const [payload, signature, extra] = value.split('.');
    if (extra || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
    const bytes = Uint8Array.from(signature.match(/../g), value => parseInt(value, 16));
    if (!await crypto.subtle.verify('HMAC', await key(env), bytes, new TextEncoder().encode(payload))) return null;
    const result = JSON.parse(atob(payload));
    if (!/^[a-f0-9-]{36}$/.test(result.subject) || result.expires <= now().epochMilliseconds) return null;
    return result;
  } catch { return null; }
}
async function schema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS privacy_documents (hash TEXT PRIMARY KEY, version TEXT NOT NULL, content TEXT NOT NULL)`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS privacy_receipts (
    id TEXT PRIMARY KEY, subject TEXT NOT NULL, occurred_at TEXT NOT NULL,
    purpose TEXT NOT NULL, method TEXT NOT NULL, version TEXT NOT NULL,
    policy_hash TEXT NOT NULL, analytics INTEGER NOT NULL, terms INTEGER NOT NULL, privacy INTEGER NOT NULL
  )`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS privacy_subject ON privacy_receipts(subject,occurred_at)').run();
}
async function latest(env, subject) {
  return env.DB.prepare("SELECT id,analytics,version FROM privacy_receipts WHERE subject=? AND purpose='cookies' ORDER BY occurred_at DESC,rowid DESC LIMIT 1").bind(subject).first();
}
export async function analyticsAllowed(req, env) {
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1') return false;
  const cookie = await readCookie(req, env);
  if (!cookie || cookie.version !== LEGAL_VERSION || !cookie.analytics) return false;
  // Fail closed, including old cookies replayed after a withdrawal.
  try {
    const row = await latest(env, cookie.subject);
    return !!row && row.version === LEGAL_VERSION && row.id === cookie.choice && row.analytics === 1;
  } catch { return false; }
}
export async function consentRequest(req, env) {
  if (!env.SESSION_SECRET || !env.DB) return reply({ detail: 'Preferencias temporalmente no disponibles.' }, 503);
  const cookie = await readCookie(req, env);
  if (req.method === 'GET') {
    let row;
    if (cookie) { await schema(env); row = await latest(env, cookie.subject); }
    return reply({ version: LEGAL_VERSION, decided: !!row && row.version === LEGAL_VERSION, analytics: await analyticsAllowed(req, env) });
  }
  if (req.method !== 'POST') return reply({ detail: 'Método no permitido.' }, 405, { allow: 'GET, POST' });
  if (req.headers.get('origin') !== new URL(req.url).origin) return reply({ detail: 'Origen no autorizado.' }, 403);
  if (!req.headers.get('content-type')?.startsWith('application/json')) return reply({ detail: 'Se requiere JSON.' }, 415);
  if (Number(req.headers.get('content-length')) > 1024) return reply({ detail: 'Solicitud demasiado grande.' }, 413);
  const raw = await req.text();
  if (raw.length > 1024) return reply({ detail: 'Solicitud demasiado grande.' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ detail: 'JSON inválido.' }, 400); }
  if (!body || typeof body !== 'object') return reply({ detail: 'Solicitud inválida.' }, 422);
  if (body.version !== LEGAL_VERSION) return reply({ detail: 'Las políticas cambiaron. Recarga y léelas de nuevo.' }, 409);
  if (!['cookies', 'brief'].includes(body.purpose) || (body.purpose === 'cookies' && typeof body.analytics !== 'boolean') || (body.purpose === 'brief' && (body.terms !== true || body.privacy !== true || !['copy', 'download'].includes(body.method)))) return reply({ detail: 'Revisa las casillas y la acción solicitada.' }, 422);
  await schema(env);
  const subject = cookie?.subject || crypto.randomUUID();
  const instant = now();
  const since = instant.subtract({ hours: 24 }).toString();
  const count = await env.DB.prepare('SELECT count(*) AS n FROM privacy_receipts WHERE subject=? AND occurred_at>?').bind(subject, since).first();
  if (count.n >= 50) return reply({ detail: 'Demasiadas solicitudes. Inténtalo más tarde.' }, 429);
  const documentHash = await hash(legalSnapshot);
  await env.DB.prepare('INSERT OR IGNORE INTO privacy_documents(hash,version,content) VALUES(?,?,?)').bind(documentHash, LEGAL_VERSION, legalSnapshot).run();
  const id = crypto.randomUUID();
  const analytics = body.purpose === 'cookies' ? body.analytics && req.headers.get('dnt') !== '1' && req.headers.get('sec-gpc') !== '1' : await analyticsAllowed(req, env);
  const timestamp = instant.toString({ fractionalSecondDigits: 3 });
  const method = body.purpose === 'cookies' ? (analytics ? 'banner:accept' : 'banner:reject-or-withdraw') : `brief:${body.method}`;
  await env.DB.prepare('INSERT INTO privacy_receipts(id,subject,occurred_at,purpose,method,version,policy_hash,analytics,terms,privacy) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id, subject, timestamp, body.purpose, method, LEGAL_VERSION, documentHash, Number(analytics), Number(body.purpose === 'brief'), Number(body.purpose === 'brief')).run();
  const headers = {};
  if (body.purpose === 'cookies' || !cookie) {
    const payload = btoa(JSON.stringify({ subject, version: LEGAL_VERSION, analytics: !!analytics, choice: body.purpose === 'cookies' ? id : '', expires: instant.add({ hours: DAYS * 24 }).epochMilliseconds }));
    const signature = hex(await crypto.subtle.sign('HMAC', await key(env), new TextEncoder().encode(payload)));
    headers['set-cookie'] = `${COOKIE}=${payload}.${signature}; Path=/; Max-Age=${DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`;
  }
  return reply({ receipt: id, occurredAt: timestamp, version: LEGAL_VERSION, analytics: !!analytics }, 201, headers);
}
export async function privacyReport(env, url) {
  await schema(env);
  const cursor = url.searchParams.get('before') || '9007199254740991';
  if (!/^\d{1,16}$/.test(cursor)) return reply({ detail: 'Cursor inválido.' }, 422);
  const result = await env.DB.prepare('SELECT rowid AS cursor,* FROM privacy_receipts WHERE rowid<? ORDER BY rowid DESC LIMIT 200').bind(Number(cursor)).all();
  const versions = await env.DB.prepare('SELECT hash,version,content FROM privacy_documents').all();
  return reply({ receipts: result.results, documents: versions.results, next: result.results.length === 200 ? result.results.at(-1).cursor : null });
}
export async function purgePrivacy(env) {
  await schema(env);
  await env.DB.prepare('DELETE FROM privacy_receipts WHERE occurred_at < ?').bind(now().subtract({ hours: 365 * 24 }).toString()).run();
  const today = Temporal.Now.zonedDateTimeISO('America/Guayaquil').toPlainDate();
  // The analytics table may not exist until the first authorized visit.
  const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_events'").first();
  if (table) await env.DB.prepare('DELETE FROM analytics_events WHERE day < ?').bind(today.subtract({ days: 179 }).toString()).run();
}
