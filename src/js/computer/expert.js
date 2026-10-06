/* =========================================================
   EXPERT computer player.
   Plays only on information a strong human at the table has: the board, every building and
   road, public scores, how many cards each player holds and what they produce. It never looks
   at anyone's hidden hand or development cards, the deck, or future dice.
   ========================================================= */
const XBASE={wood:1.0,brick:1.0,sheep:0.8,wheat:1.1,ore:1.05,gold:1.5};
const X_CACHE=new WeakMap();
/* how rare each resource is on this particular board: a scarce resource is worth more */
function xScarcity(B){
  if(X_CACHE.has(B)) return X_CACHE.get(B);
  const tot={wood:0,brick:0,sheep:0,wheat:0,ore:0};
  B.hexes.forEach(h=>{ const r=TERRAIN_RES[h.terrain]; if(r&&tot[r]!=null) tot[r]+=PIP(h.num); });
  const avg=RES.reduce((a,r)=>a+tot[r],0)/5, out={gold:1.2};
  RES.forEach(r=>{ out[r]=Math.max(0.75,Math.min(1.5,Math.sqrt(avg/Math.max(1,tot[r])))); });
  X_CACHE.set(B,out); return out;
}
/* expected pips per resource from a player's buildings (robber hex excluded) */
function xProd(G,B,pi){
  const out={wood:0,brick:0,sheep:0,wheat:0,ore:0,gold:0};
  for(const vid in G.buildings){ const b=G.buildings[vid]; if(b.p!==pi) continue;
    const m=b.t==='c'?2:1;
    for(const hid of B.verts[vid].hexes){ if(hid===G.robber) continue;
      const h=B.hexById[hid]; if(!h) continue; const r=TERRAIN_RES[h.terrain];
      if(r&&out[r]!=null) out[r]+=PIP(h.num)*m; } }
  return out;
}
/* which stage of the game this player is in: early = expand, late = cities and cards */
function xLate(G,pi){ return vpPublic(G,pi)>=5; }
function xResWeight(G,B,pi,r){
  const late=xLate(G,pi); let w=XBASE[r]*(xScarcity(B)[r]||1);
  if(!late && (r==='wood'||r==='brick')) w*=1.15;
  if(late){ if(r==='ore'||r==='wheat') w*=1.18; if(r==='wood'||r==='brick') w*=0.85; }
  return w;
}
/* value of settling a corner, for this player, given what they already produce */
function xVertexValue(G,B,vid,pi,prodNow){
  const v=B.verts[vid]; if(!v) return -99;
  const prod=prodNow||xProd(G,B,pi);
  let val=0; const kinds={}, nums={};
  for(const hid of v.hexes){
    const h=B.hexById[hid]; if(!h) continue;
    const r=TERRAIN_RES[h.terrain]; if(!r) continue;             /* desert */
    let pips=PIP(h.num); if(hid===G.robber) pips*=0.45;
    /* a resource we don't produce at all is worth far more — without it whole builds stall */
    const lack = prod[r]===0 ? (r==='ore'?0.7:1.0) : (prod[r]<=3 ? 0.3 : (prod[r]>=9 ? -0.2 : 0));
    val += pips*xResWeight(G,B,pi,r)*(1+lack);
    kinds[r]=(kinds[r]||0)+pips;
    if(h.num){ nums[h.num]=(nums[h.num]||0)+1; }
  }
  val += Object.keys(kinds).length*1.3;
  for(const n in nums) if(nums[n]>1) val-=0.6;                   /* same number twice: all eggs in one basket */
  if(v.port){
    const after={...prod}; for(const r in kinds) after[r]=(after[r]||0)+kinds[r];
    const total=RES.reduce((a,r)=>a+(after[r]||0),0);
    if(v.port==='any') val += 0.8 + total*0.045;
    else val += Math.min(4.5,(after[v.port]||0)*0.33);
  }
  /* room to grow: good free corners two steps away */
  let room=0;
  for(const a of v.adj) for(const b of B.verts[a].adj){
    if(b===vid || G.buildings[b] || !canSettle(G,B,b,pi,true)) continue;
    let pp=0; for(const hid of B.verts[b].hexes){ const h=B.hexById[hid]; if(h) pp+=PIP(h.num); }
    room=Math.max(room,pp);
  }
  val += room*0.12;
  return val;
}
/* ---- road planning: the best corner we can reach, and the first road toward it ---- */
function xNetwork(G,pi){
  const set=new Set();
  for(const vid in G.buildings) if(G.buildings[vid].p===pi) set.add(vid);
  for(const e in G.roads) if(G.roads[e].p===pi && !G.roads[e].ship){ const [a,b]=e.split('|'); set.add(a); set.add(b); }
  return set;
}
function xRoadPlan(G,B,pi,maxDepth){
  const net=xNetwork(G,pi), prod=xProd(G,B,pi);
  const passable=v=>{ const b=G.buildings[v]; return !b||b.p===pi; };
  const dist=new Map(), first=new Map(), q=[];
  net.forEach(v=>{ if(passable(v)){ dist.set(v,0); first.set(v,null); q.push(v); } });
  while(q.length){
    const v=q.shift(), d=dist.get(v); if(d>=maxDepth) continue;
    for(const a of B.verts[v].adj){
      const e=edgeKey(v,a); const rd=G.roads[e];
      if(rd && rd.p!==pi) continue;                              /* someone else's road */
      if(!rd && (edgeLand(B,e)<1)) continue;                     /* roads need land */
      if(!passable(v) && d>0) continue;
      const nd=d+(rd?0:1);
      if(dist.has(a) && dist.get(a)<=nd) continue;
      dist.set(a,nd); first.set(a, first.get(v)||(rd?null:e));
      if(rd) q.unshift(a); else q.push(a);
    }
  }
  let best=null;
  dist.forEach((d,v)=>{
    if(d===0 || !canSettle(G,B,v,pi,true)) return;
    let val=xVertexValue(G,B,v,pi,prod);
    /* someone else next to it will probably get there first */
    for(const a of B.verts[v].adj) for(const e2 of [edgeKey(v,a)]){ const rd=G.roads[e2]; if(rd&&rd.p!==pi) val*=0.7; }
    const score=val/(1+0.55*d);
    if(!best||score>best.score) best={v,d,edge:first.get(v),score,val};
  });
  return best;
}
/* ---- counting cards ---- */
function xMissing(p,cost){ let m=0; for(const r in cost) m+=Math.max(0,cost[r]-p.res[r]); return m; }
/* can bank/port trades of surplus cover everything missing for `cost` right now? returns the trades */
function xTradePlan(G,B,pi,cost){
  const p=G.players[pi], have={...p.res}, trades=[];
  const need={}; RES.forEach(r=>need[r]=Math.max(0,(cost[r]||0)-have[r]));
  for(const r of RES){
    while(need[r]>0){
      let bestGive=null,bestRate=9;
      for(const g of RES){ if(g===r) continue;
        const rate=bankRate(G,B,pi,g), spare=have[g]-(cost[g]||0);
        if(spare>=rate && rate<bestRate && G.bank[r]>trades.filter(t=>t.get===r).length){ bestGive=g; bestRate=rate; } }
      if(!bestGive) return null;
      have[bestGive]-=bestRate; have[r]++; need[r]--; trades.push({give:bestGive,get:r,rate:bestRate});
    }
  }
  return trades;
}
/* how threatening each opponent looks from the outside */
function xThreat(G,pi,o){
  if(o===pi) return 0;
  const target=G.cfg.target||10, vp=vpPublic(G,o), mine=vpPublic(G,pi);
  const hidden=G.players[o].dev.length*0.35;                     /* the count of their cards is public */
  let t=1+Math.max(0,vp+hidden-mine)*0.45;
  if(vp+hidden>=target-3) t+=1.6;
  if(vp+hidden>=target-1) t+=2.5;
  return t;
}
/* public estimate of how many of a resource the others hold: their card counts spread
   by what their buildings produce (no peeking at the actual hands) */
