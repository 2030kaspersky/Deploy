import {useState} from 'react';
import {CheckCircle2,Eye,EyeOff,Star,Trash2,XCircle} from 'lucide-react';
import {adminDelete,Item,rpc} from './api';
import {Dash,Empty,StatusBadge} from './ui';

export function Admin(){
  const [password,setPassword]=useState(()=>sessionStorage.getItem('watan96v2-admin')||'');
  const [items,setItems]=useState<Item[]>([]);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const [opened,setOpened]=useState(false);

  async function load(){
    setBusy(true);setMsg('');
    try{
      const data=await rpc('watan96v2_admin_list',{p_password:password});
      sessionStorage.setItem('watan96v2-admin',password);
      setItems(data||[]);setOpened(true);
      setMsg((data||[]).length?'تم فتح الإدارة بنجاح.':'تم فتح الإدارة بنجاح — لا توجد مشاركات حاليًا.');
    }catch{
      setOpened(false);setItems([]);setMsg('رمز الإدارة غير صحيح.');
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