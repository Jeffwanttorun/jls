--
-- PostgreSQL database dump
--

\restrict t0h53m4YOIdYV7GmWmkg9O2LQpTA6NxUQ8hiP649N1xn4X0lam2pH3ChCzjjNM0

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: confidence_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.confidence_level AS ENUM (
    'A',
    'B',
    'C',
    'D'
);


--
-- Name: coordinate_candidate_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.coordinate_candidate_status AS ENUM (
    'pending',
    'confirmed',
    'rejected'
);


--
-- Name: coordinate_record_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.coordinate_record_status AS ENUM (
    'active',
    'superseded',
    'revoked'
);


--
-- Name: coordinate_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.coordinate_source AS ENUM (
    'phone_gps',
    'map_click',
    'manual_input',
    'dji_srt',
    'gps_track',
    'imported_file',
    'other'
);


--
-- Name: coordinate_source_legacy; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.coordinate_source_legacy AS ENUM (
    '手机',
    'DJI',
    'GPS',
    '地图点选',
    '手工导入'
);


--
-- Name: coordinate_system; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.coordinate_system AS ENUM (
    'WGS84',
    'GCJ-02',
    'BD-09',
    '未知'
);


--
-- Name: place_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.place_status AS ENUM (
    '正常',
    '临时关闭',
    '季节关闭',
    '施工',
    '道路中断',
    '不建议前往',
    '永久关闭',
    '待核实'
);


--
-- Name: place_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.place_type AS ENUM (
    '主地点',
    '辅助点',
    '服务点',
    '风险点'
);


--
-- Name: priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.priority AS ENUM (
    '高',
    '中',
    '低'
);


--
-- Name: public_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.public_level AS ENUM (
    'P1',
    'P2',
    'P3',
    'P4',
    'P5'
);


--
-- Name: publish_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.publish_status AS ENUM (
    '草稿',
    '已发布',
    '已归档'
);


--
-- Name: yes_partial; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.yes_partial AS ENUM (
    '是',
    '否',
    '部分',
    '未知'
);


--
-- Name: confirmed_candidate_has_formal(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.confirmed_candidate_has_formal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW.status='confirmed' AND NOT EXISTS(SELECT 1 FROM place_coordinates WHERE candidate_id=NEW.id AND human_confirmed) THEN
  RAISE EXCEPTION 'Candidate confirmation and formal coordinate must commit together'; END IF;
 RETURN NULL;
END $$;


--
-- Name: guard_candidate_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_candidate_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: guard_coordinate_certainty(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_coordinate_certainty() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW.position_certainty IS DISTINCT FROM
    (SELECT position_certainty FROM coordinate_candidates WHERE id=NEW.candidate_id) THEN
  RAISE EXCEPTION 'Formal position certainty must preserve the confirmed candidate';
 END IF;
 RETURN NEW;
END $$;


--
-- Name: guard_formal_coordinate(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_formal_coordinate() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: keep_business_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.keep_business_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN IF NEW.code IS DISTINCT FROM OLD.code THEN RAISE EXCEPTION 'Business code is immutable'; END IF; RETURN NEW; END $$;


--
-- Name: preserve_verifications(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_verifications() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN RAISE EXCEPTION 'Verification history is append-only'; END $$;


--
-- Name: validate_place(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_place() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: place_coordinates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.place_coordinates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid NOT NULL,
    candidate_id uuid,
    raw_latitude double precision NOT NULL,
    raw_longitude double precision NOT NULL,
    raw_coordinate_system public.coordinate_system NOT NULL,
    source_type public.coordinate_source NOT NULL,
    source_file text,
    source_time timestamp with time zone,
    accuracy_meters numeric,
    confidence_level public.confidence_level,
    map_latitude double precision,
    map_longitude double precision,
    map_coordinate_system public.coordinate_system,
    conversion_method text,
    human_confirmed boolean DEFAULT false NOT NULL,
    confirmed_at timestamp with time zone,
    confirmed_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    raw_wgs84 public.geography(Point,4326) GENERATED ALWAYS AS (
CASE
    WHEN (raw_coordinate_system = 'WGS84'::public.coordinate_system) THEN (public.st_setsrid(public.st_makepoint(raw_longitude, raw_latitude), 4326))::public.geography
    ELSE NULL::public.geography
END) STORED,
    map_point public.geometry(Point) GENERATED ALWAYS AS (
CASE
    WHEN (map_latitude IS NOT NULL) THEN public.st_makepoint(map_longitude, map_latitude)
    ELSE NULL::public.geometry
END) STORED,
    source_reference text,
    accuracy_note text,
    status public.coordinate_record_status DEFAULT 'active'::public.coordinate_record_status NOT NULL,
    status_changed_at timestamp with time zone DEFAULT now() NOT NULL,
    superseded_by uuid,
    revoked_at timestamp with time zone,
    revoked_by text,
    revocation_reason text,
    position_certainty text,
    CONSTRAINT active_coordinate_confirmed CHECK (((status <> 'active'::public.coordinate_record_status) OR (human_confirmed AND (candidate_id IS NOT NULL)))),
    CONSTRAINT confirmed_at_finite CHECK (((confirmed_at IS NULL) OR isfinite(confirmed_at))),
    CONSTRAINT created_at_finite CHECK (((created_at IS NULL) OR isfinite(created_at))),
    CONSTRAINT formal_accuracy_finite CHECK (((accuracy_meters IS NULL) OR (accuracy_meters < 'Infinity'::numeric))),
    CONSTRAINT formal_accuracy_known_or_noted CHECK (((accuracy_meters IS NOT NULL) OR ((accuracy_note IS NOT NULL) AND (length(TRIM(BOTH FROM accuracy_note)) > 0)))),
    CONSTRAINT place_coordinates_accuracy_meters_check CHECK ((accuracy_meters >= (0)::numeric)),
    CONSTRAINT place_coordinates_check CHECK (((map_latitude IS NULL) = (map_longitude IS NULL))),
    CONSTRAINT place_coordinates_check1 CHECK (((map_latitude IS NULL) OR ((raw_coordinate_system <> '未知'::public.coordinate_system) AND (map_coordinate_system IS NOT NULL) AND (map_coordinate_system = 'GCJ-02'::public.coordinate_system)))),
    CONSTRAINT place_coordinates_check2 CHECK (((NOT human_confirmed) OR ((map_latitude IS NOT NULL) AND (confirmed_at IS NOT NULL) AND (confirmed_by IS NOT NULL) AND (length(TRIM(BOTH FROM confirmed_by)) > 0)))),
    CONSTRAINT place_coordinates_map_latitude_check CHECK (((map_latitude >= ('-90'::integer)::double precision) AND (map_latitude <= (90)::double precision))),
    CONSTRAINT place_coordinates_map_longitude_check CHECK (((map_longitude >= ('-180'::integer)::double precision) AND (map_longitude <= (180)::double precision))),
    CONSTRAINT place_coordinates_position_certainty_check CHECK ((position_certainty = ANY (ARRAY['certain'::text, 'approximate'::text, 'uncertain'::text]))),
    CONSTRAINT place_coordinates_raw_latitude_check CHECK (((raw_latitude >= ('-90'::integer)::double precision) AND (raw_latitude <= (90)::double precision))),
    CONSTRAINT place_coordinates_raw_longitude_check CHECK (((raw_longitude >= ('-180'::integer)::double precision) AND (raw_longitude <= (180)::double precision))),
    CONSTRAINT revoked_at_finite CHECK (((revoked_at IS NULL) OR isfinite(revoked_at))),
    CONSTRAINT revoked_coordinate_audit CHECK (((status <> 'revoked'::public.coordinate_record_status) OR ((revoked_at IS NOT NULL) AND (revoked_by IS NOT NULL) AND (revocation_reason IS NOT NULL) AND (length(TRIM(BOTH FROM revocation_reason)) > 0)))),
    CONSTRAINT source_time_finite CHECK (((source_time IS NULL) OR isfinite(source_time))),
    CONSTRAINT status_changed_at_finite CHECK (isfinite(status_changed_at))
);


--
-- Name: COLUMN place_coordinates.position_certainty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.place_coordinates.position_certainty IS 'Immutable position certainty copied from the confirmed candidate';


--
-- Name: confirmed_place_coordinates; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.confirmed_place_coordinates AS
 SELECT id,
    place_id,
    candidate_id,
    raw_latitude,
    raw_longitude,
    raw_coordinate_system,
    source_type,
    source_file,
    source_time,
    accuracy_meters,
    confidence_level,
    map_latitude,
    map_longitude,
    map_coordinate_system,
    conversion_method,
    human_confirmed,
    confirmed_at,
    confirmed_by,
    created_at,
    raw_wgs84,
    map_point,
    source_reference,
    accuracy_note,
    status,
    status_changed_at,
    superseded_by,
    revoked_at,
    revoked_by,
    revocation_reason
   FROM public.place_coordinates
  WHERE ((status = 'active'::public.coordinate_record_status) AND human_confirmed AND (map_coordinate_system = 'GCJ-02'::public.coordinate_system) AND (map_latitude IS NOT NULL));


--
-- Name: coordinate_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coordinate_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    source_file text,
    source_type public.coordinate_source NOT NULL,
    source_time timestamp with time zone,
    source_time_original text,
    timecode text,
    device text,
    altitude_m numeric,
    raw_latitude double precision NOT NULL,
    raw_longitude double precision NOT NULL,
    raw_coordinate_system public.coordinate_system NOT NULL,
    accuracy_meters numeric,
    confidence_level public.confidence_level,
    matched_place_id uuid,
    match_confidence text,
    match_reason text,
    converted_latitude double precision,
    converted_longitude double precision,
    map_coordinate_system public.coordinate_system,
    conversion_method text,
    human_confirmed boolean DEFAULT false NOT NULL,
    confirmed_at timestamp with time zone,
    confirmed_by text,
    source_claimed_confirmed boolean,
    rejected_reason text,
    writeback_status text DEFAULT '待确认'::text NOT NULL,
    notes text,
    source_import_row_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_reference text,
    accuracy_note text,
    status public.coordinate_candidate_status DEFAULT 'pending'::public.coordinate_candidate_status NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by text,
    position_certainty text,
    CONSTRAINT candidate_accuracy_finite CHECK (((accuracy_meters IS NULL) OR (accuracy_meters < 'Infinity'::numeric))),
    CONSTRAINT candidate_accuracy_known_or_noted CHECK (((accuracy_meters IS NOT NULL) OR ((accuracy_note IS NOT NULL) AND (length(TRIM(BOTH FROM accuracy_note)) > 0)))),
    CONSTRAINT candidate_code_nonempty CHECK ((length(TRIM(BOTH FROM code)) > 0)),
    CONSTRAINT candidate_review_state CHECK ((((status = 'pending'::public.coordinate_candidate_status) AND (NOT human_confirmed)) OR ((status = 'confirmed'::public.coordinate_candidate_status) AND human_confirmed AND (confirmed_at IS NOT NULL) AND (confirmed_by IS NOT NULL)) OR ((status = 'rejected'::public.coordinate_candidate_status) AND (NOT human_confirmed) AND (rejected_reason IS NOT NULL) AND (length(TRIM(BOTH FROM rejected_reason)) > 0) AND (reviewed_at IS NOT NULL) AND (reviewed_by IS NOT NULL)))),
    CONSTRAINT confirmed_at_finite CHECK (((confirmed_at IS NULL) OR isfinite(confirmed_at))),
    CONSTRAINT coordinate_candidates_accuracy_meters_check CHECK ((accuracy_meters >= (0)::numeric)),
    CONSTRAINT coordinate_candidates_check CHECK (((converted_latitude IS NULL) = (converted_longitude IS NULL))),
    CONSTRAINT coordinate_candidates_check1 CHECK (((converted_latitude IS NULL) OR ((raw_coordinate_system <> '未知'::public.coordinate_system) AND (map_coordinate_system IS NOT NULL) AND (map_coordinate_system = 'GCJ-02'::public.coordinate_system)))),
    CONSTRAINT coordinate_candidates_check2 CHECK (((NOT human_confirmed) OR ((confirmed_at IS NOT NULL) AND (confirmed_by IS NOT NULL) AND (length(TRIM(BOTH FROM confirmed_by)) > 0) AND (matched_place_id IS NOT NULL) AND (converted_latitude IS NOT NULL)))),
    CONSTRAINT coordinate_candidates_check3 CHECK (((writeback_status <> ALL (ARRAY['可写回'::text, '已写回'::text])) OR human_confirmed)),
    CONSTRAINT coordinate_candidates_converted_latitude_check CHECK (((converted_latitude >= ('-90'::integer)::double precision) AND (converted_latitude <= (90)::double precision))),
    CONSTRAINT coordinate_candidates_converted_longitude_check CHECK (((converted_longitude >= ('-180'::integer)::double precision) AND (converted_longitude <= (180)::double precision))),
    CONSTRAINT coordinate_candidates_match_confidence_check CHECK ((match_confidence = ANY (ARRAY['高'::text, '中'::text, '低'::text]))),
    CONSTRAINT coordinate_candidates_position_certainty_check CHECK ((position_certainty = ANY (ARRAY['certain'::text, 'approximate'::text, 'uncertain'::text]))),
    CONSTRAINT coordinate_candidates_raw_latitude_check CHECK (((raw_latitude >= ('-90'::integer)::double precision) AND (raw_latitude <= (90)::double precision))),
    CONSTRAINT coordinate_candidates_raw_longitude_check CHECK (((raw_longitude >= ('-180'::integer)::double precision) AND (raw_longitude <= (180)::double precision))),
    CONSTRAINT coordinate_candidates_writeback_status_check CHECK ((writeback_status = ANY (ARRAY['待匹配'::text, '待确认'::text, '可写回'::text, '已写回'::text, '已拒绝'::text, '仅轨迹参考'::text]))),
    CONSTRAINT created_at_finite CHECK (((created_at IS NULL) OR isfinite(created_at))),
    CONSTRAINT reviewed_at_finite CHECK (((reviewed_at IS NULL) OR isfinite(reviewed_at))),
    CONSTRAINT source_time_finite CHECK (((source_time IS NULL) OR isfinite(source_time)))
);


--
-- Name: COLUMN coordinate_candidates.position_certainty; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.coordinate_candidates.position_certainty IS 'Reviewer assessment of the location, independent of source confidence, measured accuracy and field verification; NULL means not recorded';


--
-- Name: guide_places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_places (
    guide_id uuid NOT NULL,
    place_id uuid NOT NULL
);


--
-- Name: guide_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_routes (
    guide_id uuid NOT NULL,
    route_id uuid NOT NULL
);


--
-- Name: guides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    summary text,
    body text,
    guide_type text NOT NULL,
    publish_status public.publish_status DEFAULT '草稿'::public.publish_status NOT NULL,
    source_workflow text,
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_updated_at timestamp with time zone,
    body_source text,
    media_note text,
    notes text,
    source_import_row_id uuid,
    CONSTRAINT guides_check CHECK (((publish_status <> '已发布'::public.publish_status) OR (published_at IS NOT NULL))),
    CONSTRAINT guides_code_check CHECK ((code ~ '^G-[0-9]{4,}$'::text)),
    CONSTRAINT guides_guide_type_check CHECK ((guide_type = ANY (ARRAY['实测攻略'::text, '展馆攻略'::text, '自然观察攻略'::text, '路线/专题'::text, '人物/展馆攻略'::text]))),
    CONSTRAINT guides_source_workflow_check CHECK ((source_workflow = ANY (ARRAY['已有内容/待入库'::text, '研究中'::text, '待建立'::text, '草稿'::text, '已发布'::text, '已归档'::text]))),
    CONSTRAINT published_at_finite CHECK (((published_at IS NULL) OR isfinite(published_at))),
    CONSTRAINT source_updated_at_finite CHECK (((source_updated_at IS NULL) OR isfinite(source_updated_at))),
    CONSTRAINT updated_at_finite CHECK (((updated_at IS NULL) OR isfinite(updated_at)))
);


--
-- Name: import_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_filename text NOT NULL,
    source_sha256 text NOT NULL,
    preview_sha256 text NOT NULL,
    status text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    result jsonb,
    CONSTRAINT completed_at_finite CHECK (((completed_at IS NULL) OR isfinite(completed_at))),
    CONSTRAINT import_jobs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'completed'::text]))),
    CONSTRAINT started_at_finite CHECK (((started_at IS NULL) OR isfinite(started_at)))
);


