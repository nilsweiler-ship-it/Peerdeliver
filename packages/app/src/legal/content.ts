/**
 * Legal document templates for Shlep, in the app's four languages.
 *
 * IMPORTANT: these are concise TEMPLATES to make the screens functional and
 * localized. They are NOT legal advice and MUST be reviewed and completed by a
 * qualified Swiss lawyer (and the [bracketed] Impressum fields filled in)
 * before public launch. The company operates under Swiss law (revised FADP for
 * data protection).
 */

export type LegalKey = 'terms' | 'privacy' | 'impressum';
export type LegalSection = { h: string; p: string };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

export const LEGAL_LAST_UPDATED = '2026-07-04';

type Lang = 'en' | 'de' | 'fr' | 'it';

const en: Record<LegalKey, LegalDoc> = {
  terms: {
    title: 'Terms & Conditions',
    intro:
      'These terms govern your use of the Shlep app and the peer-to-peer delivery service it provides in Switzerland. By creating an account you accept them.',
    sections: [
      { h: '1. The service', p: 'Shlep is a marketplace that connects people who want to send a parcel (senders) with people already travelling a similar route (drivers). Shlep is an intermediary platform; it does not itself carry parcels and is not a party to the transport agreement between sender and driver.' },
      { h: '2. Accounts', p: 'You must be at least 18 years old and provide accurate information. You are responsible for activity on your account and for keeping your credentials secure.' },
      { h: '3. Deliveries and codes', p: 'Pickup and delivery are confirmed with 6-digit codes. Senders and drivers agree the price, timing and handover. You must not send prohibited, illegal, dangerous or improperly packaged goods.' },
      { h: '4. Payments and fees', p: 'Payments are processed by our payment provider. Shlep charges a platform fee (currently 9% of the delivery price, with a minimum of CHF 1.50); the remainder is paid out to the driver after a code-verified delivery. Applicable taxes are your responsibility.' },
      { h: '5. Conduct and liability', p: 'You agree to act lawfully and respectfully. To the extent permitted by law, Shlep is not liable for loss or damage arising from the transport itself, which is a matter between sender and driver. Nothing excludes liability that cannot be excluded under Swiss law.' },
      { h: '6. Suspension and changes', p: 'We may suspend accounts that breach these terms and may update the service or these terms; material changes will be notified in the app.' },
      { h: '7. Governing law', p: 'These terms are governed by Swiss law. Place of jurisdiction is Winterthur, subject to mandatory consumer-protection venues.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro:
      'This policy explains how Shlep processes your personal data under the revised Swiss Federal Act on Data Protection (FADP) and, where applicable, the GDPR.',
    sections: [
      { h: '1. Who is responsible', p: 'The data controller is DeltaSCI Solutions GmbH, Jonas-Furrer-Strasse 104, 8400 Winterthur, contact privacy@shlep.ch.' },
      { h: '2. Data we process', p: 'Account data (name, email), delivery data (addresses, package details, codes), approximate and live location during an active delivery, chat messages, ratings, and payment status. Payment card data is handled by our payment provider, not stored by us.' },
      { h: '3. Why we process it', p: 'To operate the service (contract), match deliveries, enable tracking and communication, process payments, ensure safety and prevent fraud (legitimate interests), and meet legal obligations.' },
      { h: '4. Sharing', p: 'We share the minimum necessary data between matched senders, drivers and recipients, and with service providers (hosting, payments, email). We do not sell your data.' },
      { h: '5. Retention', p: 'We keep data only as long as needed for the service and legal requirements, then delete or anonymise it. Live location is retained only for the duration of a delivery.' },
      { h: '6. Your rights', p: 'You may request access, correction, deletion, or a copy of your data, and object to certain processing. Contact privacy@shlep.ch. You may lodge a complaint with the Swiss FDPIC.' },
      { h: '7. Security', p: 'We use encryption in transit, access controls and other measures to protect your data, though no system is perfectly secure.' },
    ],
  },
  impressum: {
    title: 'Legal Notice',
    intro: 'Information about the operator of the Shlep app, as required under Swiss law.',
    sections: [
      { h: 'Operator', p: 'DeltaSCI Solutions GmbH' },
      { h: 'Address', p: 'Jonas-Furrer-Strasse 104, 8400 Winterthur, Switzerland' },
      { h: 'Commercial register', p: 'UID: [CHE-xxx.xxx.xxx]' },
      { h: 'Represented by', p: '[Name(s) of authorised signatory]' },
      { h: 'Contact', p: 'Email: hello@shlep.ch · Phone: +41 76 460 77 24' },
      { h: 'Disclaimer', p: 'Despite careful review we assume no liability for the content of external links; their operators are solely responsible.' },
    ],
  },
};

const de: Record<LegalKey, LegalDoc> = {
  terms: {
    title: 'Allgemeine Geschäftsbedingungen',
    intro:
      'Diese Bedingungen regeln die Nutzung der Shlep-App und des darüber angebotenen Peer-to-Peer-Lieferdienstes in der Schweiz. Mit der Erstellung eines Kontos akzeptierst du sie.',
    sections: [
      { h: '1. Der Dienst', p: 'Shlep ist ein Marktplatz, der Personen, die ein Paket senden möchten (Sendende), mit Personen verbindet, die ohnehin eine ähnliche Strecke fahren (Fahrende). Shlep ist eine Vermittlungsplattform; Shlep transportiert selbst keine Pakete und ist nicht Vertragspartei des Transportvertrags zwischen sendender und fahrender Person.' },
      { h: '2. Konten', p: 'Du musst mindestens 18 Jahre alt sein und wahrheitsgemässe Angaben machen. Du bist für Aktivitäten in deinem Konto und die Sicherheit deiner Zugangsdaten verantwortlich.' },
      { h: '3. Lieferungen und Codes', p: 'Abholung und Lieferung werden mit 6-stelligen Codes bestätigt. Sendende und Fahrende vereinbaren Preis, Zeit und Übergabe. Verbotene, illegale, gefährliche oder unsachgemäss verpackte Güter dürfen nicht versendet werden.' },
      { h: '4. Zahlungen und Gebühren', p: 'Zahlungen werden über unseren Zahlungsdienstleister abgewickelt. Shlep erhebt eine Plattformgebühr (derzeit 9 % des Lieferpreises, mindestens CHF 1.50); der Rest wird nach einer per Code bestätigten Lieferung an die fahrende Person ausbezahlt. Anfallende Steuern liegen in deiner Verantwortung.' },
      { h: '5. Verhalten und Haftung', p: 'Du verpflichtest dich zu rechtmässigem und respektvollem Verhalten. Soweit gesetzlich zulässig, haftet Shlep nicht für Verluste oder Schäden aus dem Transport selbst, der Sache zwischen sendender und fahrender Person ist. Zwingende gesetzliche Haftung bleibt unberührt.' },
      { h: '6. Sperrung und Änderungen', p: 'Wir können Konten sperren, die gegen diese Bedingungen verstossen, und den Dienst oder diese Bedingungen ändern; wesentliche Änderungen werden in der App mitgeteilt.' },
      { h: '7. Anwendbares Recht', p: 'Es gilt Schweizer Recht. Gerichtsstand ist Winterthur, vorbehaltlich zwingender Konsumentengerichtsstände.' },
    ],
  },
  privacy: {
    title: 'Datenschutzerklärung',
    intro:
      'Diese Erklärung beschreibt, wie Shlep deine Personendaten gemäss dem revidierten Schweizer Datenschutzgesetz (DSG) und, soweit anwendbar, der DSGVO bearbeitet.',
    sections: [
      { h: '1. Verantwortliche Stelle', p: 'Verantwortlich ist DeltaSCI Solutions GmbH, Jonas-Furrer-Strasse 104, 8400 Winterthur, Kontakt privacy@shlep.ch.' },
      { h: '2. Bearbeitete Daten', p: 'Kontodaten (Name, E-Mail), Lieferdaten (Adressen, Paketangaben, Codes), ungefährer und Live-Standort während einer aktiven Lieferung, Chat-Nachrichten, Bewertungen und Zahlungsstatus. Kartendaten werden durch unseren Zahlungsdienstleister verarbeitet, nicht von uns gespeichert.' },
      { h: '3. Zwecke', p: 'Zum Betrieb des Dienstes (Vertrag), zur Vermittlung von Lieferungen, für Tracking und Kommunikation, zur Zahlungsabwicklung, für Sicherheit und Betrugsprävention (berechtigte Interessen) sowie zur Erfüllung gesetzlicher Pflichten.' },
      { h: '4. Weitergabe', p: 'Wir geben nur die nötigsten Daten zwischen zugeordneten Sendenden, Fahrenden und Empfangenden sowie an Dienstleister (Hosting, Zahlung, E-Mail) weiter. Wir verkaufen deine Daten nicht.' },
      { h: '5. Aufbewahrung', p: 'Wir bewahren Daten nur so lange auf, wie es für den Dienst und gesetzliche Vorgaben nötig ist, und löschen oder anonymisieren sie danach. Der Live-Standort wird nur während einer Lieferung gespeichert.' },
      { h: '6. Deine Rechte', p: 'Du kannst Auskunft, Berichtigung, Löschung oder eine Kopie deiner Daten verlangen und bestimmten Bearbeitungen widersprechen. Kontakt: privacy@shlep.ch. Du kannst dich beim EDÖB beschweren.' },
      { h: '7. Sicherheit', p: 'Wir verwenden Verschlüsselung bei der Übertragung, Zugriffskontrollen und weitere Massnahmen zum Schutz deiner Daten; kein System ist jedoch vollkommen sicher.' },
    ],
  },
  impressum: {
    title: 'Impressum',
    intro: 'Angaben zur Betreiberin der Shlep-App gemäss Schweizer Recht.',
    sections: [
      { h: 'Betreiberin', p: 'DeltaSCI Solutions GmbH' },
      { h: 'Adresse', p: 'Jonas-Furrer-Strasse 104, 8400 Winterthur, Schweiz' },
      { h: 'Handelsregister', p: 'UID: [CHE-xxx.xxx.xxx]' },
      { h: 'Vertreten durch', p: '[Name(n) der zeichnungsberechtigten Person(en)]' },
      { h: 'Kontakt', p: 'E-Mail: hello@shlep.ch · Telefon: +41 76 460 77 24' },
      { h: 'Haftungsausschluss', p: 'Trotz sorgfältiger Prüfung übernehmen wir keine Haftung für Inhalte externer Links; für diese sind ausschliesslich deren Betreiber verantwortlich.' },
    ],
  },
};

const fr: Record<LegalKey, LegalDoc> = {
  terms: {
    title: 'Conditions générales',
    intro:
      "Ces conditions régissent l'utilisation de l'application Shlep et du service de livraison entre particuliers proposé en Suisse. En créant un compte, vous les acceptez.",
    sections: [
      { h: '1. Le service', p: "Shlep est une place de marché qui met en relation les personnes souhaitant envoyer un colis (expéditeurs) et les personnes effectuant déjà un trajet similaire (conducteurs). Shlep est une plateforme d'intermédiation ; elle ne transporte pas elle-même les colis et n'est pas partie au contrat de transport entre l'expéditeur et le conducteur." },
      { h: '2. Comptes', p: 'Vous devez avoir au moins 18 ans et fournir des informations exactes. Vous êtes responsable de l\'activité de votre compte et de la sécurité de vos identifiants.' },
      { h: '3. Livraisons et codes', p: 'L\'enlèvement et la livraison sont confirmés par des codes à 6 chiffres. Les expéditeurs et les conducteurs conviennent du prix, de l\'horaire et de la remise. Il est interdit d\'envoyer des biens prohibés, illégaux, dangereux ou mal emballés.' },
      { h: '4. Paiements et frais', p: 'Les paiements sont traités par notre prestataire de paiement. Shlep prélève une commission de plateforme (actuellement 9 % du prix de la livraison, avec un minimum de CHF 1.50) ; le solde est versé au conducteur après une livraison confirmée par code. Les taxes applicables sont à votre charge.' },
      { h: '5. Comportement et responsabilité', p: 'Vous vous engagez à agir de manière licite et respectueuse. Dans les limites autorisées par la loi, Shlep n\'est pas responsable des pertes ou dommages liés au transport lui-même, qui relèvent de l\'expéditeur et du conducteur. La responsabilité impérative légale demeure réservée.' },
      { h: '6. Suspension et modifications', p: 'Nous pouvons suspendre les comptes qui enfreignent ces conditions et modifier le service ou ces conditions ; les changements importants seront notifiés dans l\'application.' },
      { h: '7. Droit applicable', p: 'Ces conditions sont régies par le droit suisse. Le for est Winterthur, sous réserve des fors impératifs de protection des consommateurs.' },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    intro:
      "Cette politique explique comment Shlep traite vos données personnelles conformément à la loi fédérale suisse révisée sur la protection des données (LPD) et, le cas échéant, au RGPD.",
    sections: [
      { h: '1. Responsable', p: 'Le responsable du traitement est DeltaSCI Solutions GmbH, Jonas-Furrer-Strasse 104, 8400 Winterthur, contact privacy@shlep.ch.' },
      { h: '2. Données traitées', p: 'Données de compte (nom, e-mail), données de livraison (adresses, détails du colis, codes), position approximative et en temps réel pendant une livraison active, messages de chat, évaluations et statut de paiement. Les données de carte sont gérées par notre prestataire de paiement et non stockées par nous.' },
      { h: '3. Finalités', p: 'Pour exploiter le service (contrat), associer les livraisons, permettre le suivi et la communication, traiter les paiements, assurer la sécurité et prévenir la fraude (intérêts légitimes), et respecter les obligations légales.' },
      { h: '4. Partage', p: 'Nous partageons le minimum de données nécessaires entre expéditeurs, conducteurs et destinataires associés, et avec nos prestataires (hébergement, paiement, e-mail). Nous ne vendons pas vos données.' },
      { h: '5. Conservation', p: 'Nous conservons les données uniquement le temps nécessaire au service et aux obligations légales, puis les supprimons ou les anonymisons. La position en temps réel n\'est conservée que pendant une livraison.' },
      { h: '6. Vos droits', p: 'Vous pouvez demander l\'accès, la rectification, la suppression ou une copie de vos données, et vous opposer à certains traitements. Contact : privacy@shlep.ch. Vous pouvez déposer une réclamation auprès du PFPDT.' },
      { h: '7. Sécurité', p: 'Nous utilisons le chiffrement en transit, des contrôles d\'accès et d\'autres mesures pour protéger vos données ; aucun système n\'est toutefois parfaitement sûr.' },
    ],
  },
  impressum: {
    title: 'Mentions légales',
    intro: "Informations sur l'exploitant de l'application Shlep, conformément au droit suisse.",
    sections: [
      { h: 'Exploitant', p: 'DeltaSCI Solutions GmbH' },
      { h: 'Adresse', p: 'Jonas-Furrer-Strasse 104, 8400 Winterthur, Suisse' },
      { h: 'Registre du commerce', p: 'IDE : [CHE-xxx.xxx.xxx]' },
      { h: 'Représenté par', p: '[Nom(s) de la personne autorisée à signer]' },
      { h: 'Contact', p: 'E-mail : hello@shlep.ch · Téléphone : +41 76 460 77 24' },
      { h: 'Clause de non-responsabilité', p: 'Malgré un contrôle attentif, nous déclinons toute responsabilité quant au contenu des liens externes ; leurs exploitants en sont seuls responsables.' },
    ],
  },
};

const it: Record<LegalKey, LegalDoc> = {
  terms: {
    title: 'Condizioni generali',
    intro:
      "Queste condizioni regolano l'uso dell'app Shlep e del servizio di consegna tra privati offerto in Svizzera. Creando un account le accetti.",
    sections: [
      { h: '1. Il servizio', p: "Shlep è un marketplace che mette in contatto chi desidera inviare un pacco (mittenti) con chi sta già percorrendo un tragitto simile (conducenti). Shlep è una piattaforma di intermediazione; non trasporta essa stessa i pacchi e non è parte del contratto di trasporto tra mittente e conducente." },
      { h: '2. Account', p: 'Devi avere almeno 18 anni e fornire informazioni accurate. Sei responsabile dell\'attività del tuo account e della sicurezza delle tue credenziali.' },
      { h: '3. Consegne e codici', p: 'Il ritiro e la consegna sono confermati con codici a 6 cifre. Mittenti e conducenti concordano prezzo, orario e consegna. È vietato inviare beni proibiti, illegali, pericolosi o imballati in modo inadeguato.' },
      { h: '4. Pagamenti e commissioni', p: 'I pagamenti sono elaborati dal nostro fornitore di pagamento. Shlep applica una commissione di piattaforma (attualmente il 9% del prezzo di consegna, con un minimo di CHF 1.50); il resto viene versato al conducente dopo una consegna confermata tramite codice. Le imposte applicabili sono a tuo carico.' },
      { h: '5. Comportamento e responsabilità', p: 'Ti impegni ad agire in modo lecito e rispettoso. Nei limiti consentiti dalla legge, Shlep non è responsabile per perdite o danni derivanti dal trasporto stesso, che riguarda mittente e conducente. Resta salva la responsabilità imperativa di legge.' },
      { h: '6. Sospensione e modifiche', p: 'Possiamo sospendere gli account che violano queste condizioni e modificare il servizio o le condizioni; le modifiche sostanziali saranno notificate nell\'app.' },
      { h: '7. Diritto applicabile', p: 'Si applica il diritto svizzero. Il foro competente è Winterthur, fatti salvi i fori imperativi a tutela dei consumatori.' },
    ],
  },
  privacy: {
    title: 'Informativa sulla privacy',
    intro:
      "Questa informativa spiega come Shlep tratta i tuoi dati personali ai sensi della legge federale svizzera riveduta sulla protezione dei dati (LPD) e, ove applicabile, del GDPR.",
    sections: [
      { h: '1. Titolare', p: 'Il titolare del trattamento è DeltaSCI Solutions GmbH, Jonas-Furrer-Strasse 104, 8400 Winterthur, contatto privacy@shlep.ch.' },
      { h: '2. Dati trattati', p: 'Dati dell\'account (nome, e-mail), dati di consegna (indirizzi, dettagli del pacco, codici), posizione approssimativa e in tempo reale durante una consegna attiva, messaggi in chat, valutazioni e stato dei pagamenti. I dati della carta sono gestiti dal nostro fornitore di pagamento e non memorizzati da noi.' },
      { h: '3. Finalità', p: 'Per gestire il servizio (contratto), abbinare le consegne, consentire tracciamento e comunicazione, elaborare i pagamenti, garantire la sicurezza e prevenire le frodi (interessi legittimi) e adempiere agli obblighi di legge.' },
      { h: '4. Condivisione', p: 'Condividiamo i dati minimi necessari tra mittenti, conducenti e destinatari abbinati e con i nostri fornitori (hosting, pagamenti, e-mail). Non vendiamo i tuoi dati.' },
      { h: '5. Conservazione', p: 'Conserviamo i dati solo per il tempo necessario al servizio e agli obblighi di legge, poi li cancelliamo o li rendiamo anonimi. La posizione in tempo reale è conservata solo per la durata di una consegna.' },
      { h: '6. I tuoi diritti', p: 'Puoi richiedere accesso, rettifica, cancellazione o una copia dei tuoi dati e opporti a determinati trattamenti. Contatto: privacy@shlep.ch. Puoi presentare reclamo all\'IFPDT.' },
      { h: '7. Sicurezza', p: 'Utilizziamo la cifratura in transito, controlli di accesso e altre misure per proteggere i tuoi dati; nessun sistema è tuttavia perfettamente sicuro.' },
    ],
  },
  impressum: {
    title: 'Note legali',
    intro: "Informazioni sul gestore dell'app Shlep, come richiesto dal diritto svizzero.",
    sections: [
      { h: 'Gestore', p: 'DeltaSCI Solutions GmbH' },
      { h: 'Indirizzo', p: 'Jonas-Furrer-Strasse 104, 8400 Winterthur, Svizzera' },
      { h: 'Registro di commercio', p: 'IDI: [CHE-xxx.xxx.xxx]' },
      { h: 'Rappresentato da', p: '[Nome/i della persona autorizzata a firmare]' },
      { h: 'Contatto', p: 'E-mail: hello@shlep.ch · Telefono: +41 76 460 77 24' },
      { h: 'Esclusione di responsabilità', p: 'Nonostante un attento controllo, non ci assumiamo alcuna responsabilità per i contenuti dei link esterni; i rispettivi gestori ne sono gli unici responsabili.' },
    ],
  },
};

const LEGAL: Record<Lang, Record<LegalKey, LegalDoc>> = { en, de, fr, it };

export function getLegalDoc(lang: string, key: LegalKey): LegalDoc {
  const set = LEGAL[(lang as Lang)] ?? LEGAL.en;
  return set[key];
}
