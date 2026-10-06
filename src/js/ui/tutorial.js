/* =========================================================
   TUT. Interactive tutorials — a practice board with a coach
   ========================================================= */
const TUT_LVL = BOT_LEVELS[2];      /* the strongest chooser, used only to lay out a sensible board */

/* deterministic opening: both players place their starting pieces automatically */
function tutSetup(G,B,pickSettle,pickRoad){
  let guard=0;
  while(G.phase==='setup1'||G.phase==='setup2'){
    if(guard++>80) break;
    const pi=G.turn;
    if(G.sub==='setupS'){
      const spots=legalSettleSpots(G,B,pi,true);
      let vid = pickSettle ? pickSettle(pi,spots,G,B) : null;
      if(!vid) vid=bestOf(spots,v=>vertexScore(G,B,v,pi,TUT_LVL),TUT_LVL);
      placeSetupSettlement(G,B,vid);
    } else {
      const v=G.lastBuiltVertex;
      let legal=legalSetupRoadSpots(G,B,pi).filter(e=>!G.roads[e]);
      legal.sort();
      let eid = pickRoad ? pickRoad(pi,legal,G,B) : null;
      placeSetupRoad(G,B,eid||legal[0],false);
    }
    while(G.goldQueue.length){ const q=G.goldQueue[0]; if(!resolveGold(G,q.p,{wood:q.n})) G.goldQueue.shift(); }
  }
}
const tutTop=(p,obj)=>{ Object.keys(obj).forEach(k=>{
  if(COM.indexOf(k)>=0) p.com[k]=Math.max(p.com[k],obj[k]); else p.res[k]=Math.max(p.res[k],obj[k]); }); };
const tutPair=n=>{ const a=Math.min(6,n-1); return [a,n-a]; };

/* a hex next to `vid` that produces something, for a scripted roll */
function tutHexNear(G,B,vid,wantTerrain){
  const list=B.verts[vid].hexes.map(h=>B.hexById[h]).filter(h=>h&&h.num&&h.num!==7);
  const pref=list.filter(h=>wantTerrain.indexOf(h.terrain)>=0);
  return (pref[0]||list[0]||null);
}

/* the shortest ship route from the main island to a smaller one */
function seaPlan(G,B){
  const main=B.mainIsland, dist={}, par={}, q=[];
  Object.keys(B.verts).forEach(v=>{
    const vh=B.verts[v].hexes;
    if(vh.length && vh.every(h=>B.islandOf[h]!==main)){ dist[v]=0; par[v]=null; q.push(v); }
  });
  while(q.length){
    const v=q.shift();
    for(const a of B.verts[v].adj){
      if(dist[a]!==undefined) continue;
      const e=B.edges[edgeKey(v,a)];
      if(!e||e.hexes.length>1) continue;             /* ships live on the water's edge */
      dist[a]=dist[v]+1; par[a]=v; q.push(a);
    }
  }
  /* distance >= 2: the distance rule forbids settling next to our own starting house */
  const starts=Object.keys(B.verts).filter(v=>dist[v]!==undefined && dist[v]>=2 &&
    canSettle(G,B,v,0,true) && B.verts[v].hexes.every(h=>B.islandOf[h]===main));
  starts.sort((a,b)=>(dist[a]-dist[b])||(vertexScore(G,B,b,0,TUT_LVL)-vertexScore(G,B,a,0,TUT_LVL)));
  const S=starts[0]; if(!S) return null;
  const path=[]; let v=S;
  while(par[v]!==null && par[v]!==undefined){ const n=par[v]; path.push(edgeKey(v,n)); v=n; }
  return {S,T:v,path};
}

const TUTS = {};

