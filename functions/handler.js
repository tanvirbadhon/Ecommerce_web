const crypto=require('node:crypto');
const {SHIPPING,fail,productData,orderData,imageData}=require('./validation');
function createCloudHandler({db,auth,bucket,apiKey,origins,signIn}) {
  const json=(res,status,data)=>res.status(status).json(data);
  async function rateLimit(req,scope,max){
    const minute=Math.floor(Date.now()/60000),key=crypto.createHash('sha256').update(`${scope}:${req.ip||'unknown'}:${minute}`).digest('hex');
    const ref=db.collection('requestLimits').doc(key);
    await db.runTransaction(async tx=>{const doc=await tx.get(ref);const count=doc.exists?doc.data().count:0;if(count>=max)fail('Too many requests. Please wait a minute.',429);tx.set(ref,{count:count+1,expiresAt:new Date(Date.now()+3600000)});});
  }
  async function admin(req){
    const cookie=(req.headers.cookie||'').match(/(?:^|;\s*)__session=([^;]+)/)?.[1];if(!cookie)fail('Please sign in to the product manager.',401);
    let decoded,user;try{decoded=await auth.verifySessionCookie(cookie,true);user=await auth.getUser(decoded.uid);}catch{fail('Your session expired. Please sign in again.',401);}
    if(decoded.admin!==true||user.disabled||user.customClaims?.admin!==true)fail('This account does not have store administrator access.',403);
    return decoded;
  }
  return async(req,res)=>{
    res.set('Cache-Control','private, no-store');res.set('X-Content-Type-Options','nosniff');
    try{
      const route=new URL(req.originalUrl||req.url,'https://store.invalid').pathname;
      if(!['GET','POST'].includes(req.method))fail('Method not allowed.',405);
      if(req.method==='POST'){
        if(!origins.includes(req.headers.origin))fail('This request must come from the store website.',403);
        if(!String(req.headers['content-type']||'').startsWith('application/json'))fail('JSON content required.',415);
        if(!req.body||Array.isArray(req.body)||typeof req.body!=='object'||Buffer.isBuffer(req.body))fail('Invalid request body.');
        if((req.rawBody?.length||Buffer.byteLength(JSON.stringify(req.body)))>8*1024*1024)fail('Upload is too large.',413);
      }
      if(route==='/api/config'&&req.method==='GET')return json(res,200,{authMode:'firebase'});
      if(route==='/api/settings'&&req.method==='GET')return json(res,200,{shipping:SHIPPING});
      if(route==='/api/products'&&req.method==='GET'){
        const snapshot=await db.collection('products').where('active','==',true).limit(1000).get();return json(res,200,snapshot.docs.map(d=>d.data()).sort((a,b)=>a.id-b.id));
      }
      if(route==='/api/admin/login'&&req.method==='POST'){
        await rateLimit(req,'login',10);const data=req.body;
        if(typeof data.email!=='string'||typeof data.password!=='string'||data.email.length>254||data.password.length>1024)fail('Enter your administrator email and password.');
        let result,decoded;
        try{
          if(signIn)result=await signIn(data.email,data.password);
          else{const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(apiKey),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:data.email,password:data.password,returnSecureToken:true}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();result=await response.json();}
          decoded=await auth.verifyIdToken(result.idToken,true);
        }catch{fail('Unable to sign in. Check your email and password.',401);}
        if(decoded.admin!==true||Date.now()/1000-decoded.auth_time>300)fail('This account does not have store administrator access.',403);
        const cookie=await auth.createSessionCookie(result.idToken,{expiresIn:8*60*60*1000});
        res.set('Set-Cookie',`__session=${cookie}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=28800`);
        return json(res,200,{ok:true});
      }
      if(route.startsWith('/api/admin/')){
        const identity=await admin(req);
        if(route==='/api/admin/logout'&&req.method==='POST'){
          await auth.revokeRefreshTokens(identity.uid);res.set('Set-Cookie','__session=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0');return json(res,200,{ok:true});
        }
        if(route==='/api/admin/products'&&req.method==='GET'){const snapshot=await db.collection('products').limit(1000).get();return json(res,200,snapshot.docs.map(d=>d.data()).sort((a,b)=>a.id-b.id));}
        if(route==='/api/admin/orders'&&req.method==='GET'){const snapshot=await db.collection('orders').orderBy('createdAt','desc').limit(200).get();return json(res,200,snapshot.docs.map(d=>d.data()));}
        if(route==='/api/admin/upload'&&req.method==='POST'){
          await rateLimit(req,'upload',30);const {buffer,ext,contentType}=imageData(req.body);
          const name='products/'+crypto.randomBytes(16).toString('hex')+'.'+ext,token=crypto.randomUUID();
          await bucket.file(name).save(buffer,{resumable:false,metadata:{contentType,cacheControl:'public, max-age=31536000, immutable',metadata:{firebaseStorageDownloadTokens:token}}});
          return json(res,201,{url:`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(name)}?alt=media&token=${token}`});
        }
        if(route==='/api/admin/products'&&req.method==='POST'){
          const data=req.body;if(data.id!==undefined&&(!Number.isSafeInteger(data.id)||data.id<1))fail('Invalid product ID.');
          const saved=await db.runTransaction(async tx=>{
            let id=data.id;
            if(id){const current=await tx.get(db.collection('products').doc(String(id)));if(!current.exists)fail('Product not found.',404);}
            else{const ref=db.collection('metadata').doc('catalog');const current=await tx.get(ref);id=Math.max(1000,current.exists?current.data().nextId:1000);const product=productData(data,id);tx.set(ref,{nextId:id+1});tx.create(db.collection('products').doc(String(id)),product);return product;}
            const product=productData(data,id);tx.set(db.collection('products').doc(String(id)),product);return product;
          });return json(res,200,saved);
        }
      }
      if(route==='/api/orders'&&req.method==='POST'){
        await rateLimit(req,'orders',20);const data=req.body;
        if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(data.requestId||''))fail('Invalid order request.');
        if(!Array.isArray(data.items)||!data.items.length||data.items.length>100||data.items.some(item=>!item||!Number.isSafeInteger(item.id)||item.id<1))fail('Your bag contains an invalid item.');
        const ref=db.collection('orders').doc(data.requestId);
        const result=await db.runTransaction(async tx=>{
          const existing=await tx.get(ref);if(existing.exists){const order=existing.data();return {id:order.id,total:order.total,duplicate:true};}
          const snapshots=await Promise.all(data.items.map(item=>tx.get(db.collection('products').doc(String(item.id)))));
          const order=orderData(data,snapshots.filter(d=>d.exists).map(d=>d.data()));
          tx.create(ref,order);return {id:order.id,total:order.total};
        });return json(res,result.duplicate?200:201,{id:result.id,total:result.total});
      }
      return json(res,404,{error:'Not found.'});
    }catch(error){if(!error.status)console.error('Store request failed:',error.code||'internal');return json(res,error.status||500,{error:error.status?error.message:'Unable to complete your request. Please try again.'});}
  };
}
module.exports={createCloudHandler};
