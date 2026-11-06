// Browser tests: open the real app in headless Chromium and check the main features.
// Run with: npm test   (needs `npx playwright install chromium` once)
const http=require('http');
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const {chromium}=require('playwright');

const ROOT=path.join(__dirname,'..');
const TYPES={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};

function serve(){
  return new Promise(resolve=>{
    const server=http.createServer((req,res)=>{
      let p=decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if(p==='/')p='/index.html';
      const file=path.join(ROOT,path.normalize(p));
      if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':TYPES[path.extname(file)]||'application/octet-stream'});
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0,()=>resolve(server));
  });
}

// Mock Firestore shared by every "phone" in a test.
const MOCK_DB=`
  try{localStorage.setItem('hk_morning_off','1');}catch(e){}  // morning summary pops up on its own; tests open it themselves
  window.__cloud={erp:{},erp_photos:{}};
  window.__cloudData=()=>HKSync.unpack(__cloud.erp.hk_main_user);   // the cloud copy is stored compressed
  window.__mockDb=function(){
    const clone=x=>JSON.parse(JSON.stringify(x));
    const col=c=>(__cloud[c]=__cloud[c]||{});
    const ref=(c,id)=>({_c:c,_id:id,
      get:async()=>({exists:!!col(c)[id],data:()=>clone(col(c)[id])}),
      set:async d=>{col(c)[id]=clone({...d,savedAt:1});},
      delete:async()=>{delete col(c)[id];},
      onSnapshot:()=>()=>{}});
    return {collection:c=>({doc:id=>ref(c,id),
        get:async()=>({forEach:fn=>Object.entries(col(c)).forEach(([id,v])=>fn({id,data:()=>clone(v)}))})}),
      runTransaction:async fn=>{await fn({get:r=>r.get(),set:(r,d)=>{__cloud[r._c][r._id]=clone({...d,savedAt:1});}});}};
  };`;

const tests=[];
function test(name,fn){tests.push({name,fn});}

test('app opens with no errors and every tab renders',async page=>{
  const r=await page.evaluate(async()=>{
    let tabs=[...document.querySelectorAll('.tab')].map(t=>t.id);
    for(const t of tabs)switchTab(t);
    switchTab('tabHome');
    return tabs.length;
  });
  assert.ok(r>=10,'tabs: '+r);
});

test('old localStorage data moves to IndexedDB and large data saves',async page=>{
  const r=await page.evaluate(async()=>{
    localStorage.setItem('ww_data',JSON.stringify({parties:[{id:5,name:'Ali Traders'}],orders:[]}));
    await HKStore.del('ww_data');
    let raw=await HKStore.boot();
    let migrated=JSON.parse(raw).parties[0].name;
    _bootRaw=raw;loadData();
    parties.push({id:6,name:'Big',photo:'x'.repeat(8e6)});saveLocal();
    await new Promise(r=>setTimeout(r,800));
    return {migrated,big:JSON.parse(await HKStore.get('ww_data')).parties[1].photo.length};
  });
  assert.strictEqual(r.migrated,'Ali Traders');
  assert.strictEqual(r.big,8e6);
});

test('two phones syncing keep each other\'s entries, edits and deletes',async page=>{
  const r=await page.evaluate(async()=>{
    db=__mockDb();cloudEnabled=true;_syncBaseLoaded=true;_syncBase=null;
    parties=[{id:1,name:'Ali'}];
    __cloud.erp.hk_main_user={parties:[{id:1,name:'Ali'},{id:2,name:'FromB'}],nextId:500};
    await syncNow();
    parties.push({id:newId(),name:'NewA'});saveAll();
    let c=await __cloudData();__cloud.erp.hk_main_user=c;
    c.parties=c.parties.map(p=>p.id===2?{...p,name:'FromB-edited'}:p);c.parties.push({id:3,name:'NewB'});
    await syncNow();
    let afterAdd=parties.map(p=>p.name);
    {let c2=await __cloudData();c2.parties=c2.parties.filter(p=>p.id!==1);__cloud.erp.hk_main_user=c2;}
    await syncNow();
    return {afterAdd,afterDelete:parties.map(p=>p.name)};
  });
  assert.deepStrictEqual(r.afterAdd,['Ali','FromB-edited','NewA','NewB']);
  assert.deepStrictEqual(r.afterDelete,['FromB-edited','NewA','NewB']);
});

test('photos sync through their own documents',async page=>{
  const r=await page.evaluate(async()=>{
    db=__mockDb();cloudEnabled=true;_syncBaseLoaded=true;_syncBase=null;
    const photo='data:image/jpeg;base64,'+'A'.repeat(200000);
    orders=[{id:1,orderNo:'ORD-1',partyId:1,date:'2026-10-01',orderTotal:5,payments:[],designPhoto:photo}];
    quotations=[{id:2,designPhoto:photo}];
    await syncNow();await new Promise(r=>setTimeout(r,300));
    let mainSize=JSON.stringify(__cloud.erp.hk_main_user).length;
    orders=[];quotations=[];_syncBase=null;_photosUploaded=new Set();
    await syncNow();await new Promise(r=>setTimeout(r,500));
    return {mainSize,photoDocs:Object.keys(__cloud.erp_photos).length,ok:orders[0].designPhoto===photo&&quotations[0].designPhoto===photo};
  });
  assert.ok(r.mainSize<5000,'main doc size '+r.mainSize);
  assert.strictEqual(r.photoDocs,1);
  assert.ok(r.ok);
});

test('PIN lock, wrong PIN, and staff cannot delete',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const type=async v=>{document.querySelector('.hk-pin-input').value=v;document.querySelector('[data-act=ok]').click();await wait(50);};
    businessProfile.ownerPin='1234';staffUsers=[{id:77,name:'Aslam',pin:'5555'}];
    parties=[{id:1,name:'Ali'}];saveAll();
    lockApp();await wait(100);
    await type('9999');let stillLocked=!!document.querySelector('.hk-pin-lock');
    await type('5555');let staff=hkIsStaff();
    deleteParty(1);await wait(100);
    let kept=parties.length===1;
    switchToOwner();await wait(100);await type('1234');
    return {stillLocked,staff,kept,owner:!hkIsStaff()};
  });
  assert.deepStrictEqual(r,{stillLocked:true,staff:true,kept:true,owner:true});
});

test('activity log records who did what',async page=>{
  const r=await page.evaluate(async()=>{
    staffUsers=[{id:77,name:'Aslam',pin:'5555'}];
    parties.push({id:newId(),name:'Bilal'});saveAll();
    activeUserId=77;
    orders.push({id:newId(),orderNo:'ORD-9',partyId:parties[0].id,date:'2026-10-28',orderTotal:50000,payments:[]});saveAll();
    orders[0].payments.push({id:1,amount:20000,date:'2026-10-28'});saveAll();
    activeUserId=null;
    return activityLog.map(a=>a.user+'|'+a.type+'|'+a.coll);
  });
  assert.deepStrictEqual(r,['Owner|add|parties','Aslam|add|orders','Aslam|pay|orders']);
});

test('auto-backup restores deleted data',async page=>{
  const r=await page.evaluate(async()=>{
    parties=[{id:1,name:'Ali'}];orders=[{id:9,orderNo:'ORD-1',partyId:1,date:'2026-10-01',orderTotal:10,payments:[]}];saveAll();
    let key='ww_autobackup_'+new Date().toISOString().slice(0,10);
    await HKStore.del(key);
    document.dispatchEvent(new Event('hk:ready'));await new Promise(r=>setTimeout(r,400));
    orders=[];saveAll();
    await restoreAutoBackup(key);await new Promise(r=>setTimeout(r,100));customConfirmOk();await new Promise(r=>setTimeout(r,200));
    return orders.length;
  });
  assert.strictEqual(r,1);
});

test('monthly statement, profit report, Excel and QR order screen',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    let cur=new Date().toISOString().slice(0,7);
    let d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);let prev=d.toISOString().slice(0,7);
    parties=[{id:1,name:'Ali',phone:'03001234567'}];
    orders=[{id:11,orderNo:'ORD-1',partyId:1,date:prev+'-10',orderTotal:100000,totalWoodCost:40000,totalLabour:10000,payments:[{id:1,amount:30000,date:prev+'-12'}]},
            {id:12,orderNo:'ORD-2',partyId:1,date:cur+'-05',orderTotal:50000,totalWoodCost:20000,totalLabour:5000,payments:[{id:2,amount:60000,date:cur+'-06'}]}];
    expenses=[{id:21,description:'Bijli',category:'Utilities',amount:8000,date:cur+'-03'}];
    saveAll();
    openStatements();
    let st=document.getElementById('hkStatementModalBody').innerText;
    openProfitReport();
    let pl=document.getElementById('hkProfitModalBody').innerText;
    let blobs=[];let oc=URL.createObjectURL;URL.createObjectURL=b=>{blobs.push(b);return oc(b);};
    await exportExcel();await wait(300);
    let wb=XLSX.read(await blobs[0].arrayBuffer(),{type:'array'});
    location.hash='#order=12';await wait(300);
    quickSetStatus(12,'ready');
    return {st,pl,sheets:wb.SheetNames.length,status:orders[1].status};
  });
  assert.ok(r.st.includes('Pichhla Rs.70,000')&&r.st.includes('Rs.60,000'),r.st);
  assert.ok(r.pl.includes('Rs.25,000')&&r.pl.includes('Rs.17,000'),r.pl);
  assert.strictEqual(r.sheets,7);
  assert.strictEqual(r.status,'ready');
});

test('home screen shows key numbers and what needs attention',async page=>{
  const r=await page.evaluate(async()=>{
    let d=new Date().toISOString().slice(0,10);
    parties=[{id:1,name:'Ali'}];
    orders=[{id:11,orderNo:'ORD-1',partyId:1,date:d,orderTotal:85000,netProfit:22000,payments:[{id:1,amount:5000,date:d}],status:'ready'}];
    cheques=[{id:5,status:'pending',dueDate:d,amount:40000,type:'received',partyId:1}];
    saveAll();renderAll();
    return {kpis:document.getElementById('hmKpis').innerText,att:document.getElementById('hmAttention').innerText,
      tiles:document.querySelectorAll('#tabHome .hm-kpi,#tabHome .hm-act').length,
      homeHeight:document.getElementById('tabHome').scrollHeight};
  });
  assert.ok(r.kpis.includes('Rs.85,000')&&r.kpis.includes('Rs.80,000')&&r.kpis.includes('Rs.22,000'),r.kpis);
  assert.ok(r.att.includes('cheque')&&r.att.includes('tayyar'),r.att);
  assert.strictEqual(r.tiles,8);
  assert.ok(r.homeHeight<1600,'home too long: '+r.homeHeight);
});

