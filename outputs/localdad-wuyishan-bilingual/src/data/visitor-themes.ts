import runtime from "./visitor-runtime.json";

export type VisitorThemeId = "water" | "scenery" | "nature" | "museum" | "food" | "camping";

export interface VisitorTheme {
  id: VisitorThemeId;
  name: string;
  icon: string;
  tone: string;
  description: string;
  nameEn: string;
  descriptionEn: string;
  heroImage?: string;
}

export interface VisitorThemePlace {
  code: string;
  name: string;
  region: string;
  summary: string;
  summaryByTheme?: Partial<Record<VisitorThemeId,string>>;
  themes: VisitorThemeId[];
  familyFriendly: boolean;
  facilities?: {
    toilet?: boolean;
    shop?: boolean;
    restaurant?: boolean;
    lodging?: boolean;
  };
  status: string;
  image?: string;
}

const media = (fileName: string) => `/visitor-media/${fileName}`;

const fallbackThemes: VisitorTheme[] = [
  { id:"water", name:"玩水", nameEn:"Waterside", icon:"水", tone:"water", description:"先看当天水况，再选择适合停留的河边、浅滩或瀑布。", descriptionEn:"Check current water conditions before choosing a riverbank, shallow stretch, or waterfall stop.", heroImage:media("31295183a29702ec970c672dee1feffc664b9625550c2442333f0721b475ba64.jpg") },
  { id:"scenery", name:"风景", nameEn:"Scenery", icon:"景", tone:"scenery", description:"沿一号风景道看山、看水、看茶园，挑适合自己的停留点。", descriptionEn:"Find mountain, river, and tea-field views along No. 1 Scenic Road." },
  { id:"nature", name:"自然", nameEn:"Nature", icon:"叶", tone:"nature", description:"从溪流、林缘和展馆认识植物、昆虫与山林环境。", descriptionEn:"Explore streams, forest edges, plants, insects, and nature exhibitions." },
  { id:"museum", name:"茶与展馆", nameEn:"Tea and Exhibitions", icon:"馆", tone:"museum", description:"从茶园、制茶工艺到植物、昆虫与村落展馆，按兴趣慢慢认识武夷山。", descriptionEn:"Explore tea landscapes, craft traditions, natural history, and local exhibitions.", heroImage:media("0534d210b18efbea96f7c7ff6e118d896b77b7ccb1de032038399d312f3e9e12.jpg") },
  { id:"food", name:"吃的", nameEn:"Food", icon:"食", tone:"food", description:"整理沿路吃饭、补给和歇脚的位置，方便按行程就近选择。", descriptionEn:"Find places for meals, simple supplies, and a break along the road.", heroImage:media("d32b5f40e69875a1849502246e0416f3f0f53b07038bf3d6f1d77280ae2fbcf5.jpg") },
  { id:"camping", name:"床车过夜", nameEn:"Sleeping in Your Vehicle", icon:"营", tone:"camping", description:"记录可能与床车停靠、过夜和休息有关的位置；过夜许可与现场条件需在出发前确认。", descriptionEn:"Places for an overnight stay in a vehicle. Check current rules and conditions before going." },
];

const englishThemeCopy=Object.fromEntries(fallbackThemes.map((theme)=>[theme.id,{nameEn:theme.nameEn,descriptionEn:theme.descriptionEn}])) as Record<VisitorThemeId,{nameEn:string;descriptionEn:string}>;

