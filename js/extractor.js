function normalizeSpaces(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function stripDiacritics(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeForMatch(value) {
  return stripDiacritics(value)
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'");
}

function stripNonDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function toISODate(dd, mm, yyyy) {
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseBRMoney(value) {
  if (!value) return null;
  const normalized = String(value).replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function firstMatch(text, patterns, mapper = (m) => m[1]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return mapper(match);
  }
  return '';
}

function extractMoneyNearLabel(lines, labelRegex, window = 5) {
  const index = lines.findIndex((line) => labelRegex.test(line));
  if (index < 0) return null;

  const sameLine = lines[index].match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/);
  if (sameLine) return parseBRMoney(sameLine[1]);

  for (let i = index + 1; i <= Math.min(index + window, lines.length - 1); i += 1) {
    const m = lines[i].match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/);
    if (m) return parseBRMoney(m[1]);
  }

  return null;
}

function detectType(text) {
  if (/\bNFS-?e\b|DANFSe|Documento Auxiliar da NFS-e/i.test(text)) return 'NFS-e';
  if (/\bDANFE\b|Documento Auxiliar da Nota Fiscal Eletronica|CHAVE DE ACESSO/i.test(text)) return 'NF-e';
  return 'NF-e';
}

function sectionBetween(text, startPattern, endPattern, fallbackWindow = 1600) {
  const start = text.search(startPattern);
  if (start < 0) return '';
  const tail = text.slice(start);
  const endRel = tail.search(endPattern);
  if (endRel < 0) return tail.slice(0, fallbackWindow);
  return tail.slice(0, endRel);
}

function findAllMoney(text) {
  const matches = [...text.matchAll(/\b([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/g)];
  return matches
    .map((m) => parseBRMoney(m[1]))
    .filter((v) => Number.isFinite(v));
}

function extractNumeroNF(text, lines, type) {
  if (type === 'NFS-e') {
    const direct = firstMatch(text, [
      /Numero\s+da\s+NFS-?e[\s:]*([0-9]{3,})/i,
      /NFS-?e\s*(?:n|no|n\.)?[\s:]*([0-9]{3,})/i
    ]);
    if (direct) return direct;
  }

  const fromText = firstMatch(text, [
    /\bN\.?\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{3,})\b/i,
    /\bN[Ooº°]\s*[:\s]*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{3,})\b/i,
    /(?:NF-e|NFe|Nota Fiscal)[^\d]{0,25}([0-9]{3,})/i
  ], (m) => stripNonDigits(m[1]));
  if (fromText) return fromText;

  const candidateLine = lines.find((line) => /\b(?:n\.?|nf|nota)/i.test(line) && /\d{3,}/.test(line));
  if (!candidateLine) return '';
  const m = candidateLine.match(/(\d{3,})/);
  return m ? m[1] : '';
}

function extractDateISO(text) {
  const patterns = [
    /Data\s*(?:da\s*)?Emissao[\s:]*([0-3]\d)[\/\-]([01]\d)[\/\-](\d{4})/i,
    /Data\s+e\s+Hora\s+da\s+emissao[\s:]*([0-3]\d)[\/\-]([01]\d)[\/\-](\d{4})/i,
    /Data\s+e\s+Hora\s+da\s+emissao\s+da\s+NFS-e[\s:]*([0-3]\d)[\/\-]([01]\d)[\/\-](\d{4})/i,
    /Competencia[\s:]*([0-3]\d)[\/\-]([01]\d)[\/\-](\d{4})/i,
    /Competencia\s+da\s+NFS-e[\s:]*([0-3]\d)[\/\-]([01]\d)[\/\-](\d{4})/i,
    /([0-3]\d)[\/\-]([01]\d)[\/\-](\d{4})\s+\d{2}:\d{2}/,
    /(\d{4})-(\d{2})-(\d{2})/
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    if (m[1].length === 4) return toISODate(m[3], m[2], m[1]);
    return toISODate(m[1], m[2], m[3]);
  }

  return '';
}

function extractDocumento(text, type) {
  if (type === 'NFS-e') {
    const tomadorBlock = sectionBetween(
      text,
      /TOMADOR DO SERVICO/i,
      /INTERMEDIARIO DO SERVICO|SERVICO PRESTADO|TRIBUTACAO MUNICIPAL/i,
      1800
    );

    const tomadorDoc = firstMatch(tomadorBlock, [
      /CNPJ\s*\/\s*CPF\s*\/\s*NIF[\s:]*([0-9\.\/-]{11,18})/i,
      /\b([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2})\b/,
      /\b([0-9]{11,14})\b/
    ], (m) => stripNonDigits(m[1]));

    if (tomadorDoc.length === 14 || tomadorDoc.length === 11) return tomadorDoc;
  }

  if (type === 'NF-e') {
    const destinatarioBlock = sectionBetween(
      text,
      /DESTINATARIO\/REMETENTE/i,
      /DADOS DOS PRODUTOS\/SERVICOS|CALCULO DO ISSQN|DADOS ADICIONAIS/i,
      2800
    );
    const recipientDoc = firstMatch(destinatarioBlock, [
      /\b([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2})\b/,
      /\b([0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})\b/
    ], (m) => stripNonDigits(m[1]));
    if (recipientDoc.length === 14 || recipientDoc.length === 11) return recipientDoc;
  }

  const cnpj = firstMatch(text, [
    /CNPJ\s*[:\-]?\s*([0-9\.\/-]{14,18})/i,
    /CNPJ\/CPF\s*[:\-]?\s*([0-9\.\/-]{11,18})/i
  ], (m) => stripNonDigits(m[1]));

  if (cnpj.length === 14 || cnpj.length === 11) return cnpj;

  const cpf = firstMatch(text, [
    /CPF\s*[:\-]?\s*([0-9\.\-]{11,14})/i
  ], (m) => stripNonDigits(m[1]));

  return cpf.length === 11 ? cpf : '';
}

function extractCliente(lines, text, type) {
  if (type === 'NFS-e') {
    const tomadorBlock = sectionBetween(
      text,
      /TOMADOR DO SERVICO/i,
      /INTERMEDIARIO DO SERVICO|SERVICO PRESTADO|TRIBUTACAO MUNICIPAL/i,
      1800
    );

    const byLabel = firstMatch(tomadorBlock, [
      /Nome\s*\/\s*Nome Empresarial\s*\n([^\n]+)/i
    ]);
    if (byLabel) return byLabel.trim();

    const linesTomador = tomadorBlock.split('\n').map((line) => line.trim()).filter(Boolean);
    const likelyName = linesTomador.find((line) =>
      line.length > 5
      && /[A-Z]/.test(line)
      && !/TOMADOR|NOME|EMPRESARIAL|ENDERECO|MUNICIPIO|CNPJ|CPF|NIF|INSCRICAO|TELEFONE|EMAIL|CEP/i.test(line)
      && !/\d{11,14}/.test(line)
    );
    if (likelyName) return likelyName;
  }

  if (type === 'NF-e') {
    const destinatarioBlock = sectionBetween(
      text,
      /DESTINATARIO\/REMETENTE/i,
      /DADOS DOS PRODUTOS\/SERVICOS|CALCULO DO ISSQN|DADOS ADICIONAIS/i,
      2800
    );

    const matchDocInLine = destinatarioBlock.match(/\n([A-Z0-9 \-&.,]{4,}?)\s+([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2})\b(?!.*Emitente)/);
    if (matchDocInLine && matchDocInLine[1]) return matchDocInLine[1].trim();

    const likelyName = destinatarioBlock
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .find((line) =>
        line.length > 5
        && /[A-Z]/.test(line)
        && !/DESTINATARIO|REMETENTE|NOME|RAZAO|MUNICIPIO|INSCRICAO|CEP|FONE|UF|CNPJ|CPF|DATA|HORA/i.test(line)
        && !/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}/.test(line)
      );
    if (likelyName) return likelyName;
  }

  const anchorPatterns = type === 'NFS-e'
    ? [/TOMADOR DO SERVICO/i, /Nome\s*\/\s*Nome Empresarial/i]
    : [/DESTINATARIO\/REMETENTE/i, /NOME\s*\/\s*RAZAO SOCIAL/i];

  const anchor1 = lines.findIndex((line) => anchorPatterns[0].test(line));
  if (anchor1 >= 0) {
    const anchor2 = lines.findIndex((line, idx) => idx > anchor1 && anchorPatterns[1].test(line));
    if (anchor2 >= 0 && lines[anchor2 + 1]) return lines[anchor2 + 1].trim();
    if (lines[anchor1 + 1]) return lines[anchor1 + 1].trim();
  }

  const fallback = firstMatch(text, [
    /Tomador[\s\S]{0,240}?Nome\s*\/\s*Nome Empresarial\s*\n([^\n]+)/i,
    /Destinatario\/Remetente[\s\S]{0,280}?Nome\s*\/\s*Razao Social\s*\n([^\n]+)/i,
    /Razao Social[\s:]*([^\n]+)/i
  ]);

  if (fallback) return fallback.trim();

  const generic = lines.find((line) =>
    line.length > 6
    && /[A-Za-z]/.test(line)
    && !/nota|valor|emissao|serie|chave|cfop|ncm|imposto|telefone/i.test(line)
  );

  return generic ? generic.slice(0, 120).trim() : '';
}

