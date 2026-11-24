import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Script } from 'node:vm';

test('the browser entry uses a self-contained classic script for direct file opening', () => {
  const html = readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  const script = html.match(/<script\b([^>]+)><\/script>/i)?.[1];
  assert.ok(script, 'The lesson must load its JavaScript');
  assert.doesNotMatch(script, /\btype\s*=/i);
  assert.match(script, /\bdefer\b/i);
  assert.match(script, /\bsrc="\.\/app\.bundle\.js(?:\?v=[\w-]+)?"/i);

  const bundle = readFileSync(new URL('../docs/app.bundle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(bundle, /\bimport\s*\(/);
  assert.doesNotThrow(() => new Script(bundle));
});
