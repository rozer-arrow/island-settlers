/* =========================================================
   Trading with other players.
   Step 1: tap the cards from your own hand that you will give.
   Step 2: tap what you want to get, then choose who to offer it to.
   The answer comes back as a big card over the board.
   ========================================================= */
const fmtObj = obj => RES.filter(r=>obj[r]>0).map(r=>obj[r]+' '+RES_HE[r]).join(' + ') || '—';
let tresT=null;
function tradeGiveObj(){
  const G=ST.G, tr=ST.trade, p=G.players[tr.who];
  const list=[]; RES.forEach(r=>{ for(let i=0;i<p.res[r];i++) list.push(r); });
  const o={}; RES.forEach(r=>o[r]=0);
  tr.give.forEach(i=>{ if(list[i]) o[list[i]]++; });
  return o;
}
function refreshTrade(){ drawHand(); drawActions(currentNeed(ST.G)); }
function startPlayerTrade(){
  const G=ST.G, me=actor();
  if(currentNeed(G).kind!=='main' || G.players.length<2) return;
  ST.place=null; ST.near=null; clearTradeBanner();
  ST.trade={who:me,step:'give',give:[],want:{wood:0,brick:0,sheep:0,wheat:0,ore:0}};
  toast('בחרו בעצמכם את הקלפים שתתנו',2400);
  refreshTrade();
}
function endPlayerTrade(){ ST.trade=null; clearTradeBanner(); refreshTrade(); }

function clearTradeBanner(){ clearTimeout(tresT); const b=$('#tres'); if(b) b.remove(); }
function showTradeBanner(kind,big,small,btns){
  clearTradeBanner();
  const el=document.createElement('div'); el.id='tres'; el.className='tres '+kind;
  el.innerHTML=`<div class="big">${big}</div>${small?`<div class="small">${small}</div>`:''}<div class="btns"></div>`;
  const bt=el.querySelector('.btns');
  (btns||[]).forEach(b=>{ const x=document.createElement('button'); x.className='btn '+(b.cls||''); x.textContent=b.label; x.onclick=b.fn; bt.appendChild(x); });
  $('#coach').parentElement.appendChild(el);
  return el;
}
function declinedBanner(o){
  SFX.lose();
  showTradeBanner('no','✖ '+o.name+' '+notInterested(o)+' לסחור איתך','אפשר לנסות הצעה אחרת, או לפנות לשחקן אחר.',[
    {label:'נסו הצעה אחרת',cls:'gold',fn:()=>{ clearTradeBanner(); if(ST.trade){ ST.trade.step='want'; refreshTrade(); } }},
    {label:'ביטול',fn:()=>endPlayerTrade()}]);
}
function doneBanner(o,give,want){
  SFX.coins();
  showTradeBanner('yes','✔ '+o.name+' '+agreeWord(o)+' — ההחלפה בוצעה!',
    'נתתם: '+fmtObj(give)+'<br>קיבלתם: '+fmtObj(want),[{label:'מעולה',cls:'gold',fn:clearTradeBanner}]);
  tresT=setTimeout(clearTradeBanner,5000);
}

