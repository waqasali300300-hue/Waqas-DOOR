// HK Wood Doors ERP — home screen
// One clean screen: this month's numbers, 4 quick actions, what needs attention,
// production pipeline, cash chart and latest orders. Older charts sit in the
// "Mazeed reports" section; every other screen is in the ☰ menu.
(function(){
  const STAGES=[['pending','Pending'],['cutting','Cutting'],['assembly','Assembly'],['polishing','Polish'],['ready','Ready']];
  function num(v){return parseFloat(v)||0;}
  function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}

  function trend(cur,prev){
    if(!prev)return '';
    let pct=Math.round((cur-prev)/Math.abs(prev)*100);
    if(!pct)return '';
    return `<span class="hm-trend ${pct>0?'up':'down'}">${pct>0?'▲':'▼'} ${Math.abs(pct)}%</span>`;
  }

  function monthStats(key){
    let mo=orders.filter(o=>String(o.date||'').startsWith(key));
    let received=0;
    orders.forEach(o=>(o.payments||[]).forEach(p=>{if(String(p.date||'').startsWith(key))received+=num(p.amount);}));
    parties.forEach(p=>(p.partyPayments||[]).forEach(pp=>{if(String(pp.date||'').startsWith(key))received+=num(pp.amount);}));
    let kharcha=expenses.filter(e=>String(e.date||'').startsWith(key)).reduce((s,e)=>s+num(e.amount),0);
    let profit=mo.reduce((s,o)=>s+num(o.netProfit),0)-kharcha;
    return {sale:mo.reduce((s,o)=>s+num(o.orderTotal),0),count:mo.length,received,profit};
  }

  function renderKpis(){
    let now=new Date(),cur=monthKey(now),prev=monthKey(new Date(now.getFullYear(),now.getMonth()-1,1));
    let a=monthStats(cur),b=monthStats(prev);
    let udhaar=parties.reduce((s,p)=>s+Math.max(0,getPartyBalance(p)),0);
    let staff=typeof hkIsStaff==='function'&&hkIsStaff();
    let tile=(label,value,extra,cls,onclick)=>`<button class="hm-kpi ${cls||''}" onclick="${onclick}"><div class="hm-kpi-label">${label}</div><div class="hm-kpi-value">${value}</div><div class="hm-kpi-extra">${extra||'&nbsp;'}</div></button>`;
    document.getElementById('hmKpis').innerHTML=
      tile('Is mahine sale',fmtRs(a.sale),`${a.count} orders ${trend(a.sale,b.sale)}`,'','switchTab(\'tabOrders\')')+
      tile('Wasooli',fmtRs(a.received),trend(a.received,b.received),'good','switchTab(\'tabKhata\')')+
      tile('Kul udhaar',fmtRs(udhaar),'parties ki taraf','warn','switchTab(\'tabKhata\')')+
      (staff?tile('Orders',String(orders.length),'kul','', 'switchTab(\'tabOrders\')')
            :tile('Munafa',fmtRs(a.profit),'kharche ke baad '+trend(a.profit,b.profit),a.profit<0?'bad':'','openProfitReport()'));
  }

  function renderAttention(){
    let today=new Date().toISOString().slice(0,10);
    let soon=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    let items=[];
    let due=cheques.filter(c=>c.status==='pending'&&c.dueDate&&c.dueDate<=soon);
    if(due.length){
      let late=due.some(c=>c.dueDate<today);
      items.push({icon:'🧾',tone:late?'bad':'warn',text:`${due.length} cheque ${late?'ki tareekh guzar gayi':'agle 3 din mein'}`,amt:due.reduce((s,c)=>s+num(c.amount),0),go:'openChequeListModal()'});
    }
    let owing=parties.map(p=>({p,b:getPartyBalance(p)})).filter(x=>x.b>0).sort((a,b)=>b.b-a.b);
    if(owing.length)items.push({icon:'📒',tone:'warn',text:`${owing.length} ${owing.length===1?'party':'parties'} ka baqaya — sab se zyada ${owing[0].p.name}`,amt:owing.reduce((s,x)=>s+x.b,0),go:'openReminderCenter()'});
    let ready=orders.filter(o=>o.status==='ready');
    if(ready.length)items.push({icon:'🚚',tone:'info',text:`${ready.length} order tayyar — delivery baqi`,go:"switchTab('tabProduction')"});
    let kDue=labours.reduce((s,l)=>s+Math.max(0,num(l.totalCost)-num(l.paid)),0);
    if(kDue>0)items.push({icon:'🔧',tone:'info',text:'Karigaron ko dena hai',amt:kDue,go:window.openKarigarPay?'openKarigarPay()':"switchTab('tabLabour')"});
    let lowItems=inventory.filter(i=>num(i.minStock)>0&&num(i.qty)<=num(i.minStock));
    // Only woods that were ever stocked; "0 left" on a wood never bought isn't a warning.
    let lowWood=woodTypes.filter(w=>{let r=getWoodStockRemaining(w);let stocked=(w.openingStock||0)>0||getWoodPurchasedCft(w.id)>0;let shortListed=window.hkWoodShort&&hkWoodShort().some(x=>x.w.id===w.id&&x.short>0);return stocked&&r<=10&&!shortListed;});
    if(lowItems.length||lowWood.length){
      let names=[...lowItems.map(i=>i.name),...lowWood.map(w=>w.name)];
      items.push({icon:'📦',tone:'warn',text:`Stock kam: ${names.slice(0,3).join(', ')}${names.length>3?` +${names.length-3}`:''}`,go:lowWood.length&&!lowItems.length?'openWoodStockModal()':"switchTab('tabInventory')"});
    }
    // Other modules add their own items (late deliveries, supplier dues…).
    (window.hkAttentionSources||[]).forEach(fn=>{try{items.push(...fn());}catch(e){console.warn('Attention:',e);}});
    items.sort((a,b)=>({bad:0,warn:1,info:2}[a.tone]??3)-({bad:0,warn:1,info:2}[b.tone]??3));
    document.getElementById('hmAttention').innerHTML=items.length?items.map(it=>`
      <button class="hm-row" onclick="${it.go}">
        <span class="hm-dot ${it.tone}">${it.icon}</span>
        <span class="hm-row-text">${esc(it.text)}</span>
        ${it.amt?`<span class="hm-row-amt">${fmtRs(it.amt)}</span>`:''}
        <span class="hm-chev">›</span>
      </button>`).join(''):'<div class="hm-empty">✅ Sab theek hai — koi kaam baqi nahi</div>';
  }

  function renderPipeline(){
    let active=orders.filter(o=>(o.status||'pending')!=='delivered');
    let counts=STAGES.map(([k])=>active.filter(o=>(o.status||'pending')===k).length);
    let total=counts.reduce((a,b)=>a+b,0);
    document.getElementById('hmPipeline').innerHTML=`
      <div class="hm-pipe">${STAGES.map(([k,l],i)=>`
        <button class="hm-stage ${counts[i]?'on':''}" onclick="document.getElementById('prodStatusFilter').value='${k}';switchTab('tabProduction')">
          <div class="hm-stage-n">${counts[i]}</div><div class="hm-stage-l">${l}</div></button>`).join('')}
      </div>
      <div class="hm-pipe-foot">${total?`${total} order chal rahe hain`:'Koi order production mein nahi'}</div>`;
  }

  function renderHead(){
    let now=new Date(),hr=now.getHours();
    let greet=hr<12?'Subah bakhair':hr<17?'Assalam-o-Alaikum':'Shaam bakhair';
    document.getElementById('hmDate').textContent=now.toLocaleDateString('en-PK',{weekday:'long',day:'numeric',month:'long'});
    document.getElementById('hmTitle').textContent=greet;
    let u=activeUserId!=null?staffUsers.find(x=>x.id===activeUserId):null;
    let name=u?u.name:(businessProfile.ownerName||'Owner');
    document.getElementById('hmUser').innerHTML=`<button class="hm-avatar" onclick="openUserSwitcher()" title="${esc(name)}">${esc(name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase())}</button>`;
  }

  function renderRecent(){
    let recent=orders.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||b.id-a.id).slice(0,5);
    let label={pending:'Pending',cutting:'Cutting',assembly:'Assembly',polishing:'Polish',ready:'Ready',delivered:'Delivered'};
    document.getElementById('recentOrders').innerHTML=recent.length?recent.map(o=>{
      let bal=num(o.orderTotal)-getOrderTotalPaid(o);
      return `<button class="hm-row" onclick="viewOrderDetail(${o.id})">
        <span class="hm-row-text"><b>${esc(o.orderNo||'')}</b> · ${esc(getPartyName(o.partyId))}<br><small>${esc(o.date||'')} · <span class="status-badge ${o.status||'pending'}">${label[o.status||'pending']||o.status}</span></small></span>
        <span class="hm-row-amt">${fmtRs(o.orderTotal)}${bal>0?`<br><small class="hm-due">${fmtRs(bal)} baqi</small>`:'<br><small class="hm-paid">Paid</small>'}</span>
      </button>`;
    }).join(''):'<div class="hm-empty">Abhi koi order nahi — upar "+ Order" dabayein</div>';
  }

  function renderHome(){
    if(!document.getElementById('hmKpis'))return;
    try{renderHead();renderKpis();renderAttention();renderPipeline();renderRecent();}catch(e){console.warn('Home:',e);}
  }
  window.renderHome=renderHome;

  let origRenderDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    origRenderDashboard.apply(this,arguments);
    renderHome();
  };
  // Remember whether "Mazeed reports" is open.
  document.addEventListener('hk:ready',()=>{
    let d=document.getElementById('hmMore');
    try{if(localStorage.getItem('hm_more_open')==='1')d.open=true;}catch(e){}
    d&&d.addEventListener('toggle',()=>{try{localStorage.setItem('hm_more_open',d.open?'1':'0');}catch(e){}});
    renderHome();
  });
})();
