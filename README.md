# HouseDesign — STUDIO

Upload a photo of a room and receive an **AI-generated redesign direction** — a
structured design board describing how the room should be transformed, plus a
render of that same room redesigned.

Every redesign belongs to a signed-in account. Accounts are backed by Firebase
Authentication; storage is capped per plan (500 MB free, 10 GB on Pro).

The uploaded photo is the **before**. The app returns two things:

1. A rendered **design board** — palette swatches, materials, lighting, a
   keep/remove/add plan, a shopping list — from Claude's structured analysis.
2. A rendered **"after" image** — your *actual photo* edited into the redesigned
   room (same architecture and viewpoint, restyled) by OpenAI `gpt-image-1`.

**How the two providers split the work:** Claude (vision) reads the room and
returns a strict-JSON design spec **plus a precise image-edit prompt**; that
prompt + the original photo are sent to `gpt-image-1`'s image-edit endpoint to
produce the "after". Claude does not generate images — so the render step uses
OpenAI.

> Both API keys live only on the Node backend and are never shipped to the
> browser. If `OPENAI_API_KEY` is unset (or the render fails), the app degrades
> gracefully to a board-only result.

---

## Stack

| Layer    | Tech                                                    |
| -------- | ------------------------------------------------------- |
| Frontend | React 19 + Vite, React Router, Tailwind CSS v4          |
| Auth     | Firebase Authentication (email/password + Google)       |
| Backend  | Node.js + Express                                       |
| Database | PostgreSQL (`pg`)                                       |
| Uploads  | local `/uploads`, served only via signed URLs           |
| AI       | Anthropic Messages API (vision) + OpenAI `gpt-image-1`  |

```
HouseDesign/
├─ designer/                 # React + Vite frontend
│  └─ src/
│     ├─ pages/
│     │  ├─ Landing.jsx          public marketing page
│     │  ├─ SignIn / SignUp      auth screens (AuthLayout)
│     │  └─ app/                 the dashboard
│     │     ├─ Overview.jsx      greeting, stats, storage, recent work
│     │     ├─ NewRedesign.jsx   upload + intent + generate
│     │     ├─ Projects.jsx      grid, search, delete
│     │     ├─ ProjectDetail.jsx one board
│     │     ├─ StoragePlan.jsx   quota meter, plans, largest projects
│     │     └─ Settings.jsx      profile, account, privacy, session
│     ├─ components/
│     │  ├─ ui/                  Button, Field, Surface, Modal
│     │  ├─ dashboard/           DashboardLayout, Sidebar, UserMenu, ProjectCard
│     │  ├─ Icon.jsx             the whole icon set (SVG; no emoji anywhere)
│     │  └─ DesignBoard, Swatches, UploadZone, Loading, Reveal, Wordmark
│     └─ lib/
│        ├─ firebase.js          public web config + error copy
│        ├─ auth.jsx             AuthProvider
│        ├─ authContext.js       useAuth + identity helpers
│        ├─ api.js               every request carries the ID token
│        ├─ useResource.js       fetch-on-mount with cancellation
│        └─ plans.js, format.js, color.js, sample.js
└─ server/                   # Express backend
   └─ src/
      ├─ index.js               app wiring
      ├─ auth.js                Firebase ID token verification → users row
      ├─ plans.js               plan catalog, usage, quota enforcement
      ├─ media.js               signed, expiring image URLs
      ├─ storage.js             save / absolutePath / remove
      ├─ routes/
      │  ├─ redesign.js         create, read, list, delete (ownership-scoped)
      │  ├─ account.js          /api/me, storage, plan changes
      │  └─ media.js            signature-checked image delivery
      ├─ claude.js, images.js, validate.js, imageSize.js
      └─ db.js / migrate.js / schema.sql
```

---

## Prerequisites

- **Node.js 18+** (uses global `fetch`)
- **PostgreSQL** running locally (or a connection string to a hosted instance)
- An **Anthropic API key**
- A **Firebase project** with Authentication enabled

---

## Setup

### 1. Install everything

```bash
npm run install:all
```

### 2. Set up Firebase Authentication

