/* =========================================================
   10. ONLINE ROOMS
   ========================================================= */
let DB=null, USER=null, uid=null, netUnsub=null, netReady=false, netChecked=false, roomDoc=null;
let lobby=null;         /* {code, cfg, seed, seats:[], started, host} */
let lastRollSeen=0, pushTimer=null, pushPending=false, pushBusy=false, deferredDoc=null;
let lastRoomKey=null;
/* a cheap fingerprint of a room document, to recognise a read that brings nothing new */
function roomKey(d){ try{ return JSON.stringify([d.v,d.started,d.seed,d.rematch,d.seats,d.state]); }catch(e){ return null; } }
let roomPoll=null, pollBusy=false, lastV=0, introPending=false;

async function initNet(){
  const note=$('#onlineNote');
  note.textContent='בודק חיבור…';
  try{
    DB = await claude.use('db');
    USER = await claude.use('user');
  }catch(e){ DB=null; }
  uid = null;
  if(USER){ try{ uid = await USER.id(); }catch(e){} }
  if(!uid){ uid = ls('siid') || ('g'+Math.random().toString(36).slice(2,10)); ls('siid',uid); }
  netReady = !!DB; netChecked = true;
  if(!DB){
    note.innerHTML='משחק מקוון לא זמין בתצוגה הזו. אפשר לשחק על מכשיר אחד — כולם סביב אותו מסך.';
    $('#createRoom').disabled=true; $('#joinRoom').disabled=true;
  } else {
    $('#createRoom').disabled=false; $('#joinRoom').disabled=false;
    note.innerHTML='כל מי שפותח את הקישור ונכנס עם קוד החדר מצטרף לאותו לוח. '+
      'שימו לב: הלוח המשותף פתוח רק למי שמחובר לאותו מרחב עבודה ב‑Claude — '+
      'חבר מחוץ לארגון יראה את המשחק אך לא יוכל לשחק בו. במקרה כזה שחקו במצב "על מכשיר אחד".';
    const h=(location.hash||'').match(/room=([A-Z0-9]{4})/i);
    if(h){ $('#joinCode').value=h[1].toUpperCase(); setMode('online'); setTimeout(()=>joinRoom(h[1].toUpperCase()),300); }
  }
}
const CODE_CH='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(){ let s=''; for(let i=0;i<4;i++) s+=CODE_CH[randInt(CODE_CH.length)]; return s; }

async function createRoom(){
  if(!DB) return;
  const name=($('#myName').value||'').trim()||'מארח';
  ls('siname',name);
  if(!myGender){ const gg=genderGuess(name);
    if(gg==='m'||gg==='f') myGender=gg;
    else return askGender(name,k=>{ myGender=k; ls('sigender',k); createRoom(); }); }
  const code=newCode();
  const cfg=readCfg(4);
  const doc={code, host:uid, started:false, seed:randInt(2147483647),
    cfg, seats:[{uid,name,color:PCOLORS[myColor].id,g:myGender}], state:null, rematch:{},
    target:sel.target||10, targetOk:{[uid]:true}, v:1};
  try{
    await DB.doc('rooms/'+code).set(doc);
  }catch(e){ toast('לא הצלחנו לפתוח חדר'); return; }
  ST.room=code; ST.mode='online';
  history.replaceState(null,'','#room='+code);
  watchRoom(code);
}
async function joinRoom(code){
  if(!DB) return;
  code=(code||'').toUpperCase().trim();
  if(code.length!==4){ toast('קוד חדר הוא 4 תווים'); return; }
  const name=($('#myName').value||'').trim()||ls('siname')||'שחקן';
  ls('siname',name);
  if(!myGender){ const gg=genderGuess(name);
    if(gg==='m'||gg==='f') myGender=gg;
    else return askGender(name,k=>{ myGender=k; ls('sigender',k); joinRoom(code); }); }
  const ref=DB.doc('rooms/'+code);
  let snap;
  try{ snap=await ref.get(); }catch(e){ toast('לא הצלחנו להתחבר'); return; }
  if(!snap.exists){ toast('אין חדר עם הקוד הזה'); return; }
  const d=deepClone(snap.data());
  const mine=(d.seats||[]).findIndex(s=>s.uid===uid);
  if(mine<0){
    if(d.started){ toast('המשחק כבר התחיל'); return; }
    if((d.seats||[]).length>=6){ toast('החדר מלא'); return; }
    const lease=await ref.acquire({holder:uid,ttlMs:4000}).catch(()=>({acquired:false}));
    const fresh=deepClone((await ref.get()).data()||d);
    const used=(fresh.seats||[]).map(s=>s.color);
    /* keep the colour the player picked on the home screen; only fall back if it's taken */
    const want=PCOLORS[myColor];
    const col=(want && used.indexOf(want.id)<0) ? want
            : (PCOLORS.find(c=>used.indexOf(c.id)<0)||PCOLORS[0]);
    const nseats=(fresh.seats||[]).concat([{uid,name,color:col.id,g:myGender}]);
    try{ await ref.set(Object.assign({},fresh,{seats:nseats,v:(fresh.v||1)+1})); }
    catch(e){ toast('לא הצלחנו לשבת לשולחן'); return; }
  }
  ST.room=code; ST.mode='online';
  history.replaceState(null,'','#room='+code);
  watchRoom(code);
}

