import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost'
});

const { window } = dom;

global.window = window;
global.document = window.document;
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.Event = window.Event;
global.CustomEvent = window.CustomEvent;
global.FormData = window.FormData;
global.localStorage = {
  getItem: () => null,
  setItem: () => null,
  removeItem: () => null
};
