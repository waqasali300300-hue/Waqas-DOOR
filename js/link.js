// HK Wood Doors ERP — joining phone and laptop to the same cloud data
// Each device keeps its own copy; they share data only when both use the same
// Cloud Setup (Firebase project + login). This makes that easy and visible:
//   • a "link code" (and QR) from a device that is already connected,
//   • pasting that code on the other device fills in Cloud Setup,
//   • Home shows clearly whether this device is connected.
// The code never contains the password; it is typed on the new device.
(function(){
  const PREFIX='HKDOOR:';

  function makeCode(){
    let c=getFirebaseCfg();if(!c)return '';
    let data={apiKey:c.apiKey,authDomain:c.authDomain,projectId:c.projectId,appId:c.appId,email:c.email||''};
    return PREFIX+btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  }
  function readCode(text){
    let t=String(text||'').trim();
    let i=t.indexOf(PREFIX);if(i<0)return null;
    try{
      let d=JSON.parse(decodeURIComponent(escape(atob(t.slice(i+PREFIX.length).split(/\s/)[0]))));
      return d&&d.apiKey&&d.projectId?d:null;
    }catch(e){return null;}
  }

  // ── On a connected device: show the code ──
  window.openLinkDevice=function(){
    let code=makeCode();
    let m=document.getElementById('hkLinkModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkLinkModal';
      m.innerHTML=`<div class="modal-box" style="max-width:460px;"><div class="modal-head">📲 Doosra device jorein <button class="modal-close" onclick="closeModal('hkLinkModal')">✕</button></div><div class="modal-body" id="hkLinkBody"></div></div>`;
      document.body.appendChild(m);
    }
    let body=document.getElementById('hkLinkBody');
    if(!code){
      body.innerHTML=`<p style="font-size:12px;">Is device par abhi Cloud Setup nahi hua. Pehle ☰ → <b>Cloud Backup Setup</b> mein Firebase aur login bharein, phir yahan code milega.</p>
        <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:8px;" onclick="closeModal('hkLinkModal');openFbSetup()">🔥 Cloud Setup kholein</button>`;
    }else{
      window._hkLinkCode=code;
      body.innerHTML=`<ol style="font-size:12px;line-height:1.7;padding-left:18px;margin-bottom:10px;">
          <li>Neeche wala code copy karein ya WhatsApp par khud ko bhejein.</li>
          <li>Doosre device (laptop/mobile) par app kholein → ☰ → <b>Cloud Backup Setup</b>.</li>
          <li>Wahan "Link code" mein paste karein, <b>wahi password</b> likhein → Connect.</li>
        </ol>
        <div id="hkLinkQR" style="display:flex;justify-content:center;margin:8px 0;"></div>
        <textarea class="form-input" readonly style="font-size:10px;height:70px;font-family:var(--font-mono);">${esc(code)}</textarea>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn btn-primary" style="flex:1;justify-content:center;" onclick="copyLinkCode()">📋 Copy</button>
          <button class="btn btn-success" style="flex:1;justify-content:center;" onclick="window.open('https://wa.me/?text='+encodeURIComponent(window._hkLinkCode),'_blank')">💬 WhatsApp</button>
        </div>
        <p style="font-size:9.5px;color:var(--gray-500);margin-top:8px;">Code mein password nahi hota. Jis device par password likha jaye, wohi jud sakta hai.</p>`;
      try{if(typeof QRCode!=='undefined')new QRCode(document.getElementById('hkLinkQR'),{text:code,width:170,height:170,correctLevel:QRCode.CorrectLevel?QRCode.CorrectLevel.L:undefined});}catch(e){}
    }
    if(!m.classList.contains('open'))openModal('hkLinkModal');
  };
  window.copyLinkCode=function(){
    let t=window._hkLinkCode||'';
    (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>showToast('📋 Code copy ho gaya'),()=>showToast('⚠️ Copy nahi hua — khud select karein'));
  };

  // ── On the new device: paste the code in Cloud Setup ──
  // Firebase's own snippet, as shown after "Register app" (apiKey: "…", …).
  // Works with or without quotes around the names, and with JSON too.
  function readFirebaseSnippet(text){
    let t=String(text||'');
    let get=k=>{let m=t.match(new RegExp('["\']?'+k+'["\']?\\s*[:=]\\s*["\'`]([^"\'`\\s]+)["\'`]'));return m?m[1].trim():'';};
    let d={apiKey:get('apiKey'),authDomain:get('authDomain'),projectId:get('projectId'),appId:get('appId')};
    if(!d.apiKey||!d.projectId)return null;
    if(!d.authDomain)d.authDomain=d.projectId+'.firebaseapp.com';
    return d;
  }

  // One box takes either a link code from another device or Firebase's snippet.
  window.applyLinkCode=function(quiet){
    let el=document.getElementById('fb_linkCode');
    let text=el&&el.value;
    let d=readCode(text),fromSnippet=false;
    if(!d){d=readFirebaseSnippet(text);fromSnippet=!!d;}
    if(!d){if(!quiet)showToast('⚠️ Code samajh nahi aaya — Firebase ka poora code ya HKDOOR code paste karein');return false;}
    let set=(id,v)=>{let x=document.getElementById(id);if(x&&v!==undefined)x.value=v||'';};
    set('fb_apiKey',d.apiKey);set('fb_authDomain',d.authDomain);set('fb_projectId',d.projectId);set('fb_appId',d.appId);
    if(d.email)set('fb_email',d.email);
    if(typeof updateFbRulesHint==='function')updateFbRulesHint();
    let msg=document.getElementById('fb_linkMsg');
    if(msg)msg.innerHTML=fromSnippet
      ?'✅ 4 cheezein bhar gayin. Ab neeche <b>Email</b> aur <b>Password</b> likhein, Step 5 ke Rules Publish karein, phir Connect.'
      :'✅ Code lag gaya. Ab <b>wahi password</b> likh kar Connect dabayein.';
    showToast(fromSnippet?'✅ Firebase code se 4 khane bhar gaye':'✅ Code lag gaya — password likh kar Connect');
    (fromSnippet&&!document.getElementById('fb_email')?.value?document.getElementById('fb_email'):document.getElementById('fb_password'))?.focus();
    return true;
  };
  window.hkReadFirebaseSnippet=readFirebaseSnippet;
  function addLinkBox(){
    let first=document.querySelector('#fbSetupOverlay .fb-step');
    if(!first||document.getElementById('fb_linkCode'))return;
    first.insertAdjacentHTML('beforebegin',`<div class="fb-step" style="border:1px dashed rgba(255,255,255,.35);">
      <strong>📋 Code yahan paste karein</strong> — inn mein se koi bhi:
      <div style="font-size:9px;opacity:.85;margin-top:3px;">• Firebase ka <b>poora code</b> (Register app ke baad jo dikhta hai — <i>const firebaseConfig = {…}</i>)<br>• Ya doosre device ka <b>HKDOOR</b> code (☰ → Settings → Doosra device jorein)</div>
      <textarea class="fb-input" id="fb_linkCode" placeholder="const firebaseConfig = { apiKey: ... }  ya  HKDOOR:..." style="height:70px;margin-top:6px;" oninput="applyLinkCode(true)"></textarea>
      <button class="btn btn-outline btn-xs" type="button" onclick="applyLinkCode()">✅ Code lagayein</button>
      <div id="fb_linkMsg" style="font-size:9px;margin-top:4px;"></div></div>`);
  }

  // ── Settings: button to show the code ──
  let origOpenSettings=window.openSettingsModal;
  window.openSettingsModal=function(){
    origOpenSettings.apply(this,arguments);
    let info=document.getElementById('hkStorageInfo');
    if(info&&!document.getElementById('hkLinkBtn'))info.insertAdjacentHTML('beforebegin','<button id="hkLinkBtn" class="btn btn-gold btn-sm" style="margin-top:8px;" onclick="closeModal(\'settingsModal\');openLinkDevice()">📲 Doosra device jorein (laptop / mobile)</button>');
  };

  // ── Home: say clearly whether this device shares data ──
  function renderCloudBanner(){
    let head=document.querySelector('#tabHome .hm-head');if(!head)return;
    let el=document.getElementById('hmCloud');
    if(!el){el=document.createElement('div');el.id='hmCloud';head.after(el);}
    let cfg=getFirebaseCfg();
    if(cloudEnabled){el.className='hm-cloud ok';el.innerHTML=`☁️ Cloud se juda hai — mobile aur laptop par ek hi data <button class="hm-link" onclick="openLinkDevice()">📲 Device jorein ›</button>`;return;}
    if(cfg){el.className='hm-cloud warn';el.innerHTML=`⚠️ Cloud abhi juda nahi (internet ya login) — nayi entries baad mein sync hongi <button class="hm-link" onclick="openFbSetup()">Login ›</button>`;return;}
    el.className='hm-cloud bad';
    el.innerHTML=`⚠️ Yeh data <b>sirf isi device</b> par hai — mobile aur laptop alag alag hain. <button class="hm-link" onclick="openFbSetup()">☁️ Cloud se jorein ›</button>`;
  }
  window.hkRenderCloudBanner=renderCloudBanner;
  let origSetSync=window.setSyncStatus;
  window.setSyncStatus=function(){let r=origSetSync.apply(this,arguments);try{renderCloudBanner();}catch(e){}return r;};
  let origRenderDashboard=window.renderDashboard;
  window.renderDashboard=function(){let r=origRenderDashboard.apply(this,arguments);try{renderCloudBanner();}catch(e){}return r;};

  document.addEventListener('hk:ready',()=>{addLinkBox();renderCloudBanner();});
  window.hkLinkCode={make:makeCode,read:readCode};
})();
