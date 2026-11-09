// HK Wood Doors ERP — a party's old khata (from before the app)
// Besides the one "opening balance", any number of old entries can be added:
// date, details, goods given (bill) and money received. They count in the
// balance and show in the ledger, its PDF, statements and the live khata link.
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function old(p){return (p&&p.oldEntries)||[];}

  let origBal=window.getPartyBalance;
  window.getPartyBalance=function(p){
    let b=origBal.apply(this,arguments);
    return b+old(p).reduce((s,e)=>s+num(e.debit)-num(e.credit),0);
  };
  let origEntries=window.buildPartyLedgerEntries;
  window.buildPartyLedgerEntries=function(p){
    let list=origEntries.apply(this,arguments);
    if(!old(p).length)return list;
    old(p).forEach(e=>list.push({date:e.date||'—',type:'Purana khata'+(e.note?': '+e.note:''),ref:'',debit:num(e.debit),credit:num(e.credit),old:true}));
    list.sort((a,b)=>(a.date==='—'?-1:b.date==='—'?1:String(a.date).localeCompare(String(b.date))));
    let run=0;list.forEach(e=>{run+=num(e.debit)-num(e.credit);e.balance=run;});
    return list;
  };

  function modal(id,title,html){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:480px;"><div class="modal-head"><span id="${id}T"></span> <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}B"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById(id+'T').textContent=title;
    document.getElementById(id+'B').innerHTML=html;
    if(!m.classList.contains('open'))openModal(id);
  }
  window.openOldKhata=function(pid){
    let p=getPartyById(pid);if(!p)return;
    let rows=old(p).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    let maal=rows.reduce((s,e)=>s+num(e.debit),0),paise=rows.reduce((s,e)=>s+num(e.credit),0);
    modal('hkOldKhataModal','📒 Purana Khata — '+p.name,`
      <p style="font-size:10px;color:var(--gray-500);margin-bottom:8px;">App se pehle ka hisaab (purani copy/register se). Har entry party ke khate, PDF aur statement mein shamil hogi.${num(p.openingBalance)?` Is ke ilawa Opening Balance: <b>${fmtRs(p.openingBalance)}</b>.`:''}</p>
      ${rows.length?`<div style="font-size:10px;margin-bottom:6px;">Maal: <b>${fmtRs(maal)}</b> · Wasooli: <b>${fmtRs(paise)}</b> · Farq: <b>${fmtRs(maal-paise)}</b></div>`+rows.map(e=>`
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;font-size:10.5px;padding:6px 0;border-bottom:1px solid var(--border);">
          <span>${esc(e.date)} · ${num(e.debit)?'📦 Maal':'💵 Wasooli'}${e.note?' · '+esc(e.note):''}</span>
          <span><b style="color:${num(e.debit)?'#b91c1c':'#065f46'};">${fmtRs(num(e.debit)||num(e.credit))}</b>
          <button class="btn btn-outline btn-xs" onclick="deleteOldKhataEntry(${p.id},${e.id})">🗑</button></span></div>`).join('')
        :'<div style="font-size:10.5px;color:var(--gray-500);">Abhi koi purani entry nahi</div>'}
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
        <input class="form-input" type="date" id="hkOkDate" value="${today()}" style="flex:1;min-width:130px;">
        <input class="form-input" type="number" id="hkOkAmt" placeholder="Raqam" style="flex:1;min-width:100px;" oninput="let w=document.getElementById('hkOkW');if(w&&window.hkRsWords)w.textContent=hkRsWords(this.value)"></div><small id="hkOkW" class="hk-k2-w"></small>
      <input class="form-input" id="hkOkNote" placeholder="Tafseel (maslan: 10 darwaze, bill #45)" style="margin-top:6px;">
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="btn btn-primary" style="flex:1;" onclick="addOldKhataEntry(${p.id},'maal')">📦 Maal diya (party ne dene hain)</button>
        <button class="btn btn-gold" style="flex:1;" onclick="addOldKhataEntry(${p.id},'paise')">💵 Paise mile</button></div>
      <button class="btn btn-outline btn-sm" style="width:100%;justify-content:center;margin-top:8px;" onclick="closeModal('hkOldKhataModal');openPartyLedger(${p.id})">📖 Khata dekhein</button>`);
  };
  window.addOldKhataEntry=function(pid,kind){
    let p=getPartyById(pid);if(!p)return;
    let amt=num(document.getElementById('hkOkAmt')?.value);
    if(amt<=0){showToast('⚠️ Raqam likhein');return;}
    (p.oldEntries=p.oldEntries||[]).push({id:newId(),date:document.getElementById('hkOkDate')?.value||today(),
      note:(document.getElementById('hkOkNote')?.value||'').trim(),debit:kind==='maal'?amt:0,credit:kind==='paise'?amt:0});
    p.updatedAt=new Date().toISOString();
    saveAll();renderAll();
    showToast('✅ Purani entry jud gayi — naya baqaya '+fmtRs(getPartyBalance(p)));
    openOldKhata(pid);
  };
  window.deleteOldKhataEntry=function(pid,eid){
    let p=getPartyById(pid);if(!p)return;
    customConfirm('Yeh purani entry mita dein?',()=>{
      p.oldEntries=old(p).filter(e=>e.id!==eid);p.updatedAt=new Date().toISOString();
      saveAll();renderAll();openOldKhata(pid);
    },{okText:'Mitayein'});
  };
  // Buttons: in the party form (existing party) and on top of the ledger.
  let origPartyModal=window.openPartyModal;
  window.openPartyModal=function(id){
    let r=origPartyModal.apply(this,arguments);
    try{
      let g=document.getElementById('partyOpeningBalance')?.closest('.form-group');
      if(g&&!document.getElementById('hkOldKhataHint')){
        let p=id?getPartyById(id):null;
        g.insertAdjacentHTML('afterend',`<div id="hkOldKhataHint" style="font-size:9.5px;margin:-4px 0 10px;color:var(--gray-500);">
          ${p?`📒 Puraane bill aur wasooli alag alag tareekh se likhne hain? <button type="button" class="btn btn-outline btn-xs" onclick="closeModal('partyModal');openOldKhata(${p.id})">Purana Khata${old(p).length?' ('+old(p).length+')':''}</button>`
            :'📒 Kul purani baqi raqam upar likhein. Puraane bill alag alag likhne hon to party Save karne ke baad "Purana Khata" se jorein.'}</div>`);
      }
    }catch(e){}
    return r;
  };
  let origLedger=window.openPartyLedger;
  window.openPartyLedger=function(pid){
    let r=origLedger.apply(this,arguments);
    let body=document.getElementById('partyLedgerModalBody');
    if(body&&!body.querySelector('.hk-oldk-btn'))body.insertAdjacentHTML('afterbegin',`<button class="btn btn-outline btn-sm hk-oldk-btn" style="width:100%;justify-content:center;margin-bottom:6px;" onclick="closeModal('partyLedgerModal');openOldKhata(${pid})">📒 Purana Khata (app se pehle ka) jorein</button>`);
    return r;
  };
})();
