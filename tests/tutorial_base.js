/* The basic-rules demo game (the one behind the "?" under "תקציר חוקים"), and the explanation text of the
   expansions that the computer changes touch.
   usage: node tests/tutorial_base.js
   1. the demo button sits at the bottom of the rules summary and starts the demo
   2. the demo can be played from the first step to the last
   3. every new text has an English translation */
const fs=require('fs');const {JSDOM}=require('jsdom');
let html=fs.readFileSync(process.env.GAME||require('path').join(__dirname,'..','island.html'),'utf8');
function inject(from,to){ if(html.indexOf(from)<0){ console.error('FAIL: cannot find in game: '+from); process.exit(2); } html=html.replace(from,to); }
inject('\n})();\n</script>','\nwindow.__dbg={ST,TUTS,EXPANSIONS,startTutorial,tutNext,tutCheck,onAction,buildRoad,buildSettlement,moveRobber,trStr,setLang:l=>{LANG=l;}};\n})();\n</script>');

function stubCtx(){ const g={addColorStop(){}};
  return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g;
    if(k==='measureText')return ()=>({width:10}); if(k==='getImageData')return ()=>({data:new Uint8ClampedArray(4)});
    if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const errs=[];
const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',pretendToBeVisual:false,beforeParse(w){
  w.__noRollUI=true;
  const st=w.setTimeout.bind(w);
  w.setTimeout=(fn,ms,...a)=>st(fn,Math.min(ms||0,1),...a);
  w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()+1e7),8); w.cancelAnimationFrame=()=>{};
  w.claude={use:async()=>null}; w.AudioContext=undefined; w.webkitAudioContext=undefined;
  w.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
  w.onerror=(m,s,l,c,e)=>errs.push(String(e&&e.stack||m).slice(0,300));
  w.console.error=(...a)=>errs.push(a.map(String).join(' ').slice(0,300));
}});
const w=dom.window, sleep=ms=>new Promise(r=>setTimeout(r,ms));
let failed=0; const ok=(c,msg)=>{ console.log((c?'  ✓ ':'  ✗ ')+msg); if(!c) failed++; };
const HEB=/[֐-׿]/;
/* the text nodes of an HTML fragment, in English: none may still contain Hebrew */
function untranslated(d,fragment){
  return fragment.split(/<[^>]*>/).map(s=>s.trim()).filter(s=>HEB.test(s)).filter(s=>HEB.test(d.trStr(s)));
}

(async()=>{
  await sleep(400); const d=w.__dbg, doc=w.document;

  console.log('1. the demo button at the bottom of the rules');
  const btn=doc.querySelector('#rulesExp [data-starttut="base"]');
  ok(!!btn,'the rules summary has a demo-game button');
  const inner=doc.querySelector('#rulesExp .inner');
  ok(!!btn && inner.lastElementChild===btn,'it is the last thing in the rules (at the bottom)');
  btn.click(); await sleep(50);
  ok(!!d.ST.tut && d.ST.tut.def.id==='base' && !!d.ST.G,'tapping it starts the basic-rules demo game');

  console.log('2. playing the demo from start to finish');
  const T=d.ST.tut, G=d.ST.G, B=d.ST.B, total=T.def.steps.length;
  let guard=0, stuck=null;
  while(guard++<60){
    d.tutCheck();
    const st=T.def.steps[T.i]; if(st.final) break;
    const before=T.i; const label='step '+(T.i+1)+'/'+total;
    if(st.next){ if(st.btn) st.btn.fn(); else d.tutNext(); }
    else if(st.spot==='primary' && st.phase==='roll'){
      const pt=st.point(G,B,T); ok(!!(pt&&pt.hexes&&pt.hexes.length),label+': the hex the roll lands on is marked');
      d.onAction('roll'); await sleep(150); }
    else if(st.spot==='road'){ const pt=st.point(G,B,T); ok(!!(pt&&pt.edges&&pt.edges.length),label+': a road spot is marked');
      if(pt) d.buildRoad(G,B,pt.edges[0],false,false); }
    else if(st.spot==='sett'){ const pt=st.point(G,B,T); ok(!!(pt&&pt.verts&&pt.verts.length),label+': a settlement spot is marked');
      if(pt) d.buildSettlement(G,B,pt.verts[0]); }
    else if(st.spot==='primary' && st.phase==='main'){ d.onAction('end'); }
    else if(!st.spot && st.point){ const pt=st.point(G,B,T); ok(!!(pt&&pt.hexes&&pt.hexes.length),label+': a robber hex is marked');
      if(pt) d.moveRobber(G,B,pt.hexes[0],1); }
    d.tutCheck();
    if(T.i<=before){ stuck=label; break; }
  }
  ok(stuck===null,'every step moved on when the player did what it asked'+(stuck?' (stuck at '+stuck+')':''));
  ok(T.def.steps[T.i].final===true,'the demo reached its last step');
  ok(G.players[0].res && Object.values(G.buildings).filter(b=>b.p===0).length>=3,'the player really built a third settlement');
  ok(G.robber!==T.data.robber0 ,'the robber really moved');

  console.log('3. English');
  d.setLang('en');
  const bad=[];
  T.def.steps.forEach((st,i)=>{ untranslated(d,st.t).forEach(s=>bad.push('base step '+(i+1)+': '+s)); if(st.btn) untranslated(d,st.btn.label).forEach(s=>bad.push('base button: '+s)); });
  untranslated(d,T.def.title).forEach(s=>bad.push('base title: '+s));
  ['למשחק אמיתי','בחרו שחקנים והתחילו'].forEach(s=>{ if(HEB.test(d.trStr(s))) bad.push('label: '+s); });
  const sea=d.EXPANSIONS.find(e=>e.id==='seafarers');
  untranslated(d,sea.body).forEach(s=>bad.push('seafarers explanation: '+s));
  const seaTut=d.TUTS.seafarers.steps; untranslated(d,seaTut[seaTut.length-1].t).forEach(s=>bad.push('seafarers demo, last step: '+s));
  untranslated(d,inner.innerHTML).forEach(s=>bad.push('rules summary: '+s));
  ok(bad.length===0,'every new or changed text is translated'+(bad.length?'\n      '+bad.slice(0,8).join('\n      '):''));
  d.setLang('he');

  ok(errs.length===0,'no errors'+(errs.length?': '+[...new Set(errs)].slice(0,3).join(' | '):''));
  console.log(failed?'FAILED: '+failed:'all good');
  process.exit(failed?1:0);
})();
