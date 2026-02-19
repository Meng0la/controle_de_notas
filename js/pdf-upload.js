let workerConfigured = false;

function ensurePdfWorker() {
  if (workerConfigured) return;
  if (!window.pdfjsLib) throw new Error('Biblioteca PDF.js não carregada.');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  workerConfigured = true;
}

async function extractTextFromPdfFile(file) {
  ensurePdfWorker();
  const buffer = await file.arrayBuffer();
  const loadingTask = window.pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ');
    pages.push(text);
  }

  return pages.join('\n');
}

export async function extractTextFromUploadedFile(file) {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return extractTextFromPdfFile(file);
  }

  if (type.includes('text') || name.endsWith('.txt')) {
    return file.text();
  }

  throw new Error(`Formato não suportado: ${file.name}`);
}
