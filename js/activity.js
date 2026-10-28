// HK Wood Doors ERP — activity log ("kis ne kya kiya")
// Every save compares the data with the last save and writes down what was
// added, changed or deleted, by which user, and when. The log syncs to other
// phones like any other data and keeps the latest MAX_ENTRIES entries.
(function(){
  const MAX_ENTRIES=400;
  const MAX_PER_SAVE=15; // more than this in one save (e.g. bulk import) → one summary line

  const TRACKED={
    orders:{icon:'🛒',name:'Order',label:o=>`${o.orderNo||''} ${getPartyName(o.partyId)} ${fmtRs(o.orderTotal)}`},
    parties:{icon:'👤',name:'Party',label:p=>p.name},
    labours:{icon:'🔧',name:'Labour',label:l=>`${l.labourNo||''} ${getKarigarName(l.karigarId)} ${fmtRs(l.totalCost)}`},
    expenses:{icon:'💰',name:'Kharcha',label:e=>`${e.description||''} ${fmtRs(e.amount)}`},
    purchases:{icon:'🛍️',name:'Khareed',label:p=>`${p.purchaseNo||''} ${p.item||''}`},
    inventory:{icon:'📦',name:'Stock',label:i=>`${i.name||''} (${i.qty??''})`},
    suppliers:{icon:'🏪',name:'Supplier',label:s=>s.name},
    bankTransactions:{icon:'🏦',name:'Bank',label:t=>`${t.description||t.note||t.type||''} ${fmtRs(t.amount)}`},
    karigars:{icon:'👷',name:'Karigar',label:k=>k.name},
    quotations:{icon:'📝',name:'Estimate',label:q=>`${q.quoteNo||''} ${getPartyName(q.partyId)}`},
    cheques:{icon:'🧾',name:'Cheque',label:c=>`${c.chequeNo||''} ${fmtRs(c.amount)} ${c.status||''}`}
  };

  let last=null; // collection -> Map(id -> {text, rec})

  function photoless(r){
    if(!r||typeof r!=='object')return r;
    let {designPhoto,photo,...rest}=r;return rest;
  }
  function capture(){
    let all=getDataSnapshot(),out={};
    for(const coll of Object.keys(TRACKED)){
      let m=new Map();
      (all[coll]||[]).forEach(r=>{if(r&&r.id!=null)m.set(r.id,{text:JSON.stringify(photoless(r)),rec:r,paid:coll==='orders'?paidOf(r):0});});
      out[coll]=m;
    }
    return out;
  }
  function currentUserName(){
    let u=activeUserId!=null?staffUsers.find(x=>x.id===activeUserId):null;
    return u?u.name:'Owner';
  }
  function paidOf(o){return typeof getOrderTotalPaid==='function'?getOrderTotalPaid(o):0;}
  function safeLabel(fn,r){try{return String(fn(r)||'').replace(/\s+/g,' ').trim();}catch(e){return '';}}

  function diff(){
    let now=capture(),changes=[];
    if(!last){last=now;return changes;}
    for(const [coll,cfg] of Object.entries(TRACKED)){
      let before=last[coll]||new Map(),after=now[coll];
      after.forEach((v,id)=>{
        let b=before.get(id);
        if(!b){changes.push({type:'add',coll,text:safeLabel(cfg.label,v.rec)});return;}
        if(b.text===v.text)return;
        if(coll==='orders'){
          let delta=v.paid-b.paid;
          if(delta>0){changes.push({type:'pay',coll,text:`${fmtRs(delta)} — ${safeLabel(cfg.label,v.rec)}`});return;}
        }
        changes.push({type:'edit',coll,text:safeLabel(cfg.label,v.rec)});
      });
      before.forEach((v,id)=>{if(!after.has(id))changes.push({type:'del',coll,text:safeLabel(cfg.label,v.rec)});});
    }
    last=now;
    return changes;
  }

  function addEntries(changes){
    if(!changes.length)return;
    let at=new Date().toISOString(),user=currentUserName();
    if(changes.length>MAX_PER_SAVE){
      changes=[{type:'bulk',coll:'',text:`${changes.length} tabdeeliyan ek saath`}];
    }
    changes.forEach(c=>activityLog.push({id:newId(),at,user,type:c.type,coll:c.coll,text:c.text.slice(0,120)}));
    if(activityLog.length>MAX_ENTRIES){
      activityLog.sort((a,b)=>String(a.at).localeCompare(String(b.at)));
      activityLog.splice(0,activityLog.length-MAX_ENTRIES);
    }
  }

  // Record changes on every save made on this phone.
  let origSaveAll=window.saveAll;
  window.saveAll=function(){
    try{addEntries(diff());}catch(e){console.warn('Activity log:',e);}
    return origSaveAll.apply(this,arguments);
  };
  // Data replaced from the cloud, a backup or a restore is not this user's work:
  // just take a fresh starting point.
  let origApplyData=window.applyData;
  window.applyData=function(){
    let r=origApplyData.apply(this,arguments);
    try{last=capture();}catch(e){}
    return r;
  };

  // ── Screen ──
  const TYPE_LABEL={add:['➕','Naya'],edit:['✏️','Badla'],del:['🗑','Delete'],pay:['💳','Payment'],bulk:['📦','Bulk']};
  let filterUser='';

  window.openActivityLog=function(user){
    if(user!==undefined)filterUser=user;
    let modal=document.getElementById('hkActivityModal');
    if(!modal){
      modal=document.createElement('div');
      modal.className='modal';modal.id='hkActivityModal';
      modal.innerHTML=`<div class="modal-box" style="max-width:560px;"><div class="modal-head">📜 Activity — Kis ne kya kiya <button class="modal-close" onclick="closeModal('hkActivityModal')">✕</button></div><div class="modal-body" id="hkActivityBody"></div></div>`;
      document.body.appendChild(modal);
    }
    let users=[...new Set(activityLog.map(a=>a.user))].sort();
    let list=activityLog.filter(a=>!filterUser||a.user===filterUser).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    let day='',rows=[];
    list.slice(0,300).forEach(a=>{
      let d=new Date(a.at);
      let dKey=d.toLocaleDateString('en-PK',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
      if(dKey!==day){day=dKey;rows.push(`<div style="font-size:9px;font-weight:700;color:var(--gray-500);margin:10px 0 4px;">${esc(dKey)}</div>`);}
      let t=TYPE_LABEL[a.type]||['•',''];
      let cfg=TRACKED[a.coll];
      let color=a.type==='del'?'var(--red)':a.type==='pay'?'#16a34a':'inherit';
      rows.push(`<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:10px;align-items:flex-start;">
        <span style="width:42px;flex-shrink:0;color:var(--gray-500);font-size:9px;">${d.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}</span>
        <span style="flex:1;min-width:0;"><span style="color:${color};font-weight:700;">${t[0]} ${t[1]} ${cfg?cfg.icon+' '+cfg.name:''}</span><br><span style="word-break:break-word;">${esc(a.text)}</span></span>
        <span style="flex-shrink:0;font-size:9px;font-weight:700;">👤 ${esc(a.user)}</span>
      </div>`);
    });
    document.getElementById('hkActivityBody').innerHTML=`
      <select class="form-input" style="margin-bottom:6px;" onchange="openActivityLog(this.value)">
        <option value="">Sab users</option>
        ${users.map(u=>`<option value="${esc(u)}" ${u===filterUser?'selected':''}>${esc(u)}</option>`).join('')}
      </select>
      ${rows.length?rows.join(''):'<div class="empty-state"><div class="e-icon">📜</div><p>Abhi koi record nahi — ab se har entry yahan likhi jayegi</p></div>'}`;
    if(!modal.classList.contains('open'))openModal('hkActivityModal');
  };

  function addMenuEntry(){
    let staffBtn=[...document.querySelectorAll('.drawer-item')].find(b=>(b.getAttribute('onclick')||'').includes('openUserSwitcher'));
    if(!staffBtn||document.getElementById('hkActivityDrawerBtn'))return;
    let b=document.createElement('button');
    b.className='drawer-item';b.id='hkActivityDrawerBtn';
    b.setAttribute('onclick','openActivityLog();closeDrawer();');
    b.innerHTML='<span class="t-icon">📜</span>Activity (Kis ne kya kiya)';
    staffBtn.after(b);
  }

  document.addEventListener('hk:ready',()=>{
    try{last=capture();}catch(e){}
    addMenuEntry();
  });
})();
