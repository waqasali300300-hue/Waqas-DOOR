// HK Wood Doors ERP — customer tracking link, karigar fix-up, old customers,
// and the Android back button.
//   • Order tracking: a private link for one customer (status.html#t=…) shows that
//     order's progress, amount paid and balance. Only that order is shared, under a
//     random code that can't be guessed; it updates itself when the order changes.
//   • Labour without a karigar: pick karigars for all of them on one screen.
//   • Purane gahak: parties with no order for 60+ days, with a WhatsApp button.
//   • APK back button: closes the open window, then goes Home, then leaves the app.
(function(){
  const TRACK_DAYS_IDLE=60;
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function waPhone(p){p=String(p||'').replace(/[^0-9]/g,'');if(p.startsWith('0'))p='92'+p.slice(1);return p;}
  function wa(phone,msg){window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(msg)}`,'_blank');}
  function modal(id,title,html){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:520px;"><div class="modal-head"><span id="${id}T"></span> <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}B"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById(id+'T').textContent=title;
    document.getElementById(id+'B').innerHTML=html;
    if(!m.classList.contains('open'))openModal(id);
  }
  function addMenu(id,icon,label,fn,afterSel){
    if(document.getElementById(id))return;
    let anchor=document.querySelector(afterSel);if(!anchor)return;
    anchor.insertAdjacentHTML('afterend',`<button class="drawer-item" id="${id}" onclick="${fn};closeDrawer();"><span class="t-icon">${icon}</span>${label}</button>`);
  }

  // ════════ Order tracking link ════════
  function newToken(){
    let a=new Uint8Array(12);crypto.getRandomValues(a);
    return [...a].map(b=>'abcdefghijkmnpqrstuvwxyz23456789'[b%32]).join('');
  }
  function trackData(o){
    let p=getPartyById(o.partyId)||{},bp=businessProfile||{};
    let paid=getOrderTotalPaid(o);
    return {shop:{name:bp.name||'',phone:bp.phone||'',whatsapp:bp.whatsapp||bp.phone||'',address:[bp.address,bp.city].filter(Boolean).join(', ')},
      orderNo:o.orderNo||'',party:p.name||'',date:o.date||'',deliveryDate:o.deliveryDate||'',status:o.status||'pending',
      doors:(o.doors||[]).map(d=>({size:d.size||'',qty:num(d.qty)||1})),
      total:num(o.orderTotal),paid,balance:Math.max(0,num(o.orderTotal)-paid),currency:bp.currency||'Rs.'};
  }
  function trackUrl(o){let c=typeof getFirebaseCfg==='function'&&getFirebaseCfg();return hkPublicBase()+'status.html#p='+encodeURIComponent((c&&c.projectId)||'')+'&t='+o.trackId;}
  function ready(){return typeof cloudEnabled!=='undefined'&&cloudEnabled&&db;}
  const sentSig={};
  async function publishTrack(o){
    if(!o.trackId||!ready())return false;
    let data=trackData(o),sig=JSON.stringify(data);
    if(sentSig[o.trackId]===sig)return true;
    await db.collection('public').doc('t_'+o.trackId).set({...data,updatedAt:new Date().toISOString()});
    sentSig[o.trackId]=sig;
    return true;
  }
  window.shareOrderTracking=async function(id){
    let o=orders.find(x=>x.id===id);if(!o)return;
    if(!ready()){showToast('⚠️ Tracking link ke liye cloud se juda hona zaroori hai');return;}
    if(!o.trackId){o.trackId=newToken();saveAll();}
    try{await publishTrack(o);}catch(e){showToast('⚠️ Link nahi bana: '+(e.message||e));return;}
    let p=getPartyById(o.partyId)||{};
    let msg=`Assalam-o-Alaikum ${p.name||''},\n${businessProfile.name||''} — aap ke order *${o.orderNo}* ki taza soorat-e-haal is link par dekhein (yeh khud update hota rehta hai):\n${trackUrl(o)}\nShukriya!`;
    if(p.phone)wa(p.phone,msg);
    else{try{await navigator.clipboard.writeText(msg);}catch(e){}showToast('📋 Link copy ho gaya (party ka phone number nahi tha)');}
  };
  window.hkTrackUrl=o=>o&&o.trackId?trackUrl(o):'';
  // Shared orders follow every change (status, payments, delivery date).
  let pubTimer=null;
  let origSaveAll=window.saveAll;
  window.saveAll=function(){
    let r=origSaveAll.apply(this,arguments);
    if(ready()&&orders.some(o=>o.trackId)){
      clearTimeout(pubTimer);
      pubTimer=setTimeout(()=>{orders.filter(o=>o.trackId).forEach(o=>publishTrack(o).catch(()=>{}));},3000);
    }
    return r;
  };
  // Button in the order screen.
  let origView=window.viewOrderDetail;
  window.viewOrderDetail=function(id){
    let r=origView.apply(this,arguments);
    let c=document.getElementById('orderDetailContent');
    if(c&&!c.querySelector('.hk-track-btn')){
      let o=orders.find(x=>x.id===id);
      c.insertAdjacentHTML('afterbegin',`<button class="btn btn-gold btn-sm hk-track-btn" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="shareOrderTracking(${id})">🔗 Gahak ko order ka live link bhejein${o&&o.trackId?' (dobara)':''}</button>`);
    }
    return r;
  };

  // ════════ Labour without a karigar ════════
  function looseLabour(){return labours.filter(l=>!karigars.some(k=>String(k.id)===String(l.karigarId)));}
  window.openLabourFix=function(){
    let list=looseLabour();
    if(!karigars.length){
      modal('hkLabFixModal','👷 Karigar chunein',`<p style="font-size:11px;">Pehle karigar add karein, phir yahan har labour ka karigar chun sakte hain.</p>
        <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="closeModal('hkLabFixModal');openKarigarList()">🔧 Karigar Manager kholein</button>`);
      return;
    }
    let opts=`<option value="">— chunein —</option>`+karigars.map(k=>`<option value="${k.id}">${esc(k.name)}</option>`).join('');
    modal('hkLabFixModal','👷 Karigar chunein ('+list.length+')',list.length?`
      <p style="font-size:10px;color:var(--gray-500);margin-bottom:8px;">In labour records mein karigar nahi chuna gaya. Har ek ka karigar chun kar Save dabayein.</p>
      ${list.map(l=>{let o=orders.find(x=>x.id==l.orderId);return `<div class="khata-card" style="margin-bottom:6px;">
        <div style="font-size:10.5px;"><b>${esc(l.labourNo||'')}</b> · ${esc(l.date||'')} · <b>${fmtRs(l.totalCost)}</b>${o?` · ${esc(o.orderNo||'')} ${esc(getPartyName(o.partyId))}`:''}</div>
        <select class="form-input hk-labfix" data-id="${l.id}" style="margin-top:4px;">${opts}</select></div>`;}).join('')}
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:6px;" onclick="saveLabourFix()">💾 Save</button>`
      :'<div class="empty-state"><div class="e-icon">✅</div><p>Sab labour mein karigar chuna hua hai</p></div>');
  };
  window.saveLabourFix=function(){
    let n=0;
    document.querySelectorAll('.hk-labfix').forEach(sel=>{
      if(!sel.value)return;
      let l=labours.find(x=>String(x.id)===sel.dataset.id);
      if(l){l.karigarId=parseInt(sel.value);l.updatedAt=new Date().toISOString();n++;}
    });
    if(!n){showToast('⚠️ Kam az kam ek karigar chunein');return;}
    saveAll();renderAll();
    showToast(`✅ ${n} labour mein karigar lag gaya`);
    openLabourFix();
  };

  // ════════ Purane gahak ════════
  function lastOrderDate(p){
    return orders.filter(o=>o.partyId==p.id).map(o=>String(o.date||'')).sort().pop()||'';
  }
  window.openOldCustomers=function(){
    let cut=new Date(Date.now()-TRACK_DAYS_IDLE*86400000).toISOString().slice(0,10);
    let list=parties.map(p=>({p,last:lastOrderDate(p)})).filter(x=>x.last&&x.last<cut).sort((a,b)=>a.last.localeCompare(b.last));
    modal('hkOldCustModal','👥 Purane gahak',`
      <p style="font-size:10px;color:var(--gray-500);margin-bottom:8px;">Jin parties ne ${TRACK_DAYS_IDLE} din se zyada se order nahi diya. Salam bhej kar naye designs bata dein.</p>
      ${list.length?list.map(x=>{let days=Math.floor((Date.now()-Date.parse(x.last))/86400000);return `<div class="khata-card" style="margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <span style="font-size:10.5px;"><b>${esc(x.p.name)}</b><br><small style="color:var(--gray-500);">Aakhri order: ${esc(x.last)} (${days} din pehle)</small></span>
        ${x.p.phone?`<button class="btn btn-success btn-xs" onclick="greetOldCustomer(${x.p.id})">💬 Salam</button>`:'<small style="color:var(--gray-500);">phone nahi</small>'}</div>`;}).join('')
        :'<div class="empty-state"><div class="e-icon">🎉</div><p>Sab gahak haal hi mein order de chuke hain</p></div>'}`);
  };
  window.greetOldCustomer=function(id){
    let p=getPartyById(id);if(!p)return;
    let bp=businessProfile||{};
    let link=bp.catalogOn&&typeof getFirebaseCfg==='function'&&getFirebaseCfg()?hkPublicBase()+'catalog.html#p='+encodeURIComponent(getFirebaseCfg().projectId)+'&k='+encodeURIComponent(getFirebaseCfg().apiKey):'';
    wa(p.phone,`Assalam-o-Alaikum ${p.name},\n${bp.name||''} ki taraf se. Kafi din ho gaye — hamare paas naye designs aaye hain.${link?`\nDesigns aur rates yahan dekhein: ${link}`:''}\nKoi kaam ho to zaroor batayein. Shukriya!`);
  };

  // ════════ Android back button (APK) ════════
  function onBack(){
    if(document.querySelector('.hk-pin-lock')){cap().App.minimizeApp&&cap().App.minimizeApp();return;}
    let sheet=document.querySelector('.hk-src-sheet,div[style*="z-index:20000"]');
    if(sheet){sheet.remove();return;}
    let open=[...document.querySelectorAll('.modal.open')];
    if(open.length){
      let top=open.sort((a,b)=>(parseInt(b.style.zIndex)||500)-(parseInt(a.style.zIndex)||500))[0];
      if(top.id==='confirmModal'&&typeof customConfirmCancel==='function')customConfirmCancel();else closeModal(top.id);
      return;
    }
    if(document.getElementById('fbSetupOverlay')?.classList.contains('open')){document.getElementById('fbSetupOverlay').classList.remove('open');return;}
    if(document.getElementById('drawerNav')?.classList.contains('open')){closeDrawer();return;}
    let active=document.querySelector('.tab.active');
    if(active&&active.id!=='tabHome'){switchTab('tabHome');return;}
    let a=cap().App;
    if(a.minimizeApp)a.minimizeApp();else if(a.exitApp)a.exitApp();
  }
  function cap(){return (window.Capacitor&&Capacitor.Plugins)||{};}
  window.hkBackButton=onBack;

  document.addEventListener('hk:ready',()=>{
    addMenu('hkOldCustBtn','👥','Purane Gahak (Salam bhejein)','openOldCustomers()','.drawer-item[data-tab="tabParties"]');
    if(window.hkNative&&cap().App&&cap().App.addListener)cap().App.addListener('backButton',onBack);
  });
})();

// Labour without a karigar: the Home item opens the one-screen fix.
(window.hkAttentionSources=window.hkAttentionSources||[]).push(()=>{
  let n=labours.filter(l=>!karigars.some(k=>String(k.id)===String(l.karigarId))).length;
  return n?[{icon:'👷',tone:'warn',text:`${n} labour record mein karigar nahi chuna — yahan dabayein`,go:'openLabourFix()'}]:[];
});
