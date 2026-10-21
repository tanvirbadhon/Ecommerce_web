const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'firebase-public');
// Build only explicitly public files; never copy .data, credentials, or backend source.
const allowed=['index.html','style.css','app.js','bootstrap.js','shop-extras.js','checkout.js','store-api.js','store-backend.json','admin.html','admin.js','admin.css'];
if(path.dirname(out)!==root||path.basename(out)!=='firebase-public')throw new Error('Unexpected build target.');
if(fs.existsSync(out)){
  if(fs.lstatSync(out).isSymbolicLink())throw new Error('The build directory must not be a symbolic link.');
  fs.rmSync(out,{recursive:true,force:true});
}
fs.mkdirSync(out,{recursive:true});
for(const file of allowed)fs.copyFileSync(path.join(root,file),path.join(out,file));
fs.mkdirSync(path.join(out,'assets'),{recursive:true});
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const referenced=[...html.matchAll(/assets\/([a-z-]+\.(?:svg|png))/g)].map(match=>match[1]);
const catalog=JSON.parse(fs.readFileSync(path.join(root,'catalog.json'),'utf8'));
for(const product of catalog)if(!product.image.startsWith('http')&&!product.image.startsWith('/'))referenced.push(product.image.startsWith('assets/')?product.image.slice(7):product.image+'.svg');
for(const name of new Set(referenced))fs.copyFileSync(path.join(root,'assets',name),path.join(out,'assets',name));
console.log('Prepared Firebase Hosting files in firebase-public/ (private data excluded).');