--
-- Name: import_rows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.import_rows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    sheet text NOT NULL,
    row_number integer NOT NULL,
    business_code text,
    payload jsonb NOT NULL,
    outcome text NOT NULL,
    issues jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT import_rows_outcome_check CHECK ((outcome = ANY (ARRAY['pending'::text, 'success'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT import_rows_row_number_check CHECK ((row_number > 0))
);


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    place_id uuid,
    media_type text NOT NULL,
    purpose text,
    file_url text,
    local_source_path text,
    shot_at timestamp with time zone,
    direction_note text,
    public_status text DEFAULT '私有'::text NOT NULL,
    CONSTRAINT media_check CHECK (((file_url IS NOT NULL) OR (local_source_path IS NOT NULL))),
    CONSTRAINT media_media_type_check CHECK ((media_type = ANY (ARRAY['图片'::text, '视频'::text, '音频'::text, '文件'::text]))),
    CONSTRAINT media_public_status_check CHECK ((public_status = ANY (ARRAY['私有'::text, '可公开'::text]))),
    CONSTRAINT shot_at_finite CHECK (((shot_at IS NULL) OR isfinite(shot_at)))
);


--
-- Name: place_accessibility; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.place_accessibility (
    place_id uuid NOT NULL,
    stroller_friendly public.yes_partial,
    baby_carrier_possible public.yes_partial,
    age_2_3_rating text,
    age_4_6_rating text,
    age_7_plus_rating text,
    elderly_friendly public.yes_partial,
    child_friendly_note text,
    stairs_note text,
    slope_note text,
    shade_note text,
    seats_available public.yes_partial,
    fall_risk text,
    water_risk text,
    vehicle_risk text
);


--
-- Name: place_nature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.place_nature (
    place_id uuid NOT NULL,
    primary_observation text,
    secondary_observation text,
    best_season text,
    best_time text,
    weather_note text,
    wind_note text,
    temperature_note text,
    guaranteed_sighting boolean DEFAULT false NOT NULL,
    waiting_required boolean,
    ecological_sensitivity text
);


--
-- Name: place_practical_info; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.place_practical_info (
    place_id uuid NOT NULL,
    car_access public.yes_partial,
    road_type text,
    road_width_note text,
    passing_difficulty text,
    four_wheel_drive_required boolean,
    walking_required boolean,
    walking_distance_m numeric,
    walking_duration_min numeric,
    parking_available public.yes_partial,
    parking_type text,
    parking_capacity_note text,
    parking_fee_note text,
    toilet_available public.yes_partial,
    toilet_distance_m numeric,
    food_available public.yes_partial,
    water_available public.yes_partial,
    mobile_signal_note text,
    charging_available public.yes_partial,
    CONSTRAINT place_practical_info_toilet_distance_m_check CHECK ((toilet_distance_m >= (0)::numeric)),
    CONSTRAINT place_practical_info_walking_distance_m_check CHECK ((walking_distance_m >= (0)::numeric)),
    CONSTRAINT place_practical_info_walking_duration_min_check CHECK ((walking_duration_min >= (0)::numeric))
);


--
-- Name: place_water; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.place_water (
    place_id uuid NOT NULL,
    water_type text,
    normal_depth_note text,
    riverbed_type text,
    slippery_risk text,
    current_risk text,
    rainfall_risk text,
    upstream_rainfall_risk text,
    child_water_entry_note text,
    life_jacket_note text,
    last_water_check_at timestamp with time zone,
    CONSTRAINT last_water_check_at_finite CHECK (((last_water_check_at IS NULL) OR isfinite(last_water_check_at)))
);


--
-- Name: places; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.places (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    short_name text,
    place_type public.place_type NOT NULL,
    parent_place_id uuid,
    category_id uuid NOT NULL,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    region text,
    main_line text,
    intro text,
    current_status public.place_status DEFAULT '待核实'::public.place_status NOT NULL,
    public_level public.public_level DEFAULT 'P5'::public.public_level NOT NULL,
    priority public.priority DEFAULT '中'::public.priority NOT NULL,
    risk_note text,
    rain_friendly public.yes_partial,
    notes text,
    source_last_verified_at date,
    source_import_row_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT created_at_finite CHECK (((created_at IS NULL) OR isfinite(created_at))),
    CONSTRAINT places_check CHECK ((parent_place_id IS DISTINCT FROM id)),
    CONSTRAINT places_code_check CHECK ((code ~ '^WY-[0-9]{4,}$'::text)),
    CONSTRAINT places_name_check CHECK ((length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT source_last_verified_at_finite CHECK (((source_last_verified_at IS NULL) OR isfinite(source_last_verified_at))),
    CONSTRAINT updated_at_finite CHECK (((updated_at IS NULL) OR isfinite(updated_at)))
);


--
-- Name: public_places; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.public_places AS
 SELECT p.code,
    p.name,
    p.current_status,
    p.public_level,
        CASE
            WHEN (p.public_level = ANY (ARRAY['P1'::public.public_level, 'P2'::public.public_level, 'P3'::public.public_level])) THEN p.region
            ELSE NULL::text
        END AS region,
        CASE
            WHEN ((p.public_level = 'P1'::public.public_level) AND (p.current_status = '正常'::public.place_status)) THEN c.map_latitude
            ELSE NULL::double precision
        END AS latitude,
        CASE
            WHEN ((p.public_level = 'P1'::public.public_level) AND (p.current_status = '正常'::public.place_status)) THEN c.map_longitude
            ELSE NULL::double precision
        END AS longitude,
        CASE
            WHEN ((p.public_level = 'P1'::public.public_level) AND (p.current_status = '正常'::public.place_status) AND (c.id IS NOT NULL)) THEN 'GCJ-02'::text
            ELSE NULL::text
        END AS coordinate_system
   FROM (public.places p
     LEFT JOIN public.confirmed_place_coordinates c ON ((c.place_id = p.id)))
  WHERE (p.public_level <> 'P5'::public.public_level);


--
-- Name: route_place_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route_place_links (
    route_id uuid NOT NULL,
    place_id uuid NOT NULL,
    source_import_row_id uuid
);


--
-- Name: route_stops; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.route_stops (
    route_id uuid NOT NULL,
    place_id uuid NOT NULL,
    sequence integer NOT NULL,
    suggested_duration_min numeric,
    required_or_optional text,
    alternative_group text,
    condition_note text,
    CONSTRAINT route_stops_required_or_optional_check CHECK ((required_or_optional = ANY (ARRAY['必选'::text, '可选'::text]))),
    CONSTRAINT route_stops_sequence_check CHECK ((sequence > 0)),
    CONSTRAINT route_stops_suggested_duration_min_check CHECK ((suggested_duration_min >= (0)::numeric))
);


--
-- Name: routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    route_type text NOT NULL,
    intro text,
    total_duration_min numeric,
    estimated_driving_min numeric,
    estimated_walking_m numeric,
    suitable_age_note text,
    season_note text,
    rain_friendly public.yes_partial,
    elderly_friendly public.yes_partial,
    publish_status public.publish_status DEFAULT '草稿'::public.publish_status NOT NULL,
    source_status public.place_status,
    start_note text,
    end_note text,
    source_last_verified_at date,
    sequence_confirmed boolean DEFAULT false NOT NULL,
    source_import_row_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT created_at_finite CHECK (((created_at IS NULL) OR isfinite(created_at))),
    CONSTRAINT routes_code_check CHECK ((code ~ '^R-[0-9]{4,}$'::text)),
    CONSTRAINT routes_estimated_driving_min_check CHECK ((estimated_driving_min >= (0)::numeric)),
    CONSTRAINT routes_estimated_walking_m_check CHECK ((estimated_walking_m >= (0)::numeric)),
    CONSTRAINT routes_route_type_check CHECK ((route_type = ANY (ARRAY['候选路线'::text, '自驾'::text, '步行'::text, '混合'::text]))),
    CONSTRAINT routes_total_duration_min_check CHECK ((total_duration_min >= (0)::numeric)),
    CONSTRAINT source_last_verified_at_finite CHECK (((source_last_verified_at IS NULL) OR isfinite(source_last_verified_at))),
    CONSTRAINT updated_at_finite CHECK (((updated_at IS NULL) OR isfinite(updated_at)))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    name text NOT NULL,
    sha256 text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: taxonomy_terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.taxonomy_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    dimension text NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    enabled boolean DEFAULT true NOT NULL,
    source_import_row_id uuid,
    CONSTRAINT taxonomy_dimension CHECK ((dimension = ANY (ARRAY['点位层级'::text, '一级分类'::text, '公开等级'::text, '坐标可信'::text, '当前状态'::text, '任务状态'::text, '任务优先级'::text, '标签'::text])))
);


--
-- Name: verification_media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_media (
    verification_id uuid NOT NULL,
    media_id uuid NOT NULL
);


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    place_id uuid NOT NULL,
    verified_at timestamp with time zone NOT NULL,
    road_status text,
    parking_status text,
    toilet_status text,
    open_status public.place_status,
    weather text,
    water_condition text,
    observation_note text,
    general_note text,
    verifier text NOT NULL,
    source_photo_note text,
    source_import_row_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT created_at_finite CHECK (((created_at IS NULL) OR isfinite(created_at))),
    CONSTRAINT verification_code_nonempty CHECK ((length(TRIM(BOTH FROM code)) > 0)),
    CONSTRAINT verifications_verifier_check CHECK ((length(TRIM(BOTH FROM verifier)) > 0)),
    CONSTRAINT verified_at_finite CHECK (((verified_at IS NULL) OR isfinite(verified_at)))
);


--
-- Data for Name: coordinate_candidates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.coordinate_candidates (id, code, source_file, source_type, source_time, source_time_original, timecode, device, altitude_m, raw_latitude, raw_longitude, raw_coordinate_system, accuracy_meters, confidence_level, matched_place_id, match_confidence, match_reason, converted_latitude, converted_longitude, map_coordinate_system, conversion_method, human_confirmed, confirmed_at, confirmed_by, source_claimed_confirmed, rejected_reason, writeback_status, notes, source_import_row_id, created_at, source_reference, accuracy_note, status, reviewed_at, reviewed_by, position_certainty) FROM stdin;
9b263b85-4288-4cf7-869a-8a0322bdba08	C-7ad80eaf-109c-428a-a74e-2cf58f3c95ab	\N	map_click	2026-09-09 08:39:08.457+08	2026-09-09T00:39:08.457Z	\N	\N	\N	27.61034087193368	117.99222872911434	GCJ-02	\N	C	82384987-e512-469a-8734-c2b842e213ee	\N	\N	27.61034087193368	117.99222872911434	GCJ-02	identity:GCJ-02	t	2026-09-09 08:40:24.140661+08	owner	\N	\N	已写回	\N	\N	2026-09-09 08:39:37.083863+08	腾讯卫星影像人工判读	未测量；不能据此宣称定位精度	confirmed	2026-09-09 08:40:24.140661+08	owner	certain
e89717d9-ded3-4cbc-a6fd-e85230fc34cf	C-dbaa58d9-bc52-4955-a650-56a6333a96c3	\N	map_click	2026-09-09 08:49:03.013+08	2026-09-09T00:49:03.013Z	\N	\N	\N	27.608460789632296	117.99057456870855	GCJ-02	\N	C	82384987-e512-469a-8734-c2b842e213ee	\N	\N	27.608460789632296	117.99057456870855	GCJ-02	identity:GCJ-02	t	2026-09-09 08:49:45.886978+08	owner	\N	\N	已写回	\N	\N	2026-09-09 08:49:26.900828+08	腾讯标准地图人工判点	未测量；不能据此宣称定位精度	confirmed	2026-09-09 08:49:45.886978+08	owner	certain
b0ff7de5-899d-4953-82fa-bdd3f2f4e5e4	C-f9165972-0f17-4e5c-be59-3c6559c6eafe	\N	map_click	2026-09-09 08:51:31.144+08	2026-09-09T00:51:31.144Z	\N	\N	\N	27.609909249142245	117.99201844498793	GCJ-02	\N	C	ebe75bec-1bb5-49c9-88e9-705a6f280e36	\N	\N	27.609909249142245	117.99201844498793	GCJ-02	identity:GCJ-02	t	2026-09-09 08:51:40.881515+08	owner	\N	\N	已写回	\N	\N	2026-09-09 08:51:36.156214+08	腾讯标准地图人工判点	未测量；不能据此宣称定位精度	confirmed	2026-09-09 08:51:40.881515+08	owner	certain
a2de84b8-0bd2-4f00-9ec3-d0169dbd6e5a	C-fb3f81e2-cae0-465b-925f-7589b19a5ae0	\N	map_click	2026-09-09 08:52:05.903+08	2026-09-09T00:52:05.903Z	\N	\N	\N	27.61031608497586	117.9921821005239	GCJ-02	\N	C	fc815062-4ff8-4b26-ad62-68a2ca8573fe	\N	\N	27.61031608497586	117.9921821005239	GCJ-02	identity:GCJ-02	t	2026-09-09 08:52:18.233149+08	owner	\N	\N	已写回	\N	\N	2026-09-09 08:52:14.372797+08	腾讯标准地图人工判点	未测量；不能据此宣称定位精度	confirmed	2026-09-09 08:52:18.233149+08	owner	approximate
51692d10-aaaa-4a61-b98c-385fbd082f61	C-2f9cbc01-7a31-4411-8a96-0622e47c9b18	\N	map_click	2026-09-09 09:03:25.964+08	2026-09-09T01:03:25.964Z	\N	\N	\N	27.62003604255768	117.92890743753605	GCJ-02	\N	C	b8fabb59-18a6-47e0-9414-5fe137b1e4ef	\N	\N	27.62003604255768	117.92890743753605	GCJ-02	identity:GCJ-02	t	2026-09-09 09:04:25.583937+08	owner	\N	\N	已写回	\N	\N	2026-09-09 09:04:22.083289+08	腾讯卫星影像人工判读	未测量；不能据此宣称定位精度	confirmed	2026-09-09 09:04:25.583937+08	owner	certain
\.


--
-- Data for Name: guide_places; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.guide_places (guide_id, place_id) FROM stdin;
ad1b655d-6aab-4156-8c7b-3105aec93e2f	3c62d05a-ccda-4f56-8798-2738ed05d899
11de3193-1a98-4b60-92dc-8a776bd2eb6b	2ba2eb33-930d-43b5-8260-504242816eda
eb4745d1-cb50-4ee2-82e8-8ce178ea4c6b	4727af6b-b38f-421d-b2eb-f81dc53bd828
9ecf93b3-6791-47af-b1d5-29dc48e6b6ba	865fd38e-5097-4f47-9269-4b6d3b2e1433
c52d614c-8cb7-428e-ab0a-4655e802a52e	3a717058-62be-42de-bd53-1fc7fb08cab4
3343539a-945e-405b-b380-835716698029	9bfe0058-a9cc-4b7e-a2a5-2ec4308f3715
0b9ce5af-bbe9-4827-8d92-0683809730b3	21eed006-9770-438a-8641-b90044786bbd
2cdd94f1-6979-46d9-94cf-fe584cd985ab	0c194fab-5ed5-49b3-9768-d447d12507e3
\.


--
-- Data for Name: guide_routes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.guide_routes (guide_id, route_id) FROM stdin;
9b44a990-9bd2-4897-bd3a-592c4c84767c	2145100b-d390-4503-be43-4f75d7989279
0b017017-3d9b-4a3a-8d41-9803936def4d	3446d8ee-6b56-47fb-9809-31a7aba512f8
\.


--
-- Data for Name: guides; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.guides (id, code, title, summary, body, guide_type, publish_status, source_workflow, published_at, updated_at, source_updated_at, body_source, media_note, notes, source_import_row_id) FROM stdin;
ad1b655d-6aab-4156-8c7b-3105aec93e2f	G-0001	桃源峪找蝴蝶	\N	\N	实测攻略	草稿	已有内容/待入库	\N	2026-09-05 12:35:22.13704+08	\N	\N	可关联野外观察素材	\N	ea8b337d-d270-4a55-8fb0-332258f898c3
11de3193-1a98-4b60-92dc-8a776bd2eb6b	G-0002	龙渡蝴蝶科普展示馆	\N	\N	展馆攻略	草稿	已有内容/待入库	\N	2026-09-05 12:35:22.141711+08	\N	\N	已有完整口播与素材	\N	173731aa-0fad-4209-8291-6d371f0f9568
eb4745d1-cb50-4ee2-82e8-8ce178ea4c6b	G-0003	野猴谷里的藏酋猴	\N	\N	自然观察攻略	草稿	研究中	\N	2026-09-05 12:35:22.14407+08	\N	\N	需补拍并核实观察条件	\N	5c416c53-5a09-4d3e-8657-2167b455a1af
9b44a990-9bd2-4897-bd3a-592c4c84767c	G-0004	一号风景道玩水点合集	\N	\N	路线/专题	草稿	待建立	\N	2026-09-05 12:35:22.145568+08	\N	\N	重点关联动态水情字段	\N	bd664ffa-f7e7-4cef-b273-fb28d91410e3
0b017017-3d9b-4a3a-8d41-9803936def4d	G-0005	一号风景道自然观察线	\N	\N	路线/专题	草稿	待建立	\N	2026-09-05 12:35:22.148647+08	\N	\N	暂不写死一日完成	\N	cfc57243-1323-448c-8549-57b6721ad571
9ecf93b3-6791-47af-b1d5-29dc48e6b6ba	G-0006	乌龙茶展示馆	\N	\N	展馆攻略	草稿	已有内容/待入库	\N	2026-09-05 12:35:22.149895+08	\N	\N	已有较完整研究、口播与素材	重点保留贡茶—市场—工艺演变与迁徙传播的复杂性。	247fb7ba-d35f-4459-a242-83f242f10e5d
c52d614c-8cb7-428e-ab0a-4655e802a52e	G-0007	珍稀植物展示馆1号馆	\N	\N	展馆攻略	草稿	已有内容/待入库	\N	2026-09-05 12:35:22.151557+08	\N	\N	已有模式标本、谭卫道、植物学网络研究	强调科学史与模式标本，避免单一民族叙事。	a3483d11-f1a4-41a2-a226-f31f3f05243a
3343539a-945e-405b-b380-835716698029	G-0008	珍稀植物展示馆2号馆	\N	\N	展馆攻略	草稿	待建立	\N	2026-09-05 12:35:22.15282+08	\N	\N	地点先入库，内容结构待补	\N	cf83bc3e-bfc2-4175-93a0-1cb02119a7d4
0b9ce5af-bbe9-4827-8d92-0683809730b3	G-0009	兰花展示馆	\N	\N	展馆攻略	草稿	已有内容/待入库	\N	2026-09-05 12:35:22.154855+08	\N	\N	已有兰花种子、真菌、传粉口播与素材	\N	3b78a26c-561b-4401-a2d7-0a0fcc47332d
2cdd94f1-6979-46d9-94cf-fe584cd985ab	G-0010	乡愁馆与山里人的故事	\N	\N	人物/展馆攻略	草稿	已有内容/待入库	\N	2026-09-05 12:35:22.156097+08	\N	\N	可关联黎老先生采访与乡愁馆素材	人物故事与地点信息分层呈现。	cb0a88b2-cd55-4bba-8942-aea8f582fa88
\.


--
-- Data for Name: import_jobs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.import_jobs (id, source_filename, source_sha256, preview_sha256, status, started_at, completed_at, result) FROM stdin;
e7e14a5f-c5dc-4516-ad66-254b52506316	武夷山奶爸地图_主数据库_V1.2.xlsx	5346dbe02e3e54067d96b91f080bf40007183b51df8cdd107d0d7f1dfd6cb40b	a4daf00c32a94b5f30bdfac1192721b120b238f8720e757ee2d5741500f11df6	completed	2026-09-05 12:35:21.946978+08	2026-09-05 12:35:22.157221+08	{"rows": [{"row": 2, "code": "点位层级:MAIN", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 3, "code": "点位层级:AUX", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 4, "code": "一级分类:AREA", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 5, "code": "一级分类:NATURE", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 6, "code": "一级分类:WATER", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 7, "code": "一级分类:VIEW", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 8, "code": "一级分类:MUSEUM", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 9, "code": "一级分类:SERVICE", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 10, "code": "一级分类:PARKING", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 11, "code": "一级分类:TRAFFIC", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 12, "code": "一级分类:RISK", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 13, "code": "公开等级:P1", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 14, "code": "公开等级:P2", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 15, "code": "公开等级:P3", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 16, "code": "公开等级:P4", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 17, "code": "公开等级:P5", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 18, "code": "坐标可信:A", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 19, "code": "坐标可信:B", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 20, "code": "坐标可信:C", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 21, "code": "坐标可信:D", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 22, "code": "当前状态:OPEN", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 23, "code": "当前状态:CLOSED", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 24, "code": "当前状态:SEASONAL", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 25, "code": "当前状态:CONSTRUCTION", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 26, "code": "当前状态:ROADBLOCK", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 27, "code": "当前状态:AVOID", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 28, "code": "当前状态:VERIFY", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 29, "code": "任务状态:TODO", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 30, "code": "任务状态:DOING", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 31, "code": "任务状态:DONE", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 32, "code": "任务优先级:H", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 33, "code": "任务优先级:M", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 34, "code": "任务优先级:L", "sheet": "分类标签", "issues": [], "outcome": "success"}, {"row": 2, "code": "WY-0001", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 3, "code": "WY-0002", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 4, "code": "WY-0003", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 5, "code": "WY-0004", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 6, "code": "WY-0005", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 7, "code": "WY-0006", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 8, "code": "WY-0007", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 9, "code": "WY-0008", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 10, "code": "WY-0009", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 11, "code": "WY-0010", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 12, "code": "WY-0011", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 13, "code": "WY-0012", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 14, "code": "WY-0013", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 15, "code": "WY-0014", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 16, "code": "WY-0015", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}, {"field": "上级地点ID", "level": "warning", "message": "辅助点未指定父地点，保持独立，不推测关联"}], "outcome": "success"}, {"row": 17, "code": "WY-0016", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 18, "code": "WY-0017", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 19, "code": "WY-0018", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 20, "code": "WY-0019", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 21, "code": "WY-0020", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 22, "code": "WY-0021", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 23, "code": "WY-0022", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 24, "code": "WY-0023", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 25, "code": "WY-0024", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}, {"field": "公开等级", "level": "warning", "message": "自然观察 P1 需人工复核生态敏感性；本批无正式坐标，不自动发布"}], "outcome": "success"}, {"row": 26, "code": "WY-0025", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 27, "code": "WY-0026", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 28, "code": "WY-0027", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 29, "code": "WY-0028", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 30, "code": "WY-0029", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 31, "code": "WY-0030", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}, {"field": "公开等级", "level": "warning", "message": "自然观察 P1 需人工复核生态敏感性；本批无正式坐标，不自动发布"}], "outcome": "success"}, {"row": 32, "code": "WY-0031", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 33, "code": "WY-0032", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 34, "code": "WY-0033", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 35, "code": "WY-0034", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 36, "code": "WY-0035", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 37, "code": "WY-0036", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 38, "code": "WY-0037", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 39, "code": "WY-0038", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 40, "code": "WY-0039", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 41, "code": "WY-0040", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 42, "code": "WY-0041", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 43, "code": "WY-0042", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 44, "code": "WY-0043", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 45, "code": "WY-0044", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 46, "code": "WY-0045", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 47, "code": "WY-0046", "sheet": "地点库", "issues": [{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}], "outcome": "success"}, {"row": 2, "code": "R-0001", "sheet": "路线库", "issues": [{"field": "地点序列（地点ID）", "level": "warning", "message": "只保留来源候选顺序，sequence_confirmed=false，不承诺路线可通行"}], "outcome": "success"}, {"row": 3, "code": "R-0002", "sheet": "路线库", "issues": [{"field": "地点序列（地点ID）", "level": "warning", "message": "只保留来源候选顺序，sequence_confirmed=false，不承诺路线可通行"}], "outcome": "success"}, {"row": 4, "code": "R-0003", "sheet": "路线库", "issues": [{"field": "地点序列（地点ID）", "level": "warning", "message": "只保留来源候选顺序，sequence_confirmed=false，不承诺路线可通行"}], "outcome": "success"}, {"row": 5, "code": "R-0004", "sheet": "路线库", "issues": [{"field": "地点序列（地点ID）", "level": "warning", "message": "站点序列为空；保留路线和备注，不从备注范围推测顺序"}], "outcome": "success"}, {"row": 2, "code": "G-0001", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 3, "code": "G-0002", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 4, "code": "G-0003", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 5, "code": "G-0004", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 6, "code": "G-0005", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 7, "code": "G-0006", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 8, "code": "G-0007", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 9, "code": "G-0008", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 10, "code": "G-0009", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}, {"row": 11, "code": "G-0010", "sheet": "攻略库", "issues": [{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}], "outcome": "success"}], "jobId": "e7e14a5f-c5dc-4516-ad66-254b52506316", "counts": {"failed": 0, "places": 46, "skipped": 0, "success": 93, "warnings": 119}, "sourceSha256": "5346dbe02e3e54067d96b91f080bf40007183b51df8cdd107d0d7f1dfd6cb40b"}
\.


