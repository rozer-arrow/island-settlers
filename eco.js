/* battery saver: count real redraws per second in each state, in a real browser */
const {chromium}=require('playwright'); const fs=require('fs'), path=require('path');
const src=process.argv[2]||path.join(__dirname,'..','island.html');
let html=fs.readFileSync(src,'utf8').replace('try{ render(vt); }','try{ window.__renders=(window.__renders||0)+1; render(vt); }');
const tmp=path.join(require('os').tmpdir(),'eco-test.html'); fs.writeFileSync(tmp,html);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'}).catch(()=>chromium.launch());
  const ctx=await b.newContext({viewport:{width:1000,height:700}});
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{ window.__noRollUI=true; });
  await pg.goto('file://'+tmp); await pg.waitForTimeout(500);
  const rate=async(ms)=>{ const a=await pg.evaluate(()=>window.__renders||0); await pg.waitForTimeout(ms); const z=await pg.evaluate(()=>window.__renders||0); return ((z-a)/(ms/1000)).toFixed(1); };
  await pg.evaluate(()=>{ document.querySelector('#startLocal').click(); const ig=document.querySelector('#introGo'); if(ig) ig.click(); });
  await pg.waitForTimeout(1500);
  console.log('eco OFF, in game:            ',await rate(3000),'redraws/s');
  // switch on through the menu
  await pg.click('#btnMenu'); await pg.waitForTimeout(200);
  const btn=pg.locator('#menuBody button',{hasText:'מצב חסכוני'}); console.log('menu button:',await btn.textContent());
  await btn.click(); console.log('after click:',await btn.textContent(), ' stored:',await pg.evaluate(()=>localStorage.getItem('sieco')));
  await pg.evaluate(()=>{ document.querySelector('#scrim').click(); });
  await pg.mouse.move(500,350);
  console.log('eco ON, right after a touch: ',await rate(1000),'redraws/s');
  await pg.waitForTimeout(3000);
  console.log('eco ON, idle 4-12s:          ',await rate(8000),'redraws/s');
  await pg.waitForTimeout(19000);
  console.log('eco ON, idle 31s+ (asleep):  ',await rate(8000),'redraws/s');
  await pg.mouse.move(520,360); await pg.mouse.move(540,380);
  console.log('eco ON, moving the mouse:    ',await rate(1000),'redraws/s');
  // a state change (computer turn / friend update) wakes it
  await pg.waitForTimeout(32000);
  const before=await rate(4000);
  await pg.evaluate(()=>{ const t=document.createEvent('Event'); });
  console.log('asleep again:',before,'redraws/s; errors:',errs.length?errs.slice(0,3):'none');
  await b.close();
})();