/* ---------------- The basics (no expansion) ---------------- */
TUTS.base = {
  id:'base', exp:null, title:'חוקי הבסיס', seed:7,
  cfg:{players:2, balanced:true, target:10},
  setup(G,B,T){
    tutSetup(G,B);
    G.players.forEach(p=>RES.forEach(r=>p.res[r]=0));
    /* the scripted roll lands on a number next to our own settlement */
    const mine=Object.keys(G.buildings).filter(v=>G.buildings[v].p===0);
    const best=bestOf(mine,v=>vertexScore(G,B,v,0,TUT_LVL),TUT_LVL);
    const h=tutHexNear(G,B,best,['forest','hills','pasture','fields','mountains']);
    T.data.rollHex=h?h.id:null;
    G.forced=[tutPair(h?h.num:8)];
    tutTop(G.players[1],{wood:1,brick:1,sheep:1,wheat:1});     /* so there is a card to steal later */
  },
  steps:[
    {next:true, t:'<b>ברוכים הבאים למשחק דמה!</b> שני שחקנים, שום דבר כאן לא נספר, ואפשר לנסות הכול. אתם האדומים. נעבור על חוקי הבסיס צעד אחרי צעד: קוביות, בנייה, מסחר, שודד וניצחון.'},
    {spot:'primary', phase:'roll', point:(G,B,T)=>T.data.rollHex?{hexes:[T.data.rollHex]}:null,
      t:'<b>הטילו את הקוביות.</b> כל משושה שהמספר שלו יצא מפיק משאב לכל יישוב שנוגע בו (עיר מפיקה 2). הפעם המספר יצא על משושה שליד היישוב שלכם — הוא מסומן.',
      done:G=>(G.rollId||0)>=1},
    {next:true, t:'<b>קיבלתם משאב!</b> יש חמישה סוגים: עץ, לבנה, צמר, חיטה ואבן. הם ביד שלכם, למטה. עכשיו אפשר לבנות — העלות מופיעה על כל כפתור.'},
    {spot:'road', t:'<b>דרך.</b> עולה עץ + לבנה. לחצו <b>"דרך"</b> והניחו אותה על הקשת המסומנת. דרכים מחברות את היישובים שלכם ומובילות למקומות חדשים.',
      enter:(G,B,T)=>{ tutTop(G.players[0],{wood:1,brick:1});
        const legal=legalRoadSpots(G,B,0,false);
        T.data.road=legal.length?bestOf(legal,e=>roadScore(G,B,e,0,TUT_LVL),TUT_LVL):null; },
      point:(G,B,T)=>(T.data.road&&!G.roads[T.data.road])?{edges:[T.data.road]}:null,
      done:G=>Object.values(G.roads).filter(r=>r.p===0).length>=3},
    {spot:'sett', t:'<b>יישוב.</b> עולה עץ + לבנה + צמר + חיטה. לחצו <b>"יישוב"</b> והניחו אותו בצומת המסומן — הוא שווה נקודה ומפיק משאבים. אסור ליישב בצומת שצמוד ליישוב אחר (חוק המרחק).',
      enter:(G,B,T)=>{ tutTop(G.players[0],{wood:1,brick:1,sheep:1,wheat:1});
        const spots=legalSettleSpots(G,B,0,false);
        T.data.sett=spots.length?bestOf(spots,v=>vertexScore(G,B,v,0,TUT_LVL),TUT_LVL):null; },
      point:(G,B,T)=>T.data.sett?{verts:[T.data.sett]}:null,
      done:(G,B,T)=>!T.data.sett || Object.values(G.buildings).filter(b=>b.p===0).length>=3},
    {next:true, spot:'city', t:'<b>עיר.</b> אפשר לשדרג יישוב לעיר: 2 חיטה + 3 אבן. עיר שווה 2 נקודות ומפיקה כפול.'},
    {next:true, spot:'dev', t:'<b>קלף פיתוח.</b> עולה צמר + חיטה + אבן. יש בו אביר (מזיז את השודד), בניית דרכים, שנת שפע, מונופול או נקודת ניצחון חסויה.'},
    {next:true, spot:'trade', t:'<b>מסחר.</b> מול הבנק: 4 קלפים מאותו סוג תמורת קלף אחד לבחירתכם, ובנמל 3:1 או 2:1. אפשר גם לסחור עם שחקנים בכל יחס שתסכימו עליו.'},
    {next:true, btn:{label:'הוציאו 7 לדוגמה', fn:()=>{
        const G=ST.G,B=ST.B,T=ST.tut;
        T.data.robber0=G.robber;
        /* a hex next to the other player's house, away from ours, so the block and the steal are easy to see */
        const theirs=Object.keys(G.buildings).filter(v=>G.buildings[v].p===1);
        const mineHex={}; Object.keys(G.buildings).filter(v=>G.buildings[v].p===0).forEach(v=>B.verts[v].hexes.forEach(h=>mineHex[h]=1));
        const cand=[]; theirs.forEach(v=>B.verts[v].hexes.forEach(hid=>{ const h=B.hexById[hid];
          if(h&&hid!==G.robber&&h.num&&canPlaceRobber(G,B,hid,0)&&!mineHex[hid]) cand.push(h); }));
        cand.sort((a,b)=>PIP(b.num)-PIP(a.num));
        T.data.rHex=cand.length?cand[0].id:null;
        G.robberReturn=homeSub(G); G.sub='robber'; logit(G,'יצא 7 (הדגמה)');
        tutNext(); }},
      t:'<b>שודד.</b> כשיוצא 7, מי שמחזיק יותר מ‑7 קלפים משליך חצי מהם. אחר כך מזיזים את השודד למשושה אחר — הוא חוסם אותו (אין הפקה) — וגונבים קלף משכן. בואו ננסה.'},
    {t:'<b>הציבו את השודד.</b> בחרו את המשושה המסומן, שליד היישוב של שחקן הדמה, ואז בחרו קלף הפוך מהיד שלו כדי לגנוב אותו.',
      point:(G,B,T)=>T.data.rHex?{hexes:[T.data.rHex]}:null,
      done:(G,B,T)=>G.sub==='main' && G.robber!==T.data.robber0},
    {spot:'primary', phase:'main', t:'<b>סיימו את התור.</b> לחצו על הכפתור הזהב. בכל תור מטילים קוביות, בונים וסוחרים, ואז מסיימים. שחקן הדמה ידלג מיד.',
      enter:(G,B,T)=>{ T.data.tc1=G.tc; },
      done:(G,B,T)=>G.tc>T.data.tc1},
    {final:true, t:'<b>כל הכבוד! 🎉</b> עוד שני בונוסים: <b>הדרך הארוכה</b> (5 דרכים רצופות ויותר) ו<b>צבא גדול</b> (3 אבירים או יותר) — כל אחד שווה 2 נקודות. מי שמגיע ל‑10 נקודות בתורו מנצח. בהצלחה!'}
  ]
};

