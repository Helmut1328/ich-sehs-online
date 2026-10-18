# Ich seh's! – Online-Spiel

Mobile-first HTML/CSS/JavaScript-Grundgerüst für GitHub Pages. Es ist bewusst eine **Vorschau**: Die Oberfläche und der Aufrufzähler sind vorbereitet, aber Raum-Erstellung, Beitritt, Echtzeit-Spielrunden und Antworten sind noch nicht mit der Datenbank verbunden.

## Dateien
- `index.html` – Startseite und Spieloberfläche
- `styles.css` – responsives Design für Smartphones und größere Bildschirme
- `app.js` – Modusauswahl, Vorschau für Raumcode, Aufrufzähler
- `config.js` – öffentliche Supabase-Konfiguration

## Wichtig: Supabase-Schlüssel
In `config.js` gehört ausschließlich der öffentliche **Publishable Key** (oder der alte `anon`-Key). Niemals `service_role`, `secret` oder andere geheime Schlüssel in diese Datei oder in GitHub Pages schreiben.

Die Aufrufzählung verwendet die bereits angelegte Edge Function:
`https://wxymjgjwndavcglgbyq.supabase.co/functions/v1/track-game-view`

## GitHub Pages veröffentlichen
1. Auf GitHub ein neues Repository erstellen, zum Beispiel `ich-sehs-online`.
2. Diese Dateien im Repository-Hauptverzeichnis hochladen (nicht den ZIP-Ordner selbst, sondern die vier Dateien).
3. Repository → **Settings** → **Pages** öffnen.
4. Unter **Build and deployment** bei **Source** `Deploy from a branch` auswählen.
5. Branch `main` und Ordner `/ (root` auswählen, dann **Save**.
6. Warten, bis GitHub Pages eine URL anzeigt.

## Nächste Entwicklungsstufe
1. Öffentlichen Supabase-Key in `config.js` eintragen.
2. Sichere Edge Functions für Raum erstellen und Beitritt implementieren.
3. Datenbankzugriffe mit den bestehenden Tabellen `rooms`, `players`, `rounds` und `answers` verbinden.
4. Realtime-Synchronisierung, 60-Sekunden-Runden, Bild-Upload und Rangliste ergänzen.
5. Fotos nach einer abgeschlossenen Runde löschen und verwaiste Uploads regelmäßig bereinigen.

Die Datenbankstruktur und vorhandene Supabase-Konfiguration sollen vor der Implementierung der Online-Funktionen geprüft werden; bestehende Projekteinstellungen nicht blind überschreiben.
