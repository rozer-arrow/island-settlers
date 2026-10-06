/* =========================================================
   6. APP STATE + BOARD INTERACTION
   ========================================================= */
const ST = { G:null, B:null, mode:'local', meIdx:-1, place:null, near:null,
             net:null, room:null, lastNeed:'', busy:false, seatUid:{} };

/* room the players' strip (and, in Cities & Knights, the barbarian meter) takes at the top */
/* ---- desktop mode: who sits where around the table (you are always at the bottom) ---- */
const SEAT_SLOTS={1:['top'],2:['right','left'],3:['right','top','left'],4:['right','top','top','left'],5:['right','top','top','top','left']};
function isDesk(){ return document.body.classList.contains('desk'); }
function fitPads(){
  const n=ST.G?ST.G.players.length:2, slots=SEAT_SLOTS[n-1]||[];
  if(!isDesk()) return {top:padTop(),bottom:24,side:null};
  const hasTop=slots.indexOf('top')>=0, hasSide=slots.indexOf('left')>=0||slots.indexOf('right')>=0;
  return {top:64+(hasTop?84:0)+((ST.G&&ST.G.cfg&&ST.G.cfg.ck)?30:0), bottom:172, side:hasSide?240:40};
}
function fitNow(){
  const B=ST.B; if(!B) return; const p=fitPads();
  fitView(B,CW,CH-(ST.tut&&!isDesk()?190:0),p.top,p.bottom,p.side);
}
function setDesk(on,save){
  document.body.classList.toggle('desk',!!on);
  if(save!==false) ls('sidesk',on?'1':'0');
  const b=$('#btnDesk'); if(b) b.classList.toggle('on',!!on);
  resizeCanvas(); if(ST.G){ fitNow(); drawStrip(); drawHand(); drawActions(currentNeed(ST.G)); }
}
function autoDesk(){
  try{ return window.innerWidth>=1000 && window.innerHeight>=620 && !!window.matchMedia &&
       window.matchMedia('(hover:hover) and (pointer:fine)').matches; }catch(e){ return false; }
}
function padTop(){ return (ST.G&&ST.G.cfg&&ST.G.cfg.ck)?130:100; }
function actor(){ return ST.G ? currentNeed(ST.G).who : 0; }
function need(){ return ST.G ? currentNeed(ST.G) : {kind:'none',who:0}; }
function canAct(){
  if(!ST.G) return false;
  if(ST.mode==='local'){
    const p=ST.G.players[actor()];
    return !!p && !p.bot;              /* never let a person click for the computer */
  }
  return actor()===ST.meIdx;
}
/* whose hand is on screen: only ever a human's, never a computer's */
function viewIdx(){
  const G=ST.G;
  if(ST.mode!=='local') return ST.meIdx>=0?ST.meIdx:0;
  const a=actor();
  if(G.players[a] && !G.players[a].bot){ ST.lastHuman=a; return a; }
  if(ST.lastHuman!=null && G.players[ST.lastHuman] && !G.players[ST.lastHuman].bot) return ST.lastHuman;
  const h=G.players.findIndex(p=>!p.bot);
  return h>=0?h:0;
}

