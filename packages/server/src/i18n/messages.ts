/**
 * Server messages in the user's language.
 *
 * The server's user-facing errors are written once (mostly in German, some
 * in English) and the app shows them as they come — so the app in English,
 * French or Italian answered in German ("Bitte bestätige zuerst …"). The app
 * now sends Accept-Language; errorHandler and validate() pass every message
 * through `localize`, which looks it up here.
 *
 * - A message not in this table goes out unchanged (internal and dev-only
 *   messages stay as written).
 * - No Accept-Language → unchanged too, so scripts and older app builds see
 *   exactly what they saw before.
 * - Add a line here whenever a new user-facing message is written. Keys are
 *   the exact source text; templated messages are regexes, with $1, $2 … in
 *   the translations.
 */

export type Lang = 'de' | 'en' | 'fr' | 'it';
type T = Record<Lang, string>;

const EXACT: Record<string, T> = {
  // ── Driving: who may take a job ─────────────────────────────────────────
  'Bitte bestätige zuerst deine Identität und deine Telefonnummer, bevor du Lieferungen übernimmst.': {
    de: 'Bitte bestätige zuerst deine Identität und deine Telefonnummer, bevor du Lieferungen übernimmst.',
    en: 'Please confirm your identity and phone number before you take deliveries.',
    fr: 'Veuillez d’abord confirmer votre identité et votre numéro de téléphone avant d’accepter des livraisons.',
    it: 'Prima di accettare consegne, conferma la tua identità e il tuo numero di telefono.',
  },
  'Bitte bestätige zuerst deine Telefonnummer, bevor du Lieferungen übernimmst.': {
    de: 'Bitte bestätige zuerst deine Telefonnummer, bevor du Lieferungen übernimmst.',
    en: 'Please confirm your phone number before you take deliveries.',
    fr: 'Veuillez d’abord confirmer votre numéro de téléphone avant d’accepter des livraisons.',
    it: 'Prima di accettare consegne, conferma il tuo numero di telefono.',
  },
  'Complete payout setup before accepting deliveries': {
    de: 'Richte zuerst deine Auszahlung ein, bevor du Lieferungen übernimmst.',
    en: 'Set up your payouts before you take deliveries.',
    fr: 'Configurez d’abord vos versements avant d’accepter des livraisons.',
    it: 'Prima di accettare consegne, configura i tuoi pagamenti.',
  },
  'Diese Sendung ist noch nicht bezahlt': {
    de: 'Diese Sendung ist noch nicht bezahlt.',
    en: 'This parcel hasn’t been paid for yet.',
    fr: 'Cet envoi n’est pas encore payé.',
    it: 'Questa spedizione non è ancora stata pagata.',
  },
  'Du kannst deine eigene Sendung nicht übernehmen': {
    de: 'Du kannst deine eigene Sendung nicht übernehmen.',
    en: 'You can’t take your own parcel.',
    fr: 'Vous ne pouvez pas prendre votre propre envoi.',
    it: 'Non puoi prendere la tua stessa spedizione.',
  },
  'Dieses Paket passt nicht in dein Fahrzeug': {
    de: 'Dieses Paket passt nicht in dein Fahrzeug.',
    en: 'This parcel doesn’t fit in your vehicle.',
    fr: 'Ce colis ne rentre pas dans votre véhicule.',
    it: 'Questo pacco non entra nel tuo veicolo.',
  },
  'Dieses Paket ist schwerer, als du laden kannst': {
    de: 'Dieses Paket ist schwerer, als du laden kannst.',
    en: 'This parcel is heavier than you can carry.',
    fr: 'Ce colis est plus lourd que ce que vous pouvez transporter.',
    it: 'Questo pacco è più pesante di quanto puoi caricare.',
  },
  'Diese Lieferung wurde soeben schon vergeben': {
    de: 'Diese Lieferung wurde soeben schon vergeben.',
    en: 'Someone else just took this delivery.',
    fr: 'Cette livraison vient d’être attribuée à quelqu’un d’autre.',
    it: 'Questa consegna è appena stata assegnata a qualcun altro.',
  },
  'Diese Lieferung hat sich inzwischen geändert': {
    de: 'Diese Lieferung hat sich inzwischen geändert. Bitte lade sie neu.',
    en: 'This delivery has changed in the meantime. Please refresh.',
    fr: 'Cette livraison a changé entre-temps. Veuillez actualiser.',
    it: 'Questa consegna è cambiata nel frattempo. Aggiorna la pagina.',
  },
  'Diese Lieferung wurde bereits abgeschlossen': {
    de: 'Diese Lieferung wurde bereits abgeschlossen.',
    en: 'This delivery has already been completed.',
    fr: 'Cette livraison est déjà terminée.',
    it: 'Questa consegna è già stata completata.',
  },
  'Diese Lieferung ist bereits abgeschlossen.': {
    de: 'Diese Lieferung ist bereits abgeschlossen.',
    en: 'This delivery is already finished.',
    fr: 'Cette livraison est déjà terminée.',
    it: 'Questa consegna è già conclusa.',
  },
  'Diese Lieferung ist nicht mehr offen': {
    de: 'Diese Lieferung ist nicht mehr offen.',
    en: 'This delivery is no longer open.',
    fr: 'Cette livraison n’est plus ouverte.',
    it: 'Questa consegna non è più aperta.',
  },
  'Diese Sendung ist nicht mehr offen': {
    de: 'Diese Sendung ist nicht mehr offen.',
    en: 'This parcel is no longer open.',
    fr: 'Cet envoi n’est plus ouvert.',
    it: 'Questa spedizione non è più aperta.',
  },
  'Diese Anfrage ist nicht mehr offen': {
    de: 'Diese Anfrage ist nicht mehr offen.',
    en: 'This request is no longer open.',
    fr: 'Cette demande n’est plus ouverte.',
    it: 'Questa richiesta non è più aperta.',
  },
  'Diese Lieferung hat bereits eine fahrende Person': {
    de: 'Diese Lieferung hat bereits eine fahrende Person.',
    en: 'This delivery already has a driver.',
    fr: 'Cette livraison a déjà un chauffeur.',
    it: 'Questa consegna ha già un conducente.',
  },
  'Diese Lieferung wartet bereits auf eine Antwort': {
    de: 'Diese Lieferung wartet bereits auf eine Antwort.',
    en: 'This delivery is already waiting for a reply.',
    fr: 'Cette livraison attend déjà une réponse.',
    it: 'Questa consegna è già in attesa di una risposta.',
  },
  'Die fahrende Person hat inzwischen geantwortet': {
    de: 'Die fahrende Person hat inzwischen geantwortet.',
    en: 'The driver has replied in the meantime.',
    fr: 'Le chauffeur a répondu entre-temps.',
    it: 'Il conducente ha risposto nel frattempo.',
  },
  'Diese Route ist nicht mehr aktiv': {
    de: 'Diese Route ist nicht mehr aktiv.',
    en: 'This route is no longer active.',
    fr: 'Cet itinéraire n’est plus actif.',
    it: 'Questo percorso non è più attivo.',
  },
  'Diese Route hat nicht genug Platz für dieses Paket': {
    de: 'Diese Route hat nicht genug Platz für dieses Paket.',
    en: 'This route doesn’t have room for this parcel.',
    fr: 'Cet itinéraire n’a pas assez de place pour ce colis.',
    it: 'Questo percorso non ha spazio per questo pacco.',
  },
  'Dieses Paket ist schwerer, als diese Route tragen kann': {
    de: 'Dieses Paket ist schwerer, als diese Route tragen kann.',
    en: 'This parcel is heavier than this route can carry.',
    fr: 'Ce colis est plus lourd que ce que cet itinéraire peut transporter.',
    it: 'Questo pacco è più pesante di quanto questo percorso possa portare.',
  },
  'Du kannst deine eigene Route nicht anfragen': {
    de: 'Du kannst deine eigene Route nicht anfragen.',
    en: 'You can’t book your own route.',
    fr: 'Vous ne pouvez pas réserver votre propre itinéraire.',
    it: 'Non puoi prenotare il tuo stesso percorso.',
  },
  'Diese fahrende Person kann im Moment keine Lieferungen übernehmen': {
    de: 'Diese fahrende Person kann im Moment keine Lieferungen übernehmen.',
    en: 'This driver can’t take deliveries right now.',
    fr: 'Ce chauffeur ne peut pas accepter de livraisons pour le moment.',
    it: 'Questo conducente al momento non può accettare consegne.',
  },
  'Bitte bezahle die Sendung, bevor du sie anbietest': {
    de: 'Bitte bezahle die Sendung, bevor du sie anbietest.',
    en: 'Please pay for the parcel before offering it to a driver.',
    fr: 'Veuillez payer l’envoi avant de le proposer à un chauffeur.',
    it: 'Paga la spedizione prima di proporla a un conducente.',
  },
  'Route nicht gefunden': {
    de: 'Route nicht gefunden.',
    en: 'Route not found.',
    fr: 'Itinéraire introuvable.',
    it: 'Percorso non trovato.',
  },
  'Delivery not found': {
    de: 'Lieferung nicht gefunden.',
    en: 'Delivery not found.',
    fr: 'Livraison introuvable.',
    it: 'Consegna non trovata.',
  },
  'Not authorized': {
    de: 'Dafür hast du keine Berechtigung.',
    en: 'You’re not allowed to do that.',
    fr: 'Vous n’êtes pas autorisé à faire cela.',
    it: 'Non hai l’autorizzazione per farlo.',
  },
  'Only the driver can accept': {
    de: 'Nur die fahrende Person kann annehmen.',
    en: 'Only the driver can accept.',
    fr: 'Seul le chauffeur peut accepter.',
    it: 'Solo il conducente può accettare.',
  },

  // ── Handover codes ──────────────────────────────────────────────────────
  'Invalid pickup code': {
    de: 'Der Abholcode stimmt nicht.',
    en: 'That pickup code isn’t right.',
    fr: 'Ce code de retrait n’est pas correct.',
    it: 'Il codice di ritiro non è corretto.',
  },
  'Invalid delivery code': {
    de: 'Der Liefercode stimmt nicht.',
    en: 'That delivery code isn’t right.',
    fr: 'Ce code de livraison n’est pas correct.',
    it: 'Il codice di consegna non è corretto.',
  },
  'Zu viele falsche Codes. Die Code-Eingabe ist vorübergehend gesperrt.': {
    de: 'Zu viele falsche Codes. Die Code-Eingabe ist vorübergehend gesperrt.',
    en: 'Too many wrong codes. Code entry is locked for a while.',
    fr: 'Trop de codes erronés. La saisie du code est temporairement bloquée.',
    it: 'Troppi codici errati. L’inserimento del codice è temporaneamente bloccato.',
  },
  'Delivery is not in transit': {
    de: 'Diese Lieferung ist nicht unterwegs.',
    en: 'This delivery isn’t on its way.',
    fr: 'Cette livraison n’est pas en cours d’acheminement.',
    it: 'Questa consegna non è in viaggio.',
  },
  'Delivery is not in accepted state': {
    de: 'Diese Lieferung ist noch nicht zur Abholung bereit.',
    en: 'This delivery isn’t ready for pickup.',
    fr: 'Cette livraison n’est pas prête pour le retrait.',
    it: 'Questa consegna non è pronta per il ritiro.',
  },

  // ── Cancelling ──────────────────────────────────────────────────────────
  'Das Paket wurde bereits abgeholt und kann nicht mehr storniert werden. Melde stattdessen ein Problem.': {
    de: 'Das Paket wurde bereits abgeholt und kann nicht mehr storniert werden. Melde stattdessen ein Problem.',
    en: 'The parcel has already been collected and can’t be cancelled. Report a problem instead.',
    fr: 'Le colis a déjà été récupéré et ne peut plus être annulé. Signalez plutôt un problème.',
    it: 'Il pacco è già stato ritirato e non può essere annullato. Segnala invece un problema.',
  },
  'Nur die sendende oder die fahrende Person kann eine Lieferung stornieren': {
    de: 'Nur die sendende oder die fahrende Person kann eine Lieferung stornieren.',
    en: 'Only the sender or the driver can cancel a delivery.',
    fr: 'Seul l’expéditeur ou le chauffeur peut annuler une livraison.',
    it: 'Solo il mittente o il conducente può annullare una consegna.',
  },
  'Nur eine offene Anfrage kann abgelehnt werden': {
    de: 'Nur eine offene Anfrage kann abgelehnt werden.',
    en: 'Only an open request can be declined.',
    fr: 'Seule une demande ouverte peut être refusée.',
    it: 'Solo una richiesta aperta può essere rifiutata.',
  },

  // ── Disputes and ratings ────────────────────────────────────────────────
  'Bitte beschreibe kurz, was passiert ist (mindestens 10 Zeichen).': {
    de: 'Bitte beschreibe kurz, was passiert ist (mindestens 10 Zeichen).',
    en: 'Please describe briefly what happened (at least 10 characters).',
    fr: 'Décrivez brièvement ce qui s’est passé (10 caractères minimum).',
    it: 'Descrivi brevemente cosa è successo (almeno 10 caratteri).',
  },
  'Bitte fasse dich kürzer (höchstens 1000 Zeichen).': {
    de: 'Bitte fasse dich kürzer (höchstens 1000 Zeichen).',
    en: 'Please keep it shorter (at most 1000 characters).',
    fr: 'Veuillez être plus bref (1000 caractères maximum).',
    it: 'Sii più breve (massimo 1000 caratteri).',
  },
  'Zu dieser Lieferung ist bereits eine Meldung offen. Unser Support meldet sich.': {
    de: 'Zu dieser Lieferung ist bereits eine Meldung offen. Unser Support meldet sich.',
    en: 'A report is already open for this delivery. Our support team will be in touch.',
    fr: 'Un signalement est déjà ouvert pour cette livraison. Notre support vous contactera.',
    it: 'Per questa consegna c’è già una segnalazione aperta. Il nostro supporto ti contatterà.',
  },
  'Zu dieser Lieferung gab es bereits eine Meldung. Bitte schreib uns an hello@shlep.ch.': {
    de: 'Zu dieser Lieferung gab es bereits eine Meldung. Bitte schreib uns an hello@shlep.ch.',
    en: 'This delivery has already been reported once. Please write to hello@shlep.ch.',
    fr: 'Cette livraison a déjà été signalée. Écrivez-nous à hello@shlep.ch.',
    it: 'Questa consegna è già stata segnalata. Scrivici a hello@shlep.ch.',
  },
  'Vor der Abholung kannst du die Sendung einfach stornieren; danach hilft dir diese Meldung.': {
    de: 'Vor der Abholung kannst du die Sendung einfach stornieren; danach hilft dir diese Meldung.',
    en: 'Before pickup you can simply cancel; this report is for problems after pickup.',
    fr: 'Avant le retrait, vous pouvez simplement annuler ; ce signalement sert après le retrait.',
    it: 'Prima del ritiro puoi semplicemente annullare; questa segnalazione serve dopo il ritiro.',
  },
  'Bitte vergib 1 bis 5 Sterne.': {
    de: 'Bitte vergib 1 bis 5 Sterne.',
    en: 'Please give 1 to 5 stars.',
    fr: 'Veuillez attribuer de 1 à 5 étoiles.',
    it: 'Assegna da 1 a 5 stelle.',
  },
  'Der Kommentar ist zu lang (höchstens 1000 Zeichen).': {
    de: 'Der Kommentar ist zu lang (höchstens 1000 Zeichen).',
    en: 'The comment is too long (at most 1000 characters).',
    fr: 'Le commentaire est trop long (1000 caractères maximum).',
    it: 'Il commento è troppo lungo (massimo 1000 caratteri).',
  },
  'Bewerten kannst du nach der Zustellung.': {
    de: 'Bewerten kannst du nach der Zustellung.',
    en: 'You can rate once the parcel has been delivered.',
    fr: 'Vous pourrez évaluer après la livraison.',
    it: 'Potrai valutare dopo la consegna.',
  },
  'Du hast diese Lieferung bereits bewertet.': {
    de: 'Du hast diese Lieferung bereits bewertet.',
    en: 'You’ve already rated this delivery.',
    fr: 'Vous avez déjà évalué cette livraison.',
    it: 'Hai già valutato questa consegna.',
  },
  'Die sendende Person bewertet diese Lieferung.': {
    de: 'Die sendende Person bewertet diese Lieferung.',
    en: 'The sender rates this delivery.',
    fr: 'C’est l’expéditeur qui évalue cette livraison.',
    it: 'È il mittente a valutare questa consegna.',
  },
  'Hier gibt es niemanden zu bewerten.': {
    de: 'Hier gibt es niemanden zu bewerten.',
    en: 'There’s no one to rate here.',
    fr: 'Il n’y a personne à évaluer ici.',
    it: 'Qui non c’è nessuno da valutare.',
  },

  // ── Account ─────────────────────────────────────────────────────────────
  'Bitte akzeptiere die AGB und die Datenschutzerklärung.': {
    de: 'Bitte akzeptiere die AGB und die Datenschutzerklärung.',
    en: 'Please accept the terms and the privacy policy.',
    fr: 'Veuillez accepter les CG et la politique de confidentialité.',
    it: 'Accetta le CG e l’informativa sulla privacy.',
  },
  'Email already registered': {
    de: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
    en: 'There’s already an account for this email address.',
    fr: 'Un compte existe déjà pour cette adresse e-mail.',
    it: 'Esiste già un account per questo indirizzo e-mail.',
  },
  'Invalid email or password': {
    de: 'E-Mail oder Passwort stimmen nicht.',
    en: 'Email or password is incorrect.',
    fr: 'E-mail ou mot de passe incorrect.',
    it: 'E-mail o password non corretti.',
  },
  'Du hast noch laufende Lieferungen. Schliesse sie ab oder storniere sie, bevor du dein Konto löschst.': {
    de: 'Du hast noch laufende Lieferungen. Schliesse sie ab oder storniere sie, bevor du dein Konto löschst.',
    en: 'You still have deliveries in progress. Finish or cancel them before deleting your account.',
    fr: 'Vous avez encore des livraisons en cours. Terminez-les ou annulez-les avant de supprimer votre compte.',
    it: 'Hai ancora consegne in corso. Concludile o annullale prima di eliminare il tuo account.',
  },
  'Enter a valid Swiss plate, e.g. ZH 123456': {
    de: 'Gib ein gültiges Schweizer Kennzeichen ein, z. B. ZH 123456.',
    en: 'Enter a valid Swiss plate, e.g. ZH 123456.',
    fr: 'Saisissez une plaque suisse valide, p. ex. ZH 123456.',
    it: 'Inserisci una targa svizzera valida, ad es. ZH 123456.',
  },
  'Enter a valid phone number': {
    de: 'Gib eine gültige Telefonnummer ein.',
    en: 'Enter a valid phone number.',
    fr: 'Saisissez un numéro de téléphone valide.',
    it: 'Inserisci un numero di telefono valido.',
  },
  'Bitte gib eine gültige Telefonnummer ein': {
    de: 'Bitte gib eine gültige Telefonnummer ein.',
    en: 'Please enter a valid phone number.',
    fr: 'Veuillez saisir un numéro de téléphone valide.',
    it: 'Inserisci un numero di telefono valido.',
  },
  'Bitte gib den Code aus der SMS ein': {
    de: 'Bitte gib den Code aus der SMS ein.',
    en: 'Please enter the code from the text message.',
    fr: 'Veuillez saisir le code reçu par SMS.',
    it: 'Inserisci il codice ricevuto via SMS.',
  },
  'Bitte bestätige deine Nummer per SMS-Code': {
    de: 'Bitte bestätige deine Nummer per SMS-Code.',
    en: 'Please confirm your number with the code we texted you.',
    fr: 'Veuillez confirmer votre numéro avec le code reçu par SMS.',
    it: 'Conferma il tuo numero con il codice ricevuto via SMS.',
  },
  'Bitte bestätige deine Identität über die Ausweisprüfung': {
    de: 'Bitte bestätige deine Identität über die Ausweisprüfung.',
    en: 'Please confirm your identity with the ID check.',
    fr: 'Veuillez confirmer votre identité via la vérification de la pièce d’identité.',
    it: 'Conferma la tua identità tramite la verifica del documento.',
  },
  'Diese Nummer sieht nicht gültig aus. Bitte prüfe sie.': {
    de: 'Diese Nummer sieht nicht gültig aus. Bitte prüfe sie.',
    en: 'This number doesn’t look valid. Please check it.',
    fr: 'Ce numéro ne semble pas valide. Veuillez le vérifier.',
    it: 'Questo numero non sembra valido. Controllalo.',
  },
  'Zu viele Versuche. Bitte warte einen Moment.': {
    de: 'Zu viele Versuche. Bitte warte einen Moment.',
    en: 'Too many attempts. Please wait a moment.',
    fr: 'Trop de tentatives. Veuillez patienter un instant.',
    it: 'Troppi tentativi. Attendi un momento.',
  },
  'Der Code ist abgelaufen. Fordere einen neuen an.': {
    de: 'Der Code ist abgelaufen. Fordere einen neuen an.',
    en: 'The code has expired. Request a new one.',
    fr: 'Le code a expiré. Demandez-en un nouveau.',
    it: 'Il codice è scaduto. Richiedine uno nuovo.',
  },
  'Der Code stimmt nicht.': {
    de: 'Der Code stimmt nicht.',
    en: 'That code isn’t right.',
    fr: 'Ce code n’est pas correct.',
    it: 'Il codice non è corretto.',
  },
  'An diese Nummer kann keine SMS zugestellt werden (Festnetz).': {
    de: 'An diese Nummer kann keine SMS zugestellt werden (Festnetz).',
    en: 'Text messages can’t be delivered to this number (landline).',
    fr: 'Impossible d’envoyer un SMS à ce numéro (ligne fixe).',
    it: 'Non è possibile inviare SMS a questo numero (rete fissa).',
  },
  'Der Mobilfunkanbieter hat die SMS abgelehnt. Bitte andere Nummer versuchen.': {
    de: 'Der Mobilfunkanbieter hat die SMS abgelehnt. Bitte andere Nummer versuchen.',
    en: 'Your mobile provider rejected the text message. Please try another number.',
    fr: 'Votre opérateur a refusé le SMS. Essayez un autre numéro.',
    it: 'Il tuo operatore ha rifiutato l’SMS. Prova un altro numero.',
  },

  // ── Booking a delivery (shared/schemas) ─────────────────────────────────
  'Bitte runde den Betrag auf 5 Rappen.': {
    de: 'Bitte runde den Betrag auf 5 Rappen.',
    en: 'Please round the amount to 5 centimes.',
    fr: 'Veuillez arrondir le montant à 5 centimes.',
    it: 'Arrotonda l’importo a 5 centesimi.',
  },
  'Shlep ist im Moment nur in der Schweiz und in Liechtenstein verfügbar.': {
    de: 'Shlep ist im Moment nur in der Schweiz und in Liechtenstein verfügbar.',
    en: 'Shlep is currently available only in Switzerland and Liechtenstein.',
    fr: 'Shlep n’est disponible pour l’instant qu’en Suisse et au Liechtenstein.',
    it: 'Al momento Shlep è disponibile solo in Svizzera e in Liechtenstein.',
  },
  'Das Zeitfenster muss nach seinem Beginn enden.': {
    de: 'Das Zeitfenster muss nach seinem Beginn enden.',
    en: 'The time window must end after it starts.',
    fr: 'La plage horaire doit se terminer après son début.',
    it: 'La fascia oraria deve finire dopo il suo inizio.',
  },
  'Das Zeitfenster liegt in der Vergangenheit.': {
    de: 'Das Zeitfenster liegt in der Vergangenheit.',
    en: 'The time window is in the past.',
    fr: 'La plage horaire est dans le passé.',
    it: 'La fascia oraria è nel passato.',
  },
  'Abhol- und Zieladresse sind dieselbe.': {
    de: 'Abhol- und Zieladresse sind dieselbe.',
    en: 'The pickup and drop-off addresses are the same.',
    fr: 'Les adresses de retrait et de livraison sont identiques.',
    it: 'Gli indirizzi di ritiro e di consegna coincidono.',
  },
  'Diese Abfahrt liegt in der Vergangenheit.': {
    de: 'Diese Abfahrt liegt in der Vergangenheit.',
    en: 'This departure is in the past.',
    fr: 'Ce départ est dans le passé.',
    it: 'Questa partenza è nel passato.',
  },
  'Wähle mindestens einen Wochentag.': {
    de: 'Wähle mindestens einen Wochentag.',
    en: 'Choose at least one day of the week.',
    fr: 'Choisissez au moins un jour de la semaine.',
    it: 'Scegli almeno un giorno della settimana.',
  },
  'Die Nachricht ist leer.': {
    de: 'Die Nachricht ist leer.',
    en: 'The message is empty.',
    fr: 'Le message est vide.',
    it: 'Il messaggio è vuoto.',
  },
  'Die Nachricht ist zu lang (höchstens 2000 Zeichen).': {
    de: 'Die Nachricht ist zu lang (höchstens 2000 Zeichen).',
    en: 'The message is too long (at most 2000 characters).',
    fr: 'Le message est trop long (2000 caractères maximum).',
    it: 'Il messaggio è troppo lungo (massimo 2000 caratteri).',
  },
};

