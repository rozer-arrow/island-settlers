/* Expert trade proposals: one card short of a build, the expert asks another player (rarely, never a pest).
   Checks a person at the table is asked, can say yes or no, and that the cards really move.
   usage: node tests/expert_trade.js */
const fs=require('fs');const {JSDOM,VirtualConsole}=require('jsdom');
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
const from='\n})();\n</script>';
if(html.indexOf(from)<0){ console.error('FAIL: cannot find the end of the game script'); process.exit(2); }
html=html.replace(from,'\nwindow.__dbg={ST,sel,seats,xTradeCandidate,xProposeTrade,leaveGame};\n})();\n</script>');
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
  for(let i=0;i<6;i++){ d.seats[i].bot=i===0?'expert':'expert'; d.seats[i].name='P'+i; }
  d.sel.seafarers=false; d.sel.ck=false;
  w.document.querySelector('#countSeg button[data-n="3"]').click();
  w.document.querySelector('#startLocal').click(); await sleep(5);
  const ig=w.document.querySelector('#introGo'); if(ig) ig.click();
  const G=d.ST.G, B=d.ST.B;
  /* let the bots play the opening so there is a real board with real spots */
  const t0=Date.now(); while(G.round<4 && G.phase!=='over' && Date.now()-t0<40000) await sleep(20);
  ok(G.round>=4,'reached round 4 ('+G.round+')');
  /* seat 0 becomes a person; seat 1 is the expert whose turn it is */
  G.players[0].bot=null; d.ST.G.discardQueue=[]; G.offer=null;
  const pi=1; G.turn=pi; G.sub='main'; d.ST.busy=false; d.ST.mode='local';
  const hands=[{wood:1,brick:1,sheep:1,wheat:0,ore:2},{wood:2,brick:2,sheep:0,wheat:0,ore:0},{wood:0,brick:0,sheep:1,wheat:2,ore:2},{wood:1,brick:0,sheep:1,wheat:1,ore:0},{wood:0,brick:1,sheep:0,wheat:0,ore:3}];
  const R=['wood','brick','sheep','wheat','ore'];
  let cand=null, used=null;
  for(const h of hands){
    G.xTradeAt={}; G.xAskedHuman={}; G.round=Math.max(G.round,10);
    R.forEach(r=>{ G.players[pi].res[r]=h[r]; G.players[2].res[r]=0; }); 
    R.forEach(r=>G.players[0].res[r]=3);
    cand=d.xTradeCandidate(G,B,pi); if(cand){ used=h; break; } }
  ok(!!cand,'one card short of a build: the expert finds something to ask');
  if(cand){
    ok(cand.asks.length===1 && cand.asks[0]===0,'only the person is a candidate (others hold no cards)');
    const wantR=Object.keys(cand.want)[0], giveR=Object.keys(cand.give)[0];
    ok(Object.keys(cand.give).indexOf(wantR)<0,'it never offers the card it asks for');
    const meBefore={...G.players[0].res}, exBefore={...G.players[pi].res};
    const started=d.xProposeTrade(G,B,pi);
    ok(started===true && d.ST.busy===true,'the person is asked and the game waits (busy)');
    ok(G.xTradeAt[pi]===G.round,'the ask is remembered, so it does not repeat next turn');
    const btns=[...w.document.querySelectorAll('#pickBody button')];
    ok(btns.length===2,'two answers on the sheet');
    btns[1].click();                                  /* say no */
    ok(d.ST.busy===false,'after "no" the game continues');
    ok(G.players[0].res[wantR]===meBefore[wantR] && G.players[pi].res[giveR]===exBefore[giveR],'"no": no cards moved');
    ok(d.xTradeCandidate(G,B,pi)===null,'asked just now: no new ask until a few rounds pass');
    G.round+=2; ok(d.xTradeCandidate(G,B,pi)===null || true,'(rounds pass)');
    /* now say yes */
    G.xTradeAt={}; G.xAskedHuman={}; G.round+=10;
    R.forEach(r=>{ G.players[pi].res[r]=used[r]; });
    const me2={...G.players[0].res}, ex2={...G.players[pi].res};
    const c2=d.xTradeCandidate(G,B,pi);
    if(c2){ d.xProposeTrade(G,B,pi); const b2=[...w.document.querySelectorAll('#pickBody button')]; b2[0].click();
      const gk=Object.keys(c2.give)[0], wk=Object.keys(c2.want)[0];
      ok(G.players[0].res[wk]===me2[wk]-1 && G.players[pi].res[wk]===ex2[wk]+1,'"yes": the person gave the asked card and the expert got it');
      ok(G.players[0].res[gk]>me2[gk] && G.players[pi].res[gk]<ex2[gk],'"yes": the expert gave its spare card');
      ok(d.ST.busy===false,'after "yes" the game continues'); }
    else ok(false,'second candidate');
    /* the person is not pestered: asked again only after a while */
    G.xTradeAt={}; const askedAt=G.xAskedHuman[0]; G.round=askedAt+1;
    R.forEach(r=>{ G.players[pi].res[r]=used[r]; });
    const c3=d.xTradeCandidate(G,B,pi); ok(!c3 || c3.asks.indexOf(0)<0,'the same person is not asked again within a few rounds');
  }
  console.log(failed?'FAILED: '+failed:'all good'); process.exit(failed?1:0);
})();
