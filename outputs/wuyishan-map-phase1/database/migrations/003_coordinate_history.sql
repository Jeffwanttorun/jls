DROP VIEW public_places;
DROP VIEW confirmed_place_coordinates;
ALTER TYPE coordinate_source RENAME TO coordinate_source_legacy;
CREATE TYPE coordinate_source AS ENUM ('phone_gps','map_click','manual_input','dji_srt','gps_track','imported_file','other');
CREATE TYPE coordinate_record_status AS ENUM ('active','superseded','revoked');
CREATE TYPE coordinate_candidate_status AS ENUM ('pending','confirmed','rejected');
ALTER TABLE coordinate_candidates ALTER COLUMN source_type TYPE coordinate_source USING
 (CASE source_type::text WHEN '手机' THEN 'phone_gps' WHEN '地图点选' THEN 'map_click' WHEN '手工导入' THEN 'imported_file' WHEN 'DJI' THEN 'dji_srt' WHEN 'GPS' THEN 'gps_track' ELSE 'other' END)::coordinate_source;
ALTER TABLE place_coordinates ALTER COLUMN source_type TYPE coordinate_source USING
 (CASE source_type::text WHEN '手机' THEN 'phone_gps' WHEN '地图点选' THEN 'map_click' WHEN '手工导入' THEN 'imported_file' WHEN 'DJI' THEN 'dji_srt' WHEN 'GPS' THEN 'gps_track' ELSE 'other' END)::coordinate_source;
ALTER TABLE coordinate_candidates ALTER COLUMN source_file DROP NOT NULL;
ALTER TABLE place_coordinates ALTER COLUMN source_file DROP NOT NULL;
ALTER TABLE coordinate_candidates ADD COLUMN source_reference text, ADD COLUMN accuracy_note text,
 ADD COLUMN status coordinate_candidate_status NOT NULL DEFAULT 'pending',
 ADD COLUMN reviewed_at timestamptz, ADD COLUMN reviewed_by text;
ALTER TABLE place_coordinates ADD COLUMN source_reference text, ADD COLUMN accuracy_note text,
 ADD COLUMN status coordinate_record_status NOT NULL DEFAULT 'active',
 ADD COLUMN status_changed_at timestamptz NOT NULL DEFAULT now(),
 ADD COLUMN superseded_by uuid REFERENCES place_coordinates(id) DEFERRABLE INITIALLY DEFERRED,
 ADD COLUMN revoked_at timestamptz, ADD COLUMN revoked_by text, ADD COLUMN revocation_reason text;
UPDATE coordinate_candidates SET source_reference=source_file,accuracy_note=CASE WHEN accuracy_meters IS NULL THEN '来源未记录精度' END,
 status=CASE WHEN human_confirmed THEN 'confirmed'::coordinate_candidate_status WHEN rejected_reason IS NOT NULL THEN 'rejected'::coordinate_candidate_status ELSE 'pending'::coordinate_candidate_status END,
 reviewed_at=CASE WHEN human_confirmed THEN confirmed_at WHEN rejected_reason IS NOT NULL THEN created_at END,
 reviewed_by=CASE WHEN human_confirmed THEN confirmed_by WHEN rejected_reason IS NOT NULL THEN 'legacy-import' END;
UPDATE place_coordinates SET source_reference=source_file,accuracy_note=CASE WHEN accuracy_meters IS NULL THEN '来源未记录精度' END;
-- Legacy rows without candidates receive a provenance candidate, never a fabricated observation.
INSERT INTO coordinate_candidates(id,code,source_type,source_file,source_reference,source_time,
 raw_latitude,raw_longitude,raw_coordinate_system,accuracy_meters,accuracy_note,confidence_level,
 matched_place_id,converted_latitude,converted_longitude,map_coordinate_system,conversion_method,
 human_confirmed,confirmed_at,confirmed_by,status,reviewed_at,reviewed_by,created_at)
 SELECT id,'LEGACY-'||id,source_type,source_file,source_reference,source_time,
 raw_latitude,raw_longitude,raw_coordinate_system,accuracy_meters,accuracy_note,confidence_level,
 place_id,map_latitude,map_longitude,map_coordinate_system,conversion_method,
 human_confirmed,confirmed_at,confirmed_by,
 CASE WHEN human_confirmed THEN 'confirmed'::coordinate_candidate_status ELSE 'pending'::coordinate_candidate_status END,
 confirmed_at,confirmed_by,created_at FROM place_coordinates WHERE candidate_id IS NULL;
