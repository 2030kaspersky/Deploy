import {Sparkles} from 'lucide-react';
import {Item} from './api';
import {Card,Empty,Stat} from './ui';

export function Home({count,featured,go,open}:{count:number;featured:Item[];go:(v:'home'|'submit'|'gallery'|'admin')=>void;open:(i:Item)=>void}){
  return <>
    <section className="hero"><div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 lg:grid-cols-[1.1fr_.9fr] lg:py-20">
      <div>
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dac48e] bg-white/75 px-4 py-2 text-sm font-black"><Sparkles size={16}/> إبداعات طلابنا في حب الوطن</div>
        <h1 className="text-5xl font-black leading-tight md:text-7xl">وطن <span className="text-[#0c6b4b]">نبدع</span> له</h1>
        <p className="mt-5 max-w-2xl text-lg font-bold leading-9 text-[#52675d]">معرض رقمي تفاعلي يحتفي بإبداع طلاب ابتدائية خالد بن الوليد بمناسبة اليوم الوطني السعودي 96.</p>
        <div className="mt-8 flex gap-3"><button onClick={()=>go('submit')} className="rounded-2xl bg-[#0c6b4b] px-7 py-4 font-black text-white">شارك بإبداعك</button><button onClick={()=>go('gallery')} className="rounded-2xl bg-white px-7 py-4 font-black">استكشف المعرض</button></div>
        <div className="mt-10 grid max-w-xl grid-cols-3 gap-3"><Stat n={count} t="مشاركة معتمدة"/><Stat n={featured.length} t="إبداع مميز"/><Stat n={96} t="اليوم الوطني"/></div>
      </div>
      <div className="relative min-h-[390px] rounded-[42px] bg-[#0c6b4b] p-8 text-white shadow-2xl">
        <div className="pattern absolute inset-0 opacity-20"/>
        <div className="relative flex h-full flex-col justify-between rounded-[32px] border border-white/20 p-8">
          <div className="text-sm font-bold opacity-80">المملكة العربية السعودية · وزارة التعليم</div>
          <div><div className="text-8xl font-black text-[#e5c875]">96</div><div className="mt-2 text-2xl font-black">عزنا بطبعنا</div></div>
          <div className="text-sm font-bold opacity-80">الإدارة العامة للتعليم بمنطقة نجران · ابتدائية خالد بن الوليد</div>
        </div>
      </div>
    </div></section>
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="mb-7 flex items-end justify-between"><div><div className="eyebrow">مختارات المعرض</div><h2 className="text-3xl font-black">إبداعات تستحق الضوء</h2></div><button onClick={()=>go('gallery')} className="font-black text-[#0c6b4b]">عرض الكل ←</button></div>
      {featured.length?<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{featured.map(i=><Card key={i.id} item={i} open={()=>open(i)}/>)}</div>:<Empty text="ستظهر هنا المشاركات المميزة بعد اعتمادها."/>}
    </section>
  </>
}