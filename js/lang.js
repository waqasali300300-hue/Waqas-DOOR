// HK Wood Doors ERP — Urdu language option
// ☰ → "اردو / English" switches menus, buttons, headings and form labels to Urdu.
// It translates the words on screen (also new screens as they open) from the
// list below; anything not in the list stays as it is. Choice is per device.
(function(){
  const KEY='hk_lang';
  const UR={
    // Bottom bar, menu, sections
    'Home':'ہوم','Orders':'آرڈر','Khata':'کھاتہ','Labour':'لیبر','More':'مزید',
    'Home Dashboard':'ہوم','Estimates / Quotations':'تخمینے','Production':'پروڈکشن','Labour Records':'لیبر ریکارڈ',
    'Party Khata':'پارٹی کھاتہ','Parties':'پارٹیاں','Inventory / Stock':'اسٹاک','Khareed / Purchases':'خریداری',
    'Suppliers':'سپلائر','Kharcha / Expenses':'خرچہ','Bank / Cash Book':'بینک / کیش بک','Cheques':'چیک',
    'Reports':'رپورٹیں','Recycle Bin':'ری سائیکل بن','Global Search':'تلاش','Calculator':'کیلکولیٹر',
    'Karigar Manager':'کاریگر','Karigar Attendance':'کاریگر حاضری','Wood Stock':'لکڑی کا اسٹاک',
    'Rate / Price List':'ریٹ لسٹ','Material Calculator':'میٹیریل کیلکولیٹر','Business Card':'بزنس کارڈ',
    'Payment Reminders':'پیمنٹ یاد دہانی','Staff / Users':'اسٹاف','Cloud Backup Setup':'کلاؤڈ سیٹ اپ',
    'Settings':'سیٹنگ','Dark / Light Mode':'ڈارک / لائٹ موڈ','Auto System':'آٹو سسٹم',
    'Activity (Kis ne kya kiya)':'کس نے کیا کیا','Mahana Statement (Parties)':'ماہانہ اسٹیٹمنٹ',
    'Munafa / Nuqsan Report':'منافع / نقصان','Excel Export':'ایکسل ایکسپورٹ',
    'Aaj ka Hisaab (Day Close)':'آج کا حساب','Karigar Payment':'کاریگر پیمنٹ','Lakri Khareed List':'لکڑی خریداری لسٹ',
    'App Install Karein (Laptop / Mobile)':'ایپ انسٹال کریں','Kaam Kaaj':'کام کاج','Maal / Paisa':'مال / پیسہ',
    'Tools':'ٹولز','App':'ایپ','ERP Menu':'مینو','Administrator':'مالک',
    // Home
    'Is mahine sale':'اس مہینے سیل','Wasooli':'وصولی','Kul udhaar':'کل ادھار','Munafa':'منافع',
    'parties ki taraf':'پارٹیوں کی طرف','kharche ke baad':'خرچے کے بعد','orders':'آرڈر',
    'Payment':'پیمنٹ','Kharcha':'خرچہ','Estimate':'تخمینہ','Party':'پارٹی',
    'Tawajjo chahiye':'توجہ چاہیے','Sab theek hai — koi kaam baqi nahi':'سب ٹھیک ہے — کوئی کام باقی نہیں',
    'Naye Orders':'نئے آرڈر','Sab orders ›':'سب آرڈر ›','Sab dekhein ›':'سب دیکھیں ›',
    'Aamdani vs Kharcha':'آمدنی اور خرچہ','Mazeed reports aur charts':'مزید رپورٹیں اور چارٹ',
    'Aaj ka hisaab ›':'آج کا حساب ›','Lakri list ›':'لکڑی لسٹ ›','Shaam bakhair':'شام بخیر',
    'Subah bakhair':'صبح بخیر','Assalam-o-Alaikum':'السلام علیکم','Device jorein ›':'ڈیوائس جوڑیں ›',
    // Production stages
    'Pending':'باقی','Cutting':'کٹائی','Assembly':'جوڑائی','Polish':'پالش','Polishing':'پالش','Ready':'تیار','Delivered':'ڈلیور',
    // Common buttons and words
    'Save':'محفوظ کریں','Save Order':'آرڈر محفوظ کریں','Save Settings':'سیٹنگ محفوظ کریں','Cancel':'منسوخ',
    'Close':'بند کریں','Delete':'ڈیلیٹ','Edit':'ترمیم','Add':'شامل کریں','New':'نیا','Confirm':'تصدیق',
    'Search...':'تلاش...','Search orders...':'آرڈر تلاش کریں...','Detail':'تفصیل','Invoice':'انوائس',
    'Delivery Challan':'ڈلیوری چالان','Digital Ledger':'لیجر','Receive Payment':'پیمنٹ وصول کریں',
    'WhatsApp Reminder':'واٹس ایپ یاد دہانی','Reminders':'یاد دہانی','Full Year':'پورا سال','All Parties':'سب پارٹیاں',
    'Install':'انسٹال','Connect':'جوڑیں','Baad Mein':'بعد میں','Setup':'سیٹ اپ',
    'New Order':'نیا آرڈر','New Party':'نئی پارٹی','New Kharcha':'نیا خرچہ','New Purchase':'نئی خریداری',
    'New Labour Entry':'نئی لیبر انٹری','New Stock Item':'نیا اسٹاک','New Estimate':'نیا تخمینہ',
    'Add Door':'دروازہ شامل کریں','Sample':'نمونہ','Templates':'ٹیمپلیٹ','Photo Add Karein':'تصویر لگائیں',
    // Form labels
    'Name':'نام','Naam':'نام','Phone':'فون','Address':'پتہ','Area':'علاقہ','City':'شہر','Date':'تاریخ',
    'Status':'حالت','Note':'نوٹ','Amount':'رقم','Description':'تفصیل','Category':'قسم','Qty':'تعداد',
    'Quantity':'تعداد','Unit':'یونٹ','Rate':'ریٹ','Item':'چیز','Item Name':'چیز کا نام','Supplier':'سپلائر',
    'Karigar':'کاریگر','Advance Payment':'ایڈوانس','Delivery kab deni hai':'ڈلیوری کب دینی ہے',
    'Opening Balance (Purani Baqi Raqam)':'پرانا بقایا','Paisa kahan se gaya':'پیسہ کہاں سے گیا',
    'Karigar (labour isi ke khate mein jayegi)':'کاریگر (لیبر اسی کے کھاتے میں جائے گی)',
    'Design Reference Photo':'ڈیزائن کی تصویر','Total Doors:':'کل دروازے:','Total Amount:':'کل رقم:',
    'Total Wood Cft:':'کل لکڑی (cft):','Total Wood Cost:':'لکڑی کی لاگت:','Min Stock Alert':'کم اسٹاک الرٹ',
    'Cost per unit':'فی یونٹ قیمت','Company Name':'کمپنی کا نام','Theme':'تھیم','Security':'حفاظت',
    // Statuses and totals
    'Paid':'ادا','Balance':'بقایا','Baqi':'باقی','Total':'کل','Received':'وصول','Revenue':'آمدنی',
    'Net Profit':'خالص منافع','Total Outstanding':'کل بقایا','Parties Due':'بقایا والی پارٹیاں',
    'Is Mahine Wasool':'اس مہینے وصول','Labour Cost':'لیبر لاگت','Today':'آج','Month':'مہینہ','Week':'ہفتہ','Year':'سال',
    'No orders':'کوئی آرڈر نہیں','No parties':'کوئی پارٹی نہیں','No expenses':'کوئی خرچہ نہیں',
    'No suppliers':'کوئی سپلائر نہیں','No purchases':'کوئی خریداری نہیں','No transactions':'کوئی انٹری نہیں',
    'No labour records':'کوئی لیبر ریکارڈ نہیں','No inventory':'اسٹاک خالی ہے',
    // Newer screens
    'Sab ko Yaad Dahani (Wasooli)':'سب کو یاد دہانی (وصولی)','Karigar Report (Mahana)':'کاریگر رپورٹ (ماہانہ)',
    'Excel se Parties Layein':'ایکسل سے پارٹیاں لائیں','Udhaar ki hadd (limit) — khali = koi hadd nahi':'ادھار کی حد (خالی = کوئی حد نہیں)',
    'Sab ko yaad dahani':'سب کو یاد دہانی','Karigar Report':'کاریگر رپورٹ','Agle ko bhejein ›':'اگلے کو بھیجیں ›',
    'Bhejein':'بھیجیں','Darwaze':'دروازے','Diya':'دیا','Hazri din':'حاضری دن','Parchi PDF':'پرچی PDF',
    'Party ko order WhatsApp karein':'پارٹی کو آرڈر واٹس ایپ کریں','Finger / Face se kholein':'فنگر / چہرے سے کھولیں',
    'Kholein':'کھولیں'
  };
  const ATTRS=['placeholder','title'];
  let orig=new WeakMap();

  function lang(){try{return localStorage.getItem(KEY)||'en';}catch(e){return 'en';}}
  function splitLead(s){
    // Keep emoji / symbols in front ("📋 Orders") and spaces around the words.
    let m=s.match(/^(\s*[^A-Za-z]*?\s*)([A-Za-z].*?)(\s*)$/s);
    return m?[m[1],m[2],m[3]]:null;
  }
  function tr(text){
    let p=splitLead(text);if(!p)return null;
    let u=UR[p[1]]||UR[p[1].trim()];
    return u?p[0]+u+p[2]:null;
  }
  function translateNode(n){
    if(n.nodeType===3){
      let v=n.nodeValue;if(!v||!v.trim())return;
      let t=tr(v);if(t&&t!==v){orig.set(n,v);n.nodeValue=t;}
      return;
    }
    if(n.nodeType!==1||n.tagName==='SCRIPT'||n.tagName==='STYLE'||n.tagName==='TEXTAREA')return;
    ATTRS.forEach(a=>{let v=n.getAttribute&&n.getAttribute(a);if(v){let t=tr(v);if(t)n.setAttribute(a,t);}});
    let w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
    let x;while(x=w.nextNode()){
      if(x.nodeType===3){let v=x.nodeValue;if(v&&v.trim()){let t=tr(v);if(t&&t!==v)x.nodeValue=t;}}
      else ATTRS.forEach(a=>{let v=x.getAttribute(a);if(v){let t=tr(v);if(t)x.setAttribute(a,t);}});
    }
  }
  let pending=new Set(),timer=null,observer=null;
  function flush(){timer=null;pending.forEach(n=>{if(n.isConnected!==false)translateNode(n);});pending.clear();}
  function start(){
    document.documentElement.setAttribute('lang','ur');
    document.body.classList.add('hk-urdu');
    translateNode(document.body);
    observer=new MutationObserver(ms=>{
      ms.forEach(m=>{
        if(m.type==='characterData')pending.add(m.target);
        m.addedNodes&&m.addedNodes.forEach(n=>pending.add(n));
      });
      if(!timer)timer=setTimeout(flush,0);
    });
    observer.observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  window.hkTranslate=tr;
  window.toggleLanguage=function(){
    let next=lang()==='ur'?'en':'ur';
    try{localStorage.setItem(KEY,next);}catch(e){}
    if(next==='ur'){start();showToast('✅ اردو');}
    else location.reload(); // back to English: reload shows the original words
    menuLabel();
  };
  function menuLabel(){
    let b=document.getElementById('hkLangBtn');
    if(!b){
      let anchor=[...document.querySelectorAll('.drawer-item')].find(x=>(x.getAttribute('onclick')||'').includes('openSettingsModal'));
      if(!anchor)return;
      anchor.insertAdjacentHTML('afterend','<button class="drawer-item" id="hkLangBtn" onclick="toggleLanguage();closeDrawer();"><span class="t-icon">🌐</span><span class="hk-lang-label"></span></button>');
      b=document.getElementById('hkLangBtn');
    }
    // Shown in both languages so it can always be found.
    b.querySelector('.hk-lang-label').textContent=lang()==='ur'?'English mein dekhein':'اردو میں دیکھیں (Urdu)';
  }
  document.addEventListener('hk:ready',()=>{menuLabel();if(lang()==='ur')start();});
})();
