# 24H Stream – KevOne2107 × Sgt_Buddie

Eine responsive, statische Event-Website im J.A.R.V.I.S.-HUD-Stil für den gemeinsamen 24-Stunden-Twitch-Stream von **KevOne2107** und **Sgt_Buddie**. Die Seite benötigt keinen eigenen Server und kann direkt über GitHub Pages ausgeliefert werden.

## Funktionen

- Zwei Twitch-Kanäle mit Profilbild-Fallback, Kanalstatus, Titel, Spiel, Zuschauer- und Followerdaten.
- Twitch-Player als Dual- oder Einzelansicht; beide Chats unter den Streams oder jeweils neben dem Player.
- Event-Countdown, automatische Laufzeit, Fortschrittsbalken und stundenbasierte Meilensteine.
- Dashboard mit aktuellem Publikum, Kanalvergleich, Follower-Verlauf und Follower-Meilensteinen.
- Frei pflegbarer Streamplan, Spiele, Challenges, Clips, Community- und Social-Links.
- Konfigurationsoberfläche unter `config.html`; zentrale Datei `data/config.json`, Standardwerte in `js/defaults.js`.
- Lokales Speichern, JSON-Import/-Export und direkter GitHub-API-Commit.
- GitHub Actions: Aktualisierung der Twitch-Daten alle 15 Minuten und bei Push; automatischer Pages-Deploy.
- Browser-Fallback über DecAPI.me, wenn die Helix-Daten nicht verfügbar sind.
- OBS-Browserquelle mit transparentem Hintergrund und Widget-Auswahl.
- `prefers-reduced-motion`, responsive Layouts und Fehler-/N/A-Zustände.

## Projektstruktur

```text
.
├── index.html
├── config.html
├── README.md
├── css/
│   ├── site.css
│   └── config.css
├── js/
│   ├── defaults.js
│   ├── app.js
│   └── config.js
├── data/
│   ├── config.json
│   ├── stats.json
│   ├── history.json
│   └── clips.json
└── .github/
    ├── workflows/
    │   └── deploy.yml
    └── scripts/
        └── update-data.mjs
```

## Lokal testen

Im Projektordner einen lokalen HTTP-Server starten (nicht per Doppelklick auf `index.html`, da Browser JSON-Dateien bei `file://` blockieren können):

```bash
python -m http.server 8080
```

Danach `http://localhost:8080/` öffnen. Für den Editor `http://localhost:8080/config.html` aufrufen. Die Twitch-Player benötigen eine gültige `parent`-Domain und können lokal je nach Twitch-Einbettungsrichtlinien abweichend reagieren.

## GitHub-Pages-Deployment

1. Ein neues GitHub-Repository erstellen, beispielsweise `24h-twitch-stream`.
2. Den kompletten Inhalt dieses Projektordners in den Repository-Root hochladen und in den Branch `main` pushen.
3. Unter **Settings → Pages → Build and deployment** als Quelle **GitHub Actions** auswählen.
4. Unter **Settings → Secrets and variables → Actions → New repository secret** folgende Secrets anlegen:
   - `TWITCH_CLIENT_ID` – Twitch Developer Application Client ID.
   - `TWITCH_CLIENT_SECRET` – zugehöriges Client Secret.
5. Unter **Settings → Actions → General → Workflow permissions** sicherstellen, dass der Workflow Repository-Inhalte schreiben darf. Die YAML-Datei fordert bereits `contents: write`, `pages: write` und `id-token: write` an.
6. Unter **Actions** den Workflow „Website aktualisieren und auf GitHub Pages veröffentlichen“ einmal manuell über **Run workflow** starten.
7. Nach erfolgreichem Deployment die von GitHub angezeigte Pages-URL öffnen. `config.html` ist unter derselben URL erreichbar.

Die geplante Aktualisierung läuft danach alle 15 Minuten. Jeder Push auf `main` oder `master` startet ebenfalls den Workflow. Die vom Workflow geschriebenen Statistik-Commits verwenden `[skip ci]`, damit sie nicht unnötig einen weiteren Push-Lauf auslösen.

## Twitch-Daten und Berechtigungen

### Helix-App-Zugriff

`TWITCH_CLIENT_ID` und `TWITCH_CLIENT_SECRET` werden ausschließlich als GitHub-Secrets verwendet. Der Workflow erzeugt daraus zur Laufzeit ein Twitch-App-Access-Token und fragt pro Kanal ab:

- Kanal-ID, Anzeigename, Profilbild und Beschreibung (`users`)
- Live-Status, Streamtitel, Spiel, Zuschauerzahl und Startzeit (`streams` / `channels`)
- aktuelle Clips (`clips`)

Diese Werte werden nach `data/stats.json` und `data/clips.json` geschrieben. `data/history.json` erhält alle 15 Minuten einen Verlaufspunkt. Die Dateien enthalten keine Zugangsdaten.

### Followerzahlen