test('auto system: rate, labour, karigar record, stock, advance, cash book, challan',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    parties=[{id:1,name:'Ali'}];karigars=[{id:7,name:'Rafiq'}];
    inventory=[{id:50,name:'Kabza',qty:100,unit:'pcs',minStock:10,cost:150}];
    priceList=[{id:60,size:'45x80 Mughleazam',rate:500}];doorDesigns=['Mughleazam'];
    saveAll();
    openAutoSettings();
    document.getElementById('auLabourRate').value='60';document.getElementById('auDesign_0').value='80';
    document.getElementById('auKarigar').value='7';document.getElementById('auMat_50').value='3';
    saveAutoSettings();
    openOrderModal();await wait(50);
    document.getElementById('orderPartyId').value='1';
    addDoorFromSize('45x80');
    document.getElementById('doorSize_0').value='45x80 Mughleazam';updateDoor(0);
    document.getElementById('doorQty_0').value='2';updateDoor(0);
    document.getElementById('orderAdvance').value='20000';
    saveOrder();await wait(50);closeModal('paymentReceiptModal');
    let o=orders[0],lab=labours.find(l=>l.orderId===o.id);
    let out={rate:o.doors[0].rate,labour:o.totalLabour,lab:lab&&lab.totalCost,k:lab&&lab.karigarId,stock:inventory[0].qty,
      profit:o.netProfit,expected:25000-o.totalWoodCost-4000-900,paid:getOrderTotalPaid(o),bank:bankTransactions.length};
    openExpenseModal();await wait(30);
    document.getElementById('expDesc').value='Bijli';document.getElementById('expAmount').value='5000';saveExpense();
    out.bankAfterExpense=bankTransactions.length;
    generateChallan(o.id);await wait(200);
    out.status=o.status;
    deleteOrder(o.id);await wait(50);customConfirmOk();await wait(100);
    out.stockBack=inventory[0].qty;out.labLeft=labours.length;
    return out;
  });
  assert.strictEqual(r.rate,500);
  assert.strictEqual(r.labour,4000);
  assert.strictEqual(r.lab,4000);
  assert.strictEqual(r.k,7);
  assert.strictEqual(r.stock,94);
  assert.strictEqual(r.profit,r.expected);
  assert.strictEqual(r.paid,20000);
  assert.strictEqual(r.bank,1);
  assert.strictEqual(r.bankAfterExpense,2);
  assert.strictEqual(r.status,'delivered');
  assert.strictEqual(r.stockBack,100);
  assert.strictEqual(r.labLeft,0);
});

test('old orders: advance becomes a payment entry after owner confirms',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    parties=[{id:1,name:'Ali'}];
    orders=[
      {id:1,orderNo:'ORD-1',partyId:1,date:'2025-01-05',orderTotal:100000,advancePayment:20000,payments:[{id:11,amount:30000,date:'2025-02-01'}]},
      {id:2,orderNo:'ORD-2',partyId:1,date:'2025-01-06',orderTotal:50000,advancePayment:10000,payments:[]},
      {id:3,orderNo:'ORD-3',partyId:1,date:'2025-01-07',orderTotal:40000,advancePayment:5000,payments:[{id:12,amount:5000,date:'2025-01-07'}]}];
    businessProfile.advanceFixDone=false;
    let before=orders.map(getOrderTotalPaid);
    openAdvanceFix();await wait(50);
    let text=document.getElementById('hkAdvFixBody').innerText;
    confirmAdvanceFix();
    let after=orders.map(getOrderTotalPaid);
    let ledger=buildPartyLedgerEntries(parties[0]).filter(e=>e.credit===10000).length;
    let again=(openAdvanceFix(),orders.map(o=>o.payments.length));
    return {before,after,ledger,again,text};
  });
  assert.deepStrictEqual(r.before,[30000,10000,5000]);
  assert.deepStrictEqual(r.after,[50000,10000,5000]);
  assert.strictEqual(r.ledger,1);
  assert.deepStrictEqual(r.again,[2,1,1]);
  assert.ok(r.text.includes('ORD-1')&&!r.text.includes('ORD-3'),r.text);
});

test('supplier khata, delivery alerts, receipt, karigar pay, day close, wood list',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    let d=new Date().toISOString().slice(0,10),past=new Date(Date.now()-3*864e5).toISOString().slice(0,10);
    parties=[{id:1,name:'Ali',phone:'03001234567'}];karigars=[{id:7,name:'Rafiq'}];
    suppliers=[{id:9,name:'Wood Co',phone:'03007654321'}];
    woodTypes=[{id:1,name:'Kail',rate:300,openingStock:2}];
    orders=[{id:11,orderNo:'ORD-1',partyId:1,date:past,deliveryDate:past,orderTotal:50000,status:'cutting',payments:[],doors:[{w:45,h:80,qty:2,woodId:1,thickness:1.5}]}];
    labours=[{id:30,karigarId:7,orderId:11,totalCost:5000,paid:0,date:past},{id:31,karigarId:7,orderId:11,totalCost:3000,paid:0,date:d}];
    saveAll();renderAll();
    let att=document.getElementById('hmAttention').innerText;
    openPurchaseModal();await wait(30);
    document.getElementById('purchaseSupplier').value='9';document.getElementById('purchaseItem').value='Kail';
    document.getElementById('purchaseQty').value='10';document.getElementById('purchaseRate').value='3000';
    document.getElementById('purAccount').value='udhaar';savePurchase();
    let bal1=hkSupplierBalance(suppliers[0]),bankAfterUdhaar=bankTransactions.length;
    openSupplierPayment(9);document.getElementById('supPayAmt').value='12000';saveSupplierPayment(9);
    let bal2=hkSupplierBalance(suppliers[0]);
    openPaymentModal(11);await wait(30);document.getElementById('payAmount').value='20000';addPayment();
    let receipt=document.getElementById('hkReceiptModal').classList.contains('open');closeModal('hkReceiptModal');
    openKarigarPay();document.getElementById('kpAmt_7').value='6000';payKarigar(7);closeModal('hkKarPayModal');
    let paid=labours.map(l=>l.paid);
    openDayClose();let day=document.getElementById('hkDayModalBody').innerText;closeModal('hkDayModal');
    let short=hkWoodShort()[0].short;
    return {att,bal1,bankAfterUdhaar,bal2,receipt,paid,day,short};
  });
  assert.ok(r.att.includes('late')&&r.att.includes('Lakri kam'),r.att);
  assert.strictEqual(r.bal1,30000);
  assert.strictEqual(r.bankAfterUdhaar,0);
  assert.strictEqual(r.bal2,18000);
  assert.ok(r.receipt);
  assert.deepStrictEqual(r.paid,[5000,1000]);
  assert.ok(r.day.includes('Rs.20,000')&&r.day.includes('Rs.18,000')&&r.day.includes('Rs.2,000'),r.day);
  assert.ok(Math.abs(r.short-4.25)<0.01,'wood short '+r.short);
});

test('laptop: menu stays open on the left, no bottom bar',async page=>{
  await page.setViewportSize({width:1366,height:768});
  await page.waitForTimeout(200);
  const r=await page.evaluate(()=>({
    drawerX:document.getElementById('drawerNav').getBoundingClientRect().left,
    navShown:getComputedStyle(document.querySelector('.bottom-nav')).display!=='none',
    scrollX:document.documentElement.scrollWidth>window.innerWidth}));
  assert.strictEqual(r.drawerX,0);
  assert.strictEqual(r.navShown,false);
  assert.strictEqual(r.scrollX,false);
  // Opening another screen must hide Home (laptop grid once kept it visible).
  const tabs=await page.evaluate(()=>{switchTab('tabOrders');
    let home=getComputedStyle(document.getElementById('tabHome')).display,orders=getComputedStyle(document.getElementById('tabOrders')).display;
    switchTab('tabHome');return {home,orders,homeBack:getComputedStyle(document.getElementById('tabHome')).display};});
  assert.deepStrictEqual(tabs,{home:'none',orders:'block',homeBack:'grid'});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(600); // drawer slides out on phone
  const m=await page.evaluate(()=>({drawerX:document.getElementById('drawerNav').getBoundingClientRect().right,
    navShown:getComputedStyle(document.querySelector('.bottom-nav')).display!=='none',scrollX:document.documentElement.scrollWidth>window.innerWidth}));
  assert.ok(m.drawerX<=0,'drawer hidden on phone');
  assert.strictEqual(m.navShown,true);
  assert.strictEqual(m.scrollX,false);
});

test('laptop and phone with different parties both end up with all parties',async page=>{
  const r=await page.evaluate(async()=>{
    db=__mockDb();cloudEnabled=true;
    // Laptop: has its own party, joins the cloud first
    _syncBaseLoaded=true;_syncBase=null;parties=[{id:101,name:'Laptop Party'}];orders=[];
    await syncNow();
    let laptopCloud=await __cloudData();
    // Phone: different local party, joins the same cloud
    _syncBase=null;parties=[{id:202,name:'Mobile Party'}];
    await syncNow();
    let phone=parties.map(p=>p.name).sort();
    // Laptop syncs again from the state it had
    _syncBase=laptopCloud;parties=[{id:101,name:'Laptop Party'}];
    await syncNow();
    let laptop=parties.map(p=>p.name).sort();
    let code=hkLinkCode.read('x '+(localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'k',authDomain:'d',projectId:'p',appId:'a',email:'e@x.com'})),hkLinkCode.make()));
    return {phone,laptop,code};
  });
  assert.deepStrictEqual(r.phone,['Laptop Party','Mobile Party']);
  assert.deepStrictEqual(r.laptop,['Laptop Party','Mobile Party']);
  assert.deepStrictEqual(r.code,{apiKey:'k',authDomain:'d',projectId:'p',appId:'a',email:'e@x.com'});
});

test('cloud setup: pasting Firebase\'s whole code fills the four fields',async page=>{
  const r=await page.evaluate(async()=>{
    const snippet='import { initializeApp } from "firebase/app";\nconst firebaseConfig = {\n  apiKey: "AIzaSyB-abc_123",\n  authDomain: "hk.firebaseapp.com",\n  projectId: "hk-doors",\n  storageBucket: "hk.firebasestorage.app",\n  messagingSenderId: "99",\n  appId: "1:99:web:ab12"\n};';
    openFbSetup();
    let box=document.getElementById('fb_linkCode');box.value=snippet;box.dispatchEvent(new Event('input'));
    let filled=['fb_apiKey','fb_authDomain','fb_projectId','fb_appId'].map(i=>document.getElementById(i).value);
    // The window is taller than a phone: it must scroll so Connect can be reached.
    let ov=document.getElementById('fbSetupOverlay');
    let connect=[...ov.querySelectorAll('button')].find(b=>b.textContent.includes('Connect'));
    connect.scrollIntoView({block:'center'});
    let cr=connect.getBoundingClientRect();
    let reach=cr.top>=0&&cr.bottom<=innerHeight;
    skipFirebaseSetup();
    return {filled,bad:hkReadFirebaseSnippet('kuch bhi'),reach};
  });
  assert.deepStrictEqual(r.filled,['AIzaSyB-abc_123','hk.firebaseapp.com','hk-doors','1:99:web:ab12']);
  assert.strictEqual(r.bad,null);
  assert.ok(r.reach,'Connect button reachable on phone');
});

