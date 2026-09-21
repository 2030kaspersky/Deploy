import {useState} from 'react';
import {Activity,BarChart3,CheckCircle2,Clock3,Eye,EyeOff,Star,Trash2,Users,XCircle} from 'lucide-react';
import {adminDelete,AnalyticsSummary,Item,loadAdminAnalytics,rpc} from './api';
import {Dash,Empty,StatusBadge} from './ui';

export function Admin(){
  const [password,setPassword]=useState(()=>sessionStorage.getItem('watan96v2-admin')||'');
  const [items,setItems]=useState<Item[]>([]);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const [opened,setOpened]=useState(false);
  const [analytics,setAnalytics]=useState<AnalyticsSummary|null>(null);

  async function load(){
    setBusy(true);setMsg('');
    try{
      const data=await rpc('watan96v2_admin_list',{p_password:password});
      sessionStorage.setItem('watan96v2-admin',password);
      setItems(data||[]);setOpened(true);
      loadAdminAnalytics(password).then(setAnalytics).catch(()=>setAnalytics(null));
      setMsg((data||[]).length?'تم فتح الإدارة بنجاح.':'تم فتح الإدارة بنجاح — لا توجد مشاركات حاليًا.');
    }catch{
      setOpened(false);setItems([]);setAnalytics(null);setMsg('رمز الإدارة غير صحيح.');
    }finally{setBusy(false);}
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
              {i.status==='pending'&&<><button title="اعتماد" onClick={()=>act(i.id,'approve')} className="icon-btn text-green-700"><CheckCircle2 size={18}/></button><button title="رفض" onClick={()=>act(i.id,'reject')} className="icon-btn text-red-700"><XCircle size={18}/></button></>}
              {i.status==='approved'&&<><button title="تمييز" onClick={()=>act(i.id,'feature')} className={`icon-btn ${i.featured?'text-amber-600':''}`}><Star size={18}/></button>{i.hidden?<button title="إظهار المشاركة" onClick={()=>act(i.id,'show')} className="icon-btn text-emerald-700"><Eye size={18}/></button>:<button title="إخفاء المشاركة" onClick={()=>act(i.id,'hide')} className="icon-btn text-slate-700"><EyeOff size={18}/></button>}<button title="حذف نهائي" onClick={async()=>{if(!window.confirm('سيتم حذف المشاركة وملفها من المنصة نهائيًا. هل تريد المتابعة؟'))return;try{await adminDelete(password,i.id);await load();}catch{setMsg('تعذر حذف المشاركة.');}}} className="icon-btn text-red-700"><Trash2 size={18}/></button></>}
            </div></td>
          </tr>)}</tbody>
        </table>
      </div>:<Empty text="لا توجد مشاركات حاليًا."/>}
    </>}
  </section>
}