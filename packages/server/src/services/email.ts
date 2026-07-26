import { env } from '../config';

/**
 * Transactional email via Resend.
 *
 * Design rules:
 *  - **Never throws into a request path.** A failed email must not fail a
 *    delivery, a signup or a payout. Everything is fire-and-forget with logging.
 *  - **No-op when unconfigured.** Without RESEND_API_KEY the app runs exactly as
 *    before (useful in dev/CI), it just logs what it would have sent.
 *  - Uses `fetch` directly — no SDK dependency to keep the image small.
 */

const API = 'https://api.resend.com/emails';

export type Lang = 'de' | 'fr' | 'it' | 'en';

function lang(l?: string | null): Lang {
  const v = (l ?? 'de').slice(0, 2).toLowerCase();
  return (['de', 'fr', 'it', 'en'] as const).includes(v as Lang) ? (v as Lang) : 'de';
}

export function isConfigured(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

interface SendInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

async function send({ to, subject, html, replyTo }: SendInput): Promise<void> {
  if (!isConfigured()) {
    console.log(`[email:skipped] ${to} — "${subject}" (RESEND_API_KEY not set)`);
    return;
  }
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email:failed] ${to} — HTTP ${res.status} ${body.slice(0, 300)}`);
      return;
    }
    console.log(`[email:sent] ${to} — "${subject}"`);
  } catch (err) {
    console.error(`[email:error] ${to} —`, (err as Error).message);
  }
}

/** Fire-and-forget: callers never await, never crash on email problems. */
function queue(input: SendInput): void {
  void send(input);
}

// ---------------------------------------------------------------- templates --

const C = {
  paper: '#F3EFE6',
  card: '#FBFAF4',
  ink: '#17160F',
  ink2: '#57534A',
  ink3: '#8a867c',
  accent: '#E0A32E',
  green: '#14532D',
  line: '#E2DCCF',
};

/** Shared shell so every mail looks like the product, not a system alert. */
function shell(bodyHtml: string, footerNote: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td style="padding:22px 26px 0;">
    <span style="font-size:23px;font-weight:800;letter-spacing:-.5px;color:${C.ink};">
      <span style="color:${C.accent};">s</span>hlep
    </span>
  </td></tr>
  <tr><td style="padding:14px 26px 26px;">
    ${bodyHtml}
  </td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr><td style="padding:16px 26px;color:${C.ink3};font-size:12px;line-height:1.5;">
    ${footerNote}<br>
    Shlep · DeltaSci Solutions GmbH · Winterthur · <a href="https://shlep.ch" style="color:${C.ink3};">shlep.ch</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;font-weight:800;letter-spacing:-.4px;color:${C.ink};">${text}</h1>`;
}
function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${C.ink2};">${text}</p>`;
}
function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin:6px 0 4px;background:${C.accent};color:${C.ink};font-weight:700;font-size:15px;text-decoration:none;padding:12px 24px;border-radius:999px;">${label}</a>`;
}
/** Big mono code block for the 6-digit handover codes. */
function codeBlock(code: string): string {
  return `<div style="margin:8px 0 16px;padding:16px;background:${C.paper};border:1px solid ${C.line};border-radius:12px;text-align:center;">
    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:${C.ink};">${code}</div>
  </div>`;
}
function factRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;font-size:14px;color:${C.ink2};">${label}</td>
    <td style="padding:7px 0;font-size:14px;font-weight:700;color:${C.ink};text-align:right;">${value}</td>
  </tr>`;
}
function facts(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 16px;border-top:1px solid ${C.line};">${rows}</table>`;
}

// ------------------------------------------------------------------ copy ----

