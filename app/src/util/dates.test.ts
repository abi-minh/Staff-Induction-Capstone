import { describe, it, expect } from 'vitest';
import { formatDueDate } from './dates';

describe('formatDueDate', () => {
  // What the API actually sends: MySQL DATETIME, not ISO 8601.
  it('formats a MySQL datetime', () => {
    expect(formatDueDate('2026-06-27 09:00:00')).to.eq('27 Jun 2026');
  });

  it('formats a bare date', () => {
    expect(formatDueDate('2026-12-31')).to.eq('31 Dec 2026');
  });

  it('formats an ISO timestamp', () => {
    expect(formatDueDate('2026-01-05T23:59:59Z')).to.eq('5 Jan 2026');
  });

  // Spelled out, never numeric: 06/07 is July to this client's staff and June
  // to a US reader, and a deadline is the wrong thing to leave ambiguous.
  it('never renders a month as a number', () => {
    expect(formatDueDate('2026-07-06')).to.eq('6 Jul 2026');
    expect(formatDueDate('2026-07-06')).to.not.contain('/');
  });

  it('drops the leading zero from the day but keeps the full year', () => {
    expect(formatDueDate('2026-03-01')).to.eq('1 Mar 2026');
  });

  it('covers the first and last months', () => {
    expect(formatDueDate('2026-01-15')).to.eq('15 Jan 2026');
    expect(formatDueDate('2026-12-15')).to.eq('15 Dec 2026');
  });

  // A module with no duration has no due date, which is normal rather than an
  // error — the caller hides the chip on an empty string.
  it('returns empty for absent values', () => {
    expect(formatDueDate(null)).to.eq('');
    expect(formatDueDate(undefined)).to.eq('');
    expect(formatDueDate('')).to.eq('');
    expect(formatDueDate('   ')).to.eq('');
  });

  it('returns empty rather than guessing at junk', () => {
    expect(formatDueDate('not a date')).to.eq('');
    expect(formatDueDate('27/06/2026'), 'a formatted date, not a stored one').to.eq('');
    expect(formatDueDate('2026-13-01'), 'month 13').to.eq('');
    expect(formatDueDate('2026-00-10'), 'month 0').to.eq('');
    expect(formatDueDate('2026-06-00'), 'day 0').to.eq('');
    expect(formatDueDate('2026-06-32'), 'day 32').to.eq('');
  });

  it('tolerates surrounding whitespace', () => {
    expect(formatDueDate('  2026-06-27 09:00:00  ')).to.eq('27 Jun 2026');
  });
});
