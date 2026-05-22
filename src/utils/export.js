/**
 * Export/Import utilities for GymPay data backup
 */

import { getDB } from '../db/database.js';

/**
 * Export all data from IndexedDB as a JSON object
 * @returns {Promise<Object>} All data { members, payments, settings, exportDate }
 */
export async function exportAllData() {
  try {
    const db = await getDB();

    const tx = db.transaction(['members', 'payments', 'settings'], 'readonly');
    const [members, payments, settings] = await Promise.all([
      tx.objectStore('members').getAll(),
      tx.objectStore('payments').getAll(),
      tx.objectStore('settings').getAll(),
    ]);

    return {
      version: 1,
      exportDate: new Date().toISOString(),
      app: 'GymPay',
      data: { members, payments, settings },
    };
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
}

/**
 * Download data as a JSON file
 */
export async function downloadBackup() {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0];
  a.download = `gympay-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import data from a JSON backup file
 * @param {File} file - JSON file to import
 * @returns {Promise<{ members: number, payments: number }>} Counts of imported records
 */
export async function importData(file) {
  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.data || !backup.app || backup.app !== 'GymPay') {
      throw new Error('Archivo no válido. Debe ser un respaldo de GymPay.');
    }

    const db = await getDB();
    const { members, payments, settings } = backup.data;

    // Clear existing data
    const clearTx = db.transaction(['members', 'payments', 'settings'], 'readwrite');
    await Promise.all([
      clearTx.objectStore('members').clear(),
      clearTx.objectStore('payments').clear(),
      clearTx.objectStore('settings').clear(),
    ]);
    await clearTx.done;

    // Import members
    if (members && members.length > 0) {
      const memberTx = db.transaction('members', 'readwrite');
      for (const member of members) {
        await memberTx.store.add(member);
      }
      await memberTx.done;
    }

    // Import payments
    if (payments && payments.length > 0) {
      const paymentTx = db.transaction('payments', 'readwrite');
      for (const payment of payments) {
        await paymentTx.store.add(payment);
      }
      await paymentTx.done;
    }

    // Import settings
    if (settings && settings.length > 0) {
      const settingsTx = db.transaction('settings', 'readwrite');
      for (const setting of settings) {
        await settingsTx.store.put(setting);
      }
      await settingsTx.done;
    }

    return {
      members: members ? members.length : 0,
      payments: payments ? payments.length : 0,
    };
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
}

/**
 * Clear all data from the database
 * @returns {Promise<void>}
 */
export async function clearAllData() {
  try {
    const db = await getDB();
    const tx = db.transaction(['members', 'payments'], 'readwrite');
    await Promise.all([
      tx.objectStore('members').clear(),
      tx.objectStore('payments').clear(),
    ]);
    await tx.done;
  } catch (error) {
    console.error('Error clearing data:', error);
    throw error;
  }
}

/**
 * Export payments to CSV format and trigger download
 * @param {Array} payments - Array of payment objects joined with member data
 */
export function exportPaymentsToCSV(payments) {
  if (!payments || payments.length === 0) return;

  const headers = ['ID Recibo', 'Miembro', 'Cedula', 'Fecha Pago', 'Monto Bs', 'Monto USD', 'Metodo', 'Referencia/Banco', 'Concepto', 'Vencimiento'];
  
  const rows = payments.map(p => {
    const memberName = p.members ? `${p.members.nombre} ${p.members.apellido}` : 'Desconocido';
    const cedula = p.members?.cedula || '';
    const fechaPago = p.fechaPago ? p.fechaPago.split('T')[0] : '';
    const vencimiento = p.fechaVencimiento ? p.fechaVencimiento.split('T')[0] : '';
    const ref = p.metodoPago === 'pagoMovil' ? `${p.banco || ''} ${p.referencia || ''}` : 'Efectivo';
    
    return [
      p.id,
      `"${memberName}"`,
      cedula,
      fechaPago,
      p.montoBs,
      p.montoUsd,
      p.metodoPago,
      `"${ref.trim()}"`,
      p.concepto,
      vencimiento
    ].join(',');
  });

  const csvContent = headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  const date = new Date().toISOString().split('T')[0];
  a.download = `gympay-reporte-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