function extractValor(text, type, lines) {
  const nfsePatterns = [
    /Valor\s*Liquido\s*da\s*NFS-?e[\s:]*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
    /VALOR\s*TOTAL\s*DA\s*NFS-?E[\s:]*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
    /Valor\s*do\s*Servico[\s:]*R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i
  ];

  const nfePatterns = [
    /VALOR\s*TOTAL\s*DA\s*NOTA[\s\S]{0,120}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
    /VALOR\s*TOTAL\s*DOS\s*PRODUTOS[\s\S]{0,120}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
    /VALOR\s*TOTAL\s*DA\s*NF-e[\s\S]{0,120}?([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/i,
    /R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})/
  ];

  if (type === 'NFS-e') {
    const nearLiquido = extractMoneyNearLabel(lines, /Valor\s*Liquido\s*da\s*NFS-?e/i, 8);
    if (Number.isFinite(nearLiquido)) return nearLiquido;

    const nearTotal = extractMoneyNearLabel(lines, /VALOR\s*TOTAL\s*DA\s*NFS-?E/i, 12);
    if (Number.isFinite(nearTotal)) return nearTotal;

    const nearServico = extractMoneyNearLabel(lines, /Valor\s*do\s*Servico/i, 8);
    if (Number.isFinite(nearServico)) return nearServico;

    const totalBlock = sectionBetween(
      text,
      /VALOR TOTAL DA NFS-E/i,
      /INFORMACOES COMPLEMENTARES/i,
      1400
    );
    const values = findAllMoney(totalBlock).filter((v) => v > 0);
    if (values.length > 0) return Math.max(...values);
  }

  if (type === 'NF-e') {
    const taxBlock = sectionBetween(
      text,
      /CALCULO DE IMPOSTO/i,
      /TRANSPORTADOR\/VOLUMES|DADOS DOS PRODUTOS\/SERVICOS/i
    );
    const taxValues = findAllMoney(taxBlock);
    if (taxValues.length > 0) {
      const lastPositive = [...taxValues].reverse().find((v) => v > 0);
      if (Number.isFinite(lastPositive)) return lastPositive;
    }
  }

  const money = firstMatch(text, type === 'NFS-e' ? [...nfsePatterns, ...nfePatterns] : [...nfePatterns, ...nfsePatterns]);
  return parseBRMoney(money);
}

