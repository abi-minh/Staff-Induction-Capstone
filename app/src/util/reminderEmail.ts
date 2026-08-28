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
