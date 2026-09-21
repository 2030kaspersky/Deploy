import { useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, FileImage, Flag, ImagePlus, Medal, Search, ShieldCheck, Sparkles, Star, UploadCloud, XCircle } from 'lucide-react';

type Status = 'pending' | 'approved' | 'rejected';
type Item = {
  id:string; student_name:string; grade:string; class_name:string; category:string; title:string;
  description:string; file_name:string; mime_type:string; file_url?:string|null; one_drive_path:string;
  status:Status; featured:boolean; created_at:string;
};

const API='https://zodpkvssomalkxjzkpau.supabase.co/functions/v1/watan-nobde3-96-api';
const categories=['رسم','تصميم رقمي','تصوير','فيديو','قصيدة','قصة','عمل فني','مبادرة وطنية','أخرى'];
const grades=['الأول الابتدائي','الثاني الابتدائي','الثالث الابتدائي','الرابع الابتدائي','الخامس الابتدائي','السادس الابتدائي'];
const classes=['1','2','3'];

async function call(body:Record<string,unknown>){
  const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error||'request_failed');
  return data;
}
function toBase64(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');reader.onerror=reject;reader.readAsDataURL(file);});}

export default function App(){
  const [view,setView]=useState<'home'|'submit'|'gallery'|'admin'>('home');
  const [items,setItems]=useState<Item[]>([]);
  const [selected,setSelected]=useState<Item|null>(null);
  const [filter,setFilter]=useState('الكل');
  const [search,setSearch]=useState('');
  async function load(){const d=await call({action:'list_public'});setItems(d.items||[]);}
  useEffect(()=>{load().catch(()=>setItems([]));},[]);
  const featured=items.filter(x=>x.featured);
  const visible=useMemo(()=>items.filter(x=>(filter==='الكل'||x.category===filter)&&(!search||[x.student_name,x.title,x.grade,x.class_name].join(' ').includes(search))),[items,filter,search]);
  return <div dir="rtl" className="min-h-screen bg-[#f4f1e8] text-[#12392d]">
    <header className="sticky top-0 z-30 border-b border-white/60 bg-[#f4f1e8]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
        <button onClick={()=>setView('home')} className="flex items-center gap-3 text-right">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0c6b4b] text-white"><Flag size={21}/></div>
          <div><div className="text-xs font-bold text-[#728077]">ابتدائية خالد بن الوليد</div><div className="font-black">وطن نبدع له <span className="text-[#a67c2d]">96</span></div></div>
        </button>
        <nav className="hidden gap-1 md:flex">
          {([['home','الرئيسية'],['gallery','معرض الإبداع'],['submit','شارك بإبداعك'],['admin','الإدارة']] as const).map(([k,l])=><button key={k} onClick={()=>setView(k)} className={`rounded-xl px-4 py-2 text-sm font-black ${view===k?'bg-[#0c6b4b] text-white':'hover:bg-white'}`}>{l}</button>)}
        </nav>
        <button onClick={()=>setView('submit')} className="rounded-xl bg-[#0c6b4b] px-4 py-2.5 text-sm font-black text-white">رفع مشاركة</button>
      </div>
    </header>

    {view==='home'&&<Home count={items.length} featured={featured.slice(0,4)} go={setView} open={setSelected}/>}
    {view==='submit'&&<Submit after={async()=>{await load();setView('home');}}/>}
    {view==='gallery'&&<Gallery items={visible} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} open={setSelected}/>}
    {view==='admin'&&<Admin/>}
    {selected&&<Modal item={selected} close={()=>setSelected(null)}/>}
    <footer className="mt-14 bg-[#113b2f] text-white"><div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-2"><div><b>المملكة العربية السعودية · وزارة التعليم</b><div className="mt-1 text-sm opacity-70">الإدارة العامة للتعليم بمنطقة نجران · ابتدائية خالد بن الوليد</div></div><div className="md:text-left"><b>مسؤول نظام نور: الحسن علي ماطر مدخلي</b><div className="text-sm opacity-70">مدير المدرسة: منصور ناصر الشمراني</div></div></div></footer>
  </div>
}

