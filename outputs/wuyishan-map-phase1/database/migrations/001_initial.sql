CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TYPE place_type AS ENUM ('主地点','辅助点','服务点','风险点');
CREATE TYPE place_status AS ENUM ('正常','临时关闭','季节关闭','施工','道路中断','不建议前往','永久关闭','待核实');
CREATE TYPE public_level AS ENUM ('P1','P2','P3','P4','P5');
CREATE TYPE priority AS ENUM ('高','中','低');
CREATE TYPE coordinate_system AS ENUM ('WGS84','GCJ-02','BD-09','未知');
CREATE TYPE coordinate_source AS ENUM ('手机','DJI','GPS','地图点选','手工导入');
CREATE TYPE confidence_level AS ENUM ('A','B','C','D');
CREATE TYPE publish_status AS ENUM ('草稿','已发布','已归档');
CREATE TYPE yes_partial AS ENUM ('是','否','部分','未知');

CREATE TABLE import_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_filename text NOT NULL, source_sha256 text NOT NULL,
 preview_sha256 text NOT NULL, status text NOT NULL CHECK(status IN ('running','completed')),
 started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, result jsonb
);
CREATE TABLE import_rows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES import_jobs(id),
 sheet text NOT NULL, row_number integer NOT NULL CHECK(row_number > 0), business_code text,
 payload jsonb NOT NULL, outcome text NOT NULL CHECK(outcome IN ('pending','success','failed','skipped')),
 issues jsonb NOT NULL DEFAULT '[]', UNIQUE(job_id,sheet,row_number)
);
CREATE TABLE taxonomy_terms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), dimension text NOT NULL,
 code text NOT NULL, name text NOT NULL, description text, enabled boolean NOT NULL DEFAULT true,
 source_import_row_id uuid REFERENCES import_rows(id), UNIQUE(dimension,code), UNIQUE(dimension,name)
);
CREATE TABLE places (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(code ~ '^WY-[0-9]{4,}$'),
 name text NOT NULL CHECK(length(trim(name)) > 0), short_name text, place_type place_type NOT NULL,
 parent_place_id uuid REFERENCES places(id), category_id uuid NOT NULL REFERENCES taxonomy_terms(id),
 tags text[] NOT NULL DEFAULT '{}', region text, main_line text, intro text,
 current_status place_status NOT NULL DEFAULT '待核实', public_level public_level NOT NULL DEFAULT 'P5',
 priority priority NOT NULL DEFAULT '中', risk_note text, rain_friendly yes_partial, notes text,
 source_last_verified_at date, source_import_row_id uuid REFERENCES import_rows(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(parent_place_id IS DISTINCT FROM id)
);
CREATE INDEX places_parent_idx ON places(parent_place_id);
CREATE INDEX places_filters_idx ON places(region,category_id,current_status,public_level);
CREATE INDEX places_tags_idx ON places USING gin(tags);

CREATE TABLE place_practical_info (
 place_id uuid PRIMARY KEY REFERENCES places(id), car_access yes_partial, road_type text, road_width_note text,
 passing_difficulty text, four_wheel_drive_required boolean, walking_required boolean,
 walking_distance_m numeric CHECK(walking_distance_m >= 0), walking_duration_min numeric CHECK(walking_duration_min >= 0),
 parking_available yes_partial, parking_type text, parking_capacity_note text, parking_fee_note text,
 toilet_available yes_partial, toilet_distance_m numeric CHECK(toilet_distance_m >= 0),
 food_available yes_partial, water_available yes_partial, mobile_signal_note text, charging_available yes_partial
);
CREATE TABLE place_accessibility (
 place_id uuid PRIMARY KEY REFERENCES places(id), stroller_friendly yes_partial, baby_carrier_possible yes_partial,
 age_2_3_rating text, age_4_6_rating text, age_7_plus_rating text, elderly_friendly yes_partial,
 child_friendly_note text, stairs_note text, slope_note text, shade_note text, seats_available yes_partial,
 fall_risk text, water_risk text, vehicle_risk text
);
CREATE TABLE place_nature (
 place_id uuid PRIMARY KEY REFERENCES places(id), primary_observation text, secondary_observation text,
 best_season text, best_time text, weather_note text, wind_note text, temperature_note text,
 guaranteed_sighting boolean NOT NULL DEFAULT false, waiting_required boolean, ecological_sensitivity text
);
CREATE TABLE place_water (
 place_id uuid PRIMARY KEY REFERENCES places(id), water_type text, normal_depth_note text, riverbed_type text,
 slippery_risk text, current_risk text, rainfall_risk text, upstream_rainfall_risk text,
 child_water_entry_note text, life_jacket_note text, last_water_check_at timestamptz
);
CREATE TABLE coordinate_candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE,
 source_file text NOT NULL, source_type coordinate_source NOT NULL, source_time timestamptz,
 source_time_original text, timecode text, device text, altitude_m numeric,
 raw_latitude double precision NOT NULL CHECK(raw_latitude BETWEEN -90 AND 90),
 raw_longitude double precision NOT NULL CHECK(raw_longitude BETWEEN -180 AND 180),
 raw_coordinate_system coordinate_system NOT NULL,
 accuracy_meters numeric CHECK(accuracy_meters >= 0), confidence_level confidence_level,
 matched_place_id uuid REFERENCES places(id), match_confidence text CHECK(match_confidence IN ('高','中','低')),
 match_reason text, converted_latitude double precision CHECK(converted_latitude BETWEEN -90 AND 90),
 converted_longitude double precision CHECK(converted_longitude BETWEEN -180 AND 180),
 map_coordinate_system coordinate_system, conversion_method text,
 human_confirmed boolean NOT NULL DEFAULT false, confirmed_at timestamptz, confirmed_by text,
 source_claimed_confirmed boolean, rejected_reason text,
 writeback_status text NOT NULL DEFAULT '待确认' CHECK(writeback_status IN ('待匹配','待确认','可写回','已写回','已拒绝','仅轨迹参考')),
 notes text, source_import_row_id uuid REFERENCES import_rows(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((converted_latitude IS NULL) = (converted_longitude IS NULL)),
 CHECK(converted_latitude IS NULL OR (raw_coordinate_system <> '未知' AND map_coordinate_system IS NOT NULL AND map_coordinate_system = 'GCJ-02')),
 CHECK(NOT human_confirmed OR (confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL AND length(trim(confirmed_by)) > 0 AND matched_place_id IS NOT NULL AND converted_latitude IS NOT NULL)),
 CHECK(writeback_status NOT IN ('可写回','已写回') OR human_confirmed)
);
CREATE TABLE place_coordinates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), place_id uuid NOT NULL REFERENCES places(id),
 candidate_id uuid REFERENCES coordinate_candidates(id), raw_latitude double precision NOT NULL CHECK(raw_latitude BETWEEN -90 AND 90),
 raw_longitude double precision NOT NULL CHECK(raw_longitude BETWEEN -180 AND 180),
 raw_coordinate_system coordinate_system NOT NULL, source_type coordinate_source NOT NULL,
 source_file text NOT NULL, source_time timestamptz, accuracy_meters numeric CHECK(accuracy_meters >= 0),
 confidence_level confidence_level, map_latitude double precision CHECK(map_latitude BETWEEN -90 AND 90),
 map_longitude double precision CHECK(map_longitude BETWEEN -180 AND 180), map_coordinate_system coordinate_system,
 conversion_method text, human_confirmed boolean NOT NULL DEFAULT false, confirmed_at timestamptz, confirmed_by text,
 created_at timestamptz NOT NULL DEFAULT now(),
 raw_wgs84 geography(Point,4326) GENERATED ALWAYS AS
  (CASE WHEN raw_coordinate_system = 'WGS84' THEN ST_SetSRID(ST_MakePoint(raw_longitude,raw_latitude),4326)::geography END) STORED,
 map_point geometry(Point) GENERATED ALWAYS AS
  (CASE WHEN map_latitude IS NOT NULL THEN ST_MakePoint(map_longitude,map_latitude) END) STORED,
 CHECK((map_latitude IS NULL) = (map_longitude IS NULL)),
 CHECK(map_latitude IS NULL OR (raw_coordinate_system <> '未知' AND map_coordinate_system IS NOT NULL AND map_coordinate_system = 'GCJ-02')),
 CHECK(NOT human_confirmed OR (map_latitude IS NOT NULL AND confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL AND length(trim(confirmed_by)) > 0))
);
CREATE INDEX coordinates_place_idx ON place_coordinates(place_id);
CREATE INDEX coordinates_spatial_idx ON place_coordinates USING gist(raw_wgs84);
CREATE INDEX candidates_place_idx ON coordinate_candidates(matched_place_id);
CREATE TABLE verifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, place_id uuid NOT NULL REFERENCES places(id),
 verified_at timestamptz NOT NULL, road_status text, parking_status text, toilet_status text,
 open_status place_status, weather text, water_condition text, observation_note text, general_note text,
 verifier text NOT NULL CHECK(length(trim(verifier)) > 0), source_photo_note text,
 source_import_row_id uuid REFERENCES import_rows(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verifications_place_time_idx ON verifications(place_id,verified_at DESC);
CREATE TABLE routes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(code ~ '^R-[0-9]{4,}$'),
 name text NOT NULL, route_type text NOT NULL CHECK(route_type IN ('候选路线','自驾','步行','混合')),
 intro text, total_duration_min numeric CHECK(total_duration_min >= 0), estimated_driving_min numeric CHECK(estimated_driving_min >= 0),
 estimated_walking_m numeric CHECK(estimated_walking_m >= 0), suitable_age_note text, season_note text,
 rain_friendly yes_partial, elderly_friendly yes_partial, publish_status publish_status NOT NULL DEFAULT '草稿',
 source_status place_status, start_note text, end_note text, source_last_verified_at date,
 sequence_confirmed boolean NOT NULL DEFAULT false, source_import_row_id uuid REFERENCES import_rows(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE route_stops (
 route_id uuid NOT NULL REFERENCES routes(id), place_id uuid NOT NULL REFERENCES places(id),
 sequence integer NOT NULL CHECK(sequence > 0), suggested_duration_min numeric CHECK(suggested_duration_min >= 0),
 required_or_optional text CHECK(required_or_optional IN ('必选','可选')),
 alternative_group text, condition_note text, PRIMARY KEY(route_id,sequence)
);
CREATE INDEX route_stops_place_idx ON route_stops(place_id);
CREATE TABLE guides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(code ~ '^G-[0-9]{4,}$'),
 title text NOT NULL, summary text, body text, guide_type text NOT NULL CHECK(guide_type IN ('实测攻略','展馆攻略','自然观察攻略','路线/专题','人物/展馆攻略')),
 publish_status publish_status NOT NULL DEFAULT '草稿', source_workflow text CHECK(source_workflow IN ('已有内容/待入库','研究中','待建立','草稿','已发布','已归档')),
 published_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), source_updated_at timestamptz,
 body_source text, media_note text, notes text, source_import_row_id uuid REFERENCES import_rows(id),
 CHECK(publish_status <> '已发布' OR published_at IS NOT NULL)
);
CREATE TABLE guide_places (guide_id uuid REFERENCES guides(id), place_id uuid REFERENCES places(id), PRIMARY KEY(guide_id,place_id));
CREATE TABLE guide_routes (guide_id uuid REFERENCES guides(id), route_id uuid REFERENCES routes(id), PRIMARY KEY(guide_id,route_id));
CREATE TABLE media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), place_id uuid REFERENCES places(id),
 media_type text NOT NULL CHECK(media_type IN ('图片','视频','音频','文件')),
 purpose text, file_url text, local_source_path text, shot_at timestamptz, direction_note text,
 public_status text NOT NULL DEFAULT '私有' CHECK(public_status IN ('私有','可公开')),
 CHECK(file_url IS NOT NULL OR local_source_path IS NOT NULL)
);
CREATE TABLE verification_media (verification_id uuid REFERENCES verifications(id), media_id uuid REFERENCES media(id), PRIMARY KEY(verification_id,media_id));

