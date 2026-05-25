import { showToast } from '../components/toast.js';
import { signIn } from '../services/supabase.js';

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
            <label class="form-label">Correo Electrónico</label>
            <input type="email" id="username" class="form-input" placeholder="ejemplo@correo.com" required autocomplete="username">
          </div>
          <div class="form-group mb-lg">
            <label class="form-label">Contraseña</label>
            <input type="password" id="password" class="form-input" required autocomplete="current-password">
          </div>
          <button type="submit" id="login-btn" class="btn btn-primary" style="width: 100%; justify-content: center;">Ingresar al Sistema</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;

    btn.disabled = true;
    btn.textContent = 'Ingresando...';

    try {
      await signIn(user, pass);
      localStorage.setItem('gympay_auth', 'true');
      
      // Restore layout
      if (sidebar) sidebar.style.display = '';
      if (mobileBtn) mobileBtn.style.display = '';
      if (mainContent) {
        mainContent.style.marginLeft = '';
        mainContent.style.padding = '';
      }
      
      window.location.hash = '#/dashboard';
    } catch (error) {
      showToast(error.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : 'Error al iniciar sesión', 'error');
      btn.disabled = false;
      btn.textContent = 'Ingresar al Sistema';
    }
  });
}
