ALTER TABLE places ADD CONSTRAINT place_name_length CHECK(char_length(name)<=120);
ALTER TABLE places ADD CONSTRAINT place_name_visible CHECK(name ~ '[^[:space:]　]');
CREATE TABLE place_name_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 place_id uuid NOT NULL REFERENCES places(id),
 old_name text NOT NULL,
 new_name text NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now() CHECK(isfinite(changed_at)),
 change_source text NOT NULL CHECK(length(trim(change_source))>0),
 CHECK(old_name IS DISTINCT FROM new_name)
);
CREATE INDEX place_name_history_place_idx ON place_name_history(place_id,changed_at DESC);
CREATE FUNCTION record_place_name_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.name IS DISTINCT FROM OLD.name THEN
  INSERT INTO place_name_history(place_id,old_name,new_name,change_source)
  VALUES(NEW.id,OLD.name,NEW.name,coalesce(nullif(current_setting('app.name_change_source',true),''),'database_update'));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER place_name_change AFTER UPDATE OF name ON places FOR EACH ROW EXECUTE FUNCTION record_place_name_change();
CREATE FUNCTION protect_place_name_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Place name history is immutable'; END $$;
CREATE TRIGGER immutable_name_history BEFORE UPDATE OR DELETE ON place_name_history FOR EACH ROW EXECUTE FUNCTION protect_place_name_history();
COMMENT ON TABLE place_name_history IS '地点改名审计；旧编号、UUID和关联保持不变，历史只读';
