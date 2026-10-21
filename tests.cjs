const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{Readable}=require('node:stream');
const {createStore}=require('./store.cjs');
const directory=fs.mkdtempSync(path.join(__dirname,'.kiddo-test-'));
let store=createStore(directory),cookie='';
async function request(url,method='GET',data,authenticated=false,origin='http://localhost:3000'){
 const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);req.method=method;req.socket={remoteAddress:'127.0.0.1'};req.headers={host:'localhost:3000',origin,'content-type':'application/json',cookie:authenticated?cookie:''};
 const headers={};let result,status;
 const res={setHeader(k,v){headers[k]=v;},writeHead(code,fields){status=code;Object.assign(headers,fields);},end(text){result=JSON.parse(text);}};
 await store.handle(req,res,new URL(url,'http://localhost:3000'));return {status,result,headers};
}
(async()=>{try{
 let response=await request('/api/products');assert.equal(response.status,200);assert.ok(!response.result.some(p=>p.id===304));
 assert.equal((await request('/api/admin/orders')).status,401);
 assert.equal((await request('/api/admin/login','POST',{password:'wrong'})).status,401);
 assert.equal((await request('/api/admin/login','POST',{},false,'https://untrusted.example')).status,403);
 const password=fs.readFileSync(path.join(directory,'admin-key.txt'),'utf8');response=await request('/api/admin/login','POST',{password});assert.equal(response.status,200);cookie=response.headers['Set-Cookie'].split(';')[0];assert.match(response.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);
 const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=';
 assert.equal((await request('/api/admin/upload','POST',{base64:Buffer.from('<svg>not allowed</svg>').toString('base64')},true)).status,400);
 response=await request('/api/admin/upload','POST',{base64:png},true);assert.equal(response.status,201);const image=response.result.url;assert.ok(fs.existsSync(path.join(directory,image.slice(1))));
 const product={name:'Test toy <safe>',price:123.45,description:'A product uploaded through the manager.',category:'Toys',image,images:[image]};
 response=await request('/api/admin/products','POST',product,true);assert.equal(response.status,200);const id=response.result.id;
 assert.equal((await request('/api/admin/products','POST',{...product,price:-10},true)).status,400);
 assert.equal((await request('/api/admin/products','POST',{...product,image:'javascript:alert(1)'},true)).status,400);
 const order={requestId:crypto.randomUUID(),customer:{name:'Test Customer',phone:'01700000000',address:'Test address',city:'Dhaka'},shipping:'dhaka',items:[{id,quantity:2,price:1}],expectedTotal:326.9};
 assert.equal((await request('/api/orders','POST',{...order,expectedTotal:1})).status,409);
 assert.equal((await request('/api/orders','POST',{...order,customer:{...order.customer,phone:'invalid'}})).status,400);
 assert.equal((await request('/api/orders','POST',{...order,items:[{id,quantity:-1}]})).status,400);
 response=await request('/api/orders','POST',order);assert.equal(response.status,201);assert.equal(response.result.total,326.9);const orderId=response.result.id;
 response=await request('/api/orders','POST',order);assert.equal(response.status,200);assert.equal(response.result.id,orderId);assert.equal(fs.readdirSync(path.join(directory,'orders')).length,1);
 response=await request('/api/admin/orders','GET',undefined,true);assert.equal(response.result[0].items[0].price,123.45);assert.equal(response.result[0].customer.name,'Test Customer');
 await request('/api/admin/products','POST',{...product,id,active:false},true);assert.ok(!(await request('/api/products')).result.some(p=>p.id===id));
 assert.equal((await request('/api/orders','POST',{...order,requestId:crypto.randomUUID()})).status,400);
 store=createStore(directory);assert.equal(store.readProducts().find(p=>p.id===id).active,false);assert.ok(fs.existsSync(path.join(directory,'orders',order.requestId+'.json')));
 // Frontend route and text checks without network access.
 const vm=require('node:vm'),nodes={},el=s=>nodes[s]??={value:s==='#sort'?'featured':'3390',innerHTML:'',textContent:'',classList:{toggle(){},add(){},remove(){}},setAttribute(){},addEventListener(){},querySelector:x=>el(s+' '+x),querySelectorAll:()=>[],focus(){},close(){}};
 let checkoutOpened=false;const context={document:{body:el('body'),querySelector:el,querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},location:{hash:'',href:'http://localhost/'},window:{KIDDO_PRODUCTS:store.readProducts().filter(p=>p.active!==false),addEventListener(){},scrollTo(){},renderCheckout(){checkoutOpened=true;}},URLSearchParams,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),context);context.location.hash='#product-301';vm.runInContext('updateRoute()',context);assert.match(el('#product-detail').innerHTML,/Buy it now/);assert.doesNotMatch(el('#product-detail').innerHTML,/\bdemo\b/i);context.location.hash='#checkout';vm.runInContext('updateRoute()',context);assert.ok(checkoutOpened);assert.equal(el('#storefront').hidden,true);
 for(const file of ['index.html','app.js','checkout.js'])assert.doesNotMatch(fs.readFileSync(path.join(__dirname,file),'utf8'),/\bdemo\b/i);
 vm.runInContext("products.find(p=>p.id===301).colors=['Blue','Pink'];cart={};addToCart(301,1,'Blue');addToCart(301,1,'Pink')",context);assert.equal(el('#cart-count').textContent,2);assert.equal(vm.runInContext('getCartLines().length',context),2);assert.match(el('#cart-items').innerHTML,/Blue/);assert.match(el('#cart-items').innerHTML,/Pink/);assert.equal(vm.runInContext("addToCart(301,1,'Red')",context),false);for(let i=0;i<100;i++){assert.ok(vm.runInContext('randomInRange(2,10)',context)>=2);assert.ok(vm.runInContext('randomInRange(10,50)',context)<=50);}
 console.log('PASS: admin authentication, origin checks, uploads, product validation/edit/hide, server-priced orders, invalid orders, duplicate protection, persistence, checkout route and storefront copy.');
 }finally{if(path.dirname(directory)===__dirname&&path.basename(directory).startsWith('.kiddo-test-'))fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
