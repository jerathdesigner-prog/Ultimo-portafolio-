import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../worker/index.mjs';
// Site build output (run `bun run build:site` first): what the Worker serves.
const base=fileURLToPath(new URL('../dist-site/browser/',import.meta.url));
const sql=new DatabaseSync(':memory:');
const media=new Map();
const env={
  ADMIN_USER:'jerath',
  ADMIN_PASSWORD:'UnaPasswordSuperSegura!2026',
  SESSION_SECRET:'un-secreto-aleatorio-con-mas-de-32-bytes-mock',
  DB:{prepare(statement){const s=sql.prepare(statement);let args=[];return {bind(...values){args=values;return this},async run(){const r=s.run(...args);return {meta:{changes:r.changes}}},async first(){return s.get(...args)||null}}}},
  MEDIA:{async put(name,body,opt){const parts=[];for await(const p of body)parts.push(p);const b=Buffer.concat(parts);media.set(name,{body:b,mime:opt.httpMetadata.contentType});return {size:b.length}},async get(name,opts={}){const obj=media.get(name);if(!obj)return null;const bytes=opts.range?obj.body.subarray(opts.range.offset,opts.range.offset+opts.range.length):obj.body;return {body:new ReadableStream({start(c){c.enqueue(bytes);c.close()}}),async arrayBuffer(){return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)},httpEtag:'"test-etag"',size:obj.body.length}},async delete(name){media.delete(name)}},
  ASSETS:{async fetch(req){const u=new URL(req.url),p=path.normalize(path.join(base,u.pathname.replace(/^\//,'')||'index.html'));if(!p.startsWith(base))return new Response('Bad',{status:400});try{const bytes=await fs.readFile(p);return new Response(bytes,{headers:{'content-type':p.endsWith('.html')?'text/html':'text/plain'}})}catch{return new Response('Not Found',{status:404})}}}
};
const url='https://jerathmoreira.com';
async function request(method,p,body,headers={}){const opt={method,headers:{...headers}};if(body!==undefined){if(!(body instanceof Uint8Array)&&typeof body!=='string'){opt.body=JSON.stringify(body);opt.headers['content-type']='application/json'}else opt.body=body;}return app.fetch(new Request(url+p,opt),env)}
let r=await request('GET','/');assert.equal(r.status,200);let html=await r.text();assert.ok(html.includes('<app-root'));assert.ok(html.includes('window.jmPortfolioData='));assert.ok(html.includes('Diseño gráfico'));assert.ok(html.indexOf('jmPortfolioData')<html.indexOf('</head>'));
r=await request('GET','/api/admin/state');assert.equal(r.status,401);
r=await request('GET','/api/public');assert.equal((await r.json()).services.length,4);
r=await request('POST','/api/login',{username:'jerath',password:'incorrect'});assert.equal(r.status,401);
r=await request('POST','/api/login',{username:'jerath',password:'UnaPasswordSuperSegura!2026'});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0];assert.ok(cookie.startsWith('jerath_session='));
r=await request('GET','/api/session',undefined,{cookie});assert.equal(r.status,200);
r=await request('POST','/api/admin/services',{title:'Motion Graphics',subtitle:'Motion',focus:'video',published:true},{cookie,origin:url});assert.equal(r.status,200);const service=await r.json();assert.ok(service.id.startsWith('srv_'));
r=await request('PUT','/api/admin/services/'+service.id,{...service,title:'Motion y Diseño'},{cookie,origin:url});assert.equal(r.status,200);
r=await request('POST','/api/admin/projects',{title:'Reel de prueba',serviceId:service.id,tag:'Video',description:'Motion',published:true,media:[]},{cookie,origin:url});assert.equal(r.status,200);const project=await r.json();
r=await request('GET','/api/public');const p=await r.json();assert.equal(p.services.length,5);assert.ok(p.projects.find(x=>x.id===project.id));
const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
r=await request('POST','/api/admin/upload',png,{cookie,origin:url,'x-filename':'mi-imagen.png','content-type':'image/png'});assert.equal(r.status,200);const file=await r.json();assert.equal(file.kind,'image');assert.ok(file.url.includes('med_'));
r=await request('GET',file.url);assert.equal(r.status,200);assert.equal((await r.arrayBuffer()).byteLength,png.length);
r=await request('DELETE','/api/admin/projects/'+project.id,undefined,{cookie,origin:url});assert.equal(r.status,200);
r=await request('DELETE','/api/admin/services/'+service.id,undefined,{cookie,origin:url});assert.equal(r.status,200);
r=await request('POST','/api/logout',{}, {cookie,origin:url});assert.equal(r.status,200);
console.log('OK: app Angular con contenido inyectado, seguridad básica, login, servicios, proyectos, D1, archivos R2, logout');
