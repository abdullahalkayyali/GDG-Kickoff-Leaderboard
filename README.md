# GDG HTU · Kickoff Arena

A Vercel-ready Next.js + TypeScript app with four automatically refreshing leaderboards: CS, AI, CYS, and overall. Neon Postgres persists results across function instances and deployments. No local file or in-memory production storage.

## Run the visual demo

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Without a database, local development shows **clearly marked, readonly sample data**. Production on Vercel never falls back to fake standings. Explicit `DEMO_MODE=true` enables the readonly demo on any deployment.

## Deploy to Vercel

1. Push this repository to your Git provider, then import it into Vercel. Framework: **Next.js**. Root directory: this folder. Default install/build commands work (`npm ci`, `npm run build`). Select Node.js 22 or newer.
2. In Vercel Storage / Marketplace, connect **Neon Postgres** to the project. Ensure its connection URL is available as `DATABASE_URL`. Use a separate database/branch for Preview so test submissions cannot affect the event.
3. Booth submissions require no API keys. Configure `ORGANIZER_USERNAME`, `ORGANIZER_PASSWORD_HASH`, and `ORGANIZER_SESSION_SECRET` on Vercel for the organizer sign-in (see below). Keep them server-side.
4. Set `DEMO_MODE=false` and `SUBMISSIONS_OPEN=true` for the real event.
5. Initialize your database **once**. Link locally using `npx vercel link`, then use `npx vercel env pull .env.local` for development variables. Set the intended Neon connection in your ignored `.env.local` file (copy `.env.example` as a starting point), then run:

   ```sh
   npm run db:setup
   ```

   Production/Preview secrets may not be returned by `vercel env pull`. To initialize production, securely supply that database's `DATABASE_URL` locally or run the statements in `db/schema.sql` in Neon's SQL editor. The setup script only creates tables/indexes; it does not clear records. Do not initialize a different database by accident.
6. Redeploy after changing environment variables. Open `/` for standings and `/admin` for the organizer console. The console redirects to its sign-in page unless the browser has a valid organizer session.
7. Rehearse with a separate practice database. Calibrate and freeze `src/lib/config.ts` **before** real teams play. Keep the production database empty until event day.

No Vercel project, database or paid service has been provisioned by this code. You choose and connect them during deployment. No cron, persistent server process, or websocket service is needed. Boards poll one snapshot endpoint every five seconds and stop polling while the tab is hidden.

## Booth API

Each booth posts to its own endpoint:

| Booth | Endpoint | Default body |
| --- | --- | --- |
| CS | `POST /api/v1/booths/cs/scores` | `{ "teamName": "Null Pointers", "duration": 60 }` |
| AI | `POST /api/v1/booths/ai/scores` | `{ "teamName": "Null Pointers", "points": 85 }` |
| CYS | `POST /api/v1/booths/cys/scores` | `{ "teamName": "Null Pointers", "duration": 90 }` |

**Duration is in seconds**, including decimals. Send exactly one configured measurement; do not send normalized score, team ID, or both points and duration. Successful submission means a completed game. Do not submit unfinished games. Negative/nonfinite values and zero durations are rejected; zero raw points is a valid completion. Names must be 2–48 characters. Body size is limited to 4 KiB.

Requests require `Content-Type: application/json`. No Authorization header or API key is needed. Send an optional unique `Idempotency-Key` (1–128 letters, digits, `.`, `_`, `:`, or `-`) per logical result and **reuse it on retries**. Cross-origin browser submission is intentionally not enabled; submit from the booth backend or the built-in organizer console.

Example booth backend (Node.js):

```js
const response = await fetch(`${process.env.LEADERBOARD_URL}/api/v1/booths/cs/scores`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': attemptId // create once, retain for retries
  },
  body: JSON.stringify({ teamName: 'Null Pointers', duration: 60 })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
```

Successful response (`201`; `200` for an identical idempotent retry):

```json
{
  "attemptId": "a-generated-uuid",
  "score": 750,
  "replayed": false,
  "teamName": "Null Pointers",
  "booth": "cs"
}
```

Errors use `{ "error": "Human-readable message" }`: `400` invalid input, `403` submissions closed/demo readonly, `404` unknown booth, `409` duplicate result or conflicting idempotency key, `413` oversized body, `415` wrong content type, `503` missing configuration/database unavailable. Retry temporary failures with the same idempotency key. A replay of a voided submission includes `voided: true` and does not restore it; corrections need a new key.

`GET /api/v1/leaderboards` is public, uncached, and returns all four boards, team progress, counts, server refresh timestamp, demo status, and submission status. Each board includes ranks and its own normalized score. Team progress includes partial totals; only the `boards.overall` array is the overall ranking.

## Team identity and competition rules

- Names are normalized using Unicode NFKC, whitespace collapse, trimming, and case folding. `Null Pointers` and `  NULL   POINTERS ` identify the same team. The first display spelling is retained. Spelling/punctuation differences are different teams. Two teams cannot share a name: organizers should ensure names are unique and distribute exact names to every booth. No fuzzy merging is performed.
- One active official result per team per booth, enforced by a database unique index even for concurrent submissions. Duplicate POSTs do **not** overwrite scores.
- Overall eligibility requires an active result at **each** of CS, AI, and CYS. A completed game scoring zero qualifies. Voiding any required result immediately removes overall eligibility until a replacement is submitted.
- Each booth awards 0–1,000 points. Overall is their unweighted sum (maximum 3,000). Equal point totals share competition rank (1, 1, 3). Alphabetic ordering makes tied display stable without pretending there is a winner.
- Team name alone is an identity label, not proof of ownership. Booth submission endpoints remain keyless. Organizer endpoints require a signed session cookie.

