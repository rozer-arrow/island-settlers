/* follow one 2-player game and print the expert's state every few rounds */
const fs=require('fs');const {JSDOM}=require('jsdom');
let html=fs.readFileSync(require('path').join(__dirname,'..','island.html'),'utf8');
html=html.replace('\n})();\n</script>','\nwindow.__dbg={ST,sel,seats,vpTotal,xGoal,legalSettleSpots,xRoadPlan,totalCards};\n})();\n</script>');
function stubCtx(){ const g={addColorStop(){}}; return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g; if(k==='measureText')return ()=>({width:10}); if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',beforeParse(w){ w.__noRollUI=true; const st=w.setTimeout.bind(w);
  w.setTimeout=(fn,ms,...a)=>st(fn,Math.min(ms||0,1),...a); w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()+1e7),8); w.cancelAnimationFrame=()=>{};
  w.claude={use:async()=>null}; w.HTMLCanvasElement.prototype.getContext=()=>stubCtx(); }});
const w=dom.window, sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{ await sleep(400); const d=w.__dbg;
  for(let i=0;i<6;i++){ d.seats[i].bot=i===0?'expert':'hard'; d.seats[i].name='P'+i; }
  d.sel.target=10; w.document.querySelector('#countSeg button[data-n="2"]').click(); w.document.querySelector('#startLocal').click(); await sleep(5);
  const ig=w.document.querySelector('#introGo'); if(ig) ig.click();
  const G=d.ST.G, me=G.players.findIndex(p=>p.name==='P0'), op=1-me; let lastR=0; const t0=Date.now();
  while(G.phase!=='over' && Date.now()-t0<30000){ await sleep(10);
    if(G.round!==lastR && G.round%4===0){ lastR=G.round; const p=G.players[me], B=d.ST.B;
      const g=d.xGoal(G,B,me)[0]; const plan=d.xRoadPlan(G,B,me,3);
      console.log(`r${G.round} VP ${d.vpTotal(G,me)}-${d.vpTotal(G,op)} hand=${JSON.stringify(p.res)} left s${p.settLeft} c${p.cityLeft} r${p.roadsLeft} spots=${d.legalSettleSpots(G,B,me,false).length} plan=${plan?plan.d+'@'+plan.v:'none'} goal=${g&&g.kind}/${g&&g.missing} dev=${p.dev.length}`); } }
  console.log('winner', G.winner===me?'EXPERT':'hard', 'round', G.round); process.exit(0); })();
