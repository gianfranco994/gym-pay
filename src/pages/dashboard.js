/**
 * Dashboard page – GymPay main view
 */

import { getMemberCount, getNewMembersCount, getMember } from '../db/members.js';
import {
  getExpiringMembers,
  getExpiredMembers,
  getMonthlyAnalytics,
  getAllPayments,
  getPendingPayments
} from '../db/payments.js';
import { formatAmount, getCurrency, setCurrency } from '../utils/currency.js';
import {
  formatDate,
  daysRemaining,
  daysRemainingText,
  getMonthRange,
  getMonthName,
} from '../utils/dates.js';
import { openWhatsApp } from '../services/whatsapp.js';
import { navigate } from '../router.js';
import Chart from 'chart.js/auto';

// Store chart instances to prevent memory leaks
let _chartIncome = null;
let _chartMethods = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a stat-card HTML string.
 */
function statCard(icon, iconColor, value, label, sublabel = '') {
  return `
    <div class="stat-card">
      <div class="stat-card-header">
        <div class="stat-card-icon ${iconColor}">${icon}</div>
      </div>
      <div class="stat-card-value">${value}</div>
      <div class="stat-card-label">${label}</div>
      ${sublabel ? `<div class="stat-card-sublabel">${sublabel}</div>` : ''}
    </div>`;
}

/**
 * Return a badge-class string based on days remaining.
 */
function daysBadgeClass(days) {
  if (days <= 0) return 'danger';
  if (days <= 1) return 'warning';
  return 'warning';
}

// ─── Main render ────────────────────────────────────────────────────────────

