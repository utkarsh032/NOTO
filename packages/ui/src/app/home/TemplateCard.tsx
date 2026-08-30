import type { WritingTemplate } from '../../mock/templates';
import { cn } from '../../utils/cn';

export interface TemplateCardProps {
  template: WritingTemplate;
  onSelect(): void;
  /** `grid` shows the page preview; `list` is a compact row. */
  view?: 'grid' | 'list';
}

/** One tint per template, so the four are told apart by shape and by colour. */
const TONE: Record<WritingTemplate['preview'], { line: string; tick: string }> = {
  paragraphs: { line: 'bg-brand-subtle', tick: 'text-brand' },
  journal: { line: 'bg-info/25', tick: 'text-info' },
  meeting: { line: 'bg-warning/30', tick: 'text-warning' },
  checklist: { line: 'bg-ai/25', tick: 'text-ai' },
};

/** The widths of the lines drawn in each preview, as a fraction of the page. */
const LINES: Record<WritingTemplate['preview'], number[]> = {
  paragraphs: [100, 88, 94, 70, 100, 82],
  journal: [60, 100, 90, 100, 76, 92],
  meeting: [72, 100, 86, 100, 64, 90],
  checklist: [88, 76, 92, 68],
};

/**
 * A writing template, previewed as the page it makes.
 *
 * The preview is drawn rather than rendered from the template's own content: a
 * real render at 120px tall is unreadable, and what the eye is actually
 * matching here is the shape of the document — a journal starts with a date, a
 * checklist is a column of boxes.
 */
export function TemplateCard({ template, onSelect, view = 'grid' }: TemplateCardProps) {
  const tone = TONE[template.preview];
  const lines = LINES[template.preview];
  const isChecklist = template.preview === 'checklist';

  if (view === 'list') {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="border-default bg-surface hover:border-strong focus-visible:outline-brand flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="border-default flex h-9 w-7 shrink-0 flex-col justify-center gap-1 rounded-sm border px-1.5">
          {lines.slice(0, 3).map((width, index) => (
            <span
              key={index}
              className={cn('block h-0.5 rounded-full', tone.line)}
              style={{ width: `${width}%` }}
            />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-primary text-body-sm block font-medium">{template.name}</span>
          <span className="text-tertiary text-caption block truncate">{template.description}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group/template focus-visible:outline-brand flex flex-col text-left focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span
        className={cn(
          'border-default bg-surface group-hover/template:border-brand block rounded-lg border p-3.5 transition-colors group-hover/template:shadow-md',
        )}
      >
        <span className="flex h-[132px] flex-col gap-2 overflow-hidden">
          {lines.map((width, index) => (
            <span key={index} className="flex items-center gap-1.5">
              {isChecklist ? (
                <span
                  className={cn(
                    'border-ai/40 block h-2.5 w-2.5 shrink-0 rounded-[3px] border',
                    tone.tick,
                  )}
                />
              ) : null}
              <span
                className={cn('block h-2 rounded-full', tone.line)}
                style={{ width: `${width}%` }}
              />
            </span>
          ))}
        </span>
      </span>

      <span className="text-primary text-body-sm mt-3 block font-semibold">{template.name}</span>
      <span className="text-tertiary text-caption mt-0.5 block">{template.description}</span>
    </button>
  );
}
