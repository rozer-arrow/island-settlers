/* =========================================================
   3. GAME ENGINE
   ========================================================= */
const BANK_START = 19;

function newGame(cfg, playerDefs, seed){
  const G = {
    cfg, seed,
    players: playerDefs.map((p,i)=>({
      idx:i, uid:p.uid||null, name:p.name, color:p.color, bot:p.bot||null, g:p.g||null,
      res:{wood:0,brick:0,sheep:0,wheat:0,ore:0},
      dev:[], boughtTurn:{}, knights:0, vpCards:0,
      roadsLeft:15, shipsLeft:15, settLeft:5, cityLeft:4,
      islands:[], playedDevThisTurn:false
    })),
    buildings:{}, roads:{},
    turn:0, round:0, phase:'setup1', sub:'setupS',
    dice:[0,0], lastRoll:null, robber:null,
    bank:{wood:BANK_START,brick:BANK_START,sheep:BANK_START,wheat:BANK_START,ore:BANK_START},
    devDeck:[], longest:{p:-1,len:0}, army:{p:-1,n:0},
    discardQueue:[], goldQueue:[], freeRoads:0, robberReturn:null, pendingSteal:null,
    setupOrder:[], setupPos:0, lastBuiltVertex:null, pendingDev:null, turnDeeds:null,
    offer:null, log:[], winner:-1, harbour:{p:-1,n:0},
    special:{on:false, idx:0},
    pirate:null, tc:0, shipMoved:-1, stealPirate:false
  };
  const board = buildBoard(cfg, seed);
  G.robber = board.robber;
  G.pirate = board.pirate || null;
  if(cfg.ck) ckInit(G);

  /* dev deck scales with board size (Cities & Knights replaces it) */
  if(cfg.ck){ G.turn=G.setupOrder?0:0; }
  const scale = cfg.players>=5 ? 34/25 : 1;
  const deck=[];
  const mk=(t,n)=>{for(let i=0;i<Math.round(n*scale);i++) deck.push(t);};
  mk('knight',14); mk('vp',5); mk('road',2); mk('plenty',2); mk('mono',2);
  G.devDeck = cfg.ck ? [] : shuffleTrue(deck);

  /* snake order for the two setup rounds */
  const n=G.players.length, fwd=[], bwd=[];
  for(let i=0;i<n;i++){fwd.push(i);bwd.push(n-1-i);}
  G.setupOrder = fwd.concat(bwd);
  G.turn = G.setupOrder[0];
  return {G, board};
}

/* ---------- helpers ---------- */
const P = G => G.players[G.turn];
function totalCards(p){ return RES.reduce((s,r)=>s+p.res[r],0); }
function canAfford(p,cost){ return Object.keys(cost).every(k=>p.res[k]>=cost[k]); }
function pay(G,p,cost){ Object.keys(cost).forEach(k=>{p.res[k]-=cost[k]; G.bank[k]+=cost[k];}); }
function give(G,p,r,n){ n=Math.min(n,G.bank[r]); if(n<=0) return 0; p.res[r]+=n; G.bank[r]-=n; return n; }
/* masculine or feminine form of a word, by the player's gender */
function gv(p,m,f){ return (p&&p.g==='f')?f:m; }
function logit(G,txt){ G.log.push({t:txt, turn:G.round}); if(G.log.length>80) G.log.shift(); }

/* the running "what X has done this turn" line — it grows as the turn goes on, so the table
   sees "Roy built a road", then "Roy built a road and a settlement", and so on */
const DEED_HE={road:'דרך',ship:'ספינה',sett:'יישוב',city:'עיר',dev:'קלף פיתוח'};
const DEED_PL={road:'דרכים',ship:'ספינות',sett:'יישובים',city:'ערים',dev:'קלפי פיתוח'};
function noteDeed(G,kind){
  if(!G.turnDeeds || G.turnDeeds.p!==G.turn) G.turnDeeds={p:G.turn,list:[]};
  G.turnDeeds.list.push(kind);
  return deedSentence(G);
}
const DEED_EN={road:'a road',ship:'a ship',sett:'a settlement',city:'a city',dev:'a development card'};
const DEED_EN_PL={road:'roads',ship:'ships',sett:'settlements',city:'cities',dev:'development cards'};
function deedSentence(G){
  const d=G.turnDeeds; if(!d||!d.list.length) return '';
  const p=G.players[d.p]; if(!p) return '';
  /* built as a whole sentence per language — stitching translated fragments together
     produces the wrong word order and plurals */
  const en = (typeof LANG!=='undefined' && LANG==='en');
  const tally=arr=>{ const m={},order=[];
    arr.forEach(k=>{ if(!m[k]) order.push(k); m[k]=(m[k]||0)+1; });
    return order.map(k=>m[k]>1?(m[k]+' '+(en?DEED_EN_PL[k]:DEED_PL[k])):(en?DEED_EN[k]:DEED_HE[k])); };
  const join=a=>a.length<2?a.join('')
    : a.slice(0,-1).join(', ')+(en?' and ':' ו')+a[a.length-1];
  const built=d.list.filter(k=>k!=='dev'), bought=d.list.filter(k=>k==='dev');
  const parts=[];
  if(en){
    if(built.length) parts.push('built '+join(tally(built)));
    if(bought.length) parts.push('bought '+join(tally(bought)));
  } else {
    const fem = p.g==='f';
    if(built.length) parts.push((fem?'בנתה ':'בנה ')+join(tally(built)));
    if(bought.length) parts.push((fem?'קנתה ':'קנה ')+join(tally(bought)));
  }
  return p.name+' '+join(parts);
}

