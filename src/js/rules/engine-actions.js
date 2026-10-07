/* ---------- building ---------- */
function claimIsland(G,B,vid,pIdx){
  if(!G.cfg.seafarers) return;
  const hexes=B.verts[vid].hexes;
  for(const hid of hexes){
    const isl=B.islandOf[hid];
    if(isl===B.mainIsland) continue;
    const pl=G.players[pIdx];
    if(pl.islands.indexOf(isl)<0){ pl.islands.push(isl); logit(G,`${pl.name} התיישב על אי חדש (+2 נק׳)`); }
  }
}
function buildSettlement(G,B,vid){
  const p=P(G);
  if(!canSettle(G,B,vid,G.turn,false) || !canAfford(p,COST.settlement)) return false;
  pay(G,p,COST.settlement);
  G.buildings[vid]={t:'s',p:G.turn}; p.settLeft--;
  claimIsland(G,B,vid,G.turn);
  updateLongest(G,B); updateHarbour(G,B);
  logit(G,`${p.name} בנה יישוב`);
  return true;
}
function buildCity(G,B,vid){
  const p=P(G); const b=G.buildings[vid];
  const cost = (isCK(G)&&p.medicineOn) ? {ore:2,wheat:1} : COST.city;
  if(!b||b.p!==G.turn||b.t!=='s'||p.cityLeft<=0||!canAfford(p,cost)) return false;
  pay(G,p,cost);
  if(isCK(G)&&p.medicineOn) p.medicineOn=false;
  b.t='c'; p.cityLeft--; p.settLeft++; updateHarbour(G,B);
  logit(G,`${p.name} שדרג לעיר`);
  return true;
}
function buildRoad(G,B,eid,asShip,free){
  const p=P(G);
  const cost = asShip?COST.ship:COST.road;
  if(!canRoad(G,B,eid,G.turn,asShip)) return false;
  if(!free && !canAfford(p,cost)) return false;
  if(!free) pay(G,p,cost);
  G.roads[eid]={p:G.turn,ship:!!asShip,born:G.tc};
  if(asShip) p.shipsLeft--; else p.roadsLeft--;
  updateLongest(G,B);
  logit(G,`${p.name} בנה ${asShip?'ספינה':'דרך'}`);
  return true;
}
function buyDev(G){
  const p=P(G);
  if(!G.devDeck.length || !canAfford(p,COST.dev)) return null;
  pay(G,p,COST.dev);
  const c=G.devDeck.pop();
  p.dev.push(c);
  p.boughtTurn[p.dev.length-1]= (G.special&&G.special.on) ? G.round+0.5 : G.round;
  if(c==='vp') p.vpCards++;
  logit(G,`${p.name} קנה קלף פיתוח`);
  return c;
}

/* ---------- dev cards ---------- */
function playableDev(G,pIdx,i){
  const p=G.players[pIdx];
  if(p.dev[i]==='vp') return false;
  if(p.playedDevThisTurn) return false;
  if(p.boughtTurn[i]===G.round) return false;
  if(G.special && G.special.on && p.boughtTurn[i]===G.round+0.5) return false;
  return true;
}
function playDev(G,B,i){
  const p=P(G); const card=p.dev[i];
  if(!playableDev(G,G.turn,i)) return false;
  /* plenty/mono only choose a resource and touch nothing else first — cheap enough to let the
     player back all the way out before it's final, so keep everything needed to undo it */
  if(card==='plenty'||card==='mono') G.pendingDev={i,card,boughtTurn:Object.assign({},p.boughtTurn),wasPlayed:p.playedDevThisTurn};
  else G.pendingDev=null;
  p.dev.splice(i,1);
  const bt={}; Object.keys(p.boughtTurn).forEach(k=>{ const n=+k; bt[n>i?n-1:n]=p.boughtTurn[k]; });
  delete bt[p.dev.length]; p.boughtTurn=bt;
  p.playedDevThisTurn=true;
  if(card==='knight'){
    p.knights++; updateArmy(G);
    /* a knight played before the roll must come back to the roll */
    G.robberReturn = (G.sub==='roll') ? 'roll' : homeSub(G);
    G.sub='robber'; logit(G,`${p.name} שלח אביר`);
  } else if(card==='road'){
    G.freeRoads=2; G.sub='freeroad'; logit(G,`${p.name} בונה שתי דרכים`);
  } else if(card==='plenty'){
    G.sub='plenty';
  } else if(card==='mono'){
    G.sub='mono';
  }
  return card;
}
function cancelDevPick(G){
  const pd=G.pendingDev; if(!pd) return false;
  const p=P(G);
  p.dev.splice(pd.i,0,pd.card);
  p.boughtTurn=pd.boughtTurn; p.playedDevThisTurn=pd.wasPlayed;
  G.sub=homeSub(G); G.pendingDev=null;
  return true;
}
function doMonopoly(G,res){
  const p=P(G); let n=0;
  G.players.forEach(o=>{ if(o.idx===p.idx) return; n+=o.res[res]; p.res[res]+=o.res[res]; o.res[res]=0; });
  logit(G,`${p.name} הכריז מונופול ולקח ${n} ${RES_HE[res]} מכולם`);
  G.sub=homeSub(G); G.pendingDev=null;
}
function doPlenty(G,a,b){
  const p=P(G); give(G,p,a,1); give(G,p,b,1);
  logit(G,`${p.name} הפעיל שנת שפע ולקח ${RES_HE[a]} ו${RES_HE[b]}`);
  G.sub=homeSub(G); G.pendingDev=null;
}

