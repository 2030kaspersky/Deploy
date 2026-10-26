import test from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import crypto from "node:crypto";
const PORT=18778, ORIGIN='http://127.0.0.1:'+PORT;
const SEED=process.env.SEED_SECRET||'ci-only-secret-for-unit-tests-not-real';
function pwd(username){return crypto.createHmac('sha256',SEED).update(username).digest('base64url').slice(0,20)+'!';}
async function request(url,method='GET',body,cookie){
 const headers={Origin:ORIGIN};
 if(body!==undefined)headers['content-type']='application/json';
 if(cookie)headers.cookie=cookie;
 const r=await fetch(ORIGIN+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 const d=await r.json();
 return {status:r.status,body:d,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('isolated multi-role live handoff integration', {timeout:90000},async()=>{
 assert.ok(process.env.DATABASE_URL,'CI database must be explicitly present');
 const service=spawn(process.execPath,['server.js'],{cwd:process.cwd(),env:{...process.env,PORT:String(PORT),DEMO_ONLY:'1',PGSSL:'false',SEED_SECRET:SEED},stdio:'pipe'});
 let errors='';service.stderr.on('data',x=>errors+=String(x));
 try{
  let up=false;for(let i=0;i<100;i++){try{const x=await request('/api/health');if(x.status===200){up=true;break;}}catch{}await sleep(300)}
  assert.ok(up,'database ready, '+errors);
  const sessions={};
  for(const login of ['admin.demo','reception.demo','zone.demo','gate.demo']){
   const x=await request('/api/login','POST',{username:login,password:pwd(login)});
   assert.equal(x.status,200,login+' log in: '+JSON.stringify(x.body));
   sessions[login]=x.cookie;
  }
  const guest=await request('/api/state');assert.equal(guest.status,401);
  const before=await request('/api/state','GET',undefined,sessions['reception.demo']);
  assert.equal(before.status,200);assert.equal(before.body.students.length,18);
  let person=before.body.students.find(x=>x.code==='DEMO-1012');
  let family=await request('/api/family','POST',{code:'DEMO-1012'});
  assert.equal(family.status,200,JSON.stringify(family.body));
  family=await request('/api/family','POST',{code:'DEMO-1012'});
  assert.equal(family.status,409,'duplicate rejected');
  const state=await request('/api/state','GET',undefined,sessions['reception.demo']);
  let entry=state.body.requests.find(x=>x.student_id===person.id);
  assert.ok(entry?.onsite_pending);
  const execute=(who,action,payload={})=>request('/api/action','POST',{action,id:entry.id,...payload},sessions[who+'.demo']);
  let resp=await execute('zone','call');assert.equal(resp.status,409,'cannot call before arrival');
  resp=await execute('reception','onsite');assert.equal(resp.status,200);
  resp=await execute('reception','release');assert.equal(resp.status,403,'reception cannot release');
  resp=await execute('zone','call');assert.equal(resp.status,200);
  resp=await execute('zone','leave');assert.equal(resp.status,200);
  resp=await execute('zone','verify',{attested:true});assert.equal(resp.status,403);
  resp=await execute('gate','atgate');assert.equal(resp.status,200);
  resp=await execute('gate','release');assert.equal(resp.status,409,'cannot release without verification');
  resp=await execute('gate','verify',{attested:true});assert.equal(resp.status,200);
  resp=await execute('gate','release');assert.equal(resp.status,200);
  resp=await execute('gate','release');assert.equal(resp.status,409,'no repeated release');
  const after=await request('/api/state','GET',undefined,sessions['zone.demo']);
  const confirmed=after.body.requests.find(x=>x.id===entry.id);
  assert.equal(confirmed.status,'released');
  assert.ok(confirmed.completed_at && confirmed.verified_at);
  assert.ok(after.body.events.length>=7);
  const own=await request('/api/reset','POST',{},sessions['reception.demo']);assert.equal(own.status,403);
  const reset=await request('/api/reset','POST',{},sessions['admin.demo']);assert.equal(reset.status,200);
  console.log('PASS: multi-role login, 18 fictional students, API auth, family sync, atomic stages, physical verification, no duplicate release, audit and admin reset.');
 }finally{service.kill('SIGTERM');}
});
