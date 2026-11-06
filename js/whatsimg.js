// HK Wood Doors ERP — send bills on WhatsApp as a picture
// A wa.me link can only carry text, so the bill is drawn as an image and handed to
// the phone's share sheet (WhatsApp is picked there) with a short caption.
// Used for: the order bill/invoice, payment receipt, monthly statement, payment
// reminder (khata picture) and the instant price quote. Where the browser can't
// share files (most laptops), the picture is saved and WhatsApp opens with the text.
(function(){
  function num(v){return parseFloat(v)||0;}
  function waPhone(p){p=String(p||'').replace(/[^0-9]/g,'');if(p.startsWith('0'))p='92'+p.slice(1);return p;}
  function loading(on){document.getElementById('pdfLoading')?.classList.toggle('open',!!on);}
  function safeName(s){return String(s||'bill').replace(/[^\w\-]+/g,'_').slice(0,60);}

  async function toPng(html,width,after){
    let box=document.createElement('div');
    box.innerHTML=html;
    box.style.cssText=`position:fixed;left:0;top:0;width:${width||600}px;background:#fff;z-index:150;pointer-events:none;`;
    document.body.appendChild(box);
    try{
      if(after){try{after();}catch(e){}await new Promise(r=>setTimeout(r,200));}
      await Promise.all([...box.querySelectorAll('img')].map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r;})));
      let el=box.firstElementChild||box;
      let canvas=await html2canvas(el,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false});
      return await new Promise(r=>canvas.toBlob(r,'image/png'));
    }finally{box.remove();}
  }
  function blobToB64(blob){return new Promise((res,rej)=>{let r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(blob);});}

  // Draw `html` and share it; `caption` goes with the picture.
  window.hkShareImage=async function(html,filename,phone,caption,width,after){
    if(typeof html2canvas==='undefined'){showToast('⚠️ Tasveer nahi ban saki');return false;}
    loading(true);
    let blob;
    try{blob=await toPng(html,width,after);}catch(e){loading(false);showToast('⚠️ Tasveer nahi ban saki: '+(e.message||e));return false;}
    loading(false);
    filename=safeName(filename)+'.png';
    window._hkLastShareImage={blob,filename,caption};
    try{
      let P=window.hkNative&&window.Capacitor&&Capacitor.Plugins;
      if(P&&P.Filesystem&&P.Share){
        let f=await P.Filesystem.writeFile({path:filename,data:await blobToB64(blob),directory:'CACHE'});
        await P.Share.share({title:filename,text:caption||'',files:[f.uri],dialogTitle:'WhatsApp par bhejein'});
        return 'shared';
      }
      let file=new File([blob],filename,{type:'image/png'});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file],text:caption||''});
        return 'shared';
      }
    }catch(e){if(e&&e.name==='AbortError')return 'cancelled';}
    // No file sharing here: save the picture, then open WhatsApp with the text.
    let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    showToast('📷 Tasveer save ho gayi — WhatsApp mein 📎 se laga dein');
    window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(caption||'')}`,'_blank');
    return 'saved';
  };

  // A neat card: shop header with logo, a title, rows and a highlighted total.
  function card(title,rows,total,note){
    let bp=businessProfile||{};
    return `<div style="font-family:'Segoe UI',Inter,sans-serif;width:600px;background:#fff;color:#1a2a3a;">
      <div style="background:linear-gradient(135deg,#1c4482,#0f2347);color:#fff;padding:18px 22px;display:flex;align-items:center;gap:14px;border-bottom:4px solid #c8963e;">
        <img src="logo.png" style="width:56px;height:56px;border-radius:14px;">
        <div><div style="font-size:21px;font-weight:800;">${esc(bp.name||'HK WOOD DOORS')}</div>
          <div style="font-size:12px;opacity:.8;">${esc([bp.phone,[bp.address,bp.city].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}</div></div></div>
      <div style="padding:18px 22px 20px;">
        <div style="font-size:17px;font-weight:800;color:#1a3a6a;margin-bottom:10px;">${title}</div>
        ${rows.map(([k,v,strong])=>`<div style="display:flex;justify-content:space-between;gap:12px;font-size:14px;padding:8px 0;border-bottom:1px solid #eef1f6;">
          <span style="color:#56657a;">${k}</span><span style="text-align:right;${strong?'font-weight:800;':''}">${v}</span></div>`).join('')}
        ${total?`<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:12px 14px;border-radius:12px;background:#fff6e3;color:#5c3d0e;">
          <span style="font-size:14px;font-weight:700;">${total[0]}</span><span style="font-size:22px;font-weight:800;">${total[1]}</span></div>`:''}
        ${note?`<div style="font-size:11.5px;color:#8a96a8;margin-top:12px;text-align:center;">${note}</div>`:''}
        <div style="font-size:11px;color:#b0b9c6;margin-top:10px;text-align:center;">${new Date().toLocaleDateString('en-PK',{day:'numeric',month:'long',year:'numeric'})}</div>
      </div></div>`;
  }
  window.hkBillCard=card;

  // ── Order bill: the full invoice as a picture ──
  window.sendOrderSummary=function(id){
    let o=orders.find(x=>x.id===id);if(!o)return;
    let p=getPartyById(o.partyId)||{};
    let paid=getOrderTotalPaid(o);
    let caption=`Assalam-o-Alaikum ${p.name||''}, ${businessProfile.name||''} — order ${o.orderNo} ka bill. Kul ${fmtRs(o.orderTotal)}, baqi ${fmtRs(Math.max(0,num(o.orderTotal)-paid))}. Shukriya!`;
    return hkShareImage(buildInvoiceHTML(o,p,'hkInvImg'),'Bill_'+(o.orderNo||id),p.phone,caption,800,()=>{if(typeof renderInvoiceQR==='function')renderInvoiceQR('hkInvImg',o);});
  };
  // Bill screen: share as picture too.
  let origInvoice=window.generateInvoice;
  window.generateInvoice=function(id){
    let r=origInvoice.apply(this,arguments);
    let c=document.getElementById('billContent');
    if(c&&!c.querySelector('.hk-bill-img'))c.insertAdjacentHTML('afterbegin',`<button class="btn btn-success btn-sm hk-bill-img" style="width:100%;justify-content:center;margin-bottom:8px;" onclick="sendOrderSummary(${id})">📷 WhatsApp par bill ki tasveer bhejein</button>`);
    return r;
  };

  // ── Payment receipt (offered after every payment) ──
  let origWA=window.openWA;
  window.openWA=function(phone,msg){
    let rc=window._hkReceipt;
    if(rc&&msg===rc.msg){
      let lines=String(msg).split('\n');
      let m=/payment\s+(Rs\.?[\d,]+)/i.exec(msg),b=/Baqaya:\s*(Rs\.?[\d,]+)/i.exec(msg),o=/\((ORD[^)]*)\)/.exec(msg);
      let name=(/Alaikum\s+([^,\n]+)/.exec(msg)||[])[1]||'';
      let html=card('✅ Payment ki Rasid',[['Party',esc(name),true],o?['Order',esc(o[1])]:null,['Tareekh',new Date().toLocaleDateString('en-PK')],['Wasool hui',esc(m?m[1]:''),true]].filter(Boolean),
        ['Baqi raqam',esc(b?b[1]:'')],'Aap ki payment ka shukriya 🙏');
      return hkShareImage(html,'Rasid_'+name,phone,lines[0]+' — '+(lines[1]||''));
    }
    return origWA?origWA.apply(this,arguments):window.open(`https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(msg)}`,'_blank');
  };

  // ── Payment reminders: the khata as a picture ──
  function khataPicture(p){
    let bal=getPartyBalance(p);
    let rows=buildPartyLedgerEntries(p).slice(-8).map(e=>[`${esc(e.date)} · ${esc(e.type)}${e.ref?' '+esc(e.ref):''}`,e.debit?`<span style="color:#b91c1c;">+${fmtRs(e.debit)}</span>`:`<span style="color:#15803d;">−${fmtRs(e.credit)}</span>`]);
    let html=card('🔔 Yaad dahani — '+esc(p.name),rows.length?rows:[['Koi len-den nahi','']],['Kul baqaya',fmtRs(bal)],'Meharbani kar ke baqaya jald ada kar dein. Shukriya!');
    return hkShareImage(html,'Yaad_Dahani_'+p.name,p.phone,`Assalam-o-Alaikum ${p.name}, ${businessProfile.name||''} se yaad dahani — aap ki taraf ${fmtRs(bal)} baqi hai. Meharbani kar ke jald ada kar dein. Shukriya!`);
  }
  window.sendWhatsAppReminder=function(pid){
    let p=getPartyById(pid);
    if(!p){showToast('⚠️ Party nahi mili');return;}
    return khataPicture(p);
  };
  // "Sab ko yaad dahani" list: each party gets its khata picture.
  if(window.sendReminder){
    window.sendReminder=async function(id){
      let p=getPartyById(id);if(!p||!p.phone)return;
      await khataPicture(p);
      p.lastReminder=new Date().toISOString().slice(0,10);saveAll();
      if(window.openBulkReminders)setTimeout(openBulkReminders,300);
    };
    window.sendNextReminder=function(){
      let t=new Date().toISOString().slice(0,10);
      let next=parties.map(p=>({p,b:getPartyBalance(p)})).filter(x=>x.b>0&&x.p.phone&&x.p.lastReminder!==t).sort((a,b)=>b.b-a.b)[0];
      if(!next){showToast('✅ Aaj sab ko bhej diya');return;}
      return sendReminder(next.p.id);
    };
  }
  // Personal loan reminder.
  if(window.loanReminder){
    window.loanReminder=function(id){
      let l=(typeof personalLoans!=='undefined'?personalLoans:[]).find(x=>x.id===id);if(!l)return;
      let bal=window.hkLoanBal?hkLoanBal(l):0;
      let rows=(l.entries||[]).slice(-8).map(e=>[`${esc(e.date)} · ${e.dir==='diya'?'Diye':'Wapas mile'}${e.note?' · '+esc(e.note):''}`,`${e.dir==='diya'?'+':'−'}${fmtRs(e.amount)}`]);
      let html=card('🔔 Yaad dahani — '+esc(l.name),rows.length?rows:[['—','']],['Baqi',fmtRs(bal)],'Jab suhoolat ho wapas kar dein. Shukriya!');
      return hkShareImage(html,'Yaad_Dahani_'+l.name,l.phone,`Assalam-o-Alaikum ${l.name}, yaad dahani: aap ki taraf ${fmtRs(bal)} baqi hain. Jab suhoolat ho wapas kar dein. Shukriya!`);
    };
  }

  // ── Monthly statement ──
  let origStmt=window.sendStatementWhatsApp;
  if(origStmt)window.sendStatementWhatsApp=function(pid){
    let p=getPartyById(pid);if(!p)return;
    let cap=null,realOpen=window.open;
    window.open=u=>{cap=decodeURIComponent(String(u).split('text=')[1]||'');return null;};
    try{origStmt.apply(this,arguments);}finally{window.open=realOpen;}
    if(!cap)return;
    let lines=cap.split('\n').filter(l=>l.includes(':')).map(l=>l.replace(/\*/g,''));
    let kv=lines.map(l=>{let i=l.indexOf(':');return [esc(l.slice(0,i).trim()),esc(l.slice(i+1).trim())];});
    let head=(cap.split('\n')[1]||'').replace(/\*/g,'');
    let total=kv.find(x=>/Kul baqaya/i.test(x[0]));
    let html=card('📅 '+esc(head),kv.filter(x=>x!==total),total,'Shukriya!');
    return hkShareImage(html,'Statement_'+p.name,p.phone,cap.split('\n').slice(0,2).join(' '));
  };

  // ── Instant price quote ──
  if(window.hkQpSend){
    window.hkQpSend=function(){
      let lines=(window.hkQuickLines&&hkQuickLines())||[];
      let txt=window.hkQuoteText?hkQuoteText():'';
      let rows=txt.split('\n').filter(l=>l.startsWith('•')).map(l=>{let i=l.lastIndexOf('=');return [esc(l.slice(1,i).trim()),esc(l.slice(i+1).trim()),true];});
      let tot=(/Kul:\s*(Rs\.?[\d,]+)/.exec(txt)||[])[1]||'';
      let name=(document.getElementById('hkQpName')?.value||'').trim();
      let html=card('🧮 Qeemat'+(name?' — '+esc(name):''),rows,['Kul qeemat',esc(tot)],'Yeh andaza hai; aakhri qeemat order par tay hogi.');
      return hkShareImage(html,'Qeemat_'+(name||'gahak'),document.getElementById('hkQpPhone')?.value||'',txt.split('\n').slice(0,2).join(' ')+' — Kul '+tot);
    };
  }
})();
