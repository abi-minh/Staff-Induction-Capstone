import { describe, it, expect } from 'vitest';
import { escapeCsvField, toCsv, buildReportCsv } from './reportCsv';
import type { ModuleCompletionReport } from '../types';

function report(overrides: Partial<ModuleCompletionReport> = {}): ModuleCompletionReport {
  return {
    moduleId: 1,
    moduleTitle: 'Induction',
    totalAssigned: 10,
    totalCompleted: 4,
    completionPct: 40,
    staffBreakdown: [],
    ...overrides,
  };
}

describe('escapeCsvField', () => {
  it('leaves a plain value untouched', () => {
    expect(escapeCsvField('Safety')).toBe('Safety');
    expect(escapeCsvField(42)).toBe('42');
  });

  it('quotes a value that contains a comma', () => {
    expect(escapeCsvField('Safety, Health & Environment')).toBe('"Safety, Health & Environment"');
  });

  it('quotes and doubles an embedded double-quote', () => {
    expect(escapeCsvField('The "big" one')).toBe('"The ""big"" one"');
  });

  it('quotes a value that contains a line break', () => {
    expect(escapeCsvField('line one\nline two')).toBe('"line one\nline two"');
  });

  it('defuses a formula-injection prefix with a leading apostrophe', () => {
    expect(escapeCsvField('=1+2')).toBe("'=1+2");
    expect(escapeCsvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(escapeCsvField('-2+3')).toBe("'-2+3");
  });

  it('defuses and then quotes a formula that also needs escaping', () => {
    expect(escapeCsvField('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"');
  });
});

describe('toCsv', () => {
  it('joins fields with commas and rows with CRLF', () => {
    expect(toCsv([['a', 'b'], ['c', 'd']])).toBe('a,b\r\nc,d');
  });

  it('escapes every field, not just the first', () => {
    expect(toCsv([['ok', 'has,comma']])).toBe('ok,"has,comma"');
  });
});

describe('buildReportCsv', () => {
  it('emits only the header row for an empty report set', () => {
    expect(buildReportCsv([])).toBe('Module,Assigned,Completed,% Complete');
  });

  it('renders a module row with the percentage suffixed', () => {
    const csv = buildReportCsv([report({ moduleTitle: 'Fire Safety', completionPct: 75 })]);
    expect(csv).toBe(
      'Module,Assigned,Completed,% Complete\r\nFire Safety,10,4,75%',
    );
  });

  it('does not let a comma in a title corrupt the columns', () => {
    const csv = buildReportCsv([report({ moduleTitle: 'Safety, Health & Environment' })]);
    const dataRow = csv.split('\r\n')[1];
    expect(dataRow).toBe('"Safety, Health & Environment",10,4,40%');
  });
});
