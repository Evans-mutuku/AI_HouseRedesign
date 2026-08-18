# HouseDesign - STUDIO

Upload a photo of a room and get a **costed, phased redesign plan** - plus a
render of that same room, restyled - then keep asking for changes until it is
right.

Every room belongs to a signed-in account and keeps its full revision history.
Storage is capped per plan (500 MB free, 10 GB on Pro), and uploads are
compressed on arrival so that goes a long way.

**What lands on a board:**

- a palette pulled from the room, matched to real, stocked paint
- a plan split into **this weekend / this month / the full thing**, every line
  costed against a budget you set, with a checklist you tick as you buy
- a to-scale **floor plan** of the room after the redesign
- the "before" photo **annotated** with what is and is not working
- a **render of your actual room**, checked afterwards to make sure it did not
  delete your windows

---

## Stack

| Layer      | Tech                                                       |
| ---------- | ---------------------------------------------------------- |
| Frontend   | React 19 + Vite, React Router, Tailwind CSS v4             |
| Auth       | Firebase Authentication (email/password + Google)          |
| Backend    | Node.js + Express, in-process job queue                    |
| Database   | PostgreSQL (`pg`)                                          |
| Images     | `sharp` - re-encode, resize, thumbnail                      |
| Storage    | local `/uploads`, served only via signed URLs               |
| AI         | Anthropic Messages API (vision) + OpenAI `gpt-image-1`      |

---

## Setup

### 1. Install

```bash
npm run install:all
```

### 2. Firebase Authentication

