/* =========================================================
   12. BOOT
   ========================================================= */
const _render=render;
render=function(t){
  if(!$('#home').classList.contains('hidden')){ renderHero(t); return; }
  _render(t);
};

function paintSound(){
  const b=$('#btnSound'); if(!b) return;
  b.innerHTML = SFX.enabled
    ? '<svg width="19" height="17" viewBox="0 0 19 17" fill="none"><path d="M2 6h3l4-3.5v12L5 11H2z" fill="currentColor"/><path d="M12 5.5a4 4 0 0 1 0 6M14.5 3a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
    : '<svg width="19" height="17" viewBox="0 0 19 17" fill="none" opacity=".55"><path d="M2 6h3l4-3.5v12L5 11H2z" fill="currentColor"/><path d="M12.5 6l5 5M17.5 6l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
}
function boot(){
  cv=$('#board'); heroCv=$('#heroCanvas');
  ctx=cv.getContext('2d');
  resizeCanvas();

  buildExpList(); buildPlayersGrid(); renderOnlinePane(); setMode('local');

  $$('#modeSeg button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  $$('#countSeg button').forEach(b=>b.onclick=()=>{
    playerCount=+b.dataset.n;
    $$('#countSeg button').forEach(x=>x.setAttribute('aria-pressed',x===b));
    buildPlayersGrid();
  });
  $('#startLocal').onclick=startLocalGame;
  $('#rulesExp').querySelector('.exp-head').onclick=()=>{
    const e=$('#rulesExp'); e.dataset.open = e.dataset.open==='1'?'0':'1';
  };

  paintSound();
  $('#btnSound').onclick=()=>{ SFX.unlock(); const on=SFX.toggle(); paintSound();
    if(on&&ST.G) SFX.ambient(); toast(on?'צליל פועל':'צליל כבוי'); };
  document.addEventListener('pointerdown',()=>{ SFX.unlock(); if(ST.G) SFX.ambient(); },{capture:true});
  ['pointerdown','pointermove','wheel','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,kick,{capture:true,passive:true}));
  window.addEventListener('resize',kick);
  document.addEventListener('visibilitychange',kick);
  $('#btnMenu').onclick=openMenu;
  $('#btnLog').onclick=openLog;
  $('#scrim').onclick=closeAllSheets;
  $$('[data-close]').forEach(b=>b.onclick=closeAllSheets);
  $('#actions').addEventListener('click',e=>{
    const b=e.target.closest('.act'); if(b&&!b.disabled) onAction(b.dataset.act);
  });
  { const pref=ls('sidesk'); document.body.classList.toggle('desk', pref==='1' ? true : pref==='0' ? false : autoDesk());
    $('#btnDesk').classList.toggle('on',isDesk());
    $('#btnDesk').onclick=()=>setDesk(!isDesk()); }
  $('#primaryBtn').addEventListener('click',e=>{
    const b=e.currentTarget; if(!b.disabled && b.dataset.act) onAction(b.dataset.act);
  });
  $('#pstrip').addEventListener('click',e=>{
    const c=e.target.closest('.pcard'); if(!c||!ST.G) return;
    const i=+c.dataset.pi, p=ST.G.players[i];
    showInfo(p.name,`<ul>
      <li>נקודות גלויות: <b>${vpPublic(ST.G,i)}</b></li>
      <li>קלפי משאבים ביד: <b>${totalCards(p)}</b></li>
      <li>קלפי פיתוח: <b>${p.dev.length}</b></li>
      <li>אבירים ששוחקו: <b>${p.knights}</b></li>
      <li>הדרך הרצופה הארוכה ביותר: <b>${p.roadLen||0}</b></li>
      <li>נותרו: ${p.settLeft} יישובים · ${p.cityLeft} ערים · ${p.roadsLeft} דרכים</li>
    </ul>`);
  });

  window.addEventListener('resize',()=>{
    resizeCanvas();
    if(ST.B) fitNow();
    if(ST.G) drawHand();
  });
  window.addEventListener('orientationchange',()=>setTimeout(()=>{
    resizeCanvas(); if(ST.B) fitNow();
  },250));

  $$('#targetSeg button').forEach(b=>{ b.onclick=()=>{
    sel.target=+b.dataset.t;
    $$('#targetSeg button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
  }; });
  $$('#langSw button').forEach(b=>{ b.onclick=()=>{ if(b.dataset.l!==LANG) setLang(b.dataset.l); }; });
  setLang(LANG,true);
  /* the fonts live inside this file; once they are decoded, repaint the canvas-drawn card faces
     that may have been painted a moment earlier with a fallback font */
  try{ if(document.fonts && document.fonts.load){
    Promise.all(['400 12px Heebo','700 12px Heebo','800 12px Heebo','900 12px Heebo',
      '500 12px "Frank Ruhl Libre"','700 12px "Frank Ruhl Libre"','900 12px "Frank Ruhl Libre"'].map(f=>document.fonts.load(f,'אבג Abc')))
      .then(()=>{ for(const k in CARD_ART) delete CARD_ART[k]; if(ST.G){ drawHand(); drawStrip(); } }).catch(()=>{});
  } }catch(e){}
  initPointer();
  startLoop();
  initNet();
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot);
else boot();

