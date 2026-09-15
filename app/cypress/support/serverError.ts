/// <reference types="cypress" />

// Turns whatever a failing endpoint returned into one readable line for an
// assertion message.
//
// REST failures normally arrive as JSON ({code, message, data}). A PHP fatal
// does not: WordPress's fatal handler renders an HTML page titled
// "WordPress › Error", and the useful sentence sits inside
// <div class="wp-die-message"> after ~2KB of inline CSS. Slicing the raw body
// therefore shows nothing but stylesheet, which is exactly what happened when
// the export endpoint started returning 500.

export function serverMessage(body: unknown, limit = 400): string {
  if (body && typeof body === 'object') {
    const { code, message } = body as { code?: string; message?: string };
    if (code || message) return `${code ?? 'error'}: ${message ?? ''}`.slice(0, limit);
    return JSON.stringify(body).slice(0, limit);
  }

  const html = String(body ?? '');
  const match =
    html.match(/<div[^>]*class=["'][^"']*wp-die-message[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) ??
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

  const text = (match?.[1] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsaquo;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  return (text || '(empty response body)').slice(0, limit);
}
