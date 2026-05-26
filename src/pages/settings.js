import { getDB } from '../db/database.js';
import { fetchExchangeRate, clearRateCache } from '../services/exchange-rate.js';
import { downloadBackup, importData, clearAllData } from '../utils/export.js';
import { formatRate, setRate } from '../utils/currency.js';
import { showToast } from '../components/toast.js';
import { showModal, confirmDialog } from '../components/modal.js';
import { todayISO, formatDate, daysRemainingText } from '../utils/dates.js';
import { getInactiveMembers } from '../db/payments.js';
import { deleteMember } from '../db/members.js';

export async function render(container) {
  let db;
  let settings = {
    nombreGym: 'Mi Gimnasio',
    precioMensual: 0,
    precioMensualUsd: 0,
    tasaManual: 0,
    mensajeWhatsApp: 'Hola {nombre}! 👋 Te recordamos que tu mensualidad en {gym} vence el {fecha}. ¡Te esperamos para renovar! 💪🏋️',
    pagoMovilGym: { cedula: '', banco: '', codigoBanco: '', telefono: '' }
  };

  try {
    db = await getDB();
    const keys = ['nombreGym', 'precioMensual', 'precioMensualUsd', 'tasaManual', 'mensajeWhatsApp', 'pagoMovilGym'];
    for (const key of keys) {
      const val = await db.get('settings', key);
      if (val) settings[key] = val.value;
    }
    if (typeof settings.pagoMovilGym !== 'object') settings.pagoMovilGym = { cedula: '', banco: '', codigoBanco: '', telefono: '' };
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

      <!-- Pago Movil del Gym -->
      <div class="card mb-lg">
        <div class="card-header"><h3 class="card-title">📱 Datos de Pago Móvil del Gimnasio</h3></div>
        <div class="card-body">
          <p class="text-secondary" style="font-size: 14px; margin-bottom: var(--space-md);">Estos datos se mostrarán en el Portal del Cliente para que sepan a dónde transferir el pago.</p>
          <form id="form-pagomovil">
            <div class="form-row">
              <div class="form-group mb-md">
                <label class="form-label">Cédula del Titular</label>
                <input type="text" name="cedula" class="form-input" placeholder="Ej: V-12345678" value="${settings.pagoMovilGym.cedula || ''}">
              </div>
              <div class="form-group mb-md">
                <label class="form-label">Teléfono de Pago Móvil</label>
                <input type="text" name="telefono" class="form-input" placeholder="Ej: 0412-1234567" value="${settings.pagoMovilGym.telefono || ''}">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group mb-md">
                <label class="form-label">Banco</label>
                <select name="banco" id="pagomovil-banco" class="form-select">
                  <option value="">Selecciona banco</option>
                  ${[['Banesco','0134'],['Mercantil','0105'],['Provincial','0108'],['Venezuela','0102'],['BNC','0191'],['Bicentenario','0175'],['Del Tesoro','0163'],['Exterior','0115'],['BOD','0116'],['Bancamiga','0172'],['Sofitasa','0137'],['Plaza','0138'],['Caroní','0128'],['Del Sur','0157'],['Fondo Común','0151'],['Otro','0000']].map(([name, code]) => `<option value="${name}" data-code="${code}" ${settings.pagoMovilGym.banco === name ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group mb-md">
                <label class="form-label">Código del Banco</label>
                <input type="text" name="codigoBanco" id="pagomovil-codigo" class="form-input" placeholder="Ej: 0134" maxlength="4" value="${settings.pagoMovilGym.codigoBanco || ''}" readonly>
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-sm">Guardar Datos de Pago</button>
          </form>
        </div>
      </div>

      <!-- Mantenimiento -->
      <div class="card mb-lg" style="border-color: var(--status-danger);">
        <div class="card-header"><h3 class="card-title text-red">🛠️ Mantenimiento de Datos</h3></div>
        <div class="card-body">
          <p class="text-secondary" style="font-size: 14px; margin-bottom: var(--space-md);">Limpia tu base de datos eliminando clientes que tienen mucho tiempo sin pagar (vencidos por más de 30 días, o registrados hace más de 30 días sin ningún pago).</p>
          <button type="button" id="btn-cleanup" class="btn btn-secondary btn-sm" style="color: var(--status-danger); border-color: var(--status-danger);">Ver Clientes Inactivos (> 30 días)</button>
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

  // Cleanup Logic
  const btnCleanup = document.getElementById('btn-cleanup');
  if (btnCleanup) {
    btnCleanup.addEventListener('click', async () => {
      btnCleanup.disabled = true;
      btnCleanup.textContent = 'Cargando...';
      try {
        const inactiveMembers = await getInactiveMembers(30);
        
        if (inactiveMembers.length === 0) {
          showToast('No hay clientes con más de 30 días inactivos.', 'success');
          btnCleanup.disabled = false;
          btnCleanup.textContent = 'Ver Clientes Inactivos (> 30 días)';
          return;
        }

        showModal({
          title: 'Clientes Inactivos (> 30 días)',
          content: `
            <p class="text-secondary" style="font-size: 14px; margin-bottom: var(--space-md);">Selecciona los clientes que deseas borrar permanentemente. Esta acción no se puede deshacer y borrará también sus historiales de pago.</p>
            
            <div style="margin-bottom: var(--space-md); padding: var(--space-sm); background: var(--bg-hover); border-radius: var(--radius-sm);">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: bold;">
                <input type="checkbox" id="selectAllCleanup"> Seleccionar todos (${inactiveMembers.length})
              </label>
            </div>

            <div id="cleanup-list" style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; border: 1px solid var(--border-subtle); padding: var(--space-sm); border-radius: var(--radius-sm);">
              ${inactiveMembers.map(m => `
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 8px; border-bottom: 1px solid var(--border-subtle);">
                  <input type="checkbox" class="cleanup-checkbox" value="${m.id}">
                  <div>
                    <div style="font-weight: 600;">${m.nombre} ${m.apellido}</div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                      ${m.latestPayment ? 'Último vencimiento: ' + formatDate(m.latestPayment.fechaVencimiento) : 'Inscrito el: ' + formatDate(m.fechaInscripcion)}
                    </div>
                  </div>
                </label>
              `).join('')}
            </div>
          `,
          submitText: 'Borrar Seleccionados',
          submitClass: 'btn-danger',
          onMount: (body) => {
            const selectAll = body.querySelector('#selectAllCleanup');
            const checkboxes = body.querySelectorAll('.cleanup-checkbox');
            
            selectAll.addEventListener('change', (e) => {
              checkboxes.forEach(cb => cb.checked = e.target.checked);
            });

            checkboxes.forEach(cb => {
              cb.addEventListener('change', () => {
                const allChecked = Array.from(checkboxes).every(c => c.checked);
                const someChecked = Array.from(checkboxes).some(c => c.checked);
                selectAll.checked = allChecked;
                selectAll.indeterminate = someChecked && !allChecked;
              });
            });
          },
          onSubmit: async (body) => {
            const checkedIds = Array.from(body.querySelectorAll('.cleanup-checkbox:checked')).map(cb => parseInt(cb.value, 10));
            
            if (checkedIds.length === 0) {
              showToast('No seleccionaste a nadie para borrar', 'error');
              return false;
            }

            if (await confirmDialog('⚠️ ADVERTENCIA FINAL', `¿Seguro que quieres borrar a ${checkedIds.length} cliente(s) de forma permanente?`)) {
              // Delete sequentially or parallel? sequential is safer for DB if too many
              let deleted = 0;
              for (const id of checkedIds) {
                try {
                  await deleteMember(id);
                  deleted++;
                } catch (e) {
                  console.error('Error deleting member', id, e);
                }
              }
              showToast(`Se borraron ${deleted} clientes exitosamente`, 'success');
              return true; // close modal
            }
            return false; // don't close modal if cancelled
          }
        });
      } catch (e) {
        showToast('Error cargando lista', 'error');
      } finally {
        btnCleanup.disabled = false;
        btnCleanup.textContent = 'Ver Clientes Inactivos (> 30 días)';
      }
    });
  }


  // Pago Movil Gym — auto-fill bank code on select
  const bancoSelect = document.getElementById('pagomovil-banco');
  const codigoInput = document.getElementById('pagomovil-codigo');
  if (bancoSelect && codigoInput) {
    bancoSelect.addEventListener('change', () => {
      const selected = bancoSelect.options[bancoSelect.selectedIndex];
      codigoInput.value = selected.dataset.code || '';
    });
  }

  // Pago Movil Gym — save
  document.getElementById('form-pagomovil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const pagoMovilData = {
      cedula: formData.get('cedula') || '',
      banco: formData.get('banco') || '',
      codigoBanco: formData.get('codigoBanco') || '',
      telefono: formData.get('telefono') || ''
    };
    try {
      await db.put('settings', { key: 'pagoMovilGym', value: pagoMovilData });
      showToast('Datos de pago móvil guardados', 'success');
    } catch (err) {
      showToast('Error al guardar', 'error');
    }
  });

}