/** Messages with a number or a value in them. */
const PATTERNS: Array<[RegExp, T]> = [
  [/^Grösse (\w+) trägt höchstens ([\d.]+) kg\. Wähle eine grössere Grösse\.$/, {
    de: 'Grösse $1 trägt höchstens $2 kg. Wähle eine grössere Grösse.',
    en: 'Size $1 carries at most $2 kg. Choose a larger size.',
    fr: 'La taille $1 supporte au plus $2 kg. Choisissez une taille plus grande.',
    it: 'La taglia $1 porta al massimo $2 kg. Scegli una taglia più grande.',
  }],
  [/^Über ([\d.]+) kg können wir im Moment nicht transportieren\.$/, {
    de: 'Über $1 kg können wir im Moment nicht transportieren.',
    en: 'We can’t carry more than $1 kg at the moment.',
    fr: 'Nous ne pouvons pas transporter plus de $1 kg pour le moment.',
    it: 'Al momento non possiamo trasportare più di $1 kg.',
  }],
  [/^Sendungen über CHF ([\d']+) können wir im Moment nicht annehmen\.$/, {
    de: 'Sendungen über CHF $1 können wir im Moment nicht annehmen.',
    en: 'We can’t accept parcels worth more than CHF $1 at the moment.',
    fr: 'Nous ne pouvons pas accepter d’envois de plus de CHF $1 pour le moment.',
    it: 'Al momento non possiamo accettare spedizioni di valore superiore a CHF $1.',
  }],
  [/^Der Betrag muss mindestens CHF ([\d.]+) sein\.$/, {
    de: 'Der Betrag muss mindestens CHF $1 sein.',
    en: 'The amount must be at least CHF $1.',
    fr: 'Le montant doit être d’au moins CHF $1.',
    it: 'L’importo deve essere di almeno CHF $1.',
  }],
  [/^Der Betrag darf höchstens CHF ([\d.]+) sein\.$/, {
    de: 'Der Betrag darf höchstens CHF $1 sein.',
    en: 'The amount can be at most CHF $1.',
    fr: 'Le montant ne peut pas dépasser CHF $1.',
    it: 'L’importo può essere al massimo CHF $1.',
  }],
  [/^Lieferungen können bis (\d+) Tage im Voraus gebucht werden\.$/, {
    de: 'Lieferungen können bis $1 Tage im Voraus gebucht werden.',
    en: 'Deliveries can be booked up to $1 days ahead.',
    fr: 'Les livraisons peuvent être réservées jusqu’à $1 jours à l’avance.',
    it: 'Le consegne si possono prenotare fino a $1 giorni prima.',
  }],
  [/^Probleme können bis (\d+) Tage nach der Zustellung gemeldet werden\.$/, {
    de: 'Probleme können bis $1 Tage nach der Zustellung gemeldet werden.',
    en: 'Problems can be reported up to $1 days after delivery.',
    fr: 'Les problèmes peuvent être signalés jusqu’à $1 jours après la livraison.',
    it: 'I problemi si possono segnalare fino a $1 giorni dopo la consegna.',
  }],
  [/^Bewertungen sind bis (\d+) Tage nach der Zustellung möglich\.$/, {
    de: 'Bewertungen sind bis $1 Tage nach der Zustellung möglich.',
    en: 'Ratings are possible up to $1 days after delivery.',
    fr: 'Les évaluations sont possibles jusqu’à $1 jours après la livraison.',
    it: 'Le valutazioni sono possibili fino a $1 giorni dopo la consegna.',
  }],
  [/^Nicht möglich: (\w+) → (\w+)$/, {
    de: 'Das ist in diesem Schritt nicht möglich.',
    en: 'That isn’t possible at this stage.',
    fr: 'Ce n’est pas possible à cette étape.',
    it: 'Non è possibile in questa fase.',
  }],
];

/** The language the request asked for, if it is one we speak. */
export function requestLang(header: string | undefined): Lang | undefined {
  if (!header) return undefined;
  for (const part of header.split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (code === 'de' || code === 'en' || code === 'fr' || code === 'it') return code;
  }
  return undefined;
}

/** `message` in `lang`, or unchanged if it isn't a known user-facing message. */
export function localize(message: string, lang: Lang | undefined): string {
  if (!lang) return message;
  const exact = EXACT[message];
  if (exact) return exact[lang];
  for (const [re, t] of PATTERNS) {
    const m = message.match(re);
    if (m) return t[lang].replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? '');
  }
  return message;
}
