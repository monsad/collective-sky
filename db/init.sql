CREATE TABLE IF NOT EXISTS sky_assets (
  asset_id      text PRIMARY KEY,
  owner         text NOT NULL,
  kind          text NOT NULL CHECK (kind IN ('message', 'proof')),
  label         text NOT NULL,
  target_slug   text,
  target_name   text,
  distance_ly   numeric,
  message       text,
  event         text,
  lat           numeric,
  lon           numeric,
  occurred_at   timestamptz NOT NULL,
  slot          bigint,
  first_seen    timestamptz NOT NULL DEFAULT now(),
  catalog_hit   boolean NOT NULL
);

CREATE INDEX IF NOT EXISTS sky_assets_occurred_at_idx ON sky_assets (occurred_at DESC);
CREATE INDEX IF NOT EXISTS sky_assets_kind_idx ON sky_assets (kind);

CREATE TABLE IF NOT EXISTS owners (
  address     text PRIMARY KEY,
  added_at    timestamptz NOT NULL DEFAULT now(),
  last_swept  timestamptz
);

CREATE TABLE IF NOT EXISTS themes (
  id           serial PRIMARY KEY,
  label        text NOT NULL,
  size         int NOT NULL,
  sample_ids   text[] NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id           serial PRIMARY KEY,
  body         text NOT NULL,

  fact_digest  jsonb NOT NULL,
  model        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cursor (
  k text PRIMARY KEY,
  v text NOT NULL
);
