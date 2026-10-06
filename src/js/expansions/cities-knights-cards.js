/* =========================================================
   CK2. PROGRESS CARDS + a single generic "choose one" flow
   ========================================================= */
const CK_PICK_SUBS = ['improve','metroPick','resmono','trademono','fleet','master','deserter','smith'];
const CK_BOARD_SUBS = {merchantPlace:'hex', bishop:'hex', knightRobber:'hex',
  deserterPlace:'vertex', knightPlace:'vertex', knightMove:'vertex'};

function playProg(G,B,pi,idx){
  const p=G.players[pi]; const id=p.prog[idx]; if(!id) return false;
  if(G.sub!=='main'&&G.sub!=='roll'&&G.sub!=='special') return false;
  p.prog.splice(idx,1);
  logit(G,`${p.name} שיחק ${PROG[id].t}`);
  switch(id){
    case 'printer': case 'constit': p.vpProg++; break;
    case 'roadb': G.freeRoads=2; G.sub='freeroad'; break;
    case 'engineer': if(!buildWall(G,pi,true)) logit(G,'אין עיר פנויה לחומה'); break;
    case 'warlord': p.kn.forEach(k=>k.act=true); logit(G,`${p.name} הפעיל את כל האבירים`); break;
    case 'crane': p.craneOn=true; G.sub='improve'; break;
    case 'medicine': p.medicineOn=true; break;
    case 'smith': G.smithLeft=2; G.sub='smith'; break;
    case 'irrig': ckHarvest(G,B,pi,'fields','wheat'); break;
    case 'mining': ckHarvest(G,B,pi,'mountains','ore'); break;
    case 'merchant': G.sub='merchantPlace'; break;
    case 'bishop': G.sub='bishop'; break;
    case 'resmono': G.sub='resmono'; break;
    case 'trademono': G.sub='trademono'; break;
    case 'fleet': G.sub='fleet'; break;
    case 'master': {
      const opts=G.players.filter(o=>o.idx!==pi && vpTotal(G,o.idx)>vpTotal(G,pi) && ckHand(o)>0);
      if(!opts.length){ logit(G,'אף אחד לא מוביל עליכם'); break; }
      G.sub='master'; break; }
    case 'deserter': {
      const opts=G.players.filter(o=>o.idx!==pi && (o.kn||[]).length>0);
      if(!opts.length){ logit(G,'לאף אחד אין אבירים'); break; }
      G.sub='deserter'; break; }
    case 'wedding': {
      G.players.forEach(o=>{
        if(o.idx===pi||vpTotal(G,o.idx)<=vpTotal(G,pi)) return;
        for(let i=0;i<2;i++){
          const pool=[]; RES.forEach(r=>{for(let k=0;k<o.res[r];k++)pool.push(['res',r]);});
          COM.forEach(c=>{for(let k=0;k<o.com[c];k++)pool.push(['com',c]);});
          if(!pool.length) break;
          const [kind,key]=pool[randInt(pool.length)];
          if(kind==='res'){ o.res[key]--; p.res[key]++; } else { o.com[key]--; p.com[key]++; }
        }
        logit(G,`${o.name} שילם מתנת חתונה`);
      });
      break; }
    case 'saboteur': {
      const mine=vpTotal(G,pi);
      G.players.forEach(o=>{
        if(o.idx===pi) return;
        if(vpTotal(G,o.idx)<mine) return;
        const n=Math.floor(ckHand(o)/2);
        if(n>0) G.discardQueue.push({p:o.idx,n});
      });
      break; }
  }
  return true;
}
function ckHarvest(G,B,pi,terrain,res){
  const p=G.players[pi]; let n=0;
  const seen={};
  for(const vid in G.buildings){
    if(G.buildings[vid].p!==pi) continue;
    for(const hid of B.verts[vid].hexes){
      if(seen[hid]) continue;
      const h=B.hexById[hid];
      if(h&&h.terrain===terrain){ seen[hid]=1; n+=2; }
    }
  }
  if(n>0){ const got=give(G,p,res,n); logit(G,`${p.name} אסף ${got} ${RES_HE[res]}`); }
  else logit(G,'אין משושים מתאימים');
}