function render(t){
  if(!ST.B){ drawOcean(t); return; }
  if(sky.for!=='game') initSky(ST.B,'game');
  /* a very slow handheld drift so the board never feels pinned down */
  const bx=ECO?0:Math.sin(t*0.21)*1.6, by=ECO?0:Math.cos(t*0.17)*1.2;
  const st=ECO?0:t;                       /* battery saver: the sea and the foam rest */
  ctx.save(); ctx.translate(bx,by);
  drawTable();
  drawBoardBase(ST.B,st);
  drawCoastFoam(ST.B,st);
  drawTiles(ST.B,t,ST.G);
  drawCloudShadows(t);
  drawPorts(ST.B,t);
  drawRoads(ST.B,ST.G);
  drawTokens(ST.B,ST.G,t);
  drawHighlights(ST.B,ST.G,t,highlightSet());
  drawBuildings(ST.B,ST.G,t);
  if(ST.G.cfg && ST.G.cfg.ck) drawKnights(ST.B,ST.G,t);
  if(!ECO) drawChimneys(ST.B,ST.G,t);
  drawRobber(ST.B,ST.G,t);
  drawPirate(ST.B,ST.G,t);
  if(ST.tut) drawTutPointers(t);          /* on top of everything, so the hint is never hidden */
  drawFx(t);
  drawClouds(t);
  if(!ECO) drawGulls(t);
  ctx.restore();
  drawLight();
}
function highlightSet(){
  const pl=ST.place; if(!pl||!canAct()) return null;
  const c=colOf(ST.G,actor());
  const pend=CONFIRM_PLACE_KINDS.indexOf(pl.kind)>=0 ? ST.pendingPlace : null;
  if(pl.kind==='robber'||pl.kind==='ckhex') return {hexes:pl.legal,near:ST.near};
  if(pl.kind==='road'||pl.kind==='ship'||pl.kind==='shipfrom') return {edges:pl.legal,near:ST.near,pending:pend};
  if(pl.kind==='shipto') return {edges:pl.legal,near:ST.near,from:pl.from};
  if(pl.kind==='ckvert') return {verts:pl.legal,near:ST.near};
  return {verts:pl.legal,near:ST.near,ghost:pl.kind,color:c,pending:pend};
}

/* ---------- pointer: pan, pinch, tap ---------- */
let ptrs=new Map(), panStart=null, pinch=null, moved=false, downT=0;
function boardXY(ev){
  const r=cv.getBoundingClientRect();
  return {x:ev.clientX-r.left, y:ev.clientY-r.top};
}
function initPointer(){
  cv.addEventListener('pointerdown',e=>{
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId,boardXY(e));
    moved=false; downT=performance.now();
    if(ptrs.size===1){ const p=ptrs.get(e.pointerId); panStart={x:p.x,y:p.y,ox:view.ox,oy:view.oy}; }
    if(ptrs.size===2){ const a=[...ptrs.values()];
      pinch={d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y),s:view.scale,
             cx:(a[0].x+a[1].x)/2, cy:(a[0].y+a[1].y)/2, ox:view.ox, oy:view.oy}; }
  });
  cv.addEventListener('pointermove',e=>{
    if(!ptrs.has(e.pointerId)){ updateNear(boardXY(e)); return; }
    ptrs.set(e.pointerId,boardXY(e));
    if(ptrs.size===2&&pinch){
      const a=[...ptrs.values()];
      const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);
      const ns=clamp(pinch.s*(d/pinch.d),view.minS,view.maxS);
      const k=ns/pinch.s;
      view.scale=ns;
      view.ox=pinch.cx-(pinch.cx-pinch.ox)*k;
      view.oy=pinch.cy-(pinch.cy-pinch.oy)*k;
      moved=true; return;
    }
    if(ptrs.size===1&&panStart){
      const p=ptrs.get(e.pointerId);
      const dx=p.x-panStart.x, dy=p.y-panStart.y;
      if(Math.abs(dx)>6||Math.abs(dy)>6) moved=true;
      if(moved){ view.ox=panStart.ox+dx; view.oy=panStart.oy+dy; }
      updateNear(p);
    }
  });
  const up=e=>{
    const p=ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if(ptrs.size<2) pinch=null;
    if(ptrs.size===0){
      if(!moved && p && performance.now()-downT<600) handleTap(p);
      panStart=null;
    }
  };
  cv.addEventListener('pointerup',up);
  cv.addEventListener('pointercancel',up);
  cv.addEventListener('wheel',e=>{
    e.preventDefault();
    const p=boardXY(e);
    const k=Math.exp(-e.deltaY*0.0015);
    const ns=clamp(view.scale*k,view.minS,view.maxS), kk=ns/view.scale;
    view.scale=ns; view.ox=p.x-(p.x-view.ox)*kk; view.oy=p.y-(p.y-view.oy)*kk;
  },{passive:false});
}
function nearestTarget(p){
  const pl=ST.place; if(!pl||!pl.legal||!pl.legal.length) return null;
  const b=fromScreen(p.x,p.y);
  let best=null,bd=1e9;
  for(const id of pl.legal){
    let o;
    if(pl.kind==='robber'||pl.kind==='ckhex'){ const h=anyHex(ST.B,id); o={x:h.x,y:h.y}; }
    else if(pl.kind==='road'||pl.kind==='ship'||pl.kind==='shipfrom'||pl.kind==='shipto'){ o=ST.B.edges[id]; }
    else o=ST.B.verts[id];
    const d=Math.hypot(o.x-b.x,o.y-b.y);
    if(d<bd){bd=d;best=id;}
  }
  const lim = (pl.kind==='robber'||pl.kind==='ckhex')?1.0:0.55;
  return bd<lim?best:null;
}
function updateNear(p){
  if(!ST.place||!canAct()){ ST.near=null; return; }
  ST.near=nearestTarget(p);
}
function handleTap(p){
  if(!ST.place||!canAct()) return;
  const id=nearestTarget(p);
  if(!id){ return; }
  tapPlace(id);
}

