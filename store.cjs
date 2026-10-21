const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const SHIPPING={dhaka:{label:'Inside Dhaka',price:80},nearby:{label:'Savar, Keraniganj, Narayanganj, Gazipur',price:110},outside:{label:'Outside Dhaka',price:150}};
function createStore(directory){
 fs.mkdirSync(directory,{recursive:true});for(const folder of ['orders','uploads'])fs.mkdirSync(path.join(directory,folder),{recursive:true});
 const catalogPath=path.join(directory,'products.json');
 const atomic=(file,data)=>{const temp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,JSON.stringify(data,null,2));fs.renameSync(temp,file);};
 if(!fs.existsSync(catalogPath))atomic(catalogPath,JSON.parse(fs.readFileSync(path.join(__dirname,'catalog.json'),'utf8')));
 const keyPath=path.join(directory,'admin-key.txt');if(!fs.existsSync(keyPath))fs.writeFileSync(keyPath,crypto.randomBytes(24).toString('base64url'),{mode:0o600});
 const adminKey=fs.readFileSync(keyPath,'utf8').trim(),sessions=new Map(),attempts=new Map();
 const readProducts=()=>JSON.parse(fs.readFileSync(catalogPath,'utf8'));
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
 const text=(value,name,max=200)=>{if(typeof value!=='string'||!value.trim()||value.length>max)fail('Please provide a valid '+name+'.');return value.trim();};
 const body=async req=>{let content='',size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>8*1024*1024)fail('Upload is too large.',413);content+=chunk;}try{return JSON.parse(content);}catch{fail('Invalid request body.');}};
 const authorized=req=>{const token=(req.headers.cookie||'').match(/(?:^|;\s*)kiddo_session=([^;]+)/)?.[1];const expires=sessions.get(token);if(expires&&expires>Date.now())return true;if(token)sessions.delete(token);return false;};
 const limited=(key,limit)=>{const now=Date.now();let entry=attempts.get(key);if(!entry||entry.until<now){entry={count:0,until:now+60000};attempts.set(key,entry);}if(++entry.count>limit)fail('Too many requests. Please wait a minute.',429);};
 const imagePath=src=>typeof src==='string'&&(/^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(src)||/^assets\/[a-z-]+\.(svg|png)$/.test(src)||/^https:\/\/[^\s<>"']+$/.test(src));
 async function handle(req,res,url){try{
  const route=url.pathname;
  if(!['GET','HEAD'].includes(req.method)){if(req.headers.origin!=='http://'+req.headers.host)fail('This request must come from the store website.',403);if(!String(req.headers['content-type']||'').startsWith('application/json'))fail('JSON content required.',415);}
  if(route==='/api/products'&&req.method==='GET')return json(res,200,readProducts().filter(p=>p.active!==false&&!p.deleted).map(p=>({...p,originalPrice:p.price,discount_percent:p.discount_percent||0,price:Math.round(p.price*(100-(p.discount_percent||0)))/100})));
  if(route==='/api/config'&&req.method==='GET')return json(res,200,{authMode:'local'});
  if(route==='/api/settings'&&req.method==='GET')return json(res,200,{shipping:SHIPPING});
  if(route==='/api/admin/login'&&req.method==='POST'){
   limited('login:'+req.socket.remoteAddress,10);const data=await body(req);
   if(!crypto.timingSafeEqual(crypto.createHash('sha256').update(String(data.password||'')).digest(),crypto.createHash('sha256').update(adminKey).digest()))fail('Incorrect administrator password.',401);
   for(const [token,expiry]of sessions)if(expiry<Date.now())sessions.delete(token);
   const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+28800000);res.setHeader('Set-Cookie',`kiddo_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`);return json(res,200,{ok:true});
  }
  if(route.startsWith('/api/admin/')){
   if(!authorized(req))fail('Please sign in to the product manager.',401);
   if(route==='/api/admin/logout'&&req.method==='POST'){const token=(req.headers.cookie||'').match(/kiddo_session=([^;]+)/)?.[1];sessions.delete(token);res.setHeader('Set-Cookie','kiddo_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');return json(res,200,{ok:true});}
   if(route==='/api/admin/products'&&req.method==='GET')return json(res,200,readProducts());
   if(route==='/api/admin/orders'&&req.method==='GET')return json(res,200,fs.readdirSync(path.join(directory,'orders')).filter(f=>f.endsWith('.json')).map(file=>JSON.parse(fs.readFileSync(path.join(directory,'orders',file),'utf8'))).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
   if(route==='/api/admin/upload'&&req.method==='POST'){
    const data=await body(req);if(typeof data.base64!=='string'||!data.base64.match(/^[A-Za-z0-9+/]*={0,2}$/))fail('Invalid image.');
    const buffer=Buffer.from(data.base64,'base64');if(buffer.length>5242880||buffer.length<12)fail('Choose an image up to 5 MB.');
    let ext;if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';else if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)ext='jpg';else if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')ext='webp';else fail('Use a PNG, JPG, or WebP image.');
    const name=crypto.randomBytes(16).toString('hex')+'.'+ext;fs.writeFileSync(path.join(directory,'uploads',name),buffer);return json(res,201,{url:'/uploads/'+name});
   }
   if(route==='/api/admin/order-delete'&&req.method==='POST'){
    const data=await body(req);for(const entry of fs.readdirSync(path.join(directory,'orders')).filter(file=>file.endsWith('.json'))){const orderPath=path.join(directory,'orders',entry),saved=JSON.parse(fs.readFileSync(orderPath,'utf8'));if(saved.id===data.receipt){if(!['Delivered','Cancelled'].includes(saved.status))fail('Only delivered or cancelled orders can be deleted.');fs.unlinkSync(orderPath);return json(res,200,{ok:true});}}fail('Order not found.',404);
   }
   if(route==='/api/admin/order-status'&&req.method==='POST'){
    const data=await body(req);const files=fs.readdirSync(path.join(directory,'orders')).filter(file=>file.endsWith('.json'));let file,order;for(const entry of files){const saved=JSON.parse(fs.readFileSync(path.join(directory,'orders',entry),'utf8'));if(saved.id===data.receipt){file=entry;order=saved;break;}}if(!order)fail('Order not found.',404);
    const transitions={'Pending confirmation':['Confirmed','Cancelled'],Confirmed:['Shipped'],Shipped:['Delivered'],Cancelled:['Pending confirmation']};if(data.status!==order.status&&!(transitions[order.status]||[]).includes(data.status))fail('Invalid order status change.');order.status=data.status;order.updatedAt=new Date().toISOString();atomic(path.join(directory,'orders',file),order);return json(res,200,order);
   }
   if(route==='/api/admin/product-delete'&&req.method==='POST'){
    const data=await body(req),all=readProducts(),product=all.find(p=>p.id===data.id);if(!product||!product.deleted)fail('Product not found in Trash.',404);atomic(catalogPath,all.filter(p=>p.id!==data.id));return json(res,200,{ok:true,id:data.id});
   }
   if(route==='/api/admin/product-state'&&req.method==='POST'){
    const data=await body(req),all=readProducts(),product=all.find(p=>p.id===data.id);if(!product||typeof data.deleted!=='boolean')fail('Product not found.',404);
    product.deleted=data.deleted;product.active=!data.deleted;atomic(catalogPath,all);return json(res,200,product);
   }
   if(route==='/api/admin/products'&&req.method==='POST'){
    const data=await body(req),all=readProducts();const existing=data.id&&all.find(p=>p.id===Number(data.id));if(data.id&&!existing)fail('Product not found.',404);
    const price=Number(data.price);if(!Number.isFinite(price)||price<=0||price>1000000||Math.abs(price*100-Math.round(price*100))>0.00001)fail('Enter a price greater than zero with up to two decimal places.');
    const discount_percent=Number(data.discount_percent||0);if(!Number.isInteger(discount_percent)||discount_percent<0||discount_percent>99||Math.round(price*(100-discount_percent))<1)fail('Discount must be a whole percentage from 0 to 99 with a positive final price.');
    const images=data.images||[];if(!Array.isArray(images)||images.length>10||!images.every(imagePath)||!imagePath(data.image))fail('Upload a cover image and up to ten gallery photos.');
    const productId=existing?.id||Math.max(100,...all.map(p=>p.id))+1;const sku=String(data.sku||'KTM-'+productId).trim().toUpperCase();if(!/^[A-Z0-9_-]{1,40}$/.test(sku))fail('Product ID must use 1–40 letters, numbers, hyphens or underscores.');if(all.some(p=>p.id!==productId&&(p.sku||'KTM-'+p.id).toUpperCase()===sku))fail('This Product ID / SKU is already used.',409);
    const colors=data.colors||[];if(!Array.isArray(colors)||colors.length>20||colors.some(c=>typeof c!=='string'||!c.trim()||c.length>40)||new Set(colors.map(c=>c.toLowerCase())).size!==colors.length)fail('Enter up to twenty unique color names.');
    const product={id:productId,sku,colors,discount_percent,deleted:existing?.deleted||false,name:text(data.name,'product name',160),category:text(data.category,'category',40),description:text(data.description,'description',5000),price,image:data.image,images,badge:typeof data.badge==='string'?data.badge.slice(0,40):'',active:data.active!==false};
    if(existing)all[all.indexOf(existing)]=product;else all.push(product);atomic(catalogPath,all);return json(res,200,product);
   }
  }
  if(route==='/api/orders'&&req.method==='POST'){
   limited('orders:'+req.socket.remoteAddress,30);const data=await body(req);if(!/^[a-f0-9-]{36}$/.test(data.requestId||''))fail('Invalid order request.');
   const orderPath=path.join(directory,'orders',data.requestId+'.json');if(fs.existsSync(orderPath)){const saved=JSON.parse(fs.readFileSync(orderPath,'utf8'));return json(res,200,{id:saved.id,total:saved.total});}
   if(!Array.isArray(data.items)||!data.items.length||data.items.length>100)fail('Your bag is empty or too large.');
   const all=readProducts(),seen=new Set();const items=data.items.map(line=>{const product=all.find(p=>p.id===line.id&&p.active!==false&&!p.deleted);if(!product||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99||seen.has(line.id+':'+(line.color||'')))fail('An item is unavailable or has an invalid quantity.');const color=line.color||'';if((product.colors||[]).length?!product.colors.includes(color):color!=='')fail('Choose an available color.');seen.add(line.id+':'+color);return {color,id:product.id,name:product.name,price:Math.round(product.price*(100-(product.discount_percent||0)))/100,quantity:line.quantity};});
   const contact=data.customer||{},phone=text(contact.phone,'phone number',25);if(!/^(?:\+?88)?01[3-9]\d{8}$/.test(phone.replace(/[\s-]/g,'')))fail('Enter a valid Bangladesh mobile number.');
   const email=String(contact.email||'').trim();if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))fail('Enter a valid email address.');
   const customer={name:text(contact.name,'name',120),phone,email,address:text(contact.address,'address',500),city:text(contact.city,'city',100),postalCode:String(contact.postalCode||'').slice(0,15),notes:String(contact.notes||'').slice(0,1000)};
   const shipping=SHIPPING[data.shipping];if(!shipping)fail('Choose a delivery area.');
   const subtotal=items.reduce((sum,p)=>sum+Math.round(p.price*100)*p.quantity,0)/100,total=Math.round((subtotal+shipping.price)*100)/100;
   if(data.expectedTotal!==total)fail('Prices changed. Refresh checkout and review your total.',409);
   const order={id:'KTM-'+crypto.randomBytes(6).toString('hex').toUpperCase(),createdAt:new Date().toISOString(),status:'Pending confirmation',payment:'Cash on delivery',customer,items,shipping,subtotal,total};atomic(orderPath,order);return json(res,201,{id:order.id,total});
  }
  json(res,404,{error:'Not found.'});
 }catch(error){json(res,error.status||500,{error:error.status?error.message:'Unable to save changes. Please try again.'});}}
 return {handle,directory,readProducts};
}
module.exports={createStore,SHIPPING};
