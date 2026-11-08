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
  // "2.5 crore", "2 crore 35 lakh", "25 lakh 40 hazar", "50 hazar", "20000"
  const UNITS=[[/^(crore|karor|karod|کروڑ)/,1e7],[/^(lakh|lac|lakh|لاکھ)/,1e5],[/^(hazar|hazaar|hajar|thousand|ہزار)/,1e3],[/^(sau|سو)/,100]];
  function amountOf(t){
    let s=digits(t).toLowerCase().replace(/(\d)[,\s](?=\d{3}\b)/g,'$1').replace(/\d+\s*[x×]\s*\d+/gi,' ');
    let re=/(\d+(?:\.\d+)?)\s*([^\d\s]*)/g,m,total=0,unitSeen=false,plain=[];
    while((m=re.exec(s))){
      let n=Number(m[1]),u=UNITS.find(([r])=>r.test(m[2]));
      if(u){total+=n*u[1];unitSeen=true;}
      else if(unitSeen&&n<1000)total+=n;
      else plain.push(n);
    }
    let a=unitSeen?total:(plain.length?Math.max(...plain):0);
    return Math.round(a);
  }
  window.hkAmountOf=amountOf;
  function wait(ms){return new Promise(r=>setTimeout(r,ms));}
  function setVal(id,v){let e=document.getElementById(id);if(e){e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));}}

  // ── Words ──
  const W={
    expense:['kharch','expense','خرچ','خرچہ'],
    payment:['payment','paiment','wasool','wusool','jama','received','aaye','aye ','aa gaye','mile','وصول','ادائیگی','پیمنٹ','پیمینٹ','جمع','آئے','آ گئے','ملے'],
    gave:['diye','diya','diey','de diye','de diya','ko payment','ada ki','دیے','دیئے','دیا','دے دیے','ادا کی'],
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
    [['kul hisaab','kul hisab','mera hisaab','mera hisab','sara hisaab','کل حساب','میرا حساب','سارا حساب'],()=>openMyPosition()],
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
    // Supplier money: "Aziz ne Imran ko 5 lakh diye" (lagwayi) or "Imran ko 3 lakh diye".
    let supplier=typeof suppliers!=='undefined'?findByName(suppliers,t):null;
    if(supplier&&(has(t,W.gave)||has(t,W.payment))){
      let rest=t.replace(new RegExp(supplier.name.split(/\s+/)[0],'i'),' ');
      let payer=findByName(parties,rest);
      if(payer&&skel(payer.name)!==skel(supplier.name))return {kind:'lagwayi',party:payer,supplier,amount};
      return {kind:'supplierPay',supplier,amount};
    }
    if(party&&has(t,W.gave)&&/\bko\b|کو/.test(t)&&!has(t,W.payment))return {kind:'giveParty',party,amount};
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
      case 'lagwayi':
        openLagwao(v.party.id,v.supplier.id);await wait(60);if(v.amount)setVal('hkLagAmt',v.amount);
        document.getElementById('hkLagAmt')?.dispatchEvent(new Event('input'));
        return say(`${v.party.name} ne ${v.supplier.name} ko${v.amount?' '+fmtRs(v.amount):''} — check kar ke Save`);
      case 'supplierPay':
        openSupplierPayment(v.supplier.id);await wait(60);if(v.amount)setVal('supPayAmt',v.amount);
        return say(`${v.supplier.name} ko payment${v.amount?' '+fmtRs(v.amount):''} — check kar ke Save`);
      case 'giveParty':
        openGivePayment(v.party.id);await wait(60);if(v.amount){setVal('hkGiveAmt',v.amount);document.getElementById('hkGiveAmt')?.dispatchEvent(new Event('input'));}
        return say(`${v.party.name} ko${v.amount?' '+fmtRs(v.amount):''} diye — check kar ke Save`);
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
    // Order by voice: door sizes said while an order is open, or with the word "order".
    if(orderOpen()&&list.some(t=>has(String(t).toLowerCase(),STOP_WORDS))){window.hkDictation=false;closeVoiceSheet(true);say('Theek hai — check kar ke Save dabayein');return {kind:'stop'};}
    for(const t of list){
      let lines=parseDoors(t),low=String(t).toLowerCase();
      if(lines.length&&(orderOpen()||(has(low,['order','آرڈر','darwaz','دروازے','door'])&&!has(low,W.price)))){closeVoiceSheet();dictateOrder(t,lines);return {kind:'order-doors',lines};}
    }
    for(const t of list){let v=understand(t);if(v.kind!=='search'){pick={v,t};break;}if(!firstSearch)firstSearch={v,t};}
    pick=pick||firstSearch;
    if(!pick){showToast('⚠️ Awaaz nahi suni');return;}
    act(pick.v,pick.t);
    return pick.v;
  };

  // ── Speaking an order: "Aziz ka order 45 80 5, 39 80 5, 33 80 10 Mughleazam" ──
  // Every two numbers that look like a door (width 12–96, height 30–120) start a
  // door line; the number after them is the count (1 if none). A design name said
  // with a line goes to that line, "jori" makes it a pair.
  function designsList(){
    let seen=new Set(),out=[];
    [...(doorDesigns||[]),...(priceList||[]).map(p=>p.size)].forEach(n=>{n=String(n||'').trim();if(n&&!/^\d/.test(n)&&!seen.has(n.toLowerCase())){seen.add(n.toLowerCase());out.push({name:n});}});
    return out;
  }
  function parseDoors(raw){
    let t=digits(raw).toLowerCase().replace(/(\d)\s*(?:x|×|by|bai|بائی|ضرب|into)\s*(\d)/g,'$1 $2');
    // Split into pieces at numbers, keeping the words between them.
    let parts=t.split(/(\d+(?:\.\d+)?)/).filter(x=>x!=='');
    let lines=[],nums=[],words='';
    const flush=()=>{
      if(nums.length>=2){
        let [w,h,q]=nums;
        let d=findByName(designsList(),words);
        lines.push({w,h,qty:q&&q<=500?Math.round(q):1,design:d?d.name:'',jori:/jori|joڑi|جوڑی|pair/.test(words)});
      }
      nums=[];words='';
    };
    for(const part of parts){
      if(/^\d/.test(part)){
        let n=Number(part);
        if(nums.length===0&&!(n>=12&&n<=96)){words+=' ';continue;}            // not a width: skip
        if(nums.length===1&&!(n>=30&&n<=120)){nums=[];continue;}               // not a height: start again
        if(nums.length===2){
          // A third number: the count, unless it starts the next door instead.
          if(n>=12&&n<=96&&n!==Math.round(n))continue;
          nums.push(n);flush();continue;
        }
        nums.push(n);
      }else{
        if(nums.length===2&&/,|aur|اور|phir|پھر|\bthen\b/.test(part))flush();
        words+=' '+part;
      }
    }
    flush();
    return lines;
  }
  window.hkParseDoors=parseDoors;
  function orderOpen(){return document.getElementById('orderModal')?.classList.contains('open');}
  async function addDoors(lines){
    // A fresh form may hold one empty line: use it up first.
    if(currentOrderDoors.length===1&&!String(currentOrderDoors[0].size||'').trim()){currentOrderDoors=[];renderOrderDoors();}
    for(const l of lines){
      let size=`${l.w}x${l.h}`+(l.jori?' Jori':'')+(l.design?' '+l.design:'');
      addDoorFromSize(size);
      let i=currentOrderDoors.length-1;
      await wait(20);
      setVal('doorSize_'+i,size);
      let q=document.getElementById('doorQty_'+i);if(q)q.value=l.qty;
      let pr=l.design&&(priceList||[]).find(p=>String(p.size).toLowerCase()===l.design.toLowerCase());
      if(pr&&num(pr.rate)){let r=document.getElementById('doorRate_'+i);if(r)r.value=num(pr.rate);}
      updateDoor(i);
    }
    renderOrderDoors();updateOrderTotals();
  }
  async function dictateOrder(raw,lines){
    let fresh=!orderOpen();
    if(fresh){
      try{document.querySelectorAll('.modal.open').forEach(m=>{if(m.id!=='confirmModal')closeModal(m.id);});closeDrawer&&closeDrawer();}catch(e){}
      openOrderModal();await wait(80);
      let p=findByName(parties,raw);
      if(p)setVal('orderPartyId',p.id);
    }
    await addDoors(lines);
    let total=currentOrderDoors.reduce((s,d)=>s+num(d.doorAmount),0);
    window.hkDictation=true;
    say(`${lines.length} darwaze jud gaye: ${lines.map(l=>`${l.w}x${l.h}×${l.qty}`).join(', ')} · kul ${fmtRs(total)} — aur boliye ya check kar ke Save`);
    return true;
  }
  window.hkDictateOrder=dictateOrder;
  const STOP_WORDS=['bas','ho gaya','ho gya','stop','band karo','بس','ہو گیا','ہوگیا'];

  // ── Listening sheet (browser) with examples ──
  const EXAMPLES=['Aziz ka order 45 80 5, 39 80 5','Aziz ne Imran ko 5 lakh diye','Imran ko 2 lakh diye','mera kul hisaab','Aziz ka khata','naya order Aziz','payment Aziz 20000','kharcha bijli 5000','Rafiq ko 3000 do','order 21','45x80 Mughleazam 4 ki qeemat','Aziz ko yaad dahani','aaj ka hisaab','stock'];
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
  window.closeVoiceSheet=function(stop){document.getElementById('hkVoiceSheet')?.remove();if(stop){window.hkDictation=false;if(rec){try{rec.abort();}catch(e){}rec=null;}}};
  let origStart=window.startVoice;
  window.startVoice=function(){
    let nsr=window.hkNative&&window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.SpeechRecognition;
    if(nsr)return nativeListen(nsr);
    let SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR)return origStart?origStart.apply(this,arguments):showToast('⚠️ Is browser mein awaaz nahi chalti — Google Chrome istemal karein');
    rec=new SR();rec.lang='ur-PK';rec.interimResults=true;rec.maxAlternatives=5;
    sheet(window.hkDictation&&orderOpen()?'Agle darwaze boliye… (ruknay ke liye "bas")':'Boliye… jo kholna hai');
    rec.onresult=e=>{
      let r=e.results[e.results.length-1];
      let el=document.querySelector('#hkVoiceSheet .hk-voice-msg');if(el)el.textContent='“'+r[0].transcript+'”';
      if(r.isFinal){let alts=[...r].slice(1).map(a=>a.transcript);applyVoiceText(r[0].transcript,alts);}
    };
    rec.onerror=e=>{closeVoiceSheet();showToast(e.error==='not-allowed'?'⚠️ Mic ki ijazat dein (browser settings)':'⚠️ Awaaz nahi suni — dobara koshish karein');};
    rec.onend=()=>{
      rec=null;
      if(window.hkDictation&&orderOpen()){setTimeout(()=>{if(window.hkDictation&&orderOpen())startVoice();},350);return;}
      setTimeout(()=>closeVoiceSheet(),300);
    };
    try{rec.start();}catch(e){}
  };
  let origOpenOrder=window.openOrderModal;
  window.openOrderModal=function(){
    let r=origOpenOrder.apply(this,arguments);
    if(!document.getElementById('hkOrderMic')){
      let body=document.getElementById('orderModalBody')||document.querySelector('#orderModal .modal-body');
      if(body)body.insertAdjacentHTML('afterbegin','<button type="button" id="hkOrderMic" class="btn btn-gold btn-sm" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="window.hkDictation=true;startVoice()">🎤 Bol kar darwaze likhein (maslan: 45 80 5, 39 80 5)</button>');
    }
    return r;
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
