-- Position certainty is independent of legacy A-D source confidence and field verification.
-- Existing observations remain unknown; never infer a field visit from an image.
ALTER TABLE coordinate_candidates ADD COLUMN position_certainty text
 CHECK(position_certainty IN ('certain','approximate','uncertain'));
ALTER TABLE place_coordinates ADD COLUMN position_certainty text
 CHECK(position_certainty IN ('certain','approximate','uncertain'));
COMMENT ON COLUMN coordinate_candidates.position_certainty IS 'Reviewer assessment of the location, independent of source confidence, measured accuracy and field verification; NULL means not recorded';
COMMENT ON COLUMN place_coordinates.position_certainty IS 'Immutable position certainty copied from the confirmed candidate';

-- Existing history guards protect all payload fields via to_jsonb, including the new column.
-- Add the equality check on insertion without changing the existing lifecycle trigger.
CREATE FUNCTION guard_coordinate_certainty() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.position_certainty IS DISTINCT FROM
    (SELECT position_certainty FROM coordinate_candidates WHERE id=NEW.candidate_id) THEN
  RAISE EXCEPTION 'Formal position certainty must preserve the confirmed candidate';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER formal_coordinate_certainty_guard BEFORE INSERT ON place_coordinates
 FOR EACH ROW EXECUTE FUNCTION guard_coordinate_certainty();
