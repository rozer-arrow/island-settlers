/* Seafarers: the computer uses the pirate and moves its ships.
   usage: node tests/seafarers_bot.js [games]
   Part 1 (full games): computer-only Seafarers games; counts how often ships and the pirate moved.
   Part 2 (controlled): pirate decisions on a made-up position. */
const fs=require('fs');const {JSDOM}=require('jsdom');
const GAMES=+process.argv[2]||8;
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
function inject(from,to){ if(html.indexOf(from)<0){ console.error('FAIL: cannot find in game: '+from); process.exit(2); } html=html.replace(from,to); }
inject('\n})();\n</script>','\nwindow.__dbg={ST,sel,seats,BOT_LEVELS,vpTotal,botTryPirate,botMoveShip,seaPirateScore,shipSpotValue,movableShips,hexEdgeIds,pirateTargets,shipDestinations,legalRoadSpots,legalSettleSpots};\n})();\n</script>');
inject('function movePirate(G,B,hid,victim,key){','function movePirate(G,B,hid,victim,key){ window.__pirateMoves=(window.__pirateMoves||0)+1;');
inject('  logit(G,`${p.name} הזיז ספינה`);','  window.__shipMoves=(window.__shipMoves||0)+1; logit(G,`${p.name} הזיז ספינה`);');

function stubCtx(){ const g={addColorStop(){}};
  return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g;
    if(k==='measureText')return ()=>({width:10}); if(k==='getImageData')return ()=>({data:new Uint8ClampedArray(4)});
    if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',pretendToBeVisual:false,beforeParse(w){
  w.__noRollUI=true;
  const st=w.setTimeout.bind(w);
  w.setTimeout=(fn,ms,...a)=>st(fn,Math.min(ms||0,1),...a);
  w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()+1e7),8); w.cancelAnimationFrame=()=>{};
  w.claude={use:async()=>null}; w.AudioContext=undefined; w.webkitAudioContext=undefined;
  w.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
  w.onerror=(m,s,l,c,e)=>errs.push(String(e&&e.stack||m).slice(0,300));
  w.console.error=(...a)=>errs.push(a.map(String).join(' ').slice(0,300));
}});
const w=dom.window, sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=0; const ok=(c,msg)=>{ console.log((c?'  ✓ ':'  ✗ ')+msg); if(!c) failed++; };

