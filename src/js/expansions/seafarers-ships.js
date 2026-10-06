/* ---------- Seafarers: the pirate ship & moving ships ---------- */
function hexEdgeIds(B,hid){
  B.__he = B.__he || {};
  if(B.__he[hid]) return B.__he[hid];
  const h=anyHex(B,hid); if(!h) return [];
  const c={x:h.x,y:h.y}, ks=[];
  for(let i=0;i<6;i++) ks.push(vKey(hexCorner(c,i)));
  const out=[]; for(let i=0;i<6;i++) out.push(edgeKey(ks[i],ks[(i+1)%6]));
  return (B.__he[hid]=out);
}
function pirateBlocksEdge(G,B,eid){
  return !!(G.pirate && hexEdgeIds(B,G.pirate).indexOf(eid)>=0);
}
/* players with a ship on the pirate's hex who are worth stealing from */
function pirateTargets(G,B,hid,pIdx){
  const set={};
  hexEdgeIds(B,hid).forEach(eid=>{
    const r=G.roads[eid]; if(!r||!r.ship||r.p===pIdx) return;
    const vic=G.players[r.p];
    if(totalCards(vic)+(isCK(G)?comTotal(vic):0)<=0) return;
    if(G.cfg.friendly && vpPublic(G,r.p)<=2) return;
    set[r.p]=1;
  });
  return Object.keys(set).map(Number);
}
function canPlacePirate(G,B,hid,pIdx){
  if(!G.cfg.seafarers || !G.pirate) return false;
  if(!B.seaById[hid] || hid===G.pirate) return false;
  if(!G.cfg.friendly) return true;
  /* friendly: not on a hex where every ship belongs to a protected player */
  let others=0, valid=0;
  hexEdgeIds(B,hid).forEach(eid=>{ const r=G.roads[eid];
    if(r&&r.ship&&r.p!==pIdx){ others++; if(vpPublic(G,r.p)>2) valid++; } });
  return others===0 || valid>0;
}
function movePirate(G,B,hid,victim,key){
  G.pirate=hid;
  const p=P(G);
  if(victim!=null && victim>=0) stealFrom(G,p,victim,key);
  else logit(G,`${p.name} הזיז את שודדי הים`);
  G.sub = G.robberReturn || homeSub(G);
  G.robberReturn = null;
  G.pendingSteal = null; G.stealPirate = false;
}
/* is the vertex a live end of pIdx's ship route (own building, or another own ship)? */
function shipJoined(G,B,vid,eid,pIdx){
  const b=G.buildings[vid]; if(b && b.p===pIdx) return true;
  for(const a of B.verts[vid].adj){
    const k=edgeKey(vid,a); if(k===eid) continue;
    const r=G.roads[k]; if(r && r.ship && r.p===pIdx) return true;
  }
  return false;
}
function shipDestinations(G,B,eid,pIdx){
  const p=G.players[pIdx], saved=G.roads[eid];
  if(!saved) return [];
  delete G.roads[eid]; p.shipsLeft++;
  const out=[]; for(const k in B.edges){ if(k!==eid && canRoad(G,B,k,pIdx,true)) out.push(k); }
  G.roads[eid]=saved; p.shipsLeft--;
  return out;
}
/* an "open" ship: one end joined to your route, the other end dangling.
   Not one built this turn, not one beside the pirate, once per turn. */
function movableShips(G,B,pIdx){
  if(!G.cfg.seafarers || G.shipMoved===G.tc) return [];
  const out=[];
  for(const eid in G.roads){
    const r=G.roads[eid];
    if(!r.ship || r.p!==pIdx || r.born===G.tc) continue;
    if(pirateBlocksEdge(G,B,eid)) continue;
    const e=B.edges[eid];
    const j0=shipJoined(G,B,e.v[0],eid,pIdx), j1=shipJoined(G,B,e.v[1],eid,pIdx);
    if(j0===j1) continue;
    if(shipDestinations(G,B,eid,pIdx).length) out.push(eid);
  }
  return out;
}
function moveShip(G,B,from,to){
  const p=P(G);
  if(movableShips(G,B,G.turn).indexOf(from)<0) return false;
  if(shipDestinations(G,B,from,G.turn).indexOf(to)<0) return false;
  delete G.roads[from];
  G.roads[to]={p:G.turn,ship:true,born:G.tc};
  G.shipMoved=G.tc;
  updateLongest(G,B);
  logit(G,`${p.name} הזיז ספינה`);
  return true;
}

