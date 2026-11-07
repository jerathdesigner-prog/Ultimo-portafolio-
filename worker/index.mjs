import { SEED } from './seed.mjs';
import { collect, report } from './analytics.mjs';
import { legalPage } from './legal.mjs';
import { consentRequest, privacyReport, purgePrivacy } from './privacy.mjs';

// Backend cloud nativo: Cloudflare Workers + D1 (contenido) + R2 (multimedia).
// No instala Python ni expone los archivos de tu computadora.
const encoder = new TextEncoder();
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const KINDS = { jpg: ['image','image/jpeg'], jpeg:['image','image/jpeg'], png:['image','image/png'], gif:['image','image/gif'], webp:['image','image/webp'], avif:['image','image/avif'], mp4:['video','video/mp4'], webm:['video','video/webm'], mov:['video','video/quicktime'], m4v:['video','video/x-m4v'], mp3:['audio','audio/mpeg'], m4a:['audio','audio/mp4'], wav:['audio','audio/wav'], ogg:['audio','audio/ogg'] };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jresp = (obj, status=200, extra={}) => new Response(JSON.stringify(obj), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...extra}});
const error = (code,msg) => { const err = new Error(msg); err.status=code; return err; };
const clone = obj => structuredClone(obj);
function clean(value, field, maxlen=5000, required=false) {const s=String(value??'').trim();if(s.length>maxlen ||(required&&!s))throw error(422,`${field}: texto inválido o demasiado largo.`);return s;}
const strEqual = async (a,b) => {const [x,y]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(String(a))),crypto.subtle.digest('SHA-256',encoder.encode(String(b)))]);const aa=new Uint8Array(x),bb=new Uint8Array(y);let n=0;for(let i=0;i<aa.length;i++)n |= aa[i]^bb[i];return n===0;};
const b64 = u8 => btoa(Array.from(u8, c=>String.fromCharCode(c)).join(''));
const unb64 = s => Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const safeJson = obj => JSON.stringify(obj).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
let schemaPromise;
async function initDB(env){
  if(!env.DB)throw error(503,'Falta configurar la base de datos D1.');
  if(!schemaPromise) schemaPromise=(async()=>{
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS portfolio_state (id INTEGER PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 1)').run();
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS login_attempts (ip TEXT PRIMARY KEY, count INTEGER NOT NULL, first_at INTEGER NOT NULL)').run();
  })().catch(e=>{schemaPromise=null;throw e});
  await schemaPromise;
}
async function readState(env){
  await initDB(env);
  let row=await env.DB.prepare('SELECT data,rev FROM portfolio_state WHERE id=1').first();
  if(!row){await env.DB.prepare('INSERT OR IGNORE INTO portfolio_state (id,data,rev) VALUES (1,?,1)').bind(JSON.stringify(SEED)).run();row=await env.DB.prepare('SELECT data,rev FROM portfolio_state WHERE id=1').first();}
  const state=JSON.parse(row.data);
  for(const k of ['services','projects','media'])if(!Array.isArray(state[k]))state[k]=[];
  return {state, rev:row.rev};
}
async function mutate(env,fn){
  for(let tries=0;tries<6;tries++){
    const {state,rev}=await readState(env);
    const result=await fn(state);
    const saved=await env.DB.prepare('UPDATE portfolio_state SET data=?,rev=rev+1 WHERE id=1 AND rev=?').bind(JSON.stringify(state),rev).run();
    if(saved.meta?.changes===1)return result;
  }
  throw error(409,'Cambios simultáneos. Actualiza el panel e intenta otra vez.');
}
function mediaPublic(data,id){const m=data.media.find(x=>x.id===id);return m?{...m,url:'/uploads/'+m.diskName}:null;}
// En la respuesta privada tambien enviamos las URL seguras de R2.
function adminState(data){return {...data,media:data.media.map(m=>({...m,url:'/uploads/'+encodeURIComponent(m.diskName)}))};}
const FREE_REFERENCE_BYTES=10_000_000_000; // 10 GB-mes, referencia de la capa gratuita de R2 Standard.
async function storageStatus(req,env){
  await verifyAuth(req,env);
  if(!env.MEDIA)throw error(503,'R2 no esta configurado.');
  let cursor,bytes=0,objects=0,complete=true;
  // Recorre R2, no depende de estimaciones de D1 (incluye archivos sin referencia).
  for(let pageNumber=0;pageNumber<25;pageNumber++){
    const page=await env.MEDIA.list(cursor?{limit:1000,cursor}:{limit:1000});
    for(const object of page.objects||[]){bytes+=object.size||0;objects++;}
    if(!page.truncated){cursor=undefined;break;}
    if(!page.cursor){complete=false;break;}
    cursor=page.cursor;
    if(pageNumber===24)complete=false;
  }
  return jresp({usedBytes:bytes,remainingBytes:complete?Math.max(0,FREE_REFERENCE_BYTES-bytes):null,referenceBytes:FREE_REFERENCE_BYTES,objects,complete,reference:'10 GB-mes de almacenamiento Standard; no es un limite fisico ni una factura en tiempo real.'});
}
function publicData(data){
  const services=data.services.filter(s=>s.published!==false).sort((a,b)=>(a.order??0)-(b.order??0)||String(a.title).localeCompare(String(b.title)));
  const serviceIds=new Set(services.map(s=>s.id));
  const projects=data.projects.filter(p=>p.published!==false&&serviceIds.has(p.serviceId)).sort((a,b)=>String(a.serviceId).localeCompare(String(b.serviceId))||(a.order??0)-(b.order??0));
  const refs=new Set();for(const s of services)if(s.coverMediaId)refs.add(s.coverMediaId);
  for(const p of projects){if(p.coverMediaId)refs.add(p.coverMediaId);for(const r of p.media||[])if(r.mediaId)refs.add(r.mediaId);}
  return {services,projects,media:[...refs].map(mid=>mediaPublic(data,mid)).filter(Boolean)};
}
// La web es la app Angular (dist/browser). El Worker le inyecta el contenido
// publico para que no tenga que pedir /api/public al cargar.
function portfolioFallback(data){
  // Real progressive enhancement, identical for visitors and crawlers. Angular
  // replaces app-root's children on bootstrap; no hidden SEO-only duplicate.
  const services=data.services.map(service=>`<li>${esc(service.title)}</li>`).join('');
  return `<app-root><main class="portfolio-fallback"><h1>Jerath Moreira</h1><p>Diseñador gráfico en Portoviejo, Ecuador. Identidad visual, diseño publicitario, contenido para redes sociales y edición de video.</p><section id="servicios"><h2>Servicios</h2><ul>${services}</ul></section><section id="contacto"><h2>Hablemos de tu proyecto</h2><p>Cuéntame qué necesitas diseñar.</p><a href="mailto:jerathdesigner@gmail.com">jerathdesigner@gmail.com</a><p><a href="https://wa.me/593964143410" rel="noopener noreferrer">Contactar por WhatsApp</a></p></section><nav aria-label="Información legal"><a href="/legal/terminos">Términos</a> · <a href="/legal/privacidad">Privacidad</a> · <a href="/legal/cookies">Cookies</a> · <a href="/legal/reembolsos">Reembolsos</a></nav></main></app-root>`;
}
async function website(request,env){
  const {state}=await readState(env), data=publicData(state);
  const u=new URL(request.url);u.pathname='/';u.search='';
  const shell=await env.ASSETS.fetch(new Request(u));
  if(!shell.ok)throw error(500,'La app web no está disponible. Ejecuta el build de Angular.');
  const html=(await shell.text()).replace('<app-root></app-root>',portfolioFallback(data)).replace('</head>',`<script>window.jmPortfolioData=${safeJson(data)};</script><link rel="stylesheet" href="/static/privacy.css"><script defer src="/static/privacy.js?v=20261107"></script></head>`);
  return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff','x-frame-options':'SAMEORIGIN'}});
}
function originCheck(request){if(['GET','HEAD','OPTIONS'].includes(request.method))return;
  const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw error(403,'Origen no autorizado.');
}
const getCookie=(req,key)=>{const all=req.headers.get('Cookie')||'';const m=all.match(new RegExp('(?:^|;\\s*)'+key+'=([^;]+)'));return m?m[1]:'';};
async function sign(secret,payload){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(payload)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function verifyAuth(req,env){
  if(!env.ADMIN_PASSWORD || !env.SESSION_SECRET)throw error(503,'El acceso admin todavía no está configurado.');
  const tok=getCookie(req,'jerath_session'),spl=tok.split('.');if(spl.length!==2)throw error(401,'Inicia sesión en el panel.');
  const [payload,sig]=spl;
  if(!await strEqual(sig,await sign(env.SESSION_SECRET,payload)))throw error(401,'Sesión inválida.');
  let session;try{session=JSON.parse(new TextDecoder().decode(unb64(payload.replace(/-/g,'+').replace(/_/g,'/'))))}catch{throw error(401,'Sesión inválida.');}
  if(session.expires<Date.now()||session.user!==(env.ADMIN_USER||'jerath'))throw error(401,'Sesión expirada.');
  originCheck(req);return session;
}
const cookieHeader=(val,maxage)=>`jerath_session=${val}; Path=/; Max-Age=${maxage}; HttpOnly; Secure; SameSite=Strict`;
async function login(req,env){
  originCheck(req);await initDB(env);if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)throw error(503,'Configura las contraseñas secretas del CMS antes de iniciar sesión.');
  const ip=req.headers.get('CF-Connecting-IP')||'local';const now=Date.now();
  let row=await env.DB.prepare('SELECT count,first_at FROM login_attempts WHERE ip=?').bind(ip).first();
  if(row&&row.count>=8&&now-row.first_at<600000)throw error(429,'Demasiados intentos: espera 10 minutos.');
  const body=await req.json().catch(()=>({})),user=clean(body.username,'usuario',100),pass=clean(body.password,'contraseña',1000);
  const valid=await strEqual(user,env.ADMIN_USER||'jerath')&&await strEqual(pass,env.ADMIN_PASSWORD);
  if(!valid){
    const count=row&&now-row.first_at<600000?row.count+1:1;
    await env.DB.prepare('INSERT INTO login_attempts(ip,count,first_at) VALUES(?,?,?) ON CONFLICT(ip) DO UPDATE SET count=excluded.count,first_at=excluded.first_at').bind(ip,count,count===1?now:row.first_at).run();
    throw error(401,'Usuario o contraseña incorrectos.');
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip=?').bind(ip).run();
  const payload=b64(encoder.encode(JSON.stringify({user:env.ADMIN_USER||'jerath',expires:Date.now()+SESSION_TTL_MS,nonce:crypto.randomUUID()}))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  const token=payload+'.'+await sign(env.SESSION_SECRET,payload);
  return jresp({ok:true,username:env.ADMIN_USER||'jerath'},200,{'set-cookie':cookieHeader(token,Math.floor(SESSION_TTL_MS/1000))});
}
const uniqueId=p=>p+'_'+crypto.randomUUID().replaceAll('-','').slice(0,p==='med'?16:14);
function validateService(raw,old,state){
  const out=old?clone(old):{};
  out.title=clean(raw.title??out.title,'nombre de servicio',100,true);
  out.subtitle=clean(raw.subtitle??out.subtitle,'descripción',190);
  out.tag=clean(raw.tag??out.tag??'ENFOQUE','etiqueta',45);
  out.keywords=clean(raw.keywords??out.keywords,'enfoque',130);
  out.focus=raw.focus??out.focus??'visual';if(!['video','visual'].includes(out.focus))throw error(422,'Tipo inválido.');
  out.published=raw.published===undefined?out.published!==false:!!raw.published;
  out.coverMediaId=raw.coverMediaId??out.coverMediaId??null;
  if(out.coverMediaId&&!state.media.some(m=>m.id===out.coverMediaId))throw error(422,'Portada no encontrada.');
  if(!old){out.id=uniqueId('srv');out.slug=out.id;out.order=Math.max(-1,...state.services.map(s=>s.order??0))+1;}
  else if(raw.order!==undefined){const o=Number(raw.order);if(!Number.isFinite(o))throw error(422,'Orden inválido.');out.order=o;}
  return out;
}
function validateProject(raw,old,state){
  const out=old?clone(old):{};out.title=clean(raw.title??out.title,'nombre del proyecto',160,true);
  out.description=clean(raw.description??out.description,'descripción del proyecto',20000);
  out.tag=clean(raw.tag??out.tag??'Proyecto','etiqueta',60);
  out.serviceId=raw.serviceId??out.serviceId;
  if(!state.services.some(s=>s.id===out.serviceId))throw error(422,'Selecciona un servicio válido.');
  out.published=raw.published===undefined?out.published!==false:!!raw.published;
  out.coverMediaId=raw.coverMediaId??out.coverMediaId??null;
  const mids=new Set(state.media.map(x=>x.id));
  if(out.coverMediaId&&!mids.has(out.coverMediaId))throw error(422,'Portada no encontrada.');
  const refs=raw.media??out.media??[];
  if(!Array.isArray(refs)||refs.length>2000)throw error(422,'Galería inválida.');
  out.media=refs.map((r,i)=>{if(!r||!mids.has(r.mediaId)||!['full','half'].includes(r.layout||'full'))throw error(422,'Archivo o distribución inválidos.');return {mediaId:r.mediaId,layout:r.layout||'full',caption:clean(r.caption||'','pie de foto',180),order:i};});
  if(!old){out.id=uniqueId('pr');out.order=Math.max(-1,...state.projects.filter(p=>p.serviceId===out.serviceId).map(p=>p.order??0))+1;}
  else if(raw.order!==undefined){const o=Number(raw.order);if(!Number.isFinite(o))throw error(422,'Orden inválido.');out.order=o;}
  return out;
}
const parseJson=async req=>{try{return await req.json()}catch{throw error(400,'El JSON enviado es inválido.');}};
async function adminCrud(req,env,path){
  await verifyAuth(req,env);
  const [, , , collection,id]=path.split('/');
  if(!['services','projects','media'].includes(collection))throw error(404,'Ruta no encontrada.');
  if(collection==='media'&&req.method==='DELETE'&&id){
    let removed;
    await mutate(env,s=>{const m=s.media.find(x=>x.id===id);if(!m)throw error(404,'Archivo no encontrado.');removed=m;s.media=s.media.filter(x=>x.id!==id);
      for(const v of s.services)if(v.coverMediaId===id)v.coverMediaId=null;
      for(const p of s.projects){if(p.coverMediaId===id)p.coverMediaId=null;p.media=(p.media||[]).filter(x=>x.mediaId!==id);}return {ok:true};
    });await env.MEDIA.delete(removed.diskName);return jresp({ok:true});
  }
  if(!['services','projects'].includes(collection))throw error(405,'Método no admitido.');
  if(req.method==='POST'&&!id){const body=await parseJson(req);
    const row=await mutate(env,s=>{const obj=collection==='services'?validateService(body,null,s):validateProject(body,null,s);s[collection].push(obj);return obj;});return jresp(row);
  }
  if(id&&req.method==='PUT'){const body=await parseJson(req);const row=await mutate(env,s=>{const old=s[collection].find(x=>x.id===id);if(!old)throw error(404,'Elemento no encontrado.');const obj=collection==='services'?validateService(body,old,s):validateProject(body,old,s);s[collection][s[collection].indexOf(old)]=obj;return obj;});return jresp(row);}
  if(id&&req.method==='DELETE'){await mutate(env,s=>{if(!s[collection].some(x=>x.id===id))throw error(404,'Elemento no encontrado.');s[collection]=s[collection].filter(x=>x.id!==id);
    if(collection==='services')s.projects=s.projects.filter(x=>x.serviceId!==id);return {ok:true};});return jresp({ok:true});}
  throw error(405,'Método no admitido.');
}
function matchMagic(ext,b){
  const at=(...a)=>a.every((x,i)=>b[i]===x);
  if(['jpg','jpeg'].includes(ext))return at(0xff,0xd8,0xff);
  if(ext==='png')return at(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a);
  if(ext==='gif')return new TextDecoder().decode(b.slice(0,6)).match(/^GIF8[79]a$/);
  if(['webp','wav'].includes(ext))return new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))===(ext==='webp'?'WEBP':'WAVE');
  if(['mp4','m4a','m4v','mov','avif'].includes(ext))return new TextDecoder().decode(b.slice(4,8))==='ftyp';
  if(ext==='webm')return at(0x1a,0x45,0xdf,0xa3);
  if(ext==='mp3')return new TextDecoder().decode(b.slice(0,3))==='ID3'||b[0]===255&&(b[1]&224)===224;
  if(ext==='ogg')return new TextDecoder().decode(b.slice(0,4))==='OggS';return false;
}
async function uploadFile(req,env){
  await verifyAuth(req,env);
  if(!env.MEDIA)throw error(503,'Falta activar R2 para subir archivos.');
  const fileName=decodeURIComponent(req.headers.get('x-filename')||'').split(/[\\/]/).pop().slice(0,160);
  const ext=fileName.split('.').pop()?.toLowerCase(),kind=KINDS[ext];
  if(!fileName||!kind)throw error(415,'Formato no admitido. Usa imágenes, videos o audio en formatos compatibles.');
  const len=Number(req.headers.get('content-length'));
  if(Number.isFinite(len)&&len>MAX_FILE_BYTES)throw error(413,'Por seguridad el máximo por archivo es 100 MB. Divide los videos más grandes.');
  if(!req.body)throw error(400,'Archivo vacío.');
  const id=uniqueId('med'),diskName=id+'.'+ext;
  // R2 necesita longitud conocida para streams. Enviamos el cuerpo ORIGINAL del
  // request (no un stream .tee(), que puede perder esa información en workerd).
  const uploaded=await env.MEDIA.put(diskName,req.body,{httpMetadata:{contentType:kind[1]},customMetadata:{filename:fileName}});
  if(uploaded.size>MAX_FILE_BYTES){await env.MEDIA.delete(diskName);throw error(413,'Archivo demasiado grande.');}
  // Comprobación de firma mágica POSTERIOR a la subida, leyendo solo 40 bytes de R2.
  // Así preservamos la subida en streaming de videos y archivos grandes.
  const probe=await env.MEDIA.get(diskName,{range:{offset:0,length:Math.min(uploaded.size,40)}});
  const prefix=probe?new Uint8Array(await probe.arrayBuffer()):new Uint8Array();
  if(!matchMagic(ext,prefix)){await env.MEDIA.delete(diskName);throw error(415,'El archivo no coincide con su formato.');}
  const row={id,filename:fileName,diskName,kind:kind[0],mime:kind[1],bytes:uploaded.size,uploadedAt:Math.floor(Date.now()/1000)};
  try{await mutate(env,s=>{s.media.push(row);return row;});}catch(e){await env.MEDIA.delete(diskName);throw e;}
  return jresp({...row,url:'/uploads/'+diskName});
}
async function mediaRequest(req,env,name){
  if(!/^med_[a-f0-9]{16}\.[a-z0-9]+$/.test(name))throw error(404,'No encontrado.');
  const {state}=await readState(env),m=state.media.find(x=>x.diskName===name);if(!m)throw error(404,'No encontrado.');
  const opts=req.headers.get('range')?{range:req.headers}:{};
  const obj=await env.MEDIA.get(name,opts);if(!obj)throw error(404,'No encontrado.');
  const headers=new Headers({'content-type':m.mime,'accept-ranges':'bytes','x-content-type-options':'nosniff','cache-control':'public, max-age=3600','etag':obj.httpEtag});
  const part=!!req.headers.get('range')&&obj.range;
  if(part)headers.set('content-range',`bytes ${obj.range.offset}-${obj.range.offset+obj.range.length-1}/${obj.size}`);
  headers.set('content-length',String(part?obj.range.length:obj.size));
  return new Response(req.method==='HEAD'?null:obj.body,{status:part?206:200,headers});
}
async function handler(request,env){
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith('/legal/'))return legalPage(path.slice(7));
  if(path==='/api/consent')return consentRequest(request,env);
  if(path==='/api/admin/privacy-receipts'&&request.method==='GET'){await verifyAuth(request,env);return privacyReport(env,url);}
  // The previous font file is quarantined from public builds pending a web license.
  if(path==='/static/media/19943b6e5746.woff2')return new Response('No encontrado',{status:404});
  if(path==='/'||path==='/index.html')return website(request,env);
  if(path==='/admin'){const u=new URL(request.url);u.pathname='/static/admin.html';const r=await env.ASSETS.fetch(new Request(u));return new Response(r.body,{status:r.status,headers:{...Object.fromEntries(r.headers),'cache-control':'no-store','x-frame-options':'DENY'}});}
  if(path==='/api/health')return jresp({ok:true,storage:'D1 + R2'});
  if(path==='/api/public')return jresp(publicData((await readState(env)).state));
  if(path==='/api/login'&&request.method==='POST')return login(request,env);
  if(path==='/api/logout'&&request.method==='POST'){originCheck(request);return jresp({ok:true},200,{'set-cookie':cookieHeader('',0)});}
  if(path==='/api/session'&&request.method==='GET'){const s=await verifyAuth(request,env);return jresp({authenticated:true,username:s.user});}
  if(path==='/api/admin/state'&&request.method==='GET'){await verifyAuth(request,env);return jresp(adminState((await readState(env)).state));}
  if(path==='/api/admin/storage'&&request.method==='GET')return storageStatus(request,env);
  if(path==='/api/analytics'&&request.method==='POST')return collect(request,env);
  if(path==='/api/admin/analytics'&&request.method==='GET'){await verifyAuth(request,env);return jresp(await report(env,url.searchParams.get('days')));}
  if(path==='/api/admin/upload'&&request.method==='POST')return uploadFile(request,env);
  if(path.startsWith('/api/admin/'))return adminCrud(request,env,path);
  if(path.startsWith('/uploads/'))return mediaRequest(request,env,path.slice('/uploads/'.length));
  if(path.startsWith('/api/'))throw error(404,'Ruta no encontrada.');
  return staticAsset(request,env,path);
}
// Archivos con hash en el nombre (build de Angular y /static/media extraídos):
// su contenido nunca cambia, el navegador puede guardarlos un año.
const IMMUTABLE_ASSET=/(?:-[A-Z0-9]{8}\.(?:js|css)|^\/static\/media\/[0-9a-f]{12}\.[a-z0-9]+)$/;
async function staticAsset(request,env,path){
  const res=await env.ASSETS.fetch(request);
  if(!res.ok||!IMMUTABLE_ASSET.test(path))return res;
  const out=new Response(res.body,res);
  out.headers.set('cache-control','public, max-age=31536000, immutable');
  return out;
}
export default {async scheduled(event,env,ctx){ctx.waitUntil(purgePrivacy(env));},async fetch(request,env){try{return await handler(request,env);}catch(e){const st=e.status||500; if(st>=500)console.error('Jerath CMS:',e);return jresp({detail:st>=500?'Error del servidor. Revisa los logs de Workers.':e.message},st);}}};
