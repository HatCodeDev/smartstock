import { test } from 'node:test';
import assert from 'node:assert';
import appStore from '../../js/store/Store.js';

test('Auth State: initial state has authentication fields', () => {
  const state = appStore.getState();
  assert.strictEqual(state.isAuthenticated, false, 'Should be unauthenticated by default');
  assert.strictEqual(state.user, null, 'User should be null by default');
});

test('Auth State: updating auth state works', () => {
  const userData = { username: 'admin', role: 'admin' };
  appStore.setState({ isAuthenticated: true, user: userData });
  
  const state = appStore.getState();
  assert.strictEqual(state.isAuthenticated, true);
  assert.deepStrictEqual(state.user, userData);
});
