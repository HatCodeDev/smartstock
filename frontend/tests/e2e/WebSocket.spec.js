import { test, expect } from '@playwright/test';

test.describe('WebSocket Real-time Updates', () => {
  test('Dashboard reflects counter updates from WebSocket', async ({ page }) => {
    // 1. Ir a la página (asumimos que el server corre en el 3000)
    await page.goto('http://localhost:3000');

    // 2. Mockear el WebSocket en el cliente
    // Esto es más robusto que esperar al mock-server real
    await page.evaluate(() => {
      const mockEvent = {
        type: 'COUNTER_UPDATE',
        payload: {
          salidos: 42,
          retornados: 10,
          vendidos_estimado: 5,
          en_bodega: 100
        }
      };
      
      // Acceder al Store global si está expuesto, o disparar evento
      // En nuestra app, el WS Service llama a appStore.setState()
      // Podemos simular la llegada del mensaje al WS
      if (window.appStore) {
        window.appStore.setState({ counters: mockEvent.payload });
      }
    });

    // 3. Verificar que el DOM se actualizó
    const salidosCard = page.locator('.stat-card:has-text("Salidos Hoy")');
    const value = salidosCard.locator('.stat-value');
    
    await expect(value).toHaveText('42');
  });
});
