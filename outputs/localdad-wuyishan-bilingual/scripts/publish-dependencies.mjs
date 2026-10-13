import {basename} from 'node:path';

// The existing host may invoke builds through npm. Install from the repository's
// pnpm lockfile in either case, without changing globally installed tools.
export function dependencyInstallPlan(command,manifest){
 const name=basename(command.replaceAll('\\','/')).replace(/\.(cmd|exe)$/i,'');
 const pinned=manifest.packageManager;
 if(!/^pnpm@\d+\.\d+\.\d+$/.test(pinned||''))throw Error('Website must declare an exact pnpm packageManager version.');
 const args=['install','--frozen-lockfile','--prod=false'];
 if(name==='pnpm')return {command,args};
 if(name==='npm')return {command,args:['exec','--yes',`--package=${pinned}`,'--','pnpm',...args]};
 throw Error('Website publication supports the existing npm or pnpm launcher only.');
}