function finishTrade(i,offer){
  const G=ST.G, o=G.players[i];
  G.offer={from:offer.from,give:offer.give,want:offer.want,open:true,replies:{}};
  const ok=settleOffer(G,i);
  G.offer=null; ST.trade=null; closeAllSheets(); ST.lastNeed='';
  afterAction();
  if(ok) doneBanner(o,offer.give,offer.want); else declinedBanner(o);
}
function proposeTrade(i,giveObj,wantObj){
  const G=ST.G, me=actor(), o=G.players[i];
  const offer={from:me,give:giveObj,want:wantObj};
  if(o.bot){
    const probe=Object.assign({open:true,replies:{}},offer);
    if(!botAcceptsOffer(G,i,probe)) return declinedBanner(o);
    return finishTrade(i,offer);
  }
  /* another person on the same device: ask them, privately */
  const body=$('#pickBody'); body.innerHTML='';
  $('#pickTitle').textContent=o.name+', יש לך הצעה';
  $('#pickSub').textContent=`${G.players[me].name} נותן ${fmtObj(giveObj)} ומבקש ${fmtObj(wantObj)}`;
  const yes=document.createElement('button'); yes.className='btn gold wide'; yes.style.marginBottom='8px';
  yes.textContent=agreeWord(o);
  yes.onclick=()=>{
    if(RES.some(r=>o.res[r]<(wantObj[r]||0))){ closeAllSheets(); return declinedBanner(o); }
    finishTrade(i,offer);
  };
  const no=document.createElement('button'); no.className='btn wide'; no.textContent=notInterested(o);
  no.onclick=()=>{ closeAllSheets(); declinedBanner(o); };
  body.append(yes,no);
  openSheet('sheetPick');
}
/* online: an open offer to the whole table */
function sendTableOffer(){
  const G=ST.G;
  if(makeOffer(G,tradeGiveObj(),Object.assign({},ST.trade.want))){ ST.trade=null; ST.lastNeed=''; afterAction(); }
}
/* the proposer's live view of the answers (online) — a banner, not a sheet */
function offerSig(o){ return o ? o.from+'|'+JSON.stringify(o.give)+'|'+JSON.stringify(o.want) : ''; }
function renderOfferBanner(){
  const G=ST.G, o=G&&G.offer;
  const mine = !!(o&&o.open&&ST.mode==='online'&&ST.meIdx===o.from);
  const cur=$('#tres');
  if(!mine){
    if(cur&&cur.dataset.offer){ cur.remove(); }
    /* we answered someone's offer and are showing "waiting for them"; once that offer is no
       longer open (closed, cancelled, or the turn moved on) the card has nothing left to say */
    if(cur&&cur.dataset.reply && (!o || !o.open || offerSig(o)!==cur.dataset.reply)) clearTradeBanner();
    return;
  }
  const others=G.players.map((p,i)=>i).filter(i=>i!==o.from);
  const replied=others.filter(i=>o.replies[i]);
  const anyYes=others.some(i=>o.replies[i]==='yes'), allNo=others.every(i=>o.replies[i]==='no');
  const kind = anyYes?'yes': (allNo?'no':'wait');
  const key=JSON.stringify(o.replies)+kind;
  if(cur&&cur.dataset.offer===key) return;
  const el=showTradeBanner(kind,
    anyYes ? '✔ יש מי שמסכים!' : (allNo ? '✖ אף אחד לא מעוניין' : 'ההצעה נשלחה — ממתינים לתשובות'),
    'נותנים: '+fmtObj(o.give)+' · מבקשים: '+fmtObj(o.want), []);
  el.dataset.offer=key;
  el.style.animation='none';
  others.forEach(i=>{
    const p=G.players[i], st=o.replies[i];
    const line=document.createElement('div'); line.className='line';
    line.innerHTML=`<span class="dot" style="width:12px;height:12px;border-radius:50%;background:${colOf(G,i).hex};display:inline-block"></span>
      <span class="nm">${p.name}</span>
      <span class="st ${st==='yes'?'y':st==='no'?'n':'w'}">${st==='yes'?agreeWord(p):st==='no'?notInterested(p):'ממתין…'}</span>`;
    if(st==='yes'){ const b=document.createElement('button'); b.className='btn gold'; b.textContent='סגירת עסקה';
      b.onclick=()=>{ const GG=ST.G, oo=GG&&GG.offer; if(!oo||!oo.open) return;   /* always the live state, never the one this banner was drawn from */
        const wasGive=oo.give, wasWant=oo.want; const from=GG.players[GG.offer.from], to=GG.players[i];
        if(settleOffer(GG,i)){
          emitFx({t:'toast',text:`✔ העסקה נסגרה בין ${from.name} ל${to.name}`,snd:'coins'});
          ST.lastNeed=''; afterAction(); doneBanner(GG.players[i],wasGive,wasWant); } };
      line.appendChild(b); }
    el.insertBefore(line,el.querySelector('.btns'));
  });
  const bt=el.querySelector('.btns');
  const c=document.createElement('button'); c.className='btn'; c.textContent=allNo?'נסו הצעה אחרת':'ביטול ההצעה';
  c.onclick=()=>{ const GG=ST.G;
    if(GG && GG.offer && GG.offer.open){ const pp=GG.players[GG.offer.from];
      emitFx({t:'toast',text:`${pp.name} ${gv(pp,'ביטל','ביטלה')} את הצעת החליפין`}); }
    if(GG) GG.offer=null; clearTradeBanner(); ST.lastNeed=''; afterAction(); if(allNo){ startPlayerTrade(); } };
  bt.appendChild(c);
}

