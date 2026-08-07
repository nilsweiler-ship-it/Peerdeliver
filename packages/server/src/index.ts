import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config';
import { errorHandler, apiLimiter } from './middleware';
import routes from './routes';
import { setupSocket } from './socket';
import { stripeWebhook } from './controllers/webhook';
import { webhook as payrexxWebhook } from './controllers/payrexx';

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);
app.use(cors());

// Payment webhooks need the raw body for signature checks — mount BEFORE express.json().
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.post('/webhooks/payrexx', express.raw({ type: '*/*' }), payrexxWebhook);

app.use(express.json());
app.use(apiLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Integration self-test.
 *
 * Reading Render's logs to find out why an SMS failed turned out to be
 * unreliable — a log line that is never written looks identical to one that
 * cannot be found. This asks the live service instead: is Twilio configured at
 * all, and do the credentials and Service SID actually work?
 *
 * Deliberately leaks nothing. No SIDs, no tokens, no phone numbers — only
 * booleans and a coarse verdict. It sends no SMS, so it cannot be abused to
 * bill the account or to probe whether a number exists.
 */
app.get('/health/integrations', async (_req, res) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

  const twilio: Record<string, unknown> = {
    accountSidPresent: Boolean(sid),
    authTokenPresent: Boolean(token),
    verifyServiceSidPresent: Boolean(verifySid),
    // A Verify Service SID starts with "VA". Pasting the Messaging Service
    // (MG) or Account (AC) SID is the single most common setup mistake and
    // produces a 20404 that reads like a generic failure.
    verifyServiceSidLooksRight: verifySid ? verifySid.startsWith('VA') : false,
    senderConfigured: Boolean(process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_SENDER_ID),
  };

  if (sid && token && verifySid) {
    try {
      const auth = Buffer.from(`${sid}:${token}`).toString('base64');
      const r = await fetch(`https://verify.twilio.com/v2/Services/${verifySid}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (r.ok) {
        twilio.liveCheck = 'ok';

        // Credentials being valid does not mean sending works. A trial account
        // refuses every destination that is not on its Verified Caller IDs
        // list — which looks exactly like a generic send failure. Report the
        // account type and how many numbers are whitelisted, never which ones.
        try {
          const acct = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, {
            headers: { Authorization: `Basic ${auth}` },
          });
          if (acct.ok) {
            const a = (await acct.json()) as { type?: string; status?: string };
            twilio.accountType = a.type; // "Trial" or "Full"
            twilio.accountStatus = a.status;
            if (a.type === 'Trial') {
              const ids = await fetch(
                `https://api.twilio.com/2010-04-01/Accounts/${sid}/OutgoingCallerIds.json?PageSize=50`,
                { headers: { Authorization: `Basic ${auth}` } },
              );
              if (ids.ok) {
                const j = (await ids.json()) as { outgoing_caller_ids?: unknown[] };
                twilio.verifiedCallerIdCount = j.outgoing_caller_ids?.length ?? 0;
              }
              twilio.note =
                'Trial account: SMS is delivered only to numbers on the Verified Caller IDs list.';
            }
          }
        } catch {
          /* account lookup is a nice-to-have; never fail the health check on it */
        }
      } else if (r.status === 401) {
        twilio.liveCheck = 'auth_failed — Account SID or Auth Token is wrong';
      } else if (r.status === 404) {
        twilio.liveCheck = 'service_not_found — TWILIO_VERIFY_SERVICE_SID is wrong';
      } else {
        twilio.liveCheck = `unexpected_${r.status}`;
      }
    } catch (err) {
      twilio.liveCheck = `unreachable — ${err instanceof Error ? err.message : 'error'}`;
    }
  } else {
    // This is the quiet failure mode: unconfigured, sendCode returns
    // { ok: true, simulated: true }, no SMS is sent and no error is shown.
    twilio.liveCheck = 'not_configured — codes are simulated, no SMS is sent';
  }

  res.json({
    env: env.NODE_ENV,
    twilio,
    resend: { apiKeyPresent: Boolean(process.env.RESEND_API_KEY) },
    payrexx: {
      instancePresent: Boolean(process.env.PAYREXX_INSTANCE),
      // Payrexx calls this the "API Secret" in its dashboard, and so does the
      // rest of this codebase. An earlier version of this check read
      // PAYREXX_API_KEY — a name used nowhere else — and so reported a
      // correctly configured integration as broken.
      apiSecretPresent: Boolean(process.env.PAYREXX_API_SECRET),
      webhookSecretPresent: Boolean(process.env.PAYREXX_WEBHOOK_SECRET),
    },
    timestamp: new Date().toISOString(),
  });
});

app.use('/api', routes);

app.use(errorHandler);

setupSocket(httpServer);

httpServer.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${env.PORT}`);
});
