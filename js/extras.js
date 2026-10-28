// HK Wood Doors ERP — automatic daily backups + 6-month income vs expense chart
(function(){
  const KEEP_DAYS=7;
  const PREFIX='ww_autobackup_';

  // ── Daily auto-backup (kept on the phone, last 7 days) ──
  // Protects against mistakes (wrong delete, bad restore, reset) even if the
  // owner forgets to download a backup file.
  async function makeAutoBackup(){
    if(!window.HKStore||!HKStore.ok)return;
    try{
      let key=PREFIX+new Date().toISOString().slice(0,10);
      let keys=(await HKStore.keys()).filter(k=>String(k).startsWith(PREFIX)).sort();
      if(!keys.includes(key)){
        let hasData=orders.length||parties.length||labours.length||expenses.length;
        if(!hasData)return;
        await HKStore.set(key,JSON.stringify({savedAt:new Date().toISOString(),data:getDataSnapshot()}));
        keys.push(key);keys.sort();
      }
      while(keys.length>KEEP_DAYS){await HKStore.del(keys.shift());}
    }catch(e){console.warn('Auto-backup:',e);}
  }

  async function listAutoBackups(){
    if(!window.HKStore||!HKStore.ok)return [];
    try{return (await HKStore.keys()).filter(k=>String(k).startsWith(PREFIX)).sort().reverse();}catch(e){return [];}
  }

  window.restoreAutoBackup=async function(key){
    let raw=await HKStore.get(key);
    if(!raw){showToast('⚠️ Backup nahi mila');return;}
    let day=key.slice(PREFIX.length);
    customConfirm(`${day} ka backup wapis layein? Us ke baad ki entries hat jayengi.`,()=>{
      try{
        let data=JSON.parse(raw).data;
        applyData(data);
        saveAll();
        updateKhataFilter();renderAll();updateUserBadge();
        closeModal('settingsModal');
        showToast('✅ '+day+' ka data wapis aa gaya');
      }catch(e){showToast('⚠️ Backup kharab hai');}
    },{title:'⚠️ Auto Backup Restore',okText:'Restore Karein'});
  };

  let origOpenSettings=window.openSettingsModal;
  window.openSettingsModal=function(){
    origOpenSettings();
    let body=document.getElementById('settingsContent');if(!body)return;
    let box=document.createElement('div');
    box.style.cssText='margin-top:8px;';
    box.innerHTML='<div style="font-size:10px;font-weight:700;margin-bottom:4px;">🕒 Auto Backup (roz khud banta hai, 7 din)</div><div id="hkAutoBackupList" style="font-size:9px;color:var(--gray-500);">...</div>';
    let anchor=body.querySelector('#restoreFileInput')?.parentElement;
    if(anchor)anchor.after(box);else body.appendChild(box);
    listAutoBackups().then(keys=>{
      let el=document.getElementById('hkAutoBackupList');if(!el)return;
      el.innerHTML=keys.length?keys.map(k=>{
        let day=k.slice(PREFIX.length);
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border);">
          <span>📅 ${esc(day)}</span><button class="btn btn-outline btn-xs" onclick="restoreAutoBackup('${esc(k)}')">↩️ Restore</button></div>`;
      }).join(''):'Abhi koi auto backup nahi — kal tak ban jayega.';
    });
  };

  // ── 6-month income vs expense chart ──
  function monthKeys(n){
    let now=new Date(),out=[];
    for(let i=n-1;i>=0;i--){
      let d=new Date(now.getFullYear(),now.getMonth()-i,1);
      out.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
    }
    return out;
  }
  function num(v){return parseFloat(v)||0;}

  function renderCashflowChart(){
    let el=document.getElementById('hkCashflowChart');if(!el)return;
    let keys=monthKeys(6),inc={},exp={};
    keys.forEach(k=>{inc[k]=0;exp[k]=0;});
    let add=(map,date,amt)=>{let k=String(date||'').slice(0,7);if(k in map)map[k]+=amt;};
    orders.forEach(o=>{
      if(o.payments&&o.payments.length)o.payments.forEach(p=>add(inc,p.date||o.date,num(p.amount)));
      else add(inc,o.date,num(o.advancePayment));
    });
    parties.forEach(p=>(p.partyPayments||[]).forEach(pp=>add(inc,pp.date,num(pp.amount))));
    expenses.forEach(e=>add(exp,e.date,num(e.amount)));
    purchases.forEach(p=>add(exp,p.date,num(p.total)||num(p.qty)*num(p.rate)));
    labours.forEach(l=>add(exp,l.date,num(l.totalCost)));

    let max=Math.max(1,...keys.map(k=>Math.max(inc[k],exp[k])));
    if(!keys.some(k=>inc[k]||exp[k])){el.innerHTML='<div class="empty-state" style="padding:16px 0;"><p>Abhi data nahi</p></div>';return;}
    let W=600,H=190,padB=22,padT=16,plotH=H-padB-padT,slot=W/keys.length,bw=Math.min(34,slot/3);
    let short=v=>v>=1e7?(v/1e7).toFixed(1)+'Cr':v>=1e5?(v/1e5).toFixed(1)+'L':v>=1e3?Math.round(v/1e3)+'k':String(Math.round(v));
    let bars=keys.map((k,i)=>{
      let cx=slot*i+slot/2;
      let hi=inc[k]/max*plotH,he=exp[k]/max*plotH;
      let label=new Date(k+'-01T00:00:00').toLocaleDateString('en',{month:'short'});
      return `<rect x="${cx-bw-2}" y="${padT+plotH-hi}" width="${bw}" height="${hi}" rx="4" fill="#16a34a"><title>Aamdani ${fmtRs(inc[k])}</title></rect>
        <rect x="${cx+2}" y="${padT+plotH-he}" width="${bw}" height="${he}" rx="4" fill="#dc2626"><title>Kharcha ${fmtRs(exp[k])}</title></rect>
        ${inc[k]?`<text x="${cx-bw/2-2}" y="${padT+plotH-hi-3}" font-size="10" text-anchor="middle" fill="currentColor">${short(inc[k])}</text>`:''}
        ${exp[k]?`<text x="${cx+bw/2+2}" y="${padT+plotH-he-3}" font-size="10" text-anchor="middle" fill="currentColor">${short(exp[k])}</text>`:''}
        <text x="${cx}" y="${H-6}" font-size="11" text-anchor="middle" fill="currentColor" opacity=".7">${label}</text>`;
    }).join('');
    let k0=keys[keys.length-1],net=inc[k0]-exp[k0];
    el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;overflow:visible;">
        <line x1="0" x2="${W}" y1="${padT+plotH}" y2="${padT+plotH}" stroke="currentColor" opacity=".15"/>${bars}</svg>
      <div style="display:flex;gap:12px;justify-content:center;font-size:9px;margin-top:6px;flex-wrap:wrap;">
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#16a34a;"></span> Aamdani (wasooli)</span>
        <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#dc2626;"></span> Kharcha (kharcha + khareed + labour)</span>
      </div>
      <div style="text-align:center;font-size:10px;font-weight:700;margin-top:6px;color:${net>=0?'#16a34a':'#dc2626'};">Is mahine: ${net>=0?'Bachat':'Ghata'} ${fmtRs(Math.abs(net))}</div>`;
  }

  function ensureCashflowCard(){
    if(document.getElementById('hkCashflowChart'))return;
    let sales=document.getElementById('salesOverviewChart');
    let card=sales&&sales.closest('.card');if(!card)return;
    let c=document.createElement('div');
    c.className='card';
    c.innerHTML='<div class="card-head">💹 Aamdani vs Kharcha <span style="font-weight:400;font-size:8px;color:var(--gray-500);">6 Mahine</span></div><div class="card-body" id="hkCashflowChart"></div>';
    card.after(c);
  }

  let origRenderDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    origRenderDashboard.apply(this,arguments);
    try{ensureCashflowCard();renderCashflowChart();}catch(e){console.warn('Cashflow chart:',e);}
  };

  document.addEventListener('hk:ready',()=>{
    try{ensureCashflowCard();renderCashflowChart();}catch(e){}
    makeAutoBackup();
    // Long-running app: make the next day's backup too.
    setInterval(makeAutoBackup,60*60*1000);
  });
})();
