import { Temporal } from 'temporal-polyfill';
import { analyticsAllowed } from './privacy.mjs';

const ZONE = 'America/Guayaquil';
const empty = () => new Response(null, { status: 204 });
async function schema(env) {
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY, day TEXT NOT NULL, visitor TEXT NOT NULL,
    session TEXT NOT NULL, type TEXT NOT NULL, project TEXT NOT NULL,
    source TEXT NOT NULL, country TEXT NOT NULL, device TEXT NOT NULL
  )`).run();
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS analytics_day ON analytics_events(day,visitor)',
  ).run();
}
async function fingerprint(secret, value) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Array.from(
    new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function collect(req, env) {
  if (req.headers.get('origin') !== new URL(req.url).origin)
    return new Response(null, { status: 403 });
  if (!await analyticsAllowed(req, env)) return empty();
  const ua = req.headers.get('user-agent') || '';
  if (
    !env.SESSION_SECRET ||
    /bot|crawler|spider|headless/i.test(ua) ||
    req.headers.get('dnt') === '1' ||
    req.headers.get('sec-gpc') === '1' ||
    /jerath_session=/.test(req.headers.get('cookie') || '')
  )
    return empty();
  if (Number(req.headers.get('content-length')) > 2048)
    return new Response(null, { status: 413 });
  const raw = await req.text();
  if (raw.length > 2048) return new Response(null, { status: 413 });
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  const uuid = /^[a-f0-9-]{36}$/i;
  if (
    !body ||
    !uuid.test(body.id) ||
    !uuid.test(body.session) ||
    !['page_view', 'project_view', 'contact_click'].includes(body.type) ||
    (body.type === 'project_view' &&
      !/^[a-z0-9_-]{1,80}$/i.test(body.project || ''))
  )
    return new Response(null, { status: 400 });
  const today = Temporal.Now.zonedDateTimeISO(ZONE).toPlainDate();
  const day = today.toString();
  // Daily pseudonym: raw addresses and user agents are never persisted.
  const visitor = await fingerprint(
    env.SESSION_SECRET,
    `${day}|${req.headers.get('cf-connecting-ip') || 'local'}|${ua}`,
  );
  const session = await fingerprint(
    env.SESSION_SECRET,
    `${day}|${body.session}|${visitor}`,
  );
  let source = 'Directo';
  try {
    const ref = new URL(body.referrer);
    if (
      ['http:', 'https:'].includes(ref.protocol) &&
      ref.origin !== new URL(req.url).origin
    )
      source = ref.hostname.replace(/^www\./, '').slice(0, 120);
  } catch {
    /* Direct navigation. */
  }
  const device = /ipad|tablet/i.test(ua)
    ? 'Tablet'
    : /mobile|iphone|android/i.test(ua)
      ? 'Móvil'
      : 'Escritorio';
  const country = /^[A-Z]{2}$/.test(req.cf?.country || '')
    ? req.cf.country
    : 'XX';
  await schema(env);
  await env.DB.prepare(`INSERT OR IGNORE INTO analytics_events
    (id,day,visitor,session,type,project,source,country,device)
    SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT count(*) FROM analytics_events WHERE day=? AND visitor=?) < 300`)
    .bind(
      body.id,
      day,
      visitor,
      session,
      body.type,
      body.type === 'project_view' ? body.project : '',
      source,
      country,
      device,
      day,
      visitor,
    )
    .run();
  await env.DB.prepare('DELETE FROM analytics_events WHERE day < ?')
    .bind(today.subtract({ days: 179 }).toString())
    .run();
  return empty();
}
export async function report(env, requestedDays) {
  await schema(env);
  const days = [7, 30, 90].includes(Number(requestedDays))
    ? Number(requestedDays)
    : 30;
  const today = Temporal.Now.zonedDateTimeISO(ZONE).toPlainDate();
  const start = today.subtract({ days: days - 1 }).toString();
  const previousStart = today.subtract({ days: days * 2 - 1 }).toString();
  const totalsFor = async (from, until) => {
    const row = await env.DB.prepare(`SELECT
      COALESCE(SUM(type='page_view'),0) AS views,
      COUNT(DISTINCT CASE WHEN type='page_view' THEN visitor END) AS visitors,
      COUNT(DISTINCT CASE WHEN type='page_view' THEN session END) AS sessions,
      COALESCE(SUM(type='project_view'),0) AS projects,
      COALESCE(SUM(type='contact_click'),0) AS contacts,
      COUNT(DISTINCT CASE WHEN type='contact_click' AND session IN
        (SELECT session FROM analytics_events WHERE type='page_view' AND day>=? AND day<=?) THEN session END) AS converted
      FROM analytics_events WHERE day>=? AND day<=?`)
      .bind(from, until, from, until)
      .first();
    return {
      ...row,
      conversion: row.sessions
        ? Math.round((row.converted / row.sessions) * 1000) / 10
        : 0,
    };
  };
  const totals = await totalsFor(start, today.toString());
  const previous = await totalsFor(
    previousStart,
    today.subtract({ days }).toString(),
  );
  const { results } = await env.DB.prepare(
    `SELECT day,COUNT(*) AS views,COUNT(DISTINCT visitor) AS visitors FROM analytics_events WHERE type='page_view' AND day>=? GROUP BY day ORDER BY day`,
  )
    .bind(start)
    .all();
  const daily = Array.from({ length: days }, (_, index) => {
    const day = today.subtract({ days: days - index - 1 }).toString();
    return (
      results.find((row) => row.day === day) || { day, views: 0, visitors: 0 }
    );
  });
  const breakdown = async (column, type) =>
    (
      await env.DB.prepare(
        `SELECT ${column} AS label,COUNT(*) AS count FROM analytics_events WHERE type=? AND day>=? GROUP BY ${column} ORDER BY count DESC,label LIMIT 10`,
      )
        .bind(type, start)
        .all()
    ).results;
  return {
    days,
    start,
    end: today.toString(),
    timezone: ZONE,
    totals,
    previous,
    daily,
    sources: await breakdown('source', 'page_view'),
    countries: await breakdown('country', 'page_view'),
    devices: await breakdown('device', 'page_view'),
    projects: await breakdown('project', 'project_view'),
  };
}
