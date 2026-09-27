ALTER TABLE places
 ADD COLUMN deleted_at timestamptz,
 ADD COLUMN deleted_by text,
 ADD COLUMN deletion_reason text,
 ADD CONSTRAINT place_deletion_state CHECK(
  (deleted_at IS NULL AND deleted_by IS NULL AND deletion_reason IS NULL) OR
  (deleted_at IS NOT NULL AND isfinite(deleted_at) AND deleted_by IS NOT NULL AND length(trim(deleted_by))>0 AND deletion_reason IS NOT NULL AND length(trim(deletion_reason))>0)
 );

CREATE INDEX places_recycle_bin_idx ON places(deleted_at DESC,code) WHERE deleted_at IS NOT NULL;

CREATE TABLE place_recycle_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 place_id uuid NOT NULL REFERENCES places(id),
 action text NOT NULL CHECK(action IN ('deleted','restored')),
 occurred_at timestamptz NOT NULL DEFAULT now() CHECK(isfinite(occurred_at)),
 action_source text NOT NULL CHECK(length(trim(action_source))>0),
 reason text
);
CREATE INDEX place_recycle_history_place_idx ON place_recycle_history(place_id,occurred_at DESC);

CREATE FUNCTION record_place_recycle_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
  INSERT INTO place_recycle_history(place_id,action,occurred_at,action_source,reason)
  VALUES(NEW.id,'deleted',NEW.deleted_at,NEW.deleted_by,NEW.deletion_reason);
 ELSIF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
  INSERT INTO place_recycle_history(place_id,action,action_source,reason)
  VALUES(NEW.id,'restored',coalesce(nullif(current_setting('app.place_recycle_source',true),''),'database_update'),'从回收站恢复');
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER place_recycle_audit AFTER UPDATE OF deleted_at ON places FOR EACH ROW EXECUTE FUNCTION record_place_recycle_change();

CREATE FUNCTION protect_place_recycle_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Place recycle history is immutable'; END $$;
CREATE TRIGGER immutable_place_recycle_history BEFORE UPDATE OR DELETE ON place_recycle_history FOR EACH ROW EXECUTE FUNCTION protect_place_recycle_history();

CREATE FUNCTION prevent_physical_place_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Places cannot be physically deleted; use the recycle bin'; END $$;
CREATE TRIGGER no_physical_place_delete BEFORE DELETE ON places FOR EACH ROW EXECUTE FUNCTION prevent_physical_place_delete();

COMMENT ON COLUMN places.deleted_at IS 'NULL为正常地点；非NULL表示进入回收站。地点及全部关联记录均保留';
COMMENT ON TABLE place_recycle_history IS '地点移入回收站和恢复的不可篡改审计历史';

CREATE OR REPLACE VIEW public_places AS
 SELECT p.code,p.name,p.current_status,p.public_level,
 CASE WHEN p.public_level IN ('P1','P2','P3') THEN p.region END AS region,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' THEN c.map_latitude END AS latitude,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' THEN c.map_longitude END AS longitude,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' AND c.id IS NOT NULL THEN 'GCJ-02' END AS coordinate_system
 FROM places p LEFT JOIN confirmed_place_coordinates c ON c.place_id=p.id
 WHERE p.public_level<>'P5' AND p.duplicate_of_place_id IS NULL AND p.deleted_at IS NULL;
