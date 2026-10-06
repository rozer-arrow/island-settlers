/* =========================================================
   SEAFARERS — how the computer uses the pirate and moves its ships
   (the rules themselves are in expansions/seafarers-ships.js)
   ========================================================= */

/* how much a pirate parked on this sea hex hurts the others (and us), plus the card we would take.
   Same idea as the robber scores: `expert` weighs the others by how dangerous they are. */
function seaPirateScore(G,B,hid,pi,lvl,expert){
  const lead=Math.max(...G.players.map((x,i)=>vpPublic(G,i)));
  let s=0, mine=0, steal=0;
  for(const eid of hexEdgeIds(B,hid)){
    const r=G.roads[eid]; if(!r||!r.ship) continue;
    if(r.p===pi){ mine+=3.2; continue; }                 /* it would block our own ships too */
    let w=3;
    if(expert) w*=xThreat(G,pi,r.p);
    else if(lvl.block>0 && vpPublic(G,r.p)>=lead-1) w*=(1+lvl.block);
    s+=w;
    const cards=totalCards(G.players[r.p]);
    if(cards>0 && !(G.cfg.friendly && vpPublic(G,r.p)<=2))
      steal=Math.max(steal, expert ? Math.min(cards,9)*0.35*xThreat(G,pi,r.p) : 1.5);
  }
  return s-mine+steal;
}

/* On a 7 or a knight the robber must move — in Seafarers the pirate may move instead.
   `landValue` is how good the best robber spot is, in the same units. Returns true when the
   computer parked the pirate (the turn state has moved on), false to go on with the robber. */
function botTryPirate(G,B,pi,lvl,landValue,expert){
  if(!G.cfg.seafarers || !G.pirate || !B.sea) return false;
  const legal=B.sea.filter(h=>canPlacePirate(G,B,h.id,pi)).map(h=>h.id);
  if(!legal.length) return false;
  const hid=bestOf(legal,id=>seaPirateScore(G,B,id,pi,lvl,expert)+Math.random()*0.3,lvl);
  const sc=seaPirateScore(G,B,hid,pi,lvl,expert);
  if(!(sc>0) || !(sc>landValue)) return false;           /* an empty sea is never worth it */
  const targets=pirateTargets(G,B,hid,pi);
  let victim=null;
  if(targets.length) victim = expert ? xVictim(G,targets,pi)
    : targets.sort((a,b)=>(vpPublic(G,b)-vpPublic(G,a))||(totalCards(G.players[b])-totalCards(G.players[a])))[0];
  movePirate(G,B,hid,victim); SFX.robber();
  return true;
}

/* how promising a ship spot is: the settlements it could reach (no randomness, so spots compare fairly) */
function shipSpotValue(G,B,eid,pi,lvl){
  const e=B.edges[eid]; let s=0;
  for(const v of e.v){
    if(canSettle(G,B,v,pi,true)) s+=vertexScore(G,B,v,pi,lvl)*0.8;
    for(const a of B.verts[v].adj) if(!G.buildings[a]&&canSettle(G,B,a,pi,true))
      s+=vertexScore(G,B,a,pi,lvl)*0.25;
  }
  return s;
}

/* Moving a ship is free, once a turn, and only for an "open" ship (one end dangling). Do it when
   the ship's best new spot is clearly better than where it sits now. Returns true when it moved. */
function botMoveShip(G,B,pi,lvl){
  if(!G.cfg.seafarers || lvl.look<1) return false;        /* the beginner leaves its ships alone */
  const movable=movableShips(G,B,pi); if(!movable.length) return false;
  let best=null, bestGain=1.5;                            /* "clearly" better, so ships do not shuffle for nothing */
  for(const from of movable){
    const here=shipSpotValue(G,B,from,pi,lvl);
    for(const to of shipDestinations(G,B,from,pi)){
      const gain=shipSpotValue(G,B,to,pi,lvl)-here;
      if(gain>bestGain){ bestGain=gain; best={from,to}; }
    }
  }
  if(!best || !moveShip(G,B,best.from,best.to)) return false;
  spawnBurst(B.edges[best.to].x,B.edges[best.to].y,colOf(G,pi).hex,12); SFX.build('ship');
  return true;
}

