export type Status='pending'|'approved'|'rejected';
export type Item={id:string;student_name:string;grade:string;class_name:string;category:string;title:string;description:string;file_name:string;mime_type:string;storage_path:string;one_drive_path:string;status:Status;featured:boolean;hidden:boolean;created_at:string;approved_at?:string|null;file_url?:string|null};

export const SB=import.meta.env.VITE_SUPABASE_URL as string;
export const KEY=import.meta.env.VITE_SUPABASE_ANON_KEY as string;
export const BUCKET='watan96v2';
export const categories=['رسم','تصميم رقمي','تصوير','فيديو','قصيدة','قصة','عمل فني','مبادرة وطنية','أخرى'];
export const grades=['الأول الابتدائي','الثاني الابتدائي','الثالث الابتدائي','الرابع الابتدائي','الخامس الابتدائي','السادس الابتدائي'];
export const classes=['1','2','3'];

export function headers(extra:Record<string,string>={}){return {apikey:KEY,Authorization:'Bearer '+KEY,...extra};}
export function ep(p:string){return p.split('/').map(encodeURIComponent).join('/');}
export function safe(s:string){return String(s||'').replace(/[\\/:*?"<>|]+/g,'-').trim().slice(0,90);}

export async function loadPublic():Promise<Item[]>{
  const r=await fetch(`${SB}/rest/v1/watan96v2_submissions?select=*&status=eq.approved&hidden=eq.false&order=created_at.desc&limit=200`,{headers:headers()});
  if(!r.ok)throw new Error('تعذر تحميل المعرض');
  const rows=await r.json();
  return rows.map((x:Item)=>({...x,file_url:`${SB}/functions/v1/watan96v2-file?id=${encodeURIComponent(x.id)}`}));
}

export async function rpc(name:string,payload:Record<string,unknown>){
  const r=await fetch(`${SB}/rest/v1/rpc/${name}`,{method:'POST',headers:headers({'content-type':'application/json'}),body:JSON.stringify(payload)});
  const text=await r.text();
  if(!r.ok)throw new Error(text||'rpc_failed');
  return text?JSON.parse(text):null;
}


export async function adminDelete(password:string,id:string){
  const r=await fetch(`${SB}/functions/v1/watan96v2-admin-delete`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({password,id})
  });
  const text=await r.text();
  if(!r.ok)throw new Error(text||'delete_failed');
  return text?JSON.parse(text):null;
}


export type PublicAnalytics={total_visitors:number;total_pageviews:number;online_now:number};
export type AnalyticsSummary={
  total_visitors:number;
  total_pageviews:number;
  online_now:number;
  today_visitors:number;
  week_visitors:number;
  month_visitors:number;
  avg_minutes:number;
  daily:{date:string;views:number;visitors:number}[];
  devices:{name:string;count:number}[];
  pages:{name:string;count:number}[];
  top_items:{id:string;title:string;student_name:string;views:number}[];
  sources:{name:string;count:number}[];
};

function ensureId(key:string,session=false){
  const store=session?sessionStorage:localStorage;
  let v=store.getItem(key);
  if(!v){
    v=(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));
    store.setItem(key,v);
  }
  return v;
}

function clientInfo(){
  const ua=navigator.userAgent||'';
  const deviceType=/Mobi|Android|iPhone|iPad/i.test(ua)?(/iPad|Tablet/i.test(ua)?'جهاز لوحي':'جوال'):'كمبيوتر';
  const browser=/Edg/i.test(ua)?'Edge':/Firefox/i.test(ua)?'Firefox':/Chrome/i.test(ua)?'Chrome':/Safari/i.test(ua)?'Safari':'أخرى';
  const os=/Windows/i.test(ua)?'Windows':/Android/i.test(ua)?'Android':/iPhone|iPad|iOS/i.test(ua)?'iOS':/Mac OS/i.test(ua)?'macOS':'أخرى';
  let referrerDomain='';
  try{referrerDomain=document.referrer?new URL(document.referrer).hostname:'';}catch{}
  return {deviceType,browser,os,referrerDomain};
}

export async function trackAnalytics(eventType:'page_view'|'item_view'|'heartbeat',page?:string,itemId?:string){
  const info=clientInfo();
  const payload={
    action:'track',
    visitorId:ensureId('watan96v2-visitor'),
    sessionId:ensureId('watan96v2-session',true),
    eventType,
    page:page||null,
    itemId:itemId||null,
    ...info
  };
  try{
    await fetch(`${SB}/functions/v1/watan96v2-analytics`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(payload),
      keepalive:true
    });
  }catch{}
}