function playerPorts(G,B,pIdx){
  const set={};
  for(const vid in G.buildings){ if(G.buildings[vid].p===pIdx){ const pt=B.verts[vid].port; if(pt) set[pt]=1; } }
  return set;
}
function baseRate(G,B,pIdx,res){
  const ports=playerPorts(G,B,pIdx);
  if(ports[res]) return 2;
  if(ports['any']) return 3;
  return 4;
}
function bankRate(G,B,pIdx,res){
  return isCK(G) ? ckBankRate(G,B,pIdx,res) : baseRate(G,B,pIdx,res);
}
const heldOf = (p,k) => (COM.indexOf(k)>=0 ? p.com[k] : p.res[k]);
function takeFrom(G,p,k,n){ if(COM.indexOf(k)>=0) p.com[k]-=n; else { p.res[k]-=n; G.bank[k]+=n; } }
function giveTo(G,p,k,n){ if(COM.indexOf(k)>=0){ p.com[k]+=n; return n; } return give(G,p,k,n); }

/* ---------- placement legality ---------- */
function vertexFree(G,B,vid){
  if(G.buildings[vid]) return false;
  if(isCK(G) && knightAt(G,vid)) return false;
  for(const a of B.verts[vid].adj) if(G.buildings[a]) return false;
  return true;
}
function vertexTouchesLand(B,vid){ return B.verts[vid].hexes.length>0; }

function canSettle(G,B,vid,pIdx,setup){
  if(!B.verts[vid] || B.verts[vid].hexes.length===0) return false;  /* open water */
  if(!vertexFree(G,B,vid)) return false;
  if(G.players[pIdx].settLeft<=0) return false;
  if(setup) return true;
  /* must touch one of your own roads/ships */
  for(const a of B.verts[vid].adj){
    const ek = edgeKey(vid,a);
    const rd = G.roads[ek];
    if(rd && rd.p===pIdx) return true;
  }
  return false;
}
function edgeKey(a,b){ return a<b ? a+'|'+b : b+'|'+a; }

/* land hexes touching an edge: 2 = inland, 1 = shoreline, 0 = open water */
const edgeLand = (B,eid) => (B.edges[eid] ? B.edges[eid].hexes.length : -1);

function canRoad(G,B,eid,pIdx,asShip){
  if(G.roads[eid]) return false;
  const e=B.edges[eid]; if(!e) return false;
  if(asShip){
    if(!G.cfg.seafarers) return false;
    if(edgeLand(B,eid)>1) return false;              /* ships need water */
    if(G.players[pIdx].shipsLeft<=0) return false;
    if(pirateBlocksEdge(G,B,eid)) return false;      /* the pirate's hex is closed to new ships */
  } else {
    if(edgeLand(B,eid)<1) return false;              /* roads need land */
    if(G.players[pIdx].roadsLeft<=0) return false;
  }
  /* connectivity: a building of yours, or one of your roads, at either end
     (an opponent's building blocks pass-through) */
  for(const vid of e.v){
    const b=G.buildings[vid];
    if(b){ if(b.p===pIdx) return true; else continue; }
    for(const a of B.verts[vid].adj){
      const k=edgeKey(vid,a); const rd=G.roads[k];
      /* a road extends a road, a ship extends a ship; they only meet at a settlement or city */
      if(rd && rd.p===pIdx && !!rd.ship===!!asShip) return true;
    }
  }
  return false;
}