## Scoring configuration

Edit `src/lib/config.ts`; each booth independently supports `duration` or `points`:

```ts
{ type: 'duration', fast: 30, slow: 150 }
{ type: 'points', min: 0, max: 100 }
```

```text
time score   = round(1000 × clamp((slow − duration) / (slow − fast), 0, 1))
points score = round(1000 × clamp((points − min) / (max − min), 0, 1))
```

The API expects the metric configured for the target booth. Validate `slow > fast >= 0` and `max > min >= 0`; the test suite covers the shipped config. Practice runs should establish comparable difficulty. Raw results, scoring version, and calculated points are stored together. **Changing config does not recalculate past results**, so freeze it during competition. Redeploy after pre-event edits and bump `SCORING_VERSION`.

## Organizer tools

`/admin` requires the shared organizer sign-in. Sessions last up to 12 hours and use a signed, HttpOnly, SameSite=Strict cookie (Secure on HTTPS). Sign out using the console button. Use **Add a score** to select a booth and enter a team name plus duration or raw points; normalized points are calculated automatically. Use **Rename** in Team management to update a team's name across every booth and its full audit history. A rename cannot use another team's existing normalized name. Use **Remove score** beside an active result to remove it with a reason, then add a replacement if needed. The console also includes result search and CSV export, including removed results.

Use **Reset leaderboard** at the top of the console to clear all four public boards. Type `RESET` in the confirmation dialog. Reset removes every active score while retaining raw results, prior corrections, and timestamps in the audit trail. Teams can submit again afterward; use a new idempotency key for each new game. Delayed retries of old submissions cannot restore reset results. Demo mode remains readonly.

Organizer endpoints require a valid `gdg_organizer` session cookie. They return `401` without it. Booth endpoints remain keyless.

- `GET /api/admin/attempts`: all active/voided attempts with timestamps and correction reasons.
- `POST /api/admin/attempts`: `{ "booth": "cs", "teamName": "Null Pointers", "duration": 60 }`; supports `Idempotency-Key` too.
- `POST /api/admin/attempts/<uuid>/void`: `{ "reason": "Timer malfunction; corrected result to follow" }`.
- `POST /api/admin/teams/<uuid>/rename`: `{ "teamName": "Null Pointers HTU" }`.
- `POST /api/admin/reset`: `{ "confirmation": "RESET" }`. Returns `{ "reset": true, "removed": 25 }`; any other confirmation returns `400`.

Set `SUBMISSIONS_OPEN=false` in Vercel and redeploy to close booth submissions. The public board switches to “Final standings.” Organizer corrections remain possible. Export results during and at the end of the event. Set up provider backups appropriate for the event.

The app disables browser caching for API responses, uses parameterized SQL, limits payload size, and escapes CSV formula prefixes. Organizer page access, score additions/removals, audit reads, and reset are verified on the server. The reset phrase confirms intent after sign-in. Passwords are stored as salted scrypt hashes, and changing the configured credentials invalidates existing sessions. The app does not use process-local rate limiting.

## Organizer sign-in configuration

Run `node --import tsx scripts/setup-auth.ts` locally, then enter a newline-terminated JSON object with your `username` and `password` when prompted. Input is hidden. The script stores the username, a salted password hash, and a random session secret in ignored `.env.local`, preserving database configuration. Set the same three `ORGANIZER_*` variables in Vercel Production and redeploy; do not commit `.env.local` or use `NEXT_PUBLIC_` names. Regenerating the configuration signs out old sessions.

`POST /api/auth/sign-in` accepts `{ "username": "your-host-name", "password": "your-host-password" }`, validates the credentials, and sets the cookie. `POST /api/auth/sign-out` clears it. The organizer form handles these automatically. API clients must retain the cookie after signing in.

## Big-screen display

Select **Big screen** beside the search box or open `/?display=1` directly. The display layout places the overall leaderboard in the upper half of the screen and the CS, AI, and CYS leaderboards side by side below it. Each ranking scrolls within its own panel when needed. The navigation header is hidden; **Standard view** restores it. The adjacent fullscreen button fills the screen. Scoring and five-second refreshes are unchanged.

## Validation

```sh
npm test
npm run build
```

Tests run the actual Postgres schema and submission queries using PGlite (embedded Postgres), including qualification, zero scores, concurrent uniqueness, idempotency, corrections, reset with preserved audit history, new submissions after reset, ranking ties, normalization, keyless booth validation, organizer login/session protection, and cross-origin rejection. Production still needs a smoke test against your connected Neon database before the event. Build does not require or migrate a database.

## Main files

- `src/components/leaderboard.tsx`: public dashboard and team progress.
- `src/components/admin.tsx`: organizer console.
- `src/lib/config.ts`: booth metrics and score thresholds.
- `src/lib/scoring.ts`: validation, normalization and score formulas.
- `src/lib/store.ts`: atomic writes, audit reads, and rankings.
- `db/schema.sql`: persistent schema and uniqueness constraints.
- `.env.example`: environment setup template.

Official references: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver), [Vercel environment variables](https://vercel.com/docs/environment-variables).
