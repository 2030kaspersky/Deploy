"use strict";
const $=s=>document.getElementById(s),escape=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const LABEL={requested:"طلب وارد",called:"تم الاستدعاء",leaving_zone:"غادرت المنطقة",at_gate:"عند البوابة",released:"تسليم تجريبي معتمد",delayed:"متأخرة",rejected:"مرفوض",cancelled:"ملغى"};
const ROLE={admin:"مدير النظام",principal:"مديرة المدرسة",lead:"مسؤولة الانصراف",reception:"موظفة الاستقبال",zone:"مشرفة المنطقة",gate:"مشرفة البوابة"};
const ALLOW={create:["admin","lead","reception"],onsite:["admin","lead","reception","gate"],call:["admin","lead","zone"],leave:["admin","lead","zone"],atgate:["admin","lead","zone","gate"],verify:["admin","lead","gate"],release:["admin","lead","gate"],delay:["admin","lead","zone"],retry:["admin","lead","zone"],reject:["admin","lead","gate","principal"],cancel:["admin","lead","reception","principal"]};
const STEPS=["requested","called","leaving_zone","at_gate","released"];
let state=null,page="dashboard",polling=false,timer=null,currentId=null;
function toast(msg,bad=false){const el=$("toast");el.textContent=msg;el.className="toast"+(bad?" error":"");el.style.display="block";clearTimeout(timer);timer=setTimeout(()=>el.style.display="none",5000);}
async function api(url,method="GET",data){
 const r=await fetch(url,{method,cache:"no-store",credentials:"same-origin",headers:data?{"Content-Type":"application/json"}:{},body:data?JSON.stringify(data):undefined});
 const payload=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(payload.error||"تعذر الاتصال بخادم الاختبار"),{status:r.status});
 return payload;
}
const statusTag=status=>'<span class="badge '+escape(status)+'">'+escape(LABEL[status]||status)+'</span>';
const format=t=>t?new Date(t).toLocaleString("ar-SA",{timeZone:"Asia/Riyadh",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"—";
const student=id=>state?.students?.find(s=>s.id===id);
const stat=()=>{
 const all=state?.requests||[],count=key=>all.filter(r=>r.status===key).length,done=all.filter(r=>r.completed_at);
 const avg=done.length?Math.round(done.reduce((n,r)=>n+(new Date(r.completed_at)-new Date(r.created_at))/60000,0)/done.length):0;
 return {total:all.length,requested:count("requested"),called:count("called")+count("leaving_zone"),atgate:count("at_gate"),released:count("released"),delayed:count("delayed"),rejected:count("rejected"),avg};
};
function statsHTML(){
 const s=stat();return [["إجمالي الطلبات",s.total],["طلبات واردة",s.requested],["قيد الانتقال",s.called],["عند البوابة",s.atgate],["تم التسليم تجريبيًا",s.released],["حالات متأخرة",s.delayed],["حالات مرفوضة",s.rejected],["متوسط الزمن بالدقائق",s.avg]]
 .map(([label,num])=>'<div class="stat"><strong>'+num+'</strong><small>'+label+'</small></div>').join("");
}
function menu(pageId){page=pageId;document.querySelectorAll("#app>section").forEach(x=>x.classList.toggle("on",x.id===pageId));document.querySelectorAll(".tabs button").forEach(x=>x.classList.toggle("active",x.dataset.page===pageId));draw();}
function renderLogin(){state=null;$("app").classList.add("hide");$("login").classList.remove("hide");$("logoutButton").classList.add("hide");$("currentAccount").textContent="";$("sync").textContent="غير مسجّل";$("loginForm").reset();}
function renderAuth(){if(!state)return renderLogin();$("app").classList.remove("hide");$("login").classList.add("hide");$("logoutButton").classList.remove("hide");$("currentAccount").textContent=state.account.name;$("myRole").textContent="دورك: "+(ROLE[state.account.role]||state.account.role);
$("reset").disabled=state.account.role!=="admin";draw();}
function permitted(k,r){
 if(!state||!ALLOW[k]?.includes(state.account.role))return false;
 if(k==="create")return true;
 if(!r||["released","cancelled","rejected"].includes(r.status))return false;
 switch(k){
 case "onsite":return r.status==="requested"&&r.onsite_pending;
 case "call":return r.status==="requested"&&!r.onsite_pending;
 case "leave":return r.status==="called";
 case "atgate":return r.status==="leaving_zone";
 case "verify":return r.status==="at_gate"&&!r.verified_at;
 case "release":return r.status==="at_gate"&&!!r.verified_at;
 case "delay":return r.status==="called";
 case "retry":return r.status==="delayed";
 default:return true;
 }
}
function actionBtns(r){
 const options=[["onsite","تأكيد الحضور"],["call","استدعاء"],["leave","غادرت المنطقة"],["atgate","وصلت البوابة"],["verify","تحقق الهوية"],["release","اعتماد التسليم"],["delay","تأخير"],["retry","إعادة الاستدعاء"],["reject","رفض"],["cancel","إلغاء"]];
 const available=options.filter(([a])=>permitted(a,r));
 return available.length?available.map(([a,name])=>'<button class="btn small '+(a==="release"?"green":a==="cancel"||a==="reject"?"red":a==="verify"?"warn":"alt")+'" data-action="'+a+'" data-id="'+r.id+'">'+name+'</button>').join(""):'<span class="muted mini">لا إجراءات متاحة لهذا الدور</span>';
}
function rowsHTML(list){return '<table><thead><tr><th>رقم الطلب</th><th>الطالبة الوهمية</th><th>المنطقة</th><th>المصدر</th><th>الحالة</th><th>التوقيت</th><th>العمليات المتاحة</th></tr></thead><tbody>'+list.map(r=>{
 const s=student(r.student_id);
 return '<tr><td><button class="btn out small" data-detail="'+r.id+'">#'+r.id+'</button></td><td>'+escape(s?.name||"—")+'</td><td>'+escape(s?.zone||"—")+'</td><td>'+escape(r.source==="family"?"ولي الأمر":"الاستقبال")+'</td><td>'+statusTag(r.status)+(r.onsite_pending?'<div class="mini">يلزم تأكيد حضور المستلم</div>':'')+'</td><td>'+format(r.created_at)+'</td><td><div class="actions">'+actionBtns(r)+'</div></td></tr>';
 }).join("")+'</tbody></table>';}
function draw(){
 if(!state)return;
 const s=stat();
 $("stats").innerHTML=statsHTML();
 $("summary").innerHTML=[["طلبات واردة",s.requested],["حركة الطالبات",s.called],["عند البوابة",s.atgate],["مكتملة",s.released]].map(([name,n])=>'<div class="box row between"><b>'+name+'</b><b>'+n+'</b></div>').join("");
 $("reportStats").innerHTML=statsHTML();
 const search=($("search").value||"").trim(),filter=$("statusFilter").value;
 const list=state.requests.filter(r=>(!filter||r.status===filter)&&(!search||(""+r.id+" "+student(r.student_id)?.name).includes(search)));
 $("queueTable").innerHTML=list.length?rowsHTML(list):'<p class="notice">لا توجد طلبات مطابقة. ابدئي من بوابة الأسرة أو شاشة الاستقبال.</p>';
 const existing=$("studentSelect").value;
 $("studentSelect").innerHTML=state.students.map(s=>'<option value="'+s.id+'">'+escape(s.name)+" – "+escape(s.grade)+" ("+escape(s.zone)+")</option>").join("");
 if(state.students.some(s=>String(s.id)===existing))$("studentSelect").value=existing;
 $("eventsList").innerHTML=state.events.length?state.events.map(e=>'<div class="event"><b>'+escape(e.event_type)+' · '+escape(e.detail||"")+'</b><small>'+escape(ROLE[e.actor_role]||e.actor_role)+' · '+format(e.created_at)+' · الطلب #'+escape(e.request_id||"—")+'</small></div>').join(""):'<p class="muted">لا أحداث بعد.</p>';
 $("reportEvents").innerHTML='<div class="scroll"><table><thead><tr><th>التاريخ</th><th>الدور</th><th>رقم الطلب</th><th>الحركة</th></tr></thead><tbody>'+state.events.slice(0,35).map(e=>'<tr><td>'+format(e.created_at)+'</td><td>'+escape(ROLE[e.actor_role]||e.actor_role)+'</td><td>'+escape(e.request_id||"—")+'</td><td>'+escape(e.event_type)+'</td></tr>').join("")+'</tbody></table></div>';
 if(currentId&&$("dialog").classList.contains("show"))showDetail(currentId);
}
function showDetail(id){
 if(!state)return;const r=state.requests.find(x=>x.id===Number(id));if(!r){closeModal();return;}
 currentId=Number(id);
 $("dialogTitle").textContent="تفاصيل الطلب التجريبي #"+r.id;const s=student(r.student_id),idx=STEPS.indexOf(r.status);
 $("dialogContent").innerHTML='<div class="grid"><div class="box"><b>'+escape(s?.name)+'</b><br>'+escape(s?.grade)+' · المنطقة '+escape(s?.zone)+'</div><div class="box"><b>المستلم:</b> '+escape(r.pickup)+'<br><b>الحالة:</b> '+statusTag(r.status)+'</div></div><div class="timeline">'+STEPS.map((v,i)=>'<span class="'+(r.status==="released"||i<idx?"done":i===idx?"current":"")+'">'+LABEL[v]+'</span>').join("")+'</div><div class="notice">'+(r.verified_at?"تم توثيق إقرار تحقق افتراضي":"يلزم توثيق فحص الهوية والتفويض قبل اعتماد التسليم")+'</div><div class="actions" style="margin-top:16px">'+actionBtns(r)+'</div><h3 style="margin-top:18px">الأحداث المرتبطة</h3>'+state.events.filter(e=>e.request_id===r.id).map(e=>'<div class="event">'+escape(e.event_type)+' · '+format(e.created_at)+'</div>').join("");
 $("dialog").classList.add("show");
}
function closeModal(){$("dialog").classList.remove("show");currentId=null;}
async function doAction(action,id){
 const payload={action,id:Number(id)};
 if(["reject","cancel","delay"].includes(action)){
 const reason=prompt("أدخلي سبب الإجراء (6 أحرف على الأقل):");
 if(!reason||reason.trim().length<6){toast("سبب الإجراء مطلوب",true);return;}
 payload.reason=reason.trim();
 }
 if(action==="verify"){if(!confirm("هل تم إجراء التحقق الافتراضي من هوية المستلم وتفويضه؟ هذا إقرار للمحاكاة فقط."))return;payload.attested=true;}
 try{await api("/api/action","POST",payload);toast("تم حفظ العملية وتحديثها للأجهزة الأخرى");await refresh(true);}catch(e){toast(e.message,true);}
}
async function refresh(silent=false){
 if(polling)return;polling=true;
 try{const info=await api("/api/state");const wasLoggedIn=!!state;state=info;$("sync").textContent="متصل · تحديث "+new Date().toLocaleTimeString("ar-SA");$("connection").classList.add("hide");if(!wasLoggedIn)renderAuth();else draw();}
 catch(e){
 if(e.status===401){if(state)toast("انتهت الجلسة؛ يرجى الدخول مجددًا.",true);renderLogin();}
 else{$("sync").textContent="الاتصال غير متاح";$("connection").classList.remove("hide");$("connection").textContent=e.message;}
 }finally{polling=false;}
}
function exportCSV(){
 if(!state)return;const headings=["رقم الطلب","الطالبة التجريبية","الصف","المنطقة","الحالة","المصدر","التوقيت","اعتماد التسليم"];
 const rows=state.requests.map(r=>[r.id,student(r.student_id)?.name,student(r.student_id)?.grade,student(r.student_id)?.zone,LABEL[r.status],r.source,format(r.created_at),format(r.completed_at)]);
 const csv="\ufeff"+[headings,...rows].map(items=>items.map(x=>'"'+String(x??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
 const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="miral-safe-dismissal-test.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.querySelectorAll(".tabs button").forEach(x=>x.addEventListener("click",()=>menu(x.dataset.page)));
$("search").addEventListener("input",draw);$("statusFilter").addEventListener("change",draw);
$("refresh").addEventListener("click",()=>refresh(true));
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();const username=$("username").value.trim(),password=$("password").value;
 try{await api("/api/login","POST",{username,password});await refresh();toast("مرحبًا بك في بيئة الاختبار");}catch(err){toast(err.message,true);}
});
$("logoutButton").addEventListener("click",async()=>{try{await api("/api/logout","POST",{});}catch{}renderLogin()});
$("createForm").addEventListener("submit",async e=>{e.preventDefault();try{await api("/api/action","POST",{action:"create",studentId:Number($("studentSelect").value),pickup:$("pickupSelect").value});toast("تم إنشاء طلب تجريبي");menu("queue");await refresh(true);}catch(err){toast(err.message,true);}});
$("queueTable").addEventListener("click",e=>{const a=e.target.closest("[data-action]"),d=e.target.closest("[data-detail]");if(a)doAction(a.dataset.action,a.dataset.id);if(d)showDetail(d.dataset.detail)});
$("dialogContent").addEventListener("click",e=>{const a=e.target.closest("[data-action]");if(a)doAction(a.dataset.action,a.dataset.id)});
$("dialogClose").addEventListener("click",closeModal);$("dialog").addEventListener("click",e=>{if(e.target===$("dialog"))closeModal()});
$("reset").addEventListener("click",async()=>{if(!confirm("حذف جميع سجلات التجربة المشتركة لكل الأجهزة؟"))return;try{await api("/api/reset","POST",{});await refresh(true);toast("أعيدت التجربة الافتراضية لجميع الأجهزة");}catch(e){toast(e.message,true);}});
$("printReport").addEventListener("click",()=>window.print());$("csvReport").addEventListener("click",exportCSV);
(async()=>{
 try{const h=await api("/api/health");$("connection").classList.add("hide");if(!h.databaseReady)throw Error("قاعدة الاختبار ليست متصلة");await refresh();}
 catch(e){$("connection").textContent=e.message+" — التطبيق في وضع آمن مغلق حتى استكمال الإعداد.";renderLogin();}
})();
setInterval(()=>{if(state&&document.visibilityState==="visible")refresh(true);},3000);
