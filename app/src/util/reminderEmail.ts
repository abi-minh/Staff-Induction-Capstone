import type { ReminderContext } from '../api/staff';

// The reminder email is drafted here rather than in PHP so an admin can read
// and edit it before anything is sent. The server only supplies the facts
// (name, outstanding modules, portal URL) and mails back whatever the admin
// approved, so this file is the whole template.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function defaultReminderSubject(context: ReminderContext): string {
  const kind = context.overdueCount > 0 ? 'Overdue training reminder' : 'Training reminder';
  return context.siteName ? `[${context.siteName}] ${kind}` : kind;
}

// Plain HTML, not a full email layout: the rich-text editor in the compose
// dialog round-trips these tags faithfully, and anything fancier (tables,
// inline style attributes) would be stripped either by the editor or by
// wp_kses_post() on the way back in.
export function defaultReminderBody(context: ReminderContext): string {
  const { modules, name, portalUrl, siteName } = context;

  const items = modules
    .map((module) => {
      const title = escapeHtml(module.title);
      if (!module.dueLabel) return `<li>${title}</li>`;
      return module.isOverdue
        ? `<li>${title} — <strong>overdue since ${escapeHtml(module.dueLabel)}</strong></li>`
        : `<li>${title} — due ${escapeHtml(module.dueLabel)}</li>`;
    })
    .join('');

  const body = modules.length
    ? `<p>You have ${modules.length} outstanding training ${
        modules.length === 1 ? 'module' : 'modules'
      } to complete:</p><ul>${items}</ul>`
    : '<p>This is a reminder to keep on top of your induction training.</p>';

  return [
    `<p>Hi ${escapeHtml(name)},</p>`,
    body,
    `<p><a href="${escapeHtml(portalUrl)}">Open the staff portal</a> to pick up where you left off.</p>`,
    `<p>— ${escapeHtml(siteName)}</p>`,
  ].join('');
}

// ─── Bulk ───────────────────────────────────────────────────────────────────

// One template, many recipients. The admin edits this once; each recipient's
// copy is rendered from it here in the browser, so the wording still lives in
// this file and the server still composes nothing.
export const REMINDER_TOKENS = {
  name: '{{name}}',
  modules: '{{modules}}',
  moduleCount: '{{module_count}}',
  portalLink: '{{portal_link}}',
  siteName: '{{site_name}}',
} as const;

export function defaultBulkSubject(siteName: string): string {
  return siteName ? `[${siteName}] Training reminder` : 'Training reminder';
}

export function defaultBulkBody(): string {
  return [
    `<p>Hi ${REMINDER_TOKENS.name},</p>`,
    `<p>You have ${REMINDER_TOKENS.moduleCount} outstanding training to complete:</p>`,
    `<p>${REMINDER_TOKENS.modules}</p>`,
    `<p>${REMINDER_TOKENS.portalLink} to pick up where you left off.</p>`,
    `<p>— ${REMINDER_TOKENS.siteName}</p>`,
  ].join('');
}

// The module list as an HTML list, or a plain sentence when there's nothing
// outstanding — so a template written for the common case still reads correctly
// for someone who happens to be up to date.
function moduleListHtml(context: ReminderContext): string {
  if (!context.modules.length) return 'nothing outstanding right now';

  const items = context.modules
    .map((module) => {
      const title = escapeHtml(module.title);
      if (!module.dueLabel) return `<li>${title}</li>`;
      return module.isOverdue
        ? `<li>${title} — <strong>overdue since ${escapeHtml(module.dueLabel)}</strong></li>`
        : `<li>${title} — due ${escapeHtml(module.dueLabel)}</li>`;
    })
    .join('');

  return `<ul>${items}</ul>`;
}

// Substitutes every token for this recipient. Tokens the admin deleted are
// simply absent; unknown text is left alone.
export function renderReminder(template: string, context: ReminderContext): string {
  const count = context.modules.length;
  const replacements: [string, string][] = [
    [REMINDER_TOKENS.name, escapeHtml(context.name)],
    [REMINDER_TOKENS.modules, moduleListHtml(context)],
    [REMINDER_TOKENS.moduleCount, `${count} ${count === 1 ? 'module' : 'modules'}`],
    [
      REMINDER_TOKENS.portalLink,
      `<a href="${escapeHtml(context.portalUrl)}">Open the staff portal</a>`,
    ],
    [REMINDER_TOKENS.siteName, escapeHtml(context.siteName)],
  ];

  return replacements.reduce(
    (html, [token, value]) => html.split(token).join(value),
    template,
  );
}
