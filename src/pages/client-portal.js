import { supabase } from '../services/supabase.js';
import { addPayment, getLatestPayment } from '../db/payments.js';
import { getDB } from '../db/database.js';
import { fetchExchangeRate } from '../services/exchange-rate.js';
import { bsToUsd } from '../utils/currency.js';
import { calculateExpiration, todayISO, getMembershipStatus, daysRemainingText, formatDate } from '../utils/dates.js';
import { showToast } from '../components/toast.js';

export async function render(container) {
  let gymName = 'GymPay';
  try {
    const db = await getDB();
    const gymSetting = await db.get('settings', 'nombreGym');
    if (gymSetting && gymSetting.value) gymName = gymSetting.value;
  } catch (e) {}

  container.innerHTML = `
    <div style="max-width: 500px; margin: 40px auto; padding: var(--space-md);">
      <div class="card" style="text-align: center; padding: var(--space-xl);">
        <h1 style="color: var(--accent-primary); margin-bottom: 5px;">${gymName}</h1>
        <p class="text-muted" style="margin-bottom: var(--space-xl);">Portal de Autogestión</p>

        <div id="login-section">
          <p style="margin-bottom: var(--space-md);">Ingresa tu número de cédula para consultar tu estado y reportar pagos.</p>
          <form id="portal-login-form">
            <input type="text" id="cedula-input" class="form-input" placeholder="Ej: 12345678" required style="text-align: center; font-size: 18px; margin-bottom: var(--space-md);">
            <button type="submit" class="btn btn-primary w-full">Ingresar</button>
          </form>
        </div>

        <div id="portal-content" style="display: none; text-align: left;">
          <!-- Loaded dynamically -->
        </div>

      </div>
    </div>
  `;

  const loginForm = document.getElementById('portal-login-form');
  const cedulaInput = document.getElementById('cedula-input');
  const loginSection = document.getElementById('login-section');
  const contentSection = document.getElementById('portal-content');

  let currentMember = null;
  let currentRate = 0;
  let precioMensual = 0;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cedula = cedulaInput.value.trim();
    if (!cedula) return;

    const btn = loginForm.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Buscando...';

    try {
      const { data, error } = await supabase.from('members').select('*').eq('cedula', cedula).maybeSingle();
      
      if (error || !data) {
        showToast('Cédula no encontrada en el sistema', 'error');
        btn.disabled = false;
        btn.textContent = 'Ingresar';
        return;
      }

      currentMember = data;
      
      // Load extra data for payment form
      const db = await getDB();
      const pSet = await db.get('settings', 'precioMensual');
      if (pSet) precioMensual = pSet.value;
      const rData = await fetchExchangeRate();
      if (rData) currentRate = rData.rate;

      renderPortalContent();

    } catch (err) {
      showToast('Error de conexión', 'error');
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });

  async function renderPortalContent() {
    loginSection.style.display = 'none';
    contentSection.style.display = 'block';

    const latestPayment = await getLatestPayment(currentMember.id);
    const expiration = latestPayment ? latestPayment.fechaVencimiento : null;
    let statusHtml = '';

    if (expiration) {
      const status = getMembershipStatus(expiration);
      const isExpired = status === 'expired';
      statusHtml = `
        <div style="background: var(--bg-hover); padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-lg); text-align: center;">
          <div style="font-size: 14px; color: var(--text-muted); margin-bottom: 5px;">Tu plan actual vence el:</div>
          <div style="font-size: 18px; font-weight: bold; color: ${isExpired ? 'var(--text-red)' : 'var(--text-green)'};">
            ${formatDate(expiration)}
          </div>
          <div style="font-size: 13px; margin-top: 5px;">${daysRemainingText(expiration)}</div>
        </div>
      `;
    } else {
      statusHtml = `
        <div style="background: var(--bg-hover); padding: var(--space-md); border-radius: var(--radius-md); margin-bottom: var(--space-lg); text-align: center;">
          <div style="font-size: 14px; color: var(--text-muted);">No tienes pagos registrados.</div>
        </div>
      `;
    }

    const banks = ['Banesco', 'Mercantil', 'Provincial', 'Venezuela', 'BNC', 'Bicentenario', 'Tesoro', 'Exterior', 'BOD', 'Bancamiga', 'Sofitasa', 'Plaza', 'Caroní', 'Del Sur', 'Fondo Común', 'Otro'];

    contentSection.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
        <h3 style="margin: 0;">Hola, ${currentMember.nombre}</h3>
        <button id="btn-logout" class="btn btn-ghost btn-sm" style="padding: 0; color: var(--text-red);">Salir</button>
      </div>

      ${statusHtml}

      <div class="card" style="border-color: var(--border-subtle); box-shadow: none;">
        <div class="card-header" style="padding: var(--space-md); background: var(--bg-primary);">
          <h4 style="margin: 0; font-size: 15px;">Reportar Pago Móvil / Transferencia</h4>
        </div>
        <div class="card-body" style="padding: var(--space-md);">
          <form id="report-payment-form">
            <div class="form-group">
              <label class="form-label">Monto transferido (Bs) *</label>
              <input type="number" name="montoBs" class="form-input" min="1" step="0.01" value="${precioMensual}" required>
              <div class="form-hint">Mensualidad estándar: ${precioMensual} Bs</div>
            </div>

            <div class="form-group">
              <label class="form-label">Banco Origen *</label>
              <select name="banco" class="form-select" required>
                <option value="" disabled selected>Selecciona tu banco</option>
                ${banks.map(b => `<option value="${b}">${b}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Referencia (Últimos 4 dígitos) *</label>
              <input type="text" name="referencia" class="form-input" maxlength="4" pattern="\\d{4,}" placeholder="Ej: 1234" required>
            </div>

            <button type="submit" class="btn btn-primary w-full">Enviar Reporte</button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('btn-logout').addEventListener('click', () => {
      currentMember = null;
      cedulaInput.value = '';
      loginSection.style.display = 'block';
      contentSection.style.display = 'none';
    });

    document.getElementById('report-payment-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const btn = form.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Enviando...';

      const formData = new FormData(form);
      const montoBs = parseFloat(formData.get('montoBs'));
      const today = todayISO();
      
      // Calculate expiration from the latest expiration if active, or from today if expired
      let startForExp = today;
      if (expiration && getMembershipStatus(expiration) !== 'expired') {
        startForExp = expiration.split('T')[0];
      }

      const data = {
        memberId: currentMember.id,
        montoBs,
        tasaUsd: currentRate,
        montoUsd: bsToUsd(montoBs, currentRate),
        fechaPago: today,
        fechaVencimiento: calculateExpiration(startForExp, 30),
        diasPlan: 30,
        metodoPago: 'pagoMovil',
        banco: formData.get('banco'),
        referencia: formData.get('referencia'),
        concepto: 'mensualidad',
        estado_pago: 'pendiente',
        notas: 'Reportado por el cliente desde portal'
      };

      try {
        await addPayment(data);
        showToast('Pago reportado exitosamente. Esperando aprobación.', 'success');
        form.reset();
        contentSection.innerHTML = `
          <div style="text-align: center; padding: 40px 0;">
            <div style="font-size: 40px; margin-bottom: 15px;">✅</div>
            <h3 style="margin-bottom: 10px;">¡Reporte Enviado!</h3>
            <p class="text-muted" style="margin-bottom: 20px;">Tu pago está siendo verificado por la recepción.</p>
            <button id="btn-back-portal" class="btn btn-secondary">Volver</button>
          </div>
        `;
        document.getElementById('btn-back-portal').addEventListener('click', renderPortalContent);
      } catch (err) {
        showToast('Error al enviar reporte', 'error');
        btn.disabled = false;
        btn.textContent = 'Enviar Reporte';
      }
    });
  }
}
