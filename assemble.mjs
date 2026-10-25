import {readFileSync,writeFileSync} from 'node:fs';
const legacy=readFileSync('worker/legacy.html','utf8'),online=readFileSync('worker/online.html','utf8');
writeFileSync('worker/core.js','const LEGACY='+JSON.stringify(legacy)+';\nconst ONLINE='+JSON.stringify(online)+';\n'+readFileSync('worker/server.js','utf8'));
