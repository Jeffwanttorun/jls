-- Keep unordered place -> route references distinct from an ordered itinerary.
CREATE TABLE route_place_links (
 route_id uuid NOT NULL REFERENCES routes(id), place_id uuid NOT NULL REFERENCES places(id),
 source_import_row_id uuid REFERENCES import_rows(id), PRIMARY KEY(route_id,place_id)
);
CREATE TRIGGER stable_verification_code BEFORE UPDATE ON verifications FOR EACH ROW EXECUTE FUNCTION keep_business_code();
CREATE TRIGGER stable_candidate_code BEFORE UPDATE ON coordinate_candidates FOR EACH ROW EXECUTE FUNCTION keep_business_code();
ALTER TABLE verifications ADD CONSTRAINT verification_code_nonempty CHECK(length(trim(code))>0);
ALTER TABLE coordinate_candidates ADD CONSTRAINT candidate_code_nonempty CHECK(length(trim(code))>0);
ALTER TABLE taxonomy_terms ADD CONSTRAINT taxonomy_dimension CHECK(dimension IN ('点位层级','一级分类','公开等级','坐标可信','当前状态','任务状态','任务优先级','标签'));
-- PostgreSQL accepts infinity timestamps; business records deliberately do not.
DO $$ DECLARE field record; BEGIN
 FOR field IN SELECT table_name,column_name FROM information_schema.columns
  WHERE table_schema='public' AND data_type IN ('date','timestamp with time zone','timestamp without time zone')
  AND table_name IN ('places','place_coordinates','coordinate_candidates','verifications','routes','guides','media','place_water','import_jobs')
 LOOP
  EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I IS NULL OR isfinite(%I))',field.table_name,field.column_name||'_finite',field.column_name,field.column_name);
 END LOOP;
END $$;
