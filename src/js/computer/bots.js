/* =========================================================
   AI — three levels of computer opponent
   ========================================================= */
const BOT_LEVELS = [
  {id:'easy',   he:'מתחיל', sub:'בונה מה שיוצא, לא סוחר ולא חוסם', greed:0.35, trade:false, block:0.0,  look:0, delay:[420,900]},
  {id:'normal', he:'רגיל',  sub:'שוקל צמתים, סוחר עם הבנק ומגיב',   greed:0.85, trade:true,  block:0.45, look:1, delay:[320,750]},
  {id:'hard',   he:'קשה',   sub:'מתכנן יעד, חוסם את המוביל ומנצל נמלים', greed:1.0, trade:true, block:1.0, look:2, delay:[240,600]},
  {id:'expert', he:'מומחה', sub:'משחק כמו שחקן מנוסה: פתיחה מחושבת, מסלול דרכים, מירוץ לצבא ולדרך הארוכה, וחוסם את מי שקרוב לנצח', greed:1.0, trade:true, block:1.3, look:3, delay:[240,600]}
];
const botCfg = p => BOT_LEVELS.find(l=>l.id===(p.bot||'normal'))||BOT_LEVELS[1];
const PIP = n => (n==null?0:6-Math.abs(7-n));

function botNeedWeights(G,B,pi){
  /* what is this bot short of, for whatever it is trying to build next */
  const p=G.players[pi];
  const want={wood:0,brick:0,sheep:0,wheat:0,ore:0};
  const goal = botGoal(G,B,pi);
  const cost = COST[goal] || COST.settlement;
  RES.forEach(r=>{ want[r]=Math.max(0,(cost[r]||0)-p.res[r]); });
  return {goal,want,cost};
}
function botGoal(G,B,pi){
  const p=G.players[pi];
  if(p.cityLeft>0 && legalCitySpots(G,B,pi).length) {
    if(p.res.ore>=2||p.res.wheat>=1) return 'city';
  }
  if(p.settLeft>0 && legalSettleSpots(G,B,pi,false).length) return 'settlement';
  if(p.cityLeft>0 && legalCitySpots(G,B,pi).length) return 'city';
  if(p.roadsLeft>0 && legalRoadSpots(G,B,pi,false).length) return 'road';
  return 'dev';
}
function vertexScore(G,B,vid,pi,lvl){
  const v=B.verts[vid]; if(!v) return -1;
  let score=0; const kinds={};
  for(const hid of v.hexes){
    const h=B.hexById[hid]; if(!h) continue;
    const r=TERRAIN_RES[h.terrain];
    const pips=PIP(h.num);
    if(!r){ score-=1.2; continue; }
    const w = {wood:1.05,brick:1.10,sheep:0.92,wheat:1.12,ore:1.04,gold:1.45}[r]||1;
    score += pips*w;
    kinds[r]=(kinds[r]||0)+pips;
  }
  const distinct=Object.keys(kinds).length;
  score += distinct*2.4;
  if(lvl.look>0){
    if(v.port==='any') score+=1.6;
    else if(v.port) score += 1.2 + (kinds[v.port]?2.0:0);
    /* a spot that also opens further expansion is worth more */
    let open=0; for(const a of v.adj) if(!G.buildings[a]) open++;
    score += open*0.5;
  }
  if(lvl.look>1){
    /* prefer 6/8 clusters and avoid stacking one resource */
    let hot=0; for(const hid of v.hexes){ const h=B.hexById[hid]; if(h&&(h.num===6||h.num===8)) hot++; }
    score += hot*1.1;
    const maxOne=Math.max(0,...Object.values(kinds));
    if(distinct<=1) score-=2.5; else if(maxOne>7) score-=0.8;
  }
  return score;
}
/* The hard computer's opening: judge a corner by what it ADDS to what the player already has.
   The first settlement is scored by its own corner, with a little extra for resources that are rare on this board.
   The second one also completes the first: resources still missing, and numbers not already covered.
   (The expert does more — it plans the pair in advance and aims for all five resources.) */
