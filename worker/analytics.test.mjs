import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { collect, report } from './analytics.mjs';
import app from './index.mjs';
import { consentRequest } from './privacy.mjs';
import { LEGAL_VERSION } from './legal.mjs';

test('analytics deduplicates, aggregates real events, validates origins and excludes bots', async () => {
  const sql = new DatabaseSync(':memory:');
  const env = {
    SESSION_SECRET: 'test-secret',
    DB: {
      prepare(query) {
        const stmt = sql.prepare(query);
        let args = [];
        return {
          bind(...values) {
            args = values;
            return this;
          },
          async run() {
            return stmt.run(...args);
          },
          async all() {
            return { results: stmt.all(...args) };
          },
          async first() {
            return stmt.get(...args);
          },
        };
      },
    },
  };
  const accepted = await consentRequest(new Request('https://example.com/api/consent', {
    method: 'POST',
    headers: { origin: 'https://example.com', 'content-type': 'application/json' },
    body: JSON.stringify({ purpose: 'cookies', analytics: true, version: LEGAL_VERSION }),
  }), env);
  const cookie = accepted.headers.get('set-cookie').split(';')[0];
  const send = (body, headers = {}) =>
    collect(
      new Request('https://example.com/api/analytics', {
        method: 'POST',
        headers: {
          origin: 'https://example.com',
          'user-agent': 'Firefox',
          'cf-connecting-ip': '192.0.2.1',
          cookie,
          ...headers,
        },
        body: JSON.stringify(body),
      }),
      env,
    );
  const page = {
    id: crypto.randomUUID(),
    session: crypto.randomUUID(),
    type: 'page_view',
    referrer: 'https://google.com/search?q=private',
  };
  assert.equal((await send(page, { cookie: '' })).status, 204);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='analytics_events'").get().n, 0);
  assert.equal((await send(page)).status, 204);
  await send(page);
  await send({
    ...page,
    id: crypto.randomUUID(),
    type: 'project_view',
    project: 'prj_test',
  });
  await send({ ...page, id: crypto.randomUUID(), type: 'contact_click' });
  await send(
    { ...page, id: crypto.randomUUID() },
    { 'user-agent': 'Googlebot' },
  );
  assert.equal(
    (await send(page, { origin: 'https://attacker.com' })).status,
    403,
  );
  assert.equal((await send({ ...page, type: 'invalid' })).status, 400);
  const data = await report(env, 7);
  assert.equal(data.totals.views, 1);
  assert.equal(data.totals.visitors, 1);
  assert.equal(data.totals.sessions, 1);
  assert.equal(data.totals.projects, 1);
  assert.equal(data.totals.contacts, 1);
  assert.equal(data.totals.conversion, 100);
  assert.equal(data.daily.length, 7);
  assert.equal(data.sources[0].label, 'google.com');
  assert.equal(data.projects[0].label, 'prj_test');
  assert.equal(
    sql.prepare('SELECT count(*) AS n FROM analytics_events').get().n,
    3,
  );
  assert.equal((await send(page, { DNT: '1' })).status, 204);
  assert.equal((await send(page, { 'sec-gpc': '1' })).status, 204);
  await send(
    { ...page, id: crypto.randomUUID() },
    { cookie: 'jerath_session=admin' },
  );
  assert.equal(
    sql.prepare('SELECT count(*) AS n FROM analytics_events').get().n,
    3,
  );
  assert.equal(
    (
      await app.fetch(new Request('https://example.com/api/admin/analytics'), {
        ...env,
        ADMIN_PASSWORD: 'password',
      })
    ).status,
    401,
  );
  sql
    .prepare(
      `INSERT INTO analytics_events SELECT 'expired','2000-01-01',visitor,session,type,project,source,country,device FROM analytics_events LIMIT 1`,
    )
    .run();
  await send({ ...page, id: crypto.randomUUID() });
  assert.equal(
    sql
      .prepare("SELECT count(*) AS n FROM analytics_events WHERE id='expired'")
      .get().n,
    0,
  );
  assert.equal((await report(env, 42)).days, 30);
  const login = await app.fetch(
    new Request('https://example.com/api/login', {
      method: 'POST',
      headers: { origin: 'https://example.com' },
      body: JSON.stringify({ username: 'jerath', password: 'password' }),
    }),
    { ...env, ADMIN_PASSWORD: 'password' },
  );
  assert.equal(login.status, 200);
  const response = await app.fetch(
    new Request('https://example.com/api/admin/analytics?days=7', {
      headers: { cookie: login.headers.get('set-cookie').split(';')[0] },
    }),
    { ...env, ADMIN_PASSWORD: 'password' },
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).totals.views, 2);
  sql.close();
});
