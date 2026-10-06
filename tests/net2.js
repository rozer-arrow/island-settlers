/* two devices, one shared fake room store: does each device see the first roll's dice? */
const fs=require('fs');const {JSDOM}=require('jsdom');
let html=fs.readFileSync(process.argv[2]||require('path').join(__dirname,'..','island.html'),'utf8');
html=html.replace('\n})();\n</script>','\nwindow.__dbg={ST,currentNeed,onAction,tapPlace,createRoom,joinRoom,get lobby(){return lobby;},hostStart,leaveGame,get lastRollSeen(){return lastRollSeen;}};\n})();\n</script>');
function stubCtx(){ const g={addColorStop(){}}; return new Proxy({},{get(t,k){ if(k==='createLinearGradient'||k==='createRadialGradient'||k==='createPattern')return ()=>g; if(k==='measureText')return ()=>({width:10}); if(k in t)return t[k]; return (typeof k==='string')?function(){}:undefined; },set(t,k,v){t[k]=v;return true;}}); }
const store={}, subs={};
const lat=()=>new Promise(r=>setTimeout(r,3+Math.random()*12));
function mkDB(){ return { doc(p){ return {
  async get(){ await lat(); const d=store[p]; return {exists:!!d, data:()=>d?JSON.parse(JSON.stringify(d)):undefined}; },
  async set(o){ await lat(); store[p]=JSON.parse(JSON.stringify(o)); (subs[p]||[]).forEach(cb=>setTimeout(()=>cb({exists:true,data:()=>JSON.parse(JSON.stringify(store[p]))}),3+Math.random()*12)); },
  onSnapshot(cb){ (subs[p]=subs[p]||[]).push(cb); return ()=>{ subs[p]=subs[p].filter(x=>x!==cb); }; },
  async acquire(){ return {acquired:true}; } }; } }; }
function mk(name,uid){
  const errs=[], dice=[];
  const dom=new JSDOM(html,{runScripts:'dangerously',url:'https://ex.com/',beforeParse(w){ w.__noRollUI=true; const st=w.setTimeout.bind(w);
    w.setTimeout=(fn,ms,...a)=>st(fn,Math.max(1,(ms||0)/10),...a); const si=w.setInterval.bind(w); w.setInterval=(fn,ms)=>si(fn,Math.max(5,ms/10));
    w.requestAnimationFrame=cb=>st(()=>cb(w.performance.now()),4); w.cancelAnimationFrame=()=>{};
    w.localStorage.setItem('siname',name); w.localStorage.setItem('sigender','m');
    w.claude={use:async k=>k==='db'?mkDB():{id:async()=>uid}}; w.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
    w.onerror=(m,s,l,c,e)=>errs.push(String(e&&e.stack||m).slice(0,300)); w.console.error=(...a)=>errs.push(a.join(' ').slice(0,300)); }});
  const w=dom.window;
  setTimeout(()=>{ new w.MutationObserver(()=>{ const s=w.document.querySelector('#diceLayer .dice-sum'); if(s) dice.push(+s.textContent); }).observe(w.document.querySelector('#diceLayer'),{childList:true,subtree:true}); },50);
  return {w,errs,dice,d:()=>w.__dbg,name};
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const A=mk('רועי','uA'), Bc=mk('דני','uB'); await sleep(300);
  if(process.env.PRIOR){ /* device A played a local game first in the same page */
    const w=A.w, d=A.d(); w.document.querySelector('#startLocal').click(); await sleep(50); const ig=w.document.querySelector('#introGo'); if(ig) ig.click();
    let n=0, g2=0; while(n<6 && g2++<2000){ const G=d.ST.G, nd=d.currentNeed(G), p=G.players[nd.who];
      if(!p.bot){ const cu=w.document.querySelector('#curtain button'); if(cu) cu.click();
        if((nd.kind==='setupS'||nd.kind==='setupR') && d.ST.place){ d.tapPlace(d.ST.place.legal[0]); d.onAction('confirmplace'); }
        else if(nd.kind==='roll' && !d.ST.busy){ d.onAction('roll'); n++; }
        else if(nd.kind==='main') d.onAction('end');
        else if(nd.kind==='discard'||nd.kind==='robber'||nd.kind==='steal'){ break; } }
      await sleep(30); }
    console.log('local rolls on A:',n,'lastRollSeen A =',d.lastRollSeen); d.leaveGame(); await sleep(100); A.dice.length=0; }
  await A.d().createRoom(); await sleep(150);
  const code=Object.keys(store)[0].split('/')[1];
  await Bc.d().joinRoom(code); await sleep(300);
  await A.d().hostStart(A.d().lobby); await sleep(500);
  const cls=[A,Bc]; let guard=0, rolled=0, rollsBy=[];
  while(guard++<3000){
    const G=A.d().ST.G; if(!G){ await sleep(20); continue; }
    let acted=false;
    for(const c of cls){ const S=c.d().ST, g=S.G; if(!g) continue; const nd=c.d().currentNeed(g);
      if(nd.who!==S.meIdx || S.busy) continue;
      if((nd.kind==='setupS'||nd.kind==='setupR') && S.place && S.place.legal.length){ c.d().tapPlace(S.place.legal[0]); c.d().onAction('confirmplace'); acted=true; }
      else if(nd.kind==='roll'){ c.d().onAction('roll'); rolled++; rollsBy.push(c.name); acted=true; }
      else if(nd.kind==='main'){ if(rolled>=4){ guard=1e9; break; } c.d().onAction('end'); acted=true; }
      else if(nd.kind==='discard'||nd.kind==='robber'||nd.kind==='steal'){ guard=1e9; break; }
    }
    await sleep(acted?120:20);
  }
  await sleep(600);
  console.log('rolls by:',rollsBy.join(','));
  console.log('A saw dice:',A.dice.join(','),' B saw dice:',Bc.dice.join(','));
  console.log('rollId',A.d().ST.G.rollId,Bc.d().ST.G.rollId,'lastRollSeen',A.d().lastRollSeen,Bc.d().lastRollSeen);
  console.log('errors A:',[...new Set(A.errs)].slice(0,3),'B:',[...new Set(Bc.errs)].slice(0,3));
  process.exit(0);
})();
