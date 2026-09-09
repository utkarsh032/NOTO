import { clampMargin, pageSize, resolveMargins } from '@noto/config';
import { describe, expect, it } from 'vitest';

import { sheetStyle } from './page-layout';

/*
 * What is under test is the arithmetic between a user's choice and a page: the
 * hooks around it need a React tree, but the sheet a choice produces does not,
 * and that is the part a wrong margin shows up in.
 */

describe('sheetStyle', () => {
  it('states the sheet in inches, so the screen and the printer agree', () => {
    const style = sheetStyle({
      mode: 'page',
      size: pageSize('letter'),
      margins: { top: 1, bottom: 1, left: 1.25, right: 1.25 },
    });

    expect(style.width).toBe('8.5in');
    expect(style.minHeight).toBe('11in');
    expect(style.paddingLeft).toBe('1.25in');
    expect(style.paddingRight).toBe('1.25in');
  });

  it('lets the page shrink rather than run off a narrow window', () => {
    const style = sheetStyle({
      mode: 'page',
      size: pageSize('a4'),
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });

    expect(style.maxWidth).toBe('100%');
  });
});

describe('margins', () => {
  it('gives a preset the numbers every office suite gives it', () => {
    expect(resolveMargins('narrow', { top: 9, bottom: 9, left: 9, right: 9 })).toEqual({
      top: 0.5,
      bottom: 0.5,
      left: 0.5,
      right: 0.5,
    });
  });

  it('reads the user’s own numbers only for the custom preset', () => {
    const custom = { top: 0.3, bottom: 0.4, left: 1.1, right: 1.2 };
    expect(resolveMargins('custom', custom)).toEqual(custom);
  });

  it('falls back to a page that can be written on when the preset is unknown', () => {
    // Settings written by a newer version, read by an older one.
    const margins = resolveMargins('a4-ish' as never, { top: 1, bottom: 1, left: 1, right: 1 });
    expect(margins).toEqual({ top: 1, bottom: 1, left: 1, right: 1 });
  });

  it('holds a typed margin inside the page', () => {
    expect(clampMargin(-3)).toBe(0);
    expect(clampMargin(40)).toBe(4);
    expect(clampMargin(Number.NaN)).toBe(0);
    expect(clampMargin(1.25)).toBe(1.25);
  });
});

describe('pageSize', () => {
  it('answers with a real sheet for an id it does not know', () => {
    expect(pageSize('tabloid' as never).id).toBe('letter');
  });
});