function xEstimateHeld(G,B,pi,r){
  let est=0;
  G.players.forEach((o,i)=>{ if(i===pi) return;
    const pr=xProd(G,B,i), tot=RES.reduce((a,x)=>a+pr[x],0)+2.5;
    est += totalCards(o)*((pr[r]+0.5)/tot);
  });
  return est;
}
/* ---- choosing what to build next ---- */
function xGoal(G,B,pi){
  const p=G.players[pi], opts=[];
  const setts=p.settLeft>0 ? legalSettleSpots(G,B,pi,false) : [];
  const cities=p.cityLeft>0 ? legalCitySpots(G,B,pi) : [];
  const prod=xProd(G,B,pi);
  if(setts.length){
    const best=Math.max(...setts.map(v=>xVertexValue(G,B,v,pi,prod)));
    opts.push({kind:'settlement',cost:COST.settlement,value:12+best*0.6});
  }
  if(cities.length){
    const best=Math.max(...cities.map(v=>{ let s=0; for(const hid of B.verts[v].hexes){ const h=B.hexById[hid]; if(h&&hid!==G.robber){ const r=TERRAIN_RES[h.terrain]; if(r) s+=PIP(h.num)*xResWeight(G,B,pi,r); } } return s; }));
    opts.push({kind:'city',cost:COST.city,value:12+best*0.7});
  }
  if(!setts.length && p.settLeft>0 && p.roadsLeft>0){
    const plan=xRoadPlan(G,B,pi,3);
    if(plan && plan.edge) opts.push({kind:'road',cost:COST.road,value:6+plan.val*0.35-plan.d*1.2,edge:plan.edge});
  }
  if(G.devDeck.length) opts.push({kind:'dev',cost:COST.dev,value:(xLate(G,pi)?8:6.5)+(xArmyChance(G,pi)?2.5:0)});
  opts.forEach(o=>{ o.missing=xMissing(p,o.cost); o.score=o.value/(1+o.missing*1.35); });
  opts.sort((a,b)=>b.score-a.score);
  return opts;
}
function xArmyChance(G,pi){
  const p=G.players[pi], army=G.army;
  if(army.p===pi) return G.players.some((o,i)=>i!==pi && o.knights>=p.knights-1);
  const need=Math.max(3,(army.n||2)+1);
  return p.knights+1>=need-1;
}
/* ---- development cards ---- */
function xKnightNow(G,B,pi,preRoll){
  const p=G.players[pi];
  const idx=p.dev.findIndex((c,i)=>c==='knight'&&playableDev(G,pi,i)); if(idx<0) return -1;
  /* a knight always moves the robber — and it can't stay put. If the robber is already sitting
     on an opponent's best hex, playing a knight would set them free, so weigh that first. */
  const gain=xRobberMoveGain(G,B,pi);
  /* the robber is on me */
  if(robberHitsMe(G,B,pi)){ const h=B.hexById[G.robber]; if(h && PIP(h.num)>=2) return idx; }
  /* it wins Largest Army: 2 points outweigh a weaker robber spot */
  const need=Math.max(3,(G.army.n||2)+1);
  if(G.army.p!==pi && p.knights+1>=need) return idx;
  /* protect Largest Army — but not by freeing someone we're blocking well */
  if(G.army.p===pi && G.players.some((o,i)=>i!==pi&&o.knights>=p.knights) && gain>-1) return idx;
  /* the leader is close to winning: slow them down, if the robber isn't already doing that */
  if(!preRoll && G.players.some((o,i)=>i!==pi && xThreat(G,pi,i)>=4) && gain>0.5) return idx;
  /* otherwise play it when the new robber spot is clearly better than the current one: a knight
     in hand scores nothing, and a played one also counts toward Largest Army */
  if(G.army.p!==pi && gain>0.5) return idx;
  /* or when the robber stays on an opponent at a spot nearly as strong: the pressure holds, we
     steal a card, and the knight counts toward Largest Army */
  if(G.army.p!==pi && xRobberKeepsPressure(G,B,pi)) return idx;
  return -1;
}
/* how much the robber on this hex hurts the others (and spares us); withSteal adds the card
   we would take on arrival — which only counts when we are the one moving it there */
