# Stripe Identity — Antragstext

Zum Kopieren in das Formular unter
**Produkte → Identity → Antrag** (Geschäftskonto, Live-Modus, nicht die Sandbox).

Die Feldnamen können abweichen — der Text passt auf die Fragen, die Stripe
üblicherweise stellt. Taucht eine Frage auf, die hier nicht abgedeckt ist:
nachfragen statt raten.

---

## Was macht Ihr Unternehmen?

> Shlep ist ein Schweizer Peer-to-Peer-Liefernetzwerk. Privatpersonen, die
> eine Strecke ohnehin fahren, nehmen das Paket einer anderen Privatperson
> mit. Shlep vermittelt zwischen den beiden und ist nicht Partei des
> Transportvertrags. Betrieben von DeltaSci Solutions GmbH,
> Jonas-Furrer-Strasse 104, 8400 Winterthur, UID CHE-347.257.714.

## Wofür nutzen Sie Stripe Identity?

> Zur Identitätsprüfung der fahrenden Personen, bevor sie eine Lieferung
> annehmen können. Fremde übergeben einander Gegenstände an der Haustür; die
> sendende Person muss darauf vertrauen können, dass die Person am anderen
> Ende überprüft ist. Die Prüfung dient ausschliesslich der Betrugsprävention
> sowie der Sicherheit beider Seiten.

**Warum diese Formulierung.** Stripes Nutzungsbedingungen erlauben Identity
für Betrugsprävention sowie Sicherheit — genau dieser Fall. Nicht als „KYC"
oder regulatorische Pflicht beschreiben: die regulatorische Prüfung läuft über
Connect und ist etwas anderes. Eine falsche Einordnung hier kann den Antrag
unnötig in eine Prüfschlaufe schicken.

## Wen verifizieren Sie?

> Ausschliesslich volljährige Privatpersonen mit Wohnsitz in der Schweiz, die
> sich als fahrende Person registrieren. Sendende und empfangende Personen
> werden nicht geprüft.

**Warum das zählt.** Identity darf nicht für Personen unter 16 verwendet
werden. Fahrende Personen besitzen einen Führerausweis und sind damit
volljährig — das ausdrücklich zu sagen erspart eine Rückfrage.

## Erwartetes Volumen

> Vorstart. Rund 20 Prüfungen in den ersten Monaten, mittelfristig 50–200 pro
> Jahr.

Tief ansetzen und ehrlich bleiben. Eine zu hohe Schätzung lädt zu Fragen über
Betrugsrisiko und Prozesse ein, die es bei diesem Volumen nicht braucht.

## Wie verwenden Sie die Daten?

> Shlep speichert keine Ausweisdokumente. Das Dokument wird im von Stripe
> gehosteten Ablauf erfasst und erreicht unsere Server nicht. Zurück kommt
> lediglich das Prüfergebnis, das als Status im Profil hinterlegt wird. Die
> Einwilligung der geprüften Person wird im Stripe-Ablauf eingeholt.

Das stimmt wörtlich: `startIdentityVerification` erzeugt eine Session und gibt
nur deren URL zurück; gesetzt wird allein ein boolescher Wert, und zwar über
Stripes Webhook, nie durch den Client.

## Website

> https://shlep.ch

---

## Voraussetzungen, die vorher stimmen müssen

- Die Website ist erreichbar und das Impressum vollständig: Firmenname und
  Rechtsform, volle Adresse, Kontaktangaben. Steht unter
  `shlep.ch/legal.html?doc=impressum` — **prüfen, dass es live ist**, nicht
  nur im Repository.
- Das Konto ist das **Geschäftskonto im Live-Modus**. Ein Antrag in der
  Sandbox bringt für die Produktion nichts.

## Danach

Zwei Webhook-Ereignisse müssen auf dem Live-Endpunkt registriert sein:

```
identity.verification_session.verified
identity.verification_session.requires_input
```

Ohne das erste wird die Prüfung bei Stripe erfolgreich sein und die Datenbank
nie davon erfahren — dieselbe Fehlerform, die im Oktober fünf Lieferungen
unbezahlt stehen liess.
