# GDG HTU Kickoff Leaderboard

Web app for the GDG HTU kickoff event. The Next.js app reads and writes scores through server-side API routes backed by the event database. The public board polls for fresh results and shows separate CS, AI, and CYS rankings alongside an overall ranking. A team appears overall only after completing all three challenges. Overall points are the sum of the three booth scores, with a maximum of 3,000 points.

## Booth score API

Each booth posts its final score to its endpoint:

| Booth | Endpoint |
| --- | --- |
| CS | `POST /api/v1/booths/cs/scores` |
| AI | `POST /api/v1/booths/ai/scores` |
| CYS | `POST /api/v1/booths/cys/scores` |

Send JSON:

```http
Content-Type: application/json
```

```json
{
  "teamName": "Null Pointers",
  "points": 750
}
```

- `teamName`: 2–48 characters.
- `points`: whole number from `0` to `1000`.
- No API key or authorization header is required.

Example:

```js
const response = await fetch(
  `${LEADERBOARD_URL}/api/v1/booths/cs/scores`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamName: "Null Pointers", points: 750 })
  }
);

const result = await response.json();
if (!response.ok) throw new Error(result.error);
```

Replace `LEADERBOARD_URL` with the website URL.

### Score updates

Only the highest score for a team at a booth is kept. A higher submission updates the score. An equal or lower submission is ignored.

Optionally send an idempotency key. Create one key per game result and reuse it when retrying that request:

```http
Idempotency-Key: game-12345
```

New scores return `201`. Updates, ignored lower scores, and repeated idempotent requests return `200`.

```json
{
  "attemptId": "a-generated-uuid",
  "score": 750,
  "created": true,
  "updated": false,
  "replayed": false,
  "teamName": "Null Pointers",
  "booth": "cs"
}
```

Errors return `{ "error": "Human-readable message" }`.

## Public data endpoint

`GET /api/v1/leaderboards` returns all four leaderboards and team progress.

## Organizer page

Open `/admin` to sign in to the organizer panel. The page uses the organizer session cookie to protect score-management actions while the booth submission endpoints remain keyless. Organizers can:

- Add or correct booth scores.
- Remove scores.
- Rename teams.
- Reset the leaderboard.
- Search attempts and export results.

Score changes are recorded in the audit history. Adding a score follows the same higher-score rule as booth submissions; removing a score voids the active result. Renaming a team updates its display name across all leaderboards and progress views.

## Big-screen mode

Open `/?display=1`, or choose **Big screen** on the public page. This is a presentation layout intended for a projector or large monitor: the overall leaderboard occupies the top section and the CS, AI, and CYS leaderboards appear below it. Each panel can scroll when many teams are present, while the normal five-second refresh continues in the background. The navigation header and organizer controls are hidden so the page shows only competition results.
