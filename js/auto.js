// HK Wood Doors ERP — Auto System
// Removes repeated hand work. Settings live in businessProfile.auto (synced).
//
// 1. Door rate: filled from the Rate List (matching size), else the default rate.
// 2. Labour: filled per door line from a labour rate (per sq.ft or per door,
//    with an optional rate per design). Typing your own value keeps it.
// 3. Saving an order:
//    - creates/updates the karigar's labour record for that order,
//    - takes hardware (hinges, locks…) out of stock and adds its cost to the order,
//    - turns the advance into a real payment entry.
// 4. Cash book: advances, kharcha and khareed post to Cash/Bank by themselves.
// 5. Delivery challan marks the order Delivered.
// Records made before the Auto System was switched on are left as they were.
(function(){
  const DEFAULTS={
    doorRate:440,             // sale rate per sq.ft when the Rate List has no match
    labourMode:'sqft',        // 'sqft' or 'door'
    labourRate:0,             // 0 = don't fill labour
    designLabour:{},          // design name -> rate (same unit as labourMode)
    autoLabourRecord:true,
    defaultKarigarId:null,
    materials:[],             // [{invId, perDoor}]
    advanceAsPayment:true,
    cashbook:true,
    defaultAccount:'Cash',
    challanDelivers:true,
    since:null
  };
  function num(v){return parseFloat(v)||0;}
  function cfg(){
    let a=businessProfile.auto=Object.assign({},DEFAULTS,businessProfile.auto||{});
    if(!a.since)a.since=new Date().toISOString();
    return a;
  }
  window.hkAutoCfg=cfg;
  // Made after the Auto System was switched on? (new ids are time-based)
  function isNew(rec){
    let since=cfg().since;
    return (rec.createdAt||'')>=since||num(rec.id)>=Date.parse(since)*100;
  }

  // ── Door rate + labour ──
  function doorSqft(d){return calcSqft(d.w,d.h)*(num(d.qty)||1);}
  function labourRateFor(size){
    let a=cfg(),s=String(size||'').toLowerCase();
    for(const [name,r] of Object.entries(a.designLabour||{})){
      if(num(r)>0&&name&&s.includes(name.toLowerCase()))return num(r);
    }
    return num(a.labourRate);
  }
  function autoLabour(d){
    let r=labourRateFor(d.size);
    if(!r)return null;
    return Math.round(cfg().labourMode==='door'?r*(num(d.qty)||1):r*doorSqft(d));
  }
  function autoRate(d){
    let s=String(d.size||'').trim().toLowerCase();
    let hit=s&&priceList.find(p=>String(p.size||'').trim().toLowerCase()===s&&num(p.rate)>0);
    if(hit)return num(hit.rate);
    return num(cfg().doorRate)||null;
  }
  function applyAuto(d){
    if(!d.rateManual){let r=autoRate(d);if(r!=null){d.rate=r;d._autoRate=r;}}
    if(!d.labourManual){let l=autoLabour(d);if(l!=null){d.labourPerDoor=l;d._autoLabour=l;}}
    d.doorAmount=doorSqft(d)*num(d.rate);
    d.woodCft=getDoorCft(d);
  }
  window.hkApplyDoorAuto=applyAuto;

  let origUpdateDoor=window.updateDoor;
  window.updateDoor=function(idx){
    let d=currentOrderDoors[idx];
    if(!d)return origUpdateDoor(idx);
    // Doors saved before the Auto System keep their own numbers.
    if(d.rateManual===undefined)d.rateManual=d._autoRate===undefined;
    if(d.labourManual===undefined)d.labourManual=d._autoLabour===undefined&&num(d.labourPerDoor)>0;
    let oldRate=num(d.rate),oldLabour=num(d.labourPerDoor);
    origUpdateDoor(idx);
    if(num(d.rate)!==oldRate)d.rateManual=true;
    if(num(d.labourPerDoor)!==oldLabour)d.labourManual=true;
    applyAuto(d);
    // Only touch the other inputs' values (re-rendering would close the phone keyboard).
    let rateEl=document.getElementById(`doorRate_${idx}`);
    if(rateEl&&document.activeElement!==rateEl)rateEl.value=d.rate;
    let labEl=document.getElementById(`doorLabour_${idx}`);
    if(labEl&&document.activeElement!==labEl)labEl.value=d.labourPerDoor;
    let calc=document.getElementById(`doorCalc_${idx}`);
    if(calc)calc.innerHTML=renderDoorCalcInner(d);
    updateOrderTotals();
  };
  ['addDoorFromSize','addEmptyDoor'].forEach(name=>{
    let orig=window[name];
    window[name]=function(){
      let before=currentOrderDoors.length;
      let r=orig.apply(this,arguments);
      for(let i=before;i<currentOrderDoors.length;i++){
        let d=currentOrderDoors[i];d.rateManual=false;d.labourManual=false;applyAuto(d);
      }
      renderOrderDoors();updateOrderTotals();
      return r;
    };
  });

  // ── Order form: karigar picker + hint ──
  let origOpenOrderModal=window.openOrderModal;
  window.openOrderModal=function(orderId){
    let r=origOpenOrderModal.apply(this,arguments);
    try{
      let note=document.getElementById('orderNote');
      let group=note&&note.closest('.form-group');
      if(group&&!document.getElementById('orderKarigarId')){
        let o=orderId?orders.find(x=>x.id===orderId):null;
        let a=cfg(),sel=o?o.karigarId:a.defaultKarigarId;
        let div=document.createElement('div');
        div.className='form-group';
        div.innerHTML=`<label class="form-label">Karigar (labour isi ke khate mein jayegi)</label>
          <select class="form-select" id="orderKarigarId"><option value="">— Baad mein chunein —</option>
          ${karigars.map(k=>`<option value="${k.id}" ${String(k.id)===String(sel)?'selected':''}>${esc(k.name)}</option>`).join('')}</select>
          ${num(a.labourRate)||Object.values(a.designLabour||{}).some(v=>num(v)>0)?'':'<div style="font-size:9px;color:var(--gray-500);margin-top:3px;">💡 Labour khud bharne ke liye ☰ → Auto System mein labour rate likhein</div>'}`;
        group.after(div);
      }
    }catch(e){console.warn('Auto order form:',e);}
    return r;
  };

  // ── After an order is saved ──
  function processOrder(o){
    let a=cfg();
    let doors=o.doors||[];
    o.totalLabour=doors.reduce((s,d)=>s+num(d.labourPerDoor),0);
    // Hardware per door
    let doorCount=doors.reduce((s,d)=>s+(num(d.qty)||1),0);
    o.materials=(a.materials||[]).filter(m=>num(m.perDoor)>0).map(m=>{
      let inv=inventory.find(i=>String(i.id)===String(m.invId));
      if(!inv)return null;
      let qty=num(m.perDoor)*doorCount;
      return {invId:inv.id,name:inv.name,unit:inv.unit||'pcs',qty,cost:Math.round(qty*num(inv.cost))};
    }).filter(Boolean);
    o.materialCost=o.materials.reduce((s,m)=>s+m.cost,0);
    o.netProfit=num(o.orderTotal)-num(o.totalWoodCost)-o.totalLabour-o.materialCost;
    // Advance → payment entry
    if(a.advanceAsPayment){
      let adv=num(o.advancePayment);
      o.payments=o.payments||[];
      let p=o.payments.find(x=>x.autoAdvance);
      if(p){
        if(adv>0){p.amount=adv;p.date=p.date||o.date;}
        else o.payments=o.payments.filter(x=>x!==p);
      }else if(adv>0&&!o.payments.length){
        o.payments.push({id:newId(),amount:adv,date:o.date,method:a.defaultAccount,note:'Advance',user:activeUserId,autoAdvance:true});
      }
    }
    // Karigar labour record
    if(a.autoLabourRecord){
      let mine=labours.find(l=>l.orderId===o.id&&l.auto);
      let manual=labours.some(l=>l.orderId===o.id&&!l.auto);
      let kid=o.karigarId||a.defaultKarigarId||null;
      let sqft=getOrderTotalSqft(o);
      let p=getPartyById(o.partyId);
      if(mine){
        if(o.totalLabour>0){
          mine.totalCost=o.totalLabour;mine.totalSqft=sqft;
          mine.ratePerSqft=sqft?Math.round(o.totalLabour/sqft):0;
          if(kid)mine.karigarId=kid;
        }else if(!num(mine.paid)){labours=labours.filter(l=>l!==mine);}
      }else if(!manual&&o.totalLabour>0){
        labourCounter++;
        labours.push({id:newId(),labourNo:'LAB-'+labourCounter,orderId:o.id,karigarId:kid,totalCost:o.totalLabour,paid:0,paidAccount:a.defaultAccount,
          date:o.date,note:'Order se khud bana',ratePerSqft:sqft?Math.round(o.totalLabour/sqft):0,totalSqft:sqft,
          partyId:p?p.id:null,partyName:p?p.name:'',partyPhone:p?p.phone||'':'',partyAddress:p?getFullAddress(p):'',
          auto:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
      }
    }
    o._autoProcessed=true;
  }

  let origSaveOrder=window.saveOrder;
  window.saveOrder=function(){
    let editingId=editingOrderId,before=orders.length;
    let kSel=document.getElementById('orderKarigarId')?.value;
    let r=origSaveOrder.apply(this,arguments);
    if(document.getElementById('orderModal')?.classList.contains('open'))return r; // not saved (missing field)
    let o=editingId?orders.find(x=>x.id===editingId):(orders.length>before?orders[orders.length-1]:null);
    if(o){
      if(kSel!==undefined)o.karigarId=kSel?parseInt(kSel):null;
      o._autoProcessed=false;
      saveAll();renderAll();
    }
    return r;
  };

  // A labour record edited by hand sets the order's labour; keep it from being recalculated.
  let origSaveLabour=window.saveLabour;
  window.saveLabour=function(){
    let r=origSaveLabour.apply(this,arguments);
    let id=parseInt(document.getElementById('labourOrderId')?.value);
    let o=orders.find(x=>x.id===id);
    if(o&&!document.getElementById('labourModal')?.classList.contains('open')){
      (o.doors||[]).forEach(d=>{d.labourManual=true;});
      o.netProfit=num(o.orderTotal)-num(o.totalWoodCost)-num(o.totalLabour)-num(o.materialCost);
      saveAll();
    }
    return r;
  };

  // Challan → Delivered
  let origChallan=window.generateChallan;
  window.generateChallan=function(orderId){
    let r=origChallan.apply(this,arguments);
    let o=orders.find(x=>x.id===orderId);
    if(o&&cfg().challanDelivers&&o.status!=='delivered'){
      o.status='delivered';saveAll();renderAll();
      showToast('🚚 '+o.orderNo+' Delivered ho gaya');
    }
    return r;
  };

  // ── Account picker on Kharcha and Khareed forms ──
  function accountSelect(id,current,extra){
    let a=cfg();
    let val=current||a.defaultAccount;
    return `<div class="form-group" id="${id}Group"><label class="form-label">Paisa kahan se gaya</label>
      <select class="form-select" id="${id}">${BANK_ACCOUNTS.map(b=>`<option ${b===val?'selected':''}>${b}</option>`).join('')}
      ${extra.map(([v,l])=>`<option value="${v}" ${v===val?'selected':''}>${l}</option>`).join('')}</select></div>`;
  }
  function addPicker(openName,saveName,arrName,anchorId,selId,extra){
    let origOpen=window[openName];
    window[openName]=function(id){
      let r=origOpen.apply(this,arguments);
      try{
        let anchor=document.getElementById(anchorId)?.closest('.form-group');
        if(anchor&&!document.getElementById(selId)){
          let rec=id?window.hkData()[arrName].find(x=>x.id===id):null;
          anchor.insertAdjacentHTML('afterend',accountSelect(selId,rec&&rec.account,extra));
        }
      }catch(e){}
      return r;
    };
    let origSave=window[saveName];
    window[saveName]=function(){
      let sel=document.getElementById(selId)?.value;
      let editId={saveExpense:()=>editingExpenseId,savePurchase:()=>editingPurchaseId}[saveName]();
      let list=window.hkData()[arrName],before=list.length;
      let r=origSave.apply(this,arguments);
      list=window.hkData()[arrName];
      let rec=editId?list.find(x=>x.id===editId):(list.length>before?list[list.length-1]:null);
      if(rec&&sel){rec.account=sel;saveAll();}
      return r;
    };
  }
  window.hkData=()=>({expenses,purchases});
  addPicker('openExpenseModal','saveExpense','expenses','expAmount','expAccount',[['none','Cash book mein na daalein']]);
  addPicker('openPurchaseModal','savePurchase','purchases','purchaseRate','purAccount',[['udhaar','Udhaar (baad mein dena hai)']]);

  // ── Keeping everything in step on every save ──
  function reconcileCashbook(){
    let a=cfg();
    let want=new Map();
    // Other modules (supplier payments…) add their own cash book lines here.
    (window.hkCashbookSources||[]).forEach(fn=>{try{fn(want);}catch(e){console.warn('Cash book source:',e);}});
    if(a.cashbook)expenses.forEach(e=>{
      if(!isNew(e)||e.account==='none'||num(e.amount)<=0)return;
      want.set('exp:'+e.id,{type:'withdrawal',account:e.account||a.defaultAccount,amount:num(e.amount),date:e.date,description:'Kharcha: '+(e.description||'')});
    });
    if(a.cashbook)purchases.forEach(p=>{
      let amt=num(p.total)||num(p.qty)*num(p.rate);
      if(!isNew(p)||p.account==='udhaar'||amt<=0)return;
      want.set('pur:'+p.id,{type:'withdrawal',account:p.account||a.defaultAccount,amount:amt,date:p.date,description:`Khareed: ${p.item||''} (${getSupplierName(p.supplierId)})`});
    });
    if(a.cashbook)orders.forEach(o=>(o.payments||[]).forEach(p=>{
      if(!p.autoAdvance||num(p.amount)<=0)return;
      want.set('adv:'+p.id,{type:'deposit',account:BANK_ACCOUNTS.includes(p.method)?p.method:a.defaultAccount,amount:num(p.amount),date:p.date,description:`Advance: ${o.orderNo} ${getPartyName(o.partyId)}`});
    }));
    bankTransactions=bankTransactions.filter(t=>{
      if(!t.autoFor)return true;
      let w=want.get(t.autoFor);
      if(!w)return false;
      for(const k of Object.keys(w))if(t[k]!==w[k])t[k]=w[k];
      want.delete(t.autoFor);
      return true;
    });
    want.forEach((w,k)=>bankTransactions.push({id:newId(),...w,autoFor:k,createdAt:new Date().toISOString()}));
  }
  function reconcileStock(){
    let used=new Map();
    orders.forEach(o=>(o.materials||[]).forEach(m=>used.set(String(m.invId),(used.get(String(m.invId))||0)+num(m.qty))));
    inventory.forEach(i=>{
      let want=used.get(String(i.id))||0,had=num(i.autoUsed);
      if(Math.abs(want-had)>1e-9){i.qty=num(i.qty)-(want-had);i.autoUsed=want;}
    });
  }
  function cleanLabour(){
    // An auto labour record for a deleted order, with nothing paid, goes too.
    labours=labours.filter(l=>!l.auto||num(l.paid)>0||orders.some(o=>o.id===l.orderId));
  }
  let origSaveAll=window.saveAll;
  window.saveAll=function(){
    try{
      let a=cfg();
      orders.forEach(o=>{if(o._autoProcessed===false||(o._autoProcessed===undefined&&isNew(o)))processOrder(o);});
      reconcileStock();reconcileCashbook();cleanLabour();
    }catch(e){console.warn('Auto system:',e);}
    return origSaveAll.apply(this,arguments);
  };

  // ── Settings screen ──
  window.openAutoSettings=function(){
    let a=cfg();
    let m=document.getElementById('hkAutoModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkAutoModal';
      m.innerHTML=`<div class="modal-box" style="max-width:560px;"><div class="modal-head">⚡ Auto System <button class="modal-close" onclick="closeModal('hkAutoModal')">✕</button></div><div class="modal-body" id="hkAutoBody"></div></div>`;
      document.body.appendChild(m);
    }
    let chk=(id,on,label,help)=>`<label class="hk-auto-check"><input type="checkbox" id="${id}" ${on?'checked':''}><span><b>${label}</b><br><small>${help}</small></span></label>`;
    document.getElementById('hkAutoBody').innerHTML=`
      <div class="hk-auto-sec">1️⃣ Door ka rate</div>
      <div class="form-group"><label class="form-label">Default rate (per sq.ft) — Rate List mein size na mile to</label><input class="form-input" type="number" id="auDoorRate" value="${num(a.doorRate)}"></div>
      <p class="hk-auto-help">Rate List (☰ → Rate / Price List) mein jo size likha hai, us ka rate khud lag jayega.</p>

      <div class="hk-auto-sec">2️⃣ Labour</div>
      <div class="row-2">
        <div class="form-group"><label class="form-label">Labour rate</label><input class="form-input" type="number" id="auLabourRate" value="${num(a.labourRate)||''}" placeholder="maslan 60"></div>
        <div class="form-group"><label class="form-label">Kis hisaab se</label><select class="form-select" id="auLabourMode"><option value="sqft" ${a.labourMode!=='door'?'selected':''}>Per sq.ft</option><option value="door" ${a.labourMode==='door'?'selected':''}>Per door</option></select></div>
      </div>
      ${doorDesigns.length?`<p class="hk-auto-help">Kisi design ka rate alag ho to yahan likhein (khali = upar wala rate):</p>
      <div class="hk-auto-grid">${doorDesigns.map((dz,i)=>`<label>${esc(dz)}<input class="form-input" type="number" id="auDesign_${i}" value="${num((a.designLabour||{})[dz])||''}" placeholder="—"></label>`).join('')}</div>`:''}
      <div class="form-group"><label class="form-label">Default karigar (naye order par)</label><select class="form-select" id="auKarigar"><option value="">— Koi nahi —</option>${karigars.map(k=>`<option value="${k.id}" ${String(k.id)===String(a.defaultKarigarId)?'selected':''}>${esc(k.name)}</option>`).join('')}</select></div>
      ${chk('auLabourRec',a.autoLabourRecord,'Order save hote hi karigar ka labour record banayein','Karigar ke khate mein baqi labour khud aa jayegi; payment baad mein Labour se darj karein.')}

      <div class="hk-auto-sec">3️⃣ Har door par hardware (stock se khud kate)</div>
      ${inventory.length?`<div class="hk-auto-grid">${inventory.map(i=>{let m=(a.materials||[]).find(x=>String(x.invId)===String(i.id));return `<label>${esc(i.name)} <small>(${esc(i.unit||'pcs')}${num(i.cost)?' · '+fmtRs(i.cost):''})</small><input class="form-input" type="number" step="0.1" id="auMat_${i.id}" value="${m?num(m.perDoor):''}" placeholder="per door"></label>`;}).join('')}</div>
      <p class="hk-auto-help">Maslan Kabza 3, Tala 1. Order par itna stock kam ho jayega aur keemat order ke kharche mein judegi (Inventory mein "cost" bharein).</p>`
      :'<p class="hk-auto-help">Pehle Inventory mein hardware (kabze, tala, peech…) add karein, phir yahan per-door miqdaar likhein.</p>'}

      <div class="hk-auto-sec">4️⃣ Paisa (Cash / Bank book)</div>
      <div class="form-group"><label class="form-label">Default account</label><select class="form-select" id="auAccount">${BANK_ACCOUNTS.map(b=>`<option ${b===a.defaultAccount?'selected':''}>${b}</option>`).join('')}</select></div>
      ${chk('auAdvance',a.advanceAsPayment,'Order ka advance = payment entry','Khata, ledger aur cash book mein khud aa jayega.')}
      ${chk('auCash',a.cashbook,'Kharcha aur khareed Cash/Bank book mein khud likhein','Har form par "Paisa kahan se gaya" chunein; khareed udhaar bhi ho sakti hai.')}

      <div class="hk-auto-sec">5️⃣ Delivery</div>
      ${chk('auChallan',a.challanDelivers,'Delivery challan banate hi order "Delivered"','Production list khud saaf rehti hai.')}

      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:10px;" onclick="saveAutoSettings()">💾 Save</button>`;
    if(!m.classList.contains('open'))openModal('hkAutoModal');
  };

  window.saveAutoSettings=function(){
    let a=cfg(),v=id=>document.getElementById(id);
    a.doorRate=num(v('auDoorRate').value)||440;
    a.labourRate=num(v('auLabourRate').value);
    a.labourMode=v('auLabourMode').value;
    a.designLabour={};
    doorDesigns.forEach((dz,i)=>{let x=num(v('auDesign_'+i)?.value);if(x>0)a.designLabour[dz]=x;});
    a.defaultKarigarId=v('auKarigar').value?parseInt(v('auKarigar').value):null;
    a.autoLabourRecord=v('auLabourRec').checked;
    a.materials=inventory.map(i=>({invId:i.id,perDoor:num(v('auMat_'+i.id)?.value)})).filter(m=>m.perDoor>0);
    a.defaultAccount=v('auAccount').value;
    a.advanceAsPayment=v('auAdvance').checked;
    a.cashbook=v('auCash').checked;
    a.challanDelivers=v('auChallan').checked;
    businessProfile.auto=a;
    saveAll();
    closeModal('hkAutoModal');
    showToast('✅ Auto System save ho gaya');
  };

  function addMenu(){
    if(document.getElementById('hkAutoDrawerBtn'))return;
    let anchor=[...document.querySelectorAll('.drawer-item')].find(b=>(b.getAttribute('onclick')||'').includes('openSettingsModal'));
    if(!anchor)return;
    let b=document.createElement('button');
    b.className='drawer-item';b.id='hkAutoDrawerBtn';
    b.setAttribute('onclick','openAutoSettings();closeDrawer();');
    b.innerHTML='<span class="t-icon">⚡</span>Auto System';
    anchor.before(b);
  }
  document.addEventListener('hk:ready',()=>{cfg();addMenu();});
})();
