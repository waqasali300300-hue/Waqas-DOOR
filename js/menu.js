// HK Wood Doors ERP — the ☰ main menu
// One long list of ~60 items became hard to use, so the same buttons are sorted
// into a few clear groups and shown as tiles (a list on a laptop), with:
//   • a header with the shop name, date and cloud status
//   • four big quick actions (+ Order, Payment, Kharcha, Party)
//   • "Aksar istemal": the items this device opens most
//   • seven big group cards; a tap opens that group's buttons (‹ Wapas returns),
//     so the first screen fits on a phone without scrolling
//   • a mic button, and a search that looks in every group
// The original buttons are moved, not copied, so every module's menu item keeps
// working, and items added later are sorted in too.
(function(){
  const GROUPS=[
    ['kaam','🛒','Orders aur Kaam',['tabHome','tabOrders','openQuickPrice','openAlbum','openQuotationList','tabProduction','openWorkshopBoard','openCuttingPicker','openMorning','openDayClose']],
    ['gahak','📒','Gahak aur Wasooli',['tabKhata','tabParties','openBulkReminders','openReminderCenter','openOldCustomers','openStatements','openCatalog','openImport']],
    ['paisa','💰','Paisa',['openMyPosition','tabBankBook','tabExpenses','openBills','openChequeListModal','openLoans','setSalesTarget']],
    ['karigar','👷','Karigar',['tabLabour','openMazdoori','openKarigarPay','openKarigarList','openAttendanceModal','openKarigarReport','openTools']],
    ['maal','🪵','Maal aur Rate',['tabInventory','tabPurchases','tabSuppliers','openWoodStockModal','openWoodBuyList','openStockCount','openPriceListModal','openRateChange','openRateListPdf','openRawMaterialCalcModal']],
    ['report','📊','Reports',['tabReports','openProfitReport','openDesignReport','openYearReport','exportExcel','openActivityLog']],
    ['app','⚙️','Settings aur Madad',[]] // everything else
  ];
  const ABOUT={kaam:'Orders, estimate, production',gahak:'Khata, wasooli, parties',paisa:'Kul hisaab, bank, kharcha',
    karigar:'Labour, mazdoori, hazri',maal:'Stock, khareed, rate list',report:'Munafa, saal, excel',app:'Backup, cloud, settings'};
  const DEFAULT_FAV=['tabKhata','tabOrders','openMyPosition','openKarigarPay','tabBankBook','tabInventory'];
  const SHORT={tabHome:'Home',openMorning:'Subah ka Khaka',openDayClose:'Aaj ka Hisaab',openKarigarPay:'Karigar Payment',openMazdoori:'Di hui Mazdoori',openWoodBuyList:'Lakri List',
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
  const USE_KEY='hk_menu_use',FOLD_KEY='hk_menu_folded',PIN_KEY='hk_menu_pins',RECENT_KEY='hk_menu_recent';
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
      wrap=document.createElement('div');wrap.id='hkMenu';wrap.dataset.view='home';
      let pay=window.openPaisaEntry?'openPaisaEntry()':'quickAddPayment()';
      wrap.innerHTML=`<div class="hk-menu-quick">
          <button onclick="closeDrawer();openOrderModal()"><span>➕</span>Naya Order</button>
          <button onclick="closeDrawer();${pay}"><span>💳</span>Payment</button>
          <button onclick="closeDrawer();openExpenseModal()"><span>🧾</span>Kharcha</button>
          <button onclick="closeDrawer();openPartyModal()"><span>👤</span>Party</button></div>
        ${window.startVoice?`<button class="hk-menu-voice" onclick="closeDrawer();startVoice()"><span class="hk-mv-i">🎤</span><span class="hk-mv-t"><b>Bol kar kholein</b><small>maslan: "Aziz ka khata", "kul hisaab"</small></span></button>`:''}
        <div class="hk-menu-find" id="hkMenuFind"></div>
        <div class="hk-menu-recent" id="hkMenuRecent"></div>
        <div class="hk-menu-sec hk-menu-fav" id="hkMenuFav" hidden><div class="hk-menu-title">⭐ Aksar istemal <small class="hk-pin-hint">kisi bhi button ko dabaye rakhein → 📌 upar lag jayega</small></div><div class="hk-menu-grid"></div></div>
        <div class="hk-menu-cards" id="hkMenuCards">${GROUPS.map(([id,icon,title])=>`<button class="hk-menu-card" data-card="${id}" onclick="hkOpenMenuGroup('${id}')">
          <span class="hk-mc-icon">${icon}</span><span class="hk-mc-text"><b>${title}</b><small>${ABOUT[id]||''}</small></span><span class="hk-mc-n"></span><span class="hk-mc-alert" hidden></span></button>`).join('')}</div>`+
        GROUPS.map(([id,icon,title])=>`<div class="hk-menu-sec" data-group="${id}">
          <button class="hk-menu-title" onclick="hkMenuHome()"><span class="hk-menu-back">‹ Wapas</span><span>${icon} ${title}</span></button>
          <div class="hk-menu-grid"></div></div>`).join('');
      if(search)search.after(wrap);else body.prepend(wrap);
    }
    sortItems();
    renderFav();
    renderCards();
    renderRecent();
  }
  // Card counts: what this user can open in each group (staff see fewer).
  function renderCards(){
    document.querySelectorAll('#hkMenuCards .hk-menu-card').forEach(c=>{
      let n=[...document.querySelectorAll(`#hkMenu .hk-menu-sec[data-group="${c.dataset.card}"] .drawer-item`)].filter(b=>!b.classList.contains('hk-staff-hide')).length;
      c.querySelector('.hk-mc-n').textContent=n;
      c.hidden=!n;
    });
    try{
      let al=alerts();
      document.querySelectorAll('#hkMenuCards .hk-menu-card').forEach(c=>{
        let a=al[c.dataset.card],el=c.querySelector('.hk-mc-alert');
        el.hidden=!a;if(a){el.textContent=a.n;el.title=a.why;c.querySelector('small').textContent=a.why;}
        else c.querySelector('small').textContent=ABOUT[c.dataset.card]||'';
      });
    }catch(e){console.warn('menu alerts',e);}
  }
  function setView(v){
    let wrap=document.getElementById('hkMenu');if(!wrap)return;
    wrap.dataset.view=v;
    wrap.querySelectorAll('.hk-menu-sec[data-group]').forEach(s=>s.classList.toggle('on',s.dataset.group===v));
    let body=document.querySelector('#drawerNav .drawer-body');if(body)body.scrollTop=0;
  }
  window.hkOpenMenuGroup=id=>setView(id);
  window.hkMenuHome=()=>setView('home');
  window.hkToggleMenuGroup=id=>setView(id);   // older name
  // Phone back button: from a group, back to the cards first.
  window.hkMenuBack=function(){
    let wrap=document.getElementById('hkMenu');
    if(wrap&&wrap.dataset.view!=='home'&&!wrap.classList.contains('searching')){setView('home');return true;}
    return false;
  };
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
    let pins=store(PIN_KEY)||[];
    let keys=Object.entries(use).filter(([k,n])=>n>=2).sort((a,b)=>b[1]-a[1]).map(([k])=>k);
    if(!keys.length)keys=DEFAULT_FAV;
    keys=[...pins,...keys.filter(k=>!pins.includes(k))];
    let top=keys
      .map(k=>document.querySelector(`#hkMenu .hk-menu-grid .drawer-item[data-key="${k}"]`))
      .filter(b=>b&&!b.classList.contains('hk-staff-hide')).slice(0,Math.max(6,pins.length));
    let grid=box.querySelector('.hk-menu-grid');
    grid.innerHTML='';
    top.forEach(b=>{
      let c=document.createElement('button');
      c.className='drawer-item hk-fav-item'+(pins.includes(b.dataset.key)?' hk-pinned':'');c.dataset.key=b.dataset.key;c.innerHTML=b.innerHTML;c.title=b.title;
      c.onclick=()=>b.click();
      grid.appendChild(c);
    });
    box.hidden=!top.length;
  }
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
    try{renderHead();sortItems();renderFav();renderCards();renderRecent();setView('home');let i=document.querySelector('#drawerNav .search-bar input');if(i&&i.value){i.value='';filterDrawerItems('');}}catch(e){console.warn('Menu:',e);}
    return origOpenDrawer.apply(this,arguments);
  };
  window.hkMenuRefresh=()=>{renderHead();sortItems();renderFav();renderCards();};
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

  // ── Red marks on the cards: what needs doing today ──
  function num(v){return parseFloat(v)||0;}
  function alerts(){
    let t=new Date().toISOString().slice(0,10),out={},staff=typeof hkIsStaff==='function'&&hkIsStaff();
    let open=orders.filter(o=>(o.status||'pending')!=='delivered');
    let late=open.filter(o=>o.deliveryDate&&o.deliveryDate<t).length,due=open.filter(o=>o.deliveryDate===t).length;
    if(late+due)out.kaam={n:late+due,why:[late?late+' late':'',due?due+' aaj deni':''].filter(Boolean).join(', ')};
    if(!staff){
      let ch=(typeof cheques!=='undefined'?cheques:[]).filter(c=>c.status==='pending'&&c.dueDate&&c.dueDate<=t).length;
      if(ch)out.paisa={n:ch,why:ch+' cheque aaj / guzar gaye'};
      let month=new Date(Date.now()-30*864e5).toISOString().slice(0,10);
      let slow=parties.filter(p=>{
        if(getPartyBalance(p)<1)return false;
        let last='';
        getPartyOrders(p.id).forEach(o=>(o.payments||[]).forEach(x=>{if(String(x.date)>last)last=String(x.date);}));
        (p.partyPayments||[]).forEach(x=>{if(String(x.date)>last)last=String(x.date);});
        return !last||last<month;
      }).length;
      if(slow)out.gahak={n:slow,why:slow+' se mahine bhar se payment nahi'};
      let kd=new Set(labours.filter(l=>num(l.totalCost)>num(l.paid)).map(l=>String(l.karigarId))).size;
      if(kd)out.karigar={n:kd,why:kd+' karigar ka baqaya'};
    }
    let short=(window.hkWoodShort?hkWoodShort():[]).filter(r=>r.short>0).length+inventory.filter(i=>num(i.minStock)>0&&num(i.qty)<=num(i.minStock)).length;
    if(short)out.maal={n:short,why:short+' cheez kam hai'};
    return out;
  }
  window.hkMenuAlerts=alerts;

  // ── Pin: hold any tile for a moment → it stays on top (hold again to remove) ──
  function togglePin(key){
    let pins=store(PIN_KEY)||[];
    let on=pins.includes(key);
    pins=on?pins.filter(k=>k!==key):[...pins,key];
    store(PIN_KEY,pins);renderFav();
    let b=document.querySelector(`#hkMenu .hk-menu-grid .drawer-item[data-key="${key}"]:not(.hk-fav-item)`);
    showToast((on?'📌 Hata diya: ':'📌 Upar lag gaya: ')+((b&&b.querySelector('.t-label')?.textContent)||key));
  }
  window.hkTogglePin=togglePin;
  let holdT=null,held=false;
  function tileOf(e){let b=e.target.closest&&e.target.closest('#hkMenu .drawer-item');return b&&b.dataset.key?b:null;}
  document.addEventListener('pointerdown',e=>{
    let b=tileOf(e);if(!b)return;held=false;clearTimeout(holdT);
    holdT=setTimeout(()=>{held=true;togglePin(b.dataset.key);try{navigator.vibrate&&navigator.vibrate(30);}catch(x){}},600);
  },true);
  ['pointerup','pointercancel','pointerleave','scroll'].forEach(ev=>document.addEventListener(ev,()=>clearTimeout(holdT),true));
  document.addEventListener('contextmenu',e=>{if(tileOf(e))e.preventDefault();},true);
  // A hold must not also open the item.
  document.addEventListener('click',e=>{if(held&&tileOf(e)){e.preventDefault();e.stopImmediatePropagation();held=false;}},true);

  // ── Recently opened khatas and orders ──
  function remember(kind,id){
    let r=(store(RECENT_KEY)||[]).filter(x=>!(x.k===kind&&String(x.id)===String(id)));
    r.unshift({k:kind,id});store(RECENT_KEY,r.slice(0,6));
  }
  [['openPartyLedger','p'],['viewOrderDetail','o'],['openSupplierLedger','s']].forEach(([fn,k])=>{
    let orig=window[fn];if(!orig)return;
    window[fn]=function(id){try{remember(k,id);}catch(e){}return orig.apply(this,arguments);};
  });
  function itemFor(x){
    if(x.k==='p'){let p=getPartyById(x.id);return p&&{icon:'📒',name:p.name,go:`openPartyLedger(${p.id})`};}
    if(x.k==='o'){let o=orders.find(y=>String(y.id)===String(x.id));return o&&{icon:'📋',name:o.orderNo+' '+getPartyName(o.partyId),go:`viewOrderDetail(${o.id})`};}
    if(x.k==='s'){let s=suppliers.find(y=>String(y.id)===String(x.id));return s&&{icon:'🪵',name:s.name,go:`openSupplierLedger(${s.id})`};}
  }
  function renderRecent(){
    let box=document.getElementById('hkMenuRecent');if(!box)return;
    let list=(store(RECENT_KEY)||[]).map(itemFor).filter(Boolean).slice(0,5);
    box.innerHTML=list.length?`<div class="hk-menu-title">🕘 Abhi khole</div><div class="hk-chips">${list.map(x=>`<button onclick="closeDrawer();${x.go}">${x.icon} ${esc(x.name)}</button>`).join('')}</div>`:'';
  }

  // ── Search also finds customers, suppliers, karigars and orders ──
  let baseFilter=window.filterDrawerItems;
  window.filterDrawerItems=function(q){
    let r=baseFilter.apply(this,arguments);
    let box=document.getElementById('hkMenuFind');if(!box)return r;
    q=(q||'').trim().toLowerCase();
    if(q.length<2){box.innerHTML='';return r;}
    let hit=x=>String(x.name||'').toLowerCase().includes(q)||String(x.phone||'').replace(/\D/g,'').includes(q.replace(/\D/g,'')||'§');
    let res=[];
    parties.filter(hit).slice(0,4).forEach(p=>{let b=getPartyBalance(p);res.push({icon:'📒',name:p.name,sub:b>=1?'baqi '+fmtRs(b):b<=-1?'advance '+fmtRs(-b):'saaf',go:`openPartyLedger(${p.id})`});});
    suppliers.filter(hit).slice(0,2).forEach(s=>res.push({icon:'🪵',name:s.name,sub:'supplier',go:`openSupplierLedger(${s.id})`}));
    karigars.filter(hit).slice(0,2).forEach(k=>res.push({icon:'👷',name:k.name,sub:'karigar',go:`openKarigarList();openKarigarLedger(${k.id})`}));
    orders.filter(o=>String(o.orderNo||'').toLowerCase().includes(q)).slice(0,3).forEach(o=>res.push({icon:'📋',name:o.orderNo,sub:getPartyName(o.partyId)+' · '+fmtRs(o.orderTotal),go:`viewOrderDetail(${o.id})`}));
    box.innerHTML=res.length?`<div class="hk-menu-title">🔍 Mile</div>${res.map(x=>`<button class="hk-find-row" onclick="closeDrawer();${x.go}"><span>${x.icon}</span><b>${esc(x.name)}</b><small>${esc(x.sub)}</small></button>`).join('')}`:'';
    return r;
  };
})();