In the [Firebase console](https://console.firebase.google.com/):

1. Open your project → **Build → Authentication → Get started**.
   *This step provisions Identity Toolkit for the project. Until you do it,
   every sign-in attempt fails with `CONFIGURATION_NOT_FOUND`.*
2. Under **Sign-in method**, enable **Email/Password** and **Google**.
3. Under **Settings → Authorized domains**, make sure `localhost` is listed.
4. Copy the web config from **Project settings → General → Your apps → Web app**.

Then fill in `designer/.env` (copy `designer/.env.example`):

```
VITE_FIREBASE_API_KEY=…
VITE_FIREBASE_AUTH_DOMAIN=…
VITE_FIREBASE_PROJECT_ID=…
VITE_FIREBASE_STORAGE_BUCKET=…
VITE_FIREBASE_MESSAGING_SENDER_ID=…
VITE_FIREBASE_APP_ID=…
```

These are public values — Firebase is designed for them to ship in the bundle.
Access is decided by the ID token the SDK mints, which the backend verifies.

### 3. Configure the backend env

```bash
cp server/.env.example server/.env
```

| Variable               | Purpose                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`    | **Required.** Claude key. Server-only.                                                          |
| `ANTHROPIC_MODEL`      | `claude-opus-4-8` (best quality) or `claude-sonnet-4-6`                                          |
| `OPENAI_API_KEY`       | Powers the "after" image (`gpt-image-1`). Optional — without it you get a board only.            |
| `OPENAI_IMAGE_MODEL`   | Image model (default `gpt-image-1`)                                                              |
| `OPENAI_IMAGE_SIZE`    | `1024x1024` / `1536x1024` / `1024x1536` / `auto` (default `1536x1024`)                           |
| `OPENAI_IMAGE_QUALITY` | `low` / `medium` / `high` / `auto` (default `high`)                                              |
| `FIREBASE_PROJECT_ID`  | **Required.** Same project id as the frontend. Used to verify ID tokens. Public, not a secret.   |
| `MEDIA_SIGNING_SECRET` | **Required.** Signs image URLs. Generate one (below) and keep it stable.                        |
| `DATABASE_URL`         | Postgres connection string                                                                       |
| `PORT`                 | Backend port (default `5000`)                                                                    |
| `REDESIGN_RATE_LIMIT`  | Max `POST /api/redesign` per **account** per minute (default `10`)                               |
| `PGSSL`                | Set to `require` for managed Postgres needing SSL                                                |

Generate a signing secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Create the database + tables

```bash
createdb housedesign
npm run migrate             # applies server/src/schema.sql (idempotent)
```

### 5. Run both servers

```bash
npm run dev
```

- Frontend → http://localhost:3000
- Backend  → http://localhost:5000 (proxied under `/api`)

Open **http://localhost:3000**, create an account, and upload a room photo.

---

## Accounts and data isolation

This is the part worth reading carefully.

**Identity comes only from a verified token.** The browser signs in with the
Firebase Web SDK and sends the resulting ID token as `Authorization: Bearer …`.
`server/src/auth.js` verifies it against Google's published signing keys —
RS256 signature, issuer, audience, and expiry — then maps the `sub` claim to a
row in `users`. **No route accepts a user id, session token, or account
identifier from the client.** There is nothing for a caller to tamper with.

Verification uses the Firebase JWKS directly rather than `firebase-admin`: it
needs only the public project id (no service-account key file to distribute or
leak) and performs the same checks `verifyIdToken` does. The one thing it does
not do is consult the revocation list, so a token stays valid for its lifetime
(one hour maximum) even if the session is revoked server-side.

**Every query is scoped by `req.user.id`.** Reading or deleting a redesign
requires the row to join back to the calling account:

```sql
SELECT … FROM redesigns r
  JOIN rooms rm ON rm.id = r.room_id
 WHERE r.id = $1 AND rm.user_id = $2
```

A valid id belonging to someone else returns **404**, exactly like an id that
does not exist — the API never reveals that another account's project is there.

**Images are not public.** There is deliberately no `express.static` mount for
`/uploads`. The API returns short-lived **signed URLs**
(`/api/media/<file>?u=…&e=…&s=…`), where the signature is an HMAC over the
filename, the owning account, and the expiry. Changing any of the three
invalidates it. This is what makes `<img src>` work — a browser cannot attach an
`Authorization` header to an image request — without leaving the files open to
anyone who guesses a filename.

**The client-side route guard is a convenience, not the boundary.**
`RequireAuth` keeps signed-out visitors from seeing an empty shell. Bypassing it
reveals nothing, because the server authenticates independently.

---

## Storage and plans

| Plan | Storage | Price       |
| ---- | ------- | ----------- |
| Free | 500 MB  | $0          |
| Pro  | 10 GB   | $12 / month |

- Usage is **summed live** from the rows a user owns (original uploads +
  rendered "after" images) rather than kept in a counter column, so the number
  on the dashboard can never drift from what is really stored.
- Quota is checked **before** the model is called, reserving ~3 MB of headroom
  for the render, so a redesign can never start and then fail to be stored.
- Deleting a project removes the board row, the photo, and the render, and
  returns the space immediately.
- Downgrading below current usage is allowed — nothing is ever deleted — but new
  redesigns stay blocked until the account is back under the cap.

`POST /api/me/plan` records the choice and moves the quota; **no payment
processor is connected**. Swap that handler for a checkout session (and set the
plan from the provider's webhook) when billing goes in — nothing else in the app
reads the plan directly, it all goes through `plans.js`.

---

## API

All routes except `/api/health` and `/api/media/:file` require
`Authorization: Bearer <firebase-id-token>`.

| Method   | Route                  | Description                                                             |
| -------- | ---------------------- | ----------------------------------------------------------------------- |
| `GET`    | `/api/health`          | Liveness + whether a key, model, and auth are configured.                |
| `GET`    | `/api/me`              | Profile, plan, storage usage, project counts, plan catalog.              |
| `GET`    | `/api/me/storage`      | Just the quota meter, for cheap refreshes.                               |
| `POST`   | `/api/me/plan`         | `{ plan: "free" \| "pro" }` — change plan.                               |
| `POST`   | `/api/redesign`        | multipart `image` + `style`/`budget`/`note`. Quota-checked, rate-limited. |
| `GET`    | `/api/redesign/:id`    | One redesign — 404 unless the caller owns it.                            |
| `DELETE` | `/api/redesign/:id`    | Delete it and reclaim the storage — 404 unless the caller owns it.       |
| `GET`    | `/api/redesigns`       | The caller's projects, newest first.                                     |
| `GET`    | `/api/media/:file`     | An image — requires a valid, unexpired signature.                        |

### How Claude is called

`POST https://api.anthropic.com/v1/messages` with headers `x-api-key`,
`anthropic-version: 2023-06-01`, `content-type: application/json`. The room photo
is sent as a **base64 image block first, then the text prompt**
(image-before-text). Claude is told to return **strict JSON only**; the server
parses it, strips stray ``` fences and retries on failure, then validates
against the schema before storing.

---

## Database schema

```
users (id, firebase_uid UNIQUE, email, display_name, photo_url,
       plan, plan_since, last_seen_at, session_token, created_at)
  └─ rooms (id, user_id → users, image_path, mime, width, height, bytes)
       └─ redesigns (id, room_id → rooms, style, budget, user_note, model,
                     result_json jsonb, after_image_path, after_bytes, title)
```

`firebase_uid` has a **partial** unique index (`WHERE firebase_uid IS NOT NULL`)
so legacy MVP rows — which carry a `session_token` and no uid — coexist without
colliding. Those rows are no longer reachable through the API; the pre-auth
history they held is not migrated, since there is no way to prove who owned it.

The room and its redesign are inserted in one transaction: a room without a
redesign would be invisible to the projects list yet still count against the
quota, so the two rows land together or not at all. If the transaction fails,
the files written to disk are removed.

See [`server/src/schema.sql`](server/src/schema.sql). `npm run migrate` is
idempotent and safe to re-run.

---

## Design system

Defined once, in `designer/src/index.css`:

- **Neutrals** — a single warm-grey ramp (`canvas`, `surface`, `sunken`, `ink`,
  `ink-2`, `muted`, `faint`, `line`, `line-2`).
- **Accent** — one clay hue, used sparingly.
- **Type** — Inter for UI, Fraunces for display moments. Self-hosted variable
  fonts; no CDN, no layout shift.
- **Shape** — two radii (`card`, `control`). Surfaces are separated by hairlines,
  not shadows; shadow is reserved for things that genuinely float.
- **Icons** — `components/Icon.jsx` holds the entire set: 24×24, 1.5 stroke,
  `currentColor`. **There are no emoji anywhere in the interface.**

---

## Error handling

Oversized or invalid uploads (415/413), an unauthenticated or expired token
(401), a redesign belonging to someone else (404), an exceeded quota (413 with a
`quota` payload), Anthropic failures (429/502), malformed model JSON (502 after a
fence-strip retry), and DB errors (500) all return clean JSON and render as calm
UI states — never a raw stack trace or a broken board.

---

## Swapping storage / model

- **Object storage:** implement `save` / `absolutePath` / `remove` in
  `server/src/storage.js` (e.g. S3) and export it — nothing else changes.
  `media.js` keeps signing, or hand off to the provider's own signed URLs.
- **Higher design quality:** set `ANTHROPIC_MODEL=claude-opus-4-8`.
