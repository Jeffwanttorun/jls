import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { productionSiteUrl } from "./site.config.mjs";
import remarkRemoveKnowledgeTitle from "./src/lib/remark-remove-knowledge-title.mjs";
import { execFile } from "node:child_process";
import { resolve } from "node:path";

const visitorStore=resolve("../wuyishan-map-phase1/visitor-content-store/data.json");
const visitorSyncScript=resolve("scripts/sync-visitor-content.mjs");
const liveVisitorContent={
  name:"live-visitor-content",
  hooks:{
    "astro:server:setup":({server,logger})=>{
      let timer;
      let syncing=false;
      let rerun=false;
      const sync=()=>{
        if(syncing){rerun=true;return;}
        syncing=true;
        execFile(process.execPath,[visitorSyncScript],{cwd:process.cwd()},(error)=>{
          syncing=false;
          if(error)logger.error(`游客内容自动同步失败：${error.message}`);
          else logger.info("后台内容已自动同步到本地网页");
          if(rerun){rerun=false;sync();}
        });
      };
      server.watcher.add(visitorStore);
      server.watcher.on("change",(path)=>{if(resolve(path)!==visitorStore)return;clearTimeout(timer);timer=setTimeout(sync,180);});
    },
  },
};

export default defineConfig({
  site: process.env.SITE_URL || productionSiteUrl,
  output: "static",
  trailingSlash: "never",
  integrations: [sitemap({ filter:(page) => !page.includes("/draft-preview/") }),liveVisitorContent],
  markdown: { remarkPlugins:[remarkRemoveKnowledgeTitle] },
});
