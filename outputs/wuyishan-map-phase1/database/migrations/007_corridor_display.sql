ALTER TABLE places
 ADD COLUMN corridor_order integer CHECK(corridor_order > 0),
 ADD COLUMN corridor_role text NOT NULL DEFAULT 'unassigned' CHECK(corridor_role IN ('main','branch','unassigned')),
 ADD COLUMN map_display_role text NOT NULL DEFAULT 'pin' CHECK(map_display_role IN ('pin','group','hidden')),
 ADD COLUMN duplicate_of_place_id uuid REFERENCES places(id),
 ADD CONSTRAINT place_duplicate_not_self CHECK(duplicate_of_place_id IS DISTINCT FROM id),
 ADD CONSTRAINT duplicate_not_ordered CHECK(duplicate_of_place_id IS NULL OR corridor_order IS NULL),
 ADD CONSTRAINT corridor_order_unique UNIQUE(corridor_order) DEFERRABLE INITIALLY IMMEDIATE;
COMMENT ON COLUMN places.corridor_order IS '一号风景道知识库显示顺序；NULL表示待排，不决定父级、路线站点或主支线角色';
COMMENT ON COLUMN places.corridor_role IS 'main主线体系、branch支线体系、unassigned待确认；与排序和父级独立';
COMMENT ON COLUMN places.map_display_role IS 'pin正常地图针；group集合标记；hidden默认隐藏。所有显示均要求有效人工确认坐标';
COMMENT ON COLUMN places.duplicate_of_place_id IS '已人工确认的重复档案指向保留地点；旧编号和原有资料永久保留';
CREATE INDEX places_corridor_idx ON places(corridor_order ASC NULLS LAST,code);
CREATE OR REPLACE FUNCTION validate_place() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(91724001);
 IF NOT EXISTS(SELECT 1 FROM taxonomy_terms WHERE id=NEW.category_id AND dimension='一级分类' AND enabled) THEN
  RAISE EXCEPTION 'Category must be an enabled primary category'; END IF;
 IF NEW.parent_place_id IS NOT NULL AND EXISTS(
  WITH RECURSIVE parents AS (
   SELECT id,parent_place_id FROM places WHERE id=NEW.parent_place_id
   UNION SELECT p.id,p.parent_place_id FROM places p JOIN parents a ON p.id=a.parent_place_id
  ) SELECT 1 FROM parents WHERE id=NEW.id) THEN RAISE EXCEPTION 'Parent cycle'; END IF;
 IF NEW.duplicate_of_place_id IS NOT NULL AND (
  EXISTS(SELECT 1 FROM places WHERE id=NEW.duplicate_of_place_id AND duplicate_of_place_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM places WHERE duplicate_of_place_id=NEW.id)
 ) THEN RAISE EXCEPTION 'Duplicate chains are not allowed'; END IF;
 -- An order edit must change only corridor_order, including preserving updated_at.
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'corridor_order')=(to_jsonb(OLD)-'corridor_order') THEN
  RETURN NEW;
 END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE OR REPLACE VIEW public_places AS
 SELECT p.code,p.name,p.current_status,p.public_level,
 CASE WHEN p.public_level IN ('P1','P2','P3') THEN p.region END AS region,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' THEN c.map_latitude END AS latitude,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' THEN c.map_longitude END AS longitude,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' AND c.id IS NOT NULL THEN 'GCJ-02' END AS coordinate_system
 FROM places p LEFT JOIN confirmed_place_coordinates c ON c.place_id=p.id
 WHERE p.public_level<>'P5' AND p.duplicate_of_place_id IS NULL;
