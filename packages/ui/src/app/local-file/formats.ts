import { slugify } from '@noto/core';

import { EXPORT_FORMATS, IMPORT_ACCEPT, type ExportFormat } from '../export';

/* -------------------------------------------------------------------------- */
/* Names and formats                                                          */
/* -------------------------------------------------------------------------- */

/** The formats Noto can write, in the order a save dialog should offer them. */
export const WRITABLE_FORMATS = EXPORT_FORMATS.filter((format) => format.supported);

/** What Noto writes when it has nothing better to go on. */
export const DEFAULT_LOCAL_FILE_FORMAT: ExportFormat = 'md';

/** What a picker should let the user choose when opening. */
export const LOCAL_FILE_ACCEPT = IMPORT_ACCEPT;

/**
 * Which format a file name asks for.
 *
 * Anything unrecognised is plain text. That is the honest answer for a file
 * somebody named `notes` or `todo.list`: Noto can always write the words, and
 * refusing an extension it has not heard of would be refusing the file.
 */
export function formatForFileName(name: string): ExportFormat {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';

  switch (extension) {
    case 'md':
    case 'markdown':
      return 'md';
    case 'html':
    case 'htm':
      return 'html';
    case 'json':
      return 'json';
    default:
      return 'txt';
  }
}

/** The name Noto suggests for a document that has never been saved. */
export function fileNameFor(
  title: string,
  format: ExportFormat = DEFAULT_LOCAL_FILE_FORMAT,
): string {
  const info = EXPORT_FORMATS.find((candidate) => candidate.id === format);
  return `${slugify(title || 'untitled') || 'untitled'}.${info?.extension ?? 'txt'}`;
}

/** The MIME type a format is written as, for the platforms that ask for one. */
export function mimeTypeFor(format: ExportFormat): string {
  return EXPORT_FORMATS.find((candidate) => candidate.id === format)?.mimeType ?? 'text/plain';
}

/** The formats a save dialog should offer, richest first. */
export function writableFormats(): readonly (typeof EXPORT_FORMATS)[number][] {
  return WRITABLE_FORMATS;
}