/* ---------------- Cities & Knights ---------------- */
TUTS.ck = {
  id:'ck', exp:'ck', title:'ערים ואבירים', seed:5511,
  cfg:{players:2, balanced:true, ck:true, target:13, harbour:false, eventcards:false},
  setup(G,B,T){
    tutSetup(G,B);
    const mine=Object.keys(G.buildings).filter(v=>G.buildings[v].p===0);
    const best=bestOf(mine,v=>vertexScore(G,B,v,0,TUT_LVL),TUT_LVL);
    G.buildings[best].t='c'; G.players[0].cityLeft--; G.players[0].settLeft++;
    T.data.city=best;
    G.players.forEach(p=>{ RES.forEach(r=>p.res[r]=0); COM.forEach(c=>p.com[c]=0); });
    tutTop(G.players[0],{wood:2,brick:2,sheep:2,wheat:1,ore:1});
    const h=tutHexNear(G,B,best,['forest','pasture','mountains']);
    G.forced=[tutPair(h?h.num:8)]; G.forcedEv=['ship'];
  },
  steps:[
    {next:true, t:'<b>ברוכים הבאים להדרכה!</b> זה משחק דמה עם שני שחקנים — שום דבר כאן לא נספר, ואפשר לנסות הכול. אתם האדומים. בערים ואבירים יש חוקים חדשים: סחורות, שיפורי עיר, אבירים וברברים. נעבור עליהם אחד אחד.'},
    {next:true, spot:'hand', t:'<b>הקלפים שלכם.</b> חוץ מהמשאבים הרגילים יש שלוש <b>סחורות</b> — נייר (ירוק), בד (צהוב) ומטבע (כחול). סחורות מגיעות רק מ<b>ערים</b>: עיר על יער נותנת עץ + נייר, על מרעה צמר + בד, על הרים אבן + מטבע.'},
    {spot:'primary', phase:'roll', t:'<b>הטילו את הקוביות.</b> בערים ואבירים יש שלוש: שתי קוביות רגילות, ועוד <b>קובית אירועים</b> — ספינה משמעה שהברברים מתקרבים, ושער צבעוני מאפשר למשוך קלף קִדמה.',
      done:G=>(G.rollId||0)>=1},
    {next:true, t:'<b>מה קרה?</b> העיר שלכם הפיקה גם משאב וגם סחורה — הם עכשיו ביד. והקובייה הראתה ספינה, אז <b>ספינת הברברים</b> התקדמה צעד (המד בראש המסך). כשהיא מגיעה ל־7 הם נוחתים.'},
    {spot:'improve', t:'<b>שיפור עיר.</b> את הסחורות משקיעים בשדרוג העיר. לחצו <b>"שיפור עיר"</b> ובחרו <b>מדע</b> (עולה נייר אחד).',
      enter:(G)=>tutTop(G.players[0],{paper:2}),
      done:G=>Object.values(G.players[0].imp).some(v=>v>=1)},
    {next:true, t:'<b>יפה!</b> יש שלושה מסלולים — מדע, מסחר ופוליטיקה — בחמש דרגות כל אחד. דרגה 3 פותחת יכולת קבועה, דרגה 4 נותנת <b>מטרופולין</b> ששווה 2 נקודות, ודרגה 5 יכולה לחטוף מטרופולין מיריב. ככל שהמסלול גבוה יותר, קלפי קִדמה נמשכים לעתים קרובות יותר.'},
    {spot:'kbuild', t:'<b>אבירים.</b> האבירים מגנים על האי מפני הברברים. גייסו אחד: לחצו <b>"אביר"</b> והניחו אותו על צומת שליד דרך שלכם.',
      enter:(G)=>tutTop(G.players[0],{ore:1,sheep:1}),
      point:(G,B)=>G.players[0].kn.length?null:{verts:legalKnightSpots(G,B,0).slice(0,2)},
      done:G=>G.players[0].kn.length>=1},
    {spot:'knights', t:'האביר החדש <b>לא פעיל</b> (הוא כהה) ולכן לא נחשב להגנה. לחצו <b>"האבירים"</b> ואז <b>"הפעלה"</b> — זה עולה חיטה אחת.',
      enter:(G)=>tutTop(G.players[0],{wheat:1}),
      done:G=>G.players[0].kn.some(k=>k.act)},
    {next:true, btn:{label:'הפעילו התקפת ברברים לדוגמה', fn:()=>{ ckBarbarianAttack(ST.G,ST.B); SFX.drum(); tutNext(); }},
      t:'<b>הברברים.</b> כשהם נוחתים משווים בין הכוח הכולל של האבירים הפעילים למספר הערים על האי. אם האבירים חזקים — מי שתרם הכי הרבה מקבל <b>מגן קטאן</b> (נקודה). אם חלשים — מי שתרם הכי מעט מאבד עיר. בואו נדמה התקפה.'},
    {next:true, t:(G)=>G.players[0].defender
      ? '<b>הפלישה נהדפה!</b> יש על האי עיר אחת ואביר פעיל אחד — הכוח שווה למספר הערים, אז הגנתם וקיבלתם <b>מגן קטאן</b> (נקודת ניצחון). שימו לב: אחרי כל התקפה כל האבירים חוזרים ללא פעילים וצריך להפעיל אותם שוב.'
      : '<b>ההתקפה הסתיימה.</b> כל האבירים חזרו ללא פעילים — צריך להפעיל אותם שוב לפני ההתקפה הבאה. כדאי להחזיק תמיד מספיק כוח.'},
    {spot:'prog', t:'<b>קלפי קִדמה.</b> לא קונים אותם — הם נמשכים כשקובית האירועים מראה שער בצבע של מסלול ששיפרתם, ולפי הקובייה האדומה. קיבלתם קלף לדוגמה: לחצו <b>"קלפי קִדמה"</b> ושחקו אותו.',
      enter:(G)=>{ const p=G.players[0]; if(p.prog.indexOf('printer')<0) p.prog.push('printer'); },
      done:G=>G.players[0].vpProg>=1},
    {final:true, t:'<b>סיימתם את ההדרכה! 🎉</b> עוד דברים שכדאי להכיר: <b>חומות מגן</b> (2 לבנים) מגדילות את גבול הקלפים ב־2 ומגינות על עיר; אבירים זזים לאורך הדרכים שלכם, מגרשים את השודד ודוחפים אבירים חלשים; ויש קלפי קִדמה נוספים כמו סוחר ובישוף. הניצחון בערים ואבירים הוא ב־13 נקודות.'}
  ]
};