/* ---------- longest road ---------- */
function updateLongest(G,B){
  G.players.forEach(p=>{ p.roadLen = longestFor(G,B,p.idx); });
  const cur = G.longest.p;
  let bestL=0; G.players.forEach(p=>{ if(p.roadLen>bestL) bestL=p.roadLen; });
  if(bestL<5){
    if(cur>=0) logit(G,'הדרך הארוכה התנתקה');
    G.longest={p:-1,len:bestL}; return;
  }
  if(cur>=0 && G.players[cur].roadLen>=bestL){ G.longest={p:cur,len:G.players[cur].roadLen}; return; }
  const winners=G.players.filter(p=>p.roadLen===bestL);
  if(winners.length===1){
    if(winners[0].idx!==cur) logit(G,`${winners[0].name} לקח את הדרך הארוכה (${bestL})`);
    G.longest={p:winners[0].idx,len:bestL};
  } else { G.longest={p:-1,len:bestL}; }
}
function longestFor(G,B,pIdx){
  const mine=[]; for(const eid in G.roads) if(G.roads[eid].p===pIdx) mine.push(eid);
  if(!mine.length) return 0;
  const adjE={};
  mine.forEach(eid=>{ B.edges[eid].v.forEach(v=>{ (adjE[v]=adjE[v]||[]).push(eid); }); });
  let best=0;
  const blocked = v => { const b=G.buildings[v];
    if(b && b.p!==pIdx) return true;
    if(isCK(G)){ const k=knightAt(G,v); if(k && k.p!==pIdx) return true; }
    return false; };
  function dfs(v,used,len,lastShip){
    if(len>best) best=len;
    if(blocked(v)) return;
    for(const eid of (adjE[v]||[])){
      if(used[eid]) continue;
      const isShip=!!G.roads[eid].ship;
      if(lastShip!==null && lastShip!==isShip){         /* changing between road and ship */
        const b=G.buildings[v]; if(!(b&&b.p===pIdx)) continue;
      }
      used[eid]=1;
      const e=B.edges[eid]; const nv = e.v[0]===v?e.v[1]:e.v[0];
      dfs(nv,used,len+1,isShip);
      used[eid]=0;
    }
  }
  const verts={}; mine.forEach(eid=>B.edges[eid].v.forEach(v=>verts[v]=1));
  Object.keys(verts).forEach(v=>dfs(v,{},0,null));
  return best;
}
function updateArmy(G){
  /* the holder keeps the army until someone else has MORE knights than they do — a tie never moves it,
     so the search starts from the current holder and not from seat 0 */
  const hold=G.army.p;
  let bp=-1,bn=2;
  if(hold>=0 && G.players[hold]){ bp=hold; bn=Math.max(2,G.players[hold].knights); }
  G.players.forEach(p=>{ if(p.knights>bn){bn=p.knights;bp=p.idx;} });
  if(bp>=0 && bp!==G.army.p){ G.army={p:bp,n:bn}; logit(G,`${G.players[bp].name} מחזיק בצבא הגדול (${bn})`); }
  else if(bp>=0) G.army={p:bp,n:bn};
}

/* ---------- scoring ---------- */
function vpPublic(G,pIdx){
  const p=G.players[pIdx]; let v=0;
  for(const vid in G.buildings){ const b=G.buildings[vid]; if(b.p===pIdx) v += b.t==='c'?2:1; }
  if(G.longest.p===pIdx) v+=2;
  if(!isCK(G) && G.army.p===pIdx) v+=2;
  v += (p.islands.length*2);
  if(isCK(G)) v += ckVP(G,pIdx);
  if(G.cfg.harbour && G.harbour && G.harbour.p===pIdx) v+=2;
  return v;
}
function vpTotal(G,pIdx){ return vpPublic(G,pIdx)+G.players[pIdx].vpCards; }
function checkWin(G){
  const v=vpTotal(G,G.turn);
  if(v>=(G.cfg.target||10)){ G.winner=G.turn; G.phase='over';
    logit(G,`🏆 ${P(G).name} ניצח עם ${v} נקודות!`); return true; }
  return false;
}

/* ---------- turn flow ---------- */
/* the phase a player returns to after finishing a card/robber/etc: a full turn for
   player 1, or the build-only turn for player 2 */
