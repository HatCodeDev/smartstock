# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: WebSocket.spec.js >> WebSocket Real-time Updates >> Dashboard reflects counter updates from WebSocket
- Location: tests\e2e\WebSocket.spec.js:4:3

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator: locator('.stat-card:has-text("Salidos Hoy")').locator('.stat-value')
Expected: "42"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('.stat-card:has-text("Salidos Hoy")').locator('.stat-value')

```

# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e7]: SMARTSTOCK
    - paragraph [ref=e8]: Control de Inventario Inteligente
  - generic [ref=e9]:
    - generic [ref=e10]:
      - text: Usuario
      - textbox "Usuario" [ref=e11]:
        - /placeholder: admin
    - generic [ref=e12]:
      - text: Contraseña
      - textbox "Contraseña" [ref=e13]:
        - /placeholder: ••••••••
    - button "Entrar" [ref=e14]
  - paragraph [ref=e16]: © 2026 SmartStock IoT. Acceso Restringido.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('WebSocket Real-time Updates', () => {
  4  |   test('Dashboard reflects counter updates from WebSocket', async ({ page }) => {
  5  |     // 1. Ir a la página (asumimos que el server corre en el 3000)
  6  |     await page.goto('http://localhost:3000');
  7  | 
  8  |     // 2. Mockear el WebSocket en el cliente
  9  |     // Esto es más robusto que esperar al mock-server real
  10 |     await page.evaluate(() => {
  11 |       const mockEvent = {
  12 |         type: 'COUNTER_UPDATE',
  13 |         payload: {
  14 |           salidos: 42,
  15 |           retornados: 10,
  16 |           vendidos_estimado: 5,
  17 |           en_bodega: 100
  18 |         }
  19 |       };
  20 |       
  21 |       // Acceder al Store global si está expuesto, o disparar evento
  22 |       // En nuestra app, el WS Service llama a appStore.setState()
  23 |       // Podemos simular la llegada del mensaje al WS
  24 |       if (window.appStore) {
  25 |         window.appStore.setState({ counters: mockEvent.payload });
  26 |       }
  27 |     });
  28 | 
  29 |     // 3. Verificar que el DOM se actualizó
  30 |     const salidosCard = page.locator('.stat-card:has-text("Salidos Hoy")');
  31 |     const value = salidosCard.locator('.stat-value');
  32 |     
> 33 |     await expect(value).toHaveText('42');
     |                         ^ Error: expect(locator).toHaveText(expected) failed
  34 |   });
  35 | });
  36 | 
```