/* ---------------- Seafarers ---------------- */
TUTS.seafarers = {
  id:'seafarers', exp:'seafarers', title:'ימאים', seed:3,
  cfg:{players:2, balanced:true, seafarers:true, gold:true, target:12},
  setup(G,B,T){
    const plan=seaPlan(G,B);
    T.data.plan=plan;
    const avoid={}; if(plan) plan.path.forEach(e=>avoid[e]=1);
    tutSetup(G,B,
      (pi,spots)=> (pi===0 && plan && !G.__first && spots.indexOf(plan.S)>=0) ? (G.__first=1,plan.S) : null,
      (pi,legal)=> legal.find(e=>!avoid[e]) || legal[0]);
    delete G.__first;
    G.players.forEach(p=>RES.forEach(r=>p.res[r]=0));
    tutTop(G.players[0],{wood:2,sheep:2,brick:1,wheat:1});
    G.sub='main';                       /* this lesson is about building, so skip the opening roll */
  },
  steps:[
    {next:true, t:'<b>ברוכים הבאים להדרכה: ימאים!</b> הלוח נפתח לים — מלבד האי הגדול יש איים קטנים. כדי להגיע אליהם בונים <b>ספינות</b>. זה משחק דמה: אפשר לנסות הכול.'},
    {spot:'ship', t:'<b>ספינות.</b> ספינה עולה עץ + צמר, נבנית על קשת בקצה המים ומתחברת ליישוב או לדרך שלכם. לחצו <b>"ספינה"</b> והניחו אחת על הקשת המסומנת — היא מובילה לאי הקטן. ספינה מתחברת רק לספינה אחרת או ליישוב.',
      enter:(G)=>tutTop(G.players[0],{wood:6,sheep:6}),
      point:(G,B,T)=>tutNextShip(G,T),
      done:G=>Object.values(G.roads).some(r=>r.ship&&r.p===0)},
    {spot:'ship', t:'<b>המשיכו!</b> בנו עוד ספינות לאורך הקו המסומן עד שתגיעו לאי. שרשרת ספינות נספרת יחד עם הדרכים ל"דרך הארוכה".',
      enter:(G)=>tutTop(G.players[0],{wood:6,sheep:6}),
      point:(G,B,T)=>tutNextShip(G,T),
      done:(G,B,T)=>G.players[0].islands.length>=1 || (T.data.plan && canSettle(G,B,T.data.plan.T,0,false))},
    {spot:'sett', t:'<b>יישוב על אי חדש.</b> הגעתם! לחצו <b>"יישוב"</b> והניחו אותו על הצומת המסומן. יישוב ראשון על אי חדש שווה <b>2 נקודות ניצחון</b> נוספות.',
      enter:(G)=>tutTop(G.players[0],{wood:2,brick:2,sheep:2,wheat:2}),
      point:(G,B,T)=>T.data.plan?{verts:[T.data.plan.T]}:null,
      done:G=>G.players[0].islands.length>=1},
    {spot:'ship', t:'<b>עוד ספינה.</b> בנו ספינה נוספת שיוצאת ממקום אחר — לתרגיל הבא. ספינה כזאת נקראת <b>"פתוחה"</b>: קצה אחד מחובר אליכם והשני חופשי.',
      enter:(G)=>tutTop(G.players[0],{wood:3,sheep:3}),
      point:(G,B,T)=>{ const plan=T.data.plan; if(!plan) return null;
        const legal=legalRoadSpots(G,B,0,true).filter(e=>plan.path.indexOf(e)<0);
        const e=legal.find(x=>B.edges[x].v.indexOf(plan.S)>=0)||legal[0];
        return e?{edges:[e]}:null; },
      done:(G,B,T)=>Object.values(G.roads).filter(r=>r.ship&&r.p===0).length>T.data.plan.path.length},
    {spot:'primary', phase:'main', t:'<b>סיימו את התור.</b> ספינה שנבנתה עכשיו לא ניתנת להזזה באותו תור — צריך להמתין לתור הבא. שחקן הדמה ידלג מיד.',
      enter:(G,B,T)=>{ T.data.tc1=G.tc; },
      done:(G,B,T)=>G.tc>T.data.tc1},
    {spot:'moveship', t:'<b>הזזת ספינה.</b> עכשיו הספינה הפתוחה יכולה לזוז — בחינם, פעם אחת בתור. לחצו <b>"הזזת ספינה"</b>, בחרו את הספינה הפתוחה, ואז בחרו לאן להעביר אותה.',
      done:G=>G.shipMoved===G.tc},
    {next:true, btn:{label:'הוציאו 7 לדוגמה', fn:()=>{
        const G=ST.G,B=ST.B,T=ST.tut;
        T.data.pirate0=G.pirate; T.data.robber0=G.robber;
        /* a sea hex touching one of our ships, so the blockade is easy to see */
        const mine=Object.keys(G.roads).filter(e=>G.roads[e].ship&&G.roads[e].p===0);
        const hx=B.sea.find(h=>canPlacePirate(G,B,h.id,0) && mine.some(e=>hexEdgeIds(B,h.id).indexOf(e)>=0));
        T.data.pHex=hx?hx.id:null;
        G.robberReturn=homeSub(G); G.sub='robber'; logit(G,'יצא 7 (הדגמה)');
        tutNext(); }},
      t:'<b>שודדי הים.</b> כשיוצא 7 (או משחקים אביר) בוחרים: השודד ביבשה, או <b>שודדי הים</b> בים. שודדי הים סוגרים את המשושה שלהם — אי אפשר לבנות או להזיז שם ספינות — וגונבים קלף מבעל ספינה סמוכה. בואו ננסה.'},
    {t:'<b>הציבו את שודדי הים.</b> בחרו משושה ים מסומן (כאן הוא נוגע בספינה שלכם, אז הוא היה חוסם אתכם). משושה ביבשה יזיז את השודד הרגיל.',
      point:(G,B,T)=>T.data.pHex?{hexes:[T.data.pHex]}:null,
      done:(G,B,T)=>G.sub!=='robber' && (G.pirate!==T.data.pirate0||G.robber!==T.data.robber0)},
    {final:true, t:'<b>כל הכבוד! 🎉</b> למדתם: ספינות ושרשראות, יישוב על אי חדש (+2 נקודות), הזזת ספינה פתוחה ושודדי ים. בכל משחק המפה נוצרת מחדש, ולכן כל אי והמרחקים ביניהם שונים. הניצחון בימאים הוא ב־12 נקודות. גם שחקני המחשב מזיזים ספינות ומשתמשים בשודדי הים, לפי אותם כללים.'}
  ]
};
function tutNextShip(G,T){
  const plan=T.data.plan; if(!plan) return null;
  const left=plan.path.filter(e=>!G.roads[e]);
  return left.length?{edges:left.slice(0,1)}:null;
}

