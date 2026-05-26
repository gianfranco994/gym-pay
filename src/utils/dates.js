/**
 * Date utility helpers for GymPay
 */

/**
 * Format a date string to locale display format
 * @param {string} isoDate - ISO date string
 * @returns {string} Formatted date e.g. "21/05/2026"
 */
export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a date to a short display format
 * @param {string} isoDate - ISO date string
 * @returns {string} e.g. "21 May 2026"
 */
export function formatDateShort(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date to a long display format
 * @param {string} isoDate - ISO date string
 * @returns {string} e.g. "21 de mayo de 2026"
 */
export function formatDateLong(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Get today's date as ISO string (date only, no time)
 * @returns {string} e.g. "2026-05-21"
 */
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current ISO timestamp
 * @returns {string}
 */
export function nowISO() {
  return new Date().toISOString();
}

/**
 * Calculate expiration date from a start date + days
 * @param {string} startDate - ISO date string
 * @param {number} days - Number of days to add
 * @returns {string} ISO date of expiration
 */
export function calculateExpiration(startDate, days) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Calculate days remaining until a date
 * @param {string} isoDate - ISO date string
 * @returns {number} Days remaining (negative if past)
 */
export function daysRemaining(isoDate) {
  if (!isoDate) return -Infinity;
  const target = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get a human-readable string of days remaining
 * @param {string} isoDate - ISO date string
 * @returns {string} e.g. "Vence en 5 días", "Vencido hace 3 días", "Vence hoy"
 */
export function daysRemainingText(isoDate) {
  const days = daysRemaining(isoDate);
  if (days === 0) return 'Vence hoy';
  if (days === 1) return 'Vence mañana';
  if (days > 0) return `Vence en ${days} días`;
  if (days === -1) return 'Venció ayer';
  return `Venció hace ${Math.abs(days)} días`;
}

/**
 * Get the membership status based on expiration date
 * @param {string} isoDate - ISO date string of expiration
 * @returns {'active'|'warning'|'danger'|'expired'} Status
 */
export function getMembershipStatus(isoDate) {
  const days = daysRemaining(isoDate);
  if (days < 0) return 'expired';
  if (days <= 3) return 'warning';
  return 'active';
}

/**
 * Get the badge class for membership status
 * @param {string} isoDate - ISO date string of expiration
 * @param {string} estado - Member estado (activo/inactivo)
 * @returns {{ class: string, text: string }}
 */
export function getStatusBadge(isoDate, estado) {
  if (estado === 'inactivo') {
    return { class: 'inactive', text: 'Inactivo' };
  }
  const status = getMembershipStatus(isoDate);
  switch (status) {
    case 'active':
      return { class: 'active', text: 'Activo' };
    case 'warning':
      return { class: 'warning', text: 'Por vencer' };
    case 'expired':
    case 'danger':
      return { class: 'danger', text: 'Vencido' };
    default:
      return { class: 'inactive', text: 'Sin pago' };
  }
}

/**
 * Get first and last day of a month
 * @param {number} month - Month (0-11)
 * @param {number} year - Full year
 * @returns {{ start: string, end: string }}
 */
export function getMonthRange(month, year) {
  const start = new Date(year, month, 1).toISOString().split('T')[0];
  const end = new Date(year, month + 1, 0).toISOString().split('T')[0];
  return { start, end };
}

/**
 * Get month name in Spanish
 * @param {number} month - Month (0-11)
 * @returns {string}
 */
export function getMonthName(month) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month];
}

/**
 * Format date for input[type="date"]
 * @param {string|Date} date
 * @returns {string} YYYY-MM-DD
 */
export function toInputDate(date) {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

/**
 * Calculate age based on a birth date string
 * @param {string} birthDate - Birth date string (YYYY-MM-DD or ISO)
 * @returns {number|string} Calculated age or "—" if invalid/empty
 */
export function calculateAge(birthDate) {
  if (!birthDate) return '—';
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return '—';
  
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
