/**
 * Minimal CSV parser for GSC / GA4 UI exports (quoted fields, commas).
 */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) {
        rows.push(row);
      }
      row = [];
      field = "";
      if (ch === "\r") {
        i++;
      }
      continue;
    }

    if (ch !== "\r") {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

export function rowsToObjects(rows) {
  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const objects = [];

  for (let i = 1; i < rows.length; i++) {
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = rows[i][j] ?? "";
    }
    objects.push(obj);
  }

  return objects;
}

function normalizeHeader(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function pickField(row, aliases) {
  for (const key of aliases) {
    if (row[key] !== undefined && row[key] !== "") {
      return row[key];
    }
  }
  return null;
}

export function parseNumber(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const cleaned = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
