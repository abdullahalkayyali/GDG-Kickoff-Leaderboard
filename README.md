# AI Open Day Leaderboard (GDG HTU × ELO)

Live leaderboard for AI Open Day. Two clubs run booth games:

| Club | Game | Booth id |
| --- | --- | --- |
| GDG | Cybersecurity | `cys` |
| GDG | Artificial Intelligence | `ai` |
| GDVC | Doodle Rocket | `doodle-rocket` |
| GDVC | Coaster Chaser | `coaster-chaser` |

Every game is scored out of 1,000. The public page shows three leaderboards:

- **Overall**: the sum of all four games (out of 4,000).
- **GDG booths**: Cybersecurity + AI (out of 2,000).
- **GDVC booths**: Doodle Rocket + Coaster Chaser (out of 2,000).

A team appears on a board as soon as it has a score for any game on that board. Games it hasn't played show as `—` and count as 0.

## Logos

Placeholder logos live in `public/logos/`:

| File | Used for |
| --- | --- |
| `gdg-htu.svg` | Header lockup, left (GDG HTU) |
| `elo.svg` | Header lockup, right (ELO) |
| `gdg.svg` | Above the GDG booths board |
| `gdvc.svg` | Above the GDVC booths board |

To use the real logos, overwrite these files. If your logos are PNGs, drop them in the same folder and update the paths in `src/lib/config.ts` (`EVENT_LOGOS` and the `logo` field of each club).

## Booth score API

Each booth posts its score to `POST /api/v1/booths/<booth id>/scores`:

| Booth | Endpoint |
| --- | --- |
| Cybersecurity | `POST /api/v1/booths/cys/scores` |
| AI | `POST /api/v1/booths/ai/scores` |
| Doodle Rocket | `POST /api/v1/booths/doodle-rocket/scores` |
| Coaster Chaser | `POST /api/v1/booths/coaster-chaser/scores` |

```json
{ "teamName": "Null Pointers", "points": 750 }
```

- `teamName`: 2–48 characters. Matching ignores case and extra spaces.
- `points`: whole number from `0` to `1000`.
- Send `Content-Type: application/json`. No API key is required.

```js
const response = await fetch(`${LEADERBOARD_URL}/api/v1/booths/cys/scores`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "Idempotency-Key": "game-12345" },
  body: JSON.stringify({ teamName: "Null Pointers", points: 750 })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error);
```

### No replays

Each team plays each game once. The first score is final. Any later submission for the same team and booth is rejected with `409 Conflict`:

```json
{ "error": "Null Pointers already played Cybersecurity. Replays are not allowed." }
```

To let a team replay, an organizer removes its score in `/admin`.

### AI booth: two requests

The AI game has two parts, so the AI booth sends two requests per team:

1. After game 1: `points` = game 1 score.
2. After game 2: `points` = game 1 + game 2 (the running total).

The second request replaces the first, and a third request is rejected with `409`. The total in the second request must be at least the game 1 score, or it is rejected with `400`. The combined AI score is capped at 1,000 like every other game. While only game 1 is in, the board shows the AI score with a small `1/2` badge.

### Retries

Network retries should reuse the same `Idempotency-Key` (one key per request, so the AI booth uses a different key for each of its two requests). A retried request with the same key and payload returns `200` with `"replayed": true` instead of a `409`. Without a key, a retry looks like a replay and is rejected.

### Responses

New scores return `201`. The AI booth's second request and idempotent retries return `200`.

```json
{
  "attemptId": "a-generated-uuid",
  "score": 750,
  "submissions": 1,
  "complete": true,
  "created": true,
  "updated": false,
  "replayed": false,
  "teamName": "Null Pointers",
  "booth": "cys"
}
```

`complete` is `false` after the AI booth's first request. Errors return `{ "error": "Human-readable message" }`.

## Public data endpoint

`GET /api/v1/leaderboards` returns the `overall`, `gdg`, and `gdvc` boards and team progress.

## Organizer page

Open `/admin` to sign in to the organizer panel. The page uses the organizer session cookie to protect score-management actions while the booth submission endpoints remain keyless. Organizers can:

- Add or correct booth scores.
- Remove scores.
- Rename teams.
- Reset the leaderboard.
- Search attempts and export results.
- Wipe all logs to permanently delete every submission and clear all scores while keeping team records.
- Wipe all teams to permanently delete every team and submission.

Score changes are recorded in the audit history. A manually added score is final (for AI, enter the combined total). If the team already has a score for that game, remove it first; removing a score voids the active result and lets the team play that game again. Renaming a team updates its display name across all leaderboards and progress views.

## Big-screen mode

Open `/?display=1`, or choose **Big screen** on the public page. This is a presentation layout intended for a projector or large monitor: the overall leaderboard occupies the top section and the GDG and GDVC boards appear side by side below it. Each panel can scroll when many teams are present, while the normal five-second refresh continues in the background. The navigation header and organizer controls are hidden so the page shows only competition results.

## Deploying on Vercel

Deploy it the same way as the kickoff leaderboard, as a **separate** Vercel project with its own database so the two events' scores stay apart:

1. Push this code to a GitHub repo and import it in Vercel (framework: Next.js; `vercel.json` already sets it).
2. In the project, open **Storage** and connect a new Neon Postgres database. This sets `DATABASE_URL`.
3. Add the organizer variables from `.env.example`: `ORGANIZER_USERNAME`, `ORGANIZER_PASSWORD_HASH`, `ORGANIZER_SESSION_SECRET` (generate them with `npx tsx scripts/setup-auth.ts`). Set `DEMO_MODE=false` and `SUBMISSIONS_OPEN=true`.
4. Create the tables once: pull the env locally (`vercel env pull .env.local`) and run `npm run db:setup`.
5. Deploy. Give each booth its endpoint URL from the table above.

The schema is new for this event (four booths, a `submissions` counter for the AI booth), so don't point this app at the kickoff database.
