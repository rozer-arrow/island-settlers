const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(()=>chromium.launch());
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,offline:true});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const net=[]; pg.on('request',r=>{ if(!r.url().startsWith('file:')&&!r.url().startsWith('data:')) net.push(r.url()); });
  await pg.goto('file://'+require('path').join(__dirname,'..','island.html')); await pg.waitForTimeout(1500);
  const r=await pg.evaluate(async()=>{ await document.fonts.ready; return {
    heebo:document.fonts.check('700 16px Heebo','שלום'), frank:document.fonts.check('900 30px "Frank Ruhl Libre"','אי המתיישבים'),
    loaded:[...document.fonts].filter(f=>f.status==='loaded').map(f=>f.family+' '+f.weight) }; });
  console.log(JSON.stringify(r)); console.log('network requests:',net.length,net.slice(0,3)); console.log('errors:',errs);
  await pg.screenshot({path:require('path').join(require('os').tmpdir(),'home_offline.png')});
  await b.close();
})();
