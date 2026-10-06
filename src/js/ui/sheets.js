/* =========================================================
   8. SHEETS
   ========================================================= */
let openSheetId=null;
function openSheet(id){
  closeAllSheets();
  openSheetId=id; $('#'+id).classList.add('show'); $('#scrim').classList.add('show');
}
function closeAllSheets(){
  $$('.sheet').forEach(s=>s.classList.remove('show'));
  $('#scrim').classList.remove('show'); openSheetId=null;
}
function miniRes(res,size){
  const c=document.createElement('canvas'); c.width=size*2;c.height=size*2;
  const x=c.getContext('2d'); x.scale(2,2);
  const bg=RES_BG[res]; const g=x.createLinearGradient(0,0,0,size);
  g.addColorStop(0,bg[0]); g.addColorStop(1,bg[1]);
  x.fillStyle=g; roundRect(x,0,0,size,size,size*0.22); x.fill();
  drawResIcon(x,res,size/2,size/2,size*0.78);
  c.style.width=size+'px'; c.style.height=size+'px';
  return c;
}

/* ---------- generic resource picker ---------- */
function openPicker(kind){
  const G=ST.G, me=actor(), p=G.players[me];
  const nd=currentNeed(G);
  const conf={
    discard:{title:'השלכת קלפים', sub:`יצא 7 — ${p.name} משליך ${nd.n} קלפים`, n:nd.n,
             cap:r=>(COM.indexOf(r)>=0?p.com[r]:p.res[r])},
    gold:   {title:'שדה זהב', sub:`בחרו ${nd.n} משאבים כרצונכם`, n:nd.n, cap:r=>G.bank[r]},
    plenty: {title:'שנת שפע', sub:'בחרו שני משאבים מהבנק', n:2, cap:r=>G.bank[r]},
    mono:   {title:'מונופול', sub:'בחרו משאב — כולם מוסרים לכם אותו', n:1, single:true}
  }[kind];
  const body=$('#pickBody'); body.innerHTML='';
  $('#pickTitle').textContent=conf.title; $('#pickSub').textContent=conf.sub;
  const KEYS = (kind==='discard'&&isCK(G)) ? RES.concat(COM) : RES;
  const picks={}; KEYS.forEach(r=>picks[r]=0);
  const nameOf=r=>RES_HE[r]||COM_HE[r];
  const chipOf=r=>COM.indexOf(r)>=0?miniCom(r,34):miniRes(r,34);

  /* the choice sheet sits over the hand strip, so show what you're already holding right here */
  if(kind==='plenty'||kind==='mono'){
    const held=RES.filter(r=>p.res[r]>0);
    const hw=document.createElement('div');
    hw.style.cssText='display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:rgba(0,0,0,.22);border:1px solid var(--edge-soft);border-radius:12px;padding:8px 10px;margin-bottom:12px';
    const lbl=document.createElement('span'); lbl.style.cssText='color:#93B2C2;font-size:12px;font-weight:700;flex:0 0 auto';
    lbl.textContent='ביד שלכם:'; hw.appendChild(lbl);
    if(!held.length){ const s=document.createElement('span'); s.style.cssText='color:#93B2C2;font-size:12.5px'; s.textContent='אין לכם קלפים ביד'; hw.appendChild(s); }
    held.forEach(r=>{
      const chip=document.createElement('span'); chip.style.cssText='display:flex;align-items:center;gap:3px;font-size:12.5px;font-weight:700;color:#E7F0F5';
      chip.appendChild(miniRes(r,20));
      const n=document.createElement('span'); n.textContent='×'+p.res[r]; chip.appendChild(n);
      hw.appendChild(chip);
    });
    body.appendChild(hw);
  }

  if(conf.single){
    const wrap=document.createElement('div'); wrap.className='res-pick';
    RES.forEach(r=>{
      const b=document.createElement('button'); b.className='rp';
      b.appendChild(miniRes(r,34));
      const s=document.createElement('span');
      /* the other players' hands are secret — showing the count here would give the chooser
         information the rules never grant them */
      s.textContent=RES_HE[r]; b.appendChild(s);
      b.onclick=()=>{
        closeAllSheets();
        announceThen('wait',`${p.name} ${gv(p,'הכריז','הכריזה')} מונופול!`,`כולם מוסרים את כל ה${RES_HE[r]}`,()=>{
          const GG=ST.G; const n=GG.players.reduce((a,x)=>a+(x.idx===me?0:x.res[r]),0);
          doMonopoly(GG,r); SFX.coins();
          tableToast(n>0 ? `${p.name} ${gv(p,'הכריז מונופול ולקח','הכריזה מונופול ולקחה')} ${n} ${RES_HE[r]} מכולם` : `${p.name} ${gv(p,'הכריז','הכריזה')} מונופול על ${RES_HE[r]} — אבל לאף אחד לא היה`);
          afterAction();
        });
      };
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
    if(G.pendingDev){
      const cancel=document.createElement('button'); cancel.className='btn wide'; cancel.style.marginTop='12px';
      cancel.textContent='ביטול — להשאיר את הקלף ביד';
      cancel.onclick=()=>{ cancelDevPick(G); afterAction(); closeAllSheets(); };
      body.appendChild(cancel);
    }
    openSheet('sheetPick'); return;
  }

  const counter=document.createElement('div');
  counter.style.cssText='text-align:center;font-family:var(--display);font-size:17px;margin:6px 0 12px;color:#E0A93B';
  body.appendChild(counter);
  const rows=document.createElement('div');
  KEYS.forEach(r=>{
    if(kind==='discard'&&conf.cap(r)<=0) return;
    const row=document.createElement('div'); row.className='trade-row';
    row.appendChild(chipOf(r));
    const lbl=document.createElement('div'); lbl.className='lbl'; lbl.textContent=nameOf(r);
    row.appendChild(lbl);
    const st=document.createElement('div'); st.className='stepper';
    const minus=document.createElement('button'); minus.textContent='−';
    const v=document.createElement('span'); v.className='v'; v.textContent='0';
    const plus=document.createElement('button'); plus.textContent='+';
    st.append(minus,v,plus); row.appendChild(st);
    const avail=document.createElement('span');
    avail.style.cssText='color:#93B2C2;font-size:12px'; avail.textContent=`יש ${conf.cap(r)}`;
    row.appendChild(avail);
    minus.onclick=()=>{ if(picks[r]>0){picks[r]--;upd();} };
    plus.onclick=()=>{ const tot=KEYS.reduce((s,x)=>s+picks[x],0);
      if(tot<conf.n && picks[r]<conf.cap(r)){picks[r]++;upd();} };
    row._v=v; row._r=r; rows.appendChild(row);
  });
  body.appendChild(rows);
  const go=document.createElement('button'); go.className='btn gold wide';
  go.style.marginTop='12px'; body.appendChild(go);
  function upd(){
    const tot=KEYS.reduce((s,x)=>s+picks[x],0);
    counter.textContent=`${tot} / ${conf.n}`;
    Array.from(rows.children).forEach(row=>{ row._v.textContent=picks[row._r]; });
    go.disabled = tot!==conf.n;
    go.textContent = tot===conf.n ? 'אישור' : `בחרו עוד ${conf.n-tot}`;
  }
  go.onclick=()=>{
    if(kind==='discard') resolveDiscard(G,me,picks);
    else if(kind==='gold') resolveGold(G,me,picks);
    else if(kind==='plenty'){
      const list=[]; RES.forEach(r=>{for(let i=0;i<picks[r];i++)list.push(r);});
      const a=list[0],b=list[1];
      closeAllSheets();
      announceThen('ok',`${p.name} ${gv(p,'הפעיל','הפעילה')} שנת שפע!`, a===b?`${gv(p,'לוקח','לוקחת')} 2 ${RES_HE[a]}`:`${gv(p,'לוקח','לוקחת')} ${RES_HE[a]} ו${RES_HE[b]}`,()=>{
        doPlenty(ST.G,a,b); SFX.gain();
        tableToast(a===b ? `${p.name} ${gv(p,'הפעיל שנת שפע ולקח','הפעילה שנת שפע ולקחה')} 2 ${RES_HE[a]}` : `${p.name} ${gv(p,'הפעיל שנת שפע ולקח','הפעילה שנת שפע ולקחה')} ${RES_HE[a]} ו${RES_HE[b]}`);
        afterAction();
      });
      return;
    }
    closeAllSheets(); afterAction();
  };
  if(kind==='plenty' && G.pendingDev){
    const cancel=document.createElement('button'); cancel.className='btn wide'; cancel.style.marginTop='8px';
    cancel.textContent='ביטול — להשאיר את הקלף ביד';
    cancel.onclick=()=>{ cancelDevPick(G); afterAction(); closeAllSheets(); };
    body.appendChild(cancel);
  }
  upd(); openSheet('sheetPick');
}

/* ---------- steal ---------- */
/* browser confirm() is blocked inside the embedded page, so ask in-app */
function askConfirm(title,sub,yesLabel,onYes,noLabel){
  const body=$('#pickBody'); body.innerHTML='';
  $('#pickTitle').textContent=title; $('#pickSub').textContent=sub||'';
  const yes=document.createElement('button'); yes.className='btn danger wide'; yes.style.marginBottom='8px';
  yes.textContent=yesLabel; yes.onclick=()=>{ closeAllSheets(); onYes(); };
  const no=document.createElement('button'); no.className='btn wide'; no.textContent=noLabel||'להמשיך לשחק';
  no.onclick=()=>closeAllSheets();
  body.append(yes,no);
  openSheet('sheetPick');
}

/* "7!" — say out loud who has to throw cards away */
function announceSeven(){
  const G=ST.G; if(!G||!G.discardQueue.length) return;
  const parts=G.discardQueue.map(d=>G.players[d.p].name+' ('+d.n+')').join(' · ');
  showTradeBanner('wait','יצא 7!','מי שיש לו יותר מ־7 קלפים משליך חצי: '+parts,[]);
  tresT=setTimeout(clearTradeBanner,4500);
}

/* ---- stealing: the thief picks one of the victim's face-down cards ---- */
let CARD_BACK=null;
function cardBackArt(){
  if(CARD_BACK) return CARD_BACK;
  const c=document.createElement('canvas'); c.width=108; c.height=158; const x=c.getContext('2d');
  x.save(); roundRect(x,2,2,104,154,15); x.clip();
  const g=x.createLinearGradient(0,0,0,158); g.addColorStop(0,'#1D5D86'); g.addColorStop(1,'#0B2C44');
  x.fillStyle=g; x.fillRect(0,0,108,158);
  x.strokeStyle='rgba(255,255,255,.07)'; x.lineWidth=2;
  for(let i=-160;i<220;i+=16){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+158,158); x.stroke(); }
  x.restore();
  x.strokeStyle='rgba(0,0,0,.55)'; x.lineWidth=3; roundRect(x,2,2,104,154,15); x.stroke();
  x.strokeStyle='#E0A93B'; x.lineWidth=2.5; roundRect(x,9,9,90,140,10); x.stroke();
  /* a small hexagon emblem */
  x.translate(54,79); x.fillStyle='rgba(224,169,59,.9)'; x.beginPath();
  for(let i=0;i<6;i++){ const a=Math.PI/180*(60*i-30); const px=Math.cos(a)*26, py=Math.sin(a)*26; i?x.lineTo(px,py):x.moveTo(px,py); }
  x.closePath(); x.fill();
  x.fillStyle='#0B2C44'; x.beginPath();
  for(let i=0;i<6;i++){ const a=Math.PI/180*(60*i-30); const px=Math.cos(a)*15, py=Math.sin(a)*15; i?x.lineTo(px,py):x.moveTo(px,py); }
  x.closePath(); x.fill();
  CARD_BACK=c; return c;
}
/* the development-card back: terracotta, with a winding road emblem — recognisable from across
   the table as "someone took a card", without saying which one */
let DEV_BACK=null;
function devBackArt(){
  if(DEV_BACK) return DEV_BACK;
  const c=document.createElement('canvas'); c.width=108; c.height=158; const x=c.getContext('2d');
  x.save(); roundRect(x,2,2,104,154,15); x.clip();
  const g=x.createLinearGradient(0,0,0,158); g.addColorStop(0,'#E8A183'); g.addColorStop(1,'#CE7E62');
  x.fillStyle=g; x.fillRect(0,0,108,158);
  x.strokeStyle='rgba(255,255,255,.12)'; x.lineWidth=1.5;
  for(let i=-160;i<220;i+=13){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+158,158); x.stroke(); }
  x.restore();
  x.fillStyle='#F6EEDF'; roundRect(x,0,0,108,158,16); x.fill();          /* cream border */
  x.save(); roundRect(x,6,6,96,146,12); x.clip();
  const g2=x.createLinearGradient(0,0,0,158); g2.addColorStop(0,'#E8A183'); g2.addColorStop(1,'#C9765A');
  x.fillStyle=g2; x.fillRect(0,0,108,158);
  x.strokeStyle='rgba(255,255,255,.10)'; x.lineWidth=1.4;
  for(let i=-160;i<220;i+=13){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+158,158); x.stroke(); }
  x.restore();
  /* the circular emblem with a winding road */
  x.save(); x.translate(54,79);
  x.fillStyle='rgba(180,86,60,.55)'; x.beginPath(); x.arc(0,0,33,0,TAU); x.fill();
  x.strokeStyle='rgba(246,238,223,.55)'; x.lineWidth=2; x.beginPath(); x.arc(0,0,33,0,TAU); x.stroke();
  x.strokeStyle='#F6EEDF'; x.lineWidth=7; x.lineCap='round'; x.lineJoin='round';
  x.beginPath(); x.moveTo(-17,16); x.lineTo(2,4); x.lineTo(-10,-6); x.lineTo(16,-16); x.stroke();
  x.restore();
  DEV_BACK=c; return c;
}
/* a face-down card flies up from the player's seat: everyone sees that a card was taken */
function devCardFly(pIdx,label){
  const G=ST.G; if(!G) return;
  const ov=document.createElement('div'); ov.className='devfly';
  const card=document.createElement('div'); card.className='devfly-card';
  const img=devBackArt(); const cv=document.createElement('canvas');
  cv.width=img.width; cv.height=img.height; cv.getContext('2d').drawImage(img,0,0);
  cv.style.cssText='width:100%;height:100%;display:block';
  card.appendChild(cv); ov.appendChild(card);
  if(label){ const cap=document.createElement('div'); cap.className='devfly-cap'; cap.textContent=label; ov.appendChild(cap); }
  document.body.appendChild(ov);
  requestAnimationFrame(()=>ov.classList.add('go'));
  setTimeout(()=>{ ov.classList.add('out'); setTimeout(()=>ov.remove(),420); },1250);
}
/* a dev card resolves a beat after it's chosen, so the whole table reads who played what
   before the resources actually move */