const fallbackPlaces: VisitorThemePlace[] = [
  {code:"WY-0009",name:"漫水桥",region:"星村—黄村沿线",summary:"到桥边和河滩看看当天水况。",themes:["water"],familyFriendly:true,status:"正常",image:media("387343b51318c91cf763ede965391009c4851c896e851a5fbc2ab50eb77772e9.jpg")},
  {code:"WY-0017",name:"观山听水",region:"黄村—红星沿线",summary:"沿路看水、听水，也看沿途山谷。",themes:["water","scenery"],familyFriendly:false,status:"正常",image:media("550f7ca29d57a07eaa877dedcc6177697152dee29fbb5ef984130bd6c9da88ed.jpg")},
  {code:"WY-0018",name:"大峡谷农庄下河位置",region:"黄村—红星沿线",summary:"农庄附近的下河位置。",themes:["water"],familyFriendly:false,status:"正常",image:media("935f8d636515cce0efce1d123559a538f0d1ed90c3ff71a84a3f61b1925cb943.jpg")},
  {code:"WY-0060",name:"小青龙瀑布",region:"一号风景道沿线",summary:"沿路瀑布与溪谷体验。",themes:["water"],familyFriendly:false,status:"正常",image:media("cd9e84ef89dfa178a07ddca48b3cb205e834e8525d178c0bedaaf083b383316a.jpg")},
  {code:"WY-0021",name:"皮坑口玩水点",region:"皮坑",summary:"皮坑口的玩水位置。",themes:["water"],familyFriendly:true,status:"正常",image:media("fbbe17a731f7130cdefedc6cd44e56edb01593c7650fa1cd6acf8d6364ba2895.jpg")},
  {code:"WY-0022",name:"大浅滩",region:"一号风景道沿线",summary:"空间开阔的浅滩体验。",themes:["water"],familyFriendly:true,status:"正常",image:media("1fbc6a6f0c4fe178777e247bba3c64f4070a003bf5d15f344f5b3e7ff6e55c7d.jpg")},
  {code:"WY-0004",name:"齐云峰观景/日出位置",region:"南源岭",summary:"齐云峰方向的观景与日出位置。",themes:["scenery"],familyFriendly:false,status:"正常",image:media("155c12b2deaae0180ad7dc89e2394cdabb5d9448f1f5169cafdd37b4c2548760.jpg")},
  {code:"WY-0005",name:"三才峰观景点",region:"南源岭",summary:"从三才峰方向看沿线山景。",themes:["scenery"],familyFriendly:false,status:"正常",image:media("de9c0e23771bc914cf899e7bd040761ceaa57451aab2362bacfca96a97eed488.jpg")},
  {code:"WY-0012",name:"月亮湾",region:"月亮湾",summary:"河湾与山景交叠的沿路停留，适合观察但禁止下水。",themes:["scenery","nature"],familyFriendly:true,status:"正常",image:media("a37def6b7959f3d521f56a9a5c14217f125571a1b949538c68f33bca81a97f1f.jpg")},
  {code:"WY-0056",name:"风吟茶海",region:"黄村",summary:"茶海也是一段开阔风景。",themes:["scenery","museum"],familyFriendly:false,status:"正常",image:media("65ab132a70a947f4ae5a32a0784810898f10fa43307f94d10d58bc44cbacbd59.jpg")},
  {code:"WY-0035",name:"大竹岚自然观察区域",region:"大竹岚",summary:"大竹岚方向的山林景观与自然观察区域。",themes:["scenery","nature"],familyFriendly:false,status:"正常",image:media("8bce769adf62f8a1de1d9ee1302feb05acdffe3bc2f7510b1163f1e482cd46aa.jpg")},
  {code:"WY-0036",name:"坳头观景台",region:"坳头村",summary:"到坳头方向看山谷与远景。",themes:["scenery"],familyFriendly:false,status:"正常",image:media("13f4b4a21f8e5459ccd7778ea83260e041d17eb8c6e78a13f7c7f605341ab835.jpg")},
  {code:"WY-0024",name:"桃源峪",region:"桃源峪",summary:"溪流与林缘的自然观察起点。",themes:["nature"],familyFriendly:true,status:"正常",image:media("c8bd4b82de52dedb47ad73c99300fb5a3acf526cb59da7370bd07d4e1552e09f.jpg")},
  {code:"WY-0028",name:"龙渡蝴蝶科普展示馆",region:"红星村附近",summary:"在展馆里看懂蝴蝶与环境。",themes:["nature","museum"],familyFriendly:true,status:"正常",image:media("03f35abce64a25d43f24aed7074152a9dcaa52e50f5217206d40757118fad58e.jpg")},
  {code:"WY-0030",name:"野猴谷",region:"桐木区域",summary:"继续往桐木方向观察山林环境。",themes:["nature"],familyFriendly:false,status:"正常"},
  {code:"WY-0041",name:"珍稀植物科普展示馆",region:"红星村",summary:"通过科普展示认识武夷山珍稀植物。",themes:["nature","museum"],familyFriendly:true,status:"正常",image:media("f45cca5ce439ecb32326111c319f8470f69ed9a780e20fafe1248f4a9a5d79b3.jpg")},
  {code:"WY-0043",name:"兰花展示馆",region:"红星村",summary:"从兰花主题认识本地植物。",themes:["nature","museum"],familyFriendly:true,status:"正常",image:media("816d890131c24865835d55356aca1b9fa7a396b6087536cdc0cbdf0051fba4ca.jpg")},
  {code:"WY-0061",name:"昆虫展示馆（在建）",region:"一号风景道沿线",summary:"昆虫主题展示，开放前先留意在建状态。",themes:["nature","museum"],familyFriendly:true,status:"在建",image:media("52ba2965a061f34079eb4ad22906ac8a4e73ae621bfdc4a57a0587c12d8ae482.jpg")},
  {code:"WY-0055",name:"茶诗乐营地",region:"黄村",summary:"黄村沿线的茶主题停留。",themes:["museum"],familyFriendly:false,status:"正常"},
  {code:"WY-0040",name:"黄村乌龙茶展示馆",region:"黄村",summary:"沿着工艺变化理解乌龙茶。",themes:["museum"],familyFriendly:false,status:"正常",image:media("0d2aba2cde2f4584140807c399014bbad09023e30aeb07e1bc8c948b3282c30d.jpg")},
  {code:"WY-0032",name:"红茶发源地展示馆",region:"桐木区域",summary:"了解红茶发源地与相关故事。",themes:["museum"],familyFriendly:false,status:"正常",image:media("bdf32b1ea485d3229d06eeed9af00e1ccb35dd9f20437d65400872a48ecc19f8.jpg")},
  {code:"WY-0044",name:"乡愁馆",region:"红星村",summary:"红星村沿线的乡愁主题展馆。",themes:["museum"],familyFriendly:true,status:"正常",image:media("db700e9510788c904857622cf34fb5cc060ababea35de13327cf282511825d60.jpg")},
  {code:"WY-0033",name:"大峡谷展示馆",region:"桐木区域",summary:"大峡谷主题展示。",themes:["museum"],familyFriendly:true,status:"正常",image:media("4f1f91b783655841f6793f263c952823d4cd0b8f6d7c5a3205639f15219b92bc.jpg")},
  {code:"WY-0048",name:"俞妹光饼",region:"星村",summary:"沿路简单补给。",themes:["food"],familyFriendly:false,status:"正常",image:media("d32b5f40e69875a1849502246e0416f3f0f53b07038bf3d6f1d77280ae2fbcf5.jpg")},
  {code:"WY-0049",name:"越南粉",region:"星村",summary:"坐下来吃点热的。",themes:["food"],familyFriendly:false,status:"正常"},
  {code:"WY-0050",name:"旧竹筏码头河边",region:"星村",summary:"吃完以后到河边走走。",themes:["food"],familyFriendly:false,status:"正常"},
];

