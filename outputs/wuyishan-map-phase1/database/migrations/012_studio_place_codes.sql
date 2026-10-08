-- Durable reservations survive archive, restore and removal from the current draft.
CREATE TABLE studio_place_codes (
 code text PRIMARY KEY CHECK(code ~ '^WY-[0-9]{4,}$'),
 request_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO studio_place_codes(code)
 SELECT code FROM places
 UNION SELECT business_code FROM import_rows WHERE business_code ~ '^WY-[0-9]{4,}$'
 UNION SELECT jsonb_object_keys(draft->'places') FROM content_workspaces
 UNION SELECT jsonb_object_keys(published->'places') FROM content_workspaces
 UNION SELECT jsonb_object_keys(snapshot->'places') FROM content_revision_history
 ON CONFLICT DO NOTHING;

CREATE FUNCTION reserve_studio_document_codes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(91724003);
 INSERT INTO studio_place_codes(code)
 SELECT jsonb_object_keys(NEW.draft->'places')
 UNION SELECT jsonb_object_keys(NEW.published->'places') ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
CREATE TRIGGER reserve_studio_codes BEFORE INSERT OR UPDATE OF draft,published ON content_workspaces
 FOR EACH ROW EXECUTE FUNCTION reserve_studio_document_codes();

CREATE FUNCTION reserve_legacy_place_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(91724003);
 IF EXISTS(SELECT 1 FROM studio_place_codes WHERE code=NEW.code) THEN
  RAISE EXCEPTION 'Place code already reserved: %',NEW.code;
 END IF;
 INSERT INTO studio_place_codes(code) VALUES(NEW.code);
 RETURN NEW;
END $$;
CREATE TRIGGER reserve_legacy_code BEFORE INSERT ON places FOR EACH ROW EXECUTE FUNCTION reserve_legacy_place_code();
