Ich seh's! – geprüftes Updatepaket

Enthalten:
- supabase_migration.sql: Spielrunden-Funktionen, Gesamt-Öffnungszähler und korrigierte Berechtigungsprüfung beim Bewerten von Antworten
- rounds.js: Runde starten, Antworten senden, Antworten als richtig markieren, Runde beenden, Öffnungszähler anzeigen und doppelte Spielerliste bereinigen
- index.html: bindet rounds.js ein

Wichtig:
1. Die Migration wurde bereits einmal ausgeführt. Führe diese aktualisierte SQL-Datei erneut vollständig aus, damit die Bewertungsfunktion auf die korrigierte Signatur umgestellt wird.
2. Danach rounds.js im GitHub-Repository als Datei hinzufügen bzw. ersetzen.
3. index.html im Repository durch die enthaltene Datei ersetzen.
4. app.js, config.js und styles.css unverändert lassen.
5. Nach dem Deployment den Ablauf mit zwei Spielern testen.

Der Öffnungszähler summiert die vorhandenen Werte aus public.game_daily_stats. Der vorhandene Edge-Function-Aufruf track-game-view bleibt in app.js erhalten und zählt weiterhin die Seitenaufrufe.

Hinweis: Da Spieler ohne Registrierung über Namen beitreten, ist das eine einfache spielinterne Gastgeberprüfung und keine starke Identitätsauthentifizierung.