Twitch stellt die Follower-Gesamtzahl nicht allgemein über den reinen App-Access-Token bereit. Der Helix-Endpunkt für Kanal-Follower verlangt einen kanalbezogenen User-Access-Token mit passender Berechtigung, beispielsweise `broadcaster:read:followers` oder `moderator:read:followers`.

Optional können zwei zusätzliche Repository-Secrets gesetzt werden:

- `TWITCH_USER_TOKEN_KEVONE2107`
- `TWITCH_USER_TOKEN_SGT_BUDDIE`

Jeder Token muss für den jeweiligen Kanal autorisiert sein. Ohne diese Tokens verwendet der Workflow einen bereits bekannten Snapshot, sofern vorhanden; im Browser versucht die Seite ergänzend DecAPI.me. Funktioniert auch dieser Fallback nicht, wird `N/A` angezeigt. Tokens gehören niemals in `data/config.json`, `defaults.js` oder andere Repository-Dateien.

### TwitchTracker

Der Workflow versucht zusätzlich den auf `https://twitchtracker.com/api` sichtbaren Endpunkt `https://twitchtracker.com/api/channels/summary/<login>`. Dieser Endpunkt ist nicht als stabile offizielle Twitch-API dokumentiert und kann mit HTTP 403 blockiert werden. Der Workflow fängt diese Fehler ab und speichert Status bzw. empfangene JSON-Daten separat unter `stats.tracker`. Ein Fehler beim Tracker verhindert die Twitch-Helix-Aktualisierung nicht.

TwitchMetrics- und SullyGnome-Webseiten werden nicht als verlässliche Daten-API behandelt. Das Projekt zeigt nur verifizierte vorliegende Werte; unbekannte Werte bleiben `N/A`. Im Quellregister sind die Profile verlinkt, damit Besucher die externen Statistiken direkt prüfen können.

## Konfiguration

Die editierbare Konfiguration liegt zentral in `data/config.json`. `js/defaults.js` stellt Standardwerte bereit, wenn die JSON-Datei nicht erreichbar oder unvollständig ist.

Unter `config.html` sind die wichtigsten Konfigurationsbereiche in Formularfeldern organisiert. Komplexe Listen (Streamer, Links, Programmpunkte, Spiele, Challenges und Clips) werden als JSON-Arrays bearbeitet. Es gibt zusätzlich einen vollständigen JSON-Editor.

### Speichern

- **Lokal speichern:** legt einen Override im `localStorage` des aktuellen Browsers ab. Bei gesperrtem Speicher erscheint eine Fehlermeldung.
- **JSON herunterladen / kopieren / importieren:** exportiert oder übernimmt eine gültige JSON-Konfiguration.
- **Auf GitHub speichern:** schreibt `data/config.json` per GitHub Contents API auf den ausgewählten Branch. Benötigt einen Fine-grained Personal Access Token mit Zugriff auf das konkrete Repository und **Contents: Read and write**. Der Token wird nur im Browser gehalten; mit aktivierter Merkhilfe wird er im lokalen Browser-Speicher abgelegt. Er wird nie in die Projektdateien geschrieben.
- **Lokale Änderungen verwerfen:** entfernt den Browser-Override und lädt die Repository-Datei erneut.
- **Standardwerte:** lädt die Werte aus `js/defaults.js` in den Editor.

`?nocfg=1` ignoriert den lokalen Browser-Override und verwendet ausschließlich die Repository-Konfiguration mit den Standardwerten als Fallback.

### Eventstart festlegen

In `config.html` unter **Event & Laufzeit → Event-Start** einen ISO-Zeitstempel mit Zeitzone festlegen, zum Beispiel `2026-11-21T18:00:00+01:00`. Ohne Startzeit wird keine Countdown-Zeit erfunden; die Website zeigt dann `N/A` bzw. „Startzeit nicht festgelegt“.

## OBS-Browserquelle

Die URL-Parameter können direkt an die GitHub-Pages-URL angehängt werden:

| Parameter | Funktion |
|---|---|
| `?obs=1` | Transparenter OBS-Modus ohne Kopf- und Fußbereich; Standard-Widget ist der Player. |
| `&widget=player` | Player-Widget. |
| `&widget=hero` | Arc-Reactor / Countdown-Widget. |
| `&widget=dashboard` | Dashboard-Widget. |
| `&widget=program` | Programm-Widget. |
| `&widget=clips` | Clips-Widget. |
| `&widget=links` | Community-Links. |
| `&view=dual` | Beide Streams. |
| `&view=a` | Nur KevOne2107. |
| `&view=b` | Nur Sgt_Buddie. |
| `&start=2026-11-21T18:00:00+01:00` | Testet den Countdown bzw. die Laufzeit unabhängig von der gespeicherten Startzeit. |

Beispiel:

```text
https://BENUTZER.github.io/24h-twitch-stream/?obs=1&widget=player&view=dual
```

