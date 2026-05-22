/**
 * Simple hash-based SPA router for GymPay
 */

const routes = {};
let currentRoute = null;
let onNavigateCallback = null;

/**
 * Register a route handler
 * @param {string} path - Route path (e.g., 'dashboard', 'members', 'member-detail')
 * @param {Function} handler - Async function(container, ...params) that renders the page
 */
export function route(path, handler) {
  routes[path] = handler;
}

/**
 * Navigate to a route
 * @param {string} path - Route path (can include params like 'member-detail/5')
 */
export function navigate(path) {
  window.location.hash = '#/' + path;
}

/**
 * Get the current route info
 * @returns {{ path: string, params: string[], query: Object }}
 */
export function getCurrentRoute() {
  const hash = window.location.hash.slice(2) || 'dashboard'; // Remove #/
  const [pathWithParams, queryString] = hash.split('?');
  const parts = pathWithParams.split('/');
  const path = parts[0];
  const params = parts.slice(1);

  // Parse query string
  const query = {};
  if (queryString) {
    queryString.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      query[decodeURIComponent(key)] = decodeURIComponent(value || '');
    });
  }

  return { path, params, query };
}

/**
 * Set a callback for when navigation occurs
 * @param {Function} callback - Called with (routePath)
 */
export function onNavigate(callback) {
  onNavigateCallback = callback;
}

/**
 * Handle the current hash and render the appropriate page
 */
async function handleRoute() {
  const container = document.getElementById('page-container');
  if (!container) return;

  const { path, params, query } = getCurrentRoute();

  const handler = routes[path] || routes['dashboard'];
  if (!handler) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><h3 class="empty-state-title">Página no encontrada</h3></div>';
    return;
  }

  currentRoute = path;

  // Auth Check
  const isAuthenticated = localStorage.getItem('gympay_auth') === 'true';
  const publicRoutes = ['login', 'receipt', 'portal'];
  if (!isAuthenticated && !publicRoutes.includes(path)) {
    window.location.hash = '#/login';
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="page-container">
      <div class="skeleton skeleton-title"></div>
      <div class="stats-grid">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>
  `;

  try {
    await handler(container, ...params, query);
  } catch (error) {
    console.error('Route error:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3 class="empty-state-title">Error al cargar la página</h3>
        <p class="empty-state-text">${error.message}</p>
        <button class="btn btn-primary" onclick="location.hash='#/dashboard'">Volver al Dashboard</button>
      </div>
    `;
  }

  // Notify callback
  if (onNavigateCallback) {
    onNavigateCallback(path);
  }
}

/**
 * Initialize the router
 */
export function initRouter() {
  window.addEventListener('hashchange', handleRoute);

  // Initial route
  if (!window.location.hash) {
    window.location.hash = '#/dashboard';
  } else {
    handleRoute();
  }
}
