// HK Wood Doors ERP — PIN lock and staff permissions
// - Owner PIN (Settings → Security) locks the app when it opens and after 5 minutes
//   in the background. The owner PIN or any staff PIN unlocks it.
// - Switching user now asks for that user's PIN (before, anyone could switch).
// - Staff cannot delete, reset, restore backups, change settings or manage staff.
(function(){
  const RELOCK_AFTER_MS=5*60*1000;
  const OWNER_ONLY=[
    'deleteBankTransaction','deleteCheque','deleteExpense','deleteInventory','deleteKarigar','deleteLabour',
    'deleteOrder','deleteParty','deletePartyPayment','deletePayment','deletePriceListEntry','deletePurchase',
    'deleteQuotation','deleteReceivedPayment','deleteSupplier','deleteTemplate','deleteUser','addStaffUser',
    'emptyRecycleBin','resetAllData','resetAllWoodStock','resetWoodType','removeWoodType','importBackup',
    'saveSettings','saveFirebaseConfig','fbLogout','restoreAutoBackup','openActivityLog','openProfitReport','exportExcel','saveAutoSettings','confirmAdvanceFix','deleteSupplierPayment','setSupplierOpening','openImport','importPartiesFile','removeFinger'
  ];

  function ownerPin(){return (businessProfile&&businessProfile.ownerPin)||'';}
  function isStaff(){return activeUserId!=null&&staffUsers.some(u=>u.id===activeUserId);}
  window.hkIsStaff=isStaff;

  // ── PIN prompt (returns a Promise with the typed PIN, or null if cancelled) ──
  function pinPrompt(title,opts){
    opts=opts||{};
    return new Promise(resolve=>{
      let ov=document.createElement('div');
      ov.className='hk-pin-overlay'+(opts.lock?' hk-pin-lock':'');
      ov.innerHTML=`<div class="hk-pin-box">
        <div class="hk-pin-icon">🔐</div>
        <div class="hk-pin-title"></div>
        <input class="form-input hk-pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" placeholder="PIN">
        <div class="hk-pin-err"></div>
        <div style="display:flex;gap:6px;margin-top:10px;">
          ${opts.lock?'':'<button class="btn btn-outline" style="flex:1;" data-act="cancel">Cancel</button>'}
          <button class="btn btn-primary" style="flex:1;" data-act="ok">${opts.okText||'Kholein'}</button>
        </div></div>`;
      ov.querySelector('.hk-pin-title').textContent=title;
      document.body.appendChild(ov);
      let input=ov.querySelector('input'),err=ov.querySelector('.hk-pin-err');
      setTimeout(()=>input.focus(),50);
      let finish=v=>{ov.remove();resolve(v);};
      let submit=()=>{
        let v=input.value.trim();
        if(!v)return;
        if(opts.check&&!opts.check(v)){
          err.textContent='❌ PIN galat hai';input.value='';
          ov.querySelector('.hk-pin-box').classList.remove('shake');void ov.offsetWidth;ov.querySelector('.hk-pin-box').classList.add('shake');
          return;
        }
        finish(v);
      };
      ov.addEventListener('click',e=>{let a=e.target.getAttribute&&e.target.getAttribute('data-act');if(a==='ok')submit();else if(a==='cancel')finish(null);});
      input.addEventListener('keydown',e=>{if(e.key==='Enter')submit();});
    });
  }
  window.hkPinPrompt=pinPrompt;

  // ── App lock ──
  let locked=false;
  async function lockApp(){
    if(locked||!ownerPin())return;
    locked=true;
    let pin=await pinPrompt((businessProfile.name||'HK WOOD DOORS')+' — PIN daalein',{lock:true,check:v=>v===ownerPin()||staffUsers.some(u=>u.pin&&u.pin===v)});
    let staff=pin===ownerPin()?null:staffUsers.find(u=>u.pin===pin);
    activeUserId=staff?staff.id:null;
    try{if(staff)localStorage.setItem('ww_active_user',staff.id);else localStorage.removeItem('ww_active_user');}catch(e){}
    updateUserBadge();
    locked=false;
    showToast(staff?`👤 ${staff.name}`:'👑 Owner');
  }
  window.lockApp=lockApp;

  let hiddenAt=0;
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')hiddenAt=Date.now();
    else if(hiddenAt&&Date.now()-hiddenAt>RELOCK_AFTER_MS)lockApp();
  });

  // ── Owner-only actions ──
  function guard(){
    OWNER_ONLY.forEach(name=>{
      let orig=window[name];
      if(typeof orig!=='function'||orig._hkGuarded)return;
      let wrapped=function(){
        if(isStaff()){showToast('🔒 Yeh kaam sirf Owner kar sakta hai');return;}
        return orig.apply(this,arguments);
      };
      wrapped._hkGuarded=true;
      window[name]=wrapped;
    });
  }

  // ── User switching with PIN ──
  let origSwitchUser=window.switchUser;
  window.switchUser=async function(id){
    let u=staffUsers.find(x=>x.id===id);
    if(!u){showToast('⚠️ User not found');return;}
    if(activeUserId!==id&&u.pin){
      let ok=await pinPrompt(`${u.name} ka PIN`,{check:v=>v===u.pin});
      if(ok===null)return;
    }
    origSwitchUser(id);
  };
  window.switchToOwner=async function(){
    if(!isStaff()){showToast('👑 Aap pehle se Owner hain');return;}
    if(ownerPin()){
      let ok=await pinPrompt('Owner PIN',{check:v=>v===ownerPin()});
      if(ok===null)return;
    }
    activeUserId=null;
    try{localStorage.removeItem('ww_active_user');}catch(e){}
    updateUserBadge();
    showToast('👑 Owner mode');
    if(document.getElementById('userModal')?.classList.contains('open'))openUserSwitcher();
  };

  let origOpenUserSwitcher=window.openUserSwitcher;
  window.openUserSwitcher=function(){
    origOpenUserSwitcher();
    let body=document.getElementById('userModalBody');if(!body)return;
    let box=document.createElement('div');
    box.style.cssText='margin-bottom:10px;padding:8px;border:1px solid var(--border);border-radius:10px;font-size:9px;';
    box.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <span>${isStaff()?'👤 Staff mode — delete/reset band hai':'👑 Owner mode (sab ikhtiyar)'}</span>
        ${isStaff()?'<button class="btn btn-primary btn-xs" onclick="switchToOwner()">👑 Owner</button>':''}
      </div>
      ${ownerPin()?'':'<div style="margin-top:6px;color:var(--danger,#c0392b);">⚠️ Owner PIN nahi laga — staff khud Owner ban sakta hai. Settings → Security mein PIN lagayein.</div>'}`;
    body.prepend(box);
  };

  // ── Settings: Security section ──
  window.setOwnerPin=async function(){
    if(isStaff()){showToast('🔒 Sirf Owner');return;}
    if(ownerPin()){
      let cur=await pinPrompt('Purana Owner PIN',{check:v=>v===ownerPin()});
      if(cur===null)return;
    }
    let p1=await pinPrompt('Naya Owner PIN (4-6 number)',{okText:'Aage',check:v=>/^\d{4,6}$/.test(v)});
    if(p1===null)return;
    let p2=await pinPrompt('Naya PIN dobara',{okText:'Save',check:v=>v===p1});
    if(p2===null)return;
    businessProfile.ownerPin=p1;
    saveAll();
    showToast('✅ Owner PIN lag gaya — app ab PIN se khulegi');
    if(document.getElementById('settingsModal')?.classList.contains('open'))openSettingsModal();
  };
  window.removeOwnerPin=async function(){
    if(isStaff()||!ownerPin())return;
    let cur=await pinPrompt('Owner PIN (hatane ke liye)',{check:v=>v===ownerPin()});
    if(cur===null)return;
    delete businessProfile.ownerPin;
    saveAll();
    showToast('🔓 PIN hata diya');
    openSettingsModal();
  };

  let origOpenSettings=window.openSettingsModal;
  window.openSettingsModal=function(){
    origOpenSettings();
    let body=document.getElementById('settingsContent');if(!body)return;
    let cfg=typeof getFirebaseCfg==='function'?getFirebaseCfg():null;
    let sec=document.createElement('div');
    sec.style.cssText='margin-top:12px;border-top:1px solid var(--border);padding-top:10px;';
    sec.innerHTML=`<div style="font-size:12px;font-weight:700;margin-bottom:6px;">🔐 Security</div>
      ${isStaff()?'<p style="font-size:9px;color:var(--gray-500);">Staff mode: settings sirf Owner badal sakta hai.</p>':''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
        <button class="btn btn-primary btn-sm" onclick="setOwnerPin()">${ownerPin()?'🔁 Owner PIN Badlein':'🔐 Owner PIN Lagayein'}</button>
        ${ownerPin()?'<button class="btn btn-outline btn-sm" onclick="removeOwnerPin()">🔓 PIN Hatayein</button><button class="btn btn-outline btn-sm" onclick="closeModal(\'settingsModal\');lockApp()">🔒 Abhi Lock</button>':''}
      </div>
      <p style="font-size:8px;color:var(--gray-500);">PIN laga ho to app khulte waqt aur 5 minute baad wapas aane par PIN maangti hai. Staff apne PIN se khol sakte hain (delete/reset nahi kar sakte).</p>
      <div style="font-size:9px;margin-top:8px;">☁️ Cloud: ${cfg?(cfg.email?`🔐 ${esc(cfg.email)}`:'⚠️ Login ke baghair (data khula hai)'):'Set nahi'}
        <button class="btn btn-outline btn-xs" onclick="closeModal('settingsModal');openFbSetup()">Setup</button>
        ${cfg&&cfg.email?'<button class="btn btn-outline btn-xs" onclick="fbLogout()">Logout</button>':''}
      </div>
      <div id="hkStorageInfo" style="font-size:8px;color:var(--gray-500);margin-top:6px;"></div>`;
    let buttons=body.querySelector('button[onclick="saveSettings()"]')?.parentElement;
    if(buttons)body.insertBefore(sec,buttons);else body.appendChild(sec);
    if(window.HKStore)HKStore.usage().then(u=>{
      let el=document.getElementById('hkStorageInfo');
      if(el&&u&&u.quota)el.textContent=`💾 Phone storage: ${(u.used/1048576).toFixed(1)} MB istemal / ${(u.quota/1048576).toFixed(0)} MB mojood`;
    });
  };

  document.addEventListener('hk:ready',()=>{guard();if(ownerPin())lockApp();});
})();
