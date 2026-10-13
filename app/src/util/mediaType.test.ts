import { describe, it, expect } from 'vitest';
import { fileTypeLabel, mediaTypeFromMime } from './mediaType';

// The staff portal classifies attachments itself, because it reads them from
// wp/v2/media rather than from the plugin's media endpoint. It has to reach
// the same answer as induction_media_type() in the plugin, or the same file is
// a PDF on the admin screen and "other" on the staff one.
describe('mediaTypeFromMime', () => {
  it('matches the plugin on the three types it names', () => {
    expect(mediaTypeFromMime('image/png')).to.eq('image');
    expect(mediaTypeFromMime('image/svg+xml')).to.eq('image');
    expect(mediaTypeFromMime('video/mp4')).to.eq('video');
    expect(mediaTypeFromMime('application/pdf')).to.eq('pdf');
  });

  it('calls everything else other', () => {
    expect(mediaTypeFromMime('application/msword')).to.eq('other');
    expect(mediaTypeFromMime('text/plain')).to.eq('other');
  });

  // The attachment lookup can fail, and a missing mime must not throw on a
  // page that is only trying to draw an icon.
  it('survives a missing mime type', () => {
    expect(mediaTypeFromMime(undefined)).to.eq('other');
    expect(mediaTypeFromMime('')).to.eq('other');
  });
});

describe('fileTypeLabel', () => {
  it('names the types it knows', () => {
    expect(fileTypeLabel('pdf')).to.eq('PDF');
    expect(fileTypeLabel('image')).to.eq('Image');
    expect(fileTypeLabel('video')).to.eq('Video');
  });

  // The reason this exists: "File" on everything is the generic label the
  // type is meant to replace.
  it('falls back to the extension rather than saying File', () => {
    expect(fileTypeLabel('other', 'https://site.test/wp-content/roster.xlsx')).to.eq('XLSX');
    expect(fileTypeLabel('other', 'https://site.test/policy.docx')).to.eq('DOCX');
  });

  it('ignores a query string on the way to the extension', () => {
    expect(fileTypeLabel('other', 'https://site.test/a.docx?ver=2')).to.eq('DOCX');
    expect(fileTypeLabel('other', 'https://site.test/a.docx#page=3')).to.eq('DOCX');
  });

  it('says File when there is no usable extension', () => {
    expect(fileTypeLabel('other')).to.eq('File');
    expect(fileTypeLabel('other', 'https://site.test/download')).to.eq('File');
    expect(fileTypeLabel('other', 'https://site.test/archive.verylongext')).to.eq('File');
  });

  // A known type wins over whatever the URL happens to end in.
  it('does not let the url override a known type', () => {
    expect(fileTypeLabel('pdf', 'https://site.test/thing.bin')).to.eq('PDF');
  });
});
