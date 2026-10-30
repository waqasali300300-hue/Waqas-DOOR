// HK Wood Doors ERP — wasooli tools, karigar report, Excel import,
// order summary for the customer, and voice entry.
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function waPhone(p){p=String(p||'').replace(/[^0-9]/g,'');if(p.startsWith('0'))p='92'+p.slice(1);return p;}
  function wa(phone,msg){window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(msg)}`,'_blank');}
  function modal(id,title,html,wide){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:${wide?620:480}px;"><div class="modal-head"><span id="${id}T"></span> <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}B"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById(id+'T').textContent=title;
    document.getElementById(id+'B').innerHTML=html;
    if(!m.classList.contains('open'))openModal(id);
  }
  function addMenu(id,icon,label,fn,afterTab){
    if(document.getElementById(id))return;
    let anchor=document.querySelector(`.drawer-item[data-tab="${afterTab}"]`);
    if(!anchor)return;
    anchor.insertAdjacentHTML('afterend',`<button class="drawer-item" id="${id}" onclick="${fn};closeDrawer();"><span class="t-icon">${icon}</span>${label}</button>`);
  }

  // ════════ 5. Wasooli: udhaar limit ════════
  let origOpenParty=window.openPartyModal;
  window.openPartyModal=function(id){
    let r=origOpenParty.apply(this,arguments);
    try{
      let g=document.getElementById('partyOpeningBalance')?.closest('.form-group');
      if(g&&!document.getElementById('partyCreditLimit')){
        let p=id?getPartyById(id):null;
        g.insertAdjacentHTML('afterend',`<div class="form-group"><label class="form-label">Udhaar ki hadd (limit) — khali = koi hadd nahi</label><input class="form-input" type="number" id="partyCreditLimit" value="${p&&num(p.creditLimit)?num(p.creditLimit):''}" placeholder="maslan 200000"></div>`);
      }
    }catch(e){}
    return r;
  };
  let origSaveParty=window.saveParty;
  window.saveParty=function(){
    let lim=document.getElementById('partyCreditLimit')?.value;
    let editId=editingPartyId,before=parties.length;
    let r=origSaveParty.apply(this,arguments);
    let p=editId?getPartyById(editId):(parties.length>before?parties[parties.length-1]:null);
    if(p&&lim!==undefined){p.creditLimit=num(lim);saveAll();}
    return r;
  };
  // Warn before an order takes a party over its limit.
  let limitOk=false;
  let origSaveOrder=window.saveOrder;
  window.saveOrder=function(){
    if(!limitOk){
      let pid=document.getElementById('orderPartyId')?.value;
      let p=pid&&pid!=='__new__'?getPartyById(parseInt(pid)):null;
      if(p&&num(p.creditLimit)>0){
        let amt=currentOrderDoors.reduce((s,d)=>s+num(d.doorAmount),0);
        let old=editingOrderId?num((orders.find(o=>o.id===editingOrderId)||{}).orderTotal):0;
        let adv=num(document.getElementById('orderAdvance')?.value);
        let after=getPartyBalance(p)+amt-old-adv;
        if(after>num(p.creditLimit)){
          customConfirm(`⚠️ ${p.name} ki udhaar hadd ${fmtRs(p.creditLimit)} hai. Is order ke baad baqaya ${fmtRs(after)} ho jayega. Phir bhi order save karein?`,()=>{limitOk=true;try{window.saveOrder();}finally{limitOk=false;}},{okText:'Haan, save karein',title:'⚠️ Udhaar hadd se zyada',danger:false});
          return;
        }
      }
    }
    return origSaveOrder.apply(this,arguments);
  };
  (window.hkAttentionSources=window.hkAttentionSources||[]).push(()=>{
    let over=parties.filter(p=>num(p.creditLimit)>0&&getPartyBalance(p)>num(p.creditLimit));
    return over.length?[{icon:'🚫',tone:'bad',text:`${over.length} party udhaar hadd se upar — ${over.map(p=>p.name).slice(0,2).join(', ')}`,go:'openBulkReminders()'}]:[];
  });

  // ════════ 5. Wasooli: remind everyone, one after another ════════
  function dueParties(){return parties.map(p=>({p,b:getPartyBalance(p)})).filter(x=>x.b>0).sort((a,b)=>b.b-a.b);}
  function reminderText(p,b){
    return `Assalam-o-Alaikum ${p.name},\n${businessProfile.name||''} se — aap ki taraf ${fmtRs(b)} baqi hain. Meharbani kar ke jald payment bhej dein. Shukriya.`;
  }
  window.openBulkReminders=function(){
    let list=dueParties(),t=today();
    let total=list.reduce((s,x)=>s+x.b,0);
    let rows=list.map(({p,b})=>{
      let sent=p.lastReminder===t;
      let over=num(p.creditLimit)>0&&b>num(p.creditLimit);
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);">
        <span style="flex:1;min-width:0;font-size:12px;"><b>${esc(p.name)}</b>${over?' <span class="hk-dlv late">hadd se upar</span>':''}<br><small style="color:var(--gray-500);">${p.phone?esc(p.phone):'⚠️ phone nahi'}${p.lastReminder?' · pichhli yaad: '+esc(p.lastReminder):''}</small></span>
        <b style="font-family:var(--font-mono);font-size:12px;">${fmtRs(b)}</b>
        ${p.phone?`<button class="btn ${sent?'btn-outline':'btn-success'} btn-xs" onclick="sendReminder(${p.id})">${sent?'✓ Bheja':'💬 Bhejein'}</button>`:''}
      </div>`;
    }).join('');
    modal('hkBulkRemModal','📣 Sab ko yaad dahani',list.length?`
      <div style="font-size:12px;margin-bottom:6px;">${list.length} parties · kul baqaya <b>${fmtRs(total)}</b></div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="sendNextReminder()">💬 Agle ko bhejein ›</button>
      <p style="font-size:9.5px;color:var(--gray-500);margin-bottom:6px;">Har dabane par WhatsApp khulega — Send dabayein, wapas aa kar agla.</p>${rows}`
      :'<div class="hm-empty">✅ Kisi party ka baqaya nahi</div>',true);
  };
  window.sendReminder=function(id){
    let p=getPartyById(id);if(!p||!p.phone)return;
    wa(p.phone,reminderText(p,getPartyBalance(p)));
    p.lastReminder=today();saveAll();
    setTimeout(openBulkReminders,300);
  };
  window.sendNextReminder=function(){
    let t=today();
    let next=dueParties().find(x=>x.p.phone&&x.p.lastReminder!==t);
    if(!next){showToast('✅ Aaj sab ko bhej diya');return;}
    sendReminder(next.p.id);
  };

  // ════════ 6. Karigar monthly report ════════
  let kMonth=today().slice(0,7);
  function karigarStats(k,month){
    let recs=labours.filter(l=>String(l.karigarId)===String(k.id)&&String(l.date||'').startsWith(month));
    let doors=recs.reduce((s,l)=>{let o=orders.find(x=>x.id===l.orderId);return s+(o?(o.doors||[]).reduce((a,d)=>a+(num(d.qty)||1),0):0);},0);
    let labour=recs.reduce((s,l)=>s+num(l.totalCost),0),paid=recs.reduce((s,l)=>s+num(l.paid),0);
    let att=karigarAttendance.filter(a=>String(a.karigarId)===String(k.id)&&String(a.date||'').startsWith(month));
    let days=att.filter(a=>a.status==='present').length+att.filter(a=>a.status==='half-day').length*0.5;
    let allDue=labours.filter(l=>String(l.karigarId)===String(k.id)).reduce((s,l)=>s+num(l.totalCost)-num(l.paid),0);
    return {recs,doors,labour,paid,days,allDue};
  }
  function monthOpts(sel){
    let out=[],d=new Date();
    for(let i=0;i<12;i++){let x=new Date(d.getFullYear(),d.getMonth()-i,1);let k=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');
      out.push(`<option value="${k}" ${k===sel?'selected':''}>${x.toLocaleDateString('en',{month:'short',year:'numeric'})}</option>`);}
    return out.join('');
  }
  window.openKarigarReport=function(m){
    if(m)kMonth=m;
    let rows=karigars.map(k=>({k,s:karigarStats(k,kMonth)}));
    modal('hkKarRepModal','👷 Karigar Report',`
      <select class="form-input" style="margin-bottom:8px;" onchange="openKarigarReport(this.value)">${monthOpts(kMonth)}</select>
      ${rows.length?rows.map(({k,s})=>`<div style="padding:9px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;"><b>${esc(k.name)}</b><span style="color:${s.allDue>0?'#b91c1c':'#16a34a'};font-weight:700;">${s.allDue>0?'Dena hai '+fmtRs(s.allDue):'Hisaab saaf'}</span></div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0;text-align:center;font-size:10px;">
          <div class="hm-stage on"><div class="hm-stage-n">${s.doors}</div><div class="hm-stage-l">Darwaze</div></div>
          <div class="hm-stage on"><div class="hm-stage-n" style="font-size:13px;">${fmtRs(s.labour)}</div><div class="hm-stage-l">Labour</div></div>
          <div class="hm-stage on"><div class="hm-stage-n" style="font-size:13px;">${fmtRs(s.paid)}</div><div class="hm-stage-l">Diya</div></div>
          <div class="hm-stage on"><div class="hm-stage-n">${s.days}</div><div class="hm-stage-l">Hazri din</div></div>
        </div>
        <div style="display:flex;gap:6px;"><button class="btn btn-gold btn-xs" onclick="karigarSlipPDF(${JSON.stringify(k.id)})">📄 Parchi PDF</button>${k.phone?`<button class="btn btn-outline btn-xs" onclick="karigarSlipWA(${JSON.stringify(k.id)})">💬 WhatsApp</button>`:''}</div>
      </div>`).join(''):'<div class="hm-empty">Pehle ☰ → Karigar Manager mein karigar add karein</div>'}`,true);
  };
  function slipText(k,s){
    return `${businessProfile.name||''} — ${k.name} ka hisaab (${kMonth})\nDarwaze: ${s.doors}\nLabour bani: ${fmtRs(s.labour)}\nIs mahine diya: ${fmtRs(s.paid)}\nHazri: ${s.days} din\nKul baqi: ${fmtRs(s.allDue)}`;
  }
  window.karigarSlipWA=function(id){let k=karigars.find(x=>String(x.id)===String(id));if(!k||!k.phone)return;wa(k.phone,slipText(k,karigarStats(k,kMonth)));};
  window.karigarSlipPDF=function(id){
    let k=karigars.find(x=>String(x.id)===String(id));if(!k)return;
    let s=karigarStats(k,kMonth),td='padding:6px 8px;border:1px solid #e2e8f0;';
    let html=`<div id="hkKSlip" style="font-family:sans-serif;padding:24px;background:#fff;color:#111;">
      <div style="text-align:center;border-bottom:2px solid #c8963e;padding-bottom:10px;margin-bottom:14px;"><h1 style="font-size:22px;margin:0;">${esc(businessProfile.name||'')}</h1><h2 style="font-size:16px;margin:8px 0 0;">Karigar Parchi — ${esc(k.name)} (${kMonth})</h2></div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;"><thead><tr style="background:#1a3a6a;color:#fff;"><th style="${td}">Date</th><th style="${td}">Order</th><th style="${td}">Party</th><th style="${td}text-align:right;">Labour</th><th style="${td}text-align:right;">Diya</th></tr></thead>
      <tbody>${s.recs.map(l=>{let o=orders.find(x=>x.id===l.orderId);return `<tr><td style="${td}">${esc(l.date||'')}</td><td style="${td}">${esc(o?o.orderNo:'')}</td><td style="${td}">${esc(l.partyName||(o?getPartyName(o.partyId):''))}</td><td style="${td}text-align:right;">${fmtRs(l.totalCost)}</td><td style="${td}text-align:right;">${fmtRs(l.paid)}</td></tr>`;}).join('')||`<tr><td style="${td}text-align:center;" colspan="5">Is mahine koi entry nahi</td></tr>`}</tbody></table>
      <table style="width:55%;margin:14px 0 0 auto;border-collapse:collapse;font-size:13px;">
        <tr><td style="${td}">Darwaze</td><td style="${td}text-align:right;">${s.doors}</td></tr>
        <tr><td style="${td}">Hazri</td><td style="${td}text-align:right;">${s.days} din</td></tr>
        <tr><td style="${td}">Labour bani</td><td style="${td}text-align:right;">${fmtRs(s.labour)}</td></tr>
        <tr><td style="${td}">Is mahine diya</td><td style="${td}text-align:right;">${fmtRs(s.paid)}</td></tr>
        <tr style="background:#1a3a6a;color:#fff;font-weight:700;"><td style="${td}">Kul baqi</td><td style="${td}text-align:right;">${fmtRs(s.allDue)}</td></tr></table></div>`;
    let temp=document.createElement('div');temp.innerHTML=html;temp.style.cssText='position:fixed;left:0;top:0;width:800px;background:#fff;z-index:150;pointer-events:none;';
    document.body.appendChild(temp);
    downloadPDF('hkKSlip',`Karigar_${k.name.replace(/\s+/g,'_')}_${kMonth}.pdf`).finally(()=>temp.remove());
  };

  // ════════ 7. Excel import (parties and their old balance) ════════
  function loadXlsx(){
    if(window.XLSX)return Promise.resolve();
    return new Promise((res,rej)=>{let s=document.createElement('script');s.src='vendor/xlsx.mini.min.js';s.onload=res;s.onerror=()=>rej(new Error('Excel library load nahi hui'));document.head.appendChild(s);});
  }
  window.openImport=function(){
    modal('hkImportModal','📥 Excel se Parties layein',`
      <ol style="font-size:12px;line-height:1.7;padding-left:18px;">
        <li><b>Namoona file</b> download karein.</li>
        <li>Us mein har party ki ek line bharein: <b>Naam, Phone, Area, Purana Baqaya</b>.</li>
        <li>File save kar ke yahan chunein.</li></ol>
      <button class="btn btn-outline btn-sm" style="margin:6px 0 10px;" onclick="downloadImportTemplate()">⬇️ Namoona file</button>
      <input type="file" class="form-input" accept=".xlsx,.xls,.csv" onchange="importPartiesFile(this.files[0])">
      <p style="font-size:9.5px;color:var(--gray-500);margin-top:8px;">Jis naam ki party pehle se hai, woh dobara nahi banegi.</p>
      <div id="hkImportResult" style="font-size:12px;margin-top:8px;"></div>`);
  };
  window.downloadImportTemplate=async function(){
    try{
      await loadXlsx();
      let ws=XLSX.utils.aoa_to_sheet([['Naam','Phone','Area','Purana Baqaya'],['Ali Traders','03001234567','Lahore',25000]]);
      let wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Parties');
      let out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
      let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([out]));a.download='HK_Parties_Namoona.xlsx';a.click();
    }catch(e){showToast('⚠️ '+e.message);}
  };
  function pick(row,names){
    for(const k of Object.keys(row)){let n=k.toLowerCase().replace(/[^a-z]/g,'');if(names.includes(n))return row[k];}
    return '';
  }
  window.importPartiesFromRows=function(rows){
    let added=0,skipped=0;
    rows.forEach(r=>{
      let name=String(pick(r,['naam','name','party','partyname'])||'').trim();
      if(!name){return;}
      if(parties.some(p=>p.name.trim().toLowerCase()===name.toLowerCase())){skipped++;return;}
      parties.push({id:newId(),name,phone:String(pick(r,['phone','mobile','number','fon'])||'').trim(),area:String(pick(r,['area','city','ilaqa'])||'').trim(),
        address:'',openingBalance:num(String(pick(r,['puranabaqaya','baqaya','balance','openingbalance','udhaar'])).replace(/[^0-9.-]/g,'')),createdAt:new Date().toISOString()});
      added++;
    });
    if(added){saveAll();updateKhataFilter();renderAll();}
    return {added,skipped};
  };
  window.importPartiesFile=async function(file){
    if(!file)return;
    let out=document.getElementById('hkImportResult');
    try{
      await loadXlsx();
      let wb=XLSX.read(await file.arrayBuffer(),{type:'array'});
      let rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      let r=importPartiesFromRows(rows);
      out.innerHTML=`✅ ${r.added} nayi parties aa gayin${r.skipped?` · ${r.skipped} pehle se thin (chhor di)`:''}`;
    }catch(e){out.textContent='⚠️ File parh nahi saki: '+e.message;}
  };

  // ════════ 8. Order summary to the customer on WhatsApp ════════
  function orderSummary(o){
    let p=getPartyById(o.partyId);
    let lines=(o.doors||[]).map(d=>`• ${d.size||'Door'} × ${num(d.qty)||1} = ${fmtRs(d.doorAmount)}`).join('\n');
    let paid=getOrderTotalPaid(o);
    return `Assalam-o-Alaikum ${p?p.name:''},\n${businessProfile.name||''} — aap ka order *${o.orderNo}* (${o.date})\n${lines}\n*Kul: ${fmtRs(o.orderTotal)}*`+
      (paid?`\nAdvance / ada: ${fmtRs(paid)}`:'')+`\nBaqi: ${fmtRs(num(o.orderTotal)-paid)}`+
      (o.deliveryDate?`\nDelivery: ${o.deliveryDate}`:'')+`\nShukriya!`;
  }
  window.sendOrderSummary=function(id){
    let o=orders.find(x=>x.id===id);if(!o)return;
    let p=getPartyById(o.partyId);
    if(!p||!p.phone){showToast('⚠️ Party ka phone number nahi — Parties mein add karein');return;}
    wa(p.phone,orderSummary(o));
  };
  window.hkOrderSummary=orderSummary;
  let origQuick=window.showOrderQuickActions;
  window.showOrderQuickActions=function(id){
    let r=origQuick.apply(this,arguments);
    let body=document.getElementById('paymentReceiptModalBody');
    let col=body&&body.querySelector('div[style*="flex-direction:column"]');
    if(col&&!col.querySelector('.hk-sum-btn'))col.insertAdjacentHTML('afterbegin',`<button class="btn btn-success hk-sum-btn" style="justify-content:center;" onclick="sendOrderSummary(${id})">💬 Party ko order WhatsApp karein</button>`);
    return r;
  };
  let origView=window.viewOrderDetail;
  window.viewOrderDetail=function(id){
    let r=origView.apply(this,arguments);
    let c=document.getElementById('orderDetailContent');
    if(c&&!c.querySelector('.hk-sum-btn'))c.insertAdjacentHTML('afterbegin',`<button class="btn btn-success btn-sm hk-sum-btn" style="margin-bottom:8px;" onclick="sendOrderSummary(${id})">💬 Party ko order WhatsApp karein</button>`);
    return r;
  };

  // ════════ 9. Voice entry ════════
  const URDU_DIGITS='۰۱۲۳۴۵۶۷۸۹',AR_DIGITS='٠١٢٣٤٥٦٧٨٩';
  function normDigits(s){return String(s).replace(/[۰-۹]/g,c=>URDU_DIGITS.indexOf(c)).replace(/[٠-٩]/g,c=>AR_DIGITS.indexOf(c));}
  // "kharcha bijli 5000" → expense; "payment Ali 20000" → payment. Forms open filled; you check and Save.
  function parseVoice(text){
    let t=normDigits(text).replace(/(\d)[,\s](?=\d{3}\b)/g,'$1');
    let nums=(t.match(/\d+(\.\d+)?/g)||[]).map(Number);
    let amount=nums.length?Math.max(...nums):0;
    if(/hazar|ہزار|thousand/i.test(t)&&amount&&amount<1000)amount*=1000;
    if(/lakh|لاکھ/i.test(t)&&amount&&amount<1000)amount*=100000;
    let lower=t.toLowerCase();
    let kind=/(kharch|kharcha|expense|خرچ|بل\b|bill)/i.test(lower)?'expense':/(payment|paiment|wasool|wusool|jama|received|وصول|ادائیگی|پیمنٹ|جمع)/i.test(lower)?'payment':'';
    let words=t.replace(/\d+(\.\d+)?/g,' ').replace(/(rupay|rupees|rs\.?|روپے|ہزار|hazar|lakh|لاکھ|kharcha|kharch|expense|خرچہ|خرچ|payment|paiment|پیمنٹ|wasool|وصول|jama|جمع|ka|ki|ke|کا|کی|کے|ne|نے|diye|dia|دیے|دیا|aaya|آیا|mila|ملا)/gi,' ').replace(/\s+/g,' ').trim();
    let party=null;
    if(kind==='payment'){
      let low=words.toLowerCase();
      party=parties.find(p=>low.includes(p.name.toLowerCase()))||parties.find(p=>p.name.toLowerCase().split(/\s+/).some(w=>w.length>2&&low.includes(w)));
    }
    return {kind,amount,words,party};
  }
  window.hkParseVoice=parseVoice;
  window.applyVoiceText=function(text){
    let v=parseVoice(text);
    if(v.kind==='expense'){
      openExpenseModal();
      setTimeout(()=>{let d=document.getElementById('expDesc'),a=document.getElementById('expAmount');if(d)d.value=v.words||'Kharcha';if(a&&v.amount)a.value=v.amount;},60);
      showToast('🎤 Kharcha bhar diya — check kar ke Save dabayein');return v;
    }
    if(v.kind==='payment'){
      if(v.party){openReceivePaymentModal(v.party.id);setTimeout(()=>{let a=document.getElementById('payAmount');if(a&&v.amount)a.value=v.amount;},60);showToast('🎤 '+v.party.name+' ki payment — check kar ke Save');}
      else{quickAddPayment();showToast('🎤 Party chunein'+(v.amount?' — raqam '+fmtRs(v.amount):''));}
      return v;
    }
    showToast('🎤 Samajh nahi aaya: "'+text+'" — kahein: "kharcha bijli 5000" ya "payment Ali 20000"');
    return v;
  };
  window.startVoice=function(){
    let SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){showToast('⚠️ Is browser mein awaaz se likhna nahi chalta — Google Chrome istemal karein');return;}
    let r=new SR();r.lang='ur-PK';r.interimResults=false;r.maxAlternatives=1;
    showToast('🎤 Boliye… maslan "kharcha bijli 5000"');
    r.onresult=e=>applyVoiceText(e.results[0][0].transcript);
    r.onerror=e=>showToast(e.error==='not-allowed'?'⚠️ Mic ki ijazat dein (browser settings)':'⚠️ Awaaz nahi suni — dobara koshish karein');
    try{r.start();}catch(e){}
  };

  document.addEventListener('hk:ready',()=>{
    addMenu('hkRemDrawerBtn','📣','Sab ko Yaad Dahani (Wasooli)','openBulkReminders()','tabKhata');
    addMenu('hkKarRepDrawerBtn','👷','Karigar Report (Mahana)','openKarigarReport()','tabLabour');
    addMenu('hkImportDrawerBtn','📥','Excel se Parties Layein','openImport()','tabParties');
    let right=document.querySelector('.header-right');
    if(right&&!document.getElementById('hkMicBtn'))right.insertAdjacentHTML('afterbegin','<button class="hdr-btn" id="hkMicBtn" onclick="startVoice()" title="Awaaz se likhein">🎤</button>');
  });
})();
