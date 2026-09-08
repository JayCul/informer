// Copies the compiled circuits and keys into public/ so the browser can fetch
// them via FetchZkConfigProvider.
import { cpSync, mkdirSync, existsSync, rmSync } from 'node:fs';

if (!existsSync('managed/informer')) {
  console.error('managed/informer missing. Run: npm run compact');
  process.exit(1);
}
rmSync('public/zk', { recursive: true, force: true });
mkdirSync('public/zk', { recursive: true });
cpSync('managed/informer', 'public/zk/informer', { recursive: true });
console.log('synced managed/informer -> public/zk/informer');