export async function loadPublicAnalytics():Promise<PublicAnalytics>{
  const r=await fetch(`${SB}/functions/v1/watan96v2-analytics`);
  if(!r.ok)throw new Error('analytics_failed');
  return r.json();
}

export async function loadAdminAnalytics(password:string):Promise<AnalyticsSummary>{
  const r=await fetch(`${SB}/functions/v1/watan96v2-analytics`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'admin_summary',password})
  });
  const text=await r.text();
  if(!r.ok)throw new Error(text||'analytics_failed');
  const data=JSON.parse(text);
  return data.summary as AnalyticsSummary;
}


export type MusicConfig={
  enabled:boolean;
  autoplay:boolean;
  loop:boolean;
  volume:number;
  title:string;
  has_file:boolean;
  stream_url:string|null;
  storage_path?:string|null;
  file_name?:string|null;
  mime_type?:string|null;
};

export async function loadMusicConfig():Promise<MusicConfig>{
  const r=await fetch(`${SB}/functions/v1/watan96v2-music`);
  if(!r.ok)throw new Error('music_config_failed');
  return r.json();
}

export async function adminGetMusic(password:string):Promise<MusicConfig>{
  const r=await fetch(`${SB}/functions/v1/watan96v2-music`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'admin_get',password})
  });
  const text=await r.text();
  if(!r.ok)throw new Error(text||'music_admin_failed');
  const data=JSON.parse(text);
  const c=data.config||{};
  return {
    enabled:!!c.enabled,
    autoplay:!!c.autoplay,
    loop:!!c.loop,
    volume:Number(c.volume||0.35),
    title:c.title||'الخلفية الموسيقية للمعرض',
    has_file:!!c.storage_path,
    stream_url:c.enabled&&c.storage_path?`${SB}/functions/v1/watan96v2-music?stream=1`:null,
    storage_path:c.storage_path||null,
    file_name:c.file_name||null,
    mime_type:c.mime_type||null
  };
}

export async function adminSaveMusic(password:string,config:{enabled:boolean;autoplay:boolean;loop:boolean;volume:number;title:string}){
  const r=await fetch(`${SB}/functions/v1/watan96v2-music`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'save',password,...config})
  });
  const text=await r.text();
  if(!r.ok)throw new Error(text||'music_save_failed');
  return text?JSON.parse(text):null;
}

export async function adminUploadMusic(password:string,file:File){
  const b64=await new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error);
    reader.onload=()=>resolve(String(reader.result||'').split(',')[1]||'');
    reader.readAsDataURL(file);
  });
  const r=await fetch(`${SB}/functions/v1/watan96v2-music`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'upload',password,fileName:file.name,mimeType:file.type||'audio/mpeg',fileContent:b64})
  });
  const text=await r.text();
  if(!r.ok)throw new Error(text||'music_upload_failed');
  return text?JSON.parse(text):null;
}

export async function adminRemoveMusic(password:string){
  const r=await fetch(`${SB}/functions/v1/watan96v2-music`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({action:'remove',password})
  });
  const text=await r.text();
  if(!r.ok)throw new Error(text||'music_remove_failed');
  return text?JSON.parse(text):null;
}
