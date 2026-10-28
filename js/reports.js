// HK Wood Doors ERP — monthly party statements, monthly profit report,
// Excel export, and QR labels that open the order.
(function(){
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function monthKeyNow(){let d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
  function monthLabel(key){let [y,m]=key.split('-');return MONTHS[parseInt(m)-1]+' '+y;}
  function inMonth(date,key){return String(date||'').slice(0,7)===key;}
  function num(v){return parseFloat(v)||0;}
  function monthOptions(selected){
    let out=[],d=new Date();
    for(let i=0;i<24;i++){
      let x=new Date(d.getFullYear(),d.getMonth()-i,1);
      let k=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');
      out.push(`<option value="${k}" ${k===selected?'selected':''}>${monthLabel(k)}</option>`);
    }
    return out.join('');
  }
  function ensureModal(id,title){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:640px;"><div class="modal-head">${title} <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}Body"></div></div>`;
      document.body.appendChild(m);
    }
    return m;
  }
  function show(id){let m=document.getElementById(id);if(!m.classList.contains('open'))openModal(id);}
  function pdfFromHTML(html,elId,filename){
    let temp=document.createElement('div');
    temp.innerHTML=html;
    temp.style.cssText='position:fixed;left:0;top:0;width:800px;background:#fff;z-index:150;pointer-events:none;';
    document.body.appendChild(temp);
    return downloadPDF(elId,filename).finally(()=>temp.remove());
  }
  function pdfHeader(title,sub){
    return `<div style="text-align:center;border-bottom:2px solid #c8963e;padding-bottom:10px;margin-bottom:14px;">
      <h1 style="font-size:22px;margin:0;">${esc(businessProfile.name||'HK WOOD DOORS')}</h1>
      <p style="font-size:11px;color:#666;margin:4px 0 0;">${esc(businessProfile.phone||'')} ${businessProfile.address?'· '+esc(businessProfile.address):''}</p>
      <h2 style="font-size:16px;margin:10px 0 0;">${esc(title)}</h2>
      ${sub?`<p style="font-size:11px;color:#666;margin:4px 0 0;">${esc(sub)}</p>`:''}
    </div>`;
  }
  function waPhone(phone){
    let p=String(phone||'').replace(/[^0-9]/g,'');
    if(p.startsWith('0'))p='92'+p.slice(1);
    return p;
  }

  // ── Monthly party statement ──
  function partyStatement(p,key){
    let entries=buildPartyLedgerEntries(p);
    let opening=0,rows=[],sale=0,received=0;
    entries.forEach(e=>{
      let k=String(e.date||'').slice(0,7);
      if(k<key||e.date==='—'){opening=e.balance;}
      else if(k===key){rows.push(e);sale+=e.debit;received+=e.credit;}
    });
    return {opening,rows,sale,received,closing:opening+sale-received};
  }
  let stMonth=monthKeyNow();

  window.openStatements=function(key){
    if(key)stMonth=key;
    ensureModal('hkStatementModal','📅 Mahana Statement');
    let list=parties.map(p=>({p,s:partyStatement(p,stMonth)}))
      .filter(x=>x.s.rows.length||Math.round(x.s.closing)!==0)
      .sort((a,b)=>b.s.closing-a.s.closing);
    let tot=list.reduce((t,x)=>({sale:t.sale+x.s.sale,rec:t.rec+x.s.received,bal:t.bal+x.s.closing}),{sale:0,rec:0,bal:0});
    document.getElementById('hkStatementModalBody').innerHTML=`
      <select class="form-input" style="margin-bottom:8px;" onchange="openStatements(this.value)">${monthOptions(stMonth)}</select>
      <div class="stats" style="margin-bottom:8px;">
        <div class="stat-card gold"><div class="num">${fmtRs(tot.sale)}</div><div class="lbl">Is mahine maal</div></div>
        <div class="stat-card green"><div class="num">${fmtRs(tot.rec)}</div><div class="lbl">Wasooli</div></div>
        <div class="stat-card red"><div class="num">${fmtRs(tot.bal)}</div><div class="lbl">Kul baqaya</div></div>
      </div>
      <button class="btn btn-gold btn-sm" style="margin-bottom:8px;" onclick="downloadAllStatementsPDF()">📄 Sab parties ki list PDF</button>
      ${list.length?list.map(({p,s})=>`
        <div style="padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;gap:6px;font-size:11px;"><strong>${esc(p.name)}</strong><strong style="color:${s.closing>0?'var(--red)':'#16a34a'};">${fmtRs(s.closing)}</strong></div>
          <div style="font-size:9px;color:var(--gray-500);margin:2px 0 6px;">Pichhla ${fmtRs(s.opening)} · Maal ${fmtRs(s.sale)} · Wasooli ${fmtRs(s.received)}</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-gold btn-xs" onclick="downloadStatementPDF(${p.id})">📄 PDF / Share</button>
            <button class="btn btn-outline btn-xs" onclick="sendStatementWhatsApp(${p.id})">💬 WhatsApp</button>
          </div>
        </div>`).join(''):'<div class="empty-state"><p>Is mahine koi hisaab nahi</p></div>'}`;
    show('hkStatementModal');
  };

  window.downloadStatementPDF=function(partyId){
    let p=getPartyById(partyId);if(!p)return;
    let s=partyStatement(p,stMonth);
    let td='padding:6px 8px;border:1px solid #e2e8f0;';
    let html=`<div id="hkStmtPdf" style="font-family:sans-serif;padding:24px;background:#fff;color:#111;">
      ${pdfHeader('Hisaab Statement — '+monthLabel(stMonth),p.name+(p.phone?' · '+p.phone:''))}
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#1a3a6a;color:#fff;"><th style="${td}text-align:left;">Date</th><th style="${td}text-align:left;">Detail</th><th style="${td}text-align:left;">Ref</th><th style="${td}text-align:right;">Maal</th><th style="${td}text-align:right;">Wasooli</th><th style="${td}text-align:right;">Baqaya</th></tr></thead>
        <tbody>
          <tr style="background:#fdf6e9;"><td style="${td}" colspan="5"><b>Pichhla baqaya</b></td><td style="${td}text-align:right;"><b>${fmtRs(s.opening)}</b></td></tr>
          ${s.rows.map((e,i)=>`<tr style="background:${i%2?'#f4f7fb':'#fff'};"><td style="${td}">${esc(e.date)}</td><td style="${td}">${esc(e.type)}</td><td style="${td}">${esc(e.ref)}</td><td style="${td}text-align:right;">${e.debit?fmtRs(e.debit):''}</td><td style="${td}text-align:right;">${e.credit?fmtRs(e.credit):''}</td><td style="${td}text-align:right;">${fmtRs(e.balance)}</td></tr>`).join('')}
          ${s.rows.length?'':`<tr><td style="${td}text-align:center;color:#888;" colspan="6">Is mahine koi nayi entry nahi</td></tr>`}
        </tbody>
      </table>
      <table style="width:60%;margin:14px 0 0 auto;border-collapse:collapse;font-size:13px;">
        <tr><td style="${td}">Pichhla baqaya</td><td style="${td}text-align:right;">${fmtRs(s.opening)}</td></tr>
        <tr><td style="${td}">Is mahine maal</td><td style="${td}text-align:right;">${fmtRs(s.sale)}</td></tr>
        <tr><td style="${td}">Is mahine wasooli</td><td style="${td}text-align:right;">− ${fmtRs(s.received)}</td></tr>
        <tr style="background:#1a3a6a;color:#fff;font-weight:700;"><td style="${td}">Kul baqaya</td><td style="${td}text-align:right;">${fmtRs(s.closing)}</td></tr>
      </table>
      <p style="text-align:center;font-size:11px;color:#666;margin-top:18px;">${esc(businessProfile.footerNote||'Shukriya')}</p>
    </div>`;
    pdfFromHTML(html,'hkStmtPdf',`Statement_${p.name.replace(/\s+/g,'_')}_${stMonth}.pdf`);
  };

  window.sendStatementWhatsApp=function(partyId){
    let p=getPartyById(partyId);if(!p)return;
    if(!p.phone){showToast('⚠️ Is party ka phone number nahi hai');return;}
    let s=partyStatement(p,stMonth);
    let msg=`Assalam-o-Alaikum ${p.name},\n${businessProfile.name||'HK Wood Doors'} — ${monthLabel(stMonth)} ka hisaab:\n`+
      `Pichhla baqaya: ${fmtRs(s.opening)}\nIs mahine maal: ${fmtRs(s.sale)}\nIs mahine wasooli: ${fmtRs(s.received)}\n*Kul baqaya: ${fmtRs(s.closing)}*\nShukriya.`;
    window.open(`https://wa.me/${waPhone(p.phone)}?text=${encodeURIComponent(msg)}`,'_blank');
  };

  window.downloadAllStatementsPDF=function(){
    let list=parties.map(p=>({p,s:partyStatement(p,stMonth)})).filter(x=>x.s.rows.length||Math.round(x.s.closing)!==0).sort((a,b)=>b.s.closing-a.s.closing);
    let td='padding:6px 8px;border:1px solid #e2e8f0;';
    let tot=list.reduce((t,x)=>[t[0]+x.s.opening,t[1]+x.s.sale,t[2]+x.s.received,t[3]+x.s.closing],[0,0,0,0]);
    let html=`<div id="hkAllStmtPdf" style="font-family:sans-serif;padding:24px;background:#fff;color:#111;">
      ${pdfHeader('Parties ka Hisaab — '+monthLabel(stMonth),'')}
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead><tr style="background:#1a3a6a;color:#fff;"><th style="${td}text-align:left;">Party</th><th style="${td}text-align:right;">Pichhla</th><th style="${td}text-align:right;">Maal</th><th style="${td}text-align:right;">Wasooli</th><th style="${td}text-align:right;">Baqaya</th></tr></thead>
        <tbody>${list.map(({p,s},i)=>`<tr style="background:${i%2?'#f4f7fb':'#fff'};"><td style="${td}">${esc(p.name)}</td><td style="${td}text-align:right;">${fmtRs(s.opening)}</td><td style="${td}text-align:right;">${fmtRs(s.sale)}</td><td style="${td}text-align:right;">${fmtRs(s.received)}</td><td style="${td}text-align:right;font-weight:700;">${fmtRs(s.closing)}</td></tr>`).join('')}
          <tr style="background:#1a3a6a;color:#fff;font-weight:700;"><td style="${td}">Total</td>${tot.map(v=>`<td style="${td}text-align:right;">${fmtRs(v)}</td>`).join('')}</tr>
        </tbody></table></div>`;
    pdfFromHTML(html,'hkAllStmtPdf',`Parties_Hisaab_${stMonth}.pdf`);
  };

  // ── Monthly profit / loss ──
  function profitReport(key){
    let mo=orders.filter(o=>inMonth(o.date,key));
    let sale=mo.reduce((s,o)=>s+num(o.orderTotal),0);
    let wood=mo.reduce((s,o)=>s+num(o.totalWoodCost),0);
    let labour=mo.reduce((s,o)=>s+num(o.totalLabour),0);
    let gross=sale-wood-labour;
    let cats={};
    expenses.filter(e=>inMonth(e.date,key)).forEach(e=>{let c=e.category||'Misc';cats[c]=(cats[c]||0)+num(e.amount);});
    let kharcha=Object.values(cats).reduce((a,b)=>a+b,0);
    let received=0;
    orders.forEach(o=>(o.payments||[]).forEach(p=>{if(inMonth(p.date,key))received+=num(p.amount);}));
    parties.forEach(p=>(p.partyPayments||[]).forEach(pp=>{if(inMonth(pp.date,key))received+=num(pp.amount);}));
    let purchased=purchases.filter(p=>inMonth(p.date,key)).reduce((s,p)=>s+(num(p.total)||num(p.qty)*num(p.rate)),0);
    let labourPaid=labours.filter(l=>inMonth(l.date,key)).reduce((s,l)=>s+num(l.paid),0);
    return {orders:mo.length,sale,wood,labour,gross,cats,kharcha,net:gross-kharcha,received,purchased,labourPaid};
  }
  let plMonth=monthKeyNow();
  function plRows(r){
    let line=(label,val,opts)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border,#e2e8f0);${opts&&opts.bold?'font-weight:800;':''}${opts&&opts.color?'color:'+opts.color+';':''}"><span>${label}</span><span>${val}</span></div>`;
    return line(`🛒 Sale (${r.orders} orders)`,fmtRs(r.sale))+
      line('🪵 Lakri ki laagat','− '+fmtRs(r.wood))+
      line('🔧 Labour (orders par)','− '+fmtRs(r.labour))+
      line('Kaam ka munafa',fmtRs(r.gross),{bold:true})+
      Object.entries(r.cats).sort((a,b)=>b[1]-a[1]).map(([c,v])=>line('💰 '+esc(c),'− '+fmtRs(v))).join('')+
      line(r.net>=0?'✅ Asal Munafa':'❌ Nuqsan',fmtRs(Math.abs(r.net)),{bold:true,color:r.net>=0?'#16a34a':'#dc2626'})+
      `<div style="font-size:9px;font-weight:700;margin:12px 0 2px;">💵 Paisa (cash flow)</div>`+
      line('Wasooli (aaya)',fmtRs(r.received))+
      line('Khareed (maal liya)',fmtRs(r.purchased))+
      line('Karigar ko diya',fmtRs(r.labourPaid));
  }
  window.openProfitReport=function(key){
    if(key)plMonth=key;
    ensureModal('hkProfitModal','📊 Munafa / Nuqsan');
    let r=profitReport(plMonth);
    document.getElementById('hkProfitModalBody').innerHTML=`
      <select class="form-input" style="margin-bottom:8px;" onchange="openProfitReport(this.value)">${monthOptions(plMonth)}</select>
      <div style="font-size:11px;">${plRows(r)}</div>
      <p style="font-size:8px;color:var(--gray-500);margin-top:6px;">Munafa = Sale − lakri − labour − kharche. Khareed (stock) alag dikhaya hai taake do dafa na gina jaye.</p>
      <button class="btn btn-gold btn-sm" style="margin-top:8px;" onclick="downloadProfitPDF()">📄 PDF / Share</button>`;
    show('hkProfitModal');
  };
  window.downloadProfitPDF=function(){
    let html=`<div id="hkPlPdf" style="font-family:sans-serif;padding:24px;background:#fff;color:#111;font-size:14px;">${pdfHeader('Munafa / Nuqsan — '+monthLabel(plMonth),'')}${plRows(profitReport(plMonth))}</div>`;
    pdfFromHTML(html,'hkPlPdf',`Munafa_${plMonth}.pdf`);
  };

  // ── Excel export ──
  function loadXlsx(){
    if(window.XLSX)return Promise.resolve();
    return new Promise((res,rej)=>{let s=document.createElement('script');s.src='vendor/xlsx.mini.min.js';s.onload=res;s.onerror=()=>rej(new Error('Excel library load nahi hui'));document.head.appendChild(s);});
  }
  window.exportExcel=async function(){
    try{
      await loadXlsx();
      let wb=XLSX.utils.book_new();
      let add=(name,rows)=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{'':'Koi data nahi'}]),name);
      add('Orders',orders.map(o=>({'Order #':o.orderNo,Date:o.date,Party:getPartyName(o.partyId),Doors:(o.doors||[]).length,Total:num(o.orderTotal),Received:getOrderTotalPaid(o),Balance:num(o.orderTotal)-getOrderTotalPaid(o),'Wood Cost':num(o.totalWoodCost),Labour:num(o.totalLabour),Profit:num(o.netProfit),Status:o.status||'pending'})));
      add('Payments',orders.flatMap(o=>(o.payments||[]).map(p=>({Date:p.date,'Order #':o.orderNo,Party:getPartyName(o.partyId),Amount:num(p.amount),Method:p.method||'',Note:p.note||''}))).concat(parties.flatMap(p=>(p.partyPayments||[]).map(pp=>({Date:pp.date,'Order #':'Opening',Party:p.name,Amount:num(pp.amount),Method:pp.method||'',Note:pp.note||''})))));
      add('Khata',parties.map(p=>({Party:p.name,Phone:p.phone||'',Area:p.area||'',Balance:getPartyBalance(p)})));
      add('Kharcha',expenses.map(e=>({Date:e.date,Detail:e.description,Category:e.category||'',Amount:num(e.amount)})));
      add('Khareed',purchases.map(p=>({Date:p.date,'#':p.purchaseNo||'',Item:p.item,Qty:num(p.qty),Unit:p.unit||'',Rate:num(p.rate),Total:num(p.total)||num(p.qty)*num(p.rate)})));
      add('Labour',labours.map(l=>({Date:l.date,'#':l.labourNo||'',Karigar:getKarigarName(l.karigarId),Order:(orders.find(o=>o.id===l.orderId)||{}).orderNo||'',Total:num(l.totalCost),Paid:num(l.paid),Baqi:num(l.totalCost)-num(l.paid)})));
      add('Stock',inventory.map(i=>({Item:i.name,Qty:i.qty,Unit:i.unit||'',Min:i.minStock})));
      let out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
      let blob=new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HK_Doors_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();
      setTimeout(()=>URL.revokeObjectURL(a.href),3000);
      showToast('📗 Excel file download ho gayi');
    }catch(e){showToast('⚠️ '+e.message);}
  };

  // ── QR labels that open the order ──
  function orderUrl(o){return location.origin+location.pathname+'#order='+o.id;}
  // Labels used to carry plain text; now the QR opens the order on any phone with the app.
  let origQR=window.QRCode;
  if(origQR){
    window.QRCode=function(el,opts){
      try{
        let m=opts&&typeof opts.text==='string'&&el&&String(el.id||'').startsWith('lbl_qr_')&&opts.text.match(/^(\S+) \|/);
        if(m){let o=orders.find(x=>x.orderNo===m[1]);if(o)opts={...opts,text:orderUrl(o),correctLevel:origQR.CorrectLevel?origQR.CorrectLevel.L:undefined};}
      }catch(e){}
      return new origQR(el,opts);
    };
    Object.assign(window.QRCode,origQR);
    window.QRCode.prototype=origQR.prototype;
  }
  const STATUSES=[['pending','⏳ Pending'],['cutting','🪚 Cutting'],['assembly','🔨 Assembly'],['polishing','🎨 Polishing'],['ready','✅ Ready'],['delivered','🚚 Delivered']];
  window.openOrderQuick=function(id){
    let o=orders.find(x=>String(x.id)===String(id));
    if(!o){showToast('⚠️ Order nahi mila — sync hone dein');return;}
    ensureModal('hkQuickModal','🏷️ Order');
    document.getElementById('hkQuickModalBody').innerHTML=`
      <div style="font-size:14px;font-weight:800;">${esc(o.orderNo)}</div>
      <div style="font-size:11px;color:var(--gray-500);margin-bottom:10px;">${esc(getPartyName(o.partyId))} · 🚪 ${(o.doors||[]).length} · ${fmtRs(o.orderTotal)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
        ${STATUSES.map(([v,l])=>`<button class="btn ${(o.status||'pending')===v?'btn-primary':'btn-outline'}" style="justify-content:center;" onclick="quickSetStatus(${o.id},'${v}')">${l}</button>`).join('')}
      </div>
      <button class="btn btn-gold" style="width:100%;margin-top:10px;justify-content:center;" onclick="closeModal('hkQuickModal');viewOrderDetail(${o.id})">📊 Poori Detail</button>`;
    show('hkQuickModal');
  };
  window.quickSetStatus=function(id,status){
    let o=orders.find(x=>x.id===id);if(!o)return;
    o.status=status;saveAll();renderAll();
    showToast('✅ '+o.orderNo+' → '+status);
    openOrderQuick(id);
  };
  function handleHash(){
    let m=location.hash.match(/^#order=(\d+)/);
    if(!m)return;
    let open=()=>{
      if(document.querySelector('.hk-pin-lock')){setTimeout(open,400);return;}
      history.replaceState(null,'',location.pathname+location.search);
      openOrderQuick(m[1]);
    };
    open();
  }
  window.addEventListener('hashchange',handleHash);

  // ── Menu entries ──
  function addMenu(){
    let anchor=document.getElementById('hkActivityDrawerBtn')||[...document.querySelectorAll('.drawer-item')].find(b=>(b.getAttribute('onclick')||'').includes('openUserSwitcher'));
    if(!anchor||document.getElementById('hkStmtDrawerBtn'))return;
    [['hkExcelDrawerBtn','📗','Excel Export','exportExcel()'],['hkPlDrawerBtn','📊','Munafa / Nuqsan Report','openProfitReport()'],['hkStmtDrawerBtn','📅','Mahana Statement (Parties)','openStatements()']].forEach(([id,icon,label,fn])=>{
      let b=document.createElement('button');b.className='drawer-item';b.id=id;
      b.setAttribute('onclick',fn+';closeDrawer();');
      b.innerHTML=`<span class="t-icon">${icon}</span>${label}`;
      anchor.after(b);
    });
  }
  document.addEventListener('hk:ready',()=>{addMenu();handleHash();});
})();
