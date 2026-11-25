import {readFileSync,writeFileSync} from 'node:fs';
const shared=readFileSync('studio-shared.js','utf8').replace(/^export /gm,'');
const client=readFileSync('studio-client.js','utf8');
const legacy=readFileSync('legacy.html','utf8'),online=readFileSync('online.html','utf8').replace('/*STUDIO_SHARED*/',shared).replace('/*STUDIO_CLIENT*/',client);
writeFileSync('core.js','const LEGACY='+JSON.stringify(legacy)+';\nconst ONLINE='+JSON.stringify(online)+';\n'+shared+'\n'+readFileSync('generator.js','utf8')+'\n'+readFileSync('server.js','utf8'));
