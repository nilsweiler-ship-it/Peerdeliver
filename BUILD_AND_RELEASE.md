# Shlep — Builds & Release

Drei Build-Wege. Der richtige hängt davon ab, was du gerade tust.

| Zweck | Weg | Dauer | Mac nötig? |
|---|---|---|---|
| Code ändern, sofort sehen | Metro-Reload | Sekunden | ja |
| Native Änderung testen (Kamera, Push, Standort) | lokaler Build | 5–15 Min | ja, mit Kabel |
| Jemandem eine Version geben | **EAS `preview`** | 15–25 Min | **nein** |
| App Store / Play Store | **EAS `production`** | 20–30 Min | **nein** |

Der wichtigste Punkt: **EAS baut in der Cloud.** Kein Xcode, kein Kabel, keine `devicectl`-Fehler. Genau die Klasse von Problemen, die bisher am meisten Zeit gekostet hat, entfällt damit vollständig.

---

## Vor jedem Build

```bash
cd "$HOME/Peerdeliver"
npm run preflight   # Konfiguration & Toolchain
npm run verify      # Prisma + beide Typechecks
git push origin main
```

`git push` ist bei EAS nicht optional: EAS baut aus dem **gepushten** Git-Stand. Nicht gepushte Änderungen landen nicht im Build — ohne Fehlermeldung.

---

## Weg 1 — Lokal (schnelles Iterieren)

```bash
# Terminal 1
cd "$HOME/Peerdeliver" && npm run server

# Terminal 2
cd "$HOME/Peerdeliver/packages/app" && npx expo start --dev-client

# Terminal 3 (nur wenn sich native Abhängigkeiten geändert haben)
cd "$HOME/Peerdeliver/packages/app" && npx expo run:ios --device
```

Nur JavaScript geändert? Terminal 3 überspringen — Metro lädt neu.

**Ohne Kabel:** Xcode → Window → Devices and Simulators (⇧⌘2) → iPhone auswählen → **Connect via network**. Einmal am Kabel aktivieren, danach drahtlos. Langsamer beim Installieren, Telefon muss entsperrt sein.

**Wenn `expo run:ios` an `devicectl` scheitert** (bekanntes Problem mit Xcode 26): stattdessen `open ios/Shlep.xcworkspace` und in Xcode ⌘R.

---

## Weg 2 — EAS Preview (für Testerinnen)

```bash
cd "$HOME/Peerdeliver/packages/app"
npx eas-cli@latest build --platform ios --profile preview
```

Beim ersten Mal fragt EAS nach Signing-Zertifikaten — **„let EAS handle it"** wählen. EAS verwaltet sie danach selbst; das ist der Teil, den man sonst manuell in Xcode pflegen müsste.

Ergebnis ist ein Link. Für iOS musst du Testgeräte vorher registrieren:

```bash
npx eas-cli@latest device:create
```

Das erzeugt einen QR-Code; das Gerät installiert damit ein Provisioning-Profil. Danach kann es Preview-Builds installieren.

**Für mehr als eine Handvoll Testerinnen: TestFlight statt Preview.** Keine Geräteregistrierung nötig, bis zu 10'000 Personen:

```bash
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

---

## Weg 3 — Store-Release

**Voraussetzung:** Apple Developer Program aktiv, App in App Store Connect angelegt, und in `eas.json` unter `submit.production.ios.ascAppId` die App-ID eingetragen (steht in App Store Connect → App → App Information → Apple ID).

```bash
cd "$HOME/Peerdeliver/packages/app"

# 1. QA-Protokoll vollständig durchlaufen (QA_PROTOCOL.md)
# 2. Bauen
npx eas-cli@latest build --platform ios --profile production
# 3. Einreichen
npx eas-cli@latest submit --platform ios --latest
```

Android analog mit `--platform android`. Für den Play-Submit braucht es einen Service-Account-Key als `google-play-key.json` — **nicht committen**, er steht in `.gitignore`.

`autoIncrement` im Production-Profil zählt die Build-Nummer selbst hoch. Apple lehnt eine bereits verwendete Build-Nummer ab, und das ist ein ärgerlicher Fehler, wenn man ihn manuell pflegt.

---

## Build-Profile

| Profil | Zweck | Besonderheit |
|---|---|---|
| `development` | Dev-Client mit Metro | `developmentClient: true` |
| `preview` | Testerinnen, ohne Metro lauffähig | interne Verteilung, Android als APK |
| `production` | Store | `autoIncrement`, Android als AAB |

`preview` ist der wichtige: eine eigenständige App, die **ohne deinen Mac läuft**. Das ist, was du jemandem gibst, der Shlep ausprobieren soll.

---

## Kosten

EAS hat ein Gratis-Kontingent mit begrenzten Builds pro Monat, die hinter zahlenden Nutzern in der Warteschlange stehen — Wartezeiten von 10–30 Minuten sind normal. Der bezahlte Plan (ca. USD 19/Monat) hat Priorität. Für die MVP-Phase reicht Gratis meist; erst wenn du mehrmals täglich baust, lohnt der Wechsel.

Aktuelle Konditionen: https://expo.dev/pricing

---

## Wenn etwas schiefgeht

- **„Git branch has uncommitted file changes"** → committen und pushen. EAS baut aus Git.
- **Build bricht bei Signing ab** → `npx eas-cli@latest credentials` und Zertifikate neu erzeugen lassen.
- **Build läuft, App stürzt beim Start ab** → fast immer eine fehlende Env-Variable oder ein nicht erreichbares Backend. `eas build:view` zeigt das Log.
- **Änderungen fehlen im Build** → nicht gepusht. Der häufigste Fall.
