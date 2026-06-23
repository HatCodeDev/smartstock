import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8000 });

console.log('🧪 SmartStock Mock WebSocket Server running on ws://localhost:8000');

let counters = {
  salidos: 10,
  retornados: 5,
  vendidos_estimado: 2,
  en_bodega: 45
};

wss.on('connection', (ws) => {
  console.log('🤝 Client connected to Mock Server');

  // Send initial state
  ws.send(JSON.stringify({ type: 'COUNTER_UPDATE', payload: counters }));
  ws.send(JSON.stringify({ type: 'PORTAL_MODE_CHANGED', payload: 'SALIDA' }));

  // Simulate periodic updates
  const interval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      // Randomly increment counters
      const change = Math.random() > 0.7;
      if (change) {
        counters.salidos++;
        counters.en_bodega--;
        
        ws.send(JSON.stringify({ type: 'COUNTER_UPDATE', payload: counters }));
        console.log('📡 Sent COUNTER_UPDATE:', counters);

        // Randomly send an alert
        if (Math.random() > 0.8) {
          const alert = {
            id: Date.now(),
            type: 'TAG_DESCONOCIDA',
            message: `Tag desconocida detectada: EPC${Math.floor(Math.random() * 1000)}`,
            timestamp: new Date().toISOString()
          };
          ws.send(JSON.stringify({ type: 'ALERT', payload: alert }));
          console.log('🚨 Sent ALERT:', alert);
        }
      }
    }
  }, 3000);

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    console.log('📥 Received:', data);
    if (data.type === 'PING') {
      ws.send(JSON.stringify({ type: 'PONG' }));
    }
  });

  ws.on('close', () => {
    console.log('👋 Client disconnected');
    clearInterval(interval);
  });
});
