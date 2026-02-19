const charts = { line: null, pie: null, bar: null };
let lastSignature = '';

function makeSignature(monthly, client, theme) {
  return JSON.stringify({ monthly, client, theme });
}

function axisColor() {
  return getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();
}

export function updateCharts(monthly, client) {
  const theme = document.body.getAttribute('data-theme') || 'dark';
  const signature = makeSignature(monthly, client, theme);
  if (signature === lastSignature) return;
  lastSignature = signature;

  const lineLabels = monthly.map((item) => item.label);
  const lineValues = monthly.map((item) => item.total);
  const pieLabels = client.map((item) => item.name);
  const pieValues = client.map((item) => item.total);

  if (charts.line) charts.line.destroy();
  if (charts.pie) charts.pie.destroy();
  if (charts.bar) charts.bar.destroy();

  const textColor = axisColor();
  const gridColor = theme === 'dark' ? 'rgba(148,163,184,0.22)' : 'rgba(100,116,139,0.2)';

  charts.line = new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: lineLabels,
      datasets: [{
        label: 'Faturamento',
        data: lineValues,
        borderColor: theme === 'dark' ? '#67e8f9' : '#0284c7',
        backgroundColor: theme === 'dark' ? 'rgba(103,232,249,0.2)' : 'rgba(2,132,199,0.16)',
        tension: 0.35,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });

  charts.pie = new Chart(document.getElementById('pieChart'), {
    type: 'doughnut',
    data: {
      labels: pieLabels,
      datasets: [{ data: pieValues, backgroundColor: ['#22c55e', '#38bdf8', '#f59e0b', '#3b82f6', '#ef4444', '#14b8a6', '#84cc16', '#f43f5e'] }]
    },
    options: { responsive: true, plugins: { legend: { labels: { color: textColor } } } }
  });

  charts.bar = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: lineLabels,
      datasets: [{ label: 'Total mensal', data: lineValues, backgroundColor: theme === 'dark' ? 'rgba(34,197,94,0.45)' : 'rgba(22,163,74,0.5)' }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
    }
  });
}
