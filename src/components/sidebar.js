/**
 * Sidebar navigation component for GymPay
 */

import { fetchExchangeRate } from '../services/exchange-rate.js';
import { formatRate, setRate } from '../utils/currency.js';
import { getExpiringMembers, getExpiredMembers, getPendingPayments } from '../db/payments.js';
import { signOut } from '../services/supabase.js';

let currentRoute = 'dashboard';

/**
 * Render the sidebar
 * @param {Function} navigate - Router navigate function
 */
export async function renderSidebar(navigate) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  // Get counts for badges
  let expiringCount = 0;
  let expiredCount = 0;
  let pendingCount = 0;
  try {
    const expiring = await getExpiringMembers(3);
    const expired = await getExpiredMembers();
    const pending = await getPendingPayments();
    expiringCount = expiring.length;
    expiredCount = expired.length;
    pendingCount = pending.length;
  } catch { /* ignore */ }

  const alertCount = expiringCount + expiredCount;

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">GP</div>
      <span class="sidebar-title">GymPay</span>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section-label">Principal</div>
      <button class="nav-item ${currentRoute === 'dashboard' ? 'active' : ''}" data-route="dashboard">
        <span class="nav-item-icon">📊</span>
        <span>Dashboard</span>
        ${alertCount > 0 ? `<span class="nav-item-badge">${alertCount}</span>` : ''}
      </button>
      <button class="nav-item ${currentRoute === 'members' ? 'active' : ''}" data-route="members">
        <span class="nav-item-icon">👥</span>
        <span>Miembros</span>
      </button>
      <button class="nav-item ${currentRoute === 'new-payment' ? 'active' : ''}" data-route="new-payment">
        <span class="nav-item-icon">💳</span>
        <span>Registrar Pago</span>
      </button>
      <button class="nav-item ${currentRoute === 'pending' ? 'active' : ''}" data-route="pending">
        <span class="nav-item-icon">⏳</span>
        <span>Aprobaciones</span>
        ${pendingCount > 0 ? `<span class="nav-item-badge" style="background: var(--text-yellow); color: #000;">${pendingCount}</span>` : ''}
      </button>

      <div class="nav-section-label" style="margin-top: var(--space-md)">Análisis</div>
      <button class="nav-item ${currentRoute === 'reports' ? 'active' : ''}" data-route="reports">
        <span class="nav-item-icon">📈</span>
        <span>Reportes</span>
      </button>

      <div class="nav-section-label" style="margin-top: var(--space-md)">Sistema</div>
      <button class="nav-item ${currentRoute === 'settings' ? 'active' : ''}" data-route="settings">
        <span class="nav-item-icon">⚙️</span>
        <span>Configuración</span>
      </button>
      <button class="nav-item" id="btn-logout" style="color: var(--status-danger);">
        <span class="nav-item-icon">🚪</span>
        <span>Cerrar Sesión</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-rate" id="sidebar-rate">
        <span class="sidebar-rate-label">Tasa BCV</span>
        <span class="sidebar-rate-value" id="sidebar-rate-value">Cargando...</span>
      </div>
    </div>
  `;

  // Navigation click handlers
  sidebar.querySelectorAll('.nav-item[data-route]').forEach(item => {
    item.addEventListener('click', () => {
      const route = item.dataset.route;
      if (route) {
        navigate(route);
        // Automatically close the sidebar on mobile when an option is clicked
        sidebar.classList.remove('open');
      }
    });
  });

  const logoutBtn = sidebar.querySelector('#btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut();
        localStorage.removeItem('gympay_auth');
        window.location.hash = '#/login';
      } catch (err) {
        console.error('Error signing out', err);
      }
    });
  }

  // Fetch exchange rate
  loadExchangeRate();
}

/**
 * Update the active route highlight
 * @param {string} route
 */
export function setActiveRoute(route) {
  currentRoute = route;
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.querySelectorAll('.nav-item').forEach(item => {
    if (item.dataset.route === route) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

/**
 * Load and display exchange rate in sidebar
 */
export async function loadExchangeRate() {
  const rateEl = document.getElementById('sidebar-rate-value');
  if (!rateEl) return;

  try {
    const result = await fetchExchangeRate();
    if (result && result.rate) {
      setRate(result.rate);
      rateEl.textContent = formatRate(result.rate).replace('1 USD = ', '');
      rateEl.title = `Fuente: ${result.source}\nActualizado: ${new Date(result.timestamp).toLocaleString('es-VE')}`;
    } else {
      rateEl.textContent = 'No disponible';
      rateEl.style.color = 'var(--text-muted)';
    }
  } catch {
    rateEl.textContent = 'Error';
    rateEl.style.color = 'var(--status-danger)';
  }
}

/**
 * Update badge count on sidebar
 * @param {number} count
 */
export function updateAlertBadge(count) {
  const dashItem = document.querySelector('[data-route="dashboard"]');
  if (!dashItem) return;

  const existing = dashItem.querySelector('.nav-item-badge');
  if (existing) existing.remove();

  if (count > 0) {
    const badge = document.createElement('span');
    badge.className = 'nav-item-badge';
    badge.textContent = count;
    dashItem.appendChild(badge);
  }
}
