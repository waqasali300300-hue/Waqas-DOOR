// HK Wood Doors ERP — simple khata: who owes whom, at a glance
//   • Khata screen: three tiles (lene / dene / is mahine aaye), a search box,
//     filter chips (Sab / Lene / Dene / Saaf) and one clear line per party:
//     "Aap ne lene hain Rs.X" or "Aap ne dene hain Rs.X", last payment date.
//   • ✏️ Party edit on every card and inside the khata.
//   • Inside the khata: every payment in one list, each with ✏️ edit and 🗑.
//     Editing keeps the cash book line in step. A "lagwayi" payment (paid to a
//     supplier) keeps its amount; delete and enter it again to change it.
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function words(n){return window.hkRsWords?hkRsWords(n):'';}
  let kFilter='all',kSearch='';

  // ── Every payment of a party, wherever it is kept ──
  function payments(p){
    let list=[];
    getPartyOrders(p.id).forEach(o=>(o.payments||[]).forEach(x=>list.push({kind:'order',ref:o.orderNo||'',orderId:o.id,x,sign:-1})));
    (p.partyPayments||[]).forEach(x=>list.push({kind:'party',ref:'Purana baqaya',x,sign:-1}));
    (p.paidOut||[]).forEach(x=>list.push({kind:'out',ref:'Party ko diye',x,sign:1}));
    return list.sort((a,b)=>String(b.x.date).localeCompare(String(a.x.date)));
  }
  window.hkPartyPayments=payments;
  function lastIn(p){
    let d='';payments(p).forEach(e=>{if(e.sign<0&&String(e.x.date)>d)d=String(e.x.date);});return d;
  }
  function daysAgo(d){if(!d)return '';let n=Math.round((new Date(today())-new Date(d))/864e5);return n<=0?'aaj':n===1?'kal':n+' din pehle';}
  function status(b){
    if(b>=1)return {cls:'lene',icon:'📥',text:'Aap ne lene hain',amt:b};
    if(b<=-1)return {cls:'dene',icon:'📤',text:'Aap ne dene hain',amt:-b};
    return {cls:'saaf',icon:'✅',text:'Hisaab saaf',amt:0};
  }

  // ── Khata screen ──
  let origRender=window.renderKhata;
  window.renderKhata=function(){
    let r=origRender.apply(this,arguments);
    try{draw();}catch(e){console.warn('khata3',e);}
    return r;
  };
  function draw(){
    let content=document.getElementById('khataContent'),sum=document.getElementById('khataSummary');
    if(!content||!sum)return;
    let sel=document.getElementById('khataPartyFilter');if(sel)sel.style.display='none';
    let all=parties.map(p=>({p,b:getPartyBalance(p)}));
    let lene=all.filter(x=>x.b>=1),dene=all.filter(x=>x.b<=-1),saaf=all.filter(x=>Math.abs(x.b)<1);
    let supDene=suppliers.reduce((s,x)=>s+Math.max(0,window.hkSupplierBalance?hkSupplierBalance(x):0),0);
    let m=today().slice(0,7),aaye=0;
    parties.forEach(p=>payments(p).forEach(e=>{if(e.sign<0&&String(e.x.date).startsWith(m))aaye+=num(e.x.amount);}));
    let staff=typeof hkIsStaff==='function'&&hkIsStaff();
    sum.className='hk-k3-sum';sum.removeAttribute('style');
    sum.innerHTML=`
      <button class="hk-k3-tile lene" onclick="hkKhataFilter('lene')"><small>📥 Lene hain (${lene.length})</small><b>${fmtRs(lene.reduce((s,x)=>s+x.b,0))}</b></button>
      <button class="hk-k3-tile dene" onclick="hkKhataFilter('dene')"><small>📤 Dene hain (${dene.length})</small><b>${fmtRs(-dene.reduce((s,x)=>s+x.b,0))}</b></button>
      <button class="hk-k3-tile aaye" onclick="hkKhataFilter('all')"><small>💵 Is mahine aaye</small><b>${fmtRs(aaye)}</b></button>
      <div class="hk-k3-bar">
        <input class="form-input" id="hkK3Search" placeholder="🔍 Naam ya phone se dhoondein" value="${esc(kSearch)}" oninput="hkKhataSearch(this.value)">
        ${window.openPaisaEntry?`<button class="btn btn-success btn-sm" onclick="openPaisaEntry()">💳 Paisa Entry</button>`:''}
        <button class="btn btn-outline btn-sm" onclick="openPartyModal()">➕ Party</button>
      </div>
      <div class="hk-k3-chips">${[['all','Sab',all.length],['lene','📥 Lene',lene.length],['dene','📤 Dene',dene.length],['saaf','✅ Saaf',saaf.length]]
        .map(([k,l,n])=>`<button class="${kFilter===k?'on':''}" onclick="hkKhataFilter('${k}')">${l} <span>${n}</span></button>`).join('')}</div>
      ${supDene>=1&&!staff&&kFilter==='dene'?`<button class="hk-k3-sup" onclick="switchTab('tabSuppliers')">🪵 Suppliers ko bhi dene hain: <b>${fmtRs(supDene)}</b> ›</button>`:''}`;
    let q=kSearch.trim().toLowerCase(),qd=q.replace(/\D/g,'');
    let shown=all.filter(x=>kFilter==='all'||(kFilter==='lene'&&x.b>=1)||(kFilter==='dene'&&x.b<=-1)||(kFilter==='saaf'&&Math.abs(x.b)<1))
      .filter(x=>!q||String(x.p.name).toLowerCase().includes(q)||(qd&&String(x.p.phone||'').replace(/\D/g,'').includes(qd)))
      .sort((a,b)=>Math.abs(b.b)-Math.abs(a.b));
    if(!shown.length){content.innerHTML=`<div class="empty-state"><div class="e-icon">📒</div><p>${parties.length?'Is mein koi party nahi':'Abhi koi party nahi — "➕ Party" dabayein'}</p></div>`;return;}
    content.innerHTML=shown.map(({p,b})=>{
      let s=status(b),os=getPartyOrders(p.id);
      let bill=num(p.openingBalance)+os.reduce((t,o)=>t+num(o.orderTotal),0)+((p.oldEntries)||[]).reduce((t,e)=>t+num(e.debit),0);
      let got=os.reduce((t,o)=>t+getOrderTotalPaid(o),0)+(p.partyPayments||[]).reduce((t,x)=>t+num(x.amount),0);
      let last=lastIn(p);
      return `<div class="khata-card hk-k3-card ${s.cls}">
        <div class="hk-k3-top"><div><b class="hk-k3-name">${esc(p.name)}</b><small>${[p.phone,p.area].filter(Boolean).map(esc).join(' · ')}</small></div>
          <button class="btn btn-outline btn-xs" onclick="openPartyModal(${p.id})">✏️ Edit</button></div>
        <div class="hk-k3-status ${s.cls}"><span>${s.icon} ${s.text}</span>${s.amt?`<b>${fmtRs(s.amt)}</b>`:''}</div>
        ${s.amt>=1e5?`<div class="hk-k2-w" style="text-align:right;">${words(s.amt)}</div>`:''}
        <div class="hk-k3-meta">Kul bill ${fmtRs(bill)} · Aaye ${fmtRs(got)} · ${os.length} order${last?` · Akhri payment ${esc(last)} (${daysAgo(last)})`:''}</div>
        <div class="hk-k3-btns">
          <button class="btn btn-success btn-xs" onclick="openReceivePaymentModal(${p.id})">💵 Payment Aayi</button>
          <button class="btn btn-primary btn-xs" onclick="openPartyLedger(${p.id})">📖 Khata</button>
          ${b>=1&&p.phone?`<button class="btn btn-outline btn-xs" onclick="sendWhatsAppReminder(${p.id})">💬 Yaad dahani</button>`:''}
          <button class="btn btn-outline btn-xs" onclick="openOldKhata(${p.id})">📒 Purana Hisaab</button>
        </div></div>`;
    }).join('');
  }
  window.hkKhataFilter=function(f){kFilter=f;draw();};
  window.hkKhataSearch=function(v){
    kSearch=v;draw();
    let i=document.getElementById('hkK3Search');if(i){i.focus();i.setSelectionRange(v.length,v.length);}
  };

  // ── Inside the khata: edit button, clear words, all payments ──
  let origLedger=window.openPartyLedger;
  window.openPartyLedger=function(pid){
    let r=origLedger.apply(this,arguments);
    try{
      let p=getPartyById(pid),body=document.getElementById('partyLedgerModalBody');if(!p||!body)return r;
      let t=document.querySelector('#hkK2 .hk-k2-title');
      if(t&&!t.querySelector('.hk-k3-edit'))t.insertAdjacentHTML('beforeend',` <button class="btn btn-outline btn-xs hk-k3-edit" onclick="openPartyModal(${pid})">✏️ Party edit</button>`);
      // Plain words for the table.
      body.querySelectorAll('thead th').forEach(th=>{
        let w={Debit:'Bill / Diye (+)',Credit:'Aaye (−)',Balance:'Baqi'}[th.textContent.trim()];if(w)th.textContent=w;
      });
      body.querySelectorAll('strong').forEach(st=>{
        if(st.textContent.trim()==='Current Balance'){let s=status(getPartyBalance(p));st.textContent=s.icon+' '+s.text;}
      });
      // All payments with edit / delete.
      document.getElementById('hkK3Pays')?.remove();
      let list=payments(p);
      let k2=document.getElementById('hkK2');
      let html=`<div class="hk-k2" id="hkK3Pays"><div class="hk-k2-title">💵 Payments (${list.length})</div>
        ${list.length?list.map(e=>`<div class="hk-k3-pay"><span><b class="${e.sign<0?'in':'out'}">${e.sign<0?'−':'+'} ${fmtRs(e.x.amount)}</b>
          <small>${esc(e.x.date||'')} · ${esc(e.x.method||'Cash')} · ${esc(e.ref)}${e.x.note?' · '+esc(e.x.note):''}</small></span>
          <button class="btn btn-outline btn-xs" onclick="hkEditPayment(${pid},'${e.kind}',${e.orderId||0},${e.x.id})">✏️</button>
          <button class="btn btn-outline btn-xs" onclick="hkDeletePayment(${pid},'${e.kind}',${e.orderId||0},${e.x.id})">🗑</button></div>`).join('')
          :'<div class="hk-auto-help">Abhi koi payment nahi</div>'}</div>`;
      if(k2)k2.insertAdjacentHTML('afterend',html);else body.insertAdjacentHTML('afterbegin',html);
    }catch(e){console.warn('khata3 ledger',e);}
    return r;
  };
  function find(pid,kind,orderId,id){
    let p=getPartyById(pid);if(!p)return null;
    let arr=kind==='order'?(orders.find(o=>o.id==orderId)||{}).payments:kind==='party'?p.partyPayments:p.paidOut;
    let x=(arr||[]).find(y=>y.id==id);
    return x?{p,arr,x}:null;
  }
  function refresh(pid){
    saveAll();renderAll();
    if(document.getElementById('partyLedgerModal')?.classList.contains('open'))openPartyLedger(pid);
  }
  window.hkEditPayment=function(pid,kind,orderId,id){
    let f=find(pid,kind,orderId,id);if(!f)return;
    let x=f.x,linked=!!x.linkId;
    let m=document.getElementById('hkPayEdit');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkPayEdit';
      m.innerHTML=`<div class="modal-box" style="max-width:400px;"><div class="modal-head"><span>✏️ Payment theek karein</span> <button class="modal-close" onclick="closeModal('hkPayEdit')">✕</button></div><div class="modal-body" id="hkPayEditB"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById('hkPayEditB').innerHTML=`
      <div class="form-group"><label class="form-label">Raqam</label><input class="form-input hk-pe-amt" type="number" id="hkPeEAmt" value="${num(x.amount)}" ${linked?'disabled':''} oninput="document.getElementById('hkPeEW').textContent=hkRsWords(this.value)"><small id="hkPeEW" class="hk-k2-w">${words(x.amount)}</small>
        ${linked?'<small class="hk-k2-w">Ye payment supplier ko lagwayi thi — raqam badalni ho to mita kar dobara dalein.</small>':''}</div>
      <div class="form-group"><label class="form-label">Tareekh</label><input class="form-input" type="date" id="hkPeEDate" value="${esc(x.date||today())}"></div>
      ${linked?'':`<div class="form-group"><label class="form-label">Kahan</label><select class="form-select" id="hkPeEAcc">${BANK_ACCOUNTS.map(b=>`<option ${b===(x.method||'Cash')?'selected':''}>${b}</option>`).join('')}</select></div>`}
      <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="hkPeENote" value="${esc(x.note||'')}"></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;" onclick="hkSavePaymentEdit(${pid},'${kind}',${orderId||0},${id})">💾 Save</button>`;
    openModal('hkPayEdit');
  };
  window.hkSavePaymentEdit=function(pid,kind,orderId,id){
    let f=find(pid,kind,orderId,id);if(!f)return;
    let x=f.x,g=i=>document.getElementById(i);
    if(!x.linkId){
      let amt=num(g('hkPeEAmt')?.value);
      if(amt<=0){showToast('⚠️ Raqam likhein');return;}
      x.amount=amt;x.method=g('hkPeEAcc')?.value||x.method;
    }
    x.date=g('hkPeEDate')?.value||x.date;x.note=g('hkPeENote')?.value||'';
    let tx=x.bankTxId&&bankTransactions.find(t=>t.id===x.bankTxId);
    if(tx){tx.amount=num(x.amount);tx.date=x.date;if(x.method)tx.account=x.method;}
    f.p.updatedAt=new Date().toISOString();
    closeModal('hkPayEdit');refresh(pid);showToast('✅ Payment theek ho gayi — naya baqaya '+fmtRs(getPartyBalance(f.p)));
  };
  window.hkDeletePayment=function(pid,kind,orderId,id){
    let f=find(pid,kind,orderId,id);if(!f)return;
    let x=f.x;
    customConfirm(`${fmtRs(x.amount)} (${x.date||''}) wali payment mita dein?${x.linkId?' Supplier ke khate se bhi hat jayegi.':''}`,()=>{
      if(x.linkId){
        parties.forEach(p=>{
          if(p.partyPayments)p.partyPayments=p.partyPayments.filter(y=>y.linkId!==x.linkId);
          getPartyOrders(p.id).forEach(o=>{if(o.payments)o.payments=o.payments.filter(y=>y.linkId!==x.linkId);});
        });
        suppliers.forEach(s=>{if(s.payments)s.payments=s.payments.filter(y=>y.linkId!==x.linkId);});
      }else{
        let i=f.arr.indexOf(x);if(i>=0)f.arr.splice(i,1);
        if(x.bankTxId)bankTransactions=bankTransactions.filter(t=>t.id!==x.bankTxId);
      }
      f.p.updatedAt=new Date().toISOString();
      refresh(pid);showToast('🗑 Payment mit gayi — naya baqaya '+fmtRs(getPartyBalance(f.p)));
    },{title:'💵 Payment',okText:'Mitayein'});
  };
  // Party saved from inside the khata: show the new details.
  let origSaveParty=window.saveParty;
  window.saveParty=function(){
    let r=origSaveParty.apply(this,arguments);
    try{
      let open=document.getElementById('partyLedgerModal')?.classList.contains('open');
      let pid=document.querySelector('#hkK2 .hk-k3-edit')?.getAttribute('onclick')?.match(/\d+/)?.[0];
      if(open&&pid&&!document.getElementById('partyModal')?.classList.contains('open'))openPartyLedger(parseInt(pid));
    }catch(e){}
    return r;
  };
})();
