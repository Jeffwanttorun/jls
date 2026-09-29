CREATE TABLE content_workspaces (
 id text PRIMARY KEY,
 schema_version integer NOT NULL CHECK(schema_version > 0),
 draft_revision bigint NOT NULL DEFAULT 1 CHECK(draft_revision > 0),
 published_revision text,
 draft jsonb NOT NULL,
 published jsonb,
 published_snapshot_hash text CHECK(published_snapshot_hash IS NULL OR published_snapshot_hash ~ '^[a-f0-9]{64}$'),
 updated_at timestamptz NOT NULL DEFAULT now() CHECK(isfinite(updated_at)),
 published_at timestamptz CHECK(published_at IS NULL OR isfinite(published_at))
);

CREATE TABLE content_revision_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id text NOT NULL REFERENCES content_workspaces(id),
 revision_no bigint NOT NULL CHECK(revision_no > 0),
 revision_id text NOT NULL,
 change_kind text NOT NULL CHECK(change_kind IN ('seed','save','publish','restore')),
 object_type text NOT NULL,
 object_id text NOT NULL,
 actor text NOT NULL DEFAULT 'Jeff',
 summary text NOT NULL,
 snapshot jsonb NOT NULL,
 snapshot_hash text NOT NULL CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz NOT NULL DEFAULT now() CHECK(isfinite(created_at)),
 UNIQUE(workspace_id,revision_no)
);

CREATE INDEX content_revision_history_workspace_idx ON content_revision_history(workspace_id,revision_no DESC);

CREATE FUNCTION protect_content_revision_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Content revision history is immutable'; END $$;
CREATE TRIGGER immutable_content_revision_history BEFORE UPDATE OR DELETE ON content_revision_history FOR EACH ROW EXECUTE FUNCTION protect_content_revision_history();

COMMENT ON TABLE content_workspaces IS 'V6可视化维护台的规范草稿与当前公开内容快照；地点正式坐标仍由PostGIS地点表管理';
COMMENT ON TABLE content_revision_history IS '不可篡改的内容版本；每个版本保存完整快照与SHA256';
