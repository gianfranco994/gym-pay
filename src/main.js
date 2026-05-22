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

    // Render sidebar
    await renderSidebar((routePath) => navigate(routePath));

    // Update sidebar active state on navigation
    onNavigate(async (routePath) => {
      setActiveRoute(routePath);
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
