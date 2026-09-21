import {useState} from 'react';
import {ImagePlus} from 'lucide-react';
import {SB,categories,classes,grades} from './api';
import {Field} from './ui';

export function Submit({after}:{after:()=>void}){
  const [form,setForm]=useState({studentName:'',grade:'',className:'',category:'',title:'',description:''});
  const [file,setFile]=useState<File|null>(null);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);
  const [ok,setOk]=useState(false);
  const change=(k:string,v:string)=>setForm(s=>({...s,[k]:v}));

  async function submit(e:React.FormEvent){
    e.preventDefault();setMsg('');setOk(false);
    if(!file){setMsg('اختر ملف المشاركة.');return;}
    if(file.size>10*1024*1024){setMsg('الحد الأعلى 10MB.');return;}
    setBusy(true);
    try{
      const fileContent=await new Promise<string>((resolve,reject)=>{
        const reader=new FileReader();
        reader.onload=()=>resolve(String(reader.result).split(',')[1]||'');
        reader.onerror=()=>reject(new Error('تعذر قراءة الملف.'));
        reader.readAsDataURL(file);
      });

      const r=await fetch(`${SB}/functions/v1/watan96v2-submit`,{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          studentName:form.studentName,
          grade:form.grade,
          className:form.className,
          category:form.category,
          title:form.title,
          description:form.description,
          fileName:file.name,
          mimeType:file.type||'application/octet-stream',
          fileContent
        })
      });

      const data=await r.json().catch(()=>({}));
      if(!r.ok){
        const detail=data?.detail?(' — '+data.detail):'';
        throw new Error('تعذر حفظ المشاركة'+detail);
      }

      setOk(true);
      setMsg('تم استلام المشاركة بنجاح، وستظهر في المعرض بعد اعتمادها.');
      setTimeout(after,1800);
    }catch(err){setMsg(err instanceof Error?err.message:'تعذر حفظ المشاركة. أعد المحاولة.');}
    finally{setBusy(false);}
  }

  return <section className="mx-auto max-w-4xl px-4 py-12">
    <div className="mb-8 text-center"><div className="eyebrow">شارك بإبداعك</div><h1 className="text-4xl font-black">مشاركتك جزء من حكاية الوطن</h1></div>
    <form onSubmit={submit} className="rounded-[32px] bg-white p-6 shadow-xl md:p-9">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="اسم الطالب"><input required value={form.studentName} onChange={e=>change('studentName',e.target.value)} placeholder="الاسم الثلاثي"/></Field>
        <Field label="الصف"><select required value={form.grade} onChange={e=>change('grade',e.target.value)}><option value="">اختر الصف</option>{grades.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="الفصل"><select required value={form.className} onChange={e=>change('className',e.target.value)}><option value="">اختر الفصل</option>{classes.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="نوع المشاركة"><select required value={form.category} onChange={e=>change('category',e.target.value)}><option value="">اختر النوع</option>{categories.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="عنوان المشاركة" wide><input required value={form.title} onChange={e=>change('title',e.target.value)} placeholder="مثال: وطني في عيوني"/></Field>
        <Field label="وصف مختصر" wide><textarea rows={4} value={form.description} onChange={e=>change('description',e.target.value)} placeholder="حدثنا عن فكرتك..."/></Field>
        <label className="md:col-span-2 cursor-pointer rounded-3xl border-2 border-dashed border-[#0c6b4b]/25 bg-[#f7faf7] p-8 text-center">
          <ImagePlus className="mx-auto mb-3 text-[#0c6b4b]" size={34}/>
          <div className="font-black">{file?file.name:'اضغط لاختيار ملف المشاركة'}</div>
          <div className="mt-1 text-sm font-bold text-[#75837c]">صور، PDF أو فيديو MP4 — حتى 10MB</div>
          <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4" onChange={e=>setFile(e.target.files?.[0]||null)}/>
        </label>
      </div>
      {msg&&<div className={`mt-5 rounded-2xl p-4 text-center font-black ${ok?'bg-green-50 text-green-800':'bg-red-50 text-red-700'}`}>{msg}</div>}
      <button disabled={busy} className="mt-6 w-full rounded-2xl bg-[#0c6b4b] py-4 font-black text-white disabled:opacity-50">{busy?'جارٍ رفع المشاركة...':'إرسال المشاركة'}</button>
    </form>
  </section>
}