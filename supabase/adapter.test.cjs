const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'..','store-api.js'),'utf8');
function setup(){
 const calls=[],saved={};let login=false,refreshes=0;
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 const fetch=async(url,options={})=>{
  calls.push({url,options});
  if(url==='/store-backend.json')return json({mode:'supabase',url:'https://example.supabase.co',publishableKey:'sb_publishable_test'});
  if(url.includes('grant_type=password')){assert.equal(JSON.parse(options.body).email,'owner@example.com');login=true;return json({access_token:'jwt',refresh_token:'refresh'});}
  if(url.includes('grant_type=refresh_token')){refreshes++;return json({access_token:'new-jwt',refresh_token:'new-refresh'});}
  if(url.endsWith('/rpc/is_store_admin'))return options.headers.Authorization?json(true):json(false);
  if(url.includes('/products?'))return json([{id:1000,name:'Toy',category:'Toys',description:'A toy',price:100,image:'assets/car.svg',images:[]}]);
  if(url.endsWith('/rest/v1/products'))return json([{id:1001,...JSON.parse(options.body)}]);
  if(url.includes('/orders?'))return json([{details:{id:'KTM-TEST',customer:{name:'Test'}}}]);
  if(url.endsWith('/rpc/delete_trashed_store_product')){assert.equal(options.headers.Authorization,'Bearer jwt');assert.equal(JSON.parse(options.body).p_id,1000);return json({ok:true,id:1000});}
  if(url.includes('/rpc/place_store_order')){assert.equal(options.headers.Authorization,undefined);const body=JSON.parse(options.body);assert.equal(body.p_expected_total,180);return json({id:'KTM-TEST',total:180});}
  if(url.includes('/storage/v1/object/product-images/'))return json({Key:'product-images/photo.png'});
  if(url.endsWith('/auth/v1/logout'))return json({});
  throw Error('Unexpected request: '+url);
 };
 const context={window:{},sessionStorage:{getItem:k=>saved[k],setItem:(k,v)=>saved[k]=v,removeItem:k=>delete saved[k]},fetch,Response,Blob,Uint8Array,crypto:require('node:crypto').webcrypto,atob};
 vm.createContext(context);vm.runInContext(source,context);return {api:context.window.KiddoAPI,calls,saved};
}
test('public configuration, products and checkout use only the publishable key',async()=>{
 const {api,calls}=setup();assert.equal((await(await api.fetch('/api/config')).json()).authMode,'supabase');
 assert.equal((await(await api.fetch('/api/products')).json())[0].id,1000);
 const order={requestId:'test',items:[{id:1000,quantity:1}],customer:{},shipping:'dhaka',expectedTotal:180};
 assert.equal((await api.fetch('/api/orders',{method:'POST',body:JSON.stringify(order)})).status,201);
 assert.ok(calls.every(call=>!call.options.headers?.Authorization));
});
test('admin actions require a session; login and logout save and clear it',async()=>{
 const {api,saved}=setup();assert.equal((await api.fetch('/api/admin/products')).status,401);
 const res=await api.fetch('/api/admin/login',{method:'POST',body:JSON.stringify({email:'owner@example.com',password:'test'})});assert.equal(res.status,200);assert.ok(saved['kiddo-supabase-session']);
 assert.equal((await api.fetch('/api/admin/products')).status,200);assert.equal((await(await api.fetch('/api/admin/orders')).json())[0].id,'KTM-TEST');
 assert.equal((await api.fetch('/api/admin/logout',{method:'POST',body:'{}'})).status,200);assert.equal(saved['kiddo-supabase-session'],undefined);
});
test('admin product writes and uploads map to the protected Supabase APIs',async()=>{
 const {api,calls}=setup();await api.fetch('/api/admin/login',{method:'POST',body:JSON.stringify({email:'owner@example.com',password:'test'})});
 const data={name:'Toy',description:'A toy',category:'Toys',price:100,image:'assets/car.svg',images:[],active:true};
 assert.equal((await(await api.fetch('/api/admin/products',{method:'POST',body:JSON.stringify(data)})).json()).id,1001);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
 const image=await(await api.fetch('/api/admin/upload',{method:'POST',body:JSON.stringify({base64:png})})).json();assert.match(image.url,/object\/public\/product-images\//);
 const upload=calls.find(c=>c.url.includes('/storage/'));assert.equal(upload.options.headers.Authorization,'Bearer jwt');assert.equal(upload.options.headers['Content-Type'],'image/png');
 assert.equal((await api.fetch('/api/admin/products',{method:'POST',body:JSON.stringify({...data,image:'javascript:alert(1)'})})).status,400);
 assert.equal((await api.fetch('/api/admin/product-state',{method:'POST',body:JSON.stringify({id:1000,deleted:true})})).status,200);
 const trash=calls.find(call=>call.options.method==='PATCH'&&JSON.parse(call.options.body).deleted===true);assert.ok(trash);assert.equal(JSON.parse(trash.options.body).active,false);
 await api.fetch('/api/admin/product-state',{method:'POST',body:JSON.stringify({id:1000,deleted:false})});
 const restore=calls.find(call=>call.options.method==='PATCH'&&JSON.parse(call.options.body).deleted===false);assert.ok(restore);assert.equal(JSON.parse(restore.options.body).active,true);
 assert.equal((await api.fetch('/api/admin/product-state',{method:'POST',body:JSON.stringify({id:-1,deleted:true})})).status,400);
});

test('permanent deletion uses the protected trash-only RPC',async()=>{
 const {api}=setup();assert.equal((await api.fetch('/api/admin/product-delete',{method:'POST',body:JSON.stringify({id:1000})})).status,401);
 await api.fetch('/api/admin/login',{method:'POST',body:JSON.stringify({email:'owner@example.com',password:'test'})});
 assert.equal((await api.fetch('/api/admin/product-delete',{method:'POST',body:JSON.stringify({id:1000})})).status,200);
 assert.equal((await api.fetch('/api/admin/product-delete',{method:'POST',body:JSON.stringify({id:-1})})).status,400);
});
