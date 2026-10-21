const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {createCloudHandler}=require('./handler');
const {productData,imageData,orderData}=require('./validation');
function database(){
 const records=new Map();
 const snapshot=key=>({exists:records.has(key),data:()=>structuredClone(records.get(key))});
 function collection(name){
  let predicate=()=>true,sorter=null,max=Infinity;
  const result={
   doc:id=>({key:name+'/'+id}),
   where(field,op,value){assert.equal(op,'==');predicate=data=>data[field]===value;return result;},
   orderBy(field,direction){sorter=(a,b)=>direction==='desc'?b[field].localeCompare(a[field]):a[field].localeCompare(b[field]);return result;},
   limit(n){max=n;return result;},
   async get(){let rows=[...records].filter(([key,value])=>key.startsWith(name+'/')&&predicate(value)).map(([key,value])=>value);if(sorter)rows.sort(sorter);return {docs:rows.slice(0,max).map(data=>({data:()=>structuredClone(data)}))};}
  };return result;
 }
 return {records,collection,async runTransaction(callback){const writes=[];const tx={get:async ref=>snapshot(ref.key),set(ref,value){writes.push([ref.key,value,false]);},create(ref,value){if(records.has(ref.key))throw new Error('Exists');writes.push([ref.key,value,true]);}};const value=await callback(tx);for(const [key,data]of writes)records.set(key,structuredClone(data));return value;}};
}
function setup(){
 const db=database(),savedFiles=[];
 const product={id:301,name:'Learning blocks',price:123.45,description:'A colorful set',category:'Building',image:'assets/blocks.svg',images:[],active:true};db.records.set('products/301',product);
 const state={admin:true,revoked:false,disabled:false,failLogin:false};
 const auth={async verifyIdToken(){return {uid:'owner',admin:state.admin,auth_time:Date.now()/1000};},async createSessionCookie(){return 'signed-cookie';},async verifySessionCookie(cookie){if(cookie!=='signed-cookie'||state.revoked)throw new Error();return {uid:'owner',admin:state.admin};},async getUser(){return {disabled:state.disabled,customClaims:{admin:state.admin}};},async revokeRefreshTokens(){state.revoked=true;}};
 const bucket={name:'test-bucket.firebasestorage.app',file:name=>({async save(buffer,options){savedFiles.push({name,buffer,options});}})};
 const handler=createCloudHandler({db,auth,bucket,apiKey:'public-key',origins:['https://test-store.web.app'],signIn:async()=>{if(state.failLogin)throw new Error();return {idToken:'id-token'};}});
 async function request(url,method='GET',body,authenticated=false,origin='https://test-store.web.app'){
  let result,status;const headers={};const res={set(name,value){headers[name]=value;return res;},status(code){status=code;return res;},json(value){result=value;return res;}};
  await handler({method,url,headers:{origin,'content-type':'application/json',cookie:authenticated?'__session=signed-cookie':''},body,ip:'test-client'},res);return {result,status,headers};
 }
 return {db,request,state,savedFiles,product};
}
test('public catalog and settings are readable; private data requires an administrator',async()=>{
 const {db,request}=setup();db.records.set('products/302',{id:302,active:false});
 assert.equal((await request('/api/products')).result.length,1);
 assert.equal((await request('/api/config')).result.authMode,'firebase');
 assert.equal((await request('/api/settings')).result.shipping.dhaka.price,80);
 assert.equal((await request('/api/admin/orders')).status,401);
 assert.equal((await request('/api/admin/products')).status,401);
 assert.equal((await request('/api/orders','POST',{},false,'https://evil.example')).status,403);
});
test('login uses the Hosting-compatible secure session cookie; permissions can be revoked',async()=>{
 const {request,state}=setup();
 const response=await request('/api/admin/login','POST',{email:'owner@example.com',password:'test-only'});
 assert.equal(response.status,200);assert.match(response.headers['Set-Cookie'],/^__session=/);assert.match(response.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
 assert.equal((await request('/api/admin/products','GET',undefined,true)).status,200);
 state.admin=false;assert.equal((await request('/api/admin/products','GET',undefined,true)).status,403);
 assert.equal((await request('/api/admin/login','POST',{email:'other@example.com',password:'test-only'})).status,403);
 state.admin=true;assert.equal((await request('/api/admin/logout','POST',{},true)).status,200);
 assert.equal((await request('/api/admin/orders','GET',undefined,true)).status,401);
});
test('product changes and validated image uploads are restricted to administrators',async()=>{
 const {request,db,product,savedFiles}=setup();
 assert.equal((await request('/api/admin/products','POST',product)).status,401);
 const response=await request('/api/admin/products','POST',{...product,id:undefined},true);assert.equal(response.status,200);assert.equal(response.result.id,1000);
 assert.equal((await request('/api/admin/products','POST',{...product,active:false},true)).status,200);assert.equal(db.records.get('products/301').active,false);
 assert.equal((await request('/api/admin/products','POST',{...product,image:'javascript:alert(1)'},true)).status,400);
 assert.equal((await request('/api/admin/upload','POST',{base64:Buffer.from('<svg>not an accepted upload</svg>').toString('base64')},true)).status,400);
 const base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
 const upload=await request('/api/admin/upload','POST',{base64},true);assert.equal(upload.status,201);assert.match(upload.result.url,/^https:\/\/firebasestorage.googleapis.com\/v0\/b\/test-bucket/);assert.equal(savedFiles[0].options.metadata.contentType,'image/png');
});
test('orders use stored prices, reject tampering, preserve customer privacy, and deduplicate retries',async()=>{
 const {request,db}=setup();const order={requestId:crypto.randomUUID(),customer:{name:'Test Customer',phone:'01700000000',address:'Test address',city:'Dhaka'},shipping:'dhaka',items:[{id:301,quantity:2,price:1}],expectedTotal:326.9};
 assert.equal((await request('/api/orders','POST',{...order,expectedTotal:1})).status,409);
 assert.equal((await request('/api/orders','POST',{...order,customer:{...order.customer,phone:'bad'}})).status,400);
 const response=await request('/api/orders','POST',order);assert.equal(response.status,201);assert.equal(response.result.total,326.9);assert.equal(response.result.customer,undefined);
 const duplicate=await request('/api/orders','POST',order);assert.equal(duplicate.status,200);assert.equal(duplicate.result.id,response.result.id);
 const record=db.records.get('orders/'+order.requestId);assert.equal(record.items[0].price,123.45);
 assert.equal((await request('/api/admin/orders')).status,401);assert.equal((await request('/api/admin/orders','GET',undefined,true)).result.length,1);
});
test('shared rate limiting blocks repeated login requests',async()=>{
 const {request}=setup();for(let i=0;i<10;i++)assert.equal((await request('/api/admin/login','POST',{})).status,400);
 assert.equal((await request('/api/admin/login','POST',{})).status,429);
});
test('validation rejects duplicate lines, invalid quantities, and unsafe product images',()=>{
 const product={id:1,name:'Toy',price:100,active:true};
 assert.throws(()=>orderData({items:[{id:1,quantity:1},{id:1,quantity:1}]},[product]));
 assert.throws(()=>orderData({items:[{id:1,quantity:0}]},[product]));
 assert.throws(()=>productData({name:'Toy',price:-1,description:'Toy',category:'Toys',image:'assets/car.svg'},1));
 assert.throws(()=>imageData({base64:'not-valid-base64!'}));
});
test('Hosting exposes only the public build and does not deploy billing-dependent services',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(__dirname,'..','firebase.json'),'utf8'));
 assert.equal(config.hosting.public,'firebase-public');assert.equal(config.functions,undefined);assert.equal(config.hosting.rewrites,undefined);
 assert.match(fs.readFileSync(path.join(__dirname,'..','firestore.rules'),'utf8'),/allow read, write: if false/);
 assert.match(fs.readFileSync(path.join(__dirname,'..','storage.rules'),'utf8'),/allow read, write: if false/);
});
