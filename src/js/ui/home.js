/* =========================================================
   9. HOME SCREEN
   ========================================================= */
const sel = {balanced:true, gold:false, friendly:false, special:false, seafarers:false, ck:false, target:10};
let playerCount=3;
const seats=[];   /* {name,color} for local play */
let myName='', myColor=DEFAULT_COLOR[0], myGender=ls('sigender')||null;

function ls(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){} return null; }

function buildExpList(){
  const list=$('#expList'); list.innerHTML='';
  EXPANSIONS.forEach(x=>{
    const d=document.createElement('div');
    d.className='exp'; d.dataset.on=sel[x.id]?'1':'0'; d.dataset.open='0'; d.id='exp_'+x.id;
    d.innerHTML=`<div class="exp-head">
        <div class="tick">✓</div>
        <div class="t"><b>${x.name}${x.playable?'<span class="tag ready">משחקי</span>':'<span class="tag soon">הסבר בלבד</span>'}</b><span>${x.sub}</span></div>
        <button class="info" aria-label="הסבר">?</button>
      </div>
      <div class="exp-body"><div class="inner">${x.body}${x.tut?
        `<button class="btn gold sm" data-tut="${x.tut}" style="margin-top:8px">🎓 נסו הדרכה אינטראקטיבית — משחק דמה</button>`:''}</div></div>`;
    const tb=d.querySelector('[data-tut]');
    if(tb) tb.onclick=e=>{ e.stopPropagation(); startTutorial(tb.dataset.tut); };
    d.querySelector('.info').onclick=e=>{ e.stopPropagation();
      d.dataset.open = d.dataset.open==='1'?'0':'1'; };
    d.querySelector('.exp-head').onclick=()=>{
      if(!x.playable){ d.dataset.open='1'; toast('ההרחבה הזו עדיין לא מומשה כאן'); return; }
      sel[x.id]=!sel[x.id]; d.dataset.on=sel[x.id]?'1':'0';
      if(x.id==='seafarers'&&sel[x.id]) toast('מצב ימאים: אפשר לבנות ספינות');
    };
    list.appendChild(d);
  });
}
/* ask "בן או בת?" — used for names that could be either, or that we do not know */
function askGender(name,cb){
  if(LANG==='en'){ cb('m'); return; }          /* English has no gendered wording */
  const g=genderGuess(name);
  if(g==='m'||g==='f'){ cb(g); return; }
  const body=$('#pickBody'); body.innerHTML='';
  $('#pickTitle').textContent='איך לפנות ל'+(name||'שחקן')+'?';
  $('#pickSub').textContent='כדי שהמשחק ידבר בלשון הנכונה — למשל "לא מעוניין" או "לא מעוניינת".';
  [['m','בן'],['f','בת']].forEach(([k,l])=>{
    const b=document.createElement('button'); b.className='btn gold wide'; b.style.marginBottom='8px';
    b.textContent=l; b.onclick=()=>{ closeAllSheets(); cb(k); }; body.appendChild(b);
  });
  openSheet('sheetPick');
}
function buildPlayersGrid(){
  const g=$('#playersGrid'); g.innerHTML='';
  while(seats.length<6){ const k=seats.length;
    seats.push({name:DEFAULT_NAMES[k],color:DEFAULT_COLOR[k],bot:k?'normal':null,g:DEFAULT_GENDER[k]}); }
  for(let i=0;i<playerCount;i++){
    const row=document.createElement('div'); row.className='prow';
    const sw=document.createElement('div'); sw.className='swatch';
    const nm=document.createElement('input'); nm.value=seats[i].name; nm.maxLength=14;
    const gc=document.createElement('button'); gc.className='gchip';
    const kind=document.createElement('button'); kind.className='kind';
    const paint=()=>{
      sw.style.background=PCOLORS[seats[i].color].hex;
      const b=seats[i].bot;
      kind.textContent = b ? ('מחשב · '+BOT_LEVELS.find(l=>l.id===b).he) : 'שחקן אנושי';
      kind.style.color = b ? '#E0A93B' : '';
      gc.textContent = seats[i].g==='m'?'בן':(seats[i].g==='f'?'בת':'בן/בת?');
      gc.classList.toggle('ask',!seats[i].g);
    };
    nm.oninput=()=>{ seats[i].name=nm.value.trim()||DEFAULT_NAMES[i]; };
    nm.onchange=()=>{
      seats[i].name=nm.value.trim()||DEFAULT_NAMES[i];
      const guess=genderGuess(seats[i].name);
      if(guess==='m'||guess==='f'){ seats[i].g=guess; paint(); }
      else { seats[i].g=null; paint(); askGender(seats[i].name,k=>{ seats[i].g=k; paint(); }); }
    };
    gc.onclick=()=>{ seats[i].g = seats[i].g==='m' ? 'f' : 'm'; paint(); SFX.tap(); };
    sw.onclick=()=>{
      for(let k=1;k<=6;k++){ const c=(seats[i].color+k)%6;
        if(!seats.slice(0,playerCount).some((s2,j)=>j!==i&&s2.color===c)){ seats[i].color=c; break; } }
      paint(); SFX.tap();
    };
    kind.onclick=()=>{
      const order=[null,'easy','normal','hard','expert'];
      let k=order.indexOf(seats[i].bot||null);
      seats[i].bot=order[(k+1)%order.length];
      paint(); SFX.tap();
    };
    paint();
    row.append(sw,nm,gc,kind); g.appendChild(row);
  }
  const hint=document.createElement('div');
  hint.className='note';
  hint.textContent='לחיצה על התווית מחליפה בין שחקן אנושי לארבע דרגות מחשב: '+
    BOT_LEVELS.map(l=>l.he+' — '+l.sub).join(' · ');
  g.appendChild(hint);
}
function readCfg(n){
  return {players:n, balanced:sel.balanced, gold:sel.gold, friendly:sel.friendly,
    special: sel.special || n>=5, seafarers:sel.seafarers,
    ck: !!sel.ck, harbour:false, eventcards:false,
    /* Cities & Knights always plays to 13; otherwise the table's own choice, with Seafarers
       needing at least 12 because the map is bigger */
    target: sel.ck?13:Math.max(sel.target||10, sel.seafarers?12:0)};
}
function activeExpansions(cfg){
  const on=[];
  if(cfg.ck) on.push('ck');
  if(cfg.seafarers) on.push('seafarers');
  if(cfg.harbour||cfg.eventcards) on.push('traders');
  if(cfg.gold) on.push('gold');
  if(cfg.friendly) on.push('friendly');
  if(cfg.special) on.push('special');
  if(cfg.balanced) on.push('balanced');
  return on;
}
/* the explanation the table sees before the first roll */
function showExpansionIntro(cfg,done){
  const ids=activeExpansions(cfg).filter(id=>id!=='balanced');
  if(!ids.length){ done(); return; }
  const el=document.createElement('div'); el.className='win-overlay'; el.id='introOverlay';
  el.style.background='radial-gradient(70% 70% at 50% 35%,rgba(16,51,74,.97),rgba(3,12,18,.97))';
  el.innerHTML=`<div style="max-width:560px;width:100%;text-align:right;max-height:86vh;overflow-y:auto">
    <h2 style="font-size:clamp(24px,6vw,34px);text-align:center;margin-bottom:4px">המשחק הזה כולל</h2>
    <p style="color:#93B2C2;text-align:center;margin:0 0 16px;font-size:13.5px">
      קראו רגע לפני שמתחילים — יש כאן חוקים שלא קיימים במשחק הבסיסי.</p>
    <div id="introList"></div>
    <button class="btn gold wide" id="introGo" style="margin-top:16px">מתחילים</button></div>`;
  document.body.appendChild(el);
  const list=el.querySelector('#introList');
  ids.forEach(id=>{
    const x=EXPANSIONS.find(e=>e.id===id); if(!x) return;
    const d=document.createElement('div');
    d.style.cssText='background:rgba(255,255,255,.055);border:1px solid var(--edge-soft);'+
      'border-radius:14px;padding:13px;margin-bottom:9px;text-align:right';
    d.innerHTML=`<b style="font-size:16px;color:#E0A93B">${x.name}</b>
      <div style="font-size:12.5px;color:#93B2C2;margin:2px 0 8px">${x.sub}</div>
      <div style="font-size:13px;color:#C7DCE6;line-height:1.65">${x.body}</div>`;
    if(x.tut){
      const tb=document.createElement('button'); tb.className='btn sm'; tb.style.marginTop='9px';
      tb.textContent='🎓 קודם נתרגל — הדרכה עם משחק דמה';
      tb.onclick=()=>{ el.remove(); startTutorial(x.tut); };
      d.appendChild(tb);
    }
    list.appendChild(d);
  });
  el.querySelector('#introGo').onclick=()=>{ SFX.tap(); el.remove(); done(); };
}