/* One place that turns a room document into UI. It is fed by the live subscription AND by a
   light poll, because not every viewer gets live updates (people outside the author's workspace,
   or a phone that put the page to sleep): the poll keeps everyone in step regardless. */
function mergeInto(dst,src){
  const both=(a,b)=>a&&b&&typeof a==='object'&&typeof b==='object'&&Array.isArray(a)===Array.isArray(b);
  if(Array.isArray(dst)){
    dst.length=src.length;
    for(let i=0;i<src.length;i++){ if(both(dst[i],src[i])) mergeInto(dst[i],src[i]); else dst[i]=src[i]; }
    return dst;
  }
  Object.keys(dst).forEach(k=>{ if(!(k in src)) delete dst[k]; });
  Object.keys(src).forEach(k=>{ if(both(dst[k],src[k])) mergeInto(dst[k],src[k]); else dst[k]=src[k]; });
  return dst;
}
function applyRoom(d,fromPoll){
  const ver=d.v||1;
  /* A snapshot at a version we have already applied is an echo, and re-applying it would undo
     a local change made since (cancelling an offer, say). This holds for live updates too, not
     just polled ones — an echo can arrive either way. */
  /* Strictly older only: two clients can pick the same next version when they write at the
     same moment, so an equal version may still be genuinely new information from someone else. */
  if(ver<lastV) return;
  /* The poll re-reads the room every couple of seconds, and most of those reads are exactly
     what we already have. Such a read must not touch the screen at all — otherwise it closes
     whatever the player has open (the bank, the log, choosing where a road goes). */
  const sameAsShown = ver===lastV && lastRoomKey!==null && roomKey(d)===lastRoomKey;
  if(sameAsShown) return;
  if(pushPending||pushTimer||pushBusy){
    /* We have a local change that hasn't reached the server yet. Applying someone else's state
       now would silently undo it, so hold this one and replay it the moment our push lands. */
    deferredDoc=d; return;
  }
  lastV=Math.max(lastV,ver);
  lastRoomKey=roomKey(d);
  const code=d.code;
  const wasOver = !!(ST.G && ST.G.phase==='over');
  /* snapshots are frozen and platform-owned: never hand one to the engine */
  lobby={code:d.code, host:d.host, started:!!d.started, seed:d.seed,
         cfg:deepClone(d.cfg||{}), seats:deepClone(d.seats||[]), rematch:deepClone(d.rematch||{}),
         target:d.target||10, targetOk:deepClone(d.targetOk||{}), v:ver};
  const mine=(lobby.seats||[]).findIndex(s=>s.uid===uid);
  if(!d.started){ renderLobby(lobby,mine); return; }
  /* game is live */
  if(!d.state) return;
  const G=deepClone(d.state);
  const rebuild = !ST.B || ST.B.seed!==lobby.seed;
  const B = rebuild ? buildBoard(lobby.cfg,lobby.seed) : ST.B;
  const first = !ST.G || $('#game').classList.contains('hidden');
  if(first || !ST.G) ST.G=G; else mergeInto(ST.G,G);     /* same object all along */
  ST.B=B; ST.mode='online'; ST.meIdx=mine; ST.room=code;
  if(first){
    if(introPending) return;
    introPending=true;
    showExpansionIntro(lobby.cfg,()=>{ introPending=false;
      startGame(ST.G||G,ST.B||B,'online',(lobby.seats||[]).findIndex(s=>s.uid===uid),code);
      if(ST.G.startRoll && !Object.keys(ST.G.buildings||{}).length) showStartRoll(ST.G); });
  } else if(wasOver && G.phase!=='over'){
    /* a finished game just turned back into a fresh one — a rematch the host dealt */
    ST.G=G; ST.B=B; ST.mode='online'; ST.meIdx=mine; ST.room=code;
    lastRollSeen=G.rollId||0;
    resetForRematch();
    ST.lastNeed=''; syncUI();
    if(G.startRoll && !Object.keys(G.buildings||{}).length) showStartRoll(G);
  } else {
    if($('#winOverlay') && G.phase==='over'){ renderRematchPanel(); maybeTriggerRematch(); }
    if((G.rollId||0)>lastRollSeen && G.turn!==undefined){
      lastRollSeen=G.rollId||0;
      if(actor()!==ST.meIdx || !ST.busy){
        /* hold the board on the pre-roll picture until the dice have visibly landed, exactly as
           the roller's own screen does — otherwise the result leaks before the animation ends */
        ST.busy=true;
        const reroll = G.lastRoll===7 && G.sub==='roll';
        showDice(G.dice[0],G.dice[1],()=>{ ST.busy=false; SFX.diceLand(G.lastRoll);
          if(!reroll) productionFx(G.lastRoll); ST.lastNeed=''; syncUI();
          if(G.lastRoll===7 && !reroll) announceSeven(); });
        return;                       /* the callback does the syncUI */
      }
    }
    /* No forced reset of ST.lastNeed here: syncUI compares the turn/phase signature itself and
       only closes menus or cancels a placement when that genuinely changed. Everything else
       (another player's cards, a reply to an offer) just redraws in place. */
    syncUI();
  }
}
async function pollRoomOnce(){
  if(!roomDoc || pollBusy) return;
  pollBusy=true;
  try{ const snap=await roomDoc.get(); if(snap && snap.exists) applyRoom(snap.data(),true); }
  catch(e){ /* offline for a moment — the next tick tries again */ }
  pollBusy=false;
}
function watchRoom(code){
  stopRoomWatch();
  roomDoc=DB.doc('rooms/'+code);
  netUnsub=roomDoc.onSnapshot(snap=>{ if(snap.exists) applyRoom(snap.data(),false); },
    err=>{ /* the live channel dropped; the poll below carries on */ });
  roomPoll=setInterval(()=>{ if(!document.hidden) pollRoomOnce(); },2000);
  pollRoomOnce();
}
/* coming back to the page (phone unlocked, app switched back): catch up right away */
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && roomDoc && ST.room) pollRoomOnce(); });
window.addEventListener('online',()=>{ if(roomDoc && ST.room) pollRoomOnce(); });
window.addEventListener('pageshow',()=>{ if(roomDoc && ST.room) pollRoomOnce(); });

