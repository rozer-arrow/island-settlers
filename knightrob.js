/* reproduce: the robber already sits on the human's best hex and the expert holds a knight */
const fs=require('fs');const {JSDOM}=require('jsdom');
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
html=html.replace('\n})();\n</script>','\nwindow.__dbg={ST,sel,seats,currentNeed,onAction,tapPlace,xKnightNow,xBestRobberHex,botAct,vpPublic};\n})();\n</script>');
function stubCtx(){ const g={addColorStop(){}}; return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g; if(k==='measureText')return ()=>({width:10}); if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',beforeParse(w){ w.__noRollUI=true; const st=w.setTimeout.bind(w);
  w.setTimeout=(fn,ms,...a)=>st(fn,Math.min(ms||0,1),...a); w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()+1e7),8); w.cancelAnimationFrame=()=>{};
  w.claude={use:async()=>null}; w.HTMLCanvasElement.prototype.getContext=()=>stubCtx(); w.onerror=(m,s,l,c,e)=>errs.push(String(e&&e.stack||m).slice(0,200)); }});
const w=dom.window, $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)], sleep=ms=>new Promise(r=>setTimeout(r,ms));
/* how many of player k's production pips sit on a hex */
function pipsOn(d,G,B,hid,k){ const h=B.hexById[hid]; if(!h||!h.num) return 0; const c={x:h.x,y:h.y}; let s=0;
  for(const b of Object.entries(G.buildings)){ if(b[1].p!==k) continue; if(B.verts[b[0]].hexes.indexOf(hid)>=0) s+=(6-Math.abs(7-h.num))*(b[1].t==='c'?2:1); } return s; }
(async()=>{ await sleep(400); const d=w.__dbg;
  let runs=0, offHuman=0, freed=0, keptOnMe=0, playedFromEmpty=0, emptyRuns=0, landedOnHuman=0;
  for(let g=0; g<15; g++){
    for(let i=0;i<6;i++){ d.seats[i].bot = i===1?'expert':null; d.seats[i].name='P'+i; }
    d.sel.friendly=false; d.sel.target=10;
    $$('#countSeg button').find(b=>b.dataset.n==='2').click(); await sleep(3);
    d.seats[0].bot=null; d.seats[1].bot='expert';
    $('#startLocal').click(); await sleep(3); const ig=$('#introGo'); if(ig) ig.click();
    const G=d.ST.G, B=d.ST.B; let guard=0;
    while(G.phase!=='play' && guard++<400){ const nd=d.currentNeed(G);
      if(!G.players[nd.who].bot && d.ST.place && d.ST.place.legal.length){ d.tapPlace(d.ST.place.legal[0]); d.onAction('confirmplace'); }
      await sleep(3); }
    const human=G.players.findIndex(p=>!p.bot), bot=1-human;
    /* A) robber already on the human's best hex (no expert buildings there) */
    const cands=B.hexes.filter(h=>h.num && pipsOn(d,G,B,h.id,human)>0 && pipsOn(d,G,B,h.id,bot)===0)
                       .sort((a,b)=>pipsOn(d,G,B,b.id,human)-pipsOn(d,G,B,a.id,human));
    if(cands.length){
      runs++;
      G.robber=cands[0].id; G.turn=bot; G.sub='roll'; G.players[bot].dev=['knight']; G.players[bot].boughtTurn={}; G.players[bot].playedDevThisTurn=false;
      const before=pipsOn(d,G,B,G.robber,human);
      const k=d.xKnightNow(G,B,bot,true);
      if(k>=0){ const nh=d.xBestRobberHex(G,B,bot); const after=pipsOn(d,G,B,nh,human); if(after===0) offHuman++; else if(after<before*0.6) freed++; }
      else keptOnMe++;
    }
    /* B) robber on the desert: a knight should go straight onto the human */
    const desert=B.hexes.find(h=>!h.num);
    if(desert){ emptyRuns++;
      G.robber=desert.id; G.players[bot].dev=['knight']; G.players[bot].boughtTurn={}; G.players[bot].playedDevThisTurn=false;
      const k=d.xKnightNow(G,B,bot,true);
      if(k>=0){ playedFromEmpty++; const nh=d.xBestRobberHex(G,B,bot); if(pipsOn(d,G,B,nh,human)>0) landedOnHuman++; } }
    d.ST.G=null; w.document.querySelector('#game').classList.add('hidden'); w.document.querySelector('#home').classList.remove('hidden');
    await sleep(3);
  }
  console.log(`A) robber already blocking the human (${runs} boards): moved OFF the human entirely: ${offHuman} · moved to a much weaker spot on the human: ${freed} · kept the knight: ${keptOnMe}`);
  console.log(`B) robber on the desert (${emptyRuns} boards): knight played ${playedFromEmpty}, robber landed on the human ${landedOnHuman}`);
  console.log('errors:',errs.length?errs.slice(0,3):'none'); process.exit(0); })();
