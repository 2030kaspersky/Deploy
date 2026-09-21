import {useEffect,useMemo,useState} from 'react';
import {Flag,Menu,X} from 'lucide-react';
import {Item,loadPublic,loadPublicAnalytics,PublicAnalytics,trackAnalytics} from './api';
import {Home} from './Home';
import {Submit} from './Submit';
import {Gallery} from './Gallery';
import {Admin} from './Admin';
import {Modal} from './Modal';

export default function App(){
  const [view,setView]=useState<'home'|'submit'|'gallery'|'admin'>('home');
  const [items,setItems]=useState<Item[]>([]);
  const [selected,setSelected]=useState<Item|null>(null);
  const [filter,setFilter]=useState('الكل');
  const [search,setSearch]=useState('');
  const [mobileOpen,setMobileOpen]=useState(false);
  const [publicAnalytics,setPublicAnalytics]=useState<PublicAnalytics>({total_visitors:0,total_pageviews:0,online_now:0});

  async function refresh(){setItems(await loadPublic());}
  useEffect(()=>{refresh().catch(()=>setItems([]));loadPublicAnalytics().then(setPublicAnalytics).catch(()=>{});},[]);
  useEffect(()=>{trackAnalytics('page_view',view);},[view]);
  useEffect(()=>{const t=setInterval(()=>{trackAnalytics('heartbeat',view);loadPublicAnalytics().then(setPublicAnalytics).catch(()=>{});},45000);return()=>clearInterval(t);},[view]);

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
        <div className="flex items-center gap-2">
          <button onClick={()=>setView('submit')} className="rounded-xl bg-[#0c6b4b] px-3 py-2.5 text-xs font-black text-white sm:px-4 sm:text-sm">رفع مشاركة</button>
          <button
            onClick={()=>setMobileOpen(v=>!v)}
            className="grid h-10 w-10 place-items-center rounded-xl bg-white text-[#12392d] shadow-sm md:hidden"
            aria-label="فتح القائمة"
          >
            {mobileOpen?<X size={21}/>:<Menu size={21}/>}
          </button>
        </div>
      </div>

      {mobileOpen&&<div className="border-t border-white/70 bg-[#f4f1e8] px-4 pb-4 pt-3 md:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-2">
          {([['home','الرئيسية'],['gallery','معرض الإبداع'],['submit','شارك بإبداعك'],['admin','الإدارة']] as const).map(([k,l])=>
            <button
              key={k}
              onClick={()=>{setView(k);setMobileOpen(false);}}
              className={`rounded-xl px-3 py-3 text-sm font-black ${view===k?'bg-[#0c6b4b] text-white':'bg-white text-[#12392d]'}`}
            >
              {l}
            </button>
          )}
        </div>
      </div>}
    </header>

    {view==='home'&&<Home count={items.length} featured={featured.slice(0,4)} go={setView} open={(i)=>{setSelected(i);trackAnalytics('item_view','home',i.id);}} analytics={publicAnalytics}/>}
    {view==='submit'&&<Submit after={async()=>{await refresh();setView('home');}}/>}
    {view==='gallery'&&<Gallery items={visible} filter={filter} setFilter={setFilter} search={search} setSearch={setSearch} open={(i)=>{setSelected(i);trackAnalytics('item_view','gallery',i.id);}}/>}
    {view==='admin'&&<Admin/>}
    {selected&&<Modal item={selected} close={()=>setSelected(null)}/>}

    <footer className="mt-14 bg-[#113b2f] text-white">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-2">
        <div><b>المملكة العربية السعودية · وزارة التعليم</b><div className="mt-1 text-sm opacity-70">الإدارة العامة للتعليم بمنطقة نجران · ابتدائية خالد بن الوليد</div></div>
        <div className="md:text-left"><b>مسؤول نظام نور: الحسن علي ماطر مدخلي</b><div className="text-sm opacity-70">مدير المدرسة: منصور ناصر الشمراني</div></div>
      </div>
    </footer>
  </div>
}