/* ---------------- Gold fields ---------------- */
TUTS.gold = {
  id:'gold', exp:'gold', title:'שדות זהב', seed:1,
  cfg:{players:2, balanced:true, gold:true, target:10},
  setup(G,B,T){
    const golds=B.hexes.filter(h=>h.terrain==='gold'&&h.num&&h.num!==7).sort((a,b)=>PIP(b.num)-PIP(a.num));
    const gh=golds[0]; T.data.gold=gh?gh.id:null;
    tutSetup(G,B,(pi,spots)=>{
      if(pi!==0||G.__g||!gh) return null;
      const near=spots.filter(v=>B.verts[v].hexes.indexOf(gh.id)>=0);
      if(!near.length) return null; G.__g=1;
      return bestOf(near,v=>vertexScore(G,B,v,0,TUT_LVL),TUT_LVL);
    });
    delete G.__g;
    G.players.forEach(p=>RES.forEach(r=>p.res[r]=0));
    tutTop(G.players[0],{wood:1,brick:1,sheep:1});
    G.forced=[tutPair(gh?gh.num:8)];
  },
  steps:[
    {next:true, t:'<b>שדות זהב.</b> משבצת זהב מניבה <b>כל משאב שתבחרו</b> — יישוב נותן בחירה אחת, עיר שתיים. זה מקל מאוד על מי שחסר לו משאב מסוים. בואו נראה.'},
    {spot:'primary', phase:'roll', point:(G,B,T)=>T.data.gold?{hexes:[T.data.gold]}:null,
      t:'<b>הטילו את הקוביות.</b> המספר יצא בדיוק על משבצת הזהב (מסומנת) שליד היישוב שלכם.',
      done:G=>(G.rollId||0)>=1},
    {t:'<b>בחרו משאב!</b> במקום משאב קבוע אתם מחליטים מה לקחת מהבנק — כדאי לבחור את מה שחסר לכם.',
      done:G=>(G.rollId||0)>=1 && G.goldQueue.length===0},
    {final:true, t:'<b>זהו!</b> 🎉 בכל פעם שהמספר של משבצת הזהב יוצא, כל מי שנוגע בה בוחר משאב. כשהבנק חסר במשאב מסוים אי אפשר לבחור אותו.'}
  ]
};

