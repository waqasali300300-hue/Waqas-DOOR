// ═══════════════════════════════════════════════════════
// HK WOOD DOORS ERP v8.7 — COMPLETE PROFESSIONAL EDITION (FIXED)
// ═══════════════════════════════════════════════════════

// ─── QUICK SIZES ───
const QUICK_SIZES = [
  '45x80','45x78','45x75',
  '39x80','39x78','39x75',
  '33x80','33x78','33x75',
  '27x80','27x78','27x75','27x72',
  '42x80','42x78','42x75',
  '36x80','36x78','36x75',
  '30x80','30x78','30x75',
  '51x80 Jori','57x80 Jori','45x80 Jori','48x80 Jori','60x80 Jori'
];

// ─── DOOR DESIGN / STYLE NAMES (used to build entries like "45x80 Mughleazam") ───
const DEFAULT_DOOR_DESIGNS = ['Mughleazam','D Dant','Artghal','H Design','U Dant','U Dant Ring','Jali Design'];

// ─── DASHBOARD MENU — organized by business flow (order→production→money→stock→tools) ───
const DASHBOARD_SECTIONS = [
  {title:'🚪 Order se Production Tak',c1:'#2563eb',c2:'#60a5fa',items:[
    {icon:'📋',label:'Orders',tab:'tabOrders'},
    {icon:'📝',label:'Estimates',action:'openQuotationList'},
    {icon:'🏭',label:'Production',tab:'tabProduction'},
    {icon:'👷',label:'Labour',tab:'tabLabour'},
    {icon:'🔧',label:'Karigar',action:'openKarigarList'},
    {icon:'🗓️',label:'Attendance',action:'openAttendanceModal'},
  ]},
  {title:'💰 Party aur Paisa',c1:'#0d9488',c2:'#5eead4',items:[
    {icon:'📒',label:'Khata',tab:'tabKhata'},
    {icon:'👥',label:'Parties',tab:'tabParties'},
    {icon:'🏦',label:'Bank',tab:'tabBankBook'},
    {icon:'💰',label:'Kharcha',tab:'tabExpenses'},
    {icon:'🧾',label:'Cheques',action:'openChequeListModal'},
    {icon:'📊',label:'Reports',tab:'tabReports'},
    {icon:'📈',label:'P&L Statement',action:'openPLStatementModal'},
  ]},
  {title:'📦 Maal aur Stock',c1:'#c8963e',c2:'#f3d18a',items:[
    {icon:'📦',label:'Inventory',tab:'tabInventory'},
    {icon:'🪵',label:'Wood Stock',action:'openWoodStockModal'},
    {icon:'🛒',label:'Khareed',tab:'tabPurchases'},
    {icon:'🏪',label:'Suppliers',tab:'tabSuppliers'},
    {icon:'📃',label:'Rate List',action:'openPriceListModal'},
    {icon:'🧮',label:'Material Calc',action:'openRawMaterialCalcModal'},
  ]},
  {title:'🛠️ Tools',c1:'#7c3aed',c2:'#c4b5fd',items:[
    {icon:'🧮',label:'Calculator',action:'openCalculator'},
    {icon:'🔔',label:'Reminders',action:'openReminderCenter'},
    {icon:'🪪',label:'Business Card',action:'openBusinessCardModal'},
    {icon:'♻️',label:'Recycle',tab:'tabRecycle'},
    {icon:'⚙️',label:'Settings',action:'openSettingsModal'},
  ]}
];
// Flattened list kept for badge logic + backward compatibility
const DASHBOARD_MENU = DASHBOARD_SECTIONS.flatMap(s=>s.items);

// ─── FIREBASE ───
// Cloud copy lives in one Firestore document. Syncing merges record-by-record
// (see js/sync.js) so entries made on two phones at the same time are both kept.
// With an email set in Cloud Setup the app signs in first, so the database can be
// locked to that email (see firestore.rules) instead of being open to anyone.
let db=null,cloudEnabled=false,fbAuthUser=null;
const CLOUD_USER_ID='hk_main_user';
let _syncBase=null,_syncBaseLoaded=false,_syncRunning=false,_syncAgain=false,_cloudDirty=false,_cloudUnsub=null;

function getFirebaseCfg(){try{return JSON.parse(localStorage.getItem('ww_fb_cfg')||'null');}catch(e){return null;}}
function cloudDocRef(){return db.collection('erp').doc(CLOUD_USER_ID);}

function initFirebase(){
  try{
    let cfg=getFirebaseCfg();if(!cfg)return false;
    if(typeof firebase==='undefined')return false;
    if(!firebase.apps||!firebase.apps.length)firebase.initializeApp({apiKey:cfg.apiKey,authDomain:cfg.authDomain,projectId:cfg.projectId,appId:cfg.appId});
    db=firebase.firestore();
    return true;
  }catch(e){cloudEnabled=false;setSyncStatus('error');return false;}
}

// Resolves to the signed-in user, or null when no email login is configured.
function waitForAuth(){
  let cfg=getFirebaseCfg();
  if(!cfg||!cfg.email||!firebase.auth)return Promise.resolve(null);
  return new Promise(resolve=>{
    let off=firebase.auth().onAuthStateChanged(u=>{off();resolve(u||null);});
  });
}

async function startCloud(){
  if(!initFirebase())return;
  let cfg=getFirebaseCfg();
  if(cfg.email){
    fbAuthUser=await waitForAuth();
    if(!fbAuthUser){setSyncStatus('login');showToast('🔐 Cloud ke liye login karein');openFbSetup();return;}
  }
  cloudEnabled=true;
  setSyncStatus('online');
  await loadSyncBase();
  await syncNow();
  listenForCloudChanges();
}

function saveFirebaseConfig(){
  let v=id=>(document.getElementById(id)?.value||'').trim();
  let cfg={apiKey:v('fb_apiKey'),authDomain:v('fb_authDomain'),projectId:v('fb_projectId'),appId:v('fb_appId'),email:v('fb_email').toLowerCase()};
  let pass=document.getElementById('fb_password')?.value||'';
  if(!cfg.apiKey||!cfg.projectId){showToast('⚠️ API Key zaruri');return;}
  if(cfg.email&&pass.length<6){showToast('⚠️ Password kam az kam 6 huroof');return;}
  let old=getFirebaseCfg();
  let changedProject=!old||old.projectId!==cfg.projectId||old.apiKey!==cfg.apiKey;
  localStorage.setItem('ww_fb_cfg',JSON.stringify(cfg));
  if(changedProject||!cfg.email){
    // A new Firebase project needs a fresh start; the email login happens after reload.
    if(cfg.email)sessionStorage.setItem('ww_fb_pending_pass',pass);
    showToast('✅ Saved! Reload...');setTimeout(()=>location.reload(),1200);return;
  }
  fbSignIn(cfg.email,pass);
}

async function fbSignIn(email,pass){
  if(!initFirebase()||!firebase.auth){showToast('⚠️ Firebase load nahi hua');return;}
  let auth=firebase.auth();
  try{
    try{await auth.signInWithEmailAndPassword(email,pass);}
    catch(e){
      // First time: the account does not exist yet, so create it.
      if(e.code==='auth/user-not-found'||e.code==='auth/invalid-credential'||e.code==='auth/invalid-login-credentials'){
        try{await auth.createUserWithEmailAndPassword(email,pass);}
        catch(e2){if(e2.code==='auth/email-already-in-use')throw {code:'auth/wrong-password'};throw e2;}
      }else throw e;
    }
    document.getElementById('fbSetupOverlay').classList.remove('open');
    showToast('✅ Login ho gaya');
    startCloud();
  }catch(e){
    let msg={'auth/wrong-password':'Password galat hai','auth/invalid-email':'Email theek nahi','auth/operation-not-allowed':'Firebase mein Email/Password login ON karein (Step 3)','auth/network-request-failed':'Internet nahi hai','auth/too-many-requests':'Bohat koshishein — thori der baad'}[e.code]||('Login error: '+(e.code||e.message||e));
    showToast('⚠️ '+msg);
  }
}

function fbLogout(){
  if(typeof firebase!=='undefined'&&firebase.auth)firebase.auth().signOut().finally(()=>location.reload());
}

function skipFirebaseSetup(){document.getElementById('fbSetupOverlay').classList.remove('open');}
function openFbSetup(){
  let cfg=getFirebaseCfg();
  let set=(id,val)=>{let el=document.getElementById(id);if(el)el.value=val||'';};
  if(cfg){set('fb_apiKey',cfg.apiKey);set('fb_authDomain',cfg.authDomain);set('fb_projectId',cfg.projectId);set('fb_appId',cfg.appId);set('fb_email',cfg.email);}
  updateFbRulesHint();
  document.getElementById('fbSetupOverlay').classList.add('open');
}
function updateFbRulesHint(){
  let el=document.getElementById('fbRulesCode');if(!el)return;
  let email=(document.getElementById('fb_email')?.value||'').trim().toLowerCase()||'aap@gmail.com';
  el.textContent=fbRulesText(email);
}
function fbRulesText(email){
  return "rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if request.auth != null\n        && request.auth.token.email in ['"+email+"'];\n    }\n  }\n}";
}
function copyFbRules(){
  let t=document.getElementById('fbRulesCode')?.textContent||'';
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>showToast('📋 Rules copy ho gaye'),()=>showToast('⚠️ Copy nahi hua — khud select karein'));
}

function setSyncStatus(s){let dot=document.getElementById('syncDot'),txt=document.getElementById('syncText');if(!dot||!txt)return;dot.className='sync-dot';if(s==='online'){txt.textContent='☁️ Synced';}else if(s==='syncing'){dot.classList.add('syncing');txt.textContent='⟳ Syncing...';}else if(s==='error'){dot.classList.add('error');txt.textContent='📴 Offline';}else if(s==='login'){dot.classList.add('error');txt.textContent='🔐 Login';}else{txt.textContent='💾 Local';}}

// ── Photos ──
// Firestore allows 1MB per document, so photos can't live inside the main data.
// Each photo goes to its own document in 'erp_photos', named after its content.
// The main data only carries that name (e.g. designPhotoRef), and other phones
// download the photo from it.
const PHOTO_FIELDS={orders:'designPhoto',quotations:'designPhoto',priceList:'photo'};
const MAX_PHOTO_CHARS=1000000;
let _photoRefCache=new Map(),_photosUploaded=null,_photoFetching=new Set(),_photoRulesWarned=false;

function photoRef(dataUrl){
  let hit=_photoRefCache.get(dataUrl);if(hit)return hit;
  let h1=0x811c9dc5,h2=0x01000193^0x5bd1e995;
  for(let i=0;i<dataUrl.length;i++){
    let c=dataUrl.charCodeAt(i);
    h1=Math.imul(h1^c,16777619);
    h2=Math.imul(h2^c,2246822507);
  }
  let ref='p'+dataUrl.length.toString(36)+'_'+(h1>>>0).toString(36)+(h2>>>0).toString(36);
  _photoRefCache.set(dataUrl,ref);
  return ref;
}

function getCloudSnapshot(){
  let snap=getDataSnapshot();
  for(const [coll,field] of Object.entries(PHOTO_FIELDS)){
    snap[coll]=(snap[coll]||[]).map(r=>{
      if(!r||typeof r!=='object')return r;
      let refKey=field+'Ref';
      let {[field]:photo,[refKey]:pendingRef,...rest}=r;
      if(photo)rest[refKey]=photoRef(photo);
      else if(pendingRef)rest[refKey]=pendingRef; // not downloaded on this phone yet
      return rest;
    });
  }
  // Plain copy, so later edits on this phone don't change it.
  return JSON.parse(JSON.stringify(snap));
}

function photoCollections(){return {orders,quotations,priceList};}

// Every photo currently on this phone, by its ref.
function localPhotoMap(){
  let map=new Map(),cols=photoCollections();
  for(const [coll,field] of Object.entries(PHOTO_FIELDS)){
    (cols[coll]||[]).forEach(r=>{if(r&&r[field])map.set(photoRef(r[field]),r[field]);});
  }
  return map;
}

// Fills in photos we have; returns how many are still missing.
function fillPhotos(map){
  let missing=0,cols=photoCollections();
  for(const [coll,field] of Object.entries(PHOTO_FIELDS)){
    let refKey=field+'Ref';
    (cols[coll]||[]).forEach(r=>{
      if(!r||!r[refKey])return;
      if(r[field]){delete r[refKey];return;}
      let photo=map.get(r[refKey]);
      if(photo){r[field]=photo;delete r[refKey];}
      else missing++;
    });
  }
  return missing;
}

async function loadUploadedSet(){
  if(_photosUploaded)return;
  try{let raw=window.HKStore&&HKStore.ok?await HKStore.get('ww_photos_uploaded'):null;_photosUploaded=new Set(raw?JSON.parse(raw):[]);}catch(e){_photosUploaded=new Set();}
}
function saveUploadedSet(){
  if(window.HKStore&&HKStore.ok)HKStore.set('ww_photos_uploaded',JSON.stringify([..._photosUploaded])).catch(()=>{});
}
function warnPhotoRules(e){
  if(e&&e.code==='permission-denied'&&!_photoRulesWarned){
    _photoRulesWarned=true;
    showToast('📷 Photos sync ke liye Firebase Rules dobara Publish karein (Cloud Setup)');
  }
}

// Sends this phone's photos to the cloud (each one only once).
async function uploadPhotos(){
  if(!cloudEnabled||!db)return;
  await loadUploadedSet();
  let changed=false;
  for(const [ref,data] of localPhotoMap()){
    if(_photosUploaded.has(ref))continue;
    if(data.length>MAX_PHOTO_CHARS){console.warn('Photo too big for cloud:',ref);continue;}
    try{
      await db.collection('erp_photos').doc(ref).set({data,savedAt:firebase.firestore.FieldValue.serverTimestamp()});
      _photosUploaded.add(ref);changed=true;
    }catch(e){warnPhotoRules(e);break;}
  }
  if(changed)saveUploadedSet();
}

// Downloads photos that other phones added.
async function downloadPhotos(){
  if(!cloudEnabled||!db)return;
  let refs=new Set(),cols=photoCollections();
  for(const [coll,field] of Object.entries(PHOTO_FIELDS)){
    (cols[coll]||[]).forEach(r=>{let ref=r&&r[field+'Ref'];if(ref&&!r[field]&&!_photoFetching.has(ref))refs.add(ref);});
  }
  if(!refs.size)return;
  let got=new Map();
  for(const ref of refs){
    _photoFetching.add(ref);
    try{
      let d=await db.collection('erp_photos').doc(ref).get();
      if(d.exists&&d.data().data)got.set(ref,d.data().data);
    }catch(e){warnPhotoRules(e);}
    finally{_photoFetching.delete(ref);}
  }
  if(!got.size)return;
  await loadUploadedSet();
  got.forEach((v,k)=>_photosUploaded.add(k));
  saveUploadedSet();
  fillPhotos(got);
  saveLocal();
  renderAll();
}

async function loadSyncBase(){
  if(_syncBaseLoaded)return;
  _syncBaseLoaded=true;
  try{let raw=window.HKStore&&HKStore.ok?await HKStore.get('ww_sync_base'):localStorage.getItem('ww_sync_base');_syncBase=raw?JSON.parse(raw):null;}catch(e){_syncBase=null;}
}
function saveSyncBase(base){
  _syncBase=base;
  let raw=JSON.stringify(base);
  if(window.HKStore&&HKStore.ok)HKStore.set('ww_sync_base',raw).catch(()=>{});
  else{try{localStorage.setItem('ww_sync_base',raw);}catch(e){}}
}

// Puts merged cloud data into the app, keeping the photos this phone already has.
function applyMergedData(merged){
  let photos=localPhotoMap();
  applyData(JSON.parse(JSON.stringify(merged)));
  fillPhotos(photos);
}

// Reads the cloud copy, merges it with this phone's data, and writes back if needed.
async function syncNow(){
  if(!cloudEnabled||!db)return false;
  if(_syncRunning){_syncAgain=true;return false;}
  _syncRunning=true;
  setSyncStatus('syncing');
  let ok=false;
  try{
    await loadSyncBase();
    let local=getCloudSnapshot();
    let localText=HKSync.stable(local);
    _cloudDirty=false;
    let merged=null,remoteFound=false;
    await db.runTransaction(async tx=>{
      let snap=await tx.get(cloudDocRef());
      let remote=null;
      if(snap.exists){remote=snap.data();delete remote.savedAt;remoteFound=true;}
      merged=HKSync.merge(_syncBase,local,remote);
      if(!remote||!HKSync.same(merged,remote)){
        tx.set(cloudDocRef(),{...merged,savedAt:firebase.firestore.FieldValue.serverTimestamp()});
      }
    });
    saveSyncBase(merged);
    if(HKSync.stable(getCloudSnapshot())!==localText){
      // The user changed something while we were syncing: sync again with their change.
      _syncAgain=true;
    }else if(!HKSync.same(merged,local)){
      applyMergedData(merged);
      saveLocal();
      updateKhataFilter();renderAll();
    }
    setSyncStatus('online');
    ok=true;
    // Photos travel separately; failures here never block the main sync.
    uploadPhotos().then(downloadPhotos).catch(()=>{});
  }catch(e){
    console.warn('Sync:',e);
    _cloudDirty=true;
    if(e&&e.code==='permission-denied'){setSyncStatus('login');showToast('🔐 Cloud ne mana kar diya — login/rules check karein');}
    else setSyncStatus('error');
  }finally{
    _syncRunning=false;
    if(_syncAgain){_syncAgain=false;setTimeout(syncNow,500);}
  }
  return ok;
}

// Live updates: when another phone saves, merge its changes in right away.
function listenForCloudChanges(){
  if(_cloudUnsub||!db)return;
  try{
    _cloudUnsub=cloudDocRef().onSnapshot(snap=>{
      if(snap.metadata.hasPendingWrites||!snap.exists)return;
      let remote=snap.data();delete remote.savedAt;
      if(_syncBase&&HKSync.same(remote,_syncBase))return; // nothing new
      clearTimeout(window._cloudPullTimer);
      window._cloudPullTimer=setTimeout(syncNow,800);
    },()=>{});
  }catch(e){}
}

async function cloudSave(){if(!cloudEnabled)return;_cloudDirty=true;await syncNow();}
async function cloudLoad(){return syncNow();}
async function manualSync(){if(!cloudEnabled){showToast(getFirebaseCfg()?'🔐 Pehle login karein':'⚠️ Firebase nahi');if(getFirebaseCfg())openFbSetup();return;}showToast('⟳ Sync...');let ok=await syncNow();showToast(ok?'✅ Sync ho gaya!':'⚠️ Sync nahi hua — internet check karein');}

function tryInitFirebaseOnLoad(attemptsLeft){
  if(attemptsLeft===undefined)attemptsLeft=40;
  if(!getFirebaseCfg())return;
  if(typeof firebase==='undefined'){
    if(attemptsLeft<=0){setSyncStatus('error');return;}
    setTimeout(()=>tryInitFirebaseOnLoad(attemptsLeft-1),250);
    return;
  }
  let pending=sessionStorage.getItem('ww_fb_pending_pass');
  if(pending){
    sessionStorage.removeItem('ww_fb_pending_pass');
    fbSignIn(getFirebaseCfg().email,pending);
    return;
  }
  startCloud();
}

