const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {createStore}=require('./store.cjs');
const store=createStore(process.env.KIDDO_DATA_DIR||path.join(__dirname,'.data'));
async function handler(req,res){
 const host=req.headers.host||'';
 if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)){res.writeHead(403);res.end('Host not allowed');return;}
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Cache-Control','no-store');
 try{
  const url=new URL(req.url,'http://'+host);
  if(url.pathname.startsWith('/api/'))return await store.handle(req,res,url);
  const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/store-api.js':'store-api.js','/store-backend.json':'store-backend.json','/bootstrap.js':'bootstrap.js','/shop-extras.js':'shop-extras.js','/checkout.js':'checkout.js','/admin':'admin.html','/admin.js':'admin.js','/admin.css':'admin.css'};
  let target=files[url.pathname]&&path.join(__dirname,files[url.pathname]);
  if(/^\/assets\/[a-z-]+\.(svg|png)$/.test(url.pathname))target=path.join(__dirname,url.pathname.slice(1));
  if(/^\/uploads\/[a-f0-9]{32}\.(png|jpg|webp)$/.test(url.pathname))target=path.join(store.directory,url.pathname.slice(1));
  if(!target||!fs.existsSync(target)){res.writeHead(404);res.end('Not found');return;}
  const mime={'.html':'text/html','.json':'application/json','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
  res.setHeader('Content-Type',(mime[path.extname(target)]||'application/octet-stream')+(['.html','.css','.js'].includes(path.extname(target))?'; charset=utf-8':''));
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  res.writeHead(200);if(req.method==='HEAD')res.end();else fs.createReadStream(target).pipe(res);
 }catch{if(!res.headersSent)res.writeHead(500);res.end('Unable to complete request');}
}
if(require.main===module)http.createServer(handler).listen(3000,'127.0.0.1',()=>console.log('Kiddo Toy Mart: http://127.0.0.1:3000\nProduct manager: http://127.0.0.1:3000/admin\nUse your Supabase administrator email and password (or npm run admin-key only in local backend mode).'));
module.exports={handler};