const runtimeThemes = runtime.themes as Array<{id:string;name:string;icon:string;tone:string;description:string;heroImage:string|null}>;
const runtimePlaces = runtime.places as Array<{code:string;name:string;region:string;summary:string;summaryByTheme?:Record<string,string>;themes:string[];familyFriendly:boolean;facilities?:VisitorThemePlace["facilities"];status:string;image:string|null}>;

export const visitorThemes: VisitorTheme[] = runtimeThemes.length ? runtimeThemes.map((theme)=>({
  ...theme,
  id:theme.id as VisitorThemeId,
  ...(theme.id==="camping"?{name:"床车过夜",description:"记录可能与床车停靠、过夜和休息有关的位置；过夜许可与现场条件需在出发前确认。"}:{}),
  ...englishThemeCopy[theme.id as VisitorThemeId],
  heroImage:theme.heroImage?media(theme.heroImage):undefined,
})) : fallbackThemes;

export const visitorThemePlaces: VisitorThemePlace[] = runtimePlaces.length ? runtimePlaces.map((place)=>({
  ...place,
  themes:place.themes as VisitorThemeId[],
  summaryByTheme:place.summaryByTheme as Partial<Record<VisitorThemeId,string>>,
  image:place.image?media(place.image):undefined,
})) : fallbackPlaces;

export const themeById = (id: string) => visitorThemes.find((theme) => theme.id === id);
export const placesForTheme = (id: VisitorThemeId) => visitorThemePlaces.filter((place) => place.themes.includes(id));
export const localizedThemeName=(theme:VisitorTheme,locale:"zh"|"en")=>locale==="zh"?theme.name:theme.nameEn;
export const localizedThemeDescription=(theme:VisitorTheme,locale:"zh"|"en")=>locale==="zh"?theme.description:theme.descriptionEn;
