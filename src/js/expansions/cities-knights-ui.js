/* =========================================================
   CKUI. CITIES & KNIGHTS — pieces and panels
   ========================================================= */
function drawKnights(B,G,t){
  const S=view.scale;
  G.players.forEach((p,pi)=>{
    (p.kn||[]).forEach(k=>{
      const v=B.verts[k.v]; if(!v) return;
      const s=toScreen(v.x,v.y);
      if(s.x<-60||s.x>CW+60||s.y<-60||s.y>CH+60) return;
      const c=colOf(G,pi);
      const bob=k.act?Math.sin(t*2.4+k.v.length)*S*0.016:0;
      const r=S*0.20;
      ctx.save(); ctx.translate(s.x,s.y-r*0.35+bob);
      ctx.fillStyle='rgba(0,0,0,.42)';
      ctx.beginPath(); ctx.ellipse(0,r*0.86,r*0.72,r*0.24,0,0,TAU); ctx.fill();
      if(k.act){
        ctx.globalAlpha=0.35+0.2*Math.sin(t*3.1);
        ctx.fillStyle='#FFE9A8';
        ctx.beginPath(); ctx.arc(0,0,r*1.25,0,TAU); ctx.fill();
        ctx.globalAlpha=1;
      }
      /* shield */
      ctx.beginPath();
      ctx.moveTo(-r*0.62,-r*0.70); ctx.lineTo(r*0.62,-r*0.70);
      ctx.lineTo(r*0.62,r*0.10); ctx.quadraticCurveTo(r*0.62,r*0.80,0,r*0.92);
      ctx.quadraticCurveTo(-r*0.62,r*0.80,-r*0.62,r*0.10);
      ctx.closePath();
      ctx.fillStyle = k.act ? c.hex : c.dark; ctx.fill();
      ctx.strokeStyle='rgba(16,10,3,.8)'; ctx.lineWidth=Math.max(1,r*0.16); ctx.lineJoin='round'; ctx.stroke();
      if(!k.act){ ctx.globalAlpha=0.35; ctx.fillStyle='#0B2231';
        ctx.beginPath();
        ctx.moveTo(-r*0.62,-r*0.70); ctx.lineTo(r*0.62,-r*0.70);
        ctx.lineTo(r*0.62,r*0.10); ctx.quadraticCurveTo(r*0.62,r*0.80,0,r*0.92);
        ctx.quadraticCurveTo(-r*0.62,r*0.80,-r*0.62,r*0.10); ctx.closePath(); ctx.fill();
        ctx.globalAlpha=1; }
      /* helmet mark */
      ctx.fillStyle='rgba(255,255,255,.75)';
      ctx.beginPath(); ctx.arc(0,-r*0.20,r*0.24,Math.PI,0); ctx.fill();
      ctx.fillRect(-r*0.24,-r*0.20,r*0.48,r*0.22);
      ctx.fillStyle='rgba(20,14,6,.85)';
      ctx.fillRect(-r*0.24,-r*0.12,r*0.48,r*0.07);
      /* rank pips */
      ctx.fillStyle='#FFF3D0';
      for(let i=0;i<k.lvl;i++){
        ctx.beginPath();
        ctx.arc((i-(k.lvl-1)/2)*r*0.28, r*0.44, r*0.10,0,TAU); ctx.fill();
      }
      if(p.actedKn&&p.actedKn[k.id]){
        ctx.strokeStyle='rgba(255,255,255,.5)'; ctx.lineWidth=Math.max(1,r*0.12);
        ctx.beginPath(); ctx.moveTo(-r*0.5,-r*0.5); ctx.lineTo(r*0.5,r*0.6); ctx.stroke();
      }
      ctx.restore();
    });
  });
  /* the merchant */
  if(G.merchant&&G.merchant.hex){
    const h=B.hexById[G.merchant.hex];
    if(h){
      const s=toScreen(h.x,h.y), r=S*0.19, c=colOf(G,G.merchant.p);
      ctx.save(); ctx.translate(s.x+S*0.42,s.y+S*0.38);
      ctx.fillStyle='rgba(0,0,0,.4)';
      ctx.beginPath(); ctx.ellipse(0,r*0.8,r*0.7,r*0.24,0,0,TAU); ctx.fill();
      ctx.fillStyle='#E8DCC0';
      ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r*0.8,r*0.6); ctx.lineTo(-r*0.8,r*0.6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=c.hex; ctx.lineWidth=Math.max(1,r*0.22); ctx.stroke();
      ctx.restore();
    }
  }
}