test('join link from one device opens Cloud Setup filled on the other',async page=>{
  const link=await page.evaluate(async()=>{
    localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'AIzaJ',authDomain:'hkw-doors.firebaseapp.com',projectId:'hkw-doors',appId:'1:2:web:3',email:'owner@gmail.com'}));
    openLinkDevice();
    let url=window._hkLinkCode;closeModal('hkLinkModal');
    localStorage.removeItem('ww_fb_cfg');   // the other device has no setup yet
    return {url,msg:window._hkLinkMsg};
  });
  assert.ok(link.url.includes('#join=')&&link.msg.includes(link.url),link.url);
  await page.goto(link.url);
  await page.waitForFunction(()=>document.getElementById('fbSetupOverlay')?.classList.contains('open'));
  const r=await page.evaluate(()=>({
    filled:['fb_apiKey','fb_projectId','fb_email'].map(i=>document.getElementById(i).value),
    hashGone:!location.hash}));
  assert.deepStrictEqual(r,{filled:['AIzaJ','hkw-doors','owner@gmail.com'],hashGone:true});
});

test('Reset All Data empties every joined device and keeps them connected',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'k',authDomain:'d',projectId:'hkw-doors',appId:'a',email:'e@x.com'}));
    db=__mockDb();cloudEnabled=true;_syncBaseLoaded=true;_syncBase=null;
    parties=[{id:1,name:'Ali'},{id:2,name:'Bilal'}];orders=[{id:9,orderNo:'ORD-1',partyId:1,date:'2026-10-01',orderTotal:5,payments:[]}];
    businessProfile.name='HK TEST';
    await syncNow();
    let phoneBase=await __cloudData();
    // Laptop resets
    resetAllData();await wait(50);customConfirmOk();await wait(300);await syncNow();
    let cd=await __cloudData();let cloudAfter={parties:cd.parties.length,orders:cd.orders.length};
    let keptCfg=!!localStorage.getItem('ww_fb_cfg'),keptName=businessProfile.name;
    // Phone (same data as before) syncs and gets emptied too
    _syncBase=phoneBase;parties=JSON.parse(JSON.stringify(phoneBase.parties));orders=JSON.parse(JSON.stringify(phoneBase.orders));
    await syncNow();
    let phone={parties:parties.length,orders:orders.length};
    let backups=(await HKStore.keys()).filter(k=>String(k).includes('reset')).length;
    // Cloud settings come back from the second copy if browser storage is wiped
    await HKStore.set('ww_fb_cfg',localStorage.getItem('ww_fb_cfg'));
    localStorage.removeItem('ww_fb_cfg');
    await HKStore.boot();
    let restored=JSON.parse(localStorage.getItem('ww_fb_cfg')||'null');
    return {cloudAfter,keptCfg,keptName,phone,backups,restored:restored&&restored.projectId};
  });
  assert.deepStrictEqual(r.cloudAfter,{parties:0,orders:0});
  assert.strictEqual(r.keptCfg,true);
  assert.strictEqual(r.keptName,'HK TEST');
  assert.deepStrictEqual(r.phone,{parties:0,orders:0});
  assert.ok(r.backups>=1,'backup before reset');
  assert.strictEqual(r.restored,'hkw-doors');
});

test('install button: browser prompt when offered, help window otherwise',async page=>{
  const r=await page.evaluate(async()=>{
    installApp();let help=document.getElementById('hkInstallModal').classList.contains('open');closeModal('hkInstallModal');
    let prompted=false;let ev=new Event('beforeinstallprompt');ev.prompt=()=>{prompted=true;};ev.userChoice=Promise.resolve({outcome:'accepted'});
    window.dispatchEvent(ev);
    let shown=getComputedStyle(document.getElementById('hkInstallHdr')).display!=='none';
    document.getElementById('hkInstallHdr').click();await new Promise(r=>setTimeout(r,50));
    return {help,shown,prompted,menu:!!document.getElementById('hkInstallDrawerBtn')};
  });
  assert.deepStrictEqual(r,{help:true,shown:true,prompted:true,menu:true});
});

test('fingerprint opens the locked app (virtual authenticator)',async page=>{
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  const r=await page.evaluate(async()=>{
    businessProfile.ownerPin='1234';saveAll();
    await enrolFinger();
    let enrolled=!!hkFinger.enrolledId();
    lockApp();await new Promise(r=>setTimeout(r,1500));
    return {enrolled,unlocked:!document.querySelector('.hk-pin-lock')};
  });
  assert.deepStrictEqual(r,{enrolled:true,unlocked:true});
});

test('udhaar limit warning, reminders, order summary, karigar report, import, voice, Urdu',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));let out={};
    parties=[{id:1,name:'Ali Traders',phone:'03001234567',creditLimit:50000,openingBalance:40000}];
    openOrderModal();await wait(50);document.getElementById('orderPartyId').value='1';addDoorFromSize('45x80');
    saveOrder();await wait(50);
    out.warned=document.getElementById('confirmModalMsg').textContent.includes('hadd');
    customConfirmOk();await wait(120);closeModal('paymentReceiptModal');
    out.saved=orders.length;
    let opened=[];window.open=u=>{opened.push(u);return null;};
    await sendNextReminder();out.reminder=opened[0]&&opened[0].includes('wa.me/923001234567');
    await sendOrderSummary(orders[0].id);out.summary=decodeURIComponent(opened[1]||'').includes(orders[0].orderNo);
    karigars=[{id:7,name:'Rafiq'}];labours=[{id:30,karigarId:7,orderId:orders[0].id,totalCost:3000,paid:1000,date:new Date().toISOString().slice(0,10)}];
    openKarigarReport();out.report=document.getElementById('hkKarRepModalB').innerText.includes('Dena hai Rs.2,000');closeModal('hkKarRepModal');
    out.import=importPartiesFromRows([{Naam:'Bilal Wood','Purana Baqaya':'25,000'},{Naam:'Ali Traders'}]);
    let v=hkParseVoice('payment Bilal Wood 20 hazar');out.voice=[v.kind,v.amount,v.party&&v.party.name];
    out.voiceUr=hkParseVoice('خرچہ بجلی ۵۰۰۰').amount;
    toggleLanguage();await wait(150);
    out.urdu=document.querySelector('.nav-btn[data-tab="tabOrders"]').innerText.includes('آرڈر');
    return out;
  });
  assert.deepStrictEqual(r,{warned:true,saved:1,reminder:true,summary:true,report:true,import:{added:1,skipped:1},voice:['payment',20000,'Bilal Wood'],voiceUr:5000,urdu:true});
});

test('bill photo, morning summary, online catalog publish and customer page',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));let out={};
    // bill photo on kharcha
    let c=document.createElement('canvas');c.width=40;c.height=30;let png=await new Promise(r=>c.toBlob(r,'image/png'));
    openExpenseModal();await wait(30);
    document.getElementById('expDesc').value='Bijli';document.getElementById('expAmount').value='5000';
    await hkPickBill(new File([png],'bill.png',{type:'image/png'}));
    saveExpense();await wait(50);
    out.bill=!!(expenses[0]&&expenses[0].billPhoto&&expenses[0].billPhoto.startsWith('data:image/jpeg'));
    switchTab('tabExpenses');await wait(50);out.billBtn=!!document.querySelector('#expensesList .hk-bill-btn');
    out.cloudHasNoPhoto=!JSON.stringify(getCloudSnapshot().expenses).includes('data:image');
    // morning summary
    let t=new Date().toISOString().slice(0,10);
    parties=[{id:1,name:'Ali',phone:'0300'}];
    orders=[{id:5,orderNo:'ORD-5',partyId:1,date:t,deliveryDate:t,orderTotal:9000,payments:[],status:'cutting'}];
    openMorning();out.morning=document.getElementById('hkMorningB').innerText;closeModal('hkMorning');
    // publish catalog to the mock cloud
    localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'KEY1',authDomain:'d',projectId:'proj1',appId:'a',email:'e@x.com'}));
    db=__mockDb();__cloud.public={};cloudEnabled=true;
    priceList=[{id:1,size:'45x80 Mughleazam',rate:500,photo:'data:image/jpeg;base64,AAAA'},{id:2,size:'39x78',rate:440}];
    businessProfile.whatsapp='03001112222';
    out.pub=await publishCatalog(true);
    out.catalogDoc=__cloud.public.catalog&&__cloud.public.catalog.items.length;
    out.photoDoc=Object.keys(__cloud.public).filter(k=>k.startsWith('ph_')).length;
    openCatalog();out.link=document.querySelector('#hkCatalogB input').value;
    return out;
  });
  assert.ok(r.bill&&r.billBtn&&r.cloudHasNoPhoto,JSON.stringify(r));
  assert.ok(r.morning.includes('ORD-5')&&r.morning.includes('aaj deni hai'),r.morning);
  assert.strictEqual(r.pub,true);
  assert.strictEqual(r.catalogDoc,2);
  assert.strictEqual(r.photoDoc,1);
  assert.ok(r.link.includes('catalog.html#p=proj1&k=KEY1'),r.link);
  // Customer page, with the public Firestore REST API answered locally
  const enc=v=>typeof v==='number'?{doubleValue:v}:typeof v==='string'?{stringValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
  await page.route('https://firestore.googleapis.com/**',route=>{
    let u=route.request().url();
    if(u.includes('/public/catalog'))return route.fulfill({json:{fields:enc({name:'HK Doors',whatsapp:'03001112222',currency:'Rs.',items:[{size:'45x80 Mughleazam',rate:500,photo:'p1'},{size:'39x78',rate:440,photo:''}]}).mapValue.fields}});
    return route.fulfill({json:{fields:{data:{stringValue:'data:image/png;base64,iVBORw0KGgo='}}}});
  });
  const base=page.url().replace(/index\.html.*$/,'');
  await page.goto(base+'catalog.html#p=proj1&k=KEY1');
  await page.waitForSelector('.item');
  const c=await page.evaluate(()=>{
    let opened='';window.open=u=>{opened=u;return null;};
    chg(0,1);chg(0,1);chg(1,1);
    document.getElementById('cName').value='Bilal';sendOrder();
    return {items:document.querySelectorAll('.item').length,tot:document.getElementById('tot').innerText,msg:decodeURIComponent(opened)};
  });
  assert.strictEqual(c.items,2);
  // 45x80 = 25 sq.ft × 500 = 12,500 per door × 2 = 25,000; 39x78 = 21.125 × 440 = 9,295
  assert.ok(c.tot.includes('3')&&c.tot.includes('34,295'),c.tot);
  assert.ok(c.msg.includes('wa.me/923001112222')&&c.msg.includes('45x80 Mughleazam × 2')&&c.msg.includes('Bilal'),c.msg);
});

