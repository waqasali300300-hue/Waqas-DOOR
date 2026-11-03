// HK Wood Doors ERP — cutting list, workshop board, rate change, personal loans,
// customer live khata link, QR scan.
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function isStaff(){return typeof hkIsStaff==='function'&&hkIsStaff();}
  function waPhone(p){p=String(p||'').replace(/[^0-9]/g,'');if(p.startsWith('0'))p='92'+p.slice(1);return p;}
  function wa(phone,msg){window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(msg)}`,'_blank');}
  function r2(n){return Math.round(n*100)/100;}
  function modal(id,title,html,wide){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:${wide?680:520}px;"><div class="modal-head"><span id="${id}T"></span> <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}B"></div></div>`;
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
  function cloudReady(){return typeof cloudEnabled!=='undefined'&&cloudEnabled&&db;}
  function token(){let a=new Uint8Array(12);crypto.getRandomValues(a);return [...a].map(b=>'abcdefghijkmnpqrstuvwxyz23456789'[b%32]).join('');}
  const STAGES=[['pending','Pending'],['cutting','Cutting'],['assembly','Assembly'],['polishing','Polish'],['ready','Ready']];

  // ════════ 2. Cutting list ════════
  // Each door: 2 khara (stiles) full height, rails across between the stiles,
  // and panels between the rails. Widths are set once and remembered.
  function cutCfg(){return Object.assign({stile:4.5,rail:6,rails:3,panelT:0.75},businessProfile.cutting||{});}
  function woodName(id){return (woodTypes.find(w=>String(w.id)===String(id))||{}).name||'Lakri';}
  function cutParts(doors,c){
    let parts={},skipped=0;
    const add=(name,L,W,T,qty,wood)=>{
      if(L<=0||W<=0)return;
      let k=[name,r2(L),r2(W),r2(T),wood].join('|');
      let p=parts[k]=parts[k]||{name,L:r2(L),W:r2(W),T:r2(T),wood,qty:0};
      p.qty+=qty;
    };
    doors.forEach(d=>{
      let w=num(d.w),h=num(d.h),q=num(d.qty)||1,t=num(d.thickness)||defaultThickness||1.5,wood=woodName(d.woodId);
      if(!w||!h){skipped++;return;}
      let inner=w-2*c.stile,rails=Math.max(2,Math.round(c.rails)),panelH=(h-rails*c.rail)/(rails-1);
      add('Khara (Stile)',h,c.stile,t,2*q,wood);
      add('Aara (Rail)',inner,c.rail,t,rails*q,wood);
      add('Panel',inner,panelH,c.panelT,(rails-1)*q,wood);
    });
    let list=Object.values(parts).map(p=>({...p,cft:r2(p.L*p.W*p.T/1728*p.qty)}));
    let byWood={};list.forEach(p=>{byWood[p.wood]=r2((byWood[p.wood]||0)+p.cft);});
    return {list,byWood,skipped};
  }
  let cutIds=[];
  function cutDoors(){return cutIds.map(id=>orders.find(o=>o.id===id)).filter(Boolean).flatMap(o=>o.doors||[]);}
  function cutTitle(){let os=cutIds.map(id=>orders.find(o=>o.id===id)).filter(Boolean);return os.map(o=>o.orderNo).join(', ');}
  window.openCuttingList=function(ids){
    if(ids!==undefined)cutIds=[].concat(ids).map(Number);
    let c=cutCfg(),r=cutParts(cutDoors(),c);
    let inp=(k,l)=>`<label style="flex:1;min-width:110px;font-size:9.5px;">${l}<input class="form-input" type="number" step="0.25" value="${c[k]}" onchange="setCutCfg('${k}',this.value)" style="padding:6px;"></label>`;
    modal('hkCutModal','🪚 Cutting List — '+cutTitle(),`
      <details style="margin-bottom:8px;"><summary style="font-size:10.5px;cursor:pointer;">⚙️ Patti ki chaurai (ek dafa set karein)</summary>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">${inp('stile','Khara chaurai (inch)')}${inp('rail','Aara chaurai (inch)')}${inp('rails','Aare kitne')}${inp('panelT','Panel motai (inch)')}</div></details>
      ${r.list.length?`<div style="overflow-x:auto;"><table class="hk-sc-table"><tr><th>Hissa</th><th>Lambai × Chaurai × Motai (inch)</th><th style="text-align:right;">Tadaad</th><th style="text-align:right;">cft</th></tr>
        ${r.list.map(p=>`<tr><td>${esc(p.name)}<br><small style="color:var(--gray-500);">${esc(p.wood)}</small></td><td><b>${p.L} × ${p.W} × ${p.T}</b></td><td style="text-align:right;"><b>${p.qty}</b></td><td style="text-align:right;">${p.cft}</td></tr>`).join('')}</table></div>
        <div style="font-size:11px;margin-top:8px;">${Object.entries(r.byWood).map(([w,c])=>`🪵 ${esc(w)}: <b>${c} cft</b>`).join(' · ')}</div>`
        :'<div class="empty-state"><div class="e-icon">🪚</div><p>Darwazon ka naap (jaise 45x80) nahi mila</p></div>'}
      ${r.skipped?`<p style="font-size:9.5px;color:#b45309;margin-top:6px;">⚠️ ${r.skipped} darwazon ka naap nahi likha — un ki cutting is mein nahi.</p>`:''}
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button class="btn btn-success" style="flex:1;" onclick="sendCuttingList()">💬 Karigar ko WhatsApp</button>
        <button class="btn btn-outline" style="flex:1;" onclick="cuttingListPdf()">📄 PDF</button></div>`);
  };
  window.setCutCfg=function(k,v){let c=cutCfg();c[k]=num(v);businessProfile.cutting=c;saveAll();openCuttingList();};
  window.hkCutParts=cutParts;
  function cutText(){
    let r=cutParts(cutDoors(),cutCfg());
    return `*Cutting List — ${cutTitle()}*\n`+r.list.map(p=>`• ${p.name} (${p.wood}): ${p.L} × ${p.W} × ${p.T}" — ${p.qty} adad`).join('\n')+
      '\n'+Object.entries(r.byWood).map(([w,c])=>`🪵 ${w}: ${c} cft`).join('\n');
  }
  window.sendCuttingList=function(){
    let o=orders.find(x=>x.id===cutIds[0]);
    let k=o&&labours.filter(l=>l.orderId===o.id).map(l=>karigars.find(x=>String(x.id)===String(l.karigarId))).find(Boolean);
    wa(k&&k.phone||'',cutText());
  };
  window.cuttingListPdf=function(){
    let r=cutParts(cutDoors(),cutCfg());
    let html=`<div id="hkCutPdf" style="font-family:'Segoe UI',sans-serif;width:760px;padding:28px 34px;background:#fff;color:#1a2a3a;">
      <div style="border-bottom:3px solid #c8963e;padding-bottom:8px;display:flex;justify-content:space-between;"><b style="font-size:20px;color:#1a3a6a;">${esc(businessProfile.name||'')}</b><span style="font-size:14px;font-weight:800;color:#1a3a6a;">CUTTING LIST</span></div>
      <div style="font-size:12px;margin:10px 0;">Orders: <b>${esc(cutTitle())}</b> · ${today()}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="background:#1a3a6a;color:#fff;"><th style="padding:7px;text-align:left;">Hissa</th><th style="padding:7px;text-align:left;">Lakri</th><th style="padding:7px;">L × W × T (inch)</th><th style="padding:7px;text-align:right;">Tadaad</th><th style="padding:7px;text-align:right;">cft</th></tr>
      ${r.list.map((p,i)=>`<tr style="background:${i%2?'#f7f9fc':'#fff'};"><td style="padding:7px;">${esc(p.name)}</td><td style="padding:7px;">${esc(p.wood)}</td><td style="padding:7px;text-align:center;font-weight:700;">${p.L} × ${p.W} × ${p.T}</td><td style="padding:7px;text-align:right;font-weight:700;">${p.qty}</td><td style="padding:7px;text-align:right;">${p.cft}</td></tr>`).join('')}</table>
      <div style="font-size:13px;margin-top:10px;">${Object.entries(r.byWood).map(([w,c])=>`${esc(w)}: <b>${c} cft</b>`).join(' · ')}</div></div>`;
    return pdfFromHTML(html,'hkCutPdf',`Cutting_List_${today()}.pdf`);
  };
  window.openCuttingPicker=function(){
    let act=orders.filter(o=>['pending','cutting'].includes(o.status||'pending')).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    modal('hkCutPickModal','🪚 Cutting List — orders chunein',act.length?`
      ${act.map(o=>`<label style="display:flex;gap:8px;align-items:center;font-size:11px;padding:6px 0;border-bottom:1px solid var(--border);">
        <input type="checkbox" class="hk-cutpick" value="${o.id}" checked> <span><b>${esc(o.orderNo)}</b> · ${esc(getPartyName(o.partyId))} · ${(o.doors||[]).reduce((s,d)=>s+(num(d.qty)||1),0)} darwaze</span></label>`).join('')}
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" onclick="let ids=[...document.querySelectorAll('.hk-cutpick:checked')].map(x=>+x.value);if(!ids.length){showToast('⚠️ Order chunein');return;}closeModal('hkCutPickModal');openCuttingList(ids)">🪚 Cutting List banayein</button>`
      :'<div class="empty-state"><div class="e-icon">🪚</div><p>Pending ya Cutting mein koi order nahi</p></div>');
  };

  // ════════ 4. Workshop board ════════
  let boardTimer=null;
  function boardHTML(){
    let t=today();
    let cols=STAGES.map(([k,l],si)=>{
      let os=orders.filter(o=>(o.status||'pending')===k).sort((a,b)=>String(a.deliveryDate||'9999').localeCompare(String(b.deliveryDate||'9999')));
      return `<div class="hk-board-col"><div class="hk-board-head">${l} <span>${os.length}</span></div>
        ${os.map(o=>{let late=o.deliveryDate&&o.deliveryDate<t,due=o.deliveryDate===t;
          return `<div class="hk-board-card ${late?'late':due?'due':''}">
            <div class="hk-board-no">${esc(o.orderNo||'')}</div>
            <div class="hk-board-party">${esc(getPartyName(o.partyId))}</div>
            <div class="hk-board-doors">${(o.doors||[]).slice(0,4).map(d=>`${esc(d.size||'Door')} × ${num(d.qty)||1}`).join('<br>')}${(o.doors||[]).length>4?'<br>…':''}</div>
            ${o.deliveryDate?`<div class="hk-board-date">${late?'❗ Late ':due?'⏰ Aaj ':'🚚 '}${esc(o.deliveryDate)}</div>`:''}
            ${si<STAGES.length-1?`<button onclick="boardNext(${o.id})">${STAGES[si+1][1]} ›</button>`:`<button onclick="boardNext(${o.id})">✅ Deliver</button>`}
          </div>`;}).join('')||'<div class="hk-board-empty">—</div>'}</div>`;
    }).join('');
    return `<div class="hk-board-top"><b>🏭 ${esc(businessProfile.name||'')} — Kaam ka Board</b><span id="hkBoardClock">${new Date().toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}</span>
      <button onclick="hkBoardFull()">⛶</button><button onclick="closeWorkshopBoard()">✕</button></div><div class="hk-board-cols">${cols}</div>`;
  }
  function renderBoard(){let b=document.getElementById('hkBoard');if(b)b.innerHTML=boardHTML();}
  window.openWorkshopBoard=function(){
    let b=document.getElementById('hkBoard');
    if(!b){b=document.createElement('div');b.id='hkBoard';b.className='hk-board';document.body.appendChild(b);}
    renderBoard();
    clearInterval(boardTimer);boardTimer=setInterval(renderBoard,60000);
  };
  window.closeWorkshopBoard=function(){clearInterval(boardTimer);document.getElementById('hkBoard')?.remove();try{document.fullscreenElement&&document.exitFullscreen();}catch(e){}};
  window.hkBoardFull=function(){try{let b=document.getElementById('hkBoard');document.fullscreenElement?document.exitFullscreen():b.requestFullscreen&&b.requestFullscreen();}catch(e){}};
  window.boardNext=function(id){
    let o=orders.find(x=>x.id===id);if(!o)return;
    let i=STAGES.findIndex(s=>s[0]===(o.status||'pending'));
    o.status=i<STAGES.length-1?STAGES[i+1][0]:'delivered';o.updatedAt=new Date().toISOString();
    saveAll();renderAll();renderBoard();
  };
  let origRenderAll=window.renderAll;
  window.renderAll=function(){let r=origRenderAll.apply(this,arguments);try{renderBoard();}catch(e){}return r;};

  // ════════ 6. Change all rates at once ════════
  function roundTo(v,step){return step>1?Math.round(v/step)*step:Math.round(v);}
  window.openRateChange=function(){
    modal('hkRateChgModal','📈 Sab rate ek saath badlein',`
      <p style="font-size:10px;color:var(--gray-500);margin-bottom:8px;">Lakri mehngi ho to sab designon ka rate ek dafa mein badhayein (ghatane ke liye minus likhein, jaise -5).</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <label style="flex:1;font-size:10px;">Kitne % <input class="form-input" type="number" id="hkRcPct" value="10" oninput="rateChangePreview()"></label>
        <label style="flex:1;font-size:10px;">Gol karein <select class="form-select" id="hkRcRound" onchange="rateChangePreview()"><option value="1">1</option><option value="5" selected>5</option><option value="10">10</option></select></label></div>
      <label style="display:flex;gap:6px;align-items:center;font-size:10.5px;margin:8px 0;"><input type="checkbox" id="hkRcWood" onchange="rateChangePreview()"> Lakri (cft) ke rate bhi badlein</label>
      <div id="hkRcPrev" style="max-height:40vh;overflow:auto;"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" onclick="applyRateChange()">✅ Naye rate lagayein</button>`);
    rateChangePreview();
  };
  function rateChanges(){
    let pct=num(document.getElementById('hkRcPct')?.value),step=num(document.getElementById('hkRcRound')?.value)||1;
    let f=v=>Math.max(0,roundTo(num(v)*(1+pct/100),step));
    let rows=priceList.filter(p=>p&&p.size).map(p=>({kind:'Design',name:p.size,old:num(p.rate),neu:f(p.rate),ref:p}));
    if(document.getElementById('hkRcWood')?.checked)woodTypes.forEach(w=>rows.push({kind:'Lakri',name:w.name,old:num(w.rate),neu:f(w.rate),ref:w}));
    return rows;
  }
  window.rateChangePreview=function(){
    let el=document.getElementById('hkRcPrev');if(!el)return;
    let rows=rateChanges();
    el.innerHTML=rows.length?`<table class="hk-sc-table"><tr><th>Cheez</th><th style="text-align:right;">Purana</th><th style="text-align:right;">Naya</th></tr>
      ${rows.map(r=>`<tr><td>${r.kind==='Lakri'?'🪵':'🚪'} ${esc(r.name)}</td><td style="text-align:right;">${fmtRs(r.old)}</td><td style="text-align:right;"><b>${fmtRs(r.neu)}</b></td></tr>`).join('')}</table>`
      :'<div style="font-size:11px;color:var(--gray-500);">Rate List mein koi design nahi</div>';
  };
  window.applyRateChange=function(){
    let rows=rateChanges();if(!rows.length)return;
    customConfirm(`${rows.length} rate badal jayenge. Purane orders par asar nahi hoga, sirf naye orders/estimates aur catalog mein naye rate.`,()=>{
      rows.forEach(r=>{r.ref.rate=r.neu;});
      saveAll();renderAll();closeModal('hkRateChgModal');
      showToast(`✅ ${rows.length} rate badal gaye`);
    },{danger:false,title:'📈 Rate badlein',okText:'Badal dein'});
  };
  let origRenderPL=window.renderPriceListModalBody;
  if(origRenderPL)window.renderPriceListModalBody=function(){
    let r=origRenderPL.apply(this,arguments);
    let body=document.getElementById('priceListModalBody');
    let save=body&&body.querySelector('button[onclick="savePriceList()"]');
    if(save&&!document.getElementById('hkRateChgBtn')&&!isStaff())save.insertAdjacentHTML('afterend','<button class="btn btn-outline" id="hkRateChgBtn" onclick="savePriceList();openRateChange()">📈 Sab rate badlein</button>');
    return r;
  };

  // ════════ 9. Personal loans (separate from the business) ════════
  function loanBal(l){return (l.entries||[]).reduce((s,e)=>s+(e.dir==='diya'?1:-1)*num(e.amount),0);}
  window.openLoans=function(){
    let list=personalLoans.slice().sort((a,b)=>Math.abs(loanBal(b))-Math.abs(loanBal(a)));
    let lena=list.reduce((s,l)=>s+Math.max(0,loanBal(l)),0),dena=list.reduce((s,l)=>s+Math.max(0,-loanBal(l)),0);
    modal('hkLoanModal','🤝 Zaati Qarz (karobar se alag)',`
      <p style="font-size:10px;color:var(--gray-500);margin-bottom:8px;">Jo paise aap ne kisi ko zaati taur par diye ya liye. Yeh dukaan ke hisaab aur Cash Book mein nahi jaata.</p>
      <div style="display:flex;gap:8px;margin-bottom:8px;font-size:10.5px;">
        <div class="khata-card" style="flex:1;margin:0;">Aap ne lene hain<br><b style="color:var(--green-600);">${fmtRs(lena)}</b></div>
        <div class="khata-card" style="flex:1;margin:0;">Aap ne dene hain<br><b style="color:var(--red);">${fmtRs(dena)}</b></div></div>
      ${list.map(l=>{let b=loanBal(l);return `<button class="hm-row" onclick="openLoan(${l.id})"><span class="hm-row-text"><b>${esc(l.name)}</b><br><small>${b>0?'Aap ne lene hain':b<0?'Aap ne dene hain':'Hisaab barabar'}</small></span>
        <span class="hm-row-amt" style="color:${b>0?'var(--green-600)':b<0?'var(--red)':'inherit'};">${fmtRs(Math.abs(b))}</span><span class="hm-chev">›</span></button>`;}).join('')||'<div class="empty-state"><div class="e-icon">🤝</div><p>Abhi koi qarz nahi</p></div>'}
      <div style="display:flex;gap:6px;margin-top:10px;"><input class="form-input" id="hkLoanName" placeholder="Naam" style="flex:2;"><input class="form-input" id="hkLoanPhone" placeholder="Phone" style="flex:1.4;"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:6px;" onclick="addLoanPerson()">+ Naya shakhs</button>`);
  };
  window.addLoanPerson=function(){
    let name=(document.getElementById('hkLoanName')?.value||'').trim();
    if(!name){showToast('⚠️ Naam likhein');return;}
    let l={id:newId(),name,phone:(document.getElementById('hkLoanPhone')?.value||'').trim(),entries:[],createdAt:new Date().toISOString()};
    personalLoans.push(l);saveAll();openLoan(l.id);
  };
  window.openLoan=function(id){
    let l=personalLoans.find(x=>x.id===id);if(!l)return;
    let b=loanBal(l),run=0;
    let rows=(l.entries||[]).slice().sort((a,c)=>String(a.date).localeCompare(String(c.date))).map(e=>{run+=(e.dir==='diya'?1:-1)*num(e.amount);return {...e,run};});
    modal('hkLoanModal','🤝 '+l.name,`
      <div class="khata-card" style="margin-bottom:8px;font-size:12px;">${b>0?'Aap ne lene hain':b<0?'Aap ne dene hain':'Hisaab barabar'}: <b style="color:${b>0?'var(--green-600)':b<0?'var(--red)':'inherit'};">${fmtRs(Math.abs(b))}</b></div>
      ${rows.reverse().map(e=>`<div style="display:flex;justify-content:space-between;gap:6px;align-items:center;font-size:10.5px;padding:5px 0;border-bottom:1px solid var(--border);">
        <span>${esc(e.date)} · ${e.dir==='diya'?'⬆️ Diya':'⬇️ Liya'}${e.note?' · '+esc(e.note):''}</span>
        <span><b>${fmtRs(e.amount)}</b> <button class="btn btn-outline btn-xs" onclick="deleteLoanEntry(${l.id},${e.id})">🗑</button></span></div>`).join('')||'<div style="font-size:10.5px;color:var(--gray-500);">Abhi koi len-den nahi</div>'}
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
        <input class="form-input" type="number" id="hkLoanAmt" placeholder="Raqam" style="flex:1;min-width:90px;">
        <input class="form-input" type="date" id="hkLoanDate" value="${today()}" style="flex:1;min-width:120px;"></div>
      <input class="form-input" id="hkLoanNote" placeholder="Note" style="margin-top:6px;">
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="btn btn-primary" style="flex:1;" onclick="addLoanEntry(${l.id},'diya')">⬆️ Maine diya</button>
        <button class="btn btn-gold" style="flex:1;" onclick="addLoanEntry(${l.id},'liya')">⬇️ Maine liya</button></div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        ${l.phone&&b>0?`<button class="btn btn-success btn-sm" style="flex:1;" onclick="loanReminder(${l.id})">💬 Yaad dahani</button>`:''}
        <button class="btn btn-outline btn-sm" style="flex:1;" onclick="openLoans()">‹ Wapas</button>
        <button class="btn btn-danger btn-sm" onclick="deleteLoanPerson(${l.id})">🗑</button></div>`);
  };
  window.addLoanEntry=function(id,dir){
    let l=personalLoans.find(x=>x.id===id);if(!l)return;
    let amt=num(document.getElementById('hkLoanAmt')?.value);
    if(amt<=0){showToast('⚠️ Raqam likhein');return;}
    (l.entries=l.entries||[]).push({id:newId(),dir,amount:amt,date:document.getElementById('hkLoanDate')?.value||today(),note:(document.getElementById('hkLoanNote')?.value||'').trim()});
    l.updatedAt=new Date().toISOString();saveAll();openLoan(id);
  };
  window.deleteLoanEntry=function(id,eid){
    let l=personalLoans.find(x=>x.id===id);if(!l)return;
    customConfirm('Yeh len-den mita dein?',()=>{l.entries=(l.entries||[]).filter(e=>e.id!==eid);l.updatedAt=new Date().toISOString();saveAll();openLoan(id);},{okText:'Mitayein'});
  };
  window.deleteLoanPerson=function(id){
    let l=personalLoans.find(x=>x.id===id);if(!l)return;
    customConfirm(`${l.name} ka poora hisaab mita dein?`,()=>{personalLoans=personalLoans.filter(x=>x.id!==id);saveAll();openLoans();},{okText:'Mitayein'});
  };
  window.loanReminder=function(id){
    let l=personalLoans.find(x=>x.id===id);if(!l)return;
    wa(l.phone,`Assalam-o-Alaikum ${l.name},\nYaad dahani: aap ki taraf ${fmtRs(loanBal(l))} baqi hain. Jab suhoolat ho wapas kar dein. Shukriya!`);
  };
  window.hkLoanBal=loanBal;

  // ════════ 10. Customer live khata link ════════
  function khataData(p){
    let bp=businessProfile||{};
    let entries=buildPartyLedgerEntries(p).slice(-300).map(e=>({date:e.date||'',type:e.type||'',ref:e.ref||'',debit:num(e.debit),credit:num(e.credit),balance:num(e.balance)}));
    return {shop:{name:bp.name||'',phone:bp.phone||'',whatsapp:bp.whatsapp||bp.phone||'',address:[bp.address,bp.city].filter(Boolean).join(', ')},
      party:p.name||'',balance:getPartyBalance(p),currency:bp.currency||'Rs.',entries};
  }
  function khataUrl(p){let c=typeof getFirebaseCfg==='function'&&getFirebaseCfg();return hkPublicBase()+'khata.html#p='+encodeURIComponent((c&&c.projectId)||'')+'&t='+p.khataToken;}
  const kSig={};
  async function publishKhata(p){
    if(!p.khataToken||!cloudReady())return false;
    let d=khataData(p),sig=JSON.stringify(d);
    if(kSig[p.khataToken]===sig)return true;
    await db.collection('public').doc('k_'+p.khataToken).set({...d,updatedAt:new Date().toISOString()});
    kSig[p.khataToken]=sig;return true;
  }
  window.shareLiveKhata=async function(pid){
    let p=getPartyById(pid);if(!p)return;
    if(!cloudReady()){showToast('⚠️ Live khata ke liye cloud se juda hona zaroori hai');return;}
    if(!p.khataToken){p.khataToken=token();saveAll();}
    try{await publishKhata(p);}catch(e){showToast('⚠️ Link nahi bana: '+(e.message||e));return;}
    let msg=`Assalam-o-Alaikum ${p.name},\n${businessProfile.name||''} — aap ka poora khata aur baqaya is link par kabhi bhi dekhein (yeh khud update hota hai):\n${khataUrl(p)}\nShukriya!`;
    if(p.phone)wa(p.phone,msg);else{try{await navigator.clipboard.writeText(msg);}catch(e){}showToast('📋 Link copy ho gaya');}
  };
  let kTimer=null;
  let origSaveAll=window.saveAll;
  window.saveAll=function(){
    let r=origSaveAll.apply(this,arguments);
    if(cloudReady()&&parties.some(p=>p.khataToken)){
      clearTimeout(kTimer);
      kTimer=setTimeout(()=>parties.filter(p=>p.khataToken).forEach(p=>publishKhata(p).catch(()=>{})),3500);
    }
    return r;
  };
  let origLedger=window.openPartyLedger;
  window.openPartyLedger=function(pid){
    let r=origLedger.apply(this,arguments);
    let body=document.getElementById('partyLedgerModalBody');
    if(body&&!body.querySelector('.hk-khata-btn'))body.insertAdjacentHTML('afterbegin',`<button class="btn btn-gold btn-sm hk-khata-btn" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="shareLiveKhata(${pid})">🔗 Party ko live khata link bhejein</button>`);
    return r;
  };

  // ════════ 12. QR scan ════════
  let scanStream=null,scanOn=false;
  function stopScan(){scanOn=false;if(scanStream){scanStream.getTracks().forEach(t=>t.stop());scanStream=null;}}
  window.hkHandleScan=function(text){
    let t=String(text||'');
    let m=t.match(/#order=(\d+)/);
    if(m){let o=orders.find(x=>x.id===+m[1]);if(o){viewOrderDetail(o.id);return 'order';}}
    m=t.match(/status\.html#.*[?&#]?t=([a-z0-9]+)/)||t.match(/[#&]t=([a-z0-9]{8,})/);
    if(m&&/status\.html/.test(t)){let o=orders.find(x=>x.trackId===m[1]);if(o){viewOrderDetail(o.id);return 'order';}}
    if(m&&/khata\.html/.test(t)){let p=parties.find(x=>x.khataToken===m[1]);if(p){openPartyLedger(p.id);return 'party';}}
    showToast('🔍 '+t.slice(0,80));return 'text';
  };
  function loadJsQR(){
    if(window.jsQR)return Promise.resolve();
    return new Promise((res,rej)=>{let s=document.createElement('script');s.src='vendor/jsQR.js';s.onload=res;s.onerror=()=>rej(new Error('QR reader load nahi hua'));document.head.appendChild(s);});
  }
  async function decodeFrame(video,canvas,detector){
    if(detector){let r=await detector.detect(video);return r&&r[0]&&r[0].rawValue;}
    let w=video.videoWidth,h=video.videoHeight;if(!w||!h)return null;
    canvas.width=w;canvas.height=h;let ctx=canvas.getContext('2d');ctx.drawImage(video,0,0,w,h);
    let img=ctx.getImageData(0,0,w,h),c=jsQR(img.data,w,h,{inversionAttempts:'dontInvert'});
    return c&&c.data;
  }
  window.hkDecodeQRCanvas=async function(canvas){
    await loadJsQR();
    let ctx=canvas.getContext('2d'),img=ctx.getImageData(0,0,canvas.width,canvas.height);
    let c=jsQR(img.data,canvas.width,canvas.height);return c&&c.data;
  };
  window.openQrScan=async function(){
    modal('hkScanModal','📷 QR Scan',`<p style="font-size:10px;color:var(--gray-500);margin-bottom:6px;">Order ki parchi ya label ka QR camera ke saamne rakhein.</p>
      <video id="hkScanVideo" playsinline muted style="width:100%;border-radius:12px;background:#000;max-height:55vh;"></video>
      <div id="hkScanMsg" style="font-size:10.5px;margin-top:6px;">⏳ Camera khul raha hai…</div>`);
    let video=document.getElementById('hkScanVideo'),msg=document.getElementById('hkScanMsg');
    try{
      scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});
      video.srcObject=scanStream;await video.play();
      let detector=null;
      try{if('BarcodeDetector' in window&&(await BarcodeDetector.getSupportedFormats()).includes('qr_code'))detector=new BarcodeDetector({formats:['qr_code']});}catch(e){}
      if(!detector)await loadJsQR();
      msg.textContent='📷 QR dhoond raha hai…';
      let canvas=document.createElement('canvas');scanOn=true;
      const loop=async()=>{
        if(!scanOn)return;
        if(!document.getElementById('hkScanModal')?.classList.contains('open')){stopScan();return;}
        let text=null;try{text=await decodeFrame(video,canvas,detector);}catch(e){}
        if(text){stopScan();closeModal('hkScanModal');hkHandleScan(text);return;}
        setTimeout(loop,250);
      };
      loop();
    }catch(e){stopScan();msg.textContent='⚠️ Camera nahi khula — camera ki ijazat dein ('+(e.message||e.name||e)+')';}
  };
  let origClose=window.closeModal;
  window.closeModal=function(id){if(id==='hkScanModal')stopScan();return origClose.apply(this,arguments);};

  document.addEventListener('hk:ready',()=>{
    addMenu('hkCutBtn','🪚','Cutting List','openCuttingPicker()','.drawer-item[data-tab="tabProduction"]');
    addMenu('hkBoardBtn','📺','Kaam ka Board (bari screen)','openWorkshopBoard()','.drawer-item[data-tab="tabProduction"]');
    addMenu('hkRateChgMenu','📈','Sab Rate Badlein','openRateChange()','.drawer-item[onclick*="openPriceListModal"]');
    addMenu('hkLoanBtn','🤝','Zaati Qarz (karobar se alag)','openLoans()','.drawer-item[onclick*="openChequeListModal"]');
    addMenu('hkScanBtn','📷','QR Scan','openQrScan()','.drawer-item[onclick*="openSearchModal"]');
  });
  // Order screen: cutting list for this order.
  let origView=window.viewOrderDetail;
  window.viewOrderDetail=function(id){
    let r=origView.apply(this,arguments);
    let c=document.getElementById('orderDetailContent');
    if(c&&!c.querySelector('.hk-cut-btn'))c.insertAdjacentHTML('afterbegin',`<button class="btn btn-outline btn-sm hk-cut-btn" style="width:100%;justify-content:center;margin-bottom:6px;" onclick="closeModal('orderDetailModal');openCuttingList([${id}])">🪚 Is order ki Cutting List</button>`);
    return r;
  };
})();
