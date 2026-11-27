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
