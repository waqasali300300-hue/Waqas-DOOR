// HK Wood Doors ERP — voice commands for (almost) everything
// Say what you want and it opens straight away, in Urdu or Roman Urdu:
//   "Aziz ka khata" · "naya order Aziz" · "payment Aziz 20000" · "kharcha bijli 5000"
//   "Rafiq ko 3000 do" · "order 21" · "45x80 Mughleazam 4 ki qeemat" · "Aziz ko yaad dahani"
//   "stock" · "aaj ka hisaab" · "munafa" · "design album" · "backup" … any menu item.
// Speech often comes back in Urdu letters while names are saved in English letters,
// so names are compared by their consonant sound ("عزیز" ≈ "Aziz").
// Anything not understood goes to the app-wide search.
(function(){
  function num(v){return parseFloat(v)||0;}
  const UR_DIG='۰۱۲۳۴۵۶۷۸۹',AR_DIG='٠١٢٣٤٥٦٧٨٩';
  function digits(s){return String(s||'').replace(/[۰-۹]/g,c=>UR_DIG.indexOf(c)).replace(/[٠-٩]/g,c=>AR_DIG.indexOf(c));}

  // ── Sound skeleton: consonants only, the same for Urdu and Roman spelling ──
  const UR_MAP={'ب':'b','پ':'p','ت':'t','ٹ':'t','ط':'t','ث':'s','س':'s','ص':'s','ج':'j','چ':'c','خ':'k','د':'d','ڈ':'d','ذ':'z','ز':'z','ض':'z','ظ':'z','ژ':'z',
    'ر':'r','ڑ':'r','ش':'s','غ':'g','ف':'f','ق':'k','ک':'k','ك':'k','گ':'g','ل':'l','م':'m','ن':'n','ں':'n'};
  function skel(s){
    let t=String(s||'').toLowerCase(),out='';
    for(const ch of t){
      if(UR_MAP[ch]){out+=UR_MAP[ch];continue;}
      if(/[\u0600-\u06ff]/.test(ch)){out+='a';continue;} // Urdu vowel/h letters: a gap, so "عزیز" keeps both z
      if(/[a-z]/.test(ch))out+=ch;
      else if(/\s/.test(ch))out+=' ';
    }
    out=out.replace(/kh/g,'k').replace(/gh/g,'g').replace(/sh/g,'s').replace(/ch/g,'c').replace(/th/g,'t').replace(/ph/g,'f').replace(/q/g,'k').replace(/x/g,'ks').replace(/v/g,'w')
      .replace(/(.)\1+/g,'$1').replace(/[aeiouyhw]/g,'');
    return out.replace(/\s+/g,' ').trim();
  }
  window.hkSkel=skel;
  // Best-matching record by name (parties, karigars…); longer matches win.
  function findByName(list,text){
    let st=' '+skel(text)+' ',flat=st.replace(/\s/g,''),best=null,score=0;
    (list||[]).forEach(x=>{
      let full=skel(x.name);if(full.replace(/\s/g,'').length<2)return;
      let f=full.replace(/\s/g,'');
      let sc=flat.includes(f)?f.length*2:0;
      if(!sc)full.split(' ').forEach(w=>{if(w.length>=2&&st.includes(' '+w+' '))sc=Math.max(sc,w.length);});
      if(sc>score){score=sc;best=x;}
    });
    return best;
  }
  window.hkFindByName=findByName;
  function has(t,words){return words.some(w=>t.includes(w));}
  function amountOf(t){
    let s=digits(t).replace(/(\d)[,\s](?=\d{3}\b)/g,'$1');
    let nums=(s.replace(/\d+\s*[x×]\s*\d+/gi,' ').match(/\d+(\.\d+)?/g)||[]).map(Number);
    let a=nums.length?Math.max(...nums):0;
    if(/hazar|hazaar|ہزار|thousand/i.test(s)&&a&&a<1000)a*=1000;
    if(/lakh|لاکھ/i.test(s)&&a&&a<1000)a*=100000;
    return a;
  }
  function wait(ms){return new Promise(r=>setTimeout(r,ms));}
  function setVal(id,v){let e=document.getElementById(id);if(e){e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}}

  // ── Words ──
  const W={
    expense:['kharch','expense','خرچ','خرچہ'],
    payment:['payment','paiment','wasool','wusool','jama','received','وصول','ادائیگی','پیمنٹ','پیمینٹ','جمع'],
    karigarPay:['mazdoori do','mazduri do','karigar ko','labour payment','مزدوری دو','مزدوری دے','کاریگر کو'],
    newOrder:['naya order','new order','order banao','order bana','نیا آرڈر','آرڈر بناؤ','آرڈر بنا'],
    price:['qeemat','qimat','keemat','price','قیمت','ریٹ بتاؤ'],
    reminder:['yaad dahani','yad dahani','reminder','یاد دہانی','یاد دہانی'],
    khata:['khata','khaata','ledger','hisaab','hisab','کھاتہ','کھاتا','حساب'],
    estimate:['naya estimate','estimate banao','نیا تخمینہ']
  };
  // Screens by name (Roman and Urdu); the first match in this list wins.
  const SCREENS=[
    [['aaj ka hisaab','aaj ka hisab','day close','آج کا حساب'],()=>openDayClose()],
    [['subah','morning','صبح'],()=>openMorning()],
    [['saal ka hisaab','saal ka hisab','year','سال کا حساب'],()=>openYearReport()],
    [['design report','kya bikta','ڈیزائن رپورٹ'],()=>openDesignReport()],
    [['munafa','profit','منافع','نقصان'],()=>openProfitReport()],
    [['mahana statement','statement','اسٹیٹمنٹ'],()=>openStatements()],
    [['karigar report','کاریگر رپورٹ'],()=>openKarigarReport()],
    [['report','رپورٹ'],()=>switchTab('tabReports')],
    [['design album','album','البم'],()=>openAlbum()],
    [['fauri qeemat','qeemat nikal','فوری قیمت'],()=>openQuickPrice()],
    [['rate list pdf'],()=>openRateListPdf()],
    [['rate badal','rate badha','ریٹ بدل'],()=>openRateChange()],
    [['rate list','rate','ریٹ لسٹ','ریٹ'],()=>openPriceListModal()],
    [['cutting','کٹنگ'],()=>openCuttingPicker()],
    [['board','بورڈ'],()=>openWorkshopBoard()],
    [['production','پروڈکشن'],()=>switchTab('tabProduction')],
    [['estimate','quotation','تخمینہ','تخمینے'],()=>openQuotationList()],
    [['wasooli','sab ko yaad','وصولی'],()=>openBulkReminders()],
    [['purane gahak','purane customer','پرانے گاہک'],()=>openOldCustomers()],
    [['karigar payment','mazdoori','مزدوری'],()=>openKarigarPay()],
    [['hazri','attendance','حاضری'],()=>openAttendanceModal()],
    [['auzaar','machine','اوزار','مشین'],()=>openTools()],
    [['karigar','کاریگر'],()=>openKarigarList()],
    [['labour','لیبر'],()=>switchTab('tabLabour')],
    [['stock ginti','ginti','گنتی'],()=>openStockCount()],
    [['lakri list','lakri khareed','لکڑی لسٹ','لکڑی خرید'],()=>openWoodBuyList()],
    [['lakri','wood','لکڑی'],()=>openWoodStockModal()],
    [['stock','inventory','اسٹاک','سٹاک'],()=>switchTab('tabInventory')],
    [['khareed','purchase','خریداری','خرید'],()=>switchTab('tabPurchases')],
    [['supplier','سپلائر'],()=>switchTab('tabSuppliers')],
    [['mahana bill','bijli bill','kiraya','ماہانہ بل','کرایہ'],()=>openBills()],
    [['kharche','kharcha list','expenses','خرچے'],()=>switchTab('tabExpenses')],
    [['bank','cash book','بینک','کیش'],()=>switchTab('tabBankBook')],
    [['cheque','check','چیک'],()=>openChequeListModal()],
    [['qarz','loan','قرض'],()=>openLoans()],
    [['hadaf','target','ہدف'],()=>setSalesTarget()],
    [['catalog','کیٹلاگ'],()=>openCatalog()],
    [['backup','hifazat','بیک اپ','حفاظت'],()=>openDataSafety()],
    [['activity','kis ne','سرگرمی'],()=>openActivityLog()],
    [['auto system','آٹو'],()=>openAutoSettings()],
    [['setting','سیٹنگ'],()=>openSettingsModal()],
    [['staff','اسٹاف'],()=>openUserSwitcher()],
    [['calculator','کیلکولیٹر'],()=>openCalculator()],
    [['scan','qr','اسکین'],()=>openQrScan()],
    [['recycle','ری سائیکل'],()=>switchTab('tabRecycle')],
    [['parties','party list','پارٹیاں'],()=>switchTab('tabParties')],
    [['khata','کھاتہ','کھاتا'],()=>switchTab('tabKhata')],
    [['orders','order list','آرڈرز','آرڈر'],()=>switchTab('tabOrders')],
    [['menu','مینیو'],()=>openDrawer()],
    [['home','ghar','ہوم'],()=>switchTab('tabHome')]
  ];

  // ── Understanding one sentence ──
  function understand(raw){
    let text=digits(raw).trim(),t=text.toLowerCase();
    let amount=amountOf(t);
    let party=findByName(parties,t),karigar=findByName(karigars,t);
    let size=(t.match(/(\d+(?:\.\d+)?)\s*(?:x|×|by|بائی|ضرب)\s*(\d+(?:\.\d+)?)/i)||[]);
    let orderNo=(t.match(/(?:order|ord|آرڈر)\s*(?:no|number|نمبر)?\s*[-#]?\s*(\d+)/i)||[])[1];
    if(has(t,W.karigarPay)&&karigar)return {kind:'karigarPay',karigar,amount};
    if(has(t,W.expense)&&amount)return {kind:'expense',amount,words:(window.hkParseVoice?hkParseVoice(raw).words:'')};
    if(has(t,W.payment))return {kind:'payment',party,amount};
    if(has(t,W.newOrder))return {kind:'newOrder',party};
    if(has(t,W.estimate))return {kind:'newEstimate',party};
    if(has(t,W.price)&&size[1])return {kind:'price',size:size[1]+'x'+size[2],qty:(t.replace(size[0],'').match(/\b(\d{1,3})\b/)||[])[1],design:findByName((priceList||[]).map(p=>({name:p.size})),t)};
    if(has(t,W.reminder))return {kind:'reminder',party};
    if(orderNo&&!size[1]){let o=orders.find(x=>String(x.orderNo||'').replace(/\D/g,'')===orderNo);if(o)return {kind:'order',order:o};}
    if(has(t,W.khata)&&party)return {kind:'ledger',party};
    for(const [words,fn] of SCREENS)if(has(t,words))return {kind:'screen',fn,word:words[0]};
    if(party)return {kind:'ledger',party};
    if(karigar)return {kind:'karigar',karigar};
    return {kind:'search',text};
  }
  window.hkUnderstand=understand;

  async function act(v,raw){
    closeVoiceSheet();
    try{document.querySelectorAll('.modal.open').forEach(m=>{if(m.id!=='confirmModal')closeModal(m.id);});closeDrawer&&closeDrawer();}catch(e){}
    switch(v.kind){
      case 'expense':
        openExpenseModal();await wait(60);setVal('expDesc',v.words||'Kharcha');setVal('expAmount',v.amount);
        return say('Kharcha bhar diya — check kar ke Save dabayein');
      case 'payment':
        if(v.party){openReceivePaymentModal(v.party.id);await wait(60);if(v.amount)setVal('payAmount',v.amount);return say(v.party.name+' ki payment'+(v.amount?' '+fmtRs(v.amount):'')+' — check kar ke Save');}
        quickAddPayment();return say('Party chunein'+(v.amount?' — raqam '+fmtRs(v.amount):''));
      case 'karigarPay':
        openKarigarPay();await wait(80);
        if(v.amount)setVal('kpAmt_'+v.karigar.id,v.amount);
        document.getElementById('kpAmt_'+v.karigar.id)?.scrollIntoView({block:'center'});
        return say(v.karigar.name+' ko'+(v.amount?' '+fmtRs(v.amount):'')+' — "Do" dabayein');
      case 'newOrder':
        openOrderModal();await wait(80);
        if(v.party){setVal('orderPartyId',v.party.id);}
        return say('Naya order'+(v.party?' — '+v.party.name:'')+': darwaze ka size likhein');
      case 'newEstimate':
        if(typeof openQuotationModal==='function'){openQuotationModal();await wait(80);if(v.party)setVal('orderPartyId',v.party.id);}
        return say('Naya estimate'+(v.party?' — '+v.party.name:''));
      case 'price':
        openQuickPrice(v.design?v.design.name:undefined);await wait(40);
        hkQpSet(0,'size',v.size);if(v.qty)hkQpSet(0,'qty',v.qty);
        return say('Qeemat: '+v.size+(v.design?' '+v.design.name:'')+(v.qty?' × '+v.qty:''));
      case 'reminder':
        if(v.party){sendWhatsAppReminder(v.party.id);return say(v.party.name+' ki yaad dahani');}
        openBulkReminders();return say('Sab ko yaad dahani');
      case 'order':viewOrderDetail(v.order.id);return say(v.order.orderNo);
      case 'ledger':openPartyLedger(v.party.id);return say(v.party.name+' ka khata');
      case 'karigar':openKarigarPay();return say(v.karigar.name);
      case 'screen':v.fn();return say('🎤 '+raw);
      default:
        if(typeof openSearchModal==='function'){openSearchModal();await wait(80);let i=document.querySelector('#searchModal input, #globalSearchInput');if(i){i.value=v.text;i.dispatchEvent(new Event('input',{bubbles:true}));}}
        return say('Talash: "'+v.text+'"');
    }
  }
  function say(m){showToast('🎤 '+m);return true;}
  window.applyVoiceText=function(text,alts){
    // Several guesses from the phone: use the first one that means something.
    let list=[text].concat(alts||[]).filter(Boolean),pick=null,firstSearch=null;
    for(const t of list){let v=understand(t);if(v.kind!=='search'){pick={v,t};break;}if(!firstSearch)firstSearch={v,t};}
    pick=pick||firstSearch;
    if(!pick){showToast('⚠️ Awaaz nahi suni');return;}
    act(pick.v,pick.t);
    return pick.v;
  };

  // ── Listening sheet (browser) with examples ──
  const EXAMPLES=['Aziz ka khata','naya order Aziz','payment Aziz 20000','kharcha bijli 5000','Rafiq ko 3000 do','order 21','45x80 Mughleazam 4 ki qeemat','Aziz ko yaad dahani','aaj ka hisaab','stock'];
  function sheet(msg){
    let s=document.getElementById('hkVoiceSheet');
    if(!s){
      s=document.createElement('div');s.id='hkVoiceSheet';s.className='hk-voice-sheet';
      s.innerHTML=`<div class="hk-voice-box"><div class="hk-voice-mic">🎤</div><div class="hk-voice-msg"></div>
        <div class="hk-voice-ex">${EXAMPLES.map(e=>`<span>“${e}”</span>`).join('')}</div>
        <button onclick="closeVoiceSheet(true)">Band karein</button></div>`;
      document.body.appendChild(s);
    }
    s.querySelector('.hk-voice-msg').textContent=msg;
    return s;
  }
  let rec=null;
  window.closeVoiceSheet=function(stop){document.getElementById('hkVoiceSheet')?.remove();if(stop&&rec){try{rec.abort();}catch(e){}rec=null;}};
  let origStart=window.startVoice;
  window.startVoice=function(){
    let nsr=window.hkNative&&window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.SpeechRecognition;
    if(nsr)return nativeListen(nsr);
    let SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR)return origStart?origStart.apply(this,arguments):showToast('⚠️ Is browser mein awaaz nahi chalti — Google Chrome istemal karein');
    rec=new SR();rec.lang='ur-PK';rec.interimResults=true;rec.maxAlternatives=5;
    sheet('Boliye… jo kholna hai');
    rec.onresult=e=>{
      let r=e.results[e.results.length-1];
      let el=document.querySelector('#hkVoiceSheet .hk-voice-msg');if(el)el.textContent='“'+r[0].transcript+'”';
      if(r.isFinal){let alts=[...r].slice(1).map(a=>a.transcript);applyVoiceText(r[0].transcript,alts);}
    };
    rec.onerror=e=>{closeVoiceSheet();showToast(e.error==='not-allowed'?'⚠️ Mic ki ijazat dein (browser settings)':'⚠️ Awaaz nahi suni — dobara koshish karein');};
    rec.onend=()=>{setTimeout(()=>closeVoiceSheet(),300);rec=null;};
    try{rec.start();}catch(e){}
  };
  async function nativeListen(sr){
    try{
      if(!(await sr.available()).available){showToast('⚠️ Is phone par awaaz se likhna nahi mila');return;}
      let p=await sr.requestPermissions();
      if(p&&p.speechRecognition&&p.speechRecognition!=='granted'){showToast('⚠️ Mic ki ijazat dein (phone settings → Apps → HK Doors)');return;}
      let r=await sr.start({language:'ur-PK',maxResults:5,prompt:'Boliye… maslan "Aziz ka khata"',partialResults:false,popup:true});
      let m=(r&&r.matches)||[];
      if(m.length)applyVoiceText(m[0],m.slice(1));else showToast('⚠️ Awaaz nahi suni — dobara koshish karein');
    }catch(e){showToast('⚠️ Awaaz nahi suni — dobara koshish karein');}
  }
})();
