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
    offeredSubj: 'Anfrage für deine Route',
    offeredH: '{sender} möchte etwas auf deiner Route mitgeben',
    offeredP: 'Du entscheidest, ob es passt. Nimmst du an, ist die Sendung dir zugeteilt und ihr könnt die Übergabe direkt in der App absprechen.',
    lblItem: 'Sendung',
    declinedSubj: 'Anfrage abgelehnt',
    declinedH: '{driver} kann die Sendung nicht mitnehmen',
    declinedP: 'Deine Lieferung ist wieder offen — andere fahrende Personen sehen sie weiterhin, und du kannst eine andere Route anfragen.',
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
    offeredSubj: 'Request for your route',
    offeredH: '{sender} would like to send something along your route',
    offeredP: 'You decide whether it fits. If you accept, the delivery is yours and you can arrange the handover in the app.',
    lblItem: 'Item',
    declinedSubj: 'Request declined',
    declinedH: '{driver} cannot take this delivery',
    declinedP: 'Your delivery is open again — other drivers can still see it, and you can request a different route.',
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
    offeredSubj: 'Demande pour votre trajet',
    offeredH: '{sender} aimerait envoyer quelque chose sur votre trajet',
    offeredP: 'C’est vous qui décidez. Si vous acceptez, la livraison vous est attribuée et vous pouvez organiser la remise dans l’app.',
    lblItem: 'Envoi',
    declinedSubj: 'Demande refusée',
    declinedH: '{driver} ne peut pas prendre cette livraison',
    declinedP: 'Votre livraison est à nouveau ouverte — d’autres conducteurs la voient toujours et vous pouvez demander un autre trajet.',
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
    offeredSubj: 'Richiesta per il tuo tragitto',
    offeredH: '{sender} vorrebbe mandare qualcosa sul tuo tragitto',
    offeredP: 'Decidi tu se va bene. Se accetti, la consegna è tua e potete concordare la consegna nell’app.',
    lblItem: 'Spedizione',
    declinedSubj: 'Richiesta rifiutata',
    declinedH: '{driver} non può prendere questa consegna',
    declinedP: 'La tua consegna è di nuovo aperta — altri conducenti la vedono ancora e puoi richiedere un altro tragitto.',
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

/**
 * A sender has picked this driver's route and is waiting on them.
 *
 * Goes to the driver, not the sender — this is the one message in the offer
 * flow that asks someone to do something, so it carries the price and what the
 * parcel is, the two things a driver decides on.
 */
export function sendDeliveryOffered(opts: {
  to: string;
  senderName: string;
  route: string;
  priceCHF: number;
  itemDescription?: string | null;
  language?: string | null;
}): void {
  const t = T[lang(opts.language)];
  const body =
    h1(t.offeredH.replace('{sender}', opts.senderName)) +
    p(t.offeredP) +
    facts(
      factRow(t.lblRoute, opts.route) +
        factRow(t.lblPrice, chf(opts.priceCHF)) +
        (opts.itemDescription ? factRow(t.lblItem, opts.itemDescription) : ''),
    );
  queue({ to: opts.to, subject: t.offeredSubj, html: shell(body, t.footer) });
}

/**
 * The driver declined. Deliberately framed as "open again" rather than as a
 * rejection: nothing is lost, the delivery simply returns to the pool.
 */
