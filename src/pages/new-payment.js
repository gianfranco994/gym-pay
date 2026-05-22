import { getAllMembers, getMember } from '../db/members.js';
import { addPayment, getLatestPayment } from '../db/payments.js';
import { getDB } from '../db/database.js';
import { fetchExchangeRate } from '../services/exchange-rate.js';
import { formatUsd, bsToUsd, formatAmount } from '../utils/currency.js';
import { calculateExpiration, todayISO, formatDate, getStatusBadge } from '../utils/dates.js';
import { showToast } from '../components/toast.js';
import { navigate } from '../router.js';

export async function render(container, queryParams, parsedQuery) {
  const query = parsedQuery || {};
  let selectedMemberId = query.member ? parseInt(query.member, 10) : null;
  let allMembers = [];
  let currentRate = 0;
  let precioMensual = 0;

  try {
    const [membersData, db, rateData] = await Promise.all([
      getAllMembers(),
      getDB(),
      fetchExchangeRate()
    ]);
    allMembers = membersData;
    
    if (rateData && rateData.rate) {
      currentRate = rateData.rate;
    }

    const precioSetting = await db.get('settings', 'precioMensual');
    if (precioSetting && precioSetting.value) {
      precioMensual = precioSetting.value;
    }
  } catch (err) {
    console.error('Error cargando datos para nuevo pago', err);
  }

  const banks = [
    'Banesco', 'Mercantil', 'Provincial', 'Venezuela', 'BNC', 'Bicentenario', 
    'Tesoro', 'Exterior', 'BOD', 'Bancamiga', 'Sofitasa', 'Plaza', 'Caroní', 
    'Del Sur', 'Fondo Común', 'Otro'
  ];

  container.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">Registrar Pago</h1>
      <p class="page-subtitle">Procesa un nuevo pago o renovación de mensualidad</p>
    </div>

    <div style="max-width: 700px; margin: 0 auto;">
      <div class="card">
        <div class="card-body">
          <form id="payment-form">
            
            <!-- Miembro -->
            <div class="form-group" style="position: relative;">
              <label class="form-label">Miembro *</label>
              ${selectedMemberId ? `
                <div id="selected-member-card" class="card" style="padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-hover); border-color: var(--accent-primary);">
                  <!-- Rellenado por JS -->
                </div>
                <button type="button" id="btn-change-member" class="btn btn-ghost btn-sm" style="padding: 0;">Cambiar miembro</button>
                <input type="hidden" name="memberId" value="${selectedMemberId}">
                <div id="member-search-container" style="display: none; position: relative;">
                  <div class="search-wrapper" style="max-width: 100%;">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="member-search" class="search-input" placeholder="Buscar por nombre o cédula..." autocomplete="off">
                  </div>
                  <div id="member-dropdown" class="card" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 10; max-height: 200px; overflow-y: auto; margin-top: 4px;"></div>
                </div>
              ` : `
                <div id="selected-member-card" class="card" style="display: none; padding: var(--space-md); margin-bottom: var(--space-sm); background: var(--bg-hover); border-color: var(--accent-primary);"></div>
                <button type="button" id="btn-change-member" class="btn btn-ghost btn-sm" style="display: none; padding: 0;">Cambiar miembro</button>
                <input type="hidden" name="memberId" id="member-id-input" value="">
                <div id="member-search-container" style="position: relative;">
                  <div class="search-wrapper" style="max-width: 100%;">
                    <span class="search-icon">🔍</span>
                    <input type="text" id="member-search" class="search-input" placeholder="Buscar por nombre o cédula..." autocomplete="off">
                  </div>
                  <div id="member-dropdown" class="card" style="display: none; position: absolute; top: 100%; left: 0; right: 0; z-index: 10; max-height: 200px; overflow-y: auto; margin-top: 4px;"></div>
                </div>
              `}
            </div>

            <!-- Monto -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Monto (Bs) *</label>
                <input type="number" id="monto-bs" name="montoBs" class="form-input" required min="1" step="0.01" value="${precioMensual || ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Equivalente USD</label>
                <div id="monto-usd" class="form-input" style="background: var(--bg-primary); border-style: dashed; color: var(--text-secondary); pointer-events: none;">
                  ${formatUsd(bsToUsd(precioMensual || 0, currentRate))}
                </div>
                <div class="form-hint">Tasa: 1 USD = ${currentRate.toFixed(2)} Bs</div>
              </div>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: var(--space-lg) 0;">

            <!-- Duración -->
            <div class="form-group">
              <label class="form-label">Duración del plan</label>
              <div class="duration-options">
                <button type="button" class="duration-btn active" data-days="30">30 días</button>
                <button type="button" class="duration-btn" data-days="15">15 días</button>
                <button type="button" class="duration-btn" data-days="custom">Personalizado</button>
              </div>
              <div id="custom-days-container" style="display: none; margin-bottom: var(--space-md);">
                <input type="number" id="custom-days" class="form-input" min="1" max="365" placeholder="Cantidad de días" style="max-width: 200px;">
              </div>
              <input type="hidden" name="diasPlan" id="dias-plan" value="30">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Fecha de Pago</label>
                <input type="date" id="fecha-pago" name="fechaPago" class="form-input" required value="${todayISO()}">
              </div>
              <div class="form-group">
                <label class="form-label">Fecha de Vencimiento</label>
                <input type="date" id="fecha-vencimiento" name="fechaVencimiento" class="form-input" required value="${calculateExpiration(todayISO(), 30)}">
              </div>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--border-subtle); margin: var(--space-lg) 0;">

            <!-- Método de Pago -->
            <div class="form-group">
              <label class="form-label">Método de Pago *</label>
              <div class="form-radio-group">
                <label class="form-radio-option selected">
                  <input type="radio" name="metodoPago" value="pagoMovil" checked>
                  📱 Pago Móvil / Transferencia
                </label>
                <label class="form-radio-option">
                  <input type="radio" name="metodoPago" value="efectivo">
                  💵 Efectivo
                </label>
              </div>
            </div>

            <div id="datos-banco" class="form-row animate-in">
              <div class="form-group">
                <label class="form-label">Banco</label>
                <select name="banco" id="banco-select" class="form-select" required>
                  <option value="" disabled selected>Seleccione banco</option>
                  ${banks.map(b => `<option value="${b}">${b}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Referencia (últimos 4 dígitos)</label>
                <input type="text" name="referencia" id="referencia-input" class="form-input" maxlength="4" pattern="\\d{4,}" placeholder="Ej: 1234" required>
              </div>
            </div>

            <!-- Concepto y Notas -->
            <div class="form-group">
              <label class="form-label">Concepto</label>
              <div class="form-radio-group">
                <label class="form-radio-option selected">
                  <input type="radio" name="concepto" value="mensualidad" checked>
                  Mensualidad
                </label>
                <label class="form-radio-option">
                  <input type="radio" name="concepto" value="inscripcion">
                  Inscripción
                </label>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Notas (opcional)</label>
              <textarea name="notas" class="form-textarea" placeholder="Alguna observación adicional..."></textarea>
            </div>

            <div class="form-error" id="form-error" style="display: none; margin-bottom: var(--space-md);"></div>

            <button type="submit" class="btn btn-primary w-full" style="padding: 14px; font-size: 16px;">✓ Registrar Pago</button>
          </form>
        </div>
      </div>
    </div>
  `;

  // UI Logics
  const form = document.getElementById('payment-form');
  const searchInput = document.getElementById('member-search');
  const dropdown = document.getElementById('member-dropdown');
  const idInput = form.querySelector('[name="memberId"]');
  const selectedMemberCard = document.getElementById('selected-member-card');
  const btnChangeMember = document.getElementById('btn-change-member');
  const searchContainer = document.getElementById('member-search-container');
  
  const montoBs = document.getElementById('monto-bs');
  const montoUsd = document.getElementById('monto-usd');
  
  const durationBtns = document.querySelectorAll('.duration-btn');
  const customDaysContainer = document.getElementById('custom-days-container');
  const customDaysInput = document.getElementById('custom-days');
  const diasPlanInput = document.getElementById('dias-plan');
  
  const fechaPago = document.getElementById('fecha-pago');
  const fechaVencimiento = document.getElementById('fecha-vencimiento');
  
  const radioMethods = document.querySelectorAll('input[name="metodoPago"]');
  const datosBanco = document.getElementById('datos-banco');
  const bancoSelect = document.getElementById('banco-select');
  const referenciaInput = document.getElementById('referencia-input');
  
  const radioConcepts = document.querySelectorAll('input[name="concepto"]');

  // --- Member Selection Logic ---
  async function renderSelectedMember(id) {
    if (!id) return;
    const member = await getMember(id);
    if (!member) return;
    
    const latestPayment = await getLatestPayment(id);
    const badgeInfo = getStatusBadge(latestPayment?.fechaVencimiento, member.estado);
    
    selectedMemberCard.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-weight: 700; font-size: 16px; margin-bottom: 2px;">${member.nombre} ${member.apellido}</div>
          <div style="font-size: 12px; color: var(--text-secondary);">CI: ${member.cedula || 'N/A'} • Tel: ${member.telefono}</div>
        </div>
        <div style="text-align: right;">
          <span class="badge ${badgeInfo.class}" style="margin-bottom: 4px;">
            <span class="badge-dot"></span>${badgeInfo.text}
          </span>
          <div style="font-size: 11px; color: var(--text-muted);">
            ${latestPayment ? `Vence: ${formatDate(latestPayment.fechaVencimiento)}` : 'Sin pagos previos'}
          </div>
        </div>
      </div>
    `;
    
    selectedMemberCard.style.display = 'block';
    searchContainer.style.display = 'none';
    btnChangeMember.style.display = 'inline-flex';
    idInput.value = id;
    selectedMemberId = id;

    // If active and has a previous expiration, calculate new from that expiration date?
    // User requested simpler logic: from today or selected payment date, add days.
    updateExpiration();
  }

  if (selectedMemberId) {
    renderSelectedMember(selectedMemberId);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      if (!q) {
        dropdown.style.display = 'none';
        return;
      }
      
      const filtered = allMembers.filter(m => 
        m.nombre.toLowerCase().includes(q) || 
        m.apellido.toLowerCase().includes(q) || 
        (m.cedula && m.cedula.toLowerCase().includes(q))
      ).slice(0, 5); // Limit 5

      if (filtered.length > 0) {
        dropdown.innerHTML = filtered.map(m => `
          <div class="member-dropdown-item" data-id="${m.id}" style="padding: var(--space-sm) var(--space-md); cursor: pointer; border-bottom: 1px solid var(--border-subtle);">
            <div style="font-weight: 600;">${m.nombre} ${m.apellido}</div>
            <div style="font-size: 12px; color: var(--text-muted);">CI: ${m.cedula || 'N/A'} • ${m.telefono}</div>
          </div>
        `).join('');
        
        dropdown.querySelectorAll('.member-dropdown-item').forEach(item => {
          item.addEventListener('click', () => {
            renderSelectedMember(parseInt(item.dataset.id, 10));
            dropdown.style.display = 'none';
            searchInput.value = '';
          });
          item.addEventListener('mouseover', () => item.style.background = 'var(--bg-elevated)');
          item.addEventListener('mouseout', () => item.style.background = 'transparent');
        });
        
        dropdown.style.display = 'block';
      } else {
        dropdown.innerHTML = '<div style="padding: var(--space-md); color: var(--text-muted); text-align: center; font-size: 13px;">No se encontraron resultados</div>';
        dropdown.style.display = 'block';
      }
    });

    document.addEventListener('click', (e) => {
      if (!searchContainer.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  if (btnChangeMember) {
    btnChangeMember.addEventListener('click', () => {
      selectedMemberCard.style.display = 'none';
      btnChangeMember.style.display = 'none';
      searchContainer.style.display = 'block';
      idInput.value = '';
      selectedMemberId = null;
      if (searchInput) searchInput.focus();
    });
  }

  // --- Calculations ---
  function updateUsd() {
    const val = parseFloat(montoBs.value) || 0;
    montoUsd.textContent = formatUsd(bsToUsd(val, currentRate));
  }

  if (montoBs) {
    montoBs.addEventListener('input', updateUsd);
  }

  function updateExpiration() {
    const days = parseInt(diasPlanInput.value, 10) || 30;
    const start = fechaPago.value || todayISO();
    fechaVencimiento.value = calculateExpiration(start, days);
  }

  durationBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      durationBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      
      const days = e.currentTarget.dataset.days;
      if (days === 'custom') {
        customDaysContainer.style.display = 'block';
        if (customDaysInput.value) {
          diasPlanInput.value = customDaysInput.value;
          updateExpiration();
        }
      } else {
        customDaysContainer.style.display = 'none';
        diasPlanInput.value = days;
        updateExpiration();
      }
    });
  });

  if (customDaysInput) {
    customDaysInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) {
        diasPlanInput.value = val;
        updateExpiration();
      }
    });
  }

  if (fechaPago) {
    fechaPago.addEventListener('change', updateExpiration);
  }

  // --- Payment Method UI ---
  radioMethods.forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.form-radio-option:has(input[name="metodoPago"])').forEach(lbl => lbl.classList.remove('selected'));
      e.target.closest('.form-radio-option').classList.add('selected');
      
      if (e.target.value === 'pagoMovil') {
        datosBanco.style.display = 'grid';
        bancoSelect.required = true;
        referenciaInput.required = true;
      } else {
        datosBanco.style.display = 'none';
        bancoSelect.required = false;
        referenciaInput.required = false;
        bancoSelect.value = '';
        referenciaInput.value = '';
      }
    });
  });

  // --- Concept UI ---
  radioConcepts.forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('.form-radio-option:has(input[name="concepto"])').forEach(lbl => lbl.classList.remove('selected'));
      e.target.closest('.form-radio-option').classList.add('selected');
    });
  });

  // --- Submit ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.style.display = 'none';

    if (!idInput.value) {
      errorEl.textContent = 'Debe seleccionar un miembro.';
      errorEl.style.display = 'block';
      return;
    }

    if (diasPlanInput.value === 'custom' || !parseInt(diasPlanInput.value, 10)) {
       errorEl.textContent = 'Debe ingresar una cantidad de días válida.';
       errorEl.style.display = 'block';
       return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="animate-pulse">Procesando...</span>';

    try {
      const formData = new FormData(form);
      const montoBsVal = parseFloat(formData.get('montoBs'));
      
      // Get fresh rate if possible
      let finalRate = currentRate;
      try {
        const rateRes = await fetchExchangeRate();
        if (rateRes && rateRes.rate) finalRate = rateRes.rate;
      } catch (e) { console.warn('Could not refresh rate'); }

      const data = {
        memberId: parseInt(formData.get('memberId'), 10),
        montoBs: montoBsVal,
        tasaUsd: finalRate,
        montoUsd: bsToUsd(montoBsVal, finalRate),
        fechaPago: formData.get('fechaPago'),
        fechaVencimiento: formData.get('fechaVencimiento'),
        diasPlan: parseInt(formData.get('diasPlan'), 10),
        metodoPago: formData.get('metodoPago'),
        banco: formData.get('banco') || null,
        referencia: formData.get('referencia') || null,
        concepto: formData.get('concepto'),
        notas: formData.get('notas') || ''
      };

      await addPayment(data);
      showToast('Pago registrado exitosamente', 'success');
      navigate(`member-detail/${data.memberId}`);
      
    } catch (error) {
      console.error('Error recording payment:', error);
      errorEl.textContent = error.message || 'Error al procesar el pago.';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.innerHTML = '✓ Registrar Pago';
    }
  });
}
