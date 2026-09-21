export type Status='pending'|'approved'|'rejected';
export type Item={id:string;student_name:string;grade:string;class_name:string;category:string;title:string;description:string;file_name:string;mime_type:string;storage_path:string;one_drive_path:string;status:Status;featured:boolean;created_at:string;approved_at?:string|null;file_url?:string|null};

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
  const r=await fetch(`${SB}/rest/v1/watan96v2_submissions?select=*&status=eq.approved&order=created_at.desc&limit=200`,{headers:headers()});
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
