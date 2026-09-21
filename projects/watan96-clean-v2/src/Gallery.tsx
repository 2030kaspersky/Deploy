import {Search} from 'lucide-react';
import {Item,categories} from './api';
import {Card,Empty} from './ui';

export function Gallery({items,filter,setFilter,search,setSearch,open}:{items:Item[];filter:string;setFilter:(s:string)=>void;search:string;setSearch:(s:string)=>void;open:(i:Item)=>void}){
  return <section className="mx-auto max-w-7xl px-4 py-12">
    <div className="mb-8"><div className="eyebrow">معرض الإبداع الطلابي</div><h1 className="text-4xl font-black">إبداع وطني.. بأيدي طلابنا</h1></div>
    <div className="mb-7 flex flex-col gap-4 rounded-3xl bg-white p-4 lg:flex-row">
      <div className="relative flex-1"><Search className="absolute right-4 top-3.5 text-[#789086]" size={19}/><input value={search} onChange={e=>setSearch(e.target.value)} className="w-full rounded-2xl bg-[#f4f6f3] py-3 pr-11 pl-4 font-bold outline-none" placeholder="ابحث باسم الطالب أو المشاركة..."/></div>
      <div className="flex gap-2 overflow-x-auto">{['الكل',...categories].map(x=><button key={x} onClick={()=>setFilter(x)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-black ${filter===x?'bg-[#0c6b4b] text-white':'bg-[#f4f6f3]'}`}>{x}</button>)}</div>
    </div>
    {items.length?<div className="columns-1 gap-5 sm:columns-2 lg:columns-3 xl:columns-4">{items.map(i=><div key={i.id} className="mb-5 break-inside-avoid"><Card item={i} open={()=>open(i)}/></div>)}</div>:<Empty text="لا توجد مشاركات معتمدة حتى الآن."/>}
  </section>
}