// ─── HELPERS ───
function showToast(msg){let t=document.getElementById('toastMsg');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
let _modalStack=[];
let _suppressHistory=false;
function closeModal(id){
  document.getElementById(id)?.classList.remove('open');
  let idx=_modalStack.lastIndexOf(id);
  if(idx>-1){
    _modalStack.splice(idx,1);
    if(!_suppressHistory && history.state && history.state.hkModal===id){
      _suppressHistory=true;
      history.back();
      setTimeout(()=>{_suppressHistory=false;},60);
    }
  }
}
function openModal(id){
  document.getElementById(id)?.classList.add('open');
  _modalStack.push(id);
  if(!_suppressHistory){
    history.pushState({hkModal:id},'',location.href);
  }
}
window.addEventListener('popstate',function(e){
  if(_suppressHistory)return;
  if(_modalStack.length){
    let top=_modalStack.pop();
    document.getElementById(top)?.classList.remove('open');
  }else{
    let homeTab=document.getElementById('tabHome');
    if(homeTab && !homeTab.classList.contains('active')){
      switchTab('tabHome');
    }
  }
});

// ─── CUSTOM CONFIRM ───
let _confirmCallback=null;
function customConfirm(message,onConfirm,opts){
  opts=opts||{};
  document.getElementById('confirmModalTitle').innerHTML=`${opts.title||'⚠️ Confirm'} <button class="modal-close" onclick="customConfirmCancel()">✕</button>`;
  document.getElementById('confirmModalMsg').textContent=message;
  let okBtn=document.getElementById('confirmModalOkBtn');
  okBtn.textContent=opts.okText||'Confirm';
  okBtn.className=opts.danger===false?'btn btn-primary':'btn btn-danger';
  _confirmCallback=onConfirm;
  openModal('confirmModal');
}
function customConfirmOk(){
  let cb=_confirmCallback;
  _confirmCallback=null;
  closeModal('confirmModal');
  if(cb)setTimeout(cb,50);
}
function customConfirmCancel(){
  _confirmCallback=null;
  closeModal('confirmModal');
}
function toggleDarkMode(){document.body.classList.toggle('dark-mode');localStorage.setItem('ww_darkmode',document.body.classList.contains('dark-mode')?'true':'false');}

const THEME_LIST=[
  {id:'blue',label:'Classic Blue',colors:['#1a3a6a','#2a5a8a','#c8963e']},
  {id:'royalgold',label:'Royal Gold',colors:['#2d1b4e','#4a2f7a','#d4af37']},
  {id:'midnight',label:'Midnight',colors:['#0a0e27','#1a2050','#d4af37']},
  {id:'platinum',label:'Platinum',colors:['#1f2937','#3b4759','#9ca3af']},
  {id:'wine',label:'Wine',colors:['#4a0e1f','#6b1830','#c8963e']},
  {id:'forestgold',label:'Forest Gold',colors:['#1b3a2e','#2d5a45','#c8963e']},
  {id:'walnut',label:'Walnut',colors:['#6b4226','#8b5a35','#c99566']},
  {id:'emerald',label:'Emerald',colors:['#0f5132','#1c7a4a','#5cc490']},
  {id:'rosewood',label:'Rosewood',colors:['#7a2e2e','#9a3f3a','#d99787']},
  {id:'ocean',label:'Ocean',colors:['#0c4a6e','#0369a1','#7dd3fc']},
  {id:'slate',label:'Slate',colors:['#334155','#475569','#94a3b8']},
  {id:'charcoal',label:'Charcoal',colors:['#26272b','#3f4147','#8b8e96']}
];

function applyTheme(name){
  document.body.setAttribute('data-theme',name||'blue');
  try{localStorage.setItem('ww_theme',name||'blue');}catch(e){}
  renderThemeSwatches();
}
function getSavedTheme(){try{return localStorage.getItem('ww_theme')||'blue';}catch(e){return'blue';}}

function renderThemeSwatches(){
  let grid=document.getElementById('themeSwatchGrid');
  if(!grid)return;
  let current=getSavedTheme();
  grid.innerHTML=THEME_LIST.map(t=>`
    <div>
      <div class="theme-swatch ${current===t.id?'active':''}" onclick="applyTheme('${t.id}')" title="${t.label}">
        <span style="background:${t.colors[0]};"></span><span style="background:${t.colors[1]};"></span><span style="background:${t.colors[2]};"></span>
        ${current===t.id?'<span class="ts-check">✓</span>':''}
      </div>
      <div class="theme-swatch-label">${esc(t.label)}</div>
    </div>
  `).join('');
}

// ─── ONLINE / OFFLINE STATUS ───
function updateConnectionStatus(){
  let dot=document.getElementById('syncDot'),txt=document.getElementById('syncText');
  if(!dot||!txt)return;
  if(!navigator.onLine){dot.className='sync-dot error';txt.textContent='📴 Offline (data safe)';return;}
  if(cloudEnabled)setSyncStatus('online');
}
window.addEventListener('online',()=>{updateConnectionStatus();if(cloudEnabled)cloudSave();});
window.addEventListener('offline',updateConnectionStatus);
function esc(s){if(!s)return'';return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
function fmtRs(n){return (businessProfile?.currency||'Rs.')+(Math.round(n||0)).toLocaleString();}
function getPartyName(id){return parties.find(p=>p.id==id)?.name||'Unknown';}
function getPartyById(id){return parties.find(p=>p.id==id);}
function getFullAddress(p){if(!p)return'';return [p.address,p.area].filter(Boolean).join(', ');}
function getPartyOrders(partyId){return orders.filter(o=>o.partyId===partyId);}
function getPartyBalance(p){
  if(!p)return 0;
  let pOrders=getPartyOrders(p.id);
  let totalSales=pOrders.reduce((s,o)=>s+o.orderTotal,0);
  let totalPaid=pOrders.reduce((s,o)=>s+getOrderTotalPaid(o),0);
  let directPayments=(p.partyPayments||[]).reduce((s,pp)=>s+(parseFloat(pp.amount)||0),0);
  return (p.openingBalance||0)+totalSales-totalPaid-directPayments;
}
function calcSqft(w,h){return(parseFloat(w)||0)*(parseFloat(h)||0)/144;}
function getWoodRate(id){return woodTypes.find(w=>w.id==id)?.rate||0;}
function getWoodOrdersConsumedRaw(woodTypeId){
  let total=0;
  orders.forEach(o=>(o.doors||[]).forEach(d=>{
    if(d.woodId==woodTypeId)total+=getDoorCft(d);
  }));
  return total;
}
function getWoodConsumed(woodTypeId){
  let w=woodTypes.find(x=>x.id==woodTypeId);
  let ordersPart=Math.max(0,getWoodOrdersConsumedRaw(woodTypeId)-(parseFloat(w?.consumedBaseline)||0)); // baseline hides orders-usage from before a reset, if any
  return ordersPart+(parseFloat(w?.manualUsage)||0);
}
function getWoodPurchasedCft(woodTypeId){
  return purchases.filter(p=>p.woodTypeId==woodTypeId).reduce((s,p)=>s+(parseFloat(p.qty)||0),0);
}
function getWoodStockRemaining(w){
  return (w.openingStock||0)+getWoodPurchasedCft(w.id)-getWoodConsumed(w.id);
}
function getDoorRate(d){return parseFloat(d.rate)||0;}
function calcAutoCft(w,h,th){return((parseFloat(w)||0)*(parseFloat(h)||0)*(parseFloat(th)||defaultThickness))/1728;}
// FIXED: multiply by qty
function getDoorCft(d){
  if(d.cftMode==='manual') return parseFloat(d.woodCft)||0;
  let cftPerDoor = calcAutoCft(d.w,d.h,d.thickness||defaultThickness);
  let qty = parseFloat(d.qty)||1;
  return cftPerDoor * qty;
}
function getDoorWoodCost(d){return getDoorCft(d)*getWoodRate(d.woodId);}
function getSupplierName(id){return suppliers.find(s=>s.id==id)?.name||'Unknown';}
function getOrderTotalPaid(o){if(!o)return 0;if(o.payments&&o.payments.length>0)return o.payments.reduce((s,p)=>s+(parseFloat(p.amount)||0),0);return parseFloat(o.advancePayment)||0;}
function getKarigarName(id){return karigars.find(k=>k.id==id)?.name||'Unknown';}
function numToWordsPK(num){
  num=Math.round(Math.abs(num||0));
  if(num===0)return'Zero';
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function twoDigit(n){if(n<20)return ones[n];return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');}
  function threeDigit(n){if(n<100)return twoDigit(n);return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+twoDigit(n%100):'');}
  let crore=Math.floor(num/10000000);num%=10000000;
  let lakh=Math.floor(num/100000);num%=100000;
  let thousand=Math.floor(num/1000);num%=1000;
  let rest=num;
  let parts=[];
  if(crore)parts.push(threeDigit(crore)+' Crore');
  if(lakh)parts.push(threeDigit(lakh)+' Lakh');
  if(thousand)parts.push(threeDigit(thousand)+' Thousand');
  if(rest)parts.push(threeDigit(rest));
  return parts.join(' ');
}
function amountInWords(n){return numToWordsPK(n)+' Rupees Only';}

// ─── STATE ───
let parties=[],orders=[],labours=[],expenses=[],inventory=[],deletedItems=[],purchases=[],suppliers=[],bankTransactions=[];
let karigars=[];
let woodTypes=[{id:1,name:'Pertal Wood',rate:340,openingStock:0},{id:2,name:'German Kail',rate:280,openingStock:0},{id:3,name:'Indian Kail',rate:220,openingStock:0},{id:4,name:'Yellow Pine',rate:300,openingStock:0},{id:5,name:'Mahogany',rate:450,openingStock:0}];
// New records get a time-based id so two phones never create the same id
// (old ids from a simple counter clashed when phones synced).
function newId(){let t=Date.now()*100+Math.floor(Math.random()*100);nextId=Math.max((nextId||0)+1,t);return nextId;}
let defaultThickness=1.5,nextId=100,orderCounter=0,purchaseCounter=0,labourCounter=0,receiptCounter=0,challanCounter=0;
let priceList=[],orderTemplates=[],doorDesigns=[];
let karigarAttendance=[];
let quotations=[],quoteCounter=0;
let activityLog=[];
let cheques=[];
let editingChequeId=null,_chequeFormType='received';
let currentOrderDoors=[];
let currentOrderPhoto=null;
let editingOrderId=null,editingLabourId=null,editingPartyId=null,editingExpenseId=null,editingInventoryId=null,editingQuotationId=null;
let editingPurchaseId=null,editingSupplierId=null,editingBankTransactionId=null,editingKarigarId=null;
let payingOrderId=null;
let labourKarigars=[];
let businessProfile={name:'HK WOOD DOORS',tagline:'Wooden Doors Manufacturer & Trader',phone:'',address:'',footerNote:'Thank You for Your Business 🙏',invoicePrefix:'ORD-',currency:'Rs.',invoiceTerms:'',paymentTerms:'',deliveryTerms:'',ntn:'',bankName:'',bankAccount:'',city:'',brandName:'HK WOOD DOORS',whatsapp:'',invoiceDueDays:7,defaultLowStock:5,defaultTaxPercent:0,defaultDiscountPercent:0};

const BANK_ACCOUNTS=['Cash','HBL','UBL','MCB','Bank Alfalah','Meezan Bank','EasyPaisa','JazzCash'];
const QUICK_EXPENSE_ITEMS=[
  {name:'Gond/Glue (گوند)',category:'Hardware'},
  {name:'Gilu',category:'Hardware'},
  {name:'Fevicol/Adhesive',category:'Hardware'},
  {name:'Patta (Hinges)',category:'Hardware'},
  {name:'Grinder',category:'Hardware'},
  {name:'Grinder Patta (Blade)',category:'Hardware'},
  {name:'Buff Patta (Buffing Pad)',category:'Hardware'},
  {name:'Sandpaper',category:'Hardware'},
  {name:'Kunda/Handle',category:'Hardware'},
  {name:'Tala (Lock)',category:'Hardware'},
  {name:'Peecha (Screws)',category:'Hardware'},
  {name:'Polish/Varnish',category:'Hardware'},
  {name:'Spray Paint',category:'Hardware'},
  {name:'Foam/Silicon',category:'Hardware'},
  {name:'Blade/Cutter',category:'Hardware'},
  {name:'M.S. Patti',category:'Hardware'},
  {name:'Elfi',category:'Hardware'},
  {name:'Keel (Nails)',category:'Hardware'},
  {name:'Pin',category:'Hardware'},
  {name:'Diesel/Petrol',category:'Transport'},
  {name:'Bijli Bill',category:'Utilities'},
  {name:'Bill Shop',category:'Utilities'},
  {name:'Karaya (Rent)',category:'Rent'},
  {name:'Dukaan Kharcha (Shop Expense)',category:'Shop'},
  {name:'Others',category:'Misc'}
];

// ─── STORAGE ───
function getDataSnapshot(){return{parties,orders,labours,expenses,inventory,deletedItems,woodTypes,defaultThickness,nextId,orderCounter,purchaseCounter,labourCounter,receiptCounter,purchases,suppliers,bankTransactions,karigars,businessProfile,staffUsers,priceList,orderTemplates,challanCounter,doorDesigns,karigarAttendance,quotations,quoteCounter,cheques,activityLog};}
function saveLocal(){
  let raw;try{raw=JSON.stringify(getDataSnapshot());}catch(e){console.error('Save:',e);return;}
  if(window.HKStore&&HKStore.ok){
    HKStore.set('ww_data',raw).catch(()=>{
      try{localStorage.setItem('ww_data',raw);}catch(e){showToast('⚠️ Storage full! Backup download karein');}
    });
  }else{
    try{localStorage.setItem('ww_data',raw);}catch(e){showToast('⚠️ Storage full! Backup download karein');}
  }
}
function saveAll(){saveLocal();_cloudDirty=true;clearTimeout(window._cloudTimer);window._cloudTimer=setTimeout(()=>{if(cloudEnabled)cloudSave();},4000);}
let _bootRaw=null;
function loadData(){try{let raw=_bootRaw!==null?_bootRaw:localStorage.getItem('ww_data');if(raw){let d=JSON.parse(raw);parties=d.parties||[];orders=d.orders||[];labours=d.labours||[];expenses=d.expenses||[];inventory=d.inventory||[];deletedItems=d.deletedItems||[];woodTypes=d.woodTypes||woodTypes;defaultThickness=d.defaultThickness||1.5;nextId=d.nextId||100;orderCounter=d.orderCounter||0;purchaseCounter=d.purchaseCounter||0;labourCounter=d.labourCounter||0;receiptCounter=d.receiptCounter||0;purchases=d.purchases||[];suppliers=d.suppliers||[];bankTransactions=d.bankTransactions||[];karigars=d.karigars||[];businessProfile=d.businessProfile||businessProfile;staffUsers=d.staffUsers||[];priceList=d.priceList||[];orderTemplates=d.orderTemplates||[];challanCounter=d.challanCounter||0;doorDesigns=d.doorDesigns||[];karigarAttendance=d.karigarAttendance||[];quotations=d.quotations||[];quoteCounter=d.quoteCounter||0;cheques=d.cheques||[];activityLog=d.activityLog||[];orders.forEach(o=>{if(!o.payments)o.payments=[];});}}catch(e){console.error('Load:',e);}try{let uid=localStorage.getItem('ww_active_user');if(uid&&staffUsers.some(u=>u.id===parseInt(uid)))activeUserId=parseInt(uid);}catch(e){}if(!doorDesigns.length)doorDesigns=[...DEFAULT_DOOR_DESIGNS];applyBusinessProfileToUI();}
function applyData(d){if(d.parties)parties=d.parties;if(d.orders)orders=d.orders;if(d.labours)labours=d.labours;if(d.expenses)expenses=d.expenses;if(d.inventory)inventory=d.inventory;if(d.deletedItems)deletedItems=d.deletedItems;if(d.woodTypes)woodTypes=d.woodTypes;if(d.defaultThickness)defaultThickness=d.defaultThickness;if(d.nextId)nextId=d.nextId;if(d.orderCounter)orderCounter=d.orderCounter;if(d.purchaseCounter)purchaseCounter=d.purchaseCounter;if(d.labourCounter)labourCounter=d.labourCounter;if(d.receiptCounter)receiptCounter=d.receiptCounter;if(d.purchases)purchases=d.purchases;if(d.suppliers)suppliers=d.suppliers;if(d.bankTransactions)bankTransactions=d.bankTransactions;if(d.karigars)karigars=d.karigars;if(d.businessProfile)businessProfile=d.businessProfile;if(d.staffUsers)staffUsers=d.staffUsers;if(d.priceList)priceList=d.priceList;if(d.orderTemplates)orderTemplates=d.orderTemplates;if(d.challanCounter)challanCounter=d.challanCounter;if(d.doorDesigns)doorDesigns=d.doorDesigns;if(d.karigarAttendance)karigarAttendance=d.karigarAttendance;if(d.quotations)quotations=d.quotations;if(d.quoteCounter)quoteCounter=d.quoteCounter;if(d.cheques)cheques=d.cheques;if(d.activityLog)activityLog=d.activityLog;orders.forEach(o=>{if(!o.payments)o.payments=[];});saveLocal();applyBusinessProfileToUI();}
function applyBusinessProfileToUI(){let h=document.getElementById('hdrCompanyName');if(h)h.textContent=businessProfile.name||'HK WOOD DOORS';document.title=(businessProfile.name||'HK WOOD DOORS')+' — ERP';}

// ─── TAB SWITCH ───
function switchTab(tabId){
  if(!tabId)return;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-pill').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.drawer-item').forEach(t=>t.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  document.querySelector(`.tab-pill[data-tab="${tabId}"]`)?.classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tabId}"]`)?.classList.add('active');
  document.querySelector(`.drawer-item[data-tab="${tabId}"]`)?.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
  if(tabId!=='tabHome' && !_tabHistoryPushed && !_suppressHistory){
    history.pushState({hkTab:true},'',location.href);
    _tabHistoryPushed=true;
  }else if(tabId==='tabHome'){
    _tabHistoryPushed=false;
  }
  const r={tabHome:renderDashboard,tabOrders:renderOrders,tabLabour:renderLabourList,tabProduction:renderProduction,tabInventory:renderInventory,tabExpenses:renderExpenses,tabPurchases:renderPurchases,tabSuppliers:renderSuppliers,tabBankBook:renderBankBook,tabReports:renderReports,tabRecycle:renderRecycleBin,tabParties:renderParties,tabKhata:renderKhata};
  if(r[tabId])r[tabId]();
}
let _tabHistoryPushed=false;
function renderAll(){renderDashboard();renderOrders();renderLabourList();renderParties();renderKhata();renderInventory();renderExpenses();renderPurchases();renderSuppliers();renderBankBook();renderProduction();renderRecycleBin();renderReports();}

// ════════════════════════════════════════════════════
// ──────── NAVIGATION WIRING (FIX: buttons weren't clickable) ─
// ════════════════════════════════════════════════════
function wireNavigation(){
  // Any element with data-tab (bottom nav + drawer items) now actually switches tabs.
  document.querySelectorAll('[data-tab]').forEach(el=>{
    el.addEventListener('click',function(ev){
      ev.preventDefault();
      let tab=this.getAttribute('data-tab');
      switchTab(tab);
      if(this.classList.contains('drawer-item'))closeDrawer();
    });
  });
}

// ════════════════════════════════════════════════════
// ──────── SIDE DRAWER NAVIGATION ────────────────────
// ════════════════════════════════════════════════════
function openDrawer(){document.getElementById('drawerNav')?.classList.add('open');document.getElementById('drawerOverlay')?.classList.add('open');}
function closeDrawer(){document.getElementById('drawerNav')?.classList.remove('open');document.getElementById('drawerOverlay')?.classList.remove('open');let inp=document.getElementById('drawerFilterInput');if(inp){inp.value='';filterDrawerItems('');}}
function filterDrawerItems(q){
  q=(q||'').trim().toLowerCase();
  document.querySelectorAll('.drawer-item').forEach(btn=>{
    let text=btn.textContent.toLowerCase();
    btn.style.display=(!q||text.includes(q))?'flex':'none';
  });
  document.querySelectorAll('.drawer-section-label').forEach(label=>{
    let next=label.nextElementSibling,anyVisible=false;
    while(next&&next.classList.contains('drawer-item')){
      if(next.style.display!=='none')anyVisible=true;
      next=next.nextElementSibling;
    }
    label.style.display=(!q||anyVisible)?'block':'none';
  });
}

// ════════════════════════════════════════════════════
// ──────── DASHBOARD MENU GRID (NEW) ─────────────────
// ════════════════════════════════════════════════════
function renderDashboardMenu(){
  let grid=document.getElementById('dashboardMenuGrid');
  if(!grid)return;
  function badgeFor(item){
    if(item.tab==='tabKhata'){
      let dueParties=parties.filter(p=>getPartyBalance(p)>0).length;
      return dueParties>0?`<span class="mg-badge">${dueParties}</span>`:'';
    }
    if(item.tab==='tabInventory'){
      let low=inventory.filter(i=>i.qty<=i.minStock).length;
      return low>0?`<span class="mg-badge">${low}</span>`:'';
    }
    if(item.action==='openWoodStockModal'){
      let low=woodTypes.filter(w=>getWoodStockRemaining(w)<=10).length;
      return low>0?`<span class="mg-badge">${low}</span>`:'';
    }
    return '';
  }
  grid.innerHTML=DASHBOARD_SECTIONS.map(section=>`
    <div class="dashboard-section" style="--sec-c1:${section.c1};--sec-c2:${section.c2};">
      <div class="dashboard-section-title">${section.title}</div>
      <div class="menu-grid">
        ${section.items.map(item=>{
          let handler=item.tab?`switchTab('${item.tab}')`:`${item.action}()`;
          return `<div class="menu-grid-item" onclick="${handler}"><div class="mg-icon">${item.icon}</div><div class="mg-label">${esc(item.label)}</div>${badgeFor(item)}</div>`;
        }).join('')}
      </div>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════════
// ──────── GLOBAL SEARCH ─────────────────────────────
// ════════════════════════════════════════════════════
function openSearchModal(){
  document.getElementById('searchModalBody').innerHTML=`
    <div class="search-bar" style="margin-bottom:10px;"><span class="s-icon">🔍</span><input type="text" id="globalSearchInput" placeholder="Order no, party, karigar, item... kuch bhi likho" oninput="runGlobalSearch(this.value)" autofocus></div>
    <div id="globalSearchResults"><div class="empty-state"><div class="e-icon">🔍</div><p>Order number, party naam, karigar, stock item, supplier ya kharcha — kuch bhi search karo</p></div></div>`;
  openModal('searchModal');
  setTimeout(()=>document.getElementById('globalSearchInput')?.focus(),150);
}

function runGlobalSearch(q){
  let out=document.getElementById('globalSearchResults');
  q=(q||'').trim().toLowerCase();
  if(q.length<1){out.innerHTML=`<div class="empty-state"><div class="e-icon">🔍</div><p>Order number, party naam, karigar, stock item, supplier ya kharcha — kuch bhi search karo</p></div>`;return;}
  let results=[];
  orders.forEach(o=>{
    if(o.orderNo.toLowerCase().includes(q)||getPartyName(o.partyId).toLowerCase().includes(q)){
      results.push({cat:'Order',icon:'📋',title:`${o.orderNo} — ${getPartyName(o.partyId)}`,sub:`${fmtRs(o.orderTotal)} · ${o.status||'pending'}`,action:()=>{closeModal('searchModal');viewOrderDetail(o.id);}});
    }
  });
  parties.forEach(p=>{
    if(p.name.toLowerCase().includes(q)||(p.phone||'').includes(q)){
      results.push({cat:'Party',icon:'👤',title:p.name,sub:p.phone||'—',action:()=>{closeModal('searchModal');switchTab('tabParties');}});
    }
  });
  karigars.forEach(k=>{
    if(k.name.toLowerCase().includes(q)){
      results.push({cat:'Karigar',icon:'🔧',title:k.name,sub:k.workType||'General',action:()=>{closeModal('searchModal');openKarigarList();}});
    }
  });
  inventory.forEach(i=>{
    if(i.name.toLowerCase().includes(q)){
      results.push({cat:'Stock',icon:'📦',title:i.name,sub:`${i.qty} ${i.unit||'pcs'}`,action:()=>{closeModal('searchModal');switchTab('tabInventory');}});
    }
  });
  suppliers.forEach(s=>{
    if(s.name.toLowerCase().includes(q)){
      results.push({cat:'Supplier',icon:'🏪',title:s.name,sub:s.phone||'—',action:()=>{closeModal('searchModal');switchTab('tabSuppliers');}});
    }
  });
  expenses.forEach(e=>{
    if(e.description.toLowerCase().includes(q)){
      results.push({cat:'Kharcha',icon:'💰',title:e.description,sub:`${fmtRs(e.amount)} · ${e.date}`,action:()=>{closeModal('searchModal');switchTab('tabExpenses');}});
    }
  });
  if(results.length===0){out.innerHTML=`<div class="empty-state"><div class="e-icon">😕</div><p>Kuch nahi mila "${esc(q)}" ke liye</p></div>`;return;}
  window._searchResults=results;
  out.innerHTML=results.slice(0,40).map((r,i)=>`
    <div class="search-result-item" onclick="window._searchResults[${i}].action()">
      <div><div class="search-result-cat">${r.cat}</div><div style="font-weight:700;font-size:11px;">${r.icon} ${esc(r.title)}</div><div style="font-size:8px;color:var(--gray-500);">${esc(r.sub)}</div></div>
      <span style="font-size:14px;color:var(--gray-500);">›</span>
    </div>`).join('');
}

// ════════════════════════════════════════════════════
// ──────── STAFF / MULTI-USER ────────────────────────
// ════════════════════════════════════════════════════
let staffUsers=[],activeUserId=null;

function openUserSwitcher(){
  let body=document.getElementById('userModalBody');
  document.getElementById('userModalTitle').innerHTML='🧑‍💼 Staff / Users <button class="modal-close" onclick="closeModal(\'userModal\')">✕</button>';
  let uHtml=staffUsers.length?staffUsers.map(u=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--border);"><span><strong>${esc(u.name)}</strong> ${u.role||'Staff'}</span><div><button class="btn btn-outline btn-xs" onclick="switchUser(${u.id})">${activeUserId===u.id?'✅ Active':'Switch'}</button><button class="btn btn-danger btn-xs" onclick="deleteUser(${u.id})">🗑</button></div></div>`).join(''):'<div class="empty-state"><p>Koi staff nahi</p></div>';
  body.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
      <div><input class="form-input" id="newUserName" placeholder="Name"></div>
      <div><input class="form-input" id="newUserPin" placeholder="PIN (4 digit)" type="password" maxlength="4"></div>
    </div>
    <button class="btn btn-primary" onclick="addStaffUser()">+ Add Staff</button>
    <div style="margin-top:10px;font-size:8px;color:var(--gray-500);">${staffUsers.length} staff registered</div>
    <div style="margin-top:8px;">${uHtml}</div>
  `;
  openModal('userModal');
}

function addStaffUser(){
  let name=document.getElementById('newUserName').value.trim();
  let pin=document.getElementById('newUserPin').value.trim();
  if(!name||!pin||pin.length!==4){showToast('⚠️ Name aur 4-digit PIN zaruri');return;}
  let id=Date.now();
  staffUsers.push({id,name,pin,role:'Staff',createdAt:new Date().toISOString()});
  if(!activeUserId)activeUserId=id;
  localStorage.setItem('ww_active_user',id);
  saveAll();
  updateUserBadge();
  openUserSwitcher();
  showToast('✅ Staff added');
}

function switchUser(id){
  let u=staffUsers.find(x=>x.id===id);
  if(!u){showToast('⚠️ User not found');return;}
  activeUserId=id;
  localStorage.setItem('ww_active_user',id);
  updateUserBadge();
  showToast(`👤 Switched to ${u.name}`);
  openUserSwitcher();
}

function deleteUser(id){
  if(id===activeUserId){showToast('⚠️ Cannot delete active user');return;}
  customConfirm('Delete this staff?',()=>{
    staffUsers=staffUsers.filter(u=>u.id!==id);
    saveAll();
    openUserSwitcher();
    showToast('🗑 Deleted');
  });
}

function updateUserBadge(){
  let badge=document.getElementById('activeUserBadge');
  if(badge){
    if(!activeUserId||!staffUsers.length){badge.style.display='none';}
    else{
      let u=staffUsers.find(x=>x.id===activeUserId);
      if(u){badge.textContent='🧑 '+u.name;badge.style.display='block';}
      else badge.style.display='none';
    }
  }
  renderDrawerFooter();
}

function renderDrawerFooter(){
  let el=document.getElementById('drawerFooter');
  if(!el)return;
  let u=activeUserId?staffUsers.find(x=>x.id===activeUserId):null;
  let name=u?u.name:(businessProfile.ownerName||businessProfile.name||'Owner');
  let role=u?(u.role||'Staff'):'Administrator';
  let initials=name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  el.innerHTML=`
    <div class="du-avatar">${esc(initials)}</div>
    <div class="du-info">
      <div class="du-name">${esc(name)}</div>
      <div class="du-role">${esc(role)}</div>
    </div>
    <span style="color:rgba(255,255,255,.35);font-size:12px;">▾</span>
  `;
}

// ════════════════════════════════════════════════════
// ──────── CALCULATOR ────────────────────────────────
// ════════════════════════════════════════════════════
let calcStr='',calcResult='';
function openCalculator(){openModal('calcModal');calcClear();}
function calcClear(){calcStr='';calcResult='';document.getElementById('calcDisplay').textContent='0';document.getElementById('calcExpr').textContent='';}
function calcPress(v){
  let disp=document.getElementById('calcDisplay'),expr=document.getElementById('calcExpr');
  if(v==='='){
    try{
      if(!/^[0-9+\-*/.%()\s]+$/.test(calcStr))throw new Error('bad');
      let result=Function('"use strict";return('+calcStr+')')();
      calcResult=String(result);disp.textContent=result;expr.textContent=calcStr+' =';calcStr=String(result);
    }catch(e){disp.textContent='Error';expr.textContent='';calcStr='';}
  }else if(v==='back'){calcStr=calcStr.slice(0,-1);disp.textContent=calcStr||'0';}
  else{calcStr+=v;disp.textContent=calcStr;}
}

// ════════════════════════════════════════════════════
// ──────── ORDER MODAL ───────────────────────────────
// ════════════════════════════════════════════════════
function openOrderModal(orderId){
  editingOrderId=orderId||null;
  // Order Modal and Quotation Modal share the same door-row element IDs (only one
  // is ever meant to be "live" at once) — clear the other's stale content so
  // getElementById never resolves to a leftover hidden copy from the other modal.
  let qBody=document.getElementById('quotationModalBody');
  if(qBody)qBody.innerHTML='';
  let order=orderId?orders.find(o=>o.id===orderId):null;
  if(order){currentOrderDoors=JSON.parse(JSON.stringify(order.doors||[]));}else{currentOrderDoors=[];}
  currentOrderPhoto=order?(order.designPhoto||null):null;
  let html=`
    <div class="row-2">
      <div class="form-group"><label class="form-label">Party <span class="req">*</span></label>
        <select class="form-select" id="orderPartyId" onchange="toggleInlineNewParty()">${parties.map(p=>`<option value="${p.id}" ${order&&order.partyId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}<option value="__new__">➕ Nayi Party Add Karein</option></select>
      </div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="orderDate" value="${order?order.date:new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div id="inlineNewPartyArea" style="display:${parties.length?'none':'block'};background:var(--gold-light);border-radius:10px;padding:10px;margin-bottom:8px;border:1px dashed var(--gold);">
      <div style="font-size:9px;font-weight:700;margin-bottom:6px;">➕ Nayi Party — yahin add karein, kahin aur jaane ki zaroorat nahi</div>
      <div class="row-2">
        <div class="form-group"><label class="form-label">Naam <span class="req">*</span></label><input class="form-input" id="inlinePartyName" placeholder="Party ka naam"></div>
        <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="inlinePartyPhone" placeholder="Optional"></div>
      </div>
      <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="inlinePartyAddress" placeholder="Optional"></div>
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Status</label><select class="form-select" id="orderStatus"><option value="pending" ${order&&order.status==='pending'?'selected':''}>Pending</option><option value="cutting" ${order&&order.status==='cutting'?'selected':''}>Cutting</option><option value="assembly" ${order&&order.status==='assembly'?'selected':''}>Assembly</option><option value="polishing" ${order&&order.status==='polishing'?'selected':''}>Polishing</option><option value="ready" ${order&&order.status==='ready'?'selected':''}>Ready</option><option value="delivered" ${order&&order.status==='delivered'?'selected':''}>Delivered</option></select></div>
      <div class="form-group"><label class="form-label">Advance Payment</label><input class="form-input" type="number" id="orderAdvance" value="${order?order.advancePayment||0:0}"></div>
    </div>
    <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="orderNote" value="${order?esc(order.note||''):''}"></div>
    <div class="form-group">
      <label class="form-label">📷 Design Reference Photo</label>
      <div id="orderPhotoArea">${renderOrderPhotoArea()}</div>
      <input type="file" id="orderPhotoInput" accept="image/*" style="display:none;" onchange="handleOrderPhotoSelect(this.files[0])">
    </div>
    <div class="form-group">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${QUICK_SIZES.map(s=>`<button type="button" class="btn btn-outline btn-xs" onclick="addDoorFromSize('${s}')">${s}</button>`).join('')}
      </div>
    </div>
    <div id="orderDoorsContainer">${currentOrderDoors.map((d,i)=>renderDoorRow(d,i)).join('')}</div>
    <div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap;">
      <button type="button" class="btn btn-outline btn-sm" onclick="addEmptyDoor()">+ Add Door</button>
      <button type="button" class="btn btn-outline btn-sm" onclick="addSampleDoor()">📋 Sample</button>
      <button type="button" class="btn btn-gold btn-sm" onclick="openTemplateModal()">📁 Templates</button>
    </div>
    <div style="background:var(--gray-50);padding:10px;border-radius:8px;font-size:10px;">
      <div>Total Doors: <strong id="orderTotalDoors">${currentOrderDoors.length}</strong></div>
      <div>Total Amount: <strong id="orderTotalAmount">${fmtRs(currentOrderDoors.reduce((s,d)=>s+(parseFloat(d.doorAmount)||0),0))}</strong></div>
      <div>Total Wood Cft: <strong id="orderTotalWood">${currentOrderDoors.reduce((s,d)=>s+getDoorCft(d),0).toFixed(2)}</strong></div>
      <div>Total Wood Cost: <strong id="orderTotalWoodCost">${fmtRs(currentOrderDoors.reduce((s,d)=>s+getDoorWoodCost(d),0))}</strong></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button type="button" class="btn btn-primary" onclick="saveOrder()">💾 Save Order</button>
      <button type="button" class="btn btn-outline" onclick="closeModal('orderModal')">Cancel</button>
    </div>
  `;
  document.getElementById('orderModalBody').innerHTML=html;
  document.getElementById('orderModalTitle').innerHTML=`${order?'✏️ Edit':'📋 New'} Order <button class="modal-close" onclick="closeModal('orderModal')">✕</button>`;
  openModal('orderModal');
}

// ════════════════════════════════════════════════════
// ──────── QUOTATION / ESTIMATE (non-binding) ────────
// ════════════════════════════════════════════════════
function openQuotationModal(quoteId){
  editingQuotationId=quoteId||null;
  let oBody=document.getElementById('orderModalBody');
  if(oBody)oBody.innerHTML='';
  let q=quoteId?quotations.find(x=>x.id===quoteId):null;
  if(q){currentOrderDoors=JSON.parse(JSON.stringify(q.doors||[]));}else{currentOrderDoors=[];}
  currentOrderPhoto=q?(q.designPhoto||null):null;
  let defaultValidUntil=new Date();defaultValidUntil.setDate(defaultValidUntil.getDate()+15);
  let html=`
    <div style="background:#fef3c7;color:#92400e;border-radius:8px;padding:8px 12px;font-size:8.5px;margin-bottom:10px;">📝 Yeh sirf ek <strong>Estimate</strong> hai — na Order banega, na Wood Stock/Khata mein asar hoga, jab tak "Order Mein Convert Karein" na dabayein.</div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Party <span class="req">*</span></label>
        <select class="form-select" id="orderPartyId" onchange="toggleInlineNewParty()">${parties.map(p=>`<option value="${p.id}" ${q&&q.partyId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}<option value="__new__">➕ Nayi Party Add Karein</option></select>
      </div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="orderDate" value="${q?q.date:new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div id="inlineNewPartyArea" style="display:${parties.length?'none':'block'};background:var(--gold-light);border-radius:10px;padding:10px;margin-bottom:8px;border:1px dashed var(--gold);">
      <div style="font-size:9px;font-weight:700;margin-bottom:6px;">➕ Nayi Party — yahin add karein</div>
      <div class="row-2">
        <div class="form-group"><label class="form-label">Naam <span class="req">*</span></label><input class="form-input" id="inlinePartyName" placeholder="Party ka naam"></div>
        <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="inlinePartyPhone" placeholder="Optional"></div>
      </div>
      <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="inlinePartyAddress" placeholder="Optional"></div>
    </div>
    <div class="form-group"><label class="form-label">Valid Until (kab tak yeh rate valid hai)</label><input class="form-input" type="date" id="quoteValidUntil" value="${q?q.validUntil:defaultValidUntil.toISOString().slice(0,10)}"></div>
    <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="orderNote" value="${q?esc(q.note||''):''}"></div>
    <div class="form-group">
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${QUICK_SIZES.map(s=>`<button type="button" class="btn btn-outline btn-xs" onclick="addDoorFromSize('${s}')">${s}</button>`).join('')}
      </div>
    </div>
    <div id="orderDoorsContainer">${currentOrderDoors.map((d,i)=>renderDoorRow(d,i)).join('')}</div>
    <div style="display:flex;gap:6px;margin:8px 0;flex-wrap:wrap;">
      <button type="button" class="btn btn-outline btn-sm" onclick="addEmptyDoor()">+ Add Door</button>
      <button type="button" class="btn btn-gold btn-sm" onclick="openTemplateModal()">📁 Templates</button>
    </div>
    <div style="background:var(--gray-50);padding:10px;border-radius:8px;font-size:10px;">
      <div>Total Doors: <strong id="orderTotalDoors">${currentOrderDoors.length}</strong></div>
      <div>Total Amount: <strong id="orderTotalAmount">${fmtRs(currentOrderDoors.reduce((s,d)=>s+(parseFloat(d.doorAmount)||0),0))}</strong></div>
      <div>Total Wood Cft: <strong id="orderTotalWood">${currentOrderDoors.reduce((s,d)=>s+getDoorCft(d),0).toFixed(2)}</strong></div>
      <div>Total Wood Cost: <strong id="orderTotalWoodCost">${fmtRs(currentOrderDoors.reduce((s,d)=>s+getDoorWoodCost(d),0))}</strong></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button type="button" class="btn btn-primary" onclick="saveQuotation()">💾 Estimate Save Karein</button>
      <button type="button" class="btn btn-outline" onclick="closeModal('quotationModal')">Cancel</button>
    </div>
  `;
  document.getElementById('quotationModalBody').innerHTML=html;
  document.getElementById('quotationModalTitle').innerHTML=`${q?'✏️ Edit':'📝 New'} Estimate <button class="modal-close" onclick="closeModal('quotationModal')">✕</button>`;
  openModal('quotationModal');
}

function saveQuotation(){
  let partyId=document.getElementById('orderPartyId')?.value;
  if(partyId==='__new__'){
    let newName=document.getElementById('inlinePartyName')?.value.trim();
    if(!newName){showToast('⚠️ Party ka naam likhein');return;}
    let newParty={id:newId(),name:newName,phone:document.getElementById('inlinePartyPhone')?.value||'',area:'',address:document.getElementById('inlinePartyAddress')?.value||'',openingBalance:0,createdAt:new Date().toISOString()};
    parties.push(newParty);
    partyId=String(newParty.id);
    showToast(`✅ Party "${newName}" add ho gayi`);
  }
  if(!partyId||!parties.find(p=>p.id==parseInt(partyId))){showToast('⚠️ Party select karo');return;}
  if(!currentOrderDoors.length){showToast('⚠️ Kam se kam ek door add karo');return;}
  let date=document.getElementById('orderDate')?.value||new Date().toISOString().slice(0,10);
  let validUntil=document.getElementById('quoteValidUntil')?.value||date;
  let note=document.getElementById('orderNote')?.value||'';
  let totalAmt=currentOrderDoors.reduce((s,d)=>s+(parseFloat(d.doorAmount)||0),0);
  let totalWood=currentOrderDoors.reduce((s,d)=>s+getDoorCft(d),0);
  let totalWoodCost=currentOrderDoors.reduce((s,d)=>s+getDoorWoodCost(d),0);

  let quoteData={
    partyId:parseInt(partyId),date,validUntil,note,
    doors:currentOrderDoors.map(d=>({...d})),
    quoteTotal:totalAmt,totalWoodCft:totalWood,totalWoodCost:totalWoodCost,
    designPhoto:currentOrderPhoto,
    updatedAt:new Date().toISOString()
  };

  if(editingQuotationId){
    let idx=quotations.findIndex(x=>x.id===editingQuotationId);
    if(idx>-1){quoteData.status=quotations[idx].status;quoteData.quoteNo=quotations[idx].quoteNo;quotations[idx]={...quotations[idx],...quoteData};showToast('✅ Estimate updated');}
  }else{
    quoteCounter++;
    quoteData.id=newId();
    quoteData.quoteNo='EST-'+quoteCounter;
    quoteData.status='pending';
    quoteData.createdAt=new Date().toISOString();
    quotations.push(quoteData);
    showToast(`✅ Estimate ${quoteData.quoteNo} ban gaya`);
  }
  saveAll();
  closeModal('quotationModal');
  openQuotationList();
}

function openQuotationList(){
  renderQuotationList();
  openModal('quotationListModal');
}

function renderQuotationList(){
  let body=document.getElementById('quotationListModalBody');
  let sorted=quotations.slice().sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  body.innerHTML=`
    <button class="btn btn-primary btn-sm" style="margin-bottom:10px;" onclick="closeModal('quotationListModal');openQuotationModal()">+ Naya Estimate</button>
    ${sorted.length?sorted.map(q=>{
      let statusColors={pending:'#c8963e',converted:'#16a34a',expired:'#94a3b8'};
      let statusLabels={pending:'Pending',converted:'✅ Order Ban Gaya',expired:'Expired'};
      return `<div class="khata-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;font-size:13px;">${esc(q.quoteNo)} — ${esc(getPartyName(q.partyId))}</div>
            <div style="font-size:9px;color:var(--gray-500);">${q.date} · Valid Until: ${q.validUntil}</div>
          </div>
          <div style="font-size:13px;font-weight:800;">${fmtRs(q.quoteTotal)}</div>
        </div>
        <div style="margin-top:5px;"><span style="background:${statusColors[q.status]};color:#fff;padding:2px 10px;border-radius:10px;font-size:8px;font-weight:700;">${statusLabels[q.status]}</span></div>
        <div style="display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;">
          <button class="btn btn-outline btn-xs" onclick="closeModal('quotationListModal');openQuotationModal(${q.id})">✏️ Edit</button>
          <button class="btn btn-gold btn-xs" onclick="generateQuotationPDF(${q.id})">📄 PDF</button>
          ${q.status==='pending'?`<button class="btn btn-success btn-xs" onclick="convertQuotationToOrder(${q.id})">✅ Order Mein Convert Karein</button>`:''}
          <button class="btn btn-danger btn-xs" onclick="deleteQuotation(${q.id})">🗑 Delete</button>
        </div>
      </div>`;
    }).join(''):'<div class="empty-state"><div class="e-icon">📝</div><p>Koi estimate nahi bana abhi tak</p></div>'}
  `;
}

function deleteQuotation(quoteId){
  customConfirm('Delete this estimate?',()=>{
    quotations=quotations.filter(x=>x.id!==quoteId);
    saveAll();
    renderQuotationList();
    showToast('🗑 Estimate deleted');
  });
}

function convertQuotationToOrder(quoteId){
  let q=quotations.find(x=>x.id===quoteId);
  if(!q)return;
  customConfirm(`"${q.quoteNo}" ko asal Order mein convert karein?`,()=>{
    orderCounter++;
    let orderNo=businessProfile.invoicePrefix+orderCounter;
    let totalLabour=0; // labour is assigned separately once production actually starts
    let netProfit=q.quoteTotal-(q.totalWoodCost||0)-totalLabour;
    let newOrder={
      id:newId(),orderNo,partyId:q.partyId,date:new Date().toISOString().slice(0,10),
      status:'pending',advancePayment:0,note:q.note||'',
      doors:JSON.parse(JSON.stringify(q.doors||[])),
      orderTotal:q.quoteTotal,totalWoodCft:q.totalWoodCft,totalWoodCost:q.totalWoodCost,
      totalLabour:0,netProfit,designPhoto:q.designPhoto||null,
      payments:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    };
    orders.push(newOrder);
    q.status='converted';
    saveAll();
    closeModal('quotationListModal');
    renderAll();
    showOrderQuickActions(newOrder.id);
  });
}

function buildQuotationHTML(q, party, elId){
  let rows=(q.doors||[]).map((d,i)=>{
    let sqft=calcSqft(d.w,d.h)*(d.qty||1);
    let amount=parseFloat(d.doorAmount)||0;
    let rowBg=i%2===0?'#ffffff':'#f6f8fc';
    return `<tr style="background:${rowBg};">
      <td style="padding:7px 4px;text-align:center;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#9ca7b8;font-weight:700;font-size:8px;">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:7px 4px;border-bottom:1px solid #e8ecf3;white-space:nowrap;font-weight:600;">${esc(d.size||'')}</td>
      <td style="padding:7px 4px;text-align:center;border-bottom:1px solid #e8ecf3;white-space:nowrap;">${d.qty||1}</td>
      <td style="padding:7px 4px;text-align:center;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#6b7684;">${sqft.toFixed(1)}</td>
      <td style="padding:7px 4px;text-align:right;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#6b7684;">${fmtRs(d.rate||0)}</td>
      <td style="padding:7px 4px;text-align:right;font-weight:700;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#0f5132;">${fmtRs(amount)}</td>
    </tr>`;
  }).join('');
  return `
    <div id="${elId}" style="font-family:'Segoe UI',sans-serif;width:800px;box-sizing:border-box;margin:auto;background:#fff;color:#1a2a3a;">
      <div style="background:linear-gradient(120deg,#4a3a12,#8a6a1e 55%,#c8963e);padding:26px 30px 22px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.2),transparent 70%);"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1;">
          <div>
            <h1 style="font-size:25px;margin:0;color:#fff;letter-spacing:0.5px;font-weight:800;">${esc(businessProfile.name)}</h1>
            <p style="font-size:10px;color:#fdf0d8;margin:4px 0 0;">${esc(businessProfile.tagline || '')}</p>
            <p style="font-size:8.5px;color:#fdf0d8;margin-top:8px;">${esc(businessProfile.address || '')}${businessProfile.city?', '+esc(businessProfile.city):''}</p>
            <p style="font-size:8.5px;color:#fdf0d8;">${businessProfile.phone?'📞 '+esc(businessProfile.phone):''}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:2px;">ESTIMATE</div>
            <p style="font-size:11px;margin-top:8px;color:#fff;"><strong>${esc(q.quoteNo)}</strong></p>
            <p style="font-size:9px;color:#fdf0d8;">${q.date}</p>
            <div style="display:inline-block;background:rgba(255,255,255,0.25);color:#fff;padding:3px 12px;border-radius:12px;font-size:8px;font-weight:700;margin-top:5px;">Valid Until: ${q.validUntil}</div>
          </div>
        </div>
      </div>
      <div style="padding:22px 30px 26px;">
        <div style="background:#fef3c7;color:#92400e;border-radius:8px;padding:8px 14px;font-size:9px;margin-bottom:14px;font-weight:600;">📝 Yeh ek non-binding Estimate hai — final rate order confirm hone par tay hoga.</div>
        <div style="background:#f7f9fc;border-radius:10px;padding:12px 16px;margin-bottom:16px;border:1px solid #e8ecf3;">
          <p style="font-size:8px;color:#9ca7b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;font-weight:700;">Prepared For</p>
          <p style="font-size:14px;font-weight:700;color:#1a3a6a;">${esc(party?.name || 'Unknown')}</p>
          <p style="font-size:9px;color:#6b7684;margin-top:2px;">${esc(party?.phone || '')} ${party?.address?'· '+esc(party.address):''}</p>
        </div>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px;margin-bottom:16px;">
          <colgroup><col style="width:6%;"><col style="width:26%;"><col style="width:10%;"><col style="width:14%;"><col style="width:19%;"><col style="width:25%;"></colgroup>
          <thead><tr style="background:#4a3a12;">
            <th style="padding:8px 4px;text-align:center;white-space:nowrap;color:#e8d5a8;font-weight:600;font-size:7.5px;text-transform:uppercase;letter-spacing:.4px;border-radius:6px 0 0 0;">#</th>
            <th style="padding:8px 4px;text-align:left;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Size</th>
            <th style="padding:8px 4px;text-align:center;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Qty</th>
            <th style="padding:8px 4px;text-align:center;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Sq.ft</th>
            <th style="padding:8px 4px;text-align:right;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Rate</th>
            <th style="padding:8px 4px;text-align:right;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;border-radius:0 6px 0 0;">Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td colspan="2" style="padding:10px 4px;text-align:right;font-size:9px;font-weight:700;color:#4a3a12;border-top:2px solid #c8963e;white-space:nowrap;">ESTIMATED TOTAL</td>
            <td style="padding:10px 4px;text-align:center;font-size:10px;font-weight:800;color:#4a3a12;border-top:2px solid #c8963e;white-space:nowrap;">${(q.doors||[]).reduce((s,d)=>s+(parseFloat(d.qty)||1),0)}</td>
            <td style="padding:10px 4px;text-align:center;font-size:10px;font-weight:800;color:#4a3a12;border-top:2px solid #c8963e;white-space:nowrap;">${(q.doors||[]).reduce((s,d)=>s+calcSqft(d.w,d.h)*(d.qty||1),0).toFixed(1)}</td>
            <td style="padding:10px 4px;text-align:right;font-size:10px;font-weight:700;color:#4a3a12;border-top:2px solid #c8963e;white-space:nowrap;">—</td>
            <td style="padding:10px 4px;text-align:right;font-size:13px;font-weight:800;color:#4a3a12;border-top:2px solid #c8963e;white-space:nowrap;">${fmtRs(q.quoteTotal)}</td>
          </tr></tfoot>
        </table>
        <p style="font-size:8.5px;color:#9ca7b8;">${amountInWords(q.quoteTotal)}</p>
        <div style="font-size:8px;color:#9ca7b8;margin-top:20px;text-align:center;border-top:1px solid #e8ecf3;padding-top:12px;">
          <strong style="color:#c8963e;">Estimate confirm karne ke liye rabta karein — is date ke baad rate change ho sakti hai.</strong>
        </div>
      </div>
    </div>
  `;
}

function generateQuotationPDF(quoteId){
  let q=quotations.find(x=>x.id===quoteId);
  if(!q){showToast('⚠️ Estimate not found');return;}
  let party=getPartyById(q.partyId);
  let temp=document.createElement('div');
  temp.innerHTML=buildQuotationHTML(q,party,'quotePdfContent');
  temp.style.position='fixed';
  temp.style.left='0';
  temp.style.top='0';
  temp.style.width='800px';
  temp.style.background='#fff';
  temp.style.zIndex='150';
  temp.style.pointerEvents='none';
  document.body.appendChild(temp);
  downloadPDF('quotePdfContent', `Estimate_${q.quoteNo}.pdf`).finally(()=>temp.remove());
}

function renderOrderPhotoArea(){
  if(currentOrderPhoto){
    return `<div style="display:flex;align-items:center;gap:8px;">
      <img src="${currentOrderPhoto}" style="width:70px;height:70px;object-fit:cover;border-radius:10px;border:1px solid var(--border);cursor:pointer;" onclick="viewOrderPhotoFull('${currentOrderPhoto}')">
      <div style="display:flex;flex-direction:column;gap:4px;">
        <button type="button" class="btn btn-outline btn-xs" onclick="document.getElementById('orderPhotoInput').click()">🔄 Change</button>
        <button type="button" class="btn btn-danger btn-xs" onclick="removeOrderPhoto()">🗑 Remove</button>
      </div>
    </div>`;
  }
  return `<button type="button" class="btn btn-outline btn-sm" onclick="document.getElementById('orderPhotoInput').click()">📷 Photo Add Karein</button>`;
}

function handleOrderPhotoSelect(file){
  if(!file)return;
  if(!file.type.startsWith('image/')){showToast('⚠️ Sirf image file select karein');return;}
  let reader=new FileReader();
  reader.onload=function(e){
    let img=new Image();
    img.onload=function(){
      // Resize/compress — kept sharp enough for a clear invoice print, still light on storage
      let maxW=1100;
      let scale=Math.min(1,maxW/img.width);
      let canvas=document.createElement('canvas');
      canvas.width=img.width*scale;
      canvas.height=img.height*scale;
      let ctx=canvas.getContext('2d');
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      currentOrderPhoto=canvas.toDataURL('image/jpeg',0.85);
      let area=document.getElementById('orderPhotoArea');
      if(area)area.innerHTML=renderOrderPhotoArea();
      showToast('✅ Photo attach ho gayi');
    };
    img.onerror=function(){showToast('⚠️ Photo load nahi ho saki');};
    img.src=e.target.result;
  };
  reader.onerror=function(){showToast('⚠️ File read nahi ho saki');};
  reader.readAsDataURL(file);
}

function removeOrderPhoto(){
  currentOrderPhoto=null;
  let area=document.getElementById('orderPhotoArea');
  if(area)area.innerHTML=renderOrderPhotoArea();
  document.getElementById('orderPhotoInput').value='';
}

function viewOrderPhotoFull(src){
  let w=window.open('','_blank');
  if(w){
    w.document.write(`<html><head><title>Design Photo</title></head><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${src}" style="max-width:100%;max-height:100vh;"></body></html>`);
  }else{
    showToast('⚠️ Popup block ho gaya — browser settings check karein');
  }
}

function renderDoorRow(d,idx){
  let woodOpts=woodTypes.map(w=>`<option value="${w.id}" ${d.woodId==w.id?'selected':''}>${esc(w.name)} (${fmtRs(w.rate)}/cft)</option>`).join('');
  let cft=getDoorCft(d);
  let woodCost=getDoorWoodCost(d);
  let doorAmt=parseFloat(d.doorAmount)||0;
  let labourPerDoor=parseFloat(d.labourPerDoor)||0;
  let netProfit=doorAmt-woodCost-labourPerDoor;
  return `<div class="door-row" id="doorRow_${idx}">
    <div class="door-header"><span class="door-label" id="doorLabel_${idx}">🚪 Door #${idx+1} ${esc(d.size||'')}</span><button type="button" class="door-remove" onclick="removeDoor(${idx})">✕ Remove</button></div>
    <div class="door-fields">
      <div><div class="field-label">Size</div><input class="field-input" id="doorSize_${idx}" value="${esc(d.size||'')}" placeholder="45x75" onchange="updateDoor(${idx})"></div>
      <div><div class="field-label">Qty</div><input class="field-input" type="number" id="doorQty_${idx}" value="${d.qty||1}" min="1" onchange="updateDoor(${idx})"></div>
      <div><div class="field-label">Rate / sq.ft</div><input class="field-input" type="number" id="doorRate_${idx}" value="${d.rate||0}" step="1" onchange="updateDoor(${idx})"></div>
    </div>
    ${doorDesigns.length?`<div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:6px;">${doorDesigns.map(dz=>`<button type="button" class="btn btn-outline btn-xs" onclick="appendDesignToDoorSize(${idx},'${esc(dz).replace(/'/g,"\\'")}')">${esc(dz)}</button>`).join('')}</div>`:''}
    <div class="door-fields-2">
      <div><div class="field-label">Width (in)</div><input class="field-input" type="number" id="doorW_${idx}" value="${d.w||0}" step="0.1" onchange="updateDoor(${idx})"></div>
      <div><div class="field-label">Height (in)</div><input class="field-input" type="number" id="doorH_${idx}" value="${d.h||0}" step="0.1" onchange="updateDoor(${idx})"></div>
      <div><div class="field-label">Thickness</div><input class="field-input" type="number" id="doorThick_${idx}" value="${d.thickness||defaultThickness}" step="0.1" onchange="updateDoor(${idx})"></div>
      <div><div class="field-label">Wood Type</div><select class="field-select" id="doorWood_${idx}" onchange="updateDoor(${idx})">${woodOpts}</select></div>
      <div><div class="field-label">Labour (is line ki)</div><input class="field-input" type="number" id="doorLabour_${idx}" value="${labourPerDoor}" step="1" onchange="updateDoor(${idx})"></div>
    </div>
    <div class="door-calc" id="doorCalc_${idx}">${renderDoorCalcInner(d)}</div>
  </div>`;
}

function renderDoorCalcInner(d){
  let cft=getDoorCft(d);
  let woodCost=getDoorWoodCost(d);
  let doorAmt=parseFloat(d.doorAmount)||0;
  let labourPerDoor=parseFloat(d.labourPerDoor)||0;
  let netProfit=doorAmt-woodCost-labourPerDoor;
  return `
      <div class="calc-item">📐 ${(calcSqft(d.w,d.h)* (d.qty||1)).toFixed(1)} sq.ft</div>
      <div class="calc-item ft">🪵 ${cft.toFixed(2)} cft</div>
      <div class="calc-item">💰 ${fmtRs(woodCost)} wood</div>
      <div class="calc-item labour">👷 ${fmtRs(labourPerDoor)} labour</div>
      <div class="calc-item" style="${netProfit>=0?'background:#d1fae5;color:#065f46;':'background:#fee2e2;color:#dc2626;'}">💵 ${fmtRs(netProfit)} profit</div>
  `;
}

function addDoorFromSize(size){
  let parts=size.replace(' Jori','').split('x');
  let w=parseFloat(parts[0])||0,h=parseFloat(parts[1])||0;
  let isJori=size.includes('Jori');
  currentOrderDoors.push({size:size,w:h?w:0,h:h||0,qty:isJori?2:1,rate:440,woodId:1,thickness:defaultThickness,doorAmount:0,woodCft:0,labourPerDoor:0,cftMode:'auto'});
  renderOrderDoors();
  currentOrderDoors.forEach((d,i)=>recalcDoor(d));
  renderOrderDoors();
  updateOrderTotals();
}

function recalcDoor(d){
  let sqft=calcSqft(d.w,d.h)*(d.qty||1);
  d.doorAmount=sqft*(d.rate||0);
  d.woodCft=getDoorCft(d);
}

function addEmptyDoor(){
  currentOrderDoors.push({size:'',w:0,h:0,qty:1,rate:440,woodId:1,thickness:defaultThickness,doorAmount:0,woodCft:0,labourPerDoor:0,cftMode:'auto'});
  renderOrderDoors();
  updateOrderTotals();
}

function addSampleDoor(){
  currentOrderDoors.push({size:'45x75',w:45,h:75,qty:10,rate:440,woodId:1,thickness:defaultThickness,doorAmount:103125,woodCft:0,labourPerDoor:0,cftMode:'auto'});
  renderOrderDoors();
  updateOrderTotals();
}

function removeDoor(idx){
  currentOrderDoors.splice(idx,1);
  renderOrderDoors();
  updateOrderTotals();
}

function appendDesignToDoorSize(idx,designName){
  let input=document.getElementById(`doorSize_${idx}`);
  if(!input)return;
  let current=input.value.trim();
  // avoid appending the same design twice
  if(current.includes(designName))return;
  input.value=current?`${current} ${designName}`:designName;
  updateDoor(idx);
}

function updateDoor(idx){
  let d=currentOrderDoors[idx];
  if(!d)return;
  let size=document.getElementById(`doorSize_${idx}`)?.value||'';
  d.size=size;
  d.qty=parseFloat(document.getElementById(`doorQty_${idx}`)?.value)||1;
  d.rate=parseFloat(document.getElementById(`doorRate_${idx}`)?.value)||0;
  d.w=parseFloat(document.getElementById(`doorW_${idx}`)?.value)||0;
  d.h=parseFloat(document.getElementById(`doorH_${idx}`)?.value)||0;
  d.thickness=parseFloat(document.getElementById(`doorThick_${idx}`)?.value)||defaultThickness;
  d.woodId=parseInt(document.getElementById(`doorWood_${idx}`)?.value)||1;
  d.labourPerDoor=parseFloat(document.getElementById(`doorLabour_${idx}`)?.value)||0;
  let cft=getDoorCft(d);
  let sqft=calcSqft(d.w,d.h)*(d.qty||1);
  let doorAmt=sqft*d.rate;
  d.doorAmount=doorAmt;
  d.woodCft=cft;
  // Only refresh the read-only label + calc display — never touch the input
  // elements themselves, or the browser loses focus and the keyboard closes
  // mid-entry on mobile.
  let label=document.getElementById(`doorLabel_${idx}`);
  if(label)label.textContent=`🚪 Door #${idx+1} ${d.size||''}`;
  let calc=document.getElementById(`doorCalc_${idx}`);
  if(calc)calc.innerHTML=renderDoorCalcInner(d);
  updateOrderTotals();
}

function renderOrderDoors(){
  let container=document.getElementById('orderDoorsContainer');
  if(!container)return;
  container.innerHTML=currentOrderDoors.map((d,i)=>renderDoorRow(d,i)).join('');
}

// ════════════════════════════════════════════════════
// ──────── ORDER TEMPLATES (1-click reorder) ─────────
// ════════════════════════════════════════════════════
function openTemplateModal(){
  renderTemplateModalBody();
  openModal('templateModal');
}

function renderTemplateModalBody(){
  let body=document.getElementById('templateModalBody');
  let partyId=document.getElementById('orderPartyId')?.value;
  body.innerHTML=`
    <div style="font-size:11px;font-weight:700;margin-bottom:8px;">📁 Saved Templates</div>
    ${orderTemplates.length?orderTemplates.map((t,i)=>{
      let tp=t.partyId?getPartyById(t.partyId):null;
      return `<div class="karigar-row">
        <div class="karigar-row-head">
          <span style="font-weight:700;">${esc(t.name)}</span>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-primary btn-xs" onclick="loadTemplateIntoOrder(${i})">📥 Load</button>
            <button class="btn btn-danger btn-xs" onclick="deleteTemplate(${i})">🗑</button>
          </div>
        </div>
        <div style="font-size:8px;color:var(--gray-500);">${t.doors.length} door type(s)${tp?' · Usually for: '+esc(tp.name):''}</div>
      </div>`;
    }).join(''):'<div class="empty-state"><p>Koi template save nahi hua abhi tak</p></div>'}

    <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px;">
      <div style="font-size:11px;font-weight:700;margin-bottom:6px;">💾 Maujooda Doors ko Template Banayein</div>
      ${currentOrderDoors.length?`
        <p style="font-size:8px;color:var(--gray-500);margin-bottom:6px;">Is order mein abhi ${currentOrderDoors.length} door type(s) hain — inhe template ke taur pe save karein taake agli baar 1-click mein wapis load ho sakein.</p>
        <div style="display:flex;gap:4px;">
          <input class="form-input" id="templateName" placeholder="Template ka naam, jaise: Ahsan bhai ka usual order" style="flex:2;">
          <button class="btn btn-gold btn-sm" onclick="saveCurrentAsTemplate()">💾 Save</button>
        </div>
      `:'<p style="font-size:9px;color:var(--gray-500);">Pehle order mein kuch doors add karein, phir unhe template ke taur pe save kar sakenge.</p>'}
    </div>
    <div style="margin-top:12px;">
      <button class="btn btn-outline" onclick="closeModal('templateModal')">Close</button>
    </div>
  `;
}

function saveCurrentAsTemplate(){
  let name=document.getElementById('templateName')?.value.trim();
  if(!name){showToast('⚠️ Template ka naam likhein');return;}
  if(!currentOrderDoors.length){showToast('⚠️ Order mein koi door nahi');return;}
  let partyId=document.getElementById('orderPartyId')?.value;
  orderTemplates.push({
    id:newId(),
    name,
    partyId:partyId?parseInt(partyId):null,
    doors:currentOrderDoors.map(d=>({...d})),
    createdAt:new Date().toISOString()
  });
  saveAll();
  renderTemplateModalBody();
  showToast('✅ Template save ho gaya');
}

function loadTemplateIntoOrder(idx){
  let t=orderTemplates[idx];
  if(!t){showToast('⚠️ Template not found');return;}
  currentOrderDoors=t.doors.map(d=>({...d}));
  currentOrderDoors.forEach(d=>{
    d.doorAmount=calcSqft(d.w,d.h)*(d.qty||1)*(d.rate||0);
    d.woodCft=getDoorCft(d);
  });
  renderOrderDoors();
  updateOrderTotals();
  closeModal('templateModal');
  showToast(`✅ "${t.name}" template load ho gaya`);
}

function deleteTemplate(idx){
  customConfirm('Yeh template delete karein?',()=>{
    orderTemplates.splice(idx,1);
    saveAll();
    renderTemplateModalBody();
    showToast('🗑 Template deleted');
  });
}

function updateOrderTotals(){
  let totalDoors=document.getElementById('orderTotalDoors');
  let totalAmt=document.getElementById('orderTotalAmount');
  let totalWood=document.getElementById('orderTotalWood');
  let totalWoodCost=document.getElementById('orderTotalWoodCost');
  if(totalDoors)totalDoors.textContent=currentOrderDoors.length;
  let sumAmt=currentOrderDoors.reduce((s,d)=>s+(parseFloat(d.doorAmount)||0),0);
  let sumWood=currentOrderDoors.reduce((s,d)=>s+getDoorCft(d),0);
  let sumWoodCost=currentOrderDoors.reduce((s,d)=>s+getDoorWoodCost(d),0);
  if(totalAmt)totalAmt.textContent=fmtRs(sumAmt);
  if(totalWood)totalWood.textContent=sumWood.toFixed(2);
  if(totalWoodCost)totalWoodCost.textContent=fmtRs(sumWoodCost);
}

function toggleInlineNewParty(){
  let sel=document.getElementById('orderPartyId');
  let area=document.getElementById('inlineNewPartyArea');
  if(!sel||!area)return;
  area.style.display=sel.value==='__new__'?'block':'none';
}

function saveOrder(){
  let partyId=document.getElementById('orderPartyId')?.value;

  // Inline "+ Nayi Party" flow — create the party right here, no need to leave the Order screen
  if(partyId==='__new__'){
    let newName=document.getElementById('inlinePartyName')?.value.trim();
    if(!newName){showToast('⚠️ Party ka naam likhein');return;}
    let newParty={
      id:newId(),
      name:newName,
      phone:document.getElementById('inlinePartyPhone')?.value||'',
      area:'',
      address:document.getElementById('inlinePartyAddress')?.value||'',
      openingBalance:0,
      createdAt:new Date().toISOString()
    };
    parties.push(newParty);
    partyId=String(newParty.id);
    showToast(`✅ Party "${newName}" add ho gayi`);
  }

  if(!partyId||!parties.find(p=>p.id==parseInt(partyId))){showToast('⚠️ Party select karo');return;}
  if(!currentOrderDoors.length){showToast('⚠️ Kam se kam ek door add karo');return;}
  let date=document.getElementById('orderDate')?.value||new Date().toISOString().slice(0,10);
  let status=document.getElementById('orderStatus')?.value||'pending';
  let advance=parseFloat(document.getElementById('orderAdvance')?.value)||0;
  let note=document.getElementById('orderNote')?.value||'';
  let totalAmt=currentOrderDoors.reduce((s,d)=>s+(parseFloat(d.doorAmount)||0),0);
  let totalWood=currentOrderDoors.reduce((s,d)=>s+getDoorCft(d),0);
  let totalWoodCost=currentOrderDoors.reduce((s,d)=>s+getDoorWoodCost(d),0);
  let totalLabour=currentOrderDoors.reduce((s,d)=>s+(parseFloat(d.labourPerDoor)||0),0);
  let netProfit=totalAmt-totalWoodCost-totalLabour;

  let orderData={
    partyId:parseInt(partyId),
    date,status,advancePayment:advance,note,
    doors:currentOrderDoors.map(d=>({...d})),
    orderTotal:totalAmt,
    totalWoodCft:totalWood,
    totalWoodCost:totalWoodCost,
    totalLabour:totalLabour,
    netProfit:netProfit,
    designPhoto:currentOrderPhoto,
    updatedAt:new Date().toISOString()
  };

  let isNewOrder=!editingOrderId;
  let savedOrderId=null;

  if(editingOrderId){
    let idx=orders.findIndex(o=>o.id===editingOrderId);
    if(idx>-1){
      orderData.payments=orders[idx].payments||[];
      orders[idx]={...orders[idx],...orderData};
      savedOrderId=orders[idx].id;
      showToast('✅ Order updated');
    }
  }else{
    orderCounter++;
    let orderNo=businessProfile.invoicePrefix+orderCounter;
    orderData.id=newId();
    orderData.orderNo=orderNo;
    orderData.payments=[];
    orderData.createdAt=new Date().toISOString();
    orders.push(orderData);
    savedOrderId=orderData.id;
    showToast(`✅ Order ${orderNo} created!`);
  }
  saveAll();
  closeModal('orderModal');
  renderAll();

  // One click se aage badhein — turant Invoice/Challan bana sakein, kahin aur jaane ki zaroorat nahi
  if(isNewOrder&&savedOrderId){
    showOrderQuickActions(savedOrderId);
  }
}

function showOrderQuickActions(orderId){
  let o=orders.find(x=>x.id===orderId);
  if(!o)return;
  let titleEl=document.getElementById('paymentReceiptModalTitle');
  if(titleEl)titleEl.textContent='🎉 Order Complete';
  let body=document.getElementById('paymentReceiptModalBody');
  body.innerHTML=`
    <div style="text-align:center;margin-bottom:12px;">
      <div style="font-size:32px;">🎉</div>
      <div style="font-size:14px;font-weight:700;color:var(--green-700);">${esc(o.orderNo)} Ban Gaya!</div>
      <div style="font-size:9px;color:var(--gray-500);">${esc(getPartyName(o.partyId))} · ${fmtRs(o.orderTotal)}</div>
    </div>
    <div style="font-size:9px;font-weight:700;margin-bottom:8px;">Ab aage kya karna hai?</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <button class="btn btn-gold" style="justify-content:center;" onclick="closeModal('paymentReceiptModal');generateInvoice(${o.id})">🖨️ Invoice Banayein</button>
      <button class="btn btn-outline" style="justify-content:center;" onclick="closeModal('paymentReceiptModal');generateChallan(${o.id})">🚚 Delivery Challan Banayein</button>
      <button class="btn btn-success" style="justify-content:center;" onclick="closeModal('paymentReceiptModal');openPaymentModal(${o.id})">💵 Advance Payment Darj Karein</button>
      <button class="btn btn-outline" style="justify-content:center;" onclick="closeModal('paymentReceiptModal')">✅ Bas, Baad Mein Karunga</button>
    </div>
  `;
  openModal('paymentReceiptModal');
}

// ════════════════════════════════════════════════════
// ──────── VIEW ORDER DETAIL ─────────────────────────
// ════════════════════════════════════════════════════
function viewOrderDetail(id){
  let o=orders.find(x=>x.id===id);
  if(!o){showToast('⚠️ Order not found');return;}
  let content=document.getElementById('orderDetailContent');
  let party=getPartyName(o.partyId);
  let paid=getOrderTotalPaid(o);
  let balance=o.orderTotal-paid;
  let html=`
    <div style="font-weight:700;font-size:15px;">${o.orderNo} — ${party}</div>
    <div style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">${o.date} · ${o.status||'pending'} · ${o.doors?.length||0} doors</div>
    ${o.designPhoto?`<div style="margin-bottom:10px;"><img src="${o.designPhoto}" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;border:1px solid var(--border);cursor:pointer;" onclick="viewOrderPhotoFull('${o.designPhoto}')"></div>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-bottom:10px;">
      <div class="stat-card gold"><div class="num">${fmtRs(o.orderTotal)}</div><div class="lbl">Total</div></div>
      <div class="stat-card green"><div class="num">${fmtRs(paid)}</div><div class="lbl">Paid</div></div>
      <div class="stat-card red"><div class="num">${fmtRs(balance)}</div><div class="lbl">Balance</div></div>
      <div class="stat-card blue"><div class="num">${fmtRs(o.netProfit||0)}</div><div class="lbl">Net Profit</div></div>
    </div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:8px;">
        <thead><tr style="background:var(--primary);color:#fff;">
          <th style="padding:4px 6px;">#</th><th style="padding:4px 6px;">Size</th><th style="padding:4px 6px;">Qty</th>
          <th style="padding:4px 6px;">Sq.ft</th><th style="padding:4px 6px;">Rate</th>
          <th style="padding:4px 6px;">Door Amt</th><th style="padding:4px 6px;">Wood Cft</th>
          <th style="padding:4px 6px;">Wood Cost</th><th style="padding:4px 6px;">Labour</th>
          <th style="padding:4px 6px;background:var(--gold);">Profit</th>
        </tr></thead>
        <tbody>${(o.doors||[]).map((d,i)=>{
          let cft=getDoorCft(d);
          let woodCost=getDoorWoodCost(d);
          let labour=parseFloat(d.labourPerDoor)||0;
          let doorAmt=parseFloat(d.doorAmount)||0;
          let profit=doorAmt-woodCost-labour;
          return `<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:4px 6px;">${i+1}</td>
            <td style="padding:4px 6px;">${esc(d.size||'')}</td>
            <td style="padding:4px 6px;">${d.qty||1}</td>
            <td style="padding:4px 6px;">${(calcSqft(d.w,d.h)*(d.qty||1)).toFixed(1)}</td>
            <td style="padding:4px 6px;">${fmtRs(d.rate||0)}</td>
            <td style="padding:4px 6px;">${fmtRs(doorAmt)}</td>
            <td style="padding:4px 6px;">${cft.toFixed(2)}</td>
            <td style="padding:4px 6px;">${fmtRs(woodCost)}</td>
            <td style="padding:4px 6px;">${fmtRs(labour)}</td>
            <td style="padding:4px 6px;${profit>=0?'color:#065f46;':'color:#dc2626;'}">${fmtRs(profit)}</td>
          </tr>`;
        }).join('')}
        <tr style="font-weight:700;background:#f0fdf4;">
          <td colspan="2" style="padding:4px 6px;text-align:right;">TOTAL</td>
          <td style="padding:4px 6px;">${(o.doors||[]).reduce((s,d)=>s+(parseFloat(d.qty)||1),0)}</td>
          <td style="padding:4px 6px;">${(o.doors||[]).reduce((s,d)=>s+calcSqft(d.w,d.h)*(d.qty||1),0).toFixed(1)}</td>
          <td style="padding:4px 6px;">—</td>
          <td style="padding:4px 6px;">${fmtRs(o.orderTotal)}</td>
          <td style="padding:4px 6px;">${(o.totalWoodCft||0).toFixed(2)}</td>
          <td style="padding:4px 6px;">${fmtRs(o.totalWoodCost||0)}</td>
          <td style="padding:4px 6px;">${fmtRs(o.totalLabour||0)}</td>
          <td style="padding:4px 6px;background:var(--gold-light);">${fmtRs(o.netProfit||0)}</td>
        </tr>
        </tbody>
      </table>
    </div>
    ${(o.payments&&o.payments.length)?`
    <div style="margin-top:10px;">
      <div style="font-size:9px;font-weight:700;margin-bottom:4px;">💵 Payment History</div>
      <div class="payment-history-box">
        ${o.payments.map(p=>`<div class="payment-item"><span>${p.date} · ${p.method||'Cash'} ${p.note?'· '+esc(p.note):''}</span><span>${fmtRs(p.amount)}</span></div>`).join('')}
      </div>
    </div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:10px 14px;border-radius:10px;background:${balance>0?'#fee2e2':'#d1fae5'};">
      <span style="font-size:10px;font-weight:700;color:${balance>0?'#b91c1c':'#065f46'};">${balance>0?'💰 Itni Baqi Payment Hai':'✅ Poori Payment Mil Gayi'}</span>
      <strong style="font-size:16px;color:${balance>0?'#b91c1c':'#065f46'};">${fmtRs(balance)}</strong>
    </div>
    <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
      <button class="btn btn-gold" onclick="generateInvoice(${o.id})">🖨️ Invoice</button>
      <button class="btn btn-outline" onclick="generateChallan(${o.id})">🚚 Delivery Challan</button>
      <button class="btn btn-outline" onclick="downloadLabelsPDF(${o.id})">🏷️ Labels Print Karein</button>
      <button class="btn btn-success" onclick="openPaymentModal(${o.id})">💵 Add Payment</button>
      <button class="btn btn-outline" onclick="editOrder(${o.id})">✏️ Edit</button>
      <button class="btn btn-danger" onclick="deleteOrder(${o.id})">🗑 Delete</button>
    </div>
  `;
  document.getElementById('orderDetailContent').innerHTML=html;
  openModal('orderDetailModal');
}

function editOrder(id){closeModal('orderDetailModal');openOrderModal(id);}

function deleteOrder(id){
  customConfirm('Delete this order?',()=>{
    let o=orders.find(x=>x.id===id);
    if(o){deletedItems.push({type:'order',data:o,deletedAt:new Date().toISOString()});orders=orders.filter(x=>x.id!==id);saveAll();closeModal('orderDetailModal');renderAll();showToast('🗑 Deleted');}
  });
}

// ════════════════════════════════════════════════════
// ──────── RENDER ORDERS ─────────────────────────────
// ════════════════════════════════════════════════════
function renderOrders(){
  let list=document.getElementById('ordersList');
  let q=document.getElementById('orderSearch')?.value?.toLowerCase()||'';
  let filtered=orders.filter(o=>{
    let party=getPartyName(o.partyId).toLowerCase();
    return o.orderNo.toLowerCase().includes(q)||party.includes(q);
  });
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">📋</div><p>No orders found</p></div>';return;}
  list.innerHTML=filtered.slice().reverse().map(o=>{
    let paid=getOrderTotalPaid(o);
    let balance=o.orderTotal-paid;
    let statusClass=balance<=0?'paid':paid>0?'partial':'unpaid';
    return `<div class="order-card" onclick="viewOrderDetail(${o.id})">
      <div class="order-card-top">
        <div><div class="order-no">${o.orderNo}</div><div class="order-party">${getPartyName(o.partyId)}</div></div>
        <span class="badge badge-${statusClass}">${statusClass==='paid'?'Paid':statusClass==='partial'?'Partial':'Unpaid'}</span>
      </div>
      <div class="order-meta">📅 ${o.date} · 🚪 ${o.doors?.length||0} doors · 💰 ${fmtRs(o.orderTotal)}${o.designPhoto?' · 📷':''}</div>
      <div class="order-footer">
        <span>💵 ${fmtRs(paid)} paid · ${fmtRs(balance)} balance</span>
        <span class="profit-chip ${((o.netProfit||0)>=0)?'pos':'neg'}">💰 ${fmtRs(o.netProfit||0)} profit</span>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════
// ──────── DASHBOARD ──────────────────────────────────
// ════════════════════════════════════════════════════
// ─── QUICK ACTIONS (Home tab) ───
function quickCreateInvoice(){
  let recent=orders.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,12);
  if(!recent.length){showToast('⚠️ Pehle ek Order banayein');openOrderModal();return;}
  document.getElementById('quickPickModalTitle').textContent='📄 Invoice Banayein — Order Chunein';
  document.getElementById('quickPickModalBody').innerHTML=recent.map(o=>`
    <div class="report-row" style="cursor:pointer;" onclick="closeModal('quickPickModal');generateInvoice(${o.id})">
      <span><strong>${esc(o.orderNo)}</strong> ${esc(getPartyName(o.partyId))}</span>
      <span>${fmtRs(o.orderTotal)}</span>
    </div>`).join('');
  openModal('quickPickModal');
}

function quickAddPayment(){
  let due=parties.filter(p=>getPartyBalance(p)>0).sort((a,b)=>getPartyBalance(b)-getPartyBalance(a));
  if(!due.length){showToast('✅ Koi party ka balance baqi nahi');return;}
  document.getElementById('quickPickModalTitle').textContent='💳 Payment Le Lo — Party Chunein';
  document.getElementById('quickPickModalBody').innerHTML=due.map(p=>`
    <div class="report-row" style="cursor:pointer;" onclick="closeModal('quickPickModal');openReceivePaymentModal(${p.id})">
      <span><strong>${esc(p.name)}</strong></span>
      <span style="color:var(--red);font-weight:700;">${fmtRs(getPartyBalance(p))}</span>
    </div>`).join('');
  openModal('quickPickModal');
}

function getRecentActivities(limit){
  limit=limit||8;
  let items=[];
  orders.forEach(o=>{
    items.push({icon:'📋',bg:'#dbeafe',text:`Naya order <strong>${esc(o.orderNo)}</strong> — ${esc(getPartyName(o.partyId))}`,time:o.createdAt||o.date});
    (o.payments||[]).forEach(pay=>{
      items.push({icon:'💵',bg:'#d1fae5',text:`Payment mila <strong>${fmtRs(pay.amount)}</strong> — ${esc(getPartyName(o.partyId))}`,time:pay.date});
    });
    if(o.status==='delivered'){
      items.push({icon:'🏭',bg:'#ede9fe',text:`Order <strong>${esc(o.orderNo)}</strong> Delivered ho gaya`,time:o.updatedAt||o.date});
    }
  });
  parties.forEach(p=>{
    (p.partyPayments||[]).forEach(pp=>{
      items.push({icon:'💵',bg:'#d1fae5',text:`Payment mila <strong>${fmtRs(pp.amount)}</strong> — ${esc(p.name)}`,time:pp.date});
    });
  });
  items.sort((a,b)=>new Date(b.time)-new Date(a.time));
  return items.slice(0,limit);
}

function fmtActivityTime(t){
  try{
    let d=new Date(t);
    return d.toLocaleDateString('en-PK',{day:'numeric',month:'short'})+', '+d.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'});
  }catch(e){return t;}
}

function renderRecentActivities(){
  let el=document.getElementById('recentActivitiesArea');
  if(!el)return;
  let items=getRecentActivities(8);
  el.innerHTML=items.length?items.map(a=>`
    <div class="activity-item">
      <div class="activity-icon" style="background:${a.bg};">${a.icon}</div>
      <div style="flex:1;">
        <div class="activity-text">${a.text}</div>
        <div class="activity-time">${fmtActivityTime(a.time)}</div>
      </div>
    </div>
  `).join(''):'<div class="empty-state"><p>Abhi koi activity nahi</p></div>';
}

function renderDashboard(){
  let now=new Date();
  let hr=now.getHours();
  let greetWord=hr<12?'Good Morning':hr<17?'Good Afternoon':'Good Evening';
  let activeStaffName=activeUserId?staffUsers.find(u=>u.id===activeUserId)?.name:null;
  let displayName=activeStaffName||businessProfile.ownerName||businessProfile.name||'';
  document.getElementById('heroGreet').textContent=now.toLocaleDateString('en-PK',{weekday:'short',day:'numeric',month:'short'}).toUpperCase();
  document.getElementById('heroName').textContent=(displayName?`${greetWord}, ${displayName}`:greetWord)+' 👋';
  document.getElementById('heroDate').textContent='Aaj ka business ka haal yeh raha:';
  let totalOrders=orders.length,totalRevenue=orders.reduce((s,o)=>s+o.orderTotal,0);
  let totalPaid=orders.reduce((s,o)=>s+getOrderTotalPaid(o),0);
  let totalBalance=totalRevenue-totalPaid;
  let totalWood=orders.reduce((s,o)=>s+(o.totalWoodCft||0),0);
  let totalProfit=orders.reduce((s,o)=>s+(o.netProfit||0),0);
  document.getElementById('heroPulse').innerHTML=`📊 ${totalOrders} orders · ${fmtRs(totalRevenue)} revenue · 💰 ${fmtRs(totalProfit)} profit`;

  // This-month vs last-month trend (for the top stat cards)
  let thisMonthKey=now.toISOString().slice(0,7);
  let lastMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  let lastMonthKey=lastMonthDate.toISOString().slice(0,7);
  let thisMonthOrders=orders.filter(o=>o.date.startsWith(thisMonthKey));
  let lastMonthOrders=orders.filter(o=>o.date.startsWith(lastMonthKey));
  function trendBadge(curr,prev){
    if(!prev)return '';
    let pct=Math.round(((curr-prev)/Math.abs(prev))*100);
    if(pct===0)return '';
    let up=pct>0;
    return `<span class="trend-badge ${up?'trend-up':'trend-down'}">${up?'↑':'↓'} ${Math.abs(pct)}%</span>`;
  }
  let revTrend=trendBadge(thisMonthOrders.reduce((s,o)=>s+o.orderTotal,0),lastMonthOrders.reduce((s,o)=>s+o.orderTotal,0));
  let ordersTrend=trendBadge(thisMonthOrders.length,lastMonthOrders.length);
  let profitTrend=trendBadge(thisMonthOrders.reduce((s,o)=>s+(o.netProfit||0),0),lastMonthOrders.reduce((s,o)=>s+(o.netProfit||0),0));

  document.getElementById('statsArea').innerHTML=`
    <div class="stat-card gold"><div class="stat-icon" style="--sic1:#c8963e;--sic2:#e8c777;">💰</div><div class="num">${fmtRs(totalRevenue)}</div><div class="lbl">Revenue</div>${revTrend}</div>
    <div class="stat-card green"><div class="stat-icon" style="--sic1:#16a34a;--sic2:#4ade80;">✅</div><div class="num">${fmtRs(totalPaid)}</div><div class="lbl">Received</div></div>
    <div class="stat-card red"><div class="stat-icon" style="--sic1:#dc2626;--sic2:#f87171;">⏳</div><div class="num">${fmtRs(totalBalance)}</div><div class="lbl">Balance</div></div>
    <div class="stat-card blue"><div class="stat-icon" style="--sic1:#2563eb;--sic2:#60a5fa;">📋</div><div class="num">${totalOrders}</div><div class="lbl">Orders</div>${ordersTrend}</div>
    <div class="stat-card orange"><div class="stat-icon" style="--sic1:#d97706;--sic2:#fbbf24;">🪵</div><div class="num">${totalWood.toFixed(1)}</div><div class="lbl">Wood (cft)</div></div>
    <div class="stat-card teal"><div class="stat-icon" style="--sic1:#0d9488;--sic2:#5eead4;">💎</div><div class="num">${fmtRs(totalProfit)}</div><div class="lbl">Net Profit</div>${profitTrend}</div>
  `;

  let today=now.toISOString().slice(0,10);
  let todayOrders=orders.filter(o=>o.date===today);
  let todayRevenue=todayOrders.reduce((s,o)=>s+o.orderTotal,0);
  let todayProfit=todayOrders.reduce((s,o)=>s+(o.netProfit||0),0);
  document.getElementById('todaySummaryArea').innerHTML=`
    <div class="stat-card blue"><div class="num">${todayOrders.length}</div><div class="lbl">Today Orders</div></div>
    <div class="stat-card gold"><div class="num">${fmtRs(todayRevenue)}</div><div class="lbl">Today Revenue</div></div>
    <div class="stat-card green"><div class="num">${fmtRs(todayProfit)}</div><div class="lbl">Today Profit</div></div>
  `;

  renderRecentActivities();

  renderDashboardMenu();

  // Charts
  renderSalesOverviewChart();
  renderProductionDonut();
  renderTopDesigns();
  renderMiniStatsStrip();
  renderTopPartiesChart();
  renderKarigarCostChart();
  renderWoodUsageChart();

  // Low stock (inventory items + wood running low)
  let lowStock=inventory.filter(i=>i.qty<=i.minStock);
  let lowWood=woodTypes.filter(w=>getWoodStockRemaining(w)<=10); // 10cft threshold as a simple low-wood warning
  let lowStockHtml=lowStock.map(i=>`
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:9px;">
      <span>${esc(i.name)}</span><span style="color:var(--red);font-weight:700;">${i.qty} ${i.unit||'pcs'} left</span>
    </div>`).join('');
  let lowWoodHtml=lowWood.map(w=>{
    let remaining=getWoodStockRemaining(w);
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:9px;">
      <span>🪵 ${esc(w.name)}</span><span style="color:${remaining<0?'var(--red)':'#c2670e'};font-weight:700;">${remaining.toFixed(1)} cft left</span>
    </div>`;
  }).join('');
  document.getElementById('lowStockAlerts').innerHTML=(lowStockHtml+lowWoodHtml)||'<div class="empty-state"><p>✅ Stock theek hai</p></div>';

  // Karigar dues
  let karigarBalances={};
  labours.forEach(l=>{
    if(!karigarBalances[l.karigarId])karigarBalances[l.karigarId]=0;
    karigarBalances[l.karigarId]+=(l.totalCost-(l.paid||0));
  });
  let dueList=Object.entries(karigarBalances).filter(([k,v])=>v>0);
  document.getElementById('karigarDues').innerHTML=dueList.length?dueList.map(([k,v])=>`
    <div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:9px;">
      <span>${getKarigarName(parseInt(k))}</span><span style="color:var(--red);font-weight:700;">${fmtRs(v)}</span>
    </div>`).join(''):'<div class="empty-state"><p>✅ Koi karigar due nahi</p></div>';

  let recent=orders.slice(-5).reverse();
  document.getElementById('recentOrders').innerHTML=recent.length?recent.map(o=>`
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:9px;cursor:pointer;" onclick="viewOrderDetail(${o.id})">
      <span><strong>${o.orderNo}</strong> ${getPartyName(o.partyId)}</span>
      <span>${fmtRs(o.orderTotal)} · ${fmtRs(o.netProfit||0)} profit</span>
    </div>
  `).join(''):'<div class="empty-state"><p>No orders yet</p></div>';
}

function renderSalesOverviewChart(){
  let el=document.getElementById('salesOverviewChart');
  if(!el)return;
  let now=new Date();
  let year=now.getFullYear(),month=now.getMonth(),daysElapsed=now.getDate();
  let dayTotals={};
  orders.forEach(o=>{
    let d=new Date(o.date+'T00:00:00');
    if(d.getFullYear()===year&&d.getMonth()===month)dayTotals[d.getDate()]=(dayTotals[d.getDate()]||0)+o.orderTotal;
  });
  let days=[];for(let i=1;i<=daysElapsed;i++)days.push(i);
  let values=days.map(d=>dayTotals[d]||0);
  if(!values.some(v=>v>0)){el.innerHTML='<div class="empty-state" style="padding:20px 0;"><p>Is mahine abhi tak koi order nahi</p></div>';return;}
  let max=Math.max(...values,1);
  let W=600,H=170,padL=4,padR=4,padT=14,padB=6;
  let plotW=W-padL-padR,plotH=H-padT-padB;
  let stepX=days.length>1?plotW/(days.length-1):0;
  let pts=values.map((v,i)=>({x:padL+i*stepX,y:padT+plotH-(v/max*plotH)}));
  let linePath=pts.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  let areaPath=linePath+` L${pts[pts.length-1].x.toFixed(1)},${(padT+plotH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT+plotH).toFixed(1)} Z`;
  let peakIdx=values.indexOf(max),peak=pts[peakIdx];
  let mon=now.toLocaleDateString('en',{month:'short'});
  el.innerHTML=`
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:140px;overflow:visible;display:block;">
      <defs><linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--gold)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="var(--gold)" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${areaPath}" fill="url(#salesGrad)" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${peak.x.toFixed(1)}" cy="${peak.y.toFixed(1)}" r="4" fill="var(--gold)" stroke="var(--card)" stroke-width="2"/>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:7px;color:var(--gray-500);margin-top:4px;">
      <span>1 ${mon}</span>
      <span style="font-weight:700;color:var(--gold);">Peak: ${days[peakIdx]} ${mon} · ${fmtRs(max)}</span>
      <span>${days[days.length-1]} ${mon}</span>
    </div>`;
}
function renderProductionDonut(){
  let el=document.getElementById('productionDonut');
  if(!el)return;
  let total=orders.length;
  let completed=orders.filter(o=>['ready','delivered'].includes(o.status||'pending')).length;
  let inProgress=orders.filter(o=>['cutting','assembly','polishing'].includes(o.status||'pending')).length;
  let pending=orders.filter(o=>(o.status||'pending')==='pending').length;
  let pct=total?Math.round(completed/total*100):0;
  let R=54,C=2*Math.PI*R,dash=C*pct/100;
  el.innerHTML=`
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">
      <div style="position:relative;width:130px;height:130px;flex-shrink:0;margin:0 auto;">
        <svg viewBox="0 0 130 130" style="width:130px;height:130px;transform:rotate(-90deg);">
          <circle cx="65" cy="65" r="${R}" fill="none" stroke="var(--border)" stroke-width="12"/>
          <circle cx="65" cy="65" r="${R}" fill="none" stroke="var(--green-700)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${C.toFixed(1)}"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <div style="font-size:22px;font-weight:800;color:var(--green-700);">${pct}%</div>
          <div style="font-size:7px;color:var(--gray-500);text-transform:uppercase;font-weight:700;">Completed</div>
        </div>
      </div>
      <div style="flex:1;min-width:130px;display:flex;flex-direction:column;gap:7px;">
        <div style="display:flex;justify-content:space-between;font-size:9px;"><span>🔵 Total Orders</span><strong>${total}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;"><span>🟠 In Progress</span><strong>${inProgress}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;"><span>🟢 Completed</span><strong>${completed}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:9px;"><span>🔴 Pending</span><strong>${pending}</strong></div>
      </div>
    </div>`;
}
function getTopDoorDesigns(limit){
  let totals={},grandTotal=0;
  orders.forEach(o=>(o.doors||[]).forEach(d=>{
    let amt=parseFloat(d.doorAmount)||0;
    if(!amt)return;
    let matched=doorDesigns.find(dz=>d.size&&d.size.includes(dz));
    let key=matched||'Custom / Other';
    if(!totals[key])totals[key]={revenue:0,qty:0};
    totals[key].revenue+=amt;totals[key].qty+=parseFloat(d.qty)||0;grandTotal+=amt;
  }));
  return{entries:Object.entries(totals).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,limit),grandTotal};
}
function renderTopDesigns(){
  let el=document.getElementById('topDesignsArea');
  if(!el)return;
  let{entries,grandTotal}=getTopDoorDesigns(5);
  if(!entries.length){el.innerHTML='<div class="empty-state"><p>Abhi koi door data nahi</p></div>';return;}
  let max=Math.max(...entries.map(e=>e[1].revenue),1);
  el.innerHTML=entries.map(([name,v])=>{
    let pct=grandTotal?Math.round(v.revenue/grandTotal*100):0;
    let barPct=Math.max(4,v.revenue/max*100);
    return `<div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:3px;"><span style="font-weight:700;">🚪 ${esc(name)}</span><span style="font-weight:700;">${fmtRs(v.revenue)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:7px;color:var(--gray-500);margin-bottom:3px;"><span>${v.qty} doors</span><span>${pct}%</span></div>
      <div style="height:6px;background:var(--gray-100);border-radius:4px;overflow:hidden;"><div style="height:100%;width:${barPct}%;background:linear-gradient(90deg,var(--gold),var(--accent-light));border-radius:4px;"></div></div>
    </div>`;
  }).join('');
}
function renderMiniStatsStrip(){
  let el=document.getElementById('miniStatsStrip');
  if(!el)return;
  el.innerHTML=`
    <div class="mini-stat-item"><div class="mini-stat-num">${parties.length}</div><div class="mini-stat-lbl">👥 Parties</div></div>
    <div class="mini-stat-item"><div class="mini-stat-num">${karigars.length}</div><div class="mini-stat-lbl">🔨 Karigar</div></div>
    <div class="mini-stat-item"><div class="mini-stat-num">${doorDesigns.length}</div><div class="mini-stat-lbl">🚪 Designs</div></div>
    <div class="mini-stat-item"><div class="mini-stat-num">${woodTypes.length}</div><div class="mini-stat-lbl">🪵 Wood Types</div></div>
  `;
}
function renderRevenueChart(){
  let el=document.getElementById('revenueChart');
  if(!el)return;
  let months={};
  orders.forEach(o=>{let m=o.date.slice(0,7);months[m]=(months[m]||0)+o.orderTotal;});
  let entries=Object.entries(months).sort().slice(-6);
  if(!entries.length){el.innerHTML='<div style="font-size:8px;color:var(--gray-500);">No data</div>';return;}
  let max=Math.max(...entries.map(e=>e[1]),1);
  el.innerHTML=entries.map(([m,v])=>`
    <div class="chart-bar"><span class="label">${m.slice(5)}</span><div class="bar" style="width:${Math.max(4,(v/max*100))}%;"></div><span class="val">${fmtRs(v)}</span></div>
  `).join('');
}
function renderStatusChart(){
  let el=document.getElementById('statusChart');
  if(!el)return;
  let statuses=['pending','cutting','assembly','polishing','ready','delivered'];
  let counts=statuses.map(s=>orders.filter(o=>(o.status||'pending')===s).length);
  let max=Math.max(...counts,1);
  el.innerHTML=statuses.map((s,i)=>`
    <div class="chart-bar"><span class="label">${s.slice(0,4)}</span><div class="bar" style="width:${Math.max(4,(counts[i]/max*100))}%;"></div><span class="val">${counts[i]}</span></div>
  `).join('');
}
function renderTopPartiesChart(){
  let el=document.getElementById('topPartiesChart');
  if(!el)return;
  let totals={};
  orders.forEach(o=>{totals[o.partyId]=(totals[o.partyId]||0)+o.orderTotal;});
  let entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!entries.length){el.innerHTML='<div style="font-size:8px;color:var(--gray-500);">No data</div>';return;}
  let max=Math.max(...entries.map(e=>e[1]),1);
  el.innerHTML=entries.map(([pid,v])=>`
    <div class="chart-bar"><span class="label">${getPartyName(parseInt(pid)).slice(0,8)}</span><div class="bar" style="width:${Math.max(4,(v/max*100))}%;"></div><span class="val">${fmtRs(v)}</span></div>
  `).join('');
}
function renderKarigarCostChart(){
  let el=document.getElementById('karigarCostChart');
  if(!el)return;
  let totals={};
  labours.forEach(l=>{totals[l.karigarId]=(totals[l.karigarId]||0)+l.totalCost;});
  let entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!entries.length){el.innerHTML='<div style="font-size:8px;color:var(--gray-500);">No data</div>';return;}
  let max=Math.max(...entries.map(e=>e[1]),1);
  el.innerHTML=entries.map(([kid,v])=>`
    <div class="chart-bar"><span class="label">${getKarigarName(parseInt(kid)).slice(0,8)}</span><div class="bar" style="width:${Math.max(4,(v/max*100))}%;"></div><span class="val">${fmtRs(v)}</span></div>
  `).join('');
}
function renderWoodUsageChart(){
  let el=document.getElementById('woodUsageChart');
  if(!el)return;
  let totals={};
  orders.forEach(o=>(o.doors||[]).forEach(d=>{
    let name=woodTypes.find(w=>w.id==d.woodId)?.name||'Other';
    totals[name]=(totals[name]||0)+getDoorCft(d);
  }));
  let entries=Object.entries(totals).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){el.innerHTML='<div style="font-size:8px;color:var(--gray-500);">No data</div>';return;}
  let max=Math.max(...entries.map(e=>e[1]),1);
  el.innerHTML=entries.map(([n,v])=>`
    <div class="chart-bar"><span class="label">${n.slice(0,8)}</span><div class="bar" style="width:${Math.max(4,(v/max*100))}%;"></div><span class="val">${v.toFixed(1)}</span></div>
  `).join('');
}