/* ---------------- Friendly robber ---------------- */
TUTS.friendly = {
  id:'friendly', exp:'friendly', title:'שודד ידידותי', seed:1,
  cfg:{players:2, balanced:true, friendly:true, target:10},
  setup(G,B,T){
    tutSetup(G,B);
    G.players.forEach(p=>RES.forEach(r=>p.res[r]=0));
    tutTop(G.players[0],{wood:1,brick:1});
    tutTop(G.players[1],{wood:1,sheep:1});
    G.forced=[[3,4]];
  },
  steps:[
    {next:true, t:'<b>שודד ידידותי.</b> שחקן עם <b>2 נקודות ניצחון או פחות</b> מוגן מהשודד: אי אפשר להציב עליו את השודד ואי אפשר לגנוב ממנו. זה מונע מהשולחן להתנפל על מי שכבר בפיגור.'},
    {spot:'primary', phase:'roll', t:'<b>הטילו את הקוביות.</b> כדי לראות את השודד בפעולה, ההדרכה תוציא 7.',
      done:G=>(G.rollId||0)>=1},
    {t:'<b>הזיזו את השודד.</b> שימו לב: המשושים שנוגעים בשחקן הדמה <b>לא מסומנים</b> — הוא עדיין בשתי נקודות, ולכן מוגן. אפשר להניח רק במקומות המסומנים.',
      done:G=>(G.rollId||0)>=1 && G.sub==='main'},
    {final:true, t:'<b>זה הכול.</b> 🎉 ברגע שהשחקן יעבור 2 נקודות הוא כבר לא מוגן, והשודד יכול לפגוע בו כרגיל.'}
  ]
};

