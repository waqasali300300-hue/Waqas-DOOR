// HK Wood Doors ERP — data safety ("Data ki Hifazat")
// The cloud copy only holds the latest data, so a mistake (a delete, a reset) is
// copied everywhere. This keeps dated copies in the cloud as well:
//   • one copy per day (kept 60 days) and the first copy of every month (kept for good)
//   • a copy just before any restore
// They live in the owner's Firebase (erp_backups + erp_backup_meta), so they survive
// a lost phone, an uninstalled app or a new laptop: log in again and they are there.
// The "Data ki Hifazat" screen shows every safety layer and lets the owner look at
// any old copy and bring it back.
(function(){
  const DAILY_KEEP=60;
  const SEEN='hk_cloud_bk_day';
  function day(){return new Date().toISOString().slice(0,10);}
  function num(v){return parseFloat(v)||0;}
  function counts(d){
    return {parties:(d.parties||[]).length,orders:(d.orders||[]).length,labours:(d.labours||[]).length,
      expenses:(d.expenses||[]).length,sale:(d.orders||[]).reduce((s,o)=>s+num(o.orderTotal),0)};
  }
  function ready(){return typeof cloudEnabled!=='undefined'&&cloudEnabled&&db;}
  function modal(id,title,html){
    let m=document.getElementById(id);
    if(!m){
      m=document.createElement('div');m.className='modal';m.id=id;
      m.innerHTML=`<div class="modal-box" style="max-width:520px;"><div class="modal-head"><span id="${id}T"></span> <button class="modal-close" onclick="closeModal('${id}')">✕</button></div><div class="modal-body" id="${id}B"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById(id+'T').textContent=title;
    document.getElementById(id+'B').innerHTML=html;
    if(!m.classList.contains('open'))openModal(id);
  }

  // ── Writing a dated copy ──
  async function writeCopy(id,kind){
    let data=getCloudSnapshot();
    let packed=await HKSync.pack(data);
    let meta={id,day:/^\d{4}-\d{2}-\d{2}/.test(id)?id.slice(0,10):day(),kind,savedAt:new Date().toISOString(),size:packed.z.length,...counts(data)};
    await db.collection('erp_backups').doc(id).set({...packed,savedAt:meta.savedAt});
    await db.collection('erp_backup_meta').doc(id).set(meta);
    return meta;
  }
  async function listMeta(){
    let snap=await db.collection('erp_backup_meta').get();
    let out=[];snap.forEach(d=>out.push(d.data()));
    return out.sort((a,b)=>String(b.id).localeCompare(String(a.id)));
  }
  // Daily copies older than DAILY_KEEP days go, except each month's first copy.
  async function tidy(){
    let all=await listMeta();
    let cut=new Date(Date.now()-DAILY_KEEP*86400000).toISOString().slice(0,10);
    // The first daily copy of each month is kept for good.
    let keep=new Set(),months=new Set();
    all.filter(m=>m.kind==='daily').sort((a,b)=>String(a.day).localeCompare(String(b.day))).forEach(m=>{
      let mo=String(m.day).slice(0,7);
      if(!months.has(mo)){months.add(mo);keep.add(m.id);}
    });
    for(const m of all){
      if(m.kind==='year'||m.day>=cut||keep.has(m.id))continue;
      try{await db.collection('erp_backups').doc(m.id).delete();await db.collection('erp_backup_meta').doc(m.id).delete();}catch(e){}
    }
  }
  let running=false;
  async function dailyCopy(force){
    if(!ready()||running)return null;
    let d=day();
    try{if(!force&&localStorage.getItem(SEEN)===d)return null;}catch(e){}
    if(!parties.length&&!orders.length)return null; // nothing to keep yet
    running=true;
    try{
      let meta=await writeCopy(d,'daily');
      try{localStorage.setItem(SEEN,d);localStorage.setItem('hk_cloud_bk_at',meta.savedAt);}catch(e){}
      tidy().catch(()=>{});
      return meta;
    }catch(e){console.warn('Cloud backup:',e);return null;}
    finally{running=false;}
  }
  window.hkCloudCopy=(id,kind)=>writeCopy(id,kind);
  window.hkCloudBackupNow=async function(){
    if(!ready()){showToast('⚠️ Pehle cloud se jorein');return;}
    let m=await dailyCopy(true);
    showToast(m?'✅ Aaj ki copy cloud mein mehfooz ho gayi':'⚠️ Copy nahi bani — internet check karein');
    if(document.getElementById('hkSafetyModal')?.classList.contains('open'))openDataSafety();
  };
  // After every successful sync, make sure today's copy exists.
  let origSyncNow=window.syncNow;
  window.syncNow=async function(){
    let r=await origSyncNow.apply(this,arguments);
    if(r)dailyCopy(false);
    return r;
  };

  // ── Looking at and restoring a copy ──
  async function readCopy(id){
    let s=await db.collection('erp_backups').doc(id).get();
    if(!s.exists)throw new Error('Copy nahi mili');
    return HKSync.unpack(s.data());
  }
  window.viewCloudBackup=async function(id){
    try{
      let d=await readCopy(id),c=counts(d);
      let recent=(d.orders||[]).slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);
      let partyName=pid=>((d.parties||[]).find(p=>p.id==pid)||{}).name||'—';
      modal('hkSafetyModal','👁 Copy: '+id,`
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:8px;">
          <div class="khata-card" style="margin:0;">Parties<br><b>${c.parties}</b></div>
          <div class="khata-card" style="margin:0;">Orders<br><b>${c.orders}</b></div>
          <div class="khata-card" style="margin:0;">Labour<br><b>${c.labours}</b></div>
          <div class="khata-card" style="margin:0;">Kul sale<br><b>${fmtRs(c.sale)}</b></div>
        </div>
        <div style="font-size:10px;font-weight:700;margin:6px 0 3px;">Aakhri orders is copy mein</div>
        ${recent.map(o=>`<div style="font-size:10px;padding:4px 0;border-bottom:1px solid var(--border);">${esc(o.orderNo||'')} · ${esc(partyName(o.partyId))} · ${esc(o.date||'')} · <b>${fmtRs(o.orderTotal)}</b></div>`).join('')||'<div style="font-size:10px;color:var(--gray-500);">Koi order nahi</div>'}
        <div style="display:flex;gap:6px;margin-top:10px;">
          <button class="btn btn-danger" style="flex:1;" onclick="restoreCloudBackup('${esc(id)}')">↩️ Yeh copy wapas layein</button>
          <button class="btn btn-outline" style="flex:1;" onclick="openDataSafety()">Wapas</button>
        </div>`);
    }catch(e){showToast('⚠️ '+(e.message||e));}
  };
  window.restoreCloudBackup=function(id){
    customConfirm(`${id} wali copy wapas laayein? Abhi ka data us copy jaisa ho jayega — sab juray hue devices par bhi. (Abhi ka data pehle alag copy mein mehfooz ho jayega, zaroorat ho to wapas aa sakta hai.)`,async()=>{
      try{
        if(!ready())throw new Error('Pehle cloud se jorein');
        let d=await readCopy(id);
        let now=new Date().toISOString();
        await writeCopy(day()+'_restore_'+now.slice(11,19).replace(/:/g,''),'before-restore');
        applyData(d);
        saveAll();
        if(typeof syncNow==='function')syncNow();
        updateKhataFilter&&updateKhataFilter();renderAll();
        closeModal('hkSafetyModal');
        showToast('✅ '+id+' wali copy wapas aa gayi');
      }catch(e){showToast('⚠️ Wapas nahi aayi: '+(e.message||e));}
    },{danger:true,title:'↩️ Purani copy',okText:'Wapas Layein'});
  };

  // ── The screen ──
  function ago(iso){
    if(!iso)return 'kabhi nahi';
    let d=(Date.now()-Date.parse(iso))/86400000;
    return d<1?'aaj':d<2?'kal':Math.floor(d)+' din pehle';
  }
  window.openDataSafety=async function(){
    let cfg=typeof getFirebaseCfg==='function'?getFirebaseCfg():null;
    let get=k=>{try{return localStorage.getItem(k)||'';}catch(e){return '';}};
    let row=(ok,title,detail,btn)=>`<div class="hk-safe-row ${ok?'ok':'warn'}"><span class="hk-safe-dot">${ok?'✅':'⚠️'}</span>
      <span style="flex:1;min-width:0;"><b>${title}</b><br><small>${detail}</small></span>${btn||''}</div>`;
    let fileAt=get('hk_file_backup_at'),cloudBkAt=get('hk_cloud_bk_at'),manual=get('ww_last_backup');
    let layers=
      row(ready(),'1. Cloud (Firebase)',ready()?'Har entry foran cloud mein — phone gum ho jaye ya app hata dein, login karte hi sab wapas':cfg?'Juda hai magar abhi online nahi — internet aate hi sync hoga':'Juda nahi! Data sirf is device par hai',
        ready()?'':'<button class="btn btn-primary btn-xs" onclick="closeModal(\'hkSafetyModal\');openFbSetup()">Jorein</button>')+
      row(!!cloudBkAt,'2. Cloud mein roz ki copy','Aakhri copy: '+ago(cloudBkAt)+' — 60 din ki roz ki copies aur har mahine ki pehli copy hamesha ke liye',
        ready()?'<button class="btn btn-outline btn-xs" onclick="hkCloudBackupNow()">Abhi</button>':'')+
      (window.hkNative?row(!!fileAt,'3. Phone mein roz ki file','Documents → HK Doors → Backup · aakhri: '+ago(fileAt)+' — app hatane ke baad bhi phone mein rehti hai',
        '<button class="btn btn-outline btn-xs" onclick="hkFileBackupNow&&hkFileBackupNow().then(()=>openDataSafety())">Abhi</button>'):'')+
      row(!!manual&&(Date.now()-Date.parse(manual))<30*86400000,(window.hkNative?'4':'3')+'. Apni backup file','Aakhri download: '+ago(manual)+' — mahine mein ek dafa download kar ke Google Drive / WhatsApp par rakh lein',
        '<button class="btn btn-gold btn-xs" onclick="exportBackup()">⬇️ Download</button>')+
      row(true,(window.hkNative?'5':'4')+'. Recycle Bin','Delete ki hui cheezein wahan se wapas aa sakti hain',
        '<button class="btn btn-outline btn-xs" onclick="closeModal(\'hkSafetyModal\');switchTab(\'tabRecycle\')">Kholein</button>');
    modal('hkSafetyModal','🛡️ Data ki Hifazat',`
      <p style="font-size:10px;color:var(--gray-500);margin-bottom:8px;">Aap ka data kai jagah mehfooz hai. App hata kar dobara install karein to ☰ → Cloud Backup Setup mein login karte hi sab wapas aa jata hai.</p>
      ${layers}
      <div style="font-size:11px;font-weight:700;margin:12px 0 4px;">☁️ Cloud ki purani copies</div>
      <div id="hkSafeList" style="font-size:10px;">${ready()?'⏳ Load ho rahi hain…':'Cloud se jorne ke baad yahan nazar aayengi.'}</div>`);
    if(!ready())return;
    try{
      let list=await listMeta();
      let el=document.getElementById('hkSafeList');if(!el)return;
      el.innerHTML=list.length?list.map(m=>`<div class="hk-safe-copy">
          <span style="flex:1;min-width:0;"><b>${m.kind==='year'?'📅 Saal '+esc(String(m.id).slice(5)):esc(m.day)}</b>${m.kind==='before-restore'?' <small>(wapas laane se pehle)</small>':m.kind==='year'?' <small>(hamesha ke liye)</small>':''}<br>
          <small>${m.parties} parties · ${m.orders} orders · ${fmtRs(m.sale)}</small></span>
          <button class="btn btn-outline btn-xs" onclick="viewCloudBackup('${esc(m.id)}')">👁 Dekhein</button></div>`).join('')
        :'Abhi koi copy nahi — "Abhi" dabayein ya kal tak khud ban jayegi.';
    }catch(e){let el=document.getElementById('hkSafeList');if(el)el.textContent='⚠️ Copies load nahi huin: '+(e.message||e);}
  };

  document.addEventListener('hk:ready',()=>{
    if(!document.getElementById('hkSafetyBtn')){
      let anchor=[...document.querySelectorAll('.drawer-item')].find(b=>(b.getAttribute('onclick')||'').includes('openFbSetup'));
      if(anchor)anchor.insertAdjacentHTML('beforebegin','<button class="drawer-item" id="hkSafetyBtn" onclick="openDataSafety();closeDrawer();"><span class="t-icon">🛡️</span>Data ki Hifazat (Backup)</button>');
    }
  });
})();
