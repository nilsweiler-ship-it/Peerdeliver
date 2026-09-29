#!/usr/bin/env node
/**
 * Publish website/ to shlep.ch.
 *
 *   npm run deploy:site
 *
 * Netlify is not git-linked here, so nothing reaches shlep.ch by pushing. That
 * has cost this project real money twice: the site once went eight weeks
 * without a deploy, and the waitlist role fix sat committed while the live
 * form kept rejecting every signup that picked a role.
 *
 * The obvious fix — calling the Netlify CLI directly — walks into a trap. Run
 * from the repo root the CLI finds npm workspaces, prints "We've detected
 * multiple projects inside your repository", and offers to build
 * packages/app: an Expo React Native app, being handed to a static host.
 * Every answer to that prompt is wrong.
 *
 * So this deploys the directory and nothing else:
 *   · --no-build, so no build pipeline runs and no package is selected
 *   · run with cwd=website, so the root package.json is never consulted
 *   · website/netlify.toml declares publish="." and an empty command
 *
 * Preflight runs first. A drifted waitlist role or a broken locale file is
 * exactly the kind of thing that should not reach production, and the whole
 * reason this problem was expensive is that nothing stood between a mistake
 * and the live site.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteDir = join(root, 'website');

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

/**
 * Which site to deploy to.
 *
 * `--site=shlepch` failed with "Failed retrieving site data for site shlepch:
 * Not Found". The slug in the dashboard URL is not necessarily what the API
 * accepts; the site's own ID always is. So: an explicit ID if one is
 * configured, otherwise fall back to whatever `netlify link` recorded.
 */
function resolveSite() {
  if (process.env.NETLIFY_SITE_ID) return { id: process.env.NETLIFY_SITE_ID, from: 'NETLIFY_SITE_ID' };

  const stateFile = join(siteDir, '.netlify', 'state.json');
  if (existsSync(stateFile)) {
    try {
      const id = JSON.parse(readFileSync(stateFile, 'utf8')).siteId;
      if (id) return { id, from: 'website/.netlify/state.json' };
    } catch {
      /* fall through */
    }
  }
  return null;
}

console.log(bold('\nDeploy website → shlep.ch\n') + dim('─'.repeat(64)));

// ── 1. Never publish something preflight rejects ───────────────────────────
console.log(dim('\nRunning preflight…'));
const pre = spawnSync('node', [join(root, 'scripts', 'preflight.mjs')], { stdio: 'inherit' });
if (pre.status !== 0) {
  console.error(r('\nPreflight failed — not deploying.\n'));
  process.exit(1);
}

// ── 2. Resolve the target ───────────────────────────────────────────────────
const site = resolveSite();
if (!site) {
  console.error(
    r('\nNo Netlify site configured.') +
      dim(
        '\n\n  Link it once — from the website directory, so the CLI never sees the\n' +
          '  workspace root and never offers to build packages/app:\n\n' +
          '      cd website && npx netlify-cli@latest link\n\n' +
          '  Pick the existing shlep.ch site. That writes website/.netlify/state.json\n' +
          '  and every later deploy is just: npm run deploy:site\n\n' +
          '  Or, if you would rather not link, set the id explicitly. Netlify\n' +
          '  dashboard → Site configuration → Site information → Site ID:\n\n' +
          '      NETLIFY_SITE_ID=<uuid> npm run deploy:site\n\n' +
          '  Note it is the Site ID (a uuid), not "shlepch" from the dashboard URL —\n' +
          '  that slug is what the previous attempt sent, and the API rejected it.\n',
      ),
  );
  process.exit(1);
}
console.log(dim(`\nSite: ${site.id}  (from ${site.from})`));

// ── 3. Upload, and nothing else ─────────────────────────────────────────────
const args = [
  'netlify-cli@latest',
  'deploy',
  '--prod',
  // No build pipeline: this is a folder of static files. Without it the CLI
  // inspects the repo, finds workspaces, and asks which package to build.
  '--no-build',
  '--dir=.',
  `--site=${site.id}`,
];

console.log(dim(`\nnpx ${args.join(' ')}\n`));
try {
  execFileSync('npx', args, { cwd: siteDir, stdio: 'inherit' });
} catch {
  console.error(
    r('\nDeploy failed.') +
      dim(
        '\n  If it is an auth error:            cd website && npx netlify-cli@latest login\n' +
          '  If the site id is wrong:           cd website && npx netlify-cli@latest link\n' +
          '  As a fallback, drag website/ to:   https://app.netlify.com/drop\n',
      ),
  );
  process.exit(1);
}

console.log(g('\nDeployed.') + dim('  Confirm what actually landed:  npm run status\n'));
