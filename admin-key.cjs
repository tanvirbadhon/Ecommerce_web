const fs=require('node:fs'),path=require('node:path');
const directory=process.env.KIDDO_DATA_DIR||path.join(__dirname,'.data');
const file=path.join(directory,'admin-key.txt');
if(!fs.existsSync(file)){console.log('Run npm run dev once to create your administrator password.');process.exit(1);}
console.log('Private administrator password (keep it to yourself):\n'+fs.readFileSync(file,'utf8').trim());
