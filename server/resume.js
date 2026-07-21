/**
 * Resume pipeline: DOCX→PDF conversion (LibreOffice when available, mammoth
 * HTML fallback otherwise), text extraction (pdfjs / mammoth), anonymization,
 * and page-1 thumbnails (pdftoppm when available; otherwise the uploader's
 * browser renders one with pdf.js and posts it back).
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';

const run = promisify(execFile);

async function commandExists(command) {
  try { await run(process.platform === 'win32' ? 'where' : 'which', [command]); return true; }
  catch { return false; }
}

let toolsPromise;
/** Detect external converters once per process. */
export function detectTools() {
  toolsPromise ||= (async () => ({
    soffice: await commandExists('soffice'),
    pdftoppm: await commandExists('pdftoppm'),
  }))();
  return toolsPromise;
}

/** DOCX → PDF via LibreOffice headless. Returns the PDF path, or null if unavailable/failed. */
export async function convertDocxToPdf(docxPath, outDir) {
  const tools = await detectTools();
  if (!tools.soffice) return null;
  try {
    await run('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', outDir, docxPath], { timeout: 60000 });
    const pdfPath = path.join(outDir, `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
    await fs.promises.access(pdfPath);
    return pdfPath;
  } catch { return null; }
}

/** DOCX → sanitized-ish HTML string via mammoth (fallback viewer). */
export async function docxToHtml(docxPath) {
  const { value } = await mammoth.convertToHtml({ path: docxPath });
  return value;
}

/** PDF page-1 → PNG via pdftoppm. Returns PNG path or null. */
export async function pdfThumbnail(pdfPath, outPathNoExt) {
  const tools = await detectTools();
  if (!tools.pdftoppm) return null;
  try {
    await run('pdftoppm', ['-png', '-singlefile', '-f', '1', '-scale-to', '480', pdfPath, outPathNoExt], { timeout: 30000 });
    const pngPath = `${outPathNoExt}.png`;
    await fs.promises.access(pngPath);
    return pngPath;
  } catch { return null; }
}

/** Extract plain text from a PDF using pdfjs (no native deps). */
export async function extractPdfText(pdfPath) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await fs.promises.readFile(pdfPath));
  const loadingTask = getDocument({ data, useSystemFonts: true });
  const document_ = await loadingTask.promise;
  const parts = [];
  for (let pageNumber = 1; pageNumber <= Math.min(document_.numPages, 10); pageNumber += 1) {
    const page = await document_.getPage(pageNumber);
    const content = await page.getTextContent();
    parts.push(content.items.map((item) => item.str).join(' '));
  }
  await loadingTask.destroy();
  return parts.join('\n\n');
}

/** Extract plain text from a DOCX via mammoth. */
export async function extractDocxText(docxPath) {
  const { value } = await mammoth.extractRawText({ path: docxPath });
  return value;
}

/**
 * Strip identifying contact details from extracted resume text: the candidate's
 * name, emails, phone numbers, and profile links. Consent-first pre-match view.
 */
export function anonymizeText(text, user = {}) {
  let output = (text || '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '█ email hidden █')
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, '█ phone hidden █')
    .replace(/(?:https?:\/\/)?(?:www\.)?(linkedin\.com|github\.com|twitter\.com|x\.com|facebook\.com)\/[^\s,;)]+/gi, '█ link hidden █');
  const nameParts = String(user.name || '').split(/\s+/).filter((part) => part.length > 1);
  for (const part of nameParts) output = output.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '█████');
  return output;
}

/**
 * Minimal single-page PDF generator (Helvetica text lines) used to give seed
 * candidates realistic resumes without external tooling.
 */
export function makeSimplePdf(lines) {
  const escape = (value) => String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = ['BT /F1 18 Tf 56 760 Td 26 TL'];
  lines.forEach((line, index) => {
    if (index === 1) content.push('/F1 11 Tf 16 TL');
    content.push(`(${escape(line)}) Tj T*`);
  });
  content.push('ET');
  const stream = content.join('\n');
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
