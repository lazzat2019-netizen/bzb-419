const TEACHER_EMAILS=['lazzat2019@gmail.com'];
const j=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}});
function teacher(req){return !!req.headers.get('oai-authenticated-user-id')&&TEACHER_EMAILS.includes(req.headers.get('oai-authenticated-user-email')?.toLowerCase())}
function fail(message,status=400){throw Object.assign(new Error(message),{status})}
function txt(s,max=1000){if(typeof s!=='string'||s.trim().length===0||s.length>max)fail('Мәтін толтырылмаған немесе тым ұзын.');return s.trim()}
async function body(req){if(Number(req.headers.get('content-length'))>200000)fail('Жүктелетін дерек тым үлкен.',413);let raw=await req.text();if(raw.length>200000)fail('Жүктелетін дерек тым үлкен.',413);try{return JSON.parse(raw)}catch{fail('JSON дерегі жарамсыз.')}}
function checkOrigin(req){if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==new URL(req.url).origin)fail('Сұрау рұқсат етілмеген.',403)}
function normalize(s){return String(s).normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('kk-KZ')}
function publicAssignment(a){const d=JSON.parse(a.data);return {id:a.id,title:d.title,grade:d.grade,instructions:d.instructions,objectives:d.objectives||'',open:!!a.open,variants:d.variants.map(v=>({name:v.name,tasks:v.tasks.map(t=>({prompt:t.prompt,max:t.max,type:t.type,image:t.image||'',table:t.table||null}))}))}}
async function api(req,env,url){
 checkOrigin(req);const path=url.pathname;const images=imageStore(env.DB);
 if(path==='/api/me')return j({teacher:teacher(req)});
 if(path.startsWith('/api/teacher/')&&!teacher(req))fail('Мұғалім ретінде кіріңіз.',403);
 const imageRoute=path.match(/^\/api\/teacher\/images(?:\/([a-f0-9-]{36}))?$/);
 if(imageRoute){
 if(!env.DB)fail('Сурет сақтау қызметі қолжетімсіз.',503);
 if(req.method==='POST'&&!imageRoute[1]){if(Number(req.headers.get('content-length'))>512000)fail('Ықшамдалған сурет 500 КБ-тан аспауы керек.',413);const bytes=new Uint8Array(await req.arrayBuffer());if(bytes.length>512000)fail('Ықшамдалған сурет 500 КБ-тан аспауы керек.',413);const type=imageType(bytes);if(!type)fail('PNG, JPEG немесе WebP суретін таңдаңыз.');const id=crypto.randomUUID();await images.put('task-images/'+id,bytes,{httpMetadata:{contentType:type}});return j({id},201)}
 if(req.method==='GET'&&imageRoute[1])return imageResponse(await images.get('task-images/'+imageRoute[1]));
 fail('Сұрау жарамсыз.',405);
 }
 const studentImage=path.match(/^\/api\/student\/([a-f0-9]{32})\/images\/([a-f0-9-]{36})$/);
 if(studentImage&&req.method==='GET'){
 if(!env.DB)fail('Қызмет қолжетімсіз.',503);
 const a=await env.DB.prepare('SELECT * FROM online_assignments WHERE token=?').bind(studentImage[1]).first();if(!a)fail('Тапсырма табылмады.',404);const d=JSON.parse(a.data);if(!d.variants.some(v=>v.tasks.some(t=>t.image===studentImage[2])))fail('Сурет табылмады.',404);return imageResponse(await images.get('task-images/'+studentImage[2]));
 }
 if(!env.DB)fail('Сервердегі дерекқор әлі қосылмаған.',503);
 if(path==='/api/teacher/assignments'&&req.method==='GET'){
 const rows=await env.DB.prepare('SELECT a.*, (SELECT COUNT(*) FROM online_submissions s WHERE s.assignment_id=a.id) AS count FROM online_assignments a ORDER BY a.created_at DESC').all();return j(rows.results.map(a=>({id:a.id,token:a.token,open:!!a.open,created_at:a.created_at,count:a.count,...JSON.parse(a.data)})));
 }
 if(path==='/api/teacher/assignments'&&req.method==='POST'){
 const b=await body(req);const data={title:txt(b.title,200),grade:txt(b.grade,80),objectives:String(b.objectives||'').slice(0,4000),instructions:String(b.instructions||'').slice(0,4000),variants:[]};
 if(!Array.isArray(b.variants)||b.variants.length<1||b.variants.length>10)fail('1–10 нұсқа енгізіңіз.');
 data.variants=b.variants.map(v=>{if(!Array.isArray(v.tasks)||!v.tasks.length||v.tasks.length>30)fail('Әр нұсқада 1–30 тапсырма болуы керек.');return {name:txt(v.name,100),tasks:v.tasks.map(t=>{if(!['exact','manual'].includes(t.type)||!Number.isFinite(t.max)||t.max<=0||t.max>100)fail('Тапсырма түрі немесе балл жарамсыз.');const answer=t.type==='exact'?txt(t.answer,2000):'';if(t.type==='exact'&&answer.split('|').some(s=>!s.trim()))fail('Дұрыс жауап нұсқасы бос болмауы керек.');if(t.image){if(typeof t.image!=='string'||!/^([a-f0-9-]{36})$/.test(t.image))fail('Сурет коды жарамсыз.');}const table=validateTable(t.table);if(table&&t.type!=='manual')fail('Кестені мұғалім бағалайды.');return {table,image:t.image||'',prompt:txt(t.prompt||(table?'Кестені толтырыңыз.':t.image?'Суреттегі тапсырманы орындаңыз.':''),6000),desc:String(t.desc||'').slice(0,1000),type:t.type,answer,max:t.max}})}});
 const imageIds=[...new Set(data.variants.flatMap(v=>v.tasks.map(t=>t.image).filter(Boolean)))];for(const image of imageIds){if(!env.DB||!await images.head('task-images/'+image))fail('Тапсырма суреті табылмады. Қайта жүктеңіз.');}
 const id=crypto.randomUUID(),token=crypto.randomUUID().replace(/-/g,'');await env.DB.prepare('INSERT INTO online_assignments (id,token,data,open,created_at) VALUES (?,?,?,1,?)').bind(id,token,JSON.stringify(data),new Date().toISOString()).run();return j({id,token},201);
 }
 const m=path.match(/^\/api\/teacher\/assignments\/([^/]+)(?:\/(submissions|status))?$/);
 if(m){const a=await env.DB.prepare('SELECT * FROM online_assignments WHERE id=?').bind(m[1]).first();if(!a)fail('Тапсырма табылмады.',404);
 if(!m[2]&&req.method==='DELETE'){const b=await body(req);if(b.confirm!==a.id)fail('Өшіруді растаңыз.');await env.DB.batch([env.DB.prepare('DELETE FROM online_submissions WHERE assignment_id=?').bind(a.id),env.DB.prepare('DELETE FROM online_assignments WHERE id=?').bind(a.id)]);return j({ok:true})}
 if(m[2]==='status'&&req.method==='POST'){const b=await body(req);if(typeof b.open!=='boolean')fail('Күй жарамсыз.');await env.DB.prepare('UPDATE online_assignments SET open=? WHERE id=?').bind(b.open?1:0,a.id).run();return j({ok:true})}
 if(m[2]==='submissions'&&req.method==='GET'){const rows=await env.DB.prepare('SELECT * FROM online_submissions WHERE assignment_id=? ORDER BY submitted_at DESC').bind(a.id).all();return j(rows.results.map(s=>({...s,answers:JSON.parse(s.answers),scores:JSON.parse(s.scores)})))}
 }
 const sm=path.match(/^\/api\/teacher\/submissions\/([^/]+)$/);
 if(sm&&req.method==='POST'){const s=await env.DB.prepare('SELECT * FROM online_submissions WHERE id=?').bind(sm[1]).first();if(!s)fail('Жұмыс табылмады.',404);const a=await env.DB.prepare('SELECT * FROM online_assignments WHERE id=?').bind(s.assignment_id).first();const tasks=JSON.parse(a.data).variants[s.variant].tasks,b=await body(req);if(!Array.isArray(b.scores)||b.scores.length!==tasks.length)fail('Балл саны сәйкес емес.');let scores=JSON.parse(s.scores);tasks.forEach((t,i)=>{if(t.type==='manual'){const v=b.scores[i];if(v!==null&&(!Number.isFinite(v)||v<0||v>t.max))fail('Балл рұқсат етілген аралықта болуы керек.');scores[i]=v}});await env.DB.prepare('UPDATE online_submissions SET scores=?,feedback=? WHERE id=?').bind(JSON.stringify(scores),String(b.feedback||'').slice(0,3000),s.id).run();return j({ok:true})}
 const pm=path.match(/^\/api\/student\/([a-f0-9]{32})(?:\/(submit))?$/);
 if(pm){const a=await env.DB.prepare('SELECT * FROM online_assignments WHERE token=?').bind(pm[1]).first();if(!a)fail('Тапсырма сілтемесі жарамсыз.',404);if(!a.open)fail('Бұл тапсырмаға жауап қабылдау жабылған.',410);
 if(!pm[2]&&req.method==='GET')return j(publicAssignment(a));
 if(pm[2]==='submit'&&req.method==='POST'){const b=await body(req),d=JSON.parse(a.data);const name=txt(b.name,120),grade=txt(b.grade,60);if(!Number.isInteger(b.variant)||!d.variants[b.variant])fail('Нұсқа жарамсыз.');const tasks=d.variants[b.variant].tasks;if(!Array.isArray(b.answers)||b.answers.length!==tasks.length||b.answers.some(x=>typeof x!=='string'||x.length>10000))fail('Жауаптар пішімі жарамсыз.');tasks.forEach((t,i)=>{if(t.table){let cells;try{cells=JSON.parse(b.answers[i]).cells}catch{fail('Кесте жауабы жарамсыз.')}if(!Array.isArray(cells)||cells.length!==t.table.cells.length||cells.some((r,ri)=>!Array.isArray(r)||r.length!==t.table.cells[ri].length||r.some(x=>typeof x!=='string'||x.length>500)))fail('Кесте жауабының өлшемі жарамсыз.');}});if(!/^[a-f0-9-]{36}$/.test(b.requestId||''))fail('Жіберу коды жарамсыз.');let old=await env.DB.prepare('SELECT id FROM online_submissions WHERE assignment_id=? AND request_id=?').bind(a.id,b.requestId).first();if(old)return j({id:old.id,received:true});let scores=tasks.map((t,i)=>t.type==='manual'?null:(t.answer.split('|').some(k=>normalize(k)===normalize(b.answers[i]))?t.max:0));const id=crypto.randomUUID();await env.DB.prepare('INSERT OR IGNORE INTO online_submissions (id,assignment_id,request_id,name,grade,variant,answers,scores,feedback,submitted_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,a.id,b.requestId,name,grade,b.variant,JSON.stringify(b.answers),JSON.stringify(scores),'',new Date().toISOString()).run();const saved=await env.DB.prepare('SELECT id FROM online_submissions WHERE assignment_id=? AND request_id=?').bind(a.id,b.requestId).first();return j({id:saved.id,received:true},201)}
 }
 fail('Сұрау табылмады.',404);
}
export default {async fetch(req,env){const url=new URL(req.url);try{if(url.pathname.startsWith('/api/'))return await api(req,env,url);if(req.method!=='GET')return new Response('Method not allowed',{status:405});if(url.pathname==='/legacy'){if(!teacher(req))return Response.redirect(url.origin+'/auth/google?return_to=%2Flegacy',302);return page(LEGACY)}if(url.pathname==='/online'||url.pathname.startsWith('/s/'))return page(ONLINE);if(url.pathname==='/'){if(teacher(req))return page(LEGACY);return page(ONLINE)}return new Response('Not found',{status:404})}catch(e){return j({error:e.status?e.message:'Сервер қатесі. Қайталап көріңіз.'},e.status||500)}}};
function page(html){return new Response(html,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'same-origin','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"}})}

function imageType(b){if(b.length>=8&&[137,80,78,71,13,10,26,10].every((x,i)=>b[i]===x))return 'image/png';if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';return null}
function imageResponse(obj){if(!obj)fail('Сурет табылмады.',404);return new Response(obj.body,{headers:{'content-type':obj.httpMetadata?.contentType||'application/octet-stream','cache-control':'private,max-age=300','x-content-type-options':'nosniff'}})}

function imageStore(db){return {
 async put(key,bytes,metadata){const id=key.split('/').pop();const blob=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);await db.prepare('INSERT INTO online_images (id,content,mime,created_at) VALUES (?,?,?,?)').bind(id,blob,metadata.httpMetadata.contentType,new Date().toISOString()).run()},
 async get(key){const row=await db.prepare('SELECT content,mime FROM online_images WHERE id=?').bind(key.split('/').pop()).first();return row?{body:row.content,httpMetadata:{contentType:row.mime}}:null},
 async head(key){return db.prepare('SELECT id FROM online_images WHERE id=?').bind(key.split('/').pop()).first()}
}}

function validateTable(t){
 if(t==null)return null;
 if(!Array.isArray(t.cells)||t.cells.length<1||t.cells.length>20||!Array.isArray(t.cells[0])||t.cells[0].length<1||t.cells[0].length>10)fail('Кесте өлшемі: 1–20 жол, 1–10 баған.');
 const cols=t.cells[0].length;
 const cells=t.cells.map(row=>{if(!Array.isArray(row)||row.length!==cols)fail('Кесте жолдары сәйкес емес.');return row.map(c=>{if(!c||typeof c.text!=='string'||c.text.length>500||typeof c.editable!=='boolean')fail('Кесте ұяшығы жарамсыз.');return {text:c.text,editable:c.editable}})});
 if(!cells.some(row=>row.some(c=>c.editable)))fail('Оқушы толтыратын кемінде бір ұяшықты белгілеңіз.');
 return {cells};
}
