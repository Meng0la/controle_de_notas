function monthIndex(dateString) {
  const d = new Date(dateString);
  return d.getFullYear() * 12 + d.getMonth();
}

export function runAiEngine(notasFiscais, monthlyData) {
  const insights = [];

  const last6 = monthlyData.slice(-6);
  if (last6.length >= 2) {
    const x = last6.map((_, idx) => idx + 1);
    const y = last6.map((m) => m.total);
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const denom = (n * sumX2) - (sumX * sumX);
    const slope = denom !== 0 ? ((n * sumXY) - (sumX * sumY)) / denom : 0;
    const intercept = (sumY - slope * sumX) / n;
    const forecast = Math.max(0, intercept + slope * (n + 1));
    insights.push({ title: 'Previsão de faturamento', text: `Próximo mês estimado em R$ ${forecast.toFixed(2).replace('.', ',')}` });
  }

  const monthMap = {};
  notasFiscais.forEach((nf) => {
    const key = monthIndex(nf.dataEmissao);
    if (!monthMap[key]) monthMap[key] = [];
    monthMap[key].push(parseFloat(nf.valor || 0));
  });

  const anomalies = [];
  Object.entries(monthMap).forEach(([month, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    values.forEach((v) => {
      if (avg > 0 && v > avg * 2) anomalies.push(`NF acima de 2x da média mensal detectada (mês #${month})`);
    });
  });

  const clientSeries = {};
  notasFiscais.forEach((nf) => {
    if (!clientSeries[nf.cliente]) clientSeries[nf.cliente] = {};
    const k = monthIndex(nf.dataEmissao);
    clientSeries[nf.cliente][k] = (clientSeries[nf.cliente][k] || 0) + parseFloat(nf.valor || 0);
  });

  let fastestGrowth = null;
  let recurringClient = null;
  let recurringCount = 0;

  Object.entries(clientSeries).forEach(([client, series]) => {
    const sortedKeys = Object.keys(series).map(Number).sort((a, b) => a - b);
    if (sortedKeys.length > recurringCount) {
      recurringCount = sortedKeys.length;
      recurringClient = client;
    }

    if (sortedKeys.length >= 2) {
      const prev = series[sortedKeys[sortedKeys.length - 2]];
      const curr = series[sortedKeys[sortedKeys.length - 1]];
      if (prev > 0) {
        const growth = ((curr - prev) / prev) * 100;
        if (!fastestGrowth || growth > fastestGrowth.growth) fastestGrowth = { client, growth };
        if (growth > 80) anomalies.push(`Crescimento abrupto detectado para ${client}: ${growth.toFixed(1)}%`);
      }
    }
  });

  if (anomalies.length > 0) insights.push({ title: 'Anomalias', text: anomalies.slice(0, 3).join(' | ') });
  if (fastestGrowth) insights.push({ title: 'Cliente que mais cresce', text: `${fastestGrowth.client} (${fastestGrowth.growth.toFixed(1)}%)` });
  if (recurringClient) insights.push({ title: 'Cliente recorrente', text: `${recurringClient} (${recurringCount} meses)` });

  const volatility = monthlyData.map((m) => m.total);
  if (volatility.length >= 2) {
    let maxVar = 0;
    let varMonth = null;
    for (let i = 1; i < volatility.length; i += 1) {
      const v = Math.abs(volatility[i] - volatility[i - 1]);
      if (v > maxVar) {
        maxVar = v;
        varMonth = monthlyData[i].label;
      }
    }
    if (varMonth) insights.push({ title: 'Mês com maior volatilidade', text: `${varMonth} (variação R$ ${maxVar.toFixed(2).replace('.', ',')})` });
  }

  const last3 = monthlyData.slice(-3);
  if (last3.length > 0) {
    const avg = last3.reduce((a, b) => a + b.total, 0) / last3.length;
    const goal = avg * 1.15;
    insights.push({ title: 'Meta sugerida', text: `R$ ${goal.toFixed(2).replace('.', ',')} (média últimos 3 meses + 15%)` });
  }

  return insights;
}
