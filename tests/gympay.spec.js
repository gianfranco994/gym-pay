import { test, expect } from '@playwright/test';

test('GymPay E2E: Create member and register payment', async ({ page }) => {
  // 1. Go to Dashboard
  await page.goto('http://localhost:5173/');
  await expect(page).toHaveTitle(/GymPay/);
  await expect(page.locator('.page-title')).toHaveText('Dashboard');

  // 2. Go to Members page
  await page.click('button[data-route="members"]');
  await expect(page.locator('.page-title')).toHaveText('Miembros');

  // 3. Create a new member
  await page.click('#btn-new-member');
  await expect(page.locator('.modal-title')).toHaveText('Nuevo Miembro');
  
  await page.fill('input[name="nombre"]', 'Test');
  await page.fill('input[name="apellido"]', 'User');
  await page.fill('input[name="cedula"]', '12345678');
  await page.fill('input[name="edad"]', '25');
  await page.fill('input[name="telefono"]', '0412-1234567');
  
  await page.click('button[data-action="submit"]'); // Guardar Miembro
  
  // Wait for success toast
  await expect(page.locator('.toast.success')).toBeVisible();
  
  // Verify member is in the list
  await expect(page.locator('td:has-text("Test User")')).toBeVisible();

  // 4. Go to New Payment page
  await page.click('button[data-route="new-payment"]');
  await expect(page.locator('.page-title')).toHaveText('Registrar Pago');

  // Search member
  await page.waitForTimeout(1000); // Wait for members to load
  await page.fill('#member-search', 'Test User');
  await page.waitForSelector('.member-dropdown-item:has-text("Test User")');
  await page.click('.member-dropdown-item:has-text("Test User")');
  
  // Verify member card is shown
  await expect(page.locator('#selected-member-card')).toBeVisible();
  
  // Fill payment details
  await page.fill('input[name="montoBs"]', '500');
  
  // Select Pago Movil
  await page.click('input[value="pagoMovil"]');
  
  // Select Bank and Ref
  await page.selectOption('select[name="banco"]', 'Banesco');
  await page.fill('input[name="referencia"]', '1234');
  
  // Submit payment
  await page.click('button[type="submit"]');

  // 5. Verify navigation to Member Detail and payment success
  await expect(page.locator('.toast.success')).toBeVisible();
  
  // URL should contain member-detail
  await expect(page).toHaveURL(/#\/member-detail/);
  
  // Verify payment is in history table
  await expect(page.locator('td:has-text("Banesco - *1234")')).toBeVisible();
  await expect(page.locator('td:has-text("📱 Pago Móvil")')).toBeVisible();
});
