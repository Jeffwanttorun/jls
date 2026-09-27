export const locales = ["en", "zh"] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = "en";
export type RoutingMode = "current" | "locale-prefixed";

export const localeInfo = {
  en: { htmlLang: "en-US", ogLocale: "en_US", label: "English", pathPrefix: "" },
  zh: { htmlLang: "zh-CN", ogLocale: "zh_CN", label: "中文", pathPrefix: "/zh" },
} as const;

const routePrefixes: Record<RoutingMode, Record<Locale, string>> = {
  current: { en: "", zh: "/zh" },
  "locale-prefixed": { en: "/en", zh: "/zh" },
};

export const ui = {
  en: {
    home: "Home", start: "Start Here", guides: "Guides", tea: "Rock Tea",
    family: "Family Travel", why: "Why Wuyishan", explore: "Explore Wuyishan",
    stories: "Stories of Wuyishan", map: "Map", about: "About Jeff", contact: "Contact", menu: "Menu",
    openMenu: "Open main navigation", closeMenu: "Close main navigation",
  },
  zh: {
    home: "首页", start: "初识武夷山", guides: "旅行指南", tea: "武夷岩茶",
    family: "亲子旅行", why: "为什么是武夷山", explore: "探索武夷山",
    stories: "武夷山故事", map: "奶爸地图", about: "关于 Jeff", contact: "联系", menu: "菜单",
    openMenu: "打开主导航", closeMenu: "关闭主导航",
  },
} as const;

export function localizedPath(path: string, locale: Locale = defaultLocale, routingMode: RoutingMode = "current") {
  const clean = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${routePrefixes[routingMode][locale]}${clean}` || "/";
}

export function localeFromPath(pathname: string): Locale {
  if (pathname === "/zh" || pathname.startsWith("/zh/")) return "zh";
  return "en";
}