export function sendOfferDeclined(opts: {
  to: string;
  driverName: string;
  route: string;
  language?: string | null;
}): void {
  const t = T[lang(opts.language)];
  const body =
    h1(t.declinedH.replace('{driver}', opts.driverName)) +
    p(t.declinedP) +
    facts(factRow(t.lblRoute, opts.route));
  queue({ to: opts.to, subject: t.declinedSubj, html: shell(body, t.footer) });
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

/**
 * Tell the RECIPIENT their parcel is on the way, and give them the code.
 *
 * Until this existed, nothing was ever addressed to the recipient — every
 * message went to the sender or the driver. A recipient without a Shlep account
 * therefore had no way to learn the delivery code, and the handover only worked
 * because the sender read it out to them. That is not a system, it is a
 * workaround that happens to hold.
 *
 * Deliberately written for someone who has never heard of Shlep: it explains
 * what is happening and what to do, rather than assuming familiarity.
 */
export function sendRecipientPickedUp(opts: {
  to: string;
  route: string;
  deliveryCode: string;
  senderName?: string | null;
  language?: string | null;
}): void {
  const l = lang(opts.language);
  const copy = {
    de: {
      subj: 'Ein Paket ist für dich unterwegs',
      h: 'Ein Paket ist für dich unterwegs',
      p: opts.senderName
        ? `${opts.senderName} schickt dir etwas über Shlep. Eine verifizierte fahrende Person hat die Sendung übernommen.`
        : 'Jemand schickt dir etwas über Shlep. Eine verifizierte fahrende Person hat die Sendung übernommen.',
      codeLabel: 'Dein Zustellcode',
      how: 'Nenne diesen Code bei der Übergabe. Erst damit gilt die Sendung als zugestellt — er ist dein Nachweis, dass das Paket wirklich bei dir angekommen ist.',
      what: 'Shlep ist ein Schweizer Liefernetz: Menschen nehmen ein Paket auf einer Fahrt mit, die sie ohnehin machen.',
      footer: 'Du erhältst diese Nachricht, weil jemand dir eine Sendung über Shlep geschickt hat.',
    },
    en: {
      subj: 'A parcel is on its way to you',
      h: 'A parcel is on its way to you',
      p: opts.senderName
        ? `${opts.senderName} is sending you something via Shlep. A verified driver has picked it up.`
        : 'Someone is sending you something via Shlep. A verified driver has picked it up.',
      codeLabel: 'Your delivery code',
      how: 'Give this code at handover. Only then does the delivery count as complete — it is your proof the parcel actually reached you.',
      what: 'Shlep is a Swiss delivery network: people take a parcel along on a journey they are already making.',
      footer: 'You received this because someone sent you a parcel via Shlep.',
    },
    fr: {
      subj: 'Un colis est en route pour vous',
      h: 'Un colis est en route pour vous',
      p: opts.senderName
        ? `${opts.senderName} vous envoie quelque chose via Shlep. Un conducteur vérifié a pris le colis en charge.`
        : 'Quelqu\'un vous envoie quelque chose via Shlep. Un conducteur vérifié a pris le colis en charge.',
      codeLabel: 'Votre code de livraison',
      how: 'Communiquez ce code lors de la remise. La livraison n\'est validée qu\'à ce moment — c\'est votre preuve de réception.',
      what: 'Shlep est un réseau de livraison suisse : des personnes emportent un colis sur un trajet qu\'elles font déjà.',
      footer: 'Vous recevez ce message car quelqu\'un vous a envoyé un colis via Shlep.',
    },
    it: {
      subj: 'Un pacco è in arrivo per te',
      h: 'Un pacco è in arrivo per te',
      p: opts.senderName
        ? `${opts.senderName} ti sta inviando qualcosa tramite Shlep. Un autista verificato ha ritirato il pacco.`
        : 'Qualcuno ti sta inviando qualcosa tramite Shlep. Un autista verificato ha ritirato il pacco.',
      codeLabel: 'Il tuo codice di consegna',
      how: 'Comunica questo codice alla consegna. Solo così la consegna è confermata — è la tua prova di ricezione.',
      what: 'Shlep è una rete di consegna svizzera: le persone portano un pacco lungo un tragitto che fanno già.',
      footer: 'Ricevi questo messaggio perché qualcuno ti ha inviato un pacco tramite Shlep.',
    },
  }[l];

  const body =
    h1(copy.h) +
    p(copy.p) +
    facts(factRow(T[l].lblRoute, opts.route)) +
    `<p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${C.ink};">${copy.codeLabel}</p>` +
    codeBlock(opts.deliveryCode) +
    `<p style="margin:0 0 14px;font-size:13px;color:${C.ink2};">${copy.how}</p>` +
    `<p style="margin:0;font-size:12px;color:${C.ink3};">${copy.what}</p>`;

  queue({ to: opts.to, subject: copy.subj, html: shell(body, copy.footer) });
}

/**
 * Tell the recipient a parcel has been created for them — before it moves.
 *
 * Deliberately WITHOUT the delivery code. The code is proof that the parcel
 * actually reached them, so it should exist for as short a time as possible
 * before the handover: an email sent days early gets forwarded, sits in shared
 * inboxes, and is read by whoever else has access. The code follows at pickup,
 * when it is about to be needed.
 *
 * What this message is for instead: telling someone a parcel is coming, and
 * inviting them to create an account so they can follow it.
 */
export function sendRecipientAnnounced(opts: {
  to: string;
  route: string;
  itemDescription?: string | null;
  senderName?: string | null;
  language?: string | null;
}): void {
  const l = lang(opts.language);
  const who = opts.senderName;
  const copy = {
    de: {
      subj: 'Jemand schickt dir ein Paket über Shlep',
      h: 'Ein Paket ist für dich angemeldet',
      p: who
        ? `${who} hat über Shlep eine Sendung an dich aufgegeben. Sobald eine fahrende Person die Strecke übernimmt, informieren wir dich.`
        : 'Jemand hat über Shlep eine Sendung an dich aufgegeben. Sobald eine fahrende Person die Strecke übernimmt, informieren wir dich.',
      lblItem: 'Sendung',
      next: 'Bei der Übergabe nennst du einen Zustellcode. Den schicken wir dir, sobald das Paket abgeholt wurde — nicht vorher, damit er nicht unnötig lange herumliegt.',
      cta: 'Mit einem Shlep-Konto siehst du den Status live und kannst der fahrenden Person schreiben. Dieselbe E-Mail-Adresse verwenden, dann ist die Sendung sofort verknüpft.',
      what: 'Shlep ist ein Schweizer Liefernetz: Menschen nehmen ein Paket auf einer Fahrt mit, die sie ohnehin machen.',
      footer: 'Du erhältst diese Nachricht, weil jemand dir eine Sendung über Shlep geschickt hat.',
    },
    en: {
      subj: 'Someone is sending you a parcel via Shlep',
      h: 'A parcel has been registered for you',
      p: who
        ? `${who} has arranged a delivery to you through Shlep. We will let you know as soon as a driver takes the route.`
        : 'Someone has arranged a delivery to you through Shlep. We will let you know as soon as a driver takes the route.',
      lblItem: 'Item',
      next: 'At handover you give a delivery code. We send it once the parcel has been collected — not before, so it does not sit around longer than needed.',
      cta: 'With a Shlep account you can follow the status live and message the driver. Use this same email address and the delivery links up automatically.',
      what: 'Shlep is a Swiss delivery network: people take a parcel along on a journey they are already making.',
      footer: 'You received this because someone sent you a parcel via Shlep.',
    },
    fr: {
      subj: 'Quelqu\'un vous envoie un colis via Shlep',
      h: 'Un colis a été enregistré pour vous',
      p: who
        ? `${who} a créé une livraison à votre intention via Shlep. Nous vous informerons dès qu'un conducteur prendra le trajet.`
        : 'Quelqu\'un a créé une livraison à votre intention via Shlep. Nous vous informerons dès qu\'un conducteur prendra le trajet.',
      lblItem: 'Envoi',
      next: 'À la remise, vous communiquez un code de livraison. Nous vous l\'enverrons dès que le colis aura été récupéré — pas avant.',
      cta: 'Avec un compte Shlep, vous suivez le statut en direct et pouvez écrire au conducteur. Utilisez cette même adresse e-mail et la livraison sera liée automatiquement.',
      what: 'Shlep est un réseau de livraison suisse : des personnes emportent un colis sur un trajet qu\'elles font déjà.',
      footer: 'Vous recevez ce message car quelqu\'un vous a envoyé un colis via Shlep.',
    },
    it: {
      subj: 'Qualcuno ti sta inviando un pacco tramite Shlep',
      h: 'Un pacco è stato registrato per te',
      p: who
        ? `${who} ha creato una consegna per te tramite Shlep. Ti avviseremo appena un autista prenderà il tragitto.`
        : 'Qualcuno ha creato una consegna per te tramite Shlep. Ti avviseremo appena un autista prenderà il tragitto.',
      lblItem: 'Spedizione',
      next: 'Alla consegna comunicherai un codice. Te lo invieremo appena il pacco sarà stato ritirato — non prima.',
      cta: 'Con un account Shlep segui lo stato in tempo reale e puoi scrivere all\'autista. Usa questo stesso indirizzo e-mail e la consegna verrà collegata automaticamente.',
      what: 'Shlep è una rete di consegna svizzera: le persone portano un pacco lungo un tragitto che fanno già.',
      footer: 'Ricevi questo messaggio perché qualcuno ti ha inviato un pacco tramite Shlep.',
    },
  }[l];

  const rows =
    factRow(T[l].lblRoute, opts.route) +
    (opts.itemDescription ? factRow(copy.lblItem, opts.itemDescription) : '');

  const body =
    h1(copy.h) +
    p(copy.p) +
    facts(rows) +
    `<p style="margin:0 0 14px;font-size:13px;color:${C.ink2};">${copy.next}</p>` +
    `<p style="margin:0 0 14px;font-size:13px;color:${C.ink2};">${copy.cta}</p>` +
    `<p style="margin:0;font-size:12px;color:${C.ink3};">${copy.what}</p>`;

  queue({ to: opts.to, subject: copy.subj, html: shell(body, copy.footer) });
}