--
-- Data for Name: import_rows; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.import_rows (id, job_id, sheet, row_number, business_code, payload, outcome, issues) FROM stdin;
d879bbfb-7eef-4ece-b672-a09aae0996cb	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	2	点位层级:MAIN	{"名称": "主地点", "启用": true, "维度": "点位层级", "编码": "MAIN", "说明": "用户会独立寻找或理解的主要地点"}	success	[]
cb6b23d9-ec7b-413c-96cf-209754cb5a14	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	3	点位层级:AUX	{"名称": "辅助点", "启用": true, "维度": "点位层级", "编码": "AUX", "说明": "停车、厕所、入口、下河口等附属位置"}	success	[]
98996a7f-1d3e-40d7-aaea-6c1c3c794307	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	4	一级分类:AREA	{"名称": "区域/村镇", "启用": true, "维度": "一级分类", "编码": "AREA", "说明": "区域或村镇级地点"}	success	[]
d302c08b-44b1-4374-8708-4740ff429b93	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	5	一级分类:NATURE	{"名称": "自然观察", "启用": true, "维度": "一级分类", "编码": "NATURE", "说明": "蝴蝶、猴类、昆虫、星空等"}	success	[]
07644085-a3b5-43c1-abf5-7b3a15bfed13	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	6	一级分类:WATER	{"名称": "玩水", "启用": true, "维度": "一级分类", "编码": "WATER", "说明": "溪流、浅滩、下河点"}	success	[]
3ca56810-8caf-4db8-96d7-889510ff770a	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	7	一级分类:VIEW	{"名称": "观景", "启用": true, "维度": "一级分类", "编码": "VIEW", "说明": "观景、日出、星空等"}	success	[]
a8f2c1e4-cec7-4729-8318-59f7f1f63bfd	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	8	一级分类:MUSEUM	{"名称": "展馆", "启用": true, "维度": "一级分类", "编码": "MUSEUM", "说明": "科普、历史、茶文化等展馆"}	success	[]
372f53df-ec55-4da1-9792-2b768048fa63	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	9	一级分类:SERVICE	{"名称": "服务", "启用": true, "维度": "一级分类", "编码": "SERVICE", "说明": "厕所、补给、餐饮等"}	success	[]
90dcebc1-c33e-4cfe-8621-4565f9057178	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	10	一级分类:PARKING	{"名称": "停车", "启用": true, "维度": "一级分类", "编码": "PARKING", "说明": "停车位置或停车场"}	success	[]
bf4d5fe7-0957-43e1-86c2-ddbfa406bc86	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	11	一级分类:TRAFFIC	{"名称": "交通/入口", "启用": true, "维度": "一级分类", "编码": "TRAFFIC", "说明": "岔路口、步行入口、道路节点"}	success	[]
d779ace4-ed44-49a7-be99-0748b74bf826	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	12	一级分类:RISK	{"名称": "风险/状态", "启用": true, "维度": "一级分类", "编码": "RISK", "说明": "封闭、施工、风险提示等"}	success	[]
25b73472-7714-4c34-8996-611988700f88	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	13	公开等级:P1	{"名称": "精确公开", "启用": true, "维度": "公开等级", "编码": "P1", "说明": "显示精确位置，可用于导航"}	success	[]
fd1104ce-6143-418a-b215-1329e4d7d156	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	14	公开等级:P2	{"名称": "附近公开", "启用": true, "维度": "公开等级", "编码": "P2", "说明": "显示附近区域，不强调精确落点"}	success	[]
1fcaffa2-91fc-48a0-8ac1-7c105e2e244c	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	15	公开等级:P3	{"名称": "区域公开", "启用": true, "维度": "公开等级", "编码": "P3", "说明": "只显示区域级位置"}	success	[]
a5ad465b-c913-4b29-963f-e42ffadde4c3	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	16	公开等级:P4	{"名称": "不公开坐标", "启用": true, "维度": "公开等级", "编码": "P4", "说明": "攻略可公开，但不展示坐标"}	success	[]
5ea41ecd-1126-4f62-9a0c-0a18dc9b7c70	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	17	公开等级:P5	{"名称": "完全私有", "启用": true, "维度": "公开等级", "编码": "P5", "说明": "仅后台可见"}	success	[]
60fbbd01-c7dc-4220-96cc-8b7e193eefcb	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	18	坐标可信:A	{"名称": "A级", "启用": true, "维度": "坐标可信", "编码": "A", "说明": "实地准确位置采集并人工核验"}	success	[]
8fcdc913-924f-4d58-a362-a928dd99dee8	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	19	坐标可信:B	{"名称": "B级", "启用": true, "维度": "坐标可信", "编码": "B", "说明": "GPS/无人机轨迹等较可靠来源"}	success	[]
8133ddc2-98ae-4315-a48a-950350553d43	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	20	坐标可信:C	{"名称": "C级", "启用": true, "维度": "坐标可信", "编码": "C", "说明": "地图或卫星图人工判断"}	success	[]
99045797-cb65-4365-b802-009729a2d3fb	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	21	坐标可信:D	{"名称": "D级", "启用": true, "维度": "坐标可信", "编码": "D", "说明": "仅大致区域"}	success	[]
f3bfe7a5-3740-4f05-9cab-8b8c3c5ca6db	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	22	当前状态:OPEN	{"名称": "正常", "启用": true, "维度": "当前状态", "编码": "OPEN", "说明": "正常可访问/可使用"}	success	[]
533ff753-9d24-454b-8fbb-044ecab3177d	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	23	当前状态:CLOSED	{"名称": "临时关闭", "启用": true, "维度": "当前状态", "编码": "CLOSED", "说明": "临时关闭或封闭"}	success	[]
da3fc0c8-50e5-4712-8afc-c1cdf6ee26ef	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	24	当前状态:SEASONAL	{"名称": "季节关闭", "启用": true, "维度": "当前状态", "编码": "SEASONAL", "说明": "按季节关闭"}	success	[]
25c9d094-f9de-485a-9917-2a78c5ea185f	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	25	当前状态:CONSTRUCTION	{"名称": "施工", "启用": true, "维度": "当前状态", "编码": "CONSTRUCTION", "说明": "施工影响访问"}	success	[]
32b77756-3d55-45fe-9ea4-b2e953cbf33f	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	26	当前状态:ROADBLOCK	{"名称": "道路中断", "启用": true, "维度": "当前状态", "编码": "ROADBLOCK", "说明": "道路无法正常通行"}	success	[]
fa24d70e-2026-46cf-8971-ad6ccada9df8	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	27	当前状态:AVOID	{"名称": "不建议前往", "启用": true, "维度": "当前状态", "编码": "AVOID", "说明": "当前不建议前往"}	success	[]
f796e952-bc5e-4c7a-bd8e-ee3ae303abad	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	28	当前状态:VERIFY	{"名称": "待核实", "启用": true, "维度": "当前状态", "编码": "VERIFY", "说明": "信息尚未完成现场核实"}	success	[]
b4499378-7d33-4850-9236-864f9c878584	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	29	任务状态:TODO	{"名称": "待处理", "启用": true, "维度": "任务状态", "编码": "TODO", "说明": "尚未处理"}	success	[]
38487aeb-28fb-44bf-a762-3a0b69a5d676	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	30	任务状态:DOING	{"名称": "进行中", "启用": true, "维度": "任务状态", "编码": "DOING", "说明": "正在核验或补录"}	success	[]
713154a1-46c2-41d1-af29-e50e70cfd0fe	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	31	任务状态:DONE	{"名称": "已完成", "启用": true, "维度": "任务状态", "编码": "DONE", "说明": "已经完成"}	success	[]
0cb2ec5e-5e9a-4ff1-9c01-138dcea02e2c	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	32	任务优先级:H	{"名称": "高", "启用": true, "维度": "任务优先级", "编码": "H", "说明": "第一批必须补齐"}	success	[]
70f16f67-3b60-40b2-b854-7c0968ff6460	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	33	任务优先级:M	{"名称": "中", "启用": true, "维度": "任务优先级", "编码": "M", "说明": "第二批补齐"}	success	[]
48675990-f1d1-440b-9d72-ca54ad86bb6f	e7e14a5f-c5dc-4516-ad66-254b52506316	分类标签	34	任务优先级:L	{"名称": "低", "启用": true, "维度": "任务优先级", "编码": "L", "说明": "后续完善"}	success	[]
d9d324b6-9790-4a77-a6e5-1665794cba14	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	2	WY-0001	{"停车": null, "厕所": null, "名称": "南源岭", "备注": null, "地点ID": "WY-0001", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T2=\\"\\",\\"待核验\\",IF(U2<=90,\\"新鲜\\",IF(U2<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T2=\\"\\",\\"\\",TODAY()-T2)"}}, "优先级": "高", "一级分类": "区域/村镇", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "南源岭", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "一号风景道起点/区域"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
457e2e6f-42da-42e0-a3bc-da4afb992c4c	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	3	WY-0002	{"停车": null, "厕所": null, "名称": "南源岭停车位置", "备注": null, "地点ID": "WY-0002", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T3=\\"\\",\\"待核验\\",IF(U3<=90,\\"新鲜\\",IF(U3<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T3=\\"\\",\\"\\",TODAY()-T3)"}}, "优先级": "高", "一级分类": "停车", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "南源岭", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0001", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "停车"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
e5ca2dff-d91a-4250-a5fb-fa61c00a4ce2	e7e14a5f-c5dc-4516-ad66-254b52506316	路线库	5	R-0004	{"备注": "节点集合包括WY-0040～WY-0044；暂不写死参观顺序，先现场核验各馆坐标、开放情况与真实步行关系。", "状态": "待核实", "终点": "红星村", "起点": "红星村", "路线ID": "R-0004", "推荐季节": null, "路线名称": "红星村·展馆步行候选线", "路线类型": "候选路线", "适合人群": "亲子/雨天/文化自然", "雨天可用": "是", "驾驶时长": null, "步行距离km": null, "预计总时长": null, "最后核验日期": null, "地点序列（地点ID）": null}	success	[{"field": "地点序列（地点ID）", "level": "warning", "message": "站点序列为空；保留路线和备注，不从备注范围推测顺序"}]
ea8b337d-d270-4a55-8fb0-332258f898c3	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	2	G-0001	{"备注": null, "平台": "统一内容源", "标题": "桃源峪找蝴蝶", "攻略ID": "G-0001", "内容类型": "实测攻略", "发布时间": null, "发布状态": "已有内容/待入库", "最后修改": null, "关联地点ID": "WY-0024", "关联路线ID": null, "封面/素材备注": "可关联野外观察素材", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
173731aa-0fad-4209-8291-6d371f0f9568	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	3	G-0002	{"备注": null, "平台": "统一内容源", "标题": "龙渡蝴蝶科普展示馆", "攻略ID": "G-0002", "内容类型": "展馆攻略", "发布时间": null, "发布状态": "已有内容/待入库", "最后修改": null, "关联地点ID": "WY-0028", "关联路线ID": null, "封面/素材备注": "已有完整口播与素材", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
92407514-5176-4878-815a-7129344b4bcf	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	4	WY-0003	{"停车": null, "厕所": null, "名称": "南源岭卫生间", "备注": null, "地点ID": "WY-0003", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T4=\\"\\",\\"待核验\\",IF(U4<=90,\\"新鲜\\",IF(U4<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T4=\\"\\",\\"\\",TODAY()-T4)"}}, "优先级": "中", "一级分类": "服务", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "南源岭", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0001", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "卫生间"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
ac7fe21e-cc81-404f-86be-63f0c02a15f7	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	5	WY-0004	{"停车": null, "厕所": null, "名称": "齐云峰观景/日出位置", "备注": null, "地点ID": "WY-0004", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T5=\\"\\",\\"待核验\\",IF(U5<=90,\\"新鲜\\",IF(U5<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T5=\\"\\",\\"\\",TODAY()-T5)"}}, "优先级": "高", "一级分类": "观景", "主要风险": null, "公开等级": "P2", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "南源岭", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "日出/观景"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
a173dfb2-0a0a-418e-bdec-4878c4c2f48f	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	6	WY-0005	{"停车": null, "厕所": null, "名称": "三才峰观景信息点", "备注": null, "地点ID": "WY-0005", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T6=\\"\\",\\"待核验\\",IF(U6<=90,\\"新鲜\\",IF(U6<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T6=\\"\\",\\"\\",TODAY()-T6)"}}, "优先级": "低", "一级分类": "观景", "主要风险": null, "公开等级": "P3", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "南源岭", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "观景"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
e829a5be-b9e4-47ab-857e-35c7d1c26f59	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	7	WY-0006	{"停车": null, "厕所": null, "名称": "星村补给区", "备注": null, "地点ID": "WY-0006", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T7=\\"\\",\\"待核验\\",IF(U7<=90,\\"新鲜\\",IF(U7<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T7=\\"\\",\\"\\",TODAY()-T7)"}}, "优先级": "中", "一级分类": "服务", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "星村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "补给/餐饮"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
56b3f6a9-dc14-4bf9-a20b-5338bfcf25a9	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	8	WY-0007	{"停车": null, "厕所": null, "名称": "星村特色小吃集中区", "备注": null, "地点ID": "WY-0007", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T8=\\"\\",\\"待核验\\",IF(U8<=90,\\"新鲜\\",IF(U8<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T8=\\"\\",\\"\\",TODAY()-T8)"}}, "优先级": "中", "一级分类": "服务", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "星村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0006", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "光饼/越南粉/油饼"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
78fe27f7-023b-4269-8214-2aed24bf9662	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	9	WY-0008	{"停车": null, "厕所": null, "名称": "漫水桥", "备注": null, "地点ID": "WY-0008", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T9=\\"\\",\\"待核验\\",IF(U9<=90,\\"新鲜\\",IF(U9<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T9=\\"\\",\\"\\",TODAY()-T9)"}}, "优先级": "高", "一级分类": "玩水", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "星村—黄村沿线", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "桥/浅水石滩"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
d5676428-5eb2-44e4-b3bd-92e6194fda53	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	10	WY-0009	{"停车": null, "厕所": null, "名称": "漫水桥下河位置", "备注": null, "地点ID": "WY-0009", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T10=\\"\\",\\"待核验\\",IF(U10<=90,\\"新鲜\\",IF(U10<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T10=\\"\\",\\"\\",TODAY()-T10)"}}, "优先级": "高", "一级分类": "玩水", "主要风险": null, "公开等级": "P2", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "星村—黄村沿线", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0008", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "下河入口"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
a283b9b7-dcd3-4177-b261-77bf1aa5f04e	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	11	WY-0010	{"停车": null, "厕所": null, "名称": "黄村", "备注": null, "地点ID": "WY-0010", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T11=\\"\\",\\"待核验\\",IF(U11<=90,\\"新鲜\\",IF(U11<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T11=\\"\\",\\"\\",TODAY()-T11)"}}, "优先级": "中", "一级分类": "区域/村镇", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "黄村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "村落/沿线节点"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
5815cc94-93fb-43e6-bb79-c22609aa9794	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	12	WY-0011	{"停车": null, "厕所": null, "名称": "黄村沿线停靠/观察位置", "备注": null, "地点ID": "WY-0011", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T12=\\"\\",\\"待核验\\",IF(U12<=90,\\"新鲜\\",IF(U12<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T12=\\"\\",\\"\\",TODAY()-T12)"}}, "优先级": "低", "一级分类": "观景", "主要风险": null, "公开等级": "P3", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "黄村", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0010", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "沿线观察"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
ddef78b1-3748-4df2-9f3d-573f1d80a78b	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	13	WY-0012	{"停车": null, "厕所": null, "名称": "月亮湾", "备注": null, "地点ID": "WY-0012", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T13=\\"\\",\\"待核验\\",IF(U13<=90,\\"新鲜\\",IF(U13<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T13=\\"\\",\\"\\",TODAY()-T13)"}}, "优先级": "高", "一级分类": "观景", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "正常", "所属区域": "月亮湾", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "人工大坝/观景"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
be905002-ee13-409a-b530-feefcff78e92	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	14	WY-0013	{"停车": null, "厕所": null, "名称": "月亮湾停车位置", "备注": null, "地点ID": "WY-0013", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T14=\\"\\",\\"待核验\\",IF(U14<=90,\\"新鲜\\",IF(U14<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T14=\\"\\",\\"\\",TODAY()-T14)"}}, "优先级": "高", "一级分类": "停车", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "月亮湾", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0012", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "停车"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
86729187-4a89-45eb-a9cf-463b8b11ad95	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	15	WY-0014	{"停车": null, "厕所": null, "名称": "月亮湾大坝观察位置", "备注": null, "地点ID": "WY-0014", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T15=\\"\\",\\"待核验\\",IF(U15<=90,\\"新鲜\\",IF(U15<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T15=\\"\\",\\"\\",TODAY()-T15)"}}, "优先级": "中", "一级分类": "观景", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "月亮湾", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0012", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "大坝观察"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
03b8438a-f998-4227-af48-f4056195442f	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	16	WY-0015	{"停车": null, "厕所": null, "名称": "翡翠谷支线路口", "备注": null, "地点ID": "WY-0015", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T16=\\"\\",\\"待核验\\",IF(U16<=90,\\"新鲜\\",IF(U16<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T16=\\"\\",\\"\\",TODAY()-T16)"}}, "优先级": "高", "一级分类": "交通/入口", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "翡翠谷支线", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "支线路口"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}, {"field": "上级地点ID", "level": "warning", "message": "辅助点未指定父地点，保持独立，不推测关联"}]
5c416c53-5a09-4d3e-8657-2167b455a1af	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	4	G-0003	{"备注": null, "平台": "统一内容源", "标题": "野猴谷里的藏酋猴", "攻略ID": "G-0003", "内容类型": "自然观察攻略", "发布时间": null, "发布状态": "研究中", "最后修改": null, "关联地点ID": "WY-0030", "关联路线ID": null, "封面/素材备注": "需补拍并核实观察条件", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
bd664ffa-f7e7-4cef-b273-fb28d91410e3	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	5	G-0004	{"备注": null, "平台": "统一内容源", "标题": "一号风景道玩水点合集", "攻略ID": "G-0004", "内容类型": "路线/专题", "发布时间": null, "发布状态": "待建立", "最后修改": null, "关联地点ID": null, "关联路线ID": "R-0003", "封面/素材备注": "重点关联动态水情字段", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
cfc57243-1323-448c-8549-57b6721ad571	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	6	G-0005	{"备注": null, "平台": "统一内容源", "标题": "一号风景道自然观察线", "攻略ID": "G-0005", "内容类型": "路线/专题", "发布时间": null, "发布状态": "待建立", "最后修改": null, "关联地点ID": null, "关联路线ID": "R-0001", "封面/素材备注": "暂不写死一日完成", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
3b78a26c-561b-4401-a2d7-0a0fcc47332d	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	10	G-0009	{"备注": null, "平台": "统一内容源", "标题": "兰花展示馆", "攻略ID": "G-0009", "内容类型": "展馆攻略", "发布时间": null, "发布状态": "已有内容/待入库", "最后修改": null, "关联地点ID": "WY-0043", "关联路线ID": null, "封面/素材备注": "已有兰花种子、真菌、传粉口播与素材", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
cb0a88b2-cd55-4bba-8942-aea8f582fa88	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	11	G-0010	{"备注": "人物故事与地点信息分层呈现。", "平台": "统一内容源", "标题": "乡愁馆与山里人的故事", "攻略ID": "G-0010", "内容类型": "人物/展馆攻略", "发布时间": null, "发布状态": "已有内容/待入库", "最后修改": null, "关联地点ID": "WY-0044", "关联路线ID": null, "封面/素材备注": "可关联黎老先生采访与乡愁馆素材", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
b9dd4058-50e4-4db2-b619-938a37a935a2	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	17	WY-0016	{"停车": null, "厕所": null, "名称": "翡翠谷支线", "备注": null, "地点ID": "WY-0016", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T17=\\"\\",\\"待核验\\",IF(U17<=90,\\"新鲜\\",IF(U17<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T17=\\"\\",\\"\\",TODAY()-T17)"}}, "优先级": "高", "一级分类": "风险/状态", "主要风险": null, "公开等级": "P4", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "临时关闭", "所属区域": "翡翠谷支线", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "当前封闭支线"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
ae7b17c5-717f-4533-957d-db897ebd12a6	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	18	WY-0017	{"停车": null, "厕所": null, "名称": "观山听水", "备注": null, "地点ID": "WY-0017", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T18=\\"\\",\\"待核验\\",IF(U18<=90,\\"新鲜\\",IF(U18<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T18=\\"\\",\\"\\",TODAY()-T18)"}}, "优先级": "高", "一级分类": "玩水", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "黄村—红星沿线", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "沿线玩水"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
9cb50b1a-e93f-4922-b7df-38935624995c	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	19	WY-0018	{"停车": null, "厕所": null, "名称": "大峡谷农庄下河位置", "备注": null, "地点ID": "WY-0018", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T19=\\"\\",\\"待核验\\",IF(U19<=90,\\"新鲜\\",IF(U19<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T19=\\"\\",\\"\\",TODAY()-T19)"}}, "优先级": "高", "一级分类": "玩水", "主要风险": null, "公开等级": "P2", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "黄村—红星沿线", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0017", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "下河入口"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
42197b06-d1b3-4b16-9874-5a617a1e7683	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	20	WY-0019	{"停车": null, "厕所": null, "名称": "皮坑浅滩", "备注": null, "地点ID": "WY-0019", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T20=\\"\\",\\"待核验\\",IF(U20<=90,\\"新鲜\\",IF(U20<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T20=\\"\\",\\"\\",TODAY()-T20)"}}, "优先级": "高", "一级分类": "玩水", "主要风险": null, "公开等级": "P2", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "皮坑", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "浅滩"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
fb665bb1-bf12-4d7f-8d44-309e72c821fc	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	21	WY-0020	{"停车": null, "厕所": null, "名称": "皮坑口", "备注": null, "地点ID": "WY-0020", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T21=\\"\\",\\"待核验\\",IF(U21<=90,\\"新鲜\\",IF(U21<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T21=\\"\\",\\"\\",TODAY()-T21)"}}, "优先级": "高", "一级分类": "玩水", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "皮坑", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "浅滩/入口"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
ee2f75e7-473c-4300-a8e7-7a60e27ae8f4	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	22	WY-0021	{"停车": null, "厕所": null, "名称": "皮坑口下水位置", "备注": null, "地点ID": "WY-0021", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T22=\\"\\",\\"待核验\\",IF(U22<=90,\\"新鲜\\",IF(U22<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T22=\\"\\",\\"\\",TODAY()-T22)"}}, "优先级": "高", "一级分类": "玩水", "主要风险": null, "公开等级": "P2", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "皮坑", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0020", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "下水入口"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
32620b55-41bd-4bb6-87af-893670c906fe	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	23	WY-0022	{"停车": null, "厕所": null, "名称": "大浅滩", "备注": null, "地点ID": "WY-0022", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T23=\\"\\",\\"待核验\\",IF(U23<=90,\\"新鲜\\",IF(U23<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T23=\\"\\",\\"\\",TODAY()-T23)"}}, "优先级": "高", "一级分类": "玩水", "主要风险": null, "公开等级": "P2", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "一号风景道沿线", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "浅滩/餐饮附近"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
483f3a8c-dba0-4809-9e6b-b1a1bc134e5d	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	24	WY-0023	{"停车": null, "厕所": null, "名称": "大浅滩停车位置", "备注": null, "地点ID": "WY-0023", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T24=\\"\\",\\"待核验\\",IF(U24<=90,\\"新鲜\\",IF(U24<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T24=\\"\\",\\"\\",TODAY()-T24)"}}, "优先级": "中", "一级分类": "停车", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "一号风景道沿线", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0022", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "停车"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
9a284fb0-8a8d-4f81-96de-f956c0c2ad2d	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	25	WY-0024	{"停车": null, "厕所": null, "名称": "桃源峪", "备注": null, "地点ID": "WY-0024", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T25=\\"\\",\\"待核验\\",IF(U25<=90,\\"新鲜\\",IF(U25<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T25=\\"\\",\\"\\",TODAY()-T25)"}}, "优先级": "高", "一级分类": "自然观察", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "正常", "所属区域": "桃源峪", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "蝴蝶/溪谷"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}, {"field": "公开等级", "level": "warning", "message": "自然观察 P1 需人工复核生态敏感性；本批无正式坐标，不自动发布"}]
af15f1a1-452b-4381-a678-d9bf8b1c4597	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	26	WY-0025	{"停车": null, "厕所": null, "名称": "桃源峪停车位置", "备注": null, "地点ID": "WY-0025", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T26=\\"\\",\\"待核验\\",IF(U26<=90,\\"新鲜\\",IF(U26<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T26=\\"\\",\\"\\",TODAY()-T26)"}}, "优先级": "高", "一级分类": "停车", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "桃源峪", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0024", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "停车"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
247fb7ba-d35f-4459-a242-83f242f10e5d	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	7	G-0006	{"备注": "重点保留贡茶—市场—工艺演变与迁徙传播的复杂性。", "平台": "统一内容源", "标题": "乌龙茶展示馆", "攻略ID": "G-0006", "内容类型": "展馆攻略", "发布时间": null, "发布状态": "已有内容/待入库", "最后修改": null, "关联地点ID": "WY-0040", "关联路线ID": null, "封面/素材备注": "已有较完整研究、口播与素材", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
a3483d11-f1a4-41a2-a226-f31f3f05243a	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	8	G-0007	{"备注": "强调科学史与模式标本，避免单一民族叙事。", "平台": "统一内容源", "标题": "珍稀植物展示馆1号馆", "攻略ID": "G-0007", "内容类型": "展馆攻略", "发布时间": null, "发布状态": "已有内容/待入库", "最后修改": null, "关联地点ID": "WY-0041", "关联路线ID": null, "封面/素材备注": "已有模式标本、谭卫道、植物学网络研究", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
cf83bc3e-bfc2-4175-93a0-1cb02119a7d4	e7e14a5f-c5dc-4516-ad66-254b52506316	攻略库	9	G-0008	{"备注": null, "平台": "统一内容源", "标题": "珍稀植物展示馆2号馆", "攻略ID": "G-0008", "内容类型": "展馆攻略", "发布时间": null, "发布状态": "待建立", "最后修改": null, "关联地点ID": "WY-0042", "关联路线ID": null, "封面/素材备注": "地点先入库，内容结构待补", "正文文件/链接": null}	success	[{"field": "发布状态", "level": "warning", "message": "导入为草稿；来源内容进度另存，不将“已有内容”当成已发布"}, {"field": "正文文件/链接", "level": "warning", "message": "没有正文文件或链接，保留攻略条目，不生成正文"}]
cbfd55f4-56bd-41a8-83ce-e393386725d0	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	27	WY-0026	{"停车": null, "厕所": null, "名称": "桃源峪卫生间", "备注": null, "地点ID": "WY-0026", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T27=\\"\\",\\"待核验\\",IF(U27<=90,\\"新鲜\\",IF(U27<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T27=\\"\\",\\"\\",TODAY()-T27)"}}, "优先级": "中", "一级分类": "服务", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "桃源峪", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0024", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "卫生间"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
7ca2f064-b59e-4690-82a0-8f770d7854aa	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	28	WY-0027	{"停车": null, "厕所": null, "名称": "桃源峪主要观蝶区域", "备注": null, "地点ID": "WY-0027", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T28=\\"\\",\\"待核验\\",IF(U28<=90,\\"新鲜\\",IF(U28<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T28=\\"\\",\\"\\",TODAY()-T28)"}}, "优先级": "高", "一级分类": "自然观察", "主要风险": null, "公开等级": "P2", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "桃源峪", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0024", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "蝴蝶观察"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
941fe7d2-6731-4530-839c-39abb4ec24af	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	29	WY-0028	{"停车": null, "厕所": null, "名称": "龙渡蝴蝶科普展示馆", "备注": null, "地点ID": "WY-0028", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T29=\\"\\",\\"待核验\\",IF(U29<=90,\\"新鲜\\",IF(U29<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T29=\\"\\",\\"\\",TODAY()-T29)"}}, "优先级": "高", "一级分类": "展馆", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "正常", "所属区域": "红星村附近", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "蝴蝶科普"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
244ff3a0-523f-478f-8ce3-9b7d4ae7415b	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	30	WY-0029	{"停车": null, "厕所": null, "名称": "蝴蝶馆停车/步行入口", "备注": null, "地点ID": "WY-0029", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T30=\\"\\",\\"待核验\\",IF(U30<=90,\\"新鲜\\",IF(U30<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T30=\\"\\",\\"\\",TODAY()-T30)"}}, "优先级": "高", "一级分类": "交通/入口", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村附近", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0028", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "停车/步行入口"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
2d96abac-bcda-45f7-a754-7a34bb6fc723	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	33	WY-0032	{"停车": null, "厕所": null, "名称": "红茶发源地展示馆", "备注": null, "地点ID": "WY-0032", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T33=\\"\\",\\"待核验\\",IF(U33<=90,\\"新鲜\\",IF(U33<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T33=\\"\\",\\"\\",TODAY()-T33)"}}, "优先级": "高", "一级分类": "展馆", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "正常", "所属区域": "桐木区域", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "红茶历史/正山小种"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
eaf7d2f7-0b40-4a73-b920-7c58e6f39f19	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	31	WY-0030	{"停车": null, "厕所": null, "名称": "野猴谷", "备注": null, "地点ID": "WY-0030", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T31=\\"\\",\\"待核验\\",IF(U31<=90,\\"新鲜\\",IF(U31<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T31=\\"\\",\\"\\",TODAY()-T31)"}}, "优先级": "高", "一级分类": "自然观察", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "桐木区域", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "藏酋猴"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}, {"field": "公开等级", "level": "warning", "message": "自然观察 P1 需人工复核生态敏感性；本批无正式坐标，不自动发布"}]
04a7863b-c4b4-4565-853d-b1d446ee65e1	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	32	WY-0031	{"停车": null, "厕所": null, "名称": "野猴观察区域", "备注": null, "地点ID": "WY-0031", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T32=\\"\\",\\"待核验\\",IF(U32<=90,\\"新鲜\\",IF(U32<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T32=\\"\\",\\"\\",TODAY()-T32)"}}, "优先级": "高", "一级分类": "自然观察", "主要风险": null, "公开等级": "P3", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "桐木区域", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0030", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "藏酋猴观察范围"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
4526c26e-4b6a-40f9-acd5-5a9938d254de	e7e14a5f-c5dc-4516-ad66-254b52506316	路线库	2	R-0001	{"备注": "先作为路线集合，不直接承诺一日完成", "状态": "待核实", "终点": "坳头观景台", "起点": "桃源峪", "路线ID": "R-0001", "推荐季节": null, "路线名称": "一号风景道·自然观察候选线", "路线类型": "候选路线", "适合人群": "自然观察/亲子", "雨天可用": "部分", "驾驶时长": null, "步行距离km": null, "预计总时长": null, "最后核验日期": null, "地点序列（地点ID）": "WY-0024→WY-0028→WY-0030→WY-0035→WY-0036"}	success	[{"field": "地点序列（地点ID）", "level": "warning", "message": "只保留来源候选顺序，sequence_confirmed=false，不承诺路线可通行"}]
54e2354e-daf3-4e8e-8105-df1144843991	e7e14a5f-c5dc-4516-ad66-254b52506316	路线库	3	R-0002	{"备注": "后续通过R-0004接入红星村展馆群；跨区域先保留为候选路线，不写死顺序与时长。", "状态": "待核实", "终点": "大峡谷展示馆", "起点": "蝴蝶馆", "路线ID": "R-0002", "推荐季节": null, "路线名称": "一号风景道·展馆候选线", "路线类型": "候选路线", "适合人群": "亲子/雨天", "雨天可用": "是", "驾驶时长": null, "步行距离km": null, "预计总时长": null, "最后核验日期": null, "地点序列（地点ID）": "WY-0028→WY-0032→WY-0033"}	success	[{"field": "地点序列（地点ID）", "level": "warning", "message": "只保留来源候选顺序，sequence_confirmed=false，不承诺路线可通行"}]
fd34d44a-d7ce-403a-b6cc-ca38081cd81d	e7e14a5f-c5dc-4516-ad66-254b52506316	路线库	4	R-0003	{"备注": "必须结合实时/近期水情与降雨判断", "状态": "待核实", "终点": "武夷源", "起点": "漫水桥", "路线ID": "R-0003", "推荐季节": "夏季", "路线名称": "一号风景道·玩水候选线", "路线类型": "候选路线", "适合人群": "亲子/玩水", "雨天可用": "否", "驾驶时长": null, "步行距离km": null, "预计总时长": null, "最后核验日期": null, "地点序列（地点ID）": "WY-0008→WY-0017→WY-0019→WY-0020→WY-0022→WY-0038"}	success	[{"field": "地点序列（地点ID）", "level": "warning", "message": "只保留来源候选顺序，sequence_confirmed=false，不承诺路线可通行"}]
f0223efc-7401-449e-bc80-4004a94c79df	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	34	WY-0033	{"停车": null, "厕所": null, "名称": "大峡谷展示馆", "备注": null, "地点ID": "WY-0033", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T34=\\"\\",\\"待核验\\",IF(U34<=90,\\"新鲜\\",IF(U34<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T34=\\"\\",\\"\\",TODAY()-T34)"}}, "优先级": "高", "一级分类": "展馆", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "正常", "所属区域": "桐木区域", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "自然/地理展示"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
4731cea8-78b0-4836-a08e-6b0acbbd8a1c	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	35	WY-0034	{"停车": null, "厕所": null, "名称": "桐木茶马古道相关入口", "备注": null, "地点ID": "WY-0034", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T35=\\"\\",\\"待核验\\",IF(U35<=90,\\"新鲜\\",IF(U35<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T35=\\"\\",\\"\\",TODAY()-T35)"}}, "优先级": "中", "一级分类": "交通/入口", "主要风险": null, "公开等级": "P3", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "桐木区域", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "历史路线/徒步入口"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
6253aea1-6e28-4dde-8fd9-30cc48153a46	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	36	WY-0035	{"停车": null, "厕所": null, "名称": "大竹岚自然观察区域", "备注": null, "地点ID": "WY-0035", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T36=\\"\\",\\"待核验\\",IF(U36<=90,\\"新鲜\\",IF(U36<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T36=\\"\\",\\"\\",TODAY()-T36)"}}, "优先级": "中", "一级分类": "自然观察", "主要风险": null, "公开等级": "P3", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "大竹岚", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "昆虫/森林观察"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
5ba0604b-c446-4002-909c-9d7bdea13699	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	37	WY-0036	{"停车": null, "厕所": null, "名称": "坳头观景台", "备注": null, "地点ID": "WY-0036", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T37=\\"\\",\\"待核验\\",IF(U37<=90,\\"新鲜\\",IF(U37<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T37=\\"\\",\\"\\",TODAY()-T37)"}}, "优先级": "高", "一级分类": "观景", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "坳头村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "观景/夜景"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
d1a94c5a-ca6a-44ca-8f86-5828fe2f8a03	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	38	WY-0037	{"停车": null, "厕所": null, "名称": "坳头星空观察区域", "备注": null, "地点ID": "WY-0037", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T38=\\"\\",\\"待核验\\",IF(U38<=90,\\"新鲜\\",IF(U38<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T38=\\"\\",\\"\\",TODAY()-T38)"}}, "优先级": "中", "一级分类": "自然观察", "主要风险": null, "公开等级": "P2", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "坳头村", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0036", "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "星空"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
47194ed6-6dc0-42e4-aaeb-faff47afec8f	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	39	WY-0038	{"停车": null, "厕所": null, "名称": "武夷源活动区域", "备注": null, "地点ID": "WY-0038", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T39=\\"\\",\\"待核验\\",IF(U39<=90,\\"新鲜\\",IF(U39<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T39=\\"\\",\\"\\",TODAY()-T39)"}}, "优先级": "中", "一级分类": "玩水", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "武夷源", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": null, "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "皮筏艇/溪流"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
4e31f895-a101-4547-9cc4-ea0021fa50d5	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	40	WY-0039	{"停车": null, "厕所": null, "名称": "红星村", "备注": "各展馆作为子节点展开，步行关系待现场核验。", "地点ID": "WY-0039", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T40=\\"\\",\\"待核验\\",IF(U40<=90,\\"新鲜\\",IF(U40<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T40=\\"\\",\\"\\",TODAY()-T40)"}}, "优先级": "高", "一级分类": "区域/村镇", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": null, "一句话说明": "红星村展馆群的区域父节点；用于缩小地图时聚合展示。", "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "展馆群/村落节点"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
fca83197-ca32-4fd2-98a4-fe6ebe2e1333	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	41	WY-0040	{"停车": null, "厕所": null, "名称": "乌龙茶展示馆", "备注": "已有较完整研究与口播基础，坐标及开放信息待统一核验。", "地点ID": "WY-0040", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T41=\\"\\",\\"待核验\\",IF(U41<=90,\\"新鲜\\",IF(U41<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T41=\\"\\",\\"\\",TODAY()-T41)"}}, "优先级": "高", "一级分类": "展馆", "主要风险": null, "公开等级": "P1", "关联攻略": "G-0006", "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0039", "一句话说明": "红星村茶文化展馆节点。", "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "乌龙茶/茶史/工艺"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
5e9b20f0-bfdc-4e25-ac90-67ad0693e6c7	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	42	WY-0041	{"停车": null, "厕所": null, "名称": "珍稀植物展示馆1号馆", "备注": "已有内容研究基础；坐标、开放时间、步行关系待核验。", "地点ID": "WY-0041", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T42=\\"\\",\\"待核验\\",IF(U42<=90,\\"新鲜\\",IF(U42<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T42=\\"\\",\\"\\",TODAY()-T42)"}}, "优先级": "高", "一级分类": "展馆", "主要风险": null, "公开等级": "P1", "关联攻略": "G-0007", "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0039", "一句话说明": "以武夷山植物、模式标本与科学史为重点的展馆节点。", "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "珍稀植物/模式标本/植物史"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
6a9c1ce3-ad75-4507-80bb-6a4c820eb04e	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	43	WY-0042	{"停车": null, "厕所": null, "名称": "珍稀植物展示馆2号馆", "备注": "先建立地点对象，具体内容结构与1号馆关系后续补充。", "地点ID": "WY-0042", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T43=\\"\\",\\"待核验\\",IF(U43<=90,\\"新鲜\\",IF(U43<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T43=\\"\\",\\"\\",TODAY()-T43)"}}, "优先级": "高", "一级分类": "展馆", "主要风险": null, "公开等级": "P1", "关联攻略": "G-0008", "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0039", "一句话说明": "珍稀植物展示馆群中的第二馆。", "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "珍稀植物/自然科普"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
2053f41a-1abb-4931-9458-cd101cd3b29c	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	44	WY-0043	{"停车": null, "厕所": null, "名称": "兰花展示馆", "备注": "已有完整口播与素材基础，坐标及开放信息待核验。", "地点ID": "WY-0043", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T44=\\"\\",\\"待核验\\",IF(U44<=90,\\"新鲜\\",IF(U44<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T44=\\"\\",\\"\\",TODAY()-T44)"}}, "优先级": "高", "一级分类": "展馆", "主要风险": null, "公开等级": "P1", "关联攻略": "G-0009", "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0039", "一句话说明": "兰花种子萌发、真菌关系与传粉观察的展馆节点。", "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "兰花/真菌共生/传粉"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
6efd8838-8f0f-4bb3-b752-fbf29db88591	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	45	WY-0044	{"停车": null, "厕所": null, "名称": "乡愁馆", "备注": "可关联黎老先生等“山里人的故事”内容。", "地点ID": "WY-0044", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T45=\\"\\",\\"待核验\\",IF(U45<=90,\\"新鲜\\",IF(U45<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T45=\\"\\",\\"\\",TODAY()-T45)"}}, "优先级": "高", "一级分类": "展馆", "主要风险": null, "公开等级": "P1", "关联攻略": "G-0010", "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村", "点位层级": "主地点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0039", "一句话说明": "红星村乡村历史与人物故事节点。", "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "乡村记忆/山里人的故事"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
b4109663-972f-4157-8a39-947e085cca01	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	46	WY-0045	{"停车": null, "厕所": null, "名称": "乡愁馆村咖/休息点", "备注": "如果与乡愁馆完全同址且用户无需单独寻找，可后续降为地点属性而非地图针。", "地点ID": "WY-0045", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T46=\\"\\",\\"待核验\\",IF(U46<=90,\\"新鲜\\",IF(U46<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T46=\\"\\",\\"\\",TODAY()-T46)"}}, "优先级": "低", "一级分类": "服务", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0044", "一句话说明": "作为乡愁馆附属休息与补给点，是否需要独立成点待核验。", "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "村咖/休息/补给"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
16e7ad1d-91a7-47ba-8e5a-eeb1fae7a319	e7e14a5f-c5dc-4516-ad66-254b52506316	地点库	47	WY-0046	{"停车": null, "厕所": null, "名称": "红星村展馆群停车/步行起点", "备注": "需现场确认最佳停车位置以及是否确有统一步行起点；若不存在则拆分。", "地点ID": "WY-0046", "_formulas": {"信息新鲜度": {"result": "待核验", "formula": "IF(T47=\\"\\",\\"待核验\\",IF(U47<=90,\\"新鲜\\",IF(U47<=180,\\"需复核\\",\\"已过期\\")))"}, "距今核验天数": {"formula": "IF(T47=\\"\\",\\"\\",TODAY()-T47)"}}, "优先级": "高", "一级分类": "交通/入口", "主要风险": null, "公开等级": "P1", "关联攻略": null, "关联路线": null, "原始纬度": null, "原始经度": null, "地图纬度": null, "地图经度": null, "坐标来源": null, "当前状态": "待核实", "所属区域": "红星村", "点位层级": "辅助点", "适合带娃": null, "适合老人": null, "雨天适合": null, "上级地点ID": "WY-0039", "一句话说明": "为红星村展馆群建立统一到达与步行起点。", "信息新鲜度": "待核验", "原始坐标系": null, "地图坐标系": null, "坐标可信等级": null, "是否人工核验": null, "最后核验日期": null, "距今核验天数": null, "二级分类/标签": "停车/步行起点"}	success	[{"field": "坐标", "level": "warning", "message": "缺少坐标，地点可导入但不可导航"}, {"field": "最后核验日期", "level": "warning", "message": "无核验日期，不能认定当前信息已实地核验"}]
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.media (id, place_id, media_type, purpose, file_url, local_source_path, shot_at, direction_note, public_status) FROM stdin;
\.


--
-- Data for Name: place_accessibility; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.place_accessibility (place_id, stroller_friendly, baby_carrier_possible, age_2_3_rating, age_4_6_rating, age_7_plus_rating, elderly_friendly, child_friendly_note, stairs_note, slope_note, shade_note, seats_available, fall_risk, water_risk, vehicle_risk) FROM stdin;
82384987-e512-469a-8734-c2b842e213ee	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ebe75bec-1bb5-49c9-88e9-705a6f280e36	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fc815062-4ff8-4b26-ad62-68a2ca8573fe	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b8fabb59-18a6-47e0-9414-5fe137b1e4ef	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7c248101-9941-4387-9a47-946fcea76527	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f20f797d-3e4c-4774-be83-549982f7a858	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
269734f6-dcf9-4086-964a-ae51d7658f05	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a5e4a8aa-a63c-42f4-befb-6eef62214a10	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
67cf1a51-3890-43da-8dc3-43cab796ddd2	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a8ac2c98-1141-4865-a0b7-148d707c6f4a	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
aae13f3d-3606-46b0-b815-1dff6566f57c	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
35858246-5474-41e4-9ac2-d3f32df9638e	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
87a70a78-8008-4afc-b77d-fab9797fb9d5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1a033e05-2eef-42ff-9d35-3bf731731187	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9153acb8-5afd-4ff2-953d-d38a5f373a33	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6b05b4e2-5da4-4d6d-a564-2e424759c2a5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
011a3edf-be6e-4a97-a52c-11f225d26c36	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5b36516f-2e1b-4e79-992b-21cc20024d10	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
90859cda-38cc-484c-8c68-4fbf6d10e1b5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
28231ac4-3f87-401e-8b98-2b30f269f5e7	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a49b5c82-a149-421d-aeae-691af4e97028	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
aa5db0f5-bc3c-4ceb-a3be-87df5751adf4	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f3805426-45b5-4b7f-ae0c-59347b069ec5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3c62d05a-ccda-4f56-8798-2738ed05d899	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b5803673-c280-4a9c-92e2-a1f5265fd5fb	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fefa2ae0-a5b7-4cba-b7da-ea9136b17f05	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d9df8a67-43b4-495c-b3a2-4e01d439e098	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2ba2eb33-930d-43b5-8260-504242816eda	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fb61bba4-449f-4400-aac0-c9e17a38ff25	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4727af6b-b38f-421d-b2eb-f81dc53bd828	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d02d9040-5e9d-4835-b897-7077f72e7ec5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c35b0914-8093-4713-ab71-878f855785ce	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9eee6fbd-5dcd-4e02-b9f5-7351d8f6d1f3	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2348c40c-c1ab-4576-8ae8-47d806ad0937	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7bfda89b-cbad-44b3-87e0-ee008aa93fae	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fb16090c-d84f-4fa8-8a63-e9ddfcf444b8	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8a1c8f52-0260-40a3-8369-39c7991b9140	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d46ecaaa-9bae-4eb0-8abb-82d54edc2991	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3f859fb6-b24a-46ed-bc16-bf4346ad6000	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
865fd38e-5097-4f47-9269-4b6d3b2e1433	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3a717058-62be-42de-bd53-1fc7fb08cab4	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9bfe0058-a9cc-4b7e-a2a5-2ec4308f3715	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
21eed006-9770-438a-8641-b90044786bbd	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
0c194fab-5ed5-49b3-9768-d447d12507e3	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1bea0878-e36d-4228-8423-de1ab1a45191	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2f710781-7f66-4388-bbe8-432a3ef7e12a	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: place_coordinates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.place_coordinates (id, place_id, candidate_id, raw_latitude, raw_longitude, raw_coordinate_system, source_type, source_file, source_time, accuracy_meters, confidence_level, map_latitude, map_longitude, map_coordinate_system, conversion_method, human_confirmed, confirmed_at, confirmed_by, created_at, source_reference, accuracy_note, status, status_changed_at, superseded_by, revoked_at, revoked_by, revocation_reason, position_certainty) FROM stdin;
bed25af3-ba7a-48c0-b99b-96c42ccc0a92	82384987-e512-469a-8734-c2b842e213ee	9b263b85-4288-4cf7-869a-8a0322bdba08	27.61034087193368	117.99222872911434	GCJ-02	map_click	\N	2026-09-09 08:39:08.457+08	\N	C	27.61034087193368	117.99222872911434	GCJ-02	identity:GCJ-02	t	2026-09-09 08:40:24.140661+08	owner	2026-09-09 08:40:24.140661+08	腾讯卫星影像人工判读	未测量；不能据此宣称定位精度	revoked	2026-09-09 08:46:55.353794+08	\N	2026-09-09 08:46:55.353794+08	owner	重新选择	certain
b5880240-2a93-4cd5-afbf-c4ae53b9211a	82384987-e512-469a-8734-c2b842e213ee	e89717d9-ded3-4cbc-a6fd-e85230fc34cf	27.608460789632296	117.99057456870855	GCJ-02	map_click	\N	2026-09-09 08:49:03.013+08	\N	C	27.608460789632296	117.99057456870855	GCJ-02	identity:GCJ-02	t	2026-09-09 08:49:45.886978+08	owner	2026-09-09 08:49:45.886978+08	腾讯标准地图人工判点	未测量；不能据此宣称定位精度	active	2026-09-09 08:49:45.886978+08	\N	\N	\N	\N	certain
44e92acc-7f9f-45c9-b67f-a591a2470b61	ebe75bec-1bb5-49c9-88e9-705a6f280e36	b0ff7de5-899d-4953-82fa-bdd3f2f4e5e4	27.609909249142245	117.99201844498793	GCJ-02	map_click	\N	2026-09-09 08:51:31.144+08	\N	C	27.609909249142245	117.99201844498793	GCJ-02	identity:GCJ-02	t	2026-09-09 08:51:40.881515+08	owner	2026-09-09 08:51:40.881515+08	腾讯标准地图人工判点	未测量；不能据此宣称定位精度	active	2026-09-09 08:51:40.881515+08	\N	\N	\N	\N	certain
1fad3125-739f-4dd8-bbff-cb74b81be6e1	fc815062-4ff8-4b26-ad62-68a2ca8573fe	a2de84b8-0bd2-4f00-9ec3-d0169dbd6e5a	27.61031608497586	117.9921821005239	GCJ-02	map_click	\N	2026-09-09 08:52:05.903+08	\N	C	27.61031608497586	117.9921821005239	GCJ-02	identity:GCJ-02	t	2026-09-09 08:52:18.233149+08	owner	2026-09-09 08:52:18.233149+08	腾讯标准地图人工判点	未测量；不能据此宣称定位精度	active	2026-09-09 08:52:18.233149+08	\N	\N	\N	\N	approximate
2ac37f13-f006-4223-afe5-150c3432ee54	b8fabb59-18a6-47e0-9414-5fe137b1e4ef	51692d10-aaaa-4a61-b98c-385fbd082f61	27.62003604255768	117.92890743753605	GCJ-02	map_click	\N	2026-09-09 09:03:25.964+08	\N	C	27.62003604255768	117.92890743753605	GCJ-02	identity:GCJ-02	t	2026-09-09 09:04:25.583937+08	owner	2026-09-09 09:04:25.583937+08	腾讯卫星影像人工判读	未测量；不能据此宣称定位精度	active	2026-09-09 09:04:25.583937+08	\N	\N	\N	\N	certain
\.


--
-- Data for Name: place_nature; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.place_nature (place_id, primary_observation, secondary_observation, best_season, best_time, weather_note, wind_note, temperature_note, guaranteed_sighting, waiting_required, ecological_sensitivity) FROM stdin;
\.


--
-- Data for Name: place_practical_info; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.place_practical_info (place_id, car_access, road_type, road_width_note, passing_difficulty, four_wheel_drive_required, walking_required, walking_distance_m, walking_duration_min, parking_available, parking_type, parking_capacity_note, parking_fee_note, toilet_available, toilet_distance_m, food_available, water_available, mobile_signal_note, charging_available) FROM stdin;
82384987-e512-469a-8734-c2b842e213ee	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
ebe75bec-1bb5-49c9-88e9-705a6f280e36	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fc815062-4ff8-4b26-ad62-68a2ca8573fe	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b8fabb59-18a6-47e0-9414-5fe137b1e4ef	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7c248101-9941-4387-9a47-946fcea76527	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f20f797d-3e4c-4774-be83-549982f7a858	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
269734f6-dcf9-4086-964a-ae51d7658f05	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a5e4a8aa-a63c-42f4-befb-6eef62214a10	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
67cf1a51-3890-43da-8dc3-43cab796ddd2	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a8ac2c98-1141-4865-a0b7-148d707c6f4a	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
aae13f3d-3606-46b0-b815-1dff6566f57c	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
35858246-5474-41e4-9ac2-d3f32df9638e	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
87a70a78-8008-4afc-b77d-fab9797fb9d5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1a033e05-2eef-42ff-9d35-3bf731731187	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9153acb8-5afd-4ff2-953d-d38a5f373a33	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
6b05b4e2-5da4-4d6d-a564-2e424759c2a5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
011a3edf-be6e-4a97-a52c-11f225d26c36	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
5b36516f-2e1b-4e79-992b-21cc20024d10	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
90859cda-38cc-484c-8c68-4fbf6d10e1b5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
28231ac4-3f87-401e-8b98-2b30f269f5e7	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
a49b5c82-a149-421d-aeae-691af4e97028	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
aa5db0f5-bc3c-4ceb-a3be-87df5751adf4	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f3805426-45b5-4b7f-ae0c-59347b069ec5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3c62d05a-ccda-4f56-8798-2738ed05d899	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
b5803673-c280-4a9c-92e2-a1f5265fd5fb	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fefa2ae0-a5b7-4cba-b7da-ea9136b17f05	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d9df8a67-43b4-495c-b3a2-4e01d439e098	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2ba2eb33-930d-43b5-8260-504242816eda	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fb61bba4-449f-4400-aac0-c9e17a38ff25	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
4727af6b-b38f-421d-b2eb-f81dc53bd828	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d02d9040-5e9d-4835-b897-7077f72e7ec5	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
c35b0914-8093-4713-ab71-878f855785ce	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9eee6fbd-5dcd-4e02-b9f5-7351d8f6d1f3	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2348c40c-c1ab-4576-8ae8-47d806ad0937	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7bfda89b-cbad-44b3-87e0-ee008aa93fae	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
fb16090c-d84f-4fa8-8a63-e9ddfcf444b8	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
8a1c8f52-0260-40a3-8369-39c7991b9140	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d46ecaaa-9bae-4eb0-8abb-82d54edc2991	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3f859fb6-b24a-46ed-bc16-bf4346ad6000	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
865fd38e-5097-4f47-9269-4b6d3b2e1433	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
3a717058-62be-42de-bd53-1fc7fb08cab4	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
9bfe0058-a9cc-4b7e-a2a5-2ec4308f3715	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
21eed006-9770-438a-8641-b90044786bbd	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
0c194fab-5ed5-49b3-9768-d447d12507e3	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1bea0878-e36d-4228-8423-de1ab1a45191	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2f710781-7f66-4388-bbe8-432a3ef7e12a	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: place_water; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.place_water (place_id, water_type, normal_depth_note, riverbed_type, slippery_risk, current_risk, rainfall_risk, upstream_rainfall_risk, child_water_entry_note, life_jacket_note, last_water_check_at) FROM stdin;
\.


--
-- Data for Name: places; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.places (id, code, name, short_name, place_type, parent_place_id, category_id, tags, region, main_line, intro, current_status, public_level, priority, risk_note, rain_friendly, notes, source_last_verified_at, source_import_row_id, created_at, updated_at) FROM stdin;
82384987-e512-469a-8734-c2b842e213ee	WY-0001	南源岭	\N	主地点	\N	9063ead7-19a2-48fb-810a-a1826b8ba7df	{一号风景道起点,区域}	南源岭	\N	\N	待核实	P1	高	\N	\N	\N	\N	d9d324b6-9790-4a77-a6e5-1665794cba14	2026-09-05 12:35:22.005219+08	2026-09-05 12:35:22.005219+08
ebe75bec-1bb5-49c9-88e9-705a6f280e36	WY-0002	南源岭停车位置	\N	辅助点	82384987-e512-469a-8734-c2b842e213ee	238ecc5a-0e8d-4479-8750-e8c14d0b6e2e	{停车}	南源岭	\N	\N	待核实	P1	高	\N	\N	\N	\N	457e2e6f-42da-42e0-a3bc-da4afb992c4c	2026-09-05 12:35:22.013733+08	2026-09-05 12:35:22.013733+08
fc815062-4ff8-4b26-ad62-68a2ca8573fe	WY-0003	南源岭卫生间	\N	辅助点	82384987-e512-469a-8734-c2b842e213ee	862c0fc7-b943-4b78-8afe-edbaf8b5e692	{卫生间}	南源岭	\N	\N	待核实	P1	中	\N	\N	\N	\N	92407514-5176-4878-815a-7129344b4bcf	2026-09-05 12:35:22.017459+08	2026-09-05 12:35:22.017459+08
b8fabb59-18a6-47e0-9414-5fe137b1e4ef	WY-0004	齐云峰观景/日出位置	\N	主地点	\N	8a63fcaa-9706-400c-8376-63f044eda137	{日出,观景}	南源岭	\N	\N	待核实	P2	高	\N	\N	\N	\N	ac7fe21e-cc81-404f-86be-63f0c02a15f7	2026-09-05 12:35:22.020211+08	2026-09-05 12:35:22.020211+08
7c248101-9941-4387-9a47-946fcea76527	WY-0005	三才峰观景信息点	\N	主地点	\N	8a63fcaa-9706-400c-8376-63f044eda137	{观景}	南源岭	\N	\N	待核实	P3	低	\N	\N	\N	\N	a173dfb2-0a0a-418e-bdec-4878c4c2f48f	2026-09-05 12:35:22.024237+08	2026-09-05 12:35:22.024237+08
f20f797d-3e4c-4774-be83-549982f7a858	WY-0006	星村补给区	\N	主地点	\N	862c0fc7-b943-4b78-8afe-edbaf8b5e692	{补给,餐饮}	星村	\N	\N	待核实	P1	中	\N	\N	\N	\N	e829a5be-b9e4-47ab-857e-35c7d1c26f59	2026-09-05 12:35:22.027416+08	2026-09-05 12:35:22.027416+08
269734f6-dcf9-4086-964a-ae51d7658f05	WY-0007	星村特色小吃集中区	\N	主地点	f20f797d-3e4c-4774-be83-549982f7a858	862c0fc7-b943-4b78-8afe-edbaf8b5e692	{光饼,越南粉,油饼}	星村	\N	\N	待核实	P1	中	\N	\N	\N	\N	56b3f6a9-dc14-4bf9-a20b-5338bfcf25a9	2026-09-05 12:35:22.030684+08	2026-09-05 12:35:22.030684+08
a5e4a8aa-a63c-42f4-befb-6eef62214a10	WY-0008	漫水桥	\N	主地点	\N	4eaf428f-fe40-4160-82b9-29d14bb2958f	{桥,浅水石滩}	星村—黄村沿线	\N	\N	待核实	P1	高	\N	\N	\N	\N	78fe27f7-023b-4269-8214-2aed24bf9662	2026-09-05 12:35:22.033756+08	2026-09-05 12:35:22.033756+08
67cf1a51-3890-43da-8dc3-43cab796ddd2	WY-0009	漫水桥下河位置	\N	辅助点	a5e4a8aa-a63c-42f4-befb-6eef62214a10	4eaf428f-fe40-4160-82b9-29d14bb2958f	{下河入口}	星村—黄村沿线	\N	\N	待核实	P2	高	\N	\N	\N	\N	d5676428-5eb2-44e4-b3bd-92e6194fda53	2026-09-05 12:35:22.035257+08	2026-09-05 12:35:22.035257+08
a8ac2c98-1141-4865-a0b7-148d707c6f4a	WY-0010	黄村	\N	主地点	\N	9063ead7-19a2-48fb-810a-a1826b8ba7df	{村落,沿线节点}	黄村	\N	\N	待核实	P1	中	\N	\N	\N	\N	a283b9b7-dcd3-4177-b261-77bf1aa5f04e	2026-09-05 12:35:22.037949+08	2026-09-05 12:35:22.037949+08
aae13f3d-3606-46b0-b815-1dff6566f57c	WY-0011	黄村沿线停靠/观察位置	\N	辅助点	a8ac2c98-1141-4865-a0b7-148d707c6f4a	8a63fcaa-9706-400c-8376-63f044eda137	{沿线观察}	黄村	\N	\N	待核实	P3	低	\N	\N	\N	\N	5815cc94-93fb-43e6-bb79-c22609aa9794	2026-09-05 12:35:22.039764+08	2026-09-05 12:35:22.039764+08
35858246-5474-41e4-9ac2-d3f32df9638e	WY-0012	月亮湾	\N	主地点	\N	8a63fcaa-9706-400c-8376-63f044eda137	{人工大坝,观景}	月亮湾	\N	\N	正常	P1	高	\N	\N	\N	\N	ddef78b1-3748-4df2-9f3d-573f1d80a78b	2026-09-05 12:35:22.042297+08	2026-09-05 12:35:22.042297+08
87a70a78-8008-4afc-b77d-fab9797fb9d5	WY-0013	月亮湾停车位置	\N	辅助点	35858246-5474-41e4-9ac2-d3f32df9638e	238ecc5a-0e8d-4479-8750-e8c14d0b6e2e	{停车}	月亮湾	\N	\N	待核实	P1	高	\N	\N	\N	\N	be905002-ee13-409a-b530-feefcff78e92	2026-09-05 12:35:22.044943+08	2026-09-05 12:35:22.044943+08
1a033e05-2eef-42ff-9d35-3bf731731187	WY-0014	月亮湾大坝观察位置	\N	辅助点	35858246-5474-41e4-9ac2-d3f32df9638e	8a63fcaa-9706-400c-8376-63f044eda137	{大坝观察}	月亮湾	\N	\N	待核实	P1	中	\N	\N	\N	\N	86729187-4a89-45eb-a9cf-463b8b11ad95	2026-09-05 12:35:22.048612+08	2026-09-05 12:35:22.048612+08
9153acb8-5afd-4ff2-953d-d38a5f373a33	WY-0015	翡翠谷支线路口	\N	辅助点	\N	1e61e475-61e2-4bc7-8699-caf02a30e731	{支线路口}	翡翠谷支线	\N	\N	待核实	P1	高	\N	\N	\N	\N	03b8438a-f998-4227-af48-f4056195442f	2026-09-05 12:35:22.050961+08	2026-09-05 12:35:22.050961+08
6b05b4e2-5da4-4d6d-a564-2e424759c2a5	WY-0016	翡翠谷支线	\N	主地点	\N	bda6b30e-49a3-47df-aaf8-d621bf45a632	{当前封闭支线}	翡翠谷支线	\N	\N	临时关闭	P4	高	\N	\N	\N	\N	b9dd4058-50e4-4db2-b619-938a37a935a2	2026-09-05 12:35:22.052504+08	2026-09-05 12:35:22.052504+08
011a3edf-be6e-4a97-a52c-11f225d26c36	WY-0017	观山听水	\N	主地点	\N	4eaf428f-fe40-4160-82b9-29d14bb2958f	{沿线玩水}	黄村—红星沿线	\N	\N	待核实	P1	高	\N	\N	\N	\N	ae7b17c5-717f-4533-957d-db897ebd12a6	2026-09-05 12:35:22.05425+08	2026-09-05 12:35:22.05425+08
5b36516f-2e1b-4e79-992b-21cc20024d10	WY-0018	大峡谷农庄下河位置	\N	辅助点	011a3edf-be6e-4a97-a52c-11f225d26c36	4eaf428f-fe40-4160-82b9-29d14bb2958f	{下河入口}	黄村—红星沿线	\N	\N	待核实	P2	高	\N	\N	\N	\N	9cb50b1a-e93f-4922-b7df-38935624995c	2026-09-05 12:35:22.055667+08	2026-09-05 12:35:22.055667+08
90859cda-38cc-484c-8c68-4fbf6d10e1b5	WY-0019	皮坑浅滩	\N	主地点	\N	4eaf428f-fe40-4160-82b9-29d14bb2958f	{浅滩}	皮坑	\N	\N	待核实	P2	高	\N	\N	\N	\N	42197b06-d1b3-4b16-9874-5a617a1e7683	2026-09-05 12:35:22.0576+08	2026-09-05 12:35:22.0576+08
28231ac4-3f87-401e-8b98-2b30f269f5e7	WY-0020	皮坑口	\N	主地点	\N	4eaf428f-fe40-4160-82b9-29d14bb2958f	{浅滩,入口}	皮坑	\N	\N	待核实	P1	高	\N	\N	\N	\N	fb665bb1-bf12-4d7f-8d44-309e72c821fc	2026-09-05 12:35:22.060443+08	2026-09-05 12:35:22.060443+08
a49b5c82-a149-421d-aeae-691af4e97028	WY-0021	皮坑口下水位置	\N	辅助点	28231ac4-3f87-401e-8b98-2b30f269f5e7	4eaf428f-fe40-4160-82b9-29d14bb2958f	{下水入口}	皮坑	\N	\N	待核实	P2	高	\N	\N	\N	\N	ee2f75e7-473c-4300-a8e7-7a60e27ae8f4	2026-09-05 12:35:22.063572+08	2026-09-05 12:35:22.063572+08
aa5db0f5-bc3c-4ceb-a3be-87df5751adf4	WY-0022	大浅滩	\N	主地点	\N	4eaf428f-fe40-4160-82b9-29d14bb2958f	{浅滩,餐饮附近}	一号风景道沿线	\N	\N	待核实	P2	高	\N	\N	\N	\N	32620b55-41bd-4bb6-87af-893670c906fe	2026-09-05 12:35:22.065877+08	2026-09-05 12:35:22.065877+08
f3805426-45b5-4b7f-ae0c-59347b069ec5	WY-0023	大浅滩停车位置	\N	辅助点	aa5db0f5-bc3c-4ceb-a3be-87df5751adf4	238ecc5a-0e8d-4479-8750-e8c14d0b6e2e	{停车}	一号风景道沿线	\N	\N	待核实	P1	中	\N	\N	\N	\N	483f3a8c-dba0-4809-9e6b-b1a1bc134e5d	2026-09-05 12:35:22.067262+08	2026-09-05 12:35:22.067262+08
3c62d05a-ccda-4f56-8798-2738ed05d899	WY-0024	桃源峪	\N	主地点	\N	7ff1a6ee-c86d-4c27-a7cf-d73c6dc44db0	{蝴蝶,溪谷}	桃源峪	\N	\N	正常	P1	高	\N	\N	\N	\N	9a284fb0-8a8d-4f81-96de-f956c0c2ad2d	2026-09-05 12:35:22.069596+08	2026-09-05 12:35:22.069596+08
b5803673-c280-4a9c-92e2-a1f5265fd5fb	WY-0025	桃源峪停车位置	\N	辅助点	3c62d05a-ccda-4f56-8798-2738ed05d899	238ecc5a-0e8d-4479-8750-e8c14d0b6e2e	{停车}	桃源峪	\N	\N	待核实	P1	高	\N	\N	\N	\N	af15f1a1-452b-4381-a678-d9bf8b1c4597	2026-09-05 12:35:22.070885+08	2026-09-05 12:35:22.070885+08
fefa2ae0-a5b7-4cba-b7da-ea9136b17f05	WY-0026	桃源峪卫生间	\N	辅助点	3c62d05a-ccda-4f56-8798-2738ed05d899	862c0fc7-b943-4b78-8afe-edbaf8b5e692	{卫生间}	桃源峪	\N	\N	待核实	P1	中	\N	\N	\N	\N	cbfd55f4-56bd-41a8-83ce-e393386725d0	2026-09-05 12:35:22.072377+08	2026-09-05 12:35:22.072377+08
d9df8a67-43b4-495c-b3a2-4e01d439e098	WY-0027	桃源峪主要观蝶区域	\N	辅助点	3c62d05a-ccda-4f56-8798-2738ed05d899	7ff1a6ee-c86d-4c27-a7cf-d73c6dc44db0	{蝴蝶观察}	桃源峪	\N	\N	待核实	P2	高	\N	\N	\N	\N	7ca2f064-b59e-4690-82a0-8f770d7854aa	2026-09-05 12:35:22.074276+08	2026-09-05 12:35:22.074276+08
2ba2eb33-930d-43b5-8260-504242816eda	WY-0028	龙渡蝴蝶科普展示馆	\N	主地点	\N	94d86b5a-aa78-4f30-8494-b3a81fa2b52f	{蝴蝶科普}	红星村附近	\N	\N	正常	P1	高	\N	\N	\N	\N	941fe7d2-6731-4530-839c-39abb4ec24af	2026-09-05 12:35:22.078758+08	2026-09-05 12:35:22.078758+08
fb61bba4-449f-4400-aac0-c9e17a38ff25	WY-0029	蝴蝶馆停车/步行入口	\N	辅助点	2ba2eb33-930d-43b5-8260-504242816eda	1e61e475-61e2-4bc7-8699-caf02a30e731	{停车,步行入口}	红星村附近	\N	\N	待核实	P1	高	\N	\N	\N	\N	244ff3a0-523f-478f-8ce3-9b7d4ae7415b	2026-09-05 12:35:22.080817+08	2026-09-05 12:35:22.080817+08
4727af6b-b38f-421d-b2eb-f81dc53bd828	WY-0030	野猴谷	\N	主地点	\N	7ff1a6ee-c86d-4c27-a7cf-d73c6dc44db0	{藏酋猴}	桐木区域	\N	\N	待核实	P1	高	\N	\N	\N	\N	eaf7d2f7-0b40-4a73-b920-7c58e6f39f19	2026-09-05 12:35:22.083558+08	2026-09-05 12:35:22.083558+08
d02d9040-5e9d-4835-b897-7077f72e7ec5	WY-0031	野猴观察区域	\N	辅助点	4727af6b-b38f-421d-b2eb-f81dc53bd828	7ff1a6ee-c86d-4c27-a7cf-d73c6dc44db0	{藏酋猴观察范围}	桐木区域	\N	\N	待核实	P3	高	\N	\N	\N	\N	04a7863b-c4b4-4565-853d-b1d446ee65e1	2026-09-05 12:35:22.085096+08	2026-09-05 12:35:22.085096+08
c35b0914-8093-4713-ab71-878f855785ce	WY-0032	红茶发源地展示馆	\N	主地点	\N	94d86b5a-aa78-4f30-8494-b3a81fa2b52f	{红茶历史,正山小种}	桐木区域	\N	\N	正常	P1	高	\N	\N	\N	\N	2d96abac-bcda-45f7-a754-7a34bb6fc723	2026-09-05 12:35:22.087036+08	2026-09-05 12:35:22.087036+08
9eee6fbd-5dcd-4e02-b9f5-7351d8f6d1f3	WY-0033	大峡谷展示馆	\N	主地点	\N	94d86b5a-aa78-4f30-8494-b3a81fa2b52f	{自然,地理展示}	桐木区域	\N	\N	正常	P1	高	\N	\N	\N	\N	f0223efc-7401-449e-bc80-4004a94c79df	2026-09-05 12:35:22.088559+08	2026-09-05 12:35:22.088559+08
2348c40c-c1ab-4576-8ae8-47d806ad0937	WY-0034	桐木茶马古道相关入口	\N	主地点	\N	1e61e475-61e2-4bc7-8699-caf02a30e731	{历史路线,徒步入口}	桐木区域	\N	\N	待核实	P3	中	\N	\N	\N	\N	4731cea8-78b0-4836-a08e-6b0acbbd8a1c	2026-09-05 12:35:22.090388+08	2026-09-05 12:35:22.090388+08
7bfda89b-cbad-44b3-87e0-ee008aa93fae	WY-0035	大竹岚自然观察区域	\N	主地点	\N	7ff1a6ee-c86d-4c27-a7cf-d73c6dc44db0	{昆虫,森林观察}	大竹岚	\N	\N	待核实	P3	中	\N	\N	\N	\N	6253aea1-6e28-4dde-8fd9-30cc48153a46	2026-09-05 12:35:22.093591+08	2026-09-05 12:35:22.093591+08
fb16090c-d84f-4fa8-8a63-e9ddfcf444b8	WY-0036	坳头观景台	\N	主地点	\N	8a63fcaa-9706-400c-8376-63f044eda137	{观景,夜景}	坳头村	\N	\N	待核实	P1	高	\N	\N	\N	\N	5ba0604b-c446-4002-909c-9d7bdea13699	2026-09-05 12:35:22.096081+08	2026-09-05 12:35:22.096081+08
8a1c8f52-0260-40a3-8369-39c7991b9140	WY-0037	坳头星空观察区域	\N	辅助点	fb16090c-d84f-4fa8-8a63-e9ddfcf444b8	7ff1a6ee-c86d-4c27-a7cf-d73c6dc44db0	{星空}	坳头村	\N	\N	待核实	P2	中	\N	\N	\N	\N	d1a94c5a-ca6a-44ca-8f86-5828fe2f8a03	2026-09-05 12:35:22.098434+08	2026-09-05 12:35:22.098434+08
d46ecaaa-9bae-4eb0-8abb-82d54edc2991	WY-0038	武夷源活动区域	\N	主地点	\N	4eaf428f-fe40-4160-82b9-29d14bb2958f	{皮筏艇,溪流}	武夷源	\N	\N	待核实	P1	中	\N	\N	\N	\N	47194ed6-6dc0-42e4-aaeb-faff47afec8f	2026-09-05 12:35:22.10065+08	2026-09-05 12:35:22.10065+08
3f859fb6-b24a-46ed-bc16-bf4346ad6000	WY-0039	红星村	\N	主地点	\N	9063ead7-19a2-48fb-810a-a1826b8ba7df	{展馆群,村落节点}	红星村	\N	红星村展馆群的区域父节点；用于缩小地图时聚合展示。	待核实	P1	高	\N	\N	各展馆作为子节点展开，步行关系待现场核验。	\N	4e31f895-a101-4547-9cc4-ea0021fa50d5	2026-09-05 12:35:22.102148+08	2026-09-05 12:35:22.102148+08
865fd38e-5097-4f47-9269-4b6d3b2e1433	WY-0040	乌龙茶展示馆	\N	主地点	3f859fb6-b24a-46ed-bc16-bf4346ad6000	94d86b5a-aa78-4f30-8494-b3a81fa2b52f	{乌龙茶,茶史,工艺}	红星村	\N	红星村茶文化展馆节点。	待核实	P1	高	\N	\N	已有较完整研究与口播基础，坐标及开放信息待统一核验。	\N	fca83197-ca32-4fd2-98a4-fe6ebe2e1333	2026-09-05 12:35:22.10523+08	2026-09-05 12:35:22.10523+08
3a717058-62be-42de-bd53-1fc7fb08cab4	WY-0041	珍稀植物展示馆1号馆	\N	主地点	3f859fb6-b24a-46ed-bc16-bf4346ad6000	94d86b5a-aa78-4f30-8494-b3a81fa2b52f	{珍稀植物,模式标本,植物史}	红星村	\N	以武夷山植物、模式标本与科学史为重点的展馆节点。	待核实	P1	高	\N	\N	已有内容研究基础；坐标、开放时间、步行关系待核验。	\N	5e9b20f0-bfdc-4e25-ac90-67ad0693e6c7	2026-09-05 12:35:22.109605+08	2026-09-05 12:35:22.109605+08
9bfe0058-a9cc-4b7e-a2a5-2ec4308f3715	WY-0042	珍稀植物展示馆2号馆	\N	主地点	3f859fb6-b24a-46ed-bc16-bf4346ad6000	94d86b5a-aa78-4f30-8494-b3a81fa2b52f	{珍稀植物,自然科普}	红星村	\N	珍稀植物展示馆群中的第二馆。	待核实	P1	高	\N	\N	先建立地点对象，具体内容结构与1号馆关系后续补充。	\N	6a9c1ce3-ad75-4507-80bb-6a4c820eb04e	2026-09-05 12:35:22.113106+08	2026-09-05 12:35:22.113106+08
21eed006-9770-438a-8641-b90044786bbd	WY-0043	兰花展示馆	\N	主地点	3f859fb6-b24a-46ed-bc16-bf4346ad6000	94d86b5a-aa78-4f30-8494-b3a81fa2b52f	{兰花,真菌共生,传粉}	红星村	\N	兰花种子萌发、真菌关系与传粉观察的展馆节点。	待核实	P1	高	\N	\N	已有完整口播与素材基础，坐标及开放信息待核验。	\N	2053f41a-1abb-4931-9458-cd101cd3b29c	2026-09-05 12:35:22.115077+08	2026-09-05 12:35:22.115077+08
0c194fab-5ed5-49b3-9768-d447d12507e3	WY-0044	乡愁馆	\N	主地点	3f859fb6-b24a-46ed-bc16-bf4346ad6000	94d86b5a-aa78-4f30-8494-b3a81fa2b52f	{乡村记忆,山里人的故事}	红星村	\N	红星村乡村历史与人物故事节点。	待核实	P1	高	\N	\N	可关联黎老先生等“山里人的故事”内容。	\N	6efd8838-8f0f-4bb3-b752-fbf29db88591	2026-09-05 12:35:22.11702+08	2026-09-05 12:35:22.11702+08
1bea0878-e36d-4228-8423-de1ab1a45191	WY-0045	乡愁馆村咖/休息点	\N	辅助点	0c194fab-5ed5-49b3-9768-d447d12507e3	862c0fc7-b943-4b78-8afe-edbaf8b5e692	{村咖,休息,补给}	红星村	\N	作为乡愁馆附属休息与补给点，是否需要独立成点待核验。	待核实	P1	低	\N	\N	如果与乡愁馆完全同址且用户无需单独寻找，可后续降为地点属性而非地图针。	\N	b4109663-972f-4157-8a39-947e085cca01	2026-09-05 12:35:22.118815+08	2026-09-05 12:35:22.118815+08
2f710781-7f66-4388-bbe8-432a3ef7e12a	WY-0046	红星村展馆群停车/步行起点	\N	辅助点	3f859fb6-b24a-46ed-bc16-bf4346ad6000	1e61e475-61e2-4bc7-8699-caf02a30e731	{停车,步行起点}	红星村	\N	为红星村展馆群建立统一到达与步行起点。	待核实	P1	高	\N	\N	需现场确认最佳停车位置以及是否确有统一步行起点；若不存在则拆分。	\N	16e7ad1d-91a7-47ba-8e5a-eeb1fae7a319	2026-09-05 12:35:22.120594+08	2026-09-05 12:35:22.120594+08
\.


--
-- Data for Name: route_place_links; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.route_place_links (route_id, place_id, source_import_row_id) FROM stdin;
\.


--
-- Data for Name: route_stops; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.route_stops (route_id, place_id, sequence, suggested_duration_min, required_or_optional, alternative_group, condition_note) FROM stdin;
3446d8ee-6b56-47fb-9809-31a7aba512f8	3c62d05a-ccda-4f56-8798-2738ed05d899	1	\N	\N	\N	\N
3446d8ee-6b56-47fb-9809-31a7aba512f8	2ba2eb33-930d-43b5-8260-504242816eda	2	\N	\N	\N	\N
3446d8ee-6b56-47fb-9809-31a7aba512f8	4727af6b-b38f-421d-b2eb-f81dc53bd828	3	\N	\N	\N	\N
3446d8ee-6b56-47fb-9809-31a7aba512f8	7bfda89b-cbad-44b3-87e0-ee008aa93fae	4	\N	\N	\N	\N
3446d8ee-6b56-47fb-9809-31a7aba512f8	fb16090c-d84f-4fa8-8a63-e9ddfcf444b8	5	\N	\N	\N	\N
7ab9dc45-10ee-425f-971b-b49da6e4faf4	2ba2eb33-930d-43b5-8260-504242816eda	1	\N	\N	\N	\N
7ab9dc45-10ee-425f-971b-b49da6e4faf4	c35b0914-8093-4713-ab71-878f855785ce	2	\N	\N	\N	\N
7ab9dc45-10ee-425f-971b-b49da6e4faf4	9eee6fbd-5dcd-4e02-b9f5-7351d8f6d1f3	3	\N	\N	\N	\N
2145100b-d390-4503-be43-4f75d7989279	a5e4a8aa-a63c-42f4-befb-6eef62214a10	1	\N	\N	\N	\N
2145100b-d390-4503-be43-4f75d7989279	011a3edf-be6e-4a97-a52c-11f225d26c36	2	\N	\N	\N	\N
2145100b-d390-4503-be43-4f75d7989279	90859cda-38cc-484c-8c68-4fbf6d10e1b5	3	\N	\N	\N	\N
2145100b-d390-4503-be43-4f75d7989279	28231ac4-3f87-401e-8b98-2b30f269f5e7	4	\N	\N	\N	\N
2145100b-d390-4503-be43-4f75d7989279	aa5db0f5-bc3c-4ceb-a3be-87df5751adf4	5	\N	\N	\N	\N
2145100b-d390-4503-be43-4f75d7989279	d46ecaaa-9bae-4eb0-8abb-82d54edc2991	6	\N	\N	\N	\N
\.


--
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.routes (id, code, name, route_type, intro, total_duration_min, estimated_driving_min, estimated_walking_m, suitable_age_note, season_note, rain_friendly, elderly_friendly, publish_status, source_status, start_note, end_note, source_last_verified_at, sequence_confirmed, source_import_row_id, created_at, updated_at) FROM stdin;
3446d8ee-6b56-47fb-9809-31a7aba512f8	R-0001	一号风景道·自然观察候选线	候选路线	先作为路线集合，不直接承诺一日完成	\N	\N	\N	自然观察/亲子	\N	部分	\N	草稿	待核实	桃源峪	坳头观景台	\N	f	4526c26e-4b6a-40f9-acd5-5a9938d254de	2026-09-05 12:35:22.122495+08	2026-09-05 12:35:22.122495+08
7ab9dc45-10ee-425f-971b-b49da6e4faf4	R-0002	一号风景道·展馆候选线	候选路线	后续通过R-0004接入红星村展馆群；跨区域先保留为候选路线，不写死顺序与时长。	\N	\N	\N	亲子/雨天	\N	是	\N	草稿	待核实	蝴蝶馆	大峡谷展示馆	\N	f	54e2354e-daf3-4e8e-8105-df1144843991	2026-09-05 12:35:22.130379+08	2026-09-05 12:35:22.130379+08
2145100b-d390-4503-be43-4f75d7989279	R-0003	一号风景道·玩水候选线	候选路线	必须结合实时/近期水情与降雨判断	\N	\N	\N	亲子/玩水	夏季	否	\N	草稿	待核实	漫水桥	武夷源	\N	f	fd34d44a-d7ce-403a-b6cc-ca38081cd81d	2026-09-05 12:35:22.133292+08	2026-09-05 12:35:22.133292+08
fa65d9b0-b182-4d37-9897-b5d19756f17e	R-0004	红星村·展馆步行候选线	候选路线	节点集合包括WY-0040～WY-0044；暂不写死参观顺序，先现场核验各馆坐标、开放情况与真实步行关系。	\N	\N	\N	亲子/雨天/文化自然	\N	是	\N	草稿	待核实	红星村	红星村	\N	f	e5ca2dff-d91a-4250-a5fb-fa61c00a4ce2	2026-09-05 12:35:22.136177+08	2026-09-05 12:35:22.136177+08
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schema_migrations (name, sha256, applied_at) FROM stdin;
001_initial.sql	38664af2cdae9ea9bdf4492b375295249448bbf0f0a7d2b57c2b1ad6d0fd8b33	2026-09-05 12:32:34.008208+08
002_integrity.sql	0bdbc01b4da33dbebb869c0fdce1011e563325f1b52df71ff5e83f9b6d7db8a8	2026-09-05 12:39:50.338692+08
003_coordinate_history.sql	37781205ffe468f335b14fe40d896789146e332fe24b20993b0156476586010d	2026-09-05 13:57:53.486468+08
004_coordinate_audit_integrity.sql	d6d3ac1e8ded3cb9c00544e67443e4f5015b6291d1849528f3d438fac2af1355	2026-09-05 18:24:13.713566+08
005_position_certainty.sql	84b691d3a0e7556e138e499269738904484acf1e7bad48d921274e937d851e69	2026-09-08 22:10:16.295432+08
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: taxonomy_terms; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.taxonomy_terms (id, dimension, code, name, description, enabled, source_import_row_id) FROM stdin;
034dea68-b94c-4756-8e24-1cc78c648d86	点位层级	MAIN	主地点	用户会独立寻找或理解的主要地点	t	d879bbfb-7eef-4ece-b672-a09aae0996cb
e6c5adb4-5a1c-4a6a-8cc2-db41cd1e7c8e	点位层级	AUX	辅助点	停车、厕所、入口、下河口等附属位置	t	cb6b23d9-ec7b-413c-96cf-209754cb5a14
9063ead7-19a2-48fb-810a-a1826b8ba7df	一级分类	AREA	区域/村镇	区域或村镇级地点	t	98996a7f-1d3e-40d7-aaea-6c1c3c794307
7ff1a6ee-c86d-4c27-a7cf-d73c6dc44db0	一级分类	NATURE	自然观察	蝴蝶、猴类、昆虫、星空等	t	d302c08b-44b1-4374-8708-4740ff429b93
4eaf428f-fe40-4160-82b9-29d14bb2958f	一级分类	WATER	玩水	溪流、浅滩、下河点	t	07644085-a3b5-43c1-abf5-7b3a15bfed13
8a63fcaa-9706-400c-8376-63f044eda137	一级分类	VIEW	观景	观景、日出、星空等	t	3ca56810-8caf-4db8-96d7-889510ff770a
94d86b5a-aa78-4f30-8494-b3a81fa2b52f	一级分类	MUSEUM	展馆	科普、历史、茶文化等展馆	t	a8f2c1e4-cec7-4729-8318-59f7f1f63bfd
862c0fc7-b943-4b78-8afe-edbaf8b5e692	一级分类	SERVICE	服务	厕所、补给、餐饮等	t	372f53df-ec55-4da1-9792-2b768048fa63
238ecc5a-0e8d-4479-8750-e8c14d0b6e2e	一级分类	PARKING	停车	停车位置或停车场	t	90dcebc1-c33e-4cfe-8621-4565f9057178
1e61e475-61e2-4bc7-8699-caf02a30e731	一级分类	TRAFFIC	交通/入口	岔路口、步行入口、道路节点	t	bf4d5fe7-0957-43e1-86c2-ddbfa406bc86
bda6b30e-49a3-47df-aaf8-d621bf45a632	一级分类	RISK	风险/状态	封闭、施工、风险提示等	t	d779ace4-ed44-49a7-be99-0748b74bf826
5791ea6e-6f10-4149-b771-375e5441d638	公开等级	P1	精确公开	显示精确位置，可用于导航	t	25b73472-7714-4c34-8996-611988700f88
fdbc3c33-a47d-4dfb-865c-74747cfa22cb	公开等级	P2	附近公开	显示附近区域，不强调精确落点	t	fd1104ce-6143-418a-b215-1329e4d7d156
34fc752a-1bf7-44ac-a552-04c51e2bb4f1	公开等级	P3	区域公开	只显示区域级位置	t	1fcaffa2-91fc-48a0-8ac1-7c105e2e244c
7b7efbce-0e9e-484c-bfd9-e2133d62a68c	公开等级	P4	不公开坐标	攻略可公开，但不展示坐标	t	a5ad465b-c913-4b29-963f-e42ffadde4c3
337415e2-37c8-43ee-abe5-a504d8bbc94d	公开等级	P5	完全私有	仅后台可见	t	5ea41ecd-1126-4f62-9a0c-0a18dc9b7c70
77082bc1-e1f6-45cb-ab24-57cd53f244ac	坐标可信	A	A级	实地准确位置采集并人工核验	t	60fbbd01-c7dc-4220-96cc-8b7e193eefcb
983ec234-c4e7-41d7-b9cf-46b0ea13f6c1	坐标可信	B	B级	GPS/无人机轨迹等较可靠来源	t	8fcdc913-924f-4d58-a362-a928dd99dee8
e2213c80-fa8b-488d-9e6a-d5f031d5372c	坐标可信	C	C级	地图或卫星图人工判断	t	8133ddc2-98ae-4315-a48a-950350553d43
78b75df8-ee58-4733-ba6b-bf82a139c545	坐标可信	D	D级	仅大致区域	t	99045797-cb65-4365-b802-009729a2d3fb
5f92ee8d-18dd-45bf-bd68-d928f8560589	当前状态	OPEN	正常	正常可访问/可使用	t	f3bfe7a5-3740-4f05-9cab-8b8c3c5ca6db
0e6fbfbc-20b9-41da-8a0b-5d36de7f2b94	当前状态	CLOSED	临时关闭	临时关闭或封闭	t	533ff753-9d24-454b-8fbb-044ecab3177d
812d4eeb-edec-4ff2-9f92-85060a61d182	当前状态	SEASONAL	季节关闭	按季节关闭	t	da3fc0c8-50e5-4712-8afc-c1cdf6ee26ef
7e35788b-2b0b-4f4e-bc64-bc40a2df57b0	当前状态	CONSTRUCTION	施工	施工影响访问	t	25c9d094-f9de-485a-9917-2a78c5ea185f
50fb190d-0119-4246-9a90-7fdac555af93	当前状态	ROADBLOCK	道路中断	道路无法正常通行	t	32b77756-3d55-45fe-9ea4-b2e953cbf33f
729fd96a-0011-42a7-b154-00b69e7f7c9f	当前状态	AVOID	不建议前往	当前不建议前往	t	fa24d70e-2026-46cf-8971-ad6ccada9df8
c446fe70-aa9e-4efe-8928-45af8f4aba91	当前状态	VERIFY	待核实	信息尚未完成现场核实	t	f796e952-bc5e-4c7a-bd8e-ee3ae303abad
85026b9d-ea2c-4ab6-b369-95a57791e1ba	任务状态	TODO	待处理	尚未处理	t	b4499378-7d33-4850-9236-864f9c878584
5d2e93b7-9bbf-45e9-ab0d-1e3291898336	任务状态	DOING	进行中	正在核验或补录	t	38487aeb-28fb-44bf-a762-3a0b69a5d676
25e5cbf5-f86d-424d-ba00-447763a16921	任务状态	DONE	已完成	已经完成	t	713154a1-46c2-41d1-af29-e50e70cfd0fe
8a64a785-fdc3-4757-80d6-ab8f9e54ffe8	任务优先级	H	高	第一批必须补齐	t	0cb2ec5e-5e9a-4ff1-9c01-138dcea02e2c
a5eb6bb5-76ee-4ee4-8552-b4a85e391b75	任务优先级	M	中	第二批补齐	t	70f16f67-3b60-40b2-b854-7c0968ff6460
1fc6c036-7934-4432-b90a-4b82d839c7b3	任务优先级	L	低	后续完善	t	48675990-f1d1-440b-9d72-ca54ad86bb6f
\.


--
-- Data for Name: verification_media; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verification_media (verification_id, media_id) FROM stdin;
\.


--
-- Data for Name: verifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.verifications (id, code, place_id, verified_at, road_status, parking_status, toilet_status, open_status, weather, water_condition, observation_note, general_note, verifier, source_photo_note, source_import_row_id, created_at) FROM stdin;
\.


--
-- Name: coordinate_candidates coordinate_candidates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinate_candidates
    ADD CONSTRAINT coordinate_candidates_code_key UNIQUE (code);


--
-- Name: coordinate_candidates coordinate_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinate_candidates
    ADD CONSTRAINT coordinate_candidates_pkey PRIMARY KEY (id);


--
-- Name: guide_places guide_places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_places
    ADD CONSTRAINT guide_places_pkey PRIMARY KEY (guide_id, place_id);


--
-- Name: guide_routes guide_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_routes
    ADD CONSTRAINT guide_routes_pkey PRIMARY KEY (guide_id, route_id);


--
-- Name: guides guides_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_code_key UNIQUE (code);


--
-- Name: guides guides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_pkey PRIMARY KEY (id);


--
-- Name: import_jobs import_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_jobs
    ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);


--
-- Name: import_rows import_rows_job_id_sheet_row_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_rows
    ADD CONSTRAINT import_rows_job_id_sheet_row_number_key UNIQUE (job_id, sheet, row_number);


--
-- Name: import_rows import_rows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_rows
    ADD CONSTRAINT import_rows_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: place_accessibility place_accessibility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_accessibility
    ADD CONSTRAINT place_accessibility_pkey PRIMARY KEY (place_id);


--
-- Name: place_coordinates place_coordinates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_coordinates
    ADD CONSTRAINT place_coordinates_pkey PRIMARY KEY (id);


--
-- Name: place_nature place_nature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_nature
    ADD CONSTRAINT place_nature_pkey PRIMARY KEY (place_id);


--
-- Name: place_practical_info place_practical_info_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_practical_info
    ADD CONSTRAINT place_practical_info_pkey PRIMARY KEY (place_id);


--
-- Name: place_water place_water_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_water
    ADD CONSTRAINT place_water_pkey PRIMARY KEY (place_id);


--
-- Name: places places_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_code_key UNIQUE (code);


--
-- Name: places places_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_pkey PRIMARY KEY (id);


--
-- Name: route_place_links route_place_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_place_links
    ADD CONSTRAINT route_place_links_pkey PRIMARY KEY (route_id, place_id);


--
-- Name: route_stops route_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_pkey PRIMARY KEY (route_id, sequence);


--
-- Name: routes routes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_code_key UNIQUE (code);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (name);


--
-- Name: taxonomy_terms taxonomy_terms_dimension_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taxonomy_terms
    ADD CONSTRAINT taxonomy_terms_dimension_code_key UNIQUE (dimension, code);


--
-- Name: taxonomy_terms taxonomy_terms_dimension_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taxonomy_terms
    ADD CONSTRAINT taxonomy_terms_dimension_name_key UNIQUE (dimension, name);


--
-- Name: taxonomy_terms taxonomy_terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taxonomy_terms
    ADD CONSTRAINT taxonomy_terms_pkey PRIMARY KEY (id);


--
-- Name: verification_media verification_media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_media
    ADD CONSTRAINT verification_media_pkey PRIMARY KEY (verification_id, media_id);


--
-- Name: verifications verifications_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_code_key UNIQUE (code);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: candidate_place_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidate_place_status_idx ON public.coordinate_candidates USING btree (matched_place_id, status);


--
-- Name: candidates_place_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX candidates_place_idx ON public.coordinate_candidates USING btree (matched_place_id);


--
-- Name: coordinates_place_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinates_place_idx ON public.place_coordinates USING btree (place_id);


--
-- Name: coordinates_spatial_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX coordinates_spatial_idx ON public.place_coordinates USING gist (raw_wgs84);


--
-- Name: one_active_coordinate_per_place; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_active_coordinate_per_place ON public.place_coordinates USING btree (place_id) WHERE (status = 'active'::public.coordinate_record_status);


--
-- Name: one_formal_per_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_formal_per_candidate ON public.place_coordinates USING btree (candidate_id);


--
-- Name: places_filters_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_filters_idx ON public.places USING btree (region, category_id, current_status, public_level);


--
-- Name: places_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_parent_idx ON public.places USING btree (parent_place_id);


--
-- Name: places_tags_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX places_tags_idx ON public.places USING gin (tags);


--
-- Name: route_stops_place_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX route_stops_place_idx ON public.route_stops USING btree (place_id);


--
-- Name: verifications_place_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX verifications_place_time_idx ON public.verifications USING btree (place_id, verified_at DESC);


--
-- Name: coordinate_candidates candidate_confirmation_atomic; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER candidate_confirmation_atomic AFTER UPDATE ON public.coordinate_candidates DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.confirmed_candidate_has_formal();


--
-- Name: coordinate_candidates candidate_history_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER candidate_history_guard BEFORE INSERT OR DELETE OR UPDATE ON public.coordinate_candidates FOR EACH ROW EXECUTE FUNCTION public.guard_candidate_history();


--
-- Name: place_coordinates formal_coordinate_certainty_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER formal_coordinate_certainty_guard BEFORE INSERT ON public.place_coordinates FOR EACH ROW EXECUTE FUNCTION public.guard_coordinate_certainty();


--
-- Name: place_coordinates formal_coordinate_history_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER formal_coordinate_history_guard BEFORE INSERT OR DELETE OR UPDATE ON public.place_coordinates FOR EACH ROW EXECUTE FUNCTION public.guard_formal_coordinate();


--
-- Name: coordinate_candidates stable_candidate_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stable_candidate_code BEFORE UPDATE ON public.coordinate_candidates FOR EACH ROW EXECUTE FUNCTION public.keep_business_code();


--
-- Name: guides stable_guide_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stable_guide_code BEFORE UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION public.keep_business_code();


--
-- Name: places stable_place_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stable_place_code BEFORE UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION public.keep_business_code();


--
-- Name: routes stable_route_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stable_route_code BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.keep_business_code();


--
-- Name: verifications stable_verification_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER stable_verification_code BEFORE UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.keep_business_code();


--
-- Name: places validate_place_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_place_trigger BEFORE INSERT OR UPDATE ON public.places FOR EACH ROW EXECUTE FUNCTION public.validate_place();


--
-- Name: verifications verification_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER verification_history BEFORE DELETE OR UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.preserve_verifications();


--
-- Name: coordinate_candidates coordinate_candidates_matched_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinate_candidates
    ADD CONSTRAINT coordinate_candidates_matched_place_id_fkey FOREIGN KEY (matched_place_id) REFERENCES public.places(id);


--
-- Name: coordinate_candidates coordinate_candidates_source_import_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coordinate_candidates
    ADD CONSTRAINT coordinate_candidates_source_import_row_id_fkey FOREIGN KEY (source_import_row_id) REFERENCES public.import_rows(id);


--
-- Name: guide_places guide_places_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_places
    ADD CONSTRAINT guide_places_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id);


--
-- Name: guide_places guide_places_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_places
    ADD CONSTRAINT guide_places_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: guide_routes guide_routes_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_routes
    ADD CONSTRAINT guide_routes_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id);


--
-- Name: guide_routes guide_routes_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_routes
    ADD CONSTRAINT guide_routes_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: guides guides_source_import_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_source_import_row_id_fkey FOREIGN KEY (source_import_row_id) REFERENCES public.import_rows(id);


--
-- Name: import_rows import_rows_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.import_rows
    ADD CONSTRAINT import_rows_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.import_jobs(id);


--
-- Name: media media_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: place_accessibility place_accessibility_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_accessibility
    ADD CONSTRAINT place_accessibility_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: place_coordinates place_coordinates_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_coordinates
    ADD CONSTRAINT place_coordinates_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.coordinate_candidates(id);


--
-- Name: place_coordinates place_coordinates_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_coordinates
    ADD CONSTRAINT place_coordinates_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: place_coordinates place_coordinates_superseded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_coordinates
    ADD CONSTRAINT place_coordinates_superseded_by_fkey FOREIGN KEY (superseded_by) REFERENCES public.place_coordinates(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: place_nature place_nature_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_nature
    ADD CONSTRAINT place_nature_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: place_practical_info place_practical_info_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_practical_info
    ADD CONSTRAINT place_practical_info_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: place_water place_water_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.place_water
    ADD CONSTRAINT place_water_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: places places_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.taxonomy_terms(id);


--
-- Name: places places_parent_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_parent_place_id_fkey FOREIGN KEY (parent_place_id) REFERENCES public.places(id);


--
-- Name: places places_source_import_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.places
    ADD CONSTRAINT places_source_import_row_id_fkey FOREIGN KEY (source_import_row_id) REFERENCES public.import_rows(id);


--
-- Name: route_place_links route_place_links_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_place_links
    ADD CONSTRAINT route_place_links_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: route_place_links route_place_links_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_place_links
    ADD CONSTRAINT route_place_links_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: route_place_links route_place_links_source_import_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_place_links
    ADD CONSTRAINT route_place_links_source_import_row_id_fkey FOREIGN KEY (source_import_row_id) REFERENCES public.import_rows(id);


--
-- Name: route_stops route_stops_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: route_stops route_stops_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: routes routes_source_import_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_source_import_row_id_fkey FOREIGN KEY (source_import_row_id) REFERENCES public.import_rows(id);


--
-- Name: taxonomy_terms taxonomy_terms_source_import_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.taxonomy_terms
    ADD CONSTRAINT taxonomy_terms_source_import_row_id_fkey FOREIGN KEY (source_import_row_id) REFERENCES public.import_rows(id);


--
-- Name: verification_media verification_media_media_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_media
    ADD CONSTRAINT verification_media_media_id_fkey FOREIGN KEY (media_id) REFERENCES public.media(id);


--
-- Name: verification_media verification_media_verification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_media
    ADD CONSTRAINT verification_media_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES public.verifications(id);


--
-- Name: verifications verifications_place_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_place_id_fkey FOREIGN KEY (place_id) REFERENCES public.places(id);


--
-- Name: verifications verifications_source_import_row_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_source_import_row_id_fkey FOREIGN KEY (source_import_row_id) REFERENCES public.import_rows(id);


--
-- PostgreSQL database dump complete
--

\unrestrict t0h53m4YOIdYV7GmWmkg9O2LQpTA6NxUQ8hiP649N1xn4X0lam2pH3ChCzjjNM0