test('activity: one line per action, owner can delete a line or clear all; labour without karigar flagged',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    parties=[{id:1,name:'Aziz bhai'}];karigars=[];
    let a=hkAutoCfg();a.labourRate=60;saveAll();activityLog=[];
    openOrderModal();await wait(50);document.getElementById('orderPartyId').value='1';addDoorFromSize('45x80');
    saveOrder();await wait(80);closeModal('paymentReceiptModal');
    let orderLines=activityLog.filter(x=>x.coll==='orders').map(x=>x.type);
    let attention=document.getElementById('hmAttention').innerText;
    let labName=getKarigarName(labours[0]&&labours[0].karigarId);
    let first=activityLog[0].id,before=activityLog.length;
    deleteActivityEntry(first);await wait(50);customConfirmOk();await wait(120);
    let afterOne=activityLog.length;
    clearActivityLog();await wait(50);customConfirmOk();await wait(120);
    return {orderLines,attention,labName,before,afterOne,afterAll:activityLog.length};
  });
  assert.deepStrictEqual(r.orderLines,['add']);
  assert.ok(r.attention.includes('karigar nahi chuna'),r.attention);
  assert.strictEqual(r.labName,'Karigar nahi chuna');
  assert.strictEqual(r.afterOne,r.before-1);
  assert.strictEqual(r.afterAll,0);
});

test('monthly bills, rate list PDF, tools and machines, sales target',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const day=new Date().toISOString().slice(8,10);
    // 21. Bill due today → reminder on Home; paying writes a Kharcha entry once.
    openBills();editBill();
    document.getElementById('hkBillName').value='Dukaan ka kiraya';
    document.getElementById('hkBillAmt').value='25000';
    document.getElementById('hkBillDay').value=String(parseInt(day));
    saveBill(null);await wait(50);
    renderDashboard();
    let billAttention=document.getElementById('hmAttention').innerText;
    let bill=monthlyBills[0];
    payBill(bill.id);document.getElementById('hkBillPayAmt').value='26000';confirmBillPay(bill.id);
    payBill(bill.id);
    let billExp=expenses.filter(e=>e.billId===bill.id);
    renderDashboard();
    let afterPay=document.getElementById('hmAttention').innerText;
    // 22. Rate list PDF content and shortcut.
    priceList=[{id:1,size:'Mughleazam',rate:950},{id:2,size:'Rose Design',rate:800}];
    let html=hkRateListHTML('x');
    openPriceListModal();let plBtn=!!document.getElementById('hkRatePdfBtn');closeModal('priceListModal');
    let opened='';window.open=u=>{opened=u;};sendRateListWA();
    // 23. Tools: give to karigar, repair with cost → Kharcha, service reminder.
    karigars=[{id:7,name:'Akram'}];
    openTools();editTool();
    document.getElementById('hkToolName').value='Randa machine';
    document.getElementById('hkToolKind').value='machine';
    document.getElementById('hkToolLast').value='2020-01-01';
    document.getElementById('hkToolEvery').value='90';
    saveTool(null);
    let tool=shopTools[0];
    giveTool(tool.id);document.getElementById('hkToolGive').value='7';confirmGiveTool(tool.id);
    let toolsText=document.getElementById('hkToolsModalB').innerText;
    renderDashboard();
    let svcAttention=document.getElementById('hmAttention').innerText;
    repairTool(tool.id);document.getElementById('hkRepText').value='Belt badli';document.getElementById('hkRepCost').value='1500';saveRepair(tool.id);
    let repairExp=expenses.find(e=>e.toolId===tool.id);
    // 24. Target card on Home.
    orders=[{id:50,orderNo:'O-1',date:new Date().toISOString().slice(0,10),orderTotal:250000,payments:[]}];
    setSalesTarget();document.getElementById('hkTargetAmt').value='1000000';saveSalesTarget();
    renderDashboard();
    let target=document.getElementById('hmTarget').innerText;
    // Staff can't delete bills/tools.
    staffUsers=[{id:99,name:'Bilal',pin:'1111'}];activeUserId=99;
    deleteShopTool(tool.id);await wait(50);
    let staffDelete=!!document.getElementById('confirmModalOkBtn')?.closest('.modal.open');
    activeUserId=null;
    return {billAttention,billExp:billExp.map(e=>e.amount),afterPay,html,plBtn,opened,toolsText,svcAttention,
      repair:repairExp&&[repairExp.amount,repairExp.category],lastService:shopTools[0].lastService,
      target,tools:shopTools.length,staffDelete:!!staffDelete};
  });
  assert.ok(r.billAttention.includes('Dukaan ka kiraya'),r.billAttention);
  assert.deepStrictEqual(r.billExp,[26000]);
  assert.ok(!r.afterPay.includes('Dukaan ka kiraya'),r.afterPay);
  assert.ok(r.html.includes('Mughleazam')&&r.html.includes('RATE LIST'));
  assert.ok(r.plBtn);
  assert.ok(decodeURIComponent(r.opened).includes('Rose Design'),r.opened);
  assert.ok(r.toolsText.includes('Akram'),r.toolsText);
  assert.ok(r.svcAttention.includes('Randa machine'),r.svcAttention);
  assert.deepStrictEqual(r.repair,[1500,'Marammat']);
  assert.strictEqual(r.lastService,new Date().toISOString().slice(0,10));
  assert.ok(r.target.includes('25%'),r.target);
  assert.strictEqual(r.tools,1);
  assert.strictEqual(r.staffDelete,false);
});

test('confirm box opened from another window shows on top and deletes (Activity, bills)',async page=>{
  await page.evaluate(()=>{
    let at=new Date().toISOString();
    activityLog=[{id:5001,at,user:'Owner',type:'add',coll:'orders',rid:1,text:'ORD-6 Aziz'},{id:5002,at,user:'Owner',type:'del',coll:'orders',rid:1,text:'ORD-6 Aziz'}];
    monthlyBills=[{id:6001,name:'Bijli ka bill',amount:9000,day:28}];
    saveAll();activityLog=activityLog.filter(a=>a.id>=5001&&a.id<=5002);saveAll();openActivityLog();
  });
  await page.locator('#hkActivityBody button[title="Yeh line mitayein"]').first().click();
  await page.locator('#confirmModalOkBtn').click(); // fails if another window covers it
  await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate(()=>activityLog.length),1);
  await page.locator('#hkActivityBody button',{hasText:'Sab saaf karein'}).click();
  await page.locator('#confirmModalOkBtn').click();
  await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate(()=>activityLog.length),0);
  await page.evaluate(()=>{closeModal('hkActivityModal');openBills();});
  await page.locator('#hkBillsModalB button',{hasText:'🗑'}).click();
  await page.locator('#confirmModalOkBtn').click();
  await page.waitForTimeout(500);
  assert.strictEqual(await page.evaluate(()=>monthlyBills.length),0);
});

test('APK: files are saved and shared, outside links open in their app; web shows APK menu',async page=>{
  assert.ok(await page.evaluate(()=>!!document.getElementById('hkApkBtn')&&!hkNative),'APK menu in browser');
  await page.addInitScript(()=>{
    window.__nat={writes:[],shares:[],opened:[]};
    window.Capacitor={isNativePlatform:()=>true,Plugins:{
      Filesystem:{writeFile:async o=>{__nat.writes.push([o.directory,o.path,o.data.length]);return {uri:'file:///cache/'+o.path};},
        readdir:async()=>({files:Array.from({length:17},(_,i)=>({name:`HK_Doors_Backup_2026-10-${String(i+1).padStart(2,'0')}.json`}))}),
        deleteFile:async o=>{(__nat.deleted=__nat.deleted||[]).push(o.path);}},
      NativeBiometric:{isAvailable:async()=>({isAvailable:true}),verifyIdentity:async()=>{__nat.bio=(__nat.bio||0)+1;}},
      SpeechRecognition:{available:async()=>({available:true}),requestPermissions:async()=>({speechRecognition:'granted'}),start:async o=>{__nat.lang=o.language;return {matches:['kharcha bijli 5000']};}},
      Share:{share:async o=>{__nat.shares.push(o.files[0]);}},
      AppLauncher:{openUrl:async o=>{__nat.opened.push(o.url);}}}};
  });
  await page.reload();
  await page.waitForFunction(()=>document.getElementById('statsArea')?.innerHTML);
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    let a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['hello'],{type:'application/pdf'}));a.download='Test.pdf';a.click();
    await wait(300);
    window.open('https://wa.me/923001234567?text=hi','_blank');
    let writesBefore=__nat.writes.length;
    await hkFileBackupNow();
    let backup=__nat.writes.slice(writesBefore).map(w=>w[1]);
    businessProfile.ownerPin='1234';
    await enrolFinger();
    let fingerOn=localStorage.getItem('hk_finger_cred');
    let unlocked=await hkFingerVerify();
    startVoice();await wait(200);
    let expDesc=document.getElementById('expDesc')?.value,expAmt=document.getElementById('expAmount')?.value;
    // Photo field: asks camera or gallery, then opens the picker with the right setting.
    let inp=document.createElement('input');inp.type='file';inp.accept='image/*';document.body.appendChild(inp);
    let opened=[];inp.addEventListener('click',e=>{if(!e.defaultPrevented){opened.push(inp.getAttribute('capture'));e.preventDefault();}});
    inp.click();
    let sheet=!!document.querySelector('.hk-src-sheet');
    document.querySelector('.hk-src-sheet button[data-s="camera"]').click();
    inp.click();document.querySelector('.hk-src-sheet button[data-s="gallery"]').click();
    let photo={sheet,opened,left:!!document.querySelector('.hk-src-sheet')};
    return {nat:__nat,native:hkNative,apkMenu:!!document.getElementById('hkApkBtn'),
      base:hkPublicBase(),sw:document.documentElement.classList.contains('hk-native'),
      backup,deleted:__nat.deleted,photo,fingerOn,unlocked,bio:__nat.bio,lang:__nat.lang,expDesc,expAmt};
  });
  assert.strictEqual(r.native,true);
  assert.deepStrictEqual(r.nat.writes.slice(0,2).map(w=>w[0]),['DOCUMENTS','CACHE']);
  assert.ok(r.nat.writes[0][1].endsWith('Test.pdf'));
  assert.deepStrictEqual(r.nat.shares,['file:///cache/Test.pdf']);
  assert.deepStrictEqual(r.nat.opened,['https://wa.me/923001234567?text=hi']);
  assert.strictEqual(r.apkMenu,false);
  assert.strictEqual(r.base,'https://waqasali300300-hue.github.io/Waqas-DOOR/');
  assert.ok(r.sw);
  assert.strictEqual(r.backup.length,1);
  assert.ok(/^HK Doors\/Backup\/HK_Doors_Backup_\d{4}-\d{2}-\d{2}\.json$/.test(r.backup[0]),r.backup[0]);
  assert.deepStrictEqual(r.deleted,['HK Doors/Backup/HK_Doors_Backup_2026-10-01.json','HK Doors/Backup/HK_Doors_Backup_2026-10-02.json']);
  assert.strictEqual(r.fingerOn,'native');
  assert.strictEqual(r.unlocked,true);
  assert.strictEqual(r.bio,2);
  assert.strictEqual(r.lang,'ur-PK');
  assert.deepStrictEqual(r.photo,{sheet:true,opened:['environment',null],left:false});
  assert.ok(r.expAmt==='5000',JSON.stringify([r.expDesc,r.expAmt]));
});

