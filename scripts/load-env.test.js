// `bun run test` must not depend on the developer's `.env`: with `--example`,
// load-env reads only `.env.example` (process variables, e.g. CI, still win).
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.join(__dirname, '..');

function sandbox(envContent) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-env-'));
  fs.copyFileSync(
    path.join(root, 'load-env.js'),
    path.join(dir, 'load-env.js'),
  );
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(
    path.join(root, 'scripts/env-helper.js'),
    path.join(dir, 'scripts/env-helper.js'),
  );
  fs.copyFileSync(
    path.join(root, '.env.example'),
    path.join(dir, '.env.example'),
  );
  fs.symlinkSync(
    path.join(root, 'node_modules'),
    path.join(dir, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  if (envContent !== undefined)
    fs.writeFileSync(path.join(dir, '.env'), envContent);
  return dir;
}

function run(dir, args, extraEnv = {}) {
  const env = { ...process.env, SKIP_ENV_FETCH: '1', ...extraEnv };
  for (const key of ['API_URL', 'SECRET_KEY', 'ENTITY_ROOT', 'NODE_ENV']) {
    if (!(key in extraEnv)) delete env[key];
  }
  execFileSync(process.execPath, ['load-env.js', ...args], {
    cwd: dir,
    env,
    stdio: 'pipe',
  });
  return fs.readFileSync(
    path.join(dir, 'src/environments/environment.ts'),
    'utf8',
  );
}

const exampleApiUrl = () =>
  fs
    .readFileSync(path.join(root, '.env.example'), 'utf8')
    .match(/^API_URL=(.*)$/m)[1]
    .trim();

test('--example ignores .env and reads .env.example', () => {
  const dir = sandbox('API_URL=http://from-dot-env.invalid\n');
  try {
    const output = run(dir, ['--example']);
    assert.match(output, new RegExp(exampleApiUrl().replaceAll('.', '\\.')));
    assert.doesNotMatch(output, /from-dot-env/);
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

test('--example works when .env exists but is empty', () => {
  const dir = sandbox('');
  try {
    assert.match(run(dir, ['--example']), /apiUrl/);
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

test('process variables still win over .env.example', () => {
  const dir = sandbox();
  try {
    const output = run(dir, ['--example'], {
      API_URL: 'http://from-process.invalid',
    });
    assert.match(output, /from-process\.invalid/);
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

test('without --example, .env is used as before', () => {
  const dir = sandbox(
    fs
      .readFileSync(path.join(root, '.env.example'), 'utf8')
      .replace(/^API_URL=.*$/m, 'API_URL=http://from-dot-env.invalid'),
  );
  try {
    assert.match(run(dir, []), /from-dot-env\.invalid/);
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});

test('runs on a Node without native Temporal (falls back to the polyfill)', () => {
  const dir = sandbox();
  try {
    // Simulates Node < 26, which has no global Temporal.
    const strip = path.join(dir, 'strip-temporal.js');
    fs.writeFileSync(strip, 'delete globalThis.Temporal;\n');
    const env = { ...process.env, SKIP_ENV_FETCH: '1' };
    for (const key of ['API_URL', 'SECRET_KEY', 'ENTITY_ROOT', 'NODE_ENV']) {
      delete env[key];
    }
    execFileSync(
      process.execPath,
      ['--require', strip, 'load-env.js', '--example'],
      { cwd: dir, env, stdio: 'pipe' },
    );
    const output = fs.readFileSync(
      path.join(dir, 'src/environments/environment.ts'),
      'utf8',
    );
    assert.match(output, /Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/);
  } finally {
    fs.rmSync(dir, { force: true, recursive: true });
  }
});