async function startGame(levels){
  const d=w.__dbg;
  for(let i=0;i<6;i++){ d.seats[i].bot=levels[i%levels.length]; d.seats[i].name='P'+i; }
  d.sel.seafarers=true; d.sel.ck=false; d.sel.target=10;
  w.document.querySelector('#countSeg button[data-n="4"]').click();
  w.document.querySelector('#startLocal').click(); await sleep(5);
  const ig=w.document.querySelector('#introGo'); if(ig) ig.click();
}
(async()=>{
  await sleep(400); const d=w.__dbg;

  /* ---------- Part 1: full computer games ---------- */
  console.log('Part 1 — '+GAMES+' computer-only Seafarers games');
  w.__pirateMoves=0; w.__shipMoves=0;
  let stalled=0, finished=0;
  const levelSets=[['expert','hard','normal','hard'],['hard','hard','expert','normal'],['normal','expert','hard','expert']];
  for(let g=0;g<GAMES;g++){
    const wb0=w.document.querySelector('#winBack'); if(wb0) wb0.click(); else d.ST.G=null;
    await sleep(5);
    await startGame(levelSets[g%levelSets.length]);
    const G2=d.ST.G, t0=Date.now();
    while(G2.phase!=='over' && Date.now()-t0<25000 && G2.round<120) await sleep(20);
    if(G2.phase==='over') finished++; else stalled++;
    if(process.env.DEBUG){ const ships=Object.values(G2.roads).filter(r=>r.ship).length; const sevens=(G2.log||[]).filter(l=>/שודד|7/.test(l.t)).length; console.log('   game '+g+': rounds '+G2.round+', ships on board '+ships+', robber/7 log lines '+sevens+', pirate '+G2.pirate+', moves so far ship '+w.__shipMoves+' pirate '+w.__pirateMoves); }
  }
  console.log('  games finished: '+finished+'/'+GAMES+'   ship moves: '+w.__shipMoves+'   pirate moves: '+w.__pirateMoves);
  ok(stalled===0,'every game reached a winner (none stalled)');
  /* ships and the pirate come up only now and then in a real game (the computer builds about 3 ships),
     so the counts are shown for information; the controlled part checks the behaviour itself */
  /* ---------- Part 2: a made-up position ---------- */
  console.log('Part 2 — pirate decisions on a made-up position');
  { const wb=w.document.querySelector('#winBack'); if(wb) wb.click(); await sleep(5); }
  await startGame(['hard']);
  const G=d.ST.G, B=d.ST.B;
  G.round=0; G.phase='play';
  ok(!!G.cfg.seafarers && !!G.pirate && B.sea.length>0,'a Seafarers board with a pirate and sea hexes');
  /* freeze the game: nobody acts while we set the table */
  const stop=G.players.map(p=>p.bot); G.players.forEach(p=>{ p.bot=null; });
  G.turn=0; G.sub='robber'; G.robberReturn='main'; G.roads={}; G.buildings=G.buildings||{};
  G.players.forEach((p,i)=>{ p.res={wood:2,brick:2,sheep:2,wheat:2,ore:2}; });
  const lvl=d.BOT_LEVELS[2];
  const quiet=B.sea.find(h=>d.hexEdgeIds(B,h.id).length===6 && h.id!==G.pirate);
  /* three ships of player 1 around one sea hex */
  const target=B.sea.find(h=>h.id!==G.pirate && d.hexEdgeIds(B,h.id).length===6 && h.id!==quiet.id);
  d.hexEdgeIds(B,target.id).slice(0,3).forEach(eid=>{ G.roads[eid]={p:1,ship:true,born:-1}; });
  const before=G.pirate, robberBefore=G.robber;
  ok(d.seaPirateScore(G,B,target.id,0,lvl,false)>0,'the hex with three enemy ships scores above zero for the pirate');
  ok(!(d.seaPirateScore(G,B,quiet.id,0,lvl,false)>0),'an empty sea hex scores zero or less');
  const cardsBefore=G.players[0].res.wood+G.players[0].res.brick+G.players[0].res.sheep+G.players[0].res.wheat+G.players[0].res.ore;
  ok(d.botTryPirate(G,B,0,lvl,1e9,false)===false && G.pirate===before,'when the robber is far better, the pirate stays put');
  const moved=d.botTryPirate(G,B,0,lvl,-1,false);
  ok(moved===true,'when the pirate is better, the computer parks it');
  ok(G.pirate!==before && d.hexEdgeIds(B,G.pirate).some(e=>G.roads[e]&&G.roads[e].p===1),'the pirate landed next to the opponent\'s ships');
  ok(G.robber===robberBefore,'the land robber did not move');
  const cardsAfter=['wood','brick','sheep','wheat','ore'].reduce((s,r)=>s+G.players[0].res[r],0);
  ok(cardsAfter===cardsBefore+1,'the computer stole one card from the owner of those ships');
  ok(G.sub==='main','the turn went back to the main phase');
  /* the expert too */
  G.sub='robber'; G.robberReturn='main'; G.turn=0; G.pirate=before;
  ok(d.botTryPirate(G,B,0,d.BOT_LEVELS[3],-1,true)===true,'the expert also uses the pirate when it hurts the opponent');
  /* with no enemy ships anywhere, never */
  G.roads={}; G.sub='robber'; G.robberReturn='main'; G.turn=0;
  ok(d.botTryPirate(G,B,0,lvl,-1e9,false)===false,'no enemy ships on the sea: the pirate is left alone');
  /* ---- moving a ship: one settlement on the coast, one ship at its poorest spot ---- */
  G.roads={}; G.buildings={}; G.pirate=null; G.tc=5; G.shipMoved=-1; G.turn=0;
  /* look over the coast for a settlement whose ship has a clearly better spot to go to */
  let home=null, ships=[], best=null;
  for(const v of d.legalSettleSpots(G,B,0,true)){
    G.buildings[v]={p:0,t:'s'}; ships=d.legalRoadSpots(G,B,0,true);
    let bestHere=null;
    for(const from of ships){
      G.roads[from]={p:0,ship:true,born:-1};
      const here=d.shipSpotValue(G,B,from,0,lvl);
      for(const to of d.shipDestinations(G,B,from,0)){ const gain=d.shipSpotValue(G,B,to,0,lvl)-here; if(!bestHere||gain>bestHere.gain) bestHere={from,to,gain}; }
      delete G.roads[from];
    }
    if(bestHere && bestHere.gain>1.5){ home=v; best=bestHere; break; }
    delete G.buildings[v];
  }
  ok(!!home,'found a coastal settlement whose ship has a clearly better spot');
  if(!best){ console.log('FAILED: no suitable position on this board'); process.exit(1); }
  ok(best.gain>1.5,'the better spot is clearly better (gain '+best.gain.toFixed(1)+')');
  G.roads[best.from]={p:0,ship:true,born:-1};
  ok(d.movableShips(G,B,0).indexOf(best.from)>=0,'that ship is open and free to move');
  ok(d.botMoveShip(G,B,0,d.BOT_LEVELS[0])===false && !!G.roads[best.from],'the beginner level leaves its ships alone');
  const shipsBefore=Object.values(G.roads).filter(r=>r.ship&&r.p===0).length;
  ok(d.botMoveShip(G,B,0,lvl)===true,'the normal/hard computer moves the ship');
  ok(!G.roads[best.from] && !!G.roads[best.to] && G.roads[best.to].ship && G.roads[best.to].p===0,'the ship went from the poor spot to the better spot');
  ok(Object.values(G.roads).filter(r=>r.ship&&r.p===0).length===shipsBefore,'no ship was lost or created by moving');
  ok(G.shipMoved===G.tc && d.botMoveShip(G,B,0,lvl)===false,'only one ship move per turn');
  G.players.forEach((p,i)=>{ p.bot=stop[i]; });
  const dbgBefore=errs.length;
  if(process.env.DEBUG) console.log('errors after part 1:',errs.length, errs.join(' ## '));

  if(process.env.DEBUG) console.log('ALL ERRORS:\n'+[...new Set(errs)].join('\n---\n'));
  const gameErrs=[...new Set(errs)].slice(0,3);
  ok(gameErrs.length===0,'no errors'+(gameErrs.length?': '+gameErrs.join(' | '):''));
  console.log(failed?'FAILED: '+failed:'all good');
  process.exit(failed?1:0);
})();