test('fonts are bundled with the app (work offline)',async page=>{
  const r=await page.evaluate(async()=>{
    await document.fonts.ready;
    let links=[...document.querySelectorAll('link[rel=stylesheet]')].map(l=>l.getAttribute('href'));
    await Promise.all(['600 12px Poppins','400 12px Inter','600 12px "IBM Plex Mono"'].map(f=>document.fonts.load(f)));
    return {links,ok:['600 12px Poppins','400 12px Inter','600 12px "IBM Plex Mono"'].map(f=>document.fonts.check(f))};
  });
  assert.ok(!r.links.some(h=>/googleapis/.test(h)),JSON.stringify(r.links));
  assert.deepStrictEqual(r.ok,[true,true,true]);
});

test('new APK finds the shop cloud by itself; connected app shares only the public address',async page=>{
  // 1. Connected owner app saves the public connect details after a sync.
  const shared=await page.evaluate(async()=>{
    localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'AIzaShop',authDomain:'hkw-doors.firebaseapp.com',projectId:'hkw-doors',appId:'1:2:web:3',email:'owner@gmail.com'}));
    db=__mockDb();__cloud.public={};cloudEnabled=true;
    await syncNow();await new Promise(r=>setTimeout(r,100));
    return __cloud.public.connect;
  });
  assert.strictEqual(shared.apiKey,'AIzaShop');
  assert.ok(!/owner@gmail|pass|email/i.test(JSON.stringify(shared)),JSON.stringify(shared));
  // 2. A brand-new APK reads them and opens Cloud Setup with everything filled.
  const ctx=page.context();
  await page.evaluate(()=>{localStorage.clear();indexedDB.deleteDatabase&&indexedDB.databases&&indexedDB.databases().then(l=>l.forEach(d=>indexedDB.deleteDatabase(d.name)));});
  await ctx.route('https://firestore.googleapis.com/**',route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({fields:{apiKey:{stringValue:'AIzaShop'},authDomain:{stringValue:'hkw-doors.firebaseapp.com'},projectId:{stringValue:'hkw-doors'},appId:{stringValue:'1:2:web:3'}}})}));
  await page.addInitScript(()=>{window.Capacitor={isNativePlatform:()=>true,Plugins:{}};localStorage.setItem('hk_morning_off','1');});
  await page.reload();
  await page.waitForFunction(()=>document.getElementById('fbSetupOverlay')?.classList.contains('open'),null,{timeout:8000});
  await page.waitForFunction(()=>document.getElementById('fb_apiKey')?.value==='AIzaShop',null,{timeout:5000});
  const r=await page.evaluate(()=>({
    filled:['fb_apiKey','fb_projectId','fb_appId','fb_email'].map(i=>document.getElementById(i).value),
    msg:document.getElementById('fb_linkMsg').innerText,
    focus:document.activeElement&&document.activeElement.id}));
  assert.deepStrictEqual(r.filled,['AIzaShop','hkw-doors','1:2:web:3','']);
  assert.ok(r.msg.includes('password'),r.msg);
  assert.strictEqual(r.focus,'fb_email');
  // Forgot password sends the reset email to the owner.
  const reset=await page.evaluate(async()=>{
    let sent=null;
    firebase.initializeApp=(cfg,name)=>({name,auth:()=>({sendPasswordResetEmail:async e=>{sent=[e,cfg.projectId];}})});
    document.getElementById('fb_email').value='owner@gmail.com';
    document.getElementById('fbForgotBtn').click();
    await new Promise(r=>setTimeout(r,100));
    return sent;
  });
  assert.deepStrictEqual(reset,['owner@gmail.com','hkw-doors']);
});

test('data safety: dated cloud copies, old ones tidied, view and restore an old copy',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'k',authDomain:'d',projectId:'hkw-doors',appId:'a'}));
    db=__mockDb();cloudEnabled=true;
    parties=[{id:1,name:'Aziz bhai'}];orders=[{id:5,orderNo:'ORD-1',partyId:1,date:'2026-01-02',orderTotal:50000,payments:[]}];saveAll();
    // Old copies: 2 in an old month (first one kept for good), one recent.
    const old=(id,kind)=>{__cloud.erp_backup_meta=__cloud.erp_backup_meta||{};__cloud.erp_backups=__cloud.erp_backups||{};
      __cloud.erp_backup_meta[id]={id,day:id.slice(0,10),kind:kind||'daily',parties:1,orders:1,sale:1};__cloud.erp_backups[id]={z:'x'};};
    old('2025-03-01');old('2025-03-09');old(new Date(Date.now()-5*86400000).toISOString().slice(0,10));
    localStorage.removeItem('hk_cloud_bk_day');
    await syncNow();await wait(300);
    let today=new Date().toISOString().slice(0,10);
    let ids=Object.keys(__cloud.erp_backup_meta).sort();
    // Screen lists the copies.
    await openDataSafety();await wait(100);
    let screen=document.getElementById('hkSafetyModalB').innerText;
    // Data changes, then today's copy is brought back.
    orders=[];parties.push({id:2,name:'Naya'});saveAll();
    await viewCloudBackup(today);await wait(50);
    let view=document.getElementById('hkSafetyModalB').innerText;
    restoreCloudBackup(today);await wait(50);customConfirmOk();await wait(400);
    return {ids,today,screen,view,orders:orders.length,parties:parties.map(p=>p.name),
      before:Object.values(__cloud.erp_backup_meta).filter(m=>m.kind==='before-restore').map(m=>[m.orders,m.parties])};
  });
  assert.ok(r.ids.includes(r.today),JSON.stringify(r.ids));
  assert.ok(r.ids.includes('2025-03-01'),'first copy of an old month is kept');
  assert.ok(!r.ids.includes('2025-03-09'),'other old daily copies are tidied');
  assert.strictEqual(r.ids.length,3,JSON.stringify(r.ids));
  assert.ok(r.screen.includes('Cloud (Firebase)')&&r.screen.includes(r.today),r.screen);
  assert.ok(r.view.includes('ORD-1')&&r.view.includes('Aziz bhai'),r.view);
  assert.strictEqual(r.orders,1);
  assert.deepStrictEqual(r.parties,['Aziz bhai']);
  assert.deepStrictEqual(r.before,[[0,2]]);
});

test('customer tracking link: only that order is shared, follows changes, status page shows it',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'k',authDomain:'d',projectId:'hkw-doors',appId:'a'}));
    db=__mockDb();__cloud.public={};cloudEnabled=true;
    parties=[{id:1,name:'Aziz bhai',phone:'03001234567'},{id:2,name:'Secret party',phone:'0300'}];
    orders=[{id:5,orderNo:'ORD-7',partyId:1,date:'2026-11-01',status:'cutting',orderTotal:90000,doors:[{size:'45x80',qty:2,doorAmount:90000}],payments:[{amount:30000,date:'2026-11-01'}]},
            {id:6,orderNo:'ORD-8',partyId:2,date:'2026-11-01',orderTotal:111,payments:[]}];
    saveAll();
    let opened='';window.open=u=>{opened=u;};
    viewOrderDetail(5);let btn=!!document.querySelector('.hk-track-btn');
    await shareOrderTracking(5);
    let key=Object.keys(__cloud.public).find(k=>k.startsWith('t_'));
    let first=JSON.parse(JSON.stringify(__cloud.public[key]));
    orders[0].status='ready';orders[0].payments.push({amount:10000,date:'2026-11-02'});saveAll();
    await wait(3400);
    return {btn,opened:decodeURIComponent(opened),key,first,later:__cloud.public[key],all:JSON.stringify(__cloud.public),token:orders[0].trackId};
  });
  assert.ok(r.btn);
  assert.ok(r.opened.includes('status.html#p=hkw-doors&t='+r.token),r.opened);
  assert.strictEqual(r.key,'t_'+r.token);
  assert.ok(/^[a-z2-9]{12}$/.test(r.token),r.token);
  assert.deepStrictEqual([r.first.orderNo,r.first.status,r.first.paid,r.first.balance],['ORD-7','cutting',30000,60000]);
  assert.deepStrictEqual([r.later.status,r.later.balance],['ready',50000]);
  assert.ok(!r.all.includes('Secret party')&&!r.all.includes('ORD-8'),'other orders are not shared');
  // The customer's page.
  const fs=v=>v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(fs)}}:typeof v==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fs(x)]))}}:typeof v==='number'?{doubleValue:v}:{stringValue:String(v)};
  await page.context().route('https://firestore.googleapis.com/**',route=>route.request().url().includes('t_'+r.token)
    ?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({fields:fs(r.later).mapValue.fields})})
    :route.fulfill({status:404,body:'{}'}));
  await page.goto(page.url().replace(/index\.html.*$/,'status.html#p=hkw-doors&t='+r.token));
  await page.waitForSelector('.steps');
  const text=await page.locator('#main').innerText();
  assert.ok(text.includes('ORD-7')&&text.includes('Aziz bhai'),text);
  assert.ok(text.includes('50,000'),text);
  assert.ok(await page.locator('.step.now b').innerText()==='Tayyar');
});

test('karigar fix screen, old customers, APK back button',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    karigars=[{id:7,name:'Rafiq'}];
    labours=[{id:30,labourNo:'LAB-1',totalCost:1000,date:'2026-11-01'},{id:31,labourNo:'LAB-2',totalCost:2000,karigarId:99},{id:32,labourNo:'LAB-3',karigarId:7,totalCost:5}];
    let old=new Date(Date.now()-90*86400000).toISOString().slice(0,10),recent=new Date().toISOString().slice(0,10);
    parties=[{id:1,name:'Purana Gahak',phone:'0300'},{id:2,name:'Naya Gahak',phone:'0301'}];
    orders=[{id:5,orderNo:'ORD-1',partyId:1,date:old,orderTotal:1,payments:[]},{id:6,orderNo:'ORD-2',partyId:2,date:recent,orderTotal:1,payments:[]}];
    saveAll();renderDashboard();
    let attention=document.getElementById('hmAttention').innerText;
    openLabourFix();
    let rows=document.querySelectorAll('.hk-labfix').length;
    document.querySelectorAll('.hk-labfix').forEach(s=>s.value='7');saveLabourFix();
    let fixed=labours.map(l=>l.karigarId);
    closeModal('hkLabFixModal');
    openOldCustomers();let oldList=document.getElementById('hkOldCustModalB').innerText;closeModal('hkOldCustModal');
    // Back button.
    let min=0;window.Capacitor={Plugins:{App:{minimizeApp:()=>{min++;}}}};
    openSettingsModal();hkBackButton();let modalClosed=!document.getElementById('settingsModal').classList.contains('open');
    switchTab('tabOrders');hkBackButton();let home=document.querySelector('.tab.active').id;
    hkBackButton();
    return {attention,rows,fixed,oldList,modalClosed,home,min};
  });
  assert.ok(r.attention.includes('2 labour record'),r.attention);
  assert.strictEqual(r.rows,2);
  assert.deepStrictEqual(r.fixed,[7,7,7]);
  assert.ok(r.oldList.includes('Purana Gahak')&&!r.oldList.includes('Naya Gahak'),r.oldList);
  assert.deepStrictEqual([r.modalClosed,r.home,r.min],[true,'tabHome',1]);
});

