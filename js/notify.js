// HK Wood Doors ERP — phone reminders (Android app only)
// Every morning at 9 a notification lists that day's work: deliveries due (and
// late ones), cheques due, monthly bills due and machine services. They are
// worked out from the data and set for the next 7 days, and set again whenever
// the data changes, so they arrive even when the app is closed.
(function(){
  const BASE_ID=7000,DAYS=7,HOUR=9,OFF='hk_notify_off',ASKED='hk_notify_asked';
  function num(v){return parseFloat(v)||0;}
  function plugin(){return window.hkNative&&window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.LocalNotifications;}
  function ymd(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function off(){try{return localStorage.getItem(OFF)==='1';}catch(e){return false;}}
  function billDay(b,d){let dim=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();return Math.min(Math.max(1,parseInt(b.day)||1),dim);}
  function billPaid(b,key){return expenses.some(e=>e.billId===b.id&&e.billMonth===key);}

  // What needs doing on day d (a Date at local midnight).
  function itemsFor(d,first){
    let day=ymd(d),key=day.slice(0,7),out=[];
    let open=orders.filter(o=>(o.status||'pending')!=='delivered');
    let due=open.filter(o=>o.deliveryDate===day);
    if(due.length)out.push(`🚚 ${due.length} delivery: ${due.slice(0,3).map(o=>o.orderNo).join(', ')}${due.length>3?'…':''}`);
    if(first){let late=open.filter(o=>o.deliveryDate&&o.deliveryDate<day);if(late.length)out.push(`❗ ${late.length} order late`);}
    let ch=(typeof cheques!=='undefined'?cheques:[]).filter(c=>c.status==='pending'&&c.dueDate===day);
    if(ch.length)out.push(`🧾 ${ch.length} cheque — ${fmtRs(ch.reduce((s,c)=>s+num(c.amount),0))}`);
    let bills=(typeof monthlyBills!=='undefined'?monthlyBills:[]).filter(b=>billDay(b,d)===d.getDate()&&!billPaid(b,key));
    if(bills.length)out.push(`💡 ${bills.map(b=>b.name).join(', ')}`);
    let svc=(typeof shopTools!=='undefined'?shopTools:[]).filter(t=>t.kind==='machine'&&num(t.serviceDays)>0&&(()=>{
      let x=new Date((t.lastService||String(t.createdAt||'').slice(0,10)||day)+'T00:00:00');x.setDate(x.getDate()+num(t.serviceDays));return ymd(x)===day;})());
    if(svc.length)out.push(`⚙️ Service: ${svc.map(t=>t.name).join(', ')}`);
    return out;
  }
  function plan(now){
    now=now||new Date();
    let list=[];
    for(let i=0;i<DAYS;i++){
      let d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
      let at=new Date(d.getFullYear(),d.getMonth(),d.getDate(),HOUR,0,0);
      if(at<=now)continue;
      let items=itemsFor(d,list.length===0);
      if(!items.length)continue;
      list.push({id:BASE_ID+i,title:(businessProfile.name||'HK Doors')+' — aaj ka kaam',body:items.join('\n'),largeBody:items.join('\n'),schedule:{at,allowWhileIdle:true}});
    }
    return list;
  }
  window.hkNotifyPlan=plan;
  let busy=false;
  async function reschedule(){
    let p=plugin();if(!p||busy)return;
    busy=true;
    try{
      await p.cancel({notifications:Array.from({length:DAYS},(_,i)=>({id:BASE_ID+i}))}).catch(()=>{});
      if(off())return;
      let perm=await p.checkPermissions();
      if(perm.display!=='granted')return;
      let list=plan();
      if(list.length)await p.schedule({notifications:list});
    }catch(e){console.warn('Reminders:',e);}
    finally{busy=false;}
  }
  window.hkNotifyReschedule=reschedule;
  async function askOnce(){
    let p=plugin();if(!p||off())return;
    try{
      if(localStorage.getItem(ASKED))return;
      localStorage.setItem(ASKED,'1');
      let perm=await p.checkPermissions();
      if(perm.display!=='granted')await p.requestPermissions();
    }catch(e){}
    reschedule();
  }
  window.hkNotifyToggle=async function(){
    try{localStorage.setItem(OFF,off()?'0':'1');}catch(e){}
    if(!off()){let p=plugin();try{let perm=await p.checkPermissions();if(perm.display!=='granted')await p.requestPermissions();}catch(e){}}
    await reschedule();
    showToast(off()?'🔕 Phone par yaad dahani band':'🔔 Har subah 9 baje aaj ka kaam phone par aayega');
    if(document.getElementById('settingsModal')?.classList.contains('open'))openSettingsModal();
  };
  // Settings → on/off switch.
  let origSettings=window.openSettingsModal;
  window.openSettingsModal=function(){
    let r=origSettings.apply(this,arguments);
    if(plugin()){
      let info=document.getElementById('hkStorageInfo');
      if(info&&!document.getElementById('hkNotifyRow'))info.insertAdjacentHTML('beforebegin',`<div id="hkNotifyRow" style="margin-top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:10px;">
        ${off()?'🔕 Phone par subah ki yaad dahani band hai':'🔔 Har subah 9 baje: delivery, cheque, bill, service'}
        <button class="btn btn-outline btn-xs" onclick="hkNotifyToggle()">${off()?'Chalu karein':'Band karein'}</button></div>`);
    }
    return r;
  };
  let timer=null;
  let origSaveAll=window.saveAll;
  window.saveAll=function(){
    let r=origSaveAll.apply(this,arguments);
    if(plugin()){clearTimeout(timer);timer=setTimeout(reschedule,4000);}
    return r;
  };
  document.addEventListener('hk:ready',()=>{if(plugin())setTimeout(askOnce,8000);});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&plugin())reschedule();});
})();
