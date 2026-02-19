import { getMonthYear } from './filters.js';

function memoizeByKey(fn) {
  let lastKey = '';
  let lastResult = null;
  return (arr) => {
    const key = JSON.stringify(arr.map((nf) => [nf.id, nf.dataEmissao, Number(nf.valor || 0), nf.cliente]));
    if (key === lastKey && lastResult) return lastResult;
    lastKey = key;
    lastResult = fn(arr);
    return lastResult;
  };
}

export const buildMonthlyData = memoizeByKey((notasFiscais) => {
  const monthlyData = {};
  notasFiscais.forEach((nf) => {
    const { sortKey } = getMonthYear(nf.dataEmissao);
    if (!monthlyData[sortKey]) monthlyData[sortKey] = 0;
    monthlyData[sortKey] += parseFloat(nf.valor || 0);
  });

  return Object.entries(monthlyData)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => {
      const [year, month] = key.split('-');
      const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('pt-BR', { month: 'short' });
      return { key, label: `${monthName}/${year}`, total };
    });
});

export const buildClientData = memoizeByKey((notasFiscais) => {
  const clientData = {};
  notasFiscais.forEach((nf) => {
    const name = nf.cliente || 'Sem cliente';
    if (!clientData[name]) clientData[name] = 0;
    clientData[name] += parseFloat(nf.valor || 0);
  });

  return Object.entries(clientData)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
});

export function calculateMonthlyProjection(notasFiscais) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const total = notasFiscais
    .filter((nf) => {
      const d = new Date(nf.dataEmissao);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, nf) => sum + parseFloat(nf.valor || 0), 0);

  const day = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  return day > 0 ? (total / day) * daysInMonth : total;
}

export function calculateGrowthIndicator(notasFiscais) {
  const monthly = buildMonthlyData(notasFiscais);
  if (monthly.length < 2) return { text: '-', trend: 'neutral' };
  const current = monthly[monthly.length - 1].total;
  const prev = monthly[monthly.length - 2].total;
  if (prev <= 0) return { text: 'Sem base', trend: 'neutral' };
  const pct = ((current - prev) / prev) * 100;
  if (pct > 0) return { text: `↑ ${pct.toFixed(1)}%`, trend: 'up' };
  if (pct < 0) return { text: `↓ ${Math.abs(pct).toFixed(1)}%`, trend: 'down' };
  return { text: '0,0%', trend: 'neutral' };
}

export function calculateSummary(notasFiscais) {
  const totalNFs = notasFiscais.length;
  const totalValue = notasFiscais.reduce((sum, nf) => sum + parseFloat(nf.valor || 0), 0);
  const totalCommission = totalValue * 0.01;
  const avgTicket = totalNFs > 0 ? totalValue / totalNFs : 0;

  return { totalNFs, totalValue, totalCommission, avgTicket };
}

export function getTopClient(notasFiscais) {
  const data = buildClientData(notasFiscais);
  return data[0] || null;
}

export function buildMonthlySummaryRows(notasFiscais) {
  const monthlyData = {};

  notasFiscais.forEach((nf) => {
    const { sortKey } = getMonthYear(nf.dataEmissao);
    if (!monthlyData[sortKey]) monthlyData[sortKey] = { count: 0, total: 0 };
    monthlyData[sortKey].count += 1;
    monthlyData[sortKey].total += parseFloat(nf.valor || 0);
  });

  return Object.entries(monthlyData)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, data]) => {
      const [year, month] = key.split('-');
      const monthName = new Date(Number(year), Number(month) - 1).toLocaleString('pt-BR', { month: 'long' });
      const prevKey = `${Number(year) - 1}-${month}`;
      const prevData = monthlyData[prevKey];
      const variance = prevData && prevData.total > 0 ? ((data.total - prevData.total) / prevData.total) * 100 : null;
      return {
        label: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`,
        count: data.count,
        total: data.total,
        commission: data.total * 0.01,
        variance
      };
    });
}
