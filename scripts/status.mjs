#!/usr/bin/env node
/**
 * What is actually live, right now.
 *
 *   npm run status
 *
 * Three times on this project the code has been right and the thing serving it
 * has been wrong, and each time it cost hours before anyone thought to check:
 * the website went eight weeks without a deploy because Netlify was never
 * git-linked; the API ran an old commit because a branch was never merged; a
 * payment path was "configured" with no webhook secret behind it.
 *
 * None of those show up in a typecheck. They only show up by asking the live
 * systems what they are running, which is what this does — comparing the
 * working tree against api.shlep.ch and shlep.ch.
 *
 * Read-only. Touches nothing, changes nothing, needs no keys.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const API = 'https://api.shlep.ch';
const SITE = 'https://shlep.ch';

const todo = [];
const line = (mark, label, detail = '') => console.log(`  ${mark} ${label.padEnd(34)} ${detail}`);

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

async function get(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'cache-control': 'no-cache' } });
    return { ok: res.ok, status: res.status, text: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, text: '', error: e.name === 'AbortError' ? 'timed out' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

console.log(bold('\nShlep — what is live\n') + dim('─'.repeat(70)));

// ── 1. Git: is the work even out of this machine? ──────────────────────────
console.log(bold('\nRepository'));
const branch = sh('git rev-parse --abbrev-ref HEAD');
const dirty = sh('git status --porcelain');
const ahead = sh('git rev-list --count @{u}..HEAD') || '?';
const behind = sh('git rev-list --count HEAD..@{u}') || '0';

line(branch === 'main' ? g('✓') : y('!'), 'branch', branch || 'unknown');

if (ahead === '?') {
  line(y('!'), 'unpushed commits', 'no upstream configured');
} else if (Number(ahead) > 0) {
  line(r('✗'), 'unpushed commits', r(`${ahead} commit(s) exist only on this machine`));
  todo.push(`git push   — ${ahead} commit(s) not yet on GitHub, so Render has not seen them`);
} else {
  line(g('✓'), 'unpushed commits', 'none');
}
if (Number(behind) > 0) line(y('!'), 'behind remote', `${behind} commit(s) — git pull`);

if (dirty) {
  const n = dirty.split('\n').length;
  line(y('!'), 'uncommitted changes', `${n} file(s)`);
} else {
  line(g('✓'), 'uncommitted changes', 'none');
}

// ── 2. The API ──────────────────────────────────────────────────────────────
console.log(bold('\nAPI') + dim(`  ${API}`));
const health = await get(`${API}/health`);
let apiUnreachable = false;
if (!health.ok) {
  apiUnreachable = true;
  line(r('✗'), 'reachable', r(health.error || `HTTP ${health.status}`));
} else {
  line(g('✓'), 'reachable', dim('/health ok'));

  const integ = await get(`${API}/health/integrations`);
  let j = null;
  try {
    j = JSON.parse(integ.text);
  } catch {
    /* older deploy without the endpoint */
  }

  if (!j) {
    line(y('!'), 'integrations endpoint', 'not present — the API is running older code');
    todo.push('Redeploy the API: /health/integrations is missing, so this is a stale build');
  } else {
    // Stripe. The section that decides whether a payment can complete.
    const s = j.stripe;
    if (!s) {
      line(y('!'), 'stripe', 'endpoint predates the Stripe check — redeploy');
      todo.push('Redeploy the API to get the Stripe health section');
    } else if (!s.secretKeyPresent) {
      line(y('!'), 'stripe', 'not configured — payments are SIMULATED, no money moves');
      todo.push('Set STRIPE_SECRET_KEY on Render (sk_test_… first) to leave simulated mode');
    } else {
      const modeMark = s.mode === 'live' ? y('!') : g('✓');
      line(modeMark, 'stripe', `${s.mode} mode · ${s.liveCheck}`);
      if (!s.publishableKeyPresent) {
        line(r('✗'), 'stripe publishable key', r('not set — the app cannot open a payment sheet'));
        todo.push(
          'Set STRIPE_PUBLISHABLE_KEY on Render, copied from the SAME Stripe account as the ' +
            'secret key. The app now takes its key from the API, so this is what guarantees they match.',
        );
      } else if (s.publishableKeyValid === false) {
        line(r('✗'), 'stripe publishable key', r(String(s.publishableKeyProblem)));
        todo.push(
          `STRIPE_PUBLISHABLE_KEY is wrong: ${s.publishableKeyProblem}. Take it from ` +
            `https://dashboard.stripe.com/test/apikeys while signed in to ${s.accountId}.`,
        );
      } else {
        line(g('✓'), 'stripe publishable key', `set${s.accountId ? ` · ${s.accountId}` : ''}`);
      }
      if (!s.webhookSecretPresent) {
        line(r('✗'), 'stripe webhook secret', r('missing — payments will succeed and stay unpaid'));
        todo.push('Set STRIPE_WEBHOOK_SECRET on Render, or every payment silently fails to register');
      } else {
        line(g('✓'), 'stripe webhook secret', 'set');
      }
      if (s.twintCapability && s.twintCapability !== 'active') {
        line(y('!'), 'twint capability', `${s.twintCapability} — senders cannot choose TWINT yet`);
        todo.push(`TWINT capability is "${s.twintCapability}" — it needs the Impressum live and TWINT's review`);
      } else if (s.twintCapability) {
        line(g('✓'), 'twint capability', 'active');
      }
    }

    const tw = j.twilio ?? {};
    line(
      tw.liveCheck === 'ok' ? g('✓') : y('!'),
      'twilio',
      String(tw.liveCheck ?? 'unknown') + (tw.accountType === 'Trial' ? dim('  (trial: whitelisted numbers only)') : ''),
    );
    const re = j.resend ?? {};
    if (!re.apiKeyPresent) {
      line(y('!'), 'resend', 'no key — no email is sent');
      todo.push('Set RESEND_API_KEY on Render — signup and delivery emails are not being sent');
    } else if (re.apiKeyLooksRight === false) {
      line(r('✗'), 'resend', r('key is set but is not a Resend key (re_…) — every email is failing'));
      todo.push('RESEND_API_KEY on Render is not a real key. Get one at resend.com/api-keys; it starts re_');
    } else {
      line(g('✓'), 'resend', 'configured');
    }

    const sender = j.twilioSender;
    if (sender && sender.present && !sender.looksRight) {
      line(r('✗'), 'twilio sender', r(`${sender.kind} — ${sender.note}`));
      todo.push('TWILIO_FROM_NUMBER is not a sender. Use the +41… number or a Messaging Service SID (MG…)');
    } else if (sender && sender.looksRight) {
      line(g('✓'), 'twilio sender', sender.kind);
    }
  }
}

