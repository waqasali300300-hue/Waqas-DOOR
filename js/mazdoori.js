// HK Wood Doors ERP — Di hui Mazdoori (all labour money ever paid)
// The owner writes once what was paid to karigars before the app (per karigar,
// or one lump sum). Everything paid in the app after that adds itself:
//   • labour payments (the cash part; advance-covered parts are not counted twice)
//   • advances given
//   • daily wage paid (hazri)
// Old entries live in businessProfile.oldLabour, so they sync with the rest.
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function words(n){return window.hkRsWords?hkRsWords(n):'';}
  function old(){return businessProfile.oldLabour||(businessProfile.oldLabour=[]);}

  // Every rupee given, as {kid, date, amount, kind}.
  function events(){
    let ev=[];
    old().forEach(e=>ev.push({kid:e.karigarId??null,date:e.date||'',amount:num(e.amount),kind:'old'}));
    labours.forEach(l=>{let cash=num(l.paid)-num(l.advPaid);if(cash>0)ev.push({kid:l.karigarId,date:l.date||'',amount:cash,kind:'labour'});});
    karigars.forEach(k=>(k.advances||[]).forEach(a=>{if(num(a.amount)>0)ev.push({kid:k.id,date:a.date||'',amount:num(a.amount),kind:'advance'});}));
    (typeof karigarAttendance!=='undefined'?karigarAttendance:[]).forEach(a=>{if(num(a.paid)>0)ev.push({kid:a.karigarId,date:a.date||'',amount:num(a.paid),kind:'hazri'});});
    return ev;
  }
  function totals(filter){
    let ev=events().filter(filter||(()=>true));
    let sum=f=>ev.filter(f).reduce((s,e)=>s+e.amount,0);
    let m=today().slice(0,7),y=today().slice(0,4);
    return {all:sum(()=>true),old:sum(e=>e.kind==='old'),app:sum(e=>e.kind!=='old'),
      month:sum(e=>e.kind!=='old'&&String(e.date).startsWith(m)),year:sum(e=>String(e.date).startsWith(y))};
  }
  window.hkMazdooriTotals=totals;
  window.hkKarigarGiven=kid=>totals(e=>String(e.kid)===String(kid));

  function modal(){
    let m=document.getElementById('hkMzModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkMzModal';
      m.innerHTML=`<div class="modal-box" style="max-width:520px;"><div class="modal-head"><span>💰 Di hui Mazdoori</span> <button class="modal-close" onclick="closeModal('hkMzModal')">✕</button></div><div class="modal-body" id="hkMzB"></div></div>`;
      document.body.appendChild(m);
    }
    return m;
  }
  window.openMazdoori=function(kid){
    let m=modal(),t=totals();
    let rows=karigars.map(k=>({k,t:hkKarigarGiven(k.id)})).sort((a,b)=>b.t.all-a.t.all);
    let loose=totals(e=>e.kid==null||!karigars.some(k=>String(k.id)===String(e.kid)));
    let list=old().slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)));
    let kOpts=`<option value="">— Sab karigar (kul raqam) —</option>`+karigars.map(k=>`<option value="${k.id}" ${String(k.id)===String(kid)?'selected':''}>${esc(k.name)}</option>`).join('');
    document.getElementById('hkMzB').innerHTML=`
      <div class="hk-k2-v hk-k2-adv" style="text-align:center;margin-top:0;">
        <div>Ab tak kul mazdoori di</div><div class="hk-k2-amt">${fmtRs(t.all)}</div><div class="hk-k2-w">${words(t.all)}</div>
      </div>
      <div class="hk-mz-mini">
        <div><small>📒 App se pehle</small><b>${fmtRs(t.old)}</b></div>
        <div><small>📱 App mein</small><b>${fmtRs(t.app)}</b></div>
        <div><small>🗓 Is mahine</small><b>${fmtRs(t.month)}</b></div>
        <div><small>📅 Is saal</small><b>${fmtRs(t.year)}</b></div>
      </div>
      ${rows.length||loose.all?`<div class="hk-pos-h">👷 Har karigar ko</div>
        ${rows.map(({k,t})=>`<div class="hk-mz-row"><span><b>${esc(k.name)}</b><small>${t.old?`pehle ${fmtRs(t.old)} + app ${fmtRs(t.app)}`:'app mein'}</small></span><b>${fmtRs(t.all)}</b>
          <button class="btn btn-outline btn-xs" onclick="openMazdoori(${k.id});document.getElementById('hkMzAmt').focus()">+ Purani</button></div>`).join('')}
        ${loose.all?`<div class="hk-mz-row"><span><b>Bina naam</b><small>kul purani raqam</small></span><b>${fmtRs(loose.all)}</b><span></span></div>`:''}`:''}
      <div class="hk-mz-form">
        <div class="hk-pos-h" style="margin-top:0;">📒 Purani di hui mazdoori likhein</div>
        <p class="hk-auto-help">App se pehle jo mazdoori de chuke hain — ek dafa likh dein. Is ke baad har payment, advance aur hazri khud is mein judti jayegi.</p>
        <select class="form-select" id="hkMzKar">${kOpts}</select>
        <input class="form-input hk-pe-amt" type="number" inputmode="numeric" id="hkMzAmt" placeholder="Raqam" style="margin-top:6px;" oninput="document.getElementById('hkMzW').textContent=hkRsWords(this.value)">
        <div class="hk-pe-chips">${[[1e4,'+10 hazar'],[1e5,'+1 lakh'],[1e6,'+10 lakh']].map(([v,l])=>`<button type="button" onclick="let i=document.getElementById('hkMzAmt');i.value=(parseFloat(i.value)||0)+${v};i.dispatchEvent(new Event('input'))">${l}</button>`).join('')}</div>
        <div id="hkMzW" class="hk-k2-w"></div>
        <div class="hk-pe-row" style="margin-top:6px;">
          <input class="form-input" type="date" id="hkMzDate" value="${today()}">
          <input class="form-input" id="hkMzNote" placeholder="Note (maslan: 2025 ka)">
        </div>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" onclick="saveOldMazdoori()">💾 Save</button>
      </div>
      ${list.length?`<div class="hk-pos-h">📒 Purani entries</div>${list.map(e=>`<div class="hk-mz-row"><span><b>${esc(e.karigarId!=null?getKarigarName(e.karigarId):'Sab karigar')}</b><small>${esc(e.date||'')}${e.note?' · '+esc(e.note):''}</small></span><b>${fmtRs(e.amount)}</b>
        <button class="btn btn-outline btn-xs" onclick="deleteOldMazdoori(${e.id})">🗑</button></div>`).join('')}`:''}
      <div class="hk-k2-btns">
        <button class="btn btn-success btn-sm" onclick="closeModal('hkMzModal');openKarigarPay()">💵 Karigar ko payment dein</button>
      </div>`;
    if(!m.classList.contains('open'))openModal('hkMzModal');
  };
  window.saveOldMazdoori=function(){
    let amt=num(document.getElementById('hkMzAmt')?.value);
    if(amt<=0){showToast('⚠️ Raqam likhein');return;}
    let kv=document.getElementById('hkMzKar')?.value;
    let kid=kv?(karigars.find(k=>String(k.id)===kv)||{}).id??null:null;
    old().push({id:newId(),karigarId:kid,amount:amt,date:document.getElementById('hkMzDate')?.value||today(),note:(document.getElementById('hkMzNote')?.value||'').trim()});
    saveAll();renderAll();
    showToast(`✅ ${fmtRs(amt)} purani mazdoori jud gayi — kul ${fmtRs(totals().all)}`);
    openMazdoori();
  };
  window.deleteOldMazdoori=function(id){
    let e=old().find(x=>x.id===id);if(!e)return;
    customConfirm(`${fmtRs(e.amount)} (${e.date||''}) wali purani entry mita dein?`,()=>{
      businessProfile.oldLabour=old().filter(x=>x.id!==id);
      saveAll();renderAll();openMazdoori();showToast('🗑 Entry mit gayi');
    },{title:'💰 Mazdoori'});
  };

  // ── The total also shows where karigars are seen ──
  let origKarBody=window.renderKarigarModalBody;
  window.renderKarigarModalBody=function(){
    let r=origKarBody.apply(this,arguments);
    try{
      if(karigarView!=='list')return r;
      document.querySelectorAll('#karigarModalBody .karigar-row').forEach((row,i)=>{
        let k=karigars[i];if(!k)return;
        row.insertAdjacentHTML('beforeend',`<div class="hk-mz-line">💰 Ab tak kul di: <b>${fmtRs(hkKarigarGiven(k.id).all)}</b></div>`);
      });
    }catch(e){}
    return r;
  };
  let origKarLedger=window.renderKarigarLedgerView;
  window.renderKarigarLedgerView=function(){
    let r=origKarLedger.apply(this,arguments);
    try{
      let t=hkKarigarGiven(karigarLedgerId),back=document.querySelector('#karigarModalBody > button');
      if(back)back.insertAdjacentHTML('afterend',`<div class="hk-mz-line" style="margin-bottom:8px;">💰 Ab tak kul di: <b>${fmtRs(t.all)}</b>${t.old?` (pehle ${fmtRs(t.old)} + app ${fmtRs(t.app)})`:''}
        <button class="btn btn-outline btn-xs" onclick="closeModal('karigarModal');openMazdoori(${karigarLedgerId})">+ Purani likhein</button></div>`);
    }catch(e){}
    return r;
  };
  // Labour screen: one line on top.
  let origLabourList=window.renderLabourList;
  window.renderLabourList=function(){
    let r=origLabourList.apply(this,arguments);
    try{
      let list=document.getElementById('labourList');if(!list)return r;
      document.getElementById('hkMzCard')?.remove();
      if(typeof hkIsStaff==='function'&&hkIsStaff())return r;
      let t=totals();
      list.insertAdjacentHTML('beforebegin',`<button type="button" id="hkMzCard" class="hk-hpos" onclick="openMazdoori()">
        <div class="hk-hpos-h">💰 Ab tak kul mazdoori di <span>›</span></div>
        <div style="font-size:20px;font-weight:900;">${fmtRs(t.all)}</div>
        <div class="hk-k2-w">${t.all?words(t.all):'Purani di hui mazdoori yahan likhein'}${t.month?' · is mahine '+fmtRs(t.month):''}</div></button>`);
    }catch(e){}
    return r;
  };

  document.addEventListener('hk:ready',()=>{
    let a=document.querySelector('.drawer-item[data-tab="tabLabour"]');
    if(a&&!document.getElementById('hkMzBtn'))a.insertAdjacentHTML('afterend',`<button class="drawer-item" id="hkMzBtn" onclick="openMazdoori();closeDrawer();"><span class="t-icon">💰</span>Di hui Mazdoori</button>`);
  });
})();