export async function render(container) {
  // ── 1. Load data ──────────────────────────────────────────────────────────

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentYear = now.getFullYear();
  const { start: monthStart, end: monthEnd } = getMonthRange(
    now.getMonth(),
    currentYear,
  );

  const [
    analytics,
    activeCount,
    newCount,
    expiringMembers,
    expiredMembers,
    allPayments,
    pendingPayments,
  ] = await Promise.all([
    getMonthlyAnalytics(currentMonth, currentYear),
    getMemberCount(),
    getNewMembersCount(monthStart, monthEnd),
    getExpiringMembers(3),
    getExpiredMembers(),
    getAllPayments(),
    getPendingPayments(),
  ]);

  // Last 10 payments
  const recentPayments = allPayments.slice(0, 10);

  // Load member data for recent payments
  const memberCache = new Map();
  for (const p of recentPayments) {
    if (!memberCache.has(p.memberId)) {
      const m = await getMember(p.memberId);
      if (m) memberCache.set(p.memberId, m);
    }
  }

  // Last 6 months analytics for bar chart
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, now.getMonth() - i, 1);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const a = await getMonthlyAnalytics(m, y);
    monthlyData.push({
      label: getMonthName(d.getMonth()).substring(0, 3),
      totalBs: a.totalBs,
      totalUsd: a.totalUsd,
    });
  }

  // ── 2. Currency state ─────────────────────────────────────────────────────
  const currency = getCurrency();

  // ── 3. Build HTML ─────────────────────────────────────────────────────────

  const html = `
    <div class="page-container animate-in">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Dashboard</h1>
          <p class="page-subtitle">Resumen general de tu gimnasio</p>
        </div>
        <div class="currency-toggle">
          <button class="currency-option ${currency === 'bs' ? 'active' : ''}" data-currency="bs">Bs</button>
          <button class="currency-option ${currency === 'usd' ? 'active' : ''}" data-currency="usd">USD</button>
        </div>
      </div>

      ${pendingPayments.length > 0 ? `
      <!-- Pending Payments Alert -->
      <div class="card" style="background: var(--bg-hover); border-left: 4px solid var(--text-yellow); margin-bottom: var(--space-xl);">
        <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; padding: var(--space-md);">
          <div>
            <h3 style="margin: 0 0 5px 0; color: var(--text-primary); font-size: 16px;">Hay ${pendingPayments.length} pago(s) pendiente(s) de aprobación</h3>
            <p class="text-muted" style="margin: 0; font-size: 14px;">Revisa las transferencias reportadas por los clientes.</p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="location.hash='#/pending'">Revisar Pagos</button>
        </div>
      </div>
      ` : ''}

      <!-- Stat Cards -->
      <div class="stats-grid">
        ${statCard('💰', 'green', formatAmount(analytics.totalBs, analytics.totalUsd), 'Ingresos del mes', getMonthName(now.getMonth()) + ' ' + currentYear)}
        ${statCard('👥', 'blue', activeCount, 'Miembros activos')}
        ${statCard('🆕', 'purple', newCount, 'Nuevos este mes')}
        ${statCard('🔄', 'green', analytics.renewals, 'Renovaciones')}
        ${statCard('⚠️', 'yellow', expiringMembers.length, 'Por vencer', 'Próximos 3 días')}
        ${statCard('🔴', 'red', expiredMembers.length, 'Vencidos')}
      </div>

      <!-- WhatsApp Reminders -->
      <div class="whatsapp-section">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">📱 Recordatorios WhatsApp</h2>
          </div>
          ${expiringMembers.length > 0 ? `
            <div class="card-body no-padding">
              <div class="whatsapp-list">
                ${expiringMembers.map(({ member, payment }) => {
                  const days = daysRemaining(payment.fechaVencimiento);
                  const badgeClass = daysBadgeClass(days);
                  const daysText = daysRemainingText(payment.fechaVencimiento);
                  return `
                    <div class="whatsapp-item">
                      <div class="whatsapp-item-info">
                        <div class="whatsapp-item-name">${member.nombre} ${member.apellido}</div>
                        <div class="whatsapp-item-detail">${member.telefono || 'Sin teléfono'}</div>
                      </div>
                      <span class="badge ${badgeClass}">
                        <span class="badge-dot"></span>
                        ${daysText}
                      </span>
                      <button class="btn btn-whatsapp btn-sm" data-wa-member='${JSON.stringify({ telefono: member.telefono, nombre: member.nombre + ' ' + member.apellido, fechaVencimiento: payment.fechaVencimiento })}'>
                        📲 Enviar
                      </button>
                    </div>`;
                }).join('')}
              </div>
            </div>
          ` : `
            <div class="card-body">
              <div class="empty-state">
                <div class="empty-state-icon">🎉</div>
                <div class="empty-state-title">Todo al día</div>
                <div class="empty-state-text">No hay miembros por vencer en los próximos 3 días</div>
              </div>
            </div>
          `}
        </div>
      </div>

      <!-- Charts -->
      <div class="charts-grid">
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">📊 Ingresos Mensuales</h2>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="chart-income"></canvas>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h2 class="card-title">💳 Métodos de Pago</h2>
          </div>
          <div class="card-body">
            <div class="chart-container">
              <canvas id="chart-methods"></canvas>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">🕐 Actividad Reciente</h2>
        </div>
        ${recentPayments.length > 0 ? `
          <div class="card-body no-padding">
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Miembro</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentPayments.map((p) => {
                    const member = memberCache.get(p.memberId);
                    const memberName = member
                      ? `${member.nombre} ${member.apellido}`
                      : 'Miembro eliminado';
                    const metodo = p.metodoPago === 'pagoMovil' ? 'Pago Móvil' : 'Efectivo';
                    return `
                      <tr data-member-id="${p.memberId}">
                        <td>
                          <a class="member-link" data-id="${p.memberId}">${memberName}</a>
                        </td>
                        <td class="font-mono">${formatAmount(p.montoBs, p.montoUsd)}</td>
                        <td>${metodo}</td>
                        <td class="text-muted">${formatDate(p.fechaPago)}</td>
                      </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <div class="card-body">
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <div class="empty-state-title">Sin actividad</div>
              <div class="empty-state-text">Aún no se han registrado pagos</div>
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // ── 4. Charts ─────────────────────────────────────────────────────────────

  // Global Chart.js dark-theme defaults
  Chart.defaults.color = 'hsl(228, 12%, 55%)';
  Chart.defaults.borderColor = 'hsla(228, 15%, 30%, 0.4)';

  // Destroy previous chart instances to prevent memory leaks
  if (_chartIncome) { _chartIncome.destroy(); _chartIncome = null; }
  if (_chartMethods) { _chartMethods.destroy(); _chartMethods = null; }

  // — Bar chart: monthly income (last 6 months) —
  const incomeCtx = container.querySelector('#chart-income');
  if (incomeCtx) {
    const isUsd = getCurrency() === 'usd';
    _chartIncome = new Chart(incomeCtx, {
      type: 'bar',
      data: {
        labels: monthlyData.map((d) => d.label),
        datasets: [
          {
            label: isUsd ? 'Ingresos USD' : 'Ingresos Bs',
            data: monthlyData.map((d) => (isUsd ? d.totalUsd : d.totalBs)),
            backgroundColor: 'hsl(157, 78%, 48%)',
            borderRadius: 6,
            maxBarThickness: 48,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (v) => (isUsd ? '$ ' + v : 'Bs ' + v),
            },
            grid: {
              color: 'hsla(228, 15%, 30%, 0.4)',
            },
          },
          x: {
            grid: { display: false },
          },
        },
      },
    });
  }

  // — Doughnut chart: payment methods —
  const methodsCtx = container.querySelector('#chart-methods');
  if (methodsCtx) {
    const pmCount = analytics.byMethod.pagoMovil.count;
    const efCount = analytics.byMethod.efectivo.count;
    const hasData = pmCount > 0 || efCount > 0;

    _chartMethods = new Chart(methodsCtx, {
      type: 'doughnut',
      data: {
        labels: ['Pago Móvil', 'Efectivo'],
        datasets: [
          {
            data: hasData ? [pmCount, efCount] : [1, 1],
            backgroundColor: ['hsl(262, 68%, 62%)', 'hsl(157, 78%, 48%)'],
            borderWidth: 0,
            spacing: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasData,
          },
        },
      },
    });
  }

  // ── 5. Event listeners ────────────────────────────────────────────────────

  // Currency toggle
  container.querySelectorAll('.currency-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      const newCurrency = btn.dataset.currency;
      setCurrency(newCurrency);
      // Re-render the whole dashboard
      render(container);
    });
  });

  // WhatsApp buttons
  container.querySelectorAll('[data-wa-member]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const data = JSON.parse(btn.dataset.waMember);
        await openWhatsApp(data);
      } catch (err) {
        console.error('[Dashboard] WhatsApp error:', err);
      }
    });
  });

  // Member links in recent activity table
  container.querySelectorAll('.member-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.dataset.id;
      if (id) navigate(`member-detail/${id}`);
    });
  });
}
