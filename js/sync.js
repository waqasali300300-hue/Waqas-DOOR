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

  // ── Packing the cloud copy ──
  // Firestore allows 1MB per document. Plain JSON of a busy shop passes that after
  // a few hundred orders, so the data is stored gzip-compressed (about 10× smaller)
  // as one text field. Documents written by older app versions (plain fields)
  // are still read.
  const PLAIN_KEYS=['parties','orders','labours','expenses','businessProfile'];
  function toB64(bytes){
    let s='',CH=0x8000;
    for(let i=0;i<bytes.length;i+=CH)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+CH));
    return btoa(s);
  }
  function fromB64(str){let bin=atob(str),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;}
  async function pack(obj){
    let json=JSON.stringify(obj);
    if(typeof CompressionStream!=='undefined'){
      let stream=new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
      let buf=new Uint8Array(await new Response(stream).arrayBuffer());
      return {fmt:2,enc:'gzip',z:toB64(buf)};
    }
    return {fmt:2,enc:'json',z:json};
  }
  async function unpack(doc){
    if(!doc)return null;
    let d=Object.assign({},doc);delete d.savedAt;
    // Plain fields present → written by an older app version; use them.
    if(!d.z||PLAIN_KEYS.some(k=>k in d)){delete d.z;delete d.fmt;delete d.enc;return d;}
    if(d.enc==='json')return JSON.parse(d.z);
    let stream=new Blob([fromB64(d.z)]).stream().pipeThrough(new DecompressionStream('gzip'));
    return JSON.parse(await new Response(stream).text());
  }

  let api={merge,stable,same,pack,unpack};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.HKSync=api;
})(typeof window!=='undefined'?window:this);
