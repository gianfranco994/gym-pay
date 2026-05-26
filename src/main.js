/**
 * GymPay - Main Entry Point
 * Gym membership management application
 */

import './index.css';
import { initDB } from './db/database.js';
import { route, initRouter, onNavigate, navigate } from './router.js';
import { renderSidebar, setActiveRoute } from './components/sidebar.js';

// Import pages
import { render as renderDashboard } from './pages/dashboard.js';
import { render as renderMembers } from './pages/members.js';
import { render as renderMemberDetail } from './pages/member-detail.js';
import { render as renderNewPayment } from './pages/new-payment.js';
import { render as renderReports } from './pages/reports.js';
import { render as renderSettings } from './pages/settings.js';
import { render as renderLogin } from './pages/login.js';
import { render as renderReceipt } from './pages/receipt.js';
import { render as renderClientPortal } from './pages/client-portal.js';
import { render as renderPending } from './pages/pending.js';

/**
 * Initialize the application
 */
async function init() {
  try {
    // Initialize database
    await initDB();

    // Register routes
    route('dashboard', renderDashboard);
    route('members', renderMembers);
    route('member-detail', renderMemberDetail);
    route('new-payment', renderNewPayment);
    route('reports', renderReports);
    route('settings', renderSettings);
    route('login', renderLogin);
    route('receipt', renderReceipt);
    route('portal', renderClientPortal);
    route('pending', renderPending);

    // Render sidebar
    await renderSidebar((routePath) => navigate(routePath));

    // Update sidebar active state on navigation
    onNavigate(async (routePath) => {
      setActiveRoute(routePath);
      // Hide sidebar and mobile button on public-only pages
      const isPublicOnly = ['portal', 'login'].includes(routePath);
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.style.display = isPublicOnly ? 'none' : '';
      if (mobileMenuBtn) mobileMenuBtn.style.display = isPublicOnly ? 'none' : '';
      // Also adjust main-content margin when sidebar is hidden
      const mainContent = document.getElementById('main-content');
      if (mainContent) mainContent.style.marginLeft = isPublicOnly ? '0' : '';
    });

    // Mobile menu button
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'mobile-menu-btn';
    mobileMenuBtn.innerHTML = '☰';
    mobileMenuBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('open');
    });
    document.body.appendChild(mobileMenuBtn);

    // Close sidebar on mobile when clicking outside
    document.getElementById('main-content').addEventListener('click', () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
      }
    });

    // Initialize router (will trigger first render)
    initRouter();

    console.log('✅ GymPay initialized');
  } catch (error) {
    console.error('Failed to initialize GymPay:', error);
    document.getElementById('page-container').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Error al iniciar GymPay</h3>
        <p class="empty-state-text">${error.message}</p>
      </div>
    `;
  }
}

// Start the app
init();
