/* =========================================================
   Who goes first — every player rolls one die, the highest number starts and the rest follow
   in descending order. Players who roll the same number roll again, among themselves only.
   ========================================================= */
function rollOffOrder(n,die){
  if(!die){
    const hook=(typeof window!=='undefined')?window.__rollDie:null;         /* test hook: 'identity' keeps the seating as entered */
    if(hook==='identity'){ let k=0; die=()=>6-(k++%6); }
    else die=hook||(()=>randInt(6)+1);
  }
  const rounds=[]; let groups=[Array.from({length:n},(_,i)=>i)], guard=0;
  while(groups.some(g=>g.length>1) && guard++<60){
    const next=[];
    groups.forEach(g=>{                                   /* each tied group re-rolls on its own, top group first */
      if(g.length===1){ next.push(g); return; }
      const rolled=g.map(i=>({i,v:die()}));
      rounds.push(rolled);
      [...new Set(rolled.map(r=>r.v))].sort((a,b)=>b-a)
        .forEach(v=>next.push(rolled.filter(r=>r.v===v).map(r=>r.i)));
    });
    groups=next;
  }
  const order=[]; groups.forEach(g=>g.forEach(i=>order.push(i)));   /* (a 60-round dead heat falls back to seat order) */
  return {order,rounds};
}
/* the result expressed in the NEW seating: order[k] = who sat where before; startRoll is what gets stored in the game */
function rollOffPlan(n){
  const ro=rollOffOrder(n), pos=[];
  ro.order.forEach((orig,k)=>{ pos[orig]=k; });
  return {order:ro.order,
    startRoll:{seat:pos, rounds:ro.rounds.map(r=>r.map(x=>({i:pos[x.i],v:x.v})))}};
}

/* ---- the ceremony ---- */
let rollTimers=[], rollIvs=[];
function stopStartRoll(){
  rollTimers.forEach(clearTimeout); rollIvs.forEach(clearInterval); rollTimers=[]; rollIvs=[];
  const ov=$('#rollov'); if(ov) ov.remove();
  if(ST.hold){ ST.hold=false; }
}
function dieHTML(v){
  const map={1:[4],2:[0,8],3:[0,4,8],4:[0,2,6,8],5:[0,2,4,6,8],6:[0,2,3,5,6,8]}, on=map[v]||[];
  return Array.from({length:9},(_,c)=>`<i class="${on.indexOf(c)>=0?'on':''}"></i>`).join('');
}
function showStartRoll(G){
  const sr=G&&G.startRoll; if(!sr||!sr.rounds||!sr.rounds.length) return;
  if(window.__noRollUI) return;
  stopStartRoll();
  ST.hold=true;
  const ov=document.createElement('div'); ov.id='rollov'; ov.className='rollov';
  ov.innerHTML=`<div class="rollbox"><h2>מי מתחיל?</h2><div class="rsub"></div><div class="rrows"></div>
    <div class="rbtns"><button class="btn wide" id="rSkip">דלג</button></div></div>`;
  document.body.appendChild(ov);
  const box=ov.querySelector('.rollbox'), sub=ov.querySelector('.rsub'), list=ov.querySelector('.rrows'), btns=ov.querySelector('.rbtns');
  const rows={}, last={};
  /* rows appear in the original seating, so the result is not given away by the order */
  sr.seat.map((fin,k)=>({fin,k})).forEach(({fin})=>{
    const p=G.players[fin]; if(!p) return;
    const row=document.createElement('div'); row.className='rrow';
    row.innerHTML=`<span class="rk"></span><span class="dot" style="background:${colOf(G,fin).hex}"></span><span class="nm"></span><span class="dcont"></span>`;
    row.querySelector('.nm').textContent=p.name+(p.bot?' 🤖':'');
    list.appendChild(row); rows[fin]={row,dc:row.querySelector('.dcont'),die:null};
  });
  const T=(fn,ms)=>{ const t=setTimeout(fn,ms); rollTimers.push(t); return t; };
  const setDie=(i,v)=>{ last[i]=v; rows[i].die.innerHTML=dieHTML(v); };
  const addDie=(i,v)=>{ const r=rows[i]; if(r.die) r.die.classList.add('old');
    const d=document.createElement('span'); d.className='sdie'; d.innerHTML=dieHTML(v||0); r.dc.appendChild(d); r.die=d; return d; };
  const nameOf=i=>G.players[i].name;
  function finish(){
    rollTimers.forEach(clearTimeout); rollIvs.forEach(clearInterval); rollTimers=[]; rollIvs=[];
    /* every row shows all of its rolls: the first one, then any re-rolls, the latest one full size */
    Object.keys(rows).forEach(i=>{ const r=rows[i]; r.dc.innerHTML=''; r.die=null; r.row.classList.remove('idle','tie'); });
    sr.rounds.forEach(rd=>rd.forEach(x=>{ addDie(x.i,x.v); }));
    /* final order: first in the list, numbered */
    Object.keys(rows).map(Number).sort((a,b)=>a-b).forEach((i,k)=>{
      list.appendChild(rows[i].row); rows[i].row.querySelector('.rk').textContent=String(k+1);
      rows[i].row.classList.toggle('first',k===0);
    });
    box.classList.add('fin');
    sub.textContent=nameOf(0)+' מתחיל!';
    btns.innerHTML=''; const go=document.createElement('button'); go.className='btn gold wide'; go.id='rollGo'; go.textContent='מתחילים במשחק';
    go.onclick=closeStartRoll; btns.appendChild(go);
    T(closeStartRoll,12000);
  }
  function tumble(i,v,dur){
    const r=rows[i]; r.row.classList.remove('idle','tie'); const die=addDie(i,0); die.classList.add('rolling');
    const iv=setInterval(()=>{ die.innerHTML=dieHTML(1+Math.floor(Math.random()*6)); },75); rollIvs.push(iv);
    T(()=>{ clearInterval(iv); die.classList.remove('rolling'); setDie(i,v); },dur);
  }
  function play(k){
    const round=sr.rounds[k], inRound={}; round.forEach(x=>{ inRound[x.i]=1; });
    sub.textContent = k===0 ? 'כל שחקן מטיל קובייה — המספר הגבוה ביותר פותח'
      : 'תיקו! '+round.map(x=>nameOf(x.i)).join(' · ')+' מטילים שוב';
    Object.keys(rows).forEach(i=>{ rows[i].row.classList.toggle('idle',!inRound[i]); rows[i].row.classList.remove('tie'); });
    try{ SFX.dice(); }catch(e){}
    round.forEach((x,j)=>tumble(x.i,x.v,750+j*170));
    const settle=750+(round.length-1)*170+350;
    T(()=>{
      if(k+1<sr.rounds.length){
        sr.rounds[k+1].forEach(x=>rows[x.i].row.classList.add('tie'));
        T(()=>play(k+1),1500);
      } else T(finish,900);
    },settle);
  }
  $('#rSkip').onclick=finish;
  T(()=>play(0),450);
}
function closeStartRoll(){
  stopStartRoll();                 /* removes the overlay and — as a side effect — drops ST.hold */
  if(!ST.G) return;
  ST.lastNeed=''; syncUI();
  if(ST.mode!=='local') return;
  const p=ST.G.players[ST.G.turn];
  if(p && p.bot){
    /* a computer player won the roll — keep the board held a moment longer so the win reads as
       "X goes first" before anything moves, instead of the turn jumping on within a poll tick */
    ST.hold=true;
    setTimeout(()=>{ ST.hold=false; scheduleBot(); },1100);
  } else scheduleBot();
}

