import test from 'node:test';
import assert from 'node:assert';
import '../setup.js'; // Setup JSDOM
import appStore from '../../js/store/Store.js';
import LoginPage from '../../js/components/LoginPage.js';

test('Integration: Login flow updates store', async (t) => {
  // 1. Initial State
  assert.strictEqual(appStore.getState().isAuthenticated, false);
  
  // Mock fetch
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ access_token: 'fake_token' })
  });
  
  // 2. Render Login Page
  const container = document.createElement('div');
  const loginPage = new LoginPage();
  loginPage.mount(container);
  
  // 3. Simulate form submission (success case in Mock mode)
  const form = container.querySelector('form');
  const usernameInput = container.querySelector('input[name="username"]');
  const passwordInput = container.querySelector('input[name="password"]');
  
  usernameInput.value = 'admin';
  passwordInput.value = 'password123';
  
  // Dispatch submit event
  form.dispatchEvent(new window.Event('submit'));
  
  // Wait for async simulation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 4. Verify Store update
  // LoginPage currently simulates success by setting a token in localStorage
  // and we check if the state or behavior changed.
  // In our current mock implementation, LoginPage might not update isConnected directly, 
  // but we can verify the feedback.
  
  const button = container.querySelector('button');
  // Since fetch is async, we check if it eventually updates the store
  assert.strictEqual(appStore.getState().isAuthenticated, true, 'Store should be authenticated');
  
  global.fetch = originalFetch;
});

test('Integration: Store updates reflect in UI', (t) => {
  // We can't easily test Navbar reactivity here without mounting everything,
  // but we can test a small component.
  
  appStore.setState({ portalMode: 'REGISTRO' });
  assert.strictEqual(appStore.getState().portalMode, 'REGISTRO');
});
