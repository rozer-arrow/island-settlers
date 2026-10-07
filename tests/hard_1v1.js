/* Hard in 1v1: blocks hard only when the opponent really threatens (ahead or near winning), and plays a knight only for a reason.
   usage: node tests/hard_1v1.js */
const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
const from='\n})();\n</script>';
if(html.indexOf(from)<0){ console.error('FAIL: cannot find the end of the game script'); process.exit(2); }
html=html.replace(from,'\nwindow.__dbg={ST,sel,seats,hardOppThreat,hardKnightWorth,hardOneOnOne,robberScore,BOT_LEVELS,vpPublic};\n})();\n</script>');
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
  w.document.querySelector('#countSeg button[data-n="2"]').click();
  w.document.querySelector('#startLocal').click(); await sleep(5);
  const ig=w.document.querySelector('#introGo'); if(ig) ig.click();
  const G=d.ST.G, B=d.ST.B, hard=d.BOT_LEVELS.find(l=>l.id==='hard');
  ok(d.hardOneOnOne(G,hard),'1v1 + hard: the new rule applies');
  ok(!d.hardOneOnOne(G,d.BOT_LEVELS.find(l=>l.id==='expert')),'expert is not affected');
  /* the human is P1 vs the bot at seat 0 */
  const T=G.cfg.target||10;
  /* points are set with "islands" (2 points each) on an empty board, so every value is 0, 2, 4, 6 ... */
  const setVp=(i,v)=>{ G.players[i].islands=new Array(Math.round(v/2)).fill(0); };
  setVp(0,4); setVp(1,4);
  ok(!d.hardOppThreat(G,0),'tied: the opponent is not a threat');
  setVp(1,2); ok(!d.hardOppThreat(G,0),'opponent behind: not a threat');
  setVp(1,6); ok(d.hardOppThreat(G,0),'opponent ahead: a threat');
  G.cfg.target=8; setVp(0,8); setVp(1,6); ok(d.hardOppThreat(G,0),'opponent 2 from winning: a threat even if I lead'); G.cfg.target=T;
  setVp(0,4); setVp(1,2);
  /* knights: no reason, no knight */
  G.players[0].knights=0; G.army={p:-1,n:0};
  ok(!d.hardKnightWorth(G,0),'no threat, no army race: a knight is not worth playing');
  G.players[0].knights=2; ok(d.hardKnightWorth(G,0),'third knight would take the army: worth it');
  G.army={p:0,n:3}; G.players[0].knights=3; ok(!d.hardKnightWorth(G,0),'already holding the army: not worth it');
  setVp(1,8); ok(d.hardKnightWorth(G,0),'opponent ahead: worth it');
  console.log(failed?'FAILED: '+failed:'all good'); process.exit(failed?1:0);
})();
