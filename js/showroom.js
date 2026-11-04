// HK Wood Doors ERP — design album (showroom) and instant price in front of the customer.
//   • Design Album: the Rate List designs full screen with their photos, one by one
//     (swipe or arrows). Rates can be hidden. "Qeemat nikalein" opens the price tool.
//   • Fauri Qeemat: pick a design, a size and a count; the price shows at once.
//     Several lines can be added; send it on WhatsApp or turn it into an estimate.
(function(){
  const HIDE='hk_album_hide_rate';
  function num(v){return parseFloat(v)||0;}
  function designs(){return priceList.filter(p=>p&&String(p.size||'').trim());}
  function hideRate(){try{return localStorage.getItem(HIDE)==='1';}catch(e){return false;}}
  function sqft(w,h){return num(w)*num(h)/144;}
  function parseSize(s){let m=/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/.exec(String(s||''));return m?{w:num(m[1]),h:num(m[2])}:null;}
  function waPhone(p){p=String(p||'').replace(/[^0-9]/g,'');if(p.startsWith('0'))p='92'+p.slice(1);return p;}

  // ════════ Design album ════════
  let idx=0;
  function albumHTML(){
    let list=designs();
    if(!list.length)return `<div class="hk-album-empty">Rate List mein abhi koi design nahi.<br><button onclick="closeAlbum();openPriceListModal()">📃 Rate List kholein</button></div>`;
    idx=(idx+list.length)%list.length;
    let p=list[idx];
    return `<div class="hk-album-top"><b>${esc(businessProfile.name||'')}</b><span>${idx+1} / ${list.length}</span>
        <button onclick="hkAlbumToggleRate()">${hideRate()?'👁 Rate dikhayein':'🙈 Rate chhupayein'}</button><button onclick="closeAlbum()">✕</button></div>
      <div class="hk-album-stage" id="hkAlbumStage">
        <button class="hk-album-nav" onclick="hkAlbumGo(-1)">‹</button>
        ${p.photo?`<img src="${p.photo}" alt="">`:'<div class="hk-album-nophoto">🚪<small>Tasveer nahi — Rate List mein 📷 se lagayein</small></div>'}
        <button class="hk-album-nav r" onclick="hkAlbumGo(1)">›</button>
      </div>
      <div class="hk-album-info"><div class="hk-album-name">${esc(p.size)}</div>
        ${hideRate()?'':`<div class="hk-album-rate">${fmtRs(p.rate)} <small>/ sq.ft</small></div>`}
        <button class="hk-album-price" onclick="hkAlbumPrice()">🧮 Is design ki qeemat nikalein</button></div>
      <div class="hk-album-strip">${list.map((d,i)=>`<button class="${i===idx?'on':''}" onclick="hkAlbumGo(${i-idx})">${d.photo?`<img src="${d.photo}" alt="">`:'🚪'}</button>`).join('')}</div>`;
  }
  function render(){let a=document.getElementById('hkAlbum');if(a)a.innerHTML=albumHTML();}
  window.openAlbum=function(start){
    if(typeof start==='number')idx=start;
    let a=document.getElementById('hkAlbum');
    if(!a){
      a=document.createElement('div');a.id='hkAlbum';a.className='hk-album';document.body.appendChild(a);
      // Swipe left/right to change design.
      let x0=null;
      a.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;},{passive:true});
      a.addEventListener('touchend',e=>{if(x0===null)return;let dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50)hkAlbumGo(dx<0?1:-1);});
    }
    render();
  };
  window.hkAlbumPrice=function(){let p=designs()[idx];closeAlbum();openQuickPrice(p?String(p.size):'');};
  window.closeAlbum=function(){document.getElementById('hkAlbum')?.remove();};
  window.hkAlbumGo=function(d){idx+=d;render();};
  window.hkAlbumToggleRate=function(){try{localStorage.setItem(HIDE,hideRate()?'0':'1');}catch(e){}render();};
  document.addEventListener('keydown',e=>{
    if(!document.getElementById('hkAlbum'))return;
    if(e.key==='ArrowRight')hkAlbumGo(1);else if(e.key==='ArrowLeft')hkAlbumGo(-1);else if(e.key==='Escape')closeAlbum();
  });

  // ════════ Instant price ════════
  let lines=[];
  function lineCalc(l){
    let s=parseSize(l.size),rate=num(l.rate),q=Math.max(1,parseInt(l.qty)||1);
    let ft=s?sqft(s.w,s.h)*q:0;
    return {sqft:Math.round(ft*100)/100,amount:Math.round(ft*rate)};
  }
  function total(){return lines.reduce((s,l)=>s+lineCalc(l).amount,0);}
  function rateOf(name){let p=designs().find(d=>String(d.size)===String(name));return p?num(p.rate):0;}
  window.openQuickPrice=function(design){
    if(design!==undefined){let d=designs()[0];lines=[{design:String(design||(d&&d.size)||''),size:'45x80',qty:1,rate:rateOf(design||(d&&d.size))}];}
    if(!lines.length){let d=designs()[0];lines=[{design:d?String(d.size):'',size:'45x80',qty:1,rate:d?num(d.rate):440}];}
    renderQuick();
    if(!document.getElementById('hkQuickModal').classList.contains('open'))openModal('hkQuickModal');
  };
  function renderQuick(){
    let m=document.getElementById('hkQuickModal');
    if(!m){
      m=document.createElement('div');m.className='modal';m.id='hkQuickModal';
      m.innerHTML=`<div class="modal-box" style="max-width:520px;"><div class="modal-head">🧮 Fauri Qeemat <button class="modal-close" onclick="closeModal('hkQuickModal')">✕</button></div><div class="modal-body" id="hkQuickBody"></div></div>`;
      document.body.appendChild(m);
    }
    let opts=sel=>designs().map(d=>`<option ${String(d.size)===String(sel)?'selected':''}>${esc(d.size)}</option>`).join('')+`<option value="" ${sel?'':'selected'}>— Design ke baghair —</option>`;
    document.getElementById('hkQuickBody').innerHTML=`
      ${lines.map((l,i)=>{let c=lineCalc(l);return `<div class="hk-qp-line">
        <div style="display:flex;gap:6px;">
          <select class="form-select" style="flex:2;" onchange="hkQpSet(${i},'design',this.value)">${opts(l.design)}</select>
          ${lines.length>1?`<button class="btn btn-outline btn-xs" onclick="hkQpDel(${i})">✕</button>`:''}</div>
        <div style="display:flex;gap:6px;margin-top:6px;">
          <input class="form-input" style="flex:1.3;" list="hkQpSizes" value="${esc(l.size)}" placeholder="45x80" onchange="hkQpSet(${i},'size',this.value)">
          <input class="form-input" style="flex:.8;" type="number" min="1" value="${l.qty}" onchange="hkQpSet(${i},'qty',this.value)" title="Tadaad">
          <input class="form-input" style="flex:1;" type="number" value="${l.rate}" onchange="hkQpSet(${i},'rate',this.value)" title="Rate / sq.ft">
        </div>
        <div class="hk-qp-res">${c.sqft?`${c.sqft} sq.ft × ${fmtRs(l.rate)} = <b>${fmtRs(c.amount)}</b>`:'<span style="color:#b45309;">Naap likhein, jaise 45x80</span>'}</div></div>`;}).join('')}
      <datalist id="hkQpSizes">${QUICK_SIZES.map(s=>`<option value="${esc(s)}">`).join('')}</datalist>
      <button class="btn btn-outline btn-sm" style="width:100%;justify-content:center;" onclick="hkQpAdd()">+ Aur darwaza</button>
      <div class="hk-qp-total">Kul qeemat <b>${fmtRs(total())}</b></div>
      <input class="form-input" id="hkQpName" placeholder="Gahak ka naam (zaroori nahi)" style="margin-bottom:6px;">
      <input class="form-input" id="hkQpPhone" type="tel" placeholder="Gahak ka WhatsApp number (zaroori nahi)">
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btn-success" style="flex:1;" onclick="hkQpSend()">💬 WhatsApp bhejein</button>
        <button class="btn btn-primary" style="flex:1;" onclick="hkQpEstimate()">📝 Estimate banayein</button></div>
      <button class="btn btn-outline btn-sm" style="width:100%;justify-content:center;margin-top:6px;" onclick="closeModal('hkQuickModal');openAlbum()">🖼️ Design Album dekhein</button>`;
  }
  window.hkQpSet=function(i,k,v){
    let l=lines[i];if(!l)return;
    if(k==='design'){l.design=v;let r=rateOf(v);if(r)l.rate=r;}
    else if(k==='size'){l.size=String(v).trim();if(/jori/i.test(l.size)&&l.qty===1)l.qty=2;}
    else if(k==='qty')l.qty=Math.max(1,parseInt(v)||1);
    else if(k==='rate')l.rate=num(v);
    renderQuick();
  };
  window.hkQpAdd=function(){let last=lines[lines.length-1]||{};lines.push({design:last.design||'',size:last.size||'45x80',qty:1,rate:last.rate||440});renderQuick();};
  window.hkQpDel=function(i){lines.splice(i,1);renderQuick();};
  function quoteText(){
    let name=(document.getElementById('hkQpName')?.value||'').trim();
    return `Assalam-o-Alaikum${name?' '+name:''},\n*${businessProfile.name||''} — Qeemat*\n`+
      lines.map(l=>{let c=lineCalc(l);return `• ${l.size}${l.design?' '+l.design:''} × ${l.qty} = ${fmtRs(c.amount)}`;}).join('\n')+
      `\n*Kul: ${fmtRs(total())}*\nYeh andaza hai; aakhri qeemat order par tay hogi.${businessProfile.phone?'\n📞 '+businessProfile.phone:''}`;
  }
  window.hkQuoteText=quoteText;
  window.hkQpSend=function(){
    let ph=document.getElementById('hkQpPhone')?.value||'';
    window.open(`https://wa.me/${waPhone(ph)}?text=${encodeURIComponent(quoteText())}`,'_blank');
  };
  window.hkQpEstimate=function(){
    let ok=lines.filter(l=>parseSize(l.size));
    if(!ok.length){showToast('⚠️ Kam az kam ek darwaze ka naap likhein');return;}
    if(typeof hkMakeEstimateFromRequest!=='function'){showToast('⚠️ Estimate nahi ban saka');return;}
    let q=hkMakeEstimateFromRequest({name:(document.getElementById('hkQpName')?.value||'').trim(),phone:(document.getElementById('hkQpPhone')?.value||'').trim(),
      items:ok.map(l=>({size:(l.size+(l.design?' '+l.design:'')).trim(),qty:Math.max(1,parseInt(l.qty)||1),rate:num(l.rate)}))});
    q.note='Fauri qeemat se';saveAll();
    closeModal('hkQuickModal');lines=[];
    showToast('✅ '+q.quoteNo+' ban gaya');
    if(typeof openQuotationModal==='function')openQuotationModal(q.id);
  };
  window.hkQuickLines=()=>lines;

  function addMenu(id,icon,label,fn,afterSel){
    if(document.getElementById(id))return;
    let anchor=document.querySelector(afterSel);if(!anchor)return;
    anchor.insertAdjacentHTML('afterend',`<button class="drawer-item" id="${id}" onclick="${fn};closeDrawer();"><span class="t-icon">${icon}</span>${label}</button>`);
  }
  document.addEventListener('hk:ready',()=>{
    addMenu('hkQuickBtn','🧮','Fauri Qeemat','openQuickPrice()','.drawer-item[onclick*="openQuotationList"]');
    addMenu('hkAlbumBtn','🖼️','Design Album','openAlbum()','.drawer-item[onclick*="openQuotationList"]');
  });
})();
