/**
 * Getting a document out of Noto.
 *
 * Local-first means the user's work is theirs, so every format here is written
 * from the stored ProseMirror JSON with no service in the middle. PDF goes
 * through printing — the desktop writes the file itself, a browser offers
 * "Save as PDF" in its print dialog — because the print stylesheet is already
 * the page layout a PDF should have.
 */

export type ExportFormat = 'txt' | 'md' | 'html' | 'json' | 'pdf' | 'docx';

export interface ExportFormatInfo {
  id: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
  /** `false` when Noto cannot produce this format yet. */
  supported: boolean;
}

export const EXPORT_FORMATS: ExportFormatInfo[] = [
  {
    id: 'md',
    label: 'Markdown',
    extension: 'md',
    mimeType: 'text/markdown',
    description: 'Headings, lists and links, in plain text.',
    supported: true,
  },
  {
    id: 'txt',
    label: 'Plain text',
    extension: 'txt',
    mimeType: 'text/plain',
    description: 'The words, and nothing else.',
    supported: true,
  },
  {
    id: 'html',
    label: 'HTML',
    extension: 'html',
    mimeType: 'text/html',
    description: 'A standalone page, styled like the editor.',
    supported: true,
  },
  {
    id: 'json',
    label: 'Noto JSON',
    extension: 'json',
    mimeType: 'application/json',
    description: 'The document exactly as Noto stores it.',
    supported: true,
  },
  {
    id: 'pdf',
    label: 'PDF',
    extension: 'pdf',
    mimeType: 'application/pdf',
    description: 'The page as it prints, with its margins.',
    supported: false,
  },
  {
    id: 'docx',
    label: 'Word (DOCX)',
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description: 'Headings, lists, tables and links, for Word.',
    supported: true,
  },
];
