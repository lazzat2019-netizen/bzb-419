import {readFileSync,writeFileSync} from 'node:fs';
const legacy=readFileSync('legacy.html','utf8'),online=readFileSync('online.html','utf8');
writeFileSync('core.js','const LEGACY='+JSON.stringify(legacy)+';\nconst ONLINE='+JSON.stringify(online)+';\n'+readFileSync('server.js','utf8'));
