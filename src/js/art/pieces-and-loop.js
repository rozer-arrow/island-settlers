/* =============== HARBOURS =============== */
function drawPorts(B,t){
  const S=view.scale;
  for(const pt of B.ports){
    const a=toScreen(B.verts[pt.v[0]].x,B.verts[pt.v[0]].y);
    const b=toScreen(B.verts[pt.v[1]].x,B.verts[pt.v[1]].y);
    const m=toScreen(pt.x,pt.y);
    const px=m.x+pt.nx*S*0.80, py=m.y+pt.ny*S*0.80;

    /* ripples rolling out from the jetty */
    for(let i=0;i<3;i++){
      const k=((t*0.55+i/3)%1);
      ctx.globalAlpha=(1-k)*0.34;
      ctx.strokeStyle='#CFEFFB'; ctx.lineWidth=Math.max(1,S*0.022);
      ctx.beginPath(); ctx.ellipse(px,py+S*0.10,S*(0.18+k*0.5),S*(0.07+k*0.20),0,0,TAU); ctx.stroke();
    }
    ctx.globalAlpha=1;

    /* two jetty planks reaching the shore */
    ctx.strokeStyle='#6B4A2C'; ctx.lineCap='round';
    ctx.lineWidth=Math.max(2,S*0.075);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(px,py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(px,py); ctx.stroke();
    ctx.strokeStyle='#8A6238'; ctx.lineWidth=Math.max(1,S*0.035);
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(px,py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x,b.y); ctx.lineTo(px,py); ctx.stroke();

    /* the boat, bobbing on the swell */
    const bob=Math.sin(t*1.5+pt.ang*2)*S*0.045;
    const roll=Math.sin(t*1.1+pt.ang*2)*0.11;
    ctx.save();
    ctx.translate(px+pt.nx*S*0.34, py+pt.ny*S*0.34+bob);
    ctx.rotate(roll);
    const bs=S*0.30;
    ctx.fillStyle='rgba(255,255,255,.18)';
    ctx.beginPath(); ctx.ellipse(0,bs*0.50,bs*0.95,bs*0.16,0,0,TAU); ctx.fill();
    ctx.fillStyle='#7A4E2B';
    ctx.beginPath(); ctx.moveTo(-bs*0.80,0); ctx.quadraticCurveTo(0,bs*0.62,bs*0.80,0);
    ctx.lineTo(bs*0.62,-bs*0.14); ctx.lineTo(-bs*0.62,-bs*0.14); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#96603A'; ctx.fillRect(-bs*0.66,-bs*0.16,bs*1.32,bs*0.09);
    ctx.strokeStyle='#5A3A20'; ctx.lineWidth=Math.max(1,bs*0.08);
    ctx.beginPath(); ctx.moveTo(0,-bs*0.14); ctx.lineTo(0,-bs*0.95); ctx.stroke();
    ctx.fillStyle='#F2E9D4';
    ctx.beginPath(); ctx.moveTo(bs*0.06,-bs*0.90);
    ctx.quadraticCurveTo(bs*0.70,-bs*0.42,bs*0.08,-bs*0.16); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.12)';
    ctx.beginPath(); ctx.moveTo(bs*0.06,-bs*0.90);
    ctx.quadraticCurveTo(bs*0.34,-bs*0.54,bs*0.08,-bs*0.16); ctx.closePath(); ctx.fill();
    ctx.restore();

    /* the trade sign */
    const r=S*0.235;
    ctx.save(); ctx.translate(px,py);
    ctx.fillStyle='rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(0,S*0.04,r*1.02,0,TAU); ctx.fill();
    const g=ctx.createLinearGradient(0,-r,0,r);
    g.addColorStop(0,'#F0E4C6'); g.addColorStop(1,'#CDB68C');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
    ctx.strokeStyle='#6B4A2C'; ctx.lineWidth=Math.max(1,r*0.16);
    ctx.beginPath(); ctx.arc(0,0,r*0.93,0,TAU); ctx.stroke();
    drawResIcon(ctx,pt.type,0,-r*0.20,r*1.05);
    ctx.fillStyle='#4A3416';
    ctx.font='900 '+Math.round(r*0.62)+'px '+FONT_D;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(pt.type==='any'?'3:1':'2:1',0,r*0.52);
    ctx.restore();
  }
}

