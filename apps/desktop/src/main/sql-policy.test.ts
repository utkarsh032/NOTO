import { describe, expect, it } from 'vitest';

import { checkStatement } from './sql-policy';

describe('checkStatement', () => {
  it('allows the statements the shared query layer sends', () => {
    expect(checkStatement('SELECT * FROM documents WHERE id = ?', ['a']).ok).toBe(true);
    expect(checkStatement('BEGIN', []).ok).toBe(true);
    expect(checkStatement('PRAGMA user_version = 3', []).ok).toBe(true);
    expect(checkStatement('PRAGMA foreign_keys = ON', []).ok).toBe(true);
  });

  it('refuses statements that write files outside the database', () => {
    expect(checkStatement("ATTACH DATABASE 'C:/evil.db' AS evil", []).ok).toBe(false);
    expect(checkStatement("attach 'x' as y", []).ok).toBe(false);
    expect(checkStatement("VACUUM INTO '/tmp/copy.db'", []).ok).toBe(false);
    expect(checkStatement("SELECT load_extension('x')", []).ok).toBe(false);
  });

  it('refuses pragmas the schema does not use', () => {
    expect(checkStatement('PRAGMA writable_schema = ON', []).ok).toBe(false);
  });

  it('allows the forbidden words inside bound values', () => {
    // Document text travels as parameters, so a note about "attach" is fine.
    expect(
      checkStatement('UPDATE documents SET title = ? WHERE id = ?', ['attach the file', 'a']).ok,
    ).toBe(true);
  });

  it('refuses malformed input', () => {
    expect(checkStatement(42, []).ok).toBe(false);
    expect(checkStatement('', []).ok).toBe(false);
    expect(checkStatement('SELECT 1', 'nope').ok).toBe(false);
    expect(checkStatement('SELECT ?', [{ toString: () => '1' }]).ok).toBe(false);
  });
});
