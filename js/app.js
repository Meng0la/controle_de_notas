import { storage } from './storage.js';
import { debounce, populateFilters, filterData, sortData, normalizeText } from './filters.js';
import { buildMonthlyData, buildClientData } from './analytics.js';
import { updateCharts } from './charts.js';
import { runAiEngine } from './ai-engine.js';
import { extractInvoiceData } from './extractor.js';
import { extractTextFromUploadedFile } from './pdf-upload.js';
import {
  showToast,
  renderSummary,
  renderGoalProgress,
  renderTable,
  bindPagination,
  renderMonthlySummary,
  renderInsights,
  updateSortVisual,
  showSkeleton
} from './ui.js';

const syncChannel = new BroadcastChannel('nf_sync_channel');

const state = {
  notasFiscais: [],
  sortConfig: { key: 'dataEmissao', direction: 'desc' },
  currentPage: 1,
  perPage: 15,
  editId: null
};

function nowDateISO() {
  return new Date().toISOString().split('T')[0];
}

function setSyncStatus(text) {
  document.getElementById('syncStatus').textContent = text;
}

function safeText(value) {
  return String(value || '').trim();
}

function parseNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function validateCpfCnpj(value) {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return true;
  if (digits.length === 11) return validateCPF(digits);
  if (digits.length === 14) return validateCNPJ(digits);
  return false;
}

