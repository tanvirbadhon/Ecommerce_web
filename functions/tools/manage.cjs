// Account-authorized operations only. Never copy service-account keys into this repository.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {getAuth}=require('firebase-admin/auth');
const {productData}=require('../validation');
const [command,...args]=process.argv.slice(2),options={};
for(let i=0;i<args.length;i+=2)options[args[i]]=args[i+1];
async function main(){
 if(!['grant-admin','import-products'].includes(command)||!options['--project'])throw new Error('Specify grant-admin or import-products and the exact --project Project ID.');
 initializeApp({credential:applicationDefault(),projectId:options['--project'],...(options['--bucket']?{storageBucket:options['--bucket']}:{})});
 if(command==='grant-admin'){
  if(!options['--uid'])throw new Error('Specify --uid for the intended Firebase Authentication user.');
  const user=await getAuth().getUser(options['--uid']);await getAuth().setCustomUserClaims(user.uid,{...user.customClaims,admin:true});await getAuth().revokeRefreshTokens(user.uid);console.log('Administrator access assigned to the selected UID. Sign in again to apply it.');return;
 }
 if(!options['--source']||!options['--bucket'])throw new Error('Specify an absolute --source products.json path and the exact --bucket name.');
 const source=path.resolve(options['--source']),root=path.dirname(source),products=JSON.parse(fs.readFileSync(source,'utf8'));
 if(!Array.isArray(products)||products.length>1000)throw new Error('Expected a product array with up to 1000 items.');
 const db=getFirestore(),bucket=getStorage().bucket(),converted=new Map();let imported=0,skipped=0;
 async function photo(value){
  if(!value.startsWith('/uploads/'))return value;
  if(!/^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(value))throw new Error('Invalid local upload reference.');
  if(converted.has(value))return converted.get(value);
  const file=path.join(root,value.slice(1));if(!fs.existsSync(file))throw new Error('A referenced product photo is missing.');
  const name='products/'+crypto.randomBytes(16).toString('hex')+path.extname(file),token=crypto.randomUUID();
  await bucket.upload(file,{destination:name,resumable:false,metadata:{contentType:{'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[path.extname(file)],cacheControl:'public, max-age=31536000, immutable',metadata:{firebaseStorageDownloadTokens:token}}});
  const url=`https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(name)}?alt=media&token=${token}`;converted.set(value,url);return url;
 }
 for(const item of products){
  if(!Number.isSafeInteger(item.id)||item.id<1)throw new Error('Invalid product ID in import.');
  const ref=db.collection('products').doc(String(item.id));if((await ref.get()).exists){skipped++;continue;}
  const base=item.image.startsWith('http')||item.image.startsWith('/uploads/')||item.image.startsWith('assets/')?item.image:'assets/'+item.image+'.svg';
  const product=productData({...item,image:await photo(base),images:await Promise.all((item.images||[]).map(photo))},item.id);
  try{await ref.create(product);imported++;}catch(e){if(e.code===6)skipped++;else throw e;}
 }
 // Advance the counter without overwriting concurrent product additions.
 await db.runTransaction(async tx=>{const ref=db.collection('metadata').doc('catalog'),snapshot=await tx.get(ref);tx.set(ref,{nextId:Math.max(1000,...products.map(p=>p.id+1),snapshot.exists?snapshot.data().nextId:0)});});
 console.log(`Imported ${imported} products; skipped ${skipped} existing records. Customer orders were not uploaded.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