const H_OPEN_NEW_KIND=1.8, H_OPEN_SAME_NUMBER=1.1, H_OPEN_RARE=0.6;
function hardOpenScore(G,B,vid,pi,lvl){
  let s=vertexScore(G,B,vid,pi,lvl);
  const v=B.verts[vid]; if(!v) return s;
  const prod=xProd(G,B,pi), have=RES.some(r=>prod[r]>0);
  const rare=xScarcity(B), mine={};
  for(const k in G.buildings){ const b=G.buildings[k]; if(b.p!==pi) continue;
    for(const hid of B.verts[k].hexes){ const h=B.hexById[hid]; if(h&&h.num) mine[h.num]=1; } }
  const seen={};
  for(const hid of v.hexes){
    const h=B.hexById[hid]; if(!h) continue; const r=TERRAIN_RES[h.terrain]; if(!r||r==='gold') continue;
    s+=PIP(h.num)*Math.max(0,(rare[r]||1)-1)*H_OPEN_RARE;                 /* rare on this board: worth a bit more */
    if(have){
      if(!(prod[r]>0) && !seen[r]){ s+=H_OPEN_NEW_KIND*(r==='ore'||r==='wheat'?1.15:1); seen[r]=1; }
      if(h.num && mine[h.num]) s-=H_OPEN_SAME_NUMBER;                     /* same number twice: both settlements live and die on the same rolls */
    }
  }
  return s;
}
function bestOf(list,fn,lvl){
  if(!list.length) return null;
  const scored=list.map(x=>({x,s:fn(x)})).sort((a,b)=>b.s-a.s);
  if(lvl.greed>=1) return scored[0].x;
  const top=Math.max(1,Math.round(scored.length*(1-lvl.greed)*0.7)+1);
  return scored[Math.min(scored.length-1,randInt(top))].x;
}

/* ---- trading with the bank to reach the goal ---- */
function botBankTrade(G,B,pi){
  const lvl=botCfg(G.players[pi]); if(!lvl.trade) return false;
  const p=G.players[pi];
  const {want}=botNeedWeights(G,B,pi);
  const missing=RES.filter(r=>want[r]>0);
  if(!missing.length) return false;
  for(const need of missing){
    for(const give of RES){
      if(give===need) continue;
      const rate=bankRate(G,B,pi,give);
      const spare=p.res[give]-( (COST[botGoal(G,B,pi)]||{})[give]||0 );
      if(spare>=rate && G.bank[need]>0){
        if(bankTrade(G,B,give,need)) return true;
      }
    }
  }
  return false;
}