function Home({count,featured,go,open}:{count:number;featured:Item[];go:(v:'home'|'submit'|'gallery'|'admin')=>void;open:(i:Item)=>void}){
  return <>
    <section className="hero"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.1fr_.9fr] lg:py-20">
      <div><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dac48e] bg-white/75 px-4 py-2 text-sm font-black"><Sparkles size={16}/> إبداعات طلابنا في حب الوطن</div>
      <h1 className="text-5xl font-black leading-tight md:text-7xl">وطن <span className="text-[#0c6b4b]">نبدع</span> له</h1>
      <p className="mt-5 max-w-2xl text-lg font-bold leading-9 text-[#52675d]">معرض رقمي تفاعلي يحتفي بإبداع طلاب ابتدائية خالد بن الوليد بمناسبة اليوم الوطني السعودي 96.</p>
      <div className="mt-8 flex gap-3"><button onClick={()=>go('submit')} className="rounded-2xl bg-[#0c6b4b] px-7 py-4 font-black text-white">شارك بإبداعك</button><button onClick={()=>go('gallery')} className="rounded-2xl bg-white px-7 py-4 font-black">استكشف المعرض</button></div>
      <div className="mt-10 grid max-w-xl grid-cols-3 gap-3"><Stat n={count} t="مشاركة معتمدة"/><Stat n={featured.length} t="إبداع مميز"/><Stat n={96} t="اليوم الوطني"/></div></div>
      <div className="relative min-h-[390px] rounded-[42px] bg-[#0c6b4b] p-8 text-white shadow-2xl"><div className="pattern absolute inset-0 opacity-20"/><div className="relative flex h-full flex-col justify-between rounded-[32px] border border-white/20 p-8"><div className="text-sm font-bold opacity-80">المملكة العربية السعودية · وزارة التعليم</div><div><div className="text-8xl font-black text-[#e5c875]">96</div><div className="mt-2 text-2xl font-black">عزنا بطبعنا</div></div><div className="text-sm font-bold opacity-80">الإدارة العامة للتعليم بمنطقة نجران · ابتدائية خالد بن الوليد</div></div></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-4 py-14"><div className="mb-7 flex items-end justify-between"><div><div className="eyebrow">مختارات المعرض</div><h2 className="text-3xl font-black">إبداعات تستحق الضوء</h2></div><button onClick={()=>go('gallery')} className="font-black text-[#0c6b4b]">عرض الكل ←</button></div>{featured.length?<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{featured.map(i=><Card key={i.id} item={i} open={()=>open(i)}/>)}</div>:<Empty text="ستظهر هنا المشاركات المميزة بعد اعتمادها."/>}</section>
  </>
}

