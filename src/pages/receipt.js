import { getPayment } from '../db/payments.js';
import { getDB } from '../db/database.js';
import { formatAmount } from '../utils/currency.js';
import { formatDate } from '../utils/dates.js';

export async function render(container, paymentId) {
  if (!paymentId) {
    container.innerHTML = '<div class="empty-state"><h3>Recibo no encontrado</h3></div>';
    return;
  }

  try {
    const id = parseInt(paymentId, 10);
    const payment = await getPayment(id);
    const db = await getDB();
    const gymNameSetting = await db.get('settings', 'nombreGym');
    const gymName = gymNameSetting?.value || 'GymPay';

    if (!payment) {
      container.innerHTML = '<div class="empty-state"><h3>El pago no existe</h3></div>';
      return;
    }

    const m = payment.members;
    const refText = payment.metodoPago === 'pagoMovil' ? `Pago Móvil / Transf. - ${payment.banco || ''} ${payment.referencia || ''}` : 'Efectivo';
    
    // Minimalist receipt styling suitable for both mobile viewing and printing
    container.innerHTML = `
      <style>
        /* Hide navbar/sidebar in print */
        @media print {
          .sidebar, .topbar { display: none !important; }
          .page-container { margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          body { background: white; color: black; }
          .receipt-card { box-shadow: none !important; border: 1px solid #ddd; }
        }
      </style>
      
      <div style="max-width: 400px; margin: 40px auto;">
        
        <div class="no-print" style="margin-bottom: var(--space-md); display: flex; gap: var(--space-sm); justify-content: center;">
          <button id="btn-print" class="btn btn-primary">🖨️ Imprimir / Guardar PDF</button>
          <a href="#/dashboard" class="btn btn-secondary">Volver al Inicio</a>
        </div>

        <div class="card receipt-card" style="padding: 30px; background: var(--bg-elevated); text-align: center;">
          
          <h2 style="margin: 0 0 5px 0; font-size: 24px; color: var(--text-primary);">${gymName}</h2>
          <p style="color: var(--text-muted); margin: 0 0 20px 0; font-size: 14px;">Comprobante de Pago</p>
          
          <div style="border-top: 2px dashed var(--border-subtle); border-bottom: 2px dashed var(--border-subtle); padding: 20px 0; margin-bottom: 20px;">
            <div style="font-size: 32px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px;">
              ${formatAmount(payment.montoBs, payment.montoUsd)}
            </div>
            <div style="font-size: 14px; color: var(--text-secondary);">
              N° Recibo: <strong>#${payment.id.toString().padStart(6, '0')}</strong><br>
              Fecha: ${formatDate(payment.fechaPago)}
            </div>
          </div>
          
          <div style="text-align: left; font-size: 14px; line-height: 1.6; color: var(--text-secondary);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Cliente:</span>
              <strong style="color: var(--text-primary);">${m?.nombre} ${m?.apellido}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Cédula:</span>
              <strong style="color: var(--text-primary);">${m?.cedula || 'N/A'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Concepto:</span>
              <strong style="color: var(--text-primary); text-transform: capitalize;">${payment.concepto}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Método:</span>
              <strong style="color: var(--text-primary); text-align: right;">${refText}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-subtle);">
              <span>Próximo Vencimiento:</span>
              <strong style="color: var(--accent-primary);">${formatDate(payment.fechaVencimiento)}</strong>
            </div>
          </div>

          <div style="margin-top: 30px; font-size: 12px; color: var(--text-muted);">
            ¡Gracias por preferirnos!<br>
            Este recibo fue generado electrónicamente.
          </div>
        </div>
      </div>
    `;

    const printBtn = document.getElementById('btn-print');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        window.print();
      });
    }

  } catch (error) {
    console.error('Error loading receipt:', error);
    container.innerHTML = '<div class="empty-state"><h3>Error al cargar el recibo</h3></div>';
  }
}
