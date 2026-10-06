/* =========================================================
   CK. CITIES & KNIGHTS
   ========================================================= */
const COM = ['paper','cloth','coin'];
const COM_HE = {paper:'נייר', cloth:'בד', coin:'מטבע'};
const TRACKS = [
  {id:'sci',   com:'paper', he:'מדע',     col:'#4FB286', lvl3:'אמת מים', ab:'אם גלגול לא הניב לכם כלום — קחו משאב אחד לבחירתכם'},
  {id:'trade', com:'cloth', he:'מסחר',    col:'#E0A93B', lvl3:'בית מסחר', ab:'החלפת 2 סחורות זהות מול הבנק בכל קלף'},
  {id:'pol',   com:'coin',  he:'פוליטיקה',col:'#5B8FD4', lvl3:'מצודה',   ab:'אפשר לקדם אבירים לדרגה 3 (אביר אדיר)'}
];
const TRACK_BY = {}; TRACKS.forEach(t=>TRACK_BY[t.id]=t);
const CK_COST = {knight:{ore:1,sheep:1}, activate:{wheat:1}, promote:{ore:1,sheep:1}, wall:{brick:2}};
const CK_COST_HE = {knight:'אבן + צמר', activate:'חיטה', promote:'אבן + צמר', wall:'2 לבנים'};
const KN_HE = ['','אביר בסיסי','אביר חזק','אביר אדיר'];
const EVENT_FACES = ['ship','ship','ship','sci','trade','pol'];

const PROG = {
  /* --- science (paper) --- */
  crane:   {deck:'sci', n:2, t:'מנוף',        d:'שיפור עיר אחד עולה סחורה אחת פחות — עכשיו.'},
  engineer:{deck:'sci', n:1, t:'מהנדס',       d:'חומת מגן אחת בחינם על עיר שלכם.'},
  irrig:   {deck:'sci', n:2, t:'השקיה',       d:'2 חיטה על כל משושה שדות שנוגע ביישוב או עיר שלכם.'},
  mining:  {deck:'sci', n:2, t:'כרייה',       d:'2 אבן על כל משושה הרים שנוגע ביישוב או עיר שלכם.'},
  medicine:{deck:'sci', n:2, t:'רפואה',       d:'שדרוג יישוב לעיר תמורת 2 אבן וחיטה אחת בלבד.'},
  printer: {deck:'sci', n:1, t:'דפוס',        d:'נקודת ניצחון קבועה.'},
  roadb:   {deck:'sci', n:2, t:'סלילת דרכים', d:'שתי דרכים בחינם.'},
  smith:   {deck:'sci', n:2, t:'נפח',         d:'קידום שני אבירים בחינם.'},
  /* --- trade (cloth) --- */
  merchant:{deck:'trade', n:4, t:'סוחר',        d:'מניחים את הסוחר על משושה ליד בנייה שלכם — יחס 2:1 במשאב שלו, ועוד נקודה.'},
  master:  {deck:'trade', n:2, t:'סוחר בכיר',   d:'שני קלפים אקראיים משחקן שמוביל עליכם בנקודות.'},
  resmono: {deck:'trade', n:3, t:'מונופול משאב',d:'כל שחקן מוסר לכם עד 2 יחידות ממשאב שתבחרו.'},
  trademono:{deck:'trade',n:2, t:'מונופול סחורה',d:'כל שחקן מוסר לכם יחידה אחת מסחורה שתבחרו.'},
  fleet:   {deck:'trade', n:2, t:'צי סוחר',     d:'יחס 2:1 במשאב או סחורה אחת עד סוף התור.'},
  /* --- politics (coin) --- */
  bishop:  {deck:'pol', n:2, t:'הבישוף',      d:'מזיזים את השודד וגונבים קלף מכל שחקן שנוגע במשושה.'},
  constit: {deck:'pol', n:1, t:'חוקה',        d:'נקודת ניצחון קבועה.'},
  deserter:{deck:'pol', n:2, t:'עריק',        d:'שחקן שתבחרו מאבד אביר — ואתם מקבלים אביר באותה דרגה בחינם.'},
  warlord: {deck:'pol', n:2, t:'מצביא',       d:'כל האבירים שלכם מופעלים בחינם.'},
  wedding: {deck:'pol', n:2, t:'חתונה',       d:'כל שחקן שמוביל עליכם בנקודות מוסר לכם 2 קלפים.'},
  saboteur:{deck:'pol', n:2, t:'חבלן',        d:'כל שחקן עם נקודות כמוכם או יותר משליך חצי מקלפיו.'}
};
/* not implemented here, and therefore not in the decks:
   אלכימאי, ממציא, נמל מסחרי, מרגל, תככים, דיפלומט */

