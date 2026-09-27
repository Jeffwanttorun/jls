-- Backfill only the six evidenced renames from the approved corridor data batch.
-- Evidence: reports/phase2/corridor/applied.json and after.json (transaction timestamp).
-- This inserts audit rows only, never updates a place or invents an earlier name.
INSERT INTO place_name_history(place_id,old_name,new_name,changed_at,change_source)
SELECT p.id,v.old_name,v.new_name,'2026-09-09T02:26:44.433Z'::timestamptz,'documented_corridor_v1_batch'
FROM (VALUES
 ('WY-0005','三才峰观景信息点','三才峰观景点'),
 ('WY-0009','漫水桥下河位置','漫水桥河滩'),
 ('WY-0015','翡翠谷支线路口','翡翠谷路口'),
 ('WY-0021','皮坑口下水位置','皮坑口玩水点'),
 ('WY-0040','乌龙茶展示馆','黄村乌龙茶展示馆'),
 ('WY-0041','珍稀植物展示馆1号馆','珍稀植物科普展示馆')
) AS v(code,old_name,new_name) JOIN places p ON p.code=v.code AND p.name=v.new_name
WHERE NOT EXISTS(SELECT 1 FROM place_name_history h WHERE h.place_id=p.id AND h.old_name=v.old_name AND h.new_name=v.new_name);