function validateCPF(cpf) {
  if (!cpf || cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += parseInt(cpf[i], 10) * (10 - i);
  let check = (sum * 10) % 11;
  if (check === 10) check = 0;
  if (check !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += parseInt(cpf[i], 10) * (11 - i);
  check = (sum * 10) % 11;
  if (check === 10) check = 0;
  return check === parseInt(cpf[10], 10);
}

function validateCNPJ(cnpj) {
  if (!cnpj || cnpj.length !== 14 || /^([0-9])\1+$/.test(cnpj)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += parseInt(cnpj[i], 10) * weights1[i];
  let check = sum % 11;
  check = check < 2 ? 0 : 11 - check;
  if (check !== parseInt(cnpj[12], 10)) return false;
  sum = 0;
  for (let i = 0; i < 13; i += 1) sum += parseInt(cnpj[i], 10) * weights2[i];
  check = sum % 11;
  check = check < 2 ? 0 : 11 - check;
  return check === parseInt(cnpj[13], 10);
}

function buildFiltersFromDom() {
  return {
    selectedMonth: document.getElementById('filterMonth').value,
    selectedYear: document.getElementById('filterYear').value,
    search: normalizeText(document.getElementById('searchInput').value),
    startDate: document.getElementById('startDate').value,
    endDate: document.getElementById('endDate').value,
    minValue: parseNumber(document.getElementById('minValue').value),
    maxValue: parseNumber(document.getElementById('maxValue').value)
  };
}

async function loadData() {
  const saved = await storage.get('notasFiscais');
  state.notasFiscais = Array.isArray(saved) ? saved : [];
}

async function saveData() {
  await storage.set('notasFiscais', state.notasFiscais);
  syncChannel.postMessage({ type: 'sync', payload: state.notasFiscais });
  setSyncStatus(`Atualizado em ${new Date().toLocaleTimeString('pt-BR')}`);
}

function hasDuplicateNF(numeroNF, dataEmissao, ignoreId = null) {
  return state.notasFiscais.some((nf) =>
    nf.numeroNF === numeroNF
    && nf.dataEmissao === dataEmissao
    && (ignoreId == null || nf.id !== ignoreId)
  );
}

function render() {
  populateFilters(state.notasFiscais, document);

  const filtered = filterData(state.notasFiscais, buildFiltersFromDom());
  const sorted = sortData(filtered, state.sortConfig);

  const maxPage = Math.max(1, Math.ceil(sorted.length / state.perPage));
  if (state.currentPage > maxPage) state.currentPage = maxPage;

  const summary = renderSummary(filtered);
  const goal = renderGoalProgress(summary.totalValue);

  const monthly = buildMonthlyData(filtered);
  const client = buildClientData(filtered);
  updateCharts(monthly, client);

  const bestMonth = monthly.reduce((acc, item) => (item.total > (acc?.total || 0) ? item : acc), null);
  const baseInsights = [
    { title: 'Registros filtrados', text: `${filtered.length} NFs` },
    { title: 'Melhor mês', text: bestMonth ? bestMonth.label : 'N/A' },
    { title: 'Meta', text: goal.hitGoal ? 'Meta batida' : 'Meta em andamento' }
  ];

  renderInsights(baseInsights, 'insights');
  renderInsights(runAiEngine(filtered, monthly), 'aiInsights');

  renderTable({
    rows: sorted,
    currentPage: state.currentPage,
    perPage: state.perPage,
    onEdit: openEdit,
    onDelete: deleteNF
  });
  bindPagination((page) => {
    state.currentPage = page;
    render();
  });

  renderMonthlySummary(filtered);
  updateSortVisual(state.sortConfig);

  const badgeContainer = document.getElementById('badgeContainer');
  if (bestMonth) {
    const badge = document.createElement('span');
    badge.className = 'badge success';
    badge.textContent = `Melhor mês: ${bestMonth.label}`;
    badgeContainer.appendChild(badge);
  }
  if (goal.hitGoal) {
    const badge = document.createElement('span');
    badge.className = 'badge warning';
    badge.textContent = 'Meta batida';
    badgeContainer.appendChild(badge);
  }
}

function clearForm() {
  document.getElementById('nfForm').reset();
}

function applyExtractedToForm(fields) {
  if (fields.numeroNF) document.getElementById('numeroNF').value = fields.numeroNF;
  if (fields.dataEmissao) document.getElementById('dataEmissao').value = fields.dataEmissao;
  if (fields.cliente) document.getElementById('cliente').value = fields.cliente;
  if (fields.documento) document.getElementById('documento').value = fields.documento;
  if (fields.valor != null) document.getElementById('valor').value = String(fields.valor);
  if (fields.descricao) document.getElementById('descricao').value = fields.descricao;
}

function isValidExtractedForAutoCreate(fields) {
  const numeroNF = safeText(fields.numeroNF);
  const dataEmissao = safeText(fields.dataEmissao);
  const cliente = safeText(fields.cliente);
  const documento = safeText(fields.documento).replace(/\D/g, '');
  const valor = parseNumber(fields.valor);

  if (!numeroNF || !dataEmissao || !cliente) return false;
  if (!validateCpfCnpj(documento)) return false;
  if (valor == null || valor <= 0) return false;
  if (dataEmissao > nowDateISO()) return false;
  if (hasDuplicateNF(numeroNF, dataEmissao)) return false;
  return true;
}

async function createNF(event) {
  event.preventDefault();

  const numeroNF = safeText(document.getElementById('numeroNF').value);
  const dataEmissao = document.getElementById('dataEmissao').value;
  const cliente = safeText(document.getElementById('cliente').value);
  const documento = safeText(document.getElementById('documento').value).replace(/\D/g, '');
  const valor = parseNumber(document.getElementById('valor').value);
  const descricao = safeText(document.getElementById('descricao').value);

  if (!numeroNF || !dataEmissao || !cliente) {
    showToast('Preencha os campos obrigatórios.', 'error');
    return;
  }
  if (!validateCpfCnpj(documento)) {
    showToast('CPF/CNPJ inválido.', 'error');
    return;
  }
  if (valor == null || valor <= 0) {
    showToast('Valor deve ser maior que zero.', 'error');
    return;
  }
  if (dataEmissao > nowDateISO()) {
    showToast('Data não pode ser futura.', 'error');
    return;
  }
  if (hasDuplicateNF(numeroNF, dataEmissao)) {
    showToast('NF duplicada para a mesma data.', 'error');
    return;
  }

  state.notasFiscais.push({
    id: Date.now(),
    numeroNF,
    dataEmissao,
    cliente,
    documento,
    valor: String(valor),
    descricao
  });

  await saveData();
  clearForm();
  state.currentPage = 1;
  render();
  showToast('Nota fiscal adicionada com sucesso!', 'success');
}

function openEdit(id) {
  const nf = state.notasFiscais.find((item) => item.id === id);
  if (!nf) return;
  state.editId = id;

  document.getElementById('editNumeroNF').value = nf.numeroNF;
  document.getElementById('editDataEmissao').value = nf.dataEmissao;
  document.getElementById('editCliente').value = nf.cliente;
  document.getElementById('editDocumento').value = nf.documento || '';
  document.getElementById('editValor').value = nf.valor;
  document.getElementById('editDescricao').value = nf.descricao || '';
  document.getElementById('editModal').classList.add('active');
}

function closeEdit() {
  state.editId = null;
  document.getElementById('editModal').classList.remove('active');
}

async function submitEdit(event) {
  event.preventDefault();
  if (state.editId == null) return;

  const numeroNF = safeText(document.getElementById('editNumeroNF').value);
  const dataEmissao = document.getElementById('editDataEmissao').value;
  const cliente = safeText(document.getElementById('editCliente').value);
  const documento = safeText(document.getElementById('editDocumento').value).replace(/\D/g, '');
  const valor = parseNumber(document.getElementById('editValor').value);
  const descricao = safeText(document.getElementById('editDescricao').value);

  if (!validateCpfCnpj(documento)) {
    showToast('CPF/CNPJ inválido.', 'error');
    return;
  }
  if (valor == null || valor <= 0) {
    showToast('Valor deve ser maior que zero.', 'error');
    return;
  }
  if (dataEmissao > nowDateISO()) {
    showToast('Data não pode ser futura.', 'error');
    return;
  }
  if (hasDuplicateNF(numeroNF, dataEmissao, state.editId)) {
    showToast('NF duplicada para a mesma data.', 'error');
    return;
  }

  state.notasFiscais = state.notasFiscais.map((nf) => (nf.id === state.editId ? {
    ...nf,
    numeroNF,
    dataEmissao,
    cliente,
    documento,
    valor: String(valor),
    descricao
  } : nf));

  await saveData();
  closeEdit();
  render();
  showToast('Nota fiscal atualizada.', 'success');
}

async function deleteNF(id) {
  if (!window.confirm('Tem certeza que deseja excluir esta nota fiscal?')) return;
  state.notasFiscais = state.notasFiscais.filter((nf) => nf.id !== id);
  await saveData();
  render();
  showToast('Nota fiscal excluída com sucesso!', 'success');
}

function exportToJson() {
  if (!state.notasFiscais.length) {
    showToast('Não há dados para backup!', 'warning');
    return;
  }

  const dataStr = JSON.stringify(state.notasFiscais, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `backup_notas_fiscais_${nowDateISO()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToXlsx() {
  if (!state.notasFiscais.length) {
    showToast('Não há dados para exportar!', 'warning');
    return;
  }

  const rows = state.notasFiscais.map((nf) => ({
    NumeroNF: nf.numeroNF,
    DataEmissao: nf.dataEmissao,
    Cliente: nf.cliente,
    Documento: nf.documento || '',
    Valor: Number(nf.valor || 0),
    Comissao: Number(nf.valor || 0) * 0.01,
    Descricao: nf.descricao || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Notas');
  XLSX.writeFile(wb, `notas_fiscais_${nowDateISO()}.xlsx`);
  showToast('Planilha XLSX exportada com sucesso!', 'success');
}

function importFromJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Formato inválido');
      if (!window.confirm(`Deseja restaurar o backup?\n\nSubstituir ${state.notasFiscais.length} notas por ${imported.length} notas.`)) return;

      state.notasFiscais = imported.map((nf) => ({
        id: Number(nf.id) || Date.now() + Math.floor(Math.random() * 10000),
        numeroNF: safeText(nf.numeroNF),
        dataEmissao: safeText(nf.dataEmissao),
        cliente: safeText(nf.cliente),
        documento: safeText(nf.documento).replace(/\D/g, ''),
        valor: String(parseNumber(nf.valor) || 0),
        descricao: safeText(nf.descricao)
      }));

      await saveData();
      render();
      showToast('Backup restaurado com sucesso!', 'success');
    } catch {
      showToast('Erro ao ler backup JSON.', 'error');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

async function extractFromText() {
  const raw = document.getElementById('pdfText').value || '';
  const status = document.getElementById('extractStatus');
  if (!raw.trim()) {
    showToast('Cole o texto da nota fiscal primeiro.', 'warning');
    return;
  }

  status.textContent = 'Analisando texto do PDF...';

  const useAiExtract = document.getElementById('useAiExtract').checked;
  const aiWebhookUrl = document.getElementById('aiWebhookUrl').value.trim();

  const result = await extractInvoiceData(raw, { enableAI: useAiExtract, aiWebhookUrl });
  const { fields, missing, confidence, method, aiError } = result;

  applyExtractedToForm(fields);

  if (fields.numeroNF || fields.cliente || fields.valor != null) document.getElementById('pdfText').value = '';

  if (missing.length === 0) {
    status.textContent = `Extração concluída (${method}, confiança ${confidence}%).`;
  } else {
    status.textContent = `Extração parcial (${method}, confiança ${confidence}%). Faltou: ${missing.join(', ')}.`;
  }

  if (aiError) showToast(`IA indisponível: ${aiError}. Mantido modo local.`, 'warning');
}

async function extractFromUploadedFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;

  const status = document.getElementById('extractStatus');
  const useAiExtract = document.getElementById('useAiExtract').checked;
  const aiWebhookUrl = document.getElementById('aiWebhookUrl').value.trim();
  status.textContent = `Processando ${files.length} arquivo(s)...`;

  let added = 0;
  let pending = 0;
  let failed = 0;
  let firstPending = null;

  for (const file of files) {
    try {
      const text = await extractTextFromUploadedFile(file);
      const result = await extractInvoiceData(text, { enableAI: useAiExtract, aiWebhookUrl });
      const fields = result.fields || {};

      if (isValidExtractedForAutoCreate(fields)) {
        state.notasFiscais.push({
          id: Date.now() + Math.floor(Math.random() * 100000),
          numeroNF: safeText(fields.numeroNF),
          dataEmissao: safeText(fields.dataEmissao),
          cliente: safeText(fields.cliente),
          documento: safeText(fields.documento).replace(/\D/g, ''),
          valor: String(parseNumber(fields.valor)),
          descricao: safeText(fields.descricao || `Extraído de ${file.name}`)
        });
        added += 1;
      } else {
        pending += 1;
        if (!firstPending) firstPending = { fields, fileName: file.name, confidence: result.confidence };
      }
    } catch {
      failed += 1;
    }
  }

  if (added > 0) {
    await saveData();
    render();
  }

  if (firstPending) {
    applyExtractedToForm(firstPending.fields);
    showToast(`Revise os dados de "${firstPending.fileName}" antes de salvar.`, 'warning');
  }

  status.textContent = `Upload concluído: ${added} NF(s) adicionadas, ${pending} pendente(s), ${failed} falha(s).`;
  if (added > 0) showToast(`${added} NF(s) anexadas e cadastradas automaticamente.`, 'success');
  if (added === 0 && (pending > 0 || failed > 0)) showToast('Não foi possível cadastrar automaticamente todas as NFs.', 'warning');

  document.getElementById('pdfFileInput').value = '';
}

function toggleTheme() {
  const body = document.body;
  const isLight = body.getAttribute('data-theme') === 'light';
  const next = isLight ? 'dark' : 'light';
  body.setAttribute('data-theme', next);
  storage.set('theme', next);
  render();
}

function closeTutorial() {
  document.getElementById('tutorial').classList.remove('active');
  storage.set('hasSeenTutorial', true);
}

function toggleCompactMode() {
  document.body.classList.toggle('compact');
  storage.set('compactMode', document.body.classList.contains('compact'));
}

function bindEvents() {
  document.getElementById('nfForm').addEventListener('submit', createNF);
  document.getElementById('editForm').addEventListener('submit', submitEdit);
  document.getElementById('btnCloseEdit').addEventListener('click', closeEdit);
  document.getElementById('btnClearForm').addEventListener('click', clearForm);

  document.getElementById('btnExportJson').addEventListener('click', exportToJson);
  document.getElementById('btnExportXlsx').addEventListener('click', exportToXlsx);
  document.getElementById('btnImportJson').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importFromJson);

  document.getElementById('btnExtract').addEventListener('click', () => {
    extractFromText().catch(() => showToast('Falha ao extrair dados do texto.', 'error'));
  });
  document.getElementById('btnUploadExtract').addEventListener('click', () => {
    document.getElementById('pdfFileInput').click();
  });
  document.getElementById('pdfFileInput').addEventListener('change', (event) => {
    extractFromUploadedFiles(event.target.files).catch(() => showToast('Falha ao processar upload de NF(s).', 'error'));
  });

  const triggerRender = () => {
    state.currentPage = 1;
    render();
  };

  document.getElementById('filterMonth').addEventListener('change', triggerRender);
  document.getElementById('filterYear').addEventListener('change', triggerRender);
  document.getElementById('startDate').addEventListener('change', triggerRender);
  document.getElementById('endDate').addEventListener('change', triggerRender);
  document.getElementById('minValue').addEventListener('input', triggerRender);
  document.getElementById('maxValue').addEventListener('input', triggerRender);

  const onSearch = debounce(() => {
    state.currentPage = 1;
    render();
  }, 250);
  document.getElementById('searchInput').addEventListener('input', onSearch);

  document.getElementById('monthlyGoal').addEventListener('change', () => {
    storage.set('monthlyGoal', document.getElementById('monthlyGoal').value);
    render();
  });
  document.getElementById('useAiExtract').addEventListener('change', () => {
    storage.set('useAiExtract', document.getElementById('useAiExtract').checked);
  });
  document.getElementById('aiWebhookUrl').addEventListener('change', () => {
    storage.set('aiWebhookUrl', document.getElementById('aiWebhookUrl').value.trim());
  });

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      state.sortConfig = {
        key,
        direction: state.sortConfig.key === key && state.sortConfig.direction === 'asc' ? 'desc' : 'asc'
      };
      render();
    });
  });

  document.getElementById('btnTheme').addEventListener('click', toggleTheme);
  document.getElementById('btnCompact').addEventListener('click', toggleCompactMode);
  document.getElementById('btnCloseTutorial').addEventListener('click', closeTutorial);

  document.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement?.tagName;
    if (event.key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
      event.preventDefault();
      document.getElementById('searchInput').focus();
    }
    if (event.key.toLowerCase() === 'n' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
      document.getElementById('numeroNF').focus();
    }
    if (event.key === '?') showToast('Atalhos: / busca | N nova NF | Ctrl+Enter salvar', 'warning');
  });

  document.getElementById('nfForm').addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'Enter') {
      event.preventDefault();
      document.getElementById('nfForm').requestSubmit();
    }
  });

  syncChannel.onmessage = (event) => {
    if (event.data?.type !== 'sync') return;
    state.notasFiscais = Array.isArray(event.data.payload) ? event.data.payload : [];
    render();
    showToast('Dados sincronizados de outra aba.', 'success');
  };
}

async function boot() {
  showSkeleton(true);
  await loadData();

  const savedTheme = await storage.get('theme');
  if (savedTheme) {
    document.body.setAttribute('data-theme', savedTheme);
  } else {
    const preferLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    document.body.setAttribute('data-theme', preferLight ? 'light' : 'dark');
  }

  const compactMode = await storage.get('compactMode');
  if (compactMode) document.body.classList.add('compact');

  const goal = await storage.get('monthlyGoal');
  if (goal) document.getElementById('monthlyGoal').value = goal;
  const useAiExtract = await storage.get('useAiExtract');
  if (useAiExtract) document.getElementById('useAiExtract').checked = true;
  const aiWebhookUrl = await storage.get('aiWebhookUrl');
  if (aiWebhookUrl) document.getElementById('aiWebhookUrl').value = aiWebhookUrl;

  const tutorialSeen = await storage.get('hasSeenTutorial');
  if (!tutorialSeen) document.getElementById('tutorial').classList.add('active');

  bindEvents();
  render();
  showSkeleton(false);
}

boot();
