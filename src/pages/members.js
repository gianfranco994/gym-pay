import { addMember, getAllMembers } from '../db/members.js';
import { addPayment, getLatestPayment } from '../db/payments.js';
import { getDB, isValidVenezuelanPhone } from '../db/database.js';
import { fetchExchangeRate } from '../services/exchange-rate.js';
import { bsToUsd } from '../utils/currency.js';
import { formatDate, daysRemainingText, getStatusBadge, todayISO, calculateExpiration } from '../utils/dates.js';
import { toTitleCase } from '../utils/text.js';
import { showToast } from '../components/toast.js';
import { showModal } from '../components/modal.js';
import { navigate } from '../router.js';

let currentFilter = 'todos';
let searchQuery = '';
let allMembersWithStatus = [];

export async function render(container) {
  // Initial Data Load
  const members = await getAllMembers();
  allMembersWithStatus = await Promise.all(members.map(async (member) => {
    const latestPayment = await getLatestPayment(member.id);
    const expirationDate = latestPayment ? latestPayment.fechaVencimiento : null;
    const badgeInfo = getStatusBadge(expirationDate, member.estado);
    return { ...member, latestPayment, expirationDate, badgeInfo };
  }));

  const counts = {
    todos: allMembersWithStatus.length,
    activos: allMembersWithStatus.filter(m => m.estado !== 'inactivo' && m.badgeInfo.class === 'active').length,
    porVencer: allMembersWithStatus.filter(m => m.estado !== 'inactivo' && m.badgeInfo.class === 'warning').length,
    vencidos: allMembersWithStatus.filter(m => m.estado !== 'inactivo' && m.badgeInfo.class === 'danger').length,
    inactivos: allMembersWithStatus.filter(m => m.estado === 'inactivo').length
  };

  // Build Shell
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Miembros</h1>
        <p class="page-subtitle">Total: ${counts.todos} registrados</p>
      </div>
      <div style="display: flex; gap: var(--space-md); align-items: center;">
        <div class="search-wrapper">
          <span class="search-icon">🔍</span>
          <input type="text" id="member-search" class="search-input" placeholder="Buscar por nombre o cédula..." value="${searchQuery}">
        </div>
        <button id="btn-new-member" class="btn btn-primary">➕ Nuevo Miembro</button>
      </div>
    </div>

    <div class="tabs" id="filter-tabs">
      <button class="tab ${currentFilter === 'todos' ? 'active' : ''}" data-filter="todos">
        Todos <span class="tab-count">(${counts.todos})</span>
      </button>
      <button class="tab ${currentFilter === 'activos' ? 'active' : ''}" data-filter="activos">
        Activos <span class="tab-count">(${counts.activos})</span>
      </button>
      <button class="tab ${currentFilter === 'por-vencer' ? 'active' : ''}" data-filter="por-vencer">
        Por vencer <span class="tab-count">(${counts.porVencer})</span>
      </button>
      <button class="tab ${currentFilter === 'vencidos' ? 'active' : ''}" data-filter="vencidos">
        Vencidos <span class="tab-count">(${counts.vencidos})</span>
      </button>
      <button class="tab ${currentFilter === 'inactivos' ? 'active' : ''}" data-filter="inactivos">
        Inactivos <span class="tab-count">(${counts.inactivos})</span>
      </button>
    </div>

    <div class="card">
      <div class="card-body no-padding table-wrapper" id="members-table-container">
        <!-- Table will be rendered here -->
      </div>
    </div>
  `;

  // Setup Shell Listeners
  const searchInput = container.querySelector('#member-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      updateTableView(container);
    });
  }

  container.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      currentFilter = e.currentTarget.dataset.filter;
      container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      updateTableView(container);
    });
  });

  const newMemberBtn = container.querySelector('#btn-new-member');
  if (newMemberBtn) {
    newMemberBtn.addEventListener('click', async () => {
      let precioMensual = 0;
      let currentRate = 0;
      try {
        const db = await getDB();
        const precioSetting = await db.get('settings', 'precioMensual');
        if (precioSetting && precioSetting.value) precioMensual = precioSetting.value;
        const rateData = await fetchExchangeRate();
        if (rateData && rateData.rate) currentRate = rateData.rate;
      } catch(e) {}

      const banks = ['Banesco', 'Mercantil', 'Provincial', 'Venezuela', 'BNC', 'Bicentenario', 'Tesoro', 'Exterior', 'BOD', 'Bancamiga', 'Sofitasa', 'Plaza', 'Caroní', 'Del Sur', 'Fondo Común', 'Otro'];

      showModal({
        title: 'Nuevo Miembro',
        content: `
          <form id="new-member-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Nombre *</label>
                <input type="text" name="nombre" class="form-input" required>
              </div>
              <div class="form-group">
                <label class="form-label">Apellido *</label>
                <input type="text" name="apellido" class="form-input" required>
              </div>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Cédula</label>
                <input type="text" name="cedula" class="form-input">
                <div class="form-hint">Dejar vacío si no aplica</div>
              </div>
              <div class="form-group">
                <label class="form-label">Edad *</label>
                <input type="number" name="edad" class="form-input" required min="10" max="100">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Teléfono *</label>
                <input type="text" name="telefono" class="form-input" required placeholder="Ej: 0412-1234567">
              </div>
              <div class="form-group">
                <label class="form-label">Correo Electrónico</label>
                <input type="email" name="correo" class="form-input">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Fecha de Inscripción *</label>
              <input type="date" name="fechaInscripcion" class="form-input" required value="${todayISO()}">
            </div>

            <hr style="margin: var(--space-md) 0; border: 0; border-top: 1px solid var(--border-subtle);">
            
            <label class="form-radio-option" style="margin-bottom: var(--space-md);">
              <input type="checkbox" id="check-initial-payment" checked>
              <strong>Registrar primer pago ahora (30 días)</strong>
            </label>

            <div id="initial-payment-section">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Monto (Bs) *</label>
                  <input type="number" name="montoBs" class="form-input" min="1" step="0.01" value="${precioMensual || ''}">
                </div>
                <div class="form-group">
                  <label class="form-label">Método de Pago *</label>
                  <select name="metodoPago" id="metodo-select" class="form-select">
                    <option value="pagoMovil">📱 Pago Móvil / Transferencia</option>
                    <option value="efectivo">💵 Efectivo</option>
                  </select>
                </div>
              </div>

              <div id="datos-banco-modal" class="form-row">
                <div class="form-group">
                  <label class="form-label">Banco</label>
                  <select name="banco" class="form-select">
                    <option value="" disabled selected>Seleccione banco</option>
                    ${banks.map(b => `<option value="${b}">${b}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Referencia (últimos 4 dígitos)</label>
                  <input type="text" name="referencia" class="form-input" maxlength="4" pattern="\\d{4,}">
                </div>
              </div>
            </div>
          </form>
        `,
        submitText: 'Guardar Miembro',
        onMount: (modalBody) => {
          const check = modalBody.querySelector('#check-initial-payment');
          const section = modalBody.querySelector('#initial-payment-section');
          const method = modalBody.querySelector('#metodo-select');
          const bancoSection = modalBody.querySelector('#datos-banco-modal');
          const bancoInput = modalBody.querySelector('[name="banco"]');
          const refInput = modalBody.querySelector('[name="referencia"]');

          check.addEventListener('change', (e) => {
            section.style.display = e.target.checked ? 'block' : 'none';
          });

          method.addEventListener('change', (e) => {
            if (e.target.value === 'pagoMovil') {
              bancoSection.style.display = 'flex';
              bancoSection.style.gap = 'var(--space-md)';
              bancoInput.required = check.checked;
              refInput.required = check.checked;
            } else {
              bancoSection.style.display = 'none';
              bancoInput.required = false;
              refInput.required = false;
            }
          });
          method.dispatchEvent(new Event('change'));
        },
        onSubmit: async (body) => {
          const form = body.querySelector('#new-member-form');
          const check = body.querySelector('#check-initial-payment');
          
          if (check.checked) {
             form.querySelector('[name="montoBs"]').required = true;
             const method = form.querySelector('#metodo-select').value;
             if (method === 'pagoMovil') {
               form.querySelector('[name="banco"]').required = true;
               form.querySelector('[name="referencia"]').required = true;
             }
          } else {
             form.querySelector('[name="montoBs"]').required = false;
             form.querySelector('[name="banco"]').required = false;
             form.querySelector('[name="referencia"]').required = false;
          }

          if (!form.reportValidity()) return false;

          const formData = new FormData(form);
          const fechaInsc = formData.get('fechaInscripcion') || todayISO();

          const telefono = formData.get('telefono').trim();
          if (telefono && !isValidVenezuelanPhone(telefono)) {
            showToast('El teléfono debe tener formato venezolano: 04XX-XXXXXXX', 'error');
            return false;
          }

          const data = {
            nombre: toTitleCase(formData.get('nombre').trim()),
            apellido: toTitleCase(formData.get('apellido').trim()),
            cedula: formData.get('cedula') ? formData.get('cedula').trim() : null,
            edad: parseInt(formData.get('edad'), 10),
            telefono,
            correo: formData.get('correo') ? formData.get('correo').trim().toLowerCase() : null,
            fechaInscripcion: fechaInsc
          };

          try {
            const memberId = await addMember(data);
            
            if (check.checked) {
              const montoBsVal = parseFloat(formData.get('montoBs'));
              const paymentData = {
                memberId: memberId,
                montoBs: montoBsVal,
                tasaUsd: currentRate,
                montoUsd: bsToUsd(montoBsVal, currentRate),
                fechaPago: fechaInsc,
                fechaVencimiento: calculateExpiration(fechaInsc, 30),
                diasPlan: 30,
                metodoPago: formData.get('metodoPago'),
                banco: formData.get('banco') || null,
                referencia: formData.get('referencia') || null,
                concepto: 'inscripcion',
                notas: 'Pago inicial generado automáticamente.'
              };
              await addPayment(paymentData);
              showToast('Miembro y pago registrados', 'success');
            } else {
              showToast('Miembro agregado exitosamente', 'success');
            }
            
            render(container);
            return true;
          } catch (error) {
            console.error('Error:', error);
            showToast(error.message || 'Error al procesar', 'error');
            return false;
          }
        }
      });
    });
  }

  // Initial Table Render
  updateTableView(container);
}