/* ---------------- framework ---------------- */
function startTutorial(id){
  const def=TUTS[id]; if(!def) return;
  clearTimeout(botTimer); botTimer=null;
  const defs=[{name:'אתם',color:'red',g:null},{name:'שחקן דמה',color:'blue',g:null}];
  const {G,board:B}=newGame(def.cfg,defs,def.seed);
  G.scripted=true;
  const T={def,i:0,data:{}};
  def.setup(G,B,T);
  ST.tut=T;
  startGame(G,B,'local',-1,null);
  const s0=def.steps[0]; if(s0&&s0.enter) s0.enter(G,B,T);
  ST.lastNeed=''; syncUI();
}
function tutStep(){ const T=ST.tut; return T? T.def.steps[T.i] : null; }
function tutNext(){
  const T=ST.tut; if(!T) return;
  T.i=Math.min(T.i+1,T.def.steps.length-1);
  const st=T.def.steps[T.i]; if(st&&st.enter) st.enter(ST.G,ST.B,T);
  ST.lastNeed=''; SFX.tap(); syncUI();
}
function tutCheck(){
  const T=ST.tut; if(!T) return;
  if(!ST.busy){
    let g=0, moved=false;
    while(g++<8){
      const st=T.def.steps[T.i]; if(!st||st.next||st.final) break;
      if(st.done && st.done(ST.G,ST.B,T)){
        T.i++; moved=true;
        const ns=T.def.steps[T.i]; if(ns&&ns.enter) ns.enter(ST.G,ST.B,T);
        continue;
      }
      break;
    }
    if(moved){ ST.lastNeed=''; setTimeout(()=>{ if(ST.tut===T) syncUI(); },0); }
  }
  renderCoach(); tutDecorate();
}
function renderCoach(){
  const c=$('#coach'), T=ST.tut;
  if(!T){ c.classList.add('hidden'); return; }
  const st=T.def.steps[T.i]; if(!st){ c.classList.add('hidden'); return; }
  c.classList.remove('hidden');
  const total=T.def.steps.length;
  const html=(typeof st.t==='function')?st.t(ST.G,ST.B,T):st.t;
  c.innerHTML=`<div class="ch"><b>🎓 ${T.def.title}</b><span>${T.i+1}/${total}</span>
      <button id="coachX" aria-label="יציאה מההדרכה">✕</button></div>
    <div class="cb">${html}</div><div class="cbtns" id="coachBtns"></div>`;
  const bt=c.querySelector('#coachBtns');
  const mk=(label,cls,fn)=>{ const b=document.createElement('button'); b.className='btn '+cls; b.textContent=label; b.onclick=fn; bt.appendChild(b); return b; };
  if(st.final){
    mk('חזרה לתפריט','',()=>leaveGame());
    if(T.def.exp) mk('משחק אמיתי עם ההרחבה','gold',()=>{ const e=T.def.exp; leaveGame(); sel[e]=true; buildExpList();
      toast('ההרחבה הופעלה — בחרו שחקנים והתחילו',3200); });
    else mk('למשחק אמיתי','gold',()=>{ leaveGame(); toast('בחרו שחקנים והתחילו',2800); });
  } else if(st.btn){ mk(st.btn.label,'gold',st.btn.fn); }
  else if(st.next){ mk('המשך','gold',()=>tutNext()); }
  c.querySelector('#coachX').onclick=()=>leaveGame();
}
function tutDecorate(){
  $$('.spot').forEach(e=>e.classList.remove('spot'));
  const st=tutStep(); if(!st||!st.spot) return;
  let el = st.spot==='primary' ? $('#primaryBtn')
         : st.spot==='hand' ? $('#hand')
         : $('#actions .act[data-act="'+st.spot+'"]');
  if(el && !el.classList.contains('hidden')){
    el.classList.add('spot');
    if(el.scrollIntoView && st.spot!=='hand'){ try{ el.scrollIntoView({inline:'center',block:'nearest'}); }catch(e){} }
  }
}
function drawTutPointers(t){
  const T=ST.tut, st=tutStep(); if(!T||!st||!st.point) return;
  const pt=st.point(ST.G,ST.B,T); if(!pt) return;
  const B=ST.B, S=view.scale, pulse=0.5+0.5*Math.sin(t*4.2);
  /* a bold pulsing line on the suggested edge(s) */
  (pt.edges||[]).forEach(e=>{
    const ed=B.edges[e]; if(!ed) return;
    const a=toScreen(B.verts[ed.v[0]].x,B.verts[ed.v[0]].y), c=toScreen(B.verts[ed.v[1]].x,B.verts[ed.v[1]].y);
    ctx.save(); ctx.lineCap='round';
    ctx.strokeStyle='rgba(20,12,3,.55)'; ctx.lineWidth=S*0.26;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(c.x,c.y); ctx.stroke();
    ctx.strokeStyle='rgba(255,216,107,'+(0.65+pulse*0.35)+')'; ctx.lineWidth=S*0.17;
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(c.x,c.y); ctx.stroke();
    ctx.restore();
  });
  /* ring around suggested vertices / hexes */
  drawHighlights(B,ST.G,t,{verts:pt.verts,hexes:pt.hexes,near:null});
  const spots=[];
  (pt.verts||[]).forEach(v=>B.verts[v]&&spots.push(B.verts[v]));
  (pt.hexes||[]).forEach(h=>B.hexById[h]&&spots.push(B.hexById[h]));
  (pt.edges||[]).forEach(e=>{ const ed=B.edges[e]; if(!ed) return;
    const a=B.verts[ed.v[0]], c=B.verts[ed.v[1]]; spots.push({x:(a.x+c.x)/2,y:(a.y+c.y)/2}); });
  const bob=Math.sin(t*4.2)*S*0.12;
  spots.slice(0,3).forEach(o=>{
    const p=toScreen(o.x,o.y), r=S*0.30;
    ctx.save(); ctx.translate(p.x,p.y-S*0.95+bob);
    ctx.fillStyle='#FFD86B'; ctx.strokeStyle='rgba(20,12,3,.9)'; ctx.lineWidth=Math.max(2,r*0.24); ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(-r,-r*0.9); ctx.lineTo(r,-r*0.9); ctx.lineTo(0,r*0.95); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.restore();
  });
}
/* the dummy opponent never holds the table up */
function tutAutoDummy(G){
  let g=0;
  while(g++<8){
    const dq=G.discardQueue[0], gq=G.goldQueue[0];
    if(dq&&dq.p===1){
      const picks={}; let left=dq.n; const keys=isCK(G)?RES.concat(COM):RES;
      keys.forEach(r=>{ const k=Math.min(left,heldOf(G.players[1],r)); picks[r]=k; left-=k; });
      if(!resolveDiscard(G,1,picks)) G.discardQueue.shift();
    } else if(gq&&gq.p===1){
      if(!resolveGold(G,1,{wood:gq.n})) G.goldQueue.shift();
    } else break;
  }
}
function tutAfterEndTurn(){
  const G=ST.G, st=tutStep();
  G.turn=0; G.sub=(st&&st.phase)||'main'; G.round++;
  G.players[0].rolled=false;
  toast('שחקן הדמה סיים את תורו — חזרתם',2000);
}

