// HK Wood Doors ERP — on-device storage
// Data lives in IndexedDB, which holds hundreds of MB (localStorage only holds ~5MB,
// so photos used to fill it and saving would stop). Old localStorage data is
// migrated on first run. If IndexedDB is unavailable, localStorage is still used.
(function(){
  const DB_NAME='hk_erp', STORE='kv';
  let dbPromise=null;

  function openDB(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('no indexedDB'));return;}
      let req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{req.result.createObjectStore(STORE);};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
      req.onblocked=()=>reject(new Error('indexedDB blocked'));
    });
    dbPromise.catch(()=>{dbPromise=null;});
    return dbPromise;
  }

  function run(mode,fn){
    return openDB().then(db=>new Promise((resolve,reject)=>{
      let tx=db.transaction(STORE,mode);
      let out=fn(tx.objectStore(STORE));
      tx.oncomplete=()=>resolve(out&&'result' in out?out.result:undefined);
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error||new Error('aborted'));
    }));
  }

  const HKStore={
    ok:false,
    get(key){return run('readonly',s=>s.get(key));},
    set(key,val){return run('readwrite',s=>s.put(val,key));},
    del(key){return run('readwrite',s=>s.delete(key));},
    keys(){return run('readonly',s=>s.getAllKeys());},
    // Loads the main data string. Returns null when there is no saved data.
    async boot(){
      try{
        let raw=await HKStore.get('ww_data');
        HKStore.ok=true;
        if(raw==null){
          // First run on IndexedDB: copy existing localStorage data across.
          let old=null;try{old=localStorage.getItem('ww_data');}catch(e){}
          if(old){await HKStore.set('ww_data',old);raw=old;}
        }
        // Ask the browser not to clear our data when the phone is low on space.
        try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist();}catch(e){}
        return raw;
      }catch(e){
        HKStore.ok=false;
        try{return localStorage.getItem('ww_data');}catch(e2){return null;}
      }
    },
    async usage(){
      try{
        if(navigator.storage&&navigator.storage.estimate){
          let e=await navigator.storage.estimate();
          return {used:e.usage||0,quota:e.quota||0};
        }
      }catch(e){}
      return null;
    }
  };
  window.HKStore=HKStore;
})();
