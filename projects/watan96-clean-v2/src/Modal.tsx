import {XCircle} from 'lucide-react';
import {Item} from './api';

export function Modal({
  item,
  close,
  onMediaStart,
  onMediaStop
}:{
  item:Item;
  close:()=>void;
  onMediaStart?:()=>void;
  onMediaStop?:()=>void;
}){
  function closeModal(){
    onMediaStop?.();
    close();
  }

  return <div onClick={closeModal} className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm">
    <div onClick={e=>e.stopPropagation()} className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-[32px] bg-white p-6">
      <div className="mb-4 flex justify-between">
        <div>
          <div className="text-xs font-black text-[#9a742b]">{item.category}</div>
          <h3 className="text-2xl font-black">{item.title}</h3>
        </div>
        <button onClick={closeModal} className="icon-btn"><XCircle/></button>
      </div>

      <div className="overflow-hidden rounded-3xl bg-[#edf1ed]">
        {item.file_url&&item.mime_type.startsWith('image/')?
          <img src={item.file_url} className="max-h-[62vh] w-full object-contain"/>:
        item.file_url&&item.mime_type.startsWith('video/')?
          <video
            src={item.file_url}
            controls
            playsInline
            className="max-h-[62vh] w-full"
            onPlay={()=>onMediaStart?.()}
            onPause={()=>onMediaStop?.()}
            onEnded={()=>onMediaStop?.()}
          />:
        item.file_url&&item.mime_type.startsWith('audio/')?
          <div className="grid min-h-64 place-items-center p-6">
            <audio
              src={item.file_url}
              controls
              className="w-full max-w-xl"
              onPlay={()=>onMediaStart?.()}
              onPause={()=>onMediaStop?.()}
              onEnded={()=>onMediaStop?.()}
            />
          </div>:
          <div className="grid min-h-64 place-items-center">
            <a href={item.file_url||'#'} target="_blank" className="rounded-xl bg-[#0c6b4b] px-5 py-3 font-black text-white">فتح الملف</a>
          </div>
        }
      </div>

      <div className="mt-5">
        <b>{item.student_name}</b>
        <div className="text-sm text-slate-500">{item.grade} · الفصل {item.class_name}</div>
        <p className="mt-3 font-bold leading-7 text-slate-600">{item.description||'مشاركة وطنية إبداعية.'}</p>
      </div>
    </div>
  </div>
}