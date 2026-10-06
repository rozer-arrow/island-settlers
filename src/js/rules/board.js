/* =========================================================
   2. HEX GEOMETRY + BOARD GENERATION
   ========================================================= */
const HDIR=[{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}];
const hexKey=(q,r)=>q+','+r;
function hexCenter(q,r){ return {x:SQ3*(q+r/2), y:1.5*r}; }
function hexCorner(c,i){ const a=(Math.PI/180)*(60*i-30); return {x:c.x+Math.cos(a), y:c.y+Math.sin(a)}; }
const vKey=p=>Math.round(p.x*1000)+':'+Math.round(p.y*1000);

function hexRows(rows){
  const out=[], mid=(rows.length-1)/2;
  rows.forEach((L,i)=>{ const r=i-mid, qs=Math.round(-(L-1)/2 - r/2);
    for(let k=0;k<L;k++) out.push({q:qs+k,r}); });
  return out;
}

/* Seafarers scenario: classic island + two outlying islands */
const SEAFARERS_LAND = [
  ...hexRows([3,4,5,4,3]),
  {q:4,r:-2},{q:5,r:-2},{q:4,r:-1},{q:5,r:-3},
  {q:-5,r:2},{q:-4,r:2},{q:-5,r:3},{q:-4,r:1}
];

/* Seafarers: a brand-new archipelago every game — one big island plus several
   small ones, each separated from the others by at least one sea hex */
function hexDist(a,b){ const dq=a.q-b.q, dr=a.r-b.r; return (Math.abs(dq)+Math.abs(dr)+Math.abs(dq+dr))/2; }
function genArchipelago(players,rnd){
  const big=players>=5, R=big?6:5, total=big?38:28;
  const key=c=>c.q+','+c.r;
  for(let attempt=0; attempt<400; attempt++){
    const nSmall=(big?4:3)+Math.floor(rnd()*2);
    const mainSize=Math.round(total*(0.42+rnd()*0.08));
    const sizes=[]; for(let i=0;i<nSmall;i++) sizes.push(2);
    let rest=total-mainSize-2*nSmall, guard=0;
    if(rest<0) continue;
    while(rest>0 && guard++<600){ const i=Math.floor(rnd()*nSmall); if(sizes[i]<6){ sizes[i]++; rest--; } }
    if(rest>0) continue;
    const owner={}, isl=[[]];                       /* island 0 = the big one */
    const touchesOther=(c,me)=>HDIR.some(d=>{ const o=owner[key({q:c.q+d.q,r:c.r+d.r})]; return o!==undefined && o!==me; });
    const grow=(me,start,size)=>{
      owner[key(start)]=me; isl[me]=[start];
      while(isl[me].length<size){
        const cand={};
        isl[me].forEach(m=>HDIR.forEach(d=>{
          const c={q:m.q+d.q,r:m.r+d.r}, k=key(c);
          if(owner[k]!==undefined) return;
          if(hexDist(c,{q:0,r:0})>R) return;
          if(touchesOther(c,me)) return;
          cand[k]=cand[k]||{c,w:0}; cand[k].w+=1;    /* more touching neighbours = more compact */
        }));
        const list=Object.values(cand); if(!list.length) return false;
        const tot=list.reduce((a,x)=>a+x.w*x.w,0); let r=rnd()*tot, pick=list[0];
        for(const x of list){ r-=x.w*x.w; if(r<=0){ pick=x; break; } }
        owner[key(pick.c)]=me; isl[me].push(pick.c);
      }
      return true;
    };
    if(!grow(0,{q:Math.floor(rnd()*3)-1,r:Math.floor(rnd()*3)-1},mainSize)) continue;
    let ok=true;
    for(let i=0;i<nSmall && ok;i++){
      const me=i+1, all=[]; isl.forEach(a=>a.forEach(c=>all.push(c)));
      const cents=isl.map(a=>({q:a.reduce((x,c)=>x+c.q,0)/a.length, r:a.reduce((x,c)=>x+c.r,0)/a.length}));
      let best=null,bs=-1;
      for(let t=0;t<14;t++){
        /* a spot 2-3 hexes from existing land, spread away from the other islands */
        const c={q:Math.floor(rnd()*(2*R+1))-R, r:Math.floor(rnd()*(2*R+1))-R};
        if(hexDist(c,{q:0,r:0})>R || owner[key(c)]!==undefined || touchesOther(c,me)) continue;
        const dl=Math.min(...all.map(o=>hexDist(c,o)));
        if(dl<2||dl>3) continue;
        const sp=Math.min(...cents.map(o=>hexDist(c,o)));
        if(sp>bs){ bs=sp; best=c; }
      }
      if(!best){ ok=false; break; }
      ok=grow(me,best,sizes[i]);
    }
    if(!ok) continue;
    const coords=[], comp=[];
    isl.forEach((a,i)=>a.forEach(c=>{ coords.push({q:c.q,r:c.r}); comp.push(i); }));
    return {coords,comp};
  }
  return null;
}

