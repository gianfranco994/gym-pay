/**
 * Toast notification component
 */

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {'success'|'error'|'warning'|'info'} [type='success'] - Toast type
 * @param {number} [duration=3000] - Duration in ms
 */
export function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-root');
  if (!container) return;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" aria-label="Cerrar">✕</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  container.appendChild(toast);

  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  toast.style.animation = 'slideOutRight 0.3s ease forwards';
  setTimeout(() => toast.remove(), 300);
}
