// HK Wood Doors ERP — the ☰ main menu
// One long list of ~60 items became hard to use, so the same buttons are sorted
// into a few clear groups and shown as tiles (a list on a laptop), with:
//   • a header with the shop name, date and cloud status
//   • four big quick actions (+ Order, Payment, Kharcha, Party)
//   • "Aksar istemal": the items this device opens most
//   • groups that fold open/closed (remembered) and a search that looks everywhere
// The original buttons are moved, not copied, so every module's menu item keeps
// working, and items added later are sorted in too.
(function(){
  const GROUPS=[
    ['kaam','🛒','Orders aur Kaam',['tabHome','tabOrders','openQuickPrice','openAlbum','openQuotationList','tabProduction','openWorkshopBoard','openCuttingPicker','openMorning','openDayClose']],
    ['gahak','📒','Gahak aur Wasooli',['tabKhata','tabParties','openBulkReminders','openReminderCenter','openOldCustomers','openStatements','openCatalog','openImport']],
    ['paisa','💰','Paisa',['openMyPosition','tabBankBook','tabExpenses','openBills','openChequeListModal','openLoans','setSalesTarget']],
    ['karigar','👷','Karigar',['tabLabour','openKarigarPay','openKarigarList','openAttendanceModal','openKarigarReport','openTools']],
    ['maal','🪵','Maal aur Rate',['tabInventory','tabPurchases','tabSuppliers','openWoodStockModal','openWoodBuyList','openStockCount','openPriceListModal','openRateChange','openRateListPdf','openRawMaterialCalcModal']],
    ['report','📊','Reports',['tabReports','openProfitReport','openDesignReport','openYearReport','exportExcel','openActivityLog']],
    ['app','⚙️','Settings aur Madad',[]] // everything else
  ];
  const SHORT={tabHome:'Home',openMorning:'Subah ka Khaka',openDayClose:'Aaj ka Hisaab',openKarigarPay:'Karigar Payment',openWoodBuyList:'Lakri List',
    tabOrders:'Orders',openQuickPrice:'Fauri Qeemat',openAlbum:'Design Album',openQuotationList:'Estimates',tabProduction:'Production',openWorkshopBoard:'Kaam ka Board',openCuttingPicker:'Cutting List',
    tabLabour:'Labour',openKarigarReport:'Karigar Report',tabKhata:'Party Khata',openBulkReminders:'Wasooli Yaad Dahani',tabParties:'Parties',
    openOldCustomers:'Purane Gahak',openImport:'Excel se Parties',tabInventory:'Stock',tabPurchases:'Khareed',tabSuppliers:'Suppliers',
    tabExpenses:'Kharcha',openMyPosition:'Kul Hisaab',openBills:'Mahana Bill',tabBankBook:'Bank / Cash',openChequeListModal:'Cheques',openLoans:'Zaati Qarz',
    tabReports:'Reports',openDesignReport:'Design Report',openYearReport:'Saal ka Hisaab',setSalesTarget:'Mahine ka Hadaf',
    openStatements:'Mahana Statement',openProfitReport:'Munafa Report',exportExcel:'Excel Export',tabRecycle:'Recycle Bin',
    openSearchModal:'Search',openQrScan:'QR Scan',openCalculator:'Calculator',openKarigarList:'Karigar',openTools:'Auzaar',
    openAttendanceModal:'Hazri',openWoodStockModal:'Wood Stock',openStockCount:'Stock Ginti',openPriceListModal:'Rate List',
    openRateChange:'Rate Badlein',openRateListPdf:'Rate List PDF',openCatalog:'Online Catalog',openRawMaterialCalcModal:'Material Calc',
    openBusinessCardModal:'Business Card',openReminderCenter:'Payment Reminders',openUserSwitcher:'Staff / Users',openActivityLog:'Activity',
    openApkInfo:'Android App',openDataSafety:'Data ki Hifazat',openFbSetup:'Cloud Setup',openAutoSettings:'Auto System',
    installApp:'App Install',openSettingsModal:'Settings',toggleDarkMode:'Dark / Light'};
  const USE_KEY='hk_menu_use',FOLD_KEY='hk_menu_folded';
  function store(k,v){try{if(v===undefined)return JSON.parse(localStorage.getItem(k)||'null');localStorage.setItem(k,JSON.stringify(v));}catch(e){return null;}}
  function keyOf(b){
    if(b.dataset.tab)return b.dataset.tab;
    let m=(b.getAttribute('onclick')||'').match(/([A-Za-z_$][\w$]*)\s*\(/);
    return m?m[1]:b.id||'';
  }
  function groupOf(k){let g=GROUPS.find(g=>g[3].includes(k));return g?g[0]:'app';}

  // Turn a menu button into a tile: icon on top, a short name, full name as tooltip.
  function tidy(b){
    if(b.dataset.hkTidy)return;
    b.dataset.hkTidy='1';
    let k=keyOf(b);b.dataset.key=k;
    if(b.querySelector('.hk-lang-label')){b.querySelector('.hk-lang-label').classList.add('t-label');return;}
    let full='';
    [...b.childNodes].forEach(n=>{if(n.nodeType===3&&n.nodeValue.trim()){full+=n.nodeValue.trim();n.remove();}});
    if(!b.querySelector('.t-label')){
      let s=document.createElement('span');s.className='t-label';s.textContent=SHORT[k]||full;b.appendChild(s);
    }
    if(full)b.title=full;
  }
  function build(){
    let body=document.querySelector('#drawerNav .drawer-body');if(!body)return;
    let search=body.querySelector('.search-bar');
    body.querySelectorAll('.drawer-section-label').forEach(l=>l.remove());
    let wrap=document.getElementById('hkMenu');
    if(!wrap){
      wrap=document.createElement('div');wrap.id='hkMenu';
      let folded=store(FOLD_KEY)||[];
      wrap.innerHTML=`<div class="hk-menu-quick">
          <button onclick="closeDrawer();openOrderModal()"><span>➕</span>Naya Order</button>
          <button onclick="closeDrawer();quickAddPayment()"><span>💳</span>Payment</button>
          <button onclick="closeDrawer();openExpenseModal()"><span>🧾</span>Kharcha</button>
          <button onclick="closeDrawer();openPartyModal()"><span>👤</span>Party</button></div>
        <div class="hk-menu-sec hk-menu-fav" id="hkMenuFav" hidden><div class="hk-menu-title">⭐ Aksar istemal</div><div class="hk-menu-grid"></div></div>`+
        GROUPS.map(([id,icon,title])=>`<div class="hk-menu-sec${folded.includes(id)?' folded':''}" data-group="${id}">
          <button class="hk-menu-title" onclick="hkToggleMenuGroup('${id}')"><span>${icon} ${title}</span><span class="hk-menu-chev">⌄</span></button>
          <div class="hk-menu-grid"></div></div>`).join('');
      if(search)search.after(wrap);else body.prepend(wrap);
    }
    sortItems();
    renderFav();
  }
  function sortItems(){
    let wrap=document.getElementById('hkMenu');if(!wrap)return;
    document.querySelectorAll('#drawerNav .drawer-item').forEach(b=>{
      if(b.closest('#hkMenuFav'))return;
      tidy(b);
      let g=wrap.querySelector(`.hk-menu-sec[data-group="${groupOf(b.dataset.key)}"] .hk-menu-grid`);
      if(g&&b.parentElement!==g){
        // Keep the order given in GROUPS; unknown items go to the end.
        let order=(GROUPS.find(x=>x[0]===groupOf(b.dataset.key))||[])[3]||[];
        let i=order.indexOf(b.dataset.key);
        let before=i<0?null:[...g.children].find(c=>{let j=order.indexOf(c.dataset.key);return j<0||j>i;});
        g.insertBefore(b,before||null);
      }
    });
  }
  // "Aksar istemal": copies of the 6 most opened items (clicks go to the original).
  function renderFav(){
    let box=document.getElementById('hkMenuFav');if(!box)return;
    let use=store(USE_KEY)||{};
    let top=Object.entries(use).filter(([k,n])=>n>=2).sort((a,b)=>b[1]-a[1]).map(([k])=>k)
      .map(k=>document.querySelector(`#hkMenu .hk-menu-grid .drawer-item[data-key="${k}"]`))
      .filter(b=>b&&!b.classList.contains('hk-staff-hide')).slice(0,6);
    let grid=box.querySelector('.hk-menu-grid');
    grid.innerHTML='';
    top.forEach(b=>{
      let c=document.createElement('button');
      c.className='drawer-item hk-fav-item';c.dataset.key=b.dataset.key;c.innerHTML=b.innerHTML;c.title=b.title;
      c.onclick=()=>b.click();
      grid.appendChild(c);
    });
    box.hidden=!top.length;
  }
  window.hkToggleMenuGroup=function(id){
    let sec=document.querySelector(`#hkMenu .hk-menu-sec[data-group="${id}"]`);if(!sec)return;
    sec.classList.toggle('folded');
    store(FOLD_KEY,[...document.querySelectorAll('#hkMenu .hk-menu-sec.folded')].map(s=>s.dataset.group));
  };
  // Count what is opened (the original buttons only; favourites click those).
  document.addEventListener('click',e=>{
    let b=e.target.closest&&e.target.closest('#drawerNav .drawer-item');
    if(!b||b.classList.contains('hk-fav-item')||!b.dataset.key)return;
    let use=store(USE_KEY)||{};use[b.dataset.key]=(use[b.dataset.key]||0)+1;store(USE_KEY,use);
  },true);

  // Search looks in every group (folded ones too) and in the full names.
  window.filterDrawerItems=function(q){
    q=(q||'').trim().toLowerCase();
    let menu=document.getElementById('hkMenu');
    if(menu)menu.classList.toggle('searching',!!q);
    document.querySelectorAll('#hkMenu .hk-menu-grid .drawer-item:not(.hk-fav-item)').forEach(b=>{
      let hit=!q||(b.textContent+' '+(b.title||'')+' '+(b.dataset.key||'')).toLowerCase().includes(q);
      b.classList.toggle('hk-search-miss',!hit);
    });
    document.querySelectorAll('#hkMenu .hk-menu-sec[data-group]').forEach(s=>{
      let any=[...s.querySelectorAll('.drawer-item')].some(b=>!b.classList.contains('hk-search-miss')&&!b.classList.contains('hk-staff-hide'));
      s.classList.toggle('hk-search-miss',!!q&&!any);
    });
  };

  // Header: shop name, today's date, cloud status.
  function renderHead(){
    let head=document.querySelector('#drawerNav .drawer-head');if(!head)return;
    let name=(window.businessProfile&&businessProfile.name)||'HK WOOD DOORS';
    let on=typeof cloudEnabled!=='undefined'&&cloudEnabled;
    let cfg=typeof getFirebaseCfg==='function'&&getFirebaseCfg();
    head.innerHTML=`<div class="hk-menu-head">
        <div class="hk-menu-logo"><img src="logo.png" alt=""></div>
        <div style="min-width:0;flex:1;"><div class="hk-menu-name">${esc(name)}</div>
          <div class="hk-menu-sub">${new Date().toLocaleDateString('en-PK',{weekday:'short',day:'numeric',month:'short'})}
            <span class="hk-menu-cloud ${on?'ok':cfg?'warn':'bad'}">${on?'☁️ Cloud juda':cfg?'⏳ Offline':'⚠️ Cloud nahi'}</span></div></div>
        <button class="modal-close" onclick="closeDrawer()">✕</button></div>`;
  }
  let origOpenDrawer=window.openDrawer;
  window.openDrawer=function(){
    try{renderHead();sortItems();renderFav();}catch(e){console.warn('Menu:',e);}
    return origOpenDrawer.apply(this,arguments);
  };
  window.hkMenuRefresh=()=>{renderHead();sortItems();renderFav();};
  let origSync=window.setSyncStatus;
  if(origSync)window.setSyncStatus=function(){let r=origSync.apply(this,arguments);try{renderHead();}catch(e){}return r;};

  document.addEventListener('hk:ready',()=>{
    // Other modules add their items on hk:ready too; sort once they are in.
    setTimeout(()=>{
      try{build();renderHead();}catch(e){console.warn('Menu:',e);}
      let body=document.querySelector('#drawerNav .drawer-body');
      if(body)new MutationObserver(ms=>{
        if(ms.some(m=>[...m.addedNodes].some(n=>n.classList&&n.classList.contains('drawer-item')&&!n.dataset.hkTidy)))sortItems();
      }).observe(body,{childList:true,subtree:true});
    },0);
  });
})();
