# TIKABI Website (neu)

Öffnen: `index.html` per Doppelklick (funktioniert offline; der weiche Seitenwechsel
"Reise" läuft nur über einen Webserver / nach dem Hochladen, lokal lädt jede Seite normal).

## Links
Alle Payhip-Links und das Brevo-Formular sind in `_build/links.json` eingetragen (geprüft am 18.10.2026).
Offen: Die Payhip-Verkaufsseiten von Zusatzseite, Shop-Integration, Buchungssystem, SEO Advanced und
Website-Check zeigen noch die englische Payhip-Mustervorlage und müssen in Payhip befüllt werden.

Nach Änderungen im Ordner `website-neu` ausführen:  `python3 _build/build.py`

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
