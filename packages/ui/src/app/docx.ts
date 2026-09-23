import type { DocumentContent, NotoDocument } from '@noto/types';

import { createZip } from './zip';

/**
 * A Word document, written from the stored JSON.
 *
 * WordprocessingML directly, rather than a library: the parts of Noto's schema
 * map onto a small, stable subset of it — paragraphs with a style, runs with
 * a few properties, tables, hyperlinks — and the whole file is five XML parts
 * in a ZIP. Images are not embedded yet; where one was, the document says so.
 */

interface Node {
  type?: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: Node[];
}

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Marks in the order their run properties must appear (CT_RPr): rFonts, b, i, strike, highlight, u. */
const RUN_ORDER = ['code', 'bold', 'italic', 'strike', 'highlight', 'underline'];

class Writer {
  readonly links: string[] = [];

  body(nodes: readonly Node[]): string {
    return nodes.map((node) => this.block(node, 0)).join('');
  }

  private paragraph(
    runs: string,
    { style, align, indent }: { style?: string; align?: unknown; indent?: number } = {},
  ): string {
    const props = [
      style ? `<w:pStyle w:val="${style}"/>` : '',
      indent ? `<w:ind w:left="${indent * 360}"/>` : '',
      typeof align === 'string' && ['center', 'right', 'justify'].includes(align)
        ? `<w:jc w:val="${align === 'justify' ? 'both' : align}"/>`
        : '',
    ].join('');

    return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ''}${runs}</w:p>`;
  }

  private block(node: Node, depth: number, prefix = ''): string {
    const children = node.content ?? [];

    switch (node.type) {
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
        return this.paragraph(this.runs(children), {
          style: `Heading${level}`,
          align: node.attrs?.textAlign,
        });
      }
      case 'paragraph':
        return this.paragraph(this.text(prefix) + this.runs(children), {
          align: node.attrs?.textAlign,
          indent: depth,
        });
      case 'bulletList':
        return children.map((item) => this.listItem(item, depth, '• ')).join('');
      case 'orderedList': {
        const start = Number(node.attrs?.start) || 1;
        return children
          .map((item, index) => this.listItem(item, depth, `${start + index}. `))
          .join('');
      }
      case 'taskList':
        return children
          .map((item) => this.listItem(item, depth, item.attrs?.checked ? '☑ ' : '☐ '))
          .join('');
      case 'blockquote':
        return children
          .map((child) =>
            child.type === 'paragraph'
              ? this.paragraph(this.runs(child.content ?? []), { style: 'Quote' })
              : this.block(child, depth),
          )
          .join('');
      case 'codeBlock': {
        const code = (children.map((child) => child.text ?? '').join('') || '').split('\n');
        return code
          .map((line) =>
            this.paragraph(this.run(line, '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>'), {
              style: 'Code',
            }),
          )
          .join('');
      }
      case 'horizontalRule':
        return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>';
      case 'table':
        return this.table(node);
      case 'image':
        return this.paragraph(
          this.run(`[Image${node.attrs?.alt ? `: ${String(node.attrs.alt)}` : ''}]`, '<w:i/>'),
        );
      default:
        return children.length > 0 ? this.body(children) : '';
    }
  }

  private listItem(item: Node, depth: number, marker: string): string {
    return (item.content ?? [])
      .map((child, index) =>
        child.type === 'paragraph'
          ? this.block(child, depth + 1, index === 0 ? marker : '')
          : this.block(child, depth + 1),
      )
      .join('');
  }

  private table(node: Node): string {
    const rows = (node.content ?? [])
      .map((row) => {
        const cells = (row.content ?? [])
          .map((cell) => {
            const inner = this.body(cell.content ?? []) || '<w:p/>';
            const header =
              cell.type === 'tableHeader' ? '<w:shd w:val="clear" w:fill="EEEEEE"/>' : '';
            return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${header}</w:tcPr>${inner}</w:tc>`;
          })
          .join('');
        return `<w:tr>${cells}</w:tr>`;
      })
      .join('');

    return (
      '<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/>' +
      '<w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/>' +
      '<w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/>' +
      '<w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders>' +
      `</w:tblPr>${rows}</w:tbl><w:p/>`
    );
  }

  private runs(nodes: readonly Node[]): string {
    return nodes
      .map((node) => {
        if (node.type === 'hardBreak') return '<w:r><w:br/></w:r>';
        if (node.type !== 'text' || !node.text) return '';

        const marks = node.marks ?? [];
        // Word rejects run properties out of schema order, and marks arrive in any order.
        const props = [...marks]
          .sort((a, b) => RUN_ORDER.indexOf(a.type) - RUN_ORDER.indexOf(b.type))
          .map((mark) => {
            switch (mark.type) {
              case 'bold':
                return '<w:b/>';
              case 'italic':
                return '<w:i/>';
              case 'underline':
                return '<w:u w:val="single"/>';
              case 'strike':
                return '<w:strike/>';
              case 'code':
                return '<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>';
              case 'highlight':
                return '<w:highlight w:val="yellow"/>';
              default:
                return '';
            }
          })
          .join('');

        const link = marks.find((mark) => mark.type === 'link');
        const href = typeof link?.attrs?.href === 'string' ? link.attrs.href : null;
        if (href) {
          this.links.push(href);
          const id = `rIdLink${this.links.length}`;
          return `<w:hyperlink r:id="${id}">${this.run(node.text, `<w:rStyle w:val="Hyperlink"/>${props}`)}</w:hyperlink>`;
        }

        return this.run(node.text, props);
      })
      .join('');
  }

  private run(text: string, props = ''): string {
    return `<w:r>${props ? `<w:rPr>${props}</w:rPr>` : ''}<w:t xml:space="preserve">${escape(text)}</w:t></w:r>`;
  }

  text(value: string): string {
    return value ? this.run(value) : '';
  }
}

const HEADINGS = [40, 32, 28, 26, 24, 22]
  .map(
    (size, index) =>
      `<w:style w:type="paragraph" w:styleId="Heading${index + 1}"><w:name w:val="heading ${index + 1}"/>` +
      `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
      `<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${index}"/></w:pPr>` +
      `<w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`,
  )
  .join('');

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:b/><w:sz w:val="48"/></w:rPr></w:style>' +
  HEADINGS +
  '<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="720"/></w:pPr><w:rPr><w:i/><w:color w:val="555555"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="20"/></w:rPr></w:style>' +
  '<w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style>' +
  '</w:styles>';

export function documentToDocx(document: Pick<NotoDocument, 'title' | 'content'>): Uint8Array {
  const writer = new Writer();
  const content = (document.content as DocumentContent & { content?: Node[] }).content ?? [];
  const title = `<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr>${writer.text(document.title || 'Untitled')}</w:p>`;
  const body = writer.body(content);

  const xml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<w:body>${title}${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>` +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>';

  const links = writer.links
    .map(
      (href, index) =>
        `<Relationship Id="rIdLink${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escape(href)}" TargetMode="External"/>`,
    )
    .join('');

  return createZip([
    {
      path: '[Content_Types].xml',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
        '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
        '</Types>',
    },
    {
      path: '_rels/.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
        '</Relationships>',
    },
    {
      path: 'word/_rels/document.xml.rels',
      data:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        `${links}</Relationships>`,
    },
    { path: 'word/document.xml', data: xml },
    { path: 'word/styles.xml', data: STYLES },
  ]);
}
