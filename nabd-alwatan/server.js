'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const PORT=Number(process.env.PORT||3000);
const HOST=process.env.HOST||'0.0.0.0';
const password=process.env.ADMIN_PASSWORD;
if(!password||password.length<12){console.error('ADMIN_PASSWORD must be at least 12 characters');process.exit(1);}
const dir=path.resolve(process.env.DATA_DIR||path.join(__dirname,'data'));
fs.mkdirSync(dir,{recursive:true,mode:0o700});
const stateFile=path.join(dir,'state.json');
let db={next:1,pulses:[],duas:{},audit:[]};
if(fs.existsSync(stateFile)){try{db=JSON.parse(fs.readFileSync(stateFile,'utf8'));}catch(e){console.error('Corrupt database, aborting safely:',e);process.exit(1);}}
db.pulses=db.pulses||[];db.duas=db.duas||{};db.audit=db.audit||[];
db.next=Math.max(Number(db.next)||1,...db.pulses.map(p=>(p.seq||0)+1));
const sessions=new Map(),rate=new Map(),salt=crypto.randomBytes(16),hash=crypto.scryptSync(password,salt,64);
function persist(){const tmp=stateFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db),{mode:0o600});fs.renameSync(tmp,stateFile);}
function reply(res,body,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});res.end(JSON.stringify(body));}
function fail(res,code,msg){reply(res,{error:msg},code);}
function cookies(req){const o={};for(const c of (req.headers.cookie||'').split(';')){const i=c.indexOf('=');if(i>0){try{o[c.slice(0,i).trim()]=decodeURIComponent(c.slice(i+1));}catch{}}}return o;}
function cookie(req,key,val,ttl){const ssl=process.env.COOKIE_SECURE==='1'||req.socket.encrypted;return key+'='+encodeURIComponent(val)+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+ttl+(ssl?'; Secure':'');}
function visitor(req,res){const v=cookies(req).nabd_v;if(v&&/^[a-f0-9]{48}$/.test(v))return v;const x=crypto.randomBytes(24).toString('hex');res.setHeader('Set-Cookie',cookie(req,'nabd_v',x,31536000));return x;}
function owner(req){const t=cookies(req).nabd_admin;const e=sessions.get(t);if(!e)return false;if(e<Date.now()){sessions.delete(t);return false;}return true;}
function safe(p,admin=false){return {id:p.id,seq:p.seq,city:p.city,country:p.country,lon:p.lon,lat:p.lat,cat:p.cat,card:p.card,ts:p.ts,msg:p.approval==='approved'?p.msg:'',msgApproved:p.approval==='approved',name:'',...(admin?{reviewStatus:p.approval,submittedMessage:p.msg,name:p.name}:{})};}
function normalize(v,n){return String(v||'').replace(/[<>\x00-\x1f]/g,'').replace(/\s+/g,' ').trim().slice(0,n);}
function bad(v){return /https?:|www\.|\.com\b|\.net\b|@|[0-9٠-٩]{6,}/i.test(v);}
const allowedCats=new Set(['student','teacher','parent','citizen','resident','abroad']);
function limit(req,res,key,max,ms){const id=key+':'+(req.socket.remoteAddress||'unknown'),now=Date.now();let v=rate.get(id)||{at:now,n:0};if(now-v.at>ms)v={at:now,n:0};v.n++;rate.set(id,v);if(v.n>max){fail(res,429,'تم تجاوز الحد المسموح مؤقتًا.');return true;}return false;}
function input(req){return new Promise((resolve,reject)=>{const parts=[];let n=0;req.on('data',b=>{n+=b.length;if(n>8192){reject(Error('Too large'));req.destroy();}else parts.push(b);});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString()||'{}'));}catch{reject(Error('Invalid JSON'));}});req.on('error',reject);});}
function admin(req,res){if(!owner(req)){fail(res,401,'يلزم دخول مدير المنصة.');return false;}return true;}
function csv(v){let s=String(v??'');if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
async function route(req,res){
 const url=new URL(req.url,'http://localhost'),p=url.pathname,m=req.method;
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
 if(!['GET','HEAD','OPTIONS'].includes(m)&&req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{return fail(res,403,'مصدر غير صالح');}if(origin.host!==req.headers.host)return fail(res,403,'مصدر غير مصرح به');}
 if(p==='/api/health'&&m==='GET')return reply(res,{ok:true,version:2});
 if(p==='/api/state'&&m==='GET'){
  const v=visitor(req,res),isOwner=owner(req),mine=db.pulses.find(x=>x.visitor===v);
  return reply(res,{pulses:db.pulses.map(x=>safe(x)),me:mine?safe(mine,true):null,myDuas:db.duas[v]||0,duas:Object.values(db.duas).reduce((a,n)=>a+(Number(n)||0),0),owner:isOwner,pending:isOwner?db.pulses.filter(x=>x.msg&&x.approval==='pending').map(x=>safe(x,true)):[]});
 }
 if(p==='/api/pulses'&&m==='POST'){
  if(limit(req,res,'pulse',15,3600000))return;
  const v=visitor(req,res),x=await input(req),city=normalize(x.city,40),country=normalize(x.country,40),cat=normalize(x.cat,24),msg=normalize(x.msg,120),name=normalize(x.name,20),lon=Number(x.lon),lat=Number(x.lat),card=Number(x.card);
  if(!city||!country||!allowedCats.has(cat)||!Number.isInteger(card)||card<0||card>9||!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90||bad(msg)||bad(name))return fail(res,400,'يرجى مراجعة بيانات المشاركة.');
  let pulse=db.pulses.find(x=>x.visitor===v),isNew=!pulse;
  if(!pulse){pulse={id:crypto.randomUUID(),visitor:v,seq:db.next++,ts:Date.now()};db.pulses.push(pulse);}
  const changed=pulse.msg!==msg;
  Object.assign(pulse,{city,country,cat,msg,name,lon,lat,card,updatedAt:Date.now()});
  if(changed||isNew)pulse.approval=msg?'pending':'none';
  db.audit.push({at:Date.now(),action:isNew?'new_pulse':'edit_pulse',seq:pulse.seq});
  persist();return reply(res,{ok:true,me:safe(pulse,true),isNew});
 }
 if(p==='/api/dua'&&m==='POST'){
  if(limit(req,res,'dua',60,60000))return;
  const v=visitor(req,res);db.duas[v]=Math.min(10000,(db.duas[v]||0)+1);persist();
  return reply(res,{mine:db.duas[v],total:Object.values(db.duas).reduce((a,n)=>a+Number(n||0),0)});
 }
 if(p==='/api/admin/login'&&m==='POST'){
  if(limit(req,res,'login',8,900000))return;
  const x=await input(req),candidate=crypto.scryptSync(String(x.password||''),salt,64);
  if(!crypto.timingSafeEqual(candidate,hash))return fail(res,401,'كلمة المرور غير صحيحة.');
  const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);
  res.setHeader('Set-Cookie',cookie(req,'nabd_admin',token,28800));
  db.audit.push({at:Date.now(),action:'admin_login'});persist();return reply(res,{ok:true});
 }
 if(p==='/api/admin/logout'&&m==='POST'){
  sessions.delete(cookies(req).nabd_admin);res.setHeader('Set-Cookie',cookie(req,'nabd_admin','',0));return reply(res,{ok:true});
 }
 if(p==='/api/admin/approve'&&m==='POST'){
  if(!admin(req,res))return;
  const x=await input(req),pulse=db.pulses.find(v=>v.id===x.id);
  if(!pulse||!pulse.msg||typeof x.ok!=='boolean')return fail(res,400,'قرار غير صالح');
  pulse.approval=x.ok?'approved':'rejected';pulse.reviewedAt=Date.now();
  db.audit.push({at:Date.now(),action:pulse.approval,seq:pulse.seq});persist();return reply(res,{ok:true});
 }
 if(p==='/api/admin/export'&&m==='GET'){
  if(!admin(req,res))return;
  const rows=[['رقم المشاركة','المدينة','الدولة','الفئة','الرسالة الجاهزة','الرسالة المكتوبة','حالة المراجعة','التاريخ'],...db.pulses.map(x=>[x.seq,x.city,x.country,x.cat,x.card+1,x.msg,x.approval,new Date(x.ts).toISOString()])];
  res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="nabd-pulses.csv"','Cache-Control':'no-store'});return res.end('\uFEFF'+rows.map(r=>r.map(csv).join(',')).join('\r\n'));
 }
 if(p.startsWith('/api/'))return fail(res,404,'مسار غير موجود');
 if(!['GET','HEAD'].includes(m))return fail(res,405,'طريقة غير مسموحة');
 if(p!=='/'&&p!=='/index.html'){res.writeHead(404);return res.end('Not found');}
 const src=path.join(__dirname,'index.html');
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
 if(m==='HEAD')return res.end();fs.createReadStream(src).pipe(res);
}
http.createServer((req,res)=>Promise.resolve(route(req,res)).catch(e=>{console.error(e);if(!res.headersSent)fail(res,500,'خطأ في الخادم');else res.end();})).listen(PORT,HOST,()=>console.log('Nabd Alwatan listening on '+HOST+':'+PORT));