function legalSettleSpots(G,B,pIdx,setup){
  const out=[];
  for(const vid in B.verts) if(canSettle(G,B,vid,pIdx,setup)) out.push(vid);
  return out;
}
function legalRoadSpots(G,B,pIdx,asShip){
  const out=[];
  for(const eid in B.edges) if(canRoad(G,B,eid,pIdx,asShip)) out.push(eid);
  return out;
}
/* the opening road must touch the settlement just placed — by its actual endpoints.
   (Matching the vertex id as a substring of the edge id also caught edges of other corners
   whose ids contain it, e.g. "866:-3500" inside "-866:-3500|0:-4000".) */
function legalSetupRoadSpots(G,B,pIdx){
  const v=G.lastBuiltVertex; if(v==null) return [];
  const touches=e=>B.edges[e] && B.edges[e].v.indexOf(v)>=0;
  let legal=legalRoadSpots(G,B,pIdx,false).filter(touches);
  if(G.cfg.seafarers) legal=legal.concat(legalRoadSpots(G,B,pIdx,true).filter(touches));
  return legal;
}
function legalCitySpots(G,B,pIdx){
  const out=[];
  for(const vid in G.buildings){ const b=G.buildings[vid]; if(b.p===pIdx&&b.t==='s') out.push(vid); }
  return G.players[pIdx].cityLeft>0 ? out : [];
}

/* ---------- setup phase ---------- */
function placeSetupSettlement(G,B,vid){
  const p=P(G);
  G.buildings[vid]={t:'s',p:G.turn};
  p.settLeft--;
  G.lastBuiltVertex=vid;
  claimIsland(G,B,vid,G.turn);
  if(G.phase==='setup2'){
    const gained={};
    B.verts[vid].hexes.forEach(hid=>{
      const h=B.hexById[hid]; const r=TERRAIN_RES[h.terrain];
      if(r&&r!=='gold'){ if(give(G,p,r,1)) gained[r]=(gained[r]||0)+1; }
      else if(r==='gold'){ G.goldQueue.push({p:G.turn,n:1}); }
    });
    const parts=Object.keys(gained).map(r=>gained[r]+' '+RES_HE[r]);
    if(parts.length) logit(G,`${p.name} קיבל ${parts.join(', ')}`);
  }
  updateHarbour(G,B);
  G.sub='setupR';
  return {vid, gained:true};
}
function placeSetupRoad(G,B,eid,asShip){
  const p=P(G);
  G.roads[eid]={p:G.turn, ship:!!asShip, born:G.tc};
  if(asShip) p.shipsLeft--; else p.roadsLeft--;
  advanceSetup(G,B);
}
function advanceSetup(G,B){
  G.setupPos++;
  if(G.setupPos>=G.setupOrder.length){
    G.phase='play'; G.sub='roll'; G.turn=G.setupOrder[0]; G.round=1; G.tc=1;
    updateLongest(G,B);
    logit(G,'ההכנה הסתיימה. מתחילים!');
    return;
  }
  G.turn = G.setupOrder[G.setupPos];
  G.phase = G.setupPos < G.players.length ? 'setup1' : 'setup2';
  G.sub='setupS';
}

/* ---------- dice & production ---------- */
function doRoll(G,B){
  if(isCK(G)) return ckRoll(G,B);
  const [d1,d2]=rollPair(G);
  G.dice=[d1,d2]; const sum=d1+d2; G.lastRoll=sum;
  P(G).rolled=true;
  if(sum===7 && G.round===1 && !G.scripted){          /* (tutorials script their 7s on purpose) */
    /* a 7 in the opening round — before the starting player has rolled a second time — is
       rolled again: nobody discards and the robber stays put */
    P(G).rolled=false; G.sub='roll'; G.reroll7=(G.reroll7||0)+1;
    logit(G,`יצא 7 בסיבוב הראשון — ${P(G).name} ${gv(P(G),'מטיל','מטילה')} שוב`);
    return sum;
  }
  if(sum===7){
    G.sub='robber';
    G.discardQueue = G.players.filter(p=>totalCards(p)>7)
      .map(p=>({p:p.idx,n:Math.floor(totalCards(p)/2)}));
    logit(G,'יצא 7 — השודד זז');
  } else {
    const rep = produce(G,B,sum);
    G.sub=homeSub(G);
    logit(G,`יצא ${sum}${rep?' — '+rep:''}`);
  }
  return sum;
}

