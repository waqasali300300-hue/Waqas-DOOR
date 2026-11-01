// HK Wood Doors ERP — Android app (APK) support
// The APK carries all app files inside it (no website needed to open). Inside the
// APK a few browser features work differently, so they are handled here:
//   • PDF / Excel / backup files: saved to the phone and the share sheet opens
//   • WhatsApp, phone and other links: open in their own app
//   • Links sent to customers point to the online copy, not to the phone
//   • A note when a newer APK is available
// In a normal browser this file only adds the "Android App (APK)" menu item.
(function(){
  const PUBLIC_BASE='https://waqasali300300-hue.github.io/Waqas-DOOR/';
  const APK_URL='https://github.com/waqasali300300-hue/Waqas-DOOR/releases/download/apk-latest/HK-Doors.apk';
  const RELEASE_API='https://api.github.com/repos/waqasali300300-hue/Waqas-DOOR/releases/tags/apk-latest';
  let cap=window.Capacitor;
  let native=!!(cap&&typeof cap.isNativePlatform==='function'&&cap.isNativePlatform());
  window.hkNative=native;
  window.hkApkUrl=APK_URL;
  // Base address for links that other people open (catalog, order status, join code).
  window.hkPublicBase=function(){
    return native?PUBLIC_BASE:location.origin+location.pathname.replace(/[^/]*$/,'');
  };

  function addMenu(){
    if(native||document.getElementById('hkApkBtn'))return;
    let anchor=[...document.querySelectorAll('.drawer-item')].find(b=>(b.getAttribute('onclick')||'').includes('openFbSetup'));
    if(!anchor)return;
    anchor.insertAdjacentHTML('beforebegin',`<button class="drawer-item" id="hkApkBtn" onclick="openApkInfo();closeDrawer();"><span class="t-icon">📱</span>Android App (APK)</button>`);
  }
  window.openApkInfo=function(){
    let m=document.getElementById('hkApkModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkApkModal';
      m.innerHTML=`<div class="modal-box" style="max-width:460px;"><div class="modal-head">📱 Android App (APK) <button class="modal-close" onclick="closeModal('hkApkModal')">✕</button></div><div class="modal-body" id="hkApkBody"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById('hkApkBody').innerHTML=`
      <p style="font-size:11px;line-height:1.7;">Yeh app ki APK file hai — phone mein install ho kar alag app ki tarah chalti hai, website ke baghair khulti hai.</p>
      <ol style="font-size:11px;line-height:1.8;padding-left:18px;margin:8px 0;">
        <li>Neeche wala button dabayein — <b>HK-Doors.apk</b> download hogi.</li>
        <li>Download khol kar <b>Install</b> dabayein. Phone poochhe to "Is source se install ki ijazat" de dein.</li>
        <li>Nayi app khol kar ☰ → <b>Cloud Backup Setup</b> → yahan wala <b>link code</b> paste karein aur password likhein — sara data aa jayega.</li>
      </ol>
      <a class="btn btn-primary" style="width:100%;justify-content:center;text-decoration:none;" href="${APK_URL}">⬇️ APK Download Karein</a>
      <p style="font-size:9px;color:var(--gray-500);margin-top:8px;">APK file ko WhatsApp par khud ko bhej kar ya Google Drive mein rakh kar mehfooz kar sakte hain.</p>`;
    openModal('hkApkModal');
  };

  if(!native){
    document.addEventListener('hk:ready',addMenu);
    return;
  }

  // ════════ Inside the APK ════════
  document.documentElement.classList.add('hk-native');
  let P=()=>cap.Plugins||{};

  function blobToBase64(blob){
    return new Promise((res,rej)=>{let r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]||'');r.onerror=rej;r.readAsDataURL(blob);});
  }
  async function saveAndShare(href,name){
    try{
      let blob=await (await fetch(href)).blob();
      let data=await blobToBase64(blob);
      let fs=P().Filesystem;
      if(!fs)throw new Error('Filesystem nahi mila');
      // A copy stays in Documents/HK Doors so the file is safe on the phone.
      let saved=false;
      try{await fs.writeFile({path:'HK Doors/'+name,data,directory:'DOCUMENTS',recursive:true});saved=true;}catch(e){}
      let tmp=await fs.writeFile({path:name,data,directory:'CACHE'});
      showToast(saved?'✅ Save ho gaya: Documents → HK Doors':'✅ File tayyar');
      if(P().Share)await P().Share.share({title:name,files:[tmp.uri]}).catch(()=>{});
    }catch(e){
      console.warn('APK save:',e);
      showToast('⚠️ File save nahi hui: '+(e&&e.message||e));
    }
  }
  // Every download in the app goes through a link with a "download" name.
  let origClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    if(this.download&&/^(blob:|data:)/.test(this.href)){saveAndShare(this.href,this.download);return;}
    return origClick.call(this);
  };
  document.addEventListener('click',e=>{
    let a=e.target.closest&&e.target.closest('a[download]');
    if(a&&/^(blob:|data:)/.test(a.href)){e.preventDefault();saveAndShare(a.href,a.download);}
  },true);

  // WhatsApp, phone, maps and other outside links open in their own app.
  function external(url){
    try{let u=new URL(url,location.href);return u.origin!==location.origin;}catch(e){return false;}
  }
  function openOutside(url){
    let l=P().AppLauncher;
    if(l)l.openUrl({url}).catch(()=>{location.href=url;});
    else location.href=url;
  }
  let origOpen=window.open;
  window.open=function(url){
    if(url&&external(url)){openOutside(String(url));return null;}
    return origOpen.apply(window,arguments);
  };
  document.addEventListener('click',e=>{
    let a=e.target.closest&&e.target.closest('a[href]');
    if(!a||a.hasAttribute('download'))return;
    let href=a.getAttribute('href');
    if(href&&!href.startsWith('#')&&external(a.href)){e.preventDefault();openOutside(a.href);}
  },true);

  // Photo viewer used a new browser window; show it inside the app instead.
  function photoViewer(src){
    let ov=document.createElement('div');
    ov.style.cssText='position:fixed;inset:0;z-index:20000;background:#111;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML=`<img style="max-width:100%;max-height:100%;"><button style="position:absolute;top:14px;right:14px;width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,.2);color:#fff;font-size:18px;">✕</button>`;
    ov.querySelector('img').src=src;
    ov.onclick=()=>ov.remove();
    document.body.appendChild(ov);
  }

  // Tell the owner when a newer APK is out.
  async function checkUpdate(){
    let mine=Number(window.HK_APK_BUILD)||0;if(!mine)return;
    try{
      let r=await fetch(RELEASE_API,{cache:'no-store'});if(!r.ok)return;
      let m=/build:(\d+)/.exec((await r.json()).body||'');
      if(m&&Number(m[1])>mine){
        let b=document.createElement('button');
        b.className='hk-apk-update';
        b.textContent='⬆️ App ka naya version aa gaya — dabayein';
        b.onclick=()=>{openOutside(APK_URL);b.remove();};
        document.body.appendChild(b);
        setTimeout(()=>b.remove(),20000);
      }
    }catch(e){}
  }

  document.addEventListener('hk:ready',()=>{
    window.viewOrderPhotoFull=photoViewer;
    setTimeout(checkUpdate,4000);
  });
})();
