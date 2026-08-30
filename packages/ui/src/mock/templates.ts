import type { DocumentContent } from '@noto/types';

/**
 * The Start Writing templates.
 *
 * These are real: choosing one creates a document and writes this content into
 * it, exactly as typing it would. They live here rather than in `@noto/core`
 * because the wording is presentation — a heading someone will rewrite in the
 * first ten seconds — and not part of the document model.
 */

export type TemplateId = 'blank' | 'daily' | 'meeting' | 'tasks';

export interface WritingTemplate {
  id: TemplateId;
  name: string;
  description: string;
  /** The lines the preview draws, as a hint of the shape of the document. */
  preview: 'paragraphs' | 'journal' | 'meeting' | 'checklist';
  /** Built at the moment it is chosen, so a daily note carries today's date. */
  build(): { title: string; content: DocumentContent };
}

const heading = (level: number, text: string) => ({
  type: 'heading',
  attrs: { level },
  content: [{ type: 'text', text }],
});

const paragraph = (text?: string) =>
  text ? { type: 'paragraph', content: [{ type: 'text', text }] } : { type: 'paragraph' };

const bulletList = (items: string[]) => ({
  type: 'bulletList',
  content: items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
});

const taskList = (items: string[]) => ({
  type: 'taskList',
  content: items.map((item) => ({
    type: 'taskItem',
    attrs: { checked: false },
    content: [paragraph(item)],
  })),
});

const today = (): string =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date());

export const WRITING_TEMPLATES: WritingTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start from scratch',
    preview: 'paragraphs',
    build: () => ({ title: 'Untitled', content: { type: 'doc', content: [paragraph()] } }),
  },
  {
    id: 'daily',
    name: 'Daily Note',
    description: 'For your daily thoughts',
    preview: 'journal',
    build: () => ({
      title: today(),
      content: {
        type: 'doc',
        content: [
          heading(1, today()),
          heading(3, 'How today went'),
          paragraph(),
          heading(3, 'Worth remembering'),
          bulletList(['']),
          heading(3, 'Tomorrow'),
          taskList(['']),
        ],
      },
    }),
  },
  {
    id: 'meeting',
    name: 'Meeting Note',
    description: 'Capture meeting highlights',
    preview: 'meeting',
    build: () => ({
      title: 'Meeting Notes',
      content: {
        type: 'doc',
        content: [
          heading(1, 'Meeting Notes'),
          paragraph(today()),
          heading(3, 'Attendees'),
          bulletList(['']),
          heading(3, 'Discussion'),
          paragraph(),
          heading(3, 'Decisions'),
          bulletList(['']),
          heading(3, 'Actions'),
          taskList(['']),
        ],
      },
    }),
  },
  {
    id: 'tasks',
    name: 'Task List',
    description: 'Plan and track your tasks',
    preview: 'checklist',
    build: () => ({
      title: 'Task List',
      content: {
        type: 'doc',
        content: [heading(1, 'Task List'), taskList(['', '', ''])],
      },
    }),
  },
];