CREATE FUNCTION keep_business_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.code IS DISTINCT FROM OLD.code THEN RAISE EXCEPTION 'Business code is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER stable_place_code BEFORE UPDATE ON places FOR EACH ROW EXECUTE FUNCTION keep_business_code();
CREATE TRIGGER stable_route_code BEFORE UPDATE ON routes FOR EACH ROW EXECUTE FUNCTION keep_business_code();
CREATE TRIGGER stable_guide_code BEFORE UPDATE ON guides FOR EACH ROW EXECUTE FUNCTION keep_business_code();
CREATE FUNCTION preserve_verifications() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Verification history is append-only'; END $$;
CREATE TRIGGER verification_history BEFORE UPDATE OR DELETE ON verifications FOR EACH ROW EXECUTE FUNCTION preserve_verifications();
CREATE FUNCTION validate_place() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(91724001);
 IF NOT EXISTS(SELECT 1 FROM taxonomy_terms WHERE id=NEW.category_id AND dimension='一级分类' AND enabled) THEN
  RAISE EXCEPTION 'Category must be an enabled primary category'; END IF;
 IF NEW.parent_place_id IS NOT NULL AND EXISTS(
  WITH RECURSIVE parents AS (
   SELECT id,parent_place_id FROM places WHERE id=NEW.parent_place_id
   UNION SELECT p.id,p.parent_place_id FROM places p JOIN parents a ON p.id=a.parent_place_id
  ) SELECT 1 FROM parents WHERE id=NEW.id) THEN RAISE EXCEPTION 'Parent cycle'; END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER validate_place_trigger BEFORE INSERT OR UPDATE ON places FOR EACH ROW EXECUTE FUNCTION validate_place();

-- Map GCJ-02 coordinates are not EPSG:4326. Only original WGS84 uses geography/SRID 4326.
CREATE VIEW confirmed_place_coordinates AS
 SELECT DISTINCT ON (place_id) * FROM place_coordinates
 WHERE human_confirmed AND map_coordinate_system='GCJ-02' AND map_latitude IS NOT NULL
 ORDER BY place_id,confirmed_at DESC,id DESC;
-- Public projection is deliberately small; raw/source/free text and relationships never enter it.
CREATE VIEW public_places AS
 SELECT p.code,p.name,p.current_status,p.public_level,
 CASE WHEN p.public_level IN ('P1','P2','P3') THEN p.region END AS region,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' THEN c.map_latitude END AS latitude,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' THEN c.map_longitude END AS longitude,
 CASE WHEN p.public_level='P1' AND p.current_status='正常' AND c.id IS NOT NULL THEN 'GCJ-02' END AS coordinate_system
 FROM places p LEFT JOIN confirmed_place_coordinates c ON c.place_id=p.id WHERE p.public_level <> 'P5';
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
