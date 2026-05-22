import { showToast } from '../components/toast.js';

export async function render(container) {
  // Hide sidebar and adjust main layout since we are not logged in
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('main-content');
  const mobileBtn = document.querySelector('.mobile-menu-btn');
  
  if (sidebar) sidebar.style.display = 'none';
  if (mobileBtn) mobileBtn.style.display = 'none';
  if (mainContent) {
    mainContent.style.marginLeft = '0';
    mainContent.style.padding = '0';
  }

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background-color: var(--bg-body);">
      <div class="card" style="width: 100%; max-width: 400px; padding: var(--space-xl);">
        <div style="text-align: center; margin-bottom: var(--space-lg);">
          <div style="font-size: 3rem; margin-bottom: var(--space-sm);">💪</div>
          <h1 style="color: var(--text-primary); font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">GymPay Login</h1>
          <p class="text-muted" style="margin-top: 8px;">Por favor, ingresa tus credenciales</p>
        </div>
        
        <form id="login-form">
          <div class="form-group mb-md">
            <label class="form-label">Usuario</label>
            <input type="text" id="username" class="form-input" required autocomplete="username">
          </div>
          <div class="form-group mb-lg">
            <label class="form-label">Contraseña</label>
            <input type="password" id="password" class="form-input" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; justify-content: center;">Ingresar al Sistema</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;

    if (user === 'admin' && pass === '1234') {
      localStorage.setItem('gympay_auth', 'true');
      
      // Restore layout
      if (sidebar) sidebar.style.display = '';
      if (mobileBtn) mobileBtn.style.display = '';
      if (mainContent) {
        mainContent.style.marginLeft = '';
        mainContent.style.padding = '';
      }
      
      window.location.hash = '#/dashboard';
    } else {
      showToast('Credenciales incorrectas', 'error');
    }
  });
}
