import { getCustomAnalytics, getPaymentsByDateRange } from '../db/payments.js';
import { exportPaymentsToCSV } from '../utils/export.js';
import { formatAmount } from '../utils/currency.js';
import { todayISO, toInputDate, formatDateShort } from '../utils/dates.js';
import Chart from 'chart.js/auto';

let trendChartInstance = null;
let methodChartInstance = null;
let compareChartInstance = null;
let currentPaymentsList = [];

// Helper to get date for X days ago
function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// Helper to get first day of current month
function getFirstDayOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

// Helper to get first day of last month and last day of last month
function getLastMonthRange() {
  const d = new Date();
  d.setDate(0); // Last day of last month
  const end = d.toISOString().split('T')[0];
  d.setDate(1); // First day of last month
  const start = d.toISOString().split('T')[0];
  return { start, end };
}

export async function render(container) {
  // Default to current month
  let startDate = getFirstDayOfMonth();
  let endDate = todayISO();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Reportes</h1>
        <p class="page-subtitle">Analíticas y rendimiento financiero</p>
      </div>
      
      <div class="date-range">
        <input type="date" id="report-start" class="form-input" value="${startDate}">
        <span class="date-range-separator">hasta</span>
        <input type="date" id="report-end" class="form-input" value="${endDate}">
        <button id="btn-apply-dates" class="btn btn-primary">Aplicar</button>
      </div>
    </div>
    
    <div class="date-presets" style="margin-top: -16px; margin-bottom: var(--space-xl); justify-content: flex-start; flex-wrap: wrap;">
      <button class="btn btn-ghost btn-sm preset-btn" data-preset="month">Este mes</button>
      <button class="btn btn-ghost btn-sm preset-btn" data-preset="last-month">Mes pasado</button>
      <button class="btn btn-ghost btn-sm preset-btn" data-preset="3-months">Últimos 3 meses</button>
      <button class="btn btn-ghost btn-sm preset-btn" data-preset="year">Este año</button>
      <div style="flex: 1; min-width: 20px;"></div>
      <button id="btn-export-excel" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">⬇️</span> Exportar a Excel
      </button>
    </div>

    <div class="report-metrics">
      <div class="report-metric">
        <div class="report-metric-value text-green" id="metric-income">Cargando...</div>
        <div class="report-metric-label">Ingreso Total</div>
      </div>
      <div class="report-metric">
        <div class="report-metric-value" id="metric-payments">...</div>
        <div class="report-metric-label">Pagos Procesados</div>
      </div>
      <div class="report-metric">
        <div class="report-metric-value" id="metric-new">...</div>
        <div class="report-metric-label">Nuevos Miembros</div>
      </div>
      <div class="report-metric">
        <div class="report-metric-value text-purple" id="metric-renews">...</div>
        <div class="report-metric-label">Renovaciones</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><h3 class="card-title">Tendencia de Ingresos</h3></div>
        <div class="card-body">
          <div class="chart-container">
            <canvas id="trendChart"></canvas>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header"><h3 class="card-title">Métodos de Pago</h3></div>
        <div class="card-body">
          <div class="chart-container">
            <canvas id="methodChart"></canvas>
          </div>
        </div>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: var(--space-xl);">
      <div class="card-header"><h3 class="card-title">Pago Móvil vs Efectivo (Ingresos)</h3></div>
      <div class="card-body">
        <div class="chart-container" style="height: 200px;">
          <canvas id="compareChart"></canvas>
        </div>
      </div>
    </div>
  `;

  Chart.defaults.color = 'hsl(228, 12%, 55%)';
  Chart.defaults.borderColor = 'hsla(228, 15%, 30%, 0.4)';
  Chart.defaults.font.family = "'Inter', sans-serif";

  const startInput = document.getElementById('report-start');
  const endInput = document.getElementById('report-end');

  async function loadData() {
    const start = startInput.value;
    const end = endInput.value;
    
    if (!start || !end) return;
    
    try {
      const [analytics, paymentsList] = await Promise.all([
        getCustomAnalytics(start, end),
        getPaymentsByDateRange(start, end)
      ]);
      currentPaymentsList = paymentsList;
      
      // Update Metrics
      document.getElementById('metric-income').textContent = formatAmount(analytics.totalBs, analytics.totalUsd);
      document.getElementById('metric-payments').textContent = analytics.totalPayments;
      document.getElementById('metric-new').textContent = analytics.newMembers;
      document.getElementById('metric-renews').textContent = analytics.renewals;
      
      // Prepare data for Trend chart (daily aggregation)
      const dailyIncome = {};
      paymentsList.forEach(p => {
        const d = p.fechaPago.split('T')[0];
        if (!dailyIncome[d]) dailyIncome[d] = 0;
        dailyIncome[d] += p.montoBs;
      });
      
      // Fill gaps in dates
      const currDate = new Date(start);
      const targetDate = new Date(end);
      const labels = [];
      const trendData = [];
      
      while (currDate <= targetDate) {
        const dStr = currDate.toISOString().split('T')[0];
        labels.push(formatDateShort(dStr));
        trendData.push(dailyIncome[dStr] || 0);
        currDate.setDate(currDate.getDate() + 1);
      }
      
      // Render Trend Chart
      const trendCtx = document.getElementById('trendChart');
      if (trendChartInstance) trendChartInstance.destroy();
      
      trendChartInstance = new Chart(trendCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Ingresos (Bs)',
            data: trendData,
            borderColor: 'hsl(157, 78%, 48%)',
            backgroundColor: 'hsla(157, 78%, 48%, 0.1)',
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: trendData.length > 30 ? 0 : 3,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { callback: v => 'Bs ' + v } }
          }
        }
      });
      
      // Render Method Chart (Count)
      const methodCtx = document.getElementById('methodChart');
      if (methodChartInstance) methodChartInstance.destroy();
      
      const pMovilCount = analytics.byMethod.pagoMovil.count;
      const efectivoCount = analytics.byMethod.efectivo.count;
      
      methodChartInstance = new Chart(methodCtx, {
        type: 'doughnut',
        data: {
          labels: ['Pago Móvil', 'Efectivo'],
          datasets: [{
            data: [pMovilCount, efectivoCount],
            backgroundColor: ['hsl(157, 78%, 48%)', 'hsl(262, 68%, 62%)'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: { legend: { position: 'bottom' } }
        }
      });
      
      // Render Compare Chart (Income Bs)
      const compareCtx = document.getElementById('compareChart');
      if (compareChartInstance) compareChartInstance.destroy();
      
      compareChartInstance = new Chart(compareCtx, {
        type: 'bar',
        data: {
          labels: ['Pago Móvil vs Efectivo'],
          datasets: [
            {
              label: 'Pago Móvil',
              data: [analytics.byMethod.pagoMovil.total],
              backgroundColor: 'hsl(157, 78%, 48%)',
              borderRadius: 4
            },
            {
              label: 'Efectivo',
              data: [analytics.byMethod.efectivo.total],
              backgroundColor: 'hsl(262, 68%, 62%)',
              borderRadius: 4
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } },
          scales: {
            x: { beginAtZero: true, ticks: { callback: v => 'Bs ' + v } }
          }
        }
      });
      
    } catch (e) {
      console.error('Error loading reports', e);
    }
  }

  // Initial load
  await loadData();

  // Event Listeners
  document.getElementById('btn-apply-dates').addEventListener('click', loadData);
  document.getElementById('btn-export-excel').addEventListener('click', () => {
    exportPaymentsToCSV(currentPaymentsList);
  });
  
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const preset = e.target.dataset.preset;
      const d = new Date();
      if (preset === 'month') {
        startInput.value = getFirstDayOfMonth();
        endInput.value = todayISO();
      } else if (preset === 'last-month') {
        const { start, end } = getLastMonthRange();
        startInput.value = start;
        endInput.value = end;
      } else if (preset === '3-months') {
        startInput.value = getDateDaysAgo(90);
        endInput.value = todayISO();
      } else if (preset === 'year') {
        d.setMonth(0, 1);
        startInput.value = d.toISOString().split('T')[0];
        endInput.value = todayISO();
      }
      loadData();
    });
  });
}
