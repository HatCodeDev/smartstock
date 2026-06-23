import { test } from 'node:test';
import assert from 'node:assert';

// Mock browser globals for config.js
global.window = { location: { origin: 'http://localhost:3000' } };
global.localStorage = { getItem: () => null, setItem: () => null, removeItem: () => null };

import apiService from '../../js/services/ApiService.js';

test('ApiService: sends form-data correctly when body is URLSearchParams', async (t) => {
  // Mock global fetch
  const originalFetch = global.fetch;
  let capturedOptions = null;
  
  global.fetch = async (url, options) => {
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'test_token' })
    };
  };

  const params = new URLSearchParams();
  params.append('username', 'admin');
  params.append('password', 'admin');

  await apiService.post('/auth/login', params);

  // Verification
  assert.ok(capturedOptions, 'Fetch should have been called');
  assert.strictEqual(capturedOptions.headers['Content-Type'], undefined, 'Fetch should auto-set Content-Type for URLSearchParams');
  assert.ok(capturedOptions.body instanceof URLSearchParams, 'Body should be URLSearchParams');
  assert.strictEqual(capturedOptions.body.get('username'), 'admin');

  // Cleanup
  global.fetch = originalFetch;
});

test('ApiService: handles 401 Unauthorized by clearing state', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized'
  });

  // Mock Store
  const mockStore = (await import('../../js/store/Store.js')).default;
  const storeSpy = [];
  mockStore.subscribe(state => storeSpy.push(state));

  try {
    await apiService.get('/any-endpoint');
  } catch (error) {
    // Expected error
  }

  assert.strictEqual(storeSpy.some(s => s.isAuthenticated === false), true, 'Store should be updated to unauthenticated');

  global.fetch = originalFetch;
});
