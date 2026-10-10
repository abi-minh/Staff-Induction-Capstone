/**
 * The text sizes an author can apply to part of a text block or callout.
 *
 * Four named steps rather than a point size. A size picked on a desktop is a
 * different thing on a 375px phone, and most of this content is read on one —
 * so the steps are expressed in `em`, relative to whatever the theme has
 * already decided the surrounding text should be. Change the theme's scale and
 * these follow it.
 *
 * The chosen step is stored as a class, not as `style="font-size: 18px"`. The
 * stylesheet then owns what "large" means, so a later type change is one CSS
 * edit instead of a rewrite of every module's stored HTML — and `blocks_json`
 * stays small, which matters when every save writes a full version-history row.
 */
export const FONT_SIZES = [
  { key: 'sm', label: 'Small', em: 0.85 },
  { key: 'normal', label: 'Normal', em: 1 },
  { key: 'lg', label: 'Large', em: 1.25 },
  { key: 'xl', label: 'Extra large', em: 1.6 },
] as const;

export type FontSizeKey = (typeof FONT_SIZES)[number]['key'];

/** Normal is the absence of a mark, so it has no class of its own. */
export const DEFAULT_FONT_SIZE: FontSizeKey = 'normal';

export function fontSizeClass(key: string): string {
  return `ind-size-${key}`;
}

/**
 * Size rules to merge into the editing surface and the reader, so the two
 * cannot drift — an author must see the size they are choosing.
 */
export function fontSizeSx(): Record<string, { fontSize: string }> {
  return Object.fromEntries(
    FONT_SIZES.filter((size) => size.key !== DEFAULT_FONT_SIZE).map((size) => [
      `& .${fontSizeClass(size.key)}`,
      { fontSize: `${size.em}em` },
    ]),
  );
}