/* ---------- dice ---------- */
const PIPS={1:[[.5,.5]],2:[[.26,.26],[.74,.74]],3:[[.26,.26],[.5,.5],[.74,.74]],
  4:[[.26,.26],[.74,.26],[.26,.74],[.74,.74]],
  5:[[.26,.26],[.74,.26],[.5,.5],[.26,.74],[.74,.74]],
  6:[[.26,.24],[.74,.24],[.26,.5],[.74,.5],[.26,.76],[.74,.76]]};
function dieEl(n){
  const d=document.createElement('div'); d.className='die';
  (PIPS[n]||[]).forEach(([x,y])=>{ const i=document.createElement('i');
    i.style.left=(x*100)+'%'; i.style.top=(y*100)+'%';
    i.style.transform='translate(-50%,-50%)'; d.appendChild(i); });
  return d;
}
function showDice(d1,d2,done){
  const layer=$('#diceLayer'); layer.innerHTML='';
  const wrap=document.createElement('div'); wrap.className='dice-wrap';
  const pair=document.createElement('div'); pair.className='dice-pair';
  wrap.appendChild(pair); layer.appendChild(wrap);
  let a=dieEl(1),b=dieEl(1); pair.appendChild(a); pair.appendChild(b);
  const t0=performance.now();
  const DUR=850;
  function tick(now){
    const k=(now-t0)/DUR;
    if(k<1){
      const f1=1+randInt(6), f2=1+randInt(6);
      const na=dieEl(f1), nb=dieEl(f2);
      pair.replaceChild(na,a); pair.replaceChild(nb,b); a=na;b=nb;
      const sp=(1-k);
      a.style.transform=`rotate(${Math.sin(now/40)*40*sp}deg) translateY(${-Math.abs(Math.sin(now/90))*26*sp}px)`;
      b.style.transform=`rotate(${Math.cos(now/37)*40*sp}deg) translateY(${-Math.abs(Math.cos(now/84))*26*sp}px)`;
      requestAnimationFrame(tick);
    } else {
      const na=dieEl(d1), nb=dieEl(d2);
      pair.replaceChild(na,a); pair.replaceChild(nb,b);
      na.style.transition=nb.style.transition='transform .28s cubic-bezier(.2,1.7,.4,1)';
      na.style.transform=nb.style.transform='scale(1.12)';
      setTimeout(()=>{ na.style.transform=nb.style.transform='scale(1)'; },160);
      const sum=document.createElement('div'); sum.className='dice-sum'; sum.textContent=d1+d2;
      wrap.appendChild(sum);
      /* the game carries on quickly, but the result stays on screen long enough to read */
      setTimeout(()=>{ if(done) done(); },780);
      setTimeout(()=>{
        wrap.style.transition='opacity .5s, transform .5s';
        wrap.style.opacity='0'; wrap.style.transform='translateY(-18px) scale(.85)';
        setTimeout(()=>{ if(layer.firstChild===wrap) layer.innerHTML=''; },560);
      },2800);
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- toast ---------- */
let toastT=null;
function toast(msg,ms){
  const el=$('#toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),ms||2200);
}

