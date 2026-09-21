import {useEffect,useMemo,useRef,useState} from 'react';
import {Flag,Menu,Music2,Volume2,VolumeX,X} from 'lucide-react';
import {Item,loadMusicConfig,loadPublic,loadPublicAnalytics,MusicConfig,PublicAnalytics,trackAnalytics} from './api';
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
  const [music,setMusic]=useState<MusicConfig|null>(null);
  const [musicPlaying,setMusicPlaying]=useState(false);
  const [musicBlocked,setMusicBlocked]=useState(false);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const resumeAfterMediaRef=useRef(false);

  async function refresh(){setItems(await loadPublic());}

  useEffect(()=>{
    refresh().catch(()=>setItems([]));
    loadPublicAnalytics().then(setPublicAnalytics).catch(()=>{});
    loadMusicConfig().then(setMusic).catch(()=>setMusic(null));
  },[]);

  useEffect(()=>{trackAnalytics('page_view',view);},[view]);

  useEffect(()=>{
    const t=setInterval(()=>{
      trackAnalytics('heartbeat',view);
      loadPublicAnalytics().then(setPublicAnalytics).catch(()=>{});
    },45000);
    return()=>clearInterval(t);
  },[view]);

  useEffect(()=>{
    const a=audioRef.current;
    if(!a||!music)return;
    a.volume=Math.max(0,Math.min(1,music.volume||0));
    a.loop=!!music.loop;

    if(!music.enabled||!music.has_file){
      a.pause();
      setMusicPlaying(false);
      return;
    }

    if(music.autoplay){
      const p=a.play();
      if(p&&typeof p.then==='function'){
        p.then(()=>{
          setMusicPlaying(true);
          setMusicBlocked(false);
        }).catch(()=>{
          setMusicPlaying(false);
          setMusicBlocked(true);
        });
      }
    }
  },[music]);

  useEffect(()=>{
    if(!musicBlocked)return;

    const resume=()=>{
      const a=audioRef.current;
      if(!a)return;
      a.play().then(()=>{
        setMusicPlaying(true);
        setMusicBlocked(false);
      }).catch(()=>{});
    };

    window.addEventListener('pointerdown',resume,{once:true});
    return()=>window.removeEventListener('pointerdown',resume);
  },[musicBlocked]);

  function pauseBackgroundForMedia(){
    const a=audioRef.current;
    if(!a)return;
    resumeAfterMediaRef.current=!a.paused;
    if(!a.paused){
      a.pause();
      setMusicPlaying(false);
    }
  }

  function resumeBackgroundAfterMedia(){
    const a=audioRef.current;
    if(!a||!music?.enabled||!music.has_file)return;
    if(resumeAfterMediaRef.current){
      resumeAfterMediaRef.current=false;
      a.play().then(()=>{
        setMusicPlaying(true);
        setMusicBlocked(false);
      }).catch(()=>setMusicBlocked(true));
    }
  }

  function toggleMusic(){
    const a=audioRef.current;
    if(!a)return;

    if(a.paused){
      a.play().then(()=>{
        setMusicPlaying(true);
        setMusicBlocked(false);
      }).catch(()=>setMusicBlocked(true));
    }else{
      a.pause();
      setMusicPlaying(false);
    }
  }

  const featured=items.filter(x=>x.featured);
  const visible=useMemo(
    ()=>items.filter(x=>(filter==='الكل'||x.category===filter)&&(!search||[x.student_name,x.title,x.grade,x.class_name].join(' ').includes(search))),
    [items,filter,search]
  );

  return <div dir="rtl" className="min-h-screen bg-[#f4f1e8] text-[#12392d]">
    {music?.enabled&&music.has_file&&music.stream_url&&<audio
      ref={audioRef}
      src={music.stream_url}
      loop={music.loop}
      muted={false}
      preload="auto"
      onPlay={()=>setMusicPlaying(true)}
      onPause={()=>setMusicPlaying(false)}
    />}

    {music?.enabled&&music.has_file&&<button
      onClick={toggleMusic}
      title={musicPlaying?'إيقاف الخلفية الموسيقية':'تشغيل الخلفية الموسيقية'}
      className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full bg-[#113b2f] px-4 py-3 text-sm font-black text-white shadow-2xl"
    >
      {musicPlaying?<Volume2 size={18}/>:<VolumeX size={18}/>}
      <span className="hidden sm:inline">{musicPlaying?'الموسيقى تعمل':'تشغيل الموسيقى'}</span>
      <Music2 size={16} className="text-[#e5c875]"/>
    </button>}

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
    {selected&&<Modal item={selected} close={()=>setSelected(null)} onMediaStart={pauseBackgroundForMedia} onMediaStop={resumeBackgroundAfterMedia}/>}

    <footer className="mt-14 bg-[#113b2f] text-white">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 md:grid-cols-2">
        <div><b>المملكة العربية السعودية · وزارة التعليم</b><div className="mt-1 text-sm opacity-70">الإدارة العامة للتعليم بمنطقة نجران · ابتدائية خالد بن الوليد</div></div>
        <div className="md:text-left"><b>مسؤول نظام نور: الحسن علي ماطر مدخلي</b><div className="text-sm opacity-70">مدير المدرسة: منصور ناصر الشمراني</div></div>
      </div>
    </footer>
  </div>
}