import { useState } from 'react';

import { Badge } from '../../components/Badge';
import { IconButton } from '../../components/IconButton';
import { SendIcon, SparklesIcon } from '../../components/icons';
import { cn } from '../../utils/cn';

export interface AIAssistantPanelProps {
  /** The document the assistant would act on, for the context line. */
  documentTitle?: string;
  className?: string;
}

/** The eight things people ask an assistant to do to a paragraph they wrote. */
const ACTIONS = [
  { id: 'improve', label: 'Improve writing', prompt: 'Improve the writing in this document' },
  { id: 'rewrite', label: 'Rewrite', prompt: 'Rewrite this in a clearer voice' },
  { id: 'summarize', label: 'Summarize', prompt: 'Summarise this document in five bullets' },
  { id: 'explain', label: 'Explain', prompt: 'Explain what this document is saying' },
  { id: 'expand', label: 'Expand', prompt: 'Expand this section with more detail' },
  { id: 'shorten', label: 'Shorten', prompt: 'Make this shorter without losing the point' },
  { id: 'brainstorm', label: 'Brainstorm', prompt: 'Brainstorm ideas to add to this' },
  { id: 'format', label: 'Format', prompt: 'Format this with headings and lists' },
];

/**
 * Noto AI, as a panel.
 *
 * Purple, quiet, and secondary to the document: the assistant is a tool beside
 * the writing, never the thing the application is about. It is also not
 * connected to a model yet, and says so plainly rather than staging a
 * conversation — a fake answer in a notes application is a note you might
 * later believe.
 */
export function AIAssistantPanel({ documentTitle, className }: AIAssistantPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex items-center gap-2">
        <span className="bg-ai-soft text-ai flex h-8 w-8 items-center justify-center rounded-md">
          <SparklesIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-primary text-body-sm font-semibold">Noto AI</p>
          <p className="text-tertiary text-caption truncate">
            {documentTitle ? `Working on “${documentTitle}”` : 'Ask about anything in Noto'}
          </p>
        </div>
        <Badge tone="ai">Preview</Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => setPrompt(action.prompt)}
            className="border-default text-secondary hover:border-ai/40 hover:bg-ai-soft hover:text-ai focus-visible:outline-ai text-caption rounded-full border px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="noto-scroll-y mt-4 min-h-0 flex-1 overflow-y-auto">
        {submitted ? (
          <div className="flex flex-col gap-3">
            <p className="bg-surface-secondary text-primary text-body-sm ml-auto max-w-[85%] rounded-xl rounded-br-sm px-3 py-2">
              {submitted}
            </p>
            <div className="border-ai/25 bg-ai-soft rounded-xl rounded-bl-sm border px-3 py-2.5">
              <p className="text-primary text-body-sm">
                Noto AI is not connected yet, so there is no answer to give you.
              </p>
              <p className="text-secondary text-caption mt-1.5">
                Your prompt has not left this device. When a model is connected, this is where the
                reply will appear — and you will always choose whether it goes into the document.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-tertiary text-body-sm">
            Pick an action or describe what you want. Nothing is sent anywhere until you connect a
            model in Settings.
          </p>
        )}
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const value = prompt.trim();
          if (value === '') return;

          setSubmitted(value);
          setPrompt('');
        }}
      >
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            /* Enter sends, Shift+Enter breaks the line — as in every chat. */
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }}
          rows={2}
          placeholder="Ask Noto AI…"
          aria-label="Ask Noto AI"
          className="border-default bg-surface text-primary placeholder:text-disabled text-body-sm focus-visible:border-ai focus-visible:ring-ai/20 min-h-10 w-full resize-none rounded-md border px-3 py-2 focus-visible:ring-3 focus-visible:outline-none"
        />
        <IconButton
          label="Send"
          type="submit"
          icon={<SendIcon className="h-4 w-4" />}
          className="bg-ai text-white hover:brightness-95"
          disabled={prompt.trim() === ''}
        />
      </form>
    </div>
  );
}