function openOfferSheet(){
  const G=ST.G, o=G.offer; if(!o) return;
  if(ST.meIdx===o.from){ renderOfferBanner(); return; }          /* the proposer never gets a sheet */
  /* already answered: the offer stays open until the proposer closes it, so show a quiet
     "waiting" card instead of asking again on every state sync */
  if(o.replies && o.replies[ST.meIdx]){
    const mine=o.replies[ST.meIdx];
    const cur=$('#tres');
    if(cur && cur.dataset.reply===offerSig(o) && cur.dataset.ans===mine) return;   /* already showing it */
    const meP=G.players[ST.meIdx];
    const el=showTradeBanner(mine==='yes'?'ok':'wait',
      mine==='yes'?'ענית: '+agreeWord(meP):'ענית: '+notInterested(meP),
      mine==='yes'?`ממתינים ל${G.players[o.from].name} לסגור את העסקה…`:`ממתינים ל${G.players[o.from].name}…`,[]);
    if(el){ el.dataset.reply=offerSig(o); el.dataset.ans=mine; }
    return;
  }
  const body=$('#pickBody'); body.innerHTML='';
  const from=G.players[o.from];
  $('#pickTitle').textContent='הצעת חליפין';
  $('#pickSub').textContent=`${from.name} נותן ${fmtObj(o.give)} ומבקש ${fmtObj(o.want)}`;
  /* the sheet covers your hand, so spell out what you're holding before you answer */
  {
    const meP2=G.players[ST.meIdx], held=RES.filter(r=>meP2.res[r]>0);
    const hw=document.createElement('div');
    hw.style.cssText='display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:rgba(0,0,0,.22);border:1px solid var(--edge-soft);border-radius:12px;padding:8px 10px;margin-bottom:12px';
    const lbl=document.createElement('span'); lbl.style.cssText='color:#93B2C2;font-size:12px;font-weight:700;flex:0 0 auto';
    lbl.textContent='ביד שלכם:'; hw.appendChild(lbl);
    if(!held.length){ const e=document.createElement('span'); e.style.cssText='color:#93B2C2;font-size:12.5px'; e.textContent='אין לכם קלפים ביד'; hw.appendChild(e); }
    held.forEach(r=>{
      const chip=document.createElement('span'); chip.style.cssText='display:flex;align-items:center;gap:3px;font-size:12.5px;font-weight:700;color:#E7F0F5';
      chip.appendChild(miniRes(r,20));
      const n=document.createElement('span'); n.textContent='×'+meP2.res[r];
      if((o.want[r]||0)>0) chip.style.color = meP2.res[r]>=(o.want[r]||0) ? '#7FD6AE' : '#E0765F';
      chip.appendChild(n); hw.appendChild(chip);
    });
    body.appendChild(hw);
  }
  const yes=document.createElement('button'); yes.className='btn gold wide'; yes.style.marginBottom='8px';
  const meP=G.players[ST.meIdx];
  yes.textContent=agreeWord(meP);
  yes.onclick=()=>{
    const GG=ST.G; if(!GG||!GG.offer||!GG.offer.open){ closeAllSheets(); return; }
    const mp=GG.players[ST.meIdx];
    const has=RES.every(r=>mp.res[r]>=(GG.offer.want[r]||0));
    replyOffer(GG,ST.meIdx,has); push(); closeAllSheets();
    if(!has) toast('אין לך את הקלפים לזה');
    ST.lastNeed=''; openOfferSheet(); };
  const no=document.createElement('button'); no.className='btn wide'; no.textContent=notInterested(meP);
  no.onclick=()=>{ const GG=ST.G; if(GG&&GG.offer&&GG.offer.open){ replyOffer(GG,ST.meIdx,false); push(); } closeAllSheets(); ST.lastNeed=''; openOfferSheet(); };
  body.append(yes,no);
  openSheet('sheetPick');
}

