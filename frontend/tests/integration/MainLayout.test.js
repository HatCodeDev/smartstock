import { test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><div id="app"></div>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.localStorage = { getItem: () => null, setItem: () => null, removeItem: () => null };

import appStore from '../../js/store/Store.js';
import MainLayout from '../../js/components/MainLayout.js';

test('MainLayout: renders LoginPage when not authenticated', async () => {
  appStore.setState({ isAuthenticated: false });
  
  const target = document.getElementById('app');
  const layout = new MainLayout();
  layout.mount(target);
  
  const loginForm = target.querySelector('#login-form');
  assert.ok(loginForm, 'Login form should be present in the document');
  
  const sidebar = target.querySelector('.sidebar');
  assert.strictEqual(sidebar, null, 'Sidebar should not be rendered');
});
