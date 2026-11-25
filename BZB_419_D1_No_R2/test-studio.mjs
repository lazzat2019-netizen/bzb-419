import {ALLOWED} from './auth.js';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {DEFAULT_SCALE,resultSummary,scaleRanges,classStatistics,validatePreferences,defaultPreferences} from './studio-shared.js';
assert.equal(resultSummary([null,2],[3,2]).grade,null);
for(const[score,grade]of [[0,2],[7.5,2],[8,3],[12.5,3],[13,4],[16.5,4],[17,5],[20,5]])assert.equal(resultSummary([score],[20]).grade,grade);
assert.equal(resultSummary([84.999],[100]).grade,4);
assert.throws(()=>resultSummary([21],[20]));assert.throws(()=>resultSummary(['2'],[20]));assert.throws(()=>resultSummary([2],[0]));
assert.deepEqual(scaleRanges(20).map(r=>[r.min,r.max]),[[0,7.5],[8,12.5],[13,16.5],[17,20]]);
assert.equal(resultSummary([15],[20],{three:50,four:70,five:90}).grade,4);
assert.deepEqual(classStatistics([{scores:[null],maxima:[10]},{scores:[10],maxima:[10]}]).distribution,{2:0,3:0,4:0,5:1});
assert.equal(classStatistics([{scores:[null],maxima:[10]}]).averagePercent,null);
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync('0001_online.sql','utf8'));sql.exec(readFileSync('0002_images.sql','utf8'));
const DB={prepare(query){return{bind(...args){this.args=args;return this},async first(){return sql.prepare(query).get(...(this.args||[]))||null},async all(){return{results:sql.prepare(query).all(...(this.args||[]))}},async run(){return sql.prepare(query).run(...(this.args||[]))}}},async batch(statements){sql.exec('BEGIN');try{const r=[];for(const st of statements)r.push(await st.run());sql.exec('COMMIT');return r}catch(e){sql.exec('ROLLBACK');throw e}}};
const worker=(await import('./core.js')).default;
const origin='https://example.test';async function call(path,method='GET',data,owner=true,headers={}){const h={origin,'content-type':'application/json',...headers};if(owner){h['oai-authenticated-user-id']='teacher';h['oai-authenticated-user-email']=ALLOWED[0]}const response=await worker.fetch(new Request(origin+path,{method,headers:h,body:data===undefined?undefined:JSON.stringify(data)}),{DB});return{status:response.status,data:await response.json()}}
let r=await call('/api/teacher/settings');assert.equal(r.status,200);assert.deepEqual(r.data,defaultPreferences());
r=await call('/api/teacher/settings','GET',undefined,false);assert.equal(r.status,403);
const prefs={version:1,scale:{three:45,four:70,five:90},templates:[{id:crypto.randomUUID(),name:'Желі',rows:[{criterion:'Мекенжай анықтау',task:'1',descriptor:'Масканы қолданады',max:2}]}]};
r=await call('/api/teacher/settings','PUT',prefs);assert.equal(r.status,200);r=await call('/api/teacher/settings');assert.deepEqual(r.data,prefs);
r=await call('/api/teacher/settings','PUT',{...prefs,scale:{three:70,four:50,five:90}});assert.equal(r.status,400);assert.deepEqual((await call('/api/teacher/settings')).data,prefs);
const token='11112222333344445555666677778888';
const assignment={title:'Қалпына келтіру сынағы',grade:'9А',objectives:'9.1.2.2 мақсат',instructions:'Орындаңыз',restoreToken:token,gradingScale:prefs.scale,variants:[{name:'1',tasks:[{prompt:'Сұрақ',criterion:'Критерий',desc:'Дескриптор',type:'manual',max:2,table:{cells:[[{text:'Тұрақты мәтін',editable:false},{text:'',editable:true}]]}}]}]};
assert.equal((await call('/api/student/'+token,'GET',undefined,false)).status,404);
r=await call('/api/teacher/assignments','POST',assignment);assert.equal(r.status,201);assert.equal(r.data.token,token);const id=r.data.id;
r=await call('/api/teacher/assignments','POST',assignment);assert.equal(r.status,409);assert.equal(sql.prepare('SELECT COUNT(*) n FROM online_assignments').get().n,1);
r=await call('/api/student/'+token,'GET',undefined,false);assert.equal(r.status,200);assert.equal(r.data.variants[0].tasks[0].criterion,undefined);assert.equal(r.data.gradingScale,undefined);
const answer=JSON.stringify({cells:[['Оқушы ауыстырған мәтін','Жауап']]});r=await call('/api/student/'+token+'/submit','POST',{name:'S01',grade:'9А',variant:0,answers:[answer],requestId:crypto.randomUUID()},false);assert.equal(r.status,201);
const saved=JSON.parse(sql.prepare('SELECT answers FROM online_submissions').get().answers);assert.equal(JSON.parse(saved[0]).cells[0][0],'Тұрақты мәтін');
const source=readFileSync('online.html','utf8').replace('/*STUDIO_SHARED*/',readFileSync('studio-shared.js','utf8').replace(/^export /gm,'')).replace('/*STUDIO_CLIENT*/',readFileSync('studio-client.js','utf8'));new Function(source.match(/<script>([\s\S]*)<\/script>/)[1]);
let actualFetch=globalThis.fetch,mode='ok',calls=0;
globalThis.fetch=async(url,init)=>{calls++;assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/v1beta/models/'));assert.equal(init.headers['x-goog-api-key'],'test-key');if(mode==='quota')return Response.json({}, {status:429});const tasks=Array.from({length:mode==='four'?4:5},(_,i)=>({prompt:'Мақсатқа сәйкес '+(i+1),criterion:'Критерий',desc:'Орындайды',max:2,type:'manual',answer:''}));return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({title:'Жоба',instructions:'Нұсқау',tasks})}]}}]})};
try{const b={title:'Желі',grade:'9А',objectives:'9.1.2.2 берілген мақсат',total:10,consent:true,gradingScale:DEFAULT_SCALE};r=await call('/api/teacher/generate','POST',b);assert.equal(r.status,400);assert.equal(calls,0);r=await call('/api/teacher/generate','POST',b,false,{'x-gemini-key':'test-key'});assert.equal(r.status,403);r=await call('/api/teacher/generate','POST',b,true,{'x-gemini-key':'test-key'});assert.equal(r.status,200);assert.equal(r.data.variants[0].tasks.length,5);assert.equal(r.data.objectives,b.objectives);assert.equal(r.data.variants[0].tasks.reduce((s,t)=>s+t.max,0),10);assert.ok(!JSON.stringify(r.data).includes('test-key'));mode='four';assert.equal((await call('/api/teacher/generate','POST',b,true,{'x-gemini-key':'test-key'})).status,502);mode='quota';assert.equal((await call('/api/teacher/generate','POST',b,true,{'x-gemini-key':'test-key'})).status,429)}finally{globalThis.fetch=actualFetch}
console.log('PASS: exact grade boundaries and pending nulls; private persistent settings; safe old-link recreation and duplicate refusal; immutable table cells; embedded client syntax; mocked five-task generation and quota failure. No real AI request made.');
let keyCalls=0;
globalThis.fetch=async(url,init)=>{keyCalls++;assert.equal(String(url),'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000');assert.equal(init.headers['x-goog-api-key'],'test-key');return Response.json({models:[{name:'models/gemini-flash-latest',supportedGenerationMethods:['generateContent']},{name:'models/gemini-embedding',supportedGenerationMethods:['embedContent']}]})};
try{assert.equal((await call('/api/teacher/gemini/check','POST',{},false)).status,403);assert.equal((await call('/api/teacher/gemini/check','POST',{})).status,400);assert.equal(keyCalls,0);r=await call('/api/teacher/gemini/check','POST',{},true,{'x-gemini-key':'test-key'});assert.equal(r.status,200);assert.deepEqual(r.data.models,['gemini-flash-latest']);assert.equal(r.data.modelAvailable,true);assert.ok(!JSON.stringify(r.data).includes('test-key'));for(const status of [400,403,429]){globalThis.fetch=async()=>Response.json({error:{message:'test-key',details:[{reason:status===400?'API_KEY_INVALID':'OTHER'}]}},{status});r=await call('/api/teacher/gemini/check','POST',{},true,{'x-gemini-key':'test-key'});assert.equal(r.status,status);assert.ok(!JSON.stringify(r.data).includes('test-key'))}}finally{globalThis.fetch=actualFetch}
console.log('PASS: authenticated model-only connection check, missing-key rejection, filtered models and redacted provider failures.');
