import test from 'node:test';
import assert from 'node:assert';
import { Store } from '../../js/store/Store.js';

test('Store: initial state', (t) => {
  const store = new Store({ count: 0 });
  assert.strictEqual(store.getState().count, 0);
});

test('Store: setState updates state', (t) => {
  const store = new Store({ count: 0 });
  store.setState({ count: 1 });
  assert.strictEqual(store.getState().count, 1);
});

test('Store: subscribe notifies listeners', (t) => {
  const store = new Store({ count: 0 });
  let called = false;
  
  store.subscribe((state) => {
    called = true;
    assert.strictEqual(state.count, 5);
  });
  
  store.setState({ count: 5 });
  assert.strictEqual(called, true);
});

test('Store: unsubscribe works', (t) => {
  const store = new Store({ count: 0 });
  let callCount = 0;
  
  const unsubscribe = store.subscribe(() => {
    callCount++;
  });
  
  store.setState({ count: 1 });
  unsubscribe();
  store.setState({ count: 2 });
  
  assert.strictEqual(callCount, 1);
});
