/**
 * WhatsApp service for GymPay
 * Generates WhatsApp Web links with pre-filled messages
 */

import { getDB } from '../db/database.js';
import { formatDate } from '../utils/dates.js';

/**
 * Get the WhatsApp message template from settings
 * @returns {Promise<string>}
 */
async function getMessageTemplate() {
  try {
    const db = await getDB();
    const setting = await db.get('settings', 'mensajeWhatsApp');
    return setting?.value || 'Hola {nombre}! 👋 Te recordamos que tu mensualidad en {gym} vence el {fecha}. ¡Te esperamos para renovar! 💪🏋️';
  } catch {
    return 'Hola {nombre}! 👋 Te recordamos que tu mensualidad en {gym} vence el {fecha}. ¡Te esperamos para renovar! 💪🏋️';
  }
}

/**
 * Get the gym name from settings
 * @returns {Promise<string>}
 */
async function getGymName() {
  try {
    const db = await getDB();
    const setting = await db.get('settings', 'nombreGym');
    return setting?.value || 'Mi Gimnasio';
  } catch {
    return 'Mi Gimnasio';
  }
}

/**
 * Clean a phone number to international format
 * Assumes Venezuelan numbers (+58)
 * @param {string} phone - Phone number
 * @returns {string} Cleaned phone number
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return '';
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // If starts with 0, remove it and add 58
  if (cleaned.startsWith('0')) {
    cleaned = '58' + cleaned.substring(1);
  }

  // If doesn't start with country code, add 58
  if (!cleaned.startsWith('58')) {
    cleaned = '58' + cleaned;
  }

  return cleaned;
}

/**
 * Generate a WhatsApp link with a pre-filled message
 * @param {Object} params
 * @param {string} params.telefono - Client phone number
 * @param {string} params.nombre - Client full name
 * @param {string} params.fechaVencimiento - Expiration date ISO string
 * @returns {Promise<string>} WhatsApp URL
 */
export async function generateWhatsAppLink({ telefono, nombre, fechaVencimiento }) {
  const template = await getMessageTemplate();
  const gymName = await getGymName();

  const message = template
    .replace(/{nombre}/g, nombre)
    .replace(/{gym}/g, gymName)
    .replace(/{fecha}/g, formatDate(fechaVencimiento));

  const phone = cleanPhoneNumber(telefono);
  const encodedMessage = encodeURIComponent(message);

  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`;
}

/**
 * Open WhatsApp with a pre-filled message
 * @param {Object} params - Same as generateWhatsAppLink
 */
export async function openWhatsApp(params) {
  const url = await generateWhatsAppLink(params);
  window.open(url, '_blank');
}