/* ---------- log & menu ---------- */
function openLog(){
  const G=ST.G, box=$('#logbox'); box.innerHTML='';
  G.log.slice().reverse().forEach(l=>{ const d=document.createElement('div'); d.textContent=l.t; box.appendChild(d); });
  if(!G.log.length) box.textContent='עוד לא קרה כלום.';
  openSheet('sheetLog');
}
function openMenu(){
  const body=$('#menuBody'); body.innerHTML='';
  const G=ST.G;
  const mk=(label,fn,cls)=>{ const b=document.createElement('button');
    b.className='btn wide '+(cls||''); b.textContent=label; b.onclick=fn; body.appendChild(b); return b; };
  if(ST.mode==='online'&&ST.room){
    const info=document.createElement('div');
    info.style.cssText='background:rgba(0,0,0,.25);border:1px solid var(--edge-soft);border-radius:12px;padding:12px;text-align:center;margin-bottom:6px';
    info.innerHTML=`<div style="font-size:12.5px;color:#93B2C2">קוד החדר</div>
      <div style="font-family:var(--display);font-size:30px;letter-spacing:.2em;color:#E0A93B;font-weight:900">${ST.room}</div>`;
    body.appendChild(info);
    mk('העתקת קישור למשחק',()=>{
      const url=location.href.split('#')[0]+'#room='+ST.room;
      navigator.clipboard&&navigator.clipboard.writeText(url).then(()=>toast('הקישור הועתק'),()=>toast(url));
    },'gold');
  }
  mk(isDesk()?'חזרה לתצוגת טלפון':'מצב דסקטופ (למחשב)',()=>{ closeAllSheets(); setDesk(!isDesk()); },'gold');
  mk(LANG==='en'?'עברית':'English',()=>{ closeAllSheets(); setLang(LANG==='en'?'he':'en'); });
  const cloudBtn=mk(CLOUD_LEVELS[cloudLevelIdx()].he,()=>{ cycleCloudOpacity(); cloudBtn.textContent=CLOUD_LEVELS[cloudLevelIdx()].he; });
  const ecoLabel=()=>ECO?'מצב חסכוני: פועל':'מצב חסכוני: כבוי';
  const ecoBtn=mk(ecoLabel(),()=>{ setEco(!ECO); ecoBtn.textContent=ecoLabel(); toast(ECO?'מצב חסכוני פועל — פחות אנימציה, פחות סוללה':'מצב חסכוני כבוי'); });
  mk('מרכוז הלוח',()=>{ fitNow(); closeAllSheets(); });
  mk('חוקי המשחק',()=>{
    /* no demo-game button here: starting one in the middle of a real game would throw that game away */
    const c=$('#rulesExp .inner').cloneNode(true);
    c.querySelectorAll('[data-starttut]').forEach(x=>x.remove());
    showInfo('תקציר חוקים', c.innerHTML); });
  mk('יציאה לתפריט הראשי',()=>{
    askConfirm('לצאת מהמשחק?', ST.mode==='online'?'תוכלו לחזור לחדר דרך אותו קישור.':'המצב המקומי לא יישמר.','כן, לצאת',()=>leaveGame());
  },'danger');
  openSheet('sheetMenu');
}
function showInfo(title,html){
  $('#infoTitle').textContent=title; $('#infoBody').innerHTML='<div class="inner">'+html+'</div>';
  $('#infoBody').style.maxHeight='none';
  openSheet('sheetInfo');
}

