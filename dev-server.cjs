'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const handler=require('./api/index.js');
const root=path.join(__dirname,'public');
const port=Number(process.env.PORT||4174);
http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname.startsWith('/api/'))return handler(req,res);
 const name=pathname==='/'?'index.html':pathname.slice(1);
 if(!['index.html','style.css','app.js'].includes(name)){res.writeHead(404);return res.end('Not found');}
 try{
  const bytes=await fs.readFile(path.join(root,name));
  res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log('Fun Run preview: http://127.0.0.1:'+port));