function renderLobby(d,mine){
  const pane=$('#onlinePane');
  const isHost = d.host===uid;
  pane.innerHTML=`
    <div style="text-align:center;margin-bottom:12px">
      <div style="font-size:12.5px;color:#93B2C2">קוד החדר</div>
      <div style="font-family:var(--display);font-size:38px;letter-spacing:.22em;color:#E0A93B;font-weight:900">${d.code}</div>
    </div>
    <button class="btn gold wide" id="lbCopy">העתקת קישור להזמנה</button>
    <div style="height:12px"></div>
    <div class="players-grid" id="lbSeats"></div>
    <div style="height:12px"></div>
    <div id="lbActions"></div>
    <div class="note">${isHost?'כשכולם בפנים — התחילו. ההרחבות שבחרתם בדף הבית יחולו על הלוח.':'ממתינים למארח שיתחיל.'}</div>`;
  const sw=$('#lbSeats');
  (d.seats||[]).forEach(s=>{
    const c=PCOLORS.find(c=>c.id===s.color)||PCOLORS[0];
    const row=document.createElement('div'); row.className='prow';
    row.innerHTML=`<div class="swatch" style="background:${c.hex};cursor:default"></div>
      <div style="flex:1;font-weight:700">${s.name}${s.uid===uid?' (אתם)':''}${s.uid===d.host?' · מארח':''}</div>`;
    sw.appendChild(row);
  });
  $('#lbCopy').onclick=()=>{
    const url=location.href.split('#')[0]+'#room='+d.code;
    if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>toast('הקישור הועתק'),()=>toast(url));
    else toast(url);
  };
  const acts=$('#lbActions');
  /* ---- points to win: 10 by default; 12 only when every player has agreed ---- */
  const tgt=d.target||10, ok=d.targetOk||{}, seats=d.seats||[];
  const all12 = tgt!==12 || seats.every(s=>ok[s.uid]===true);
  const tbox=document.createElement('div');
  tbox.style.cssText='background:rgba(0,0,0,.22);border:1px solid var(--edge-soft);border-radius:14px;padding:12px;margin-bottom:12px';
  tbox.innerHTML=`<div style="font-size:12.5px;color:#93B2C2;margin-bottom:8px">נקודות לניצחון</div>`;
  if(isHost){
    const seg=document.createElement('div'); seg.className='seg';
    [10,12].forEach(v=>{ const b=document.createElement('button'); b.textContent=v+' נקודות';
      b.setAttribute('aria-pressed',v===tgt?'true':'false');
      b.onclick=()=>{ if(v!==tgt) updateRoom(r=>{ r.target=v; r.targetOk={[uid]:true}; }); };
      seg.appendChild(b); });
    tbox.appendChild(seg);
  } else {
    const big=document.createElement('div'); big.style.cssText='font-size:17px;font-weight:800;color:#F0C15C';
    big.textContent=tgt+' נקודות'; tbox.appendChild(big);
  }
  if(tgt===12){
    const hostSeat=seats.find(s=>s.uid===d.host);
    const note=document.createElement('div'); note.style.cssText='font-size:12.5px;color:#93B2C2;margin:8px 0 6px';
    note.textContent=(hostSeat?hostSeat.name:'המארח')+' '+((hostSeat&&hostSeat.g==='f')?'הציעה':'הציע')+' משחק עד 12 נקודות — מתחילים רק אם כולם מסכימים';
    tbox.appendChild(note);
    seats.forEach(s=>{
      const v=ok[s.uid], f=s.g==='f';
      const row=document.createElement('div');
      row.style.cssText='display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:4px 2px';
      const st = v===true ? {t:f?'מסכימה ל‑12':'מסכים ל‑12',c:'#7FD6AE'}
               : v===false ? {t:f?'מעדיפה 10':'מעדיף 10',c:'#E0765F'}
               : {t:'ממתינים לתגובה',c:'#E0A93B'};
      row.innerHTML=`<span>${s.name}${s.uid===uid?' (אתם)':''}</span><b style="color:${st.c}">${st.t}</b>`;
      tbox.appendChild(row);
    });
    if(!isHost){
      const me=ok[uid];
      const bw=document.createElement('div'); bw.style.cssText='display:flex;gap:8px;margin-top:8px';
      const y=document.createElement('button'); y.className='btn '+(me===true?'':'gold'); y.style.flex='1';
      y.textContent='מסכים/ה ל‑12'; y.onclick=()=>updateRoom(r=>{ r.targetOk=Object.assign({},r.targetOk,{[uid]:true}); });
      const nb=document.createElement('button'); nb.className='btn'; nb.style.flex='1';
      nb.textContent='מעדיף/ה 10'; nb.onclick=()=>updateRoom(r=>{ r.targetOk=Object.assign({},r.targetOk,{[uid]:false}); });
      bw.append(y,nb); tbox.appendChild(bw);
    }
  }
  acts.appendChild(tbox);
  if(isHost){
    const b=document.createElement('button'); b.className='btn gold wide';
    const someoneNo = tgt===12 && seats.some(s=>ok[s.uid]===false);
    b.textContent = all12 ? `התחלת משחק (${seats.length} שחקנים · ${tgt} נקודות)`
                  : someoneNo ? 'מישהו מעדיף 10 — אפשר לחזור ל‑10 נקודות'
                  : 'ממתינים שכולם יאשרו 12 נקודות…';
    b.disabled = seats.length<2 || !all12;
    b.onclick=()=>hostStart(d);
    acts.appendChild(b);
  }
  const leave=document.createElement('button'); leave.className='btn ghost wide';
  leave.style.marginTop='8px'; leave.textContent='יציאה מהחדר';
  leave.onclick=()=>{ stopRoomWatch(); ST.room=null;
    history.replaceState(null,'',location.pathname+location.search); renderOnlinePane(); };
  acts.appendChild(leave);
}
async function updateRoom(mut){
  if(!roomDoc) return;
  try{
    const fresh=deepClone((await roomDoc.get()).data());
    mut(fresh);
    await roomDoc.set(Object.assign({},fresh,{v:(fresh.v||1)+1}));
  }catch(e){ toast('לא הצלחנו לעדכן'); }
}
async function hostStart(d){
  const n=(d.seats||[]).length;
  const cfg=readCfg(n);
  /* the room's agreed target, not whatever the host's home screen says right now */
  cfg.target = cfg.ck ? 13 : Math.max(d.target||10, cfg.seafarers?12:0);
  const plan=rollOffPlan(n);                             /* a die each decides who starts */
  const seatsO=plan.order.map(i=>d.seats[i]);            /* seat order = play order, so everyone's index stays consistent */
  const defs=seatsO.map(s=>({name:s.name,color:s.color,uid:s.uid,g:s.g||null}));
  const {G}=newGame(cfg,defs,d.seed);
  G.rollId=0; G.startRoll=plan.startRoll;
  G.log.push({t:'סדר המשחק נקבע בהטלת קובייה: '+G.players.map(p=>p.name).join(' · '),turn:0});
  try{ await roomDoc.set(Object.assign({},d,{started:true,cfg,state:G,seats:seatsO,v:(d.v||1)+1})); }
  catch(e){ toast('לא הצלחנו להתחיל'); }
}

