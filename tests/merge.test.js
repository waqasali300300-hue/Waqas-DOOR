const assert=require('assert');const {merge}=require('../js/sync.js');
const ids=a=>a.map(x=>x.id).join(',');
let base={orders:[{id:1,t:10},{id:2,t:20},{id:3,t:30}],nextId:5,businessProfile:{name:'A'}};
// A adds 4, edits 1, deletes 2 ; B adds 5, edits 3, profile change
let A={orders:[{id:1,t:11},{id:3,t:30},{id:4,t:40}],nextId:6,businessProfile:{name:'A'}};
let B={orders:[{id:1,t:10},{id:2,t:20},{id:3,t:33},{id:5,t:50}],nextId:7,businessProfile:{name:'B'}};
let m=merge(base,A,B);
assert.equal(ids(m.orders),'1,3,4,5');assert.equal(m.orders[0].t,11);assert.equal(m.orders[1].t,33);
assert.equal(m.nextId,7);assert.equal(m.businessProfile.name,'B');
// remote deleted, local edited -> keep
m=merge(base,{orders:[{id:2,t:99}]},{orders:[]});assert.equal(ids(m.orders),'2');
// remote deleted, local unchanged -> gone
m=merge(base,{orders:[{id:2,t:20}]},{orders:[]});assert.equal(ids(m.orders),'');
// no base: remote wins conflicts, local-only kept
m=merge(null,{orders:[{id:1,t:0},{id:9,t:9}],businessProfile:{name:'default'}},{orders:[{id:1,t:10}],businessProfile:{name:'Real'}});
assert.equal(ids(m.orders),'1,9');assert.equal(m.orders[0].t,10);assert.equal(m.businessProfile.name,'Real');
// key order irrelevant
m=merge({p:[{id:1,a:1,b:2}]},{p:[{b:2,a:1,id:1}]},{p:[{id:1,a:5,b:2}]});assert.equal(m.p[0].a,5);
// no remote
assert.deepEqual(merge(base,A,null),A);
// arrays without ids -> whole value
m=merge({x:[1,2]},{x:[1,2,3]},{x:[1,2]});assert.deepEqual(m.x,[1,2,3]);
console.log('merge tests passed');
