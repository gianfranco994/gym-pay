import { supabase } from '../services/supabase.js';
import { addPayment, getLatestPayment, hasPendingPayment } from '../db/payments.js';
import { getDB } from '../db/database.js';
import { fetchExchangeRate } from '../services/exchange-rate.js';
import { bsToUsd } from '../utils/currency.js';
import { calculateExpiration, todayISO, getMembershipStatus, daysRemainingText, formatDate } from '../utils/dates.js';
import { showToast } from '../components/toast.js';

// Rate limiting storage key
const RATE_LIMIT_KEY = 'gympay_portal_attempts';
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000; // 30 seconds

/**
 * Check and record a login attempt. Returns true if allowed, false if locked out.
 */
function checkRateLimit() {
  try {
    const stored = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY) || '{"attempts":0,"since":0}');
    const now = Date.now();

    // Reset if lockout period has passed
    if (stored.attempts >= MAX_ATTEMPTS && now - stored.since < LOCKOUT_MS) {
      const remaining = Math.ceil((LOCKOUT_MS - (now - stored.since)) / 1000);
      return { allowed: false, remaining };
    }

    if (now - stored.since >= LOCKOUT_MS) {
      // Reset
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify({ attempts: 1, since: now }));
    } else {
      stored.attempts += 1;
      localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(stored));
    }

    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Reset rate limit counter on successful login.
 */
function resetRateLimit() {
  localStorage.removeItem(RATE_LIMIT_KEY);
}

