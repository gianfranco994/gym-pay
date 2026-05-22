import { addMember, getAllMembers } from '../db/members.js';
import { getLatestPayment } from '../db/payments.js';
import { formatDate, daysRemainingText, getStatusBadge, todayISO } from '../utils/dates.js';
import { openWhatsApp } from '../services/whatsapp.js';
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
    newMemberBtn.addEventListener('click', () => {
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
          </form>
        `,
        submitText: 'Guardar Miembro',
        onSubmit: async (body) => {
          const form = body.querySelector('#new-member-form');
          if (!form.reportValidity()) return false;

          const formData = new FormData(form);
          const data = {
            nombre: formData.get('nombre'),
            apellido: formData.get('apellido'),
            cedula: formData.get('cedula') || null,
            edad: parseInt(formData.get('edad'), 10),
            telefono: formData.get('telefono'),
            correo: formData.get('correo') || null,
            fechaInscripcion: formData.get('fechaInscripcion') || todayISO()
          };

          try {
            await addMember(data);
            showToast('Miembro agregado exitosamente', 'success');
            render(container); // Reload full view to fetch new member
            return true;
          } catch (error) {
            console.error('Error al agregar miembro:', error);
            showToast(error.message || 'Error al agregar miembro', 'error');
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