test('catalog request link becomes an estimate; karigar advance is deducted and cash book stays right',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    parties=[{id:1,name:'Aziz bhai',phone:'0300-1234567'}];quotations=[];saveAll();
    let code=btoa(unescape(encodeURIComponent(JSON.stringify({n:'Aziz',p:'+92 300 1234567',i:[['45x80 Mughleazam',2,950],['Rose Design',1,800]]})))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    location.hash='#est='+code;await wait(150);
    let shown=document.getElementById('hkReqModalB')?.innerText||'';
    document.getElementById('hkReqMake').click();await wait(150);
    let q=quotations[quotations.length-1];
    let est={party:q.partyId,doors:q.doors.map(d=>[d.size,d.qty,Math.round(d.doorAmount)]),total:Math.round(q.quoteTotal),parties:parties.length,hash:location.hash,editing:document.getElementById('quotationModal')?.classList.contains('open')};
    document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));_modalStack.length=0;
    // Advance
    karigars=[{id:7,name:'Rafiq'}];bankTransactions=[];
    labours=[{id:30,labourNo:'LAB-1',karigarId:7,totalCost:10000,paid:0,date:'2026-11-01'}];saveAll();
    openKarigarPay();
    document.getElementById('hkAdvKar').value='7';document.getElementById('hkAdvAmt').value='3000';giveKarigarAdvance();
    let afterAdv=bankTransactions.map(t=>[t.type,t.amount]);
    let cashDefault=document.getElementById('kpAmt_7').value,boxOn=document.getElementById('kpAdv_7').checked;
    payKarigar(7);
    let l=labours[0];
    return {shown,est,afterAdv,cashDefault,boxOn,paid:l.paid,advPaid:l.advPaid,left:hkAdvanceLeft(7),
      cashOut:bankTransactions.filter(t=>t.type==='withdrawal').reduce((s,t)=>s+t.amount,0),tx:bankTransactions.map(t=>t.amount)};
  });
  assert.ok(r.shown.includes('45x80 Mughleazam')&&r.shown.includes('Rose Design'),r.shown);
  assert.strictEqual(r.est.party,1,'matched by phone');
  assert.strictEqual(r.est.parties,1);
  assert.deepStrictEqual(r.est.doors,[['45x80 Mughleazam',2,47500],['Rose Design',1,0]]);
  assert.strictEqual(r.est.total,47500);
  assert.strictEqual(r.est.hash,'');
  assert.ok(r.est.editing);
  assert.deepStrictEqual(r.afterAdv,[['withdrawal',3000]]);
  assert.deepStrictEqual([r.cashDefault,r.boxOn],['7000',true]);
  assert.deepStrictEqual([r.paid,r.advPaid,r.left],[10000,3000,0]);
  assert.strictEqual(r.cashOut,10000,JSON.stringify(r.tx));
});

test('stock count, design report, staff limits, year closing',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    woodTypes=[{id:1,name:'Kail',rate:5000,openingStock:100}];inventory=[{id:50,name:'Kabza',qty:40,unit:'pcs',cost:150}];
    let y=String(new Date().getFullYear()),d=y+'-03-05';
    parties=[{id:1,name:'Aziz bhai'}];
    orders=[{id:5,orderNo:'ORD-1',partyId:1,date:d,orderTotal:60000,netProfit:20000,payments:[{amount:10000,date:d}],
      doors:[{size:'45x80 Mughleazam',qty:2,doorAmount:50000,labourPerDoor:2000,woodId:1,w:45,h:80,cftMode:'auto'},{size:'Rose Design',qty:1,doorAmount:10000,woodId:1}]}];
    expenses=[{id:9,description:'Bijli',amount:4000,date:d}];saveAll();
    // Stock count
    let before=getWoodStockRemaining(woodTypes[0]);
    openStockCount();
    document.querySelector('.hk-sc[data-kind="wood"]').value=String(Math.round((before-3)*100)/100);
    document.querySelector('.hk-sc[data-kind="inv"]').value='35';
    saveStockCount();
    let stock={wood:Math.round(getWoodStockRemaining(woodTypes[0])*100)/100,expect:Math.round((before-3)*100)/100,inv:inventory[0].qty,hist:businessProfile.stockCounts.length,
      value:businessProfile.stockCounts[0].value};
    closeModal('hkStockModal');
    // Design report
    openDesignReport('year');let design=[...document.querySelectorAll('#hkDesignModalB .hk-dr-row > div:first-child > b:first-child')].map(b=>b.innerText);closeModal('hkDesignModal');
    // Year
    localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'k',authDomain:'d',projectId:'hkw-doors',appId:'a'}));
    db=__mockDb();cloudEnabled=true;
    openYearReport(y);let year=document.getElementById('hkYearPreview').innerText;
    closeYear(y);await wait(50);customConfirmOk();await wait(1500);
    let meta=__cloud.erp_backup_meta&&__cloud.erp_backup_meta['year-'+y];
    document.querySelectorAll('.modal.open').forEach(m=>m.classList.remove('open'));_modalStack.length=0;
    // Staff
    staffUsers=[{id:99,name:'Bilal',pin:'1111'}];activeUserId=99;updateUserBadge();
    let repHidden=document.querySelector('.drawer-item[data-tab="tabReports"]').classList.contains('hk-staff-hide');
    let bankHidden=document.querySelector('.drawer-item[data-tab="tabBankBook"]').classList.contains('hk-staff-hide');
    switchTab('tabReports');let tab=document.querySelector('.tab.active').id;
    viewOrderDetail(5);let detail=document.getElementById('orderDetailContent').innerText;
    let designBlocked=(openDesignReport(),!document.getElementById('hkDesignModal')?.classList.contains('open'));
    activeUserId=null;updateUserBadge();
    let ownerSees=!document.querySelector('.drawer-item[data-tab="tabReports"]').classList.contains('hk-staff-hide');
    return {stock,design,year,meta:meta&&[meta.kind,meta.orders],repHidden,bankHidden,tab,staffProfit:/Net Profit/.test(detail),designBlocked,ownerSees,closed:businessProfile.closedYears};
  });
  assert.strictEqual(r.stock.wood,r.stock.expect);
  assert.strictEqual(r.stock.inv,35);
  assert.strictEqual(r.stock.hist,1);
  assert.strictEqual(r.stock.value,-3*5000-5*150);
  assert.ok(r.design[0].includes('Mughleazam')&&r.design[1].includes('Rose Design'),JSON.stringify(r.design));
  assert.ok(r.year.includes('60,000')&&r.year.includes('Aziz bhai'),r.year.slice(0,300));
  assert.deepStrictEqual(r.meta,['year',1]);
  assert.deepStrictEqual(r.closed,[String(new Date().getFullYear())]);
  assert.deepStrictEqual([r.repHidden,r.bankHidden,r.tab,r.staffProfit,r.designBlocked,r.ownerSees],[true,true,'tabHome',false,true,true]);
});

test('cutting list, workshop board, rate change, personal loans',async page=>{
  const r=await page.evaluate(async()=>{
    woodTypes=[{id:1,name:'Kail',rate:5000,openingStock:0}];
    parties=[{id:1,name:'Aziz bhai'}];
    let t=new Date().toISOString().slice(0,10);
    orders=[{id:5,orderNo:'ORD-1',partyId:1,date:t,deliveryDate:'2020-01-01',status:'pending',orderTotal:1,payments:[],
      doors:[{size:'36x84',w:36,h:84,qty:2,thickness:1.5,woodId:1},{size:'Bina naap',qty:1,woodId:1}]}];
    priceList=[{id:1,size:'Mughleazam',rate:950}];saveAll();
    let cut=hkCutParts(orders[0].doors,{stile:4.5,rail:6,rails:3,panelT:0.75});
    openCuttingList([5]);let cutText=document.getElementById('hkCutModalB').innerText;closeModal('hkCutModal');
    openWorkshopBoard();
    let cards=document.querySelectorAll('#hkBoard .hk-board-card').length,late=document.querySelectorAll('#hkBoard .hk-board-card.late').length;
    boardNext(5);let status=orders[0].status,moved=document.querySelectorAll('#hkBoard .hk-board-col')[1].querySelectorAll('.hk-board-card').length;
    closeWorkshopBoard();
    openRateChange();document.getElementById('hkRcPct').value='10';rateChangePreview();applyRateChange();
    await new Promise(r=>setTimeout(r,50));customConfirmOk();await new Promise(r=>setTimeout(r,120));
    let rates=[priceList[0].rate,woodTypes[0].rate];
    openLoans();document.getElementById('hkLoanName').value='Bhai jan';document.getElementById('hkLoanPhone').value='0300';addLoanPerson();
    let L=personalLoans[0];
    document.getElementById('hkLoanAmt').value='5000';addLoanEntry(L.id,'diya');
    document.getElementById('hkLoanAmt').value='2000';addLoanEntry(L.id,'liya');
    let bal=hkLoanBal(personalLoans[0]),cashBook=bankTransactions.length;
    closeModal('hkLoanModal');
    staffUsers=[{id:99,name:'Bilal',pin:'1'}];activeUserId=99;openLoans();
    let staffSees=document.getElementById('hkLoanModal').classList.contains('open');activeUserId=null;
    return {cut:cut.list.map(p=>[p.name,p.L,p.W,p.T,p.qty]),byWood:cut.byWood,skipped:cut.skipped,cutText,cards,late,status,moved,rates,bal,cashBook,staffSees};
  });
  assert.deepStrictEqual(r.cut,[['Khara (Stile)',84,4.5,1.5,4],['Aara (Rail)',27,6,1.5,6],['Panel',27,33,0.75,4]]);
  assert.strictEqual(r.skipped,1);
  assert.ok(r.cutText.includes('84 × 4.5 × 1.5')&&r.cutText.includes('naap nahi'),r.cutText);
  assert.deepStrictEqual([r.cards,r.late,r.status,r.moved],[1,1,'cutting',1]);
  assert.deepStrictEqual(r.rates,[1045,5000]);
  assert.strictEqual(r.bal,3000);
  assert.strictEqual(r.cashBook,0,'personal loans stay out of the cash book');
  assert.strictEqual(r.staffSees,false);
});

