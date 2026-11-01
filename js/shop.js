// HK Wood Doors ERP — shop running costs and tools
//   • Monthly bills (rent, bijli, gas…): reminder before the due day, one tap to pay
//     (the payment is written into Kharcha automatically)
//   • Rate list PDF: a clean one-page table of designs and rates, plus WhatsApp text
//   • Tools & machines: who has which tool, machine repairs and next service date
//   • Monthly sales target: progress on Home, how much is left and how much per day
(function(){
  function num(v){return parseFloat(v)||0;}
  function today(){return new Date().toISOString().slice(0,10);}
  function monthKey(){return today().slice(0,7);}
  function monthName(key){let [y,m]=key.split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('en-PK',{month:'short',year:'numeric'});}
  function daysInMonth(key){let [y,m]=key.split('-').map(Number);return new Date(y,m,0).getDate();}
  function addDays(d,n){let x=new Date(d+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);}
  function isStaff(){return typeof hkIsStaff==='function'&&hkIsStaff();}
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
  function addMenu(id,icon,label,fn,afterSel){
    if(document.getElementById(id))return;
    let anchor=document.querySelector(afterSel);if(!anchor)return;
    anchor.insertAdjacentHTML('afterend',`<button class="drawer-item" id="${id}" onclick="${fn};closeDrawer();"><span class="t-icon">${icon}</span>${label}</button>`);
  }
  function val(id){return document.getElementById(id)?.value??'';}
  function addExpense(description,amount,category,extra){
    let now=new Date().toISOString();
    expenses.push(Object.assign({id:newId(),description,amount,date:today(),category,createdAt:now,updatedAt:now},extra||{}));
  }

  // ════════ 21. Monthly bills ════════
  const BILL_CATS=['Kiraya','Bijli','Gas','Pani','Internet / Phone','Doosra'];
  const BILL_QUICK=[['Dukaan ka kiraya','Kiraya'],['Bijli ka bill','Bijli'],['Gas ka bill','Gas'],['Pani ka bill','Pani'],['Internet / Phone','Internet / Phone']];
  function billDue(b,key){return key+'-'+String(Math.min(Math.max(1,parseInt(b.day)||1),daysInMonth(key))).padStart(2,'0');}
  function billPaid(b,key){return expenses.find(e=>e.billId===b.id&&e.billMonth===key);}
  function billState(b){
    let key=monthKey(),paid=billPaid(b,key),due=billDue(b,key),t=today();
    if(paid)return {key,due,paid,tone:'good',text:`✅ Ada — ${fmtRs(paid.amount)} (${paid.date})`};
    if(due<t)return {key,due,tone:'bad',text:`❗ Tareekh guzar gayi (${due})`};
    if(due<=addDays(t,3))return {key,due,tone:'warn',text:`⏰ ${due===t?'Aaj':due} ada karna hai`};
    return {key,due,tone:'',text:`📅 ${due} tak`};
  }

  window.openBills=function(){
    let key=monthKey();
    let rows=monthlyBills.slice().sort((a,b)=>(parseInt(a.day)||1)-(parseInt(b.day)||1)).map(b=>{
      let s=billState(b);
      let color=s.tone==='bad'?'var(--red,#c0392b)':s.tone==='warn'?'#b45309':s.tone==='good'?'var(--green,#15803d)':'var(--gray-500)';
      return `<div class="khata-card" style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
          <div><b>${esc(b.name)}</b><div style="font-size:9px;color:var(--gray-500);">${esc(b.category||'')} · har mahine ${parseInt(b.day)||1} tareekh · ${fmtRs(b.amount)}</div>
          <div style="font-size:9.5px;color:${color};margin-top:2px;">${s.text}</div></div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            ${s.paid?'':`<button class="btn btn-primary btn-xs" onclick="payBill(${b.id})">✅ Ada</button>`}
            <button class="btn btn-outline btn-xs" onclick="editBill(${b.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteMonthlyBill(${b.id})">🗑</button>
          </div>
        </div></div>`;
    }).join('');
    let unpaid=monthlyBills.filter(b=>!billPaid(b,key));
    let paidSum=monthlyBills.reduce((s,b)=>s+num((billPaid(b,key)||{}).amount),0);
    modal('hkBillsModal','🧾 Mahana Bill (Kiraya, Bijli…)',`
      <p style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">Har mahine ke bill ek dafa yahan likh dein. Tareekh se 3 din pehle Home par yaad dahani aayegi. "✅ Ada" dabane se raqam khud Kharcha mein likh di jayegi.</p>
      <div style="display:flex;gap:8px;margin-bottom:8px;font-size:10px;">
        <div class="khata-card" style="flex:1;margin:0;">${monthName(key)} ada<br><b>${fmtRs(paidSum)}</b></div>
        <div class="khata-card" style="flex:1;margin:0;">Baqi bill<br><b>${unpaid.length} · ${fmtRs(unpaid.reduce((s,b)=>s+num(b.amount),0))}</b></div>
      </div>
      ${rows||'<div class="empty-state"><div class="e-icon">🧾</div><p>Abhi koi bill nahi — neeche se add karein</p></div>'}
      <button class="btn btn-primary" style="width:100%;margin-top:6px;" onclick="editBill()">+ Naya Bill</button>`);
  };

  window.editBill=function(id){
    let b=id?monthlyBills.find(x=>x.id===id):null;
    modal('hkBillsModal',b?'✏️ Bill badlein':'+ Naya Bill',`
      ${b?'':`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">${BILL_QUICK.map(([n,c])=>`<button class="btn btn-outline btn-xs" onclick="document.getElementById('hkBillName').value='${n}';document.getElementById('hkBillCat').value='${c}';">${n}</button>`).join('')}</div>`}
      <div class="form-group"><label class="form-label">Naam</label><input class="form-input" id="hkBillName" value="${esc(b?b.name:'')}" placeholder="maslan Dukaan ka kiraya"></div>
      <div class="form-group"><label class="form-label">Qism</label><select class="form-input" id="hkBillCat">${BILL_CATS.map(c=>`<option ${b&&b.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
      <div style="display:flex;gap:8px;">
        <div class="form-group" style="flex:1;"><label class="form-label">Andazan raqam</label><input class="form-input" type="number" id="hkBillAmt" value="${b?num(b.amount):''}" placeholder="Rs"></div>
        <div class="form-group" style="flex:1;"><label class="form-label">Har mahine tareekh</label><input class="form-input" type="number" min="1" max="31" id="hkBillDay" value="${b?parseInt(b.day)||1:10}"></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-primary" style="flex:1;" onclick="saveBill(${b?b.id:'null'})">💾 Save</button>
        <button class="btn btn-outline" style="flex:1;" onclick="openBills()">Wapas</button>
      </div>`);
  };

  window.saveBill=function(id){
    let name=val('hkBillName').trim(),amount=num(val('hkBillAmt')),day=parseInt(val('hkBillDay'));
    if(!name){showToast('⚠️ Bill ka naam likhein');return;}
    if(!(day>=1&&day<=31)){showToast('⚠️ Tareekh 1 se 31 tak');return;}
    let data={name,category:val('hkBillCat'),amount,day,updatedAt:new Date().toISOString()};
    let b=id?monthlyBills.find(x=>x.id===id):null;
    if(b)Object.assign(b,data);else monthlyBills.push(Object.assign({id:newId(),createdAt:data.updatedAt},data));
    saveAll();showToast('✅ Bill save ho gaya');openBills();try{renderHome();}catch(e){}
  };

  window.payBill=function(id){
    let b=monthlyBills.find(x=>x.id===id);if(!b)return;
    let key=monthKey();
    if(billPaid(b,key)){showToast('✅ Is mahine ka pehle se ada hai');return;}
    modal('hkBillsModal','✅ '+b.name+' — '+monthName(key),`
      <div class="form-group"><label class="form-label">Kitni raqam di? (bill har mahine badal sakta hai)</label>
        <input class="form-input" type="number" id="hkBillPayAmt" value="${num(b.amount)||''}"></div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-primary" style="flex:1;" onclick="confirmBillPay(${b.id})">✅ Ada kar diya</button>
        <button class="btn btn-outline" style="flex:1;" onclick="openBills()">Wapas</button>
      </div>`);
    setTimeout(()=>document.getElementById('hkBillPayAmt')?.select(),50);
  };
  window.confirmBillPay=function(id){
    let b=monthlyBills.find(x=>x.id===id);if(!b)return;
    let key=monthKey(),amount=num(val('hkBillPayAmt'));
    if(amount<=0){showToast('⚠️ Raqam likhein');return;}
    if(billPaid(b,key)){openBills();return;}
    addExpense(`${b.name} (${monthName(key)})`,amount,b.category||'Bill',{billId:b.id,billMonth:key});
    saveAll();renderAll();
    showToast('✅ Ada — Kharcha mein likh diya');
    openBills();
  };

  window.deleteMonthlyBill=function(id){
    let b=monthlyBills.find(x=>x.id===id);if(!b)return;
    customConfirm(`"${b.name}" ki yaad dahani hata dein? (Pehle diye gaye bill Kharcha mein rahenge)`,()=>{
      monthlyBills=monthlyBills.filter(x=>x.id!==id);
      saveAll();openBills();try{renderHome();}catch(e){}
    },{danger:true,okText:'Hata dein'});
  };

  // ════════ 22. Rate list PDF ════════
  function rateRows(){return priceList.filter(p=>String(p.size||'').trim());}
  function rateListHTML(elId){
    let bp=businessProfile||{};
    let rows=rateRows().map((p,i)=>`<tr style="background:${i%2?'#f7f9fc':'#fff'};">
        <td style="padding:9px 12px;border-bottom:1px solid #e8ecf3;color:#6b7a90;width:40px;">${i+1}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e8ecf3;font-weight:600;">${esc(p.size)}</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e8ecf3;text-align:right;font-weight:800;color:#92400e;">${fmtRs(p.rate)}</td>
      </tr>`).join('');
    return `<div id="${elId}" style="font-family:'Segoe UI',sans-serif;width:760px;box-sizing:border-box;padding:34px 40px;background:#fff;color:#1a2a3a;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #c8963e;padding-bottom:12px;">
        <div><div style="font-size:24px;font-weight:800;color:#1a3a6a;">${esc(bp.name||'HK WOOD DOORS')}</div>
          ${bp.tagline?`<div style="font-size:11px;color:#6b7a90;">${esc(bp.tagline)}</div>`:''}
          <div style="font-size:10.5px;color:#6b7a90;margin-top:4px;">${[bp.phone,bp.whatsapp&&bp.whatsapp!==bp.phone?'WhatsApp '+bp.whatsapp:'',[bp.address,bp.city].filter(Boolean).join(', ')].filter(Boolean).map(esc).join(' · ')}</div></div>
        <div style="text-align:right;"><div style="font-size:16px;font-weight:800;letter-spacing:3px;color:#1a3a6a;">RATE LIST</div>
          <div style="font-size:10px;color:#6b7a90;">${new Date().toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'})}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:12.5px;">
        <thead><tr style="background:#1a3a6a;color:#fff;">
          <th style="padding:9px 12px;text-align:left;">#</th><th style="padding:9px 12px;text-align:left;">Design</th><th style="padding:9px 12px;text-align:right;">Rate / sq.ft</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:9.5px;color:#9ca7b8;margin-top:16px;font-style:italic;">Rates subject to change without prior notice. Final price will be confirmed at time of order.</p>
      <div style="text-align:center;font-size:10.5px;color:#c8963e;font-weight:700;margin-top:12px;">${esc(bp.footerNote||'Thank You for Your Business')}</div>
    </div>`;
  }
  function rateListText(){
    let bp=businessProfile||{};
    return `*${bp.name||'HK WOOD DOORS'} — Rate List*\n${new Date().toLocaleDateString('en-PK')}\n\n`+
      rateRows().map((p,i)=>`${i+1}. ${p.size} — ${fmtRs(p.rate)} / sq.ft`).join('\n')+
      `\n\n${bp.phone?'📞 '+bp.phone:''}`;
  }
  window.openRateListPdf=function(){
    if(!rateRows().length){showToast('⚠️ Pehle Rate List mein design aur rate likhein');openPriceListModal();return;}
    modal('hkRatePdfModal','📄 Rate List PDF',`
      <p style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">Rate List mein jo designs aur rates hain, unki saaf PDF banti hai. Rate badalne ke liye "Rate / Price List" kholein.</p>
      <div style="overflow:auto;max-height:46vh;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;">
        <div style="transform-origin:top left;transform:scale(.45);width:760px;height:0;">${rateListHTML('hkRatePreview')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <button class="btn btn-primary" onclick="downloadRateListPdf()">📄 Table wali PDF banayein</button>
        ${typeof downloadCatalogPDF==='function'?'<button class="btn btn-outline" onclick="downloadCatalogPDF()">🖼️ Photos wali PDF banayein</button>':''}
        <button class="btn btn-outline" onclick="sendRateListWA()">💬 WhatsApp par likh kar bhejein</button>
      </div>`);
    // Preview box height follows the scaled table.
    setTimeout(()=>{let p=document.getElementById('hkRatePreview');if(p)p.parentElement.style.height=Math.ceil(p.offsetHeight*.45)+'px';},30);
  };
  window.downloadRateListPdf=function(){
    let temp=document.createElement('div');
    temp.innerHTML=rateListHTML('hkRatePdfContent');
    temp.style.cssText='position:fixed;left:0;top:0;width:760px;background:#fff;z-index:150;pointer-events:none;';
    document.body.appendChild(temp);
    return downloadPDF('hkRatePdfContent',`Rate_List_${today()}.pdf`).finally(()=>temp.remove());
  };
  window.sendRateListWA=function(){window.open('https://wa.me/?text='+encodeURIComponent(rateListText()),'_blank');};
  window.hkRateListHTML=rateListHTML;

  // A shortcut inside the Rate List screen as well.
  let origRenderPL=window.renderPriceListModalBody;
  if(origRenderPL)window.renderPriceListModalBody=function(){
    let r=origRenderPL.apply(this,arguments);
    let body=document.getElementById('priceListModalBody');
    let save=body&&body.querySelector('button[onclick="savePriceList()"]');
    if(save&&!document.getElementById('hkRatePdfBtn'))save.insertAdjacentHTML('afterend','<button class="btn btn-outline" id="hkRatePdfBtn" onclick="savePriceList();openRateListPdf()">📄 Rate List PDF</button>');
    return r;
  };

  // ════════ 23. Tools & machines ════════
  function holderName(t){return t.karigarId!=null&&t.karigarId!==''?((karigars.find(k=>String(k.id)===String(t.karigarId))||{}).name||'Karigar (hata diya gaya)'):'Dukaan mein';}
  function nextService(t){return t.kind==='machine'&&num(t.serviceDays)>0?addDays(t.lastService||String(t.createdAt||today()).slice(0,10),num(t.serviceDays)):'';}
  let toolFilter='';
  window.openTools=function(filter){
    if(filter!==undefined)toolFilter=filter;
    let t0=today(),soon=addDays(t0,3);
    let list=shopTools.filter(t=>!toolFilter||(toolFilter==='shop'?holderName(t)==='Dukaan mein':String(t.karigarId)===String(toolFilter)))
      .sort((a,b)=>(a.kind===b.kind?0:a.kind==='machine'?-1:1)||String(a.name).localeCompare(String(b.name)));
    let rows=list.map(t=>{
      let ns=nextService(t);
      let svc=ns?(ns<t0?`<span style="color:var(--red,#c0392b);">❗ Service ki tareekh guzar gayi (${ns})</span>`:ns<=soon?`<span style="color:#b45309;">⏰ Service ${ns}</span>`:`Agli service ${ns}`):'';
      let last=(t.log||[]).slice(-1)[0];
      return `<div class="khata-card" style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;gap:6px;align-items:center;">
          <div style="min-width:0;"><b>${t.kind==='machine'?'⚙️':'🔨'} ${esc(t.name)}</b>${num(t.qty)>1?` ×${num(t.qty)}`:''}
            <div style="font-size:9px;color:var(--gray-500);">👤 ${esc(holderName(t))}${t.lastService?` · Pichhli marammat ${t.lastService}`:''}</div>
            ${svc?`<div style="font-size:9px;">${svc}</div>`:''}
            ${last?`<div style="font-size:8.5px;color:var(--gray-500);">📝 ${esc(last.date)} — ${esc(last.text)}${num(last.cost)?' ('+fmtRs(last.cost)+')':''}</div>`:''}
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn btn-outline btn-xs" onclick="giveTool(${t.id})">👤 Dein</button>
            <button class="btn btn-outline btn-xs" onclick="repairTool(${t.id})">🔧 Marammat</button>
            <button class="btn btn-outline btn-xs" onclick="editTool(${t.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteShopTool(${t.id})">🗑</button>
          </div>
        </div></div>`;
    }).join('');
    let opts=`<option value="">Sab (${shopTools.length})</option><option value="shop" ${toolFilter==='shop'?'selected':''}>Dukaan mein</option>`+
      karigars.map(k=>`<option value="${k.id}" ${String(toolFilter)===String(k.id)?'selected':''}>${esc(k.name)} ke paas (${shopTools.filter(t=>String(t.karigarId)===String(k.id)).length})</option>`).join('');
    modal('hkToolsModal','🛠️ Auzaar aur Machinen',`
      <p style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">Kaun sa auzaar kis karigar ke paas hai, aur machine ki marammat kab hui. Machine ki service ki tareekh qareeb ho to Home par yaad dahani aati hai.</p>
      <select class="form-input" style="margin-bottom:8px;" onchange="openTools(this.value)">${opts}</select>
      ${rows||'<div class="empty-state"><div class="e-icon">🛠️</div><p>Koi auzaar nahi</p></div>'}
      <button class="btn btn-primary" style="width:100%;margin-top:6px;" onclick="editTool()">+ Naya Auzaar / Machine</button>`);
  };
  function karigarSelect(id,cur){
    return `<select class="form-input" id="${id}"><option value="">🏪 Dukaan mein</option>${karigars.map(k=>`<option value="${k.id}" ${String(cur)===String(k.id)?'selected':''}>${esc(k.name)}</option>`).join('')}</select>`;
  }
  window.editTool=function(id){
    let t=id?shopTools.find(x=>x.id===id):null;
    let kind=t?t.kind:'tool';
    modal('hkToolsModal',t?'✏️ '+t.name:'+ Naya Auzaar / Machine',`
      <div class="form-group"><label class="form-label">Naam</label><input class="form-input" id="hkToolName" value="${esc(t?t.name:'')}" placeholder="maslan Drill machine, Randa, Aari"></div>
      <div style="display:flex;gap:8px;">
        <div class="form-group" style="flex:1;"><label class="form-label">Qism</label><select class="form-input" id="hkToolKind" onchange="document.getElementById('hkToolSvc').style.display=this.value==='machine'?'':'none'">
          <option value="tool" ${kind==='tool'?'selected':''}>🔨 Auzaar</option><option value="machine" ${kind==='machine'?'selected':''}>⚙️ Machine</option></select></div>
        <div class="form-group" style="flex:1;"><label class="form-label">Tadaad</label><input class="form-input" type="number" min="1" id="hkToolQty" value="${t?num(t.qty)||1:1}"></div>
      </div>
      <div class="form-group"><label class="form-label">Kis ke paas hai</label>${karigarSelect('hkToolHolder',t?t.karigarId:'')}</div>
      <div id="hkToolSvc" style="${kind==='machine'?'':'display:none'}">
        <div style="display:flex;gap:8px;">
          <div class="form-group" style="flex:1;"><label class="form-label">Pichhli marammat / service</label><input class="form-input" type="date" id="hkToolLast" value="${t&&t.lastService||''}"></div>
          <div class="form-group" style="flex:1;"><label class="form-label">Har kitne din baad service</label><input class="form-input" type="number" id="hkToolEvery" value="${t&&num(t.serviceDays)?num(t.serviceDays):''}" placeholder="maslan 90"></div>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="hkToolNote" value="${esc(t&&t.note||'')}" placeholder="company, model, qeemat…"></div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-primary" style="flex:1;" onclick="saveTool(${t?t.id:'null'})">💾 Save</button>
        <button class="btn btn-outline" style="flex:1;" onclick="openTools()">Wapas</button>
      </div>`);
  };
  window.saveTool=function(id){
    let name=val('hkToolName').trim();
    if(!name){showToast('⚠️ Naam likhein');return;}
    let holder=val('hkToolHolder');
    let data={name,kind:val('hkToolKind')||'tool',qty:Math.max(1,parseInt(val('hkToolQty'))||1),karigarId:holder?parseInt(holder):null,note:val('hkToolNote').trim(),updatedAt:new Date().toISOString()};
    if(data.kind==='machine'){data.lastService=val('hkToolLast');data.serviceDays=num(val('hkToolEvery'));}
    let t=id?shopTools.find(x=>x.id===id):null;
    if(t){
      if(String(t.karigarId)!==String(data.karigarId))(t.log=t.log||[]).push({date:today(),text:`${holderName(Object.assign({},t,data))} ko diya`});
      Object.assign(t,data);
    }else shopTools.push(Object.assign({id:newId(),createdAt:data.updatedAt,log:[]},data));
    saveAll();showToast('✅ Save ho gaya');openTools();try{renderHome();}catch(e){}
  };
  window.giveTool=function(id){
    let t=shopTools.find(x=>x.id===id);if(!t)return;
    modal('hkToolsModal','👤 '+t.name+' — kis ko diya?',`
      <div class="form-group">${karigarSelect('hkToolGive',t.karigarId)}</div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-primary" style="flex:1;" onclick="confirmGiveTool(${t.id})">✅ Save</button>
        <button class="btn btn-outline" style="flex:1;" onclick="openTools()">Wapas</button>
      </div>`);
  };
  window.confirmGiveTool=function(id){
    let t=shopTools.find(x=>x.id===id);if(!t)return;
    let v=val('hkToolGive'),k=v?parseInt(v):null;
    if(String(t.karigarId)!==String(k)){
      t.karigarId=k;t.updatedAt=new Date().toISOString();
      (t.log=t.log||[]).push({date:today(),text:k==null?'Dukaan mein wapas':`${holderName(t)} ko diya`});
      saveAll();
    }
    openTools();
  };
  window.repairTool=function(id){
    let t=shopTools.find(x=>x.id===id);if(!t)return;
    modal('hkToolsModal','🔧 '+t.name+' — marammat / service',`
      <div class="form-group"><label class="form-label">Kya kaam hua</label><input class="form-input" id="hkRepText" placeholder="maslan belt badli, dhaar lagwai"></div>
      <div style="display:flex;gap:8px;">
        <div class="form-group" style="flex:1;"><label class="form-label">Kharcha (Rs)</label><input class="form-input" type="number" id="hkRepCost" placeholder="0"></div>
        <div class="form-group" style="flex:1;"><label class="form-label">Tareekh</label><input class="form-input" type="date" id="hkRepDate" value="${today()}"></div>
      </div>
      <p style="font-size:8.5px;color:var(--gray-500);">Kharcha likha ho to woh khud Kharcha (Marammat) mein bhi chala jayega.</p>
      ${(t.log||[]).length?`<div style="font-size:9px;margin:6px 0;max-height:120px;overflow:auto;border-top:1px solid var(--border);padding-top:6px;">${t.log.slice().reverse().map(l=>`<div>${esc(l.date)} — ${esc(l.text)}${num(l.cost)?' ('+fmtRs(l.cost)+')':''}</div>`).join('')}</div>`:''}
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-primary" style="flex:1;" onclick="saveRepair(${t.id})">✅ Save</button>
        <button class="btn btn-outline" style="flex:1;" onclick="openTools()">Wapas</button>
      </div>`);
  };
  window.saveRepair=function(id){
    let t=shopTools.find(x=>x.id===id);if(!t)return;
    let text=val('hkRepText').trim()||'Marammat / service',cost=num(val('hkRepCost')),date=val('hkRepDate')||today();
    (t.log=t.log||[]).push({date,text,cost});
    if(!t.lastService||date>t.lastService)t.lastService=date;
    t.updatedAt=new Date().toISOString();
    if(cost>0)addExpense(`${t.name}: ${text}`,cost,'Marammat',{toolId:t.id,date});
    saveAll();if(cost>0)renderAll();
    showToast(cost>0?'✅ Save — Kharcha mein bhi likh diya':'✅ Save ho gaya');
    openTools();
  };
  window.deleteShopTool=function(id){
    let t=shopTools.find(x=>x.id===id);if(!t)return;
    customConfirm(`"${t.name}" list se hata dein?`,()=>{
      shopTools=shopTools.filter(x=>x.id!==id);saveAll();openTools();try{renderHome();}catch(e){}
    },{danger:true,okText:'Hata dein'});
  };

  // ════════ 24. Monthly sales target ════════
  function monthSale(key){return orders.filter(o=>String(o.date||'').startsWith(key)).reduce((s,o)=>s+num(o.orderTotal),0);}
  function renderTarget(){
    let k=document.getElementById('hmKpis');if(!k)return;
    let box=document.getElementById('hmTarget');
    if(!box){box=document.createElement('div');box.id='hmTarget';box.className='hm-target';k.insertAdjacentElement('afterend',box);}
    let target=num(businessProfile.salesTarget);
    if(!target){
      box.innerHTML=isStaff()?'':`<button class="hm-target-set" onclick="setSalesTarget()">🎯 Is mahine ki sale ka hadaf (target) lagayein</button>`;
      return;
    }
    let key=monthKey(),sale=monthSale(key),pct=Math.min(100,Math.round(sale/target*100));
    let left=Math.max(0,target-sale),dayNow=parseInt(today().slice(8,10)),days=daysInMonth(key)-dayNow+1;
    let pace=sale/Math.max(1,dayNow)*daysInMonth(key); // where this month ends at today's speed
    let msg=left<=0?`🎉 Hadaf pura! ${fmtRs(sale-target)} zyada`
      :`${fmtRs(left)} baqi · ${days} din · roz ${fmtRs(Math.ceil(left/days))} chahiye`;
    let tone=left<=0||dayNow<5?'good':pace>=target?'good':pace>=target*.8?'warn':'bad';
    box.innerHTML=`<button class="hm-target-card" onclick="${isStaff()?'':'setSalesTarget()'}">
      <div class="hm-target-top"><span>🎯 Mahine ka hadaf ${fmtRs(target)}</span><b>${pct}%</b></div>
      <div class="hm-target-bar"><div class="hm-target-fill ${tone}" style="width:${pct}%"></div></div>
      <div class="hm-target-msg">${msg}${left>0&&dayNow>=5?` · is raftaar se ${fmtRs(Math.round(pace))} tak`:''}</div>
    </button>`;
  }
  window.setSalesTarget=function(){
    let cur=num(businessProfile.salesTarget),last=monthSale((()=>{let d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');})());
    modal('hkTargetModal','🎯 Mahine ki sale ka hadaf',`
      <p style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">Har mahine kitne ke orders lene hain? Home par roz dikhega kitna pura hua aur roz kitna chahiye.${last?` Pichhle mahine ${fmtRs(last)} ki sale hui thi.`:''}</p>
      <div class="form-group"><label class="form-label">Hadaf (Rs)</label><input class="form-input" type="number" id="hkTargetAmt" value="${cur||''}" placeholder="maslan 1000000"></div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-primary" style="flex:1;" onclick="saveSalesTarget()">💾 Save</button>
        ${cur?'<button class="btn btn-outline" style="flex:1;" onclick="document.getElementById(\'hkTargetAmt\').value=\'\';saveSalesTarget()">Hata dein</button>':''}
      </div>`);
  };
  window.saveSalesTarget=function(){
    let v=num(val('hkTargetAmt'));
    if(v>0)businessProfile.salesTarget=v;else delete businessProfile.salesTarget;
    saveAll();closeModal('hkTargetModal');renderTarget();
    showToast(v>0?'🎯 Hadaf lag gaya':'Hadaf hata diya');
  };
  window.hkRenderTarget=renderTarget;

  let origRenderDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    let r=origRenderDashboard.apply(this,arguments);
    try{renderTarget();}catch(e){console.warn('Target:',e);}
    return r;
  };

  // ════════ Home reminders ════════
  (window.hkAttentionSources=window.hkAttentionSources||[]).push(()=>{
    let due=monthlyBills.map(b=>({b,s:billState(b)})).filter(x=>x.s.tone==='bad'||x.s.tone==='warn');
    if(!due.length)return [];
    let late=due.some(x=>x.s.tone==='bad');
    return [{icon:'🧾',tone:late?'bad':'warn',text:`${due.length===1?due[0].b.name:due.length+' bill'} ${late?'— tareekh guzar gayi':'— jald ada karna hai'}`,amt:due.reduce((s,x)=>s+num(x.b.amount),0),go:'openBills()'}];
  });
  (window.hkAttentionSources=window.hkAttentionSources||[]).push(()=>{
    let soon=addDays(today(),3);
    let due=shopTools.filter(t=>{let n=nextService(t);return n&&n<=soon;});
    if(!due.length)return [];
    return [{icon:'⚙️',tone:'info',text:`${due.length===1?due[0].name:due.length+' machinon'} ki service ka waqt`,go:'openTools()'}];
  });

  document.addEventListener('hk:ready',()=>{
    addMenu('hkBillsBtn','🧾','Mahana Bill (Kiraya, Bijli)','openBills()','.drawer-item[data-tab="tabExpenses"]');
    addMenu('hkTargetBtn','🎯','Mahine ka Hadaf (Target)','setSalesTarget()','.drawer-item[data-tab="tabReports"]');
    addMenu('hkRatePdfMenu','📄','Rate List PDF','openRateListPdf()','.drawer-item[onclick*="openPriceListModal"]');
    addMenu('hkToolsBtn','🛠️','Auzaar aur Machinen','openTools()','.drawer-item[onclick*="openKarigarList"]');
    try{renderTarget();}catch(e){}
  });
})();
