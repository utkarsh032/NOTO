import { describe, expect, it } from 'vitest';

import { normalizeImageSrc, normalizeLinkHref } from './urls';

describe('normalizeLinkHref', () => {
  it('assumes https for a bare host, which is how people type addresses', () => {
    expect(normalizeLinkHref('noto.app')).toBe('https://noto.app/');
    expect(normalizeLinkHref('  noto.app/docs  ')).toBe('https://noto.app/docs');
  });

  it('leaves an explicit scheme alone', () => {
    expect(normalizeLinkHref('http://noto.app/')).toBe('http://noto.app/');
    expect(normalizeLinkHref('mailto:hi@noto.app')).toBe('mailto:hi@noto.app');
    expect(normalizeLinkHref('tel:+15551234')).toBe('tel:+15551234');
  });

  it('refuses schemes that execute', () => {
    // A note is user data that later renders as HTML and syncs to other
    // devices; a link like this would be stored cross-site scripting.
    expect(normalizeLinkHref('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkHref('  JavaScript:alert(1)')).toBeNull();
    expect(normalizeLinkHref('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizeLinkHref('vbscript:msgbox(1)')).toBeNull();
    expect(normalizeLinkHref('file:///etc/passwd')).toBeNull();
  });

  it('refuses input that is not an address at all', () => {
    expect(normalizeLinkHref('')).toBeNull();
    expect(normalizeLinkHref('   ')).toBeNull();
    expect(normalizeLinkHref('https://')).toBeNull();
  });
});

describe('normalizeImageSrc', () => {
  it('accepts remote images', () => {
    expect(normalizeImageSrc('noto.app/logo.png')).toBe('https://noto.app/logo.png');
    expect(normalizeImageSrc('http://noto.app/logo.png')).toBe('http://noto.app/logo.png');
  });

  it('accepts an inline image, which is how a pasted screenshot arrives', () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    expect(normalizeImageSrc(png)).toBe(png);
    expect(normalizeImageSrc('data:image/svg+xml,%3Csvg%3E')).toBe('data:image/svg+xml,%3Csvg%3E');
  });

  it('refuses a data URI that is not an image', () => {
    expect(normalizeImageSrc('data:text/html,<script>alert(1)</script>')).toBeNull();
    expect(normalizeImageSrc('data:image')).toBeNull();
  });

  it('refuses schemes that execute', () => {
    expect(normalizeImageSrc('javascript:alert(1)')).toBeNull();
    expect(normalizeImageSrc('')).toBeNull();
  });
});