UPDATE place_coordinates SET candidate_id=id WHERE candidate_id IS NULL;
UPDATE place_coordinates SET status='revoked',revoked_at=now(),revoked_by='migration',revocation_reason='旧版本未确认记录，保留历史但不作有效正式坐标' WHERE NOT human_confirmed;
WITH ranked AS (
 SELECT id,first_value(id) OVER(PARTITION BY place_id ORDER BY confirmed_at DESC,id DESC) newest,
 row_number() OVER(PARTITION BY place_id ORDER BY confirmed_at DESC,id DESC) rn
 FROM place_coordinates WHERE human_confirmed
) UPDATE place_coordinates p SET status='superseded',superseded_by=r.newest FROM ranked r WHERE p.id=r.id AND r.rn>1;
-- Flush legacy self-reference checks before DDL, then restore deferred replacement semantics.
SET CONSTRAINTS ALL IMMEDIATE;
CREATE UNIQUE INDEX one_active_coordinate_per_place ON place_coordinates(place_id) WHERE status='active';
CREATE UNIQUE INDEX one_formal_per_candidate ON place_coordinates(candidate_id);
CREATE INDEX candidate_place_status_idx ON coordinate_candidates(matched_place_id,status);
ALTER TABLE coordinate_candidates ADD CONSTRAINT candidate_review_state CHECK(
 (status='pending' AND NOT human_confirmed) OR
 (status='confirmed' AND human_confirmed AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL) OR
 (status='rejected' AND NOT human_confirmed AND rejected_reason IS NOT NULL AND length(trim(rejected_reason))>0 AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL));
ALTER TABLE coordinate_candidates ADD CONSTRAINT candidate_accuracy_known_or_noted CHECK(accuracy_meters IS NOT NULL OR (accuracy_note IS NOT NULL AND length(trim(accuracy_note))>0));
ALTER TABLE place_coordinates ADD CONSTRAINT active_coordinate_confirmed CHECK(status<>'active' OR (human_confirmed AND candidate_id IS NOT NULL));
ALTER TABLE place_coordinates ADD CONSTRAINT formal_accuracy_known_or_noted CHECK(accuracy_meters IS NOT NULL OR (accuracy_note IS NOT NULL AND length(trim(accuracy_note))>0));
ALTER TABLE place_coordinates ADD CONSTRAINT revoked_coordinate_audit CHECK(status<>'revoked' OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL AND length(trim(revocation_reason))>0));

CREATE FUNCTION guard_candidate_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Candidates cannot be deleted'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'pending' OR NEW.human_confirmed THEN RAISE EXCEPTION 'New coordinates must start as pending candidates'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.status<>'pending' OR NEW.status NOT IN ('confirmed','rejected') THEN RAISE EXCEPTION 'Candidate already reviewed or invalid transition'; END IF;
 IF (to_jsonb(NEW)-ARRAY['status','human_confirmed','confirmed_at','confirmed_by','reviewed_at','reviewed_by','rejected_reason','writeback_status']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['status','human_confirmed','confirmed_at','confirmed_by','reviewed_at','reviewed_by','rejected_reason','writeback_status']) THEN
  RAISE EXCEPTION 'Candidate observation is immutable; create a new candidate'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER candidate_history_guard BEFORE INSERT OR UPDATE OR DELETE ON coordinate_candidates FOR EACH ROW EXECUTE FUNCTION guard_candidate_history();

