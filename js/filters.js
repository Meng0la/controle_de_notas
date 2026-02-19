export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function getMonthYear(dateString) {
  const date = new Date(dateString);
  const month = date.toLocaleString('pt-BR', { month: 'long' });
  const year = date.getFullYear();
  const monthNum = date.getMonth();
  return {
    month,
    year,
    monthNum,
    sortKey: `${year}-${String(monthNum + 1).padStart(2, '0')}`
  };
}

export function populateFilters(notasFiscais, doc) {
  const months = new Set();
  const years = new Set();

  notasFiscais.forEach((nf) => {
    const date = new Date(nf.dataEmissao);
    if (Number.isNaN(date.getTime())) return;
    const { month, year, monthNum } = getMonthYear(nf.dataEmissao);
    months.add(JSON.stringify({ month, monthNum }));
    years.add(year);
  });

  const filterMonth = doc.getElementById('filterMonth');
  const filterYear = doc.getElementById('filterYear');
  const currentMonth = filterMonth.value;
  const currentYear = filterYear.value;

  filterMonth.innerHTML = '<option value="">Todos os meses</option>';
  Array.from(months)
    .map((item) => JSON.parse(item))
    .sort((a, b) => a.monthNum - b.monthNum)
    .forEach(({ month, monthNum }) => {
      const option = doc.createElement('option');
      option.value = String(monthNum);
      option.textContent = month.charAt(0).toUpperCase() + month.slice(1);
      filterMonth.appendChild(option);
    });

  filterYear.innerHTML = '<option value="">Todos os anos</option>';
  Array.from(years)
    .sort((a, b) => b - a)
    .forEach((year) => {
      const option = doc.createElement('option');
      option.value = String(year);
      option.textContent = String(year);
      filterYear.appendChild(option);
    });

  if (currentMonth) filterMonth.value = currentMonth;
  if (currentYear) filterYear.value = currentYear;
}

export function normalizeText(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function filterData(notasFiscais, filters) {
  const {
    selectedMonth,
    selectedYear,
    search,
    startDate,
    endDate,
    minValue,
    maxValue
  } = filters;

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  return notasFiscais.filter((nf) => {
    const date = new Date(nf.dataEmissao);
    if (Number.isNaN(date.getTime())) return false;

    const monthMatch = !selectedMonth || date.getMonth() === Number(selectedMonth);
    const yearMatch = !selectedYear || date.getFullYear() === Number(selectedYear);

    const value = parseFloat(nf.valor || 0);
    const minMatch = !Number.isFinite(minValue) || value >= minValue;
    const maxMatch = !Number.isFinite(maxValue) || value <= maxValue;

    const startMatch = !start || date >= start;
    const endMatch = !end || date <= end;

    const searchMatch = !search || [nf.numeroNF, nf.cliente, nf.descricao, nf.documento]
      .some((field) => normalizeText(field).includes(search));

    return monthMatch && yearMatch && minMatch && maxMatch && startMatch && endMatch && searchMatch;
  });
}

export function sortData(data, sortConfig) {
  const { key, direction } = sortConfig;
  const factor = direction === 'asc' ? 1 : -1;

  return [...data].sort((a, b) => {
    let aValue = a[key];
    let bValue = b[key];

    if (key === 'dataEmissao') {
      aValue = new Date(aValue).getTime();
      bValue = new Date(bValue).getTime();
    } else if (key === 'valor' || key === 'comissao') {
      aValue = parseFloat(a.valor || 0);
      bValue = parseFloat(b.valor || 0);
    } else {
      aValue = normalizeText(aValue);
      bValue = normalizeText(bValue);
    }

    if (aValue > bValue) return 1 * factor;
    if (aValue < bValue) return -1 * factor;
    return 0;
  });
}
