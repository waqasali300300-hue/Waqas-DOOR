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
        ${suppliers.length?`<button class="btn btn-outline btn-sm" onclick="openLagwao(${p.id},null)">🔁 Supplier ko payment lagwayi</button>`:''}
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
      <div class="form-group"><label class="form-label">Kaise</label><select class="form-select" id="hkGiveMethod">${BANK_ACCOUNTS.map(b=>`<option>${b}</option>`).join('')}</select></div>
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
  // ════════ Payment "lagwayi": a customer pays a supplier for the shop ════════
  // One entry on both khatas: the customer's balance goes down (oldest order
  // first, then old balance) and so does what the shop owes the supplier.
  // No cash moves, so nothing goes in the cash book. Both sides share a linkId;
  // deleting either side keeps the other in step.
  function linked(fn){
    parties.forEach(p=>{
      (p.partyPayments||[]).forEach(x=>{if(x.linkId)fn(x,p,null);});
      getPartyOrders(p.id).forEach(o=>(o.payments||[]).forEach(x=>{if(x.linkId)fn(x,p,o);}));
    });
  }
  window.openLagwao=function(pid,sid){
    let m=document.getElementById('hkLagModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkLagModal';
      m.innerHTML=`<div class="modal-box" style="max-width:440px;"><div class="modal-head"><span>🔁 Payment lagwayi</span> <button class="modal-close" onclick="closeModal('hkLagModal')">✕</button></div><div class="modal-body" id="hkLagB"></div></div>`;
      document.body.appendChild(m);
    }
    let pOpts=parties.slice().sort((a,b)=>getPartyBalance(b)-getPartyBalance(a)).map(p=>`<option value="${p.id}" ${String(p.id)===String(pid)?'selected':''}>${esc(p.name)} — baqi ${fmtRs(getPartyBalance(p))}</option>`).join('');
    let sOpts=suppliers.map(x=>`<option value="${x.id}" ${String(x.id)===String(sid)?'selected':''}>${esc(x.name)} — dena ${fmtRs(hkSupplierBalance(x))}</option>`).join('');
    document.getElementById('hkLagB').innerHTML=`
      <p class="hk-auto-help">Jab gahak aap ki jagah seedha supplier ko paise de de — dono khaton se ek saath kat jayega. Cash book mein kuch nahi jayega.</p>
      <div class="form-group"><label class="form-label">Kis gahak ne diye</label><select class="form-select" id="hkLagParty">${pOpts}</select></div>
      <div class="form-group"><label class="form-label">Kis supplier ko</label><select class="form-select" id="hkLagSup">${sOpts}</select></div>
      <div class="form-group"><label class="form-label">Raqam</label><input class="form-input" type="number" id="hkLagAmt" oninput="document.getElementById('hkLagW').textContent=hkRsWords(this.value)"><small id="hkLagW" class="hk-k2-w"></small></div>
      <div class="form-group"><label class="form-label">Tareekh</label><input class="form-input" type="date" id="hkLagDate" value="${today()}"></div>
      <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="hkLagNote" placeholder="maslan: cheque no. / parchi"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="saveLagwao()">💾 Save</button>`;
    openModal('hkLagModal');
  };
  window.saveLagwao=function(){
    let p=getPartyById(parseInt(document.getElementById('hkLagParty')?.value));
    let sup=suppliers.find(x=>String(x.id)===String(document.getElementById('hkLagSup')?.value));
    let amount=num(document.getElementById('hkLagAmt')?.value);
    if(!p||!sup){showToast('⚠️ Gahak aur supplier chunein');return;}
    if(amount<=0){showToast('⚠️ Raqam likhein');return;}
    let date=document.getElementById('hkLagDate')?.value||today(),note=document.getElementById('hkLagNote')?.value||'';
    let linkId=newId(),method='Lagwayi → '+sup.name,left=amount,n=0;
    let mk=a=>({id:Date.now()+(n++),amount:a,date,method,note,user:activeUserId,linkId,viaSupplierId:sup.id});
    getPartyOrders(p.id).filter(o=>num(o.orderTotal)-getOrderTotalPaid(o)>0).sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(o=>{
      if(left<=0)return;
      let a=Math.min(left,num(o.orderTotal)-getOrderTotalPaid(o));
      if(!o.payments)o.payments=[];
      // An order whose advance was never written as a payment keeps that advance.
      if(!o.payments.length&&num(o.advancePayment))o.payments.push({id:Date.now()+(n++),amount:num(o.advancePayment),date:o.date,method:'Advance',note:''});
      o.payments.push(mk(a));left-=a;
    });
    if(left>0){(p.partyPayments=p.partyPayments||[]).push(mk(left));}
    (sup.payments=sup.payments||[]).push({id:newId(),amount,date,account:'Party se: '+p.name,note,user:activeUserId,linkId,viaPartyId:p.id});
    p.updatedAt=sup.updatedAt=new Date().toISOString();
    saveAll();closeModal('hkLagModal');renderAll();
    if(ledgerOpen())openPartyLedger(p.id);
    if(document.getElementById('hkSupLedgerModal')?.classList.contains('open'))openSupplierLedger(sup.id);
    if(document.getElementById('hkPosModal')?.classList.contains('open'))openMyPosition();
    showToast(`✅ ${p.name} → ${sup.name}: ${fmtRs(amount)} dono khaton se kat gaye`);
  };
  // Deleting one side of a "lagwayi" deletes (or shrinks) the other side too.
  // Only an explicit payment delete does this — deleting a whole order or
  // customer leaves the supplier's khata alone, since that money was paid.
  let pend=null;
  function findCust(pid,payId,orderId){
    let p=getPartyById(pid);
    if(orderId!=null){let o=orders.find(x=>x.id==orderId);return o&&(o.payments||[]).find(x=>x.id==payId);}
    return p&&(p.partyPayments||[]).find(x=>x.id==payId);
  }
  function mark(entry,side){if(entry&&entry.linkId)pend={linkId:entry.linkId,side};}
  let dP=window.deletePayment;
  window.deletePayment=function(orderId,payId){let o=orders.find(x=>x.id==orderId);mark(o&&(o.payments||[]).find(x=>x.id==payId),'cust');return dP.apply(this,arguments);};
  let dPP=window.deletePartyPayment;
  window.deletePartyPayment=function(pid,payId){mark(findCust(pid,payId),'cust');return dPP.apply(this,arguments);};
  let dRP=window.deleteReceivedPayment;
  if(dRP)window.deleteReceivedPayment=function(kind,refId,payId,pid){mark(kind==='order'?findCust(pid,payId,refId):findCust(pid,payId),'cust');return dRP.apply(this,arguments);};
  let dSP=window.deleteSupplierPayment;
  window.deleteSupplierPayment=function(sid,payId){let s=suppliers.find(x=>x.id===sid);mark(s&&(s.payments||[]).find(x=>x.id===payId),'sup');return dSP.apply(this,arguments);};
  function syncLinks(){
    if(!pend)return;
    let {linkId,side}=pend;pend=null;
    let left=0,has=false;
    linked(x=>{if(x.linkId===linkId){has=true;left+=num(x.amount);}});
    if(side==='cust'){
      suppliers.forEach(s=>{
        if(!s.payments)return;
        s.payments=s.payments.filter(x=>x.linkId!==linkId||left>0);
        s.payments.forEach(x=>{if(x.linkId===linkId)x.amount=left;});
      });
    }else if(!suppliers.some(s=>(s.payments||[]).some(x=>x.linkId===linkId))&&has){
      parties.forEach(p=>{
        if(p.partyPayments)p.partyPayments=p.partyPayments.filter(x=>x.linkId!==linkId);
        getPartyOrders(p.id).forEach(o=>{if(o.payments)o.payments=o.payments.filter(x=>x.linkId!==linkId);});
      });
    }
  }
  let origSaveAll=window.saveAll;
  window.saveAll=function(){try{syncLinks();}catch(e){console.warn('links',e);}return origSaveAll.apply(this,arguments);};

  // ════════ Supplier khata: summary on top ════════
  function supSummary(s){
    let old=num(s.openingBalance),took=0,cash=0,via=0;
    purchases.filter(p=>p.supplierId==s.id&&p.account==='udhaar').forEach(p=>took+=num(p.total)||num(p.qty)*num(p.rate));
    (s.payments||[]).forEach(x=>{if(x.viaPartyId)via+=num(x.amount);else cash+=num(x.amount);});
    return {old,took,cash,via,bal:hkSupplierBalance(s)};
  }
  window.hkSupSummary=supSummary;
  let origSupLedger=window.openSupplierLedger;
  window.openSupplierLedger=function(id){
    let r=origSupLedger.apply(this,arguments);
    let s=suppliers.find(x=>x.id===id),body=document.getElementById('hkSupLedgerModalBody');
    if(!s||!body)return r;
    let x=supSummary(s);
    let row=(l,v,sign,cls)=>`<div class="hk-k2-row ${cls||''}"><span>${l}</span><b>${sign}${big(v)}</b></div>`;
    let v=Math.abs(x.bal)<1?`<div class="hk-k2-v hk-k2-zero">✅ Hisaab barabar</div>`
      :`<div class="hk-k2-v ${x.bal>0?'hk-k2-adv':'hk-k2-due'}"><div>${x.bal>0?`Aap ne <b>${esc(s.name)}</b> ko dene hain`:`<b>${esc(s.name)}</b> ne aap ko dene hain (advance)`}</div><div class="hk-k2-amt">${big(x.bal)}</div><div class="hk-k2-w">${words(x.bal)}</div></div>`;
    body.insertAdjacentHTML('afterbegin',`<div class="hk-k2" id="hkSupK2">
      <div class="hk-k2-title">📊 Pura Hisaab — ${esc(s.name)}</div>
      ${row('📒 Pichhla baqaya',x.old,x.old<0?'− ':'')}
      ${row('🪵 Udhaar khareed',x.took,'+ ')}
      ${row('💵 Aap ne payment di',x.cash,'− ','hk-k2-got')}
      ${row('🔁 Gahakon se lagwayi',x.via,'− ','hk-k2-got')}
      ${v}
      <div class="hk-k2-btns">
        <button class="btn btn-success btn-sm" onclick="openSupplierPayment(${s.id})">💵 Payment di</button>
        ${parties.length?`<button class="btn btn-outline btn-sm" onclick="openLagwao(null,${s.id})">🔁 Gahak se lagwayi</button>`:''}
      </div></div>`);
    let ob=document.getElementById('supOpening');
    if(ob&&!document.getElementById('supOpeningW')){
      ob.insertAdjacentHTML('afterend',`<small id="supOpeningW" class="hk-k2-w">${words(ob.value)}</small>`);
      ob.addEventListener('input',()=>{document.getElementById('supOpeningW').textContent=words(ob.value);});
    }
    return r;
  };
  // A payment saved from the supplier khata: the khata shows the new figures.
  let origSupPay=window.saveSupplierPayment;
  window.saveSupplierPayment=function(id){
    let r=origSupPay.apply(this,arguments);
    if(document.getElementById('hkSupLedgerModal')?.classList.contains('open'))openSupplierLedger(id);
    return r;
  };

  // ════════ Mera Kul Hisaab: the whole business in one screen ════════
  function position(){
    let acc={};
    bankTransactions.forEach(t=>{let a=t.account||'Cash';acc[a]=(acc[a]||0)+(t.type==='deposit'?num(t.amount):-num(t.amount));});
    let cash=Object.values(acc).reduce((s,v)=>s+v,0);
    let pb=parties.map(p=>({p,b:getPartyBalance(p)})),sb=suppliers.map(s=>({s,b:hkSupplierBalance(s)}));
    let lene=pb.filter(x=>x.b>0).reduce((s,x)=>s+x.b,0)+sb.filter(x=>x.b<0).reduce((s,x)=>s-x.b,0);
    let dene=sb.filter(x=>x.b>0).reduce((s,x)=>s+x.b,0)+pb.filter(x=>x.b<0).reduce((s,x)=>s-x.b,0);
    let run=orders.filter(o=>(o.status||'pending')!=='delivered');
    let runVal=run.reduce((s,o)=>s+num(o.orderTotal),0),runDue=run.reduce((s,o)=>s+Math.max(0,num(o.orderTotal)-getOrderTotalPaid(o)),0);
    return {acc,cash,lene,dene,run,runVal,runDue,pb,sb,net:cash+lene-dene};
  }
  window.hkPosition=position;
  window.openMyPosition=function(){
    let x=position();
    let m=document.getElementById('hkPosModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkPosModal';
      m.innerHTML=`<div class="modal-box" style="max-width:560px;"><div class="modal-head"><span>💼 Mera Kul Hisaab</span> <button class="modal-close" onclick="closeModal('hkPosModal')">✕</button></div><div class="modal-body" id="hkPosB"></div></div>`;
      document.body.appendChild(m);
    }
    let tile=(icon,label,v,cls,sub)=>`<div class="hk-pos-tile ${cls}"><div class="hk-pos-l">${icon} ${label}</div><div class="hk-pos-v">${big(v)}</div><div class="hk-k2-w">${words(v)}</div>${sub?`<div class="hk-pos-sub">${sub}</div>`:''}</div>`;
    let accs=Object.entries(x.acc).filter(([,v])=>Math.abs(v)>=1).map(([a,v])=>`${esc(a)} ${fmtRs(v)}`).join(' · ');
    let line=(name,b,click)=>`<button type="button" class="hk-pos-row" onclick="${click}"><span>${esc(name)}</span><b>${big(b)}</b></button>`;
    let owe=x.sb.filter(e=>e.b>=1).sort((a,b)=>b.b-a.b).map(e=>line(e.s.name,e.b,`openSupplierLedger(${e.s.id})`))
      .concat(x.pb.filter(e=>e.b<=-1).sort((a,b)=>a.b-b.b).map(e=>line(e.p.name+' (advance)',e.b,`openPartyLedger(${e.p.id})`)));
    let get=x.pb.filter(e=>e.b>=1).sort((a,b)=>b.b-a.b).map(e=>line(e.p.name,e.b,`openPartyLedger(${e.p.id})`))
      .concat(x.sb.filter(e=>e.b<=-1).map(e=>line(e.s.name+' (advance diya)',e.b,`openSupplierLedger(${e.s.id})`)));
    document.getElementById('hkPosB').innerHTML=`
      <div class="hk-pos-grid">
        ${tile('📤','Main ne dene hain',x.dene,'hk-pos-red',`${owe.length} khate`)}
        ${tile('💰','Mere paas mojood',x.cash,'hk-pos-green',accs||'Cash / bank mein kuch nahi')}
        ${tile('📥','Bahar se lene hain',x.lene,'hk-pos-blue',`${get.length} gahak`)}
        ${tile('🛠','Orders shuru',x.runVal,'hk-pos-purple',`${x.run.length} orders · in par lena baqi ${fmtRs(x.runDue)}`)}
      </div>
      <div class="hk-k2-v ${x.net>=0?'hk-k2-zero':'hk-k2-due'}" style="text-align:center;">
        <div>Sab mila kar (mojood + lena − dena)</div><div class="hk-k2-amt">${x.net<0?'− ':''}${big(x.net)}</div><div class="hk-k2-w">${words(x.net)}</div>
      </div>
      ${owe.length?`<div class="hk-pos-h">📤 Jin ko dena hai</div>${owe.join('')}`:''}
      ${get.length?`<div class="hk-pos-h">📥 Jin se lena hai</div>${get.slice(0,15).join('')}${get.length>15?`<button type="button" class="hk-pos-row" onclick="closeModal('hkPosModal');switchTab('tabKhata')"><span>… aur ${get.length-15} — sab dekhein</span><b>›</b></button>`:''}`:''}
      ${x.run.length?`<div class="hk-pos-h">🛠 Chalte orders</div>${x.run.slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).map(o=>`<button type="button" class="hk-pos-row" onclick="viewOrderDetail(${o.id})"><span>${esc(o.orderNo||'')} · ${esc(getPartyName(o.partyId))} · ${esc(o.status||'pending')}</span><b>${fmtRs(o.orderTotal)}</b></button>`).join('')}`:''}
      <div class="hk-k2-btns">
        <button class="btn btn-primary btn-sm" onclick="openPaisaEntry()">💳 Paisa Entry</button>
        <button class="btn btn-gold btn-sm" onclick="shareMyPosition()">📤 Share</button>
      </div>`;
    openModal('hkPosModal');
  };
  window.shareMyPosition=function(){
    let x=position();
    let t=`*${businessProfile.name||'HK Doors'} — Kul Hisaab* (${today()})\n📤 Dene hain: ${big(x.dene)}\n💰 Mojood: ${big(x.cash)}\n📥 Lene hain: ${big(x.lene)}\n🛠 Orders shuru: ${x.run.length} · ${big(x.runVal)}\n= Sab mila kar: ${x.net<0?'− ':''}${big(x.net)}`;
    if(navigator.share)navigator.share({text:t}).catch(()=>{});
    else window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');
  };
  document.addEventListener('hk:ready',()=>{
    let anchor=document.querySelector('.drawer-item[data-tab="tabBankBook"]');
    if(anchor&&!document.getElementById('hkPosBtn'))anchor.insertAdjacentHTML('beforebegin',`<button class="drawer-item" id="hkPosBtn" onclick="openMyPosition();closeDrawer();"><span class="t-icon">💼</span>Mera Kul Hisaab</button>`);
  });
  // ════════ Paisa Entry: every kind of payment from one simple form ════════
  const KINDS=[
    ['in','📥','Gahak se aaye','Gahak ne paise diye'],
    ['out','📤','Supplier ko diye','Aap ne supplier ko diye'],
    ['lag','🔁','Gahak ne supplier ko diye','Payment lagwayi'],
    ['back','💸','Gahak ko diye','Advance wapas / gahak ko diye']
  ];
  let peKind='in';
  function opts(list,bal,label){
    return list.slice().sort((a,b)=>Math.abs(bal(b))-Math.abs(bal(a))).map(x=>`<option value="${x.id}">${esc(x.name)} — ${label(bal(x))}</option>`).join('');
  }
  function partyLabel(b){return b>=1?'baqi '+fmtRs(b):b<=-1?'advance '+fmtRs(-b):'saaf';}
  function supLabel(b){return b>=1?'dena '+fmtRs(b):b<=-1?'advance '+fmtRs(-b):'saaf';}
  window.openPaisaEntry=function(kind,pid,sid){
    if(kind)peKind=kind;
    let m=document.getElementById('hkPeModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkPeModal';
      m.innerHTML=`<div class="modal-box" style="max-width:460px;"><div class="modal-head"><span>💳 Paisa Entry</span> <button class="modal-close" onclick="closeModal('hkPeModal')">✕</button></div><div class="modal-body" id="hkPeB"></div></div>`;
      document.body.appendChild(m);
    }
    let showParty=peKind!=='out',showSup=peKind==='out'||peKind==='lag',showAcc=peKind!=='lag';
    document.getElementById('hkPeB').innerHTML=`
      <div class="hk-pe-kinds">${KINDS.map(([k,i,l])=>`<button type="button" class="hk-pe-kind ${k===peKind?'on':''}" onclick="openPaisaEntry('${k}')"><span>${i}</span>${l}</button>`).join('')}</div>
      ${showParty?`<div class="form-group"><label class="form-label">👤 Gahak</label>${parties.length?`<select class="form-select" id="hkPeParty" onchange="hkPeShow()">${opts(parties,getPartyBalance,partyLabel)}</select>`:'<p class="hk-auto-help">Pehle party add karein</p>'}</div>`:''}
      ${showSup?`<div class="form-group"><label class="form-label">🪵 Supplier</label>${suppliers.length?`<select class="form-select" id="hkPeSup" onchange="hkPeShow()">${opts(suppliers,hkSupplierBalance,supLabel)}</select>`:'<p class="hk-auto-help">Pehle supplier add karein</p>'}</div>`:''}
      <div class="form-group"><label class="form-label">💰 Raqam</label><input class="form-input hk-pe-amt" type="number" inputmode="numeric" id="hkPeAmt" oninput="hkPeShow()" placeholder="0">
        <div class="hk-pe-chips">${[[1e4,'+10 hazar'],[1e5,'+1 lakh'],[1e6,'+10 lakh'],[1e7,'+1 crore']].map(([v,l])=>`<button type="button" onclick="let i=document.getElementById('hkPeAmt');i.value=(parseFloat(i.value)||0)+${v};hkPeShow()">${l}</button>`).join('')}<button type="button" onclick="document.getElementById('hkPeAmt').value='';hkPeShow()">✕</button></div>
        <div id="hkPeW" class="hk-k2-w"></div></div>
      <div class="hk-pe-row">
        <div class="form-group"><label class="form-label">📅 Tareekh</label><input class="form-input" type="date" id="hkPeDate" value="${today()}"></div>
        ${showAcc?`<div class="form-group"><label class="form-label">🏦 Kahan</label><select class="form-select" id="hkPeAcc">${BANK_ACCOUNTS.map(b=>`<option>${b}</option>`).join('')}</select></div>`:''}
      </div>
      <div class="form-group"><label class="form-label">📝 Note</label><input class="form-input" id="hkPeNote" placeholder="Optional"></div>
      <div id="hkPeAfter" class="hk-pe-after"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;" onclick="savePaisaEntry()">💾 Save</button>`;
    if(pid!=null&&document.getElementById('hkPeParty'))document.getElementById('hkPeParty').value=pid;
    if(sid!=null&&document.getElementById('hkPeSup'))document.getElementById('hkPeSup').value=sid;
    hkPeShow();
    if(!m.classList.contains('open'))openModal('hkPeModal');
  };
  // Live preview: what each khata will show after saving.
  window.hkPeShow=function(){
    let amt=num(document.getElementById('hkPeAmt')?.value);
    let w=document.getElementById('hkPeW');if(w)w.textContent=words(amt);
    let p=getPartyById(parseInt(document.getElementById('hkPeParty')?.value));
    let sp=suppliers.find(x=>String(x.id)===String(document.getElementById('hkPeSup')?.value));
    let out=[];
    let pl=(name,b)=>b>=1?`${esc(name)} ne dene: <b>${fmtRs(b)}</b>`:b<=-1?`${esc(name)} ko dene: <b>${fmtRs(-b)}</b>`:`${esc(name)}: <b>saaf ✅</b>`;
    let sl=(name,b)=>b>=1?`${esc(name)} ko dene: <b>${fmtRs(b)}</b>`:b<=-1?`${esc(name)} ne dene: <b>${fmtRs(-b)}</b>`:`${esc(name)}: <b>saaf ✅</b>`;
    if(p&&peKind!=='out')out.push(pl(p.name,getPartyBalance(p)+(peKind==='back'?amt:-amt)));
    if(sp&&(peKind==='out'||peKind==='lag'))out.push(sl(sp.name,hkSupplierBalance(sp)-amt));
    let a=document.getElementById('hkPeAfter');
    if(a)a.innerHTML=amt>0&&out.length?'Save ke baad → '+out.join(' · '):'';
  };
  window.savePaisaEntry=function(){
    let g=id=>document.getElementById(id)?.value;
    let amt=num(g('hkPeAmt')),date=g('hkPeDate')||today(),acc=g('hkPeAcc')||'Cash',note=g('hkPeNote')||'';
    let pid=parseInt(g('hkPeParty')),sid=parseInt(g('hkPeSup'));
    if(amt<=0){showToast('⚠️ Raqam likhein');return;}
    let fill=(m)=>Object.entries(m).forEach(([id,v])=>{let e=document.getElementById(id);if(e)e.value=v;});
    closeModal('hkPeModal');
    if(peKind==='in'){
      if(!getPartyById(pid))return showToast('⚠️ Gahak chunein');
      openReceivePaymentModal(pid);fill({payAmount:amt,payDate:date,payMethod:acc,payNote:note});addPartyPayment();
    }else if(peKind==='out'){
      if(!suppliers.some(x=>x.id===sid))return showToast('⚠️ Supplier chunein');
      openSupplierPayment(sid);fill({supPayAmt:amt,supPayDate:date,supPayAcc:acc,supPayNote:note});saveSupplierPayment(sid);
    }else if(peKind==='lag'){
      if(!getPartyById(pid)||!suppliers.some(x=>x.id===sid))return showToast('⚠️ Gahak aur supplier chunein');
      openLagwao(pid,sid);fill({hkLagAmt:amt,hkLagDate:date,hkLagNote:note});saveLagwao();
    }else{
      if(!getPartyById(pid))return showToast('⚠️ Gahak chunein');
      openGivePayment(pid);fill({hkGiveAmt:amt,hkGiveDate:date,hkGiveMethod:acc,hkGiveNote:note});saveGivePayment(pid);
    }
    if(document.getElementById('hkPosModal')?.classList.contains('open'))openMyPosition();
    if(window.renderHome)renderHome();
  };

  // ════════ Home: the whole position at a glance ════════
  function homeCard(){
    let kp=document.getElementById('hmKpis');if(!kp)return;
    let el=document.getElementById('hkHomePos');
    if(typeof hkIsStaff==='function'&&hkIsStaff()){el&&el.remove();return;}
    let x=position();
    if(!parties.length&&!suppliers.length&&!bankTransactions.length){el&&el.remove();return;}
    let short=n=>{n=Math.abs(n);return n>=1e7?(n/1e7).toFixed(n>=1e8?0:2).replace(/\.?0+$/,'')+' cr':n>=1e5?(n/1e5).toFixed(1).replace(/\.0$/,'')+' lakh':fmtRs(n);};
    let html=`<button type="button" class="hk-hpos" onclick="openMyPosition()">
      <div class="hk-hpos-h">💼 Mera Kul Hisaab <span>›</span></div>
      <div class="hk-hpos-g">
        <div class="r"><small>📤 Dena</small><b>${short(x.dene)}</b></div>
        <div class="g"><small>💰 Mojood</small><b>${short(x.cash)}</b></div>
        <div class="b"><small>📥 Lena</small><b>${short(x.lene)}</b></div>
      </div>
      <div class="hk-hpos-n ${x.net<0?'neg':''}">Sab mila kar: ${x.net<0?'− ':''}${short(x.net)}</div>
    </button>`;
    if(el)el.outerHTML=html.replace('class="hk-hpos"','id="hkHomePos" class="hk-hpos"');
    else kp.insertAdjacentHTML('afterend',html.replace('class="hk-hpos"','id="hkHomePos" class="hk-hpos"'));
  }
  window.hkHomePos=homeCard;
  document.addEventListener('hk:ready',()=>{
    ['renderHome','renderDashboard'].forEach(n=>{
      let orig=window[n];
      if(orig)window[n]=function(){let r=orig.apply(this,arguments);try{homeCard();}catch(e){console.warn('home pos',e);}return r;};
    });
    // The home "Payment" button opens the one simple form.
    let b=document.querySelector('.hm-act[onclick="quickAddPayment()"]');
    if(b)b.setAttribute('onclick','openPaisaEntry()');
    homeCard();
  });
})();
