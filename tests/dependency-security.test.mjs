import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const __dirname = import.meta.dirname;
import braces from 'braces';
const guarded = error => error instanceof SyntaxError && error.code === 'ERR_BRACES_DEPTH';

test('all installed braces paths resolve to the reviewed private fork', () => {
  const lock = JSON.parse(readFileSync(path.join(__dirname, '../package-lock.json')));
  const packages = Object.entries(lock.packages);
  assert.ok(packages.some(([key]) => key.endsWith('node_modules/braces')));
  for (const [key, meta] of packages) {
    if (!key.endsWith('node_modules/braces')) continue;
    const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', key, 'package.json')));
    assert.equal(pkg.name, '@kujolang/braces-depth-guard');
    assert.equal(pkg.version, '3.0.3-kujo.1');
    assert.ok(meta.link || meta.resolved.startsWith('file:'));
  }
  assert.equal(JSON.parse(readFileSync(require.resolve('vite/package.json'))).version, '8.3.5');
});

test('nested braces, parentheses and unclosed blocks fail with a bounded syntax error', () => {
  for (const [open, close] of [['{', '}'], ['(', ')']]) {
    for (const input of [open.repeat(4999) + 'x' + close.repeat(4999), open.repeat(4999) + 'x']) {
      for (const fn of [braces, braces.parse, braces.compile, braces.expand, braces.stringify]) {
        assert.throws(() => fn(input, { maxDepth: Infinity }), guarded);
      }
    }
  }
  assert.throws(() => braces(['{a,b}', '{'.repeat(4999)]), guarded);
});

test('direct AST and internal walkers cannot bypass the depth limit', () => {
  const localRequire = createRequire(require.resolve('braces'));
  for (const operation of ['compile', 'expand', 'stringify']) {
    for (const fn of [braces[operation], localRequire('./lib/' + operation)]) {
      const ast = { type: 'root', nodes: [] };
      let node = ast;
      for (let i = 0; i < 10000; i++) {
        const child = { type: 'brace', nodes: [], parent: node, commas: 1, ranges: 0 };
        node.nodes.push(child); node = child;
      }
      node.nodes.push({ type: 'text', value: 'x' });
      assert.throws(() => fn(ast), guarded);
    }
  }
});

test('normal expansions, escaping, ranges and actual glob consumers remain compatible', async () => {
  assert.deepEqual(braces.expand('app/{pages,articles}/{a,b}.tsx'), ['app/pages/a.tsx','app/pages/b.tsx','app/articles/a.tsx','app/articles/b.tsx']);
  assert.deepEqual(braces.expand('v{1..3}'), ['v1','v2','v3']);
  assert.deepEqual(braces.expand('{a,{b,c}}'), ['a','b','c']);
  assert.equal(braces.stringify(braces.parse('app/{pages,articles}/*.tsx')), 'app/{pages,articles}/*.tsx');
  assert.deepEqual(braces.expand('\\{literal\\}'), ['{literal}']);
  assert.throws(() => braces.expand('{1..10000}'), /range limit/);
  const { default: micromatch } = await import('micromatch');
  assert.deepEqual(micromatch(['app/a.tsx','lib/a.ts','ignore.js'], '{app,lib}/**/*.{ts,tsx}'), ['app/a.tsx','lib/a.ts']);
  assert.throws(() => micromatch.braces('{'.repeat(4999) + 'x' + '}'.repeat(4999)), guarded);
  const { default: glob } = await import('fast-glob');
  const pattern = 'app/{page,layout}.tsx';
  assert.deepEqual(glob.sync(pattern).sort(), ['app/layout.tsx','app/page.tsx']);
  assert.deepEqual((await glob(pattern)).sort(), ['app/layout.tsx','app/page.tsx']);
});
