import type { Pool } from 'pg';
export async function checkDatabase(db:Pool) {
 const checks:Record<string,unknown[]>={};
 const queries:Record<string,string>={
  '回收站状态完整':`SELECT code FROM places WHERE (deleted_at IS NULL)<>(deleted_by IS NULL) OR (deleted_at IS NULL)<>(deletion_reason IS NULL)`,
  '回收站审计完整':`SELECT h.id FROM place_recycle_history h LEFT JOIN places p ON p.id=h.place_id WHERE p.id IS NULL OR NOT isfinite(h.occurred_at) OR trim(h.action_source)=''`,
  '回收站不公开':`SELECT p.code FROM places p JOIN public_places v USING(code) WHERE p.deleted_at IS NOT NULL`,
  '名称历史完整':`SELECT h.id FROM place_name_history h LEFT JOIN places p ON p.id=h.place_id WHERE p.id IS NULL OR h.old_name=h.new_name OR NOT isfinite(h.changed_at) OR trim(h.change_source)=''`,
  '路线显示顺序唯一且有效':`SELECT corridor_order FROM places WHERE corridor_order IS NOT NULL GROUP BY corridor_order HAVING count(*)>1 OR corridor_order<=0`,
  '显示与主支线角色合法':`SELECT code FROM places WHERE map_display_role NOT IN ('pin','group','hidden') OR corridor_role NOT IN ('main','branch','unassigned')`,
  '重复档案引用完整':`SELECT p.code FROM places p LEFT JOIN places c ON c.id=p.duplicate_of_place_id WHERE p.duplicate_of_place_id IS NOT NULL AND (c.id IS NULL OR c.id=p.id OR c.duplicate_of_place_id IS NOT NULL OR p.corridor_order IS NOT NULL)`,
  '在建不作为公开导航':`SELECT code FROM public_places WHERE current_status='在建' AND (latitude IS NOT NULL OR longitude IS NOT NULL)`,
  '业务编号唯一性':`SELECT code FROM places GROUP BY code HAVING count(*)>1`,
  '父地点存在':`SELECT p.code FROM places p LEFT JOIN places parent ON parent.id=p.parent_place_id WHERE p.parent_place_id IS NOT NULL AND parent.id IS NULL`,
  '父子循环':`WITH RECURSIVE tree AS (SELECT id,parent_place_id,ARRAY[id] path,false cycle FROM places UNION ALL SELECT p.id,p.parent_place_id,t.path||p.id,p.id=ANY(t.path) FROM places p JOIN tree t ON p.id=t.parent_place_id WHERE NOT t.cycle) SELECT DISTINCT id FROM tree WHERE cycle`,
  '路线引用完整':`SELECT r.route_id FROM route_stops r LEFT JOIN places p ON p.id=r.place_id LEFT JOIN routes t ON t.id=r.route_id WHERE p.id IS NULL OR t.id IS NULL`,
  '攻略引用完整':`SELECT gp.guide_id FROM guide_places gp LEFT JOIN guides g ON g.id=gp.guide_id LEFT JOIN places p ON p.id=gp.place_id WHERE g.id IS NULL OR p.id IS NULL`,
  'P2至P5精确坐标隔离':`SELECT code FROM public_places WHERE public_level IN ('P2','P3','P4','P5') AND (latitude IS NOT NULL OR longitude IS NOT NULL)`,
  'P5私有':`SELECT code FROM public_places WHERE public_level='P5'`,
  '未经确认坐标隔离':`SELECT v.code FROM public_places v JOIN places p USING(code) WHERE v.latitude IS NOT NULL AND NOT EXISTS(SELECT 1 FROM place_coordinates c WHERE c.place_id=p.id AND c.status='active' AND c.human_confirmed AND c.map_latitude=v.latitude AND c.map_longitude=v.longitude)`,
  '每地点唯一有效坐标':`SELECT place_id FROM place_coordinates WHERE status='active' GROUP BY place_id HAVING count(*)>1`,
  '正式坐标候选链完整':`SELECT p.id FROM place_coordinates p LEFT JOIN coordinate_candidates c ON c.id=p.candidate_id WHERE p.status='active' AND (c.id IS NULL OR c.status<>'confirmed' OR NOT c.human_confirmed OR c.matched_place_id<>p.place_id)`,
  '候选已确认必有历史':`SELECT c.id FROM coordinate_candidates c WHERE c.status='confirmed' AND NOT EXISTS(SELECT 1 FROM place_coordinates p WHERE p.candidate_id=c.id)`,
  '历史坐标不公开':`SELECT v.code FROM public_places v JOIN places p USING(code) WHERE v.latitude IS NOT NULL AND NOT EXISTS(SELECT 1 FROM confirmed_place_coordinates c WHERE c.place_id=p.id AND c.map_latitude=v.latitude AND c.map_longitude=v.longitude)`,
  '关闭或待核实不导航':`SELECT code FROM public_places WHERE current_status<>'正常' AND latitude IS NOT NULL`,
  '确认审计完整':`SELECT id FROM place_coordinates WHERE human_confirmed AND (confirmed_at IS NULL OR confirmed_by IS NULL OR trim(confirmed_by)='' OR map_latitude IS NULL OR map_coordinate_system IS DISTINCT FROM 'GCJ-02')`,
  '时间字段有效':`SELECT code FROM verifications WHERE NOT isfinite(verified_at) UNION ALL SELECT code FROM places WHERE NOT isfinite(created_at) OR NOT isfinite(updated_at) OR (source_last_verified_at IS NOT NULL AND NOT isfinite(source_last_verified_at))`,
  '坐标时间字段有效':`SELECT id FROM coordinate_candidates WHERE NOT isfinite(created_at) OR NOT isfinite(source_time) OR NOT isfinite(confirmed_at) OR NOT isfinite(reviewed_at) UNION ALL SELECT id FROM place_coordinates WHERE NOT isfinite(created_at) OR NOT isfinite(source_time) OR NOT isfinite(confirmed_at) OR NOT isfinite(status_changed_at) OR NOT isfinite(revoked_at)`,
  '枚举合法':`SELECT code FROM places WHERE place_type::text NOT IN ('主地点','辅助点','服务点','风险点') OR current_status::text NOT IN ('正常','临时关闭','季节关闭','在建','施工','道路中断','不建议前往','永久关闭','待核实') OR public_level::text NOT IN ('P1','P2','P3','P4','P5') OR priority::text NOT IN ('高','中','低')`,
  '分类维度合法':`SELECT p.code FROM places p JOIN taxonomy_terms t ON t.id=p.category_id WHERE t.dimension<>'一级分类'`
 };
 for(const [name,sql] of Object.entries(queries))checks[name]=(await db.query(sql)).rows;
 const counts:Record<string,number>={};
 for(const table of ['taxonomy_terms','places','place_coordinates','coordinate_candidates','verifications','routes','route_stops','guides','guide_places','guide_routes','media'])counts[table]=Number((await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
 return {checkedAt:new Date().toISOString(),passed:Object.values(checks).every(v=>v.length===0),counts,checks};
}
