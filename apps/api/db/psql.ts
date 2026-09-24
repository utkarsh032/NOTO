import { spawn } from 'node:child_process';

/**
 * `pnpm db:psql` — a psql shell on DATABASE_URL, as `noto_api`.
 *
 * As the API's role, so what you see is what a request sees: set a caller
 * with `select set_config('app.user_id', '<uuid>', false);` or every table
 * reads as empty. Pass `--owner` for DATABASE_MIGRATE_URL instead.
 */

const useOwner = process.argv.includes('--owner');
const url = process.env[useOwner ? 'DATABASE_MIGRATE_URL' : 'DATABASE_URL'];

if (!url) {
  console.error(`Set ${useOwner ? 'DATABASE_MIGRATE_URL' : 'DATABASE_URL'} in apps/api/.env.`);
  process.exit(1);
}

const child = spawn('psql', [url], { stdio: 'inherit' });

child.on('error', () => {
  console.error("psql was not found. Add PostgreSQL's bin directory to PATH.");
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
