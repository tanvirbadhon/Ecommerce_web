const crypto=require('node:crypto');
const SHIPPING={dhaka:{label:'Inside Dhaka',price:80},nearby:{label:'Savar, Keraniganj, Narayanganj, Gazipur',price:110},outside:{label:'Outside Dhaka',price:150}};
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function text(value,name,max){if(typeof value!=='string'||!value.trim()||value.length>max)fail('Please provide a valid '+name+'.');return value.trim();}
function imagePath(value){return typeof value==='string'&&(/^assets\/[a-z-]+\.(svg|png)$/.test(value)||/^https:\/\/[^\s<>"']+$/.test(value));}
function productData(data,id){
  const price=Number(data.price);if(!Number.isFinite(price)||price<=0||price>1000000||Math.abs(price*100-Math.round(price*100))>.00001)fail('Enter a valid price with up to two decimal places.');
  const images=data.images||[];if(!imagePath(data.image)||!Array.isArray(images)||images.length>10||!images.every(imagePath))fail('Choose a cover image and up to ten gallery photos.');
  return {id,name:text(data.name,'product name',160),description:text(data.description,'description',5000),category:text(data.category,'category',40),price,image:data.image,images,badge:typeof data.badge==='string'?data.badge.slice(0,40):'',active:data.active!==false};
}
function customerData(data){
  const phone=text(data.phone,'phone number',25);if(!/^(?:\+?88)?01[3-9]\d{8}$/.test(phone.replace(/[\s-]/g,'')))fail('Enter a valid Bangladesh mobile number.');
  const email=String(data.email||'').trim();if(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))fail('Enter a valid email address.');
  return {name:text(data.name,'name',120),phone,email,address:text(data.address,'address',500),city:text(data.city,'city',100),postalCode:String(data.postalCode||'').slice(0,15),notes:String(data.notes||'').slice(0,1000)};
}
function orderData(data,products){
  if(!Array.isArray(data.items)||!data.items.length||data.items.length>100)fail('Your bag is empty or too large.');
  const seen=new Set();const items=data.items.map(line=>{const product=products.find(p=>p.id===line.id&&p.active!==false);if(!product||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99||seen.has(line.id))fail('An item is unavailable or has an invalid quantity.');seen.add(line.id);return {id:product.id,name:product.name,price:product.price,quantity:line.quantity};});
  const shipping=SHIPPING[data.shipping];if(!shipping)fail('Choose a delivery area.');
  const customer=customerData(data.customer||{}),subtotal=items.reduce((sum,p)=>sum+Math.round(p.price*100)*p.quantity,0)/100,total=Math.round((subtotal+shipping.price)*100)/100;
  if(data.expectedTotal!==total)fail('Prices changed. Refresh checkout and review your total.',409);
  return {id:'KTM-'+crypto.randomBytes(6).toString('hex').toUpperCase(),createdAt:new Date().toISOString(),status:'Pending confirmation',payment:'Cash on delivery',customer,items,shipping,subtotal,total};
}
function imageData(data){
  if(typeof data.base64!=='string'||!data.base64.match(/^[A-Za-z0-9+/]*={0,2}$/))fail('Invalid image.');
  const buffer=Buffer.from(data.base64,'base64');if(buffer.length>5242880||buffer.length<12)fail('Choose an image up to 5 MB.');
  if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {buffer,ext:'png',contentType:'image/png'};
  if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return {buffer,ext:'jpg',contentType:'image/jpeg'};
  if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return {buffer,ext:'webp',contentType:'image/webp'};
  fail('Use a PNG, JPG, or WebP image.');
}
module.exports={SHIPPING,fail,productData,customerData,orderData,imageData};
