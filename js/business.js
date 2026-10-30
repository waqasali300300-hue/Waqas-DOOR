// HK Wood Doors ERP — day-to-day business tools
//   • Supplier khata: udhaar purchases, payments to suppliers, ledger + PDF/WhatsApp
//   • Delivery date on orders, with due/late alerts on Home and badges on order lists
//   • WhatsApp receipt right after a payment is received
//   • Day close (Aaj ka hisaab): today's sale, money in/out, cash in hand
//   • Wood buy list: how much wood running orders still need, sent to a supplier
//   • Pay karigar in one step from Home
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function waPhone(phone){let p=String(phone||'').replace(/[^0-9]/g,'');if(p.startsWith('0'))p='92'+p.slice(1);return p;}
  function openWA(phone,msg){window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(msg)}`,'_blank');}
  function modal(id,title,html,wide){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:${wide?640:480}px;"><div class="modal-head"><span id="${id}Title"></span> <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}Body"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById(id+'Title').textContent=title;
    document.getElementById(id+'Body').innerHTML=html;
    if(!m.classList.contains('open'))openModal(id);
  }
  function pdfFromHTML(html,elId,filename){
    let temp=document.createElement('div');
    temp.innerHTML=html;
    temp.style.cssText='position:fixed;left:0;top:0;width:800px;background:#fff;z-index:150;pointer-events:none;';
    document.body.appendChild(temp);
    return downloadPDF(elId,filename).finally(()=>temp.remove());
  }
  function purchaseAmount(p){return num(p.total)||num(p.qty)*num(p.rate);}

  // ════════ Supplier khata ════════
  function supplierEntries(s){
    let e=[];
    if(num(s.openingBalance))e.push({date:(s.createdAt||'').slice(0,10)||'—',type:'Pichhla baqaya',ref:'',took:Math.max(0,num(s.openingBalance)),paid:Math.max(0,-num(s.openingBalance))});
    purchases.filter(p=>p.supplierId==s.id&&p.account==='udhaar').forEach(p=>e.push({date:p.date,type:'Udhaar khareed: '+(p.item||''),ref:p.purchaseNo||'',took:purchaseAmount(p),paid:0}));
    (s.payments||[]).forEach(p=>e.push({date:p.date,type:'Payment ('+(p.account||'Cash')+')'+(p.note?' — '+p.note:''),ref:'',took:0,paid:num(p.amount),payId:p.id}));
    e.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    let run=0;e.forEach(x=>{run+=x.took-x.paid;x.balance=run;});
    return e;
  }
  function supplierBalance(s){let e=supplierEntries(s);return e.length?e[e.length-1].balance:0;}
  window.hkSupplierBalance=supplierBalance;

  // Supplier payments go to the cash book as money out.
  (window.hkCashbookSources=window.hkCashbookSources||[]).push(want=>{
    suppliers.forEach(s=>(s.payments||[]).forEach(p=>{
      if(num(p.amount)<=0)return;
      want.set('sup:'+p.id,{type:'withdrawal',account:p.account||'Cash',amount:num(p.amount),date:p.date,description:'Supplier payment: '+s.name});
    }));
  });

  // Supplier list: balance + buttons on every card.
  let origRenderSuppliers=window.renderSuppliers;
  window.renderSuppliers=function(){
    origRenderSuppliers.apply(this,arguments);
    let list=document.getElementById('suppliersList');if(!list)return;
    let q=document.getElementById('supplierSearch')?.value?.toLowerCase()||'';
    let shown=suppliers.filter(s=>s.name.toLowerCase().includes(q)||(s.phone||'').includes(q));
    let total=suppliers.reduce((t,s)=>t+Math.max(0,supplierBalance(s)),0);
    list.querySelectorAll('.khata-card').forEach((card,i)=>{
      let s=shown[i];if(!s)return;
      let bal=supplierBalance(s);
      card.insertAdjacentHTML('beforeend',`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:6px;flex-wrap:wrap;">
        <b style="color:${bal>0?'#b91c1c':'#16a34a'};font-size:11px;">${bal>0?'Dena hai '+fmtRs(bal):bal<0?'Advance diya '+fmtRs(-bal):'Hisaab saaf ✅'}</b>
        <span style="display:flex;gap:4px;"><button class="btn btn-success btn-xs" onclick="openSupplierPayment(${s.id})">💵 Payment</button><button class="btn btn-outline btn-xs" onclick="openSupplierLedger(${s.id})">📖 Khata</button></span></div>`);
    });
    if(!document.getElementById('hkSupTotal')&&suppliers.length){
      list.insertAdjacentHTML('afterbegin',`<div id="hkSupTotal" class="hm-card" style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:12px;font-weight:700;">Suppliers ko kul dena hai</span><b style="font-family:var(--font-mono);color:#b91c1c;">${fmtRs(total)}</b></div>`);
    }
  };

  window.openSupplierPayment=function(id){
    let s=suppliers.find(x=>x.id===id);if(!s)return;
    let bal=supplierBalance(s);
    modal('hkSupPayModal','💵 Payment — '+s.name,`
      <div style="font-size:11px;margin-bottom:8px;">Abhi baqaya: <b style="color:${bal>0?'#b91c1c':'#16a34a'};">${fmtRs(bal)}</b></div>
      <div class="form-group"><label class="form-label">Kitni payment di</label><input class="form-input" type="number" id="supPayAmt" value="${bal>0?Math.round(bal):''}"></div>
      <div class="form-group"><label class="form-label">Tareekh</label><input class="form-input" type="date" id="supPayDate" value="${today()}"></div>
      <div class="form-group"><label class="form-label">Kahan se di</label><select class="form-select" id="supPayAcc">${BANK_ACCOUNTS.map(b=>`<option>${b}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="supPayNote" placeholder="Optional"></div>
      <button class="btn btn-success" style="width:100%;justify-content:center;" onclick="saveSupplierPayment(${s.id})">💾 Payment Save Karein</button>`);
  };
  window.saveSupplierPayment=function(id){
    let s=suppliers.find(x=>x.id===id);if(!s)return;
    let amount=num(document.getElementById('supPayAmt').value);
    if(amount<=0){showToast('⚠️ Amount likhein');return;}
    s.payments=s.payments||[];
    s.payments.push({id:newId(),amount,date:document.getElementById('supPayDate').value||today(),account:document.getElementById('supPayAcc').value,note:document.getElementById('supPayNote').value||'',user:activeUserId});
    saveAll();closeModal('hkSupPayModal');renderSuppliers();
    showToast(`✅ ${s.name} ko ${fmtRs(amount)} — Cash book mein bhi likh diya`);
  };
  window.deleteSupplierPayment=function(sid,pid){
    let s=suppliers.find(x=>x.id===sid);if(!s)return;
    customConfirm('Yeh payment delete karein?',()=>{
      s.payments=(s.payments||[]).filter(p=>p.id!==pid);
      saveAll();openSupplierLedger(sid);renderSuppliers();
    });
  };
  window.openSupplierLedger=function(id){
    let s=suppliers.find(x=>x.id===id);if(!s)return;
    let e=supplierEntries(s),bal=supplierBalance(s);
    modal('hkSupLedgerModal','📖 '+s.name+' — Khata',`
      <div style="font-size:9.5px;color:var(--gray-500);margin-bottom:6px;">Udhaar khareed yahan aati hai (khareed form mein "Udhaar" chunein). Payment cash book se bhi kat jati hai.</div>
      <div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:10px;">
        <thead><tr style="background:var(--primary);color:#fff;"><th style="padding:5px;text-align:left;">Date</th><th style="padding:5px;text-align:left;">Detail</th><th style="padding:5px;text-align:right;">Liya</th><th style="padding:5px;text-align:right;">Diya</th><th style="padding:5px;text-align:right;">Baqaya</th><th></th></tr></thead>
        <tbody>${e.map(x=>`<tr style="border-bottom:1px solid var(--border);"><td style="padding:5px;white-space:nowrap;">${esc(x.date)}</td><td style="padding:5px;">${esc(x.type)}</td><td style="padding:5px;text-align:right;">${x.took?fmtRs(x.took):''}</td><td style="padding:5px;text-align:right;color:#16a34a;">${x.paid?fmtRs(x.paid):''}</td><td style="padding:5px;text-align:right;font-weight:700;">${fmtRs(x.balance)}</td><td>${x.payId?`<button class="btn btn-danger btn-xs" onclick="deleteSupplierPayment(${s.id},${x.payId})">🗑</button>`:''}</td></tr>`).join('')||'<tr><td colspan="6" style="padding:12px;text-align:center;color:var(--gray-500);">Abhi koi entry nahi</td></tr>'}</tbody>
      </table></div>
      <div style="display:flex;justify-content:space-between;margin:10px 0;padding:10px;border-radius:8px;background:var(--gray-50);font-weight:700;"><span>Kul baqaya</span><span style="color:${bal>0?'#b91c1c':'#16a34a'};">${fmtRs(bal)}</span></div>
      <div class="form-group"><label class="form-label">Pichhla baqaya (is app se pehle ka)</label><input class="form-input" type="number" id="supOpening" value="${num(s.openingBalance)||''}" placeholder="0" onchange="setSupplierOpening(${s.id},this.value)"></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-success btn-sm" onclick="openSupplierPayment(${s.id})">💵 Payment</button>
        <button class="btn btn-gold btn-sm" onclick="downloadSupplierLedgerPDF(${s.id})">📄 PDF / Share</button>
        ${s.phone?`<button class="btn btn-outline btn-sm" onclick="sendSupplierWA(${s.id})">💬 WhatsApp</button>`:''}
      </div>`,true);
  };
  window.setSupplierOpening=function(id,v){
    let s=suppliers.find(x=>x.id===id);if(!s)return;
    s.openingBalance=num(v);saveAll();openSupplierLedger(id);renderSuppliers();
  };
  window.downloadSupplierLedgerPDF=function(id){
    let s=suppliers.find(x=>x.id===id);if(!s)return;
    let td='padding:6px 8px;border:1px solid #e2e8f0;';
    let e=supplierEntries(s);
    pdfFromHTML(`<div id="hkSupPdf" style="font-family:sans-serif;padding:24px;background:#fff;color:#111;">
      <div style="text-align:center;border-bottom:2px solid #c8963e;padding-bottom:10px;margin-bottom:14px;"><h1 style="font-size:22px;margin:0;">${esc(businessProfile.name||'')}</h1><h2 style="font-size:16px;margin:8px 0 0;">Supplier Khata — ${esc(s.name)}</h2><p style="font-size:11px;color:#666;">${new Date().toLocaleDateString('en-PK')}</p></div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#1a3a6a;color:#fff;"><th style="${td}">Date</th><th style="${td}text-align:left;">Detail</th><th style="${td}text-align:right;">Liya</th><th style="${td}text-align:right;">Diya</th><th style="${td}text-align:right;">Baqaya</th></tr></thead>
      <tbody>${e.map((x,i)=>`<tr style="background:${i%2?'#f4f7fb':'#fff'};"><td style="${td}">${esc(x.date)}</td><td style="${td}">${esc(x.type)}</td><td style="${td}text-align:right;">${x.took?fmtRs(x.took):''}</td><td style="${td}text-align:right;">${x.paid?fmtRs(x.paid):''}</td><td style="${td}text-align:right;font-weight:700;">${fmtRs(x.balance)}</td></tr>`).join('')}</tbody></table>
      <p style="text-align:right;font-size:14px;font-weight:700;margin-top:12px;">Kul baqaya: ${fmtRs(supplierBalance(s))}</p></div>`,'hkSupPdf',`Supplier_${s.name.replace(/\s+/g,'_')}.pdf`);
  };
  window.sendSupplierWA=function(id){
    let s=suppliers.find(x=>x.id===id);if(!s||!s.phone)return;
    openWA(s.phone,`Assalam-o-Alaikum ${s.name},\n${businessProfile.name||''} ki taraf se hisaab: aap ka baqaya ${fmtRs(supplierBalance(s))} hai.\nShukriya.`);
  };

  // ════════ Delivery date ════════
  let origOpenOrderModal=window.openOrderModal;
  window.openOrderModal=function(orderId){
    let r=origOpenOrderModal.apply(this,arguments);
    try{
      let dateEl=document.getElementById('orderDate');
      let group=dateEl&&dateEl.closest('.form-group');
      if(group&&!document.getElementById('orderDeliveryDate')){
        let o=orderId?orders.find(x=>x.id===orderId):null;
        group.insertAdjacentHTML('afterend',`<div class="form-group"><label class="form-label">🚚 Delivery kab deni hai</label><input class="form-input" type="date" id="orderDeliveryDate" value="${o&&o.deliveryDate?esc(o.deliveryDate):''}"></div>`);
      }
    }catch(e){}
    return r;
  };
  let origSaveOrder=window.saveOrder;
  window.saveOrder=function(){
    let editingId=editingOrderId,before=orders.length;
    let dd=document.getElementById('orderDeliveryDate')?.value;
    let r=origSaveOrder.apply(this,arguments);
    if(document.getElementById('orderModal')?.classList.contains('open'))return r;
    let o=editingId?orders.find(x=>x.id===editingId):(orders.length>before?orders[orders.length-1]:null);
    if(o&&dd!==undefined&&o.deliveryDate!==dd){o.deliveryDate=dd||'';saveAll();renderAll();}
    return r;
  };
  function deliveryInfo(o){
    if(!o.deliveryDate||o.status==='delivered')return null;
    let days=Math.round((new Date(o.deliveryDate+'T00:00:00')-new Date(today()+'T00:00:00'))/86400000);
    if(days<0)return {cls:'late',text:`${-days} din late`};
    if(days===0)return {cls:'due',text:'Aaj deni hai'};
    if(days<=2)return {cls:'due',text:`${days} din baqi`};
    return {cls:'ok',text:'🚚 '+o.deliveryDate};
  }
  window.hkDeliveryInfo=deliveryInfo;
  // Badge on order cards in Orders and Production lists.
  function badgeLists(){
    ['ordersList','productionList'].forEach(id=>{
      document.querySelectorAll(`#${id} .order-card`).forEach(card=>{
        if(card.querySelector('.hk-dlv'))return;
        let no=card.querySelector('.order-no')?.textContent.trim();
        let o=no&&orders.find(x=>x.orderNo===no);
        let info=o&&deliveryInfo(o);
        if(info)card.querySelector('.order-meta')?.insertAdjacentHTML('beforeend',` <span class="hk-dlv ${info.cls}">${esc(info.text)}</span>`);
      });
    });
  }
  ['renderOrders','renderProduction'].forEach(n=>{
    let orig=window[n];
    window[n]=function(){let r=orig.apply(this,arguments);try{badgeLists();}catch(e){}return r;};
  });

  // ════════ Home alerts ════════
  (window.hkAttentionSources=window.hkAttentionSources||[]).push(()=>{
    let out=[];
    let late=orders.filter(o=>deliveryInfo(o)?.cls==='late');
    let due=orders.filter(o=>deliveryInfo(o)?.cls==='due');
    if(late.length)out.push({icon:'⏰',tone:'bad',text:`${late.length} order delivery mein late — ${late.map(o=>o.orderNo).slice(0,3).join(', ')}`,go:"switchTab('tabProduction')"});
    if(due.length)out.push({icon:'🚚',tone:'warn',text:`${due.length} order ki delivery 2 din mein — ${due.map(o=>o.orderNo).slice(0,3).join(', ')}`,go:"switchTab('tabProduction')"});
    let supDue=suppliers.reduce((t,s)=>t+Math.max(0,supplierBalance(s)),0);
    if(supDue>0)out.push({icon:'🏪',tone:'info',text:'Suppliers ko dena hai',amt:supDue,go:"switchTab('tabSuppliers')"});
    let short=woodShortfall().filter(r=>r.short>0);
    if(short.length)out.push({icon:'🪵',tone:'warn',text:`Lakri kam: ${short.map(r=>r.w.name+' '+r.short.toFixed(1)+' cft').slice(0,2).join(', ')}`,go:'openWoodBuyList()'});
    return out;
  });

  // ════════ WhatsApp receipt after a payment ════════
  function offerReceipt(party,amount,orderNo){
    if(!party)return;
    let bal=getPartyBalance(party);
    let msg=`Assalam-o-Alaikum ${party.name},\n${businessProfile.name||''} — aap ki payment ${fmtRs(amount)} wasool ho gayi${orderNo?' ('+orderNo+')':''}. Shukriya!\nBaqaya: ${fmtRs(Math.max(0,bal))}`;
    window._hkReceipt={phone:party.phone,msg};
    modal('hkReceiptModal','✅ Payment darj ho gayi',`
      <div style="text-align:center;margin-bottom:10px;"><div style="font-size:30px;">💵</div><div style="font-size:14px;font-weight:800;">${fmtRs(amount)}</div><div style="font-size:11px;color:var(--gray-500);">${esc(party.name)} · baqaya ${fmtRs(Math.max(0,bal))}</div></div>
      <pre style="white-space:pre-wrap;font-family:inherit;font-size:11px;background:var(--gray-50);padding:10px;border-radius:10px;">${esc(msg)}</pre>
      <div style="display:flex;gap:6px;margin-top:10px;">
        <button class="btn btn-outline" style="flex:1;justify-content:center;" onclick="closeModal('hkReceiptModal')">Nahi</button>
        ${party.phone?`<button class="btn btn-success" style="flex:1;justify-content:center;" onclick="openWA(window._hkReceipt.phone,window._hkReceipt.msg);closeModal('hkReceiptModal')">💬 WhatsApp Rasid</button>`:'<span style="flex:1;font-size:10px;color:var(--gray-500);align-self:center;">Party ka phone number nahi — Parties mein add karein</span>'}
      </div>`);
  }
  window.openWA=openWA;
  let origAddPayment=window.addPayment;
  window.addPayment=function(){
    let o=orders.find(x=>x.id===payingOrderId);
    let n=o?(o.payments||[]).length:0;
    let r=origAddPayment.apply(this,arguments);
    if(o&&(o.payments||[]).length>n)offerReceipt(getPartyById(o.partyId),num(o.payments[o.payments.length-1].amount),o.orderNo);
    return r;
  };
  if(window.addPartyPayment){
    let origAddPartyPayment=window.addPartyPayment;
    window.addPartyPayment=function(){
      let p=getPartyById(payingPartyId);
      let amt=num(document.getElementById('payAmount')?.value);
      let before=p?getPartyBalance(p):0;
      let r=origAddPartyPayment.apply(this,arguments);
      if(p&&getPartyBalance(p)<before)offerReceipt(p,amt,'');
      return r;
    };
  }

  // ════════ Day close ════════
  window.openDayClose=function(day){
    day=day||today();
    let sale=orders.filter(o=>o.date===day);
    let tx=bankTransactions.filter(t=>t.date===day);
    let byAcc={};
    tx.forEach(t=>{let a=byAcc[t.account]=byAcc[t.account]||{in:0,out:0};if(t.type==='deposit')a.in+=num(t.amount);else a.out+=num(t.amount);});
    let totIn=tx.filter(t=>t.type==='deposit').reduce((s,t)=>s+num(t.amount),0);
    let totOut=tx.filter(t=>t.type!=='deposit').reduce((s,t)=>s+num(t.amount),0);
    let cash=bankTransactions.filter(t=>t.account==='Cash'&&t.date<=day).reduce((s,t)=>s+(t.type==='deposit'?num(t.amount):-num(t.amount)),0);
    let kh=expenses.filter(e=>e.date===day).reduce((s,e)=>s+num(e.amount),0);
    let row=(l,v,c)=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;"><span>${l}</span><b style="${c?'color:'+c:''}">${v}</b></div>`;
    let msg=`${businessProfile.name||''} — ${day} ka hisaab\nNaye orders: ${sale.length} (${fmtRs(sale.reduce((s,o)=>s+num(o.orderTotal),0))})\nAaya: ${fmtRs(totIn)}\nGaya: ${fmtRs(totOut)}\nKharcha: ${fmtRs(kh)}\nCash haath mein: ${fmtRs(cash)}`;
    window._hkDayMsg=msg;
    modal('hkDayModal','📅 Aaj ka hisaab',`
      <input class="form-input" type="date" value="${day}" style="margin-bottom:8px;" onchange="openDayClose(this.value)">
      ${row(`🛒 Naye orders (${sale.length})`,fmtRs(sale.reduce((s,o)=>s+num(o.orderTotal),0)))}
      ${row('📥 Paisa aaya',fmtRs(totIn),'#16a34a')}
      ${row('📤 Paisa gaya',fmtRs(totOut),'#dc2626')}
      ${row('🧾 Kharcha',fmtRs(kh))}
      ${row('💵 Cash haath mein hona chahiye',fmtRs(cash),'var(--primary)')}
      ${Object.keys(byAcc).length?`<div style="font-size:10px;font-weight:700;margin:10px 0 4px;">Account ke hisaab se</div>${Object.entries(byAcc).map(([a,v])=>row(esc(a),`+${fmtRs(v.in)} / −${fmtRs(v.out)}`)).join('')}`:''}
      ${tx.length?`<div style="font-size:10px;font-weight:700;margin:10px 0 4px;">Aaj ki entries</div>${tx.map(t=>`<div style="font-size:10px;padding:4px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:6px;"><span>${t.type==='deposit'?'📥':'📤'} ${esc(t.description||'')}</span><b>${fmtRs(t.amount)}</b></div>`).join('')}`:'<p style="font-size:11px;color:var(--gray-500);margin-top:8px;">Is din cash book mein koi entry nahi.</p>'}
      <p style="font-size:9.5px;color:var(--gray-500);margin-top:8px;">Galle mein cash gin kar "Cash haath mein" se mila lein. Farq ho to koi entry reh gayi hai.</p>
      <button class="btn btn-success" style="width:100%;justify-content:center;margin-top:8px;" onclick="openWA(businessProfile.whatsapp||businessProfile.phone||'',window._hkDayMsg)">💬 Apne WhatsApp par bhejein</button>`);
  };

  // ════════ Wood buy list ════════
  function woodShortfall(){
    let running=orders.filter(o=>!['ready','delivered'].includes(o.status||'pending'));
    let need={};
    running.forEach(o=>(o.doors||[]).forEach(d=>{if(d.woodId)need[d.woodId]=(need[d.woodId]||0)+getDoorCft(d);}));
    // Stock figures already subtract every order, so "have" adds the running orders back:
    // have = stock before these orders; short = how far stock goes below zero.
    return woodTypes.map(w=>{let n=need[w.id]||0,left=getWoodStockRemaining(w);return {w,need:n,have:left+n,short:Math.max(0,-left)};}).filter(r=>r.need>0);
  }
  window.hkWoodShort=woodShortfall;
  window.openWoodBuyList=function(){
    let rows=woodShortfall(),short=rows.filter(r=>r.short>0);
    let withPhone=suppliers.filter(s=>s.phone);
    let msg=`Assalam-o-Alaikum,\n${businessProfile.name||''} ko yeh lakri chahiye:\n`+short.map(r=>`• ${r.w.name}: ${Math.ceil(r.short)} cft`).join('\n')+'\nRate aur delivery bata dein. Shukriya.';
    window._hkWoodMsg=msg;
    modal('hkWoodBuyModal','🪵 Lakri ki khareed list',`
      <p style="font-size:10px;color:var(--gray-500);margin-bottom:8px;">Jo orders abhi ban rahe hain (Ready/Delivered nahi) un ke liye lakri vs stock:</p>
      ${rows.length?rows.map(r=>`<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:11.5px;"><span><b>${esc(r.w.name)}</b><br><small style="color:var(--gray-500);">chahiye ${r.need.toFixed(1)} · stock ${r.have.toFixed(1)} cft</small></span><b style="color:${r.short>0?'#b91c1c':'#16a34a'};">${r.short>0?Math.ceil(r.short)+' cft khareedni hai':'✅ Kaafi hai'}</b></div>`).join(''):'<div class="hm-empty">Abhi koi order production mein nahi</div>'}
      ${short.length?`<div class="form-group" style="margin-top:10px;"><label class="form-label">Supplier ko bhejein</label><select class="form-select" id="woodBuySup">${withPhone.map(s=>`<option value="${esc(s.phone)}">${esc(s.name)}</option>`).join('')}<option value="">— Number khud chunein —</option></select></div>
      <button class="btn btn-success" style="width:100%;justify-content:center;" onclick="openWA(document.getElementById('woodBuySup').value,window._hkWoodMsg)">💬 WhatsApp par list bhejein</button>`:''}`);
  };

  // ════════ Pay karigar from Home ════════
  function karigarDues(){
    let map={};
    labours.forEach(l=>{let due=num(l.totalCost)-num(l.paid);if(due>0){let k=map[l.karigarId]=map[l.karigarId]||{id:l.karigarId,due:0,recs:[]};k.due+=due;k.recs.push(l);}});
    return Object.values(map).sort((a,b)=>b.due-a.due);
  }
  window.openKarigarPay=function(){
    let list=karigarDues();
    modal('hkKarPayModal','🔧 Karigaron ko payment',list.length?list.map(k=>`
      <div style="padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;font-size:12px;"><b>${esc(getKarigarName(k.id))}</b><b style="color:#b91c1c;">${fmtRs(k.due)}</b></div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input class="form-input" type="number" id="kpAmt_${k.id}" value="${Math.round(k.due)}" style="flex:1;">
          <select class="form-select" id="kpAcc_${k.id}" style="width:auto;">${BANK_ACCOUNTS.map(b=>`<option>${b}</option>`).join('')}</select>
          <button class="btn btn-success btn-sm" onclick="payKarigar(${JSON.stringify(k.id)})">💵 Do</button>
        </div></div>`).join(''):'<div class="hm-empty">✅ Kisi karigar ka baqaya nahi</div>');
  };
  // Pays the oldest unpaid labour records first; each record's cash book line
  // is kept in step the same way the Labour screen does it.
  window.payKarigar=function(kid){
    let amt=num(document.getElementById('kpAmt_'+kid)?.value);
    let acc=document.getElementById('kpAcc_'+kid)?.value||'Cash';
    if(amt<=0){showToast('⚠️ Amount likhein');return;}
    let recs=labours.filter(l=>String(l.karigarId)===String(kid)&&num(l.totalCost)>num(l.paid)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    let left=amt,name=getKarigarName(kid);
    recs.forEach(l=>{
      if(left<=0)return;
      let pay=Math.min(left,num(l.totalCost)-num(l.paid));
      l.paid=num(l.paid)+pay;l.paidAccount=acc;left-=pay;
      let o=orders.find(x=>x.id===l.orderId);
      let desc=`Labour payment to ${name}${o?' ('+o.orderNo+')':''}`;
      let tx=l.bankTxId&&bankTransactions.find(t=>t.id===l.bankTxId);
      if(tx){tx.amount=l.paid;tx.account=acc;tx.date=today();tx.description=desc;}
      else{let id=newId();bankTransactions.push({id,type:'withdrawal',account:acc,amount:l.paid,date:today(),description:desc,createdAt:new Date().toISOString()});l.bankTxId=id;}
    });
    saveAll();renderAll();
    showToast(`✅ ${name} ko ${fmtRs(amt-left)} — Cash book mein likh diya`+(left>0?` (${fmtRs(left)} zyada tha, chhor diya)`:''));
    openKarigarPay();
  };

  // ════════ Order form totals: labour, hardware and profit too ════════
  let origTotals=window.updateOrderTotals;
  window.updateOrderTotals=function(){
    let r=origTotals.apply(this,arguments);
    try{
      let box=document.getElementById('orderTotalWoodCost')?.parentElement?.parentElement;
      if(!box)return r;
      let el=document.getElementById('hkOrderTotalsExtra');
      if(!el){el=document.createElement('div');el.id='hkOrderTotalsExtra';box.appendChild(el);}
      let amt=currentOrderDoors.reduce((s,d)=>s+num(d.doorAmount),0);
      let wood=currentOrderDoors.reduce((s,d)=>s+getDoorWoodCost(d),0);
      let lab=currentOrderDoors.reduce((s,d)=>s+num(d.labourPerDoor),0);
      let a=window.hkAutoCfg?hkAutoCfg():{materials:[]};
      let doors=currentOrderDoors.reduce((s,d)=>s+(num(d.qty)||1),0);
      let mat=(a.materials||[]).reduce((s,m)=>{let i=inventory.find(x=>String(x.id)===String(m.invId));return s+(i?num(m.perDoor)*doors*num(i.cost):0);},0);
      let profit=amt-wood-lab-mat;
      el.innerHTML=`Total Labour: <b>${fmtRs(lab)}</b>${mat?`<br>Hardware: <b>${fmtRs(mat)}</b>`:''}<br>Andaza Munafa: <b style="color:${profit>=0?'#16a34a':'#dc2626'};">${fmtRs(profit)}</b>`;
    }catch(e){}
    return r;
  };

  // ════════ Menu ════════
  function addMenu(){
    if(document.getElementById('hkDayDrawerBtn'))return;
    let anchor=document.querySelector('.drawer-item[data-tab="tabHome"]');
    if(!anchor)return;
    [['hkWoodDrawerBtn','🪵','Lakri Khareed List','openWoodBuyList()'],['hkKarDrawerBtn','🔧','Karigar Payment','openKarigarPay()'],['hkDayDrawerBtn','📅','Aaj ka Hisaab (Day Close)','openDayClose()']].forEach(([id,icon,label,fn])=>{
      let b=document.createElement('button');b.className='drawer-item';b.id=id;
      b.setAttribute('onclick',fn+';closeDrawer();');
      b.innerHTML=`<span class="t-icon">${icon}</span>${label}`;
      anchor.after(b);
    });
    // Home: day close link under the quick actions.
    let acts=document.querySelector('.hm-actions');
    if(acts&&!document.getElementById('hmDayLink'))acts.insertAdjacentHTML('afterend','<div id="hmDayLink" style="display:flex;gap:8px;margin:-4px 0 12px;"><button class="hm-link" onclick="openDayClose()">📅 Aaj ka hisaab ›</button><button class="hm-link" onclick="openWoodBuyList()">🪵 Lakri list ›</button></div>');
  }
  document.addEventListener('hk:ready',()=>{addMenu();try{renderHome&&renderHome();}catch(e){}});
})();