function Submit({after}:{after:()=>void}){
  const [form,setForm]=useState({studentName:'',grade:'',className:'',category:'',title:'',description:''});
  const [file,setFile]=useState<File|null>(null); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
  const change=(k:string,v:string)=>setForm(s=>({...s,[k]:v}));
  async function submit(e:React.FormEvent){e.preventDefault();setMsg('');if(!file){setMsg('اختر ملف المشاركة.');return;}if(file.size>10*1024*1024){setMsg('الحد الأعلى 10MB.');return;}setBusy(true);try{await call({action:'submit',...form,fileName:file.name,mimeType:file.type||'application/octet-stream',fileContent:await toBase64(file)});setMsg('وصل إبداعك 🇸🇦 وستظهر المشاركة بعد اعتمادها.');setTimeout(after,1600);}catch{setMsg('تعذر حفظ المشاركة. أعد المحاولة.');}finally{setBusy(false);}}
  return <section className="mx-auto max-w-4xl px-4 py-12"><div className="mb-8 text-center"><div className="eyebrow">شارك بإبداعك</div><h1 className="text-4xl font-black">مشاركتك جزء من حكاية الوطن</h1></div><form onSubmit={submit} className="rounded-[32px] bg-white p-6 shadow-xl md:p-9"><div className="grid gap-5 md:grid-cols-2">
    <Field label="اسم الطالب"><input required value={form.studentName} onChange={e=>change('studentName',e.target.value)} placeholder="الاسم الثلاثي"/></Field>
    <Field label="الصف"><select required value={form.grade} onChange={e=>change('grade',e.target.value)}><option value="">اختر الصف</option>{grades.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="الفصل"><select required value={form.className} onChange={e=>change('className',e.target.value)}><option value="">اختر الفصل</option>{classes.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="نوع المشاركة"><select required value={form.category} onChange={e=>change('category',e.target.value)}><option value="">اختر النوع</option>{categories.map(x=><option key={x}>{x}</option>)}</select></Field>
    <Field label="عنوان المشاركة" wide><input required value={form.title} onChange={e=>change('title',e.target.value)} placeholder="مثال: وطني في عيوني"/></Field>
    <Field label="وصف مختصر" wide><textarea rows={4} value={form.description} onChange={e=>change('description',e.target.value)} placeholder="حدثنا عن فكرتك..."/></Field>
    <label className="md:col-span-2 cursor-pointer rounded-3xl border-2 border-dashed border-[#0c6b4b]/25 bg-[#f7faf7] p-8 text-center"><ImagePlus className="mx-auto mb-3 text-[#0c6b4b]" size={34}/><div className="font-black">{file?file.name:'اضغط لاختيار ملف المشاركة'}</div><div className="mt-1 text-sm font-bold text-[#75837c]">صور، PDF أو فيديو MP4 — حتى 10MB</div><input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
  </div>{msg&&<div className="mt-5 rounded-2xl bg-[#eef7f2] p-4 text-center font-black">{msg}</div>}<button disabled={busy} className="mt-6 w-full rounded-2xl bg-[#0c6b4b] py-4 font-black text-white disabled:opacity-50">{busy?'جارٍ الحفظ...':'إرسال المشاركة'}</button></form></section>
}

function Gallery({items,filter,setFilter,search,setSearch,open}:{items:Item[];filter:string;setFilter:(s:string)=>void;search:string;setSearch:(s:string)=>void;open:(i:Item)=>void}){
  return <section className="mx-auto max-w-7xl px-4 py-12"><div className="mb-8"><div className="eyebrow">معرض الإبداع الطلابي</div><h1 className="text-4xl font-black">إبداع وطني.. بأيدي طلابنا</h1></div><div className="mb-7 flex flex-col gap-4 rounded-3xl bg-white p-4 lg:flex-row"><div className="relative flex-1"><Search className="absolute right-4 top-3.5 text-[#789086]" size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-2xl bg-[#f4f6f3] py-3 pr-11 pl-4 font-bold outline-none" placeholder="ابحث باسم الطالب أو المشاركة..."/></div><div className="flex gap-2 overflow-x-auto">{['الكل',...categories].map(x=><button key={x} onClick={()=>setFilter(x)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-black ${filter===x?'bg-[#0c6b4b] text-white':'bg-[#f4f6f3]'}`}>{x}</button>)}</div></div>{items.length?<div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">{items.map(i=><div key={i.id} className="mb-5 break-inside-avoid"><Card item={i} open={()=>open(i)}/></div>)}</div>:<Empty text="لا توجد مشاركات مطابقة حتى الآن."/>}</section>
}

function Admin(){
  const [password,setPassword]=useState(()=>sessionStorage.getItem('watan96-admin')||''); const [items,setItems]=useState<Item[]>([]); const [msg,setMsg]=useState(''); const [busy,setBusy]=useState(false);
  async function load(){setBusy(true);try{const d=await call({action:'admin_list',password});sessionStorage.setItem('watan96-admin',password);setItems(d.items||[]);setMsg('');}catch{setMsg('رمز الإدارة غير صحيح أو تعذر الاتصال.');}finally{setBusy(false);}}
  async function act(id:string,command:'approve'|'reject'|'feature'){await call({action:'admin_action',password,id,command});await load();}
  const pending=items.filter(x=>x.status==='pending'), approved=items.filter(x=>x.status==='approved');
  return <section className="mx-auto max-w-7xl px-4 py-12"><div className="mb-8"><div className="eyebrow">لوحة الإدارة</div><h1 className="text-4xl font-black">مركز إدارة المعرض</h1></div><div className="mb-6 grid gap-3 rounded-3xl bg-white p-5 md:grid-cols-[1fr_auto]"><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="rounded-2xl border px-4 py-3 font-bold" placeholder="رمز إدارة المعرض"/><button onClick={load} className="rounded-2xl bg-[#0c6b4b] px-6 py-3 font-black text-white">{busy?'جارٍ الدخول...':'فتح الإدارة'}</button>{msg&&<div className="md:col-span-2 text-sm font-black text-red-700">{msg}</div>}</div>
  {items.length>0&&<><div className="mb-6 grid gap-4 md:grid-cols-4"><Dash n={items.length} t="كل المشاركات"/><Dash n={pending.length} t="بانتظار الاعتماد"/><Dash n={approved.length} t="معتمدة"/><Dash n={approved.filter(x=>x.featured).length} t="مميزة"/></div><div className="overflow-x-auto rounded-3xl bg-white shadow"><table className="w-full min-w-[900px] text-right text-sm"><thead className="bg-[#f5f6f2]"><tr><th>الطالب</th><th>المشاركة</th><th>الحالة</th><th>OneDrive</th><th>الإجراءات</th></tr></thead><tbody>{items.map(i=><tr key={i.id} className="border-t"><td><b>{i.student_name}</b><div className="text-xs text-slate-500">{i.grade} · {i.class_name}</div></td><td><b>{i.title}</b><div className="text-xs text-slate-500">{i.category}</div></td><td><StatusBadge s={i.status}/></td><td className="max-w-[280px] truncate text-xs">{i.one_drive_path}</td><td><div className="flex gap-2">{i.status==='pending'&&<><button onClick={()=>act(i.id,'approve')} className="icon-btn text-green-700"><CheckCircle2 size={18}/></button><button onClick={()=>act(i.id,'reject')} className="icon-btn text-red-700"><XCircle size={18}/></button></>}{i.status==='approved'&&<button onClick={()=>act(i.id,'feature')} className={`icon-btn ${i.featured?'text-amber-600':''}`}><Star size={18}/></button>}</div></td></tr>)}</tbody></table></div></>}</section>
}

function Card({item,open}:{item:Item;open:()=>void}){return <button onClick={open} className="group w-full overflow-hidden rounded-[26px] bg-white text-right shadow-md transition hover:-translate-y-1 hover:shadow-xl"><div className="relative aspect-[4/3] overflow-hidden bg-[#e7eee9]">{item.file_url&&item.mime_type.startsWith('image/')?<img src={item.file_url} className="h-full w-full object-cover"/>:<div className="grid h-full place-items-center"><FileImage size={44} className="text-[#0c6b4b]"/></div>}{item.featured&&<div className="absolute right-3 top-3 rounded-full bg-[#d3a64a] px-3 py-1 text-xs font-black text-white"><Award size={13} className="ml-1 inline"/> مميزة</div>}</div><div className="p-5"><div className="text-xs font-black text-[#9a742b]">{item.category}</div><div className="mt-1 text-lg font-black">{item.title}</div><div className="mt-3 text-xs font-bold text-[#73817a]">{item.student_name} · {item.grade.replace(' الابتدائي','')}</div></div></button>}
function Modal({item,close}:{item:Item;close:()=>void}){return <div onClick={close} className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"><div onClick={e=>e.stopPropagation()} className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[32px] bg-white p-6"><div className="mb-4 flex justify-between"><div><div className="text-xs font-black text-[#9a742b]">{item.category}</div><h3 className="text-2xl font-black">{item.title}</h3></div><button onClick={close} className="icon-btn"><XCircle/></button></div><div className="overflow-hidden rounded-3xl bg-[#edf1ed]">{item.file_url&&item.mime_type.startsWith('image/')?<img src={item.file_url} className="max-h-[62vh] w-full object-contain"/>:item.file_url&&item.mime_type.startsWith('video/')?<video src={item.file_url} controls className="max-h-[62vh] w-full"/>:<div className="grid min-h-64 place-items-center"><a href={item.file_url||'#'} target="_blank" className="rounded-xl bg-[#0c6b4b] px-5 py-3 font-black text-white">فتح الملف</a></div>}</div><div className="mt-5"><b>{item.student_name}</b><div className="text-sm text-slate-500">{item.grade} · الفصل {item.class_name}</div><p className="mt-3 font-bold leading-7 text-slate-600">{item.description||'مشاركة وطنية إبداعية.'}</p></div></div></div>}
function Field({label,wide,children}:{label:string;wide?:boolean;children:React.ReactNode}){return <label className={wide?'md:col-span-2':''}><span className="mb-2 block text-sm font-black">{label}</span><div className="field">{children}</div></label>}
function Stat({n,t}:{n:number;t:string}){return <div className="rounded-2xl bg-white/70 p-4"><div className="text-2xl font-black text-[#0c6b4b]">{n}</div><div className="text-xs font-black text-[#69786f]">{t}</div></div>}
function Dash({n,t}:{n:number;t:string}){return <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-3xl font-black">{n}</div><div className="mt-2 text-sm font-black text-slate-500">{t}</div></div>}
function Empty({text}:{text:string}){return <div className="rounded-[28px] border border-dashed border-[#0c6b4b]/25 bg-white/60 p-12 text-center font-black text-[#718078]">{text}</div>}
function StatusBadge({s}:{s:Status}){const m={pending:['بانتظار الاعتماد','bg-amber-50 text-amber-700'],approved:['معتمدة','bg-green-50 text-green-700'],rejected:['مرفوضة','bg-red-50 text-red-700']} as const;return <span className={`rounded-full px-3 py-1 text-xs font-black ${m[s][1]}`}>{m[s][0]}</span>}