/* ---------- table events that every device should see ----------
   Messages like "Roy declared Monopoly" used to be drawn only on the device that did it. They
   are now also written into the game state (G.fx) and pushed, so the other players' devices
   replay them — same banner, same toast, same sound. */
function emitFx(ev){
  const G=ST.G; if(!G) return;
  G.fxSeq=(G.fxSeq||0)+1;
  ev.seq=G.fxSeq; ev.from=ST.meIdx;
  (G.fx=G.fx||[]).push(ev);
  if(G.fx.length>8) G.fx.splice(0,G.fx.length-8);
}
/* a banner the whole table sees */
function tableBanner(kind,title,sub,dur,snd){
  showTradeBanner(kind,title,sub||'',[]); clearTimeout(tresT); tresT=setTimeout(clearTradeBanner,dur||2200);
  emitFx({t:'banner',kind,title,sub:sub||'',dur:dur||2200,snd:snd||null});
}
/* a toast the whole table sees */
function tableToast(text,snd){
  toast(text,3200);
  emitFx({t:'toast',text,snd:snd||null});
}
/* on the other devices: play every event this device hasn't shown yet */
function playRemoteFx(G){
  if(ST.mode!=='online' || !G) return;
  const gid=G.seed+'|'+(G.startRoll?JSON.stringify(G.startRoll.seat):'');
  const deedKeyOf=GG=>{ const td=GG.turnDeeds;
    return (td&&td.list&&td.list.length) ? (GG.tc||0)+':'+td.p+':'+td.list.length : '-'; };
  if(ST.fxGame!==gid){                                  /* first look at this game: don't replay history */
    ST.fxGame=gid; ST.fxSeen=G.fxSeq||0; ST.deedKey=deedKeyOf(G); return;
  }
  (G.fx||[]).forEach(ev=>{
    if(ev.seq<=ST.fxSeen) return;
    ST.fxSeen=ev.seq;
    if(ev.from===ST.meIdx) return;                  /* we showed it ourselves when it happened */
    if(ev.snd){ try{ SFX[ev.snd](); }catch(e){} }
    if(ev.t==='banner'){ showTradeBanner(ev.kind||'wait',ev.title,ev.sub||'',[]); clearTimeout(tresT); tresT=setTimeout(clearTradeBanner,ev.dur||2200); }
    else if(ev.t==='toast') toast(ev.text,3200);
  });
  /* the running "X built a road and a settlement" line is already part of the synced state
     (G.turnDeeds) — show it on the other devices whenever it grows */
  const k=deedKeyOf(G);
  if(k!==ST.deedKey){
    ST.deedKey=k;
    const td=G.turnDeeds;
    if(k!=='-' && td.p!==ST.meIdx){
      const last=td.list[td.list.length-1], line=deedSentence(G);
      if(last==='dev'){ try{ SFX.buyCard(); }catch(e){} devCardFly(td.p,line); }
      else { try{ SFX.build(last==='sett'?'sett':last); }catch(e){} toast(line,3200); }
    }
  }
}
function announceThen(kind,title,sub,fn){
  showTradeBanner(kind||'wait',title,sub||'',[]);
  emitFx({t:'banner',kind:kind||'wait',title,sub:sub||'',dur:1500,snd:null});
  push();                                        /* the others see the announcement before anything moves */
  ST.busy=true;                                  /* nothing else moves while the table reads it */
  setTimeout(()=>{ ST.busy=false; clearTradeBanner(); fn(); }, 1500);
}
function clearStealOv(){ const o=$('#stealOv'); if(o) o.remove(); }
function showStealPicker(vi,cb){
  const G=ST.G, v=G.players[vi];
  const pool=stealPool(G,vi), n=pool.length;
  clearStealOv();
  const ov=document.createElement('div'); ov.id='stealOv'; ov.className='stealov';
  ov.innerHTML=`<div class="sttl">בחרו קלף מהיד של ${v.name}</div><div class="ssub">${n} קלפים הפוכים — נגעו באחד</div><div class="sfan"></div>`;
  const fan=ov.querySelector('.sfan');
  $('#coach').parentElement.appendChild(ov);
  const W=Math.min(fan.clientWidth||520,560), cw=72;
  const step=n<=1?0:Math.min(cw*0.9,(W-cw-16)/(n-1));
  const total=step*(n-1)+cw, x0=(W-total)/2, ang=Math.min(4.2,34/Math.max(n,1));
  const els=[]; let picked=false;
  for(let i=0;i<n;i++){
    const t=i-(n-1)/2;
    const c=document.createElement('div'); c.className='scard';
    c.style.left=(W/2-cw/2)+'px'; c.style.zIndex=i+1;             /* start stacked in the middle... */
    c.style.transform='scale(.7) rotate('+((i%2?1:-1)*6)+'deg)';
    c.innerHTML='<div class="flipper"><div class="face back"></div><div class="face front"></div></div>';
    const bc=document.createElement('canvas'); bc.width=108; bc.height=158; bc.getContext('2d').drawImage(cardBackArt(),0,0);
    c.querySelector('.back').appendChild(bc);
    c.onclick=()=>choose(i);
    fan.appendChild(c); els.push(c);
    setTimeout(()=>{                                                  /* ...then deal out */
      c.style.transitionDelay=(i*22)+'ms';
      c.style.left=(x0+step*i)+'px';
      c.style.transform='translateY('+(t*t*(n>10?0.25:1.1))+'px) rotate('+(t*ang)+'deg)';
    },40);
  }
  function choose(i){
    if(picked) return; picked=true;
    const key=pool[randInt(pool.length)];
    SFX.tap();
    els.forEach((e,k)=>{ if(k!==i) e.classList.add('dim'); });
    const c=els[i]; c.style.transitionDelay='0ms';
    const fc=document.createElement('canvas'); fc.width=108; fc.height=158; fc.getContext('2d').drawImage(cardArt(key),0,0);
    c.querySelector('.front').appendChild(fc);
    c.classList.add('chosen');
    setTimeout(()=>c.classList.add('flipped'),260);
    const ttl=ov.querySelector('.sttl'); const sub=ov.querySelector('.ssub');
    setTimeout(()=>{ ttl.textContent='גנבתם: '+(RES_HE[key]||COM_HE[key]); sub.textContent=`מהיד של ${v.name}`; SFX.coins(); },700);
    setTimeout(()=>{ ov.style.transition='opacity .3s'; ov.style.opacity='0'; setTimeout(clearStealOv,320); cb(key); },1900);
  }
}
function runSteal(kind,hexId,victimIdx){
  const G=ST.G,B=ST.B;
  const finish=key=>{
    if(kind==='pirate') movePirate(G,B,hexId,victimIdx,key); else moveRobber(G,B,hexId,victimIdx,key);
    G.pendingSteal=null; closeAllSheets(); ST.lastNeed=''; afterAction();
  };
  const ok = victimIdx!=null && victimIdx>=0 && canAct() && stealPool(G,victimIdx).length>0;
  if(!ok){ finish(undefined); return; }
  if(kind==='pirate') G.pirate=hexId; else G.robber=hexId;
  showStealPicker(victimIdx,finish);
}

