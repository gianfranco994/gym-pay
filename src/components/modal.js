/**
 * Modal component for GymPay
 */

/**
 * Show a modal dialog
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string} options.content - HTML content for the body
 * @param {Function} [options.onSubmit] - Submit handler
 * @param {string} [options.submitText='Guardar'] - Submit button text
 * @param {string} [options.submitClass='btn-primary'] - Submit button class
 * @param {boolean} [options.showCancel=true] - Show cancel button
 * @param {Function} [options.onMount] - Called after modal is mounted with the body element
 * @returns {{ close: Function, getBody: Function }}
 */
export function showModal({
  title,
  content,
  onSubmit,
  submitText = 'Guardar',
  submitClass = 'btn-primary',
  showCancel = true,
  onMount,
}) {
  const root = document.getElementById('modal-root');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">${content}</div>
      <div class="modal-footer">
        ${showCancel ? '<button class="btn btn-secondary" data-action="cancel">Cancelar</button>' : ''}
        ${onSubmit ? `<button class="btn ${submitClass}" data-action="submit">${submitText}</button>` : ''}
      </div>
    </div>
  `;

  function close() {
    overlay.style.animation = 'fadeIn 0.2s ease reverse';
    overlay.querySelector('.modal').style.animation = 'slideUp 0.3s ease reverse';
    setTimeout(() => overlay.remove(), 200);
  }

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // Close button
  overlay.querySelector('.modal-close').addEventListener('click', close);

  // Cancel button
  const cancelBtn = overlay.querySelector('[data-action="cancel"]');
  if (cancelBtn) cancelBtn.addEventListener('click', close);

  // Submit button
  const submitBtn = overlay.querySelector('[data-action="submit"]');
  if (submitBtn && onSubmit) {
    submitBtn.addEventListener('click', async () => {
      const result = await onSubmit(overlay.querySelector('.modal-body'));
      if (result !== false) close();
    });
  }

  // ESC key
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKeyDown);
    }
  }
  document.addEventListener('keydown', onKeyDown);

  root.appendChild(overlay);

  // Call onMount callback
  if (onMount) {
    onMount(overlay.querySelector('.modal-body'));
  }

  return {
    close,
    getBody: () => overlay.querySelector('.modal-body'),
    getElement: () => overlay,
  };
}

/**
 * Show a confirmation dialog
 * @param {string} title
 * @param {string} message
 * @param {Object} [options]
 * @param {string} [options.confirmText='Confirmar']
 * @param {string} [options.confirmClass='btn-danger']
 * @returns {Promise<boolean>}
 */
export function confirmDialog(title, message, options = {}) {
  return new Promise((resolve) => {
    const { confirmText = 'Confirmar', confirmClass = 'btn-danger' } = options;

    showModal({
      title,
      content: `<p style="font-size:14px;color:var(--text-secondary);line-height:1.6">${message}</p>`,
      submitText: confirmText,
      submitClass: confirmClass,
      onSubmit: () => {
        resolve(true);
        return true;
      },
    });

    // If user closes modal without confirming
    const observer = new MutationObserver(() => {
      if (!document.querySelector('.modal-overlay')) {
        observer.disconnect();
        resolve(false);
      }
    });
    observer.observe(document.getElementById('modal-root'), { childList: true });
  });
}
