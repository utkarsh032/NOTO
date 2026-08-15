/**
 * A deliberately small Markdown renderer for release notes.
 *
 * Release bodies come from the GitHub API, which means they are text written by
 * whoever cut the release and returned over the network. Rendering them with
 * `dangerouslySetInnerHTML` would put that text on the page as markup, so this
 * builds React elements instead: there is no path from a release body to raw
 * HTML, and no sanitiser to get wrong.
 *
 * It handles the subset the release notes actually use — headings, lists,
 * block quotes, fenced code, tables reduced to monospace rows, and inline
 * links, code and emphasis. Anything else renders as plain text, which is a
 * fine outcome for a page that also links to the formatted original.
 */

import { Fragment, type ReactNode } from 'react';

const INLINE = /(\[[^\]]+\]\([^)\s]+\))|(`[^`]+`)|(\*\*[^*]+\*\*)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  INLINE.lastIndex = 0;

  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith('[')) {
      const label = token.slice(1, token.indexOf(']'));
      const href = token.slice(token.indexOf('(') + 1, -1);
      // Only http(s) links are rendered as links; anything else (javascript:,
      // data:) falls through to plain text.
      nodes.push(
        /^https?:\/\//i.test(href) ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="text-accent hover:underline"
          >
            {label}
          </a>
        ) : (
          <Fragment key={key}>{label}</Fragment>
        ),
      );
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="bg-surface-sunken rounded px-1.5 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(
        <strong key={key} className="text-content font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];

  let paragraph: string[] = [];
  let list: string[] = [];
  let fence: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ');
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-muted text-sm">
        {renderInline(text, `p-${blocks.length}`)}
      </p>,
    );
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="space-y-1.5">
        {list.map((item, itemIndex) => (
          <li key={item + itemIndex} className="text-muted ml-5 list-disc text-sm">
            {renderInline(item, `li-${blocks.length}-${itemIndex}`)}
          </li>
        ))}
      </ul>,
    );
    list = [];
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.startsWith('```')) {
      if (fence === null) {
        flushAll();
        fence = [];
      } else {
        blocks.push(
          <pre
            key={`pre-${blocks.length}`}
            className="border-border-subtle bg-surface-sunken text-muted overflow-x-auto rounded-md border p-3 font-mono text-xs"
          >
            {fence.join('\n')}
          </pre>,
        );
        fence = null;
      }
      continue;
    }

    if (fence !== null) {
      fence.push(raw);
      continue;
    }

    if (line.trim() === '') {
      flushAll();
      continue;
    }

    // A horizontal rule separates the sections the release-notes script emits.
    if (/^-{3,}$/.test(line.trim())) {
      flushAll();
      blocks.push(<hr key={`hr-${blocks.length}`} className="border-border-subtle" />);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushAll();
      const hashes = heading[1] ?? '';
      const headingText = heading[2] ?? '';
      const level = hashes.length;
      const Tag = (level <= 2 ? 'h3' : 'h4') as 'h3' | 'h4';
      blocks.push(
        <Tag
          key={`h-${blocks.length}`}
          className={
            level <= 2
              ? 'text-content pt-2 text-base font-semibold'
              : 'text-content pt-1 text-sm font-semibold'
          }
        >
          {renderInline(headingText, `h-${blocks.length}`)}
        </Tag>,
      );
      continue;
    }

    if (line.startsWith('> ')) {
      flushAll();
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          className="border-accent text-muted border-l-2 pl-4 text-sm italic"
        >
          {renderInline(line.slice(2), `q-${blocks.length}`)}
        </blockquote>,
      );
      continue;
    }

    const listItem = /^\s*[-*]\s+(.*)$/.exec(line);
    if (listItem) {
      flushParagraph();
      list.push(listItem[1] ?? '');
      continue;
    }

    // Tables are rendered as monospace rows rather than reconstructed; the
    // release notes use them only for download lists, which stay readable.
    if (line.trim().startsWith('|')) {
      flushAll();
      if (!/^\|[\s|:-]+\|$/.test(line.trim())) {
        blocks.push(
          <p key={`t-${blocks.length}`} className="text-muted font-mono text-xs">
            {renderInline(line.replace(/\|/g, ' ').trim(), `t-${blocks.length}`)}
          </p>,
        );
      }
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushAll();

  return <div className="space-y-3">{blocks}</div>;
}
