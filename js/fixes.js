// HK Wood Doors ERP — one-time fix for advances on old orders
// Before the Auto System, an order's "Advance" was only a number on the order:
// - with no other payment, it counted as paid but never showed in the ledger/khata;
// - once any other payment was added, the advance stopped counting as paid at all.
// This turns each such advance into a real payment entry, after the owner confirms.
(function(){
  function num(v){return parseFloat(v)||0;}

  // Orders whose advance is not yet a payment entry.
  function findOldAdvances(){
    return orders.filter(o=>{
      let adv=num(o.advancePayment);
      if(adv<=0)return false;
      let pays=o.payments||[];
      if(pays.some(p=>p.autoAdvance||p.migratedAdvance))return false;
      // Already written down by hand as a payment of the same amount → leave it.
      if(pays.some(p=>Math.abs(num(p.amount)-adv)<0.5))return false;
      return true;
    });
  }

  function applyFix(list){
    list.forEach(o=>{
      o.payments=o.payments||[];
      // Same id on every phone, so two phones fixing the same order don't add it twice.
      o.payments.unshift({id:Number(o.id)*10+7,amount:num(o.advancePayment),date:o.date,method:'Cash',note:'Advance (order ke waqt)',migratedAdvance:true});
    });
    businessProfile.advanceFixDone=true;
    saveAll();renderAll();
  }

  window.openAdvanceFix=function(){
    let list=findOldAdvances();
    if(!list.length){businessProfile.advanceFixDone=true;saveAll();showToast('✅ Sab advance pehle se theek hain');return;}
    let lost=list.filter(o=>(o.payments||[]).length);   // advance not counted as paid today
    let hidden=list.filter(o=>!(o.payments||[]).length);// counted, but missing from the ledger
    let lostSum=lost.reduce((s,o)=>s+num(o.advancePayment),0);
    let m=document.getElementById('hkAdvFixModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkAdvFixModal';
      m.innerHTML=`<div class="modal-box" style="max-width:520px;"><div class="modal-head">🛠️ Purane Advance Theek Karein <button class="modal-close" onclick="closeModal('hkAdvFixModal')">✕</button></div><div class="modal-body" id="hkAdvFixBody"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById('hkAdvFixBody').innerHTML=`
      <p style="font-size:11px;margin-bottom:8px;">${list.length} purane orders mein advance sirf ek number tha, payment entry nahi. Theek karne par har advance order ki tareekh par <b>Cash payment</b> ban jayega.</p>
      ${lost.length?`<div style="font-size:11px;font-weight:700;margin:8px 0 4px;color:#b91c1c;">⚠️ ${lost.length} orders — advance "Paid" mein gina hi nahi ja raha tha (kul ${fmtRs(lostSum)})</div>
        <p style="font-size:9.5px;color:var(--gray-500);margin-bottom:4px;">In ka baqaya ab utna kam ho jayega:</p>
        ${lost.map(o=>`<div style="display:flex;justify-content:space-between;font-size:10.5px;padding:5px 0;border-bottom:1px solid var(--border);"><span><b>${esc(o.orderNo||'')}</b> · ${esc(getPartyName(o.partyId))} · ${esc(o.date||'')}</span><span>${fmtRs(o.advancePayment)}</span></div>`).join('')}`:''}
      ${hidden.length?`<div style="font-size:11px;font-weight:700;margin:12px 0 4px;">📒 ${hidden.length} orders — paid sahi tha, magar ledger/khata mein advance nazar nahi aata tha</div>
        <p style="font-size:9.5px;color:var(--gray-500);">Baqaya nahi badlega; sirf ledger mein advance ki line aa jayegi.</p>`:''}
      <p style="font-size:9.5px;color:var(--gray-500);margin-top:10px;">Jin orders mein advance pehle hi payment ke taur par likha hua tha, unhein nahi chheda. Kuch ghalat lage to Settings → Auto Backup se aaj ka data wapas la sakte hain.</p>
      <div style="display:flex;gap:6px;margin-top:12px;">
        <button class="btn btn-outline" style="flex:1;justify-content:center;" onclick="closeModal('hkAdvFixModal')">Baad mein</button>
        <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="confirmAdvanceFix()">✅ Theek Karein</button>
      </div>`;
    if(!m.classList.contains('open'))openModal('hkAdvFixModal');
  };

  window.confirmAdvanceFix=function(){
    let list=findOldAdvances();
    applyFix(list);
    closeModal('hkAdvFixModal');
    showToast(`✅ ${list.length} orders ke advance theek ho gaye`);
  };

  document.addEventListener('hk:ready',()=>{
    // Ask the owner once (after the PIN screen); staff never see it.
    setTimeout(function ask(){
      if(document.querySelector('.hk-pin-lock')){setTimeout(ask,800);return;}
      if(businessProfile.advanceFixDone||(window.hkIsStaff&&hkIsStaff()))return;
      if(findOldAdvances().length)openAdvanceFix();
    },1500);
  });
})();
