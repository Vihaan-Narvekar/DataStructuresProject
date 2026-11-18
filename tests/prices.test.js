import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPrice, generatePrices, orderPrices, parsePrice, parseSequence } from '../docs/js/prices.js';

test('parses and formats exact nonnegative cents', () => {
  for (const input of ['10', '10.00', '$10.0', ' 010 ']) assert.equal(parsePrice(input), 1000);
  assert.equal(parsePrice('.05'), 5);
  assert.equal(parsePrice('0'), 0);
  assert.equal(parsePrice('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  assert.equal(formatPrice(5), '$0.05');
  assert.equal(formatPrice(Number.MAX_SAFE_INTEGER), '$90,071,992,547,409.91');
});

test('rejects malformed, negative, sub-cent, and unsafe values', () => {
  for (const input of ['', '-1', '0.001', '1e2', '3.4.5', '1,000', 'Infinity', '90071992547409.92']) {
    assert.throws(() => parsePrice(input));
  }
});

test('preview reports invalid values and deduplicates equivalent keys', () => {
  assert.deepEqual(parseSequence('10, 2\n10.00 $3.25 error, -8'), {
    keys: [1000, 200, 325],
    invalid: ['error', '-8'],
    duplicates: ['10.00'],
  });
});

test('generated sequences respect exact cents and the range and count limits', () => {
  assert.deepEqual(generatePrices('0.01', '.02', '4', 5), [1, 3, 5, 7]);
  assert.throws(() => generatePrices('1', '0', '4', 5), /increment/);
  assert.throws(() => generatePrices('1', '1', '1.5', 5), /whole number/);
  assert.throws(() => generatePrices('1', '1', '6', 5), /fewer/);
  assert.throws(() => generatePrices('90071992547409.91', '.01', '2', 5), /last price/);
});

test('orders or shuffles a copy while preserving the original keys', () => {
  const keys = [8, 2, 4, 1];
  assert.deepEqual(orderPrices(keys, 'entered'), keys);
  assert.deepEqual(orderPrices(keys, 'ascending'), [1, 2, 4, 8]);
  assert.deepEqual(orderPrices(keys, 'descending'), [8, 4, 2, 1]);
  assert.deepEqual(orderPrices(keys, 'shuffle', () => 0), [2, 4, 1, 8]);
  assert.deepEqual(keys, [8, 2, 4, 1]);
});
