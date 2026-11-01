// HK Wood Doors ERP — bill photos, morning summary, online catalog
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function modal(id,title,html,wide){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:${wide?620:480}px;"><div class="modal-head"><span id="${id}T"></span> <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}B"></div></div>`;
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
  function shrink(file,maxW,q){
    return new Promise((res,rej)=>{
      let r=new FileReader();
      r.onload=e=>{let img=new Image();img.onload=()=>{
        let sc=Math.min(1,maxW/img.width),c=document.createElement('canvas');
        c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        res(c.toDataURL('image/jpeg',q));
      };img.onerror=()=>rej(new Error('Tasveer nahi khuli'));img.src=e.target.result;};
      r.onerror=()=>rej(new Error('File nahi parhi'));r.readAsDataURL(file);
    });
  }

  // ════════ 4. Bill / receipt photo on kharcha and khareed ════════
  // undefined = unchanged, null = removed, string = new photo
  let pendingBill;
  function billBlock(rec){
    let ph=rec&&rec.billPhoto;
    return `<div class="form-group" id="hkBillGroup"><label class="form-label">📷 Bill / Rasid ki tasveer</label>
      <div id="hkBillPrev">${ph?`<img src="${ph}" style="max-width:100%;max-height:140px;border-radius:8px;border:1px solid var(--border);display:block;margin-bottom:6px;">`:''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <label class="btn btn-outline btn-sm" style="cursor:pointer;">📷 ${ph?'Tasveer badlein':'Tasveer lagayein'}<input type="file" accept="image/*" capture="environment" style="display:none;" onchange="hkPickBill(this.files[0])"></label>
        ${ph?'<button type="button" class="btn btn-outline btn-sm" onclick="hkRemoveBill()">🗑 Hatayein</button>':''}
      </div></div>`;
  }
  window.hkPickBill=async function(file){
    if(!file)return;
    try{
      pendingBill=await shrink(file,1200,0.72);
      let p=document.getElementById('hkBillPrev');
      if(p)p.innerHTML=`<img src="${pendingBill}" style="max-width:100%;max-height:140px;border-radius:8px;border:1px solid var(--border);display:block;margin-bottom:6px;">`;
      showToast('✅ Tasveer lag gayi — Save dabayein');
    }catch(e){showToast('⚠️ '+e.message);}
  };
  window.hkRemoveBill=function(){pendingBill=null;let p=document.getElementById('hkBillPrev');if(p)p.innerHTML='<small style="color:var(--gray-500);">Tasveer Save par hat jayegi</small>';};
  function hookBill(openName,saveName,arr,editIdFn,anchorId){
    let origOpen=window[openName];
    window[openName]=function(id){
      pendingBill=undefined;
      let r=origOpen.apply(this,arguments);
      try{
        let a=document.getElementById(anchorId)?.closest('.form-group');
        if(a&&!document.getElementById('hkBillGroup')){
          let rec=id?arr().find(x=>x.id===id):null;
          a.insertAdjacentHTML('afterend',billBlock(rec));
        }
      }catch(e){}
      return r;
    };
    let origSave=window[saveName];
    window[saveName]=function(){
      let editId=editIdFn(),before=arr().length,pick=pendingBill;
      let r=origSave.apply(this,arguments);
      let rec=editId?arr().find(x=>x.id===editId):(arr().length>before?arr()[arr().length-1]:null);
      if(rec&&pick!==undefined){if(pick)rec.billPhoto=pick;else delete rec.billPhoto;saveAll();}
      pendingBill=undefined;
      return r;
    };
  }
  hookBill('openExpenseModal','saveExpense',()=>expenses,()=>editingExpenseId,'expAmount');
  hookBill('openPurchaseModal','savePurchase',()=>purchases,()=>editingPurchaseId,'purchaseRate');
  window.viewBill=function(kind,id){
    let rec=(kind==='exp'?expenses:purchases).find(x=>x.id===id);
    if(!rec||!rec.billPhoto){showToast('Tasveer abhi doosre device se aa rahi hai');return;}
    modal('hkBillView','📷 Bill',`<img src="${rec.billPhoto}" style="width:100%;border-radius:10px;">`,true);
  };
  function markLists(listId,fnName,kind,arr){
    document.querySelectorAll(`#${listId} button[onclick^="${fnName}("]`).forEach(b=>{
      let id=parseInt((b.getAttribute('onclick').match(/\((\d+)\)/)||[])[1]);
      let rec=arr().find(x=>x.id===id);
      if(rec&&(rec.billPhoto||rec.billPhotoRef)&&!b.parentElement.querySelector('.hk-bill-btn'))
        b.insertAdjacentHTML('beforebegin',`<button class="btn btn-outline btn-xs hk-bill-btn" onclick="viewBill('${kind}',${id})">📷</button>`);
    });
  }
  ['renderExpenses','renderPurchases'].forEach(n=>{
    let orig=window[n];
    window[n]=function(){let r=orig.apply(this,arguments);try{
      if(n==='renderExpenses')markLists('expensesList','editExpense','exp',()=>expenses);
      else markLists('purchasesList','editPurchase','pur',()=>purchases);
    }catch(e){}return r;};
  });

  // ════════ 6. Morning summary ════════
  const MORNING_KEY='hk_morning_seen',MORNING_OFF='hk_morning_off';
  window.openMorning=function(){
    let t=today(),y=new Date(Date.now()-864e5).toISOString().slice(0,10);
    let line=(icon,text,amt,go,tone)=>`<button class="hm-row" onclick="closeModal('hkMorning');${go}"><span class="hm-dot ${tone||''}">${icon}</span><span class="hm-row-text">${text}</span>${amt?`<span class="hm-row-amt">${fmtRs(amt)}</span>`:''}<span class="hm-chev">›</span></button>`;
    let rows=[];
    let open=orders.filter(o=>(o.status||'pending')!=='delivered');
    let late=open.filter(o=>o.deliveryDate&&o.deliveryDate<t),due=open.filter(o=>o.deliveryDate===t);
    late.forEach(o=>rows.push(line('⏰',`<b>${esc(o.orderNo)}</b> ${esc(getPartyName(o.partyId))} — delivery late (${esc(o.deliveryDate)})`,0,`viewOrderDetail(${o.id})`,'bad')));
    due.forEach(o=>rows.push(line('🚚',`<b>${esc(o.orderNo)}</b> ${esc(getPartyName(o.partyId))} — <b>aaj deni hai</b>`,0,`viewOrderDetail(${o.id})`,'warn')));
    cheques.filter(c=>c.status==='pending'&&c.dueDate&&c.dueDate<=t).forEach(c=>rows.push(line('🧾',`Cheque ${esc(c.chequeNo||'')} ${c.dueDate<t?'ki tareekh guzar gayi':'aaj ka'}`,num(c.amount),'openChequeListModal()',c.dueDate<t?'bad':'warn')));
    let dues=parties.map(p=>({p,b:getPartyBalance(p)})).filter(x=>x.b>0).sort((a,b)=>b.b-a.b).slice(0,5);
    let duesHtml=dues.map(x=>line('📒',esc(x.p.name),x.b,`openReceivePaymentModal(${x.p.id})`,'info')).join('');
    let short=(window.hkWoodShort?hkWoodShort():[]).filter(r=>r.short>0);
    let lowInv=inventory.filter(i=>num(i.minStock)>0&&num(i.qty)<=num(i.minStock));
    let stock=[...short.map(r=>`${r.w.name} ${Math.ceil(r.short)} cft`),...lowInv.map(i=>`${i.name} (${i.qty})`)];
    let kDue=labours.reduce((s,l)=>s+Math.max(0,num(l.totalCost)-num(l.paid)),0);
    let ySale=orders.filter(o=>o.date===y).reduce((s,o)=>s+num(o.orderTotal),0);
    let yIn=bankTransactions.filter(x=>x.date===y&&x.type==='deposit').reduce((s,x)=>s+num(x.amount),0);
    let yOut=bankTransactions.filter(x=>x.date===y&&x.type!=='deposit').reduce((s,x)=>s+num(x.amount),0);
    let hr=new Date().getHours();
    modal('hkMorning',hr<12?'☀️ Subah bakhair — aaj ka khaka':'📋 Aaj ka khaka',`
      <div style="font-size:11px;color:var(--gray-500);margin-bottom:8px;">${new Date().toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'long'})}</div>
      <div class="hm-card-head">Aaj ke kaam</div>${rows.join('')||'<div class="hm-empty">✅ Aaj koi delivery ya cheque nahi</div>'}
      <div class="hm-card-head" style="margin-top:10px;">Wasooli — sab se zyada baqaya</div>${duesHtml||'<div class="hm-empty">✅ Kisi ka baqaya nahi</div>'}
      ${stock.length?`<div class="hm-card-head" style="margin-top:10px;">Stock kam</div>${line('📦',esc(stock.slice(0,4).join(', ')),0,'openWoodBuyList()','warn')}`:''}
      ${kDue>0?line('🔧','Karigaron ko dena hai',kDue,'openKarigarPay()','info'):''}
      <div class="hm-card-head" style="margin-top:10px;">Kal ka hisaab</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;">
        <div class="hm-stage on"><div class="hm-stage-n" style="font-size:13px;">${fmtRs(ySale)}</div><div class="hm-stage-l">Sale</div></div>
        <div class="hm-stage on"><div class="hm-stage-n" style="font-size:13px;color:#16a34a;">${fmtRs(yIn)}</div><div class="hm-stage-l">Aaya</div></div>
        <div class="hm-stage on"><div class="hm-stage-n" style="font-size:13px;color:#dc2626;">${fmtRs(yOut)}</div><div class="hm-stage-l">Gaya</div></div>
      </div>
      <label class="hk-auto-check" style="margin-top:10px;"><input type="checkbox" ${localStorage.getItem(MORNING_OFF)?'':'checked'} onchange="try{this.checked?localStorage.removeItem('${MORNING_OFF}'):localStorage.setItem('${MORNING_OFF}','1')}catch(e){}"><span>Roz pehli dafa app kholne par yeh dikhayein</span></label>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" onclick="closeModal('hkMorning')">👍 Theek hai, kaam shuru</button>`);
    try{localStorage.setItem(MORNING_KEY,t);}catch(e){}
  };
  function maybeMorning(){
    try{if(localStorage.getItem(MORNING_OFF)||localStorage.getItem(MORNING_KEY)===today())return;}catch(e){return;}
    if(!orders.length&&!parties.length)return;
    if(document.querySelector('.hk-pin-overlay')||document.querySelector('.modal.open')){setTimeout(maybeMorning,1500);return;}
    openMorning();
  }

  // ════════ 3. Online catalog for customers ════════
  // The owner publishes the Rate List (sizes, rates, photos) to a public part of
  // the cloud. catalog.html shows it to anyone with the link; customers pick
  // sizes and send the order request to the owner on WhatsApp. Nothing else
  // (khata, orders, parties) is ever public.
  function catalogContent(){
    let bp=businessProfile;
    return {name:bp.name||'',tagline:bp.tagline||'',phone:bp.phone||'',whatsapp:bp.whatsapp||bp.phone||'',address:[bp.address,bp.city].filter(Boolean).join(', '),
      currency:bp.currency||'Rs.',footer:bp.footerNote||'',
      items:priceList.filter(p=>p&&p.size).map(p=>({size:String(p.size),rate:num(p.rate),photo:p.photo?photoRef(p.photo):''}))};
  }
  function catalogLink(){
    let c=getFirebaseCfg();if(!c)return '';
    return location.origin+location.pathname.replace(/[^/]*$/,'')+'catalog.html#p='+encodeURIComponent(c.projectId)+'&k='+encodeURIComponent(c.apiKey);
  }
  let pubTimer=null,lastPub='';
  async function publishCatalog(quiet){
    if(!cloudEnabled||!db){if(!quiet)showToast('⚠️ Pehle cloud se jorein (ghar par sabz dabba)');return false;}
    let data=catalogContent();
    try{
      let sent=JSON.parse(localStorage.getItem('hk_pub_photos')||'[]');
      for(const p of priceList){
        if(!p||!p.photo)continue;
        let ref=photoRef(p.photo);
        if(sent.includes(ref))continue;
        await db.collection('public').doc('ph_'+ref).set({data:p.photo});
        sent.push(ref);
      }
      localStorage.setItem('hk_pub_photos',JSON.stringify(sent));
      await db.collection('public').doc('catalog').set({...data,updatedAt:new Date().toISOString()});
      lastPub=JSON.stringify(data);
      if(!businessProfile.catalogOn){businessProfile.catalogOn=true;saveAll();}
      if(!quiet)showToast('✅ Catalog online ho gaya');
      return true;
    }catch(e){
      if(!quiet)showToast(e&&e.code==='permission-denied'?'⚠️ Firebase Rules dobara Publish karein (neeche "Naye Rules" dekhein)':'⚠️ Catalog nahi gaya: '+(e.message||e));
      return false;
    }
  }
  window.publishCatalog=publishCatalog;
  window.openCatalog=function(){
    let link=catalogLink(),on=!!businessProfile.catalogOn;
    let cfg=getFirebaseCfg();
    modal('hkCatalog','🛍️ Online Catalog (Gahak ke liye)',`
      <p style="font-size:12px;line-height:1.6;">Aap ki <b>Rate List</b> (size, rate, tasveerein) ek link par gahak dekh sakte hain. Woh size aur ginti chun kar <b>WhatsApp par order request</b> bhejte hain. Khata, orders ya parties kabhi online nahi jatin.</p>
      <div style="font-size:11px;margin:8px 0;">Rate List mein <b>${priceList.length}</b> items · WhatsApp: <b>${esc(businessProfile.whatsapp||businessProfile.phone||'— Settings mein likhein')}</b></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="publishCatalog().then(ok=>ok&&openCatalog())">${on?'🔄 Catalog Update karein':'🚀 Catalog Online karein'}</button>
      ${on&&link?`<div style="margin-top:10px;"><div style="font-size:11px;font-weight:700;margin-bottom:4px;">Gahak ko yeh link bhejein:</div>
        <input class="form-input" readonly value="${esc(link)}" style="font-size:10px;">
        <div style="display:flex;gap:6px;margin-top:6px;">
          <button class="btn btn-success btn-sm" style="flex:1;justify-content:center;" onclick="window.open('https://wa.me/?text='+encodeURIComponent('${esc(businessProfile.name||'')} ka catalog — size chun kar order bhejein: ${esc(link)}'),'_blank')">💬 WhatsApp</button>
          <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center;" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(link)}').then(()=>showToast('📋 Link copy'))">📋 Copy</button>
          <button class="btn btn-outline btn-sm" style="flex:1;justify-content:center;" onclick="window.open('${esc(link)}','_blank')">👀 Dekhein</button>
        </div>
        <p style="font-size:9.5px;color:var(--gray-500);margin-top:6px;">Rate List badlenge to catalog khud update ho jayega.</p></div>`:''}
      <div style="margin-top:12px;padding:8px;border:1px dashed var(--border);border-radius:10px;font-size:10px;">
        <b>Pehli dafa zaroori:</b> Firebase Rules mein catalog ki line shamil karni hai. Naye Rules copy kar ke Firebase → Firestore → Rules mein paste aur <b>Publish</b> karein.
        <button class="btn btn-outline btn-xs" style="margin-top:6px;" onclick="navigator.clipboard&&navigator.clipboard.writeText(fbRulesText('${esc((cfg&&cfg.email)||'')}')).then(()=>showToast('📋 Naye Rules copy ho gaye'))">📋 Naye Rules copy</button>
      </div>`);
  };
  // Keep the published catalog in step with the Rate List and business details.
  let origSaveAll=window.saveAll;
  window.saveAll=function(){
    let r=origSaveAll.apply(this,arguments);
    try{
      if(businessProfile.catalogOn&&typeof cloudEnabled!=='undefined'&&cloudEnabled){
        let now=JSON.stringify(catalogContent());
        if(now!==lastPub){clearTimeout(pubTimer);pubTimer=setTimeout(()=>publishCatalog(true),5000);}
      }
    }catch(e){}
    return r;
  };

  document.addEventListener('hk:ready',()=>{
    addMenu('hkMorningBtn','☀️','Aaj ka Khaka (Subah)','openMorning()','.drawer-item[data-tab="tabHome"]');
    addMenu('hkCatalogBtn','🛍️','Online Catalog (Gahak)','openCatalog()','.drawer-item[onclick*="openPriceListModal"]');
    setTimeout(maybeMorning,2000);
  });
})();

// Warn early if the cloud copy is getting close to Firestore's 1MB limit.
(window.hkAttentionSources=window.hkAttentionSources||[]).push(()=>{
  let z=window._hkCloudSize||0;
  return z>800000?[{icon:'☁️',tone:'warn',text:`Cloud ki jagah ${Math.round(z/10485.76)}% bhar gayi — purana data archive karne ke liye rabta karein`,go:'openSettingsModal()'}]:[];
});