Twitch benötigt für die Einbettung die tatsächliche Host-Domain als `parent`. Die Seite setzt diese Domain automatisch aus `window.location.hostname` zusammen. Bei einer eigenen Domain muss diese Domain für die Twitch-Player-Einbettung zugelassen sein.

## Recherche-Stand der vorbefüllten Daten (04.11.2026)

- **KevOne2107:** TwitchMetrics zeigte für den Zeitraum **05.10.2026 bis 04.11.2026** 727 Follower, +328 Follower, 2.879 Zuschauerstunden, 52 Peak-Zuschauer, 141 Live-Stunden, ca. 20 durchschnittliche Zuschauer und Rang **#238** unter deutschsprachigen GTA-V-Kanälen. Die dort erfasste Kanalbeschreibung nennt Musik, GTA-RP und weitere Spiele. Diese Werte sind ein zeitgebundener Drittanbieter-Snapshot, keine Live-Messung.
- **Sgt_Buddie:** im KLAERWERK-Streamverzeichnis-Suchergebnis aufgeführt. Ein eindeutiges Detailprofil und belastbare Statistikwerte konnten bei der Recherche nicht ermittelt werden; die Felder stehen auf `N/A`.
- **KLAERWERK:** Das Profil von KevOne2107 ist unter `https://forum.klaerwerk-community.de/streams/channels/kevone2107.415/` verlinkt. Sgt_Buddie wurde im Verzeichnis-Suchergebnis auf Seite 2 gefunden; ein verifizierter individueller Profil-Link blieb offen.
- **Discord:** Der öffentliche KLAERWERK-Community-Server ist über die offizielle Forenseite verlinkt: `https://discord.com/invite/39XUadzkgw`. Persönliche Discord-Einladungen von KevOne2107 oder Sgt_Buddie konnten nicht verifiziert werden.
- **YouTube, X, Instagram, TikTok:** keine eindeutigen, öffentlich verifizierbaren Konten gefunden. Sie können nach Verifizierung im Editor ergänzt werden.
- **Profilbilder:** werden zur Laufzeit aus Twitch Helix geladen. Ohne Bild wird der Initialen-Fallback angezeigt.

## Datenquellen

- Twitch / KevOne2107: https://www.twitch.tv/kevone2107
- Twitch / Sgt_Buddie: https://www.twitch.tv/sgt_buddie
- TwitchMetrics / KevOne2107: https://www.twitchmetrics.net/c/731403981-kevone2107
- TwitchTracker / KevOne2107: https://twitchtracker.com/kevone2107
- TwitchTracker / Sgt_Buddie: https://twitchtracker.com/sgt_buddie
- TwitchTracker API-Hinweis: https://twitchtracker.com/api
- SullyGnome / KevOne2107: https://sullygnome.com/channel/kevone2107
- SullyGnome / Sgt_Buddie: https://sullygnome.com/channel/sgt_buddie
- KLAERWERK / KevOne2107: https://forum.klaerwerk-community.de/streams/channels/kevone2107.415/
- KLAERWERK / Stream-Verzeichnis: https://forum.klaerwerk-community.de/streams/page-2?view=table
- KLAERWERK / Livestream-Übersicht: https://forum.klaerwerk-community.de/streams/
- KLAERWERK / Discord-Infoseite: https://forum.klaerwerk-community.de/discord/
- KLAERWERK / öffentlicher Discord-Einladungslink: https://discord.com/invite/39XUadzkgw

## Bekannte Grenzen / ehrliche Statusprüfung

- Das Repository kann nicht aus dieser Umgebung heraus in ein GitHub-Konto übertragen oder unter deinem Account veröffentlicht werden. Dafür sind deine Repository-Daten und ein Token erforderlich; die GitHub-Konfigurationsseite übernimmt den Commit nach Einrichtung.
- Der echte GitHub-Pages-Deploy, echte Twitch-Helix-Aufrufe mit deinen Secrets, die Twitch-Player in deinem OBS und die GitHub-API-Speicherung lassen sich ohne dein GitHub-Repository, Twitch-App-Zugangsdaten und Live-Kanalkontext nicht end-to-end ausführen.
- Twitch-Embeds können durch Browser-Tracking-Schutz, Drittanbieter-Cookies, Kanal-Embed-Einstellungen oder falsche `parent`-Domains eingeschränkt sein.
- DecAPI.me ist ein externer Fallback ohne Verfügbarkeitsgarantie. Bei Ausfall, CORS-Sperre oder Rate-Limit werden Werte als `N/A` behandelt.
- TwitchTracker kann 403 liefern; SullyGnome/TwitchMetrics werden nicht gescrapt. Nicht verfügbare historische Kennzahlen und Profile bleiben `N/A`.
- Der geplante Programminhalt, genaue Eventstartzeit, Challenges, Discord-Links und weitere Social-Media-Profile wurden nicht erfunden. Sie können über `config.html` ergänzt werden.