test('live khata link and page; QR scan reads a code and opens the order',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    localStorage.setItem('ww_fb_cfg',JSON.stringify({apiKey:'k',authDomain:'d',projectId:'hkw-doors',appId:'a'}));
    db=__mockDb();__cloud.public={};cloudEnabled=true;
    parties=[{id:1,name:'Aziz bhai',phone:'0300',openingBalance:5000},{id:2,name:'Doosri party'}];
    orders=[{id:5,orderNo:'ORD-1',partyId:1,date:'2026-11-01',orderTotal:20000,payments:[{amount:8000,date:'2026-11-02'}]},{id:6,orderNo:'ORD-9',partyId:2,date:'2026-11-01',orderTotal:7,payments:[]}];
    saveAll();
    let opened='';window.open=u=>{opened=u;};
    openPartyLedger(1);let btn=!!document.querySelector('.hk-khata-btn');closeModal('partyLedgerModal');
    await shareLiveKhata(1);
    let key=Object.keys(__cloud.public).find(k=>k.startsWith('k_'));
    let doc=__cloud.public[key];
    // QR: make a code with the app's own QR library, then read it back.
    let box=document.createElement('div');document.body.appendChild(box);
    new QRCode(box,{text:'https://x.github.io/Waqas-DOOR/#order=5',width:256,height:256});
    await wait(100);
    let canvas=box.querySelector('canvas');
    let read=await hkDecodeQRCanvas(canvas);
    let action=hkHandleScan(read);
    let detailOpen=document.getElementById('orderDetailModal').classList.contains('open');
    return {btn,opened:decodeURIComponent(opened),key,token:parties[0].khataToken,doc,all:JSON.stringify(__cloud.public),read,action,detailOpen};
  });
  assert.ok(r.btn);
  assert.ok(r.opened.includes('khata.html#p=hkw-doors&t='+r.token),r.opened);
  assert.strictEqual(r.key,'k_'+r.token);
  assert.strictEqual(r.doc.balance,17000);
  assert.strictEqual(r.doc.entries.length,3);
  assert.ok(!r.all.includes('Doosri party')&&!r.all.includes('ORD-9'));
  assert.strictEqual(r.read,'https://x.github.io/Waqas-DOOR/#order=5');
  assert.deepStrictEqual([r.action,r.detailOpen],['order',true]);
  const fs=v=>v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(fs)}}:typeof v==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,fs(x)]))}}:typeof v==='number'?{doubleValue:v}:{stringValue:String(v)};
  await page.context().route('https://firestore.googleapis.com/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({fields:fs(r.doc).mapValue.fields})}));
  await page.goto(page.url().replace(/index\.html.*$/,'khata.html#p=hkw-doors&t='+r.token));
  await page.waitForSelector('table');
  const text=await page.locator('#main').innerText();
  assert.ok(text.includes('Aziz bhai')&&text.includes('17,000')&&text.includes('ORD-1'),text);
});

test('new main menu: groups, quick actions, most used, search, staff; phone reminders plan',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    localStorage.setItem('hk_menu_use',JSON.stringify({tabOrders:5,openBills:3,openCalculator:1}));
    openDrawer();await wait(100);
    let groups=[...document.querySelectorAll('#hkMenu .hk-menu-sec[data-group]')].map(s=>[s.dataset.group,s.querySelectorAll('.drawer-item').length]);
    let loose=[...document.querySelectorAll('#drawerNav .drawer-item')].filter(b=>!b.closest('#hkMenu')).length;
    let total=document.querySelectorAll('#hkMenu .hk-menu-sec[data-group] .drawer-item').length;
    let fav=[...document.querySelectorAll('#hkMenuFav .drawer-item')].map(b=>b.dataset.key);
    let labels=['tabOrders','openLoans','openBills'].map(k=>document.querySelector(`#hkMenu .drawer-item[data-key="${k}"] .t-label`)?.textContent);
    // Clicking a tile still works and is counted.
    document.querySelector('#hkMenu .drawer-item[data-key="tabKhata"]').click();await wait(50);
    let tab=document.querySelector('.tab.active').id,use=JSON.parse(localStorage.getItem('hk_menu_use')).tabKhata;
    // Fold a group, search finds items inside it.
    hkToggleMenuGroup('maal');
    filterDrawerItems('rate');
    let shown=[...document.querySelectorAll('#hkMenu .hk-menu-sec[data-group] .drawer-item')].filter(b=>b.offsetParent!==null).map(b=>b.dataset.key);
    filterDrawerItems('');
    // Staff: owner-only tiles stay hidden even after a search.
    staffUsers=[{id:99,name:'Bilal',pin:'1'}];activeUserId=99;updateUserBadge();filterDrawerItems('rep');filterDrawerItems('');
    let staffSeesReports=document.querySelector('#hkMenu .drawer-item[data-key="tabReports"]').offsetParent!==null;
    activeUserId=null;updateUserBadge();closeDrawer();
    // Reminders plan.
    let t0=new Date();t0.setHours(6,0,0,0);
    let d=x=>{let y=new Date(t0);y.setDate(y.getDate()+x);return y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');};
    orders=[{id:1,orderNo:'ORD-1',partyId:1,date:d(0),deliveryDate:d(0),status:'ready',orderTotal:1,payments:[]},{id:2,orderNo:'ORD-2',partyId:1,date:d(0),deliveryDate:d(-3),status:'pending',orderTotal:1,payments:[]},
      {id:3,orderNo:'ORD-3',partyId:1,date:d(0),deliveryDate:d(2),status:'delivered',orderTotal:1,payments:[]}];
    cheques=[{id:5,status:'pending',dueDate:d(1),amount:20000}];
    monthlyBills=[{id:6,name:'Bijli ka bill',amount:9000,day:parseInt(d(2).slice(8))}];expenses=[];
    let plan=hkNotifyPlan(t0).map(n=>[n.id-7000,n.body,n.schedule.at.getHours()]);
    return {groups,loose,total,fav,labels,tab,use,shown,staffSeesReports,plan};
  });
  assert.strictEqual(r.loose,0,'every item sits in a group');
  assert.ok(r.total>=55,String(r.total));
  assert.ok(r.groups.every(g=>g[1]>0),JSON.stringify(r.groups));
  assert.deepStrictEqual(r.fav,['tabOrders','openBills']);
  assert.deepStrictEqual(r.labels,['Orders','Zaati Qarz','Mahana Bill']);
  assert.deepStrictEqual([r.tab,r.use],['tabKhata',1]);
  assert.deepStrictEqual(r.shown.sort(),['openPriceListModal','openRateChange','openRateListPdf'].sort());
  assert.strictEqual(r.staffSeesReports,false);
  assert.strictEqual(r.plan.length,3,JSON.stringify(r.plan));
  assert.ok(r.plan[0][1].includes('ORD-1')&&r.plan[0][1].includes('1 order late'),r.plan[0][1]);
  assert.ok(r.plan[1][1].includes('cheque')&&r.plan[2][1].includes('Bijli ka bill'),JSON.stringify(r.plan));
  assert.ok(!JSON.stringify(r.plan).includes('ORD-3'));
  assert.ok(r.plan.every(p=>p[2]===9));
});

test('design album and instant price: price, WhatsApp text, estimate',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    priceList=[{id:1,size:'Mughleazam',rate:950,photo:'data:image/gif;base64,R0lGODlhAQABAAAAACw='},{id:2,size:'Rose Design',rate:800}];
    parties=[];quotations=[];saveAll();
    openAlbum();
    let first=document.querySelector('.hk-album-name').innerText,hasImg=!!document.querySelector('.hk-album-stage img');
    hkAlbumGo(1);let second=document.querySelector('.hk-album-name').innerText;
    let rateShown=!!document.querySelector('.hk-album-rate');hkAlbumToggleRate();let rateHidden=!document.querySelector('.hk-album-rate');hkAlbumToggleRate();
    document.querySelector('.hk-album-price').click();await wait(50);
    let albumGone=!document.getElementById('hkAlbum'),line0=JSON.parse(JSON.stringify(hkQuickLines()[0]));
    hkQpSet(0,'size','45x80');hkQpSet(0,'qty','2');
    hkQpAdd();hkQpSet(1,'design','Mughleazam');hkQpSet(1,'size','36x84');
    let total=document.querySelector('.hk-qp-total b').innerText;
    document.getElementById('hkQpName').value='Aziz';document.getElementById('hkQpPhone').value='0300 1234567';
    let opened='';window.open=u=>{opened=u;};await hkQpSend();
    hkQpEstimate();await wait(100);
    let q=quotations[quotations.length-1];
    return {first,hasImg,second,rateShown,rateHidden,albumGone,line0,total,opened:decodeURIComponent(opened),
      q:q&&[q.doors.map(d=>[d.size,d.qty,Math.round(d.doorAmount)]),Math.round(q.quoteTotal)],party:parties.map(p=>[p.name,p.phone]),
      editing:document.getElementById('quotationModal')?.classList.contains('open')};
  });
  assert.deepStrictEqual([r.first,r.hasImg,r.second],['Mughleazam',true,'Rose Design']);
  assert.deepStrictEqual([r.rateShown,r.rateHidden,r.albumGone],[true,true,true]);
  assert.deepStrictEqual([r.line0.design,r.line0.rate],['Rose Design',800]);
  // 45x80 = 25 sq.ft × 2 × 800 = 40,000 ; 36x84 = 21 sq.ft × 950 = 19,950
  assert.ok(r.total.includes('59,950'),r.total);
  assert.ok(r.opened.startsWith('https://wa.me/923001234567')&&r.opened.includes('Kul Rs.59,950'),r.opened);
  assert.deepStrictEqual(r.q,[[['45x80 Rose Design',2,40000],['36x84 Mughleazam',1,19950]],59950]);
  assert.deepStrictEqual(r.party,[['Aziz','0300 1234567']]);
  assert.ok(r.editing);
});

test('old khata entries count everywhere; bills go to WhatsApp as a picture',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    parties=[{id:1,name:'Aziz bhai',phone:'0300 1234567',openingBalance:5000}];
    orders=[{id:5,orderNo:'ORD-7',partyId:1,date:'2026-11-01',orderTotal:20000,payments:[{amount:8000,date:'2026-11-02'}],doors:[{size:'45x80',qty:1,doorAmount:20000}]}];
    saveAll();
    let before=getPartyBalance(parties[0]);
    openOldKhata(1);
    document.getElementById('hkOkDate').value='2025-03-01';document.getElementById('hkOkAmt').value='10000';document.getElementById('hkOkNote').value='bill 45';addOldKhataEntry(1,'maal');
    document.getElementById('hkOkDate').value='2025-04-01';document.getElementById('hkOkAmt').value='3000';addOldKhataEntry(1,'paise');
    let after=getPartyBalance(parties[0]);
    let led=buildPartyLedgerEntries(parties[0]).map(e=>[e.type.slice(0,12),e.balance]);
    closeModal('hkOldKhataModal');
    openPartyModal(1);let hint=!!document.getElementById('hkOldKhataHint');closeModal('partyModal');
    // Sharing: capture what goes to the share sheet.
    let shared=[];
    navigator.canShare=()=>true;navigator.share=async d=>{shared.push({name:d.files[0].name,type:d.files[0].type,size:d.files[0].size,text:d.text});};
    await sendOrderSummary(5);
    window._hkReceipt={phone:'0300',msg:'Assalam-o-Alaikum Aziz bhai,\nHK — aap ki payment Rs.8,000 wasool ho gayi (ORD-7). Shukriya!\nBaqaya: Rs.24,000'};
    await openWA('0300',window._hkReceipt.msg);
    await sendWhatsAppReminder(1);
    await sendReminder(1);
    let marked=parties[0].lastReminder===new Date().toISOString().slice(0,10);
    personalLoans=[{id:70,name:'Bhai jan',phone:'0301',entries:[{id:1,dir:'diya',amount:5000,date:'2026-10-01'}]}];
    await loanReminder(70);
    // No file sharing (laptop): picture saved + WhatsApp text opened.
    navigator.canShare=()=>false;let opened='';window.open=u=>{opened=u;};
    let saved=await sendWhatsAppReminder(1);
    return {before,after,led,hint,shared,saved,marked,opened:decodeURIComponent(opened)};
  });
  assert.strictEqual(r.before,17000);
  assert.strictEqual(r.after,24000);
  assert.ok(r.led.some(x=>x[0]==='Purana khata'),JSON.stringify(r.led));
  assert.strictEqual(r.led[r.led.length-1][1],24000);
  assert.ok(r.hint);
  assert.strictEqual(r.shared.length,5,JSON.stringify(r.shared));
  assert.ok(r.shared[3].name.startsWith('Yaad_Dahani_Aziz')&&r.marked,JSON.stringify(r.shared[3]));
  assert.ok(r.shared[4].name.startsWith('Yaad_Dahani_Bhai')&&r.shared[4].text.includes('5,000'),JSON.stringify(r.shared[4]));
  assert.ok(r.shared.every(s=>s.type==='image/png'&&s.size>5000),JSON.stringify(r.shared));
  assert.ok(r.shared[0].name.startsWith('Bill_ORD-7')&&r.shared[0].text.includes('ORD-7'),JSON.stringify(r.shared[0]));
  assert.ok(r.shared[1].name.startsWith('Rasid_'),r.shared[1].name);
  assert.ok(r.shared[2].name.startsWith('Yaad_Dahani_')&&r.shared[2].text.includes('24,000'),JSON.stringify(r.shared[2]));
  assert.strictEqual(r.saved,'saved');
  assert.ok(r.opened.startsWith('https://wa.me/923001234567'),r.opened);
});

