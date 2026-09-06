# Music Archive

A personal music **archive**, not a streaming player. The point is not "what did you
listen to?" but "what did you keep?" — you build a collection of tracks, albums and
artists, rate them, tag them by mood, and watch your discography coverage fill in.

Spotify supplies the metadata; the archive is yours.

The current product plan is [MUSIC-ARCHIVE-BRIEF.md](MUSIC-ARCHIVE-BRIEF.md).
The web app is being extended with a personal instrument studio. Historical
audit findings must be checked against the current code before applying them.

## What's in here

| Path          | What it is                                                    |
| ------------- | ------------------------------------------------------------- |
| `index.html`, `css/`, `js/` | The web client — vanilla JS, no build step   |
| `server.js`   | Express API: auth, library, ratings, playlists, Spotify proxy |
| `server/`     | Extracted models, middleware and services                     |
| `mobile/`     | React Native client (Expo Router, TypeScript)                 |
| `assets/`, `design-tokens.json` | Shared visual assets and design tokens      |

The web client speaks to the same API as the mobile app. Track previews come from
Spotify where available and fall back to iTunes.

## Running it

Requires Node 22 (see `.nvmrc`) and MongoDB for persistent data. The existing
archive can use a temporary in-memory store only in explicit development/test
mode. That store loses data on server restart; it is not a persistence solution.

```bash
npm ci
cp .env.example .env   # then fill in every value
NODE_ENV=development npm run dev
```

The server refuses to start if `JWT_SECRET`, `ADMIN_USERNAME` or `ADMIN_PASSWORD`
are missing — there are deliberately no built-in defaults for these. Generate a
secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

The web client is then at `http://localhost:3000`.

After initial configuration, `npm run dev` starts the server with file watching
(`NODE_ENV=development` must be in `.env` or the environment). For production:

```bash
npm run check
NODE_ENV=production npm start
```

There is no frontend compilation step: Express serves `index.html` and browser
ES modules in `js/`. `npm run build` does not exist. Production requires a
reachable `MONGO_URI`, explicit `CORS_ORIGINS`, and HTTPS at the reverse proxy.
An unset `NODE_ENV` applies production protections and refuses an unavailable
database. `/api/health` reports database readiness and Spotify configuration.
Spotify is required for catalog search, not for authentication or the studio.

### Instrument studio (experimental)

Open **Stüdyo**, connect a Web MIDI input or explicitly select **Ekran piyanosu
• Simülasyon**. Sign in to record, give the take a title, start, play and stop.
**Arşive kaydet** confirms MongoDB persistence; **Kayıtlarım** lists stored takes
and recoverable local drafts. **Dinle** synthesizes the captured MIDI events;
**.mid indir** exports a Standard MIDI File, not recorded instrument audio.
**Çalışmalarım** stores a piece and personal notes and links subsequent takes
to that piece and, optionally, a liked catalog track.

Recording limits: 60 minutes or 60,000 MIDI events. IndexedDB checkpoints run
once a second while recording. A sudden browser/process crash can lose the last
second; graceful stop writes the final take. If upload fails, use **Tekrar yükle**
in Kayıtlarım. Drafts belong to the signed-in account on this browser/origin;
clearing site data removes them. Export valuable takes as `.mid` as well.

This is the first MIDI workflow, not completion of every brief phase. Sampled
piano sound, microphone recording, analysis, metronome, A–B loops and PDF/MIDI
attachments are pending. The new studio screens currently use Turkish; main
navigation and the existing archive retain TR/EN/KU. Real hardware acceptance
is still required. See the [delivery report](docs/reports/MIDI_STUDIO_2026-09-05.md).

### Studio verification

`npm run check` runs lint and the unit/regression suite. For persistent storage
tests, provide a **local, disposable MongoDB**; the suite refuses remote hosts
and creates a randomly named test database:

```bash
STUDIO_TEST_MONGO=mongodb://127.0.0.1:27017 npm run check
```

CI starts its own MongoDB service for this test. Tests retain their isolated
database for inspection and do not read `.env` or contact your hosted database.

For the Chrome flow, start the app against a disposable local MongoDB using
explicit test secrets, `ENABLE_MOCK_AUTH=false`, and a matching `CORS_ORIGINS`.
Start Chrome with an isolated profile and `--remote-debugging-port=9227`, then:

```bash
STUDIO_TEST_URL=http://127.0.0.1:3109 npm run test:browser
```

The browser test creates disposable accounts and actual MIDI simulation takes,
tests failed upload/recovery, reload/login, permission denial, a language switch
and responsive layout. It addresses controls by `data-testid` and reads expected
messages from `js/locales/*.json`, so a translation change never turns into a
silent selector failure; the identities are listed in `docs/specs/TESTIDS.md`
and `npm test` fails if a control ships without one. It writes screenshots to `/tmp/music-archive-studio-*.png`. Never point
it at a server containing your personal archive. Automated MIDI input is not a
physical device test.

### Mobile client

```bash
cd mobile && npm install && npm start
```

In development the app finds the backend from Expo's host IP automatically. For a
production build, set `expo.extra.PROD_API_URL` in `mobile/app.json` to your own
API origin — it is empty by default and the app throws if it is left unset.

## Notes

- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` come from the
  [Spotify developer dashboard](https://developer.spotify.com/dashboard).
  Spotify metadata is cached in memory only and audio is never downloaded.
- The admin surface at `/admin` sits behind HTTP Basic auth using the admin
  credentials from the environment.
- Mock authentication exists for local development and is off unless both
  `NODE_ENV=development` and `ENABLE_MOCK_AUTH=true` are set.

## License

MIT — see [LICENSE](LICENSE).