const T = {
  de: {
    footer: 'Du erhältst diese E-Mail, weil du ein Shlep-Konto hast.',
    welcomeSubj: 'Willkommen bei Shlep',
    welcomeH: 'Willkommen bei Shlep, {name}!',
    welcomeP: 'Dein Konto ist bereit. Du kannst jetzt Pakete verschicken oder auf Fahrten, die du ohnehin machst, etwas mitnehmen.',
    welcomeCta: 'Zu Shlep',
    verifySubj: 'Bestätige deine E-Mail-Adresse',
    verifyH: 'Nur noch ein Klick',
    verifyP: 'Bestätige deine E-Mail-Adresse, damit wir dich über deine Lieferungen informieren können.',
    verifyCta: 'E-Mail bestätigen',
    verifyIgnore: 'Wenn du kein Shlep-Konto erstellt hast, kannst du diese E-Mail ignorieren.',
    matchedSubj: 'Deine Lieferung hat eine fahrende Person',
    matchedH: 'Gefunden — {driver} übernimmt deine Lieferung',
    matchedP: 'Die Zahlung ist autorisiert und wird erst nach der per Code bestätigten Zustellung freigegeben. Du kannst die Fahrt live in der App verfolgen.',
    pickupCodeLabel: 'Dein Abhol-Code',
    pickupCodeP: 'Zeig diesen Code bei der Übergabe — nur damit kann die Abholung bestätigt werden.',
    pickedUpSubj: 'Dein Paket ist unterwegs',
    pickedUpH: 'Abgeholt und unterwegs',
    pickedUpP: 'Dein Paket wurde per Code bestätigt abgeholt. Bei der Zustellung wird der zweite Code benötigt.',
    deliverCodeLabel: 'Dein Zustell-Code',
    deliveredSubj: 'Zugestellt ✓',
    deliveredH: 'Zugestellt — danke!',
    deliveredP: 'Die Übergabe wurde per Code bestätigt und die Zahlung freigegeben.',
    payoutSubj: 'Deine Auszahlung ist unterwegs',
    payoutH: 'Lieferung abgeschlossen',
    payoutP: 'Danke fürs Mitnehmen. Deine Auszahlung wurde ausgelöst.',
    lblRoute: 'Strecke', lblPrice: 'Preis', lblPayout: 'Deine Auszahlung', lblFee: 'Shlep-Gebühr', lblCo2: 'CO₂ gespart',
  },
  en: {
    footer: 'You receive this email because you have a Shlep account.',
    welcomeSubj: 'Welcome to Shlep',
    welcomeH: 'Welcome to Shlep, {name}!',
    welcomeP: 'Your account is ready. You can now send parcels, or carry one along on a trip you are already making.',
    welcomeCta: 'Open Shlep',
    verifySubj: 'Confirm your email address',
    verifyH: 'One more click',
    verifyP: 'Confirm your email address so we can keep you posted on your deliveries.',
    verifyCta: 'Confirm email',
    verifyIgnore: 'If you did not create a Shlep account, you can ignore this email.',
    matchedSubj: 'Your delivery has a driver',
    matchedH: 'Matched — {driver} is taking your delivery',
    matchedP: 'Payment is authorised and only released after a code-verified drop-off. You can follow the trip live in the app.',
    pickupCodeLabel: 'Your pickup code',
    pickupCodeP: 'Show this code at handover — it is the only way pickup can be confirmed.',
    pickedUpSubj: 'Your parcel is on its way',
    pickedUpH: 'Picked up and on the road',
    pickedUpP: 'Your parcel was picked up with a verified code. The second code is needed at drop-off.',
    deliverCodeLabel: 'Your delivery code',
    deliveredSubj: 'Delivered ✓',
    deliveredH: 'Delivered — thank you!',
    deliveredP: 'The handover was confirmed by code and the payment released.',
    payoutSubj: 'Your payout is on its way',
    payoutH: 'Delivery complete',
    payoutP: 'Thanks for carrying it. Your payout has been triggered.',
    lblRoute: 'Route', lblPrice: 'Price', lblPayout: 'Your payout', lblFee: 'Shlep fee', lblCo2: 'CO₂ saved',
  },
  fr: {
    footer: 'Vous recevez cet e-mail car vous avez un compte Shlep.',
    welcomeSubj: 'Bienvenue chez Shlep',
    welcomeH: 'Bienvenue chez Shlep, {name} !',
    welcomeP: 'Votre compte est prêt. Vous pouvez envoyer des colis ou en emporter un sur un trajet que vous faites déjà.',
    welcomeCta: 'Ouvrir Shlep',
    verifySubj: 'Confirmez votre adresse e-mail',
    verifyH: 'Encore un clic',
    verifyP: 'Confirmez votre adresse e-mail pour recevoir les informations sur vos livraisons.',
    verifyCta: 'Confirmer l’e-mail',
    verifyIgnore: 'Si vous n’avez pas créé de compte Shlep, ignorez cet e-mail.',
    matchedSubj: 'Votre livraison a un conducteur',
    matchedH: 'Trouvé — {driver} prend votre livraison',
    matchedP: 'Le paiement est autorisé et libéré seulement après une remise confirmée par code. Suivez le trajet en direct dans l’app.',
    pickupCodeLabel: 'Votre code d’enlèvement',
    pickupCodeP: 'Montrez ce code lors de la remise — c’est le seul moyen de confirmer l’enlèvement.',
    pickedUpSubj: 'Votre colis est en route',
    pickedUpH: 'Enlevé et en route',
    pickedUpP: 'Votre colis a été enlevé avec un code vérifié. Le second code sera demandé à la livraison.',
    deliverCodeLabel: 'Votre code de livraison',
    deliveredSubj: 'Livré ✓',
    deliveredH: 'Livré — merci !',
    deliveredP: 'La remise a été confirmée par code et le paiement libéré.',
    payoutSubj: 'Votre versement est en route',
    payoutH: 'Livraison terminée',
    payoutP: 'Merci de l’avoir emporté. Votre versement a été déclenché.',
    lblRoute: 'Trajet', lblPrice: 'Prix', lblPayout: 'Votre versement', lblFee: 'Commission Shlep', lblCo2: 'CO₂ économisé',
  },
  it: {
    footer: 'Ricevi questa e-mail perché hai un account Shlep.',
    welcomeSubj: 'Benvenuto su Shlep',
    welcomeH: 'Benvenuto su Shlep, {name}!',
    welcomeP: 'Il tuo account è pronto. Ora puoi spedire pacchi o portarne uno su un tragitto che fai comunque.',
    welcomeCta: 'Apri Shlep',
    verifySubj: 'Conferma il tuo indirizzo e-mail',
    verifyH: 'Ancora un clic',
    verifyP: 'Conferma il tuo indirizzo e-mail così possiamo informarti sulle tue consegne.',
    verifyCta: 'Conferma e-mail',
    verifyIgnore: 'Se non hai creato un account Shlep, ignora questa e-mail.',
    matchedSubj: 'La tua consegna ha un conducente',
    matchedH: 'Trovato — {driver} prende la tua consegna',
    matchedP: 'Il pagamento è autorizzato e viene liberato solo dopo una consegna confermata con codice. Segui il tragitto live nell’app.',
    pickupCodeLabel: 'Il tuo codice di ritiro',
    pickupCodeP: 'Mostra questo codice alla consegna — è l’unico modo per confermare il ritiro.',
    pickedUpSubj: 'Il tuo pacco è in viaggio',
    pickedUpH: 'Ritirato e in viaggio',
    pickedUpP: 'Il tuo pacco è stato ritirato con codice verificato. Il secondo codice serve alla consegna.',
    deliverCodeLabel: 'Il tuo codice di consegna',
    deliveredSubj: 'Consegnato ✓',
    deliveredH: 'Consegnato — grazie!',
    deliveredP: 'La consegna è stata confermata con codice e il pagamento liberato.',
    payoutSubj: 'Il tuo pagamento è in arrivo',
    payoutH: 'Consegna completata',
    payoutP: 'Grazie per averlo portato. Il tuo pagamento è stato avviato.',
    lblRoute: 'Tragitto', lblPrice: 'Prezzo', lblPayout: 'Il tuo pagamento', lblFee: 'Commissione Shlep', lblCo2: 'CO₂ risparmiata',
  },
} as const;

