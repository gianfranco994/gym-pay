# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: gympay.spec.js >> GymPay E2E: Create member and register payment
- Location: tests\gympay.spec.js:3:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.member-dropdown-item:has-text("Test User")') to be visible

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - complementary [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: GP
      - generic [ref=e6]: GymPay
    - navigation [ref=e7]:
      - generic [ref=e8]: Principal
      - button "📊 Dashboard" [ref=e9] [cursor=pointer]:
        - generic [ref=e10]: 📊
        - generic [ref=e11]: Dashboard
      - button "👥 Miembros" [ref=e12] [cursor=pointer]:
        - generic [ref=e13]: 👥
        - generic [ref=e14]: Miembros
      - button "💳 Registrar Pago" [ref=e15] [cursor=pointer]:
        - generic [ref=e16]: 💳
        - generic [ref=e17]: Registrar Pago
      - generic [ref=e18]: Análisis
      - button "📈 Reportes" [ref=e19] [cursor=pointer]:
        - generic [ref=e20]: 📈
        - generic [ref=e21]: Reportes
      - generic [ref=e22]: Sistema
      - button "⚙️ Configuración" [ref=e23] [cursor=pointer]:
        - generic [ref=e24]: ⚙️
        - generic [ref=e25]: Configuración
    - generic [ref=e27]:
      - generic [ref=e28]: Tasa BCV
      - 'generic "Fuente: BCV (DolarApi) Actualizado: 21/5/2026, 9:23:18 p. m." [ref=e29]': 523,68 Bs
  - main [ref=e30]:
    - generic [ref=e31]:
      - generic [ref=e32]:
        - heading "Registrar Pago" [level=1] [ref=e33]
        - paragraph [ref=e34]: Procesa un nuevo pago o renovación de mensualidad
      - generic [ref=e38]:
        - generic [ref=e39]:
          - generic [ref=e40]: Miembro *
          - generic [ref=e41]:
            - generic [ref=e42]:
              - generic: 🔍
              - textbox "Buscar por nombre o cédula..." [active] [ref=e43]: Test User
            - generic [ref=e45]: No se encontraron resultados
        - generic [ref=e46]:
          - generic [ref=e47]:
            - generic [ref=e48]: Monto (Bs) *
            - spinbutton [ref=e49]
          - generic [ref=e50]:
            - generic [ref=e51]: Equivalente USD
            - generic: $ 0.00
            - generic [ref=e52]: "Tasa: 1 USD = 523.67 Bs"
        - separator [ref=e53]
        - generic [ref=e54]:
          - generic [ref=e55]: Duración del plan
          - generic [ref=e56]:
            - button "30 días" [ref=e57] [cursor=pointer]
            - button "15 días" [ref=e58] [cursor=pointer]
            - button "Personalizado" [ref=e59] [cursor=pointer]
        - generic [ref=e60]:
          - generic [ref=e61]:
            - generic [ref=e62]: Fecha de Pago
            - textbox [ref=e63]: 2026-05-22
          - generic [ref=e64]:
            - generic [ref=e65]: Fecha de Vencimiento
            - textbox [ref=e66]: 2026-06-21
        - separator [ref=e67]
        - generic [ref=e68]:
          - generic [ref=e69]: Método de Pago *
          - generic [ref=e70]:
            - generic [ref=e71] [cursor=pointer]: 📱 Pago Móvil / Transferencia
            - generic [ref=e72] [cursor=pointer]: 💵 Efectivo
        - generic [ref=e73]:
          - generic [ref=e74]:
            - generic [ref=e75]: Banco
            - combobox [ref=e76] [cursor=pointer]:
              - option "Seleccione banco" [disabled] [selected]
              - option "Banesco"
              - option "Mercantil"
              - option "Provincial"
              - option "Venezuela"
              - option "BNC"
              - option "Bicentenario"
              - option "Tesoro"
              - option "Exterior"
              - option "BOD"
              - option "Bancamiga"
              - option "Sofitasa"
              - option "Plaza"
              - option "Caroní"
              - option "Del Sur"
              - option "Fondo Común"
              - option "Otro"
          - generic [ref=e77]:
            - generic [ref=e78]: Referencia (últimos 4 dígitos)
            - 'textbox "Ej: 1234" [ref=e79]'
        - generic [ref=e80]:
          - generic [ref=e81]: Concepto
          - generic [ref=e82]:
            - generic [ref=e83] [cursor=pointer]: Mensualidad
            - generic [ref=e84] [cursor=pointer]: Inscripción
        - generic [ref=e85]:
          - generic [ref=e86]: Notas (opcional)
          - textbox "Alguna observación adicional..." [ref=e87]
        - button "✓ Registrar Pago" [ref=e88] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('GymPay E2E: Create member and register payment', async ({ page }) => {
  4  |   // 1. Go to Dashboard
  5  |   await page.goto('http://localhost:5173/');
  6  |   await expect(page).toHaveTitle(/GymPay/);
  7  |   await expect(page.locator('.page-title')).toHaveText('Dashboard');
  8  | 
  9  |   // 2. Go to Members page
  10 |   await page.click('button[data-route="members"]');
  11 |   await expect(page.locator('.page-title')).toHaveText('Miembros');
  12 | 
  13 |   // 3. Create a new member
  14 |   await page.click('#btn-new-member');
  15 |   await expect(page.locator('.modal-title')).toHaveText('Nuevo Miembro');
  16 |   
  17 |   await page.fill('input[name="nombre"]', 'Test');
  18 |   await page.fill('input[name="apellido"]', 'User');
  19 |   await page.fill('input[name="cedula"]', '12345678');
  20 |   await page.fill('input[name="edad"]', '25');
  21 |   await page.fill('input[name="telefono"]', '0412-1234567');
  22 |   
  23 |   await page.click('button[data-action="submit"]'); // Guardar Miembro
  24 |   
  25 |   // Wait for success toast
  26 |   await expect(page.locator('.toast.success')).toBeVisible();
  27 |   
  28 |   // Verify member is in the list
  29 |   await expect(page.locator('td:has-text("Test User")')).toBeVisible();
  30 | 
  31 |   // 4. Go to New Payment page
  32 |   await page.click('button[data-route="new-payment"]');
  33 |   await expect(page.locator('.page-title')).toHaveText('Registrar Pago');
  34 | 
  35 |   // Search member
  36 |   await page.waitForTimeout(1000); // Wait for members to load
  37 |   await page.fill('#member-search', 'Test User');
> 38 |   await page.waitForSelector('.member-dropdown-item:has-text("Test User")');
     |              ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  39 |   await page.click('.member-dropdown-item:has-text("Test User")');
  40 |   
  41 |   // Verify member card is shown
  42 |   await expect(page.locator('#selected-member-card')).toBeVisible();
  43 |   
  44 |   // Fill payment details
  45 |   await page.fill('input[name="montoBs"]', '500');
  46 |   
  47 |   // Select Pago Movil
  48 |   await page.click('input[value="pagoMovil"]');
  49 |   
  50 |   // Select Bank and Ref
  51 |   await page.selectOption('select[name="banco"]', 'Banesco');
  52 |   await page.fill('input[name="referencia"]', '1234');
  53 |   
  54 |   // Submit payment
  55 |   await page.click('button[type="submit"]');
  56 | 
  57 |   // 5. Verify navigation to Member Detail and payment success
  58 |   await expect(page.locator('.toast.success')).toBeVisible();
  59 |   
  60 |   // URL should contain member-detail
  61 |   await expect(page).toHaveURL(/#\/member-detail/);
  62 |   
  63 |   // Verify payment is in history table
  64 |   await expect(page.locator('td:has-text("Banesco - *1234")')).toBeVisible();
  65 |   await expect(page.locator('td:has-text("📱 Pago Móvil")')).toBeVisible();
  66 | });
  67 | 
```