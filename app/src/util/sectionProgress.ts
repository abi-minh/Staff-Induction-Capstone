import type { Section } from '../types';

/**
 * Which sections a staff member has ticked off, per module.
 *
 * This lives in localStorage rather than on the server, so it is per browser
 * and is lost when someone switches device. That is a real limitation, not a
 * design choice worth defending — but while it is the only record there is,
 * every surface that shows a percentage has to read the same place, or the
 * dashboard and the module view disagree about the same module.
 */
export function sectionCompletionKey(moduleId: number): string {
  return `section-completions-${moduleId}`;
}

export function readCompletedSectionIds(moduleId: number): string[] {
  try {
    const raw = localStorage.getItem(sectionCompletionKey(moduleId));
    const parsed: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    // A private window, cleared site data, or a value some other code wrote.
    return [];
  }
}

/**
 * Whether one section counts as done.
 *
 * The module-level quiz section is special: it is complete when the quiz has
 * been marked as passed, which is server-side state, not a local tick.
 */
export function isSectionComplete(
  section: Section,
  completedIds: string[],
  quizPassed: boolean | null,
): boolean {
  return section.isModuleQuiz ? quizPassed === true : completedIds.includes(section.id);
}

/**
 * How far through a module someone is, 0–100.
 *
 * A module recorded as completed reports 100 whatever the local ticks say —
 * the server's view wins, and a staff member who finished a module on another
 * device should not be told they are half way.
 */
export function moduleProgressPercent(
  sections: Section[],
  completedIds: string[],
  quizPassed: boolean | null,
  status: string,
): number {
  if (status === 'completed') return 100;
  if (sections.length === 0) return 0;

  const done = sections.filter((s) => isSectionComplete(s, completedIds, quizPassed)).length;
  return Math.round((done / sections.length) * 100);
}