/* =============== NUMBER TOKENS =============== */
const FONT_D = "'Frank Ruhl Libre',Georgia,serif";
const FONT_S = "'Heebo',system-ui,sans-serif";
function drawTokens(B,G,t){
  const S=view.scale;
  for(const h of B.hexes){
    if(h.num==null) continue;
    const p=toScreen(h.x,h.y);
    let r=S*0.30;
    const pulse=tokenPulse[h.id];
    let glow=0;
    if(pulse!=null){
      const k=(t-pulse)/1.1;
      if(k>1) delete tokenPulse[h.id];
      else { glow=1-k; r*= 1+Math.sin(Math.min(1,k*2.2)*Math.PI)*0.22; }
    }
    ctx.save(); ctx.translate(p.x,p.y);
    if(glow>0){
      ctx.globalAlpha=glow*0.8;
      ctx.fillStyle='rgba(255,226,150,.55)';
      ctx.beginPath(); ctx.arc(0,0,r*(1.5+(1-glow)*1.2),0,TAU); ctx.fill();
      ctx.globalAlpha=1;
    }
    ctx.fillStyle='rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.arc(0,r*0.13,r,0,TAU); ctx.fill();
    const g=ctx.createLinearGradient(0,-r,0,r);
    g.addColorStop(0,'#F7EEDA'); g.addColorStop(1,'#D9C8A4');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,r,0,TAU); ctx.fill();
    ctx.strokeStyle='rgba(90,64,28,.55)'; ctx.lineWidth=Math.max(1,r*0.07);
    ctx.beginPath(); ctx.arc(0,0,r*0.90,0,TAU); ctx.stroke();
    const hot=(h.num===6||h.num===8);
    ctx.fillStyle= hot?'#B23726':'#33291A';
    ctx.font='900 '+Math.round(r*1.05)+'px '+FONT_D;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(String(h.num),0,-r*0.10);
    const pips=6-Math.abs(7-h.num);
    ctx.fillStyle= hot?'#B23726':'#5A4A30';
    for(let i=0;i<pips;i++){
      ctx.beginPath();
      ctx.arc((i-(pips-1)/2)*r*0.17, r*0.52, r*0.055,0,TAU); ctx.fill();
    }
    ctx.restore();
  }
}

/* =============== ROADS, SHIPS, BUILDINGS =============== */
function colOf(G,i){ const c=PCOLORS.find(c=>c.id===G.players[i].color)||PCOLORS[0]; return c; }