function xRobberHexScore(G,B,pi,hid,withSteal){
  const h=B.hexById[hid]; if(!h) return 0;
  const c={x:h.x,y:h.y}, r=TERRAIN_RES[h.terrain];
  let s=0, stealBest=0;
  for(let i=0;i<6;i++){
    const b=G.buildings[vKey(hexCorner(c,i))]; if(!b) continue;
    const m=b.t==='c'?2:1, pp=PIP(h.num)*m*(r?xScarcity(B)[r]||1:1);
    if(b.p===pi){ s-=pp*3.2; continue; }
    s+=pp*xThreat(G,pi,b.p);
    const cards=totalCards(G.players[b.p]);
    if(cards>0 && !(G.cfg.friendly && vpPublic(G,b.p)<=2)) stealBest=Math.max(stealBest,Math.min(cards,9)*0.35*xThreat(G,pi,b.p));
  }
  return s+(withSteal?stealBest:0);
}
function xBestRobberHex(G,B,pi){
  const legal=B.hexes.filter(h=>canPlaceRobber(G,B,h.id,pi)).map(h=>h.id);
  let best=null,bs=-1e9;
  for(const hid of legal){ const s=xRobberHexScore(G,B,pi,hid,true); if(s>bs){ bs=s; best=hid; } }
  return best;
}
/* is moving the robber now actually better than leaving it where it is? */
function xRobberMoveGain(G,B,pi){
  const best=xBestRobberHex(G,B,pi); if(best==null) return -1e9;
  const blockNow=xRobberHexScore(G,B,pi,G.robber,false);
  const blockNew=xRobberHexScore(G,B,pi,best,false);
  const steal=xRobberHexScore(G,B,pi,best,true)-blockNew;
  /* the block lasts for many rolls, the stolen card is one card: weigh the block more */
  return (blockNew-blockNow) + steal*0.5;
}
/* does moving the robber keep (most of) the pressure — landing on a strong spot of an opponent? */
function xRobberKeepsPressure(G,B,pi){
  const best=xBestRobberHex(G,B,pi); if(best==null) return false;
  const blockNow=xRobberHexScore(G,B,pi,G.robber,false), blockNew=xRobberHexScore(G,B,pi,best,false);
  return blockNew>0 && blockNew>=blockNow*0.7;
}
function xVictim(G,list,pi){
  return list.slice().sort((a,b)=>(xThreat(G,pi,b)*2+totalCards(G.players[b])*0.3)-(xThreat(G,pi,a)*2+totalCards(G.players[a])*0.3))[0];
}
/* ---- keeping the right cards on a 7 ---- */
function xDiscard(G,B,pi,n){
  const p=G.players[pi], keep={...p.res}, picks={wood:0,brick:0,sheep:0,wheat:0,ore:0};
  const goal=(xGoal(G,B,pi)[0]||{cost:COST.settlement}).cost;
  for(let k=0;k<n;k++){
    let best=null,bs=1e9;
    for(const r of RES){ if(keep[r]<=0) continue;
      /* the cost of throwing this one away: needed for the goal counts a lot, scarce counts a bit */
      const needed=keep[r]<=(goal[r]||0)?6:0;
      const s=needed + xResWeight(G,B,pi,r)*1.2 - keep[r]*0.45;
      if(s<bs){ bs=s; best=r; } }
    keep[best]--; picks[best]++;
  }
  return picks;
}
/* ---- answering a player's trade offer ---- */
function xAcceptOffer(G,pi,o){
  const p=G.players[pi];
  for(const r of RES) if((o.want[r]||0)>p.res[r]) return false;
  /* never feed someone who is about to win, or who clearly leads */
  if(xThreat(G,pi,o.from)>=3.2) return false;
  const B=ST.B, goal=xGoal(G,B,pi)[0]; if(!goal) return false;
  const after={...p.res}; RES.forEach(r=>{ after[r]+=(o.give[r]||0)-(o.want[r]||0); });
  const before=xMissing(p,goal.cost), now=xMissing({res:after},goal.cost);
  if(now<before) return true;
  let get=0,give=0; RES.forEach(r=>{ get+=(o.give[r]||0)*xResWeight(G,B,pi,r); give+=(o.want[r]||0)*xResWeight(G,B,pi,r)*((goal.cost[r]||0)?1.8:1); });
  return now===before && get>=give*1.35;
}
/* ---- the opening ---- */
/* the starting position: strong numbers (6 and 8 are rolled most), and all five resources between the
   two settlements — without ore or wheat there are no cities and no cards, without wood or brick no roads */