/* ---- the one action a bot takes per tick ---- */
function botAct(){
  const G=ST.G,B=ST.B; if(!G) return;
  const nd=currentNeed(G), pi=nd.who, p=G.players[pi];
  if(!p||!p.bot) return;
  const lvl=botCfg(p);
  const R=a=>a[randInt(a.length)];
  if(lvl.id==='expert' && !isCK(G) && xAct(G,B,nd,pi,p,lvl)) return;

  switch(nd.kind){
    case 'setupS': {
      const spots=legalSettleSpots(G,B,pi,true);
      const vid=bestOf(spots,v=>lvl.id==='hard'?hardOpenScore(G,B,v,pi,lvl):vertexScore(G,B,v,pi,lvl),lvl);
      placeSetupSettlement(G,B,vid); buildAnim[vid]=T;
      spawnBurst(B.verts[vid].x,B.verts[vid].y,colOf(G,pi).hex,14); SFX.build('sett');
      return afterAction();
    }
    case 'setupR': {
      const v=G.lastBuiltVertex;
      const legal=legalSetupRoadSpots(G,B,pi);   /* no fallback: the road always goes by the settlement just placed */
      const eid=bestOf(legal,e=>{
        const ed=B.edges[e]; const far=ed.v[0]===v?ed.v[1]:ed.v[0];
        let s=vertexScore(G,B,far,pi,lvl)*0.55;
        for(const a of B.verts[far].adj) if(!G.buildings[a]) s+=vertexScore(G,B,a,pi,lvl)*0.22;
        return s;
      },lvl);
      placeSetupRoad(G,B,eid,edgeLand(B,eid)<1); SFX.build('road');
      return afterAction();
    }
    case 'roll': {
      const ki=p.dev.findIndex((c,i)=>c==='knight'&&playableDev(G,pi,i));
      if(ki>=0 && lvl.look>0 && B.verts && robberHitsMe(G,B,pi) && Math.random()<0.8){
        playDev(G,B,ki); SFX.knight();
        showTradeBanner('wait',`${p.name} ${gv(p,'שלח','שלחה')} אביר!`,'מזיז את השודד',[]); tresT=setTimeout(clearTradeBanner,2200);
        return afterAction();
      }
      return onAction('roll');
    }
    case 'discard': {
      const keys = isCK(G)?RES.concat(COM):RES;
      const picks={}; keys.forEach(r=>picks[r]=0);
      const {cost}=botNeedWeights(G,B,pi);
      const pool=[];
      RES.forEach(r=>{ for(let i=0;i<p.res[r];i++) pool.push(r); });
      if(isCK(G)) COM.forEach(c=>{ for(let i=0;i<p.com[c];i++) pool.push(c); });
      const held=r=>COM.indexOf(r)>=0?p.com[r]:p.res[r];
      pool.sort((a,b)=>((cost[b]||0)-(cost[a]||0)) || (held(b)-held(a)));
      for(let i=0;i<nd.n&&pool.length;i++){ const r=pool.pop(); picks[r]=(picks[r]||0)+1; }
      const dn=nd.n;
      if(!resolveDiscard(G,pi,picks)){ G.discardQueue.shift(); } else toast(p.name+' השליך '+dn+' קלפים',1600);
      return afterAction();
    }
    case 'gold': {
      const picks={}; RES.forEach(r=>picks[r]=0);
      const {want}=botNeedWeights(G,B,pi);
      for(let i=0;i<nd.n;i++){
        let pick=RES.filter(r=>want[r]>0&&G.bank[r]>0)[0];
        if(!pick) pick=RES.filter(r=>G.bank[r]>0).sort((a,b)=>p.res[a]-p.res[b])[0]||'wood';
        picks[pick]++; if(want[pick]) want[pick]--;
      }
      resolveGold(G,pi,picks); return afterAction();
    }
    case 'plenty': {
      const {want}=botNeedWeights(G,B,pi);
      const list=RES.filter(r=>want[r]>0); 
      const a=list[0]||RES.slice().sort((x,y)=>p.res[x]-p.res[y])[0];
      const b=list[1]||a;
      announceThen('ok',`${p.name} ${gv(p,'הפעיל','הפעילה')} שנת שפע!`, a===b?`${gv(p,'לוקח','לוקחת')} 2 ${RES_HE[a]}`:`${gv(p,'לוקח','לוקחת')} ${RES_HE[a]} ו${RES_HE[b]}`,()=>{
        doPlenty(ST.G,a,b); SFX.gain();
        toast(a===b ? `${p.name} ${gv(p,'הפעיל שנת שפע ולקח','הפעילה שנת שפע ולקחה')} 2 ${RES_HE[a]}` : `${p.name} ${gv(p,'הפעיל שנת שפע ולקח','הפעילה שנת שפע ולקחה')} ${RES_HE[a]} ו${RES_HE[b]}`);
        afterAction();
      });
      return;
    }
    case 'mono': {
      const {want}=botNeedWeights(G,B,pi);
      const pick=RES.filter(r=>want[r]>0)[0] || RES.slice().sort((x,y)=>p.res[x]-p.res[y])[0];
      announceThen('wait',`${p.name} ${gv(p,'הכריז','הכריזה')} מונופול!`,`כולם מוסרים את כל ה${RES_HE[pick]}`,()=>{
        const GG=ST.G; const n=GG.players.reduce((a,x)=>a+(x.idx===pi?0:x.res[pick]),0);
        doMonopoly(GG,pick); SFX.coins();
        toast(n>0 ? `${p.name} ${gv(p,'הכריז מונופול ולקח','הכריזה מונופול ולקחה')} ${n} ${RES_HE[pick]} מכולם` : `${p.name} ${gv(p,'הכריז','הכריזה')} מונופול על ${RES_HE[pick]} — אבל לאף אחד לא היה`);
        afterAction();
      });
      return;
    }
    case 'robber': {
      const legal=B.hexes.filter(h=>canPlaceRobber(G,B,h.id,pi)).map(h=>h.id);
      if(G.cfg.seafarers){                                   /* the pirate may take the robber's place */
        const landBest=legal.length?Math.max(...legal.map(id=>robberScore(G,B,id,pi,lvl))):-1e9;
        if(botTryPirate(G,B,pi,lvl,landBest+(robberHitsMe(G,B,pi)?5:0),false)) return afterAction();
      }
      const hid=bestOf(legal,id=>robberScore(G,B,id,pi,lvl),lvl);
      const h=B.hexById[G.robber];
      robberAnim={from:toScreen(h.x,h.y),t0:T,t1:T+0.55};
      const targets=robberTargets(G,B,hid,pi);
      let victim=null;
      if(targets.length) victim=targets.sort((a,b)=>
        (vpPublic(G,b)-vpPublic(G,a))||(totalCards(G.players[b])-totalCards(G.players[a])))[0];
      moveRobber(G,B,hid,victim); SFX.robber();
      return afterAction();
    }
    case 'steal': {
      const t=(G.pendingSteal||[]).sort((a,b)=>totalCards(G.players[b])-totalCards(G.players[a]))[0];
      if(G.stealPirate) movePirate(G,B,G.pirate,t); else moveRobber(G,B,G.robber,t);
      SFX.robber(); return afterAction();
    }
    case 'freeroad': {
      const legal=legalRoadSpots(G,B,pi,false);
      if(!legal.length){ G.freeRoads=0; G.sub=homeSub(G); return afterAction(); }
      const wasFirst = G.freeRoads===2;
      if(wasFirst){ SFX.roadCard(); showTradeBanner('ok',`${p.name} ${gv(p,'שיחק','שיחקה')} בניית דרכים!`,'שתי דרכים בחינם',[]); tresT=setTimeout(clearTradeBanner,2200); }
      const eid=bestOf(legal,e=>roadScore(G,B,e,pi,lvl),lvl);
      buildRoad(G,B,eid,false,true); G.freeRoads--;
      if(G.freeRoads<=0) G.sub=homeSub(G);
      SFX.build('road'); return afterAction();
    }
    case 'offer': {
      if(G.offer && G.offer.from!==pi){ replyOffer(G,pi,botAcceptsOffer(G,pi,G.offer)); return afterAction(); }
      G.offer=null; return afterAction();
    }
    case 'main': case 'special': return botMain(G,B,pi,lvl,nd.kind==='special');
    default:
      if(CK_PICK_SUBS.indexOf(nd.kind)>=0) return botCkPick(G,B,pi,lvl);
      if(CK_BOARD_SUBS[nd.kind]) return botCkBoard(G,B,pi,lvl,nd.kind);
      return;
  }
}
function robberHitsMe(G,B,pi){
  const h=B.hexById[G.robber]; if(!h) return false;
  const c={x:h.x,y:h.y};
  for(let i=0;i<6;i++){ const b=G.buildings[vKey(hexCorner(c,i))]; if(b&&b.p===pi) return true; }
  return false;
}
function robberScore(G,B,hid,pi,lvl){
  const h=B.hexById[hid]; if(!h) return -99;
  const c={x:h.x,y:h.y};
  let s=0, mine=0;
  const lead=Math.max(...G.players.map((x,i)=>vpPublic(G,i)));
  for(let i=0;i<6;i++){
    const b=G.buildings[vKey(hexCorner(c,i))]; if(!b) continue;
    const mult=b.t==='c'?2:1;
    if(b.p===pi){ mine+=PIP(h.num)*mult*4; continue; }
    let w=PIP(h.num)*mult;
    if(lvl.block>0 && vpPublic(G,b.p)>=lead-1) w*= (1+lvl.block);
    if(totalCards(G.players[b.p])>0) w+=1.5;
    s+=w;
  }
  return s-mine + (Math.random()*0.6);
}
function roadScore(G,B,eid,pi,lvl){
  const e=B.edges[eid]; let s=Math.random()*0.5;
  for(const v of e.v){
    if(canSettle(G,B,v,pi,true)) s+=vertexScore(G,B,v,pi,lvl)*0.8;
    for(const a of B.verts[v].adj) if(!G.buildings[a]&&canSettle(G,B,a,pi,true))
      s+=vertexScore(G,B,a,pi,lvl)*0.25;
  }
  if(lvl.look>1 && G.longest.p!==pi && (G.players[pi].roadLen||0)>=3) s+=2;
  return s;
}
function botAcceptsOffer(G,pi,o){
  const p=G.players[pi], lvl=botCfg(p);
  if(lvl.id==='expert' && !isCK(G)) return xAcceptOffer(G,pi,o);
  for(const r of RES) if((o.want[r]||0)>p.res[r]) return false;
  let give=0,get=0;
  const {cost}=botNeedWeights(G,ST.B,pi);
  RES.forEach(r=>{
    get += (o.give[r]||0)*(1+((cost[r]||0)?1.2:0));
    const asked=o.want[r]||0;
    /* giving away your last card(s) of a type costs extra — but only for what is actually asked */
    give += asked*(1+((cost[r]||0)?1.6:0)) + (asked>0 && p.res[r]<=asked ? 0.8 : 0);
  });
  if(lvl.look===0) return Math.random()<0.5;
  if(lvl.look>1 && vpPublic(G,o.from)>=Math.max(...G.players.map((x,i)=>vpPublic(G,i)))) give*=1.4;
  return get > give*1.02;
}