function extractDescricao(lines, text, type) {
  if (type === 'NFS-e') {
    const idx = lines.findIndex((line) => /Descricao do Servico/i.test(line));
    if (idx >= 0) {
      const collected = [];
      for (let i = idx + 1; i < Math.min(idx + 10, lines.length); i += 1) {
        const line = lines[i];
        if (/TRIBUTACAO MUNICIPAL|TRIBUTACAO FEDERAL|VALOR TOTAL DA NFS-E|INFORMACOES COMPLEMENTARES/i.test(line)) break;
        if (/^\-+$/.test(line)) continue;
        if (line.length < 2) continue;
        collected.push(line);
      }
      if (collected.length > 0) return collected.join(' | ').slice(0, 200);
    }
  }

  let idx = lines.findIndex((line) => /DADOS DOS PRODUTOS\/SERVICOS/i.test(line));
  if (idx >= 0 || type === 'NF-e') {
    const productBlock = sectionBetween(
      text,
      /DADOS DOS PRODUTOS\/SERVICOS/i,
      /CALCULO DO ISSQN|DADOS ADICIONAIS|INFORMACOES COMPLEMENTARES/i
    );

    const byDocLine = firstMatch(productBlock, [
      /\n\d{6,}[^\n]{0,80}([A-Z][A-Z0-9 \-\/().]{10,90})/
    ]);
    if (byDocLine && !/COD\.|NCM|CST|CFOP|VALOR|ICMS|ALIQUOTA|DESCRICAO DOS PRODUTOS/i.test(byDocLine)) {
      return byDocLine.slice(0, 160);
    }

    const inlineItem = firstMatch(productBlock, [
      /\d,\d{2}\s*([A-Z][A-Z0-9 \-\/().]{8,80})\s+\d{1,2},\d{2}/,
      /\b([A-Z]{3,}(?:\s+[A-Z0-9\-\/().]{2,}){1,8})\b/
    ]);
    if (inlineItem && !/COD\.|NCM|CST|CFOP|VALOR|ICMS|ALIQUOTA/i.test(inlineItem)) {
      return inlineItem.slice(0, 160);
    }

    const candidate = lines.slice(idx + 1, idx + 12).find((line) =>
      line.length > 10 && !/COD\.|NCM|CST|CFOP|QUANT|V\. UNIT|ICMS/i.test(line)
    );
    if (candidate) return candidate.slice(0, 160);
  }

  idx = lines.findIndex((line) => /NATUREZA DA OPERACAO/i.test(line));
  if (idx >= 0 && lines[idx + 1]) return lines[idx + 1].slice(0, 160);

  const fromText = firstMatch(text, [/Discriminacao\s+dos\s+Servicos[\s\S]{0,200}?\n([^\n]+)/i]);
  return fromText ? fromText.slice(0, 160) : '';
}

