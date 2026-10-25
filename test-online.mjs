import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('migrations/0001_online.sql','utf8'));
const DB={prepare(query){return {bind(...args){this.args=args;return this},async first(){return sql.prepare(query).get(...(this.args||[]))||null},async all(){return {results:sql.prepare(query).all(...(this.args||[]))}},async run(){return sql.prepare(query).run(...(this.args||[]))}}}};
const worker=(await import('data:text/javascript;base64,'+Buffer.from(readFileSync('worker/core.js','utf8')).toString('base64'))).default;
const files=new Map();const BUCKET={async put(k,b,m){files.set(k,{body:b,httpMetadata:m.httpMetadata})},async get(k){return files.get(k)||null},async head(k){return files.has(k)?{}:null}};
const origin='https://example.test';async function call(path,method='GET',data,owner=false){let headers={origin,'content-type':'application/json'};if(owner){headers['oai-authenticated-user-id']='teacher-id';headers['oai-authenticated-user-email']='lazzat2019@gmail.com'}let res=await worker.fetch(new Request(origin+path,{method,headers,body:data===undefined?undefined:JSON.stringify(data)}),{DB,BUCKET});return {status:res.status,data:await res.json()}}
const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
let upload=await worker.fetch(new Request(origin+'/api/teacher/images',{method:'POST',headers:{origin,'content-type':'image/png','oai-authenticated-user-id':'teacher-id','oai-authenticated-user-email':'lazzat2019@gmail.com'},body:png}),{DB,BUCKET});assert.equal(upload.status,201);const imageId=(await upload.json()).id;
let denied=await worker.fetch(new Request(origin+'/api/teacher/images/'+imageId),{DB,BUCKET});assert.equal(denied.status,403);
let r=await call('/api/teacher/assignments');assert.equal(r.status,403);
r=await call('/api/teacher/assignments','POST',{title:'Тест',grade:'9А',objectives:'9.1.2.1 хаттамалардың қызметін сипаттау',variants:[{name:'A',tasks:[{prompt:'Қауіпсіз хаттама?',image:imageId,type:'exact',answer:'HTTPS|https://',max:2,desc:'Хаттаманы атайды'},{prompt:'DNS түсіндір',type:'manual',answer:'',max:3,desc:'DNS сипаттайды'}]},{name:'B',tasks:[{prompt:'2+2?',type:'exact',answer:'4',max:1}]}]},true);assert.equal(r.status,201);let {id,token}=r.data;let studentImage=await worker.fetch(new Request(origin+'/api/student/'+token+'/images/'+imageId),{DB,BUCKET});assert.equal(studentImage.status,200);assert.equal(studentImage.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await studentImage.arrayBuffer()),png);let wrong=await worker.fetch(new Request(origin+'/api/student/'+token+'/images/'+crypto.randomUUID()),{DB,BUCKET});assert.equal(wrong.status,404);
r=await call('/api/student/'+token);assert.equal(r.status,200);assert.equal(r.data.variants.length,2);assert.equal(r.data.variants[0].tasks[0].image,imageId);assert.equal(r.data.objectives,'9.1.2.1 хаттамалардың қызметін сипаттау');assert.equal(r.data.variants[0].tasks[0].answer,undefined);assert.equal(r.data.variants[0].tasks[0].desc,undefined);
const data={requestId:crypto.randomUUID(),name:'Тест оқушы',grade:'9А',variant:0,answers:[' https  ','DNS қызметі']};r=await call('/api/student/'+token+'/submit','POST',data);assert.equal(r.status,201);let sid=r.data.id;
r=await call('/api/student/'+token+'/submit','POST',data);assert.equal(r.data.id,sid);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM online_submissions').get().n,1);
r=await call('/api/teacher/assignments/'+id+'/submissions','GET',undefined,true);assert.deepEqual(r.data[0].scores,[2,null]);
r=await call('/api/teacher/submissions/'+sid,'POST',{scores:[0,9]},true);assert.equal(r.status,400);
r=await call('/api/teacher/submissions/'+sid,'POST',{scores:[0,2.5],feedback:'Жақсы'},true);assert.equal(r.status,200);r=await call('/api/teacher/assignments/'+id+'/submissions','GET',undefined,true);assert.deepEqual(r.data[0].scores,[2,2.5]);
r=await call('/api/teacher/assignments/'+id+'/status','POST',{open:false},true);assert.equal(r.status,200);r=await call('/api/student/'+token+'/submit','POST',{...data,requestId:crypto.randomUUID()});assert.equal(r.status,410);
r=await call('/api/teacher/assignments/'+id+'/submissions');assert.equal(r.status,403);
for(const file of ['worker/online.html','worker/legacy.html']){new Function(readFileSync(file,'utf8').match(/<script>([\s\S]*)<\/script>/)[1])}
console.log('PASS: create two variants; hide keys; submit and retry; teacher-only answers; manual grading; close submissions; both client scripts parse.');

const page=await worker.fetch(new Request(origin+"/online"),{DB});assert.equal(page.status,200);assert.ok(page.headers.get("content-security-policy").includes("frame-ancestors 'self';"));console.log("PASS: embedding is limited to this site.");

console.log('PASS: authenticated image upload; images persist with tasks; student sees referenced image only; unauthorized image access denied.');
