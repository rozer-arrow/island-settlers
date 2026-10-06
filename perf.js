const {chromium}=require('playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(()=>chromium.launch());
  const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const pg=await ctx.newPage();
  await pg.addInitScript(()=>{ window.__noRollUI=true; const raf=window.requestAnimationFrame.bind(window); window.__f=[];
    window.requestAnimationFrame=cb=>raf(ts=>{ const t0=performance.now(); cb(ts); window.__f.push(performance.now()-t0); }); });
  await pg.route(/fonts\.(googleapis|gstatic)/,r=>r.abort());
  await pg.goto('file://'+(process.argv[2]||require('path').join(__dirname,'..','island.html')));
  const cdp=await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  async function measure(label){ await pg.evaluate(()=>window.__f=[]); await pg.waitForTimeout(4000);
    const r=await pg.evaluate(()=>{const f=window.__f; const s=f.reduce((a,b)=>a+b,0); return {n:f.length, avg:s/f.length, busy:s/4000};});
    console.log(label.padEnd(16),'frames/s',(r.n/4).toFixed(0),' avg ms/frame',r.avg.toFixed(1),' main-thread busy',(r.busy*100).toFixed(0)+'%'); }
  await measure('home screen');
  await pg.evaluate(()=>{ document.querySelector('#startLocal').click(); const ig=document.querySelector('#introGo'); if(ig) ig.click(); });
  await pg.waitForTimeout(1500);
  await measure('in game');
  await b.close();
})();