CREATE FUNCTION guard_formal_coordinate() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE candidate coordinate_candidates%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Coordinate history cannot be deleted'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-ARRAY['status','status_changed_at','superseded_by','revoked_at','revoked_by','revocation_reason','raw_wgs84','map_point']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['status','status_changed_at','superseded_by','revoked_at','revoked_by','revocation_reason','raw_wgs84','map_point']) THEN
   RAISE EXCEPTION 'Formal coordinate payload is immutable'; END IF;
  IF NOT(OLD.status='active' AND NEW.status IN ('superseded','revoked')) THEN RAISE EXCEPTION 'Invalid formal coordinate transition'; END IF;
  NEW.status_changed_at=now(); RETURN NEW;
 END IF;
 SELECT * INTO candidate FROM coordinate_candidates WHERE id=NEW.candidate_id FOR UPDATE;
 IF NOT FOUND OR candidate.status<>'confirmed' OR NOT candidate.human_confirmed THEN RAISE EXCEPTION 'A confirmed candidate is required'; END IF;
 IF NEW.status<>'active' OR NOT NEW.human_confirmed OR
 ROW(NEW.place_id,NEW.raw_latitude,NEW.raw_longitude,NEW.raw_coordinate_system,NEW.source_type,NEW.source_reference,NEW.source_time,NEW.accuracy_meters,NEW.accuracy_note,NEW.map_latitude,NEW.map_longitude,NEW.map_coordinate_system,NEW.conversion_method,NEW.confirmed_at,NEW.confirmed_by) IS DISTINCT FROM
 ROW(candidate.matched_place_id,candidate.raw_latitude,candidate.raw_longitude,candidate.raw_coordinate_system,candidate.source_type,candidate.source_reference,candidate.source_time,candidate.accuracy_meters,candidate.accuracy_note,candidate.converted_latitude,candidate.converted_longitude,candidate.map_coordinate_system,candidate.conversion_method,candidate.confirmed_at,candidate.confirmed_by) THEN
  RAISE EXCEPTION 'Formal coordinate must exactly preserve the confirmed candidate'; END IF;
 PERFORM 1 FROM places WHERE id=NEW.place_id FOR UPDATE;
 UPDATE place_coordinates SET status='superseded',superseded_by=NEW.id WHERE place_id=NEW.place_id AND status='active';
 RETURN NEW;
END $$;
CREATE TRIGGER formal_coordinate_history_guard BEFORE INSERT OR UPDATE OR DELETE ON place_coordinates FOR EACH ROW EXECUTE FUNCTION guard_formal_coordinate();
CREATE FUNCTION confirmed_candidate_has_formal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='confirmed' AND NOT EXISTS(SELECT 1 FROM place_coordinates WHERE candidate_id=NEW.id AND human_confirmed) THEN
  RAISE EXCEPTION 'Candidate confirmation and formal coordinate must commit together'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER candidate_confirmation_atomic AFTER UPDATE ON coordinate_candidates DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION confirmed_candidate_has_formal();
CREATE VIEW confirmed_place_coordinates AS SELECT * FROM place_coordinates
 WHERE status='active' AND human_confirmed AND map_coordinate_system='GCJ-02' AND map_latitude IS NOT NULL;
CREATE VIEW public_places AS
 SELECT p.code,p.name,p.current_status,p.public_level,
 CASE WHEN p.public_level IN ('P1','P2','P3') THEN p.region END AS region,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' THEN c.map_latitude END AS latitude,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' THEN c.map_longitude END AS longitude,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' AND c.id IS NOT NULL THEN 'GCJ-02' END AS coordinate_system
 FROM places p LEFT JOIN confirmed_place_coordinates c ON c.place_id=p.id WHERE p.public_level<>'P5';
SET CONSTRAINTS ALL DEFERRED;
