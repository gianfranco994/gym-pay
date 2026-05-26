import { getDB } from '../db/database.js';
import { fetchExchangeRate, clearRateCache } from '../services/exchange-rate.js';
import { downloadBackup, importData, clearAllData } from '../utils/export.js';
import { formatRate, setRate } from '../utils/currency.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';
import { todayISO, formatDate } from '../utils/dates.js';

export async function render(container) {
  let db;
  let settings = {
    nombreGym: 'Mi Gimnasio',
    precioMensual: 0,
    precioMensualUsd: 0,
    tasaManual: 0,
    mensajeWhatsApp: 'Hola {nombre}! 👋 Te recordamos que tu mensualidad en {gym} vence el {fecha}. ¡Te esperamos para renovar! 💪🏋️'
  };

  try {
    db = await getDB();
    const keys = ['nombreGym', 'precioMensual', 'precioMensualUsd', 'tasaManual', 'mensajeWhatsApp'];
    for (const key of keys) {
      const val = await db.get('settings', key);
      if (val) settings[key] = val.value;
    }
  } catch (e) {
    console.error('Error loading settings', e);
  }

  // Current rate display
  let rateDisplay = 'Cargando...';
  let rateSource = '';
  let currentRate = 0;
  try {
    const rateData = await fetchExchangeRate();
    if (rateData && rateData.rate) {
      currentRate = rateData.rate;
      rateDisplay = formatRate(rateData.rate);
      rateSource = `Fuente: ${rateData.source} • Última actualización: ${new Date(rateData.timestamp).toLocaleString('es-VE')}`;
    } else {
      rateDisplay = 'No disponible';
    }
  } catch (e) {
    rateDisplay = 'Error al consultar API';
  }

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Configuración</h1>
      <p class="page-subtitle">Ajustes del sistema y respaldos de datos</p>
    </div>

    <div style="max-width: 800px;">
      
      <!-- General Gym Settings -->
      <div class="card mb-lg">
        <div class="card-header"><h3 class="card-title">🏢 Información del Gimnasio</h3></div>
        <div class="card-body">
          <form id="form-gym">
            <div class="form-group mb-md">
              <label class="form-label">Nombre del Gimnasio</label>
              <input type="text" name="nombreGym" class="form-input" value="${settings.nombreGym}" required>
            </div>
            <div class="form-row">
              <div class="form-group mb-md">
                <label class="form-label">💵 Precio Mensual ($)</label>
                <input type="number" name="precioMensualUsd" id="precio-usd" class="form-input" min="0" step="0.01" value="${settings.precioMensualUsd || ''}">
                <div class="form-hint">Precio de referencia en dólares</div>
              </div>
              <div class="form-group mb-md">
                <label class="form-label">🇻🇪 Precio Mensual (Bs)</label>
                <input type="number" name="precioMensual" id="precio-bs" class="form-input" min="0" step="0.01" value="${settings.precioMensual}">
                <div class="form-hint" id="precio-bs-hint">${currentRate > 0 && settings.precioMensualUsd > 0 ? `Auto-calculado: $${settings.precioMensualUsd} × ${currentRate.toFixed(2)} = ${(settings.precioMensualUsd * currentRate).toFixed(2)} Bs` : 'Monto por defecto al registrar pagos'}</div>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Guardar Cambios</button>
          </form>
        </div>
      </div>

      <!-- Tasa de Cambio -->
      <div class="card mb-lg">
        <div class="card-header"><h3 class="card-title">💱 Tasa de Cambio (USD/Bs)</h3></div>
        <div class="card-body">
          <div class="settings-row" style="margin-bottom: var(--space-md); padding-bottom: var(--space-md);">
            <div class="settings-row-info">
              <div class="settings-row-label">Tasa Actual BCV</div>
              <div class="settings-row-desc text-green font-bold" id="rate-display-val">${rateDisplay}</div>
              <div class="settings-row-desc" id="rate-display-src" style="font-size: 11px;">${rateSource}</div>
            </div>
            <button type="button" id="btn-refresh-rate" class="btn btn-secondary btn-sm">↻ Actualizar Tasa</button>
          </div>
          
          <form id="form-rate">
            <div class="form-group mb-md">
              <label class="form-label">Tasa Manual (opcional)</label>
              <input type="number" name="tasaManual" class="form-input" min="0" step="0.01" value="${settings.tasaManual || ''}" style="max-width: 200px;">
              <div class="form-hint">Si ingresas un valor aquí, se usará en lugar de la tasa del BCV. Déjalo en 0 o vacío para usar la API.</div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Guardar Tasa Manual</button>
          </form>
        </div>
      </div>

      <!-- WhatsApp Template -->
      <div class="card mb-lg">
        <div class="card-header"><h3 class="card-title">📱 Plantilla de WhatsApp</h3></div>
        <div class="card-body">
          <form id="form-whatsapp">
            <div class="form-group mb-md">
              <label class="form-label">Mensaje de Recordatorio</label>
              <textarea name="mensajeWhatsApp" class="form-textarea" style="height: 100px;">${settings.mensajeWhatsApp}</textarea>
              <div class="form-hint" style="margin-top: var(--space-sm);">
                Variables disponibles:<br>
                <code class="font-mono" style="background: var(--bg-hover); padding: 2px 4px; border-radius: 4px;">{nombre}</code> Nombre del cliente<br>
                <code class="font-mono" style="background: var(--bg-hover); padding: 2px 4px; border-radius: 4px;">{gym}</code> Nombre del gimnasio<br>
                <code class="font-mono" style="background: var(--bg-hover); padding: 2px 4px; border-radius: 4px;">{fecha}</code> Fecha de vencimiento
              </div>
            </div>
            <div style="display: flex; gap: var(--space-sm);">
              <button type="submit" class="btn btn-primary btn-sm">Guardar Plantilla</button>
              <button type="button" id="btn-preview-wa" class="btn btn-secondary btn-sm">Vista Previa</button>
            </div>
          </form>
          <div id="wa-preview" class="card" style="display: none; margin-top: var(--space-md); padding: var(--space-md); background: var(--bg-hover); border-color: var(--whatsapp);"></div>
        </div>
      </div>

    </div>
  `;

  // General Settings Form
  document.getElementById('form-gym').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await db.put('settings', { key: 'nombreGym', value: formData.get('nombreGym') });
      await db.put('settings', { key: 'precioMensualUsd', value: parseFloat(formData.get('precioMensualUsd')) || 0 });
      await db.put('settings', { key: 'precioMensual', value: parseFloat(formData.get('precioMensual')) || 0 });
      showToast('Configuración general guardada', 'success');
    } catch (err) {
      showToast('Error al guardar', 'error');
    }
  });

  // Auto-calculate Bs from USD when USD price changes
  const precioUsdInput = document.getElementById('precio-usd');
  const precioBsInput = document.getElementById('precio-bs');
  const precioBsHint = document.getElementById('precio-bs-hint');
  if (precioUsdInput && precioBsInput && currentRate > 0) {
    precioUsdInput.addEventListener('input', () => {
      const usd = parseFloat(precioUsdInput.value) || 0;
      if (usd > 0) {
        const bs = (usd * currentRate).toFixed(2);
        precioBsInput.value = bs;
        precioBsHint.textContent = `Auto-calculado: $${usd} × ${currentRate.toFixed(2)} = ${bs} Bs`;
      } else {
        precioBsHint.textContent = 'Monto por defecto al registrar pagos';
      }
    });
  }

  // Rate Settings
  document.getElementById('btn-refresh-rate').addEventListener('click', async () => {
    const btn = document.getElementById('btn-refresh-rate');
    btn.disabled = true;
    btn.textContent = 'Actualizando...';
    try {
      clearRateCache();
      const rateData = await fetchExchangeRate();
      if (rateData && rateData.rate) {
        document.getElementById('rate-display-val').textContent = formatRate(rateData.rate);
        document.getElementById('rate-display-src').textContent = `Fuente: ${rateData.source} • Última actualización: ${new Date(rateData.timestamp).toLocaleString('es-VE')}`;
        showToast('Tasa actualizada desde BCV', 'success');
      } else {
        throw new Error('No rate');
      }
    } catch (e) {
      showToast('No se pudo actualizar la tasa', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '↻ Actualizar Tasa';
    }
  });

  document.getElementById('form-rate').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = parseFloat(new FormData(e.target).get('tasaManual')) || 0;
    try {
      await db.put('settings', { key: 'tasaManual', value: val });
      showToast('Tasa manual guardada', 'success');
      if (val > 0) setRate(val);
    } catch (err) {
      showToast('Error al guardar', 'error');
    }
  });

  // WhatsApp
  document.getElementById('form-whatsapp').addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = new FormData(e.target).get('mensajeWhatsApp');
    try {
      await db.put('settings', { key: 'mensajeWhatsApp', value: val });
      showToast('Plantilla de WhatsApp guardada', 'success');
    } catch (err) {
      showToast('Error al guardar', 'error');
    }
  });

  document.getElementById('btn-preview-wa').addEventListener('click', () => {
    const template = document.querySelector('textarea[name="mensajeWhatsApp"]').value;
    const gymName = document.querySelector('input[name="nombreGym"]').value;
    const msg = template
      .replace(/{nombre}/g, 'Juan Pérez')
      .replace(/{gym}/g, gymName)
      .replace(/{fecha}/g, formatDate(todayISO()));
    
    const preview = document.getElementById('wa-preview');
    preview.innerHTML = `<div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Vista previa del mensaje:</div><div style="white-space: pre-wrap;">${msg}</div>`;
    preview.style.display = 'block';
  });

}
