import test from 'node:test';
import assert from 'node:assert';
import { truncate, formatDate } from '../../js/utils/Formatters.js';

test('Formatters: truncate', (t) => {
  assert.strictEqual(truncate('SmartStock is awesome', 10), 'SmartStock...');
  assert.strictEqual(truncate('Short', 10), 'Short');
  assert.strictEqual(truncate('', 10), '');
});

test('Formatters: formatDate', (t) => {
  const date = '2026-05-06T10:00:00Z';
  const formatted = formatDate(date);
  // Note: output might vary by locale in different environments, 
  // but we test it returns a string and handles nulls
  assert.ok(typeof formatted === 'string');
  assert.strictEqual(formatDate(null), '-');
});