function openStealSheet(targets){
  const G=ST.G;
  const body=$('#pickBody'); body.innerHTML='';
  $('#pickTitle').textContent='גניבת קלף';
  $('#pickSub').textContent='בחרו ממי לגנוב';
  targets.forEach(ti=>{
    const b=document.createElement('button'); b.className='btn wide'; b.style.marginBottom='8px';
    b.innerHTML=`<span class="dot" style="width:12px;height:12px;border-radius:50%;background:${colOf(G,ti).hex};display:inline-block"></span> ${G.players[ti].name} — ${totalCards(G.players[ti])} קלפים`;
    b.onclick=()=>{
      closeAllSheets();
      runSteal(G.stealPirate?'pirate':'robber', G.stealPirate?G.pirate:G.robber, ti); };
    body.appendChild(b);
  });
  openSheet('sheetPick');
}

/* ---------- dev cards ---------- */
function openDevSheet(){
  const G=ST.G, me=actor(), p=G.players[me];
  const body=$('#devBody'); body.innerHTML='';
  $('#devSub').textContent = p.dev.length? 'קלף אחד לכל תור. קלף שנקנה היום ימתין למחר.' : 'אין לכם קלפים כרגע.';
  p.dev.forEach((c,i)=>{
    const d=document.createElement('div'); d.className='devitem';
    d.innerHTML=`<div class="t"><b>${DEV_HE[c].t}</b><span>${DEV_HE[c].d}</span></div>`;
    const b=document.createElement('button'); b.className='btn sm gold';
    if(c==='vp'){ b.textContent='נקודה'; b.disabled=true; }
    else if(!playableDev(G,me,i)){ b.textContent = p.playedDevThisTurn?'כבר שיחקתם':'לא היום'; b.disabled=true; }
    else { b.textContent='לשחק'; b.onclick=()=>{
      playDev(G,ST.B,i);
      if(c==='knight'){ SFX.knight(); tableBanner('wait',`${p.name} ${gv(p,'שלח','שלחה')} אביר!`,'מזיז את השודד',2200,'knight'); }
      else if(c==='road'){ SFX.roadCard(); tableBanner('ok',`${p.name} ${gv(p,'שיחק','שיחקה')} בניית דרכים!`,'שתי דרכים בחינם',2200,'roadCard'); }
      else if(c==='plenty') SFX.plentyCard();
      else if(c==='mono') SFX.monoCard();
      closeAllSheets(); ST.lastNeed=''; afterAction(); }; }
    d.appendChild(b); body.appendChild(d);
  });
  openSheet('sheetDev');
}

