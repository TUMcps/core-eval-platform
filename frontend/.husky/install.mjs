import { execFileSync } from 'node:child_process';

if (process.env.CI === 'true' || process.env.HUSKY === '0' || process.env.NODE_ENV === 'production') {
  process.exit(0);
}

process.chdir('..');

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
} catch {
  process.exit(0);
}

const husky = (await import('husky')).default;
const message = husky('frontend/.husky');
if (message) console.log(message);
