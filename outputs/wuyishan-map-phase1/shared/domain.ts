export const enums = {
  place_type: ['主地点','辅助点','服务点','风险点'],
  current_status: ['正常','临时关闭','季节关闭','在建','施工','道路中断','不建议前往','永久关闭','待核实'],
  public_level: ['P1','P2','P3','P4','P5'], priority: ['高','中','低'],
  coordinate_system: ['WGS84','GCJ-02','BD-09','未知'], source_type: ['手机','DJI','GPS','地图点选','手工导入'],
  confidence_level: ['A','B','C','D'], match_confidence: ['高','中','低'],
  route_type: ['候选路线','自驾','步行','混合'], publish_status: ['草稿','已发布','已归档'],
  guide_type: ['实测攻略','展馆攻略','自然观察攻略','路线/专题','人物/展馆攻略'],
  guide_workflow: ['已有内容/待入库','研究中','待建立','草稿','已发布','已归档'],
  yes_partial: ['是','否','部分','未知'], writeback_status: ['待匹配','待确认','可写回','已写回','已拒绝','仅轨迹参考']
} as const;
export type Row = Record<string, unknown>;
export function publicPlace(p: Row, coordinate: Row | null) {
  if (p.public_level === 'P5' || p.duplicate_of_place_id || p.deleted_at) return null;
  // Explicit allowlist: no free text, parent, child, source, media or relationships may leak positions.
  const exact = p.public_level === 'P1' && p.current_status === '正常' && coordinate?.human_confirmed === true && coordinate.status === 'active'
    && coordinate.map_coordinate_system === 'GCJ-02' && coordinate.map_latitude != null && coordinate.map_longitude != null;
  return { code: p.code, name: p.name, public_level: p.public_level, current_status: p.current_status,
    region: ['P1','P2','P3'].includes(String(p.public_level)) ? p.region : null,
    navigation: exact ? { latitude: Number(coordinate!.map_latitude), longitude: Number(coordinate!.map_longitude), coordinate_system: 'GCJ-02' } : null };
}
export function freshness(date: string | null, now = Date.now()) {
  if (!date) return '待核验';
  const days = Math.floor((now - Date.parse(date)) / 86400000);
  return days <= 90 ? '新鲜' : days <= 180 ? '建议复核' : '已过期';
}
