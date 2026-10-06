/* The expert computer's opening: strong numbers, and all five resources between its two settlements.
   usage: node tests/expert_opening.js [games]
   Four experts sit at the table; for each of them we look at the starting position right after the
   opening. Before the fix the expert had all five resources in only about a third of the cases. */
const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
const N=+process.argv[2]||20;
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
const from='\n})();\n</script>';
if(html.indexOf(from)<0){ console.error('FAIL: cannot find the end of the game script'); process.exit(2); }
html=html.replace(from,'\nwindow.__dbg={ST,sel,seats,PIP,RES,leaveGame,xProd};\n})();\n</script>');
function stubCtx(){ const g={addColorStop(){}};
  return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g;
    if(k==='measureText')return ()=>({width:10}); if(k==='getImageData')return ()=>({data:new Uint8ClampedArray(4)});
    if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',pretendToBeVisual:false,virtualConsole:new VirtualConsole(),beforeParse(w){
  w.__noRollUI=true; const st=w.setTimeout.bind(w);
  w.setTimeout=(fn,ms,...a)=>st(fn,Math.min(ms||0,1),...a);
  w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()+1e7),8); w.cancelAnimationFrame=()=>{};
  w.claude={use:async()=>null}; w.AudioContext=undefined; w.webkitAudioContext=undefined;
  w.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
  w.onerror=(m,s,l,c,e)=>errs.push(String(e&&e.stack||m).slice(0,400));
  w.console.error=(...a)=>errs.push(a.map(x=>x&&x.stack?x.stack:String(x)).join(' ').slice(0,400));
}});
const w=dom.window, sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=0; const ok=(c,msg)=>{ console.log((c?'  ✓ ':'  ✗ ')+msg); if(!c) failed++; };
(async()=>{
  await sleep(400); const d=w.__dbg;
  let n=0, pips=0, all5=0, noOre=0, noWheat=0, hot=0, skipped=0;
  for(let g=0;g<N;g++){
    for(let i=0;i<6;i++){ d.seats[i].bot='expert'; d.seats[i].name='P'+i; }
    d.sel.seafarers=false; d.sel.ck=false; d.sel.gold=false; d.sel.friendly=false; d.sel.target=10;
    w.document.querySelector('#countSeg button[data-n="4"]').click();
    w.document.querySelector('#startLocal').click(); await sleep(5);
    const ig=w.document.querySelector('#introGo'); if(ig) ig.click();
    const G=d.ST.G, B=d.ST.B, t0=Date.now();
    while((G.phase==='setup1'||G.phase==='setup2'||!/^(play|main|roll)/.test(G.phase)) && Date.now()-t0<20000) await sleep(10);
    await sleep(30);
    if(G.phase==='setup1'||G.phase==='setup2'){ skipped++; d.leaveGame(); await sleep(5); continue; }
    G.players.forEach((p,i)=>{
      const pr=d.xProd(G,B,i), kinds=d.RES.filter(r=>pr[r]>0).length;
      n++; pips+=d.RES.reduce((a,r)=>a+pr[r],0); all5+=kinds===5?1:0; noOre+=pr.ore===0?1:0; noWheat+=pr.wheat===0?1:0;
      Object.keys(G.buildings).forEach(v=>{ if(G.buildings[v].p!==i) return;
        B.verts[v].hexes.forEach(h=>{ const hx=B.hexById[h]; if(hx&&(hx.num===6||hx.num===8)) hot++; }); });
    });
    d.leaveGame(); await sleep(5);
  }
  const pct=x=>(100*x/Math.max(1,n)).toFixed(0)+'%';
  console.log('  starting positions measured: '+n+'   average pips: '+(pips/Math.max(1,n)).toFixed(1)+'   6/8 hexes touched: '+(hot/Math.max(1,n)).toFixed(2));
  console.log('  all five resources: '+pct(all5)+'   no ore: '+pct(noOre)+'   no wheat: '+pct(noWheat));
  ok(skipped===0,'every opening finished');
  ok(all5/n>=0.55,'at least 55% of the openings have all five resources (it used to be about a third)');
  ok(pips/n>=18,'the strong numbers are not given up for it (average pips at least 18, with four experts competing for the same corners)');
  ok(noOre/n<=0.2,'no more than 20% of the openings lack ore');
  /* the "bot" errors the game itself reports; the leaveGame in this test can cut a dice animation short */
  const real=[...new Set(errs)].filter(e=>!/productionFx/.test(e));
  ok(real.length===0,'no errors'+(real.length?': '+real.slice(0,2).join(' | '):''));
  console.log(failed?'FAILED: '+failed:'all good');
  process.exit(failed?1:0);
})();
