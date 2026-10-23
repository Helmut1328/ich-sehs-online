Ich seh's! – Erweiterungspaket v2

Enthalten:
- rounds.js: Auswahl vor Spielstart zwischen „Antwort erraten“ und „Finde den Punkt“ sowie Einstellung, ob der Rundenchef rotiert.
- migration_v2.sql: Supabase-Felder und RPCs für die Rundenchef-Einstellung und die automatische Kreis-Auswertung.
- INSTALLATION.txt: Installations- und Testanleitung.

Wichtiger Hinweis:
Die Dateien wurden auf Basis des aktuellen Projektstands erstellt. Die SQL-Migration wurde nicht gegen das Live-Supabase ausgeführt und das Frontend nicht in einem echten Mehrgeräte-Spiel getestet. Vor Veröffentlichung zuerst Sicherung erstellen, Migration ausführen und Test mit mehreren Geräten machen.

Update nach Screenshot-Feedback: doppelte Spielmodus-Auswahl entfernt; die Auswahl oben auf der Startseite steuert den Spielmodus. Zielkreis lässt sich innerhalb verschieben und am Griff in der Größe anpassen. SQL-Migration erweitert die bestehende Mode-Constraint um den neuen Modus.

Korrektur: Im Modus „Finde den Punkt“ wird das zusätzliche statische Bild ausgeblendet; es bleibt nur das interaktive Bild mit Zielkreis/Tipp-Markierungen sichtbar.
