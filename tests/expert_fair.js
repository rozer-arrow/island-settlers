/* Expert mercy: it does not pile on the same player again and again with the robber, unless that player is about to win.
   usage: node tests/expert_fair.js */
const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
const from='\n})();\n</script>';
if(html.indexOf(from)<0){ console.error('FAIL: cannot find the end of the game script'); process.exit(2); }
html=html.replace(from,'\nwindow.__dbg={ST,sel,seats,xFair,xVictim,moveRobber,leaveGame};\n})();\n</script>');
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
  const G=d.ST.G; G.round=12;
  ok(!G.robHist||G.robHist.length===0,'history starts empty');
  ok(d.xFair(G,0,1)===1,'nobody hit yet: full weight');
  /* moving the robber with a steal is remembered */
  const hid=G.robber; const before=(G.robHist||[]).length;
  G.turn=0; d.moveRobber(G,d.ST.B,hid,null);
  ok((G.robHist||[]).length===before+1 && G.robHist[G.robHist.length-1].vic===-1,'robber move is recorded');
  G.robHist=[{by:0,vic:1,r:5},{by:0,vic:1,r:6}];
  const f2=d.xFair(G,0,1); ok(f2<0.5,'hit twice lately: weight drops ('+f2.toFixed(2)+')');
  ok(d.xFair(G,0,2)===1,'a player who was not hit keeps full weight');
  G.robHist=[{by:0,vic:1,r:5},{by:0,vic:1,r:6},{by:0,vic:1,r:7}];
  const f3=d.xFair(G,0,1); ok(f3<f2,'hit three times: lower still ('+f3.toFixed(2)+')');
  const t=G.cfg.target||10;
  /* someone about to win is never spared: lower the target so player 1 is within 2 points */
  G.cfg.target=2; ok(d.xFair(G,0,1)===1,'about to win: full weight even after several hits'); G.cfg.target=t;
  /* early game: someone who has barely started is spared a little */
  G.robHist=[]; G.round=2; const e=d.xFair(G,0,1);
  ok(Math.abs(e-0.75)<1e-9,'early round, nearly no points: a little mercy ('+e.toFixed(2)+')');
  G.round=12; ok(d.xFair(G,0,1)===1,'later in the game the early mercy is gone');
  /* victim choice: given two equal victims, the one already hit is chosen last */
  G.robHist=[{by:0,vic:1,r:5},{by:0,vic:1,r:6}]; G.round=12;
  const pick=d.xVictim(G,[1,2],0);
  ok(pick===2,'with two equal victims it picks the one not hit lately (picked '+pick+')');
  console.log(failed?'FAILED: '+failed:'all good'); process.exit(failed?1:0);
})();
