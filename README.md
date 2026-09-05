# Music Archive

A personal music **archive**, not a streaming player. The point is not "what did you
listen to?" but "what did you keep?" — you build a collection of tracks, albums and
artists, rate them, tag them by mood, and watch your discography coverage fill in.

Spotify supplies the metadata; the archive is yours.

> **Archived.** This repository is published as a snapshot of the project and is
> not actively maintained. There is no hosted instance — the code runs only if you
> deploy it yourself, pointing it at your own backend and your own Spotify
> credentials. Issues and pull requests are not being monitored.

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

Requires Node 18+ and a MongoDB connection string (the server falls back to an
in-memory store if MongoDB is unreachable, which is fine for a quick look).

```bash
npm install
cp .env.example .env   # then fill in every value
npm start
```

The server refuses to start if `JWT_SECRET`, `ADMIN_USERNAME` or `ADMIN_PASSWORD`
are missing — there are deliberately no built-in defaults for these. Generate a
secret with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

The web client is then at `http://localhost:3000`.

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
