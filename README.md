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

### One score per team per booth

Each booth accepts a team name only once while its score is active. Further submissions return `409 Conflict`, even if the points are higher or the request is identical. Names are matched regardless of letter case, extra spaces, or equivalent Unicode characters. The same team name must be used across CS, AI, and CYS to combine its scores.

An optional idempotency key can identify a game result. Reusing it also returns `409`; a retry cannot replace an existing score:

```http
Idempotency-Key: game-12345
```

New scores return `201`. Ask an organizer to correct mistakes. Removing a score or resetting the leaderboard allows a new submission for that booth.

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

Organizers can add a higher score to correct an existing result. To lower a score, remove it and add the corrected score. Removing a score voids the active result. Removed logs can be permanently deleted from the scrollable history table. Renaming a team updates its display name across all leaderboards and progress views.

## Big-screen mode

Open `/?display=1`, or choose **Big screen** on the public page. This is a presentation layout intended for a projector or large monitor: the overall leaderboard occupies the top section and the CS, AI, and CYS leaderboards appear below it. Each panel can scroll when many teams are present, while the normal five-second refresh continues in the background. The navigation header and organizer controls are hidden so the page shows only competition results.