/* full-state push — only the acting player writes */
function push(){
  if(ST.mode!=='online'||!roomDoc||!lobby) return;
  pushPending=true;
  if(pushTimer) return;
  pushTimer=setTimeout(async()=>{
    pushTimer=null;
    if(!pushPending||!ST.G) return;
    pushPending=false;
    const G=ST.G;
    if(G.log.length>40) G.log=G.log.slice(-40);
    pushBusy=true;
    try{ const nv=(lobby.v||1)+1; lobby.v=nv; await roomDoc.set(Object.assign({},lobby,{state:G,started:true,v:nv})); lastV=Math.max(lastV,nv); }
    catch(e){ toast('העדכון לא נשמר — נסו שוב'); }
    pushBusy=false;
    /* Anything that arrived while we were writing was held back so it couldn't undo our move.
       Rather than replaying a snapshot that may itself be out of date, ask the server for the
       authoritative current state now that our write has landed. */
    if(deferredDoc){ deferredDoc=null; pollRoomOnce(); }
  },90);
}

function renderOnlinePane(){
  const pane=$('#onlinePane');
  pane.innerHTML=`
    <div class="sub">פותחים חדר, שולחים את הקישור, וכולם משחקים מהמכשיר שלהם. הלוח מסונכרן לכולם בזמן אמת.</div>
    <div class="prow" style="margin-bottom:10px">
      <div class="swatch" id="myColor"></div>
      <input id="myName" maxlength="14" placeholder="השם שלך">
      <button class="gchip" id="myGenderBtn"></button>
    </div>
    <button class="btn gold wide" id="createRoom">פתיחת חדר חדש</button>
    <div style="height:10px"></div>
    <div class="online-box">
      <input id="joinCode" maxlength="4" placeholder="קוד" autocomplete="off">
      <button class="btn" id="joinRoom">הצטרפות</button>
    </div>
    <div class="note" id="onlineNote"></div>`;
  $('#myName').value = ls('siname')||'';
  const paintG=()=>{ const b=$('#myGenderBtn'); b.textContent=myGender==='m'?'בן':(myGender==='f'?'בת':'בן/בת?');
    b.classList.toggle('ask',!myGender); };
  paintG();
  $('#myGenderBtn').onclick=()=>{ myGender=myGender==='m'?'f':'m'; ls('sigender',myGender); paintG(); };
  $('#myName').onchange=e=>{
    const nmv=e.target.value.trim(); if(!nmv) return;
    const gg=genderGuess(nmv);
    if(gg==='m'||gg==='f'){ myGender=gg; ls('sigender',gg); paintG(); }
    else { myGender=null; paintG(); askGender(nmv,k=>{ myGender=k; ls('sigender',k); paintG(); }); }
  };
  const paint=()=>$('#myColor').style.background=PCOLORS[myColor].hex;
  $('#myColor').onclick=()=>{ myColor=(myColor+1)%6; paint(); }; paint();
  $('#createRoom').onclick=createRoom;
  $('#joinRoom').onclick=()=>joinRoom($('#joinCode').value);
  $('#joinCode').addEventListener('input',e=>{ e.target.value=e.target.value.toUpperCase(); });
  if(!netReady){
    $('#onlineNote').textContent = netChecked
      ? 'משחק מקוון לא זמין בתצוגה הזו. אפשר לשחק על מכשיר אחד.'
      : 'בודקים חיבור…';
    $('#createRoom').disabled=true; $('#joinRoom').disabled=true;
  } else {
    $('#onlineNote').innerHTML='כל מי שפותח את הקישור ומקליד את קוד החדר מצטרף לאותו לוח. '+
      'הלוח המשותף פתוח למי שמחובר לאותו מרחב עבודה ב‑Claude; חבר מחוץ לארגון יוכל לצפות אך לא לשחק — '+
      'במקרה כזה שחקו במצב "על מכשיר אחד".';
  }
}
function setMode(m){
  $$('#modeSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===m));
  $('#localPane').classList.toggle('hidden',m!=='local');
  $('#onlinePane').classList.toggle('hidden',m!=='online');
}