// ════════════════════════════════════════════════════
// ──────── PAYMENT MODAL ─────────────────────────────
// ════════════════════════════════════════════════════
function openPaymentModal(orderId){
  payingOrderId=orderId;
  let o=orders.find(x=>x.id===orderId);
  if(!o){showToast('⚠️ Order not found');return;}
  let paid=getOrderTotalPaid(o);
  let balance=o.orderTotal-paid;
  let body=document.getElementById('paymentModalBody');
  body.innerHTML=`
    <div style="font-weight:700;font-size:14px;">${o.orderNo} — ${getPartyName(o.partyId)}</div>
    <div style="font-size:9px;color:var(--gray-500);margin-top:2px;">Order Total: ${fmtRs(o.orderTotal)} · Ab Tak Mili: ${fmtRs(paid)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 10px;padding:10px 14px;border-radius:10px;background:${balance>0?'#fee2e2':'#d1fae5'};">
      <span style="font-size:10px;font-weight:700;color:${balance>0?'#b91c1c':'#065f46'};">💰 Is Order Ki Kitni Baqi Hai</span>
      <strong style="font-size:16px;color:${balance>0?'#b91c1c':'#065f46'};">${fmtRs(balance)}</strong>
    </div>
    <div class="form-group"><label class="form-label">Amount (payment jitni mil rahi hai)</label><input class="form-input" type="number" id="payAmount" value="${Math.max(0,Math.min(balance,o.orderTotal))}" step="1"></div>
    <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="payDate" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="form-group"><label class="form-label">Kis Account Mein Aaya</label><select class="form-select" id="payMethod">${BANK_ACCOUNTS.map(a=>`<option value="${a}">${a}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="payNote" placeholder="Optional"></div>
    ${(o.payments&&o.payments.length)?`<div style="margin:8px 0;"><div style="font-size:8px;font-weight:700;margin-bottom:4px;">Payment History</div><div class="payment-history-box">${o.payments.map(p=>`<div class="payment-item"><span>${p.date} · ${p.method||'Cash'}</span><span>${fmtRs(p.amount)} <button class="payment-del-btn" onclick="deletePayment(${o.id},${p.id})">✕</button></span></div>`).join('')}</div></div>`:''}
    <div style="display:flex;gap:6px;">
      <button class="btn btn-success" onclick="addPayment()">💵 Pay</button>
      <button class="btn btn-outline" onclick="closeModal('paymentModal')">Cancel</button>
    </div>
  `;
  document.getElementById('paymentModalHead').innerHTML='💵 Add Payment <button class="modal-close" onclick="closeModal(\'paymentModal\')">✕</button>';
  openModal('paymentModal');
}

function addPayment(){
  let o=orders.find(x=>x.id===payingOrderId);
  if(!o){showToast('⚠️ Order not found');return;}
  let amount=parseFloat(document.getElementById('payAmount')?.value)||0;
  if(amount<=0){showToast('⚠️ Amount positive hona chahiye');return;}
  let date=document.getElementById('payDate')?.value||new Date().toISOString().slice(0,10);
  let method=document.getElementById('payMethod')?.value||'Cash';
  let note=document.getElementById('payNote')?.value||'';
  if(!o.payments)o.payments=[];
  let paymentId=Date.now();
  // Auto-record this in the Bank/Cash Book so "kis account mein aaya" is always tracked
  let bankTxId=newId();
  bankTransactions.push({id:bankTxId,type:'deposit',account:method,amount,date,description:`Payment from ${getPartyName(o.partyId)} (${o.orderNo})`,createdAt:new Date().toISOString()});
  o.payments.push({id:paymentId,amount,date,method,note,user:activeUserId,bankTxId});
  saveAll();
  closeModal('paymentModal');
  renderAll();
  showToast('✅ Payment added — Bank Book mein bhi record ho gaya');
}

function deletePayment(orderId,paymentId){
  let o=orders.find(x=>x.id===orderId);
  if(!o||!o.payments)return;
  customConfirm('Delete this payment?',()=>{
    let pay=o.payments.find(p=>p.id===paymentId);
    if(pay&&pay.bankTxId){bankTransactions=bankTransactions.filter(t=>t.id!==pay.bankTxId);}
    o.payments=o.payments.filter(p=>p.id!==paymentId);
    saveAll();
    openPaymentModal(orderId);
    renderAll();
    showToast('🗑 Payment removed');
  });
}

// ════════════════════════════════════════════════════
// ──────── INVOICE GENERATION (IMPROVED PDF) ─────────
// ════════════════════════════════════════════════════
function buildInvoiceHTML(o, party, elId){
  let paid=getOrderTotalPaid(o);
  let balance=o.orderTotal-paid;

  let rows=(o.doors||[]).map((d,i)=>{
    let sqft = calcSqft(d.w,d.h) * (d.qty||1);
    let amount = parseFloat(d.doorAmount)||0;
    let rowBg = i%2===0 ? '#ffffff' : '#f6f8fc';
    return `<tr style="background:${rowBg};">
      <td style="padding:7px 4px;text-align:center;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#9ca7b8;font-weight:700;font-size:8px;">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:7px 4px;border-bottom:1px solid #e8ecf3;white-space:nowrap;font-weight:600;">${esc(d.size||'')}</td>
      <td style="padding:7px 4px;text-align:center;border-bottom:1px solid #e8ecf3;white-space:nowrap;">${d.qty||1}</td>
      <td style="padding:7px 4px;text-align:center;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#6b7684;">${sqft.toFixed(1)}</td>
      <td style="padding:7px 4px;text-align:right;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#6b7684;">${fmtRs(d.rate||0)}</td>
      <td style="padding:7px 4px;text-align:right;font-weight:700;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#0f5132;">${fmtRs(amount)}</td>
    </tr>`;
  }).join('');

  const statusColors={pending:'#c8963e',cutting:'#2563eb',assembly:'#7c3aed',polishing:'#db2777',ready:'#0d9488',delivered:'#16a34a'};
  let statusColor=statusColors[o.status]||'#c8963e';
  let qrId=elId+'_qr';

  return `
    <div id="${elId}" style="font-family:'Segoe UI',sans-serif;width:800px;box-sizing:border-box;margin:auto;background:#fff;color:#1a2a3a;">

      <div style="background:linear-gradient(120deg,#0f2a5a,#1a3a6a 55%,#2a5a8a);padding:26px 30px 22px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(200,150,62,.28),transparent 70%);"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1;">
          <div>
            <h1 style="font-size:25px;margin:0;color:#fff;letter-spacing:0.5px;font-weight:800;">${esc(businessProfile.name)}</h1>
            <p style="font-size:10px;color:#cfe0f5;margin:4px 0 0;">${esc(businessProfile.tagline || '')}</p>
            <p style="font-size:8.5px;color:#a9c0e0;margin-top:8px;">${esc(businessProfile.address || '')}${businessProfile.city?', '+esc(businessProfile.city):''}</p>
            <p style="font-size:8.5px;color:#a9c0e0;">${businessProfile.phone?'📞 '+esc(businessProfile.phone):''} ${businessProfile.whatsapp?' · WhatsApp: '+esc(businessProfile.whatsapp):''}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:20px;font-weight:800;color:#e8c777;letter-spacing:3px;">INVOICE</div>
            <p style="font-size:11px;margin-top:8px;color:#fff;"><strong>${esc(o.orderNo)}</strong></p>
            <p style="font-size:9px;color:#cfe0f5;">${o.date}</p>
            <div style="display:inline-block;background:${statusColor};color:#fff;padding:3px 12px;border-radius:12px;font-size:8px;font-weight:700;letter-spacing:0.5px;margin-top:5px;">${(o.status||'pending').toUpperCase()}</div>
          </div>
        </div>
      </div>

      <div style="padding:22px 30px 26px;">

        <div style="display:flex;gap:12px;margin-bottom:${o.designPhoto?'12px':'16px'};align-items:stretch;">
          <div style="flex:1;background:#f7f9fc;border-radius:10px;padding:12px 16px;border:1px solid #e8ecf3;">
            <p style="font-size:8px;color:#9ca7b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;font-weight:700;">Bill To</p>
            <p style="font-size:14px;font-weight:700;color:#1a3a6a;">${esc(party?.name || 'Unknown')}</p>
            <p style="font-size:9px;color:#6b7684;margin-top:2px;">${esc(party?.phone || '')} ${party?.address?'· '+esc(party.address):''}</p>
          </div>
          <div id="${qrId}" style="flex-shrink:0;width:78px;height:78px;background:#fff;border:1px solid #e8ecf3;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;"></div>
        </div>

        ${o.designPhoto?`
        <div style="margin-bottom:16px;">
          <p style="font-size:8px;color:#9ca7b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;font-weight:700;">Design Reference</p>
          <img src="${o.designPhoto}" style="width:100%;max-height:320px;object-fit:contain;border-radius:10px;border:1px solid #e8ecf3;background:#f7f9fc;display:block;">
        </div>`:''}

        <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px;margin-bottom:16px;">
          <colgroup>
            <col style="width:6%;"><col style="width:26%;"><col style="width:10%;">
            <col style="width:14%;"><col style="width:19%;"><col style="width:25%;">
          </colgroup>
          <thead><tr style="background:#1a3a6a;">
            <th style="padding:8px 4px;text-align:center;white-space:nowrap;color:#a9c0e0;font-weight:600;font-size:7.5px;text-transform:uppercase;letter-spacing:.4px;border-radius:6px 0 0 0;">#</th>
            <th style="padding:8px 4px;text-align:left;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Size</th>
            <th style="padding:8px 4px;text-align:center;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Qty</th>
            <th style="padding:8px 4px;text-align:center;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Sq.ft</th>
            <th style="padding:8px 4px;text-align:right;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Rate</th>
            <th style="padding:8px 4px;text-align:right;white-space:nowrap;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;border-radius:0 6px 0 0;">Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td colspan="2" style="padding:10px 4px;text-align:right;font-size:9px;font-weight:700;color:#1a3a6a;border-top:2px solid #1a3a6a;white-space:nowrap;">GRAND TOTAL</td>
            <td style="padding:10px 4px;text-align:center;font-size:10px;font-weight:800;color:#1a3a6a;border-top:2px solid #1a3a6a;white-space:nowrap;">${(o.doors||[]).reduce((s,d)=>s+(parseFloat(d.qty)||1),0)}</td>
            <td style="padding:10px 4px;text-align:center;font-size:10px;font-weight:800;color:#1a3a6a;border-top:2px solid #1a3a6a;white-space:nowrap;">${(o.doors||[]).reduce((s,d)=>s+calcSqft(d.w,d.h)*(d.qty||1),0).toFixed(1)}</td>
            <td style="padding:10px 4px;text-align:right;font-size:10px;font-weight:700;color:#1a3a6a;border-top:2px solid #1a3a6a;white-space:nowrap;">—</td>
            <td style="padding:10px 4px;text-align:right;font-size:13px;font-weight:800;color:#1a3a6a;border-top:2px solid #1a3a6a;white-space:nowrap;">${fmtRs(o.orderTotal)}</td>
          </tr></tfoot>
        </table>

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;">
          <p style="font-size:8.5px;color:#9ca7b8;font-style:italic;flex:1;margin-top:6px;">${amountInWords(o.orderTotal)}</p>
          <div style="width:230px;background:#f7f9fc;border-radius:10px;padding:12px 16px;border:1px solid #e8ecf3;flex-shrink:0;">
            <div style="display:flex;justify-content:space-between;font-size:9.5px;padding:3px 0;color:#6b7684;"><span>Subtotal</span><strong style="color:#1a2a3a;">${fmtRs(o.orderTotal)}</strong></div>
            <div style="display:flex;justify-content:space-between;font-size:9.5px;padding:3px 0;color:#0f5132;"><span>Paid</span><strong>${fmtRs(paid)}</strong></div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:9px 10px;border-radius:7px;margin-top:6px;background:${balance>0?'#fee2e2':'#d1fae5'};color:${balance>0?'#b91c1c':'#065f46'};"><span style="font-weight:600;">Balance Due</span><strong>${fmtRs(balance)}</strong></div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:26px;">
          <div style="border-top:1.5px solid #1a3a6a;padding-top:6px;font-size:9px;color:#6b7684;">Received By</div>
          <div style="border-top:1.5px solid #1a3a6a;padding-top:6px;font-size:9px;color:#6b7684;text-align:right;">Authorized Signature — ${esc(businessProfile.name)}</div>
        </div>

        <div style="font-size:8px;color:#9ca7b8;margin-top:18px;text-align:center;border-top:1px solid #e8ecf3;padding-top:12px;">
          <strong style="color:#c8963e;">${esc(businessProfile.footerNote || 'Thank You for Your Business 🙏')}</strong>
          ${businessProfile.bankName?`<br>Bank: ${esc(businessProfile.bankName)} · A/C: ${esc(businessProfile.bankAccount||'')}`:''}
          <br><span style="color:#c3cbd6;">Scan the QR code above to verify this invoice</span>
        </div>
      </div>
    </div>
  `;
}

function renderInvoiceQR(elId, o){
  try{
    if(typeof QRCode==='undefined')return;
    let el=document.getElementById(elId+'_qr');
    if(!el)return;
    el.innerHTML='';
    let text=`${businessProfile.name} | Invoice ${o.orderNo} | ${o.date} | Total: ${fmtRs(o.orderTotal)}`;
    new QRCode(el,{text,width:70,height:70,colorDark:'#1a3a6a',colorLight:'#ffffff'});
  }catch(e){ /* QR is a nice-to-have, never block invoice generation */ }
}

function generateInvoice(orderId){
  let o=orders.find(x=>x.id===orderId);
  if(!o){showToast('⚠️ Order not found');return;}
  let party=getPartyById(o.partyId);
  let content=document.getElementById('billContent');

  // On-screen preview (scales to whatever the modal width is — just a preview)
  content.innerHTML=buildInvoiceHTML(o, party, 'invoiceContent');
  openModal('billModal');
  renderInvoiceQR('invoiceContent', o);
  showToast('🖨️ Invoice ready — PDF download ho raha hai');

  // Actual PDF capture: always rendered at a fixed 800px width (masked behind the
  // loading overlay) so mobile's narrow screen never squeezes/wraps the columns.
  let temp=document.createElement('div');
  temp.innerHTML=buildInvoiceHTML(o, party, 'invoiceContentPdf');
  temp.style.position='fixed';
  temp.style.left='0';
  temp.style.top='0';
  temp.style.width='800px';
  temp.style.background='#fff';
  temp.style.zIndex='150';
  temp.style.pointerEvents='none';
  document.body.appendChild(temp);
  renderInvoiceQR('invoiceContentPdf', o);
  downloadPDF('invoiceContentPdf', `Invoice_${o.orderNo}.pdf`).finally(()=>temp.remove());
}

// ════════════════════════════════════════════════════
// ──────── DELIVERY CHALLAN (no pricing — proof of delivery) ─
// ════════════════════════════════════════════════════
function buildChallanHTML(o, party, challanNo, elId){
  let doorLines=getOrderDoorBreakdown(o);
  let totalDoors=(o.doors||[]).reduce((s,d)=>s+(parseFloat(d.qty)||1),0);
  let rows=doorLines.map((line,i)=>{
    let parts=line.split(' × ');
    let rowBg = i%2===0 ? '#ffffff' : '#f6f8fc';
    return `<tr style="background:${rowBg};">
      <td style="padding:8px;text-align:center;border-bottom:1px solid #e8ecf3;white-space:nowrap;color:#9ca7b8;font-weight:700;font-size:8px;">${String(i+1).padStart(2,'0')}</td>
      <td style="padding:8px;border-bottom:1px solid #e8ecf3;white-space:nowrap;font-weight:700;color:#1a3a6a;">${esc(parts[0]||line)}</td>
      <td style="padding:8px;text-align:center;border-bottom:1px solid #e8ecf3;white-space:nowrap;"><span style="background:#fef3c7;color:#92400e;padding:3px 12px;border-radius:12px;font-weight:800;font-size:10px;">${esc(parts[1]||'')}</span></td>
      <td style="padding:8px;border-bottom:1px solid #e8ecf3;"></td>
    </tr>`;
  }).join('');
  return `
    <div id="${elId}" style="font-family:'Segoe UI',sans-serif;width:800px;box-sizing:border-box;margin:auto;background:#fff;color:#1a2a3a;">
      <div style="background:linear-gradient(120deg,#7a4a12,#c8963e 60%,#e0ac4f);padding:26px 30px 22px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;right:-30px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.25),transparent 70%);"></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1;">
          <div>
            <h1 style="font-size:24px;margin:0;color:#fff;letter-spacing:0.5px;font-weight:800;">${esc(businessProfile.name)}</h1>
            <p style="font-size:10px;color:#fdf0d8;margin:4px 0 0;">${esc(businessProfile.tagline || '')}</p>
            <p style="font-size:8.5px;color:#fdf0d8;margin-top:8px;">${esc(businessProfile.address || '')}${businessProfile.city?', '+esc(businessProfile.city):''}</p>
            <p style="font-size:8.5px;color:#fdf0d8;">${businessProfile.phone?'📞 '+esc(businessProfile.phone):''}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:16px;font-weight:800;color:#fff;letter-spacing:2px;">DELIVERY CHALLAN</div>
            <p style="font-size:11px;margin-top:8px;color:#fff;"><strong>${esc(challanNo)}</strong></p>
            <p style="font-size:9px;color:#fdf0d8;">Order Ref: ${esc(o.orderNo)}</p>
            <p style="font-size:9px;color:#fdf0d8;">${new Date().toISOString().slice(0,10)}</p>
          </div>
        </div>
      </div>

      <div style="padding:22px 30px 26px;">

        <div style="background:#f7f9fc;border-radius:10px;padding:12px 16px;margin-bottom:16px;border:1px solid #e8ecf3;">
          <p style="font-size:8px;color:#9ca7b8;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px;font-weight:700;">Delivered To</p>
          <p style="font-size:14px;font-weight:700;color:#1a3a6a;">${esc(party?.name || 'Unknown')}</p>
          <p style="font-size:9px;color:#6b7684;margin-top:2px;">${esc(party?.phone || '')} ${getFullAddress(party)?'· 📍 '+esc(getFullAddress(party)):''}</p>
        </div>

        <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:10px;margin-bottom:16px;">
          <colgroup><col style="width:8%;"><col style="width:32%;"><col style="width:20%;"><col style="width:40%;"></colgroup>
          <thead><tr style="background:#1a3a6a;">
            <th style="padding:9px 8px;text-align:center;color:#a9c0e0;font-weight:600;font-size:7.5px;text-transform:uppercase;letter-spacing:.4px;border-radius:6px 0 0 0;">#</th>
            <th style="padding:9px 8px;text-align:left;color:#fff;font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;">Door Size</th>
            <th style="padding:9px 8px;text-align:center;color:#fff;font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;">Qty</th>
            <th style="padding:9px 8px;text-align:left;color:#fff;font-weight:700;font-size:8.5px;text-transform:uppercase;letter-spacing:.4px;border-radius:0 6px 0 0;">Remarks</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td colspan="2" style="padding:10px 8px;text-align:right;font-size:10px;font-weight:700;color:#1a3a6a;border-top:2px solid #1a3a6a;white-space:nowrap;">TOTAL DOORS</td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;font-weight:800;color:#1a3a6a;border-top:2px solid #1a3a6a;">${totalDoors}</td>
            <td style="border-top:2px solid #1a3a6a;"></td>
          </tr></tfoot>
        </table>

        <p style="font-size:8.5px;color:#9ca7b8;margin-bottom:20px;">Note: Yeh delivery ki proof hai — bill/qeemat is challan par shamil nahi. Invoice alag se jari ki jayegi.</p>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:26px;">
          <div style="border-top:1.5px solid #1a3a6a;padding-top:6px;font-size:9px;color:#6b7684;">Delivered By</div>
          <div style="border-top:1.5px solid #1a3a6a;padding-top:6px;font-size:9px;color:#6b7684;text-align:right;">Received By (Signature)</div>
        </div>

        <div style="font-size:8px;color:#9ca7b8;margin-top:18px;text-align:center;border-top:1px solid #e8ecf3;padding-top:12px;">
          <strong style="color:#c8963e;">${esc(businessProfile.footerNote || 'Thank You for Your Business 🙏')}</strong>
        </div>
      </div>
    </div>
  `;
}

function generateChallan(orderId){
  let o=orders.find(x=>x.id===orderId);
  if(!o){showToast('⚠️ Order not found');return;}
  let party=getPartyById(o.partyId);
  challanCounter++;
  let challanNo='DC-'+challanCounter;
  saveAll();

  let content=document.getElementById('billContent');
  content.innerHTML=buildChallanHTML(o, party, challanNo, 'challanContent');
  openModal('billModal');
  showToast('🚚 Delivery Challan ready — PDF download ho raha hai');

  let temp=document.createElement('div');
  temp.innerHTML=buildChallanHTML(o, party, challanNo, 'challanContentPdf');
  temp.style.position='fixed';
  temp.style.left='0';
  temp.style.top='0';
  temp.style.width='800px';
  temp.style.background='#fff';
  temp.style.zIndex='150';
  temp.style.pointerEvents='none';
  document.body.appendChild(temp);
  downloadPDF('challanContentPdf', `Delivery_Challan_${o.orderNo}.pdf`).finally(()=>temp.remove());
}

// ─── PDF GENERATION USING html2canvas + jspdf (multi-page safe, row-aware) ───
function getSafeScale(element, desiredScale){
  // Mobile browsers cap total canvas pixels (roughly 16 million on many Android WebViews,
  // and ~4096-8192px per side). Long content (Khata / Full Year report) at scale 4 can
  // silently fail or produce a blank/corrupt PDF. Scale down automatically to stay safe.
  const maxSide = 7000;
  const maxArea = 15000000;
  let w = element.scrollWidth || element.offsetWidth || 800;
  let h = element.scrollHeight || element.offsetHeight || 600;
  let scale = desiredScale;
  while (scale > 1 && (w*scale > maxSide || h*scale > maxSide || (w*scale)*(h*scale) > maxArea)) {
    scale -= 0.5;
  }
  return Math.max(1, scale);
}

// Returns sorted [top,bottom] pixel ranges (element-local, CSS px) of "atomic" blocks
// (table rows, cards, list rows) that must never be sliced in half across a page break.
function getAtomicBlockRanges(element){
  const rootRect = element.getBoundingClientRect();
  const selector = 'tr, .khata-card, .order-card, .labour-card, .karigar-row, .report-row, .payment-item, thead';
  const nodes = element.querySelectorAll(selector);
  const ranges = [];
  nodes.forEach(el=>{
    const r = el.getBoundingClientRect();
    const top = r.top - rootRect.top;
    const bottom = r.bottom - rootRect.top;
    if (bottom > top) ranges.push([top, bottom]);
  });
  ranges.sort((a,b)=>a[0]-b[0]);
  return ranges;
}

// Given an ideal cut position (px), nudge it up to the start of any atomic block
// that it would otherwise slice through.
function findSafeCut(ranges, idealCut, minCut){
  for (let i=0; i<ranges.length; i++){
    const [top, bottom] = ranges[i];
    if (idealCut > top && idealCut < bottom){
      return top > minCut ? top : idealCut; // if the whole block is bigger than one page, we can't avoid it
    }
  }
  return idealCut;
}

async function downloadPDF(elementId, filename) {
  const loading = document.getElementById('pdfLoading');
  loading.classList.add('open');

  try {
    const element = document.getElementById(elementId);
    if (!element) { showToast('⚠️ Element not found'); return; }
    if (typeof html2canvas==='undefined' || !window.jspdf) { showToast('⚠️ PDF library load nahi hui — internet check karo'); return; }
    if (!element.scrollWidth || !element.scrollHeight) { showToast('⚠️ Content khaali hai, PDF nahi ban sakti'); return; }

    await new Promise(r => setTimeout(r, 300));

    const scale = getSafeScale(element, 4);
    const atomicRangesCss = getAtomicBlockRanges(element); // CSS px, element-local

    const canvas = await html2canvas(element, {
      scale: scale,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    if (!canvas.width || !canvas.height) {
      throw new Error('Canvas render empty — content too large for this device');
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pageHeightMm = 297;
    const pxToMm = pdfWidth / canvas.width;               // canvas px -> mm
    const pageHeightPx = pageHeightMm / pxToMm;            // mm -> canvas px
    // convert atomic block ranges from CSS px to canvas px (scale applied by html2canvas)
    const atomicRangesPx = atomicRangesCss.map(([t,b])=>[t*scale, b*scale]);

    let y = 0;
    let pageNum = 0;
    while (y < canvas.height - 0.5) {
      const idealEnd = Math.min(y + pageHeightPx, canvas.height);
      let end = idealEnd;
      if (end < canvas.height) {
        end = findSafeCut(atomicRangesPx, idealEnd, y + pageHeightPx*0.25);
      }
      if (end <= y) end = idealEnd; // safety net, never produce a zero/negative-height page

      const sliceHeightPx = Math.max(1, Math.round(end - y));
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0,0,sliceCanvas.width,sliceCanvas.height);
      ctx.drawImage(canvas, 0, y, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

      const sliceData = sliceCanvas.toDataURL('image/png');
      const sliceHeightMm = sliceHeightPx * pxToMm;
      if (pageNum > 0) pdf.addPage();
      pdf.addImage(sliceData, 'PNG', 0, 0, pdfWidth, sliceHeightMm, undefined, 'FAST');

      y = end;
      pageNum++;
      if (pageNum > 200) break; // sanity guard against runaway loops
    }

    const pdfBlob = pdf.output('blob');
    await shareOrDownloadBlob(pdfBlob, filename || 'document.pdf');
    return true;
  } catch (e) {
    console.error('PDF Error:', e);
    showToast('⚠️ PDF Error: ' + e.message);
    return false;
  } finally {
    loading.classList.remove('open');
  }
}

// Tries the device's native Share Sheet (WhatsApp, SMS, Email, Bluetooth, Drive, etc.)
// first — this is what makes every "PDF"/"Invoice"/"Slip" button double as a share
// button on mobile. Falls back to a normal file download when sharing isn't
// available (desktop browsers, or if the user cancels/it's unsupported).
async function shareOrDownloadBlob(blob, filename){
  try{
    if(navigator.canShare && navigator.share){
      const file = new File([blob], filename, { type: 'application/pdf' });
      if(navigator.canShare({ files: [file] })){
        try{
          await navigator.share({ files: [file], title: filename });
          showToast('✅ Share ho gaya!');
          return;
        }catch(shareErr){
          if(shareErr && shareErr.name === 'AbortError'){
            // user closed the share sheet without picking anything — not an error
            return;
          }
          // any other share failure falls through to a normal download below
        }
      }
    }
  }catch(e){ /* fall through to download */ }

  let url = URL.createObjectURL(blob);
  let a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast('✅ PDF Downloaded!');
}

// ════════════════════════════════════════════════════
// ──────── LABOUR MODAL ──────────────────────────────
// ════════════════════════════════════════════════════
function openLabourModal(labourId){
  editingLabourId=labourId||null;
  let l=labourId?labours.find(x=>x.id===labourId):null;
  let body=document.getElementById('labourModalBody');
  let orderOpts=orders.map(o=>{
    let op=getPartyById(o.partyId);
    let addr=op?getFullAddress(op):'';
    return `<option value="${o.id}" ${l&&l.orderId===o.id?'selected':''}>${esc(o.orderNo)} - ${esc(getPartyName(o.partyId))}${addr?' — '+esc(addr):''}</option>`;
  }).join('');
  let karigarOpts=karigars.map(k=>`<option value="${k.id}" ${l&&l.karigarId===k.id?'selected':''}>${esc(k.name)}</option>`).join('');
  body.innerHTML=`
    <div class="row-2">
      <div class="form-group"><label class="form-label">Order</label><select class="form-select" id="labourOrderId">${orderOpts}${!orders.length?'<option value="">No orders</option>':''}</select></div>
      <div class="form-group"><label class="form-label">Karigar</label><select class="form-select" id="labourKarigarId">${karigarOpts}${!karigars.length?'<option value="">No karigar — add first</option>':''}</select></div>
    </div>
    <div id="labourDoorBreakdown" style="background:var(--gray-50);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:9px;display:none;"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Rate / Sq.ft (auto-calc)</label><input class="form-input" type="number" id="labourRateSqft" value="${l&&l.ratePerSqft?l.ratePerSqft:''}" step="1" placeholder="e.g. 40" oninput="recalcLabourFromRate()"></div>
      <div class="form-group"><label class="form-label">Total Labour Cost</label><input class="form-input" type="number" id="labourTotal" value="${l?l.totalCost:0}" step="1" oninput="updateLabourPerDoor()"></div>
    </div>
    <div class="form-group"><label class="form-label">Paid</label><input class="form-input" type="number" id="labourPaid" value="${l?l.paid:0}" step="1"></div>
    <div class="form-group"><label class="form-label">Kis Account Se Diya</label><select class="form-select" id="labourPaidAccount">${BANK_ACCOUNTS.map(a=>`<option value="${a}" ${l&&l.paidAccount===a?'selected':''}>${a}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="labourDate" value="${l?l.date:new Date().toISOString().slice(0,10)}"></div>
    <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="labourNote" value="${l?esc(l.note||''):''}"></div>
    <div id="labourPartyInfo" style="background:var(--gray-50);border-radius:8px;padding:8px 10px;margin-bottom:6px;font-size:9px;display:none;"></div>
    <div style="font-size:9px;color:var(--gray-500);" id="labourDoorInfo">Select order to see door count</div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="saveLabour()">💾 Save</button>
      <button class="btn btn-outline" onclick="closeModal('labourModal')">Cancel</button>
    </div>
  `;
  document.getElementById('labourModalTitle').innerHTML=`${l?'✏️ Edit':'👷 New'} Labour Entry <button class="modal-close" onclick="closeModal('labourModal')">✕</button>`;
  openModal('labourModal');
  document.getElementById('labourOrderId')?.addEventListener('change',()=>{recalcLabourFromRate();});
  setTimeout(recalcLabourFromRate,100);
}

function getOrderDoorBreakdown(o){
  let map={};
  (o.doors||[]).forEach(d=>{
    let key=d.size||`${d.w}x${d.h}`;
    let qty=parseFloat(d.qty)||1;
    map[key]=(map[key]||0)+qty;
  });
  return Object.entries(map).map(([size,qty])=>`${size} × ${qty}`);
}

function getOrderTotalSqft(o){
  return (o.doors||[]).reduce((s,d)=>s+calcSqft(d.w,d.h)*(parseFloat(d.qty)||1),0);
}

function recalcLabourFromRate(){
  let orderId=document.getElementById('labourOrderId')?.value;
  let rate=parseFloat(document.getElementById('labourRateSqft')?.value)||0;
  let o=orders.find(x=>x.id===parseInt(orderId));
  let totalInput=document.getElementById('labourTotal');
  if(o && rate>0){
    let totalSqft=getOrderTotalSqft(o);
    if(totalInput){
      totalInput.value=Math.round(totalSqft*rate);
      totalInput.readOnly=true;
      totalInput.style.background='var(--gray-100)';
      totalInput.title='Auto-calculated from rate × sq.ft — clear the rate field to edit manually';
    }
  }else if(totalInput){
    totalInput.readOnly=false;
    totalInput.style.background='';
    totalInput.title='';
  }
  updateLabourPerDoor();
}

function updateLabourPerDoor(){
  let orderId=document.getElementById('labourOrderId')?.value;
  let totalCost=parseFloat(document.getElementById('labourTotal')?.value)||0;
  let info=document.getElementById('labourDoorInfo');
  let partyInfo=document.getElementById('labourPartyInfo');
  let breakdown=document.getElementById('labourDoorBreakdown');
  if(!info)return;
  if(!orderId){
    info.textContent='Select order to see door count';
    if(partyInfo){partyInfo.style.display='none';partyInfo.innerHTML='';}
    if(breakdown){breakdown.style.display='none';breakdown.innerHTML='';}
    return;
  }
  let o=orders.find(x=>x.id===parseInt(orderId));
  if(!o){info.textContent='Order not found';return;}
  let doorCount=o.doors?.length||0;
  let perDoor=doorCount?totalCost/doorCount:0;
  let totalSqft=getOrderTotalSqft(o);
  info.innerHTML=`🚪 ${doorCount} doors · 📐 ${totalSqft.toFixed(1)} sq.ft total · 👷 ${fmtRs(perDoor)} per door · Total: ${fmtRs(totalCost)}`;
  if(breakdown){
    let lines=getOrderDoorBreakdown(o);
    if(lines.length){
      breakdown.style.display='block';
      breakdown.innerHTML=`<strong>🚪 Doors in this order:</strong><br>${lines.map(l=>esc(l)).join('<br>')}`;
    }else{
      breakdown.style.display='none';
      breakdown.innerHTML='';
    }
  }
  if(partyInfo){
    let p=getPartyById(o.partyId);
    if(p){
      partyInfo.style.display='block';
      partyInfo.innerHTML=`👤 <strong>${esc(p.name)}</strong>${p.phone?' · 📞 '+esc(p.phone):''}${getFullAddress(p)?'<br>📍 '+esc(getFullAddress(p)):''}`;
    }else{
      partyInfo.style.display='block';
      partyInfo.innerHTML='⚠️ Party not found for this order';
    }
  }
}

function saveLabour(){
  let orderId=document.getElementById('labourOrderId')?.value;
  let karigarId=document.getElementById('labourKarigarId')?.value;
  if(!orderId||!karigarId){showToast('⚠️ Order aur Karigar select karo');return;}
  let totalCost=parseFloat(document.getElementById('labourTotal')?.value)||0;
  if(totalCost<=0){showToast('⚠️ Labour cost positive hona chahiye');return;}
  let paid=parseFloat(document.getElementById('labourPaid')?.value)||0;
  let paidAccount=document.getElementById('labourPaidAccount')?.value||'Cash';
  let date=document.getElementById('labourDate')?.value||new Date().toISOString().slice(0,10);
  let note=document.getElementById('labourNote')?.value||'';
  let ratePerSqft=parseFloat(document.getElementById('labourRateSqft')?.value)||0;

  let o=orders.find(x=>x.id===parseInt(orderId));
  if(o && o.doors){
    let doorCount=o.doors.length||0;
    let perDoor=doorCount?totalCost/doorCount:0;
    o.doors.forEach(d=>{d.labourPerDoor=perDoor;});
    o.totalLabour=totalCost;
    o.netProfit=o.orderTotal-(o.totalWoodCost||0)-totalCost;
  }
  let p=o?getPartyById(o.partyId):null;
  let karigarName=getKarigarName(parseInt(karigarId));

  let data={orderId:parseInt(orderId),karigarId:parseInt(karigarId),totalCost,paid,paidAccount,date,note,ratePerSqft,
    totalSqft:o?getOrderTotalSqft(o):0,
    partyId:p?p.id:null,partyName:p?p.name:'',partyPhone:p?p.phone||'':'',partyAddress:p?getFullAddress(p):'',
    updatedAt:new Date().toISOString()};

  let existingBankTxId=null;
  if(editingLabourId){
    let idx=labours.findIndex(x=>x.id===editingLabourId);
    if(idx>-1){
      existingBankTxId=labours[idx].bankTxId;
      labours[idx]={...labours[idx],...data};
      showToast('✅ Labour updated');
    }
  }else{
    data.id=newId();
    data.createdAt=new Date().toISOString();
    labourCounter++;
    data.labourNo='LAB-'+labourCounter;
    labours.push(data);
  }

  // Keep the karigar's payment in sync with the Bank/Cash Book ("kisko di hai payment")
  if(paid>0){
    let desc=`Labour payment to ${karigarName}${o?' ('+o.orderNo+')':''}`;
    if(existingBankTxId && bankTransactions.find(t=>t.id===existingBankTxId)){
      let tx=bankTransactions.find(t=>t.id===existingBankTxId);
      tx.amount=paid; tx.account=paidAccount; tx.date=date; tx.description=desc;
    }else{
      let txId=newId();
      bankTransactions.push({id:txId,type:'withdrawal',account:paidAccount,amount:paid,date,description:desc,createdAt:new Date().toISOString()});
      let target=editingLabourId?labours.find(x=>x.id===editingLabourId):labours[labours.length-1];
      if(target)target.bankTxId=txId;
    }
  }else if(existingBankTxId){
    bankTransactions=bankTransactions.filter(t=>t.id!==existingBankTxId);
    let target=labours.find(x=>x.id===editingLabourId);
    if(target)target.bankTxId=null;
  }
  if(!editingLabourId)showToast('✅ Labour added — Bank Book bhi update ho gaya');

  saveAll();
  closeModal('labourModal');
  renderAll();
}

// ════════════════════════════════════════════════════
// ──────── RENDER LABOUR LIST ────────────────────────
// ════════════════════════════════════════════════════
function renderLabourList(){
  let list=document.getElementById('labourList');
  let q=document.getElementById('labourSearch')?.value?.toLowerCase()||'';
  let filtered=labours.filter(l=>{
    let k=getKarigarName(l.karigarId).toLowerCase();
    let o=orders.find(x=>x.id===l.orderId);
    let on=o?o.orderNo.toLowerCase():'';
    let pn=o?getPartyName(o.partyId).toLowerCase():'';
    return k.includes(q)||on.includes(q)||pn.includes(q);
  });
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">👷</div><p>No labour records</p></div>';return;}
  let totalDoors=filtered.reduce((s,l)=>{let o=orders.find(x=>x.id===l.orderId);return s+(o?.doors?.length||0);},0);
  let totalCost=filtered.reduce((s,l)=>s+l.totalCost,0);
  let totalPaid=filtered.reduce((s,l)=>s+(l.paid||0),0);
  document.getElementById('labTotalDoors').textContent=totalDoors;
  document.getElementById('labTotalLabour').textContent=fmtRs(totalCost);
  document.getElementById('labTotalPaid').textContent=fmtRs(totalPaid);
  document.getElementById('labTotalDue').textContent=fmtRs(totalCost-totalPaid);

  list.innerHTML=filtered.slice().reverse().map(l=>{
    let o=orders.find(x=>x.id===l.orderId);
    let p=o?getPartyById(o.partyId):null;
    let pName=l.partyName||(p?p.name:'');
    let pAddr=l.partyAddress||(p?getFullAddress(p):'');
    let pPhone=l.partyPhone||(p?p.phone||'':'');
    return `<div class="labour-card">
      <div class="labour-header">
        <div><span class="karigar-badge">${getKarigarName(l.karigarId)}</span><br><span style="font-size:10px;font-weight:700;">${o?o.orderNo:'N/A'}</span></div>
        <div><span style="font-size:10px;">${l.date}</span><br><span class="badge ${(l.paid||0)>=l.totalCost?'badge-paid':'badge-unpaid'}">${(l.paid||0)>=l.totalCost?'Paid':'Due'}</span></div>
      </div>
      <div style="font-size:9px;margin-top:3px;">👤 ${pName?esc(pName):'—'}${pAddr?' · 📍 '+esc(pAddr):''}</div>
      ${l.ratePerSqft?`<div style="font-size:8px;color:var(--gray-500);margin-top:2px;">📐 ${(l.totalSqft||0).toFixed(1)} sq.ft × ${fmtRs(l.ratePerSqft)}/sqft</div>`:''}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;font-size:9px;margin-top:4px;">
        <div>Total: ${fmtRs(l.totalCost)}</div>
        <div>Paid: ${fmtRs(l.paid||0)}</div>
        <div>Due: ${fmtRs((l.totalCost)-(l.paid||0))}</div>
      </div>
      <div style="font-size:8px;color:var(--gray-500);">${esc(l.note||'')}</div>
      <div style="margin-top:4px;display:flex;gap:4px;">
        <button class="btn btn-gold btn-xs" onclick="openLabourSlip(${l.id})">📇 Slip</button>
        <button class="btn btn-outline btn-xs" onclick="editLabour(${l.id})">✏️</button>
        <button class="btn btn-danger btn-xs" onclick="deleteLabour(${l.id})">🗑</button>
      </div>
    </div>`;
  }).join('');
}

function buildLabourSlipHTML(l, o, elId){
  let p=o?getPartyById(o.partyId):null;
  let pName=l.partyName||(p?p.name:'—');
  let pAddr=l.partyAddress||(p?getFullAddress(p):'');
  let pPhone=l.partyPhone||(p?p.phone||'':'');
  return `
    <div id="${elId}" style="font-family:'Segoe UI',sans-serif;width:600px;box-sizing:border-box;margin:auto;background:#fff;color:#1a2a3a;">
      <div style="background:linear-gradient(120deg,#0d3b34,#0f5c52 60%,#127a6d);padding:22px 26px 18px;text-align:center;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;right:-30px;width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.18),transparent 70%);"></div>
        <div style="position:relative;z-index:1;">
          <h1 style="font-size:19px;margin:0;color:#fff;font-weight:800;">${esc(businessProfile.name)}</h1>
          <div style="font-size:11px;font-weight:800;color:#a8e6d9;letter-spacing:2.5px;margin-top:6px;">LABOUR / DELIVERY SLIP</div>
        </div>
      </div>
      <div style="padding:20px 26px 24px;">
        <div style="background:#eff6ff;border-radius:10px;padding:11px 15px;margin-bottom:10px;border:1px solid #dbe8fb;">
          <p style="font-size:8px;color:#8a9bb4;text-transform:uppercase;letter-spacing:.6px;font-weight:700;">Karigar</p>
          <p style="font-size:14px;font-weight:700;color:#1a3a6a;">${esc(getKarigarName(l.karigarId))}</p>
        </div>
        ${o&&o.designPhoto?`<div style="text-align:center;margin-bottom:10px;"><img src="${o.designPhoto}" style="max-width:100%;max-height:220px;border-radius:10px;border:2px solid #c8963e;"><p style="font-size:8px;color:#9ca7b8;margin-top:4px;">Design Reference</p></div>`:''}
        <div style="background:#fdf8ef;border-radius:10px;padding:11px 15px;margin-bottom:12px;border:1px solid #f2e6cc;">
          <p style="font-size:8px;color:#a68f5c;text-transform:uppercase;letter-spacing:.6px;font-weight:700;">Deliver To (Party)</p>
          <p style="font-size:14px;font-weight:700;color:#1a3a6a;">${esc(pName)}</p>
          ${pPhone?`<p style="font-size:10px;color:#444;">📞 ${esc(pPhone)}</p>`:''}
          ${pAddr?`<p style="font-size:12px;color:#222;margin-top:4px;">📍 ${esc(pAddr)}</p>`:'<p style="font-size:10px;color:#c00;">Address not available</p>'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:10px;background:#f7f9fc;border-radius:10px;padding:11px 15px;border:1px solid #e8ecf3;">
          <div><span style="color:#9ca7b8;">Order</span><br><strong>${o?esc(o.orderNo):'N/A'}</strong></div>
          <div><span style="color:#9ca7b8;">Date</span><br><strong>${l.date}</strong></div>
          <div><span style="color:#9ca7b8;">Doors</span><br><strong>${o?.doors?.length||0}</strong></div>
          <div><span style="color:#9ca7b8;">Labour Cost</span><br><strong style="color:#0f5c52;">${fmtRs(l.totalCost)}</strong></div>
        </div>
        ${l.note?`<p style="font-size:10px;margin-top:10px;color:#555;"><strong>Note:</strong> ${esc(l.note)}</p>`:''}
      </div>
    </div>
  `;
}

function openLabourSlip(labourId){
  let l=labours.find(x=>x.id===labourId);
  if(!l){showToast('⚠️ Labour record not found');return;}
  let o=orders.find(x=>x.id===l.orderId);
  let content=document.getElementById('billContent');
  content.innerHTML=buildLabourSlipHTML(l, o, 'labourSlipContent');
  openModal('billModal');

  let temp=document.createElement('div');
  temp.innerHTML=buildLabourSlipHTML(l, o, 'labourSlipContentPdf');
  temp.style.position='fixed';
  temp.style.left='0';
  temp.style.top='0';
  temp.style.width='600px';
  temp.style.background='#fff';
  temp.style.zIndex='150';
  temp.style.pointerEvents='none';
  document.body.appendChild(temp);
  downloadPDF('labourSlipContentPdf', `Labour_Slip_${o?o.orderNo:l.id}.pdf`).finally(()=>temp.remove());
}

function editLabour(id){closeModal('labourModal');openLabourModal(id);}

function deleteLabour(id){
  customConfirm('Delete this labour record?',()=>{
    let l=labours.find(x=>x.id===id);
    if(l&&l.bankTxId){bankTransactions=bankTransactions.filter(t=>t.id!==l.bankTxId);}
    labours=labours.filter(x=>x.id!==id);
    saveAll();renderAll();showToast('🗑 Deleted');
  });
}

// ════════════════════════════════════════════════════
// ──────── KARIGAR MANAGER (FIXED: proper add/edit form + ledger view with back) ─
// ════════════════════════════════════════════════════
let karigarView='list'; // 'list' | 'ledger'
let karigarLedgerId=null;

function openKarigarList(){
  karigarView='list';
  karigarLedgerId=null;
  renderKarigarModalBody();
  openModal('karigarModal');
}

function renderKarigarModalBody(){
  document.getElementById('karigarModalTitle').innerHTML='🔧 Karigar Manager <button class="modal-close" onclick="closeModal(\'karigarModal\')">✕</button>';
  let body=document.getElementById('karigarModalBody');
  if(karigarView==='ledger'&&karigarLedgerId){
    renderKarigarLedgerView();
    return;
  }
  let html=`
    <div style="display:flex;gap:4px;margin-bottom:8px;">
      <input class="form-input" id="karigarName" placeholder="Karigar name" style="flex:2;">
      <input class="form-input" id="karigarPhone" placeholder="Phone (optional)" style="flex:1;">
      <button class="btn btn-primary btn-sm" onclick="addKarigar()">+ Add</button>
    </div>
    ${karigars.map(k=>{
      let labs=labours.filter(l=>l.karigarId===k.id);
      let earned=labs.reduce((s,l)=>s+l.totalCost,0);
      let paid=labs.reduce((s,l)=>s+(l.paid||0),0);
      let bal=earned-paid;
      return `
      <div class="karigar-row">
        <div class="karigar-row-head">
          <span style="font-weight:700;">${esc(k.name)}</span>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-primary btn-xs" onclick="openKarigarLedger(${k.id})">📊 Ledger</button>
            <button class="btn btn-outline btn-xs" onclick="startEditKarigar(${k.id})">✏️</button>
            <button class="btn btn-danger btn-xs" onclick="deleteKarigar(${k.id})">🗑</button>
          </div>
        </div>
        <div style="font-size:8px;color:var(--gray-500);">${esc(k.workType||'General')} ${k.phone?'· '+esc(k.phone):''}</div>
        <div style="font-size:9px;margin-top:4px;">Earned: ${fmtRs(earned)} · Paid: ${fmtRs(paid)} · <span style="color:${bal>0?'var(--red)':'var(--green-700)'};font-weight:700;">Balance: ${fmtRs(bal)}</span></div>
      </div>`;
    }).join('')}
    ${!karigars.length?'<div class="empty-state"><p>No karigar yet — pehla karigar add karo</p></div>':''}
  `;
  body.innerHTML=html;
}

function addKarigar(){
  let name=document.getElementById('karigarName')?.value.trim();
  let phone=document.getElementById('karigarPhone')?.value.trim();
  if(!name){showToast('⚠️ Name zaruri');return;}
  karigars.push({id:newId(),name,phone:phone||'',workType:'General',createdAt:new Date().toISOString()});
  saveAll();
  renderKarigarModalBody();
  showToast('✅ Karigar added');
}

function startEditKarigar(id){
  let k=karigars.find(x=>x.id===id);
  if(!k)return;
  let body=document.getElementById('karigarModalBody');
  body.innerHTML=`
    <div style="font-size:11px;font-weight:700;margin-bottom:8px;">✏️ Edit Karigar</div>
    <div class="form-group"><label class="form-label">Name</label><input class="form-input" id="editKarigarName" value="${esc(k.name)}"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="editKarigarPhone" value="${esc(k.phone||'')}"></div>
      <div class="form-group"><label class="form-label">Work Type</label><input class="form-input" id="editKarigarType" value="${esc(k.workType||'General')}"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="saveEditKarigar(${k.id})">💾 Save</button>
      <button class="btn btn-outline" onclick="renderKarigarModalBody()">← Back</button>
    </div>
  `;
}

function saveEditKarigar(id){
  let k=karigars.find(x=>x.id===id);
  if(!k)return;
  let name=document.getElementById('editKarigarName')?.value.trim();
  if(!name){showToast('⚠️ Name zaruri');return;}
  k.name=name;
  k.phone=document.getElementById('editKarigarPhone')?.value||'';
  k.workType=document.getElementById('editKarigarType')?.value||'General';
  saveAll();
  renderKarigarModalBody();
  showToast('✅ Karigar updated');
}

function deleteKarigar(id){
  customConfirm('Delete this karigar? Uske labour records rahenge lekin naam "Unknown" ho jayega.',()=>{
    karigars=karigars.filter(x=>x.id!==id);
    saveAll();renderKarigarModalBody();showToast('🗑 Deleted');
  });
}

function openKarigarLedger(id){
  karigarView='ledger';
  karigarLedgerId=id;
  renderKarigarLedgerView();
}

function renderKarigarLedgerView(){
  let k=karigars.find(x=>x.id===karigarLedgerId);
  let body=document.getElementById('karigarModalBody');
  if(!k){karigarView='list';renderKarigarModalBody();return;}
  document.getElementById('karigarModalTitle').innerHTML=`📊 ${esc(k.name)} Ledger <button class="modal-close" onclick="closeModal('karigarModal')">✕</button>`;
  let labs=labours.filter(l=>l.karigarId===k.id).slice().reverse();
  let earned=labs.reduce((s,l)=>s+l.totalCost,0);
  let paid=labs.reduce((s,l)=>s+(l.paid||0),0);
  let bal=earned-paid;
  body.innerHTML=`
    <button class="btn btn-outline btn-sm" onclick="openKarigarList()" style="margin-bottom:8px;">← Back to Karigar List</button>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:10px;">
      <div class="stat-card blue"><div class="num">${fmtRs(earned)}</div><div class="lbl">Total Earned</div></div>
      <div class="stat-card green"><div class="num">${fmtRs(paid)}</div><div class="lbl">Paid</div></div>
      <div class="stat-card red"><div class="num">${fmtRs(bal)}</div><div class="lbl">Balance Due</div></div>
    </div>
    ${labs.length?labs.map(l=>{
      let o=orders.find(x=>x.id===l.orderId);
      return `<div class="report-row">
        <span>${o?o.orderNo:'N/A'} · ${l.date}</span>
        <span>${fmtRs(l.totalCost)} (Paid ${fmtRs(l.paid||0)})</span>
      </div>`;
    }).join(''):'<div class="empty-state"><p>Koi labour record nahi</p></div>'}
  `;
}

function openKarigarForm(){openKarigarList();}

// ════════════════════════════════════════════════════
// ──────── KARIGAR ATTENDANCE (daily hazri/wage) ─────
// ════════════════════════════════════════════════════
let attendanceSelectedDate=null;

function openAttendanceModal(){
  attendanceSelectedDate=new Date().toISOString().slice(0,10);
  renderAttendanceModalBody();
  openModal('attendanceModal');
}

function renderAttendanceModalBody(){
  let body=document.getElementById('attendanceModalBody');
  if(!karigars.length){
    body.innerHTML='<div class="empty-state"><div class="e-icon">🗓️</div><p>Pehle Karigar add karein</p></div>';
    return;
  }
  let dayRecords=karigarAttendance.filter(a=>a.date===attendanceSelectedDate);
  let thisMonth=attendanceSelectedDate.slice(0,7);
  let monthRecords=karigarAttendance.filter(a=>a.date.startsWith(thisMonth));
  let monthWageDue=monthRecords.reduce((s,a)=>s+(a.status!=='absent'?(parseFloat(a.wage)||0):0)-(parseFloat(a.paid)||0),0);

  body.innerHTML=`
    <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="attendanceDate" value="${attendanceSelectedDate}" onchange="attendanceSelectedDate=this.value;renderAttendanceModalBody();"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:10px;">
      <div class="stat-card blue"><div class="num">${dayRecords.filter(a=>a.status==='present').length}/${karigars.length}</div><div class="lbl">Aaj Hazir</div></div>
      <div class="stat-card red"><div class="num">${fmtRs(monthWageDue)}</div><div class="lbl">Is Mahine Baqi Wage</div></div>
    </div>
    ${karigars.map(k=>{
      let rec=dayRecords.find(a=>a.karigarId===k.id);
      let status=rec?rec.status:'';
      return `<div class="karigar-row">
        <div class="karigar-row-head">
          <span style="font-weight:700;">${esc(k.name)}</span>
          <button class="btn btn-outline btn-xs" onclick="openKarigarAttendanceHistory(${k.id})">📊 History</button>
        </div>
        <div style="display:flex;gap:4px;margin-bottom:5px;">
          <button class="btn ${status==='present'?'btn-success':'btn-outline'} btn-xs" onclick="markAttendance(${k.id},'present')">✅ Hazir</button>
          <button class="btn ${status==='half-day'?'btn-gold':'btn-outline'} btn-xs" onclick="markAttendance(${k.id},'half-day')">🌗 Half Day</button>
          <button class="btn ${status==='absent'?'btn-danger':'btn-outline'} btn-xs" onclick="markAttendance(${k.id},'absent')">❌ Ghair Hazir</button>
        </div>
        ${status&&status!=='absent'?`<input class="form-input" type="number" placeholder="Wage" value="${rec?.wage||''}" style="font-size:9px;padding:5px 8px;" onchange="updateAttendanceWage(${k.id},this.value)">`:''}
      </div>`;
    }).join('')}
    <button class="btn btn-outline" style="margin-top:6px;" onclick="closeModal('attendanceModal')">Close</button>
  `;
}

function markAttendance(karigarId,status){
  let idx=karigarAttendance.findIndex(a=>a.karigarId===karigarId&&a.date===attendanceSelectedDate);
  if(idx>-1){
    if(karigarAttendance[idx].status===status){
      // tap again to un-mark
      karigarAttendance.splice(idx,1);
    }else{
      karigarAttendance[idx].status=status;
    }
  }else{
    karigarAttendance.push({id:newId(),karigarId,date:attendanceSelectedDate,status,wage:0,paid:0});
  }
  saveAll();
  renderAttendanceModalBody();
}

function updateAttendanceWage(karigarId,value){
  let rec=karigarAttendance.find(a=>a.karigarId===karigarId&&a.date===attendanceSelectedDate);
  if(rec){rec.wage=parseFloat(value)||0;saveAll();}
}

function openKarigarAttendanceHistory(karigarId){
  let k=getKarigarById(karigarId);
  if(!k)return;
  let records=karigarAttendance.filter(a=>a.karigarId===karigarId).sort((a,b)=>new Date(b.date)-new Date(a.date));
  let totalPresent=records.filter(a=>a.status==='present').length;
  let totalHalf=records.filter(a=>a.status==='half-day').length;
  let totalAbsent=records.filter(a=>a.status==='absent').length;
  let totalWage=records.reduce((s,a)=>s+(a.status!=='absent'?(parseFloat(a.wage)||0):0),0);
  let body=document.getElementById('attendanceModalBody');
  body.innerHTML=`
    <button class="btn btn-outline btn-sm" onclick="renderAttendanceModalBody()" style="margin-bottom:8px;">← Wapis</button>
    <div style="font-size:13px;font-weight:700;">${esc(k.name)} — Attendance History</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin:8px 0;">
      <div class="stat-card green"><div class="num">${totalPresent}</div><div class="lbl">Hazir</div></div>
      <div class="stat-card gold"><div class="num">${totalHalf}</div><div class="lbl">Half Day</div></div>
      <div class="stat-card red"><div class="num">${totalAbsent}</div><div class="lbl">Ghair Hazir</div></div>
      <div class="stat-card blue"><div class="num">${fmtRs(totalWage)}</div><div class="lbl">Total Wage</div></div>
    </div>
    ${records.length?records.slice(0,30).map(a=>`
      <div class="report-row">
        <span>${a.date} · ${a.status==='present'?'✅ Hazir':a.status==='half-day'?'🌗 Half Day':'❌ Ghair Hazir'}</span>
        <span>${a.status!=='absent'?fmtRs(a.wage||0):''}</span>
      </div>
    `).join(''):'<div class="empty-state"><p>Koi record nahi</p></div>'}
  `;
}

function getKarigarById(id){return karigars.find(k=>k.id===id);}

// ════════════════════════════════════════════════════
// ──────── PARTY MODAL ───────────────────────────────
// ════════════════════════════════════════════════════
function openPartyModal(partyId){
  editingPartyId=partyId||null;
  let p=partyId?parties.find(x=>x.id===partyId):null;
  let body=document.getElementById('partyModalBody');
  body.innerHTML=`
    <div class="form-group"><label class="form-label">Name <span class="req">*</span></label><input class="form-input" id="partyName" value="${p?esc(p.name):''}"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="partyPhone" value="${p?esc(p.phone||''):''}"></div>
      <div class="form-group"><label class="form-label">Area</label><input class="form-input" id="partyArea" value="${p?esc(p.area||''):''}"></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="partyAddress" value="${p?esc(p.address||''):''}"></div>
    <div class="form-group"><label class="form-label">Opening Balance (Purani Baqi Raqam)</label><input class="form-input" type="number" id="partyOpeningBalance" value="${p?p.openingBalance||0:0}" step="1" placeholder="Agar pehle se koi raqam party pe baqi hai to yahan likhein"></div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="saveParty()">💾 Save</button>
      <button class="btn btn-outline" onclick="closeModal('partyModal')">Cancel</button>
    </div>
  `;
  document.getElementById('partyModalTitle').innerHTML=`${p?'✏️ Edit':'👤 New'} Party <button class="modal-close" onclick="closeModal('partyModal')">✕</button>`;
  openModal('partyModal');
}

function saveParty(){
  let name=document.getElementById('partyName')?.value.trim();
  if(!name){showToast('⚠️ Name zaruri');return;}
  let data={name,phone:document.getElementById('partyPhone')?.value||'',area:document.getElementById('partyArea')?.value||'',address:document.getElementById('partyAddress')?.value||'',openingBalance:parseFloat(document.getElementById('partyOpeningBalance')?.value)||0,updatedAt:new Date().toISOString()};
  if(editingPartyId){
    let idx=parties.findIndex(p=>p.id===editingPartyId);
    if(idx>-1){parties[idx]={...parties[idx],...data};showToast('✅ Party updated');}
  }else{
    data.id=newId();
    data.createdAt=new Date().toISOString();
    parties.push(data);
    showToast('✅ Party added');
  }
  saveAll();closeModal('partyModal');renderAll();
}

// ════════════════════════════════════════════════════
// ──────── RENDER PARTIES ────────────────────────────
// ════════════════════════════════════════════════════
function renderParties(){
  let list=document.getElementById('partiesList');
  let q=document.getElementById('partySearch')?.value?.toLowerCase()||'';
  let filtered=parties.filter(p=>p.name.toLowerCase().includes(q)||(p.phone||'').includes(q));
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">👥</div><p>No parties</p></div>';return;}
  list.innerHTML=filtered.map(p=>`
    <div class="khata-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;font-size:13px;">${esc(p.name)}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-outline btn-xs" onclick="editParty(${p.id})">✏️</button>
          <button class="btn btn-danger btn-xs" onclick="deleteParty(${p.id})">🗑</button>
        </div>
      </div>
      <div style="font-size:9px;color:var(--gray-500);">${p.phone||''} ${p.area||''}</div>
      <div style="font-size:9px;">${p.address||''}</div>
    </div>
  `).join('');
}

function editParty(id){closeModal('partyModal');openPartyModal(id);}

function deleteParty(id){
  customConfirm('Delete this party?',()=>{
    parties=parties.filter(p=>p.id!==id);
    saveAll();renderParties();showToast('🗑 Deleted');
  });
}

// ════════════════════════════════════════════════════
// ──────── KHATA ─────────────────────────────────────
// ════════════════════════════════════════════════════
function renderKhata(){
  let content=document.getElementById('khataContent');
  let summaryEl=document.getElementById('khataSummary');
  if(summaryEl){
    let totalOutstanding=parties.reduce((s,p)=>{let b=getPartyBalance(p);return s+(b>0?b:0);},0);
    let dueParties=parties.filter(p=>getPartyBalance(p)>0).length;
    let thisMonth=new Date().toISOString().slice(0,7);
    let receivedThisMonth=orders.reduce((s,o)=>s+(o.payments||[]).filter(pay=>pay.date.startsWith(thisMonth)).reduce((s2,pay)=>s2+(parseFloat(pay.amount)||0),0),0)
      +parties.reduce((s,p)=>s+(p.partyPayments||[]).filter(pp=>pp.date.startsWith(thisMonth)).reduce((s2,pp)=>s2+(parseFloat(pp.amount)||0),0),0);
    summaryEl.innerHTML=`
      <div class="stat-card red"><div class="num">${fmtRs(totalOutstanding)}</div><div class="lbl">Total Outstanding</div></div>
      <div class="stat-card orange"><div class="num">${dueParties}</div><div class="lbl">Parties Due</div></div>
      <div class="stat-card green"><div class="num">${fmtRs(receivedThisMonth)}</div><div class="lbl">Is Mahine Wasool</div></div>
    `;
  }
  let filter=document.getElementById('khataPartyFilter')?.value;
  let filtered=filter?parties.filter(p=>p.id===parseInt(filter)):parties.slice();
  if(!filtered.length){content.innerHTML='<div class="empty-state"><div class="e-icon">📒</div><p>No parties</p></div>';return;}
  // Sabse zyada baqi wali party sabse upar — ek clear tarteeb
  filtered.sort((a,b)=>getPartyBalance(b)-getPartyBalance(a));
  content.innerHTML=filtered.map(p=>{
    let pOrders=getPartyOrders(p.id);
    pOrders.sort((a,b)=>new Date(b.date)-new Date(a.date));
    let totalSales=pOrders.reduce((s,o)=>s+o.orderTotal,0);
    let totalOrderPaid=pOrders.reduce((s,o)=>s+getOrderTotalPaid(o),0);
    let directPaid=(p.partyPayments||[]).reduce((s,pp)=>s+(parseFloat(pp.amount)||0),0);
    let totalPaid=totalOrderPaid+directPaid; // FIXED: now includes payments made against Opening Balance too
    let totalBilled=(p.openingBalance||0)+totalSales;
    let balance=getPartyBalance(p);
    let latest=pOrders.length>0?pOrders[0]:null;
    return `<div class="khata-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;font-size:14px;">${esc(p.name)}</div>
          <div style="font-size:9px;color:var(--gray-500);">${p.phone||''}</div>
        </div>
        <div class="khata-balance ${balance<=0?'cr':'dr'}" style="padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;">
          ${fmtRs(balance)} ${balance>0?'📥':'✅'}
        </div>
      </div>
      ${latest?`
        <div style="font-size:9px;margin-top:4px;background:var(--gray-50);padding:6px 10px;border-radius:6px;">
          <strong>Latest Order:</strong> ${latest.orderNo} · ${fmtRs(latest.orderTotal)} · ${latest.date}
        </div>
      `:''}
      ${p.openingBalance?`<div style="font-size:9px;margin-top:4px;color:var(--gray-500);">Purani Baqi: ${fmtRs(p.openingBalance)} · Orders: ${pOrders.length}</div>`:`<div style="font-size:9px;margin-top:4px;color:var(--gray-500);">Orders: ${pOrders.length}</div>`}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:6px;">
        <div style="background:var(--gray-50);border-radius:6px;padding:5px 6px;text-align:center;">
          <div style="font-size:7px;color:var(--gray-500);text-transform:uppercase;">Total Bill</div>
          <div style="font-size:10px;font-weight:800;">${fmtRs(totalBilled)}</div>
        </div>
        <div style="background:#d1fae5;border-radius:6px;padding:5px 6px;text-align:center;">
          <div style="font-size:7px;color:#065f46;text-transform:uppercase;">Kitni Aayi</div>
          <div style="font-size:10px;font-weight:800;color:#065f46;">${fmtRs(totalPaid)}</div>
        </div>
        <div style="background:${balance>0?'#fee2e2':'#d1fae5'};border-radius:6px;padding:5px 6px;text-align:center;">
          <div style="font-size:7px;color:${balance>0?'#b91c1c':'#065f46'};text-transform:uppercase;">Kitni Baqi</div>
          <div style="font-size:10px;font-weight:800;color:${balance>0?'#b91c1c':'#065f46'};">${fmtRs(balance)}</div>
        </div>
      </div>
      <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">
        <button class="btn btn-outline btn-xs" onclick="openPartyLedger(${p.id})">📖 Digital Ledger</button>
        ${balance>0?`<button class="btn btn-success btn-xs" onclick="openReceivePaymentModal(${p.id})">💵 Receive Payment</button>`:''}
        ${balance>0&&p.phone?`<button class="btn btn-outline btn-xs" onclick="sendWhatsAppReminder(${p.id})">💬 WhatsApp Reminder</button>`:''}
      </div>    </div>`;
  }).join('');
  updateKhataFilter();
}

let payingPartyId=null;

function openReceivePaymentModal(partyId){
  let p=getPartyById(partyId);
  if(!p){showToast('⚠️ Party not found');return;}
  payingPartyId=partyId;
  let balance=getPartyBalance(p);
  let body=document.getElementById('paymentModalBody');
  let historyRows=[];
  getPartyOrders(p.id).forEach(o=>(o.payments||[]).forEach(pay=>historyRows.push({...pay,ref:o.orderNo,kind:'order',orderId:o.id})));
  (p.partyPayments||[]).forEach(pp=>historyRows.push({...pp,ref:'Opening Balance',kind:'direct'}));
  historyRows.sort((a,b)=>new Date(b.date)-new Date(a.date));
  body.innerHTML=`
    <div style="font-weight:700;font-size:14px;">${esc(p.name)}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 10px;padding:10px 14px;border-radius:10px;background:${balance>0?'#fee2e2':'#d1fae5'};">
      <span style="font-size:10px;font-weight:700;color:${balance>0?'#b91c1c':'#065f46'};">💰 Ab Tak Kitni Baqi Hai</span>
      <strong style="font-size:16px;color:${balance>0?'#b91c1c':'#065f46'};">${fmtRs(balance)}</strong>
    </div>
    <div class="form-group"><label class="form-label">Amount (payment jitni mil rahi hai)</label><input class="form-input" type="number" id="payAmount" value="${Math.max(0,balance)}" step="1"></div>
    <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="payDate" value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="form-group"><label class="form-label">Kis Account Mein Aaya</label><select class="form-select" id="payMethod">${BANK_ACCOUNTS.map(a=>`<option value="${a}">${a}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="payNote" placeholder="Optional"></div>
    ${historyRows.length?`<div style="margin:8px 0;"><div style="font-size:8px;font-weight:700;margin-bottom:4px;">Payment History</div><div class="payment-history-box">${historyRows.slice(0,20).map(pay=>`<div class="payment-item"><span>${pay.date} · ${pay.method||'Cash'} · ${esc(pay.ref)}</span><span>${fmtRs(pay.amount)} <button class="payment-del-btn" onclick="deleteReceivedPayment('${pay.kind}',${pay.kind==='order'?pay.orderId:p.id},${pay.id},${p.id})">✕</button></span></div>`).join('')}</div></div>`:''}
    <div style="display:flex;gap:6px;">
      <button class="btn btn-success" onclick="addPartyPayment()">💵 Receive Payment</button>
      <button class="btn btn-outline" onclick="closeModal('paymentModal')">Cancel</button>
    </div>
  `;
  document.getElementById('paymentModalHead').innerHTML='💵 Receive Payment <button class="modal-close" onclick="closeModal(\'paymentModal\')">✕</button>';
  openModal('paymentModal');
}

function addPartyPayment(){
  let p=getPartyById(payingPartyId);
  if(!p){showToast('⚠️ Party not found');return;}
  let amount=parseFloat(document.getElementById('payAmount')?.value)||0;
  if(amount<=0){showToast('⚠️ Amount positive hona chahiye');return;}
  let date=document.getElementById('payDate')?.value||new Date().toISOString().slice(0,10);
  let method=document.getElementById('payMethod')?.value||'Cash';
  let note=document.getElementById('payNote')?.value||'';
  let remaining=amount;
  let allocation=[];

  // 1. Apply against the party's outstanding orders first (oldest order first)
  let pOrders=getPartyOrders(p.id)
    .filter(o=>(o.orderTotal-getOrderTotalPaid(o))>0)
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
  for(let o of pOrders){
    if(remaining<=0)break;
    let due=o.orderTotal-getOrderTotalPaid(o);
    let applyAmt=Math.min(due,remaining);
    if(!o.payments)o.payments=[];
    let bankTxId=newId();
    bankTransactions.push({id:bankTxId,type:'deposit',account:method,amount:applyAmt,date,description:`Payment from ${p.name} (${o.orderNo})`,createdAt:new Date().toISOString()});
    o.payments.push({id:Date.now()+Math.floor(Math.random()*1000),amount:applyAmt,date,method,note,user:activeUserId,bankTxId});
    allocation.push({label:o.orderNo,amount:applyAmt,fullySettled:applyAmt>=due});
    remaining-=applyAmt;
  }

  // 2. Anything left over reduces the general/opening balance
  if(remaining>0){
    if(!p.partyPayments)p.partyPayments=[];
    let bankTxId=newId();
    bankTransactions.push({id:bankTxId,type:'deposit',account:method,amount:remaining,date,description:`Payment from ${p.name} (Opening Balance)`,createdAt:new Date().toISOString()});
    p.partyPayments.push({id:Date.now(),amount:remaining,date,method,note,bankTxId});
    allocation.push({label:'Opening Balance / Purani Baqi',amount:remaining,fullySettled:getPartyBalance(p)<=0});
  }

  saveAll();
  closeModal('paymentModal');
  renderAll();
  showPaymentReceipt(p, amount, date, method, allocation);
}

function showPaymentReceipt(p, amount, date, method, allocation){
  let newBalance=getPartyBalance(p);
  let titleEl=document.getElementById('paymentReceiptModalTitle');
  if(titleEl)titleEl.textContent='✅ Payment Receipt';
  let body=document.getElementById('paymentReceiptModalBody');
  body.innerHTML=`
    <div style="text-align:center;margin-bottom:10px;">
      <div style="font-size:32px;">✅</div>
      <div style="font-size:14px;font-weight:700;color:var(--green-700);">Payment Receive Ho Gayi</div>
      <div style="font-size:9px;color:var(--gray-500);">${esc(p.name)} · ${date} · ${esc(method)}</div>
    </div>
    <div style="background:var(--gray-50);border-radius:10px;padding:10px 14px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;"><span>Total Received</span><strong>${fmtRs(amount)}</strong></div>
    </div>
    <div style="font-size:9px;font-weight:700;margin-bottom:6px;">📋 Kahan Adjust Hui:</div>
    ${allocation.map(a=>`
      <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--card);border:1px solid var(--border);border-radius:8px;margin-bottom:5px;font-size:10px;">
        <span>${esc(a.label)} ${a.fullySettled?'<span style="color:var(--green-700);">✓ Clear</span>':''}</span>
        <strong>${fmtRs(a.amount)}</strong>
      </div>
    `).join('')}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:10px 12px;border-radius:8px;background:${newBalance>0?'#fee2e2':'#d1fae5'};">
      <strong style="font-size:11px;">Naya Balance</strong>
      <strong style="font-size:13px;color:${newBalance>0?'#b91c1c':'#065f46'};">${fmtRs(newBalance)}</strong>
    </div>
    <button class="btn btn-primary" style="margin-top:12px;width:100%;justify-content:center;" onclick="closeModal('paymentReceiptModal')">Theek Hai</button>
  `;
  openModal('paymentReceiptModal');
}

function deletePartyPayment(partyId,paymentId){
  let p=getPartyById(partyId);
  if(!p||!p.partyPayments)return;
  let pay=p.partyPayments.find(x=>x.id===paymentId);
  if(pay&&pay.bankTxId){bankTransactions=bankTransactions.filter(t=>t.id!==pay.bankTxId);}
  p.partyPayments=p.partyPayments.filter(x=>x.id!==paymentId);
  saveAll();
  renderAll();
  showToast('🗑 Payment removed');
}

function deleteReceivedPayment(kind,refId,paymentId,partyId){
  if(kind==='order'){
    let o=orders.find(x=>x.id===refId);
    if(!o||!o.payments)return;
    customConfirm('Delete this payment?',()=>{
      let pay=o.payments.find(x=>x.id===paymentId);
      if(pay&&pay.bankTxId){bankTransactions=bankTransactions.filter(t=>t.id!==pay.bankTxId);}
      o.payments=o.payments.filter(x=>x.id!==paymentId);
      saveAll();
      renderAll();
      openReceivePaymentModal(partyId);
      showToast('🗑 Payment removed');
    });
  }else{
    let p=getPartyById(partyId);
    if(!p||!p.partyPayments)return;
    customConfirm('Delete this payment?',()=>{
      let pay=p.partyPayments.find(x=>x.id===paymentId);
      if(pay&&pay.bankTxId){bankTransactions=bankTransactions.filter(t=>t.id!==pay.bankTxId);}
      p.partyPayments=p.partyPayments.filter(x=>x.id!==paymentId);
      saveAll();
      renderAll();
      openReceivePaymentModal(partyId);
      showToast('🗑 Payment removed');
    });
  }
}

// ════════════════════════════════════════════════════
// ──────── DIGITAL PARTY LEDGER (running statement) ──
// ════════════════════════════════════════════════════
function buildPartyLedgerEntries(p){
  let entries=[];
  if(p.openingBalance){
    entries.push({date:p.createdAt?p.createdAt.slice(0,10):'—',type:'Opening Balance',ref:'',debit:p.openingBalance>0?p.openingBalance:0,credit:p.openingBalance<0?-p.openingBalance:0});
  }
  getPartyOrders(p.id).forEach(o=>{
    entries.push({date:o.date,type:'Order',ref:o.orderNo,debit:o.orderTotal,credit:0});
    (o.payments||[]).forEach(pay=>{
      entries.push({date:pay.date,type:'Payment ('+(pay.method||'Cash')+')',ref:o.orderNo,debit:0,credit:parseFloat(pay.amount)||0});
    });
  });
  (p.partyPayments||[]).forEach(pp=>{
    entries.push({date:pp.date,type:'Payment ('+(pp.method||'Cash')+')',ref:'Opening Balance',debit:0,credit:parseFloat(pp.amount)||0});
  });
  entries.sort((a,b)=>new Date(a.date)-new Date(b.date));
  let running=0;
  entries.forEach(e=>{running+=e.debit-e.credit;e.balance=running;});
  return entries;
}

function openPartyLedger(partyId){
  let p=getPartyById(partyId);
  if(!p){showToast('⚠️ Party not found');return;}
  document.getElementById('partyLedgerModalTitle').innerHTML=`📖 ${esc(p.name)} — Digital Ledger <button class="modal-close" onclick="closeModal('partyLedgerModal')">✕</button>`;
  let entries=buildPartyLedgerEntries(p);
  let body=document.getElementById('partyLedgerModalBody');
  body.innerHTML=`
    <div style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">${p.phone||''} ${getFullAddress(p)?'· 📍 '+esc(getFullAddress(p)):''}</div>
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:9px;">
        <thead><tr style="background:var(--primary);color:#fff;">
          <th style="padding:5px 6px;text-align:left;">Date</th>
          <th style="padding:5px 6px;text-align:left;">Type</th>
          <th style="padding:5px 6px;text-align:left;">Ref</th>
          <th style="padding:5px 6px;text-align:right;">Debit</th>
          <th style="padding:5px 6px;text-align:right;">Credit</th>
          <th style="padding:5px 6px;text-align:right;background:var(--gold);">Balance</th>
        </tr></thead>
        <tbody>${entries.map((e,i)=>`
          <tr style="background:${i%2===0?'var(--card)':'var(--gray-50)'};border-bottom:1px solid var(--border);">
            <td style="padding:5px 6px;white-space:nowrap;">${e.date}</td>
            <td style="padding:5px 6px;white-space:nowrap;">${esc(e.type)}</td>
            <td style="padding:5px 6px;white-space:nowrap;">${esc(e.ref)}</td>
            <td style="padding:5px 6px;text-align:right;color:#b91c1c;">${e.debit?fmtRs(e.debit):''}</td>
            <td style="padding:5px 6px;text-align:right;color:#065f46;">${e.credit?fmtRs(e.credit):''}</td>
            <td style="padding:5px 6px;text-align:right;font-weight:700;">${fmtRs(e.balance)}</td>
          </tr>
        `).join('')}
        ${!entries.length?'<tr><td colspan="6" style="padding:14px;text-align:center;color:var(--gray-500);">Abhi koi entry nahi</td></tr>':''}
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:10px 12px;border-radius:8px;background:${getPartyBalance(p)>0?'#fee2e2':'#d1fae5'};">
      <strong style="font-size:11px;">Current Balance</strong>
      <strong style="font-size:13px;color:${getPartyBalance(p)>0?'#b91c1c':'#065f46'};">${fmtRs(getPartyBalance(p))}</strong>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-gold btn-sm" onclick="downloadPartyLedgerPDF(${p.id})">📄 PDF / Share</button>
      <button class="btn btn-outline btn-sm" onclick="closeModal('partyLedgerModal')">Close</button>
    </div>
  `;
  openModal('partyLedgerModal');
}

function buildPartyLedgerPdfHTML(p, elId){
  let entries=buildPartyLedgerEntries(p);
  let balance=getPartyBalance(p);
  let rows=entries.map((e,i)=>`
    <tr style="background:${i%2===0?'#ffffff':'#f4f7fb'};">
      <td style="padding:6px 8px;border:1px solid #e2e8f0;white-space:nowrap;">${e.date}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;white-space:nowrap;">${esc(e.type)}</td>
      <td style="padding:6px 8px;border:1px solid #e2e8f0;white-space:nowrap;">${esc(e.ref)}</td>
      <td style="padding:6px 8px;text-align:right;border:1px solid #e2e8f0;white-space:nowrap;color:#b91c1c;">${e.debit?fmtRs(e.debit):''}</td>
      <td style="padding:6px 8px;text-align:right;border:1px solid #e2e8f0;white-space:nowrap;color:#065f46;">${e.credit?fmtRs(e.credit):''}</td>
      <td style="padding:6px 8px;text-align:right;border:1px solid #e2e8f0;white-space:nowrap;font-weight:700;">${fmtRs(e.balance)}</td>
    </tr>`).join('');
  return `
    <div id="${elId}" style="font-family:'Segoe UI',sans-serif;width:800px;box-sizing:border-box;margin:auto;background:#fff;color:#1a2a3a;">
      <div style="background:linear-gradient(120deg,#0f2a5a,#1a3a6a 55%,#2a5a8a);padding:24px 30px 20px;text-align:center;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-30px;left:-30px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,rgba(200,150,62,.28),transparent 70%);"></div>
        <div style="position:relative;z-index:1;">
          <h1 style="font-size:22px;margin:0;color:#fff;font-weight:800;">${esc(businessProfile.name)}</h1>
          <div style="font-size:10px;font-weight:800;color:#e8c777;letter-spacing:2.5px;margin-top:6px;">PARTY STATEMENT / DIGITAL LEDGER</div>
        </div>
      </div>
      <div style="padding:22px 30px 26px;">
      <div style="background:#f7f9fc;border-radius:10px;padding:11px 15px;margin-bottom:16px;border:1px solid #e8ecf3;">
        <p style="font-size:13px;font-weight:700;color:#1a3a6a;">${esc(p.name)}</p>
        <p style="font-size:9px;color:#6b7684;">${esc(p.phone||'')} ${getFullAddress(p)?'· 📍 '+esc(getFullAddress(p)):''}</p>
      </div>
      <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:9px;">
        <colgroup><col style="width:14%;"><col style="width:20%;"><col style="width:14%;"><col style="width:17%;"><col style="width:17%;"><col style="width:18%;"></colgroup>
        <thead><tr style="background:#1a3a6a;">
          <th style="padding:9px 8px;text-align:left;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;border-radius:6px 0 0 0;">Date</th>
          <th style="padding:9px 8px;text-align:left;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Type</th>
          <th style="padding:9px 8px;text-align:left;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Ref</th>
          <th style="padding:9px 8px;text-align:right;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Debit</th>
          <th style="padding:9px 8px;text-align:right;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;">Credit</th>
          <th style="padding:9px 8px;text-align:right;color:#fff;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:.4px;border-radius:0 6px 0 0;">Balance</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:flex;justify-content:flex-end;margin-top:16px;">
        <div style="width:260px;padding:11px 15px;border-radius:10px;background:${balance>0?'#fee2e2':'#d1fae5'};color:${balance>0?'#b91c1c':'#065f46'};display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:11px;">Current Balance</strong><strong style="font-size:14px;">${fmtRs(balance)}</strong>
        </div>
      </div>
      <div style="font-size:8px;color:#9ca7b8;margin-top:18px;text-align:center;border-top:1px solid #e8ecf3;padding-top:12px;">
        <strong style="color:#c8963e;">${esc(businessProfile.footerNote||'Thank You for Your Business 🙏')}</strong>
      </div>
      </div>
    </div>
  `;
}

function downloadPartyLedgerPDF(partyId){
  let p=getPartyById(partyId);
  if(!p){showToast('⚠️ Party not found');return;}
  let temp=document.createElement('div');
  temp.innerHTML=buildPartyLedgerPdfHTML(p,'ledgerPdfContent');
  temp.style.position='fixed';
  temp.style.left='0';
  temp.style.top='0';
  temp.style.width='800px';
  temp.style.background='#fff';
  temp.style.zIndex='150';
  temp.style.pointerEvents='none';
  document.body.appendChild(temp);
  downloadPDF('ledgerPdfContent', `Ledger_${p.name.replace(/\s+/g,'_')}.pdf`).finally(()=>temp.remove());
}

function updateKhataFilter(){
  let sel=document.getElementById('khataPartyFilter');
  if(!sel)return;
  let current=sel.value;
  sel.innerHTML=`<option value="">All Parties</option>${parties.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}`;
  if(current)sel.value=current;
}

// ════════════════════════════════════════════════════
// ──────── PRODUCTION ────────────────────────────────
// ════════════════════════════════════════════════════
function renderProduction(){
  let list=document.getElementById('productionList');
  let filter=document.getElementById('prodStatusFilter')?.value||'';
  let filtered=orders.filter(o=>!filter||o.status===filter);
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">🏭</div><p>No orders in production</p></div>';return;}
  list.innerHTML=filtered.slice().reverse().map(o=>`
    <div class="order-card">
      <div class="order-card-top">
        <div><div class="order-no">${o.orderNo}</div><div class="order-party">${getPartyName(o.partyId)}</div></div>
        <span class="status-badge ${o.status||'pending'}">${o.status||'pending'}</span>
      </div>
      <div class="order-meta">🚪 ${o.doors?.length||0} doors · ${fmtRs(o.orderTotal)}</div>
      <div class="order-footer">
        <select class="form-select" style="width:auto;font-size:8px;padding:2px 6px;" onchange="updateOrderStatus(${o.id},this.value)">
          <option value="pending" ${o.status==='pending'?'selected':''}>Pending</option>
          <option value="cutting" ${o.status==='cutting'?'selected':''}>Cutting</option>
          <option value="assembly" ${o.status==='assembly'?'selected':''}>Assembly</option>
          <option value="polishing" ${o.status==='polishing'?'selected':''}>Polishing</option>
          <option value="ready" ${o.status==='ready'?'selected':''}>Ready</option>
          <option value="delivered" ${o.status==='delivered'?'selected':''}>Delivered</option>
        </select>
        <button class="btn btn-primary btn-xs" onclick="viewOrderDetail(${o.id})">📊 Detail</button>
      </div>
    </div>
  `).join('');
}

function updateOrderStatus(id,status){
  let o=orders.find(x=>x.id===id);
  if(o){o.status=status;saveAll();renderProduction();showToast('✅ Status updated');}
}

// ════════════════════════════════════════════════════
// ──────── INVENTORY ─────────────────────────────────
// ════════════════════════════════════════════════════
function openInventoryModal(itemId){
  editingInventoryId=itemId||null;
  let i=itemId?inventory.find(x=>x.id===itemId):null;
  let body=document.getElementById('inventoryModalBody');
  body.innerHTML=`
    <div class="form-group"><label class="form-label">Item Name <span class="req">*</span></label><input class="form-input" id="invName" value="${i?esc(i.name):''}"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Quantity</label><input class="form-input" type="number" id="invQty" value="${i?i.qty:0}" step="0.01"></div>
      <div class="form-group"><label class="form-label">Unit</label><input class="form-input" id="invUnit" value="${i?esc(i.unit||'pcs'):'pcs'}"></div>
    </div>
    <div class="form-group"><label class="form-label">Category</label><input class="form-input" id="invCategory" value="${i?esc(i.category||''):''}"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Min Stock Alert</label><input class="form-input" type="number" id="invMin" value="${i?i.minStock:businessProfile.defaultLowStock||5}"></div>
      <div class="form-group"><label class="form-label">Cost per unit</label><input class="form-input" type="number" id="invCost" value="${i?i.cost:0}" step="1"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="saveInventory()">💾 Save</button>
      <button class="btn btn-outline" onclick="closeModal('inventoryModal')">Cancel</button>
    </div>
  `;
  document.getElementById('inventoryModalTitle').innerHTML=`${i?'✏️ Edit':'📦 New'} Stock Item <button class="modal-close" onclick="closeModal('inventoryModal')">✕</button>`;
  openModal('inventoryModal');
}

function saveInventory(){
  let name=document.getElementById('invName')?.value.trim();
  if(!name){showToast('⚠️ Name zaruri');return;}
  let data={name,qty:parseFloat(document.getElementById('invQty')?.value)||0,unit:document.getElementById('invUnit')?.value||'pcs',category:document.getElementById('invCategory')?.value||'',minStock:parseFloat(document.getElementById('invMin')?.value)||5,cost:parseFloat(document.getElementById('invCost')?.value)||0,updatedAt:new Date().toISOString()};
  if(editingInventoryId){
    let idx=inventory.findIndex(x=>x.id===editingInventoryId);
    if(idx>-1){inventory[idx]={...inventory[idx],...data};showToast('✅ Stock updated');}
  }else{
    data.id=newId();
    data.createdAt=new Date().toISOString();
    inventory.push(data);
    showToast('✅ Stock added');
  }
  saveAll();closeModal('inventoryModal');renderAll();
}

function renderInventory(){
  let list=document.getElementById('inventoryList');
  let q=document.getElementById('inventorySearch')?.value?.toLowerCase()||'';
  let filtered=inventory.filter(i=>i.name.toLowerCase().includes(q)||(i.category||'').toLowerCase().includes(q));
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">📦</div><p>No inventory</p></div>';return;}
  list.innerHTML=filtered.map(i=>`
    <div class="khata-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">${esc(i.name)}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-outline btn-xs" onclick="editInventory(${i.id})">✏️</button>
          <button class="btn btn-danger btn-xs" onclick="deleteInventory(${i.id})">🗑</button>
        </div>
      </div>
      <div>📦 ${i.qty} ${i.unit||'pcs'} ${i.category?'· '+esc(i.category):''}</div>
      <div style="font-size:8px;color:${i.qty<=i.minStock?'var(--red)':'var(--gray-500)'};">${i.qty<=i.minStock?'⚠️ Low stock!':'Min: '+i.minStock}</div>
    </div>
  `).join('');
}

function editInventory(id){closeModal('inventoryModal');openInventoryModal(id);}

function deleteInventory(id){
  customConfirm('Delete this stock item?',()=>{
    inventory=inventory.filter(x=>x.id!==id);
    saveAll();renderInventory();showToast('🗑 Deleted');
  });
}

// ════════════════════════════════════════════════════
// ──────── EXPENSES ──────────────────────────────────
// ════════════════════════════════════════════════════
function openExpenseModal(expenseId){
  editingExpenseId=expenseId||null;
  let e=expenseId?expenses.find(x=>x.id===expenseId):null;
  let body=document.getElementById('expenseModalBody');
  let quickOpts=QUICK_EXPENSE_ITEMS.map(item=>`<option value="${esc(item.name)}">${esc(item.name)}</option>`).join('');
  body.innerHTML=`
    <div class="form-group">
      <div class="field-label" style="margin-bottom:4px;">⚡ Quick Select</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;">
        ${QUICK_EXPENSE_ITEMS.map(item=>`<button type="button" class="btn btn-outline btn-xs" onclick="pickQuickExpense('${esc(item.name).replace(/'/g,"\\'")}','${esc(item.category).replace(/'/g,"\\'")}')">${esc(item.name)}</button>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Description <span class="req">*</span></label>
      <input class="form-input" id="expDesc" value="${e?esc(e.description):''}" list="expenseSuggestions">
      <datalist id="expenseSuggestions">${quickOpts}</datalist>
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Amount <span class="req">*</span></label><input class="form-input" type="number" id="expAmount" value="${e?e.amount:0}" step="1"></div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="expDate" value="${e?e.date:new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div class="form-group"><label class="form-label">Category</label><input class="form-input" id="expCategory" value="${e?esc(e.category||''):''}"></div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="saveExpense()">💾 Save</button>
      <button class="btn btn-outline" onclick="closeModal('expenseModal')">Cancel</button>
    </div>
  `;
  document.getElementById('expenseModalTitle').innerHTML=`${e?'✏️ Edit':'💰 New'} Kharcha <button class="modal-close" onclick="closeModal('expenseModal')">✕</button>`;
  openModal('expenseModal');
}

function pickQuickExpense(name,category){
  let descInput=document.getElementById('expDesc');
  let catInput=document.getElementById('expCategory');
  if(descInput)descInput.value=name;
  if(catInput)catInput.value=category;
  document.getElementById('expAmount')?.focus();
}

function saveExpense(){
  let desc=document.getElementById('expDesc')?.value.trim();
  let amount=parseFloat(document.getElementById('expAmount')?.value)||0;
  if(!desc){showToast('⚠️ Description zaruri');return;}
  if(amount<=0){showToast('⚠️ Amount positive hona chahiye');return;}
  let data={description:desc,amount,date:document.getElementById('expDate')?.value||new Date().toISOString().slice(0,10),category:document.getElementById('expCategory')?.value||'',updatedAt:new Date().toISOString()};
  if(editingExpenseId){
    let idx=expenses.findIndex(x=>x.id===editingExpenseId);
    if(idx>-1){expenses[idx]={...expenses[idx],...data};showToast('✅ Kharcha updated');}
  }else{
    data.id=newId();
    data.createdAt=new Date().toISOString();
    expenses.push(data);
    showToast('✅ Kharcha added');
  }
  saveAll();closeModal('expenseModal');renderAll();
}

function renderExpenses(){
  let list=document.getElementById('expensesList');
  let q=document.getElementById('expenseSearch')?.value?.toLowerCase()||'';
  let filtered=expenses.filter(e=>e.description.toLowerCase().includes(q)||(e.category||'').toLowerCase().includes(q));
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">💰</div><p>No expenses</p></div>';return;}
  let today=expenses.filter(e=>e.date===new Date().toISOString().slice(0,10));
  let month=expenses.filter(e=>e.date.startsWith(new Date().toISOString().slice(0,7)));
  document.getElementById('expenseTotalToday').textContent=fmtRs(today.reduce((s,e)=>s+e.amount,0));
  document.getElementById('expenseTotalMonth').textContent=fmtRs(month.reduce((s,e)=>s+e.amount,0));
  document.getElementById('expenseTotalAll').textContent=fmtRs(expenses.reduce((s,e)=>s+e.amount,0));

  list.innerHTML=filtered.slice().reverse().map(e=>`
    <div class="khata-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">${esc(e.description)}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-outline btn-xs" onclick="editExpense(${e.id})">✏️</button>
          <button class="btn btn-danger btn-xs" onclick="deleteExpense(${e.id})">🗑</button>
        </div>
      </div>
      <div>💰 ${fmtRs(e.amount)} · 📅 ${e.date} ${e.category?'· '+esc(e.category):''}</div>
    </div>
  `).join('');
}

function editExpense(id){closeModal('expenseModal');openExpenseModal(id);}

function deleteExpense(id){
  customConfirm('Delete this expense?',()=>{
    expenses=expenses.filter(x=>x.id!==id);
    saveAll();renderExpenses();showToast('🗑 Deleted');
  });
}

// ════════════════════════════════════════════════════
// ──────── REPORTS ───────────────────────────────────
// ════════════════════════════════════════════════════
function getAgingBucket(oldestDueDateStr){
  let days=Math.floor((Date.now()-new Date(oldestDueDateStr).getTime())/86400000);
  if(days<30)return{label:'0-29 din',color:'#0d9488',days};
  if(days<60)return{label:'30-59 din',color:'#c8963e',days};
  if(days<90)return{label:'60-89 din',color:'#db2777',days};
  return{label:'90+ din',color:'#b91c1c',days};
}

function renderAgingReport(){
  // For each party with a positive balance, find the OLDEST unpaid order date
  // (or party creation date if the balance is purely opening balance) to age it.
  let rows=[];
  parties.forEach(p=>{
    let balance=getPartyBalance(p);
    if(balance<=0)return;
    let unpaidOrders=getPartyOrders(p.id).filter(o=>(o.orderTotal-getOrderTotalPaid(o))>0);
    let oldestDate=unpaidOrders.length?unpaidOrders.reduce((min,o)=>new Date(o.date)<new Date(min)?o.date:min,unpaidOrders[0].date):(p.createdAt?p.createdAt.slice(0,10):new Date().toISOString().slice(0,10));
    let bucket=getAgingBucket(oldestDate);
    rows.push({party:p,balance,oldestDate,bucket});
  });
  rows.sort((a,b)=>b.bucket.days-a.bucket.days);
  let buckets={'0-29 din':0,'30-59 din':0,'60-89 din':0,'90+ din':0};
  rows.forEach(r=>{buckets[r.bucket.label]+=r.balance;});
  return `
    <div class="card" style="margin-top:10px;">
      <div class="card-head">⏳ Overdue Aging Report</div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-bottom:10px;">
          <div class="stat-card teal"><div class="num">${fmtRs(buckets['0-29 din'])}</div><div class="lbl">0-29 Din</div></div>
          <div class="stat-card gold"><div class="num">${fmtRs(buckets['30-59 din'])}</div><div class="lbl">30-59 Din</div></div>
          <div class="stat-card purple"><div class="num">${fmtRs(buckets['60-89 din'])}</div><div class="lbl">60-89 Din</div></div>
          <div class="stat-card red"><div class="num">${fmtRs(buckets['90+ din'])}</div><div class="lbl">90+ Din</div></div>
        </div>
        ${rows.length?rows.map(r=>`
          <div class="report-row" style="cursor:pointer;" onclick="openReceivePaymentModal(${r.party.id})">
            <span><strong>${esc(r.party.name)}</strong> <span style="background:${r.bucket.color};color:#fff;padding:1px 8px;border-radius:10px;font-size:7px;font-weight:700;margin-left:4px;">${r.bucket.label}</span></span>
            <span style="font-weight:700;color:${r.bucket.color};">${fmtRs(r.balance)}</span>
          </div>
        `).join(''):'<div class="empty-state"><p>✅ Koi party ka baqi nahi</p></div>'}
      </div>
    </div>
  `;
}

function renderReports(){
  let content=document.getElementById('reportsContent');
  let period=document.getElementById('reportPeriod')?.value||'month';
  let now=new Date();
  let filtered=orders.filter(o=>{
    let d=new Date(o.date);
    if(period==='today')return d.toDateString()===now.toDateString();
    if(period==='week'){let wk=new Date(now);wk.setDate(wk.getDate()-7);return d>=wk;}
    if(period==='month'){let mo=new Date(now);mo.setMonth(mo.getMonth()-1);return d>=mo;}
    if(period==='year'){let yr=new Date(now);yr.setFullYear(yr.getFullYear()-1);return d>=yr;}
    return true;
  });
  let totalRev=filtered.reduce((s,o)=>s+o.orderTotal,0);
  let totalWood=filtered.reduce((s,o)=>s+(o.totalWoodCft||0),0);
  let totalProfit=filtered.reduce((s,o)=>s+(o.netProfit||0),0);
  content.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-bottom:10px;">
      <div class="stat-card gold"><div class="num">${filtered.length}</div><div class="lbl">Orders</div></div>
      <div class="stat-card blue"><div class="num">${fmtRs(totalRev)}</div><div class="lbl">Revenue</div></div>
      <div class="stat-card orange"><div class="num">${totalWood.toFixed(1)}</div><div class="lbl">Wood (cft)</div></div>
      <div class="stat-card green"><div class="num">${fmtRs(totalProfit)}</div><div class="lbl">Net Profit</div></div>
    </div>
    <div style="font-size:9px;font-weight:700;margin-bottom:4px;">📋 Order-wise Report</div>
    ${filtered.length?filtered.slice().reverse().map(o=>`
      <div class="report-row">
        <span><strong>${o.orderNo}</strong> ${getPartyName(o.partyId)}</span>
        <span>💰 ${fmtRs(o.orderTotal)} · 🪵 ${(o.totalWoodCft||0).toFixed(1)} · 💵 ${fmtRs(o.netProfit||0)}</span>
      </div>
    `).join(''):'<div class="empty-state"><p>No orders for this period</p></div>'}
    ${renderAgingReport()}
  `;
}

// ════════════════════════════════════════════════════
// ──────── RECYCLE BIN ──────────────────────────────
// ════════════════════════════════════════════════════
function renderRecycleBin(){
  let list=document.getElementById('recycleList');
  if(!deletedItems.length){list.innerHTML='<div class="empty-state"><div class="e-icon">♻️</div><p>Bin empty</p></div>';return;}
  list.innerHTML=deletedItems.map((item,i)=>`
    <div class="khata-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>${item.type==='order'?`📋 ${item.data.orderNo||'Order'}`:'🗑 Item'}</span>
        <button class="btn btn-outline btn-xs" onclick="restoreItem(${i})">↩️ Restore</button>
      </div>
      <div style="font-size:8px;color:var(--gray-500);">Deleted: ${item.deletedAt||''}</div>
    </div>
  `).join('');
}

function restoreItem(idx){
  let item=deletedItems[idx];
  if(!item)return;
  if(item.type==='order'){orders.push(item.data);}
  deletedItems.splice(idx,1);
  saveAll();renderRecycleBin();renderAll();showToast('↩️ Restored');
}

function emptyRecycleBin(){
  customConfirm('Empty recycle bin? This is permanent!',()=>{
    deletedItems=[];
    saveAll();renderRecycleBin();showToast('🗑 Bin emptied');
  },{danger:true});
}

// ════════════════════════════════════════════════════
// ──────── SETTINGS ──────────────────────────────────
// ════════════════════════════════════════════════════
function openSettingsModal(){
  let body=document.getElementById('settingsContent');
  body.innerHTML=`
    <div style="font-size:12px;font-weight:700;margin-bottom:6px;">🏢 Business Profile</div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Company Name</label><input class="form-input" id="setName" value="${esc(businessProfile.name)}"></div>
      <div class="form-group"><label class="form-label">Brand Name</label><input class="form-input" id="setBrand" value="${esc(businessProfile.brandName||'')}"></div>
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="setPhone" value="${esc(businessProfile.phone||'')}"></div>
      <div class="form-group"><label class="form-label">WhatsApp</label><input class="form-input" id="setWhatsapp" value="${esc(businessProfile.whatsapp||'')}"></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="setAddress" value="${esc(businessProfile.address||'')}"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">City</label><input class="form-input" id="setCity" value="${esc(businessProfile.city||'')}"></div>
      <div class="form-group"><label class="form-label">NTN</label><input class="form-input" id="setNtn" value="${esc(businessProfile.ntn||'')}"></div>
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Bank Name</label><input class="form-input" id="setBank" value="${esc(businessProfile.bankName||'')}"></div>
      <div class="form-group"><label class="form-label">Account #</label><input class="form-input" id="setAccount" value="${esc(businessProfile.bankAccount||'')}"></div>
    </div>
    <div class="form-group"><label class="form-label">Invoice Prefix</label><input class="form-input" id="setPrefix" value="${esc(businessProfile.invoicePrefix||'ORD-')}"></div>
    <div class="form-group"><label class="form-label">Footer Note</label><input class="form-input" id="setFooter" value="${esc(businessProfile.footerNote||'Thank You')}"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Invoice Due Days</label><input class="form-input" type="number" id="setDueDays" value="${businessProfile.invoiceDueDays||7}"></div>
      <div class="form-group"><label class="form-label">Default Thickness (in)</label><input class="form-input" type="number" id="setThickness" value="${defaultThickness}" step="0.1"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Theme</label>
      <div class="theme-swatch-grid" id="themeSwatchGrid"></div>
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Currency</label><input class="form-input" id="setCurrency" value="${businessProfile.currency||'Rs.'}"></div>
      <div class="form-group"></div>
    </div>

    <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;">🪵 Wood Types</div>
      <div id="settingsWoodTypesArea">${woodTypes.map((w,i)=>`
        <div style="display:flex;gap:4px;margin-bottom:4px;align-items:center;">
          <input class="form-input" style="flex:2;" id="woodName_${i}" value="${esc(w.name)}">
          <input class="form-input" style="flex:1;" type="number" id="woodRate_${i}" value="${w.rate}" step="1">
          <button class="btn btn-danger btn-xs" onclick="removeWoodType(${i})">✕</button>
        </div>
      `).join('')}</div>
      <div style="display:flex;gap:4px;margin-top:4px;">
        <input class="form-input" id="newWoodName" placeholder="New wood name" style="flex:2;">
        <input class="form-input" type="number" id="newWoodRate" placeholder="Rate" style="flex:1;" step="1">
        <button class="btn btn-primary btn-sm" onclick="addWoodType()">+</button>
      </div>
    </div>

    <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px;">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;">🛡️ Data Backup (hamesha ke liye safe)</div>
      <p style="font-size:8px;color:var(--gray-500);margin-bottom:8px;">Browser ka storage kabhi bhi saaf ho sakta hai (app uninstall, cache clear, naya phone). Har hafte ek backup file download kar ke Drive/WhatsApp pe khud ko bhej dein — data hamesha wapis aa sakega.</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-gold btn-sm" onclick="exportBackup()">⬇️ Backup Download Karein</button>
        <button class="btn btn-outline btn-sm" onclick="document.getElementById('restoreFileInput').click()">⬆️ Backup Restore Karein</button>
        <input type="file" id="restoreFileInput" accept="application/json" style="display:none;" onchange="importBackup(this.files[0])">
      </div>
    </div>

    <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="saveSettings()">💾 Save Settings</button>
      <button class="btn btn-outline" onclick="closeModal('settingsModal')">Close</button>
      <button class="btn btn-danger" onclick="resetAllData()">⚠️ Reset All Data</button>
    </div>
  `;
  openModal('settingsModal');
  renderThemeSwatches();
}

function resetAllData() {
  customConfirm('⚠️ Are you sure you want to DELETE ALL DATA? This cannot be undone!', () => {
    localStorage.clear();
    // Auto-backups are kept on purpose so a reset by mistake can still be undone.
    let done=()=>location.reload();
    if(window.HKStore&&HKStore.ok){Promise.all([HKStore.del('ww_data'),HKStore.del('ww_sync_base')]).then(done,done);}
    else done();
  }, { danger: true, okText: 'DELETE ALL' });
}

function exportBackup(){
  try{
    let snapshot=getDataSnapshot();
    let payload={
      app:'HK Wood Doors ERP',
      exportedAt:new Date().toISOString(),
      version:1,
      data:snapshot
    };
    let json=JSON.stringify(payload,null,2);
    let blob=new Blob([json],{type:'application/json'});
    let a=document.createElement('a');
    let stamp=new Date().toISOString().slice(0,10);
    a.href=URL.createObjectURL(blob);
    a.download=`HK_Wood_Doors_Backup_${stamp}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    try{localStorage.setItem('ww_last_backup',new Date().toISOString());}catch(e){}
    showToast('✅ Backup download ho gaya — isay Drive/WhatsApp pe save kar lein');
  }catch(e){
    showToast('⚠️ Backup fail: '+e.message);
  }
}

function checkBackupReminder(){
  try{
    if(!orders.length && !parties.length)return; // nothing to protect yet
    let last=localStorage.getItem('ww_last_backup');
    let daysSince=last?(Date.now()-new Date(last).getTime())/86400000:999;
    if(daysSince>=7){
      setTimeout(()=>showToast('🛡️ Reminder: Settings mein jaake ek naya data Backup le lein'),2500);
    }
  }catch(e){}
}

function importBackup(file){
  if(!file){return;}
  let reader=new FileReader();
  reader.onload=function(e){
    try{
      let parsed=JSON.parse(e.target.result);
      let data=parsed.data||parsed; // support raw snapshot too
      if(!data||typeof data!=='object'){throw new Error('Invalid backup file');}
      customConfirm('Yeh backup restore karne se maujooda data overwrite ho jayega. Aage badhein?',()=>{
        applyData(data);
        saveAll();
        updateKhataFilter();
        renderAll();
        updateUserBadge();
        closeModal('settingsModal');
        showToast('✅ Backup restore ho gaya');
      },{title:'⚠️ Restore Backup',okText:'Restore Karein'});
    }catch(err){
      showToast('⚠️ Backup file sahi nahi: '+err.message);
    }
    document.getElementById('restoreFileInput').value='';
  };
  reader.onerror=function(){showToast('⚠️ File read nahi ho saki');};
  reader.readAsText(file);
}

function addWoodType(){
  let name=document.getElementById('newWoodName')?.value.trim();
  let rate=parseFloat(document.getElementById('newWoodRate')?.value)||0;
  if(!name||rate<=0){showToast('⚠️ Name and rate zaruri');return;}
  woodTypes.push({id:newId(),name,rate});
  saveAll();
  openSettingsModal();
}

function removeWoodType(idx){
  if(woodTypes.length<=1){showToast('⚠️ Kam se kam 1 wood type hona chahiye');return;}
  woodTypes.splice(idx,1);
  saveAll();
  openSettingsModal();
}

function saveSettings(){
  businessProfile.name=document.getElementById('setName')?.value||'HK WOOD DOORS';
  businessProfile.brandName=document.getElementById('setBrand')?.value||'';
  businessProfile.phone=document.getElementById('setPhone')?.value||'';
  businessProfile.whatsapp=document.getElementById('setWhatsapp')?.value||'';
  businessProfile.address=document.getElementById('setAddress')?.value||'';
  businessProfile.city=document.getElementById('setCity')?.value||'';
  businessProfile.ntn=document.getElementById('setNtn')?.value||'';
  businessProfile.bankName=document.getElementById('setBank')?.value||'';
  businessProfile.bankAccount=document.getElementById('setAccount')?.value||'';
  businessProfile.invoicePrefix=document.getElementById('setPrefix')?.value||'ORD-';
  businessProfile.footerNote=document.getElementById('setFooter')?.value||'Thank You';
  businessProfile.invoiceDueDays=parseInt(document.getElementById('setDueDays')?.value)||7;
  businessProfile.currency=document.getElementById('setCurrency')?.value||'Rs.';
  woodTypes.forEach((w,i)=>{
    let nameInput=document.getElementById(`woodName_${i}`);
    let rateInput=document.getElementById(`woodRate_${i}`);
    if(nameInput)w.name=nameInput.value.trim()||w.name;
    if(rateInput)w.rate=parseFloat(rateInput.value)||w.rate;
  });
  let th=parseFloat(document.getElementById('setThickness')?.value);
  if(th>0)defaultThickness=th;
  applyBusinessProfileToUI();
  saveAll();
  showToast('✅ Settings saved');
  closeModal('settingsModal');
  renderAll();
}

// ─── REMINDERS ──────────────────────────────────────
// ─── CHEQUE TRACKER ───
function openChequeListModal(){
  renderChequeListModalBody();
  openModal('chequeListModal');
}

function renderChequeListModalBody(){
  let body=document.getElementById('chequeListModalBody');
  let today=new Date().toISOString().slice(0,10);
  let sorted=[...cheques].sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  let pending=sorted.filter(c=>c.status==='pending');
  let settled=sorted.filter(c=>c.status!=='pending');

  function rowHtml(c){
    let daysLeft=Math.ceil((new Date(c.dueDate)-new Date(today))/86400000);
    let urgencyBg=c.status!=='pending'?null:(daysLeft<0?'#fee2e2':daysLeft<=3?'#fef3c7':null);
    let urgencyText=c.status!=='pending'?'':(daysLeft<0?`⚠️ ${Math.abs(daysLeft)} din late`:daysLeft===0?'📅 Aaj':daysLeft<=3?`⏰ ${daysLeft} din baqi`:'');
    let who=c.type==='received'?getPartyName(c.partyId):(c.recipientName||'');
    let statusBadge=c.status==='cleared'?'<span style="color:var(--green-700);font-weight:700;">✅ Cleared</span>':c.status==='bounced'?'<span style="color:var(--red);font-weight:700;">❌ Bounced</span>':'';
    return `<div class="karigar-row" style="${urgencyBg?`background:${urgencyBg};`:''}">
      <div class="karigar-row-head">
        <span style="font-weight:700;">${c.type==='received'?'⬇️':'⬆️'} ${esc(who)}</span>
        <span style="font-weight:800;">${fmtRs(c.amount)}</span>
      </div>
      <div style="font-size:8px;color:var(--gray-500);margin-bottom:4px;">#${esc(c.chequeNo||'—')} · ${esc(c.bankName||'—')} · Due: ${c.dueDate}${urgencyText?' · '+urgencyText:''}${statusBadge?' · '+statusBadge:''}</div>
      ${c.note?`<div style="font-size:8px;color:var(--gray-500);margin-bottom:4px;">${esc(c.note)}</div>`:''}
      ${c.status==='pending'?`
      <div style="display:flex;gap:5px;flex-wrap:wrap;">
        <button class="btn btn-success btn-xs" onclick="markChequeCleared(${c.id})">✅ Clear Ho Gaya</button>
        <button class="btn btn-outline btn-xs" onclick="markChequeBounced(${c.id})">❌ Bounce Hua</button>
        <button class="btn btn-outline btn-xs" onclick="openChequeModal(${c.id})">✏️ Edit</button>
        <button class="btn btn-danger btn-xs" onclick="deleteCheque(${c.id})">🗑</button>
      </div>`:`
      <button class="btn btn-danger btn-xs" onclick="deleteCheque(${c.id})">🗑 Delete Record</button>`}
    </div>`;
  }

  body.innerHTML=`
    <button class="btn btn-primary" style="width:100%;margin-bottom:10px;" onclick="openChequeModal()">➕ Nayi Cheque Add Karein</button>
    ${pending.length?`<div style="font-size:9px;font-weight:700;margin-bottom:6px;">📋 Pending (${pending.length})</div>${pending.map(rowHtml).join('')}`:'<div class="empty-state"><p>Koi pending cheque nahi</p></div>'}
    ${settled.length?`<div style="font-size:9px;font-weight:700;margin:14px 0 6px;">📜 History</div>${settled.map(rowHtml).join('')}`:''}
  `;
}

function openChequeModal(id){
  editingChequeId=id||null;
  let c=id?cheques.find(x=>x.id===id):null;
  _chequeFormType=c?c.type:'received';
  document.getElementById('chequeModalTitle').innerHTML=(id?'✏️ Cheque Edit Karein':'🧾 Nayi Cheque')+' <button class="modal-close" onclick="closeModal(\'chequeModal\')">✕</button>';
  renderChequeModalBody();
  openModal('chequeModal');
}

function setChequeFormType(t){
  _chequeFormType=t;
  renderChequeModalBody();
}

function renderChequeModalBody(){
  let c=editingChequeId?cheques.find(x=>x.id===editingChequeId):null;
  let type=_chequeFormType;
  let body=document.getElementById('chequeModalBody');
  body.innerHTML=`
    <div class="form-group">
      <label class="form-label">Type</label>
      <div style="display:flex;gap:6px;">
        <button type="button" class="btn ${type==='received'?'btn-primary':'btn-outline'}" style="flex:1;" onclick="setChequeFormType('received')">⬇️ Party se Mili</button>
        <button type="button" class="btn ${type==='issued'?'btn-primary':'btn-outline'}" style="flex:1;" onclick="setChequeFormType('issued')">⬆️ Humne Di</button>
      </div>
    </div>
    ${type==='received'?`
    <div class="form-group"><label class="form-label">Party</label>
      <select class="form-select" id="chequePartyId">${parties.map(p=>`<option value="${p.id}" ${c&&c.partyId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
    </div>`:`
    <div class="form-group"><label class="form-label">Kis Ko Di (Supplier/Naam)</label>
      <input class="form-input" id="chequeRecipientName" list="chequeSupplierNames" value="${esc(c&&c.recipientName||'')}" placeholder="Supplier ka naam">
      <datalist id="chequeSupplierNames">${suppliers.map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist>
    </div>`}
    <div class="row-2">
      <div class="form-group"><label class="form-label">Cheque Number</label><input class="form-input" id="chequeNo" value="${esc(c&&c.chequeNo||'')}"></div>
      <div class="form-group"><label class="form-label">Bank Naam</label><input class="form-input" id="chequeBankName" value="${esc(c&&c.bankName||'')}"></div>
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Amount</label><input class="form-input" type="number" id="chequeAmount" value="${c?c.amount:''}" step="1"></div>
      <div class="form-group"><label class="form-label">Due Date (Cash Karne Ki Tareekh)</label><input class="form-input" type="date" id="chequeDueDate" value="${c?c.dueDate:new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div class="form-group"><label class="form-label">Note</label><input class="form-input" id="chequeNote" value="${esc(c&&c.note||'')}" placeholder="Optional"></div>
    <div style="display:flex;gap:6px;">
      <button class="btn btn-primary" onclick="saveCheque()">💾 Save Karein</button>
      <button class="btn btn-outline" onclick="closeModal('chequeModal')">Cancel</button>
    </div>
  `;
}

function saveCheque(){
  let type=_chequeFormType;
  let amount=parseFloat(document.getElementById('chequeAmount')?.value)||0;
  let dueDate=document.getElementById('chequeDueDate')?.value;
  if(amount<=0){showToast('⚠️ Amount zaruri hai');return;}
  if(!dueDate){showToast('⚠️ Due date zaruri hai');return;}
  let data={type,chequeNo:document.getElementById('chequeNo')?.value||'',bankName:document.getElementById('chequeBankName')?.value||'',amount,dueDate,note:document.getElementById('chequeNote')?.value||''};
  if(type==='received'){
    data.partyId=parseInt(document.getElementById('chequePartyId')?.value)||null;
    if(!data.partyId){showToast('⚠️ Party select karein');return;}
  }else{
    data.recipientName=document.getElementById('chequeRecipientName')?.value.trim()||'';
    if(!data.recipientName){showToast('⚠️ Naam likhein');return;}
  }
  if(editingChequeId){
    let idx=cheques.findIndex(x=>x.id===editingChequeId);
    if(idx>-1)cheques[idx]={...cheques[idx],...data};
  }else{
    data.id=newId();
    data.status='pending';
    data.createdAt=new Date().toISOString();
    cheques.push(data);
  }
  saveAll();
  closeModal('chequeModal');
  renderChequeListModalBody();
  showToast('✅ Cheque save ho gayi');
}

function markChequeCleared(id){
  let c=cheques.find(x=>x.id===id);
  if(!c)return;
  customConfirm('Yeh cheque clear/cash ho gayi hai? Iska asar Khata aur Bank Book pe turant hoga.',()=>{
    let date=new Date().toISOString().slice(0,10);
    if(c.type==='received'){
      let p=getPartyById(c.partyId);
      if(!p){showToast('⚠️ Party nahi mili');return;}
      let remaining=c.amount,allocation=[];
      let pOrders=getPartyOrders(p.id).filter(o=>(o.orderTotal-getOrderTotalPaid(o))>0).sort((a,b)=>new Date(a.date)-new Date(b.date));
      for(let o of pOrders){
        if(remaining<=0)break;
        let due=o.orderTotal-getOrderTotalPaid(o);
        let applyAmt=Math.min(due,remaining);
        if(!o.payments)o.payments=[];
        let bankTxId=newId();
        bankTransactions.push({id:bankTxId,type:'deposit',account:c.bankName||'Bank',amount:applyAmt,date,description:`Cheque #${c.chequeNo||''} from ${p.name} (${o.orderNo})`,createdAt:new Date().toISOString()});
        o.payments.push({id:Date.now()+Math.floor(Math.random()*1000),amount:applyAmt,date,method:'Cheque · '+(c.bankName||''),note:c.note||'',user:activeUserId,bankTxId});
        allocation.push({label:o.orderNo,amount:applyAmt,fullySettled:applyAmt>=due});
        remaining-=applyAmt;
      }
      if(remaining>0){
        if(!p.partyPayments)p.partyPayments=[];
        let bankTxId=newId();
        bankTransactions.push({id:bankTxId,type:'deposit',account:c.bankName||'Bank',amount:remaining,date,description:`Cheque #${c.chequeNo||''} from ${p.name} (Opening Balance)`,createdAt:new Date().toISOString()});
        p.partyPayments.push({id:Date.now(),amount:remaining,date,method:'Cheque · '+(c.bankName||''),note:c.note||'',bankTxId});
        allocation.push({label:'Opening Balance / Purani Baqi',amount:remaining,fullySettled:getPartyBalance(p)<=0});
      }
      c.status='cleared';
      c.clearedDate=date;
      saveAll();
      renderChequeListModalBody();
      renderAll();
      showPaymentReceipt(p,c.amount,date,'Cheque · '+(c.bankName||''),allocation);
    }else{
      let bankTxId=newId();
      bankTransactions.push({id:bankTxId,type:'withdrawal',account:c.bankName||'Bank',amount:c.amount,date,description:`Cheque #${c.chequeNo||''} paid to ${c.recipientName||''}`,createdAt:new Date().toISOString()});
      c.status='cleared';
      c.clearedDate=date;
      c.bankTxId=bankTxId;
      saveAll();
      renderChequeListModalBody();
      renderAll();
      showToast(`✅ Cheque clear ho gayi — ${fmtRs(c.amount)} bank se nikal gaye`);
    }
  },{title:'✅ Cheque Clear Karein?',okText:'Haan, Clear Ho Gayi',danger:false});
}