export async function render(container) {
  let gymName = 'GymPay';
  try {
    const db = await getDB();
    const gymSetting = await db.get('settings', 'nombreGym');
    if (gymSetting && gymSetting.value) gymName = gymSetting.value;
  } catch (e) {}

  container.innerHTML = `
    <div id="portal-wrapper" style="max-width: 500px; margin: 40px auto; padding: var(--space-md);">
      <div id="login-section">
        <div class="card" style="text-align: center; padding: var(--space-xl);">
          <h1 style="color: var(--accent-primary); margin-bottom: 5px;">${gymName}</h1>
          <p class="text-muted" style="margin-bottom: var(--space-xl);">Portal de Autogestión</p>
          <p style="margin-bottom: var(--space-md);">Ingresa tu número de cédula para consultar tu estado y reportar pagos.</p>
          <form id="portal-login-form">
            <input type="text" id="cedula-input" class="form-input" placeholder="Ej: 12345678" required
              style="text-align: center; font-size: 18px; margin-bottom: var(--space-md);"
              maxlength="12" inputmode="numeric">
            <div id="rate-limit-msg" style="display:none; color: var(--text-yellow); font-size:13px; margin-bottom: var(--space-sm);"></div>
            <button type="submit" class="btn btn-primary w-full">Ingresar</button>
          </form>
        </div>
      </div>
      <div id="portal-content" style="display: none; text-align: left;"></div>
    </div>
  `;


  const loginForm = document.getElementById('portal-login-form');
  const cedulaInput = document.getElementById('cedula-input');
  const loginSection = document.getElementById('login-section');
  const contentSection = document.getElementById('portal-content');
  const rateLimitMsg = document.getElementById('rate-limit-msg');

  let currentMember = null;
  let currentRate = 0;
  let precioMensual = 0;
  let pagoMovilGym = { cedula: '', banco: '', codigoBanco: '', telefono: '' };

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Rate limiting check
    const rl = checkRateLimit();
    if (!rl.allowed) {
      rateLimitMsg.style.display = 'block';
      rateLimitMsg.textContent = `Demasiados intentos. Espera ${rl.remaining} segundos e intenta de nuevo.`;
      return;
    }
    rateLimitMsg.style.display = 'none';

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

      // Successful login — reset rate limit
      resetRateLimit();
      currentMember = data;
      
      // Load extra data for payment form
      const db = await getDB();
      const pSet = await db.get('settings', 'precioMensual');
      if (pSet) precioMensual = pSet.value;
      const pmSet = await db.get('settings', 'pagoMovilGym');
      if (pmSet && typeof pmSet.value === 'object') pagoMovilGym = pmSet.value;
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

    // Check for existing pending payment to prevent duplicates
    const alreadyPending = await hasPendingPayment(currentMember.id);

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

    // If member already has a pending payment, show message instead of form
    const paymentFormHtml = alreadyPending ? `
      <div class="card" style="border-color: var(--text-yellow); box-shadow: none;">
        <div class="card-body" style="padding: var(--space-md); text-align: center;">
          <div style="font-size: 30px; margin-bottom: 10px;">⏳</div>
          <h4 style="margin: 0 0 8px 0; color: var(--text-yellow);">Pago Pendiente</h4>
          <p class="text-muted" style="font-size: 13px; margin: 0;">
            Ya tienes un pago reportado esperando verificación. Espera a que la recepción lo apruebe antes de enviar otro.
          </p>
        </div>
      </div>
    ` : `
      <div class="card" style="border-color: var(--border-subtle); box-shadow: none;">
        <div class="card-header" style="padding: var(--space-md); background: var(--bg-primary);">
          <h4 style="margin: 0; font-size: 15px;">Reportar Pago Móvil / Transferencia</h4>
        </div>
        <div class="card-body" style="padding: var(--space-md);">
          <form id="report-payment-form">
            <div class="form-group">
              <label class="form-label">Monto transferido (Bs) *</label>
              <input type="number" name="montoBs" class="form-input" min="1" max="${precioMensual * 10 || 999999}" step="0.01" value="${precioMensual}" required>
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
              <input type="text" name="referencia" class="form-input" maxlength="4" pattern="\\d{4}" placeholder="Ej: 1234" required inputmode="numeric">
            </div>

            <button type="submit" class="btn btn-primary w-full">Enviar Reporte</button>
          </form>
        </div>
      </div>
    `;

    // Build gym payment info card
    const hasPagoMovilData = pagoMovilGym.telefono || pagoMovilGym.cedula;
    const pagoMovilInfoHtml = hasPagoMovilData ? `
      <div style="
        background: linear-gradient(135deg, hsla(262,68%,62%,0.12), hsla(157,78%,48%,0.08));
        border: 1px solid hsla(262,68%,62%,0.3);
        border-radius: var(--radius-lg);
        padding: var(--space-md);
        margin-bottom: var(--space-lg);
      ">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom: var(--space-md);">
          <span style="font-size:20px;">📲</span>
          <strong style="font-size:15px;">Datos para transferir tu pago</strong>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap: var(--space-sm); font-size:14px; margin-bottom:var(--space-md);">
          ${pagoMovilGym.banco ? `<div><span style="color:var(--text-muted);">Banco</span><br><strong>${pagoMovilGym.banco}${pagoMovilGym.codigoBanco ? ` (${pagoMovilGym.codigoBanco})` : ''}</strong></div>` : ''}
          ${pagoMovilGym.cedula ? `<div><span style="color:var(--text-muted);">Cédula</span><br><strong>${pagoMovilGym.cedula}</strong></div>` : ''}
          ${pagoMovilGym.telefono ? `<div><span style="color:var(--text-muted);">Teléfono</span><br><strong>${pagoMovilGym.telefono}</strong></div>` : ''}
          ${precioMensual ? `<div><span style="color:var(--text-muted);">Monto (30 días)</span><br><strong style="color:var(--status-active);">${precioMensual} Bs</strong></div>` : ''}
        </div>
        <button type="button" id="btn-copy-payment-data" class="btn btn-secondary btn-sm w-full" style="font-size:13px;">
          📋 Copiar datos de pago
        </button>
      </div>
    ` : '';

    contentSection.innerHTML = `
      <div class="card" style="padding: var(--space-xl);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
          <h3 style="margin: 0;">Hola, ${currentMember.nombre}</h3>
          <button type="button" id="btn-portal-logout" class="btn btn-ghost btn-sm" style="padding: 0; color: var(--text-red);">Salir</button>
        </div>

        ${statusHtml}
        ${pagoMovilInfoHtml}
        ${paymentFormHtml}
      </div>
    `;

    // Copy button logic
    const copyBtn = document.getElementById('btn-copy-payment-data');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const lines = [
          gymName ? `Gym: ${gymName}` : '',
          pagoMovilGym.banco ? `Banco: ${pagoMovilGym.banco}${pagoMovilGym.codigoBanco ? ` (${pagoMovilGym.codigoBanco})` : ''}` : '',
          pagoMovilGym.cedula ? `Cédula: ${pagoMovilGym.cedula}` : '',
          pagoMovilGym.telefono ? `Teléfono: ${pagoMovilGym.telefono}` : '',
          precioMensual ? `Monto: ${precioMensual} Bs` : '',
        ].filter(Boolean).join('\n');
        navigator.clipboard.writeText(lines).then(() => {
          copyBtn.textContent = '✅ Copiado!';
          setTimeout(() => { copyBtn.innerHTML = '📋 Copiar datos de pago'; }, 2000);
        }).catch(() => {
          showToast('No se pudo copiar', 'error');
        });
      });
    }

    document.getElementById('btn-portal-logout').addEventListener('click', () => {
      currentMember = null;
      cedulaInput.value = '';
      loginSection.style.display = 'block';
      contentSection.style.display = 'none';
      contentSection.innerHTML = '';
    });

    const reportForm = document.getElementById('report-payment-form');
    if (!reportForm) return;

    reportForm.addEventListener('submit', async (e) => {
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
