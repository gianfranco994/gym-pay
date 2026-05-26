import { getMember, updateMember, toggleMemberStatus, deleteMember } from '../db/members.js';
import { getPaymentsByMember, getLatestPayment } from '../db/payments.js';
import { formatDate, daysRemainingText, daysRemaining, getMembershipStatus, toInputDate, calculateAge, todayISO } from '../utils/dates.js';
import { formatAmount } from '../utils/currency.js';
import { toTitleCase } from '../utils/text.js';
import { isValidVenezuelanPhone } from '../db/database.js';
import { openWhatsApp } from '../services/whatsapp.js';
import { showToast } from '../components/toast.js';
import { showModal, confirmDialog } from '../components/modal.js';
import { navigate } from '../router.js';

export async function render(container, memberIdStr) {
  const memberId = parseInt(memberIdStr, 10);
  if (isNaN(memberId)) {
    container.innerHTML = '<div class="empty-state">ID de miembro inválido</div>';
    return;
  }

  const member = await getMember(memberId);
  if (!member) {
    container.innerHTML = '<div class="empty-state">Miembro no encontrado</div>';
    return;
  }

  const payments = await getPaymentsByMember(memberId);
  const latestPayment = await getLatestPayment(memberId);
  
  const expirationDate = latestPayment ? latestPayment.fechaVencimiento : null;
  const status = expirationDate ? getMembershipStatus(expirationDate) : 'expired';
  
  // Calculate countdown value color
  let countdownColorClass = 'text-muted';
  let countdownValue = '—';
  
  if (expirationDate) {
    const days = daysRemaining(expirationDate);
    countdownValue = Math.abs(days);
    if (days > 3) countdownColorClass = 'text-green';
    else if (days > 0) countdownColorClass = 'text-yellow';
    else countdownColorClass = 'text-red';
  }

  const initials = (member.nombre.charAt(0) + member.apellido.charAt(0)).toUpperCase();

  container.innerHTML = `
    <div class="mb-lg">
      <a href="#/members" class="btn btn-ghost" style="padding-left: 0;">← Volver a Miembros</a>
    </div>

    <div class="member-hero">
      <div class="member-avatar">${initials}</div>
      <div class="member-info">
        <h1 class="member-name">${member.nombre} ${member.apellido}</h1>
        <div class="member-meta">
          <div class="member-meta-item" title="Cédula">
            <span>🪪</span> ${member.cedula || 'Sin cédula'}
          </div>
          <div class="member-meta-item" title="Teléfono">
            <span>📞</span> <a href="tel:${member.telefono}">${member.telefono}</a>
          </div>
          <div class="member-meta-item" title="Fecha de Nacimiento / Edad">
            <span>🎂</span> ${member.fechaNacimiento ? `${formatDate(member.fechaNacimiento)} (${calculateAge(member.fechaNacimiento)} años)` : `${member.edad} años`}
          </div>
          ${member.correo ? `
          <div class="member-meta-item" title="Correo">
            <span>✉️</span> <a href="mailto:${member.correo}">${member.correo}</a>
          </div>
          ` : ''}
          <div class="member-meta-item" title="Inscripción">
            <span>📅</span> Inscrito el ${formatDate(member.fechaInscripcion)}
          </div>
          <div class="member-meta-item" title="Estado">
            <span class="badge ${member.estado === 'activo' ? 'active' : 'inactive'}">
              <span class="badge-dot"></span>
              ${member.estado === 'activo' ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>
      <div class="member-actions">
        <button id="btn-pay" class="btn btn-primary">💳 Registrar Pago</button>
        <button id="btn-wa" class="btn btn-whatsapp">📱 WhatsApp</button>
        <button id="btn-edit" class="btn btn-secondary">✏️ Editar</button>
        <button id="btn-toggle-status" class="btn ${member.estado === 'activo' ? 'btn-danger' : 'btn-secondary'}">
          ${member.estado === 'activo' ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>

    <div class="member-countdown">
      ${expirationDate ? `
        <div class="countdown-value ${countdownColorClass}">${countdownValue}</div>
        <div class="countdown-label">${daysRemainingText(expirationDate)} — ${formatDate(expirationDate)}</div>
      ` : `
        <div class="empty-state" style="padding: 0;">
          <div class="empty-state-text" style="margin: 0;">Sin pagos registrados</div>
        </div>
      `}
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Historial de Pagos</h3>
      </div>
      <div class="card-body no-padding">
        ${payments.length > 0 ? `
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Fecha Pago</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th class="hide-mobile">Banco / Ref</th>
                  <th class="hide-mobile">Vencimiento</th>
                  <th class="hide-mobile">Días</th>
                  <th>Recibo</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => `
                  <tr>
                    <td>${formatDate(p.fechaPago)}</td>
                    <td><strong style="color: var(--status-active);">${formatAmount(p.montoBs, p.montoUsd)}</strong></td>
                    <td>
                      <span class="badge ${p.metodoPago === 'pagoMovil' ? 'active' : 'warning'}" style="font-size: 11px; padding: 2px 6px;">
                        ${p.metodoPago === 'pagoMovil' ? '📱 Pago Móvil' : '💵 Efectivo'}
                      </span>
                      <div class="hide-desktop" style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                        ${p.metodoPago === 'pagoMovil' ? `${p.banco} - *${p.referencia}` : ''}
                      </div>
                    </td>
                    <td class="hide-mobile">${p.metodoPago === 'pagoMovil' ? `${p.banco} - *${p.referencia}` : '—'}</td>
                    <td class="hide-mobile">${formatDate(p.fechaVencimiento)}</td>
                    <td class="hide-mobile">${p.diasPlan}</td>
                    <td>
                      <div style="display: flex; gap: var(--space-xs);">
                        <button class="btn btn-ghost btn-icon sm action-receipt" title="Ver Recibo" data-id="${p.id}">📄</button>
                        <button class="btn btn-ghost btn-icon sm action-share-receipt" title="Enviar Recibo por WhatsApp" data-id="${p.id}" data-phone="${member.telefono}">📲</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="empty-state" style="padding: var(--space-xl);">
            <div class="empty-state-icon">💸</div>
            <h3 class="empty-state-title">No hay pagos registrados</h3>
            <p class="empty-state-text">Este miembro aún no ha realizado ningún pago.</p>
          </div>
        `}
      </div>
    </div>
  `;

  // Actions
  document.getElementById('btn-pay').addEventListener('click', () => {
    navigate(`new-payment?member=${member.id}`);
  });

  document.getElementById('btn-wa').addEventListener('click', () => {
    if (!member.telefono) {
      showToast('El miembro no tiene número de teléfono', 'error');
      return;
    }
    openWhatsApp({ 
      telefono: member.telefono, 
      nombre: `${member.nombre} ${member.apellido}`, 
      fechaVencimiento: expirationDate 
    });
  });

  // Receipt Actions
  document.querySelectorAll('.action-receipt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pId = e.currentTarget.dataset.id;
      window.open(`#/receipt/${pId}`, '_blank');
    });
  });

  document.querySelectorAll('.action-share-receipt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const pId = e.currentTarget.dataset.id;
      const phone = e.currentTarget.dataset.phone;
      if (!phone) {
        showToast('El miembro no tiene número de teléfono', 'error');
        return;
      }
      const receiptUrl = `${window.location.origin}${window.location.pathname}#/receipt/${pId}`;
      const msg = encodeURIComponent(`¡Hola! Tu pago ha sido procesado exitosamente. Puedes ver y descargar tu recibo digital aquí: ${receiptUrl}`);
      window.open(`https://wa.me/${phone.replace(/\\D/g,'')}?text=${msg}`, '_blank');
    });
  });

  document.getElementById('btn-toggle-status').addEventListener('click', async () => {
    const isActivating = member.estado === 'inactivo';
    const msg = isActivating 
      ? '¿Estás seguro de reactivar a este miembro?' 
      : '¿Estás seguro de desactivar a este miembro? No aparecerá en los reportes activos.';
    
    if (await confirmDialog(isActivating ? 'Activar Miembro' : 'Desactivar Miembro', msg)) {
      try {
        await toggleMemberStatus(member.id);
        showToast(`Miembro ${isActivating ? 'activado' : 'desactivado'} exitosamente`, 'success');
        render(container, memberIdStr);
      } catch (error) {
        showToast('Error al cambiar el estado', 'error');
      }
    }
  });

  document.getElementById('btn-edit').addEventListener('click', () => {
    showModal({
      title: 'Editar Miembro',
      content: `
        <form id="edit-member-form">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Nombre *</label>
              <input type="text" name="nombre" class="form-input" required value="${member.nombre}">
            </div>
            <div class="form-group">
              <label class="form-label">Apellido *</label>
              <input type="text" name="apellido" class="form-input" required value="${member.apellido}">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Cédula</label>
              <input type="text" name="cedula" class="form-input" value="${member.cedula || ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Fecha de Nacimiento *</label>
              <input type="date" name="fechaNacimiento" class="form-input" required max="${todayISO()}" value="${toInputDate(member.fechaNacimiento || '')}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Teléfono *</label>
              <input type="text" name="telefono" class="form-input" required value="${member.telefono}">
            </div>
            <div class="form-group">
              <label class="form-label">Correo Electrónico</label>
              <input type="email" name="correo" class="form-input" value="${member.correo || ''}">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Fecha de Inscripción *</label>
            <input type="date" name="fechaInscripcion" class="form-input" required value="${toInputDate(member.fechaInscripcion) || todayISO()}">
          </div>
          
          <div class="form-group" style="margin-top: var(--space-xl); padding-top: var(--space-lg); border-top: 1px solid var(--border-subtle);">
            <button type="button" id="btn-delete-member" class="btn btn-danger w-full" style="background: transparent; border: 1px solid var(--status-danger);">🗑️ Borrar Cliente y Todos sus Pagos</button>
          </div>
        </form>
      `,
      submitText: 'Guardar Cambios',
      onMount: (body) => {
        const btnDelete = body.querySelector('#btn-delete-member');
        if (btnDelete) {
          btnDelete.addEventListener('click', async () => {
            if (await confirmDialog(
              '⚠️ ADVERTENCIA: Borrado Permanente',
              '¿Estás ABSOLUTAMENTE SEGURO de querer borrar a este cliente? Se eliminarán también TODOS los recibos de pagos asociados. Esta acción NO se puede deshacer.',
              { confirmText: 'Sí, Borrar Permanentemente', confirmClass: 'btn-danger' }
            )) {
              try {
                await deleteMember(member.id);
                document.querySelector('.modal-close')?.click(); // Close the edit modal
                showToast('Cliente borrado permanentemente', 'success');
                navigate('#/members');
              } catch (e) {
                showToast('Error al borrar el cliente', 'error');
              }
            }
          });
        }
      },
      onSubmit: async (body) => {
        const form = body.querySelector('#edit-member-form');
        if (!form.reportValidity()) return false;

        const formData = new FormData(form);
        const telefono = formData.get('telefono').trim();
        if (telefono && !isValidVenezuelanPhone(telefono)) {
          showToast('El teléfono debe tener formato venezolano: 04XX-XXXXXXX', 'error');
          return false;
        }

        const data = {
          nombre: toTitleCase(formData.get('nombre').trim()),
          apellido: toTitleCase(formData.get('apellido').trim()),
          cedula: formData.get('cedula') ? formData.get('cedula').trim().replace(/\D/g, '') : null,
          fechaNacimiento: formData.get('fechaNacimiento'),
          telefono,
          correo: formData.get('correo') ? formData.get('correo').trim().toLowerCase() : null,
          fechaInscripcion: formData.get('fechaInscripcion')
        };

        try {
          await updateMember(member.id, data);
          showToast('Cambios guardados exitosamente', 'success');
          render(container, memberIdStr);
          return true;
        } catch (error) {
          console.error('Error al editar miembro:', error);
          showToast(error.message || 'Error al editar miembro', 'error');
          return false;
        }
      }
    });
  });
}