function buildHeuristicResult(raw) {
  const cleaned = normalizeSpaces(raw);
  const normalized = normalizeForMatch(cleaned);
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const text = lines.join('\n');
  const type = detectType(text);

  const numeroNF = extractNumeroNF(text, lines, type);
  const dataEmissao = extractDateISO(text);
  const cliente = extractCliente(lines, text, type);
  const documento = extractDocumento(text, type);
  const valor = extractValor(text, type, lines);
  const descricaoExtraida = extractDescricao(lines, text, type);
  const descricao = [type, descricaoExtraida].filter(Boolean).join(' - ');

  const fields = {
    tipo: type,
    numeroNF,
    dataEmissao,
    cliente,
    documento,
    valor: Number.isFinite(valor) ? valor : null,
    descricao
  };

  const required = ['numeroNF', 'dataEmissao', 'cliente', 'valor'];
  const foundRequired = required.filter((key) => fields[key] !== '' && fields[key] != null).length;
  const confidence = Math.round((foundRequired / required.length) * 100);
  const missing = required.filter((key) => fields[key] === '' || fields[key] == null);

  return {
    method: 'heuristic',
    confidence,
    missing,
    fields,
    debug: {
      lineCount: lines.length,
      type
    }
  };
}

function extractJsonFromText(value) {
  const txt = String(value || '').trim();
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(txt.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeRemoteFields(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const valor = data.valor == null ? null : (typeof data.valor === 'number' ? data.valor : parseBRMoney(String(data.valor)));

  return {
    numeroNF: stripNonDigits(data.numeroNF || '').slice(0, 20),
    dataEmissao: String(data.dataEmissao || '').trim(),
    cliente: String(data.cliente || '').trim().slice(0, 120),
    documento: stripNonDigits(data.documento || '').slice(0, 14),
    valor: Number.isFinite(valor) ? valor : null,
    descricao: String(data.descricao || '').trim().slice(0, 200)
  };
}

function mergeFields(baseFields, aiFields) {
  const merged = { ...baseFields };
  ['numeroNF', 'dataEmissao', 'cliente', 'documento', 'valor', 'descricao'].forEach((key) => {
    const current = merged[key];
    const candidate = aiFields[key];
    const empty = current === '' || current == null;
    if (empty && candidate !== '' && candidate != null) merged[key] = candidate;
  });
  return merged;
}

async function enhanceWithAiWebhook(raw, baseResult, webhookUrl) {
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task: 'extract_invoice_fields',
      locale: 'pt-BR',
      text: raw,
      hints: baseResult.fields,
      return_schema: {
        numeroNF: 'string',
        dataEmissao: 'YYYY-MM-DD',
        cliente: 'string',
        documento: 'digits_only',
        valor: 'number',
        descricao: 'string'
      }
    })
  });

  if (!resp.ok) throw new Error(`Webhook IA retornou ${resp.status}`);

  const contentType = resp.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await resp.json()
    : extractJsonFromText(await resp.text());

  if (!payload) throw new Error('Resposta IA sem JSON válido');

  const aiFields = normalizeRemoteFields(payload.fields || payload.data || payload);
  const mergedFields = mergeFields(baseResult.fields, aiFields);

  const required = ['numeroNF', 'dataEmissao', 'cliente', 'valor'];
  const foundRequired = required.filter((key) => mergedFields[key] !== '' && mergedFields[key] != null).length;

  return {
    ...baseResult,
    method: 'heuristic+ai',
    fields: mergedFields,
    missing: required.filter((key) => mergedFields[key] === '' || mergedFields[key] == null),
    confidence: Math.max(baseResult.confidence, Math.round((foundRequired / required.length) * 100)),
    aiNote: payload.note || payload.explanation || ''
  };
}

export async function extractInvoiceData(raw, options = {}) {
  const baseResult = buildHeuristicResult(raw);
  const enableAI = Boolean(options.enableAI);
  const webhookUrl = String(options.aiWebhookUrl || '').trim();

  if (!enableAI || !webhookUrl) return baseResult;

  try {
    return await enhanceWithAiWebhook(raw, baseResult, webhookUrl);
  } catch (error) {
    return {
      ...baseResult,
      aiError: error instanceof Error ? error.message : 'Falha de IA',
      method: 'heuristic'
    };
  }
}