/* ---------- trade ---------- */
function openTradeSheet(){
  const G=ST.G,B=ST.B, me=actor(), p=G.players[me];
  const body=$('#tradeBody'); body.innerHTML='';
  $('#sheetTrade h3').textContent='החלפה מול הבנק';
  const ports=playerPorts(G,B,me);
  $('#tradeSub').textContent = ports.any||Object.keys(ports).length
    ? 'הנמלים שלכם: '+Object.keys(ports).map(k=>k==='any'?'3:1 כללי':'2:1 '+RES_HE[k]).join(' · ')
    : 'אין לכם נמלים — הבנק מחליף 4:1.';

  const bank=document.createElement('div'); body.appendChild(bank);
  let giveR=null,getR=null;
  const tradeables = isCK(G) ? RES.concat(COM) : RES;
  const nameOf = k => RES_HE[k]||COM_HE[k];
  const chip = k => COM.indexOf(k)>=0 ? miniCom(k,34) : miniRes(k,34);
  const mk=(title,onPick,rateLabel)=>{
    const h=document.createElement('div');
    h.style.cssText='font-size:13px;color:#93B2C2;font-weight:700;margin:10px 0 6px';
    h.textContent=title; bank.appendChild(h);
    const wrap=document.createElement('div'); wrap.className='res-pick';
    tradeables.forEach(r=>{
      const b=document.createElement('button'); b.className='rp'; b.dataset.r=r;
      b.appendChild(chip(r));
      const s=document.createElement('span');
      s.textContent = rateLabel? bankRate(G,B,me,r)+':1' : nameOf(r);
      b.appendChild(s);
      const held = isCK(G)? heldOf(p,r) : p.res[r];
      if(rateLabel){ const sm=document.createElement('small'); sm.textContent=`יש ${held}`; b.appendChild(sm); }
      if(rateLabel && held<bankRate(G,B,me,r)) b.disabled=true, b.style.opacity=.35;
      if(!rateLabel && COM.indexOf(r)<0 && G.bank[r]<=0) b.disabled=true, b.style.opacity=.35;
      b.onclick=()=>{ Array.from(wrap.children).forEach(c=>c.setAttribute('aria-pressed','false'));
        b.setAttribute('aria-pressed','true'); onPick(r); upd(); };
      wrap.appendChild(b);
    });
    bank.appendChild(wrap);
  };
  mk('אני נותן',r=>giveR=r,true);
  mk('ומקבל',r=>getR=r,false);
  const go=document.createElement('button'); go.className='btn gold wide'; go.style.marginTop='14px';
  go.textContent='ביצוע החלפה'; go.disabled=true; bank.appendChild(go);
  function upd(){ go.disabled=!(giveR&&getR&&giveR!==getR);
    go.textContent = giveR&&getR ? `${bankRate(G,B,me,giveR)} ${nameOf(giveR)} ← 1 ${nameOf(getR)}` : 'ביצוע החלפה'; }
  go.onclick=()=>{ if(bankTrade(G,B,giveR,getR)){ toast('הוחלף'); SFX.coins(); closeAllSheets(); afterAction(); } };
  openSheet('sheetTrade');
}

