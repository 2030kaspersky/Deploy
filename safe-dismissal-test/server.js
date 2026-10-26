import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app=express();
app.disable('x-powered-by'); app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'16kb'})); app.use(cookieParser());
const isDemo=process.env.DEMO_ONLY==='1';
if(!isDemo){throw Error('Fail closed: this service is DEMO_ONLY=1 only');}
const pool=process.env.DATABASE_URL?new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='false'?false:{rejectUnauthorized:false},max:5,connectionTimeoutMillis:8000}):null;
let dbReady=false;
const ROLES=['admin','principal','lead','reception','zone','gate'];
const actions={
 create:['admin','lead','reception'], onsite:['admin','lead','reception','gate'],
 call:['admin','lead','zone'],leave:['admin','lead','zone'],
 atgate:['admin','lead','zone','gate'],verify:['admin','lead','gate'],
 release:['admin','lead','gate'],delay:['admin','lead','zone'],
 retry:['admin','lead','zone'],reject:['admin','lead','gate','principal'],
 cancel:['admin','lead','reception','principal']
};
const finalStatus=['released','rejected','cancelled'];
const logServer=(...args)=>console.log(new Date().toISOString(),...args);
const secureCookie=req=>req.secure||req.get('x-forwarded-proto')==='https';
const tokHash=(v)=>crypto.createHash('sha256').update(v).digest('hex');
function requireSameOrigin(req,res,next){
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
 const origin=req.get('origin');
 if(!origin)return res.status(403).json({error:'طلب غير موثوق: Origin مطلوب'});
 try{const u=new URL(origin);if(u.host!==req.get('host')||!['https:','http:'].includes(u.protocol))throw Error();}catch{return res.status(403).json({error:'طلب من مصدر غير مصرح'});}
 next();
}
app.use('/api',requireSameOrigin);
const fail=(res,status,error)=>res.status(status).json({error});
const jsonError=(e)=>String(e?.message||'خطأ').slice(0,140);
const db=async(sql,params=[])=>pool.query(sql,params);
const queryRows=async(sql,params=[])=>((await db(sql,params)).rows);
const dbRequired=(req,res,next)=>dbReady?next():fail(res,503,'بيئة الاختبار غير متصلة بقاعدة البيانات المستقلة بعد.');
app.get('/api/health',async(req,res)=>{
 let ready=dbReady;
 if(ready){try{await db('select 1')}catch{ready=false;dbReady=false;}}
 res.status(ready?200:503).json({service:'Miral safe dismissal test',demoOnly:true,databaseReady:ready,productionEnabled:false});
});
app.use('/api',dbRequired);
const slowLogin=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:'draft-7',legacyHeaders:false});
const slowFamily=rateLimit({windowMs:60*1000,limit:15,standardHeaders:'draft-7',legacyHeaders:false});
async function withTxn(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
function cookieOptions(req){return {httpOnly:true,secure:secureCookie(req),sameSite:'strict',path:'/',maxAge:8*3600*1000};}
async function session(req,res,next){
 const sid=req.cookies?.safe_demo_sid;if(!sid)return fail(res,401,'يتطلب دخول الموظفة.');
 try{
 const rows=await queryRows("SELECT s.user_id,u.username,u.role,u.display_name FROM demo_sessions s JOIN demo_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",[tokHash(sid)]);
 if(!rows.length)return fail(res,401,'انتهت الجلسة، يرجى تسجيل الدخول.');
 req.actor=rows[0];next();
 }catch{fail(res,503,'تعذر التحقق من الجلسة');}
}
app.post('/api/login',slowLogin,async(req,res)=>{
 const username=String(req.body.username||'').trim().toLowerCase().slice(0,80);
 const password=String(req.body.password||'');
 if(!username||password.length<12||password.length>128)return fail(res,400,'بيانات الدخول غير صحيحة');
 try{
 const rows=await queryRows('SELECT * FROM demo_users WHERE username=$1 AND active=true',[username]);
 const user=rows[0];const valid=user?await bcrypt.compare(password,user.password_hash):false;
 if(!valid)return fail(res,401,'اسم المستخدم أو كلمة المرور غير صحيحين');
 const token=crypto.randomBytes(32).toString('hex');
 await db("INSERT INTO demo_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",[tokHash(token),user.id]);
 res.cookie('safe_demo_sid',token,cookieOptions(req));
 return res.json({ok:true,account:{username:user.username,role:user.role,name:user.display_name}});
 }catch(e){logServer('login error:',e.code||e.name);return fail(res,503,'تعذر تسجيل الدخول');}
});
app.post('/api/logout',async(req,res)=>{
 const token=req.cookies?.safe_demo_sid; if(token)try{await db('DELETE FROM demo_sessions WHERE token_hash=$1',[tokHash(token)]);}catch{}
 res.clearCookie('safe_demo_sid',{path:'/',sameSite:'strict',secure:secureCookie(req)}).json({ok:true});
});
app.get('/api/state',session,async(req,res)=>{
 try{
 const [students,requests,events]=await Promise.all([
 queryRows('SELECT id,name,grade,section,zone,code,pickup FROM demo_students ORDER BY id'),
 queryRows("SELECT id,student_id,pickup,source,status,onsite_pending,verified_at,created_at,updated_at,completed_at,reason FROM demo_requests ORDER BY created_at DESC LIMIT 300"),
 queryRows("SELECT id,request_id,actor_role,event_type,detail,created_at FROM demo_events ORDER BY id DESC LIMIT 200")
 ]);
 res.set('Cache-Control','no-store').json({account:{username:req.actor.username,name:req.actor.display_name,role:req.actor.role},students,requests,events,demoOnly:true,refreshedAt:Date.now()});
 }catch(e){logServer('state error:',e.code||e.name);fail(res,503,'تعذر قراءة بيانات الاختبار');}
});
app.post('/api/family',slowFamily,async(req,res)=>{
 const code=String(req.body.code||'').trim().toUpperCase().slice(0,40);
 if(!/^DEMO-10\d{2}$/.test(code))return fail(res,400,'رمز العرض غير صحيح');
 try{await withTxn(async c=>{
 const s=(await c.query('SELECT * FROM demo_students WHERE code=$1 FOR UPDATE',[code])).rows[0];
 if(!s)throw Object.assign(Error('رمز العرض غير معروف'),{status:400});
 await createRequest(c,s,'family','النظام: نموذج ولي الأمر',true);
 });res.json({ok:true,message:'استُقبل الطلب التجريبي، وينتظر تأكيد حضور المستلم.'});}
 catch(e){return fail(res,e.status||409,e.status?e.message:'لا يمكن تسجيل الطلب؛ قد توجد عملية استلام سابقة للطالبة.');}
});
async function createRequest(client,s,source,actor,onsite){
 const duplicate=(await client.query("SELECT id FROM demo_requests WHERE student_id=$1 AND status NOT IN ('released','rejected','cancelled')",[s.id])).rows;
 const completed=(await client.query("SELECT id FROM demo_requests WHERE student_id=$1 AND status='released' AND created_at::date=current_date",[s.id])).rows;
 if(duplicate.length||completed.length)throw Object.assign(Error('طلب مكرر أو سبق التسليم'),{status:409});
 const x=(await client.query("INSERT INTO demo_requests(student_id,pickup,source,status,onsite_pending) VALUES($1,$2,$3,'requested',$4) RETURNING id",[s.id,s.pickup,source,onsite])).rows[0];
 await client.query('INSERT INTO demo_events(request_id,actor_role,event_type,detail) VALUES($1,$2,$3,$4)',[x.id,actor,'create',source]);
 return x.id;
}
app.post('/api/action',session,async(req,res)=>{
 const action=String(req.body.action||'');
 const role=req.actor.role;
 if(!actions[action]?.includes(role))return fail(res,403,'لا توجد صلاحية لهذا الدور.');
 const requestId=Number(req.body.id),sid=Number(req.body.studentId);
 const reason=String(req.body.reason||'').trim().slice(0,250);
 if(['delay','reject','cancel'].includes(action)&&reason.length<6)return fail(res,400,'سبب الإجراء إلزامي (ستة أحرف على الأقل).');
 try{
 const updatedId=await withTxn(async client=>{
  if(action==='create'){
   if(!Number.isSafeInteger(sid))throw Object.assign(Error('طالبة غير صالحة'),{status:400});
   const s=(await client.query('SELECT * FROM demo_students WHERE id=$1 FOR UPDATE',[sid])).rows[0];
   if(!s)throw Object.assign(Error('لا توجد طالبة'),{status:404});
   const pickup=String(req.body.pickup||'');
   if(pickup!=='authorized')throw Object.assign(Error('المستلم غير مخول'),{status:403});
   return await createRequest(client,s,'manual',role,false);
  }
  if(!Number.isSafeInteger(requestId))throw Object.assign(Error('رقم الطلب غير صالح'),{status:400});
  const r=(await client.query('SELECT * FROM demo_requests WHERE id=$1 FOR UPDATE',[requestId])).rows[0];
  if(!r)throw Object.assign(Error('الطلب غير موجود'),{status:404});
  if(finalStatus.includes(r.status))throw Object.assign(Error('طلب نهائي لا يمكن تعديله'),{status:409});
  const expected={onsite:'requested',call:'requested',leave:'called',atgate:'leaving_zone',verify:'at_gate',release:'at_gate',delay:'called',retry:'delayed'};
  if(expected[action]&&r.status!==expected[action])throw Object.assign(Error('لا يمكن تجاوز مراحل الطلب'),{status:409});
  if(action==='onsite'&&!r.onsite_pending)throw Object.assign(Error('لا يحتاج تأكيد حضور'),{status:409});
  if(action==='call'&&r.onsite_pending)throw Object.assign(Error('أكدي حضور المستلم أولًا'),{status:409});
  if(action==='verify'&&r.verified_at)throw Object.assign(Error('سبق تسجيل التحقق'),{status:409});
  if(action==='release'&&!r.verified_at)throw Object.assign(Error('لا تسليم دون فحص الهوية والتفويض'),{status:409});
  if(action==='verify'&&req.body.attested!==true)throw Object.assign(Error('يجب إقرار التحقق الافتراضي'),{status:400});
  const next={call:'called',leave:'leaving_zone',atgate:'at_gate',release:'released',delay:'delayed',retry:'called',reject:'rejected',cancel:'cancelled'}[action]||r.status;
  const verified=action==='verify'?'now()':'verified_at';
  const completed=action==='release'?'now()':'completed_at';
  await client.query("UPDATE demo_requests SET status=$1, onsite_pending=$2, verified_at="+verified+", completed_at="+completed+", reason=$3,updated_at=now() WHERE id=$4",[next,action==='onsite'?false:r.onsite_pending,reason||r.reason,requestId]);
  await client.query('INSERT INTO demo_events(request_id,actor_role,event_type,detail) VALUES($1,$2,$3,$4)',[requestId,role,action,reason]);
  return requestId;
 });
 res.json({ok:true,id:updatedId});
 }catch(e){logServer('action blocked',action,e.status||e.code||e.name);return fail(res,e.status||409,e.status?e.message:'لم يتم تنفيذ الإجراء؛ تحققي من حالته وصلاحياتك.');}
});
app.post('/api/reset',session,async(req,res)=>{
 if(req.actor.role!=='admin')return fail(res,403,'إعادة ضبط التجربة متاحة للمدير فقط');
 try{await withTxn(async c=>{await c.query('DELETE FROM demo_events');await c.query('DELETE FROM demo_requests');await c.query('ALTER SEQUENCE demo_requests_id_seq RESTART WITH 1');await c.query("INSERT INTO demo_events(actor_role,event_type,detail) VALUES('admin','reset','إعادة بدء سيناريو تجريبي')");});res.json({ok:true});}catch(e){logServer('reset failed',e.code||e.name);fail(res,503,'تعذر إعادة المحاكاة');}
});
const ROOT=path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(ROOT,'public'),{etag:true}));
app.get('*',(req,res)=>res.sendFile(path.join(ROOT,'public','index.html')));
async function migrate(){
 if(!pool){logServer('DATABASE_URL is not connected. Operations remain disabled.');return;}
 await pool.query('SELECT 1');
 await db("CREATE TABLE IF NOT EXISTS demo_users(id bigserial primary key,username text unique not null, display_name text not null,role text not null check(role IN ('admin','principal','lead','reception','zone','gate')),password_hash text not null,active boolean not null default true)");
 await db("CREATE TABLE IF NOT EXISTS demo_sessions(token_hash text primary key,user_id bigint NOT NULL REFERENCES demo_users(id),expires_at timestamptz not null)");
 await db("CREATE TABLE IF NOT EXISTS demo_students(id bigserial primary key,name text not null,grade text not null,section text not null,zone text not null,code text unique not null,pickup text not null)");
 await db("CREATE TABLE IF NOT EXISTS demo_requests(id bigserial primary key,student_id bigint NOT NULL REFERENCES demo_students(id),pickup text not null,source text not null check(source in ('manual','family')),status text not null check(status in ('requested','called','leaving_zone','at_gate','released','delayed','rejected','cancelled')),onsite_pending boolean not null default false,verified_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,reason text)");
 await db("CREATE UNIQUE INDEX IF NOT EXISTS demo_request_one_active ON demo_requests(student_id) WHERE status NOT IN ('released','rejected','cancelled')");
 await db("CREATE TABLE IF NOT EXISTS demo_events(id bigserial primary key,request_id bigint REFERENCES demo_requests(id) ON DELETE CASCADE,actor_role text not null,event_type text not null,detail text,created_at timestamptz not null default now())");
 const students=(await db('SELECT count(*)::int n FROM demo_students')).rows[0].n;
 if(!students){for(let i=1;i<=18;i++)await db('INSERT INTO demo_students(name,grade,section,zone,code,pickup) VALUES($1,$2,$3,$4,$5,$6)',[
  'طالبة تجريبية '+String(i).padStart(3,'0'),['الأول','الثاني','الثالث'][(i-1)%3]+' المتوسط',i%2?'أ':'ب',['أ','ب','ج'][(i-1)%3],'DEMO-'+(1000+i),'مستلم تجريبي '+String(i).padStart(3,'0')]);
 }
 if(!process.env.SEED_SECRET||process.env.SEED_SECRET.length<32)throw Error('SEED_SECRET must be configured; no accounts seeded.');
 const accounts=[['admin.demo','admin','مدير النظام'],['principal.demo','principal','مديرة المدرسة'],['lead.demo','lead','مسؤولة الانصراف'],['reception.demo','reception','موظفة الاستقبال'],['zone.demo','zone','مشرفة المنطقة'],['gate.demo','gate','مشرفة البوابة']];
 for(const [username,role,name] of accounts){
  const existing=(await db('SELECT id FROM demo_users WHERE username=$1',[username])).rows;
  if(existing.length)continue;
  const pwd=crypto.createHmac('sha256',process.env.SEED_SECRET).update(username).digest('base64url').slice(0,20)+'!';
  const hash=await bcrypt.hash(pwd,12);
  await db('INSERT INTO demo_users(username,role,display_name,password_hash) VALUES($1,$2,$3,$4)',[username,role,name,hash]);
 }
 await db('DELETE FROM demo_sessions WHERE expires_at<now()');
 dbReady=true;logServer('Isolated fictional test database ready; six staff accounts available.');
}
const port=Number(process.env.PORT)||10000;
app.listen(port,'0.0.0.0',()=>logServer('Listening on',port,'DEMO ONLY'));
migrate().catch(e=>{dbReady=false;logServer('Database unavailable; fail closed:',e.code||e.message);});
