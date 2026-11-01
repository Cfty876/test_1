-- PostgreSQL storage for the existing platform state model.
-- Private state stays AES-256-GCM encrypted in the payload column.
CREATE TABLE IF NOT EXISTS platform_documents (
  key text PRIMARY KEY,
  payload text NOT NULL,
  revision bigint NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_files (
  key text PRIMARY KEY,
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_state_meta (id text PRIMARY KEY, revision bigint NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS platform_state_records (collection text NOT NULL, record_key text NOT NULL, position bigint NOT NULL, payload text NOT NULL, PRIMARY KEY(collection,record_key));
CREATE INDEX IF NOT EXISTS platform_state_records_order ON platform_state_records(collection,position);
