// HK Wood Doors ERP — big khata, both ways
// For a party like "Imran" with a large old account:
//   • The old balance says who owes whom: "party ne mujhe deni hai" or
//     "main ne party ko deni hai (advance)".
//   • The ledger opens with one summary: old khata, orders done, orders still
//     being made, money received, money given — and two answers: what stands
//     today, and what stands once the running orders are done.
//   • "Payment aayi" adds money received (oldest order first, then the old
//     balance — the existing rule). "Party ko diye" records money paid to them.
//   • Big amounts are also written in crore / lakh / hazar.
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  const DONE=['ready','delivered'];

  // 2,35,40,000 → "2 crore 35 lakh 40 hazar"
  function words(n){
    n=Math.round(Math.abs(num(n)));
    if(!n)return '';
    let cr=Math.floor(n/1e7),lk=Math.floor(n%1e7/1e5),hz=Math.floor(n%1e5/1e3),rest=n%1e3,out=[];
    if(cr)out.push(cr+' crore');if(lk)out.push(lk+' lakh');if(hz)out.push(hz+' hazar');if(rest)out.push(String(rest));
    return out.join(' ');
  }
  window.hkRsWords=words;
  function big(n){return (businessProfile?.currency||'Rs.')+Math.round(Math.abs(num(n))).toLocaleString('en-IN');}

  // ── Money given to the party (when the shop owes them) ──
  function given(p){return (p&&p.paidOut)||[];}
  let origBal=window.getPartyBalance;
  window.getPartyBalance=function(p){
    return origBal.apply(this,arguments)+given(p).reduce((s,x)=>s+num(x.amount),0);
  };
  let origEntries=window.buildPartyLedgerEntries;
  window.buildPartyLedgerEntries=function(p){
    let list=origEntries.apply(this,arguments);
    if(!given(p).length)return list;
    given(p).forEach(x=>list.push({date:x.date||'—',type:'Party ko diye ('+(x.method||'Cash')+')'+(x.note?': '+x.note:''),ref:'',debit:num(x.amount),credit:0}));
    list.sort((a,b)=>(a.date==='—'?-1:b.date==='—'?1:String(a.date).localeCompare(String(b.date))));
    let run=0;list.forEach(e=>{run+=num(e.debit)-num(e.credit);e.balance=run;});
    return list;
  };

  // ── The summary ──
  function summary(p){
    let old=num(p.openingBalance)+((p.oldEntries)||[]).reduce((s,e)=>s+num(e.debit)-num(e.credit),0);
    let os=getPartyOrders(p.id),done=0,running=0,runList=[];
    os.forEach(o=>{if(DONE.includes(o.status||'pending'))done+=num(o.orderTotal);else{running+=num(o.orderTotal);runList.push(o);}});
    let got=os.reduce((s,o)=>s+getOrderTotalPaid(o),0)+(p.partyPayments||[]).reduce((s,x)=>s+num(x.amount),0);
    let gave=given(p).reduce((s,x)=>s+num(x.amount),0);
    let all=getPartyBalance(p);
    return {old,done,running,runList,got,gave,all,now:all-running};
  }
  window.hkKhataSummary=summary;
  function verdict(name,b,when){
    if(Math.abs(b)<1)return `<div class="hk-k2-v hk-k2-zero">✅ ${when}: hisaab barabar</div>`;
    let theyOwe=b>0;
    return `<div class="hk-k2-v ${theyOwe?'hk-k2-due':'hk-k2-adv'}">
      <div>${when}: ${theyOwe?`<b>${esc(name)}</b> ne aap ko dene hain`:`aap ne <b>${esc(name)}</b> ko dene hain`}</div>
      <div class="hk-k2-amt">${big(b)}</div><div class="hk-k2-w">${words(b)}</div></div>`;
  }
  function card(p){
    let s=summary(p);
    let row=(label,v,sign,cls)=>`<div class="hk-k2-row ${cls||''}"><span>${label}</span><b>${sign}${big(v)}</b></div>`;
    return `<div class="hk-k2" id="hkK2">
      <div class="hk-k2-title">📊 Pura Hisaab — ${esc(p.name)}</div>
      ${row('📒 Purana khata'+(s.old<0?' (aap ne dene the)':''),s.old,s.old<0?'− ':'')}
      ${row('✅ Orders ban chuke / diye',s.done,'+ ')}
      ${row('🛠 Orders ban rahe ('+s.runList.length+')',s.running,'+ ','hk-k2-run')}
      ${row('💵 Payment aayi',s.got,'− ','hk-k2-got')}
      ${s.gave?row('💸 Party ko diye',s.gave,'+ '):''}
      ${verdict(p.name,s.now,'Aaj tak')}
      ${s.running?verdict(p.name,s.all,'Ban rahe orders ke baad'):''}
      ${s.runList.length?`<div class="hk-k2-list">${s.runList.map(o=>`<span>${esc(o.orderNo||'')} · ${fmtRs(o.orderTotal)} · ${esc(o.status||'pending')}</span>`).join('')}</div>`:''}
      <div class="hk-k2-btns">
        <button class="btn btn-success btn-sm" onclick="openReceivePaymentModal(${p.id})">💵 Payment aayi — khate mein daalein</button>
        <button class="btn btn-outline btn-sm" onclick="openGivePayment(${p.id})">💸 Party ko paise diye</button>
      </div>
      ${given(p).length?`<div class="hk-k2-list">${given(p).slice().reverse().map(x=>`<span>💸 ${esc(x.date)} · ${fmtRs(x.amount)}${x.note?' · '+esc(x.note):''} <button class="btn btn-xs btn-outline" onclick="deleteGivePayment(${p.id},${x.id})">🗑</button></span>`).join('')}</div>`:''}
    </div>`;
  }
  let origLedger=window.openPartyLedger;
  window.openPartyLedger=function(pid){
    let r=origLedger.apply(this,arguments);
    let p=getPartyById(pid),body=document.getElementById('partyLedgerModalBody');
    if(p&&body){document.getElementById('hkK2')?.remove();body.insertAdjacentHTML('afterbegin',card(p));}
    return r;
  };
  function ledgerOpen(){return document.getElementById('partyLedgerModal')?.classList.contains('open');}
  function refresh(pid){if(ledgerOpen())openPartyLedger(pid);}

  // A payment added from inside the khata: the khata shows the new figures.
  let origAdd=window.addPartyPayment;
  window.addPartyPayment=function(){
    let pid=payingPartyId,r=origAdd.apply(this,arguments);
    refresh(pid);return r;
  };

  // ── Money given to the party ──
  window.openGivePayment=function(pid){
    let p=getPartyById(pid);if(!p)return;
    let m=document.getElementById('hkGiveModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkGiveModal';
      m.innerHTML=`<div class="modal-box" style="max-width:420px;"><div class="modal-head"><span id="hkGiveT"></span> <button class="modal-close" onclick="closeModal('hkGiveModal')">✕</button></div><div class="modal-body" id="hkGiveB"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById('hkGiveT').textContent='💸 '+p.name+' ko paise diye';
    document.getElementById('hkGiveB').innerHTML=`
      <p class="hk-auto-help">Jab aap ne party ke paise dene hon (advance ya purana len-den) aur aap ne unhein raqam di — yahan likhein. Ye khate mein jud jayegi aur cash/bank se nikal jayegi.</p>
      <div class="form-group"><label class="form-label">Raqam</label><input class="form-input" type="number" id="hkGiveAmt" oninput="document.getElementById('hkGiveW').textContent=hkRsWords(this.value)"><small id="hkGiveW" class="hk-k2-w"></small></div>
      <div class="form-group"><label class="form-label">Tareekh</label><input class="form-input" type="date" id="hkGiveDate" value="${today()}"></div>
      <div class="form-group"><label class="form-label">Kaise</label><select class="form-select" id="hkGiveMethod"><option>Cash</option><option>Bank</option><option>Cheque</option><option>JazzCash</option><option>Easypaisa</option></select></div>
      <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="hkGiveNote" placeholder="maslan: advance wapas"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="saveGivePayment(${p.id})">💾 Save</button>`;
    openModal('hkGiveModal');
  };
  window.saveGivePayment=function(pid){
    let p=getPartyById(pid);if(!p)return;
    let amount=num(document.getElementById('hkGiveAmt')?.value);
    if(amount<=0){showToast('⚠️ Raqam likhein');return;}
    let date=document.getElementById('hkGiveDate')?.value||today();
    let method=document.getElementById('hkGiveMethod')?.value||'Cash';
    let note=document.getElementById('hkGiveNote')?.value||'';
    let bankTxId=newId();
    bankTransactions.push({id:bankTxId,type:'withdrawal',account:method,amount,date,description:`Paid to ${p.name}`+(note?` (${note})`:''),createdAt:new Date().toISOString()});
    if(!p.paidOut)p.paidOut=[];
    p.paidOut.push({id:Date.now(),amount,date,method,note,bankTxId});
    p.updatedAt=new Date().toISOString();
    saveAll();closeModal('hkGiveModal');renderAll();refresh(pid);
    showToast(`✅ ${p.name} ko ${fmtRs(amount)} diye — khate mein jud gaye`);
  };
  window.deleteGivePayment=function(pid,id){
    let p=getPartyById(pid);if(!p)return;
    let x=given(p).find(e=>e.id===id);if(!x)return;
    customConfirm(`${fmtRs(x.amount)} (${x.date}) wali entry mita dein?`,()=>{
      p.paidOut=given(p).filter(e=>e.id!==id);
      if(x.bankTxId)bankTransactions=bankTransactions.filter(t=>t.id!==x.bankTxId);
      p.updatedAt=new Date().toISOString();
      saveAll();renderAll();refresh(pid);showToast('🗑 Entry mit gayi');
    },{title:'💸 Entry'});
  };

  // ── Party form: which way the old balance goes ──
  let origOpenParty=window.openPartyModal;
  window.openPartyModal=function(pid){
    let r=origOpenParty.apply(this,arguments);
    let inp=document.getElementById('partyOpeningBalance');
    if(inp&&!document.getElementById('hkObDir')){
      let v=num(inp.value),owe=v<0;
      if(owe)inp.value=Math.abs(v);
      inp.insertAdjacentHTML('afterend',`<small id="hkObW" class="hk-k2-w">${words(v)}</small>
        <select class="form-select" id="hkObDir" style="margin-top:6px;">
          <option value="due" ${owe?'':'selected'}>👉 Ye raqam party ne mujhe deni hai</option>
          <option value="owe" ${owe?'selected':''}>👈 Ye raqam main ne party ko deni hai (advance / un ka len)</option>
        </select>`);
      inp.addEventListener('input',()=>{document.getElementById('hkObW').textContent=words(inp.value);});
    }
    return r;
  };
  let origSaveParty=window.saveParty;
  window.saveParty=function(){
    let inp=document.getElementById('partyOpeningBalance'),dir=document.getElementById('hkObDir');
    if(inp&&dir&&dir.value==='owe')inp.value=-Math.abs(num(inp.value));
    return origSaveParty.apply(this,arguments);
  };
})();