test('auto system 2: wood and karigar by design, delivery date, wood warning, loose labour handed over',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    woodTypes=[{id:1,name:'Kail',rate:5000,openingStock:0},{id:2,name:'Deodar',rate:9000,openingStock:0}];
    karigars=[{id:7,name:'Rafiq'},{id:8,name:'Akram'}];
    doorDesigns=['Mughleazam','Rose Design'];
    parties=[{id:1,name:'Aziz bhai'}];orders=[];
    labours=[{id:30,labourNo:'LAB-1',totalCost:1000,date:'2026-10-01'}];
    let a=hkAutoCfg();a.labourRate=60;saveAll();
    // Settings screen: Mughleazam → Deodar + Akram, 15 days.
    openAutoSettings();
    document.getElementById('au2Wood_0').value='2';document.getElementById('au2Kar_0').value='8';
    document.getElementById('au2Days').value='15';
    document.getElementById('auKarigar').value='7';
    saveAutoSettings();await wait(400);
    let offer=document.getElementById('confirmModalMsg').textContent;customConfirmOk();await wait(150);
    let loose=labours[0].karigarId;
    // New order: a Mughleazam door.
    openOrderModal();await wait(50);
    document.getElementById('orderPartyId').value='1';
    document.getElementById('orderDate').value='2026-11-06';
    addDoorFromSize('45x80');
    let i=currentOrderDoors.length-1;
    document.getElementById('doorSize_'+i).value='45x80 Mughleazam';updateDoor(i);
    let woodAuto=currentOrderDoors[i].woodId;
    document.getElementById('orderKarigarId').value='';
    let toasts=[];let st=window.showToast;window.showToast=m=>{toasts.push(m);st(m);};
    saveOrder();await wait(1200);closeModal('paymentReceiptModal');
    let o=orders[orders.length-1],lab=labours.find(l=>l.orderId===o.id);
    return {offer,loose,woodAuto,delivery:o.deliveryDate,karigar:o.karigarId,labKarigar:lab&&lab.karigarId,labCost:lab&&lab.totalCost,
      warn:toasts.some(t=>t.includes('Lakri kam')&&t.includes('Deodar'))};
  });
  assert.ok(r.offer.includes('1 labour')&&r.offer.includes('Rafiq'),r.offer);
  assert.strictEqual(r.loose,7);
  assert.strictEqual(r.woodAuto,2,'Mughleazam gets Deodar');
  assert.strictEqual(r.delivery,'2026-11-21');
  assert.deepStrictEqual([r.karigar,r.labKarigar],[8,8]);
  assert.strictEqual(r.labCost,1500,'25 sq.ft × 60');
  assert.ok(r.warn,'wood shortage warned');
});

test('voice order: sizes spoken one after another fill the order form, nothing saved',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    parties=[{id:1,name:'Aziz bhai',phone:'0300'},{id:2,name:'Zulfiqar Traders'}];
    priceList=[{id:1,size:'Mughleazam',rate:950}];orders=[];saveAll();
    applyVoiceText('Aziz ka order 45 80 5, 39 80 5, 33 80 10');await wait(400);
    let out={open:document.getElementById('orderModal').classList.contains('open'),
      party:document.getElementById('orderPartyId').value,
      mic:!!document.getElementById('hkOrderMic'),
      doors:currentOrderDoors.map(d=>[String(d.size).trim(),Number(d.qty)])};
    applyVoiceText('60 80 Mughleazam 2');await wait(300);
    out.more=currentOrderDoors.map(d=>[String(d.size).trim(),Number(d.qty)]);
    out.rate=Number(document.getElementById('doorRate_3')?.value);
    applyVoiceText('bas');await wait(100);
    out.dict=window.hkDictation;out.saved=orders.length;
    out.priceStays=hkUnderstand('45x80 darwaze ki qeemat').kind;
    return out;
  });
  assert.strictEqual(r.open,true);assert.strictEqual(r.party,'1');assert.strictEqual(r.mic,true);
  assert.deepStrictEqual(r.doors,[['45x80',5],['39x80',5],['33x80',10]]);
  assert.deepStrictEqual(r.more[3],['60x80 Mughleazam',2]);
  assert.strictEqual(r.rate,950);
  assert.strictEqual(r.dict,false);assert.strictEqual(r.saved,0);
});

test('voice commands: names in Urdu or Roman letters, every kind of command opens the right thing',async page=>{
  const r=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    parties=[{id:1,name:'Aziz bhai',phone:'0300'},{id:2,name:'Zulfiqar Traders',phone:'0301'},{id:3,name:'Ahmed Builders'}];
    karigars=[{id:7,name:'Rafiq'},{id:8,name:'Akram'}];
    priceList=[{id:1,size:'Mughleazam',rate:950},{id:2,size:'Rose Design',rate:800}];
    orders=[{id:5,orderNo:'ORD-21',partyId:1,date:'2026-11-01',orderTotal:1,payments:[]}];saveAll();
    const U=s=>{let v=hkUnderstand(s);return [v.kind,(v.party||v.karigar||v.order||{}).name||(v.order&&v.order.orderNo)||v.word||'',v.amount||v.size||''];};
    let out={
      ledgerUr:U('عزیز بھائی کا کھاتہ'),ledgerRo:U('Aziz ka khata'),zulf:U('ذوالفقار کا حساب'),
      pay:U('payment Aziz 20 hazar'),payUr:U('احمد سے پیمنٹ ۵۰۰۰'),exp:U('kharcha bijli 5000'),
      kar:U('رفیق کو 3000 مزدوری دو'),newOrder:U('naya order Zulfiqar'),
      price:U('45x80 Mughleazam 4 ki qeemat'),order:U('order 21'),rem:U('Aziz ko yaad dahani'),
      day:U('aaj ka hisaab'),stock:U('اسٹاک'),wood:U('lakri'),kr:U('karigar report'),back:U('backup'),
      none:U('kuch bhi nahi')
    };
    // Acting: ledger opens, payment form filled, price filled, search fallback.
    applyVoiceText('عزیز کا کھاتہ');await wait(150);
    out.ledgerOpen=document.getElementById('partyLedgerModal').classList.contains('open');
    applyVoiceText('payment Ahmed 7000');await wait(250);
    out.payAmt=document.getElementById('payAmount')?.value;
    applyVoiceText('Rose Design 36x84 3 ki qeemat');await wait(200);
    out.qp=JSON.parse(JSON.stringify(hkQuickLines()[0]));
    applyVoiceText('blah',['Aziz ka khata']);await wait(150);
    out.alt=document.getElementById('partyLedgerModal').classList.contains('open');
    applyVoiceText('kuch bhi nahi');await wait(200);
    out.search=document.getElementById('globalSearchInput')?.value;
    return out;
  });
  assert.deepStrictEqual(r.ledgerUr,['ledger','Aziz bhai','']);
  assert.deepStrictEqual(r.ledgerRo,['ledger','Aziz bhai','']);
  assert.deepStrictEqual(r.zulf.slice(0,2),['ledger','Zulfiqar Traders']);
  assert.deepStrictEqual(r.pay,['payment','Aziz bhai',20000]);
  assert.deepStrictEqual(r.payUr,['payment','Ahmed Builders',5000]);
  assert.deepStrictEqual(r.exp,['expense','',5000]);
  assert.deepStrictEqual(r.kar,['karigarPay','Rafiq',3000]);
  assert.deepStrictEqual(r.newOrder.slice(0,2),['newOrder','Zulfiqar Traders']);
  assert.deepStrictEqual(r.price,['price','','45x80']);
  assert.deepStrictEqual(r.order,['order','ORD-21','']);
  assert.deepStrictEqual(r.rem.slice(0,2),['reminder','Aziz bhai']);
  assert.deepStrictEqual([r.day[0],r.day[1]],['screen','aaj ka hisaab']);
  assert.deepStrictEqual([r.stock[0],r.stock[1]],['screen','stock']);
  assert.deepStrictEqual([r.wood[0],r.wood[1]],['screen','lakri']);
  assert.deepStrictEqual([r.kr[0],r.kr[1]],['screen','karigar report']);
  assert.deepStrictEqual([r.back[0],r.back[1]],['screen','backup']);
  assert.strictEqual(r.none[0],'search');
  assert.ok(r.ledgerOpen);
  assert.strictEqual(r.payAmt,'7000');
  assert.deepStrictEqual([r.qp.design,r.qp.size,r.qp.qty],['Rose Design','36x84',3]);
  assert.ok(r.alt,'uses the phone\'s second guess');
  assert.strictEqual(r.search,'kuch bhi nahi');
});

(async()=>{
  const server=await serve();
  const url=`http://localhost:${server.address().port}/index.html`;
  const browser=await chromium.launch();
  let failed=0;
  for(const t of tests){
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.addInitScript(MOCK_DB);
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    try{
      await page.goto(url);
      await page.waitForFunction(()=>window.HKStore&&HKStore.ok!==undefined&&document.getElementById('statsArea')?.innerHTML);
      await page.waitForTimeout(300);
      await t.fn(page);
      assert.deepStrictEqual(errors,[],'page errors');
      console.log('✔',t.name);
    }catch(e){
      failed++;
      console.log('✘',t.name,'\n ',e.message);
    }
    await ctx.close();
  }
  await browser.close();server.close();
  console.log(failed?`${failed} failed`:`all ${tests.length} browser tests passed`);
  process.exit(failed?1:0);
})();
