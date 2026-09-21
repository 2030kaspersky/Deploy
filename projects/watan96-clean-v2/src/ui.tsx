import {Award,FileImage} from 'lucide-react';
import {Item,Status} from './api';

export function Card({item,open}:{item:Item;open:()=>void}){
  return <button onClick={open} className="group w-full overflow-hidden rounded-[26px] bg-white text-right shadow-md transition hover:-translate-y-1 hover:shadow-xl">
    <div className="relative aspect-[4/3] overflow-hidden bg-[#e7eee9]">
      {item.file_url&&item.mime_type.startsWith('image/')?<img src={item.file_url} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center"><FileImage size={44} className="text-[#0c6b4b]"/></div>}
      {item.featured&&<div className="absolute right-3 top-3 rounded-full bg-[#d3a64a] px-3 py-1 text-xs font-black text-white"><Award size={13} className="ml-1 inline"/> مميزة</div>}
    </div>
    <div className="p-5"><div className="text-xs font-black text-[#9a742b]">{item.category}</div><div className="mt-1 text-lg font-black">{item.title}</div><div className="mt-3 text-xs font-bold text-[#73817a]">{item.student_name} · {item.grade.replace(' الابتدائي','')}</div></div>
  </button>
}
export function Field({label,wide,children}:{label:string;wide?:boolean;children:React.ReactNode}){return <label className={wide?'md:col-span-2':''}><span className="mb-2 block text-sm font-black">{label}</span><div className="field">{children}</div></label>}
export function Stat({n,t}:{n:number;t:string}){return <div className="rounded-2xl bg-white/70 p-4"><div className="text-2xl font-black text-[#0c6b4b]">{n}</div><div className="text-xs font-black text-[#69786f]">{t}</div></div>}
export function Dash({n,t}:{n:number;t:string}){return <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-3xl font-black">{n}</div><div className="mt-2 text-sm font-black text-slate-500">{t}</div></div>}
export function Empty({text}:{text:string}){return <div className="rounded-[28px] border border-dashed border-[#0c6b4b]/25 bg-white/60 p-12 text-center font-black text-[#718078]">{text}</div>}
export function StatusBadge({s}:{s:Status}){const m={pending:['بانتظار الاعتماد','bg-amber-50 text-amber-700'],approved:['معتمدة','bg-green-50 text-green-700'],rejected:['مرفوضة','bg-red-50 text-red-700']} as const;return <span className={`rounded-full px-3 py-1 text-xs font-black ${m[s][1]}`}>{m[s][0]}</span>}