function updateTableView(container) {
  let filtered = allMembersWithStatus;
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(m => 
      m.nombre.toLowerCase().includes(q) || 
      m.apellido.toLowerCase().includes(q) || 
      (m.cedula && m.cedula.toLowerCase().includes(q))
    );
  }

  if (currentFilter !== 'todos') {
    filtered = filtered.filter(m => {
      if (currentFilter === 'inactivos') return m.estado === 'inactivo';
      if (m.estado === 'inactivo') return false;
      if (currentFilter === 'activos') return m.badgeInfo.class === 'active';
      if (currentFilter === 'por-vencer') return m.badgeInfo.class === 'warning';
      if (currentFilter === 'vencidos') return m.badgeInfo.class === 'danger';
      return true;
    });
  }

  const tableContainer = container.querySelector('#members-table-container');
  if (!tableContainer) return;

  tableContainer.innerHTML = filtered.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Cédula</th>
          <th>Teléfono</th>
          <th>Estado</th>
          <th>Vencimiento</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(m => `
          <tr data-id="${m.id}" class="member-row">
            <td style="font-weight: 600;">${m.nombre} ${m.apellido}</td>
            <td class="text-muted">${m.cedula || '—'}</td>
            <td>${m.telefono}</td>
            <td>
              <span class="badge ${m.badgeInfo.class}">
                <span class="badge-dot"></span>
                ${m.badgeInfo.text}
              </span>
            </td>
            <td>
              ${m.expirationDate ? `
                <div>${formatDate(m.expirationDate)}</div>
                <div style="font-size: 11px; color: var(--text-muted);">${daysRemainingText(m.expirationDate)}</div>
              ` : '<span class="text-muted">Sin pagos</span>'}
            </td>
            <td>
              <div style="display: flex; gap: var(--space-xs);">
                <button class="btn btn-ghost btn-icon sm action-view" title="Ver Detalle" data-id="${m.id}">👁️</button>
                <button class="btn btn-ghost btn-icon sm action-pay" title="Registrar Pago" data-id="${m.id}">💳</button>
                <button class="btn btn-ghost btn-icon sm action-whatsapp" title="WhatsApp" data-id="${m.id}" data-phone="${m.telefono}" data-name="${m.nombre} ${m.apellido}" data-venc="${m.expirationDate || ''}">📱</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : `
    <div class="empty-state">
      <div class="empty-state-icon">👥</div>
      <h3 class="empty-state-title">No se encontraron miembros</h3>
      <p class="empty-state-text">Intenta cambiar los filtros o realiza una nueva búsqueda.</p>
    </div>
  `;

  // Attach table event listeners
  tableContainer.querySelectorAll('.member-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      navigate(`member-detail/${row.dataset.id}`);
    });
  });

  tableContainer.querySelectorAll('.action-view').forEach(btn => {
    btn.addEventListener('click', (e) => {
      navigate(`member-detail/${e.currentTarget.dataset.id}`);
    });
  });

  tableContainer.querySelectorAll('.action-pay').forEach(btn => {
    btn.addEventListener('click', (e) => {
      navigate(`new-payment?member=${e.currentTarget.dataset.id}`);
    });
  });

  tableContainer.querySelectorAll('.action-whatsapp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const { phone, name, venc } = e.currentTarget.dataset;
      if (!phone) {
        showToast('El miembro no tiene número de teléfono', 'error');
        return;
      }
      openWhatsApp({ telefono: phone, nombre: name, fechaVencimiento: venc });
    });
  });
}
