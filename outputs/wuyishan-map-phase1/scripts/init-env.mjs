import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const password=randomBytes(24).toString('hex');
await writeFile('.env',`POSTGRES_PASSWORD=${password}\nDATABASE_URL=postgresql://wymap:${password}@127.0.0.1:5432/wymap\nHOST=127.0.0.1\nPORT=3001\n`,{flag:'wx'});
console.log('已生成 .env；已有文件不会覆盖。当前为内部局域网无认证模式。');
