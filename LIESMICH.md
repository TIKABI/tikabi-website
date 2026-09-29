# TIKABI Website (neu)

Öffnen: `index.html` per Doppelklick (funktioniert offline; der weiche Seitenwechsel
"Reise" läuft nur über einen Webserver / nach dem Hochladen, lokal lädt jede Seite normal).

## Noch einzutragen
Datei `_build/links.json`:
- `PAYHIP_FEHLER`, `PAYHIP_STARTSEITE`, `PAYHIP_KOMPLETT`, `BREVO_FORMULAR` sind eingetragen
- `PAYHIP_BASIC`, `PAYHIP_ZUSATZSEITE`, `PAYHIP_SHOPINT`, `PAYHIP_TERMIN`, `PAYHIP_SEO`, `PAYHIP_CHECK` zeigen noch auf kontakt.html: echte Payhip-Links eintragen

Danach im Ordner `website-neu` ausführen:  `python3 _build/build.py`

## Rechtstexte
Impressum, AGB, Widerrufsbelehrung, Rückerstattung und Versand sind aus deiner Wix-Seite übernommen
(Tippfehler/Platzhalter [deine E-Mail-Adresse] behoben). Der Datenschutz ist dein Wix-Text, angepasst
an die neue Technik. Stellen mit `PRÜFEN` in den Dateien unter `_build/pages/` (HTML-Kommentare)
vor dem Livegang von jemandem mit Rechtskenntnis prüfen lassen.

## Aufbau
- `_build/pages/*.html`  = Inhalte je Seite (hier Texte ändern)
- `_build/layout.html`   = Kopf, Weltkarte, Footer (für alle Seiten gleich)
- `assets/tikabi.css`    = Design (Tokens aus dem Designsystem)
- `assets/tikabi.js`     = Welt (Sternenfeld, Parallax, Route, Weltkarte)
- Nach jeder Änderung an `_build/`: `python3 _build/build.py`