function homeSub(G){ return (G.special && G.special.on) ? 'special' : 'main'; }
/* player 2: the third seat after player 1 (roy -> shachar in a six-seat table) */
function partnerOf(G,idx){ return (idx+3)%G.players.length; }
function endTurn(G,B){
  const p=P(G);
  G.tc=(G.tc||0)+1;
  p.playedDevThisTurn=false; p.rolled=false;
  G.offer=null; G.freeRoads=0; G.turnDeeds=null;      /* a fresh "what they did" line next turn */
  if(isCK(G)){ p.actedKn={}; p.fleetRes=null; p.medicineOn=false; p.craneOn=false;
    G.movingKnight=null; G.freeKnight=null; G.smithLeft=0; }
  const n=G.players.length;
  if(G.cfg.special && n>=5){
    /* Paired players (5-6): player 1 rolls and plays a full turn; then player 2 -
       the third seat after player 1 - builds, plays cards and trades with the bank.
       Nobody else gets a turn extension. */
    if(!G.special.on){
      const partner=partnerOf(G,G.turn);
      G.special={on:true, starter:G.turn, idx:partner};
      G.turn=partner; G.sub='special'; return;
    }
    const next=(G.special.starter+1)%n;
    G.special={on:false,idx:0};
    G.turn=next; G.sub='roll';
    if(next===G.setupOrder[0]) G.round++;
    return;
  }
  const next=(G.turn+1)%n;
  G.turn=next;
  if(next===G.setupOrder[0]) G.round++;
  G.sub='roll';
}

/* ---------- what the table is waiting for, and from whom ---------- */
function currentNeed(G){
  if(G.phase==='over') return {kind:'over', who:G.winner};
  if(G.discardQueue.length){ const d=G.discardQueue[0]; return {kind:'discard', who:d.p, n:d.n}; }
  if(G.goldQueue.length){ const g=G.goldQueue[0]; return {kind:'gold', who:g.p, n:g.n}; }
  if(G.offer && G.offer.open) return {kind:'offer', who:G.turn};
  return {kind:G.sub, who:G.turn};
}

function resolveDiscard(G,pIdx,picks){
  const q=G.discardQueue[0]; if(!q||q.p!==pIdx) return false;
  const keys = isCK(G) ? RES.concat(COM) : RES;
  let total=0; keys.forEach(r=>total+=(picks[r]||0));
  if(total!==q.n) return false;
  const p=G.players[pIdx];
  for(const r of keys){ if((picks[r]||0)>heldOf(p,r)) return false; }
  keys.forEach(r=>{ const n=picks[r]||0; if(!n) return;
    if(COM.indexOf(r)>=0) p.com[r]-=n; else { p.res[r]-=n; G.bank[r]+=n; } });
  G.discardQueue.shift();
  logit(G,`${p.name} השליך ${q.n} קלפים`);
  return true;
}
function resolveGold(G,pIdx,picks){
  const q=G.goldQueue[0]; if(!q||q.p!==pIdx) return false;
  let total=0; RES.forEach(r=>total+=(picks[r]||0));
  if(total!==q.n) return false;
  const p=G.players[pIdx], got=[];
  RES.forEach(r=>{ const n=picks[r]||0; if(n){ const g=give(G,p,r,n); if(g) got.push(g+' '+RES_HE[r]); } });
  G.goldQueue.shift();
  if(got.length) logit(G,`${p.name} בחר מזהב: ${got.join(', ')}`);
  return true;
}

/* ---------- trading ---------- */
function bankTrade(G,B,giveRes,getRes){
  const p=P(G), rate=bankRate(G,B,G.turn,giveRes);
  const nm=k=>RES_HE[k]||COM_HE[k];
  if(heldOf(p,giveRes)<rate) return false;
  if(COM.indexOf(getRes)<0 && G.bank[getRes]<=0) return false;
  takeFrom(G,p,giveRes,rate);
  giveTo(G,p,getRes,1);
  logit(G,`${p.name} החליף ${rate} ${nm(giveRes)} ב${nm(getRes)}`);
  return true;
}
function makeOffer(G,giveObj,wantObj){
  const p=P(G);
  let a=0,b=0; RES.forEach(r=>{a+=giveObj[r]||0;b+=wantObj[r]||0;});
  if(!a||!b) return false;
  for(const r of RES) if((giveObj[r]||0)>p.res[r]) return false;
  G.offer={from:G.turn, give:giveObj, want:wantObj, open:true, replies:{}};
  logit(G,`${p.name} הציע חליפין`);
  return true;
}
function replyOffer(G,pIdx,accept){
  if(!G.offer||!G.offer.open||pIdx===G.offer.from) return false;
  G.offer.replies[pIdx]=accept?'yes':'no';
  return true;
}
function settleOffer(G,withIdx){
  const o=G.offer; if(!o||!o.open) return false;
  const a=G.players[o.from], b=G.players[withIdx];
  for(const r of RES){ if((o.give[r]||0)>a.res[r]) return false; if((o.want[r]||0)>b.res[r]) return false; }
  RES.forEach(r=>{
    const g=o.give[r]||0, w=o.want[r]||0;
    a.res[r]-=g; b.res[r]+=g;
    b.res[r]-=w; a.res[r]+=w;
  });
  logit(G,`${a.name} ו${b.name} סחרו`);
  G.offer=null;
  return true;
}