/* ---------- barbarian meter ---------- */
function drawBarbMeter(G){
  const el=$('#barbMeter'); if(!el) return;
  if(!isCK(G)){ el.style.display='none'; return; }
  el.style.display='';
  const strip=$('#pstrip');           /* sit just under the players, however tall the badges make them */
  if(strip && strip.offsetHeight) el.style.top=(strip.offsetTop+strip.offsetHeight+6)+'px';
  const k=G.barb.pos/G.barb.len;
  const near=G.barb.pos>=G.barb.len-2;
  el.innerHTML=`<span class="bm-ship">⛵</span>
    <span class="bm-track"><span class="bm-fill" style="width:${Math.round(k*100)}%;
      background:${near?'#D2603F':'#E0A93B'}"></span></span>
    <b>${G.barb.pos}/${G.barb.len}</b>`;
  el.title='התקדמות ספינת הברברים';
}

/* ---------- hand with commodities ---------- */
function drawHandCK(){
  const G=ST.G, el=$('#hand'), pi=viewIdx(), p=G.players[pi];
  const prev={}; $$('#hand .rescard').forEach(c=>prev[c.dataset.res]=+c.querySelector('.n').textContent);
  el.innerHTML='';
  el.classList.add('ck');
  RES.forEach(r=>{
    const c=resCardEl(r,p.res[r]);
    if(prev[r]!==undefined && p.res[r]>prev[r]) c.classList.add('pop');
    el.appendChild(c);
  });
  COM.forEach(cm=>{
    const c=comCardEl(cm,p.com[cm]);
    if(prev[cm]!==undefined && p.com[cm]>prev[cm]) c.classList.add('pop');
    el.appendChild(c);
  });
}
const COM_BG={paper:['#7FD6AE','#2E6E52'],cloth:['#F2CE72','#9A6E14'],coin:['#9CC2EE','#33598C']};
function comCardEl(cm,n){
  const d=document.createElement('div'); d.className='rescard com'+(n?'':' zero'); d.dataset.res=cm;
  const c=document.createElement('canvas'); c.width=104;c.height=136;
  const x=c.getContext('2d'); x.scale(2,2);
  const bg=COM_BG[cm]; const g=x.createLinearGradient(0,0,0,68);
  g.addColorStop(0,bg[0]); g.addColorStop(1,bg[1]);
  x.fillStyle=g; x.fillRect(0,0,52,68);
  x.fillStyle='rgba(255,255,255,.14)'; x.fillRect(0,0,52,22);
  drawComIcon(x,cm,26,30,34);
  d.appendChild(c);
  const nn=document.createElement('div'); nn.className='n'; nn.textContent=n; d.appendChild(nn);
  return d;
}
function drawComIcon(ctx,cm,x,y,s){
  ctx.save(); ctx.translate(x,y);
  if(cm==='paper'){
    ctx.fillStyle='#FAF6E8';
    ctx.beginPath(); ctx.moveTo(-s*0.32,-s*0.42); ctx.lineTo(s*0.32,-s*0.42);
    ctx.lineTo(s*0.32,s*0.42); ctx.lineTo(-s*0.32,s*0.42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#9AA79B'; ctx.lineWidth=s*0.05;
    for(let i=0;i<4;i++){ ctx.beginPath();
      ctx.moveTo(-s*0.20,-s*0.24+i*s*0.17); ctx.lineTo(s*0.20,-s*0.24+i*s*0.17); ctx.stroke(); }
  } else if(cm==='cloth'){
    ctx.fillStyle='#F6E3A8';
    ctx.beginPath();
    ctx.moveTo(-s*0.40,-s*0.30);
    ctx.quadraticCurveTo(0,-s*0.48,s*0.40,-s*0.30);
    ctx.lineTo(s*0.40,s*0.28);
    ctx.quadraticCurveTo(0,s*0.46,-s*0.40,s*0.28);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(150,110,20,.5)'; ctx.lineWidth=s*0.05;
    ctx.beginPath(); ctx.moveTo(-s*0.14,-s*0.38); ctx.lineTo(-s*0.14,s*0.38); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s*0.14,-s*0.38); ctx.lineTo(s*0.14,s*0.38); ctx.stroke();
  } else {
    ctx.fillStyle='#F0C544';
    ctx.beginPath(); ctx.ellipse(0,s*0.06,s*0.36,s*0.32,0,0,TAU); ctx.fill();
    ctx.fillStyle='#D2A322';
    ctx.beginPath(); ctx.ellipse(0,s*0.16,s*0.36,s*0.24,0,0,TAU); ctx.fill();
    ctx.fillStyle='#F7D96A';
    ctx.beginPath(); ctx.ellipse(0,-s*0.06,s*0.36,s*0.30,0,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.ellipse(-s*0.10,-s*0.12,s*0.10,s*0.07,-0.4,0,TAU); ctx.fill();
  }
  ctx.restore();
}

/* ---------- city improvements sheet ---------- */
function openImproveSheet(){
  const G=ST.G, pi=actor(), p=G.players[pi];
  const body=$('#pickBody'); body.innerHTML='';
  $('#pickTitle').textContent='שיפורי עיר';
  $('#pickSub').textContent = p.craneOn
    ? 'המנוף מוזיל את השיפור הבא בסחורה אחת.'
    : 'סחורות מגיעות מערים בלבד. דרגה 3 פותחת יכולת, דרגה 4 מטרופולין.';
  TRACKS.forEach(t=>{
    const lv=p.imp[t.id], next=lv+1;
    let cost=impCost(next); if(p.craneOn) cost=Math.max(1,cost-1);
    const row=document.createElement('div');
    row.style.cssText='background:rgba(0,0,0,.22);border:1px solid var(--edge-soft);border-radius:14px;padding:11px;margin-bottom:9px';
    const dots=[1,2,3,4,5].map(i=>
      `<span style="display:inline-block;width:15px;height:15px;border-radius:5px;margin-inline-end:4px;
        background:${i<=lv?t.col:'rgba(255,255,255,.12)'}"></span>`).join('');
    row.innerHTML=`<div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
        <b style="font-size:15.5px;color:${t.col}">${t.he}</b>
        <span style="font-size:12px;color:#93B2C2">${COM_HE[t.com]} · יש לכם ${p.com[t.com]}</span></div>
      <div style="margin-bottom:8px">${dots}</div>
      <div style="font-size:12.5px;color:#C7DCE6;line-height:1.5">
        ${lv>=3?`<b style="color:${t.col}">${t.lvl3}:</b> ${t.ab}`:`דרגה 3 תפתח: <b>${t.lvl3}</b> — ${t.ab}`}
        ${G.metro[t.id]===pi?'<br><b style="color:#E0A93B">המטרופולין אצלכם (+2 נק׳)</b>':
          (G.metro[t.id]>=0?`<br>המטרופולין אצל ${G.players[G.metro[t.id]].name}`:'')}
      </div>`;
    const b=document.createElement('button'); b.className='btn gold wide'; b.style.marginTop='9px';
    if(lv>=5){ b.textContent='דרגה מרבית'; b.disabled=true; }
    else { b.textContent=`שדרוג לדרגה ${next} · ${cost} ${COM_HE[t.com]}`;
      b.disabled=!canImprove(G,pi,t.id);
      b.onclick=()=>{ if(doImprove(G,pi,t.id)){ SFX.build('city');
        closeAllSheets(); if(G.metroPick) G.sub='metroPick'; ST.lastNeed=''; afterAction(); } }; }
    row.appendChild(b); body.appendChild(row);
  });
  if(canWall(G,pi)||G.players[pi].walls>0){
    const w=document.createElement('div');
    w.style.cssText='background:rgba(0,0,0,.22);border:1px solid var(--edge-soft);border-radius:14px;padding:11px';
    w.innerHTML=`<b style="font-size:15px">חומות מגן</b>
      <div style="font-size:12.5px;color:#93B2C2;margin:4px 0 8px">
        יש לכם ${p.walls}/3. כל חומה מוסיפה 2 לגבול הקלפים ומגנה על עיר מפני הברברים.</div>`;
    const b=document.createElement('button'); b.className='btn wide';
    b.textContent='בניית חומה · '+CK_COST_HE.wall; b.disabled=!canWall(G,pi);
    b.onclick=()=>{ if(buildWall(G,pi,false)){ SFX.build('city'); closeAllSheets(); afterAction(); } };
    w.appendChild(b); body.appendChild(w);
  }
  if(G.sub==='improve'){
    const c=document.createElement('button'); c.className='btn ghost wide'; c.style.marginTop='9px';
    c.textContent='דילוג'; c.onclick=()=>{ ckResolve(G,ST.B,null); closeAllSheets(); ST.lastNeed=''; afterAction(); };
    body.appendChild(c);
  } else {
    const c=document.createElement('button'); c.className='btn ghost wide'; c.style.marginTop='9px';
    c.textContent='סגירה'; c.onclick=closeAllSheets; body.appendChild(c);
  }
  openSheet('sheetPick');
}

/* ---------- knights sheet ---------- */
function openKnightSheet(){
  const G=ST.G,B=ST.B, pi=actor(), p=G.players[pi];
  const body=$('#pickBody'); body.innerHTML='';
  $('#pickTitle').textContent='האבירים שלכם';
  $('#pickSub').textContent=`כוח פעיל: ${knStrength(p)} · אבירים זמינים: `+
    [1,2,3].map(l=>`${KN_HE[l]} ${p.knightsLeft[l]}`).join(' · ');
  if(!p.kn.length){
    const e=document.createElement('div'); e.style.cssText='color:#93B2C2;font-size:13px;margin-bottom:10px';
    e.textContent='עוד אין לכם אבירים. גייסו אחד מסרגל הפעולות.'; body.appendChild(e);
  }
  p.kn.forEach(k=>{
    const acted=!!p.actedKn[k.id];
    const d=document.createElement('div'); d.className='devitem';
    d.innerHTML=`<div class="t"><b>${KN_HE[k.lvl]}</b>
      <span>${k.act?'פעיל':'לא פעיל'}${acted?' · כבר פעל השנה':''}</span></div>`;
    const wrap=document.createElement('div'); wrap.style.cssText='display:flex;gap:5px;flex-wrap:wrap';
    const mk=(txt,dis,fn)=>{ const b=document.createElement('button');
      b.className='btn sm'; b.textContent=txt; b.disabled=dis; b.onclick=fn; wrap.appendChild(b); };
    if(!k.act) mk('הפעלה · חיטה', !canAfford(p,CK_COST.activate),
      ()=>{ if(activateKnight(G,pi,k.id,false)){ SFX.knight(); closeAllSheets(); afterAction(); } });
    mk('קידום · '+CK_COST_HE.promote, !canPromote(G,pi,k)||!canAfford(p,CK_COST.promote),
      ()=>{ if(promoteKnight(G,pi,k.id,false)){ SFX.knight(); closeAllSheets(); afterAction(); } });
    if(k.act&&!acted){
      const moves=knightMoveTargets(G,B,k.id,pi);
      mk('תזוזה', !moves.length, ()=>{ G.movingKnight=k.id; G.sub='knightMove';
        closeAllSheets(); ST.lastNeed=''; syncUI(); });
      const rb=knightRobberTargets(G,B,k.id,pi);
      mk('גירוש השודד', !rb.length, ()=>{ G.movingKnight=k.id; G.sub='knightRobber';
        closeAllSheets(); ST.lastNeed=''; syncUI(); });
    }
    d.appendChild(wrap); body.appendChild(d);
  });
  const c=document.createElement('button'); c.className='btn ghost wide'; c.style.marginTop='10px';
  c.textContent='סגירה'; c.onclick=closeAllSheets; body.appendChild(c);
  openSheet('sheetPick');
}

/* ---------- progress cards ---------- */
function openProgSheet(){
  const G=ST.G, pi=actor(), p=G.players[pi];
  const body=$('#devBody'); body.innerHTML='';
  $('#devSub').textContent = p.prog.length
    ? 'עד 4 קלפים ביד. נמשכים לפי קובית האירועים ודרגת השיפור.'
    : 'אין לכם קלפי קִדמה. הם נמשכים כשקובית האירועים מראה שער בצבע שיש לכם בו שיפור.';
  p.prog.forEach((id,i)=>{
    const c=PROG[id]; const tr=TRACKS.find(t=>t.id===c.deck);
    const d=document.createElement('div'); d.className='devitem';
    d.innerHTML=`<div class="t"><b style="color:${tr.col}">${c.t}</b><span>${c.d}</span></div>`;
    const b=document.createElement('button'); b.className='btn sm gold'; b.textContent='לשחק';
    b.disabled = !(G.sub==='main'||G.sub==='roll'||G.sub==='special');
    b.onclick=()=>{ if(playProg(G,ST.B,pi,i)){ SFX.knight(); closeAllSheets(); ST.lastNeed=''; afterAction(); } };
    d.appendChild(b); body.appendChild(d);
  });
  openSheet('sheetDev');
}

/* ---------- the generic chooser ---------- */
function openCkPicker(){
  const G=ST.G, ch=ckChoice(G);
  if(!ch){ G.sub=homeSub(G); ST.lastNeed=''; syncUI(); return; }
  if(ch.kind==='track'){ openImproveSheet(); return; }
  const body=$('#pickBody'); body.innerHTML='';
  $('#pickTitle').textContent=ch.title; $('#pickSub').textContent=ch.sub||'';
  if(ch.kind==='res'||ch.kind==='com'||ch.kind==='rescom'){
    const wrap=document.createElement('div'); wrap.className='res-pick';
    ch.options.forEach(o=>{
      const b=document.createElement('button'); b.className='rp';
      b.appendChild(COM.indexOf(o.id)>=0?miniCom(o.id,34):miniRes(o.id,34));
      const s=document.createElement('span'); s.textContent=o.label; b.appendChild(s);
      b.onclick=()=>{ ckResolve(G,ST.B,o.id); SFX.coins(); closeAllSheets(); ST.lastNeed=''; afterAction(); };
      wrap.appendChild(b);
    });
    body.appendChild(wrap);
  } else {
    ch.options.forEach(o=>{
      const b=document.createElement('button'); b.className='btn wide'; b.style.marginBottom='8px';
      b.innerHTML = o.note? `${o.label} <span style="color:#93B2C2;font-size:12px">· ${o.note}</span>` : o.label;
      b.onclick=()=>{ ckResolve(G,ST.B,o.id); SFX.tap(); closeAllSheets(); ST.lastNeed=''; afterAction(); };
      body.appendChild(b);
    });
    if(!ch.options.length){
      const e=document.createElement('div'); e.style.cssText='color:#93B2C2;font-size:13px';
      e.textContent='אין אפשרויות זמינות.'; body.appendChild(e);
      const b=document.createElement('button'); b.className='btn wide'; b.style.marginTop='10px';
      b.textContent='המשך'; b.onclick=()=>{ G.sub=homeSub(G); closeAllSheets(); ST.lastNeed=''; afterAction(); };
      body.appendChild(b);
    }
  }
  openSheet('sheetPick');
}
function miniCom(cm,size){
  const c=document.createElement('canvas'); c.width=size*2;c.height=size*2;
  const x=c.getContext('2d'); x.scale(2,2);
  const bg=COM_BG[cm]; const g=x.createLinearGradient(0,0,0,size);
  g.addColorStop(0,bg[0]); g.addColorStop(1,bg[1]);
  x.fillStyle=g; roundRect(x,0,0,size,size,size*0.22); x.fill();
  drawComIcon(x,cm,size/2,size/2,size*0.78);
  c.style.width=size+'px'; c.style.height=size+'px';
  return c;
}

