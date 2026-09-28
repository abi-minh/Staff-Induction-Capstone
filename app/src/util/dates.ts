const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a due date for display.
 *
 * The API hands back MySQL DATETIME ("2026-06-27 09:00:00"), which is not a
 * format `new Date()` is required to parse — Safari historically returned
 * Invalid Date for it — so the date part is picked apart directly rather than
 * trusting the constructor.
 *
 * Rendered as "27 Jun 2026" rather than a numeric date on purpose: this is an
 * Australian client whose staff read 06/07 as July, while the same string means
 * June to anyone used to US ordering. A spelled month cannot be misread, and a
 * due date is exactly the wrong thing to be ambiguous about.
 *
 * Returns '' for null, empty, or unparseable input, which callers treat as
 * "no due date" — a module with no deadline is normal, not an error.
 */
export function formatDueDate(value: string | null | undefined): string {
  if (!value) return '';

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return '';

  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  if (monthIndex < 0 || monthIndex > 11) return '';

  const dayNumber = Number(day);
  if (dayNumber < 1 || dayNumber > 31) return '';

  return `${dayNumber} ${MONTHS[monthIndex]} ${year}`;
}