const X_OPEN_KIND_BONUS=2.2, X_OPEN_ALL5_BONUS=3.0, X_OPEN_HOT_BONUS=1.5;
function xOpenKinds(B,vid){
  const out={};
  for(const hid of B.verts[vid].hexes){ const h=B.hexById[hid]; const r=h&&TERRAIN_RES[h.terrain];
    if(r&&r!=='gold'&&PIP(h.num)>0) out[r]=(out[r]||0)+PIP(h.num); }
  return out;
}
/* what a corner adds to the starting position, on top of the plain corner value: the resources we
   would be missing otherwise, and the hot numbers */
function xOpenBonus(G,B,vid,prod){
  const kinds=xOpenKinds(B,vid); let bonus=0, have=0, add=0;
  RES.forEach(r=>{ if(prod[r]>0) have++; });
  for(const r in kinds){ if(!(prod[r]>0)){ add++; bonus+=X_OPEN_KIND_BONUS*(r==='ore'||r==='wheat'?1.2:1); } }
  if(have+add>=5) bonus+=X_OPEN_ALL5_BONUS;
  for(const hid of B.verts[vid].hexes){ const h=B.hexById[hid]; if(h&&(h.num===6||h.num===8)&&TERRAIN_RES[h.terrain]) bonus+=X_OPEN_HOT_BONUS; }
  return bonus;
}
function xSetupSettlement(G,B,pi){
  const spots=legalSettleSpots(G,B,pi,true), prod=xProd(G,B,pi);
  const second = G.phase==='setup2';
  let best=null,bs=-1e9;
  for(const v of spots){
    let s=xVertexValue(G,B,v,pi,prod)+xOpenBonus(G,B,v,prod);
    if(second){
      /* the second settlement also pays out at once: wood and brick start the expansion */
      for(const hid of B.verts[v].hexes){ const h=B.hexById[hid]; const r=h&&TERRAIN_RES[h.terrain];
        if(r==='wood'||r==='brick') s+=0.5; }
    } else {
      /* the first pick should leave good partners for the second one — several, since the others
         will take some of them before our turn comes again */
      const trial={...prod}; for(const hid of B.verts[v].hexes){ const h=B.hexById[hid]; const r=h&&TERRAIN_RES[h.terrain]; if(r&&trial[r]!=null) trial[r]+=PIP(h.num); }
      const partners=[];
      for(const u of spots){ if(u===v || B.verts[v].adj.indexOf(u)>=0) continue;
        partners.push(xVertexValue(G,B,u,pi,trial)+xOpenBonus(G,B,u,trial)); }
      partners.sort((a,b)=>b-a);
      const top=partners.slice(0,3); const avg=top.length?top.reduce((a,x)=>a+x,0)/top.length:0;
      s+=avg*0.45;
    }
    if(s>bs){ bs=s; best=v; }
  }
  return best;
}
function xSetupRoad(G,B,pi){
  const v=G.lastBuiltVertex, legal=legalSetupRoadSpots(G,B,pi), prod=xProd(G,B,pi);
  let best=legal[0],bs=-1e9;
  for(const e of legal){
    const ed=B.edges[e]; const far=ed.v[0]===v?ed.v[1]:ed.v[0];
    let s=0, open=0;
    for(const a of B.verts[far].adj){ if(a===v) continue;
      if(canSettle(G,B,a,pi,true)){ s=Math.max(s,xVertexValue(G,B,a,pi,prod)); open++; } }
    s+=open*0.8;
    /* heading straight at someone else's road is a race we may lose */
    for(const a of B.verts[far].adj){ const rd=G.roads[edgeKey(far,a)]; if(rd&&rd.p!==pi) s-=2; }
    if(s>bs){ bs=s; best=e; }
  }
  return best;
}
/* ---- one expert action per tick; returns true when it handled the moment ---- */
function xAct(G,B,nd,pi,p,lvl){
  switch(nd.kind){
    case 'setupS': {
      const vid=xSetupSettlement(G,B,pi); if(!vid) return false;
      placeSetupSettlement(G,B,vid); buildAnim[vid]=T;
      spawnBurst(B.verts[vid].x,B.verts[vid].y,colOf(G,pi).hex,14); SFX.build('sett');
      afterAction(); return true;
    }
    case 'setupR': {
      const eid=xSetupRoad(G,B,pi); if(!eid) return false;
      placeSetupRoad(G,B,eid,edgeLand(B,eid)<1); SFX.build('road');
      afterAction(); return true;
    }
    case 'roll': {
      const ki=xKnightNow(G,B,pi,true);
      if(ki>=0){ playDev(G,B,ki); SFX.knight();
        showTradeBanner('wait',`${p.name} ${gv(p,'שלח','שלחה')} אביר!`,'מזיז את השודד',[]); tresT=setTimeout(clearTradeBanner,2200);
        afterAction(); return true; }
      return false;                                              /* roll normally */
    }
    case 'discard': {
      const dn=nd.n;
      if(!resolveDiscard(G,pi,xDiscard(G,B,pi,dn))) return false;
      toast(p.name+' השליך '+dn+' קלפים',1600); afterAction(); return true;
    }
    case 'robber': {
      const hid=xBestRobberHex(G,B,pi);
      if(G.cfg.seafarers){                                   /* the pirate may take the robber's place */
        const land = hid==null ? -1e9 : xRobberHexScore(G,B,pi,hid,true)+(robberHitsMe(G,B,pi)?4:0);
        if(botTryPirate(G,B,pi,lvl,land,true)){ afterAction(); return true; }
      }
      if(hid==null) return false;
      const h=B.hexById[G.robber]; robberAnim={from:toScreen(h.x,h.y),t0:T,t1:T+0.55};
      const targets=robberTargets(G,B,hid,pi);
      moveRobber(G,B,hid,targets.length?xVictim(G,targets,pi):null); SFX.robber();
      afterAction(); return true;
    }
    case 'steal': {
      if(G.stealPirate) return false;
      moveRobber(G,B,G.robber,xVictim(G,G.pendingSteal||[],pi)); SFX.robber();
      afterAction(); return true;
    }
    case 'offer': {
      if(G.offer && G.offer.from!==pi){ replyOffer(G,pi,xAcceptOffer(G,pi,G.offer)); afterAction(); return true; }
      return false;
    }
    case 'gold': case 'plenty': {
      const goal=xGoal(G,B,pi)[0]; const need={...(goal?goal.cost:COST.city)};
      const pick=()=>{ let r=RES.find(x=>(need[x]||0)>p.res[x]+(picks[x]||0) && G.bank[x]>0);
        if(!r) r=RES.filter(x=>G.bank[x]>0).sort((a,b)=>xResWeight(G,B,pi,b)-xResWeight(G,B,pi,a))[0]||'ore';
        return r; };
      const picks={};
      const n = nd.kind==='gold' ? nd.n : 2;
      const list=[]; for(let i=0;i<n;i++){ const r=pick(); picks[r]=(picks[r]||0)+1; list.push(r); }
      if(nd.kind==='gold'){ const pk={wood:0,brick:0,sheep:0,wheat:0,ore:0}; list.forEach(r=>pk[r]++); resolveGold(G,pi,pk); afterAction(); return true; }
      const a=list[0], b=list[1];
      announceThen('ok',`${p.name} ${gv(p,'הפעיל','הפעילה')} שנת שפע!`, a===b?`${gv(p,'לוקח','לוקחת')} 2 ${RES_HE[a]}`:`${gv(p,'לוקח','לוקחת')} ${RES_HE[a]} ו${RES_HE[b]}`,()=>{
        doPlenty(ST.G,a,b); SFX.gain();
        toast(a===b ? `${p.name} ${gv(p,'הפעיל שנת שפע ולקח','הפעילה שנת שפע ולקחה')} 2 ${RES_HE[a]}` : `${p.name} ${gv(p,'הפעיל שנת שפע ולקח','הפעילה שנת שפע ולקחה')} ${RES_HE[a]} ו${RES_HE[b]}`);
        afterAction(); });
      return true;
    }
    case 'mono': {
      const pick=RES.slice().sort((a,b)=>xMonoValue(G,B,pi,b)-xMonoValue(G,B,pi,a))[0];
      announceThen('wait',`${p.name} ${gv(p,'הכריז','הכריזה')} מונופול!`,`כולם מוסרים את כל ה${RES_HE[pick]}`,()=>{
        const GG=ST.G; const n=GG.players.reduce((a,x)=>a+(x.idx===pi?0:x.res[pick]),0);
        doMonopoly(GG,pick); SFX.coins();
        toast(n>0 ? `${p.name} ${gv(p,'הכריז מונופול ולקח','הכריזה מונופול ולקחה')} ${n} ${RES_HE[pick]} מכולם` : `${p.name} ${gv(p,'הכריז','הכריזה')} מונופול על ${RES_HE[pick]} — אבל לאף אחד לא היה`);
        afterAction(); });
      return true;
    }
    case 'freeroad': {
      const legal=legalRoadSpots(G,B,pi,false);
      if(!legal.length){ G.freeRoads=0; G.sub=homeSub(G); afterAction(); return true; }
      if(G.freeRoads===2){ SFX.roadCard(); showTradeBanner('ok',`${p.name} ${gv(p,'שיחק','שיחקה')} בניית דרכים!`,'שתי דרכים בחינם',[]); tresT=setTimeout(clearTradeBanner,2200); }
      const plan=xRoadPlan(G,B,pi,3);
      const eid=(plan&&plan.edge&&legal.indexOf(plan.edge)>=0)?plan.edge:bestOf(legal,e=>roadScore(G,B,e,pi,lvl),lvl);
      buildRoad(G,B,eid,false,true); G.freeRoads--;
      if(G.freeRoads<=0) G.sub=homeSub(G);
      SFX.build('road'); toast(noteDeed(G,'road')); afterAction(); return true;
    }
    case 'main': case 'special':
      if(G.cfg.seafarers) return false;                          /* ships: the general player handles those */
      xMain(G,B,pi,lvl,nd.kind==='special'); return true;
  }
  return false;
}
/* the road that most lengthens our longest chain, and the length it reaches */
function xLongestExtension(G,B,pi){
  const legal=legalRoadSpots(G,B,pi,false); let best=null,bl=-1;
  for(const e of legal){
    G.roads[e]={p:pi,ship:false,born:G.tc};
    const len=longestFor(G,B,pi);
    delete G.roads[e];
    if(len>bl){ bl=len; best=e; }
  }
  return best?{edge:best,len:bl}:null;
}
function xMonoValue(G,B,pi,r){
  const p=G.players[pi]; let v=xEstimateHeld(G,B,pi,r);
  if(bankRate(G,B,pi,r)===2) v*=1.6;                            /* a 2:1 port turns them into anything */
  const goal=xGoal(G,B,pi)[0]; if(goal && (goal.cost[r]||0)>p.res[r]) v*=1.3;
  return v;
}
function xMain(G,B,pi,lvl,special){
  const p=G.players[pi], target=G.cfg.target||10;
  /* 1. development cards that pay off now */
  if(!special){
    for(let i=0;i<p.dev.length;i++){
      if(!playableDev(G,pi,i)) continue;
      const c=p.dev[i];
      if(c==='knight' && xKnightNow(G,B,pi,false)===i){ playDev(G,B,i); SFX.knight();
        showTradeBanner('wait',`${p.name} ${gv(p,'שלח','שלחה')} אביר!`,'מזיז את השודד',[]); tresT=setTimeout(clearTradeBanner,2200);
        return afterAction(); }
      if(c==='mono'){ const best=Math.max(...RES.map(r=>xMonoValue(G,B,pi,r)));
        if(best>=3.2){ playDev(G,B,i); SFX.monoCard(); return afterAction(); } }
      if(c==='plenty'){ const g=xGoal(G,B,pi)[0];
        if(g && g.missing>0 && g.missing<=2){ playDev(G,B,i); SFX.plentyCard(); return afterAction(); } }
      if(c==='road' && p.roadsLeft>=2){ const plan=xRoadPlan(G,B,pi,3);
        const race=(p.roadLen||0)+2>=Math.max(5,(G.longest.len||0)+ (G.longest.p===pi?0:1));
        if((plan && plan.d>=1 && plan.d<=2 && !legalSettleSpots(G,B,pi,false).length) || (race && G.longest.p!==pi)){
          playDev(G,B,i); SFX.roadCard(); return afterAction(); } }
    }
  }
  /* 2. anything that wins the game right now */
  const vpNow=vpTotal(G,pi);
  const cities=legalCitySpots(G,B,pi), setts=legalSettleSpots(G,B,pi,false);
  if(vpNow+2>=target && cities.length && canAfford(p,COST.city)){ const vid=cities[0];
    if(buildCity(G,B,vid)){ buildAnim[vid]=T; SFX.build('city'); toast(noteDeed(G,'city')); return afterAction(); } }
  if(vpNow+1>=target && setts.length && canAfford(p,COST.settlement)){ const vid=setts[0];
    if(buildSettlement(G,B,vid)){ buildAnim[vid]=T; SFX.build('sett'); toast(noteDeed(G,'sett')); return afterAction(); } }
  /* 3. build toward the plan */
  const prod=xProd(G,B,pi);
  if(setts.length && canAfford(p,COST.settlement)){
    const vid=setts.slice().sort((a,b)=>xVertexValue(G,B,b,pi,prod)-xVertexValue(G,B,a,pi,prod))[0];
    if(buildSettlement(G,B,vid)){ buildAnim[vid]=T; spawnBurst(B.verts[vid].x,B.verts[vid].y,colOf(G,pi).hex,14);
      SFX.build('sett'); toast(noteDeed(G,'sett')); return afterAction(); }
  }
  if(cities.length && canAfford(p,COST.city)){
    const score=v=>{ let s=0; for(const hid of B.verts[v].hexes){ const h=B.hexById[hid]; if(h&&hid!==G.robber){ const r=TERRAIN_RES[h.terrain]; if(r) s+=PIP(h.num)*xResWeight(G,B,pi,r); } } return s; };
    const vid=cities.slice().sort((a,b)=>score(b)-score(a))[0];
    if(buildCity(G,B,vid)){ buildAnim[vid]=T; spawnBurst(B.verts[vid].x,B.verts[vid].y,'#FFE9A8',20);
      SFX.build('city'); toast(noteDeed(G,'city')); return afterAction(); }
  }
  const goals=xGoal(G,B,pi), goal=goals[0];
  /* roads: only toward a real target, or to take Longest Road */
  if(p.roadsLeft>0 && canAfford(p,COST.road)){
    const plan=xRoadPlan(G,B,pi,3);
    const wantRoad = (goal && goal.kind==='road') || (!setts.length && plan && plan.edge && p.settLeft>0);
    const race = G.longest.p!==pi && (p.roadLen||0)+1>Math.max(4,G.longest.len||0);
    let eid = plan&&plan.edge;
    if(race && !eid){ const legal=legalRoadSpots(G,B,pi,false); eid=legal.length?bestOf(legal,e=>roadScore(G,B,e,pi,lvl),lvl):null; }
    /* don't spend wood/brick on a road if the settlement they're saved for is one card away */
    const settClose = setts.length && xMissing(p,COST.settlement)<=1;
    if(eid && (wantRoad||race) && !settClose && legalRoadSpots(G,B,pi,false).indexOf(eid)>=0){
      if(buildRoad(G,B,eid,false,false)){ SFX.build('road'); toast(noteDeed(G,'road')); return afterAction(); }
    }
  }
  /* Longest Road: worth 2 points — take it when one or two roads get us there, or keep it */
  if(p.roadsLeft>0 && canAfford(p,COST.road)){
    const cur=p.roadLen||0, need=G.longest.p===pi ? 0 : Math.max(5,(G.longest.len||0)+1);
    const threat=G.longest.p===pi && G.players.some((o,i)=>i!==pi && (o.roadLen||0)>=cur-1);
    const settClose = setts.length && xMissing(p,COST.settlement)<=1;
    if(!settClose && ((need && need-cur<=2) || threat)){
      const ext=xLongestExtension(G,B,pi);
      if(ext && ext.len>cur && buildRoad(G,B,ext.edge,false,false)){ SFX.build('road'); toast(noteDeed(G,'road')); return afterAction(); }
    }
  }
  /* development cards: when the ore/wheat isn't about to become a city */
  if(!isCK(G) && G.devDeck.length && canAfford(p,COST.dev)){
    const cityClose = cities.length && xMissing(p,COST.city)<=1 && !(p.res.ore>=4);
    const settSoon = setts.length && xMissing(p,COST.settlement)<=1 && p.res.sheep<=1 && p.res.wheat<=1;
    if(!cityClose && !settSoon){
      if(buyDev(G)){ SFX.buyCard(); devCardFly(pi,noteDeed(G,'dev')); return afterAction(); }
    }
  }
  /* 4. bank and port trades — only when they finish a build this turn */
  for(const g of goals){
    if(g.missing===0) continue;
    const plan=xTradePlan(G,B,pi,g.cost);
    if(plan && plan.length){ const t=plan[0];
      if(bankTrade(G,B,t.give,t.get)){ SFX.coins(); return afterAction(); } }
  }
  /* idle surplus: a pile the plan doesn't use becomes a card it does, one step closer */
  if(goal && goal.missing>0 && goal.missing<=3){
    const needR=RES.filter(r=>(goal.cost[r]||0)>p.res[r] && G.bank[r]>0);
    const give=RES.filter(r=>needR.indexOf(r)<0 && p.res[r]-(goal.cost[r]||0)>=bankRate(G,B,pi,r))
                  .sort((a,b)=>(p.res[b]-bankRate(G,B,pi,b))-(p.res[a]-bankRate(G,B,pi,a)))[0];
    if(give && needR.length && bankTrade(G,B,give,needR[0])){ SFX.coins(); return afterAction(); }
  }
  /* too many cards for a 7: turn the biggest pile into something the plan needs */
  if(totalCards(p)>7 && goal){
    const surplus=RES.filter(r=>p.res[r]-(goal.cost[r]||0)>=bankRate(G,B,pi,r)).sort((a,b)=>p.res[b]-p.res[a])[0];
    const needR=RES.find(r=>(goal.cost[r]||0)>p.res[r] && G.bank[r]>0) || RES.filter(r=>G.bank[r]>0&&r!==surplus).sort((a,b)=>p.res[a]-p.res[b])[0];
    if(surplus && needR && surplus!==needR && bankTrade(G,B,surplus,needR)){ SFX.coins(); return afterAction(); }
  }
  if(checkWin(G)){ SFX.win(); return afterAction(); }
  endTurn(G,B); ST.place=null;
  return afterAction();
}

/* ---- driver ---- */
let botTimer=null, botGuard=0;
function scheduleBot(){
  clearTimeout(botTimer); botTimer=null;
  if(!ST.G||ST.mode!=='local'||ST.G.phase==='over') return;
  const nd=currentNeed(ST.G), p=ST.G.players[nd.who];
  if(!p||!p.bot) { botGuard=0; return; }
  if(ST.busy||ST.hold){ botTimer=setTimeout(scheduleBot,180); return; }
  if(++botGuard>4000){ return; }
  const lvl=botCfg(p);
  const d=lvl.delay[0]+Math.random()*(lvl.delay[1]-lvl.delay[0]);
  botTimer=setTimeout(()=>{ botTimer=null;
    if(ST.hold){ scheduleBot(); return; }          /* the opening roll-off is on screen */
    try{ botAct(); }catch(e){ console.error('bot',e); try{ endTurn(ST.G,ST.B); afterAction(); }catch(e2){} }
  }, d);
}

