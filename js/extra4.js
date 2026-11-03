// HK Wood Doors ERP — catalog request → estimate, karigar advance, stock count,
// staff limits, design report, year closing.
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function isStaff(){return typeof hkIsStaff==='function'&&hkIsStaff();}
  function modal(id,title,html,wide){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:${wide?640:520}px;"><div class="modal-head"><span id="${id}T"></span> <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}B"></div></div>`;
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
  function pdfFromHTML(html,elId,filename){
    let temp=document.createElement('div');
    temp.innerHTML=html;
    temp.style.cssText='position:fixed;left:0;top:0;width:800px;background:#fff;z-index:150;pointer-events:none;';
    document.body.appendChild(temp);
    return downloadPDF(elId,filename).finally(()=>temp.remove());
  }

  // ════════ 3. Catalog request → estimate ════════
  // catalog.html adds a link (#est=…) to the customer's WhatsApp message; when the
  // owner taps it the app opens and makes the estimate from it.
  function readRequest(code){
    try{
      let s=code.replace(/-/g,'+').replace(/_/g,'/');while(s.length%4)s+='=';
      let d=JSON.parse(decodeURIComponent(escape(atob(s))));
      if(!d||!Array.isArray(d.i)||!d.i.length)return null;
      return {name:String(d.n||'').slice(0,80),phone:String(d.p||'').slice(0,30),
        items:d.i.slice(0,50).map(x=>({size:String(x[0]||'').slice(0,80),qty:Math.max(1,Math.min(999,parseInt(x[1])||1)),rate:num(x[2])})).filter(x=>x.size)};
    }catch(e){return null;}
  }
  function digits(p){return String(p||'').replace(/[^0-9]/g,'').slice(-10);}
  function findOrMakeParty(name,phone){
    let ph=digits(phone);
    let p=(ph.length>=9&&parties.find(x=>digits(x.phone)===ph))||(name&&parties.find(x=>String(x.name||'').trim().toLowerCase()===name.trim().toLowerCase()));
    if(p)return p;
    p={id:newId(),name:name||'Catalog gahak',phone:phone||'',area:'',address:'',openingBalance:0,createdAt:new Date().toISOString()};
    parties.push(p);
    return p;
  }
  function makeDoor(it){
    let m=/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/.exec(it.size);
    let d={size:it.size,w:m?num(m[1]):0,h:m?num(m[2]):0,qty:it.qty,rate:it.rate||440,woodId:(woodTypes[0]&&woodTypes[0].id)||1,
      thickness:defaultThickness,doorAmount:0,woodCft:0,labourPerDoor:0,cftMode:'auto'};
    recalcDoor(d);
    return d;
  }
  window.hkMakeEstimateFromRequest=function(req){
    let p=findOrMakeParty(req.name,req.phone);
    let doors=req.items.map(makeDoor);
    quoteCounter++;
    let now=new Date().toISOString();
    let q={id:newId(),quoteNo:'EST-'+quoteCounter,status:'pending',partyId:p.id,date:today(),
      validUntil:new Date(Date.now()+7*86400000).toISOString().slice(0,10),note:'Online catalog se request',
      doors,quoteTotal:doors.reduce((s,d)=>s+num(d.doorAmount),0),totalWoodCft:doors.reduce((s,d)=>s+getDoorCft(d),0),
      totalWoodCost:doors.reduce((s,d)=>s+getDoorWoodCost(d),0),designPhoto:null,createdAt:now,updatedAt:now};
    quotations.push(q);
    saveAll();
    return q;
  };
  function handleRequestLink(){
    let m=location.hash.match(/^#est=([A-Za-z0-9_\-]+)$/);if(!m)return;
    history.replaceState(null,'',location.pathname+location.search);
    let req=readRequest(m[1]);
    if(!req){showToast('⚠️ Catalog request ka link poora nahi');return;}
    modal('hkReqModal','🛒 Catalog se request',`
      <div style="font-size:11px;margin-bottom:6px;"><b>${esc(req.name||'Gahak')}</b>${req.phone?' · '+esc(req.phone):''}</div>
      ${req.items.map(x=>`<div style="font-size:11px;padding:4px 0;border-bottom:1px solid var(--border);">🚪 ${esc(x.size)} × ${x.qty}${x.rate?` · ${fmtRs(x.rate)}/sq.ft`:''}</div>`).join('')}
      <p style="font-size:9px;color:var(--gray-500);margin:8px 0;">Estimate ban jayega; aap rate aur cheezein check kar ke badal sakte hain.</p>
      <button class="btn btn-primary" style="width:100%;justify-content:center;" id="hkReqMake">📝 Estimate banayein</button>`);
    document.getElementById('hkReqMake').onclick=()=>{
      let q=hkMakeEstimateFromRequest(req);
      closeModal('hkReqModal');
      showToast('✅ '+q.quoteNo+' ban gaya — check kar lein');
      if(typeof openQuotationModal==='function')openQuotationModal(q.id);
    };
  }

  // ════════ 4. Karigar advance ════════
  function karigar(kid){return karigars.find(k=>String(k.id)===String(kid));}
  function advanceLeft(k){return (k&&k.advances||[]).reduce((s,a)=>s+num(a.amount)-num(a.used),0);}
  window.hkAdvanceLeft=kid=>advanceLeft(karigar(kid));
  // Labour paid from an advance was already counted in the cash book when the
  // advance was given, so the labour's cash line shows only the cash part.
  function fixAdvanceTx(l){
    if(!num(l.advPaid))return;
    let cash=num(l.paid)-num(l.advPaid);
    let tx=l.bankTxId&&bankTransactions.find(t=>t.id===l.bankTxId);
    if(!tx)return;
    if(cash>0)tx.amount=cash;
    else{bankTransactions=bankTransactions.filter(t=>t.id!==l.bankTxId);l.bankTxId=null;}
  }
  function useAdvance(kid){
    let k=karigar(kid),left=advanceLeft(k);if(left<=0)return 0;
    let recs=labours.filter(l=>String(l.karigarId)===String(kid)&&num(l.totalCost)>num(l.paid)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    let used=0;
    for(const l of recs){
      if(left<=0)break;
      let x=Math.min(left,num(l.totalCost)-num(l.paid));
      l.paid=num(l.paid)+x;l.advPaid=num(l.advPaid)+x;left-=x;used+=x;
    }
    let toMark=used;
    for(const a of k.advances||[]){
      if(toMark<=0)break;
      let x=Math.min(toMark,num(a.amount)-num(a.used));
      a.used=num(a.used)+x;toMark-=x;
    }
    return used;
  }
  window.giveKarigarAdvance=function(){
    let kid=document.getElementById('hkAdvKar')?.value,amt=num(document.getElementById('hkAdvAmt')?.value);
    let acc=document.getElementById('hkAdvAcc')?.value||'Cash',note=(document.getElementById('hkAdvNote')?.value||'').trim();
    let k=karigar(kid);
    if(!k){showToast('⚠️ Karigar chunein');return;}
    if(amt<=0){showToast('⚠️ Raqam likhein');return;}
    let txId=newId(),now=new Date().toISOString();
    bankTransactions.push({id:txId,type:'withdrawal',account:acc,amount:amt,date:today(),description:`Advance to ${k.name}${note?' — '+note:''}`,createdAt:now});
    (k.advances=k.advances||[]).push({id:newId(),date:today(),amount:amt,account:acc,note,used:0,bankTxId:txId});
    saveAll();renderAll();
    showToast(`✅ ${k.name} ko ${fmtRs(amt)} advance — agli payment se khud kat jayega`);
    openKarigarPay();
  };
  let origKarPay=window.openKarigarPay;
  window.openKarigarPay=function(){
    let r=origKarPay.apply(this,arguments);
    let body=document.getElementById('hkKarPayModalBody');if(!body)return r;
    // Each karigar with an advance: show it, tick "kaat lein", and lower the cash amount.
    body.querySelectorAll('input[id^="kpAmt_"]').forEach(inp=>{
      let kid=inp.id.slice(6),left=advanceLeft(karigar(kid));
      if(left<=0)return;
      let due=num(inp.value);
      inp.value=Math.max(0,Math.round(due-left));
      inp.parentElement.insertAdjacentHTML('afterend',`<label style="display:flex;gap:6px;align-items:center;font-size:10px;margin-top:4px;color:#b45309;">
        <input type="checkbox" id="kpAdv_${kid}" checked onchange="document.getElementById('kpAmt_${kid}').value=Math.max(0,Math.round(${due}-(this.checked?${left}:0)))">
        Advance baqi ${fmtRs(left)} — is payment mein kaat lein</label>`);
    });
    let opts=karigars.map(k=>`<option value="${k.id}">${esc(k.name)}${advanceLeft(k)>0?` (advance ${fmtRs(advanceLeft(k))})`:''}</option>`).join('');
    body.insertAdjacentHTML('beforeend',karigars.length?`<div style="margin-top:12px;padding:10px;border:1px dashed var(--border);border-radius:12px;">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;">💸 Advance dein</div>
      <select class="form-select" id="hkAdvKar" style="margin-bottom:6px;">${opts}</select>
      <div style="display:flex;gap:6px;">
        <input class="form-input" type="number" id="hkAdvAmt" placeholder="Raqam" style="flex:1;">
        <select class="form-select" id="hkAdvAcc" style="width:auto;">${BANK_ACCOUNTS.map(b=>`<option>${b}</option>`).join('')}</select>
      </div>
      <input class="form-input" id="hkAdvNote" placeholder="Note (maslan: ghar ka kaam)" style="margin-top:6px;">
      <button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:6px;" onclick="giveKarigarAdvance()">💸 Advance dein</button>
      <p style="font-size:8.5px;color:var(--gray-500);margin-top:4px;">Advance Cash Book mein abhi likha jayega aur agli mazdoori ki payment se khud kat jayega.</p></div>`:'');
    return r;
  };
  let origPayKar=window.payKarigar;
  window.payKarigar=function(kid){
    let box=document.getElementById('kpAdv_'+kid);
    let used=box&&box.checked?useAdvance(kid):0;
    let cash=num(document.getElementById('kpAmt_'+kid)?.value);
    if(cash>0)origPayKar.apply(this,arguments);
    labours.filter(l=>String(l.karigarId)===String(kid)).forEach(fixAdvanceTx);
    if(used||cash>0){saveAll();renderAll();}
    if(used)showToast(`✅ ${getKarigarName(kid)}: ${fmtRs(used)} advance se kata${cash>0?` + ${fmtRs(cash)} naqad`:''}`);
    else if(cash<=0)showToast('⚠️ Amount likhein');
    if(used&&cash<=0)openKarigarPay();
  };
  let origSaveLabour=window.saveLabour;
  window.saveLabour=function(){
    let r=origSaveLabour.apply(this,arguments);
    try{if(labours.some(l=>num(l.advPaid))){labours.forEach(fixAdvanceTx);saveAll();}}catch(e){}
    return r;
  };

  // ════════ 5. Stock count ════════
  window.openStockCount=function(){
    let woodRows=woodTypes.map(w=>{let sys=getWoodStockRemaining(w);return `<tr>
      <td>🪵 ${esc(w.name)}</td><td style="text-align:right;">${sys.toFixed(2)} cft</td>
      <td><input class="form-input hk-sc" data-kind="wood" data-id="${w.id}" data-sys="${sys}" type="number" step="0.01" placeholder="Ginti" style="padding:6px;"></td></tr>`;}).join('');
    let invRows=inventory.map(i=>`<tr><td>📦 ${esc(i.name)}</td><td style="text-align:right;">${num(i.qty)} ${esc(i.unit||'')}</td>
      <td><input class="form-input hk-sc" data-kind="inv" data-id="${i.id}" data-sys="${num(i.qty)}" type="number" step="0.01" placeholder="Ginti" style="padding:6px;"></td></tr>`).join('');
    let hist=(businessProfile.stockCounts||[]).slice(-6).reverse();
    modal('hkStockModal','📦 Stock ki Ginti',`
      <p style="font-size:10px;color:var(--gray-500);margin-bottom:8px;">Dukaan mein jo maal asal mein para hai, gin kar likhein. Jo khaana khaali chhorein woh nahi badlega. Save par ap ka stock asal ginti jaisa ho jayega aur farq likh liya jayega.</p>
      <div style="overflow-x:auto;"><table class="hk-sc-table"><tr><th>Cheez</th><th style="text-align:right;">App mein</th><th>Asal ginti</th></tr>${woodRows}${invRows}</table></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" onclick="saveStockCount()">💾 Ginti Save karein</button>
      ${hist.length?`<div style="font-size:11px;font-weight:700;margin:12px 0 4px;">Pichhli ginti</div>${hist.map(h=>`<div style="font-size:10px;padding:5px 0;border-bottom:1px solid var(--border);">
        <b>${esc(h.date)}</b> · ${h.items.length} cheezein · ${h.value<0?'<span style="color:var(--red);">kami '+fmtRs(-h.value)+'</span>':h.value>0?'zyada '+fmtRs(h.value):'barabar'}
        <div style="color:var(--gray-500);">${h.items.filter(x=>x.diff).map(x=>`${esc(x.name)} ${x.diff>0?'+':''}${x.diff}`).join(' · ')||'Koi farq nahi'}</div></div>`).join('')}`:''}`,true);
  };
  window.saveStockCount=function(){
    let items=[],value=0;
    document.querySelectorAll('.hk-sc').forEach(inp=>{
      if(inp.value==='')return;
      let counted=num(inp.value),sys=num(inp.dataset.sys),diff=Math.round((counted-sys)*100)/100;
      if(inp.dataset.kind==='wood'){
        let w=woodTypes.find(x=>String(x.id)===inp.dataset.id);if(!w)return;
        w.manualUsage=num(w.manualUsage)-diff; // less wood found = more used
        value+=diff*num(w.rate);
        items.push({name:w.name,unit:'cft',system:Math.round(sys*100)/100,counted,diff});
      }else{
        let it=inventory.find(x=>String(x.id)===inp.dataset.id);if(!it)return;
        it.qty=counted;it.updatedAt=new Date().toISOString();
        value+=diff*num(it.cost||it.rate);
        items.push({name:it.name,unit:it.unit||'',system:sys,counted,diff});
      }
    });
    if(!items.length){showToast('⚠️ Kam az kam ek cheez ki ginti likhein');return;}
    let list=(businessProfile.stockCounts||[]).concat([{date:today(),items,value:Math.round(value)}]).slice(-24);
    businessProfile.stockCounts=list;
    saveAll();renderAll();
    let short=items.filter(x=>x.diff<0).length;
    showToast(short?`✅ Ginti save — ${short} cheezein kam niklin`:'✅ Ginti save — stock barabar hai');
    openStockCount();
  };

  // ════════ 6. Staff limits ════════
  const OWNER_TABS=['tabReports','tabBankBook'];
  function applyStaffView(){
    let staff=isStaff();
    document.body.classList.toggle('hk-staff',staff);
    document.querySelectorAll('.drawer-item').forEach(b=>{
      let t=b.dataset.tab,oc=b.getAttribute('onclick')||'';
      let ownerOnly=(t&&OWNER_TABS.includes(t))||/openProfitReport|exportExcel|openDesignReport|openYearReport|openDataSafety|openActivityLog/.test(oc);
      if(ownerOnly)b.style.display=staff?'none':'';
    });
    if(staff&&OWNER_TABS.includes(document.querySelector('.tab.active')?.id))switchTab('tabHome');
  }
  window.hkApplyStaffView=applyStaffView;
  let origSwitchTab=window.switchTab;
  window.switchTab=function(id){
    if(isStaff()&&OWNER_TABS.includes(id)){showToast('🔒 Yeh hissa sirf Owner dekh sakta hai');return;}
    return origSwitchTab.apply(this,arguments);
  };
  let origBadge=window.updateUserBadge;
  window.updateUserBadge=function(){let r=origBadge.apply(this,arguments);try{applyStaffView();}catch(e){}return r;};
  // Order screen: staff see the order, not its cost and profit.
  let origView=window.viewOrderDetail;
  window.viewOrderDetail=function(id){
    let r=origView.apply(this,arguments);
    if(isStaff()){
      let c=document.getElementById('orderDetailContent');
      if(c){
        c.querySelectorAll('.stat-card').forEach(s=>{if(/Profit/i.test(s.innerText))s.remove();});
        c.querySelectorAll('table').forEach(t=>{if(/Profit/i.test(t.innerText))t.remove();});
      }
    }
    return r;
  };

  // ════════ 7. Design report ════════
  function designOf(d){
    let s=String(d.design||d.size||'').replace(/\d+(?:\.\d+)?\s*[xX×]\s*\d+(?:\.\d+)?/,'').replace(/\bJori\b/i,'').trim();
    return s||'Bina design naam';
  }
  function inPeriod(date,p){
    let k=String(date||'');if(!k)return false;
    let now=new Date(),ym=now.toISOString().slice(0,7);
    if(p==='month')return k.startsWith(ym);
    if(p==='q'){let f=new Date(now.getFullYear(),now.getMonth()-2,1);return k.slice(0,7)>=f.getFullYear()+'-'+String(f.getMonth()+1).padStart(2,'0');}
    if(p==='year')return k.startsWith(String(now.getFullYear()));
    return true;
  }
  let drPeriod='year';
  window.openDesignReport=function(p){
    if(p)drPeriod=p;
    let map={};
    orders.filter(o=>inPeriod(o.date,drPeriod)).forEach(o=>(o.doors||[]).forEach(d=>{
      let k=designOf(d),r=map[k]=map[k]||{name:k,qty:0,sale:0,wood:0,labour:0,orders:new Set()};
      r.qty+=num(d.qty)||1;r.sale+=num(d.doorAmount);r.wood+=getDoorWoodCost(d);r.labour+=num(d.labourPerDoor);r.orders.add(o.id);
    }));
    let rows=Object.values(map).map(r=>({...r,profit:r.sale-r.wood-r.labour,orders:r.orders.size})).sort((a,b)=>b.sale-a.sale);
    let tot=rows.reduce((s,r)=>s+r.sale,0)||1;
    let tabs=[['month','Is mahine'],['q','3 mahine'],['year','Is saal'],['all','Sab']].map(([k,l])=>`<button class="btn ${drPeriod===k?'btn-primary':'btn-outline'} btn-xs" onclick="openDesignReport('${k}')">${l}</button>`).join(' ');
    modal('hkDesignModal','📊 Kaun sa design zyada bikta hai',`
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${tabs}</div>
      ${rows.length?rows.map((r,i)=>`<div class="hk-dr-row">
        <div style="display:flex;justify-content:space-between;gap:6px;"><b>${i+1}. ${esc(r.name)}</b><b>${fmtRs(r.sale)}</b></div>
        <div class="hk-dr-bar"><div style="width:${Math.max(2,Math.round(r.sale/tot*100))}%"></div></div>
        <div style="font-size:9.5px;color:var(--gray-500);">${r.qty} darwaze · ${r.orders} orders · munafa <b style="color:${r.profit>=0?'var(--green-600)':'var(--red)'};">${fmtRs(r.profit)}</b> (${r.sale?Math.round(r.profit/r.sale*100):0}%)</div>
      </div>`).join(''):'<div class="empty-state"><div class="e-icon">📊</div><p>Is muddat mein koi order nahi</p></div>'}`);
  };

  // ════════ 8. Year closing ════════
  function yearData(y){
    let ys=String(y),inY=d=>String(d||'').startsWith(ys);
    let yo=orders.filter(o=>inY(o.date));
    let months=Array.from({length:12},(_,i)=>({m:i,sale:0,received:0,kharcha:0}));
    let mi=d=>parseInt(String(d).slice(5,7))-1;
    yo.forEach(o=>{months[mi(o.date)].sale+=num(o.orderTotal);});
    let received=0;
    orders.forEach(o=>(o.payments||[]).forEach(p=>{if(inY(p.date)){received+=num(p.amount);months[mi(p.date)].received+=num(p.amount);}}));
    parties.forEach(p=>(p.partyPayments||[]).forEach(x=>{if(inY(x.date)){received+=num(x.amount);months[mi(x.date)].received+=num(x.amount);}}));
    let ye=expenses.filter(e=>inY(e.date));ye.forEach(e=>{months[mi(e.date)].kharcha+=num(e.amount);});
    let kharcha=ye.reduce((s,e)=>s+num(e.amount),0);
    let purchase=purchases.filter(p=>inY(p.date)).reduce((s,p)=>s+(num(p.total)||num(p.qty)*num(p.rate)),0);
    let labour=labours.filter(l=>inY(l.date)).reduce((s,l)=>s+num(l.totalCost),0);
    let gross=yo.reduce((s,o)=>s+num(o.netProfit),0);
    let byParty={};yo.forEach(o=>{byParty[o.partyId]=(byParty[o.partyId]||0)+num(o.orderTotal);});
    let top=Object.entries(byParty).map(([id,v])=>({name:getPartyName(id),v})).sort((a,b)=>b.v-a.v).slice(0,10);
    let udhaar=parties.reduce((s,p)=>s+Math.max(0,getPartyBalance(p)),0);
    return {y,count:yo.length,sale:yo.reduce((s,o)=>s+num(o.orderTotal),0),received,kharcha,purchase,labour,gross,net:gross-kharcha,months,top,udhaar,
      doors:yo.reduce((s,o)=>s+(o.doors||[]).reduce((a,d)=>a+(num(d.qty)||1),0),0)};
  }
  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function yearHTML(d,elId){
    let bp=businessProfile||{};
    let box=(l,v)=>`<div style="flex:1;min-width:150px;border:1px solid #e3e8f0;border-radius:10px;padding:10px;"><div style="font-size:11px;color:#6b7a90;">${l}</div><div style="font-size:17px;font-weight:800;color:#1a3a6a;">${v}</div></div>`;
    return `<div id="${elId}" style="font-family:'Segoe UI',sans-serif;width:760px;padding:30px 36px;background:#fff;color:#1a2a3a;">
      <div style="border-bottom:3px solid #c8963e;padding-bottom:10px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div><div style="font-size:22px;font-weight:800;color:#1a3a6a;">${esc(bp.name||'')}</div><div style="font-size:11px;color:#6b7a90;">${esc([bp.phone,bp.address,bp.city].filter(Boolean).join(' · '))}</div></div>
        <div style="text-align:right;"><div style="font-size:16px;font-weight:800;letter-spacing:2px;color:#1a3a6a;">SAAL KA HISAAB</div><div style="font-size:20px;font-weight:800;color:#c8963e;">${d.y}</div></div></div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;">
        ${box('Kul sale ('+d.count+' orders, '+d.doors+' darwaze)',fmtRs(d.sale))}${box('Wasooli',fmtRs(d.received))}${box('Kharcha',fmtRs(d.kharcha))}
        ${box('Khareed (purchase)',fmtRs(d.purchase))}${box('Mazdoori',fmtRs(d.labour))}${box('Saaf munafa (kharche ke baad)',fmtRs(d.net))}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:12px;">
        <tr style="background:#1a3a6a;color:#fff;"><th style="padding:7px;text-align:left;">Mahina</th><th style="padding:7px;text-align:right;">Sale</th><th style="padding:7px;text-align:right;">Wasooli</th><th style="padding:7px;text-align:right;">Kharcha</th></tr>
        ${d.months.map((m,i)=>`<tr style="background:${i%2?'#f7f9fc':'#fff'};"><td style="padding:6px 7px;">${MN[m.m]}</td><td style="padding:6px 7px;text-align:right;">${fmtRs(m.sale)}</td><td style="padding:6px 7px;text-align:right;">${fmtRs(m.received)}</td><td style="padding:6px 7px;text-align:right;">${fmtRs(m.kharcha)}</td></tr>`).join('')}
      </table>
      <div style="font-size:13px;font-weight:700;margin:16px 0 6px;color:#1a3a6a;">Sab se bare gahak</div>
      ${d.top.map((t,i)=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #eef1f6;"><span>${i+1}. ${esc(t.name)}</span><b>${fmtRs(t.v)}</b></div>`).join('')||'<div style="font-size:12px;color:#6b7a90;">—</div>'}
      <div style="font-size:12px;margin-top:14px;">Saal ke aakhir par parties ki taraf kul udhaar: <b>${fmtRs(d.udhaar)}</b></div>
      <div style="font-size:10px;color:#9ca7b8;margin-top:16px;text-align:center;">${new Date().toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'})}</div></div>`;
  }
  window.openYearReport=function(y){
    y=y||new Date().getFullYear();
    let d=yearData(y);
    let years=[...new Set(orders.map(o=>String(o.date||'').slice(0,4)).filter(Boolean).concat([String(new Date().getFullYear())]))].sort().reverse();
    let closed=(businessProfile.closedYears||[]).includes(String(y));
    modal('hkYearModal','📅 Saal ka Hisaab',`
      <select class="form-select" style="margin-bottom:8px;" onchange="openYearReport(this.value)">${years.map(v=>`<option ${String(v)===String(y)?'selected':''}>${v}</option>`).join('')}</select>
      <div style="overflow:auto;max-height:52vh;border:1px solid var(--border);border-radius:10px;">
        <div style="transform-origin:top left;transform:scale(.46);width:760px;height:0;">${yearHTML(d,'hkYearPreview')}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">
        <button class="btn btn-primary" onclick="downloadYearReport(${y})">📄 PDF banayein</button>
        <button class="btn ${closed?'btn-outline':'btn-gold'}" onclick="closeYear(${y})">${closed?'✅ Saal band ho chuka — dobara copy banayein':'🔒 Saal band karein (hamesha ki copy)'}</button>
        <p style="font-size:9px;color:var(--gray-500);">Saal band karne se is saal ka poora data cloud mein hamesha ke liye alag mehfooz ho jata hai. App mein kuch nahi mitta — khata aur udhaar agle saal bhi waise hi chalte rehte hain.</p>
      </div>`);
    setTimeout(()=>{let p=document.getElementById('hkYearPreview');if(p)p.parentElement.style.height=Math.ceil(p.offsetHeight*.46)+'px';},30);
  };
  window.downloadYearReport=function(y){return pdfFromHTML(yearHTML(yearData(y),'hkYearPdf'),'hkYearPdf',`Saal_ka_Hisaab_${y}.pdf`);};
  window.closeYear=function(y){
    customConfirm(`${y} ka saal band karein? Is saal ka poora data cloud mein hamesha ke liye mehfooz ho jayega. App ka data waisa hi rahega.`,async()=>{
      try{
        if(typeof hkCloudCopy!=='function'||!(typeof cloudEnabled!=='undefined'&&cloudEnabled))throw new Error('Pehle cloud se jorein');
        await hkCloudCopy('year-'+y,'year');
        let c=businessProfile.closedYears||[];if(!c.includes(String(y)))c.push(String(y));businessProfile.closedYears=c;
        saveAll();
        showToast(`✅ ${y} band — hamesha ki copy cloud mein mehfooz`);
        downloadYearReport(y);
        openYearReport(y);
      }catch(e){showToast('⚠️ '+(e.message||e));}
    },{danger:false,title:'🔒 Saal band karein',okText:'Band karein'});
  };

  document.addEventListener('hk:ready',()=>{
    handleRequestLink();
    addMenu('hkStockCountBtn','📦','Stock ki Ginti','openStockCount()','.drawer-item[onclick*="openWoodStockModal"]');
    addMenu('hkYearBtn','📅','Saal ka Hisaab (Year Close)','openYearReport()','.drawer-item[data-tab="tabReports"]');
    addMenu('hkDesignBtn','📊','Design Report (kya bikta hai)','openDesignReport()','.drawer-item[data-tab="tabReports"]');
    applyStaffView();
  });
  window.addEventListener('hashchange',handleRequestLink);
})();