// ── 3. The website ──────────────────────────────────────────────────────────
//
// Netlify is not git-linked: the site is uploaded by hand, so "committed" and
// "deployed" are completely independent here. Comparing content is the only
// way to know, and a marker string is more reliable than a hash because the
// CDN may alter whitespace.
console.log(bold('\nWebsite') + dim(`  ${SITE}`));
const localHtml = readFileSync(join(root, 'website/index.html'), 'utf8');
const live = await get(`${SITE}/index.html`);

if (!live.ok) {
  line(r('✗'), 'reachable', r(live.error || `HTTP ${live.status}`));
  // Two independent services failing at once is far more likely to be this
  // machine's network than both being down. Saying "the API is down" when the
  // wifi is off sends someone to the Render dashboard for nothing.
  if (apiUnreachable) {
    todo.push(
      'Neither the API nor the website answered. Both being down at once is unlikely — ' +
        'check this machine\'s connection first, then Render.',
    );
  }
} else {
  if (apiUnreachable) {
    todo.push('The API is not answering but the website is — check the Render dashboard.');
  }
  line(g('✓'), 'reachable', '');

  // Markers: one per recent change, so a stale deploy says WHICH change is
  // missing rather than just "different".
  const markers = [
    ['CO₂ claim rewritten', 'Transporterfahrt'],
    ['payout condition in FAQ', 'keine Teilzahlung'],
    ['waitlist role fix', 'data-role="sender"'],
  ];
  let stale = 0;
  for (const [label, needle] of markers) {
    const inLocal = localHtml.includes(needle);
    const inLive = live.text.includes(needle);
    if (!inLocal) {
      line(dim('–'), label, dim('marker not in the local file — check this script'));
    } else if (inLive) {
      line(g('✓'), label, 'live');
    } else {
      line(r('✗'), label, r('NOT on the live site'));
      stale += 1;
    }
  }
  if (stale) {
    todo.push(
      `Redeploy the website: ${stale} change(s) are committed but not live. ` +
        'Netlify is not git-linked — drag the website/ folder to app.netlify.com/drop',
    );
  }

  const localHash = createHash('sha256').update(localHtml.replace(/\s+/g, ' ')).digest('hex').slice(0, 8);
  const liveHash = createHash('sha256').update(live.text.replace(/\s+/g, ' ')).digest('hex').slice(0, 8);
  line(
    localHash === liveHash ? g('✓') : y('!'),
    'byte-for-byte',
    localHash === liveHash ? 'identical' : dim(`local ${localHash} · live ${liveHash} (minor drift is normal)`),
  );
}

// ── What to do ──────────────────────────────────────────────────────────────
console.log(dim('\n' + '─'.repeat(70)));
if (!todo.length) {
  console.log(g('\n  Everything committed is deployed, and the integrations answer.\n'));
} else {
  console.log(bold('\n  Next:\n'));
  todo.forEach((t, i) => console.log(`   ${i + 1}. ${t}`));
  console.log('');
}
