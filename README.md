# ⚽ Matchreport App

Vollwertige Android-App für Fußball-Spielberichte (E-Jugend und alle Altersklassen).

## Features
- Live-Timer mit Start/Pause/Stopp und Nachspielzeit
- Torerfassung (Tor/Elfmeter/Eigentor) mit Spielminute
- Karten (Gelb/Rot/Zeitstrafe) mit Spielminute
- Spielerwechsel mit Spielminute
- CSV-Import (DFB/FVR Semikolon-Format)
- **7 konfigurierbare Geräte-Sounds** (Tor, Eigentor, Elfmeter, Gelb, Rot, Wechsel, Halbzeit, Spielende)
- **Offline-fähig** — funktioniert ohne Internet
- **Spielbericht-Archiv** — vergangene Spiele bleiben gespeichert
- Vollständiger Spielbericht mit Zeitstempeln
- HTML-Export + Druckvorschau
- Bemerkungen-Feld

## Tech Stack
- React 18 + Vite
- Capacitor 7 (Android Native Wrapper)
- Dexie.js (IndexedDB für Offline-Archiv)
- Custom Kotlin Plugin für Android RingtoneManager
- GitHub Actions für APK-Build

## Build
APK wird automatisch via GitHub Actions gebaut bei jedem Push auf `main`.
Download der APK unter GitHub → Actions → letzter Run → Artifacts.

## Installation
1. APK auf Android-Gerät laden
2. Einstellungen → Apps → Unbekannte Apps → Erlauben
3. APK antippen → Installieren