/* ---------- win ---------- */
let winShown=false;
function showWin(){
  if(winShown) return; winShown=true;
  const G=ST.G, w=G.players[G.winner];
  const online = ST.mode==='online' && !!ST.room;
  const el=document.createElement('div'); el.className='win-overlay'; el.id='winOverlay';
  el.innerHTML=`<div>
    <div class="crown">👑</div>
    <h2 style="color:${colOf(G,G.winner).hex}">${w.name} ניצח</h2>
    <p style="color:#93B2C2;margin:0 0 6px">${vpTotal(G,G.winner)} נקודות ניצחון</p>
    <div style="margin:18px 0;display:flex;flex-direction:column;gap:6px;max-width:320px">
      ${G.players.map((p,i)=>`<div style="display:flex;justify-content:space-between;background:rgba(255,255,255,.06);padding:8px 12px;border-radius:10px">
        <span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${colOf(G,i).hex}"></span> ${p.name}</span>
        <b>${vpTotal(G,i)}</b></div>`).join('')}
    </div>
    <div id="rematchBox"></div>
    <button class="btn ${online?'':'gold'}" id="winBack" style="margin-top:${online?'10px':'0'}">${online?'יציאה לתפריט':'חזרה לתפריט'}</button></div>`;
  document.body.appendChild(el);
  SFX.win();
  $('#winBack').onclick=async()=>{ if(online && lobby && (lobby.rematch||{})[uid]!==false){ try{ await setRematchReady(false); }catch(e){} } leaveGame(); };
  if(online) renderRematchPanel();
  const winHex=colOf(G,G.winner).hex;      /* captured now — G may be overwritten in place by a later rematch */
  for(let i=0;i<70;i++) setTimeout(()=>{
    const x=(Math.random()*2-1)*3, y=(Math.random()*2-1)*2;
    spawnBurst(x,y,['#FFE9A8','#E0A93B','#FFFFFF',winHex][i%4],5);
  },i*28);
}
/* ---------- online rematch: same room, same friends ---------- */
function renderRematchPanel(){
  const box=$('#rematchBox'); if(!box) return;
  const G=ST.G; if(!G||!lobby) return;
  const rm=lobby.rematch||{};
  const seats=lobby.seats||[];
  const mine=rm[uid];                                  /* true = ready, false = not this time, undefined = no answer yet */
  const word=(s,m,f)=>s.g==='f'?f:m;
  const status=s=>{
    const v=rm[s.uid];
    if(v===true)  return {t:word(s,'מוכן למשחק נוסף','מוכנה למשחק נוסף'),c:'#7FD6AE'};
    if(v===false) return {t:word(s,'לא מעוניין במשחק נוסף','לא מעוניינת במשחק נוסף'),c:'#E0765F'};
    return {t:'ממתינים לתגובה',c:'#E0A93B'};
  };
  const someoneOut=seats.some(s=>rm[s.uid]===false);
  box.innerHTML=`<div style="margin:14px 0 10px;font-size:13px;color:#93B2C2">משחק חוזר — אותו חדר, אותם שחקנים</div>
    <div style="display:flex;flex-direction:column;gap:6px;max-width:320px;margin:0 auto 12px">
      ${seats.map(s=>{ const st=status(s); return `<div style="display:flex;justify-content:space-between;gap:10px;background:rgba(255,255,255,.05);
        padding:7px 12px;border-radius:10px;font-size:13.5px">
        <span>${s.name}${s.uid===uid?' (אתם)':''}</span>
        <b style="color:${st.c}">${st.t}</b></div>`; }).join('')}
    </div>
    ${someoneOut?'<div style="font-size:12.5px;color:#93B2C2;margin:-4px 0 10px">משחק חוזר מתחיל רק כשכל השחקנים מוכנים.</div>':''}
    <div style="display:flex;gap:8px;max-width:320px;margin:0 auto">
      <button class="btn ${mine===true?'':'gold'}" style="flex:1" id="rematchYes">${mine===true?'ביטול':'אני בפנים!'}</button>
      <button class="btn" style="flex:1${mine===false?';opacity:.6':''}" id="rematchNo">לא הפעם</button>
    </div>`;
  $('#rematchYes').onclick=()=>setRematchReady(mine===true?null:true);
  $('#rematchNo').onclick=()=>{ if(mine!==false) setRematchReady(false); };
}
/* ready: true / false (not this time) / null (take back my answer) */
async function setRematchReady(ready){
  if(!roomDoc) return;
  try{
    const fresh=(await roomDoc.get()).data();
    const rm=Object.assign({},fresh.rematch||{});
    if(ready===null) delete rm[uid]; else rm[uid]=ready;
    await roomDoc.set(Object.assign({},fresh,{rematch:rm,v:(fresh.v||1)+1}));
    if(lobby) lobby.rematch=rm;
  }catch(e){ toast('לא הצלחנו לעדכן'); return; }
  renderRematchPanel();
  maybeTriggerRematch();
}
let rematchTriggering=false;
function maybeTriggerRematch(){
  if(!lobby || lobby.host!==uid || rematchTriggering) return;         /* only the host deals the new game */
  const seats=lobby.seats||[];
  if(!seats.length || !seats.every(s=>lobby.rematch && lobby.rematch[s.uid]===true)) return;
  rematchTriggering=true;
  hostStart(Object.assign({},lobby,{seed:randInt(2147483647),rematch:{}}))
    .finally(()=>{ rematchTriggering=false; });
}
function resetForRematch(){
  winShown=false; const wo=$('#winOverlay'); if(wo) wo.remove();
  ST.place=null; ST.pendingPlace=null; ST.near=null; ST.trade=null;
  toast('משחק חדש התחיל — בהצלחה!');
}