const chf = (n: number) => `CHF ${n.toFixed(2)}`;

// ------------------------------------------------------------- public API ---

export function sendWelcome(opts: { to: string; firstName: string; language?: string | null }): void {
  const t = T[lang(opts.language)];
  queue({
    to: opts.to,
    subject: t.welcomeSubj,
    html: shell(
      h1(t.welcomeH.replace('{name}', opts.firstName)) + p(t.welcomeP) + button('https://shlep.ch', t.welcomeCta),
      t.footer,
    ),
  });
}

export function sendEmailVerification(opts: {
  to: string;
  verifyUrl: string;
  language?: string | null;
}): void {
  const t = T[lang(opts.language)];
  queue({
    to: opts.to,
    subject: t.verifySubj,
    html: shell(
      h1(t.verifyH) + p(t.verifyP) + button(opts.verifyUrl, t.verifyCta) +
        `<p style="margin:16px 0 0;font-size:12.5px;color:${C.ink3};">${t.verifyIgnore}</p>`,
      t.footer,
    ),
  });
}

export function sendDeliveryMatched(opts: {
  to: string;
  driverName: string;
  route: string;
  priceCHF: number;
  pickupCode?: string | null;
  language?: string | null;
}): void {
  const t = T[lang(opts.language)];
  const body =
    h1(t.matchedH.replace('{driver}', opts.driverName)) +
    p(t.matchedP) +
    facts(factRow(t.lblRoute, opts.route) + factRow(t.lblPrice, chf(opts.priceCHF))) +
    (opts.pickupCode
      ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${C.ink};">${t.pickupCodeLabel}</p>` +
        codeBlock(opts.pickupCode) +
        `<p style="margin:0;font-size:13px;color:${C.ink3};">${t.pickupCodeP}</p>`
      : '');
  queue({ to: opts.to, subject: t.matchedSubj, html: shell(body, t.footer) });
}

