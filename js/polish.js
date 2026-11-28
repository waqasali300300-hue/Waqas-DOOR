// HK Wood Doors ERP — small fixes that make every screen read right
//   • Big amounts (lakh / crore) stay on one line: the number shrinks to fit
//     its box instead of breaking in the middle.
//   • The Parties list shows each party's balance and opens its khata.
(function(){
  const FIT='.stat-card .num,.hk-k3-tile b,.hk-hpos-g b,.hk-pos-v,.hk-k3-status b';
  function fit(){
    document.querySelectorAll(FIT).forEach(el=>{
      if(!el.offsetParent)return;
      el.style.fontSize='';
      let size=parseFloat(getComputedStyle(el).fontSize),min=9;
      el.style.whiteSpace='nowrap';
      while(el.scrollWidth>el.clientWidth+1&&size>min){size-=0.5;el.style.fontSize=size+'px';}
    });
  }
  window.hkFitNumbers=fit;
  let t=null;
  function soon(){clearTimeout(t);t=setTimeout(fit,30);}
  ['renderAll','switchTab','renderKhata','renderBankBook','renderLabourList','renderReports','renderHome'].forEach(n=>{
    let o=window[n];if(typeof o!=='function')return;
    window[n]=function(){let r=o.apply(this,arguments);soon();return r;};
  });
  window.addEventListener('resize',soon);
  document.addEventListener('hk:ready',soon);

  // Parties list: balance + khata on each card.
  let origParties=window.renderParties;
  window.renderParties=function(){
    let r=origParties.apply(this,arguments);
    try{
      let q=document.getElementById('partySearch')?.value?.toLowerCase()||'';
      let shown=parties.filter(p=>p.name.toLowerCase().includes(q)||(p.phone||'').includes(q));
      document.querySelectorAll('#partiesList .khata-card').forEach((card,i)=>{
        let p=shown[i];if(!p)return;
        let b=getPartyBalance(p);
        card.insertAdjacentHTML('beforeend',`<div class="hk-pl-line ${b>=1?'lene':b<=-1?'dene':'saaf'}">
          <span>${b>=1?'📥 Lene hain '+fmtRs(b):b<=-1?'📤 Dene hain '+fmtRs(-b):'✅ Hisaab saaf'}</span>
          <button class="btn btn-outline btn-xs" onclick="openPartyLedger(${p.id})">📖 Khata</button></div>`);
      });
    }catch(e){console.warn('parties',e);}
    return r;
  };
})();

// ── Phone: khata tables become simple rows (nothing cut off on the right) ──
(function(){
  function cards(table){
    if(!table||table.dataset.hkCards||window.innerWidth>=600)return;
    let heads=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim().toLowerCase());
    let col=(...names)=>heads.findIndex(h=>names.some(n=>h.startsWith(n)));
    let iDate=col('date'),iType=col('type','detail'),iRef=col('ref'),iPlus=col('bill','debit','liya'),iMinus=col('aaye','credit','diya'),iBal=col('baqi','balance','baqaya');
    if(iDate<0||iBal<0)return;
    let rows=[...table.querySelectorAll('tbody tr')].filter(tr=>tr.cells.length>=heads.filter(Boolean).length-1);
    if(!rows.length)return;
    let cell=(tr,i)=>i>=0&&tr.cells[i]?tr.cells[i].textContent.trim():'';
    let list=document.createElement('div');list.className='hk-lrows';
    list.innerHTML=rows.map(tr=>{
      let plus=cell(tr,iPlus),minus=cell(tr,iMinus),extra=tr.cells[tr.cells.length-1].querySelector('button');
      return `<div class="hk-lrow"><div class="hk-lrow-l"><b>${esc(cell(tr,iType))}</b><small>${esc(cell(tr,iDate))}${cell(tr,iRef)?' · '+esc(cell(tr,iRef)):''}</small></div>
        <div class="hk-lrow-r">${plus?`<span class="p">+ ${esc(plus)}</span>`:''}${minus?`<span class="m">− ${esc(minus)}</span>`:''}<small>Baqi ${esc(cell(tr,iBal))}</small></div>
        ${extra?`<div class="hk-lrow-x">${extra.outerHTML}</div>`:''}</div>`;
    }).join('');
    let wrap=table.closest('div[style*="overflow-x"]')||table;
    wrap.style.display='none';table.dataset.hkCards='1';
    wrap.insertAdjacentElement('afterend',list);
  }
  [['openPartyLedger','partyLedgerModalBody'],['openSupplierLedger','hkSupLedgerModalBody']].forEach(([fn,body])=>{
    let o=window[fn];if(!o)return;
    window[fn]=function(){let r=o.apply(this,arguments);try{cards(document.querySelector('#'+body+' table'));}catch(e){console.warn('rows',e);}return r;};
  });

  // ── Payment form: starts empty (no accidental full amount), quick amounts, words, what stays due ──
  let origPay=window.openReceivePaymentModal;
  window.openReceivePaymentModal=function(pid){
    let r=origPay.apply(this,arguments);
    try{
      let p=getPartyById(pid),inp=document.getElementById('payAmount');if(!p||!inp)return r;
      let bal=getPartyBalance(p);
      inp.value='';inp.placeholder='Kitni raqam aayi?';inp.setAttribute('inputmode','numeric');inp.classList.add('hk-pe-amt');
      let chips=[[1e4,'+10 hazar'],[1e5,'+1 lakh'],[1e6,'+10 lakh']].map(([v,l])=>`<button type="button" onclick="let i=document.getElementById('payAmount');i.value=(parseFloat(i.value)||0)+${v};i.dispatchEvent(new Event('input'))">${l}</button>`).join('');
      if(bal>=1)chips=`<button type="button" onclick="let i=document.getElementById('payAmount');i.value=${Math.round(bal)};i.dispatchEvent(new Event('input'))">Poori baqi ${fmtRs(bal)}</button>`+chips;
      inp.insertAdjacentHTML('afterend',`<div class="hk-pe-chips">${chips}</div><div id="hkPayAfter" class="hk-pe-after"></div>`);
      let show=()=>{let a=parseFloat(inp.value)||0,left=bal-a,el=document.getElementById('hkPayAfter');if(!el)return;
        el.innerHTML=a>0?`${window.hkRsWords?hkRsWords(a)+' · ':''}Is ke baad: <b>${left>=1?'baqi '+fmtRs(left):left<=-1?'advance '+fmtRs(-left):'hisaab saaf ✅'}</b>`:'';};
      inp.addEventListener('input',show);
    }catch(e){console.warn('pay form',e);}
    return r;
  };
})();
