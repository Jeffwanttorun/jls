export function assertLocalDatabase(){
 if(process.env.LOCAL_CONTENT_ONLY!=='1')return;
 const url=new URL(process.env.DATABASE_URL||'');
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('Local-only mode requires a loopback PostgreSQL database');
 if(process.env.SITE_PUBLISH_SCRIPT||process.env.SITE_PROJECT_DIR)throw Error('Local-only mode refuses configured site publishing commands');
}
