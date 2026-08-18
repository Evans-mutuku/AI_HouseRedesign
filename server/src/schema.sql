-- ============================================================================
-- HouseDesign / STUDIO schema
--
-- Shape of the domain:
--
--   users
--     └─ homes            a whole-home project; carries a shared palette
--          └─ rooms       a real room, kept across revisions
--               └─ redesigns   a revision timeline (parent_id → previous)
--
--   assets                every stored byte, owned by a user. Quota is a single
--                         SUM over this table, so it can never drift.
--   jobs                  background generation, survives the HTTP request
--   shares                read-only public links
--   checklist_state       "bought it" ticks against a redesign's plan
--   progress_entries      photos of the room as work actually happens
--   favorites             starred redesigns → the taste profile
--
-- Everything user-facing soft-deletes (`deleted_at`) so a misclick is
-- recoverable; a purge job clears the trash after 30 days.
--
-- Idempotent: safe to re-run with `npm run migrate`.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

-- ── Users ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email         text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url     text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan          text NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_since    timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at  timestamptz NOT NULL DEFAULT now();
-- Learned preferences, recomputed from `favorites`. See taste.js.
ALTER TABLE users ADD COLUMN IF NOT EXISTS taste_json    jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Default currency for budgets, ISO 4217.
ALTER TABLE users ADD COLUMN IF NOT EXISTS currency      text NOT NULL DEFAULT 'USD';

ALTER TABLE users ALTER COLUMN session_token DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)
  WHERE firebase_uid IS NOT NULL;

-- ── Assets ──────────────────────────────────────────────────────────────────
-- One row per stored file. `user_id` is the quota owner and the identity a
-- signed URL is minted for; nothing outside this table holds a storage key.

CREATE TABLE IF NOT EXISTS assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,          -- original | render | progress | mask
  variant     text NOT NULL DEFAULT 'full',  -- full | thumb
  storage_key text NOT NULL,
  mime        text NOT NULL,
  bytes       bigint NOT NULL DEFAULT 0,
  width       int,
  height      int,
  -- A thumbnail points at the full-size asset it was derived from, so removing
  -- the parent takes its thumbnail with it.
  parent_id   uuid REFERENCES assets(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_user     ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_parent   ON assets(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_key ON assets(storage_key);

-- ── Homes ───────────────────────────────────────────────────────────────────
-- Groups rooms so a house reads as one scheme. `palette_json` is the agreed
-- through-line; room prompts are told to honour it.

CREATE TABLE IF NOT EXISTS homes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  notes        text,
  palette_json jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_homes_user ON homes(user_id) WHERE deleted_at IS NULL;

-- ── Rooms ───────────────────────────────────────────────────────────────────
-- The durable thing a person owns. Its photo lives in `assets`; its design
-- history lives in `redesigns`.

CREATE TABLE IF NOT EXISTS rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_path text,
  mime       text,
  width      int,
  height     int,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS bytes          bigint NOT NULL DEFAULT 0;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS home_id        uuid REFERENCES homes(id) ON DELETE SET NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS name           text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_type      text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS photo_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL;
-- The architectural inventory read from the photo once, then handed to every
-- render so windows and doors cannot quietly disappear. See architecture.js.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS architecture_json jsonb;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS deleted_at     timestamptz;

CREATE INDEX IF NOT EXISTS idx_rooms_user ON rooms(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_home ON rooms(home_id) WHERE deleted_at IS NULL;

-- ── Redesigns ───────────────────────────────────────────────────────────────
-- A revision. `parent_id` chains them; `revision_no` is 1-based per room.
-- `instruction` is what the user asked for on this pass ("darker walls, keep
-- the sofa") — null on the first.

CREATE TABLE IF NOT EXISTS redesigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  style       text,
  budget      text,
  user_note   text,
  model       text,
  result_json jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS after_image_path text;
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS after_bytes      bigint NOT NULL DEFAULT 0;
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS title            text;
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS parent_id        uuid REFERENCES redesigns(id) ON DELETE SET NULL;
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS revision_no      int NOT NULL DEFAULT 1;
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS instruction      text;
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS render_asset_id  uuid REFERENCES assets(id) ON DELETE SET NULL;
-- The region the user asked to change, normalised 0–1 {x,y,w,h}; null = whole
-- image. Kept so a revision can be replayed and shown back to them.
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS mask_json        jsonb;
-- Budget the user set for this pass, in minor units (cents). Null = no cap.
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS budget_cents     bigint;
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS currency         text NOT NULL DEFAULT 'USD';
-- Result of the post-render architecture check. See architecture.js.
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS fidelity_json    jsonb;
ALTER TABLE redesigns ADD COLUMN IF NOT EXISTS deleted_at       timestamptz;

CREATE INDEX IF NOT EXISTS idx_redesigns_room       ON redesigns(room_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_redesigns_parent     ON redesigns(parent_id);
CREATE INDEX IF NOT EXISTS idx_redesigns_created_at ON redesigns(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_redesigns_revision
  ON redesigns(room_id, revision_no) WHERE deleted_at IS NULL;

-- ── Jobs ────────────────────────────────────────────────────────────────────
-- Generation runs here, not in the request. The client polls; closing the tab
-- no longer loses the work.

CREATE TABLE IF NOT EXISTS jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,                    -- 'redesign'
  status      text NOT NULL DEFAULT 'queued',   -- queued|running|succeeded|failed|cancelled
  stage       text,                             -- human label for the UI
  progress    int  NOT NULL DEFAULT 0,          -- 0–100
  input_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  room_id     uuid REFERENCES rooms(id) ON DELETE CASCADE,
  redesign_id uuid REFERENCES redesigns(id) ON DELETE SET NULL,
  error       text,
  attempts    int NOT NULL DEFAULT 0,
  -- Held by the worker that claimed the job, so a crashed worker's job can be
  -- detected as stale and retried.
  locked_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  started_at  timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_jobs_user   ON jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_claim  ON jobs(status, created_at) WHERE status IN ('queued', 'running');

-- ── Shares ──────────────────────────────────────────────────────────────────
-- A read-only public board. The token is the credential; it can be revoked or
-- allowed to expire.

CREATE TABLE IF NOT EXISTS shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redesign_id uuid NOT NULL REFERENCES redesigns(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz,
  revoked_at  timestamptz,
  view_count  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shares_redesign ON shares(redesign_id);
CREATE INDEX IF NOT EXISTS idx_shares_user     ON shares(user_id, created_at DESC);

-- ── Checklist ───────────────────────────────────────────────────────────────
-- Ticking off the plan. Keyed by a stable slug of the item, not its array
-- index, so a revision that reorders the list does not scramble the ticks.

CREATE TABLE IF NOT EXISTS checklist_state (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redesign_id       uuid NOT NULL REFERENCES redesigns(id) ON DELETE CASCADE,
  item_key          text NOT NULL,
  done              boolean NOT NULL DEFAULT false,
  actual_cost_cents bigint,
  note              text,
  done_at           timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (redesign_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_checklist_redesign ON checklist_state(redesign_id);

-- ── Progress photos ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS progress_entries (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id        uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  photo_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  caption        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  deleted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS idx_progress_room ON progress_entries(room_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- ── Favorites (the taste signal) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS favorites (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  redesign_id uuid NOT NULL REFERENCES redesigns(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, redesign_id)
);