function ckInit(G){
  G.cfg.target = 13;
  G.barb = {pos:0, len:7, attacks:0};
  G.metro = {sci:-1, trade:-1, pol:-1};
  G.metroAt = {sci:null, trade:null, pol:null};
  G.eventDie='sci'; G.redDie=0;
  G.merchant = {hex:null, p:-1};
  G.progDeck = {sci:[],trade:[],pol:[]};
  Object.keys(PROG).forEach(k=>{ for(let i=0;i<PROG[k].n;i++) G.progDeck[PROG[k].deck].push(k); });
  Object.keys(G.progDeck).forEach(k=>shuffleTrue(G.progDeck[k]));
  G.devDeck=[];
  G.players.forEach(p=>{
    p.com={paper:0,cloth:0,coin:0};
    p.imp={sci:0,trade:0,pol:0};
    p.kn=[]; p.prog=[]; p.walls=0; p.defender=0; p.vpProg=0;
    p.knightsLeft={1:2,2:2,3:2};
    p.actedKn={}; p.fleetRes=null; p.craneOn=false; p.medicineOn=false;
  });
}
const isCK = G => !!(G.cfg && G.cfg.ck);
const comTotal = p => p.com ? COM.reduce((s,c)=>s+p.com[c],0) : 0;
const handLimit = p => 7 + (p.walls||0)*2;
function knStrength(p){ return (p.kn||[]).reduce((s,k)=>s+(k.act?k.lvl:0),0); }
function cityCount(G){ let n=0; for(const v in G.buildings) if(G.buildings[v].t==='c') n++; return n; }
function isMetro(G,vid){ return Object.keys(G.metroAt).some(k=>G.metroAt[k]===vid); }

/* ---------- the extra dice ---------- */
function ckRoll(G,B){
  const [red,yellow]=rollPair(G);
  const ev=(G.forcedEv&&G.forcedEv.length)?G.forcedEv.shift():EVENT_FACES[randInt(6)];
  G.dice=[red,yellow]; G.redDie=red; G.eventDie=ev;
  const sum=red+yellow; G.lastRoll=sum;
  P(G).rolled=true;
  /* 1. the event resolves first */
  if(ev==='ship'){
    G.barb.pos++;
    logit(G,`ספינת הברברים מתקדמת (${G.barb.pos}/${G.barb.len})`);
    if(G.barb.pos>=G.barb.len) ckBarbarianAttack(G,B);
  } else {
    const tr=TRACK_BY[ev];
    G.players.forEach(p=>{
      if(p.imp[ev]>=1 && red<=p.imp[ev]+1){
        if(p.prog.length>=4){ logit(G,`${p.name} כבר מחזיק 4 קלפי קִדמה`); return; }
        const c=ckGive(G,p.idx,ev);
        if(c) logit(G,`${p.name} משך קלף ${tr.he} — ${PROG[c].t}`);
      }
    });
  }
  /* 2. then production */
  if(sum===7){
    G.sub='robber';
    G.discardQueue=G.players.filter(p=>ckHand(p)>handLimit(p))
      .map(p=>({p:p.idx,n:Math.floor(ckHand(p)/2)}));
    logit(G,'יצא 7 — השודד זז');
  } else {
    const rep=produce(G,B,sum);
    G.sub=homeSub(G);
    logit(G,`יצא ${sum}${rep?' — '+rep:''}`);
  }
  return sum;
}
const ckHand = p => RES.reduce((s,r)=>s+p.res[r],0) + comTotal(p);

