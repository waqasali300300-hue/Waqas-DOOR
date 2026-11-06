// HK Wood Doors ERP — Auto System, part 2
// More of the order fills itself in, so the owner types only party, size,
// design and count:
//   • Wood type by design (e.g. Mughleazam → Deodar), unless chosen by hand
//   • Karigar by design, when the order form leaves "Karigar" empty
//   • Delivery date = order date + N days, when none is typed
//   • After saving, a warning when the wood in stock is not enough
//   • Setting a default karigar offers to give it the labour records that have none
// Settings sit in the same Auto System screen (businessProfile.auto, synced).
(function(){
  function num(v){return parseFloat(v)||0;}
  function cfg(){return typeof hkAutoCfg==='function'?hkAutoCfg():(businessProfile.auto||{});}
  function designOf(size){
    let s=String(size||'').toLowerCase(),best='';
    doorDesigns.forEach(dz=>{let n=String(dz).toLowerCase();if(n&&s.includes(n)&&n.length>best.length)best=dz;});
    return best;
  }
  window.hkDesignOf=designOf;
  function woodFor(size){let dz=designOf(size),m=cfg().designWood||{};return dz&&m[dz]?m[dz]:null;}
  function karigarFor(doors){
    let m=cfg().designKarigar||{};
    for(const d of doors||[]){let dz=designOf(d.size);if(dz&&m[dz])return m[dz];}
    return null;
  }

  // ── Wood by design ──
  function setWood(d,idx){
    if(d.woodManual!==false)return false; // only doors added since this was on; picked-by-hand stays
    let w=woodFor(d.size);
    if(!w||!woodTypes.some(x=>String(x.id)===String(w))||String(d.woodId)===String(w))return false;
    d.woodId=parseInt(w);d.woodCft=getDoorCft(d);
    let sel=document.getElementById(`doorWood_${idx}`);if(sel)sel.value=d.woodId;
    return true;
  }
  ['addDoorFromSize','addEmptyDoor'].forEach(name=>{
    let orig=window[name];if(!orig)return;
    window[name]=function(){
      let before=currentOrderDoors.length;
      let r=orig.apply(this,arguments);
      let changed=false;
      for(let i=before;i<currentOrderDoors.length;i++){currentOrderDoors[i].woodManual=false;changed=setWood(currentOrderDoors[i],i)||changed;}
      if(changed){renderOrderDoors();updateOrderTotals();}
      return r;
    };
  });
  let origUpdateDoor=window.updateDoor;
  window.updateDoor=function(idx){
    let d=currentOrderDoors[idx];
    let wBefore=d&&d.woodId,sel=document.getElementById(`doorWood_${idx}`);
    let picked=sel&&String(sel.value)!==String(wBefore);
    let r=origUpdateDoor.apply(this,arguments);
    if(d){
      if(picked)d.woodManual=true;          // chosen by hand: keep it
      else if(setWood(d,idx))updateOrderTotals();
    }
    return r;
  };

  // ── Karigar by design + delivery date, filled just before saving ──
  let origSaveOrder=window.saveOrder;
  window.saveOrder=function(){
    let a=cfg(),isNew=!editingOrderId;
    let kSel=document.getElementById('orderKarigarId');
    if(kSel&&!kSel.value){let k=karigarFor(currentOrderDoors);if(k&&karigars.some(x=>String(x.id)===String(k)))kSel.value=k;}
    let dd=document.getElementById('orderDeliveryDate');
    if(isNew&&dd&&!dd.value&&num(a.deliveryDays)>0){
      let base=document.getElementById('orderDate')?.value||new Date().toISOString().slice(0,10);
      let x=new Date(base+'T00:00:00');x.setDate(x.getDate()+num(a.deliveryDays));
      dd.value=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
    }
    let r=origSaveOrder.apply(this,arguments);
    // Saved? Then check the wood.
    if(!document.getElementById('orderModal')?.classList.contains('open')&&a.woodWarn!==false&&window.hkWoodShort){
      let short=hkWoodShort().filter(x=>x.short>0);
      if(short.length)setTimeout(()=>showToast('🪵 Lakri kam hai: '+short.map(x=>`${x.w.name} ${x.short.toFixed(1)} cft`).join(', ')+' — ☰ → Lakri List'),900);
    }
    return r;
  };

  // ── Settings: extra sections in the Auto System screen ──
  let origOpen=window.openAutoSettings;
  window.openAutoSettings=function(){
    let r=origOpen.apply(this,arguments);
    let a=cfg(),body=document.getElementById('hkAutoBody');
    let save=body&&body.querySelector('button[onclick="saveAutoSettings()"]');
    if(save&&!document.getElementById('hkAuto2')){
      let wOpts=sel=>`<option value="">—</option>`+woodTypes.map(w=>`<option value="${w.id}" ${String(w.id)===String(sel)?'selected':''}>${esc(w.name)}</option>`).join('');
      let kOpts=sel=>`<option value="">—</option>`+karigars.map(k=>`<option value="${k.id}" ${String(k.id)===String(sel)?'selected':''}>${esc(k.name)}</option>`).join('');
      save.insertAdjacentHTML('beforebegin',`<div id="hkAuto2">
        <div class="hk-auto-sec">6️⃣ Design ke hisaab se lakri aur karigar</div>
        <p class="hk-auto-help">Har design ki lakri aur karigar ek dafa chun lein — order mein design likhte hi khud lag jayenge (haath se badal bhi sakte hain).</p>
        ${doorDesigns.length?`<div style="overflow-x:auto;"><table class="hk-sc-table"><tr><th>Design</th><th>Lakri</th><th>Karigar</th></tr>
          ${doorDesigns.map((dz,i)=>`<tr><td>${esc(dz)}</td><td><select class="form-select" id="au2Wood_${i}" style="padding:5px;">${wOpts((a.designWood||{})[dz])}</select></td>
            <td><select class="form-select" id="au2Kar_${i}" style="padding:5px;">${kOpts((a.designKarigar||{})[dz])}</select></td></tr>`).join('')}</table></div>`
          :'<p class="hk-auto-help">Pehle Rate List mein design ke naam likhein.</p>'}
        <div class="hk-auto-sec">7️⃣ Delivery ki tareekh khud</div>
        <div class="form-group"><label class="form-label">Order ke kitne din baad delivery (khali = khud na lagayein)</label><input class="form-input" type="number" id="au2Days" value="${num(a.deliveryDays)||''}" placeholder="maslan 15"></div>
        <label class="hk-auto-check"><input type="checkbox" id="au2Wood" ${a.woodWarn!==false?'checked':''}><span><b>Order save par lakri kam ho to batayein</b><br><small>Chalte orders ki zaroorat stock se zyada ho to foran pata chal jaye.</small></span></label>
      </div>`);
    }
    return r;
  };
  let origSave=window.saveAutoSettings;
  window.saveAutoSettings=function(){
    let a=cfg(),v=id=>document.getElementById(id);
    if(v('hkAuto2')){
      a.designWood={};a.designKarigar={};
      doorDesigns.forEach((dz,i)=>{
        let w=v('au2Wood_'+i)?.value,k=v('au2Kar_'+i)?.value;
        if(w)a.designWood[dz]=parseInt(w);
        if(k)a.designKarigar[dz]=parseInt(k);
      });
      a.deliveryDays=num(v('au2Days')?.value);
      a.woodWarn=!!v('au2Wood')?.checked;
      businessProfile.auto=a;
    }
    let r=origSave.apply(this,arguments);
    // A default karigar now set: offer it the labour records that have none.
    let kid=cfg().defaultKarigarId,k=kid&&karigars.find(x=>String(x.id)===String(kid));
    let loose=labours.filter(l=>!karigars.some(x=>String(x.id)===String(l.karigarId)));
    if(k&&loose.length)setTimeout(()=>customConfirm(`${loose.length} labour records mein karigar nahi chuna. Sab ${k.name} ke khate mein daal dein? (Baad mein badal sakte hain)`,()=>{
      loose.forEach(l=>{l.karigarId=k.id;l.updatedAt=new Date().toISOString();});
      saveAll();renderAll();showToast(`✅ ${loose.length} labour ${k.name} ke khate mein`);
    },{danger:false,title:'👷 Karigar',okText:'Haan, daal dein'}),300);
    return r;
  };
})();
