import {
  calculateSummary,
  calculateMonthlyProjection,
  getTopClient,
  buildMonthlySummaryRows,
  calculateGrowthIndicator
} from './analytics.js';

export function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

export function sanitize(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

export function renderSummary(notasFiscais) {
  const { totalNFs, totalValue, totalCommission, avgTicket } = calculateSummary(notasFiscais);
  const projection = calculateMonthlyProjection(notasFiscais);
  const topClient = getTopClient(notasFiscais);
  const growth = calculateGrowthIndicator(notasFiscais);

  document.getElementById('totalNFs').textContent = String(totalNFs);
  document.getElementById('totalValue').textContent = formatCurrency(totalValue);
  document.getElementById('totalCommission').textContent = formatCurrency(totalCommission);
  document.getElementById('avgTicket').textContent = formatCurrency(avgTicket);
  document.getElementById('monthProjection').textContent = formatCurrency(projection);

  const growthEl = document.getElementById('growthIndicator');
  growthEl.textContent = growth.text;
  growthEl.classList.remove('growth-up', 'growth-down', 'growth-neutral');
  growthEl.classList.add(growth.trend === 'up' ? 'growth-up' : growth.trend === 'down' ? 'growth-down' : 'growth-neutral');

  const badgeContainer = document.getElementById('badgeContainer');
  badgeContainer.innerHTML = '';
  if (topClient) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = `Top cliente: ${topClient.name}`;
    badgeContainer.appendChild(badge);
  }

  return { totalValue };
}

export function renderGoalProgress(totalValue) {
  const goal = parseFloat(document.getElementById('monthlyGoal').value || 0);
  const progress = goal > 0 ? Math.min((totalValue / goal) * 100, 100) : 0;
  document.getElementById('goalProgress').style.width = `${progress}%`;
  const status = document.getElementById('goalStatus');
  if (goal <= 0) {
    status.textContent = 'Defina uma meta mensal para acompanhar desempenho.';
    return { hitGoal: false, bestMonth: false };
  }

  status.textContent = `Meta: ${formatCurrency(goal)} | Atual: ${formatCurrency(totalValue)} (${progress.toFixed(1)}%)`;
  return { hitGoal: totalValue >= goal };
}

function getPageItems(data, currentPage, perPage) {
  const start = (currentPage - 1) * perPage;
  return data.slice(start, start + perPage);
}

export function renderTable({
  rows,
  currentPage,
  perPage,
  onEdit,
  onDelete
}) {
  const tbody = document.getElementById('nfTableBody');

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-table">Nenhuma nota fiscal encontrada</td></tr>';
    document.getElementById('pagination').innerHTML = '';
    return;
  }

  const pageItems = getPageItems(rows, currentPage, perPage);

  tbody.innerHTML = pageItems.map((nf) => {
    const commission = parseFloat(nf.valor || 0) * 0.01;
    return `
      <tr>
        <td><strong>${sanitize(nf.numeroNF)}</strong></td>
        <td>${sanitize(formatDate(nf.dataEmissao))}</td>
        <td>${sanitize(nf.cliente)}</td>
        <td>${sanitize(nf.documento || '-')}</td>
        <td>${sanitize(formatCurrency(nf.valor))}</td>
        <td><strong>${sanitize(formatCurrency(commission))}</strong></td>
        <td>${sanitize(nf.descricao || '-')}</td>
        <td>
          <button class="btn btn-ghost" data-action="edit" data-id="${nf.id}">Editar</button>
          <button class="btn btn-danger" data-action="delete" data-id="${nf.id}">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => onEdit(Number(btn.dataset.id)));
  });
  tbody.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => onDelete(Number(btn.dataset.id)));
  });

  const totalPages = Math.ceil(rows.length / perPage);
  const pagination = document.getElementById('pagination');
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  pagination.innerHTML = Array.from({ length: totalPages }, (_, i) => i + 1)
    .map((p) => `<button class="${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`)
    .join('');
}

export function bindPagination(onChangePage) {
  const pagination = document.getElementById('pagination');
  pagination.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => onChangePage(Number(btn.dataset.page)));
  });
}

export function renderMonthlySummary(notasFiscais) {
  const rows = buildMonthlySummaryRows(notasFiscais);
  const tbody = document.getElementById('monthlySummaryBody');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-table">Nenhum dado disponível</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map((row) => {
    const varianceLabel = row.variance == null ? '-' : `${row.variance.toFixed(1)}%`;
    return `
      <tr>
        <td><strong>${sanitize(row.label)}</strong></td>
        <td>${row.count}</td>
        <td>${sanitize(formatCurrency(row.total))}</td>
        <td><strong>${sanitize(formatCurrency(row.commission))}</strong></td>
        <td>${sanitize(varianceLabel)}</td>
      </tr>
    `;
  }).join('');
}

export function renderInsights(items, mountId) {
  const mount = document.getElementById(mountId);
  if (!items.length) {
    mount.innerHTML = '<div class="insight">Sem insights suficientes no momento.</div>';
    return;
  }
  mount.innerHTML = items.map((item) => `<div class="insight"><strong>${sanitize(item.title)}:</strong> ${sanitize(item.text)}</div>`).join('');
}

export function updateSortVisual(sortConfig) {
  document.querySelectorAll('th[data-sort]').forEach((th) => {
    const isActive = th.dataset.sort === sortConfig.key;
    th.classList.toggle('active-sort', isActive);
    if (isActive) th.dataset.arrow = sortConfig.direction === 'asc' ? '↑' : '↓';
    else th.removeAttribute('data-arrow');
  });
}

export function showSkeleton(show) {
  document.getElementById('tableSkeleton').classList.toggle('hidden', !show);
}