function produce(G,B,sum){
  const gains={};            /* pIdx -> {res:n} */
  const want={};             /* res -> total requested, for shortage checks */
  const got={};              /* who produced anything at all */
  B.hexes.forEach(h=>{
    if(h.num!==sum || h.id===G.robber) return;
    const r=TERRAIN_RES[h.terrain]; if(!r) return;
    const c={x:h.x,y:h.y};
    for(let i=0;i<6;i++){
      const vid=vKey(hexCorner(c,i)); const b=G.buildings[vid];
      if(!b) continue;
      let n = b.t==='c'?2:1;
      if(r==='gold'){ G.goldQueue.push({p:b.p,n}); got[b.p]=1; continue; }
      if(isCK(G) && b.t==='c'){
        const com={forest:'paper',pasture:'cloth',mountains:'coin'}[h.terrain];
        if(com){ n=1; G.players[b.p].com[com]++; }
      }
      gains[b.p]=gains[b.p]||{}; gains[b.p][r]=(gains[b.p][r]||0)+n;
      got[b.p]=1; want[r]=(want[r]||0)+n;
    }
  });
  /* official shortage rule: if the bank can't pay everyone for a resource,
     nobody gets it — unless exactly one player is owed it */
  RES.forEach(r=>{
    if(!want[r] || want[r]<=G.bank[r]) return;
    const claimants=Object.keys(gains).filter(k=>gains[k][r]);
    if(claimants.length>1) claimants.forEach(k=>delete gains[k][r]);
  });
  const notes=[];
  Object.keys(gains).forEach(k=>{
    const p=G.players[+k], got=[];
    Object.keys(gains[k]).forEach(r=>{ const n=give(G,p,r,gains[k][r]); if(n) got.push(n+' '+RES_HE[r]); });
    if(got.length) notes.push(`${p.name}: ${got.join(', ')}`);
  });
  G.lastGains = gains;
  if(isCK(G)){
    /* Aqueduct: science level 3 pays out when a roll gives you nothing */
    G.players.forEach(p=>{ if(p.imp.sci>=3 && !got[p.idx]) G.goldQueue.push({p:p.idx,n:1,aq:true}); });
  }
  return notes.join(' · ');
}

/* ---------- robber ---------- */
function robberTargets(G,B,hexId,pIdx){
  const h=B.hexById[hexId]; if(!h) return [];
  const c={x:h.x,y:h.y}, set={};
  for(let i=0;i<6;i++){
    const vid=vKey(hexCorner(c,i)); const b=G.buildings[vid];
    if(!b || b.p===pIdx) continue;
    const vic=G.players[b.p];
    if(totalCards(vic)+ (isCK(G)?comTotal(vic):0) <=0) continue;
    if(G.cfg.friendly && vpPublic(G,b.p)<=2) continue;
    set[b.p]=1;
  }
  return Object.keys(set).map(Number);
}
function canPlaceRobber(G,B,hexId,pIdx){
  if(hexId===G.robber) return false;
  if(!B.hexById[hexId]) return false;
  if(!G.cfg.friendly) return true;
  /* friendly robber: not allowed on a hex where every neighbour is protected
     and there is at least one building */
  const h=B.hexById[hexId], c={x:h.x,y:h.y};
  let others=0, valid=0;
  for(let i=0;i<6;i++){
    const b=G.buildings[vKey(hexCorner(c,i))];
    if(b && b.p!==pIdx){ others++; if(vpPublic(G,b.p)>2) valid++; }
  }
  return others===0 || valid>0;
}
function stealPool(G,victim){
  const v=G.players[victim], pool=[];
  RES.forEach(r=>{ for(let i=0;i<v.res[r];i++) pool.push(r); });
  if(isCK(G)) COM.forEach(c=>{ for(let i=0;i<v.com[c];i++) pool.push(c); });
  return pool;
}
/* `key` is the card the thief tapped in the face-down picker (already drawn at random by the UI) */
function stealFrom(G,p,victim,key){
  const v=G.players[victim];
  const pool=stealPool(G,victim);
  if(!pool.length) return false;
  const r=(key && pool.indexOf(key)>=0) ? key : pool[randInt(pool.length)];
  if(COM.indexOf(r)>=0){ v.com[r]--; p.com[r]++; } else { v.res[r]--; p.res[r]++; }
  logit(G,`${p.name} גנב קלף מ${v.name}`);
  G.stealSeq=(G.stealSeq||0)+1; G.lastSteal={seq:G.stealSeq,thief:p.idx,victim,key:r};
  return true;
}
function moveRobber(G,B,hexId,victim,key){
  G.robber=hexId;
  const p=P(G);
  if(victim!=null && victim>=0) stealFrom(G,p,victim,key);
  else logit(G,`${p.name} הזיז את השודד`);
  G.sub = G.robberReturn || homeSub(G);
  G.robberReturn = null;
  G.pendingSteal = null; G.stealPirate = false;
}

