import { readFile } from 'node:fs/promises';

import { importSupabaseUsers } from '../src/db/import-supabase.ts';
import { createKysely } from '../src/db/pool.ts';

/**
 * `pnpm --filter @noto/api db:import-supabase <export.json>`
 *
 * Imports the Supabase accounts export (shape: `SupabaseExport` in
 * src/db/import-supabase.ts; the runbook is docs/deployment/supabase-cutover.md).
 * Runs as DATABASE_MIGRATE_URL, the owner. Safe to run again.
 */

const file = process.argv[2];
const url = process.env['DATABASE_MIGRATE_URL'];

if (!file || !url) {
  console.error('Usage: db:import-supabase <export.json>, with DATABASE_MIGRATE_URL set.');
  process.exit(1);
}

const db = createKysely({ connectionString: url, max: 1, applicationName: 'noto-import' });

try {
  const report = await importSupabaseUsers(db, JSON.parse(await readFile(file, 'utf8')));

  console.warn(
    `imported ${report.imported}, already present ${report.alreadyPresent}, settings ${report.settingsImported}`,
  );
  if (report.emailConflicts.length > 0) {
    console.warn(`address already used by another account here (skipped, resolve by hand):`);
    for (const email of report.emailConflicts) console.warn(`  ${email}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
