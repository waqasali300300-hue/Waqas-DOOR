// HK Wood Doors ERP — open the app with fingerprint / face (as well as the PIN)
// Uses the phone's or laptop's own screen lock (fingerprint, face, Windows Hello)
// through the browser's WebAuthn API. Nothing about the finger leaves the device;
// the browser only answers "the owner unlocked". Set up per device, in
// Settings → Security, after an Owner PIN exists. The PIN always still works.
(function(){
  const KEY='hk_finger_cred';   // per device, never synced

  function supported(){return !!(window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext);}
  async function platformReady(){
    try{return supported()&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();}catch(e){return false;}
  }
  function enrolledId(){try{return localStorage.getItem(KEY)||'';}catch(e){return '';}}
  function rnd(n){let a=new Uint8Array(n);crypto.getRandomValues(a);return a;}
  function toB64(buf){return btoa(String.fromCharCode(...new Uint8Array(buf)));}
  function fromB64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}

  window.hkFinger={supported,platformReady,enrolledId};

  window.enrolFinger=async function(){
    if(window.hkIsStaff&&hkIsStaff()){showToast('🔒 Sirf Owner');return;}
    if(!businessProfile.ownerPin){showToast('⚠️ Pehle Owner PIN lagayein');return;}
    if(!await platformReady()){showToast('⚠️ Is device par fingerprint/face lock nahi mila (phone ki settings mein screen lock lagayein)');return;}
    try{
      let cred=await navigator.credentials.create({publicKey:{
        challenge:rnd(32),
        rp:{name:'HK Wood Doors'},
        user:{id:rnd(16),name:'owner',displayName:businessProfile.name||'Owner'},
        pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
        authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'discouraged'},
        timeout:60000
      }});
      localStorage.setItem(KEY,toB64(cred.rawId));
      showToast('✅ Fingerprint lag gaya — ab finger se app khulegi');
      if(document.getElementById('settingsModal')?.classList.contains('open'))openSettingsModal();
    }catch(e){
      showToast(e&&e.name==='NotAllowedError'?'Fingerprint cancel ho gaya':'⚠️ Fingerprint nahi laga: '+(e.message||e));
    }
  };
  window.removeFinger=function(){
    try{localStorage.removeItem(KEY);}catch(e){}
    showToast('Fingerprint hata diya — ab sirf PIN');
    if(document.getElementById('settingsModal')?.classList.contains('open'))openSettingsModal();
  };

  // Ask the device to check the finger; true when the owner is confirmed.
  async function verify(){
    let id=enrolledId();if(!id)return false;
    try{
      let r=await navigator.credentials.get({publicKey:{
        challenge:rnd(32),
        allowCredentials:[{type:'public-key',id:fromB64(id),transports:['internal']}],
        userVerification:'required',timeout:60000
      }});
      return !!r;
    }catch(e){return false;}
  }
  window.hkFingerVerify=verify;

  // Lock screen: add a finger button and try once straight away.
  let busy=false;
  async function unlockWithFinger(ov){
    if(busy)return;busy=true;
    let ok=await verify();busy=false;
    if(!ok||!document.body.contains(ov))return;
    let input=ov.querySelector('.hk-pin-input');
    if(input&&businessProfile.ownerPin){input.value=businessProfile.ownerPin;ov.querySelector('[data-act=ok]')?.click();}
  }
  window.hkUnlockWithFinger=()=>{let ov=document.querySelector('.hk-pin-lock');if(ov)unlockWithFinger(ov);};
  new MutationObserver(()=>{
    let ov=document.querySelector('.hk-pin-lock');
    if(!ov||ov.dataset.finger||!enrolledId()||!supported())return;
    ov.dataset.finger='1';
    let box=ov.querySelector('.hk-pin-box');
    if(box){
      box.insertAdjacentHTML('beforeend','<button class="btn btn-gold" style="width:100%;justify-content:center;margin-top:10px;" onclick="hkUnlockWithFinger()">👆 Finger / Face se kholein</button>');
    }
    setTimeout(()=>unlockWithFinger(ov),400);
  }).observe(document.documentElement,{childList:true,subtree:true});

  // Settings → Security: set up or remove.
  let origOpenSettings=window.openSettingsModal;
  window.openSettingsModal=function(){
    origOpenSettings.apply(this,arguments);
    let info=document.getElementById('hkStorageInfo');
    if(!info||document.getElementById('hkFingerRow'))return;
    let on=!!enrolledId();
    info.insertAdjacentHTML('beforebegin',`<div id="hkFingerRow" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
      ${on?'<span style="font-size:10px;">👆 Is device par fingerprint laga hai</span><button class="btn btn-outline btn-xs" onclick="removeFinger()">Hatayein</button>'
          :`<button class="btn btn-primary btn-sm" onclick="enrolFinger()">👆 Fingerprint / Face lock lagayein</button>${businessProfile.ownerPin?'':'<span style="font-size:9px;color:var(--gray-500);">(pehle Owner PIN)</span>'}`}
    </div>`);
  };
})();