function ckGive(G,pIdx,deck){
  const d=G.progDeck[deck]; if(!d||!d.length) return null;
  const p=G.players[pIdx];
  if(p.prog.length>=4) return null;
  const c=d.pop(); p.prog.push(c); return c;
}

/* ---------- barbarians ---------- */
function ckBarbarianAttack(G,B){
  G.barb.pos=0; G.barb.attacks++;
  const strengths=G.players.map(p=>knStrength(p));
  const total=strengths.reduce((a,b)=>a+b,0);
  const cities=cityCount(G);
  logit(G,`⚔ הברברים נחתו! כוח אבירים ${total} מול ${cities} ערים`);
  if(total>=cities){
    const max=Math.max(...strengths);
    const top=G.players.filter((p,i)=>strengths[i]===max && max>0);
    if(top.length===1){
      top[0].defender++;
      logit(G,`${top[0].name} הדף את הפלישה וזכה במגן קטאן (+1 נק׳)`);
    } else if(top.length>1){
      top.forEach(p=>{
        const deck=TRACKS[randInt(3)].id;
        if(ckGive(G,p.idx,deck)) logit(G,`${p.name} תרם להגנה וקיבל קלף קִדמה`);
      });
    } else logit(G,'האי הוגן — אבל אף אחד לא הצטיין');
  } else {
    const withCities=G.players.filter(p=>ckLosableCities(G,p.idx).length>0);
    if(!withCities.length){ logit(G,'אין ערים לפגוע בהן'); }
    else {
      const min=Math.min(...withCities.map(p=>knStrength(p)));
      withCities.filter(p=>knStrength(p)===min).forEach(p=>{
        const list=ckLosableCities(G,p.idx);
        /* the least productive city falls first */
        list.sort((a,b)=>cityValue(G,B,a)-cityValue(G,B,b));
        const vid=list[0];
        G.buildings[vid].t='s'; p.cityLeft++; p.settLeft--;
        if(p.walls>0) p.walls--;
        logit(G,`${p.name} איבד עיר לברברים`);
      });
    }
  }
  /* every knight is spent defending */
  G.players.forEach(p=>(p.kn||[]).forEach(k=>k.act=false));
}
function ckLosableCities(G,pIdx){
  const out=[];
  for(const vid in G.buildings){
    const b=G.buildings[vid];
    if(b.p===pIdx && b.t==='c' && !isMetro(G,vid)) out.push(vid);
  }
  return out;
}
function cityValue(G,B,vid){
  const v=B.verts[vid]; if(!v) return 0;
  return v.hexes.reduce((s,hid)=>{ const h=B.hexById[hid];
    return s+(h&&h.num?6-Math.abs(7-h.num):0); },0);
}

/* ---------- city improvements ---------- */
function impCost(level){ return level; }
function canImprove(G,pIdx,track){
  const p=G.players[pIdx];
  if(!p.imp) return false;
  const lv=p.imp[track];
  if(lv>=5) return false;
  const next=lv+1;
  let need=impCost(next); if(p.craneOn) need=Math.max(1,need-1);
  if(p.com[TRACK_BY[track].com]<need) return false;
  let hasCity=false;
  for(const vid in G.buildings) if(G.buildings[vid].p===pIdx&&G.buildings[vid].t==='c') hasCity=true;
  if(!hasCity) return false;
  if(next>=4){
    /* needs a city that is not already a metropolis */
    let free=false;
    for(const vid in G.buildings){
      const b=G.buildings[vid];
      if(b.p===pIdx&&b.t==='c'&&!isMetro(G,vid)) free=true;
    }
    if(!free && G.metroAt[track]===null) return false;
  }
  return true;
}
function doImprove(G,pIdx,track){
  if(!canImprove(G,pIdx,track)) return false;
  const p=G.players[pIdx], tr=TRACK_BY[track];
  const next=p.imp[track]+1;
  let need=impCost(next);
  if(p.craneOn){ need=Math.max(1,need-1); p.craneOn=false; }
  p.com[tr.com]-=need;
  p.imp[track]=next;
  logit(G,`${p.name} שיפר ${tr.he} לדרגה ${next}`);
  if(next===3) logit(G,`${p.name} בנה ${tr.lvl3}`);
  /* metropolis */
  if(next>=4){
    const holder=G.metro[track];
    const take = (holder<0) || (next===5 && holder>=0 && holder!==pIdx && G.players[holder].imp[track]<5);
    if(take){
      if(holder>=0){
        logit(G,`${p.name} חטף את מטרופולין ${tr.he} מ${G.players[holder].name}`);
      } else logit(G,`${p.name} הקים מטרופולין ${tr.he} (+2 נק׳)`);
      const cities=[];
      for(const vid in G.buildings){ const b=G.buildings[vid];
        if(b.p===pIdx&&b.t==='c'&&!isMetro(G,vid)) cities.push(vid); }
      if(cities.length){
        G.metro[track]=pIdx; G.metroAt[track]=cities[0];
        G.metroPick={p:pIdx,track,options:cities};
      }
    }
  }
  return true;
}

