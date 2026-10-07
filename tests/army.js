/* Largest Army: the holder keeps it until someone plays MORE knights than they have (a tie never moves it).
   usage: node tests/army.js */
const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
const from='\n})();\n</script>';
if(html.indexOf(from)<0){ console.error('FAIL: cannot find the end of the game script'); process.exit(2); }
html=html.replace(from,'\nwindow.__dbg={ST,sel,seats,updateArmy,leaveGame};\n})();\n</script>');
function stubCtx(){ const g={addColorStop(){}};
  return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g;
    if(k==='measureText')return ()=>({width:10}); if(k==='getImageData')return ()=>({data:new Uint8ClampedArray(4)});
    if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',pretendToBeVisual:false,virtualConsole:new VirtualConsole(),beforeParse(w){
  w.__noRollUI=true; const st=w.setTimeout.bind(w);
  w.setTimeout=(fn,ms,...a)=>st(fn,Math.min(ms||0,1),...a);
  w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()+1e7),8); w.cancelAnimationFrame=()=>{};
  w.claude={use:async()=>null}; w.AudioContext=undefined; w.webkitAudioContext=undefined;
  w.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
}});
const w=dom.window, sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=0; const ok=(c,msg)=>{ console.log((c?'  ✓ ':'  ✗ ')+msg); if(!c) failed++; };
(async()=>{
  await sleep(400); const d=w.__dbg;
  for(let i=0;i<6;i++){ d.seats[i].bot=null; d.seats[i].name='P'+i; }
  d.sel.seafarers=false; d.sel.ck=false;
  w.document.querySelector('#countSeg button[data-n="3"]').click();
  w.document.querySelector('#startLocal').click(); await sleep(5);
  const ig=w.document.querySelector('#introGo'); if(ig) ig.click();
  const G=d.ST.G;
  const set=(k0,k1,k2,army)=>{ G.players[0].knights=k0; G.players[1].knights=k1; G.players[2].knights=k2; G.army=army; };
  /* the case from the report: seat 1 holds it with 3, seat 0 reaches 3 */
  set(3,3,0,{p:1,n:3}); d.updateArmy(G);
  ok(G.army.p===1,'tie at 3: the holder (seat 1) keeps the army, it does not go to seat 0');
  set(4,3,0,{p:1,n:3}); d.updateArmy(G);
  ok(G.army.p===0 && G.army.n===4,'seat 0 reaches 4: the army moves to seat 0');
  /* a tie never moves it, in either direction */
  set(4,4,0,{p:0,n:4}); d.updateArmy(G);
  ok(G.army.p===0,'tie at 4 with the holder in seat 0: stays');
  set(3,3,3,{p:2,n:3}); d.updateArmy(G);
  ok(G.army.p===2,'three-way tie: the holder in seat 2 keeps it');
  /* nobody holds it yet */
  set(2,2,2,{p:-1,n:0}); d.updateArmy(G);
  ok(G.army.p===-1,'two knights each: nobody has the army');
  set(0,3,0,{p:-1,n:0}); d.updateArmy(G);
  ok(G.army.p===1 && G.army.n===3,'first to 3 knights takes it');
  set(3,3,3,{p:-1,n:0}); d.updateArmy(G);
  ok(G.army.p>=0 && G.players[G.army.p].knights===3,'unheld and tied at 3: someone takes it (first in order)');
  console.log(failed?'FAILED: '+failed:'all good');
  process.exit(failed?1:0);
})();