function botCkPick(G,B,pi,lvl){
  const p=G.players[pi], ch=ckChoice(G);
  if(!ch||!ch.options.length){ if(G.sub==='improve') ckResolve(G,B,null); else G.sub=homeSub(G); return afterAction(); }
  let pick=ch.options[0].id;
  if(G.sub==='improve'){
    const order=ch.options.slice().sort((a,b)=>{
      const ta=TRACK_BY[a.id], tb=TRACK_BY[b.id];
      const wa=(a.id==='pol'&&p.kn.length&&p.imp.pol<3?6:0)+(p.imp[a.id]===3?4:0)+p.com[ta.com];
      const wb=(b.id==='pol'&&p.kn.length&&p.imp.pol<3?6:0)+(p.imp[b.id]===3?4:0)+p.com[tb.com];
      return wb-wa;
    });
    pick=order[0].id;
  } else if(G.sub==='resmono'||G.sub==='fleet'){
    const {want}=botNeedWeights(G,B,pi);
    pick=(ch.options.find(o=>want[o.id]>0)||ch.options[0]).id;
  } else if(G.sub==='trademono'){
    const tr=TRACKS.slice().sort((a,b)=>p.imp[b.id]-p.imp[a.id])[0];
    pick=(ch.options.find(o=>o.id===tr.com)||ch.options[0]).id;
  } else if(G.sub==='master'||G.sub==='deserter'){
    pick=ch.options[randInt(ch.options.length)].id;
  }
  ckResolve(G,B,pick);
  return afterAction();
}
function botCkBoard(G,B,pi,lvl,kind){
  const legal=ckBoardLegal(G,B);
  if(!legal.length){ G.sub=homeSub(G); G.movingKnight=null; G.freeKnight=null; return afterAction(); }
  let id;
  if(kind==='bishop'||kind==='knightRobber') id=bestOf(legal,x=>robberScore(G,B,x,pi,lvl),lvl);
  else if(kind==='merchantPlace') id=bestOf(legal,x=>PIP(B.hexById[x].num),lvl);
  else if(kind==='knightMove') id=bestOf(legal,x=>(knightAt(G,x)?12:0)+Math.random(),lvl);
  else id=bestOf(legal,x=>vertexScore(G,B,x,pi,lvl)*0.4+Math.random(),lvl);
  ckPlaceBoard(G,B,id);
  SFX.knight();
  return afterAction();
}
function botCK(G,B,pi,lvl,special){
  const p=G.players[pi];
  const urgent = G.barb.pos>=G.barb.len-2;
  /* play a progress card */
  if(!special && p.prog.length && (lvl.look>0?Math.random()<0.5:Math.random()<0.25)){
    const i=randInt(p.prog.length);
    if(playProg(G,B,pi,i)){ SFX.knight(); return true; }
  }
  /* improvements first — they are the only route to 13 points */
  const tracks=TRACKS.filter(t=>canImprove(G,pi,t.id));
  if(tracks.length && (lvl.look>0 ? true : Math.random()<0.6)){
    const t=tracks.sort((a,b)=>
      ((b.id==='pol'&&p.kn.length?3:0)+p.com[b.com]) - ((a.id==='pol'&&p.kn.length?3:0)+p.com[a.com]))[0];
    if(doImprove(G,pi,t.id)){
      SFX.build('city');
      if(G.metroPick) G.sub='metroPick';
      return true;
    }
  }
  /* keep enough knights alive to matter */
  const strength=knStrength(p);
  const inactive=p.kn.filter(k=>!k.act);
  if(inactive.length && canAfford(p,CK_COST.activate) && (urgent||strength<1||Math.random()<0.5)){
    if(activateKnight(G,pi,inactive[0].id,false)){ SFX.knight(); return true; }
  }
  if(p.kn.length<(lvl.look>1?3:2) && canAfford(p,CK_COST.knight) && p.knightsLeft[1]>0){
    const spots=legalKnightSpots(G,B,pi);
    if(spots.length){
      const vid=bestOf(spots,v=>vertexScore(G,B,v,pi,lvl)*0.3+Math.random(),lvl);
      if(buildKnight(G,B,vid,pi,false)){ SFX.knight(); return true; }
    }
  }
  if(lvl.look>1 && canWall(G,pi) && p.walls<2 && Math.random()<0.4){
    if(buildWall(G,pi,false)) return true;
  }
  return false;
}
function botMain(G,B,pi,lvl,special){
  const p=G.players[pi];
  if(isCK(G) && botCK(G,B,pi,lvl,special)) return afterAction();
  /* 1. play a useful development card */
  if(!isCK(G)){
    for(let i=0;i<p.dev.length;i++){
      if(!playableDev(G,pi,i)) continue;
      const c=p.dev[i];
      if(c==='knight' && lvl.look>0 && (robberHitsMe(G,B,pi)||Math.random()<0.25)){ playDev(G,B,i); SFX.knight(); return afterAction(); }
      if(c==='road' && p.roadsLeft>1 && legalRoadSpots(G,B,pi,false).length>1 && lvl.look>0){ playDev(G,B,i); return afterAction(); }
      if(c==='plenty' && lvl.look>0){ playDev(G,B,i); SFX.plentyCard(); return afterAction(); }
      if(c==='mono' && lvl.look>1 && Math.random()<0.5){ playDev(G,B,i); SFX.monoCard(); return afterAction(); }
    }
  }
  /* 1b. Seafarers: a free ship move, before building, since it may open a new place to settle */
  if(!special && botMoveShip(G,B,pi,lvl)) return afterAction();
  /* 2. build, best first */
  const cities=legalCitySpots(G,B,pi);
  if(cities.length && canAfford(p,COST.city)){
    const vid=bestOf(cities,v=>vertexScore(G,B,v,pi,lvl),lvl);
    if(buildCity(G,B,vid)){ buildAnim[vid]=T; spawnBurst(B.verts[vid].x,B.verts[vid].y,'#FFE9A8',20);
      SFX.build('city'); toast(noteDeed(G,'city')); return afterAction(); }
  }
  const setts=legalSettleSpots(G,B,pi,false);
  if(setts.length && canAfford(p,COST.settlement)){
    const vid=bestOf(setts,v=>vertexScore(G,B,v,pi,lvl),lvl);
    if(buildSettlement(G,B,vid)){ buildAnim[vid]=T; spawnBurst(B.verts[vid].x,B.verts[vid].y,colOf(G,pi).hex,14);
      SFX.build('sett'); toast(noteDeed(G,'sett')); return afterAction(); }
  }
  const goal=botGoal(G,B,pi);
  if((goal==='road'||setts.length===0||Math.random()<0.45) && canAfford(p,COST.road)){
    const roads=legalRoadSpots(G,B,pi,false);
    if(roads.length){
      const eid=bestOf(roads,e=>roadScore(G,B,e,pi,lvl),lvl);
      if(roadScore(G,B,eid,pi,lvl)>1.2 || lvl.look===0){
        if(buildRoad(G,B,eid,false,false)){ SFX.build('road'); toast(noteDeed(G,'road')); return afterAction(); }
      }
    }
  }
  if(G.cfg.seafarers && canAfford(p,COST.ship) && Math.random()<0.4){
    const ships=legalRoadSpots(G,B,pi,true);
    if(ships.length){ const eid=bestOf(ships,e=>roadScore(G,B,e,pi,lvl),lvl);
      if(buildRoad(G,B,eid,true,false)){ SFX.build('ship'); toast(noteDeed(G,'ship')); return afterAction(); } }
  }
  if(!isCK(G) && canAfford(p,COST.dev) && G.devDeck.length && (lvl.look>0?Math.random()<0.6:Math.random()<0.35)){
    if(buyDev(G)){ SFX.buyCard(); devCardFly(pi,noteDeed(G,'dev')); return afterAction(); }
  }
  /* 3. trade to close the gap, then try again next tick */
  if(botBankTrade(G,B,pi)){ SFX.coins(); return afterAction(); }
  /* 4. nothing left */
  if(checkWin(G)){ SFX.win(); return afterAction(); }
  endTurn(G,B); ST.place=null;
  return afterAction();
}

