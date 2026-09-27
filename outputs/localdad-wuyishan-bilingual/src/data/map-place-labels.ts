export interface PublicMapLabelMetadata {
  shortName: string;
  labelPriority: 20 | 40 | 60 | 80 | 100;
  category: string;
}

export const publicMapLabelMetadata: Record<string, PublicMapLabelMetadata> = {
  "WY-0001": { shortName:"南源岭", labelPriority:100, category:"路线核心节点" },
  "WY-0002": { shortName:"南源岭停车", labelPriority:20, category:"停车" },
  "WY-0003": { shortName:"南源岭卫生间", labelPriority:20, category:"公共服务" },
  "WY-0004": { shortName:"齐云峰", labelPriority:80, category:"观景点" },
  "WY-0005": { shortName:"三才峰", labelPriority:80, category:"观景点" },
  "WY-0047": { shortName:"三才峰卫生间", labelPriority:20, category:"公共服务" },
  "WY-0048": { shortName:"俞妹光饼", labelPriority:40, category:"餐饮补给" },
  "WY-0049": { shortName:"越南粉", labelPriority:40, category:"餐饮补给" },
  "WY-0050": { shortName:"旧码头河边", labelPriority:40, category:"沿线停留点" },
  "WY-0051": { shortName:"漫水桥停车1", labelPriority:20, category:"停车" },
  "WY-0052": { shortName:"漫水桥停车2", labelPriority:20, category:"停车" },
  "WY-0053": { shortName:"漫水桥卫生间", labelPriority:20, category:"公共服务" },
  "WY-0009": { shortName:"漫水桥", labelPriority:100, category:"路线核心节点" },
  "WY-0055": { shortName:"茶诗乐营地", labelPriority:60, category:"营地" },
  "WY-0056": { shortName:"风吟茶海", labelPriority:80, category:"茶园与风景" },
  "WY-0057": { shortName:"茶海停车", labelPriority:20, category:"停车" },
  "WY-0040": { shortName:"乌龙茶馆", labelPriority:80, category:"茶文化展馆" },
  "WY-0058": { shortName:"武夷源支线1", labelPriority:40, category:"支线路口" },
  "WY-0059": { shortName:"武夷源支线2", labelPriority:40, category:"支线路口" },
  "WY-0041": { shortName:"植物馆", labelPriority:80, category:"自然科普展馆" },
  "WY-0044": { shortName:"乡愁馆", labelPriority:60, category:"人文展馆" },
  "WY-0043": { shortName:"兰花馆", labelPriority:60, category:"自然科普展馆" },
  "WY-0012": { shortName:"月亮湾", labelPriority:100, category:"路线核心节点" },
  "WY-0013": { shortName:"月亮湾停车", labelPriority:20, category:"停车" },
  "WY-0015": { shortName:"翡翠谷路口", labelPriority:40, category:"支线路口" },
  "WY-0017": { shortName:"观山听水", labelPriority:60, category:"沿线风景" },
  "WY-0018": { shortName:"农庄下河点", labelPriority:60, category:"玩水地点" },
  "WY-0060": { shortName:"小青龙瀑布", labelPriority:80, category:"瀑布" },
  "WY-0021": { shortName:"皮坑口", labelPriority:60, category:"玩水地点" },
  "WY-0022": { shortName:"大浅滩", labelPriority:60, category:"玩水地点" },
  "WY-0024": { shortName:"桃源峪", labelPriority:100, category:"路线核心节点" },
  "WY-0025": { shortName:"桃源峪停车", labelPriority:20, category:"停车" },
  "WY-0026": { shortName:"桃源峪卫生间", labelPriority:20, category:"公共服务" },
  "WY-0028": { shortName:"蝴蝶馆", labelPriority:80, category:"自然科普展馆" },
  "WY-0030": { shortName:"野猴谷", labelPriority:100, category:"路线核心节点" },
  "WY-0031": { shortName:"野猴观察区", labelPriority:80, category:"自然观察点" },
  "WY-0032": { shortName:"红茶馆", labelPriority:100, category:"茶文化展馆" },
  "WY-0033": { shortName:"大峡谷馆", labelPriority:100, category:"路线核心节点" },
  "WY-0035": { shortName:"大竹岚", labelPriority:100, category:"路线核心节点" },
  "WY-0036": { shortName:"坳头", labelPriority:100, category:"路线核心节点" },
  "WY-0061": { shortName:"昆虫馆", labelPriority:60, category:"自然科普展馆" },
};

export function publicMapLabelFor(code:string, name:string):PublicMapLabelMetadata {
  return publicMapLabelMetadata[code] ?? { shortName:name, labelPriority:40, category:"沿线地点" };
}