function markChequeBounced(id){
  let c=cheques.find(x=>x.id===id);
  if(!c)return;
  customConfirm('Yeh cheque bounce/wapas ho gayi hai? Party abhi bhi yeh raqam owe karti hai — Khata mein koi tabdeeli nahi hogi, sirf status update hoga.',()=>{
    c.status='bounced';
    saveAll();
    renderChequeListModalBody();
    showToast('⚠️ Cheque bounced mark ho gayi');
  },{title:'❌ Cheque Bounce Hui?',okText:'Haan, Bounce Hui'});
}

function deleteCheque(id){
  customConfirm('Yeh cheque record delete karna chahte hain?',()=>{
    let idx=cheques.findIndex(x=>x.id===id);
    if(idx>-1)cheques.splice(idx,1);
    saveAll();
    renderChequeListModalBody();
    showToast('🗑 Cheque delete ho gayi');
  },{title:'🗑 Delete Karein?',okText:'Delete Karein'});
}

function openReminderCenter(){
  let body=document.getElementById('reminderModalBody');
  let today=new Date().toISOString().slice(0,10);
  let overdueOrders=orders.filter(o=>{
    let bal=o.orderTotal-getOrderTotalPaid(o);
    return bal>0 && o.date<today;
  }).slice(0,20);
  let dueCheques=cheques.filter(c=>c.status==='pending'&&c.dueDate<=new Date(Date.now()+3*86400000).toISOString().slice(0,10)).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
  body.innerHTML=`
    <div style="font-size:12px;font-weight:700;">🔔 Payment Reminders</div>
    ${overdueOrders.length?overdueOrders.map(o=>`
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:9px;align-items:center;">
        <span><strong>${o.orderNo}</strong> ${getPartyName(o.partyId)}</span>
        <span style="color:var(--red);">${fmtRs(o.orderTotal-getOrderTotalPaid(o))} due</span>
        <button class="btn btn-primary btn-xs" onclick="closeModal('reminderModal');openPaymentModal(${o.id})">Pay</button>
      </div>
    `).join(''):'<div class="empty-state"><p>✅ No overdue payments</p></div>'}
    <div style="font-size:12px;font-weight:700;margin-top:14px;">🧾 Cheques (aaj se agle 3 din / overdue)</div>
    ${dueCheques.length?dueCheques.map(c=>{
      let late=c.dueDate<today;
      return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:9px;align-items:center;">
        <span>${c.type==='received'?'⬇️':'⬆️'} <strong>${esc(c.type==='received'?getPartyName(c.partyId):c.recipientName)}</strong> · ${c.dueDate}</span>
        <span style="color:${late?'var(--red)':'#b45309'};">${fmtRs(c.amount)}</span>
        <button class="btn btn-primary btn-xs" onclick="closeModal('reminderModal');openChequeListModal()">Dekhein</button>
      </div>`;
    }).join(''):'<div class="empty-state"><p>✅ Koi cheque due nahi</p></div>'}
  `;
  openModal('reminderModal');
}

// ─── BANK TRANSACTIONS ─────────────────────────────
function openBankTransactionModal(txId){
  editingBankTransactionId=txId||null;
  let t=txId?bankTransactions.find(x=>x.id===txId):null;
  let body=document.getElementById('bankTransactionModalBody');
  body.innerHTML=`
    <div class="row-2">
      <div class="form-group"><label class="form-label">Type</label><select class="form-select" id="bankTxType"><option value="deposit" ${t&&t.type==='deposit'?'selected':''}>Deposit</option><option value="withdrawal" ${t&&t.type==='withdrawal'?'selected':''}>Withdrawal</option></select></div>
      <div class="form-group"><label class="form-label">Account</label><select class="form-select" id="bankAccount">${BANK_ACCOUNTS.map(a=>`<option value="${a}" ${t&&t.account===a?'selected':''}>${a}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Amount <span class="req">*</span></label><input class="form-input" type="number" id="bankAmount" value="${t?t.amount:0}" step="1"></div>
    <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="bankDate" value="${t?t.date:new Date().toISOString().slice(0,10)}"></div>
    <div class="form-group"><label class="form-label">Description</label><input class="form-input" id="bankDesc" value="${t?esc(t.description||''):''}"></div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="saveBankTransaction()">💾 Save</button>
      <button class="btn btn-outline" onclick="closeModal('bankTransactionModal')">Cancel</button>
    </div>
  `;
  document.getElementById('bankModalTitle').innerHTML=`${t?'✏️ Edit':'🏦 New'} Transaction <button class="modal-close" onclick="closeModal('bankTransactionModal')">✕</button>`;
  openModal('bankTransactionModal');
}

function saveBankTransaction(){
  let amount=parseFloat(document.getElementById('bankAmount')?.value)||0;
  if(amount<=0){showToast('⚠️ Amount positive hona chahiye');return;}
  let data={type:document.getElementById('bankTxType')?.value||'deposit',account:document.getElementById('bankAccount')?.value||'Cash',amount,date:document.getElementById('bankDate')?.value||new Date().toISOString().slice(0,10),description:document.getElementById('bankDesc')?.value||'',updatedAt:new Date().toISOString()};
  if(editingBankTransactionId){
    let idx=bankTransactions.findIndex(x=>x.id===editingBankTransactionId);
    if(idx>-1){bankTransactions[idx]={...bankTransactions[idx],...data};showToast('✅ Transaction updated');}
  }else{
    data.id=newId();
    data.createdAt=new Date().toISOString();
    bankTransactions.push(data);
    showToast('✅ Transaction added');
  }
  saveAll();closeModal('bankTransactionModal');renderAll();
}

function renderBankBook(){
  let list=document.getElementById('bankBookList');
  let q=document.getElementById('bankSearch')?.value?.toLowerCase()||'';
  let filtered=bankTransactions.filter(t=>(t.description||'').toLowerCase().includes(q)||t.account.toLowerCase().includes(q));
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">🏦</div><p>No transactions</p></div>';return;}
  let cash=bankTransactions.filter(t=>t.account==='Cash');
  let bank=bankTransactions.filter(t=>t.account!=='Cash');
  let cashBal=cash.reduce((s,t)=>s+(t.type==='deposit'?t.amount:-t.amount),0);
  let bankBal=bank.reduce((s,t)=>s+(t.type==='deposit'?t.amount:-t.amount),0);
  document.getElementById('bankTotalCash').textContent=fmtRs(cashBal);
  document.getElementById('bankTotalBank').textContent=fmtRs(bankBal);
  document.getElementById('bankTotalAll').textContent=fmtRs(cashBal+bankBal);

  list.innerHTML=filtered.slice().reverse().map(t=>`
    <div class="khata-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">${t.type==='deposit'?'📥':'📤'} ${t.account}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-outline btn-xs" onclick="editBankTransaction(${t.id})">✏️</button>
          <button class="btn btn-danger btn-xs" onclick="deleteBankTransaction(${t.id})">🗑</button>
        </div>
      </div>
      <div>${t.type==='deposit'?'+':'-'} ${fmtRs(t.amount)} · ${t.date} ${t.description?'· '+esc(t.description):''}</div>
    </div>
  `).join('');
}

function editBankTransaction(id){closeModal('bankTransactionModal');openBankTransactionModal(id);}

function deleteBankTransaction(id){
  customConfirm('Delete this transaction?',()=>{
    bankTransactions=bankTransactions.filter(x=>x.id!==id);
    saveAll();renderBankBook();showToast('🗑 Deleted');
  });
}

// ─── PURCHASES ──────────────────────────────────────
function openPurchaseModal(purchaseId){
  editingPurchaseId=purchaseId||null;
  let p=purchaseId?purchases.find(x=>x.id===purchaseId):null;
  let body=document.getElementById('purchaseModalBody');
  body.innerHTML=`
    <div class="form-group"><label class="form-label">Supplier</label><select class="form-select" id="purchaseSupplier">${suppliers.map(s=>`<option value="${s.id}" ${p&&p.supplierId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}${!suppliers.length?'<option value="">No suppliers — add first</option>':''}</select></div>
    <div class="form-group"><label class="form-label">Item</label><input class="form-input" id="purchaseItem" value="${p?esc(p.item):''}" placeholder="e.g. Pertal Wood ya Peecha/Screws"></div>
    <div class="form-group"><label class="form-label">🪵 Wood Stock Mein Jama Karein (agar yeh wood hai)</label>
      <select class="form-select" id="purchaseWoodType" onchange="onPurchaseWoodTypeChange()">
        <option value="">-- Wood Nahi Hai --</option>
        ${woodTypes.map(w=>`<option value="${w.id}" ${p&&p.woodTypeId===w.id?'selected':''}>${esc(w.name)}</option>`).join('')}
      </select>
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Qty <span id="purchaseQtyHint" style="font-size:8px;color:var(--gray-500);"></span></label><input class="form-input" type="number" id="purchaseQty" value="${p?p.qty:0}" step="0.01"></div>
      <div class="form-group"><label class="form-label">Unit</label><input class="form-input" id="purchaseUnit" value="${p?esc(p.unit||'pcs'):'pcs'}"></div>
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Rate</label><input class="form-input" type="number" id="purchaseRate" value="${p?p.rate:0}" step="1"></div>
      <div class="form-group"><label class="form-label">Date</label><input class="form-input" type="date" id="purchaseDate" value="${p?p.date:new Date().toISOString().slice(0,10)}"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="savePurchase()">💾 Save</button>
      <button class="btn btn-outline" onclick="closeModal('purchaseModal')">Cancel</button>
    </div>
  `;
  document.getElementById('purchaseModalTitle').innerHTML=`${p?'✏️ Edit':'🛒 New'} Purchase <button class="modal-close" onclick="closeModal('purchaseModal')">✕</button>`;
  openModal('purchaseModal');
  onPurchaseWoodTypeChange();
}

function onPurchaseWoodTypeChange(){
  let woodTypeId=document.getElementById('purchaseWoodType')?.value;
  let hint=document.getElementById('purchaseQtyHint');
  let unitInput=document.getElementById('purchaseUnit');
  if(hint)hint.textContent=woodTypeId?'(CFT mein likhein)':'';
  if(woodTypeId&&unitInput&&!unitInput.value.trim())unitInput.value='cft';
}

function savePurchase(){
  let supplierId=document.getElementById('purchaseSupplier')?.value;
  let item=document.getElementById('purchaseItem')?.value.trim();
  if(!supplierId||!item){showToast('⚠️ Supplier and item zaruri');return;}
  let woodTypeId=document.getElementById('purchaseWoodType')?.value;
  let data={supplierId:parseInt(supplierId),item,woodTypeId:woodTypeId?parseInt(woodTypeId):null,qty:parseFloat(document.getElementById('purchaseQty')?.value)||0,unit:document.getElementById('purchaseUnit')?.value||'pcs',rate:parseFloat(document.getElementById('purchaseRate')?.value)||0,date:document.getElementById('purchaseDate')?.value||new Date().toISOString().slice(0,10),updatedAt:new Date().toISOString()};
  if(editingPurchaseId){
    let idx=purchases.findIndex(x=>x.id===editingPurchaseId);
    if(idx>-1){purchases[idx]={...purchases[idx],...data};showToast('✅ Purchase updated');}
  }else{
    data.id=newId();
    data.createdAt=new Date().toISOString();
    purchaseCounter++;
    data.purchaseNo='PUR-'+purchaseCounter;
    purchases.push(data);
    showToast(woodTypeId?'✅ Purchase add ho gaya — Wood Stock update ho gaya':'✅ Purchase added');
  }
  saveAll();closeModal('purchaseModal');renderAll();
}

function renderPurchases(){
  let list=document.getElementById('purchasesList');
  let q=document.getElementById('purchaseSearch')?.value?.toLowerCase()||'';
  let filtered=purchases.filter(p=>(p.item||'').toLowerCase().includes(q)||getSupplierName(p.supplierId).toLowerCase().includes(q));
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">🛒</div><p>No purchases</p></div>';return;}
  list.innerHTML=filtered.slice().reverse().map(p=>`
    <div class="khata-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">${esc(p.item)}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-outline btn-xs" onclick="editPurchase(${p.id})">✏️</button>
          <button class="btn btn-danger btn-xs" onclick="deletePurchase(${p.id})">🗑</button>
        </div>
      </div>
      <div>${getSupplierName(p.supplierId)} · ${p.qty} ${p.unit||'pcs'} @ ${fmtRs(p.rate)} = ${fmtRs(p.qty*p.rate)}</div>
      <div style="font-size:8px;color:var(--gray-500);">${p.date}</div>
    </div>
  `).join('');
}

function editPurchase(id){closeModal('purchaseModal');openPurchaseModal(id);}

function deletePurchase(id){
  customConfirm('Delete this purchase?',()=>{
    purchases=purchases.filter(x=>x.id!==id);
    saveAll();renderPurchases();showToast('🗑 Deleted');
  });
}

// ─── SUPPLIERS ──────────────────────────────────────
function openSupplierModal(supplierId){
  editingSupplierId=supplierId||null;
  let s=supplierId?suppliers.find(x=>x.id===supplierId):null;
  let body=document.getElementById('supplierModalBody');
  body.innerHTML=`
    <div class="form-group"><label class="form-label">Name <span class="req">*</span></label><input class="form-input" id="supName" value="${s?esc(s.name):''}"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="supPhone" value="${s?esc(s.phone||''):''}"></div>
      <div class="form-group"><label class="form-label">Category</label><input class="form-input" id="supCategory" value="${s?esc(s.category||''):''}"></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="supAddress" value="${s?esc(s.address||''):''}"></div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="saveSupplier()">💾 Save</button>
      <button class="btn btn-outline" onclick="closeModal('supplierModal')">Cancel</button>
    </div>
  `;
  document.getElementById('supplierModalTitle').innerHTML=`${s?'✏️ Edit':'🏪 New'} Supplier <button class="modal-close" onclick="closeModal('supplierModal')">✕</button>`;
  openModal('supplierModal');
}

function saveSupplier(){
  let name=document.getElementById('supName')?.value.trim();
  if(!name){showToast('⚠️ Name zaruri');return;}
  let data={name,phone:document.getElementById('supPhone')?.value||'',category:document.getElementById('supCategory')?.value||'',address:document.getElementById('supAddress')?.value||'',updatedAt:new Date().toISOString()};
  if(editingSupplierId){
    let idx=suppliers.findIndex(x=>x.id===editingSupplierId);
    if(idx>-1){suppliers[idx]={...suppliers[idx],...data};showToast('✅ Supplier updated');}
  }else{
    data.id=newId();
    data.createdAt=new Date().toISOString();
    suppliers.push(data);
    showToast('✅ Supplier added');
  }
  saveAll();closeModal('supplierModal');renderAll();
}

function renderSuppliers(){
  let list=document.getElementById('suppliersList');
  let q=document.getElementById('supplierSearch')?.value?.toLowerCase()||'';
  let filtered=suppliers.filter(s=>s.name.toLowerCase().includes(q)||(s.phone||'').includes(q));
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="e-icon">🏪</div><p>No suppliers</p></div>';return;}
  list.innerHTML=filtered.map(s=>`
    <div class="khata-card">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">${esc(s.name)}</span>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-outline btn-xs" onclick="editSupplier(${s.id})">✏️</button>
          <button class="btn btn-danger btn-xs" onclick="deleteSupplier(${s.id})">🗑</button>
        </div>
      </div>
      <div style="font-size:9px;color:var(--gray-500);">${s.phone||''} ${s.category?'· '+esc(s.category):''}</div>
    </div>
  `).join('');
}

function editSupplier(id){closeModal('supplierModal');openSupplierModal(id);}

function deleteSupplier(id){
  customConfirm('Delete this supplier?',()=>{
    suppliers=suppliers.filter(x=>x.id!==id);
    saveAll();renderSuppliers();showToast('🗑 Deleted');
  });
}

// ─── WOOD RATES ─────────────────────────────────────
function openWoodModal(){
  let body=document.getElementById('woodModalBody');
  body.innerHTML=`
    <div style="font-size:12px;font-weight:700;margin-bottom:6px;">🪵 Wood Rate Management</div>
    <div id="woodModalTypesArea">${woodTypes.map((w,i)=>`
      <div style="display:flex;gap:4px;margin-bottom:4px;align-items:center;">
        <input class="form-input" style="flex:2;" id="wm_woodName_${i}" value="${esc(w.name)}">
        <input class="form-input" style="flex:1;" type="number" id="wm_woodRate_${i}" value="${w.rate}" step="1">
        <button class="btn btn-danger btn-xs" onclick="removeWoodType(${i});openWoodModal();">✕</button>
      </div>
    `).join('')}</div>
    <div style="display:flex;gap:4px;margin-top:6px;">
      <input class="form-input" id="wm_newWoodName" placeholder="New wood name" style="flex:2;">
      <input class="form-input" type="number" id="wm_newWoodRate" placeholder="Rate" style="flex:1;" step="1">
      <button class="btn btn-primary btn-sm" onclick="addWoodTypeFromWoodModal()">+ Add</button>
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button class="btn btn-primary" onclick="saveWoodTypes()">💾 Save Rates</button>
      <button class="btn btn-outline" onclick="closeModal('woodModal')">Close</button>
    </div>
  `;
  openModal('woodModal');
}

function addWoodTypeFromWoodModal(){
  let name=document.getElementById('wm_newWoodName')?.value.trim();
  let rate=parseFloat(document.getElementById('wm_newWoodRate')?.value)||0;
  if(!name||rate<=0){showToast('⚠️ Name and rate zaruri');return;}
  woodTypes.push({id:newId(),name,rate});
  saveAll();
  openWoodModal();
}

function saveWoodTypes(){
  let today=new Date().toISOString().slice(0,10);
  woodTypes.forEach((w,i)=>{
    let nameInput=document.getElementById(`wm_woodName_${i}`);
    let rateInput=document.getElementById(`wm_woodRate_${i}`);
    if(nameInput)w.name=nameInput.value.trim()||w.name;
    if(rateInput){
      let newRate=parseFloat(rateInput.value)||w.rate;
      if(newRate!==w.rate){
        if(!w.rateHistory)w.rateHistory=[];
        w.rateHistory.push({rate:w.rate,date:today,changedTo:newRate});
        w.rate=newRate;
      }
    }
  });
  saveAll();
  showToast('✅ Wood rates saved');
  closeModal('woodModal');
  renderAll();
}

function openWoodRateHistoryModal(){
  let body=document.getElementById('woodRateHistoryModalBody');
  if(!woodTypes.some(w=>w.rateHistory&&w.rateHistory.length)){
    body.innerHTML='<div class="empty-state"><p>Abhi tak kisi wood ki rate change nahi hui (change hote hi yahan record ban jayega)</p></div>';
  }else{
    body.innerHTML=woodTypes.filter(w=>w.rateHistory&&w.rateHistory.length).map(w=>`
      <div class="karigar-row">
        <div class="karigar-row-head"><span style="font-weight:700;">${esc(w.name)}</span><span style="font-weight:800;">Ab: ${fmtRs(w.rate)}/cft</span></div>
        ${[...w.rateHistory].reverse().map(h=>`<div style="display:flex;justify-content:space-between;font-size:9px;padding:4px 0;border-bottom:1px solid var(--border);"><span>${h.date}</span><span>${fmtRs(h.rate)} → ${fmtRs(h.changedTo)}/cft</span></div>`).join('')}
      </div>
    `).join('');
  }
  openModal('woodRateHistoryModal');
}

// ════════════════════════════════════════════════════
// ──────── WOOD STOCK (opening + purchased − consumed) ─
// ════════════════════════════════════════════════════
function openRawMaterialCalcModal(){
  let body=document.getElementById('rawMaterialCalcModalBody');
  let pendingOrders=orders.filter(o=>!['ready','delivered'].includes(o.status||'pending'));
  let neededByWood={};
  pendingOrders.forEach(o=>(o.doors||[]).forEach(d=>{
    if(!d.woodId)return;
    neededByWood[d.woodId]=(neededByWood[d.woodId]||0)+getDoorCft(d);
  }));
  let rows=woodTypes.map(w=>{
    let needed=neededByWood[w.id]||0;
    let have=getWoodStockRemaining(w);
    let shortfall=needed-have;
    return{w,needed,have,shortfall};
  }).filter(r=>r.needed>0||r.have!==0);
  body.innerHTML=`
    <p style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">Abhi jo orders Ready/Delivered nahi huay (Pending/Cutting/Assembly/Polishing mein hain), unke liye aage kitni wood chahiye hogi — aur kitni abhi stock mein maujood hai.</p>
    ${pendingOrders.length===0?'<div class="empty-state"><p>Abhi koi order production mein nahi hai</p></div>':rows.length===0?'<div class="empty-state"><p>Pending orders mein wood type set nahi ki gayi</p></div>':rows.map(r=>`
      <div class="karigar-row">
        <div class="karigar-row-head"><span style="font-weight:700;">${esc(r.w.name)}</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px;">
          <div style="background:var(--gray-50);border-radius:8px;padding:6px 8px;text-align:center;">
            <div style="font-size:7px;color:var(--gray-500);text-transform:uppercase;font-weight:700;">Aage Chahiye</div>
            <div style="font-size:13px;font-weight:800;">${r.needed.toFixed(1)} cft</div>
          </div>
          <div style="background:var(--gray-50);border-radius:8px;padding:6px 8px;text-align:center;">
            <div style="font-size:7px;color:var(--gray-500);text-transform:uppercase;font-weight:700;">Abhi Stock Mein</div>
            <div style="font-size:13px;font-weight:800;">${r.have.toFixed(1)} cft</div>
          </div>
        </div>
        ${r.shortfall>0
          ?`<div style="background:#fee2e2;color:#b91c1c;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:700;text-align:center;">⚠️ ${r.shortfall.toFixed(1)} cft aur khareedni paregi</div>`
          :`<div style="background:#d1fae5;color:#065f46;border-radius:8px;padding:7px 10px;font-size:10px;font-weight:700;text-align:center;">✅ Stock kaafi hai</div>`
        }
      </div>
    `).join('')}
  `;
  openModal('rawMaterialCalcModal');
}

function openPLStatementModal(){
  renderPLStatement();
  openModal('plStatementModal');
}

function renderPLStatement(){
  let body=document.getElementById('plStatementModalBody');
  let period=document.getElementById('plPeriod')?.value||'month';
  let now=new Date();
  function inPeriod(dateStr){
    let d=new Date(dateStr);
    if(period==='month'){let mo=new Date(now);mo.setMonth(mo.getMonth()-1);return d>=mo;}
    if(period==='quarter'){let q=new Date(now);q.setMonth(q.getMonth()-3);return d>=q;}
    if(period==='year'){let yr=new Date(now);yr.setFullYear(yr.getFullYear()-1);return d>=yr;}
    return true; // 'all'
  }
  let periodOrders=orders.filter(o=>inPeriod(o.date));
  let periodExpenses=expenses.filter(e=>inPeriod(e.date));
  let revenue=periodOrders.reduce((s,o)=>s+(o.orderTotal||0),0);
  let woodCost=periodOrders.reduce((s,o)=>s+(o.totalWoodCost||0),0);
  let grossProfit=periodOrders.reduce((s,o)=>s+(o.netProfit||0),0);
  let labourCost=revenue-woodCost-grossProfit;
  let opEx=periodExpenses.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
  let netProfit=grossProfit-opEx;
  let expByCat={};
  periodExpenses.forEach(e=>{let cat=e.category||'Other';expByCat[cat]=(expByCat[cat]||0)+(parseFloat(e.amount)||0);});
  body.innerHTML=`
    <div class="form-group" style="margin-bottom:10px;">
      <select class="form-select" id="plPeriod" onchange="renderPLStatement()">
        <option value="month" ${period==='month'?'selected':''}>Pichla 1 Mahina</option>
        <option value="quarter" ${period==='quarter'?'selected':''}>Pichlay 3 Mahine</option>
        <option value="year" ${period==='year'?'selected':''}>Pichla 1 Saal</option>
        <option value="all" ${period==='all'?'selected':''}>Sab Time</option>
      </select>
    </div>
    <div style="background:var(--gray-50);border-radius:10px;padding:12px 14px;">
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:11px;"><span>💰 Revenue (${periodOrders.length} orders)</span><strong>${fmtRs(revenue)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:10px;color:var(--gray-500);border-top:1px dashed var(--border);"><span>&nbsp;&nbsp;🪵 Wood Cost</span><span>− ${fmtRs(woodCost)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:10px;color:var(--gray-500);"><span>&nbsp;&nbsp;👷 Labour Cost</span><span>− ${fmtRs(labourCost)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:11px;font-weight:700;border-top:1px solid var(--border);margin-top:2px;"><span>📊 Gross Profit</span><strong style="color:var(--green-700);">${fmtRs(grossProfit)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:10px;color:var(--gray-500);"><span>&nbsp;&nbsp;💸 Operating Kharcha</span><span>− ${fmtRs(opEx)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0 2px;font-size:14px;font-weight:800;border-top:2px solid var(--accent);margin-top:2px;"><span>💎 Net Profit</span><strong style="color:${netProfit>=0?'var(--green-700)':'var(--red)'};">${fmtRs(netProfit)}</strong></div>
    </div>
    ${Object.keys(expByCat).length?`
    <div style="font-size:9px;font-weight:700;margin:14px 0 6px;">💸 Kharcha Category-wise</div>
    ${Object.entries(expByCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>`
      <div style="display:flex;justify-content:space-between;font-size:9px;padding:4px 0;border-bottom:1px solid var(--border);"><span>${esc(cat)}</span><strong>${fmtRs(amt)}</strong></div>
    `).join('')}`:''}
  `;
}

function sendWhatsAppReminder(partyId){
  let p=getPartyById(partyId);
  if(!p){showToast('⚠️ Party nahi mili');return;}
  if(!p.phone){showToast('⚠️ Is party ka phone number nahi hai');return;}
  let balance=getPartyBalance(p);
  let msg=`Assalam-o-Alaikum ${p.name}, ${businessProfile.name||'HK Wood Doors'} se — aapki taraf ${fmtRs(balance)} baqi hai. Jald payment bhej dein, shukriya.`;
  let phone=p.phone.replace(/[^0-9]/g,'');
  if(phone.startsWith('0'))phone='92'+phone.slice(1); // Pakistan local -> international
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,'_blank');
}

function openWoodStockModal(){
  renderWoodStockModalBody();
  openModal('woodStockModal');
}

function renderWoodStockModalBody(){
  let body=document.getElementById('woodStockModalBody');
  let totalRemaining=woodTypes.reduce((s,w)=>s+getWoodStockRemaining(w),0);
  let totalConsumed=woodTypes.reduce((s,w)=>s+getWoodConsumed(w.id),0);
  body.innerHTML=`
    <p style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">Purani maal (Opening) + Nayi khareedari (Purchases se) − Orders mein use hui wood = Baqi Stock. Jab bhi order banega, wood khud yahan se kat jayegi. Neeche dono figures ko zaroorat par khud edit bhi kar sakte hain (jaise physical ginti se match karna ho).</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
      <div class="stat-card teal"><div class="num">${totalRemaining.toFixed(1)} cft</div><div class="lbl">🟢 Kul Kitni Padi Hai</div></div>
      <div class="stat-card orange"><div class="num">${totalConsumed.toFixed(1)} cft</div><div class="lbl">🔴 Kul Kitni Use Hui</div></div>
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px;">
      <button class="btn btn-outline btn-sm" style="flex:1;" onclick="resetAllWoodStock()">🔄 Sab Reset Karein</button>
      <button class="btn btn-outline btn-sm" style="flex:1;" onclick="openWoodRateHistoryModal()">📜 Rate History</button>
    </div>
    ${woodTypes.map((w,i)=>{
      let purchased=getWoodPurchasedCft(w.id);
      let consumed=getWoodConsumed(w.id);
      let remaining=getWoodStockRemaining(w);
      return `
      <div class="karigar-row">
        <div class="karigar-row-head">
          <span style="font-weight:700;">${esc(w.name)}</span>
          <span style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:8px;color:var(--gray-500);">Rate: ${fmtRs(w.rate)}/cft</span>
            <button class="btn btn-outline btn-xs" onclick="resetWoodType(${i})">🔄 Reset</button>
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:6px;">
          <div style="background:${remaining<0?'#fee2e2':'#d1fae5'};border-radius:8px;padding:6px 8px;">
            <div style="font-size:7px;color:${remaining<0?'#b91c1c':'#065f46'};text-transform:uppercase;font-weight:700;text-align:center;margin-bottom:3px;">🟢 Kitni Padi Hai (Edit karein)</div>
            <input type="number" step="0.1" value="${remaining.toFixed(1)}" id="wsRemaining_${i}" onchange="updateWoodRemainingDirect(${i},this.value)"
              style="width:100%;border:none;background:transparent;text-align:center;font-size:14px;font-weight:800;color:${remaining<0?'#b91c1c':'#065f46'};">
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:6px 8px;">
            <div style="font-size:7px;color:#92400e;text-transform:uppercase;font-weight:700;text-align:center;margin-bottom:3px;">🔴 Kitni Use Hui</div>
            <div style="font-size:14px;font-weight:800;color:#92400e;text-align:center;">${consumed.toFixed(1)} cft</div>
          </div>
        </div>
        <div style="font-size:8px;color:var(--gray-500);margin-bottom:6px;">Orders se: <strong style="color:var(--text);">${(consumed-(parseFloat(w.manualUsage)||0)).toFixed(1)}</strong> cft · Khareedi Gayi: <strong style="color:var(--text);">${purchased.toFixed(1)}</strong> cft</div>
        <div class="row-2" style="margin-bottom:0;">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Opening Stock</label>
            <input class="form-input" type="number" id="wsOpening_${i}" value="${w.openingStock||0}" step="0.1" onchange="updateWoodOpeningStock(${i},this.value)">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Extra Use / Zaya (orders ke ilawa)</label>
            <input class="form-input" type="number" id="wsManualUsage_${i}" value="${w.manualUsage||0}" step="0.1" onchange="updateWoodManualUsage(${i},this.value)">
          </div>
        </div>
      </div>`;
    }).join('')}
    <button class="btn btn-outline" style="margin-top:6px;" onclick="closeModal('woodStockModal')">Close</button>
  `;
}

function updateWoodOpeningStock(idx,value){
  let w=woodTypes[idx];
  if(!w)return;
  w.openingStock=parseFloat(value)||0;
  saveAll();
  renderWoodStockModalBody();
}

function updateWoodRemainingDirect(idx,value){
  let w=woodTypes[idx];
  if(!w)return;
  let desiredRemaining=parseFloat(value)||0;
  let purchased=getWoodPurchasedCft(w.id);
  let consumed=getWoodConsumed(w.id);
  // Remaining = Opening + Purchased − Consumed  →  back-solve Opening so future
  // purchases/usage keep layering correctly on top of this corrected figure.
  w.openingStock=desiredRemaining-purchased+consumed;
  saveAll();
  renderWoodStockModalBody();
  showToast('✅ Stock update ho gaya');
}

function updateWoodManualUsage(idx,value){
  let w=woodTypes[idx];
  if(!w)return;
  w.manualUsage=parseFloat(value)||0;
  saveAll();
  renderWoodStockModalBody();
  showToast('✅ Use hui wood update ho gayi');
}

function resetWoodType(idx){
  let w=woodTypes[idx];
  if(!w)return;
  customConfirm(`"${w.name}" ki Padi Hai aur Use Hui dono 0 par reset ho jayengi. Purana Orders/Purchases record surakshit rahega, sirf yeh stock counter saaf hoga. Aage se dubara ginti shuru hogi.`,()=>{
    w.consumedBaseline=getWoodOrdersConsumedRaw(w.id);
    w.manualUsage=0;
    w.openingStock=0;
    saveAll();
    renderWoodStockModalBody();
    showToast(`✅ ${w.name} reset ho gaya`);
  },{title:'🔄 Wood Type Reset Karein?',okText:'Reset Karein'});
}

function resetAllWoodStock(){
  customConfirm('Sab wood types ki "Kul Kitni Padi Hai" aur "Kul Kitni Use Hui" 0 par reset ho jayengi. Purana Orders/Purchases record surakshit rahega, sirf stock counters saaf honge.',()=>{
    woodTypes.forEach(w=>{
      w.consumedBaseline=getWoodOrdersConsumedRaw(w.id);
      w.manualUsage=0;
      w.openingStock=0;
    });
    saveAll();
    renderWoodStockModalBody();
    showToast('✅ Sab wood stock reset ho gaya');
  },{title:'🔄 Sab Wood Stock Reset Karein?',okText:'Sab Reset Karein'});
}

// ════════════════════════════════════════════════════
// ──────── RATE / PRICE LIST CATALOG ─────────────────
// ════════════════════════════════════════════════════
function openPriceListModal(){
  if(!priceList.length){
    // Seed once from door designs (rate is set by design, not by size)
    priceList=doorDesigns.map(d=>({id:newId(),size:d,rate:440}));
    saveAll();
  }
  renderPriceListModalBody();
  openModal('priceListModal');
}

function renderPriceListModalBody(){
  let body=document.getElementById('priceListModalBody');
  body.innerHTML=`
    <p style="font-size:9px;color:var(--gray-500);margin-bottom:8px;">Yahan sirf <strong>Design/Pattern ka naam</strong> likhein (jaise: Mughleazam, Rose Design) — size (45x80 waghera) is naam mein nahi honi chahiye. Rate design ke hisaab se hoti hai, size ke hisaab se nahi — ek design ka rate sab sizes pe wahi rahega. Har entry ke saath 📷 tap kar ke photo bhi laga sakte hain.</p>
    <div style="margin-bottom:10px;">
      <div class="field-label" style="margin-bottom:4px;">🚪 Design Names — tap kar ke naye entry ke liye select karein</div>
      <div id="designChipsArea" style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px;">
        ${doorDesigns.map(d=>`<button type="button" class="btn btn-outline btn-xs" onclick="appendDesignToNewSize('${esc(d).replace(/'/g,"\\'")}')">${esc(d)} <span onclick="event.stopPropagation();removeDoorDesign('${esc(d).replace(/'/g,"\\'")}')" style="margin-left:4px;color:var(--red);font-weight:700;">✕</span></button>`).join('')}
      </div>
      <div style="display:flex;gap:4px;">
        <input class="form-input" id="newDesignName" placeholder="Naya design naam, jaise: Rose Design" style="flex:2;">
        <button class="btn btn-outline btn-sm" onclick="addDoorDesign()">+ Design Add Karein</button>
      </div>
    </div>
    <div id="priceListRows">${priceList.map((p,i)=>{
      let looksLikeSize=/^\d+\s*[xX]\s*\d+/.test((p.size||'').trim());
      return `
      <div style="margin-bottom:8px;">
        <div style="display:flex;gap:6px;align-items:center;">
          ${p.photo
            ?`<img src="${p.photo}" style="width:36px;height:36px;object-fit:cover;border-radius:8px;border:1px solid var(--border);flex-shrink:0;cursor:pointer;" onclick="document.getElementById('plPhotoInput_${i}').click()">`
            :`<button type="button" onclick="document.getElementById('plPhotoInput_${i}').click()" style="width:36px;height:36px;border-radius:8px;border:1px dashed var(--border);background:var(--gray-50);flex-shrink:0;font-size:14px;display:flex;align-items:center;justify-content:center;cursor:pointer;">📷</button>`
          }
          <input type="file" id="plPhotoInput_${i}" accept="image/*" style="display:none;" onchange="handlePriceListPhotoSelect(${i},this.files[0])">
          <input class="form-input" style="flex:2;${looksLikeSize?'border-color:#d97706;':''}" id="plSize_${i}" value="${esc(p.size)}" placeholder="Design/Pattern ka naam">
          <input class="form-input" style="flex:1;" type="number" id="plRate_${i}" value="${p.rate}" step="1">
          ${p.photo?`<button class="btn btn-outline btn-xs" onclick="removePriceListPhoto(${i})">🗑📷</button>`:''}
          <button class="btn btn-danger btn-xs" onclick="deletePriceListEntry(${i})">✕</button>
        </div>
        ${looksLikeSize?`<div style="font-size:7.5px;color:#b45309;margin:2px 0 0 42px;">⚠️ Yeh size lagta hai — is ka asal Design/Pattern naam likh dein</div>`:''}
      </div>
    `;}).join('')}</div>
    <div style="display:flex;gap:4px;margin-top:6px;">
      <input class="form-input" id="plNewSize" placeholder="Design/Pattern ka naam, jaise: Mughleazam" style="flex:2;">
      <input class="form-input" type="number" id="plNewRate" placeholder="Rate" style="flex:1;" step="1">
      <button class="btn btn-primary btn-sm" onclick="addPriceListEntry()">+ Add</button>
    </div>
    <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="savePriceList()">💾 Save</button>
      <button class="btn btn-gold" onclick="downloadCatalogPDF()">📤 Customer Ko Bhejein (Card + Rate List + Photos)</button>
      <button class="btn btn-outline" onclick="closeModal('priceListModal')">Close</button>
    </div>
  `;
}

function appendDesignToNewSize(designName){
  let input=document.getElementById('plNewSize');
  if(!input)return;
  let current=input.value.trim();
  input.value=current?`${current} ${designName}`:designName;
  input.focus();
}

function addDoorDesign(){
  let name=document.getElementById('newDesignName')?.value.trim();
  if(!name){showToast('⚠️ Design ka naam likhein');return;}
  if(doorDesigns.includes(name)){showToast('⚠️ Yeh design pehle se list mein hai');return;}
  doorDesigns.push(name);
  saveAll();
  renderPriceListModalBody();
  showToast('✅ Design add ho gaya');
}

function removeDoorDesign(name){
  doorDesigns=doorDesigns.filter(d=>d!==name);
  saveAll();
  renderPriceListModalBody();
}

function addPriceListEntry(){
  let size=document.getElementById('plNewSize')?.value.trim();
  let rate=parseFloat(document.getElementById('plNewRate')?.value)||0;
  if(!size||rate<=0){showToast('⚠️ Design ka naam aur rate zaruri');return;}
  priceList.push({id:newId(),size,rate});
  saveAll();
  renderPriceListModalBody();
}

function deletePriceListEntry(idx){
  priceList.splice(idx,1);
  saveAll();
  renderPriceListModalBody();
}

function handlePriceListPhotoSelect(idx,file){
  if(!file)return;
  if(!file.type.startsWith('image/')){showToast('⚠️ Sirf image file select karein');return;}
  let reader=new FileReader();
  reader.onload=function(e){
    let img=new Image();
    img.onload=function(){
      let maxW=500; // catalog thumbnail — lighter than full order reference photos
      let scale=Math.min(1,maxW/img.width);
      let canvas=document.createElement('canvas');
      canvas.width=img.width*scale;
      canvas.height=img.height*scale;
      let ctx=canvas.getContext('2d');
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      if(priceList[idx]){
        priceList[idx].photo=canvas.toDataURL('image/jpeg',0.82);
        saveAll();
        renderPriceListModalBody();
        showToast('✅ Photo attach ho gayi');
      }
    };
    img.onerror=function(){showToast('⚠️ Photo load nahi ho saki');};
    img.src=e.target.result;
  };
  reader.onerror=function(){showToast('⚠️ File read nahi ho saki');};
  reader.readAsDataURL(file);
}

function removePriceListPhoto(idx){
  if(priceList[idx]){
    delete priceList[idx].photo;
    saveAll();
    renderPriceListModalBody();
  }
}

function savePriceList(){
  priceList.forEach((p,i)=>{
    let sizeInput=document.getElementById(`plSize_${i}`);
    let rateInput=document.getElementById(`plRate_${i}`);
    if(sizeInput)p.size=sizeInput.value.trim()||p.size;
    if(rateInput)p.rate=parseFloat(rateInput.value)||p.rate;
  });
  saveAll();
  showToast('✅ Price list saved');
  closeModal('priceListModal');
}

function buildCatalogHTML(elId){
  let cardStyle=businessProfile.cardStyle||'navy_gold';
  let cardData={name:businessProfile.name,ownerName:businessProfile.ownerName,tagline:businessProfile.tagline,phone:businessProfile.phone,address:businessProfile.address,city:businessProfile.city};
  let cardHTML=buildBusinessCardHTML(elId+'_card',cardStyle,cardData);
  let cards=priceList.map((p,i)=>{
    let photoBlock=p.photo
      ?`<img src="${p.photo}" style="width:100%;height:120px;object-fit:cover;display:block;">`
      :`<div style="width:100%;height:120px;background:linear-gradient(135deg,#eef2f8,#dde6f2);display:flex;align-items:center;justify-content:center;font-size:36px;">🚪</div>`;
    return `<div style="border:1px solid #e8ecf3;border-radius:10px;overflow:hidden;background:#fff;position:relative;">
      <div style="position:absolute;top:6px;left:6px;background:rgba(26,58,106,0.85);color:#fff;font-size:7px;font-weight:800;padding:2px 6px;border-radius:8px;z-index:1;">${String(i+1).padStart(2,'0')}</div>
      ${photoBlock}
      <div style="padding:8px 10px 10px;">
        <div style="font-weight:700;color:#1a3a6a;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(p.size)}</div>
        <div style="margin-top:5px;"><span style="background:#fef3c7;color:#92400e;padding:3px 10px;border-radius:12px;font-weight:800;font-size:9px;">${fmtRs(p.rate)} / sq.ft</span></div>
      </div>
    </div>`;
  }).join('');
  return `
    <div id="${elId}" style="font-family:'Segoe UI',sans-serif;width:700px;box-sizing:border-box;margin:auto;background:#f4f6f9;">
      <div style="padding:24px 24px 0;display:flex;justify-content:center;">
        ${cardHTML}
      </div>
      <div style="text-align:center;padding:20px 0 4px;">
        <div style="display:inline-block;font-size:15px;font-weight:800;color:#1a3a6a;letter-spacing:4px;">RATE LIST</div>
      </div>
      <div style="padding:14px 30px 26px;background:#fff;color:#1a2a3a;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${cards}</div>
        <p style="font-size:8.5px;color:#9ca7b8;margin-top:18px;text-align:center;font-style:italic;">Rates subject to change without prior notice. Final quotation will be confirmed at time of order.</p>
        <div style="font-size:8px;color:#9ca7b8;margin-top:16px;text-align:center;border-top:1px solid #e8ecf3;padding-top:12px;">
          <strong style="color:#c8963e;">${esc(businessProfile.footerNote||'Thank You for Your Business 🙏')}</strong>
        </div>
      </div>
    </div>
  `;
}

const CARD_STYLES=[
  {id:'navy_gold',label:'Navy Gold'},
  {id:'ivory_minimal',label:'Ivory Minimal'},
  {id:'wood_warmth',label:'Wood Warmth'},
  {id:'charcoal_copper',label:'Charcoal Copper'},
  {id:'emerald_luxury',label:'Emerald Luxury'},
  {id:'diagonal_split',label:'Diagonal Split'},
  {id:'maroon_heritage',label:'Maroon Heritage'},
  {id:'slate_modern',label:'Slate Modern'},
  {id:'cream_border',label:'Cream Border'},
  {id:'black_gold',label:'Black Gold'},
];
let _selectedCardStyle='navy_gold';

function getCardFormData(){
  return{
    name:document.getElementById('bcName')?.value||businessProfile.name||'HK WOOD DOORS',
    ownerName:document.getElementById('bcOwnerName')?.value||businessProfile.ownerName||'',
    tagline:document.getElementById('bcTagline')?.value||businessProfile.tagline||'',
    phone:document.getElementById('bcPhone')?.value||businessProfile.phone||'',
    address:document.getElementById('bcAddress')?.value||businessProfile.address||'',
    city:document.getElementById('bcCity')?.value||businessProfile.city||'',
  };
}

function buildBusinessCardHTML(elId,styleId,data){
  data=data||{};
  let name=esc(data.name||'HK WOOD DOORS');
  let owner=esc(data.ownerName||'');
  let tagline=esc(data.tagline||'');
  let phone=esc(data.phone||'');
  let addrLine=esc([data.address,data.city].filter(Boolean).join(', '));
  let W=520,H=300;
  let contactRows=[owner,phone,addrLine].filter(Boolean);

  const shells={
    navy_gold:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;font-family:'Segoe UI',sans-serif;background:linear-gradient(135deg,#0a142e,#1a3a6a 55%,#2a5a8a);border-radius:18px;padding:34px 32px;position:relative;overflow:hidden;color:#fff;">
      <div style="position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(200,150,62,.32),transparent 70%);"></div>
      <div style="position:relative;z-index:1;display:flex;align-items:center;gap:14px;">
        <img src="./icon-512.png" style="width:56px;height:56px;border-radius:16px;">
        <div><div style="font-size:22px;font-weight:800;letter-spacing:.5px;">${name}</div>${tagline?`<div style="font-size:10px;color:#cfe0f5;margin-top:2px;">${tagline}</div>`:''}</div>
      </div>
      <div style="position:relative;z-index:1;margin-top:30px;font-size:11px;line-height:2;color:#e8eef7;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
      <div style="position:absolute;bottom:20px;right:32px;font-size:9px;letter-spacing:3px;color:#c8963e;font-weight:800;z-index:1;">QUALITY WOOD DOORS</div>
    </div>`,

    ivory_minimal:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;background:#faf7f0;border:1px solid #d8cfa8;border-radius:6px;padding:38px 36px;font-family:Georgia,'Times New Roman',serif;position:relative;">
      <div style="font-size:24px;font-weight:700;color:#1a1a1a;letter-spacing:1.5px;">${name}</div>
      ${tagline?`<div style="font-size:9.5px;color:#8a7a4a;margin-top:6px;letter-spacing:2px;text-transform:uppercase;">${tagline}</div>`:''}
      <div style="position:absolute;bottom:36px;left:36px;right:36px;border-top:1px solid #d8cfa8;padding-top:14px;font-size:11px;color:#2a2a2a;line-height:1.9;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
    </div>`,

    wood_warmth:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;font-family:'Segoe UI',sans-serif;background:linear-gradient(150deg,#6b3e1f,#8a5a2e 50%,#a9793f);border-radius:16px;padding:32px;position:relative;overflow:hidden;color:#fff8ec;">
      <div style="position:absolute;right:-20px;bottom:-20px;font-size:150px;opacity:.12;line-height:1;">🚪</div>
      <div style="position:relative;z-index:1;font-size:23px;font-weight:800;">${name}</div>
      ${tagline?`<div style="position:relative;z-index:1;font-size:10px;color:#f3e2c8;margin-top:4px;">${tagline}</div>`:''}
      <div style="position:relative;z-index:1;margin-top:34px;font-size:11px;line-height:2;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
    </div>`,

    charcoal_copper:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;font-family:'Segoe UI',sans-serif;background:#232323;border-radius:10px;padding:34px;position:relative;overflow:hidden;color:#f0ece6;">
      <div style="position:absolute;left:0;top:0;bottom:0;width:6px;background:linear-gradient(#b87333,#e0a06a);"></div>
      <div style="font-size:22px;font-weight:800;letter-spacing:.5px;margin-left:10px;">${name}</div>
      ${tagline?`<div style="font-size:10px;color:#c99a6c;margin-top:4px;margin-left:10px;">${tagline}</div>`:''}
      <div style="margin-top:32px;margin-left:10px;font-size:11px;line-height:2;color:#d8d2c8;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
    </div>`,

    emerald_luxury:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;font-family:Georgia,serif;background:linear-gradient(135deg,#06231a,#0f3d2e 60%,#155a44);border-radius:14px;padding:34px;position:relative;overflow:hidden;color:#f2e8c9;">
      <div style="position:absolute;inset:10px;border:1px solid rgba(242,232,201,.35);border-radius:8px;"></div>
      <div style="position:relative;z-index:1;font-size:22px;font-weight:700;letter-spacing:1px;">${name}</div>
      ${tagline?`<div style="position:relative;z-index:1;font-size:9.5px;color:#c9dcc9;margin-top:5px;letter-spacing:1px;">${tagline}</div>`:''}
      <div style="position:relative;z-index:1;margin-top:32px;font-size:11px;line-height:2;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
    </div>`,

    diagonal_split:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;font-family:'Segoe UI',sans-serif;background:#12203f;border-radius:14px;position:relative;overflow:hidden;color:#fff;">
      <div style="position:absolute;top:0;right:0;width:60%;height:100%;background:linear-gradient(160deg,#c8963e,#e8c777);clip-path:polygon(35% 0,100% 0,100% 100%,10% 100%);"></div>
      <div style="position:relative;z-index:1;padding:34px 32px;">
        <div style="font-size:22px;font-weight:800;max-width:230px;">${name}</div>
        ${tagline?`<div style="font-size:9.5px;color:#aebfdd;margin-top:5px;max-width:200px;">${tagline}</div>`:''}
        <div style="margin-top:38px;font-size:11px;line-height:2;color:#dfe6f5;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
      </div>
    </div>`,

    maroon_heritage:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;font-family:Georgia,serif;background:#4a1220;border-radius:12px;padding:14px;position:relative;overflow:hidden;color:#f3e3c3;">
      <div style="border:1.5px solid #c9a35a;border-radius:6px;height:100%;padding:24px 26px;box-sizing:border-box;">
        <div style="font-size:22px;font-weight:700;letter-spacing:1px;">${name}</div>
        ${tagline?`<div style="font-size:9.5px;color:#d9b98a;margin-top:5px;letter-spacing:1px;text-transform:uppercase;">${tagline}</div>`:''}
        <div style="margin-top:30px;font-size:11px;line-height:2;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
      </div>
    </div>`,

    slate_modern:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;font-family:'Segoe UI',sans-serif;background:#3a4552;border-radius:10px;padding:34px;position:relative;overflow:hidden;color:#fff;">
      <div style="position:absolute;top:0;left:0;width:100%;height:5px;background:#5a9bd5;"></div>
      <div style="font-size:21px;font-weight:700;">${name}</div>
      ${tagline?`<div style="font-size:10px;color:#b8c4d0;margin-top:4px;">${tagline}</div>`:''}
      <div style="margin-top:34px;font-size:11px;line-height:2;color:#dbe3ea;">${contactRows.map(r=>`<div style="display:flex;align-items:center;gap:6px;"><span style="width:4px;height:4px;background:#5a9bd5;border-radius:50%;display:inline-block;"></span>${r}</div>`).join('')}</div>
    </div>`,

    cream_border:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;background:#fdfaf3;border-radius:8px;padding:12px;position:relative;">
      <div style="border:3px solid #1a3a6a;border-radius:4px;height:100%;box-sizing:border-box;padding:26px;text-align:center;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div style="font-size:21px;font-weight:800;color:#1a3a6a;letter-spacing:1px;">${name}</div>
        ${tagline?`<div style="font-size:9.5px;color:#6a7a8a;margin-top:5px;">${tagline}</div>`:''}
        <div style="margin-top:20px;width:40px;height:2px;background:#c8963e;"></div>
        <div style="margin-top:16px;font-size:10.5px;color:#2a2a2a;line-height:1.9;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
      </div>
    </div>`,

    black_gold:()=>`<div id="${elId}" style="width:${W}px;height:${H}px;box-sizing:border-box;font-family:'Segoe UI',sans-serif;background:#0a0a0a;border-radius:12px;padding:34px;position:relative;overflow:hidden;color:#e8c777;">
      <div style="position:absolute;bottom:-30px;right:-30px;width:150px;height:150px;border:1px solid rgba(232,199,119,.25);border-radius:50%;"></div>
      <div style="font-size:24px;font-weight:800;letter-spacing:1.5px;color:#f0d38a;">${name}</div>
      ${tagline?`<div style="font-size:9.5px;color:#b89a5a;margin-top:6px;letter-spacing:1px;">${tagline}</div>`:''}
      <div style="margin-top:34px;font-size:11px;line-height:2;color:#e0d0b0;">${contactRows.map(r=>`<div>${r}</div>`).join('')}</div>
    </div>`,
  };
  return (shells[styleId]||shells.navy_gold)();
}

function selectCardStyle(styleId){
  _selectedCardStyle=styleId;
  businessProfile.cardStyle=styleId;
  saveAll();
  updateBusinessCardPreview();
}

function updateBusinessCardPreview(){
  document.getElementById('businessCardPreview').innerHTML=buildBusinessCardHTML('businessCardPreviewInner',_selectedCardStyle,getCardFormData());
  document.querySelectorAll('.card-style-chip').forEach(el=>{
    el.classList.toggle('active',el.dataset.style===_selectedCardStyle);
  });
}

function saveBusinessCardProfile(){
  let d=getCardFormData();
  businessProfile.name=d.name;
  businessProfile.ownerName=d.ownerName;
  businessProfile.tagline=d.tagline;
  businessProfile.phone=d.phone;
  businessProfile.address=d.address;
  businessProfile.city=d.city;
  businessProfile.cardStyle=_selectedCardStyle;
  saveAll();
  applyBusinessProfileToUI();
}

function downloadBusinessCardPDF(){
  saveBusinessCardProfile();
  let temp=document.createElement('div');
  temp.innerHTML=buildBusinessCardHTML('businessCardPdfContent',_selectedCardStyle,getCardFormData());
  temp.style.position='fixed';
  temp.style.left='0';
  temp.style.top='0';
  temp.style.width='520px';
  temp.style.background='#fff';
  temp.style.zIndex='150';
  temp.style.pointerEvents='none';
  document.body.appendChild(temp);
  downloadPDF('businessCardPdfContent', `Business_Card_${new Date().toISOString().slice(0,10)}.pdf`).finally(()=>temp.remove());
  showToast('✅ Details save ho gayin, PDF ban rahi hai');
}

function renderBusinessCardModalBody(){
  let body=document.getElementById('businessCardModalBody');
  body.innerHTML=`
    <div style="width:100%;height:195px;overflow:hidden;border-radius:14px;margin-bottom:10px;">
      <div id="businessCardPreview" style="width:520px;transform:scale(0.65);transform-origin:top left;"></div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;">
      ${CARD_STYLES.map(s=>`<button type="button" class="btn btn-outline btn-xs card-style-chip" data-style="${s.id}" onclick="selectCardStyle('${s.id}')">${esc(s.label)}</button>`).join('')}
    </div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Business Naam</label><input class="form-input" id="bcName" value="${esc(businessProfile.name||'')}" onchange="updateBusinessCardPreview()"></div>
      <div class="form-group"><label class="form-label">Aapka Naam (optional)</label><input class="form-input" id="bcOwnerName" value="${esc(businessProfile.ownerName||'')}" onchange="updateBusinessCardPreview()"></div>
    </div>
    <div class="form-group"><label class="form-label">Tagline</label><input class="form-input" id="bcTagline" value="${esc(businessProfile.tagline||'')}" onchange="updateBusinessCardPreview()"></div>
    <div class="row-2">
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="bcPhone" value="${esc(businessProfile.phone||'')}" onchange="updateBusinessCardPreview()"></div>
      <div class="form-group"><label class="form-label">City</label><input class="form-input" id="bcCity" value="${esc(businessProfile.city||'')}" onchange="updateBusinessCardPreview()"></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="bcAddress" value="${esc(businessProfile.address||'')}" onchange="updateBusinessCardPreview()"></div>
    <button class="btn btn-gold" style="width:100%;margin-top:6px;" onclick="downloadBusinessCardPDF()">💾 Save Karein &amp; PDF Download Karein</button>
  `;
  updateBusinessCardPreview();
}

function openBusinessCardModal(){
  _selectedCardStyle=businessProfile.cardStyle||'navy_gold';
  renderBusinessCardModalBody();
  openModal('businessCardModal');
}

function buildLabelsHTML(elId,o){
  let p=getPartyById(o.partyId);
  let labels=(o.doors||[]).map((d,i)=>`
    <div style="width:100%;border:1.5px dashed #94a3b8;border-radius:8px;padding:10px;display:flex;align-items:center;gap:10px;box-sizing:border-box;">
      <div id="lbl_qr_${elId}_${i}" style="flex-shrink:0;"></div>
      <div style="min-width:0;">
        <div style="font-size:12px;font-weight:800;color:#1a3a6a;">${esc(o.orderNo)}</div>
        <div style="font-size:9px;color:#334155;margin-top:2px;">${esc(p?p.name:'')}</div>
        <div style="font-size:9px;color:#334155;">${esc(d.size||'')}</div>
        <div style="font-size:8px;color:#94a3b8;margin-top:2px;">Door ${i+1}</div>
      </div>
    </div>
  `).join('');
  return `<div id="${elId}" style="width:600px;box-sizing:border-box;background:#fff;padding:20px;font-family:'Segoe UI',sans-serif;">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${labels}</div>
  </div>`;
}

function downloadLabelsPDF(orderId){
  let o=orders.find(x=>x.id===orderId);
  if(!o||!(o.doors&&o.doors.length)){showToast('⚠️ Is order mein doors nahi mile');return;}
  let elId='labelsPdfContent';
  let temp=document.createElement('div');
  temp.innerHTML=buildLabelsHTML(elId,o);
  temp.style.position='fixed';
  temp.style.left='0';
  temp.style.top='0';
  temp.style.width='600px';
  temp.style.background='#fff';
  temp.style.zIndex='150';
  temp.style.pointerEvents='none';
  document.body.appendChild(temp);
  try{
    if(typeof QRCode!=='undefined'){
      let partyName=getPartyName(o.partyId);
      (o.doors||[]).forEach((d,i)=>{
        let el=document.getElementById(`lbl_qr_${elId}_${i}`);
        if(el)new QRCode(el,{text:`${o.orderNo} | ${partyName} | ${d.size||''}`,width:56,height:56,colorDark:'#1a3a6a',colorLight:'#ffffff'});
      });
    }
  }catch(e){ /* labels still work without QR */ }
  downloadPDF(elId, `Labels_${o.orderNo}.pdf`).finally(()=>temp.remove());
}

function downloadCatalogPDF(){
  if(!priceList.length){showToast('⚠️ Pehle kam se kam ek size/rate add karein');return;}
  let temp=document.createElement('div');
  temp.innerHTML=buildCatalogHTML('catalogPdfContent');
  temp.style.position='fixed';
  temp.style.left='0';
  temp.style.top='0';
  temp.style.width='700px';
  temp.style.background='#fff';
  temp.style.zIndex='150';
  temp.style.pointerEvents='none';
  document.body.appendChild(temp);
  downloadPDF('catalogPdfContent', `Rate_List_${new Date().toISOString().slice(0,10)}.pdf`).finally(()=>temp.remove());
}

// ─── INVOICE PRINT / PDF ────────────────────────────
function downloadKhataPDF(){
  let content = document.getElementById('khataContent');
  if (!content || !content.innerHTML.trim()) {
    showToast('⚠️ No data to export');
    return;
  }

  let html = `
    <div id="khataPdfContent" style="font-family:sans-serif;padding:20px;max-width:800px;margin:auto;background:#fff;">
      <div style="text-align:center;border-bottom:2px solid #c8963e;padding-bottom:10px;margin-bottom:14px;">
        <h1 style="font-size:22px;">${esc(businessProfile.name)}</h1>
        <p style="font-size:10px;color:#666;">Party Khata Report</p>
        <p style="font-size:9px;color:#888;">${new Date().toLocaleDateString()}</p>
      </div>
      ${content.innerHTML}
    </div>
  `;

  let temp = document.createElement('div');
  temp.innerHTML = html;
  temp.style.position = 'fixed';
  temp.style.left = '0';
  temp.style.top = '0';
  temp.style.width = '800px';
  temp.style.background = '#fff';
  temp.style.zIndex = '150';
  temp.style.pointerEvents = 'none';
  document.body.appendChild(temp);

  downloadPDF('khataPdfContent', 'Khata_Report.pdf').finally(() => temp.remove());
}

function downloadFullYearReport(){
  let now = new Date();
  let start = new Date(now.getFullYear(), 0, 1);
  let end = new Date(now.getFullYear(), 11, 31);

  let filtered = orders.filter(o => {
    let d = new Date(o.date);
    return d >= start && d <= end;
  });

  if (!filtered.length) {
    showToast('⚠️ No orders this year');
    return;
  }

  let totalRev = filtered.reduce((s, o) => s + o.orderTotal, 0);
  let totalWood = filtered.reduce((s, o) => s + (o.totalWoodCft || 0), 0);
  let totalProfit = filtered.reduce((s, o) => s + (o.netProfit || 0), 0);

  let html = `
    <div id="yearReportContent" style="font-family:sans-serif;padding:20px;max-width:800px;margin:auto;background:#fff;">
      <div style="text-align:center;border-bottom:2px solid #c8963e;padding-bottom:10px;margin-bottom:14px;">
        <h1 style="font-size:22px;">${esc(businessProfile.name)}</h1>
        <p style="font-size:10px;color:#666;">Full Year Report ${now.getFullYear()}</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:14px;">
        <div style="text-align:center;padding:10px;background:#f0f4fa;border-radius:8px;"><strong>Orders</strong><br>${filtered.length}</div>
        <div style="text-align:center;padding:10px;background:#f0f4fa;border-radius:8px;"><strong>Revenue</strong><br>${fmtRs(totalRev)}</div>
        <div style="text-align:center;padding:10px;background:#f0f4fa;border-radius:8px;"><strong>Wood</strong><br>${totalWood.toFixed(1)} cft</div>
        <div style="text-align:center;padding:10px;background:#f0f4fa;border-radius:8px;"><strong>Profit</strong><br>${fmtRs(totalProfit)}</div>
      </div>
      ${filtered.map(o => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #eee;font-size:9px;">
          <span>${o.orderNo} - ${getPartyName(o.partyId)}</span>
          <span>${fmtRs(o.orderTotal)}</span>
        </div>
      `).join('')}
    </div>
  `;

  let temp = document.createElement('div');
  temp.innerHTML = html;
  temp.style.position = 'fixed';
  temp.style.left = '0';
  temp.style.top = '0';
  temp.style.width = '800px';
  temp.style.background = '#fff';
  temp.style.zIndex = '150';
  temp.style.pointerEvents = 'none';
  document.body.appendChild(temp);

  downloadPDF('yearReportContent', `Year_Report_${now.getFullYear()}.pdf`).finally(() => temp.remove());
}

function downloadReportPDF(){
  let content = document.getElementById('reportsContent');
  if (!content || !content.innerHTML.trim()) {
    showToast('⚠️ No data to export');
    return;
  }

  let period = document.getElementById('reportPeriod')?.value || 'month';
  let html = `
    <div id="reportPdfContent" style="font-family:sans-serif;padding:20px;max-width:800px;margin:auto;background:#fff;">
      <div style="text-align:center;border-bottom:2px solid #c8963e;padding-bottom:10px;margin-bottom:14px;">
        <h1 style="font-size:22px;">${esc(businessProfile.name)}</h1>
        <p style="font-size:10px;color:#666;">Report (${period})</p>
        <p style="font-size:9px;color:#888;">${new Date().toLocaleDateString()}</p>
      </div>
      ${content.innerHTML}
    </div>
  `;

  let temp = document.createElement('div');
  temp.innerHTML = html;
  temp.style.position = 'fixed';
  temp.style.left = '0';
  temp.style.top = '0';
  temp.style.width = '800px';
  temp.style.background = '#fff';
  temp.style.zIndex = '150';
  temp.style.pointerEvents = 'none';
  document.body.appendChild(temp);

  downloadPDF('reportPdfContent', `Report_${period}.pdf`).finally(() => temp.remove());
}

function exportKhataCSV(){
  let rows=[['Party','Orders','Total Sales','Paid','Balance']];
  parties.forEach(p=>{
    let pOrders=orders.filter(o=>o.partyId===p.id);
    let total=pOrders.reduce((s,o)=>s+o.orderTotal,0);
    let paid=pOrders.reduce((s,o)=>s+getOrderTotalPaid(o),0);
    rows.push([p.name,pOrders.length,total,paid,total-paid]);
  });
  let csv=rows.map(r=>r.join(',')).join(String.fromCharCode(10));
  let blob=new Blob([csv],{type:'text/csv'});
  let a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='khata_export.csv';
  a.click();
  showToast('📊 CSV downloaded');
}

// ─── INIT ───────────────────────────────────────────
async function init(){
  if(window.HKStore){try{_bootRaw=await HKStore.boot();}catch(e){}}
  loadData();
  orders.forEach(o=>{
    if(o.doors){
      let totalLabour=o.doors.reduce((s,d)=>s+(parseFloat(d.labourPerDoor)||0),0);
      o.totalLabour=totalLabour;
      o.netProfit=o.orderTotal-(o.totalWoodCost||0)-totalLabour-(o.materialCost||0);
    }
  });
  applyTheme(getSavedTheme());
  wireNavigation();
  updateUserBadge();
  updateKhataFilter();
  renderAll();
  tryInitFirebaseOnLoad(40);
  checkBackupReminder();
  document.dispatchEvent(new Event('hk:ready'));
  setInterval(()=>{saveLocal();if(cloudEnabled&&_cloudDirty)syncNow();},30000);
  // Save straight away when the app goes to the background or is closed.
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveLocal();});
}

document.addEventListener('DOMContentLoaded',init);

// ─── SERVICE WORKER (offline support + PWA installability) ───
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').catch(()=>{/* ignore if not served over http(s) */});
  });
}