function startGame(G,B,mode,meIdx,room){
  ST.G=G; ST.B=B; ST.mode=mode; ST.meIdx=meIdx; ST.room=room||null;
  ST.place=null; ST.near=null; ST.lastNeed=''; ST.busy=false;
  ST.curtainFor=null; ST.lastHuman=null; ST.discardSel=[]; ST.handOwner=null; ST.handCounts={}; ST.handAnimated=false;
  /* the dice counter belongs to this game only: a previous game in the same page (against the
     computer, say) must not make this one skip showing the opponents' first rolls */
  lastRollSeen=G.rollId||0;
  { const cu=$('#curtain'); if(cu) cu.remove(); }
  winShown=false; const wo=$('#winOverlay'); if(wo) wo.remove();
  Object.keys(anim).forEach(k=>delete anim[k]);
  Object.keys(chimney).forEach(k=>delete chimney[k]);
  Object.keys(hexWake).forEach(k=>delete hexWake[k]);
  initSky(B,'game');
  Object.keys(buildAnim).forEach(k=>delete buildAnim[k]);
  fx.length=0; robberAnim=null; tokenPulse={};
  $('#home').classList.add('hidden'); $('#game').classList.remove('hidden');
  SFX.unlock(); SFX.ambient(); paintSound();
  $('#roomChip').style.display = room?'':'none';
  if(room) $('#roomChip').textContent=room;
  syncUI();
  requestAnimationFrame(()=>{ resizeCanvas(); fitNow(); syncUI(); });
  setTimeout(()=>{ resizeCanvas(); fitNow(); },120);
}
function startLocalGame(){
  const cfg=readCfg(playerCount);
  const seated=seats.slice(0,playerCount).map(s=>({name:s.name,color:PCOLORS[s.color].id,bot:s.bot||null,g:s.g||null}));
  const plan=rollOffPlan(seated.length);                 /* a die each decides who starts */
  const defs=plan.order.map(i=>seated[i]);
  const seed=randInt(2147483647);
  const {G,board}=newGame(cfg,defs,seed);
  G.startRoll=plan.startRoll;
  G.log.push({t:'סדר המשחק נקבע בהטלת קובייה: '+G.players.map(p=>p.name).join(' · '),turn:0});
  showExpansionIntro(cfg,()=>{ startGame(G,board,'local',-1,null); showStartRoll(G); });
}
function stopRoomWatch(){
  if(netUnsub){ try{netUnsub();}catch(e){} netUnsub=null; }
  if(roomPoll){ clearInterval(roomPoll); roomPoll=null; }
  lastV=0; introPending=false; deferredDoc=null; lastRoomKey=null;
}
function leaveGame(){
  stopRoomWatch(); stopStartRoll();
  ST.G=null; ST.B=null; ST.room=null; ST.mode='local'; ST.meIdx=-1; ST.tut=null;
  { const cu=$('#curtain'); if(cu) cu.remove(); const co=$('#coach'); if(co) co.classList.add('hidden'); }
  { const so=$('#stealOv'); if(so) so.remove(); const tr=$('#tres'); if(tr) tr.remove(); }
  document.body.classList.remove('tut');
  winShown=false; const wo=$('#winOverlay'); if(wo) wo.remove();
  const io=$('#introOverlay'); if(io) io.remove();
  closeAllSheets();
  history.replaceState(null,'',location.pathname+location.search);
  $('#game').classList.add('hidden'); $('#home').classList.remove('hidden');
  clearTimeout(botTimer); botTimer=null; botGuard=0;
  SFX.stop();
  renderOnlinePane();
}

