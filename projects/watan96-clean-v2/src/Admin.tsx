import {useState} from 'react';
import {Activity,BarChart3,CheckCircle2,Clock3,Eye,EyeOff,Music2,Save,Star,Trash2,Upload,Users,XCircle} from 'lucide-react';
import {adminDelete,adminGetMusic,adminPreviewUrl,adminRemoveMusic,adminSaveMusic,adminUploadMusic,AnalyticsSummary,Item,loadAdminAnalytics,MusicConfig,rpc} from './api';
import {Dash,Empty,StatusBadge} from './ui';

export function Admin(){
  const [password,setPassword]=useState(()=>sessionStorage.getItem('watan96v2-admin')||'');
  const [items,setItems]=useState<Item[]>([]);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const [opened,setOpened]=useState(false);
  const [analytics,setAnalytics]=useState<AnalyticsSummary|null>(null);
  const [music,setMusic]=useState<MusicConfig|null>(null);
  const [musicBusy,setMusicBusy]=useState(false);
  const [musicMsg,setMusicMsg]=useState('');
  const [preview,setPreview]=useState<Item|null>(null);
  const [previewBusy,setPreviewBusy]=useState<string|null>(null);

  async function load(){
    setBusy(true);setMsg('');
    try{
      const data=await rpc('watan96v2_admin_list',{p_password:password});
      sessionStorage.setItem('watan96v2-admin',password);
      setItems(data||[]);setOpened(true);
      loadAdminAnalytics(password).then(setAnalytics).catch(()=>setAnalytics(null));
      adminGetMusic(password).then(setMusic).catch(()=>setMusic(null));
      setMsg((data||[]).length?'تم فتح الإدارة بنجاح.':'تم فتح الإدارة بنجاح — لا توجد مشاركات حاليًا.');
    }catch{
      setOpened(false);setItems([]);setAnalytics(null);setMusic(null);setMsg('رمز الإدارة غير صحيح.');
    }finally{setBusy(false);}
  }

  async function previewItem(item:Item){
    try{
      setPreviewBusy(item.id);
      const url=await adminPreviewUrl(password,item.id);
      setPreview({...item,file_url:url});
    }catch{
      setMsg('تعذر فتح معاينة المشاركة.');
    }finally{
      setPreviewBusy(null);
    }
  }

  async function act(id:string,command:'approve'|'reject'|'feature'|'hide'|'show'){
    try{
      await rpc('watan96v2_admin_action',{p_password:password,p_id:id,p_command:command});
      await load();
    }catch{setMsg('تعذر تنفيذ الإجراء.');}
  }

  const pending=items.filter(x=>x.status==='pending');
  const approved=items.filter(x=>x.status==='approved');
  const hidden=approved.filter(x=>x.hidden);

  return <section className="mx-auto max-w-7xl px-4 py-12">
    <div className="mb-8"><div className="eyebrow">لوحة الإدارة</div><h1 className="text-4xl font-black">مركز إدارة المعرض</h1></div>
    <div className="mb-6 grid gap-3 rounded-3xl bg-white p-5 md:grid-cols-[1fr_auto]">
      <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')load();}} className="rounded-2xl border px-4 py-3 font-bold" placeholder="رمز إدارة المعرض"/>
      <button onClick={load} disabled={busy} className="rounded-2xl bg-[#0c6b4b] px-6 py-3 font-black text-white">{busy?'جارٍ التحقق...':'فتح الإدارة'}</button>
      {msg&&<div className={`md:col-span-2 rounded-xl p-3 text-sm font-black ${opened?'bg-green-50 text-green-800':'bg-red-50 text-red-700'}`}>{msg}</div>}
    </div>

    {opened&&<>
      <div className="mb-6 grid gap-4 md:grid-cols-5"><Dash n={items.length} t="كل المشاركات"/><Dash n={pending.length} t="بانتظار الاعتماد"/><Dash n={approved.length} t="معتمدة"/><Dash n={hidden.length} t="مخفية"/><Dash n={approved.filter(x=>x.featured).length} t="مميزة"/></div>

      <div className="mb-8 rounded-3xl bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <div className="eyebrow">الخلفية الموسيقية</div>
            <h2 className="flex items-center gap-2 text-2xl font-black"><Music2 size={22}/> إدارة موسيقى المعرض</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">يمكن رفع ملف صوتي وتفعيل التشغيل التلقائي والتحكم في مستوى الصوت والتكرار.</p>
          </div>
          {music?.file_name&&<div className="rounded-2xl bg-[#f5f6f2] px-4 py-3 text-xs font-bold text-slate-600">الملف الحالي: {music.file_name}</div>}
        </div>

        {music&&<div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="space-y-4">
            <label className="block"><span className="mb-2 block text-sm font-black">عنوان الخلفية</span><input value={music.title} onChange={e=>setMusic({...music,title:e.target.value})} className="w-full rounded-2xl border bg-[#f8faf8] px-4 py-3 font-bold outline-none"/></label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f7f4] p-4"><span className="font-black">مفعلة</span><input type="checkbox" checked={music.enabled} onChange={e=>setMusic({...music,enabled:e.target.checked})} className="h-5 w-5"/></label>
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f7f4] p-4"><span className="font-black">تشغيل تلقائي</span><input type="checkbox" checked={music.autoplay} onChange={e=>setMusic({...music,autoplay:e.target.checked})} className="h-5 w-5"/></label>
              <label className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f7f4] p-4"><span className="font-black">تكرار مستمر</span><input type="checkbox" checked={music.loop} onChange={e=>setMusic({...music,loop:e.target.checked})} className="h-5 w-5"/></label>
            </div>

            <label className="block">
              <div className="mb-2 flex justify-between text-sm font-black"><span>مستوى الصوت</span><span>{Math.round(music.volume*100)}%</span></div>
              <input type="range" min="0" max="1" step="0.05" value={music.volume} onChange={e=>setMusic({...music,volume:Number(e.target.value)})} className="w-full"/>
            </label>

            <div className="flex flex-wrap gap-2">
              <button disabled={musicBusy} onClick={async()=>{
                try{
                  setMusicBusy(true);setMusicMsg('');
                  await adminSaveMusic(password,{enabled:music.enabled,autoplay:music.autoplay,loop:music.loop,volume:music.volume,title:music.title});
                  setMusicMsg('تم حفظ إعدادات الموسيقى بنجاح.');
                }catch{setMusicMsg('تعذر حفظ إعدادات الموسيقى.');}
                finally{setMusicBusy(false);}
              }} className="flex items-center gap-2 rounded-xl bg-[#0c6b4b] px-4 py-3 text-sm font-black text-white"><Save size={17}/> حفظ الإعدادات</button>

              {music.has_file&&<button disabled={musicBusy} onClick={async()=>{
                if(!window.confirm('سيتم حذف ملف الخلفية الموسيقية الحالي. هل تريد المتابعة؟'))return;
                try{
                  setMusicBusy(true);setMusicMsg('');
                  await adminRemoveMusic(password);
                  const m=await adminGetMusic(password);setMusic(m);
                  setMusicMsg('تم حذف الخلفية الموسيقية.');
                }catch{setMusicMsg('تعذر حذف الخلفية الموسيقية.');}
                finally{setMusicBusy(false);}
              }} className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-black text-red-700"><Trash2 size={17}/> حذف الملف</button>}
            </div>

            {musicMsg&&<div className="rounded-xl bg-[#f6f7f4] p-3 text-sm font-black text-slate-700">{musicMsg}</div>}
          </div>

          <div className="rounded-3xl border border-dashed border-[#0c6b4b]/30 bg-[#f8faf8] p-5">
            <div className="mb-3 flex items-center gap-2 font-black"><Upload size={19}/> رفع ملف موسيقي</div>
            <p className="mb-4 text-xs font-bold leading-6 text-slate-500">الصيغ المدعومة: MP3 وM4A وWAV وOGG وAAC، وبحجم أقصى 15 MB.</p>
            <input type="file" accept="audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/ogg,audio/aac,.mp3,.m4a,.wav,.ogg,.aac" onChange={async e=>{
              const file=e.target.files?.[0];if(!file)return;
              try{
                setMusicBusy(true);setMusicMsg('جارٍ رفع الملف...');
                await adminUploadMusic(password,file);
                const m=await adminGetMusic(password);setMusic(m);
                setMusicMsg('تم رفع الملف الموسيقي بنجاح.');
              }catch{setMusicMsg('تعذر رفع الملف الموسيقي. تأكد من الصيغة والحجم.');}
              finally{setMusicBusy(false);e.currentTarget.value='';}
            }} className="block w-full rounded-2xl border bg-white p-3 text-sm font-bold"/>
            {music.has_file&&<div className="mt-4 rounded-2xl bg-green-50 p-3 text-sm font-black text-green-800">يوجد ملف موسيقي جاهز للتشغيل.</div>}
          </div>
        </div>}
      </div>

      {analytics&&<section className="mb-8 space-y-5">
        <div className="flex items-end justify-between gap-3">
          <div><div className="eyebrow">تحليلات المعرض</div><h2 className="text-2xl font-black">مؤشرات الزوار والتفاعل</h2></div>
          <button onClick={()=>loadAdminAnalytics(password).then(setAnalytics).catch(()=>{})} className="rounded-xl bg-white px-4 py-2 text-sm font-black shadow-sm">تحديث المؤشرات</button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm"><Users className="mb-3 text-[#0c6b4b]" size={22}/><div className="text-3xl font-black">{analytics.today_visitors}</div><div className="mt-1 text-sm font-black text-slate-500">زوار اليوم</div><div className="mt-2 text-xs text-slate-400">إجمالي الزوار الفريدين: {analytics.total_visitors}</div></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><Eye className="mb-3 text-[#0c6b4b]" size={22}/><div className="text-3xl font-black">{analytics.total_pageviews}</div><div className="mt-1 text-sm font-black text-slate-500">إجمالي المشاهدات</div><div className="mt-2 text-xs text-slate-400">هذا الأسبوع: {analytics.week_visitors} زائر</div></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><Activity className="mb-3 text-[#0c6b4b]" size={22}/><div className="text-3xl font-black">{analytics.online_now}</div><div className="mt-1 text-sm font-black text-slate-500">متواجدون الآن</div><div className="mt-2 text-xs text-slate-400">آخر دقيقتين</div></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><Clock3 className="mb-3 text-[#0c6b4b]" size={22}/><div className="text-3xl font-black">{analytics.avg_minutes}</div><div className="mt-1 text-sm font-black text-slate-500">متوسط مدة الزيارة</div><div className="mt-2 text-xs text-slate-400">بالدقائق</div></div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.5fr_.9fr]">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-2"><BarChart3 size={20}/><h3 className="font-black">الزيارات خلال آخر 14 يومًا</h3></div>
            <div className="flex h-52 items-end gap-2">
              {analytics.daily.map((d)=>{
                const max=Math.max(1,...analytics.daily.map(x=>x.views));
                const h=Math.max(7,Math.round((d.views/max)*150));
                return <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <div title={`${d.views} مشاهدة · ${d.visitors} زائر`} className="w-full rounded-t-lg bg-[#0c6b4b]" style={{height:h}}/>
                  <div className="text-[10px] font-bold text-slate-400">{new Date(d.date).toLocaleDateString('ar-SA',{day:'numeric',month:'numeric'})}</div>
                </div>
              })}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-black">الأجهزة المستخدمة</h3>
            <div className="space-y-3">{analytics.devices.length?analytics.devices.map(x=>{
              const total=Math.max(1,analytics.devices.reduce((a,b)=>a+b.count,0));
              const pct=Math.round((x.count/total)*100);
              return <div key={x.name}><div className="mb-1 flex justify-between text-sm font-bold"><span>{x.name}</span><span>{pct}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0c6b4b]" style={{width:`${pct}%`}}/></div></div>
            }):<div className="text-sm text-slate-400">لا توجد بيانات بعد.</div>}</div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="mb-4 font-black">أكثر الصفحات زيارة</h3><div className="space-y-2">{analytics.pages.map((x,i)=><div key={x.name} className="flex justify-between rounded-xl bg-[#f6f7f4] px-3 py-2 text-sm"><span className="font-bold">{i+1}. {x.name}</span><b>{x.count}</b></div>)}</div></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="mb-4 font-black">أكثر المشاركات مشاهدة</h3><div className="space-y-2">{analytics.top_items.length?analytics.top_items.map((x,i)=><div key={x.id} className="rounded-xl bg-[#f6f7f4] px-3 py-2 text-sm"><div className="flex justify-between gap-2"><b>{i+1}. {x.title}</b><b>{x.views}</b></div><div className="mt-1 text-xs text-slate-500">{x.student_name}</div></div>):<div className="text-sm text-slate-400">لا توجد مشاهدات للمشاركات بعد.</div>}</div></div>
          <div className="rounded-3xl bg-white p-5 shadow-sm"><h3 className="mb-4 font-black">مصادر الزيارات</h3><div className="space-y-2">{analytics.sources.map((x,i)=><div key={x.name} className="flex justify-between rounded-xl bg-[#f6f7f4] px-3 py-2 text-sm"><span className="font-bold">{i+1}. {x.name}</span><b>{x.count}</b></div>)}</div></div>
        </div>
      </section>}
      {items.length?<div className="overflow-x-auto rounded-3xl bg-white shadow">
        <table className="w-full min-w-[900px] text-right text-sm">
          <thead className="bg-[#f5f6f2]"><tr><th>الطالب</th><th>المشاركة</th><th>الحالة</th><th>OneDrive</th><th>الإجراءات</th></tr></thead>
          <tbody>{items.map(i=><tr key={i.id} className="border-t">
            <td><b>{i.student_name}</b><div className="text-xs text-slate-500">{i.grade} · الفصل {i.class_name}</div></td>
            <td><b>{i.title}</b><div className="text-xs text-slate-500">{i.category}</div></td>
            <td><div className="flex items-center gap-2"><StatusBadge s={i.status}/>{i.hidden&&<span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">مخفية</span>}</div></td>
            <td className="max-w-[280px] truncate text-xs">{i.one_drive_path}</td>
            <td><div className="flex gap-2">
              {i.status==='pending'&&<>
                <button title="معاينة" onClick={()=>previewItem(i)} disabled={previewBusy===i.id} className="icon-btn text-slate-700">{previewBusy===i.id?<span className="text-[10px] font-black">...</span>:<Eye size={18}/>}</button>
                <button title="اعتماد" onClick={()=>act(i.id,'approve')} className="icon-btn text-green-700"><CheckCircle2 size={18}/></button>
                <button title="رفض" onClick={()=>act(i.id,'reject')} className="icon-btn text-red-700"><XCircle size={18}/></button>
              </>}
              {i.status==='approved'&&<><button title="تمييز" onClick={()=>act(i.id,'feature')} className={`icon-btn ${i.featured?'text-amber-600':''}`}><Star size={18}/></button>{i.hidden?<button title="إظهار المشاركة" onClick={()=>act(i.id,'show')} className="icon-btn text-emerald-700"><Eye size={18}/></button>:<button title="إخفاء المشاركة" onClick={()=>act(i.id,'hide')} className="icon-btn text-slate-700"><EyeOff size={18}/></button>}<button title="حذف نهائي" onClick={async()=>{if(!window.confirm('سيتم حذف المشاركة وملفها من المنصة نهائيًا. هل تريد المتابعة؟'))return;try{await adminDelete(password,i.id);await load();}catch{setMsg('تعذر حذف المشاركة.');}}} className="icon-btn text-red-700"><Trash2 size={18}/></button></>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>:<Empty text="لا توجد مشاركات حاليًا."/>}
    </>}
    {preview&&<div onClick={()=>setPreview(null)} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <div onClick={e=>e.stopPropagation()} className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-[30px] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black text-[#9a742b]">معاينة قبل الاعتماد</div>
            <h3 className="text-2xl font-black">{preview.title}</h3>
            <div className="mt-1 text-sm font-bold text-slate-500">{preview.student_name} · {preview.grade} · الفصل {preview.class_name}</div>
          </div>
          <button onClick={()=>setPreview(null)} className="icon-btn"><XCircle/></button>
        </div>

        <div className="overflow-hidden rounded-3xl bg-[#edf1ed]">
          {preview.file_url&&preview.mime_type.startsWith('image/')?
            <img src={preview.file_url} className="max-h-[68vh] w-full object-contain"/>:
          preview.file_url&&preview.mime_type.startsWith('video/')?
            <video src={preview.file_url} controls playsInline className="max-h-[68vh] w-full"/>:
          preview.file_url&&preview.mime_type.startsWith('audio/')?
            <div className="grid min-h-64 place-items-center p-6"><audio src={preview.file_url} controls className="w-full max-w-xl"/></div>:
          preview.file_url&&preview.mime_type==='application/pdf'?
            <iframe src={preview.file_url} className="h-[68vh] w-full bg-white" title="معاينة PDF"/>:
            <div className="grid min-h-64 place-items-center"><a href={preview.file_url||'#'} target="_blank" className="rounded-xl bg-[#0c6b4b] px-5 py-3 font-black text-white">فتح الملف</a></div>
          }
        </div>

        <div className="mt-5 rounded-2xl bg-[#f7f8f5] p-4">
          <div className="text-sm font-black text-slate-500">نوع المشاركة: {preview.category}</div>
          <p className="mt-2 font-bold leading-7 text-slate-700">{preview.description||'لا يوجد وصف للمشاركة.'}</p>
        </div>

        {preview.status==='pending'&&<div className="mt-5 flex flex-wrap justify-end gap-2">
          <button onClick={async()=>{await act(preview.id,'reject');setPreview(null);}} className="rounded-xl bg-red-50 px-5 py-3 font-black text-red-700">رفض المشاركة</button>
          <button onClick={async()=>{await act(preview.id,'approve');setPreview(null);}} className="rounded-xl bg-[#0c6b4b] px-5 py-3 font-black text-white">اعتماد المشاركة</button>
        </div>}
      </div>
    </div>}
  </section>
}