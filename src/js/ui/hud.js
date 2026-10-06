/* =========================================================
   7. HUD
   ========================================================= */
const ICON = {
  road:'<svg viewBox="0 0 24 22"><path d="M4 20 L10 2 h4 l6 18z" fill="currentColor" opacity=".9"/><path d="M11.4 6h1.2l.4 3h-2zM11.9 11h1.4l.5 3.4h-2.4z" fill="#0A2839"/></svg>',
  sett:'<svg viewBox="0 0 24 22"><path d="M3 20V9l9-7 9 7v11z" fill="currentColor"/><path d="M9 20v-6h6v6z" fill="#0A2839" opacity=".55"/></svg>',
  city:'<svg viewBox="0 0 24 22"><path d="M2 20V8l6-5 6 5v3h8v9z" fill="currentColor"/><path d="M16 14h3v6h-3zM6 13h4v7H6z" fill="#0A2839" opacity=".5"/></svg>',
  dev:'<svg viewBox="0 0 24 22"><rect x="4" y="2" width="16" height="18" rx="2.5" fill="currentColor"/><path d="M8 7h8M8 11h8M8 15h5" stroke="#0A2839" stroke-width="1.7" stroke-linecap="round" opacity=".6"/></svg>',
  trade:'<svg viewBox="0 0 24 22"><path d="M3 8h13l-3.5-4M21 14H8l3.5 4" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dice:'<svg viewBox="0 0 24 22"><rect x="3" y="3" width="16" height="16" rx="3.5" fill="currentColor"/><circle cx="8" cy="8" r="1.7" fill="#0A2839"/><circle cx="14" cy="14" r="1.7" fill="#0A2839"/><circle cx="11" cy="11" r="1.7" fill="#0A2839"/></svg>',
  end:'<svg viewBox="0 0 24 22"><path d="M17 11 8 4v14z" fill="currentColor"/><rect x="18" y="4" width="3" height="14" rx="1.5" fill="currentColor"/></svg>',
  ship:'<svg viewBox="0 0 24 22"><path d="M3 15h18l-3 5H6z" fill="currentColor"/><path d="M12 3v10M12 4l6 8h-6" fill="currentColor"/></svg>',
  knight:'<svg viewBox="0 0 24 22"><path d="M7 20V12L5 8l4-5 3 3 3-1 4 6-3 3v6z" fill="currentColor"/></svg>',
  check:'<svg viewBox="0 0 24 22"><path d="M4 12l6 6L20 5" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
const CONFIRM_PLACE_KINDS=['settlement','city','road','ship'];   /* costs a resource or a turn's worth of positioning — worth a confirm step */
function act(id,label,cost,icon,on,disabled){
  const b=document.createElement('button');
  b.className='act'+(on?' on':''); b.disabled=!!disabled; b.dataset.act=id;
  b.innerHTML=icon+'<span>'+label+'</span>'+(cost?'<span class="cost">'+cost+'</span>':'');
  return b;
}
function resCardEl(res,n){
  const d=document.createElement('div'); d.className='rescard'+(n?'':' zero'); d.dataset.res=res;
  const c=document.createElement('canvas'); c.width=104;c.height=136;
  const x=c.getContext('2d'); x.scale(2,2);
  const bg=RES_BG[res]; const g=x.createLinearGradient(0,0,0,68);
  g.addColorStop(0,bg[0]); g.addColorStop(1,bg[1]);
  x.fillStyle=g; x.fillRect(0,0,52,68);
  x.fillStyle='rgba(255,255,255,.14)'; x.fillRect(0,0,52,22);
  drawResIcon(x,res,26,30,36);
  d.appendChild(c);
  const nn=document.createElement('div'); nn.className='n'; nn.textContent=n; d.appendChild(nn);
  return d;
}

function syncUI(){
  kick();
  const G=ST.G,B=ST.B; if(!G) return;
  if(ST.tut) tutAutoDummy(G);
  const nd=currentNeed(G);
  const sig=[nd.kind,nd.who,G.round,G.freeRoads,G.robber,Object.keys(G.roads).length,
    Object.keys(G.buildings).length,G.phase,G.winner,G.offer?1:0].join('|');
  if(sig!==ST.lastNeed){ ST.lastNeed=sig; onNeedChanged(nd); }
  drawStrip(); drawTurnPill(nd); drawHand(); drawActions(nd); drawBarbMeter(G);
  renderOfferBanner();
  playRemoteFx(G);                 /* what the other players did, shown here too */
  if(G.lastSteal && G.lastSteal.seq!==ST.stealSeen){
    ST.stealSeen=G.lastSteal.seq;
    if(G.lastSteal.victim===viewIdx() && G.lastSteal.thief!==G.lastSteal.victim){
      const k=G.lastSteal.key; toast(G.players[G.lastSteal.thief].name+' גנב ממך: '+(RES_HE[k]||COM_HE[k]),3200); }
  }
  document.body.classList.toggle('tut',!!ST.tut);
  if(ST.tut) tutCheck();
  checkCurtain(nd);
  if(G.phase==='over' && !ST.tut) showWin();
  scheduleBot();
}

/* several people share one device: hide the hand until the right person is holding it */
function checkCurtain(nd){
  const G=ST.G;
  if(!G||ST.mode!=='local'||ST.tut||nd.kind==='over') return;
  const humans=G.players.filter(p=>!p.bot).length;
  if(humans<2) return;
  const p=G.players[nd.who];
  if(!p||p.bot) return;
  if(ST.curtainFor===nd.who || $('#curtain')) return;
  const el=document.createElement('div'); el.className='curtain'; el.id='curtain';
  const c=colOf(G,nd.who);
  el.innerHTML=`<div>
    <div style="width:54px;height:54px;border-radius:50%;background:${c.hex};margin:0 auto 10px;
      box-shadow:0 0 0 4px rgba(255,255,255,.25)"></div>
    <h2>${p.name}</h2>
    <p>העבירו את המכשיר ל${p.name}. הקלפים מוסתרים עד ללחיצה על הכפתור.<br>${nd.kind==='discard'?'יצא 7 — צריך להשליך קלפים.':''}</p>
    <button class="btn gold" id="curtainGo" style="min-width:200px;padding:14px 20px;font-size:17px">אני ${p.name} — הצג</button></div>`;
  document.body.appendChild(el);
  el.querySelector('#curtainGo').onclick=()=>{ ST.curtainFor=nd.who; el.remove(); SFX.tap(); syncUI(); };
}

function drawTurnPill(nd){
  const G=ST.G, p=G.players[nd.who];
  $('#turnDot').style.background=colOf(G,nd.who).hex;
  const mine = ST.mode==='online' && nd.who===ST.meIdx;
  $('#turnName').textContent = (ST.mode==='online'? (mine?'התור שלך':'התור של '+p.name) : p.name);
  const hints={
    setupS:'הניחו יישוב פתיחה', setupR:'הניחו דרך צמודה ליישוב',
    roll:'הטילו את הקוביות', main:'בנו, סחרו או סיימו תור',
    robber:'בחרו משושה לשודד', discard:`להשליך ${nd.n} קלפים`,
    gold:`לבחור ${nd.n} משאבים מהזהב`, freeroad:'בונים דרכים בחינם',
    plenty:'בחרו שני משאבים', mono:'בחרו משאב למונופול',
    special:'שחקן 2 — בנייה וקלפי פיתוח', offer:'ממתינים לתשובות', over:'המשחק נגמר',
    improve:'בוחרים מסלול שיפור', metroPick:'בוחרים עיר למטרופולין',
    resmono:'בוחרים משאב', trademono:'בוחרים סחורה', fleet:'בוחרים קלף לצי',
    master:'בוחרים ממי לשדוד', deserter:'בוחרים ממי לקחת אביר', smith:'קידום אבירים בחינם',
    merchantPlace:'מניחים את הסוחר', bishop:'מניחים את הבישוף',
    knightPlace:'בוחרים צומת לאביר', knightMove:'לאן האביר זז', knightRobber:'לאן לגרש את השודד',
    deserterPlace:'מניחים את האביר החדש', steal:'בוחרים ממי לגנוב'
  };
  $('#turnHint').textContent=hints[nd.kind]||'';
  const lr=$('#lastRoll');
  if(G.dice && G.lastRoll){ lr.style.display=''; lr.textContent='🎲 '+G.dice[0]+' + '+G.dice[1]+' = '+G.lastRoll; }
  else lr.style.display='none';
}

/* desktop: seat everyone around the board — you at the bottom, the next player on your right, and so on */
function seatCards(G,cards){
  const ids={left:'#seatLeft',right:'#seatRight'};
  ['#seatTop','#seatLeft','#seatRight','#seatSelf'].forEach(q=>$(q).innerHTML='');
  const n=G.players.length, me=viewIdx(), slots=SEAT_SLOTS[n-1]||[], tops=[];
  for(let k=1;k<n;k++){
    const pi=(me+k)%n, slot=slots[k-1]||'top';
    if(slot==='top') tops.push(cards[pi]); else $(ids[slot]).appendChild(cards[pi]);
  }
  if(document.documentElement.dir==='ltr') tops.reverse();
  tops.forEach(c=>$('#seatTop').appendChild(c));
  $('#seatSelf').appendChild(cards[me]);
}
function drawStrip(){
  const G=ST.G, el=$('#pstrip'); el.innerHTML=''; const cardEls=[];
  G.players.forEach((p,i)=>{
    const d=document.createElement('div');
    d.className='pcard'+(i===G.turn?' active':''); d.dataset.pi=i;
    const badges=[];
    /* awards are written out, on the holder's own card */
    if(G.longest.p===i) badges.push(`<span class="bdg road">🛣 הדרך הארוכה · ${G.longest.len}</span>`);
    if(!isCK(G) && G.army.p===i) badges.push(`<span class="bdg army">⚔ ×${p.knights} · הצבא הגדול</span>`);
    if(isCK(G)){
      TRACKS.forEach(t=>{ if(G.metro[t.id]===i) badges.push(`<span class="bdg metro">★ מטרופולין ${t.he}</span>`); });
      if(p.defender) badges.push(`<span class="bdg def">🛡 ×${p.defender} מגן קטאן</span>`);
    }
    if(G.cfg.special && G.players.length>=5){
      if(G.special.on){
        if(i===G.special.starter) badges.unshift('<span class="bdg step">① סיים</span>');
        if(i===G.turn) badges.unshift('<span class="bdg step two">② בונה עכשיו</span>');
      } else {
        if(i===G.turn) badges.unshift('<span class="bdg step">① מטיל</span>');
        if(i===partnerOf(G,G.turn)) badges.unshift('<span class="bdg step two">② בונה אחריו</span>');
      }
    }
    const cards = isCK(G)?ckHand(p):totalCards(p);
    const swords = isCK(G) ? `⚔${knStrength(p)}` : (G.army.p===i?'':(p.knights?`⚔×${p.knights}`:''));
    d.innerHTML=(badges.length?`<div class="bdgs">${badges.join('')}</div>`:'')+
      `<div class="prow1"><span class="dot" style="background:${colOf(G,i).hex}"></span>`+
      `<span class="nm">${p.name}${p.bot?' 🤖':''}</span>`+
      `<span class="vp">${vpPublic(G,i)}</span></div>`+
      `<div class="mini cnt">🂠 ${cards}${swords?'  ·  '+swords:''}</div>`;
    cardEls[i]=d;
  });
  if(isDesk()){ seatCards(G,cardEls); return; }
  ['#seatTop','#seatLeft','#seatRight','#seatSelf'].forEach(q=>{ const x=$(q); if(x) x.innerHTML=''; });
  cardEls.forEach(c=>el.appendChild(c));
  /* with many players the row scrolls: keep whoever is playing in view */
  const key=G.turn+'|'+(G.special&&G.special.on?1:0);
  if(ST.stripFor!==key){ ST.stripFor=key;
    const a=el.querySelector('.pcard.active');
    if(a&&a.scrollIntoView){ try{ a.scrollIntoView({inline:'center',block:'nearest'}); }catch(e){} } }
}

/* one card face per resource, painted once and reused */
const CARD_ART={};
function cardArt(key){
  if(CARD_ART[key]) return CARD_ART[key];
  const isCom=COM.indexOf(key)>=0;
  const bg=(isCom?COM_BG:RES_BG)[key];
  const c=document.createElement('canvas'); c.width=108; c.height=158;
  const x=c.getContext('2d');
  x.save(); roundRect(x,2,2,104,154,15); x.clip();
  const g=x.createLinearGradient(0,0,0,158); g.addColorStop(0,bg[0]); g.addColorStop(1,bg[1]);
  x.fillStyle=g; x.fillRect(0,0,108,158);
  x.fillStyle='rgba(255,255,255,.17)'; x.fillRect(0,0,108,56);
  x.restore();
  x.strokeStyle='rgba(0,0,0,.5)'; x.lineWidth=3; roundRect(x,2,2,104,154,15); x.stroke();
  x.strokeStyle='rgba(255,255,255,.38)'; x.lineWidth=2; roundRect(x,8,8,92,142,11); x.stroke();
  if(isCom) drawComIcon(x,key,54,70,68); else drawResIcon(x,key,54,70,70);
  if(isCom){ drawComIcon(x,key,21,22,22); drawComIcon(x,key,87,136,22); }
  else { drawResIcon(x,key,21,22,24); drawResIcon(x,key,87,136,24); }
  x.fillStyle='rgba(20,14,4,.88)'; x.font='800 15px '+FONT_S; x.textAlign='center'; x.textBaseline='middle';
  x.fillText(trStr(isCom?COM_HE[key]:RES_HE[key]),54,122);
  CARD_ART[key]=c; return c;
}
function smallIcon(key,size){
  const c=document.createElement('canvas'); c.width=size*2; c.height=size*2;
  const x=c.getContext('2d'); x.scale(2,2);
  const isCom=COM.indexOf(key)>=0; const bg=(isCom?COM_BG:RES_BG)[key];
  const g=x.createLinearGradient(0,0,0,size); g.addColorStop(0,bg[0]); g.addColorStop(1,bg[1]);
  x.fillStyle=g; roundRect(x,0,0,size,size,size*0.24); x.fill();
  if(isCom) drawComIcon(x,key,size/2,size/2,size*0.8); else drawResIcon(x,key,size/2,size/2,size*0.8);
  return c;
}
/* step 2 of a player trade: tap a card to ask for one more of it */
function drawWantTray(el,chips,tr){
  const G=ST.G;
  chips.innerHTML='';
  const lb=document.createElement('span'); lb.className='hchip lbl'; lb.textContent='אתם נותנים:'; chips.appendChild(lb);
  const give=tradeGiveObj();
  RES.forEach(r=>{ if(!give[r]) return;
    const ch=document.createElement('span'); ch.className='hchip';
    ch.appendChild(smallIcon(r,18)); ch.appendChild(document.createTextNode(give[r])); chips.appendChild(ch); });
  el.classList.remove('pick'); el.classList.add('tray'); el.innerHTML='';
  const wrap=document.createElement('div'); wrap.className='tray-wrap';
  const total=RES.reduce((a,r)=>a+tr.want[r],0);
  wrap.innerHTML='<div class="tray-cap">'+(total?'מבקשים '+total+' — נגעו שוב להוסיף':'נגעו בקלף כדי לבקש אותו')+'</div>';
  const row=document.createElement('div'); row.className='tray-row';
  RES.forEach(r=>{
    const c=document.createElement('div'); c.className='tcard'+(tr.want[r]?' on':''); c.dataset.r=r;
    const cv=document.createElement('canvas'); cv.width=108; cv.height=158;
    cv.getContext('2d').drawImage(cardArt(r),0,0); c.appendChild(cv);
    if(tr.want[r]){
      const bd=document.createElement('span'); bd.className='tbadge'; bd.textContent=tr.want[r]; c.appendChild(bd);
      const mn=document.createElement('button'); mn.className='tminus'; mn.textContent='−'; mn.setAttribute('aria-label','פחות');
      mn.onclick=e=>{ e.stopPropagation(); tr.want[r]--; SFX.tap(); refreshTrade(); };
      c.appendChild(mn);
    }
    c.onclick=()=>{ if(tr.want[r]<9){ tr.want[r]++; SFX.tap(); refreshTrade(); } };
    row.appendChild(c);
  });
  wrap.appendChild(row); el.appendChild(wrap);
}
function drawHand(){
  const G=ST.G, el=$('#hand'), chips=$('#hchips');
  const nd=currentNeed(G);
  const pi=viewIdx(), p=G.players[pi];
  const keys=isCK(G)?RES.concat(COM):RES;
  const list=[]; keys.forEach(k=>{ const n=heldOf(p,k); for(let i=0;i<n;i++) list.push(k); });

  /* totals per type, as small chips above the fan */
  chips.innerHTML='';
  keys.forEach(k=>{ const n=heldOf(p,k); if(!n) return;
    const ch=document.createElement('span'); ch.className='hchip';
    ch.appendChild(smallIcon(k,18)); ch.appendChild(document.createTextNode(n)); chips.appendChild(ch); });

  /* trading with players: step 2 swaps the hand for a tray of things to ask for */
  const tr = (ST.trade && ST.trade.who===pi && nd.kind==='main' && canAct()) ? ST.trade : null;
  if(tr && tr.step==='want'){ drawWantTray(el,chips,tr); return; }
  el.classList.remove('tray');

  /* is this person choosing cards — to throw away, or to give in a trade? */
  const discardMode = nd.kind==='discard' && nd.who===pi && canAct();
  const tradeMode = !!(tr && tr.step==='give');
  const selMode = discardMode || tradeMode;
  const selected = new Set(discardMode ? (ST.discardSel||[]) : (tradeMode ? tr.give : []));
  el.classList.toggle('pick',selMode);

  /* which cards are brand new (deal-in animation)? */
  const prevKey=(ST.handOwner===pi)?(ST.handCounts||{}):{};
  const seen={};
  const isNew=list.map(k=>{ seen[k]=(seen[k]||0)+1; return seen[k]>(prevKey[k]||0); });
  ST.handOwner=pi; ST.handCounts=seen;

  el.innerHTML='';
  if(!list.length){ el.innerHTML='<div class="hempty">אין לכם קלפים ביד</div>'; return; }
  const desk=isDesk(), W=el.clientWidth||360, cw=desk?68:54, chh=Math.round(cw*1.46), n=list.length;
  const angStep = Math.min(3.0, 26/n);
  /* rotated end cards swing outward about the fan's pivot; leave room for that */
  const swing = Math.sin((n-1)/2*angStep*Math.PI/180)*112*(cw/54);
  const usable = W - cw - 12 - swing*2;
  const step = n<=1 ? 0 : Math.max(6, Math.min(cw*0.80, usable/(n-1)));
  const total=step*(n-1)+cw, x0=(W-total)/2;
  list.forEach((k,i)=>{
    const t=i-(n-1)/2;
    const rot=t*angStep, dy=t*t*(n>9?0.22:0.8);
    const lift = selected.has(i) ? -26 : 0;
    const locked = tradeMode && COM.indexOf(k)>=0;         /* commodities are not offered to players here */
    const c=document.createElement('div'); c.className='hc'+(selected.has(i)?' sel':'')+(locked?' locked':'')+(isNew[i]&&ST.handAnimated?' new':'');
    c.style.width=cw+'px'; c.style.height=chh+'px';
    c.style.left=(x0+step*i)+'px';
    c.style.transform=`translateY(${dy+lift}px) rotate(${rot}deg)`;
    c.style.zIndex=i+1;
    const cv2=document.createElement('canvas'); cv2.width=108; cv2.height=158;
    cv2.getContext('2d').drawImage(cardArt(k),0,0);
    c.appendChild(cv2);
    if(discardMode){
      c.onclick=()=>{
        const sel=ST.discardSel||(ST.discardSel=[]);
        const at=sel.indexOf(i);
        if(at>=0) sel.splice(at,1); else if(sel.length<nd.n) sel.push(i);
        SFX.tap(); drawHand(); drawActions(currentNeed(ST.G));
      };
    } else if(tradeMode && !locked){
      c.onclick=()=>{
        const at=tr.give.indexOf(i);
        if(at>=0) tr.give.splice(at,1); else tr.give.push(i);
        SFX.tap(); refreshTrade();
      };
    }
    el.appendChild(c);
  });
  ST.handAnimated=true;
}

/* the one button that must always be reachable, pinned outside the scrolling row */
/* the action row while a player trade is being put together */
function drawTradeActions(el,me){
  const G=ST.G, tr=ST.trade;
  const msg=document.createElement('div');
  msg.style.cssText='flex:0 0 150px;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:8px 6px;line-height:1.5';
  const x='<span class="xico">✕</span>', back='<span class="xico">↩</span>';
  if(tr.step==='give'){
    const k=tr.give.length;
    msg.innerHTML='<b>מה אתם נותנים?</b><br><span style="color:#93B2C2;font-weight:600">נגעו בקלפים שביד · נבחרו '+k+'</span>';
    el.appendChild(msg);
    el.appendChild(act('tradecancel','ביטול','',x,false,false));
    setPrimary('המשך '+k,ICON.trade,'tradenext',{disabled:!k,pulse:!!k});
    return;
  }
  const want=RES.reduce((a,r)=>a+tr.want[r],0);
  msg.innerHTML='<b>מה תרצו לקבל?</b><br><span style="color:#93B2C2;font-weight:600">'+(want?'ולמי להציע?':'בחרו קלף לבקש')+'</span>';
  el.appendChild(msg);
  if(ST.mode==='online'){
    setPrimary('הצעה לשולחן',ICON.trade,'tradesend',{disabled:!want,pulse:!!want});
  } else {
    G.players.forEach((o,i)=>{
      if(i===me) return;
      const dot='<span class="pdot" style="background:'+colOf(G,i).hex+'"></span>';
      el.appendChild(act('tp:'+i,'הצעה ל'+o.name+(o.bot?' 🤖':''),'',dot,false,!want));
    });
  }
  el.appendChild(act('tradeback','חזרה','',back,false,false));
  el.appendChild(act('tradecancel','ביטול','',x,false,false));
}
function setPrimary(label,icon,actId,opts){
  const b=$('#primaryBtn'); opts=opts||{};
  b.classList.remove('hidden'); b.dataset.act=actId;
  b.innerHTML=icon+'<span>'+label+'</span>';
  b.disabled=!!opts.disabled;
  b.classList.toggle('pulse',!!opts.pulse);
}
function hidePrimary(){ const b=$('#primaryBtn'); b.classList.add('hidden'); b.dataset.act=''; b.disabled=false; }

function drawActions(nd){
  const G=ST.G,B=ST.B, el=$('#actions'); el.innerHTML='';
  hidePrimary();
  const me=nd.who, p=G.players[me];
  const mine=canAct();
  const add=b=>{ el.appendChild(b); return b; };

  if(!mine){
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#93B2C2;font-size:13.5px;padding:14px 10px';
    d.textContent='ממתינים ל'+G.players[nd.who].name+(G.players[nd.who].bot?' 🤖':'')+'…';
    el.appendChild(d); return;
  }
  if(nd.kind==='offer'){                       /* online: waiting for the table to answer */
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:14px 10px';
    d.textContent='ההצעה נשלחה — ממתינים לתשובות…';
    el.appendChild(d); return;
  }
  if(ST.place && CONFIRM_PLACE_KINDS.indexOf(ST.place.kind)>=0 && ST.pendingPlace!=null){
    /* a spot was tapped but not built yet — a beat to change your mind before it's spent */
    const kindHe={settlement:'ליישוב',city:'לעיר',road:'לדרך',ship:'לספינה'}[ST.place.kind];
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:10px';
    d.textContent='מיקום נבחר '+kindHe+' — אשרו או בחרו מקום אחר';
    el.appendChild(d);
    add(act('cancelplace','ביטול','',ICON.end,false,false));
    setPrimary('אישור מיקום',ICON.check,'confirmplace',{pulse:true});
    return;
  }
  if(ST.trade && ST.trade.who===me && nd.kind==='main'){ drawTradeActions(el,me); return; }
  if(ST.trade && nd.kind!=='main') ST.trade=null;
  if(nd.kind==='discard'){
    const k=(ST.discardSel||[]).length;
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:10px;line-height:1.5';
    d.innerHTML='יצא 7 — בחרו בעצמכם <b>'+nd.n+'</b> קלפים להשלכה<br><span style="color:#93B2C2;font-weight:600">נגעו בקלפים שביד · נבחרו '+k+'/'+nd.n+'</span>';
    el.appendChild(d);
    setPrimary('השלכה '+k+'/'+nd.n,ICON.end,'discardgo',{disabled:k!==nd.n,pulse:k===nd.n});
    return;
  }
  if(nd.kind==='gold'||nd.kind==='plenty'||nd.kind==='mono'){
    const b=act('resume', nd.kind==='gold'?'לבחור משאב':'לבחור','',ICON.trade,true);
    add(b); return;
  }
  if(nd.kind==='over') return;
  if(nd.kind==='steal'){
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:10px';
    d.textContent='בחרו ממי לגנוב';
    el.appendChild(d);
    add(act('resume','בחירת קורבן','',ICON.trade,true,false)); return;
  }

  if(nd.kind==='setupS'||nd.kind==='setupR'){
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:10px';
    d.textContent= nd.kind==='setupS'?'בחרו צומת על הלוח':'בחרו קשת צמודה ליישוב';
    el.appendChild(d); return;
  }
  if(nd.kind==='robber'){
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:10px';
    d.textContent=G.cfg.seafarers?'שודד ביבשה · שודדי הים במים':'בחרו משושה חדש לשודד';
    el.appendChild(d); return;
  }
  if(CK_BOARD_SUBS[nd.kind]){
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:10px';
    d.textContent={merchantPlace:'בחרו משושה לסוחר',bishop:'בחרו משושה לבישוף',
      knightPlace:'בחרו צומת לאביר',knightMove:'בחרו לאן האביר זז',
      knightRobber:'בחרו לאן לגרש את השודד',deserterPlace:'בחרו צומת לאביר החדש'}[nd.kind]||'בחרו על הלוח';
    el.appendChild(d);
    if(nd.kind==='knightMove'||nd.kind==='knightRobber'||nd.kind==='knightPlace')
      add(act('ckcancel','ביטול','',ICON.end,false,false));
    return;
  }
  if(CK_PICK_SUBS.indexOf(nd.kind)>=0){
    add(act('resume','בחירה','',ICON.trade,true,false)); return;
  }
  if(nd.kind==='freeroad'){
    const d=document.createElement('div');
    d.style.cssText='flex:1;text-align:center;color:#E0A93B;font-size:13.5px;font-weight:700;padding:10px';
    d.textContent='דרך בחינם ('+G.freeRoads+' נותרו)';
    el.appendChild(d);
    add(act('skipfree','דילוג','',ICON.end,false,false)); return;
  }
  if(nd.kind==='roll'){
    if(isCK(G)){
      if(p.prog.length) add(act('prog','קלפי קִדמה',p.prog.length+' קלפים',ICON.dev,false,false));
    } else {
      const knight=p.dev.findIndex((c,i)=>c==='knight'&&playableDev(G,me,i));
      if(knight>=0) add(act('knight','אביר','לפני ההטלה',ICON.knight,false,false));
    }
    setPrimary('הטילו קוביות',ICON.dice,'roll',{pulse:true});
    return;
  }

  const special = nd.kind==='special';
  const canRoadNow = legalRoadSpots(G,B,me,false).length>0;
  const canShipNow = G.cfg.seafarers && legalRoadSpots(G,B,me,true).length>0;
  add(act('road','דרך',COST_HE.road,ICON.road,ST.place&&ST.place.kind==='road',
    !canAfford(p,COST.road)||!canRoadNow||p.roadsLeft<=0));
  if(G.cfg.seafarers)
    add(act('ship','ספינה',COST_HE.ship,ICON.ship,ST.place&&ST.place.kind==='ship',
      !canAfford(p,COST.ship)||!canShipNow||p.shipsLeft<=0));
  if(G.cfg.seafarers && !special){
    const mv=movableShips(G,B,me).length;
    add(act('moveship','הזזת ספינה',mv?'בחינם · פעם בתור':'אין ספינה פתוחה',ICON.ship,
      ST.place&&(ST.place.kind==='shipfrom'||ST.place.kind==='shipto'),!mv));
  }
  add(act('sett','יישוב',COST_HE.settlement,ICON.sett,ST.place&&ST.place.kind==='settlement',
    !canAfford(p,COST.settlement)||!legalSettleSpots(G,B,me,false).length));
  add(act('city','עיר',COST_HE.city,ICON.city,ST.place&&ST.place.kind==='city',
    !canAfford(p,COST.city)||!legalCitySpots(G,B,me).length));
  if(isCK(G)){
    add(act('kbuild','אביר',CK_COST_HE.knight,ICON.knight,ST.place&&ST.place.kind==='ckvert',
      !canAfford(p,CK_COST.knight)||p.knightsLeft[1]<=0||!legalKnightSpots(G,B,me).length));
    add(act('knights','האבירים',knStrength(p)+' כוח',ICON.knight,false,false));
    add(act('improve','שיפור עיר',COM.map(c=>p.com[c]).join('/'),ICON.city,false,false));
    add(act('prog','קלפי קִדמה',p.prog.length+' קלפים',ICON.dev,false,!p.prog.length));
  } else {
    add(act('dev','קלף פיתוח',COST_HE.dev,ICON.dev,false,!canAfford(p,COST.dev)||!G.devDeck.length));
    const hasPlayable=p.dev.some((c,i)=>playableDev(G,me,i));
    add(act('hand','הקלפים שלי',p.dev.length+' קלפים',ICON.knight,false,!p.dev.length||special&&!hasPlayable));
  }
  if(!special && G.players.length>1) add(act('ptrade','סחר עם שחקנים','בחרו קלפים מהיד',ICON.trade,false,false));
  add(act('trade','בנק ונמלים','4:1 · 3:1 · 2:1',ICON.trade,false,false));
  setPrimary(special?'סיום בנייה':'סיום תור',ICON.end,'end');
}

/* ---------- reacting to a new state ---------- */
function onNeedChanged(nd){
  const G=ST.G,B=ST.B;
  ST.place=null; ST.near=null;
  closeAllSheets();
  /* a trade being put together survives echoes of our own state, but not a real change of turn/phase */
  if(ST.trade && !(nd.kind==='main' && nd.who===ST.trade.who && canAct())) ST.trade=null;
  if(nd.kind==='offer'){ openOfferSheet(); return; }
  if(!canAct()) return;
  if(nd.kind==='steal'){ openStealSheet(G.pendingSteal||[]); return; }
  if(nd.kind==='setupS') enterPlace('settlement',legalSettleSpots(G,B,nd.who,true));
  else if(nd.kind==='setupR'){
    enterPlace('road',legalSetupRoadSpots(G,B,nd.who),{setup:true});
  }
  else if(nd.kind==='robber'){
    let legal=B.hexes.filter(h=>canPlaceRobber(G,B,h.id,nd.who)).map(h=>h.id);
    if(G.cfg.seafarers) legal=legal.concat(B.sea.filter(h=>canPlacePirate(G,B,h.id,nd.who)).map(h=>h.id));
    enterPlace('robber',legal);
    if(G.cfg.seafarers) toast('שודד ביבשה, או שודדי הים במים — לבחירתכם',3000);
  }
  else if(nd.kind==='freeroad')
    enterPlace('road',legalRoadSpots(G,B,nd.who,false),{free:true});
  else if(CK_BOARD_SUBS[nd.kind]){
    const legal=ckBoardLegal(G,B);
    if(!legal.length){ G.sub=homeSub(G); G.movingKnight=null; G.freeKnight=null;
      ST.lastNeed=''; setTimeout(()=>{syncUI();push();},0); return; }
    enterPlace(CK_BOARD_SUBS[nd.kind]==='hex'?'ckhex':'ckvert', legal);
  }
  else if(CK_PICK_SUBS.indexOf(nd.kind)>=0) openCkPicker();
  else if(nd.kind==='discard'){ ST.discardSel=[]; toast('יצא 7 — בחרו '+nd.n+' קלפים להשלכה'); }
  else if(nd.kind==='special'){
    const st=ST.G.players[ST.G.special.starter];
    toast(ST.G.players[nd.who].name+' הוא שחקן 2 של '+st.name+' — בונה, קלפי פיתוח וסחר עם הבנק בלבד',3600);
  }
  else if(nd.kind==='gold') openPicker('gold');
  else if(nd.kind==='plenty') openPicker('plenty');
  else if(nd.kind==='mono') openPicker('mono');
}
function enterPlace(kind,legal,opts){
  if(!legal||!legal.length){ ST.place=null; ST.pendingPlace=null; return; }
  ST.place=Object.assign({kind,legal},opts||{});
  ST.near=null; ST.pendingPlace=null;
}
/* what one tap on the board does: for a costed/positioned piece, the first tap only marks the
   spot as pending (a separate confirm commits it); everything else still builds right away */
function tapPlace(id){
  const pl=ST.place; if(!pl) return;
  if(CONFIRM_PLACE_KINDS.indexOf(pl.kind)>=0){
    if(ST.pendingPlace===id) return;                 /* already selected — wait for the confirm button */
    ST.pendingPlace=id; SFX.tap(); drawActions(currentNeed(ST.G)); return;
  }
  commitPlace(id);
}
function commitPlace(id){
  const G=ST.G,B=ST.B, pl=ST.place, me=actor();
  const nd=currentNeed(G);
  ST.pendingPlace=null;
  if(pl.kind==='ckhex'||pl.kind==='ckvert'){
    if(!ckPlaceBoard(G,B,id)) return;
    if(pl.kind==='ckvert'){ buildAnim[id]=T; spawnBurst(B.verts[id].x,B.verts[id].y,colOf(G,me).hex,12); SFX.knight(); }
    else { spawnBurst(B.hexById[id].x,B.hexById[id].y,'#FFE9A8',14); SFX.robber(); }
    ST.place=null; ST.near=null; ST.lastNeed='';
    return afterAction();
  }
  if(pl.kind==='settlement'){
    if(nd.kind==='setupS'){ placeSetupSettlement(G,B,id); buildAnim[id]=T; spawnBurst(B.verts[id].x,B.verts[id].y,colOf(G,me).hex,16); SFX.build('sett'); }
    else { if(!buildSettlement(G,B,id)) return; buildAnim[id]=T; spawnBurst(B.verts[id].x,B.verts[id].y,colOf(G,me).hex,16); SFX.build('sett'); toast(noteDeed(G,'sett')); }
  } else if(pl.kind==='city'){
    if(!buildCity(G,B,id)) return;
    buildAnim[id]=T; spawnBurst(B.verts[id].x,B.verts[id].y,'#FFE9A8',22); SFX.build('city'); toast(noteDeed(G,'city'));
  } else if(pl.kind==='road'||pl.kind==='ship'){
    /* a ship is a ship because you asked for one — shoreline edges can hold either */
    const asShip = pl.kind==='ship' || edgeLand(B,id)<1;
    let deed=null;
    if(nd.kind==='setupR') placeSetupRoad(G,B,id,asShip);
    else if(pl.free){ if(!buildRoad(G,B,id,asShip,true)) return; G.freeRoads--; if(G.freeRoads<=0) G.sub=homeSub(G); deed=asShip?'ship':'road'; }
    else { if(!buildRoad(G,B,id,asShip,false)) return; deed=asShip?'ship':'road'; }
    spawnBurst(B.edges[id].x,B.edges[id].y,colOf(G,me).hex,10); SFX.build(asShip?'ship':'road');
    if(deed) toast(noteDeed(G,deed));
  } else if(pl.kind==='shipfrom'){
    const dest=shipDestinations(G,B,id,me);
    if(!dest.length){ toast('אין לאן להזיז את הספינה הזאת'); return; }
    ST.place={kind:'shipto',from:id,legal:dest}; ST.near=null;
    toast('עכשיו בחרו לאן להעביר אותה'); SFX.tap(); refreshHud(); return;
  } else if(pl.kind==='shipto'){
    if(!moveShip(G,B,pl.from,id)) return;
    spawnBurst(B.edges[id].x,B.edges[id].y,colOf(G,me).hex,12); SFX.build('ship');
  } else if(pl.kind==='robber' && B.seaById && B.seaById[id]){
    /* the pirate */
    SFX.robber();
    const targets=pirateTargets(G,B,id,me);
    if(targets.length===1){ ST.place=null; ST.near=null; return runSteal('pirate',id,targets[0]); }
    else if(targets.length===0) movePirate(G,B,id,null);
    else { G.pirate=id; G.pendingSteal=targets; G.stealPirate=true; G.sub='steal'; }
  } else if(pl.kind==='robber'){
    const h=B.hexById[G.robber];
    robberAnim={from:toScreen(h.x,h.y),t0:T,t1:T+0.55};
    SFX.robber();
    const targets=robberTargets(G,B,id,me);
    if(targets.length===1){ ST.place=null; ST.near=null; return runSteal('robber',id,targets[0]); }
    else if(targets.length===0) moveRobber(G,B,id,null);
    else { G.robber=id; G.pendingSteal=targets; G.stealPirate=false; G.sub='steal'; }
  }
  ST.place=null; ST.near=null;
  afterAction();
}
function afterAction(){
  const G=ST.G;
  if(G.phase!=='over' && (G.sub==='main'||G.sub==='special')) checkWin(G);
  ST.lastNeed='';
  syncUI(); push();
}

/* ---------- action bar clicks ---------- */
function onAction(id){
  const G=ST.G,B=ST.B,me=actor(),p=G.players[me];
  if(id==='confirmplace'){ if(ST.pendingPlace!=null) commitPlace(ST.pendingPlace); return; }
  if(id==='cancelplace'){ ST.pendingPlace=null; drawActions(currentNeed(G)); return; }
  if(id==='ptrade'){ if(ST.trade) endPlayerTrade(); else startPlayerTrade(); return; }
  if(id==='tradecancel'){ endPlayerTrade(); return; }
  if(id==='tradenext'){ if(ST.trade&&ST.trade.give.length){ ST.trade.step='want'; SFX.tap(); refreshTrade(); } return; }
  if(id==='tradeback'){ if(ST.trade){ ST.trade.step='give'; clearTradeBanner(); refreshTrade(); } return; }
  if(id==='tradesend'){ if(ST.trade) sendTableOffer(); return; }
  if(id.indexOf('tp:')===0){
    if(!ST.trade) return;
    const want=Object.assign({},ST.trade.want);
    proposeTrade(+id.slice(3),tradeGiveObj(),want); return; }
  if(id==='discardgo'){
    const nd=currentNeed(G), keys=isCK(G)?RES.concat(COM):RES;
    const list=[]; keys.forEach(k=>{ const n=heldOf(p,k); for(let i=0;i<n;i++) list.push(k); });
    const picks={}; keys.forEach(k=>picks[k]=0);
    (ST.discardSel||[]).forEach(i=>{ if(list[i]) picks[list[i]]++; });
    if(resolveDiscard(G,me,picks)){ ST.discardSel=[]; SFX.tap(); ST.lastNeed=''; afterAction(); }
    return;
  }
  if(id==='roll'){
    if(ST.busy) return; ST.busy=true;
    const sum=doRoll(G,B);
    G.rollId=(G.rollId||0)+1; lastRollSeen=G.rollId;
    push(); SFX.dice();
    /* the numbers on the board (build costs you can now afford, the new turn phase) are already
       decided the moment the dice are rolled, but they should only appear once the dice themselves
       have visibly finished — so the action row stays frozen on "rolling" until then */
    if(canAct()) setPrimary('מטילים…',ICON.dice,'roll',{disabled:true});   /* a bot also runs through here — never reveal its controls */
    const reroll = sum===7 && G.sub==='roll';          /* a 7 in the opening round: roll again */
    showDice(G.dice[0],G.dice[1],()=>{ ST.busy=false; SFX.diceLand(sum);
      if(reroll){
        const pp=G.players[G.turn];
        tableBanner('ok','יצא 7 בסיבוב הראשון!',`${pp.name} ${gv(pp,'מטיל','מטילה')} שוב — אין שודד ואין השלכה`,2600,null);
        ST.lastNeed=''; syncUI(); push(); return;
      }
      productionFx(sum);
      ST.lastNeed=''; syncUI(); if(sum===7) announceSeven(); });
    return;
  }
  if(id==='road'){ toggle('road',legalRoadSpots(G,B,me,false)); return; }
  if(id==='ship'){ toggle('ship',legalRoadSpots(G,B,me,true)); return; }
  if(id==='moveship'){
    if(ST.place&&(ST.place.kind==='shipfrom'||ST.place.kind==='shipto')){ ST.place=null; ST.near=null; refreshHud(); return; }
    const mv=movableShips(G,B,me);
    if(!mv.length){ toast('אין ספינה פתוחה שאפשר להזיז עכשיו'); return; }
    ST.place={kind:'shipfrom',legal:mv}; ST.near=null;
    toast('בחרו ספינה פתוחה להזזה (בקצה השרשרת)',3000); refreshHud(); return;
  }
  if(id==='sett'){ toggle('settlement',legalSettleSpots(G,B,me,false)); return; }
  if(id==='city'){ toggle('city',legalCitySpots(G,B,me)); return; }
  if(id==='dev'){
    const c=buyDev(G);
    if(c){ SFX.buyCard(); devCardFly(me,noteDeed(G,'dev'));
      toast('קיבלתם: '+DEV_HE[c].t); afterAction(); }
    return;
  }
  if(id==='hand'){ openDevSheet(); return; }
  if(id==='kbuild'){ G.sub='knightPlace'; ST.lastNeed=''; syncUI(); return; }
  if(id==='knights'){ openKnightSheet(); return; }
  if(id==='improve'){ openImproveSheet(); return; }
  if(id==='prog'){ openProgSheet(); return; }
  if(id==='ckcancel'){ G.sub=homeSub(G); G.movingKnight=null; ST.place=null; ST.lastNeed=''; syncUI(); push(); return; }
  if(id==='trade'){ openTradeSheet(); return; }
  if(id==='knight'){
    const i=p.dev.findIndex((c,k)=>c==='knight'&&playableDev(G,me,k));
    if(i>=0){ playDev(G,B,i); SFX.knight(); tableBanner('wait',`${p.name} ${gv(p,'שלח','שלחה')} אביר!`,'מזיז את השודד',2200,'knight'); afterAction(); }
    return;
  }
  if(id==='skipfree'){ G.freeRoads=0; G.sub=homeSub(G); afterAction(); return; }
  if(id==='resume'){ onNeedChanged(currentNeed(G)); return; }
  if(id==='end'){
    if(checkWin(G)){ afterAction(); return; }
    if(G.offer && G.offer.open) emitFx({t:'toast',text:`ההצעה של ${p.name} נסגרה בלי עסקה (התור נגמר)`});
    endTurn(G,B); ST.place=null;
    if(ST.tut) tutAfterEndTurn();
    afterAction(); return;
  }
}
/* redraw the action bar without re-deriving (and so resetting) the current placement mode */
function refreshHud(){ drawActions(currentNeed(ST.G)); }
function toggle(kind,legal){
  if(ST.place&&ST.place.kind===kind){ ST.place=null; ST.pendingPlace=null; }
  else enterPlace(kind,legal);
  drawActions(currentNeed(ST.G));
}

/* ---------- production sparkle ---------- */
function productionFx(sum){
  const G=ST.G,B=ST.B;
  if(sum===7) return;
  const strip=$('#pstrip');
  let any=false;
  B.hexes.forEach(h=>{
    if(h.num!==sum) return;
    tokenPulse[h.id]=T; wakeHex(h.id);
    if(h.id===G.robber) return;
    const r=TERRAIN_RES[h.terrain]; if(!r) return;
    const c={x:h.x,y:h.y};
    for(let i=0;i<6;i++){
      const vid=vKey(hexCorner(c,i)); const b=G.buildings[vid]; if(!b) continue;
      const card=strip.querySelector('[data-pi="'+b.p+'"]');
      const rect=card?card.getBoundingClientRect():null;
      const wrap=cv.getBoundingClientRect();
      const tx=rect?rect.left-wrap.left+rect.width/2:CW/2;
      const ty=rect?rect.top-wrap.top+rect.height/2:40;
      const n=b.t==='c'?2:1;
      for(let k=0;k<n;k++)
        spawnResFly(B.verts[vid].x,B.verts[vid].y, r==='gold'?'gold':r, tx,ty, k*0.12+i*0.02);
      any=true;
    }
  });
  if(any) setTimeout(()=>SFX.gain(),260);
}

