// HK Wood Doors ERP — laptop helpers: keyboard shortcuts.
//   Ctrl/⌘ + K  → search        Alt + N → new order
//   Alt + P     → payment       Alt + E → kharcha
//   Esc         → close the top window (or the menu on phone)
(function(){
  function typing(e){let t=e.target;return t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);}
  document.addEventListener('keydown',e=>{
    if(document.querySelector('.hk-pin-overlay'))return; // PIN screen open
    let k=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey)&&k==='k'){e.preventDefault();openSearchModal();return;}
    if(e.altKey&&!typing(e)){
      let map={n:()=>openOrderModal(),p:()=>quickAddPayment(),e:()=>openExpenseModal()};
      if(map[k]){e.preventDefault();map[k]();}
      return;
    }
    if(k==='escape'){
      let open=[...document.querySelectorAll('.modal.open')];
      if(open.length){closeModal(open[open.length-1].id);return;}
      if(document.getElementById('drawerNav')?.classList.contains('open'))closeDrawer();
    }
  });
  document.addEventListener('hk:ready',()=>{
    // Show the shortcut next to the header buttons on laptops.
    let order=document.querySelector('.hdr-btn.gold');
    if(order&&!order.querySelector('.hk-kbd'))order.insertAdjacentHTML('beforeend','<span class="hk-kbd" style="color:#fff;border-color:rgba(255,255,255,.4);">Alt+N</span>');
  });
})();