export function sendPickedUp(opts: {
  to: string;
  route: string;
  deliveryCode?: string | null;
  language?: string | null;
}): void {
  const t = T[lang(opts.language)];
  const body =
    h1(t.pickedUpH) +
    p(t.pickedUpP) +
    facts(factRow(t.lblRoute, opts.route)) +
    (opts.deliveryCode
      ? `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${C.ink};">${t.deliverCodeLabel}</p>` +
        codeBlock(opts.deliveryCode)
      : '');
  queue({ to: opts.to, subject: t.pickedUpSubj, html: shell(body, t.footer) });
}

export function sendDelivered(opts: {
  to: string;
  route: string;
  priceCHF: number;
  co2SavedKg?: number | null;
  language?: string | null;
}): void {
  const t = T[lang(opts.language)];
  const rows =
    factRow(t.lblRoute, opts.route) +
    factRow(t.lblPrice, chf(opts.priceCHF)) +
    (opts.co2SavedKg ? factRow(t.lblCo2, `${opts.co2SavedKg} kg`) : '');
  queue({
    to: opts.to,
    subject: t.deliveredSubj,
    html: shell(h1(t.deliveredH) + p(t.deliveredP) + facts(rows), t.footer),
  });
}

export function sendDriverPayout(opts: {
  to: string;
  route: string;
  payoutCHF: number;
  feeCHF: number;
  language?: string | null;
}): void {
  const t = T[lang(opts.language)];
  const rows =
    factRow(t.lblRoute, opts.route) +
    factRow(t.lblPayout, chf(opts.payoutCHF)) +
    factRow(t.lblFee, chf(opts.feeCHF));
  queue({
    to: opts.to,
    subject: t.payoutSubj,
    html: shell(h1(t.payoutH) + p(t.payoutP) + facts(rows), t.footer),
  });
}

/** Plain internal notification (waitlist, contact form, ops alerts). */
export function sendInternal(opts: { subject: string; lines: Record<string, unknown>; replyTo?: string }): void {
  const rows = Object.entries(opts.lines)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => factRow(k, String(v)))
    .join('');
  queue({
    to: env.EMAIL_INTERNAL_TO,
    subject: opts.subject,
    replyTo: opts.replyTo,
    html: shell(h1(opts.subject) + facts(rows), 'Interne Benachrichtigung von shlep.ch'),
  });
}
