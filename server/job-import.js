import crypto from 'node:crypto';

const text = (value) => String(value ?? '').trim();
const pick = (record, names) => {
  for (const name of names) if (record?.[name] !== undefined && text(record[name])) return text(record[name]);
  return '';
};

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  row.push(field);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

function recordsFromCsv(source) {
  const rows = parseCsvRows(source);
  if (rows.length < 2) return [];
  const headers = rows[0].map((item) => item.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ''])));
}

function decodeXml(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function recordsFromXml(source) {
  const blocks = [...source.matchAll(/<(job|position|posting|vacancy)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
  return blocks.map((block) => {
    const record = {};
    for (const match of block.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
      record[match[1].toLowerCase().replace(/-/g, '_')] = decodeXml(match[2]).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return record;
  });
}

function recordsFromJson(source) {
  const parsed = JSON.parse(source);
  if (Array.isArray(parsed)) return parsed;
  for (const key of ['jobs', 'postings', 'positions', 'vacancies', 'results', 'content']) {
    if (Array.isArray(parsed?.[key])) return parsed[key];
  }
  return parsed && typeof parsed === 'object' ? [parsed] : [];
}

function normalizeRecord(record, index, sourceSystem) {
  const title = pick(record, ['title', 'name', 'job_title', 'position', 'position_title']);
  const description = pick(record, ['description', 'job_description', 'content', 'body', 'summary']);
  const location = pick(record, ['location', 'job_location', 'city']);
  const url = pick(record, ['url', 'job_url', 'apply_url', 'external_url', 'link']);
  const sourceJobId = pick(record, ['id', 'job_id', 'requisition_id', 'reference', 'ref', 'shortcode']) || `${sourceSystem}-${index + 1}-${title}`;
  const updatedAt = pick(record, ['updated_at', 'modified_at', 'date_modified', 'last_updated']);
  const rawText = [
    title,
    location && `Location: ${location}`,
    pick(record, ['employment_type', 'type']) && `Employment type: ${pick(record, ['employment_type', 'type'])}`,
    pick(record, ['work_mode', 'workplace_type']) && `Work mode: ${pick(record, ['work_mode', 'workplace_type'])}`,
    pick(record, ['salary', 'compensation']) && `Salary: ${pick(record, ['salary', 'compensation'])}`,
    description,
  ].filter(Boolean).join('\n');
  if (!title || rawText.length < 10) return null;
  return { title, description, location, url, sourceJobId, sourceUpdatedAt: updatedAt, rawText: rawText.slice(0, 20000) };
}

export function parseJobImportFile(source, filename, sourceSystem = 'file') {
  const extension = String(filename || '').toLowerCase().split('.').pop();
  let records;
  if (extension === 'csv') records = recordsFromCsv(source);
  else if (extension === 'xml') records = recordsFromXml(source);
  else if (extension === 'json') records = recordsFromJson(source);
  else throw new Error('Upload a CSV, XML, or JSON job feed');
  return records.map((record, index) => normalizeRecord(record, index, sourceSystem)).filter(Boolean).slice(0, 100);
}

export function normalizeLinkedInImports(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw new Error('Add between 1 and 20 LinkedIn jobs');
  return items.map((item, index) => {
    const url = text(item?.url);
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { throw new Error(`LinkedIn job ${index + 1} needs a valid URL`); }
    if (!/(^|\.)linkedin\.com$/i.test(parsedUrl.hostname) || !/\/jobs\/view\//i.test(parsedUrl.pathname)) {
      throw new Error(`LinkedIn job ${index + 1} must use a linkedin.com/jobs/view/ URL`);
    }
    const rawText = text(item?.description);
    if (rawText.length < 40) throw new Error(`Paste the description for LinkedIn job ${index + 1}`);
    const title = text(item?.title) || rawText.split('\n').map((line) => line.trim()).find(Boolean) || `LinkedIn job ${index + 1}`;
    return {
      title: title.slice(0, 140),
      url: parsedUrl.href,
      sourceJobId: parsedUrl.pathname.split('/').filter(Boolean).pop() || parsedUrl.href,
      rawText: `${title}\n${rawText}`.slice(0, 20000),
    };
  });
}

export function importMetadata(sourceSystem, entry) {
  return {
    sourceSystem,
    sourceJobId: entry.sourceJobId,
    sourceUrl: entry.url || undefined,
    sourceUpdatedAt: entry.sourceUpdatedAt || undefined,
    contentHash: crypto.createHash('sha256').update(entry.rawText).digest('hex'),
    syncStatus: 'imported',
    lastImportedAt: Date.now(),
  };
}
