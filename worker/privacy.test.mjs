import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { consentRequest, analyticsAllowed, privacyReport, purgePrivacy } from './privacy.mjs';
import { LEGAL_VERSION } from './legal.mjs';

test('choices default to off; signed consent, withdrawal and minimal receipts are persisted', async () => {
  const sql = new DatabaseSync(':memory:');
  const env = {
    SESSION_SECRET: 'test-only-secret',
    DB: {
      prepare(query) {
        const statement = sql.prepare(query);
        let args = [];
        return {
          bind(...values) { args = values; return this; },
          async run() { return statement.run(...args); },
          async first() { return statement.get(...args); },
          async all() { return { results: statement.all(...args) }; },
        };
      },
    },
  };
  let cookie = '';
  const request = (body, headers = {}) => new Request('https://example.com/api/consent', {
    method: body ? 'POST' : 'GET',
    headers: { origin: 'https://example.com', 'content-type': 'application/json', cookie, ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(await analyticsAllowed(request(), env), false);
  const initial = await consentRequest(request(), env);
  assert.equal((await initial.json()).analytics, false);
  assert.equal(initial.headers.has('set-cookie'), false);
  assert.equal((await consentRequest(request({ purpose: 'cookies', analytics: true, version: 'old' }), env)).status, 409);
  assert.equal((await consentRequest(request({ purpose: 'cookies', analytics: true, version: LEGAL_VERSION }, { origin: 'https://attacker.test' }), env)).status, 403);
  const accepted = await consentRequest(request({ purpose: 'cookies', analytics: true, version: LEGAL_VERSION }), env);
  assert.equal(accepted.status, 201);
  cookie = accepted.headers.get('set-cookie').split(';')[0];
  assert.match(accepted.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(await analyticsAllowed(request(), env), true);
  assert.equal(await analyticsAllowed(request(undefined, { 'sec-gpc': '1' }), env), false);
  const cookieBeforeBrief = cookie;
  assert.equal((await consentRequest(request({ purpose: 'brief', method: 'download', terms: true, privacy: false, version: LEGAL_VERSION }), env)).status, 422);
  const brief = await consentRequest(request({ purpose: 'brief', method: 'download', terms: true, privacy: true, version: LEGAL_VERSION, name: 'DO NOT STORE', idea: 'PRIVATE' }), env);
  const receipt = await brief.json();
  assert.equal(brief.status, 201);
  assert.match(receipt.receipt, /^[a-f0-9-]{36}$/);
  assert.equal(brief.headers.has('set-cookie'), false);
  const rejected = await consentRequest(request({ purpose: 'cookies', analytics: false, version: LEGAL_VERSION }), env);
  cookie = rejected.headers.get('set-cookie').split(';')[0];
  assert.equal(await analyticsAllowed(request(), env), false);
  // An earlier signed cookie cannot revive a choice withdrawn in the database.
  assert.equal(await analyticsAllowed(request(undefined, { cookie: cookieBeforeBrief }), env), false);
  assert.equal(await analyticsAllowed(request(undefined, { cookie: cookie + 'tampered' }), env), false);
  const rows = sql.prepare('SELECT * FROM privacy_receipts ORDER BY rowid').all();
  assert.equal(rows.length, 3);
  assert.equal(new Set(rows.map(row => row.subject)).size, 1);
  assert.equal(rows[1].method, 'brief:download');
  assert.equal(rows[1].terms, 1);
  assert.equal(rows[1].privacy, 1);
  assert.ok(rows.every(row => row.policy_hash.length === 64 && row.occurred_at));
  assert.equal(JSON.stringify(rows).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(rows).includes('DO NOT STORE'), false);
  const snapshot = sql.prepare('SELECT content FROM privacy_documents').get();
  assert.ok(snapshot.content.includes('Términos'));
  const exported = await (await privacyReport(env, new URL('https://example.com/api/admin/privacy-receipts'))).json();
  assert.equal(exported.receipts.length, 3);
  assert.equal(exported.documents.length, 1);
  assert.ok(exported.documents[0].content.includes('Aceptar analítica'));
  sql.prepare("INSERT INTO privacy_receipts SELECT 'expired',subject,'2000-01-01T00:00:00.000Z',purpose,method,version,policy_hash,analytics,terms,privacy FROM privacy_receipts LIMIT 1").run();
  await purgePrivacy(env);
  assert.equal(sql.prepare("SELECT count(*) AS n FROM privacy_receipts WHERE id='expired'").get().n, 0);
  assert.equal(sql.prepare('SELECT count(*) AS n FROM privacy_receipts').get().n, 3);
  sql.close();
});
