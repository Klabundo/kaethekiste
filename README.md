# KätheKiste – Digitales Fundsachen-System (Prototyp)

Prototyp für das **Käthe-Kollwitz-Gymnasium (KKG)**: Ein digitales Fundsachen-System,
bei dem Verluste und Funde zentral gemeldet werden – und ein Matching-Algorithmus
automatisch erkennt, welche Verluste zu welchen Funden passen.

**Kein Server nötig:** Die App läuft vollständig im Browser (HTML + CSS + Vanilla JS).
Alle Daten werden lokal gespeichert (`localStorage`) – es fließen keine Daten an einen Server.

**Live-Demo:** <https://klabundo.github.io/kaethekiste/> (GitHub Pages – jede/r kann sie im Browser öffnen)

---

## So starte ich den Prototypen

1. `index.html` einfach im Browser öffnen (Doppelklick) – fertig.
2. **Oder** einen lokalen Webserver starten (empfohlen, falls der Browser Restriktionen hat):
   ```bash
   cd kkg-fundsachen
   python3 -m http.server 8000
   # dann http://localhost:8000 im Browser öffnen
   ```
3. Über **„Hilfe → Beispieldaten laden“** mit 11 realistischen Beispielen
   (u. a. ein bereits zugeordnetes iPhone-Paar und zwei abgeschlossene Fälle) bespielen.

## Features

| Feature | Beschreibung |
|---|---|
| **Verlust melden** | Formular mit Kategorie, Ort (KKG-Räume), Datum, Beschreibung, Foto |
| **Fund melden** | Gleiches Formular + Pflichtfeld „Weiterleitung an“ (z. B. Sekretariat) |
| **Smart Matching** | Während des Ausfüllens werden schon passende Gegenstücke gesucht; nach dem Absenden erscheinen konkrete Matches mit Ähnlichkeits-Score (Jaccard + Kategorie/Marken/Ort-Bonus) |
| **Zuordnungs-Workflow** | Match → „Zuordnen“ (beide Einträge in Abwicklung) → „Abholung bestätigen“ (beide erledigt). Freigabe läuft im echten Betrieb über Sekretariat/Lehrkraft |
| **Liste & Suche** | Freitextsuche (Live), Filter nach Art, Status, Kategorie, Ort |
| **Detailansicht** | Alle Angaben, Verlauf/Timeline, Kontakthinweis, Aktionen (Zuordnen, Abholen, Archivieren, Löschen) |
| **Übersicht (Dashboard)** | Offene Funde/Verluste, Erfolgsquote, Ø Zeit bis Abholung, Kategorien-Balken, letzte Aktivitäten |
| **Datenpflege** | Export/Import als JSON, Beispieldaten, Reset – alles lokal |
| **Barrierearm** | Tastatur bedienbar (Enter/Space auf Karten, Esc schließt Dialogs), ARIA-Attribute, Skip-Link |

## Dateistruktur

```
kkg-fundsachen/
├── index.html      # Seitenstruktur (Header, Nav, Main, Footer, Modal, Toast)
├── style.css       # Design (reduziertes, editoriales Layout: Papier-Tonalität, Serifen-Headlines, ein Akzent)
├── app.js          # Logik: State, Persistenz, Matching, Views, Aktionen
├── static/
│   ├── logo-kkg.svg    # Original-Schullogo (Emblem + Schriftzug)
│   └── logo-emblem.svg # Nur das runde Emblem (Topbar, Footer, Favicon)
└── tests/
    └── smoke.js    # Headless-Test (Matching, Filter, Beispieldaten, Rendering)
```

## Ablauf (Rollen)

1. **Schüler:in** meldet Verlust oder Fund (Foto empfohlen).
2. **Algorithmus** schlägt passende Gegenstücke vor (ab ~35 % Ähnlichkeit, bei guter Übereinstimmung >80 %).
3. **Lehrkraft / Sekretariat** bestätigt die Zuordnung im System (im Prototyp: direkt per Button).
4. **Abholung** im Sekretariat gegen kurze Identifikation (z. B. Klassenzugehörigkeit, Merkmale beschreiben) → beide Einträge werden als „abgeholt“ abgeschlossen.

## Datenschutz (wichtig für den Schulalltag)

- Im Prototyp bleiben alle Daten im jeweiligen Browser – keine Serverübertragung.
- In den Meldungen bitte **keine** privaten Handynummern, Passwörter oder Adressen.
- Für den echten Betrieb wäre zu ergänzen: Login (Schulkontext), serverseitige Speicherung
  mit AVV-Grundlage, Löschfristen (z. B. 4 Wochen aktiv → Fundbüro/Archiv).

## Testen (optional)

```bash
node tests/smoke.js
```

Testet Matching-Algorithmus, Beispieldaten, Filter und dass alle Views fehlerfrei rendern.

## Nächste Schritte (Roadmap)

- [ ] Server-Betrieb (z. B. Supabase / Schulserver) mit Login über Schulkonten
- [ ] Benachrichtigung per E-Mail, wenn ein Match gefunden wurde
- [ ] „Fundbüro“-Ansicht für das Sekretariat mit Druckfunktion (Fundzettel, Etiketten)
- [ ] Lösch-/Archivierungsfristen automatisieren
- [ ] QR-Code für die physische Fundsachen-Dose → direkt zum Melden

---

*Prototyp erstellt als Schularbeit – Käthe-Kollwitz-Gymnasium, Oktober 2026.*