/* ---------- the generic chooser ---------- */
function ckChoice(G){
  const pi=G.turn, p=G.players[pi];
  switch(G.sub){
    case 'improve': return {kind:'track', title:'שיפור עיר',
      sub: p.craneOn?'המנוף מוזיל את השיפור הזה בסחורה אחת':'בוחרים מסלול לשדרוג',
      options: TRACKS.filter(t=>canImprove(G,pi,t.id)).map(t=>{
        let c=impCost(p.imp[t.id]+1); if(p.craneOn) c=Math.max(1,c-1);
        return {id:t.id, label:`${t.he} → דרגה ${p.imp[t.id]+1}`, note:`${c} ${COM_HE[t.com]}`, col:t.col};
      }), cancel:true};
    case 'metroPick': {
      const q=G.metroPick; if(!q) return null;
      return {kind:'vertexList', title:'איפה יעמוד המטרופולין?',
        sub:'בוחרים איזו עיר הופכת למטרופולין',
        options:q.options.map((v,i)=>({id:v,label:'עיר '+(i+1)}))};
    }
    case 'resmono': return {kind:'res', title:'מונופול משאב',
      sub:'כל שחקן מוסר לכם עד 2 יחידות', options:RES.map(r=>({id:r,label:RES_HE[r]}))};
    case 'trademono': return {kind:'com', title:'מונופול סחורה',
      sub:'כל שחקן מוסר לכם יחידה אחת', options:COM.map(c=>({id:c,label:COM_HE[c]}))};
    case 'fleet': return {kind:'rescom', title:'צי סוחר',
      sub:'יחס 2:1 בקלף אחד עד סוף התור',
      options:RES.map(r=>({id:r,label:RES_HE[r]})).concat(COM.map(c=>({id:c,label:COM_HE[c]})))};
    case 'master': return {kind:'player', title:'סוחר בכיר',
      sub:'שני קלפים אקראיים משחקן שמוביל עליכם',
      options:G.players.filter(o=>o.idx!==pi&&vpTotal(G,o.idx)>vpTotal(G,pi)&&ckHand(o)>0)
        .map(o=>({id:o.idx,label:o.name+' · '+ckHand(o)+' קלפים'}))};
    case 'deserter': return {kind:'player', title:'עריק',
      sub:'שחקן שתבחרו מאבד אביר, ואתם מקבלים אחד באותה דרגה',
      options:G.players.filter(o=>o.idx!==pi&&(o.kn||[]).length>0)
        .map(o=>({id:o.idx,label:o.name+' · '+o.kn.length+' אבירים'}))};
    case 'smith': {
      const list=p.kn.filter(k=>canPromote(G,pi,k));
      if(!list.length) return null;
      return {kind:'knight', title:'נפח', sub:`קידום חינם (${G.smithLeft} נותרו)`,
        options:list.map(k=>({id:k.id,label:KN_HE[k.lvl]+' → '+KN_HE[k.lvl+1]}))};
    }
  }
  return null;
}
function ckResolve(G,B,value){
  const pi=G.turn, p=G.players[pi];
  switch(G.sub){
    case 'improve':
      if(value===null){ p.craneOn=false; G.sub=homeSub(G); return true; }
      doImprove(G,pi,value);
      G.sub = G.metroPick ? 'metroPick' : homeSub(G);
      return true;
    case 'metroPick': {
      const q=G.metroPick; if(!q) { G.sub=homeSub(G); return true; }
      G.metroAt[q.track]=value; G.metroPick=null; G.sub=homeSub(G); return true;
    }
    case 'resmono': {
      let n=0;
      G.players.forEach(o=>{ if(o.idx===pi) return;
        const t=Math.min(2,o.res[value]); o.res[value]-=t; p.res[value]+=t; n+=t; });
      logit(G,`${p.name} לקח ${n} ${RES_HE[value]}`); G.sub=homeSub(G); return true;
    }
    case 'trademono': {
      let n=0;
      G.players.forEach(o=>{ if(o.idx===pi) return;
        if(o.com[value]>0){ o.com[value]--; p.com[value]++; n++; } });
      logit(G,`${p.name} לקח ${n} ${COM_HE[value]}`); G.sub=homeSub(G); return true;
    }
    case 'fleet': p.fleetRes=value; logit(G,`${p.name} מפעיל צי סוחר`); G.sub=homeSub(G); return true;
    case 'master': {
      const o=G.players[value];
      for(let i=0;i<2;i++){
        const pool=[]; RES.forEach(r=>{for(let k=0;k<o.res[r];k++)pool.push(['res',r]);});
        COM.forEach(c=>{for(let k=0;k<o.com[c];k++)pool.push(['com',c]);});
        if(!pool.length) break;
        const [kind,key]=pool[randInt(pool.length)];
        if(kind==='res'){ o.res[key]--; p.res[key]++; } else { o.com[key]--; p.com[key]++; }
      }
      logit(G,`${p.name} שדד שני קלפים מ${o.name}`); G.sub=homeSub(G); return true;
    }
    case 'deserter': {
      const o=G.players[value];
      const k=o.kn.slice().sort((a,b)=>b.lvl-a.lvl)[0];
      if(k){ o.kn=o.kn.filter(x=>x.id!==k.id); o.knightsLeft[k.lvl]++;
        logit(G,`${o.name} איבד ${KN_HE[k.lvl]}`);
        G.freeKnight={lvl:k.lvl};
        if(legalKnightSpots(G,B,pi).length && p.knightsLeft[k.lvl]>0){ G.sub='deserterPlace'; return true; }
        G.freeKnight=null;
      }
      G.sub=homeSub(G); return true;
    }
    case 'smith': {
      promoteKnight(G,pi,value,true);
      G.smithLeft--;
      const left=p.kn.filter(k=>canPromote(G,pi,k));
      if(G.smithLeft>0 && left.length) return true;
      G.smithLeft=0; G.sub=homeSub(G); return true;
    }
  }
  return false;
}
function ckPlaceBoard(G,B,id){
  const pi=G.turn, p=G.players[pi];
  switch(G.sub){
    case 'merchantPlace':
      G.merchant={hex:id, p:pi};
      logit(G,`${p.name} הציב את הסוחר`); G.sub=homeSub(G); return true;
    case 'bishop': {
      G.robber=id;
      const h=B.hexById[id], c={x:h.x,y:h.y}, hit={};
      for(let i=0;i<6;i++){ const b=G.buildings[vKey(hexCorner(c,i))];
        if(b&&b.p!==pi) hit[b.p]=1; }
      let n=0;
      Object.keys(hit).forEach(k=>{
        const o=G.players[+k];
        const pool=[]; RES.forEach(r=>{for(let i=0;i<o.res[r];i++)pool.push(['res',r]);});
        COM.forEach(cc=>{for(let i=0;i<o.com[cc];i++)pool.push(['com',cc]);});
        if(!pool.length) return;
        const [kind,key]=pool[randInt(pool.length)];
        if(kind==='res'){ o.res[key]--; p.res[key]++; } else { o.com[key]--; p.com[key]++; }
        n++;
      });
      logit(G,`הבישוף גבה ${n} קלפים`); G.sub=homeSub(G); return true;
    }
    case 'deserterPlace': {
      const lvl=(G.freeKnight&&G.freeKnight.lvl)||1;
      if(!canPlaceKnight(G,B,id,pi)) return false;
      p.kn.push({v:id,lvl,act:false,id:'k'+(G.knSeq=(G.knSeq||0)+1)});
      p.knightsLeft[lvl]--;
      G.freeKnight=null; G.sub=homeSub(G); updateLongest(G,B);
      logit(G,`${p.name} קיבל ${KN_HE[lvl]}`); return true;
    }
    case 'knightPlace':
      if(!buildKnight(G,B,id,pi,false)) return false;
      G.sub=homeSub(G); return true;
    case 'knightMove': {
      const kid=G.movingKnight;
      if(!moveKnight(G,B,kid,pi,id)) return false;
      G.movingKnight=null; G.sub=homeSub(G); return true;
    }
    case 'knightRobber': {
      const kid=G.movingKnight, k=p.kn.find(x=>x.id===kid);
      const hh=B.hexById[G.robber];
      G.robber=id; if(k){ k.act=false; p.actedKn[kid]=1; }
      G.movingKnight=null;
      const targets=robberTargets(G,B,id,pi);
      if(targets.length===1){ G.sub=homeSub(G); moveRobber(G,B,id,targets[0]); }
      else if(!targets.length){ G.sub=homeSub(G); logit(G,`${p.name} גירש את השודד`); }
      else { G.pendingSteal=targets; G.sub='steal'; }
      return true;
    }
  }
  return false;
}
function ckBoardLegal(G,B){
  const pi=G.turn;
  switch(G.sub){
    case 'merchantPlace': return B.hexes.filter(h=>{
      if(!TERRAIN_RES[h.terrain]||TERRAIN_RES[h.terrain]==='gold') return false;
      const c={x:h.x,y:h.y};
      for(let i=0;i<6;i++){ const b=G.buildings[vKey(hexCorner(c,i))]; if(b&&b.p===pi) return true; }
      return false;
    }).map(h=>h.id);
    case 'bishop': return B.hexes.filter(h=>h.id!==G.robber).map(h=>h.id);
    case 'deserterPlace': case 'knightPlace': return legalKnightSpots(G,B,pi);
    case 'knightMove': return knightMoveTargets(G,B,G.movingKnight,pi);
    case 'knightRobber': return knightRobberTargets(G,B,G.movingKnight,pi);
  }
  return [];
}

