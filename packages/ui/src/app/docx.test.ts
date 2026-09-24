import { describe, expect, it } from 'vitest';

import { documentToDocx } from './docx';
import { crc32, createZip } from './zip';

/** Reads a stored (uncompressed) ZIP back into its entries. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const entries = new Map<string, string>();

  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const crc = view.getUint32(offset + 14, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength));
    const data = bytes.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);

    expect(crc32(data)).toBe(crc);
    entries.set(name, decoder.decode(data));
    offset += 30 + nameLength + size;
  }

  expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
  expect(view.getUint16(bytes.length - 12, true)).toBe(entries.size);
  return entries;
}

describe('createZip', () => {
  it('writes entries that read back byte for byte', () => {
    const entries = unzip(
      createZip([
        { path: 'a.txt', data: 'héllo' },
        { path: 'b/c.xml', data: '<x/>' },
      ]),
    );
    expect(entries.get('a.txt')).toBe('héllo');
    expect(entries.get('b/c.xml')).toBe('<x/>');
  });

  it('computes the standard CRC-32', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('documentToDocx', () => {
  const document = {
    title: 'Plan & notes',
    content: {
      type: 'doc' as const,
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Goals' }] },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            {
              type: 'text',
              text: 'Bold <underlined>',
              marks: [{ type: 'underline' }, { type: 'bold' }],
            },
            {
              type: 'text',
              text: 'a link',
              marks: [{ type: 'link', attrs: { href: 'https://example.com/?a=1&b=2' } }],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'One' }] }],
            },
          ],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'H' }] }],
                },
              ],
            },
          ],
        },
      ],
    },
  };

  const parts = unzip(documentToDocx(document));
  const xml = parts.get('word/document.xml')!;

  it('packages the parts Word requires', () => {
    expect([...parts.keys()].sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'word/_rels/document.xml.rels',
      'word/document.xml',
      'word/styles.xml',
    ]);
  });

  it('writes the title, headings, alignment and escaped text', () => {
    expect(xml).toContain(
      '<w:pStyle w:val="Title"/></w:pPr><w:r><w:t xml:space="preserve">Plan &amp; notes',
    );
    expect(xml).toContain('<w:pStyle w:val="Heading2"/>');
    expect(xml).toContain('<w:jc w:val="center"/>');
    expect(xml).toContain('Bold &lt;underlined&gt;');
  });

  it('orders run properties the way the schema requires', () => {
    expect(xml).toContain('<w:rPr><w:b/><w:u w:val="single"/></w:rPr>');
  });

  it('writes links as relationships', () => {
    expect(xml).toContain('<w:hyperlink r:id="rIdLink1">');
    expect(parts.get('word/_rels/document.xml.rels')).toContain(
      'Target="https://example.com/?a=1&amp;b=2" TargetMode="External"',
    );
  });

  it('writes lists and tables', () => {
    expect(xml).toContain('• </w:t>');
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('w:fill="EEEEEE"');
  });
});
