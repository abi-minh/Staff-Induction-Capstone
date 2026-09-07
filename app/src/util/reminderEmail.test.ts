import { describe, it, expect } from 'vitest';
import {
  REMINDER_TOKENS,
  defaultBulkBody,
  defaultBulkSubject,
  defaultReminderBody,
  defaultReminderSubject,
  renderReminder,
} from './reminderEmail';
import type { ReminderContext } from '../api/staff';

function context(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    userId: 7,
    name: 'Sam Williams',
    email: 'sam@example.com',
    siteName: '2 Bent Rods',
    portalUrl: 'https://example.com/portal/',
    overdueCount: 0,
    modules: [
      { moduleId: 1, title: 'Beach First Aid', dueDate: '2026-09-01 09:00:00', dueLabel: '1 September 2026', isOverdue: false },
    ],
    ...overrides,
  };
}

describe('defaultReminderSubject', () => {
  it('marks the subject overdue only when something is overdue', () => {
    expect(defaultReminderSubject(context())).toBe('[2 Bent Rods] Training reminder');
    expect(defaultReminderSubject(context({ overdueCount: 2 })))
      .toBe('[2 Bent Rods] Overdue training reminder');
  });

  it('drops the bracketed prefix when the site has no name', () => {
    expect(defaultReminderSubject(context({ siteName: '' }))).toBe('Training reminder');
  });
});

describe('defaultReminderBody', () => {
  it('lists each outstanding module with its due date', () => {
    const html = defaultReminderBody(context());
    expect(html).toContain('Beach First Aid');
    expect(html).toContain('due 1 September 2026');
  });

  it('marks overdue modules distinctly from merely due ones', () => {
    const html = defaultReminderBody(context({
      modules: [
        { moduleId: 1, title: 'Late One', dueDate: '2026-01-01 09:00:00', dueLabel: '1 January 2026', isOverdue: true },
      ],
    }));
    expect(html).toContain('<strong>overdue since 1 January 2026</strong>');
  });

  it('still reads correctly when nothing is outstanding', () => {
    const html = defaultReminderBody(context({ modules: [] }));
    expect(html).not.toContain('<ul>');
    expect(html).toContain('keep on top of your induction training');
  });

  it('escapes HTML in names and module titles', () => {
    const html = defaultReminderBody(context({
      name: 'Ben & "Bob" <script>',
      modules: [
        { moduleId: 1, title: '<img src=x onerror=alert(1)>', dueDate: '', dueLabel: '', isOverdue: false },
      ],
    }));
    expect(html).toContain('Ben &amp; &quot;Bob&quot; &lt;script&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });
});

describe('renderReminder', () => {
  it('substitutes every token for the recipient', () => {
    const html = renderReminder(defaultBulkBody(), context());
    Object.values(REMINDER_TOKENS).forEach((token) => {
      expect(html).not.toContain(token);
    });
    expect(html).toContain('Sam Williams');
    expect(html).toContain('Beach First Aid');
    expect(html).toContain('href="https://example.com/portal/"');
    expect(html).toContain('2 Bent Rods');
  });

  it('pluralises the module count', () => {
    const one = renderReminder(`x ${REMINDER_TOKENS.moduleCount}`, context());
    expect(one).toBe('x 1 module');

    const two = renderReminder(`x ${REMINDER_TOKENS.moduleCount}`, context({
      modules: [
        { moduleId: 1, title: 'A', dueDate: '', dueLabel: '', isOverdue: false },
        { moduleId: 2, title: 'B', dueDate: '', dueLabel: '', isOverdue: false },
      ],
    }));
    expect(two).toBe('x 2 modules');
  });

  it('renders a sentence, not an empty list, for someone up to date', () => {
    const html = renderReminder(`<p>${REMINDER_TOKENS.modules}</p>`, context({ modules: [] }));
    expect(html).toBe('<p>nothing outstanding right now</p>');
  });

  it('substitutes a token used more than once', () => {
    const html = renderReminder(`${REMINDER_TOKENS.name} and ${REMINDER_TOKENS.name}`, context());
    expect(html).toBe('Sam Williams and Sam Williams');
  });

  it('leaves a template alone when the admin deleted the tokens', () => {
    const html = renderReminder('<p>Please finish your training.</p>', context());
    expect(html).toBe('<p>Please finish your training.</p>');
  });

  it('escapes the recipient name it substitutes', () => {
    const html = renderReminder(REMINDER_TOKENS.name, context({ name: '<b>Sam</b>' }));
    expect(html).toBe('&lt;b&gt;Sam&lt;/b&gt;');
  });
});

describe('defaultBulkSubject', () => {
  it('uses the site name when there is one', () => {
    expect(defaultBulkSubject('2 Bent Rods')).toBe('[2 Bent Rods] Training reminder');
    expect(defaultBulkSubject('')).toBe('Training reminder');
  });
});
