/**
 * Turn a character reference back into the character it stands for.
 *
 * WordPress runs titles and excerpts through wptexturize, so a typed
 * apostrophe comes back from the REST API as `&#8217;` and a dash as
 * `&#8211;`. That is correct HTML, and correct right up until the value is
 * rendered as text rather than as markup — at which point a heading reads
 * "do&#8217;s and don&#8217;ts".
 *
 * Parsed rather than pattern-matched, so every named entity is covered rather
 * than the four or five anyone thinks to list. DOMParser documents are inert:
 * no script runs and no resource is fetched, unlike the innerHTML trick this
 * would otherwise be written as.
 */
export function decodeEntities(text: string): string {
  if (!text.includes('&') || typeof DOMParser === 'undefined') return text;
  const parsed = new DOMParser().parseFromString(text, 'text/html');
  return parsed.documentElement.textContent ?? text;
}

/**
 * Rendered HTML as plain text, for anywhere the value is shown as words
 * rather than markup.
 *
 * Tags become a space rather than nothing, so `<p>one</p><p>two</p>` does not
 * read as "onetwo"; entities are decoded after that, so what is left is the
 * text a person actually wrote.
 */
export function stripHtml(html: string): string {
  const withoutTags = html.replace(/<[^>]+>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
