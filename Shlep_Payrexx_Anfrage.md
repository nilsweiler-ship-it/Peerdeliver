# E-Mail an Payrexx — Marketplace / Split Payments

**An:** sales@payrexx.com (alternativ das Kontaktformular unter payrexx.com/kontakt)
**Betreff:** Marktplatz-Setup für Schweizer P2P-Lieferplattform — Split Payments & KYC für Privatpersonen

---

Guten Tag

Wir bauen mit **Shlep** ein Schweizer Peer-to-Peer-Liefernetz: Privatpersonen nehmen auf einer Fahrt, die sie ohnehin machen, ein Paket für jemand anderen mit. Die sendende Person bezahlt in der App, die fahrende Person erhält den Grossteil des Betrags, wir behalten eine Vermittlungsprovision von 9 % (mindestens CHF 1.50).

Ein Merchant-Konto haben wir bereits eröffnet und die TWINT-Zahlung über die Gateway-API testweise integriert — das funktioniert gut. Offen ist für uns die Auszahlungsseite, und dazu haben wir drei konkrete Fragen, die wir in der Dokumentation nicht beantwortet gefunden haben.

**1. KYC für Privatpersonen**

Unsere Empfänger sind Privatpersonen, keine eingetragenen Unternehmen — Leute, die nebenbei ein paar Lieferungen pro Monat mitnehmen. Können solche Personen bei Ihnen als Merchant-Account im Rahmen der Platform-Lösung verifiziert werden? Falls ja: welche Unterlagen werden verlangt, und wie lange dauert die Prüfung typischerweise?

Diese Frage ist für uns entscheidend. Falls Privatpersonen grundsätzlich nicht in Frage kommen, erübrigt sich der Rest.

**2. Split Payments — Konfiguration**

In der Merchant-API finden wir das Feld `applicationFee` (Betrag in der kleinsten Währungseinheit), aber keinen Parameter für die empfangende Partei. Wir gehen davon aus, dass die Aufteilung über die Platform-Lösung konfiguriert wird.

Lässt sich der Split **prozentual** definieren, oder ausschliesslich als fixer Betrag? Unser Modell ist prozentual mit einem Mindestbetrag, das liesse sich sonst nur umständlich abbilden.

**3. Konditionen**

- TWINT-Transaktionsgebühren für unser Volumen
- Konditionen der Platform-Lösung (auf der Website ab EUR 199/Monat)
- Auszahlungsintervall und -verzögerung für neue Empfänger-Accounts

**Zum Hintergrund:** Uns ist bewusst, dass ein Einsammeln der Gelder auf unserem eigenen Konto mit anschliessender Weiterleitung an die Fahrer weder mit Ihren Nutzungsbedingungen noch mit dem GwG vereinbar wäre. Genau deshalb suchen wir eine Lösung, bei der die Aufteilung beim PSP stattfindet und wir die Kundengelder nie halten.

Wir starten schweizweit und rechnen im Pilotjahr mit einem tiefen vierstelligen Transaktionsvolumen pro Monat, mit klarem Wachstumspfad.

Haben Sie kommende Woche 20 Minuten für ein Gespräch? Gerne auch schriftlich, falls das schneller geht.

Freundliche Grüsse

**Nils Weiler**
DeltaSci Solutions GmbH · Shlep
Jonas-Furrer-Strasse 104, 8400 Winterthur
UID CHE-347.257.714
hello@shlep.ch · shlep.ch

---

## Hinweise zum Versand

- **Absender:** von `hello@shlep.ch` senden, nicht privat — die UID im Footer und eine Domain-Adresse beschleunigen die Einordnung als seriöser B2B-Lead erheblich.
- **Frage 1 ist die entscheidende.** Sie steht bewusst zuerst und ist explizit als K.o.-Kriterium markiert, damit sie nicht in einer Sammelantwort untergeht.
- **Der Absatz zum GwG** ist kein Füllmaterial: er signalisiert, dass ihr die regulatorische Lage verstanden habt. Das verändert erfahrungsgemäss, wie ernst ein Sales-Team einen Marktplatz-Lead nimmt.
- **Volumenangabe** vor dem Versand prüfen und ggf. anpassen — sie steuert, an wen intern weitergeleitet wird.
- Parallel bei Stripe dranbleiben. Wer zuerst zusagt, gewinnt; die Zahlungsschicht im Code ist providerunabhängig.
