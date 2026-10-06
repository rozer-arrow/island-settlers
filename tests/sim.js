/* Headless bot-vs-bot tournament.
   usage: node sim.js <games> <levelSeat0> <levelOthers> [players] [target]
   Seat 0 plays <levelSeat0>; everyone else plays <levelOthers>. The opening roll-off
   shuffles the actual turn order, so no seat has a first-move advantage. */
const fs=require('fs');const {JSDOM}=require('jsdom');
const N=+process.argv[2]||20, L0=process.argv[3]||'hard', LO=process.argv[4]||'hard';
const NP=+process.argv[5]||4, TARGET=+process.argv[6]||10;
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
html=html.replace('\n})();\n</script>','\nwindow.__dbg={ST,sel,seats,BOT_LEVELS,vpTotal,vpPublic,xProd};\n})();\n</script>');
function stubCtx(){ const g={addColorStop(){}};
  return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g;
    if(k==='measureText')return ()=>({width:10}); if(k==='getImageData')return ()=>({data:new Uint8ClampedArray(4)});
    if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',pretendToBeVisual:false,beforeParse(w){
  w.__noRollUI=true;
  const st=w.setTimeout.bind(w);
  w.setTimeout=(fn,ms,...a)=>st(fn,Math.min(ms||0,1),...a);        /* no waiting on animations or bot "thinking" */
  w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()+1e7),8); w.cancelAnimationFrame=()=>{};
  w.claude={use:async()=>null}; w.AudioContext=undefined; w.webkitAudioContext=undefined;
  w.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
  w.onerror=(m,s,l,c,e)=>errs.push(String(e&&e.stack||m).slice(0,300));
  w.console.error=(...a)=>errs.push(a.map(String).join(' ').slice(0,300));
}});
const w=dom.window, sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await sleep(400); const d=w.__dbg;
  const res={games:0,wins0:0,winsOther:0,stalled:0,rounds:[],vp0:[],vpBestOther:[]};
  for(let g=0;g<N;g++){
    for(let i=0;i<6;i++){ d.seats[i].bot = i===0?L0:LO; d.seats[i].name='P'+i; }
    d.sel.seafarers=!!process.env.SEA; d.sel.ck=!!process.env.CK; d.sel.gold=!!process.env.GOLD; d.sel.friendly=!!process.env.FRIENDLY; d.sel.target=TARGET;
    w.document.querySelector(`#countSeg button[data-n="${NP}"]`).click();
    w.document.querySelector('#startLocal').click(); await sleep(5);
    const ig=w.document.querySelector('#introGo'); if(ig) ig.click();
    const G=d.ST.G, t0=Date.now();
    while(G.phase!=='over' && Date.now()-t0<25000 && G.round<120) await sleep(20);
    res.games++;
    const me=G.players.findIndex(p=>p.name==='P0');
    if(G.phase!=='over'){ res.stalled++; }
    else if(G.winner===me) res.wins0++; else res.winsOther++;
    res.rounds.push(G.round);
    const P=G.players[me], B=d.ST.B;
    const bl=Object.values(G.buildings).filter(b=>b.p===me);
    const pr=d.xProd?d.xProd(G,B,me):{};
    const stat={win:G.winner===me, sett:bl.filter(b=>b.t==='s').length, city:bl.filter(b=>b.t==='c').length,
      roads:Object.values(G.roads).filter(r=>r.p===me).length, devHeld:P.dev.length, knights:P.knights, vpCards:P.vpCards,
      army:G.army.p===me, longest:G.longest.p===me,
      discards:G.log.filter(l=>l.t.indexOf('P0 ')===0 && /השליך/.test(l.t)).length,
      trades:G.log.filter(l=>l.t.indexOf('P0 ')===0 && /החליף/.test(l.t)).length,
      pips:Object.values(pr).reduce((a,b)=>a+b,0)};
    (res.stats=res.stats||[]).push(stat);
    res.vp0.push(d.vpTotal(G,me));
    res.vpBestOther.push(Math.max(...G.players.map((p,i)=>i===me?0:d.vpTotal(G,i))));
    const wb=w.document.querySelector('#winBack'); if(wb) wb.click(); else { d.ST.G=null; }
    await sleep(5);
  }
  const avg=a=>(a.reduce((x,y)=>x+y,0)/Math.max(1,a.length)).toFixed(1);
  const fair=(100/NP).toFixed(0);
  console.log(JSON.stringify({seat0:L0,others:LO,players:NP,games:res.games,win0:res.wins0,
    win0pct:(100*res.wins0/Math.max(1,res.games-res.stalled)).toFixed(0)+'%',fairShare:fair+'%',
    stalled:res.stalled,avgRounds:avg(res.rounds),avgVP0:avg(res.vp0),avgBestOther:avg(res.vpBestOther),
    errors:[...new Set(errs)].slice(0,3)}));
  const S=res.stats||[]; const m=k=>(S.reduce((a,s)=>a+(+s[k]),0)/Math.max(1,S.length)).toFixed(2);
  console.log('P0 avg:',['sett','city','roads','devHeld','knights','vpCards','army','longest','discards','trades','pips'].map(k=>k+'='+m(k)).join(' '));
  process.exit(0);
})();
