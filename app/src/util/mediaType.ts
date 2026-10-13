import type { MediaType } from '../types';

/**
 * Classify a file by its MIME type.
 *
 * Mirrors induction_media_type() in the plugin, which is what the admin media
 * list is built from. The staff portal reads attachments straight from
 * wp/v2/media and so has to do its own classifying — the two have to agree, or
 * the same file is a PDF on one screen and "other" on the next.
 */
export function mediaTypeFromMime(mime?: string): MediaType {
  if (!mime) return 'other';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

const TYPE_LABEL: Record<MediaType, string> = {
  image: 'Image',
  video: 'Video',
  pdf: 'PDF',
  other: 'File',
};

/**
 * What to call a file in front of a staff member.
 *
 * "File" is the last resort. Anything the MIME type does not name gets its
 * extension instead — a spreadsheet reads as XLSX rather than as the same
 * generic word as everything else, which is the entire point of showing a
 * type at all.
 */
export function fileTypeLabel(type: MediaType, url?: string): string {
  if (type !== 'other') return TYPE_LABEL[type];

  // Query strings and fragments are not part of the name.
  const name = (url ?? '').split(/[?#]/)[0];
  const ext = name.slice(name.lastIndexOf('.') + 1);
  const looksLikeExtension = ext.length >= 2 && ext.length <= 5 && /^[a-z0-9]+$/i.test(ext);

  return looksLikeExtension && name.includes('.') ? ext.toUpperCase() : TYPE_LABEL.other;
}