/* ---------- knights ---------- */
function knightAt(G,vid){
  for(const p of G.players) for(const k of (p.kn||[])) if(k.v===vid) return {p:p.idx,k};
  return null;
}
function canPlaceKnight(G,B,vid,pIdx){
  if(!B.verts[vid]||B.verts[vid].hexes.length===0) return false;
  if(G.buildings[vid]) return false;
  if(knightAt(G,vid)) return false;
  for(const a of B.verts[vid].adj){
    const rd=G.roads[edgeKey(vid,a)];
    if(rd&&rd.p===pIdx) return true;
  }
  return false;
}
function legalKnightSpots(G,B,pIdx){
  const out=[]; for(const vid in B.verts) if(canPlaceKnight(G,B,vid,pIdx)) out.push(vid);
  return out;
}
function buildKnight(G,B,vid,pIdx,free){
  const p=G.players[pIdx];
  if(!canPlaceKnight(G,B,vid,pIdx)) return false;
  if(p.knightsLeft[1]<=0) return false;
  if(!free && !canAfford(p,CK_COST.knight)) return false;
  if(!free) pay(G,p,CK_COST.knight);
  p.kn.push({v:vid,lvl:1,act:false,id:'k'+(G.knSeq=(G.knSeq||0)+1)});
  p.knightsLeft[1]--;
  updateLongest(G,B);
  logit(G,`${p.name} גייס אביר`);
  return true;
}
function activateKnight(G,pIdx,kid,free){
  const p=G.players[pIdx], k=p.kn.find(x=>x.id===kid);
  if(!k||k.act) return false;
  if(!free && !canAfford(p,CK_COST.activate)) return false;
  if(!free) pay(G,p,CK_COST.activate);
  k.act=true; return true;
}
function canPromote(G,pIdx,k){
  const p=G.players[pIdx];
  if(k.lvl>=3) return false;
  if(k.lvl===2 && p.imp.pol<3) return false;   /* needs the Fortress */
  if(p.knightsLeft[k.lvl+1]<=0) return false;
  return true;
}
function promoteKnight(G,pIdx,kid,free){
  const p=G.players[pIdx], k=p.kn.find(x=>x.id===kid);
  if(!k||!canPromote(G,pIdx,k)) return false;
  if(!free && !canAfford(p,CK_COST.promote)) return false;
  if(!free) pay(G,p,CK_COST.promote);
  p.knightsLeft[k.lvl]++; p.knightsLeft[k.lvl+1]--;
  k.lvl++;
  logit(G,`${p.name} קידם ל${KN_HE[k.lvl]}`);
  return true;
}
/* every vertex reachable along this player's own roads */
function knightReach(G,B,vid,pIdx){
  const seen={}, out=[], stack=[vid]; seen[vid]=1;
  while(stack.length){
    const cur=stack.pop();
    for(const a of B.verts[cur].adj){
      if(seen[a]) continue;
      const rd=G.roads[edgeKey(cur,a)];
      if(!rd||rd.p!==pIdx) continue;
      const b=G.buildings[a];
      if(b&&b.p!==pIdx) { seen[a]=1; continue; }   /* blocked by a rival building */
      seen[a]=1;
      if(!b) out.push(a);
      stack.push(a);
    }
  }
  return out;
}
function knightMoveTargets(G,B,kid,pIdx){
  const p=G.players[pIdx], k=p.kn.find(x=>x.id===kid);
  if(!k||!k.act||p.actedKn[kid]) return [];
  return knightReach(G,B,k.v,pIdx).filter(v=>{
    const other=knightAt(G,v);
    if(!other) return true;
    return other.p!==pIdx && other.k.lvl<k.lvl;   /* displacement */
  });
}
function moveKnight(G,B,kid,pIdx,vid){
  const p=G.players[pIdx], k=p.kn.find(x=>x.id===kid);
  if(!k) return false;
  const other=knightAt(G,vid);
  if(other){
    if(other.p===pIdx||other.k.lvl>=k.lvl) return false;
    const op=G.players[other.p];
    const spots=knightReach(G,B,vid,other.p).filter(v=>v!==vid&&!knightAt(G,v));
    if(spots.length){ other.k.v=spots[0]; logit(G,`${p.name} הדף את האביר של ${op.name}`); }
    else { op.kn=op.kn.filter(x=>x.id!==other.k.id); op.knightsLeft[other.k.lvl]++;
      logit(G,`${p.name} סילק את האביר של ${op.name}`); }
  }
  k.v=vid; k.act=false; p.actedKn[kid]=1;
  updateLongest(G,B);
  return true;
}
function knightRobberTargets(G,B,kid,pIdx){
  const p=G.players[pIdx], k=p.kn.find(x=>x.id===kid);
  if(!k||!k.act||p.actedKn[kid]) return [];
  const h=B.hexById[G.robber]; if(!h) return [];
  const c={x:h.x,y:h.y};
  for(let i=0;i<6;i++) if(vKey(hexCorner(c,i))===k.v)
    return B.hexes.filter(x=>x.id!==G.robber&&canPlaceRobber(G,B,x.id,pIdx)).map(x=>x.id);
  return [];
}

