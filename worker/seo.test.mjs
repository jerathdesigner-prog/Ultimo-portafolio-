import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import app from './index.mjs';

test('homepage supplies accurate metadata and readable content before JavaScript', async () => {
  const sql = new DatabaseSync(':memory:');
  const shell = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  const env = {
    DB: {
      prepare(query) {
        const statement = sql.prepare(query);
        let args = [];
        return {
          bind(...values) { args = values; return this; },
          async run() { return statement.run(...args); },
          async first() { return statement.get(...args); },
        };
      },
    },
    ASSETS: { async fetch() { return new Response(shell); } },
  };
  try {
    const response = await app.fetch(new Request('https://jerathmoreira.com/'), env);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes('<title>Jerath Moreira — Diseñador gráfico</title>'));
    assert.ok(html.includes('rel="canonical" href="https://jerathmoreira.com/"'));
    assert.ok(html.includes('property="og:title" content="Jerath Moreira — Diseñador gráfico"'));
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.ok(graph['@graph'].some(entity => entity['@type'] === 'Person' && entity.jobTitle === 'Diseñador gráfico'));
    assert.match(html, /<app-root>\s*<main class="portfolio-fallback"/);
    assert.ok(html.includes('<h1>Jerath Moreira</h1>'));
    assert.ok(html.includes('Portoviejo, Ecuador'));
    assert.ok(html.includes('href="mailto:jerathdesigner@gmail.com"'));
    assert.ok(!html.includes('Diseño &amp; Dirección Creativa'));
    // Untrusted CMS titles must remain text in the initial, indexable HTML.
    const state = JSON.parse(sql.prepare('SELECT data FROM portfolio_state WHERE id=1').get().data);
    state.services[0].title = '<script>alert(1)</script>';
    sql.prepare('UPDATE portfolio_state SET data=? WHERE id=1').run(JSON.stringify(state));
    const altered = await (await app.fetch(new Request('https://jerathmoreira.com/'), env)).text();
    assert.ok(altered.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!altered.includes('<script>alert(1)</script>'));
  } finally { sql.close(); }
});
