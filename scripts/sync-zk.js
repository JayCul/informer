// Copies the compiled circuits and keys into public/ so the browser can fetch
// them via FetchZkConfigProvider.
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';

if (!existsSync('managed/cohort')) {
  console.error('managed/cohort missing. Run: npm run compact');
  process.exit(1);
}
rmSync('public/zk', { recursive: true, force: true });
mkdirSync('public/zk', { recursive: true });
cpSync('managed/cohort', 'public/zk/cohort', { recursive: true });
console.log('synced managed/cohort -> public/zk/cohort');
