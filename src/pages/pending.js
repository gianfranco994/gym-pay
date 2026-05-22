import { getPendingPayments, approvePayment, rejectPayment } from '../db/payments.js';
import { formatAmount } from '../utils/currency.js';
import { formatDate } from '../utils/dates.js';
import { showToast } from '../components/toast.js';
import { confirmDialog } from '../components/modal.js';

export async function render(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Pagos Pendientes</h1>
        <p class="page-subtitle">Aprueba o rechaza transferencias reportadas por clientes</p>
      </div>
    </div>
    <div id="pending-container">
      <div class="empty-state">
        <div class="skeleton skeleton-title"></div>
      </div>
    </div>
  `;

  const pendingContainer = document.getElementById('pending-container');

  async function loadPending() {
    try {
      const payments = await getPendingPayments();
      
      if (payments.length === 0) {
        pendingContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <h3 class="empty-state-title">Todo al día</h3>
            <p class="empty-state-text">No hay pagos pendientes por aprobar.</p>
          </div>
        `;
        return;
      }

      pendingContainer.innerHTML = `
        <div class="card">
          <div class="card-body no-padding table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha Reporte</th>
                  <th>Cliente</th>
                  <th>Cédula</th>
                  <th>Monto</th>
                  <th>Referencia</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => `
                  <tr>
                    <td>${formatDate(p.createdAt)}</td>
                    <td>
                      <a href="#/member-detail/${p.memberId}" style="color: var(--accent-primary); text-decoration: none; font-weight: 500;">
                        ${p.members ? `${p.members.nombre} ${p.members.apellido}` : 'Desconocido'}
                      </a>
                    </td>
                    <td>${p.members?.cedula || 'N/A'}</td>
                    <td><strong class="text-green">${p.montoBs} Bs</strong></td>
                    <td>
                      <span class="badge active">${p.banco}</span><br>
                      <span style="font-size: 12px; color: var(--text-muted);">Ref: *${p.referencia}</span>
                    </td>
                    <td>
                      <div style="display: flex; gap: var(--space-xs);">
                        <button class="btn btn-primary btn-sm action-approve" data-id="${p.id}">✓ Aprobar</button>
                        <button class="btn btn-danger btn-sm action-reject" data-id="${p.id}">✕ Rechazar</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Event Listeners for actions
      document.querySelectorAll('.action-approve').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          if (await confirmDialog('Aprobar Pago', '¿Confirmas que recibiste esta transferencia? Se actualizará el estado del cliente.')) {
            try {
              await approvePayment(id);
              showToast('Pago aprobado', 'success');
              loadPending();
            } catch (err) {
              showToast('Error al aprobar', 'error');
            }
          }
        });
      });

      document.querySelectorAll('.action-reject').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.dataset.id;
          if (await confirmDialog('Rechazar Pago', '¿Estás seguro de rechazar este pago? El reporte será descartado.')) {
            try {
              await rejectPayment(id);
              showToast('Pago rechazado', 'info');
              loadPending();
            } catch (err) {
              showToast('Error al rechazar', 'error');
            }
          }
        });
      });

    } catch (error) {
      console.error(error);
      pendingContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">Error</h3>
          <p class="empty-state-text">No se pudieron cargar los pagos pendientes.</p>
        </div>
      `;
    }
  }

  await loadPending();
}
