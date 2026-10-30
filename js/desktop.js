// HK Wood Doors ERP — laptop helpers: keyboard shortcuts.
//   Ctrl/⌘ + K  → search        Alt + N → new order
//   Alt + P     → payment       Alt + E → kharcha
//   Esc         → close the top window (or the menu on phone)
(function(){
  function typing(e){let t=e.target;return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);}
  document.addEventListener('keydown',e=>{
    if(document.querySelector('.hk-pin-overlay'))return; // PIN screen open
    let k=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&k==='k'){e.preventDefault();openSearchModal();return;}
    if(e.altKey&&!typing(e)){
      let map={n:()=>openOrderModal(),p:()=>quickAddPayment(),e:()=>openExpenseModal()};
      if(map[k]){e.preventDefault();map[k]();}
      return;
    }
    if(k==='escape'){
      let open=[...document.querySelectorAll('.modal.open')];
      if(open.length){closeModal(open[open.length-1].id);return;}
      if(document.getElementById('drawerNav')?.classList.contains('open'))closeDrawer();
    }
  });
  document.addEventListener('hk:ready',()=>{
    // Show the shortcut next to the header buttons on laptops.
    let order=document.querySelector('.hdr-btn.gold');
    if(order&&!order.querySelector('.hk-kbd'))order.insertAdjacentHTML('beforeend','<span class="hk-kbd" style="color:#fff;border-color:rgba(255,255,255,.4);">Alt+N</span>');
  });
})();

// ── "Install the app" button ──
// Chrome and Edge (laptop and Android) can install the app as a normal program.
// The browser hides that option in its menus, so the app offers its own button.
(function(){
  let deferred=null;
  function installed(){
    return window.matchMedia&&(matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: window-controls-overlay)').matches)||navigator.standalone===true;
  }
  function browserName(){
    let ua=navigator.userAgent;
    if(/Edg\//.test(ua))return 'edge';
    if(/OPR\//.test(ua))return 'opera';
    if(/Firefox\//.test(ua))return 'firefox';
    if(/Chrome\//.test(ua))return 'chrome';
    if(/Safari\//.test(ua))return 'safari';
    return 'other';
  }
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;refresh();});
  window.addEventListener('appinstalled',()=>{deferred=null;refresh();showToast('✅ App install ho gayi — Desktop / Start menu mein "HK Doors"');});

  window.installApp=async function(){
    if(deferred){
      deferred.prompt();
      let res=null;try{res=await deferred.userChoice;}catch(e){}
      deferred=null;refresh();
      if(res&&res.outcome==='accepted')showToast('✅ Install ho rahi hai…');
      return;
    }
    // The browser didn't offer an install prompt: explain what to do instead.
    let b=browserName(),url=location.origin+location.pathname;
    let how={
      chrome:'Upar address bar ke bilkul daayein kone mein 🖥️⬇ nishaan dabayein → Install. Na mile to ⋮ menu → "Cast, save and share" → "Install page as app".',
      edge:'⋯ menu → Apps → "Install this site as an app" → Install.',
      opera:'Opera mein install ka option kam hota hai — yeh link Google Chrome ya Microsoft Edge mein kholein.',
      firefox:'Firefox mein app install nahi hoti — yeh link Google Chrome ya Microsoft Edge mein kholein, wahan yeh button kaam karega.',
      safari:'iPhone/iPad: neeche Share (⬆️) → "Add to Home Screen". Mac: File → "Add to Dock".',
      other:'Yeh link Google Chrome ya Microsoft Edge mein kholein.'
    }[b];
    let m=document.getElementById('hkInstallModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkInstallModal';
      m.innerHTML=`<div class="modal-box" style="max-width:460px;"><div class="modal-head">💻 App Install Karein <button class="modal-close" onclick="closeModal('hkInstallModal')">✕</button></div><div class="modal-body" id="hkInstallBody"></div></div>`;
      document.body.appendChild(m);
    }
    document.getElementById('hkInstallBody').innerHTML=installed()
      ?'<p style="font-size:12px;">✅ Yeh app pehle se install hai aur alag khidki mein chal rahi hai.</p>'
      :`<p style="font-size:12px;line-height:1.6;">${how}</p>
        <p style="font-size:11px;margin-top:10px;">App ka link:</p>
        <div style="display:flex;gap:6px;align-items:center;"><input class="form-input" readonly value="${esc(url)}" style="font-size:11px;"><button class="btn btn-outline btn-sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(url)}').then(()=>showToast('📋 Link copy'))">📋</button></div>
        <p style="font-size:10px;color:var(--gray-500);margin-top:10px;">Agar pehle se install hai to Start menu / Desktop par "HK Doors" dhoondein. Incognito (private) window mein install nahi hoti.</p>`;
    if(!m.classList.contains('open'))openModal('hkInstallModal');
  };

  function refresh(){
    let hide=installed();
    let hdr=document.getElementById('hkInstallHdr');
    if(!hdr){
      let right=document.querySelector('.header-right');
      if(right){right.insertAdjacentHTML('afterbegin','<button class="hdr-btn" id="hkInstallHdr" onclick="installApp()" title="App install karein">💻 Install</button>');hdr=document.getElementById('hkInstallHdr');}
    }
    // Header button only when the browser is ready to install (keeps the header tidy).
    if(hdr)hdr.style.display=(!hide&&deferred)?'':'none';
    let item=document.getElementById('hkInstallDrawerBtn');
    if(!item){
      let anchor=[...document.querySelectorAll('.drawer-item')].find(b=>(b.getAttribute('onclick')||'').includes('openSettingsModal'));
      if(anchor){anchor.insertAdjacentHTML('beforebegin','<button class="drawer-item" id="hkInstallDrawerBtn" onclick="installApp();closeDrawer();"><span class="t-icon">💻</span>App Install Karein (Laptop / Mobile)</button>');item=document.getElementById('hkInstallDrawerBtn');}
    }
    if(item)item.style.display=hide?'none':'';
  }
  document.addEventListener('hk:ready',refresh);
})();
