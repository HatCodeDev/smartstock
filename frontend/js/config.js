/**
 * SmartStock - Frontend Configuration
 */
const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname)
);

const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const host = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';

export const CONFIG = {
  API_BASE_URL: isLocal ? `http://${hostname}:8000/api` : '/api',
  WS_BASE_URL: isLocal ? `ws://${hostname}:8000/ws/dashboard` : `${wsProtocol}//${host}/ws/dashboard`,
  TOKEN_KEY: 'smartstock_token'
};