function drawRoads(B,G){
  const S=view.scale;
  for(const eid in G.roads){
    const rd=G.roads[eid], e=B.edges[eid]; if(!e) continue;
    const a=toScreen(B.verts[e.v[0]].x,B.verts[e.v[0]].y);
    const b=toScreen(B.verts[e.v[1]].x,B.verts[e.v[1]].y);
    const c=colOf(G,rd.p);
    if(rd.ship) drawShip(a,b,c,S,T+eid.length);
    else {
      ctx.lineCap='round';
      ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=S*0.165;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      ctx.strokeStyle=c.hex; ctx.lineWidth=S*0.115;
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.28)'; ctx.lineWidth=S*0.035;
      ctx.beginPath(); ctx.moveTo(a.x*0.86+b.x*0.14,a.y*0.86+b.y*0.14-S*0.028);
      ctx.lineTo(a.x*0.14+b.x*0.86,a.y*0.14+b.y*0.86-S*0.028); ctx.stroke();
    }
  }
}
function drawShip(a,b,c,S,t){
  const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
  const ang=Math.atan2(b.y-a.y,b.x-a.x);
  const bob=Math.sin(t*1.7)*S*0.022;
  ctx.save(); ctx.translate(mx,my+bob); ctx.rotate(ang);
  const s=S*0.30;
  ctx.fillStyle='rgba(255,255,255,.22)';
  ctx.beginPath(); ctx.ellipse(0,s*0.30,s*1.0,s*0.14,0,0,TAU); ctx.fill();
  ctx.fillStyle=c.dark;
  ctx.beginPath(); ctx.moveTo(-s*0.85,-s*0.02); ctx.quadraticCurveTo(0,s*0.46,s*0.85,-s*0.02);
  ctx.lineTo(s*0.66,-s*0.20); ctx.lineTo(-s*0.66,-s*0.20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#3A2A18'; ctx.lineWidth=Math.max(1,s*0.07);
  ctx.beginPath(); ctx.moveTo(0,-s*0.20); ctx.lineTo(0,-s*0.92); ctx.stroke();
  ctx.fillStyle=c.hex;
  ctx.beginPath(); ctx.moveTo(s*0.04,-s*0.88);
  ctx.quadraticCurveTo(s*0.62,-s*0.46,s*0.06,-s*0.22); ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.18)';
  ctx.beginPath(); ctx.moveTo(s*0.04,-s*0.88);
  ctx.quadraticCurveTo(s*0.30,-s*0.56,s*0.06,-s*0.22); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawBuildings(B,G,t){
  const S=view.scale;
  const list=Object.keys(G.buildings).sort((a,b)=>B.verts[a].y-B.verts[b].y);
  for(const vid of list){
    const b=G.buildings[vid], v=B.verts[vid], p=toScreen(v.x,v.y), c=colOf(G,b.p);
    const born = buildAnim[vid];
    let k=1;
    if(born!=null){ k=(t-born)/0.45; if(k>=1){ delete buildAnim[vid]; k=1; }
      else k = 1 + Math.sin(Math.min(1,k)*Math.PI)*0.45; }
    ctx.save(); ctx.translate(p.x,p.y); ctx.scale(k,k);
    ctx.fillStyle='rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(0,S*0.10,S*0.22,S*0.08,0,0,TAU); ctx.fill();
    if(b.t==='s') drawHouse(c,S*0.22);
    else drawCity(c,S*0.25,t);
    ctx.restore();
  }
}
function drawHouse(c,s){
  ctx.fillStyle=c.hex;
  ctx.beginPath();
  ctx.moveTo(-s*0.80,s*0.42); ctx.lineTo(-s*0.80,-s*0.22);
  ctx.lineTo(0,-s*0.92); ctx.lineTo(s*0.80,-s*0.22); ctx.lineTo(s*0.80,s*0.42);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.moveTo(0,-s*0.92); ctx.lineTo(s*0.80,-s*0.22);
  ctx.lineTo(s*0.80,s*0.42); ctx.lineTo(0,s*0.42); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(20,12,4,.75)'; ctx.lineWidth=Math.max(1,s*0.13); ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(-s*0.80,s*0.42); ctx.lineTo(-s*0.80,-s*0.22);
  ctx.lineTo(0,-s*0.92); ctx.lineTo(s*0.80,-s*0.22); ctx.lineTo(s*0.80,s*0.42);
  ctx.closePath(); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.moveTo(-s*0.72,-s*0.24); ctx.lineTo(0,-s*0.84); ctx.lineTo(-s*0.10,-s*0.24); ctx.closePath(); ctx.fill();
}
function drawCity(c,s,t){
  ctx.fillStyle=c.hex;
  ctx.beginPath();
  ctx.moveTo(-s*1.05,s*0.42); ctx.lineTo(-s*1.05,-s*0.12); ctx.lineTo(-s*0.45,-s*0.62);
  ctx.lineTo(s*0.15,-s*0.12); ctx.lineTo(s*0.15,-s*0.42);
  ctx.lineTo(s*0.95,-s*0.42); ctx.lineTo(s*0.95,s*0.42);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.moveTo(s*0.15,-s*0.42); ctx.lineTo(s*0.95,-s*0.42);
  ctx.lineTo(s*0.95,s*0.42); ctx.lineTo(s*0.15,s*0.42); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='rgba(20,12,4,.75)'; ctx.lineWidth=Math.max(1,s*0.12); ctx.lineJoin='round';
  ctx.beginPath();
  ctx.moveTo(-s*1.05,s*0.42); ctx.lineTo(-s*1.05,-s*0.12); ctx.lineTo(-s*0.45,-s*0.62);
  ctx.lineTo(s*0.15,-s*0.12); ctx.lineTo(s*0.15,-s*0.42);
  ctx.lineTo(s*0.95,-s*0.42); ctx.lineTo(s*0.95,s*0.42);
  ctx.closePath(); ctx.stroke();
  /* pennant */
  ctx.strokeStyle='rgba(20,12,4,.8)'; ctx.lineWidth=Math.max(1,s*0.08);
  ctx.beginPath(); ctx.moveTo(s*0.55,-s*0.42); ctx.lineTo(s*0.55,-s*1.05); ctx.stroke();
  const fl=Math.sin(t*3.1)*s*0.10;
  ctx.fillStyle='#F2E4C0';
  ctx.beginPath(); ctx.moveTo(s*0.55,-s*1.02);
  ctx.quadraticCurveTo(s*0.95,-s*0.92+fl,s*0.55,-s*0.72); ctx.closePath(); ctx.fill();
}
const buildAnim={};

function drawRobber(B,G,t){
  const h=B.hexById[G.robber]; if(!h) return;
  const p=toScreen(h.x,h.y);
  const S=view.scale;
  const cur=robberAnim;
  let x=p.x,y=p.y;
  if(cur && t<cur.t1){
    const k=clamp((t-cur.t0)/(cur.t1-cur.t0),0,1);
    const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
    x=lerp(cur.from.x,p.x,e); y=lerp(cur.from.y,p.y,e)-Math.sin(e*Math.PI)*S*0.9;
  }
  const bob=Math.sin(t*1.9)*S*0.03;
  ctx.save(); ctx.translate(x,y-S*0.46+bob);
  ctx.fillStyle='rgba(0,0,0,.45)';
  ctx.beginPath(); ctx.ellipse(0,S*0.30,S*0.20,S*0.07,0,0,TAU); ctx.fill();
  ctx.fillStyle='#22262B';
  ctx.beginPath();
  ctx.moveTo(0,-S*0.34);
  ctx.quadraticCurveTo(S*0.24,-S*0.22,S*0.20,S*0.28);
  ctx.lineTo(-S*0.20,S*0.28);
  ctx.quadraticCurveTo(-S*0.24,-S*0.22,0,-S*0.34);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle='#34393F';
  ctx.beginPath(); ctx.arc(0,-S*0.24,S*0.13,0,TAU); ctx.fill();
  ctx.fillStyle='#0C0E10';
  ctx.beginPath(); ctx.ellipse(0,-S*0.21,S*0.085,S*0.065,0,0,TAU); ctx.fill();
  ctx.fillStyle='#C9563C';
  ctx.beginPath(); ctx.arc(-S*0.030,-S*0.215,S*0.016,0,TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(S*0.030,-S*0.215,S*0.016,0,TAU); ctx.fill();
  ctx.restore();
}
let robberAnim=null;

/* =============== HIGHLIGHTS =============== */
function drawHighlights(B,G,t,hl){
  if(!hl) return;
  const S=view.scale;
  const pulse=0.5+0.5*Math.sin(t*3.4);
  if(hl.verts){
    for(const vid of hl.verts){
      const v=B.verts[vid]; if(!v) continue;
      const p=toScreen(v.x,v.y);
      const isPend = hl.pending===vid;
      const isNear = hl.near===vid && !isPend;
      const dim = hl.pending && !isPend;                /* a choice is pending: everything else fades back */
      const r=S*((isPend?0.30:isNear?0.26:0.15))*(1+pulse*0.16);
      ctx.beginPath(); ctx.arc(p.x,p.y,r,0,TAU);
      ctx.fillStyle= isPend?'rgba(255,236,178,.7)':isNear?'rgba(255,228,150,.55)':dim?'rgba(255,228,150,.09)':'rgba(255,228,150,.24)'; ctx.fill();
      ctx.strokeStyle= isPend?'rgba(255,246,208,'+(0.75+pulse*0.25)+')':'rgba(255,236,178,'+((dim?0.18:0.55)+pulse*(dim?0.15:0.4))+')';
      ctx.lineWidth=Math.max(1.5,S*(isPend?0.05:0.035)); ctx.stroke();
      if((isNear||isPend) && hl.ghost){
        ctx.save(); ctx.translate(p.x,p.y); ctx.globalAlpha=isPend?0.95:0.75;
        if(hl.ghost==='city') drawCity(hl.color,S*0.25,t); else drawHouse(hl.color,S*0.22);
        ctx.restore();
      }
    }
  }
  if(hl.edges){
    for(const eid of hl.edges){
      const e=B.edges[eid]; if(!e) continue;
      const a=toScreen(B.verts[e.v[0]].x,B.verts[e.v[0]].y);
      const b=toScreen(B.verts[e.v[1]].x,B.verts[e.v[1]].y);
      const isPend = hl.pending===eid;
      const isNear = hl.near===eid && !isPend;
      const dim = hl.pending && !isPend;
      ctx.lineCap='round';
      ctx.strokeStyle= isPend?'rgba(255,246,208,'+(0.85+pulse*0.15)+')':isNear?'rgba(255,236,178,'+(0.75+pulse*0.25)+')':dim?'rgba(255,228,150,.10)':'rgba(255,228,150,'+(0.30+pulse*0.20)+')';
      ctx.lineWidth=S*(isPend?0.17:isNear?0.13:0.075);
      ctx.beginPath();
      ctx.moveTo(lerp(a.x,b.x,0.12),lerp(a.y,b.y,0.12));
      ctx.lineTo(lerp(a.x,b.x,0.88),lerp(a.y,b.y,0.88)); ctx.stroke();
    }
  }
  if(hl.from && B.edges[hl.from]){                 /* the ship being moved */
    const e=B.edges[hl.from];
    const a=toScreen(B.verts[e.v[0]].x,B.verts[e.v[0]].y), b=toScreen(B.verts[e.v[1]].x,B.verts[e.v[1]].y);
    ctx.save(); ctx.lineCap='round';
    ctx.strokeStyle='rgba(20,12,3,.55)'; ctx.lineWidth=S*0.26; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.strokeStyle='rgba(255,216,107,'+(0.6+pulse*0.4)+')'; ctx.lineWidth=S*0.16; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    ctx.restore();
  }
  if(hl.hexes){
    for(const hid of hl.hexes){
      const h=anyHex(B,hid); if(!h) continue;
      const isSea=!!(B.seaById&&B.seaById[hid]);
      const p=toScreen(h.x,h.y);
      const isNear=hl.near===hid;
      hexPath(ctx,p.x,p.y,S*0.92);
      ctx.strokeStyle= isSea ? (isNear?'rgba(190,232,255,.98)':'rgba(150,215,255,'+(0.35+pulse*0.3)+')')
                     : (isNear?'rgba(255,236,178,.95)':'rgba(255,228,150,'+(0.30+pulse*0.25)+')');
      ctx.lineWidth=S*(isNear?0.08:0.045); ctx.stroke();
      if(isNear){ ctx.fillStyle= isSea?'rgba(150,215,255,.16)':'rgba(255,228,150,.14)'; hexPath(ctx,p.x,p.y,S*0.92); ctx.fill(); }
    }
  }
}

/* =============== EFFECTS =============== */
function spawnResFly(bx,by,res,tx,ty,delay){
  const p=toScreen(bx,by);
  fx.push({kind:'res',res,x:p.x,y:p.y,tx,ty,t0:T+(delay||0),dur:0.95});
}
function spawnBurst(bx,by,color,n){
  const p=toScreen(bx,by);
  for(let i=0;i<(n||14);i++){
    const a=Math.random()*TAU, sp=view.scale*(0.5+Math.random()*1.4);
    fx.push({kind:'spark',x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-view.scale*0.6,
      t0:T,dur:0.7+Math.random()*0.4,color:color||'#FFE9A8',r:view.scale*(0.02+Math.random()*0.03)});
  }
}
function drawFx(t){
  for(let i=fx.length-1;i>=0;i--){
    const f=fx[i];
    const k=(t-f.t0)/f.dur;
    if(k<0) continue;
    if(k>=1){ fx.splice(i,1); if(f.onEnd) f.onEnd(); continue; }
    if(f.kind==='res'){
      const e=k<0.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
      const x=lerp(f.x,f.tx,e), y=lerp(f.y,f.ty,e)-Math.sin(e*Math.PI)*90;
      const s=view.scale*0.30*(1-k*0.35);
      ctx.save(); ctx.translate(x,y); ctx.rotate(Math.sin(k*7)*0.18);
      ctx.globalAlpha=k>0.85?(1-k)/0.15:1;
      const bg=RES_BG[f.res]||RES_BG.any;
      const g=ctx.createLinearGradient(0,-s,0,s);
      g.addColorStop(0,bg[0]); g.addColorStop(1,bg[1]);
      ctx.fillStyle=g;
      roundRect(ctx,-s*0.72,-s*0.95,s*1.44,s*1.9,s*0.24); ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.45)'; ctx.lineWidth=s*0.10; ctx.stroke();
      drawResIcon(ctx,f.res,0,0,s*1.05);
      ctx.restore();
    } else if(f.kind==='spark'){
      const x=f.x+f.vx*k*f.dur, y=f.y+f.vy*k*f.dur+0.5*view.scale*7*Math.pow(k*f.dur,2);
      ctx.globalAlpha=1-k; ctx.fillStyle=f.color;
      ctx.beginPath(); ctx.arc(x,y,f.r*(1-k*0.4),0,TAU); ctx.fill();
    }
  }
  ctx.globalAlpha=1;
}
function roundRect(c,x,y,w,h,r){
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath();
}

/* =============== MAIN LOOP =============== */
let lastDt=0.016, running=false;
function resizeCanvas(){
  const wrap=$('#boardWrap'); if(!wrap) return;
  const r=wrap.getBoundingClientRect();
  DPR=Math.min(window.devicePixelRatio||1,2);
  CW=r.width; CH=r.height;
  cv.width=Math.round(CW*DPR); cv.height=Math.round(CH*DPR);
  cv.style.width=CW+'px'; cv.style.height=CH+'px';
  ctx=cv.getContext('2d');
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
/* ---- battery saver ----
   Off: the picture is redrawn on every screen refresh, as always.
   On: the board stops swaying, the sea, foam, gulls and chimney smoke rest, and the picture is
   redrawn at full speed only while something is happening — a touch, dragging the board, dice,
   building, a computer's turn, an update from a friend. With nothing going on it drops to a few
   pictures a second (the clouds keep drifting), and after half a minute it stops altogether,
   with a quiet redraw every couple of seconds as a safety net. Any touch wakes it at once. */
let ECO = (()=>{ const v=ls('sieco'); if(v==='1') return true; if(v==='0') return false;
  try{ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }catch(e){ return false; } })();
let ecoKick = performance.now()/1000;
function kick(){ ecoKick=performance.now()/1000; }
function setEco(on){ ECO=!!on; ls('sieco',ECO?'1':'0'); kick(); }
const ECO_AWAKE=1.5, ECO_SLEEP=30, ECO_SLOW=1/8, ECO_SAFETY=2;
function ecoBusy(){
  if(typeof ST!=='undefined' && (ST.busy || ST.tut)) return true;
  if(fx.length || (robberAnim && T<robberAnim.t1)) return true;
  for(const k in hexWake) return true;
  for(const k in tokenPulse) return true;
  for(const k in buildAnim) return true;
  return false;
}
function startLoop(){
  if(running) return; running=true;
  let prev=performance.now()/1000, vt=prev;
  function frame(ms){
    if(!running) return;
    requestAnimationFrame(frame);
    const now=ms/1000;
    let step=now-prev;
    if(ECO){
      const idle=now-ecoKick, busy=idle<ECO_AWAKE || ecoBusy();
      const gap=busy?0:(idle<ECO_SLEEP?ECO_SLOW:ECO_SAFETY);
      if(step<gap-0.004) return;
      if(!busy && idle>=ECO_SLEEP) step=0;            /* asleep: redraw the same moment, nothing moves on */
      step=Math.min(step,0.15);                       /* and nothing jumps when it wakes */
    }
    prev=now;
    lastDt=ECO?step:clamp(step,0.001,0.06);
    vt+=step; T=vt;
    try{ render(vt); }catch(e){ console.error(e); }
  }
  requestAnimationFrame(frame);
}

/* the pirate: a black-sailed ship that closes its hex to new ships */
function drawPirate(B,G,t){
  if(!G.pirate) return;
  const h=B.seaById&&B.seaById[G.pirate]; if(!h) return;
  const p=toScreen(h.x,h.y), S=view.scale;
  /* the blocked water, faintly */
  hexPath(ctx,p.x,p.y,S*0.96);
  ctx.fillStyle='rgba(120,20,20,.16)'; ctx.fill();
  ctx.setLineDash([S*0.14,S*0.10]); ctx.strokeStyle='rgba(200,70,60,.55)'; ctx.lineWidth=Math.max(1.5,S*0.04); ctx.stroke(); ctx.setLineDash([]);
  const bob=Math.sin(t*1.6)*S*0.05, roll=Math.sin(t*1.3)*0.06;
  ctx.save(); ctx.translate(p.x,p.y+bob); ctx.rotate(roll);
  ctx.fillStyle='rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(0,S*0.30,S*0.42,S*0.08,0,0,TAU); ctx.fill();
  /* hull */
  ctx.fillStyle='#2A1A12';
  ctx.beginPath(); ctx.moveTo(-S*0.40,S*0.10); ctx.lineTo(S*0.40,S*0.10); ctx.lineTo(S*0.28,S*0.30); ctx.lineTo(-S*0.28,S*0.30); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#6B4A2E'; ctx.lineWidth=Math.max(1,S*0.03); ctx.beginPath(); ctx.moveTo(-S*0.36,S*0.16); ctx.lineTo(S*0.36,S*0.16); ctx.stroke();
  /* mast + black sails */
  ctx.strokeStyle='#4A3222'; ctx.lineWidth=Math.max(1.5,S*0.05);
  ctx.beginPath(); ctx.moveTo(0,S*0.12); ctx.lineTo(0,-S*0.62); ctx.stroke();
  const sway=Math.sin(t*2.2)*S*0.03;
  ctx.fillStyle='#15171B';
  ctx.beginPath(); ctx.moveTo(S*0.02,-S*0.56); ctx.quadraticCurveTo(S*0.38+sway,-S*0.30,S*0.30+sway,S*0.06); ctx.lineTo(S*0.02,S*0.06); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-S*0.02,-S*0.50); ctx.quadraticCurveTo(-S*0.32-sway,-S*0.28,-S*0.26-sway,S*0.06); ctx.lineTo(-S*0.02,S*0.06); ctx.closePath(); ctx.fill();
  /* skull */
  ctx.fillStyle='#E8E4D6'; ctx.beginPath(); ctx.arc(S*0.15+sway*0.5,-S*0.22,S*0.06,0,TAU); ctx.fill();
  ctx.fillStyle='#15171B'; ctx.beginPath(); ctx.arc(S*0.13+sway*0.5,-S*0.23,S*0.014,0,TAU); ctx.arc(S*0.17+sway*0.5,-S*0.23,S*0.014,0,TAU); ctx.fill();
  ctx.restore();
}

