import type { ModuleCompletionReport } from '../types';

// RFC 4180: a field is quoted only when it contains a comma, double-quote or
// line break, and any double-quote inside it is doubled. Without this a module
// title like "Safety, Health & Environment" splits across columns.
export function escapeCsvField(value: string | number): string {
  const raw = String(value);
  // Neutralise spreadsheet formula injection: Excel/Sheets evaluate a field that
  // opens with one of these, so a title like =HYPERLINK(...) would run on open.
  // A leading apostrophe forces the cell to plain text.
  const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number)[][]): string {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

export function buildReportCsv(reports: ModuleCompletionReport[]): string {
  const rows: (string | number)[][] = [
    ['Module', 'Assigned', 'Completed', '% Complete'],
    ...reports.map((r) => [r.moduleTitle, r.totalAssigned, r.totalCompleted, `${r.completionPct}%`]),
  ];
  return toCsv(rows);
}
