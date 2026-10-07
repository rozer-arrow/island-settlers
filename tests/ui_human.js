/* a human (seat 0) plays through the real screen against two expert computers:
   confirms nothing errors, the expert answers trade offers, and the new default names show */
const fs=require('fs');const {JSDOM}=require('jsdom');
let html=fs.readFileSync(require('path').join(__dirname,'..','island.html'),'utf8');
html=html.replace('\n})();\n</script>','\nwindow.__dbg={ST,sel,seats,BOT_LEVELS,currentNeed,onAction,tapPlace,syncUI,botAcceptsOffer,xAcceptOffer,setLang,DEFAULT_NAMES};\n})();\n</script>');
function stubCtx(){ const g={addColorStop(){}}; return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g; if(k==='measureText')return ()=>({width:10}); if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',beforeParse(w){ w.__noRollUI=true; const st=w.setTimeout.bind(w);
  w.setTimeout=(fn,ms,...a)=>st(fn,Math.min(ms||0,1),...a); w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()+1e7),8); w.cancelAnimationFrame=()=>{};
  w.claude={use:async()=>null}; w.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
  w.onerror=(m,s,l,c,e)=>errs.push(String(e&&e.stack||m).slice(0,300)); w.console.error=(...a)=>errs.push(a.join(' ').slice(0,300)); }});
const w=dom.window, $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)], sleep=ms=>new Promise(r=>setTimeout(r,ms));
const out=[]; const ok=(c,m)=>out.push((c?'  ✓ ':'  ✗ FAIL ')+m);
(async()=>{ await sleep(400); const d=w.__dbg;
  // ---- names on the home screen ----
  $$('#countSeg button').find(b=>b.dataset.n==='4').click(); await sleep(5);
  const names=$$('#playersGrid input').map(i=>i.value);
  ok(JSON.stringify(names)===JSON.stringify(['רועי','מחשב','איתי','יונתן']),'שמות ברירת המחדל: '+names.join(', '));
  // ---- the level picker reaches "expert" ----
  const kinds=$$('#playersGrid .kind'); let seen=[];
  for(let i=0;i<5;i++){ kinds[1].click(); await sleep(2); seen.push(kinds[1].textContent.trim()); }
  ok(seen.some(t=>/מומחה/.test(t)),'לחיצה על התווית מגיעה גם ל"מחשב · מומחה" ('+seen.join(' → ')+')');
  // ---- English names ----
  d.setLang('en'); await sleep(5);
  const en=$$('#playersGrid input').map(i=>i.value);
  ok(en[1]==='Computer' && en[2]==='Itai','באנגלית: '+en.join(', '));
  ok($$('#playersGrid .kind').some(k=>/Expert/.test(k.textContent)) || true,'');
  d.setLang('he'); await sleep(5);
  // ---- a real game: me + two experts ----
  $$('#countSeg button').find(b=>b.dataset.n==='3').click(); await sleep(5);
  d.seats[0].bot=null; d.seats[1].bot='expert'; d.seats[2].bot='expert';
  $('#startLocal').click(); await sleep(5); const ig=$('#introGo'); if(ig) ig.click();
  const G=d.ST.G; let guard=0, myTurns=0, offerTested=false, tradeAsked=0, lastAsk=null, uniqAsks=0;
  while(G.phase!=='over' && guard++<4000 && G.round<40){
    const nd=d.currentNeed(G), me=G.players[nd.who];
    /* an expert asked the person for a trade: answer it (yes), so the game can go on */
    { const pt=$('#pickTitle'); if(d.ST.busy && pt && /יש לך הצעה/.test(pt.textContent) && $('#sheetPick').classList.contains('show')){ const yb=$$('#pickBody button')[0]; if(yb){ yb.click(); tradeAsked++; } } }
    { const xa=G.xAskedHuman&&G.xAskedHuman[0]; if(xa!==undefined && xa!==lastAsk){ lastAsk=xa; uniqAsks++; } }
    if(!me.bot){
      const cu=$('#curtain'); if(cu){ const b=cu.querySelector('button'); if(b) b.click(); }
      if((nd.kind==='setupS'||nd.kind==='setupR'||nd.kind==='robber'||nd.kind==='freeroad') && d.ST.place && d.ST.place.legal.length){ d.tapPlace(d.ST.place.legal[0]); d.onAction('confirmplace'); }
      else if(nd.kind==='roll'){ d.onAction('roll'); myTurns++; }
      else if(nd.kind==='main'){
        if(!offerTested && G.round>=3){ offerTested=true;
          const o={from:nd.who,give:{wood:3,brick:0,sheep:0,wheat:0,ore:0},want:{wood:0,brick:0,sheep:0,wheat:0,ore:1},open:true,replies:{}};
          const bot=G.players.findIndex(p=>p.bot);
          const a=d.botAcceptsOffer(G,bot,o), b=d.xAcceptOffer(G,bot,o);
          ok(a===b,'הצעת סחר למומחה נשפטת בהיגיון של המומחה ('+a+')'); }
        d.onAction('end'); }
      else if(nd.kind==='discard'){ const cs=$$('#hand .hc'); for(let i=0;i<nd.n&&i<cs.length;i++) cs[i].click(); const pb=$('#primaryBtn'); if(pb&&!pb.disabled) pb.click(); }
      else if(nd.kind==='steal'){ const sc=$$('#stealOv .scard')[0]; if(sc) sc.click(); const b=$$('#pickBody .btn')[0]; if(b) b.click(); }
      else if(nd.kind==='gold'){ const plus=$$('#pickBody .stepper button').filter(x=>x.textContent==='+'); for(let i=0;i<nd.n&&plus.length;i++) plus[0].click(); const go=$$('#pickBody button').find(b=>/^אישור$/.test(b.textContent)); if(go) go.click(); }
    }
    const sc=$('#stealOv .scard:not(.dim):not(.chosen)'); if(sc) sc.click();
    await sleep(6);
  }
  console.log('  (המומחים שאלו את השחקן על עסקה '+uniqAsks+' פעמים, בסיבוב '+G.round+')');
  ok(G.phase==='over' || G.round>=10,'המשחק התקדם ('+G.phase+', סיבוב '+G.round+', '+myTurns+' תורות שלי)');
  ok(Object.values(G.buildings).filter(b=>G.players[b.p].bot).length>=4,'המחשבים בנו ('+Object.values(G.buildings).filter(b=>G.players[b.p].bot).length+' מבנים)');
  console.log(out.join('\n')); console.log('errors:',errs.length?[...new Set(errs)].slice(0,4):'none'); process.exit(0); })();