In the [Firebase console](https://console.firebase.google.com/):

1. **Build → Authentication → Get started.** *This provisions Identity Toolkit.
   Until you do it, every sign-in fails with `CONFIGURATION_NOT_FOUND`.*
2. Under **Sign-in method**, enable **Email/Password** and **Google**.
3. Under **Settings → Authorized domains**, make sure `localhost` is listed.
4. Copy the web config into `designer/.env` (see `designer/.env.example`).

Those values are public by design - Firebase expects them in the bundle. Access
is decided by the ID token the SDK mints, which the backend verifies.

### 3. Backend env

```bash
cp server/.env.example server/.env
```

Required: `ANTHROPIC_API_KEY`, `FIREBASE_PROJECT_ID` (same project as the
frontend), `MEDIA_SIGNING_SECRET`, `DATABASE_URL`. `OPENAI_API_KEY` is optional -
without it you get a board with no render. Every knob is documented in
`.env.example`.

### 4. Database

```bash
createdb housedesign
npm run migrate
```

`migrate` applies the schema **and** backfills older rows - it registers legacy
images as assets, generates their thumbnails, upgrades pre-costing boards, and
numbers existing revisions. Idempotent; safe on every deploy.

### 5. Run

```bash
npm run dev
```

Frontend → http://localhost:3000 · Backend → http://localhost:5000

---

## How a redesign runs

Generation is a **background job**. The upload request enqueues and returns
immediately with a job id; a worker in the same process claims it and reports
progress back through the row. Closing the tab, reloading, or switching devices
costs nothing - the UI reattaches to any running job.

```
POST /api/rooms  ──►  jobs row (queued)
                        │
        worker claims it (FOR UPDATE SKIP LOCKED)
                        │
   1. Survey the room ──────────► cached on rooms.architecture_json
   2. Design the board ─────────► concept, palette, costed + phased plan
   3. Draw the floor plan ─────► normalised rectangles → SVG
   4. Render the "after" ──────► gpt-image-1 images/edits
   5. Check the render ────────► every window and door still there?
        └─ if not, reinforce the prompt naming what was lost, render again
   6. Commit room + revision in one transaction
```

The survey runs **once per room**. A room's windows do not move between
revisions, so a revision re-runs only steps 2–5 - which is what makes asking for
a change cheap.

### Why the render used to delete windows

Three separate causes, all fixed:

1. **The output size was fixed at `1536x1024`.** A portrait photo came back
   reframed to landscape, and whatever sat at the top and bottom - very often a
   tall window or a door head - was cropped out of existence. The size is now
   chosen to match the source aspect ratio.
2. **"Preserve the architecture" was one clause in a paragraph the design model
   wrote freehand**, competing with a vivid description of everything that
   should change. Now a separate vision pass inventories every window, door,
   fireplace, and alcove - position, frame, glazing, what is visible through it -
   and the render prompt is composed server-side with that list enumerated
   **first and last**, the two positions a model weights most. The creative
   direction is fenced into the middle and explicitly forbidden from mentioning
   structure.
3. **Nothing checked the result.** Now Claude compares the render against the
   survey and reports anything removed, covered, moved, or resized. If something
   is missing, the prompt is reinforced with the specific failure ("the sash
   window on the left wall was covered") and it renders again. The verdict is
   stored on the revision and surfaced in the UI either way, so a bad render is
   visible rather than silent.

`input_fidelity: high` on the edit call is the fourth lever.

---

## Accounts and data isolation

**Identity comes only from a verified token.** The browser sends its Firebase ID
token as `Authorization: Bearer …`; `server/src/auth.js` verifies it against
Google's published signing keys - RS256 signature, issuer, audience, expiry -
then maps `sub` to a `users` row. **No route accepts a user id, session token, or
account identifier from the client.**

Verification uses the Firebase JWKS directly rather than `firebase-admin`: it
needs only the public project id, with no service-account key to distribute or
leak, and performs the same checks. It does not consult the revocation list, so
a token stays valid for its lifetime (one hour max) even if revoked server-side.

**Every query is scoped by `req.user.id`**, and ownership is a `WHERE` clause,
not an `if`:

```sql
SELECT … FROM redesigns d
  JOIN rooms r ON r.id = d.room_id
 WHERE d.id = $1 AND r.user_id = $2
```

Another account's id returns **404**, exactly like one that does not exist.

**Images are not public.** There is deliberately no `express.static` mount for
`/uploads`. The API returns short-lived **signed URLs**
(`/api/media/<file>?u=…&e=…&s=…`) where the signature is an HMAC over the
filename, the owning account, and the expiry - change any of the three and it
stops working. Shared boards get their own two-hour signatures.

---

## Storage

| Plan | Storage | Price       |
| ---- | ------- | ----------- |
| Free | 500 MB  | $0          |
| Pro  | 10 GB   | $12 / month |

**Everything is compressed on upload.** A phone photo arrives at 3–8 MB of JPEG
at 4000px; nothing here needs more than 2048px, so it is re-encoded to WebP at
q80 with a 640px thumbnail alongside. In practice that is a **90%+ reduction** -
a 2.8 MB upload becomes about 184 KB including its thumbnail - which is the
difference between roughly 60 and roughly 500 redesigns inside the free plan.
Grids load the thumbnail, not a scaled-down full render.

Usage is one live `SUM` over the `assets` table, which every stored byte is
registered in, so the meter cannot drift from what is on disk. Trashed work
still counts until the trash is emptied; the dashboard says how much emptying
would return.

`POST /api/me/plan` records the choice and moves the quota - **no payment
processor is connected**. Swap that handler for a checkout session when billing
goes in; nothing else reads the plan directly.

---

## Schema

```
users ──┬─ homes ──── rooms ──── redesigns (revision chain via parent_id)
        │                │            ├── checklist_state
        │                ├── progress_entries
        │                └── architecture_json  (the cached survey)
        ├─ assets        every stored byte; the quota is one SUM over this
        ├─ jobs          background generation
        ├─ shares        read-only public links
        └─ favorites     the taste signal
```

- **`rooms` → `redesigns` is one-to-many and now actually used.** A room is the
  durable thing; a redesign is a revision of it, chained by `parent_id` and
  numbered by `revision_no`. Nothing is overwritten.
- **`assets`** is the only table holding a storage key. A thumbnail points at its
  parent and dies with it.
- Rooms, revisions, and homes **soft-delete** (`deleted_at`); a janitor purges
  after 30 days and sweeps files nothing points at.

See [`server/src/schema.sql`](server/src/schema.sql).

---

## API

All routes require `Authorization: Bearer <firebase-id-token>` except
`/api/health`, `/api/media/:file` (signature), and `/api/share/:token`.

| Method   | Route                                    | Description                                        |
| -------- | ---------------------------------------- | -------------------------------------------------- |
| `POST`   | `/api/rooms`                             | Upload a photo, create a room, enqueue the first pass |
| `GET`    | `/api/rooms`                             | The caller's rooms                                  |
| `GET`    | `/api/rooms/:id`                         | One room + its revision timeline + any running job   |
| `PATCH`  | `/api/rooms/:id`                         | Rename, or move between homes                        |
| `DELETE` | `/api/rooms/:id`                         | Move to trash                                        |
| `POST`   | `/api/rooms/:id/revisions`               | Ask for a change - instruction, budget, or region     |
| `GET`/`POST`/`DELETE` | `/api/rooms/:id/progress`   | Progress photos                                      |
| `GET`    | `/api/redesigns/:id`                     | One revision's full board + checklist                |
| `GET`    | `/api/redesigns/:id/paints`              | Palette matched to real paint                        |
| `PUT`    | `/api/redesigns/:id/checklist/:key`      | Tick an item, record what it cost                    |
| `PUT`    | `/api/redesigns/:id/favorite`            | Star it; recomputes the taste profile                |
| `POST`/`DELETE` | `/api/redesigns/:id/share`        | Create or revoke a public link                       |
| `GET`    | `/api/jobs` · `/api/jobs/:id`            | Running work; poll one job                           |
| `POST`   | `/api/jobs/:id/cancel`                   | Stop a job mid-flight                                |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/homes`         | Whole-home projects and their shared palette         |
| `GET`    | `/api/trash`                             | Deleted work, still recoverable                      |
| `POST`   | `/api/trash/restore` · `/api/trash/empty`| Restore, or delete for good                          |
| `GET`    | `/api/me` · `/api/me/storage` · `POST /api/me/plan` | Account, quota, plan             |
| `GET`    | `/api/share/:token`                      | Public read-only board                               |

### Talking to Claude

Three calls, each constrained by a JSON Schema passed as
`output_config.format` - the API enforces the shape rather than us hoping a
prompt was followed. (Assistant prefill, the older trick for this, is rejected by
current models.) Adaptive thinking is on; `validate.js` still normalises and
recomputes every number, because the model is good at pricing a sofa and bad at
adding up twenty of them.

The floor plan is asked for separately: together, the board and plan schemas
exceed what the API will compile into a sampling grammar.

---

## Features worth knowing about

**Revisions.** "Keep the sofa but make the walls darker" adds a revision rather
than replacing anything. Every version stays selectable, and you can branch from
any of them.

**Region edits.** Drag a box over one part of the room and only that area is
edited - everything outside comes back pixel-identical, via a mask on the edit
call.

**Phased, costed plans.** Set a real budget and every line gets a price and a
phase. Totals are recomputed server-side from the line items, so the number at
the top always agrees with the list beneath it.

**Paint matching.** Palette colours matched to Farrow & Ball, Benjamin Moore,
Sherwin-Williams, and Dulux by CIEDE2000 distance in CIELAB. **The hex values
behind the catalogue are the commonly published screen approximations, not
manufacturer colorimetric data** - so every match carries how close it actually
is, and the panel always shows the "go get a physical sample" disclaimer. Swap
`server/src/paints.js` for licensed data and nothing else changes.

**Sharing.** A public link carries the design - palette, plan, render, floor plan
- and deliberately not the budget, the checklist, or anything about the account.
Revocable, expiring, and its images are signed for two hours at a time.

**PDF export.** The browser's own print-to-PDF, driven by a print stylesheet.
Chrome and controls drop away, the board reflows to one column, and sections are
kept off page folds.

**Taste profile.** Starring boards builds a preference profile that is folded
into later prompts. Derived from favourites only - nothing to fill in.

---

## Testing note

The pipeline was verified end to end against live Anthropic and OpenAI APIs: two
accounts, cross-account reads/writes/deletes refused, a full generation, a
revision, sharing, checklists, trash, and quota accounting - 67 checks, plus 60
more asserting the API returns exactly the fields the UI reads.

**Not exercised:** the fidelity *retry* path. Both test renders passed the
architecture check on the first attempt, so the reinforced-prompt re-render has
never actually fired. The check itself, and the reinforcement prompt it feeds,
are covered by code but not by a real failing render.