/* number tokens: classic distribution, stretched to any tile count */
function tokenPool(n){
  const base=[5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11];
  const extra=[2,12,5,9,4,10,6,8,3,11,5,9,4,10,6,8,3,11];
  const out=base.slice(0,Math.min(n,18));
  let i=0; while(out.length<n){ out.push(extra[i%extra.length]); i++; }
  return out;
}

function terrainPool(n,useGold){
  const deserts = n>=28?2:1;
  const golds   = useGold ? (n>=24?3:2) : 0;
  const land    = n-deserts;
  const weights = [['forest',4],['fields',4],['pasture',4],['hills',3],['mountains',3]];
  const out=[]; let acc=0;
  weights.forEach((w,i)=>{
    const c = (i===weights.length-1) ? land-acc : Math.round(land*w[1]/18);
    acc+=c; for(let k=0;k<c;k++) out.push(w[0]);
  });
  for(let g=0; g<golds; g++){
    const counts={}; out.forEach(t=>counts[t]=(counts[t]||0)+1);
    let bt=null,bc=-1; for(const t in counts) if(counts[t]>bc){bc=counts[t];bt=t;}
    out[out.indexOf(bt)]='gold';
  }
  for(let k=0;k<deserts;k++) out.push('desert');
  return out;
}

function buildBoard(cfg, seed){
  const rnd = mulberry32(seed);
  const arch = cfg.seafarers ? genArchipelago(cfg.players,rnd) : null;   /* null => fall back to the fixed map */
  const landCoords = cfg.seafarers ? (arch ? arch.coords : SEAFARERS_LAND.slice())
                   : hexRows(cfg.players>=5 ? [3,4,5,6,5,4,3] : [3,4,5,4,3]);
  /* every island needs at least one hex that actually produces something */
  const islandsOk = list => { if(!arch) return true;
    const has={}; list.forEach((h,i)=>{ if(h.terrain!=='desert') has[arch.comp[i]]=1; });
    return Object.keys(has).length===Math.max(...arch.comp)+1; };

  /* --- assign terrain & numbers, retry until the layout is acceptable --- */
  const n=landCoords.length;
  let hexes=null;
  for(let attempt=0; attempt<400; attempt++){
    const terr = shuffleSeeded(terrainPool(n, cfg.gold||cfg.seafarers), rnd);
    const producing = terr.filter(t=>t!=='desert').length;
    const nums = shuffleSeeded(tokenPool(producing), rnd);
    let ni=0;
    const list = landCoords.map((c,i)=>({
      id:hexKey(c.q,c.r), q:c.q, r:c.r, terrain:terr[i],
      num: terr[i]==='desert'? null : nums[ni++],
      ...hexCenter(c.q,c.r)
    }));
    if(islandsOk(list) && (!cfg.balanced || layoutOk(list))){ hexes=list; break; }
  }
  if(!hexes){ /* fallback: accept whatever */
    const terr = shuffleSeeded(terrainPool(n, cfg.gold||cfg.seafarers), rnd);
    const nums = shuffleSeeded(tokenPool(terr.filter(t=>t!=='desert').length), rnd); let ni=0;
    hexes = landCoords.map((c,i)=>({id:hexKey(c.q,c.r),q:c.q,r:c.r,terrain:terr[i],
      num:terr[i]==='desert'?null:nums[ni++],...hexCenter(c.q,c.r)}));
  }

  const hexById={}; hexes.forEach(h=>hexById[h.id]=h);

  /* --- the sea around the land (one ring), plus any enclosed pockets of water --- */
  const sea=[];
  const seen={};
  hexes.forEach(h=>HDIR.forEach(d=>{
    const k=hexKey(h.q+d.q,h.r+d.r);
    if(!hexById[k] && !seen[k]){ seen[k]=1;
      sea.push({id:k,q:h.q+d.q,r:h.r+d.r,...hexCenter(h.q+d.q,h.r+d.r)}); }
  }));
  if(cfg.seafarers){
    /* fill lakes: any water cell that the outside cannot reach without crossing land/ring */
    const inSet={}; hexes.forEach(h=>inSet[h.id]=1); sea.forEach(h=>inSet[h.id]=1);
    let ext=0; hexes.forEach(h=>{ ext=Math.max(ext,hexDist({q:h.q,r:h.r},{q:0,r:0})); });
    const RR=ext+3, outside={}, stack=[hexKey(RR,0)];
    outside[hexKey(RR,0)]=1;
    while(stack.length){
      const [cq,cr]=stack.pop().split(',').map(Number);
      HDIR.forEach(d=>{ const q=cq+d.q, r=cr+d.r, k=hexKey(q,r);
        if(outside[k]||inSet[k]||hexDist({q,r},{q:0,r:0})>RR) return;
        outside[k]=1; stack.push(k); });
    }
    for(let q=-RR;q<=RR;q++) for(let r=-RR;r<=RR;r++){
      const k=hexKey(q,r);
      if(hexDist({q,r},{q:0,r:0})>RR || inSet[k] || outside[k]) continue;
      sea.push({id:k,q,r,...hexCenter(q,r)}); inSet[k]=1;
    }
  }
  const seaById={}; sea.forEach(h=>seaById[h.id]=h);
  /* second ring, purely decorative */
  const sea2=[]; const seen2={};
  sea.forEach(h=>HDIR.forEach(d=>{
    const k=hexKey(h.q+d.q,h.r+d.r);
    if(!hexById[k] && !seaById[k] && !seen2[k]){ seen2[k]=1;
      sea2.push({id:k,q:h.q+d.q,r:h.r+d.r,...hexCenter(h.q+d.q,h.r+d.r)}); }
  }));

  /* --- vertices & edges ---
     In Seafarers the graph spans the water too, so ships can cross
     between islands. `hexes` on a vertex/edge always lists LAND hexes
     only: 2 land hexes = inland edge, 1 = shoreline, 0 = open water. */
  const verts={}, edges={};
  const graphHexes = cfg.seafarers ? hexes.concat(sea) : hexes;
  graphHexes.forEach(h=>{
    const isLand=!!hexById[h.id];
    const c={x:h.x,y:h.y}, ids=[];
    for(let i=0;i<6;i++){
      const p=hexCorner(c,i), k=vKey(p);
      if(!verts[k]) verts[k]={id:k,x:p.x,y:p.y,hexes:[],adj:[],port:null};
      if(isLand && verts[k].hexes.indexOf(h.id)<0) verts[k].hexes.push(h.id);
      ids.push(k);
    }
    for(let i=0;i<6;i++){
      const a=ids[i], b=ids[(i+1)%6];
      const ek = a<b ? a+'|'+b : b+'|'+a;
      if(!edges[ek]) edges[ek]={id:ek,v:[a<b?a:b,a<b?b:a],hexes:[],
        x:(verts[a].x+verts[b].x)/2, y:(verts[a].y+verts[b].y)/2};
      if(isLand && edges[ek].hexes.indexOf(h.id)<0) edges[ek].hexes.push(h.id);
      if(verts[a].adj.indexOf(b)<0) verts[a].adj.push(b);
      if(verts[b].adj.indexOf(a)<0) verts[b].adj.push(a);
    }
  });

  /* --- islands (connected components of land) --- */
  const islandOf={}; let island=0;
  hexes.forEach(h=>{
    if(islandOf[h.id]!==undefined) return;
    const stack=[h.id]; islandOf[h.id]=island;
    while(stack.length){ const cur=hexById[stack.pop()];
      HDIR.forEach(d=>{ const k=hexKey(cur.q+d.q,cur.r+d.r);
        if(hexById[k] && islandOf[k]===undefined){ islandOf[k]=island; stack.push(k); } });
    }
    island++;
  });
  const sizes={}; Object.keys(islandOf).forEach(k=>sizes[islandOf[k]]=(sizes[islandOf[k]]||0)+1);
  let mainIsland=0,best=-1; Object.keys(sizes).forEach(k=>{ if(sizes[k]>best){best=sizes[k];mainIsland=+k;} });

  /* --- harbours: a different arrangement every game --- */
  const cx = hexes.reduce((s,h)=>s+h.x,0)/hexes.length;
  const cy = hexes.reduce((s,h)=>s+h.y,0)/hexes.length;
  const coastal = Object.values(edges).filter(e=>e.hexes.length===1);
  const portTypes = shuffleSeeded(
    cfg.players>=5 ? ['any','any','any','any','any','wood','brick','sheep','wheat','ore','sheep']
                   : ['any','any','any','any','wood','brick','sheep','wheat','ore'], rnd);
  const np=portTypes.length;
  let chosen=[];
  if(!cfg.seafarers){
    /* one continuous coast: uneven gaps, so harbours bunch up in some places and are rare in others */
    coastal.sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
    const L=coastal.length, gaps=[];
    for(let i=0;i<np;i++) gaps.push(Math.floor((i+1)*L/np)-Math.floor(i*L/np));
    for(let t=0;t<np*3;t++){
      const i=Math.floor(rnd()*np), j=Math.floor(rnd()*np);
      if(i!==j && gaps[i]>2 && gaps[j]<5){ gaps[i]--; gaps[j]++; }
    }
    let idx=Math.floor(rnd()*L);
    for(let i=0;i<np;i++){ chosen.push(coastal[idx%L]); idx+=gaps[i]; }
  } else {
    /* an archipelago: scatter harbours over every island's coast, never touching each other */
    const share=(a,b)=>a.v[0]===b.v[0]||a.v[0]===b.v[1]||a.v[1]===b.v[0]||a.v[1]===b.v[1];
    let minD=2.6;
    for(let attempt=0; attempt<80; attempt++){
      const order=shuffleSeeded(coastal.slice(),rnd), picked=[];
      for(const e of order){
        if(picked.length>=np) break;
        if(picked.every(q=>!share(e,q) && Math.hypot(e.x-q.x,e.y-q.y)>=minD)) picked.push(e);
      }
      if(picked.length>=np || attempt===79){ chosen=picked; break; }
      minD*=0.965;
    }
  }
  const ports=[];
  chosen.forEach((e,i)=>{
    const h=hexById[e.hexes[0]];
    const nx=e.x-h.x, ny=e.y-h.y, Ln=Math.hypot(nx,ny)||1;     /* straight out of the coast */
    ports.push({edge:e.id, type:portTypes[i], v:e.v.slice(),
      x:e.x, y:e.y, nx:nx/Ln, ny:ny/Ln, ang:Math.atan2(ny,nx)});
    e.v.forEach(vid=>{ verts[vid].port = verts[vid].port || portTypes[i]; });
  });

  /* where the pirate ship starts: open water next to some coast */
  let pirate=null;
  if(cfg.seafarers){
    const near=sea.filter(h=>HDIR.some(d=>hexById[hexKey(h.q+d.q,h.r+d.r)]));
    const pool=near.length?near:sea;
    pirate=pool[Math.floor(rnd()*pool.length)].id;
  }

  /* --- the wooden frame: one ring of sea tiles around everything,
         and the outline of that whole shape --- */
  const frameHexes = hexes.concat(sea);
  const inFrame={}; frameHexes.forEach(h=>inFrame[hexKey(h.q,h.r)]=1);
  const EDIR=[{q:1,r:0},{q:0,r:1},{q:-1,r:1},{q:-1,r:0},{q:0,r:-1},{q:1,r:-1}];
  const frameEdges=[];
  frameHexes.forEach(h=>{
    const c={x:h.x,y:h.y};
    for(let i=0;i<6;i++){
      const d=EDIR[i];
      if(inFrame[hexKey(h.q+d.q,h.r+d.r)]) continue;
      const a=hexCorner(c,i), b=hexCorner(c,(i+1)%6);
      frameEdges.push({ax:a.x,ay:a.y,bx:b.x,by:b.y});
    }
  });

  /* --- bounds for camera fitting --- */
  let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
  frameHexes.forEach(h=>{ minX=Math.min(minX,h.x-1);maxX=Math.max(maxX,h.x+1);
    minY=Math.min(minY,h.y-1);maxY=Math.max(maxY,h.y+1); });

  const desert = hexes.find(h=>h.terrain==='desert');
  return {hexes,hexById,sea,seaById,sea2,verts,edges,ports,islandOf,mainIsland,pirate,
    frameHexes,frameEdges,
    bounds:{minX,maxX,minY,maxY},robber: desert? desert.id : hexes[0].id,
    seed, seafarers:!!cfg.seafarers};
}

const anyHex=(B,id)=>B.hexById[id]||(B.seaById&&B.seaById[id])||null;

/* layout quality: no two red numbers touching, no vertex with 3 hot numbers */
function layoutOk(list){
  const by={}; list.forEach(h=>by[hexKey(h.q,h.r)]=h);
  const hot=n=>n===6||n===8;
  for(const h of list){
    if(!hot(h.num)) continue;
    for(const d of HDIR){ const n=by[hexKey(h.q+d.q,h.r+d.r)]; if(n&&hot(n.num)) return false; }
  }
  /* avoid a single corner touching three strong numbers */
  const strong=n=>[5,6,8,9].indexOf(n)>=0;
  const cnt={};
  list.forEach(h=>{ const c={x:h.x,y:h.y};
    for(let i=0;i<6;i++){ const k=vKey(hexCorner(c,i));
      if(strong(h.num)) cnt[k]=(cnt[k]||0)+1; }});
  for(const k in cnt) if(cnt[k]>=3) return false;
  return true;
}

