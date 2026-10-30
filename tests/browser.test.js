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
  window.__cloud={erp:{},erp_photos:{}};
  window.__mockDb=function(){
    const clone=x=>JSON.parse(JSON.stringify(x));
    const ref=(c,id)=>({_c:c,_id:id,
      get:async()=>({exists:!!__cloud[c][id],data:()=>clone(__cloud[c][id])}),
      set:async d=>{__cloud[c][id]=clone({...d,savedAt:1});},
      onSnapshot:()=>()=>{}});
    return {collection:c=>({doc:id=>ref(c,id)}),
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
    let c=__cloud.erp.hk_main_user;
    c.parties=c.parties.map(p=>p.id===2?{...p,name:'FromB-edited'}:p);c.parties.push({id:3,name:'NewB'});
    await syncNow();
    let afterAdd=parties.map(p=>p.name);
    __cloud.erp.hk_main_user.parties=__cloud.erp.hk_main_user.parties.filter(p=>p.id!==1);
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
    let laptopCloud=JSON.parse(JSON.stringify(__cloud.erp.hk_main_user));
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
