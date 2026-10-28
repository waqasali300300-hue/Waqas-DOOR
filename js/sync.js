// HK Wood Doors ERP — safe merge for cloud sync
// Before, every sync overwrote the whole cloud copy, so when two phones made
// entries around the same time one phone's entries were lost.
// Now each record (order, party, payment entry, ...) is merged on its own using
// a 3-way merge: "base" is the copy both sides last agreed on, so we can tell
// which side added, changed or deleted each record.
(function(root){
  // Counters only ever go up, so the bigger value always wins.
  const COUNTERS=['nextId','orderCounter','purchaseCounter','labourCounter','receiptCounter','challanCounter','quoteCounter'];

  // JSON with sorted keys, so the same data always gives the same text
  // (the cloud does not keep key order).
  function stable(v){
    if(v===undefined)return 'undefined';
    if(v===null||typeof v!=='object')return JSON.stringify(v);
    if(Array.isArray(v))return '['+v.map(x=>x===undefined?'null':stable(x)).join(',')+']';
    return '{'+Object.keys(v).filter(k=>v[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
  }
  function same(a,b){return stable(a)===stable(b);}

  function isRecordList(a){
    if(!Array.isArray(a))return false;
    let seen=new Set();
    for(const x of a){
      if(!x||typeof x!=='object'||x.id===undefined||x.id===null)return false;
      if(seen.has(x.id))return false;
      seen.add(x.id);
    }
    return true;
  }

  // preferRemote: used on a phone's first sync (no base yet), to behave like the
  // old "load from cloud" while still keeping records that only exist locally.
  function mergeRecords(b,l,r,preferRemote){
    let bm=new Map((b||[]).map(x=>[x.id,x]));
    let rm=new Map(r.map(x=>[x.id,x]));
    let lIds=new Set(l.map(x=>x.id));
    let out=[];
    for(const lx of l){
      let bx=bm.get(lx.id),rx=rm.get(lx.id);
      if(rx===undefined){
        // Not in the cloud: either new on this phone, or deleted on another phone.
        if(bx===undefined||!same(lx,bx))out.push(lx); // new here, or edited here after the delete
        continue;
      }
      if(bx===undefined){out.push(preferRemote?rx:lx);continue;}
      let localChanged=!same(lx,bx);
      out.push(localChanged?lx:rx);
    }
    for(const rx of r){
      if(lIds.has(rx.id))continue;
      let bx=bm.get(rx.id);
      // Not on this phone: either new from another phone, or deleted here.
      if(bx===undefined||!same(rx,bx))out.push(rx); // new there, or edited there after the delete
    }
    return out;
  }

  function mergeValue(key,b,l,r,preferRemote){
    if(COUNTERS.includes(key))return Math.max(Number(l)||0,Number(r)||0)||l||r;
    if(l===undefined)return r;
    if(r===undefined)return l;
    if(isRecordList(l)&&isRecordList(r)&&(b===undefined||isRecordList(b)))return mergeRecords(b,l,r,preferRemote);
    if(preferRemote)return r;
    // Whole value (settings, business profile, ...): keep whichever side changed it.
    return same(l,b)?r:l;
  }

  function merge(base,local,remote){
    if(!remote)return local;
    let preferRemote=!base;
    base=base||{};
    let out={};
    let keys=new Set([...Object.keys(local),...Object.keys(remote)]);
    keys.delete('savedAt');
    for(const k of keys)out[k]=mergeValue(k,base[k],local[k],remote[k],preferRemote);
    return out;
  }

  let api={merge,stable,same};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.HKSync=api;
})(typeof window!=='undefined'?window:this);
