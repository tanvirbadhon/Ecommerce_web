/* One browser API for the local server and the no-card Supabase deployment. */
(() => {
  const SESSION_KEY='kiddo-supabase-session';
  const SHIPPING={dhaka:{label:'Inside Dhaka',price:80},nearby:{label:'Savar, Keraniganj, Narayanganj, Gazipur',price:110},outside:{label:'Outside Dhaka',price:150}};
  let configPromise,refreshPromise,session=null;
  try{session=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');}catch{}
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
  const failure=(message,status=400)=>Object.assign(new Error(message),{status});
  const configure=()=>configPromise??=fetch('/store-backend.json',{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw failure('Store configuration could not be loaded.',503);
    const config=await response.json();if(config.mode==='local')return config;
    if(config.mode!=='supabase'||!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url)||!config.publishableKey?.startsWith('sb_publishable_'))throw failure('Invalid store connection settings.',503);
    return config;
  });
  function saveSession(value){session=value;try{if(value)sessionStorage.setItem(SESSION_KEY,JSON.stringify(value));else sessionStorage.removeItem(SESSION_KEY);}catch{}}
  async function parse(response){const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={};}if(!response.ok)throw failure((data.code==='23505'?'This Product ID / SKU is already used. Choose another code.':data.code==='PGRST204'?'Run the product management SQL update in Supabase, then refresh this page.':null)||data.msg||data.message||data.error_description||(data.code==='23505'?'This Product ID / SKU is already used. Choose another code.':data.error)||'The request could not be completed.',response.status);return data;}
  async function refresh(config){
    if(!session?.refresh_token)throw failure('Please sign in to the product manager.',401);
    if(!refreshPromise)refreshPromise=(async()=>{try{const response=await fetch(config.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});const data=await parse(response);saveSession(data);return data.access_token;}catch(error){saveSession(null);throw failure('Your session expired. Please sign in again.',401);}finally{refreshPromise=null;}})();
    return refreshPromise;
  }
  async function remote(config,path,options={},signed=false,retry=true){
    if(signed&&!session?.access_token)throw failure('Please sign in to the product manager.',401);
    const headers={apikey:config.publishableKey,...options.headers};if(signed)headers.Authorization='Bearer '+session.access_token;
    const response=await fetch(config.url+path,{...options,headers});
    if(response.status===401&&signed&&retry){await refresh(config);return remote(config,path,options,signed,false);}
    return parse(response);
  }
  async function requireAdmin(config){const allowed=await remote(config,'/rest/v1/rpc/is_store_admin',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'},true);if(allowed!==true)throw failure('This account does not have store administrator access.',403);}
  const validImage=value=>typeof value==='string'&&(/^(https:\/\/[^\s<>"']+|assets\/[a-z-]+\.(svg|png))$/.test(value));
  function product(p,discounted=false){const discount=Number(p.discount_percent||0),original=Number(p.price);return {...p,id:Number(p.id),discount_percent:discount,originalPrice:original,price:discounted?Math.round(original*(100-discount))/100:original,image:validImage(p.image)?p.image:'assets/blocks.svg',images:Array.isArray(p.images)?p.images.filter(validImage):[]};}
  async function request(path,options={}){
    try{
      const config=await configure();if(config.mode==='local')return fetch(path,options);
      const method=options.method||'GET',data=options.body?JSON.parse(options.body):{};
      if(path==='/api/config')return reply({authMode:'supabase'});
      if(path==='/api/settings')return reply({shipping:SHIPPING});
      if(path==='/api/products'&&method==='GET')return reply((await remote(config,'/rest/v1/products?select=*&active=eq.true&order=id.asc&limit=1000')).map(p=>product(p,true)));
      if(path==='/api/admin/login'&&method==='POST'){
        const response=await fetch(config.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({email:data.email,password:data.password})});
        saveSession(await parse(response));try{await requireAdmin(config);}catch(error){saveSession(null);throw error;}return reply({ok:true});
      }
      if(path.startsWith('/api/admin/')){
        await requireAdmin(config);
        if(path==='/api/admin/logout'&&method==='POST'){try{await remote(config,'/auth/v1/logout',{method:'POST'},true);}finally{saveSession(null);}return reply({ok:true});}
        if(path==='/api/admin/products'&&method==='GET')return reply((await remote(config,'/rest/v1/products?select=*&order=id.asc&limit=1000',{},true)).map(p=>product(p)));
        if(path==='/api/admin/orders'&&method==='GET')return reply((await remote(config,'/rest/v1/orders?select=details&order=created_at.desc&limit=200',{cache:'no-store'},true)).map(row=>row.details));
        if(path==='/api/admin/order-delete'&&method==='POST')return reply(await remote(config,'/rest/v1/rpc/delete_delivered_store_order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_receipt:data.receipt})},true));
        if(path==='/api/admin/order-status'&&method==='POST')return reply(await remote(config,'/rest/v1/rpc/set_store_order_status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_receipt:data.receipt,p_status:data.status})},true));
        if(path==='/api/admin/products'&&method==='POST'){
          if(!validImage(data.image)||!Array.isArray(data.images)||!data.images.every(validImage))throw failure('Upload a cover photo and valid gallery images.');
          if(data.id!==undefined&&(!Number.isSafeInteger(data.id)||data.id<1))throw failure('Invalid product ID.');
          const discount=Number(data.discount_percent||0);if(!Number.isInteger(discount)||discount<0||discount>99)throw failure('Discount must be a whole percentage from 0 to 99.');
          const payload={discount_percent:discount,colors:data.colors||[],sku:data.sku||null,name:data.name,category:data.category,description:data.description,price:data.price,image:data.image,images:data.images,badge:data.badge||'',active:data.active!==false};
          const saved=await remote(config,'/rest/v1/products'+(data.id?'?id=eq.'+data.id:''),{method:data.id?'PATCH':'POST',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)},true);
          if(!saved.length)throw failure('The product could not be saved.');return reply(product(saved[0]));
        }
        if(path==='/api/admin/product-delete'&&method==='POST'){
          if(!Number.isSafeInteger(data.id)||data.id<1)throw failure('Invalid product selection.');
          return reply(await remote(config,'/rest/v1/rpc/delete_trashed_store_product',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_id:data.id})},true));
        }
        if(path==='/api/admin/product-state'&&method==='POST'){
          if(!Number.isSafeInteger(data.id)||data.id<1||typeof data.deleted!=='boolean')throw failure('Invalid product selection.');
          const saved=await remote(config,'/rest/v1/products?id=eq.'+data.id,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({deleted:data.deleted,active:!data.deleted})},true);
          if(!saved.length)throw failure('Product not found.',404);return reply(product(saved[0]));
        }
        if(path==='/api/admin/upload'&&method==='POST'){
          const bytes=Uint8Array.from(atob(data.base64||''),char=>char.charCodeAt(0));if(bytes.length>5242880||bytes.length<12)throw failure('Choose an image up to 5 MB.');
          let ext,mime;if(bytes.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'){ext='png';mime='image/png';}else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){ext='jpg';mime='image/jpeg';}else if(String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){ext='webp';mime='image/webp';}else throw failure('Use JPG, PNG or WebP photos.');
          const name=crypto.randomUUID()+'.'+ext;await remote(config,'/storage/v1/object/product-images/'+name,{method:'POST',headers:{'Content-Type':mime,'x-upsert':'false'},body:new Blob([bytes],{type:mime})},true);
          return reply({url:config.url+'/storage/v1/object/public/product-images/'+name},201);
        }
      }
      if(path==='/api/orders'&&method==='POST'){
        // Always use the guest role for checkout, even while the owner is signed in.
        const result=await remote(config,'/rest/v1/rpc/place_store_order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p_request_id:data.requestId,p_items:data.items,p_customer:data.customer,p_shipping:data.shipping,p_expected_total:data.expectedTotal})});return reply(result,201);
      }
      return reply({error:'Not found.'},404);
    }catch(error){return reply({error:error.message||'Could not connect. Please try again.'},error.status&&error.status>=400&&error.status<=599?error.status:503);}
  }
  window.KiddoAPI={fetch:request};
})();