/* ---------- walls ---------- */
function canWall(G,pIdx){
  const p=G.players[pIdx];
  if(p.walls>=3) return false;
  if(!canAfford(p,CK_COST.wall)) return false;
  let c=0; for(const v in G.buildings) if(G.buildings[v].p===pIdx&&G.buildings[v].t==='c') c++;
  return c>p.walls;
}
function buildWall(G,pIdx,free){
  const p=G.players[pIdx];
  if(p.walls>=3) return false;
  let c=0; for(const v in G.buildings) if(G.buildings[v].p===pIdx&&G.buildings[v].t==='c') c++;
  if(c<=p.walls) return false;
  if(!free){ if(!canAfford(p,CK_COST.wall)) return false; pay(G,p,CK_COST.wall); }
  p.walls++; logit(G,`${p.name} בנה חומת מגן`);
  return true;
}

/* ---------- trading rates with the Trading House / Merchant / Fleet ---------- */
function ckBankRate(G,B,pIdx,res){
  const p=G.players[pIdx];
  if(p.fleetRes===res) return 2;
  if(COM.indexOf(res)>=0) return p.imp.trade>=3 ? 2 : 3;
  if(G.merchant && G.merchant.p===pIdx && G.merchant.hex){
    const h=B.hexById[G.merchant.hex];
    if(h && TERRAIN_RES[h.terrain]===res) return 2;
  }
  return baseRate(G,B,pIdx,res);
}

/* ---------- scoring ---------- */
function ckVP(G,pIdx){
  const p=G.players[pIdx]; let v=0;
  TRACKS.forEach(t=>{ if(G.metro[t.id]===pIdx) v+=2; });
  v += p.defender||0;
  v += p.vpProg||0;
  if(G.merchant && G.merchant.p===pIdx && G.merchant.hex) v+=1;
  return v;
}

