/* =========================================================
   5. THE LIVING BOARD
   ========================================================= */
const view = {scale:60, ox:0, oy:0, minS:20, maxS:220};
let cv, ctx, DPR=1, CW=0, CH=0;
let T=0;                      /* seconds since load */
const anim = {};              /* per-hex persistent animation state */
const fx = [];                /* transient effects */
let tokenPulse = {};          /* hexId -> start time */

function toScreen(x,y){ return {x:view.ox+x*view.scale, y:view.oy+y*view.scale}; }
function fromScreen(x,y){ return {x:(x-view.ox)/view.scale, y:(y-view.oy)/view.scale}; }

function fitView(B,w,h,padTop,padBottom,padSide){
  const b=B.bounds, bw=b.maxX-b.minX, bh=b.maxY-b.minY;
  const availH = h-padTop-padBottom;
  const availW = padSide==null ? w*0.96 : w-2*padSide;
  const s = Math.min(availW/bw, availH*0.98/bh);
  view.scale = clamp(s,view.minS,view.maxS);
  view.ox = w/2 - (b.minX+bw/2)*view.scale;
  view.oy = padTop + availH/2 - (b.minY+bh/2)*view.scale;
}

/* --- wind field shared by wheat, trees and flags --- */
function windAt(x,y,t){
  const base = Math.sin(t*1.45 + x*0.9 + y*0.45)*0.55 + Math.sin(t*0.83 - x*0.5 + y*0.9)*0.45;
  const gustPos = ((t*0.42)%3.2)*6 - 9;          /* a gust sweeping east */
  const g = Math.exp(-Math.pow((x-gustPos)/1.9,2))*1.25;
  return base*(0.55+g);
}

function hexAnim(h){
  /* keyed by terrain too: the home screen and the game board reuse the same coordinates */
  const key=h.id+'|'+h.terrain;
  let a=anim[key];
  if(a) return a;
  const rnd=mulberry32(h.id.split(',').reduce((s,c,i)=>s+c.charCodeAt(0)*(i+3)*97,17));
  a={rnd, rot:Math.floor(rnd()*6), items:[]};
  const inR=0.60;
  const spot=()=>{ let x,y;
    do{ x=(rnd()*2-1)*inR; y=(rnd()*2-1)*inR; }while(Math.hypot(x,y)>inR);
    return {x,y}; };
  if(h.terrain==='forest'){
    const n=7; for(let i=0;i<n;i++){ const p=spot();
      a.items.push({...p, s:0.16+rnd()*0.10, ph:rnd()*TAU, kind:rnd()<0.28?'round':'pine'}); }
    a.items.sort((p,q)=>p.y-q.y);
  } else if(h.terrain==='pasture'){
    const n=3; for(let i=0;i<n;i++){ const p=spot();
      a.items.push({...p, tx:p.x, ty:p.y, s:0.115+rnd()*0.035, dir:1, walk:rnd()*TAU,
        wait:rnd()*3, graze:0, ph:rnd()*TAU}); }
  } else if(h.terrain==='fields'){
    a.rows=[];
    for(let r=0;r<6;r++){
      const y=-0.46+r*0.175, row=[];
      const halfW = Math.sqrt(Math.max(0,0.62*0.62-y*y))*1.0;
      const n=Math.max(3,Math.round(halfW/0.085));
      for(let i=0;i<n;i++){
        const x=-halfW+ (i+0.5)*(2*halfW/n) + (rnd()-0.5)*0.03;
        row.push({x, y:y+(rnd()-0.5)*0.03, h:0.15+rnd()*0.05, ph:rnd()*TAU});
      }
      a.rows.push(row);
    }
  } else if(h.terrain==='mountains'){
    for(let i=0;i<6;i++){ const p=spot(); a.items.push({...p, ph:rnd()*TAU, sp:0.7+rnd()*1.1}); }
  } else if(h.terrain==='desert'){
    a.tumble={x:-0.7, y:0.25+rnd()*0.2, t:rnd()*9, spin:0};
  } else if(h.terrain==='gold'){
    for(let i=0;i<8;i++){ const p=spot(); a.items.push({...p, ph:rnd()*TAU, sp:0.9+rnd()*1.4}); }
  }
  if(h.terrain==='hills'){ a.smoke=[]; a.emit=0; }
  anim[key]=a; return a;
}

/* =============== OCEAN =============== */
function drawOcean(t){
  const g=ctx.createLinearGradient(0,0,0,CH);
  g.addColorStop(0,'#0C3A55'); g.addColorStop(0.5,'#0A2E45'); g.addColorStop(1,'#06202F');
  ctx.fillStyle=g; ctx.fillRect(0,0,CW,CH);

  /* long swells */
  const S=view.scale;
  const rows=Math.ceil(CH/(S*0.42))+2;
  ctx.lineCap='round';
  for(let i=0;i<rows;i++){
    const baseY=i*S*0.42 + ((t*11)%(S*0.42));
    const amp=S*0.035*(0.6+((i*37)%7)/7);
    const ph=i*1.7+t*(0.55+ (i%3)*0.12);
    ctx.beginPath();
    for(let x=-20;x<=CW+20;x+=Math.max(10,S*0.18)){
      const y=baseY+Math.sin(x/(S*0.9)+ph)*amp+Math.sin(x/(S*2.4)-ph*0.6)*amp*0.7;
      x<0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.strokeStyle= i%2 ? 'rgba(140,205,230,.075)' : 'rgba(255,255,255,.045)';
    ctx.lineWidth=Math.max(1,S*0.022); ctx.stroke();
  }
  /* crest highlights that break */
  for(let i=0;i<rows;i+=2){
    const baseY=i*S*0.42 + ((t*11)%(S*0.42));
    const ph=i*1.7+t*0.55;
    for(let k=0;k<4;k++){
      const x=((i*211+k*457)%1000)/1000*CW + Math.sin(t*0.3+i+k)*S*0.5;
      const y=baseY+Math.sin(x/(S*0.9)+ph)*S*0.035;
      const a=0.5+0.5*Math.sin(t*1.6+i*2+k*1.3);
      ctx.globalAlpha=a*0.30;
      ctx.strokeStyle='#CFEFFB'; ctx.lineWidth=Math.max(1,S*0.026);
      ctx.beginPath(); ctx.moveTo(x-S*0.16,y); ctx.lineTo(x+S*0.16,y-S*0.012); ctx.stroke();
    }
  }
  ctx.globalAlpha=1;
  /* glitter */
  for(let i=0;i<46;i++){
    const sx=((i*7919)%997)/997*CW, sy=((i*104729)%991)/991*CH;
    const tw=Math.sin(t*2.2+i*1.7);
    if(tw<0.72) continue;
    ctx.globalAlpha=(tw-0.72)/0.28*0.7;
    ctx.fillStyle='#EAFBFF';
    ctx.fillRect(sx,sy,Math.max(1,S*0.035),Math.max(1,S*0.012));
  }
  ctx.globalAlpha=1;
}

/* foam that hugs every shoreline */
function drawCoastFoam(B,t){
  const S=view.scale;
  ctx.lineCap='round';
  for(const eid in B.edges){
    const e=B.edges[eid];
    if(e.hexes.length!==1) continue;
    const a=toScreen(B.verts[e.v[0]].x,B.verts[e.v[0]].y);
    const b=toScreen(B.verts[e.v[1]].x,B.verts[e.v[1]].y);
    const h=B.hexById[e.hexes[0]];
    const hc=toScreen(h.x,h.y);
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    let nx=mx-hc.x, ny=my-hc.y; const L=Math.hypot(nx,ny)||1; nx/=L; ny/=L;
    const seed=(e.x*13.7+e.y*7.1);
    const pulse=0.5+0.5*Math.sin(t*1.25+seed);
    const off=S*(0.03+pulse*0.055);
    ctx.globalAlpha=0.16+pulse*0.34;
    ctx.strokeStyle='#D9F4FF';
    ctx.lineWidth=Math.max(1,S*0.05*(0.5+pulse*0.6));
    ctx.beginPath();
    ctx.moveTo(a.x+nx*off,a.y+ny*off);
    ctx.quadraticCurveTo(mx+nx*(off+S*0.05), my+ny*(off+S*0.05), b.x+nx*off,b.y+ny*off);
    ctx.stroke();
    /* a second, slower ring */
    const p2=0.5+0.5*Math.sin(t*0.8+seed*1.3);
    ctx.globalAlpha=0.10+p2*0.16;
    ctx.lineWidth=Math.max(1,S*0.03);
    const off2=S*(0.10+p2*0.09);
    ctx.beginPath();
    ctx.moveTo(a.x+nx*off2,a.y+ny*off2);
    ctx.quadraticCurveTo(mx+nx*(off2+S*0.04), my+ny*(off2+S*0.04), b.x+nx*off2,b.y+ny*off2);
    ctx.stroke();
  }
  ctx.globalAlpha=1;
}

/* =============== LAND =============== */
function drawTiles(B,t,G){
  const S=view.scale;
  const texPx = clamp(Math.round(S*2*Math.min(DPR,2)/32)*32, 96, 352);
  for(const h of B.hexes){
    const p=toScreen(h.x,h.y);
    if(p.x<-S*2||p.x>CW+S*2||p.y<-S*2||p.y>CH+S*2) continue;
    const a=hexAnim(h);
    const wk=wakeLift(h.id,t);
    const lift=wk*S*0.075;
    /* drop shadow lifts the tile off the water */
    ctx.save();
    ctx.translate(p.x,p.y+S*0.055+lift*0.85);
    ctx.fillStyle='rgba(0,10,20,'+(0.38+wk*0.16)+')';
    hexPath(ctx,0,0,S*(0.995+wk*0.02)); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(p.x,p.y-lift);
    ctx.rotate(a.rot*Math.PI/3);
    const tex=tileTexture(h.terrain,texPx);
    ctx.drawImage(tex,-S,-S,S*2,S*2);
    ctx.restore();

    ctx.save(); ctx.translate(p.x,p.y-lift);
    drawTileLife(h,a,t,S,G);
    if(wk>0.01){
      ctx.globalAlpha=wk*0.30; ctx.fillStyle='#FFE9B5';
      hexPath(ctx,0,0,S*0.94); ctx.fill();
      ctx.globalAlpha=wk*0.55; ctx.strokeStyle='#FFF0C8';
      ctx.lineWidth=S*0.045; hexPath(ctx,0,0,S*0.95); ctx.stroke();
      ctx.globalAlpha=1;
    }
    ctx.restore();
  }
}

function drawTileLife(h,a,t,S,G){
  const dim = (h.id===G.robber) ? 0.55 : 1;
  ctx.globalAlpha=dim;
  switch(h.terrain){
    case 'forest':    lifeForest(a,t,S); break;
    case 'pasture':   lifePasture(a,t,S); break;
    case 'fields':    lifeFields(a,t,S,h); break;
    case 'mountains': lifeMountains(a,t,S); break;
    case 'hills':     lifeHills(a,t,S); break;
    case 'desert':    lifeDesert(a,t,S); break;
    case 'gold':      lifeGold(a,t,S); break;
  }
  ctx.globalAlpha=1;
}

function lifeForest(a,t,S){
  for(const it of a.items){
    const w=windAt(it.x,it.y,t);
    const lean=w*0.10;
    const X=it.x*S, Y=it.y*S, h=it.s*S*1.9, w0=it.s*S*0.78;
    ctx.save(); ctx.translate(X,Y);
    /* shadow */
    ctx.fillStyle='rgba(0,0,0,.22)';
    ctx.beginPath(); ctx.ellipse(w0*0.35,0,w0*0.8,w0*0.28,0,0,TAU); ctx.fill();
    ctx.transform(1,0,lean,1,0,0);
    ctx.strokeStyle='#4A3220'; ctx.lineWidth=Math.max(1,w0*0.30); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-h*0.32); ctx.stroke();
    if(it.kind==='pine'){
      for(let k=0;k<3;k++){
        const yy=-h*0.28-k*h*0.235, ww=w0*(1.15-k*0.24);
        ctx.beginPath(); ctx.moveTo(0,yy-h*0.36); ctx.lineTo(ww,yy); ctx.lineTo(-ww,yy); ctx.closePath();
        ctx.fillStyle= k===2?'#3F8A4A':(k===1?'#347A40':'#2B6836'); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,yy-h*0.36); ctx.lineTo(ww,yy); ctx.lineTo(0,yy); ctx.closePath();
        ctx.fillStyle='rgba(255,255,255,.10)'; ctx.fill();
      }
    } else {
      ctx.fillStyle='#2F7238';
      ctx.beginPath(); ctx.ellipse(0,-h*0.62,w0*1.06,w0*0.95,0,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.13)';
      ctx.beginPath(); ctx.ellipse(-w0*0.28,-h*0.75,w0*0.52,w0*0.42,0,0,TAU); ctx.fill();
    }
    ctx.restore();
  }
}

function lifePasture(a,t,S){
  const dt=Math.min(0.05,lastDt);
  for(const s of a.items){
    if(s.graze>0){ s.graze-=dt; }
    else {
      const dx=s.tx-s.x, dy=s.ty-s.y, d=Math.hypot(dx,dy);
      if(d<0.02){
        if(s.wait>0){ s.wait-=dt; s.graze=0; }
        else {
          const r=a.rnd;
          let nx,ny; let tries=0;
          do{ nx=s.x+(r()*2-1)*0.34; ny=s.y+(r()*2-1)*0.28; tries++; }
          while(Math.hypot(nx,ny)>0.52 && tries<8);
          s.tx=clamp(nx,-0.5,0.5); s.ty=clamp(ny,-0.46,0.46);
          s.wait=0.4+r()*2.4; s.graze= r()<0.45 ? 1.2+r()*2.2 : 0;
        }
      } else {
        const sp=0.085;
        s.x+=dx/d*sp*dt; s.y+=dy/d*sp*dt;
        s.dir = dx<0?-1:1;
        s.walk+=dt*7.5;
      }
    }
    drawSheep(s.x*S,s.y*S,s.s*S,s.dir,s.walk,s.graze>0,t+s.ph);
  }
}
function drawSheep(X,Y,r,dir,walk,grazing,tt){
  ctx.save(); ctx.translate(X,Y); ctx.scale(dir,1);
  ctx.fillStyle='rgba(0,0,0,.24)';
  ctx.beginPath(); ctx.ellipse(0,r*0.34,r*0.95,r*0.28,0,0,TAU); ctx.fill();
  const bob=grazing?0:Math.sin(walk)*r*0.05;
  ctx.translate(0,bob);
  /* legs */
  ctx.strokeStyle='#4A4238'; ctx.lineWidth=Math.max(1,r*0.17); ctx.lineCap='round';
  for(let i=0;i<4;i++){
    const lx=(-0.45+ (i%2)*0.9)*r, back=i>1?-0.18*r:0.18*r;
    const sw=grazing?0:Math.sin(walk+i*1.8)*r*0.22;
    ctx.beginPath(); ctx.moveTo(lx*0.7+back*0,r*0.12);
    ctx.lineTo(lx*0.7+sw,r*0.44); ctx.stroke();
  }
  /* woolly body */
  ctx.fillStyle='#F6F3EA';
  for(const [dx,dy,rr] of [[-0.42,0,0.44],[-0.10,-0.16,0.50],[0.26,-0.04,0.44],[0.02,0.16,0.46]]){
    ctx.beginPath(); ctx.arc(dx*r,dy*r,rr*r,0,TAU); ctx.fill();
  }
  ctx.fillStyle='rgba(0,0,0,.07)';
  ctx.beginPath(); ctx.arc(-0.05*r,0.22*r,0.44*r,0,TAU); ctx.fill();
  /* head */
  const hd=grazing? r*0.34 : r*0.06;
  ctx.save(); ctx.translate(0.66*r, -0.10*r+hd);
  ctx.rotate(grazing?0.7:Math.sin(tt*1.6)*0.10);
  ctx.fillStyle='#3B3733';
  ctx.beginPath(); ctx.ellipse(0,0,r*0.30,r*0.24,0,0,TAU); ctx.fill();
  ctx.fillStyle='#2C2926';
  ctx.beginPath(); ctx.ellipse(-r*0.22,-r*0.16,r*0.13,r*0.09,-0.6,0,TAU); ctx.fill();
  ctx.fillStyle='#FFF';
  ctx.beginPath(); ctx.arc(r*0.12,-r*0.05,r*0.055,0,TAU); ctx.fill();
  ctx.fillStyle='#1A1A1A';
  ctx.beginPath(); ctx.arc(r*0.13,-r*0.05,r*0.028,0,TAU); ctx.fill();
  ctx.restore();
  /* tail */
  ctx.fillStyle='#F6F3EA';
  ctx.beginPath(); ctx.arc(-0.76*r,-0.06*r+Math.sin(tt*3)*r*0.05,r*0.16,0,TAU); ctx.fill();
  ctx.restore();
}

function lifeFields(a,t,S,h){
  ctx.lineCap='round';
  for(const row of a.rows){
    /* stalks in one stroke per row */
    ctx.beginPath();
    for(const st of row){
      const w=windAt(st.x+h.x,st.y+h.y,t+st.ph*0.12);
      const bend=w*0.075;
      const bx=st.x*S, by=st.y*S, hh=st.h*S;
      ctx.moveTo(bx,by);
      ctx.quadraticCurveTo(bx+bend*S*0.45, by-hh*0.55, bx+bend*S*1.15, by-hh);
    }
    ctx.strokeStyle='#B99331'; ctx.lineWidth=Math.max(1,S*0.016); ctx.stroke();
    /* ears */
    for(const st of row){
      const w=windAt(st.x+h.x,st.y+h.y,t+st.ph*0.12);
      const bend=w*0.075;
      const bx=st.x*S+bend*S*1.15, by=st.y*S-st.h*S;
      ctx.save(); ctx.translate(bx,by); ctx.rotate(bend*0.8);
      ctx.fillStyle='#EFD067';
      ctx.beginPath(); ctx.ellipse(0,0,S*0.020,S*0.048,0,0,TAU); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,.35)';
      ctx.beginPath(); ctx.ellipse(-S*0.007,-S*0.012,S*0.009,S*0.020,0,0,TAU); ctx.fill();
      ctx.restore();
    }
  }
  /* a pale gust sweeping across the crop */
  const gustPos=((t*0.42)%3.2)*6-9;
  const gx=(gustPos-h.x);
  if(Math.abs(gx)<1.4){
    const al=Math.exp(-Math.pow(gx/0.8,2))*0.16;
    ctx.globalAlpha=al; ctx.fillStyle='#FFF6D0';
    hexPath(ctx,0,0,S*0.86); ctx.fill(); ctx.globalAlpha=1;
  }
}

function lifeMountains(a,t,S){
  for(const it of a.items){
    const v=Math.sin(t*it.sp+it.ph);
    const k=Math.pow(Math.max(0,v),9);
    if(k<0.02) continue;
    ctx.globalAlpha=k;
    ctx.fillStyle='#FFFFFF';
    const X=it.x*S, Y=it.y*S, r=S*0.05*k;
    ctx.beginPath();
    ctx.moveTo(X,Y-r*2.2); ctx.lineTo(X+r*0.55,Y-r*0.55); ctx.lineTo(X+r*2.2,Y);
    ctx.lineTo(X+r*0.55,Y+r*0.55); ctx.lineTo(X,Y+r*2.2); ctx.lineTo(X-r*0.55,Y+r*0.55);
    ctx.lineTo(X-r*2.2,Y); ctx.lineTo(X-r*0.55,Y-r*0.55); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha=1;
}

function lifeHills(a,t,S){
  const dt=Math.min(0.05,lastDt);
  a.emit-=dt;
  if(a.emit<=0){ a.emit=0.33+a.rnd()*0.25;
    a.smoke.push({x:0.115,y:-0.02,vx:0.02+a.rnd()*0.02,vy:-0.13-a.rnd()*0.05,
      r:0.022+a.rnd()*0.016,life:0,max:2.6+a.rnd()*1.2,ph:a.rnd()*TAU}); }
  for(let i=a.smoke.length-1;i>=0;i--){
    const s=a.smoke[i]; s.life+=dt;
    if(s.life>s.max){ a.smoke.splice(i,1); continue; }
    const k=s.life/s.max;
    s.x+=s.vx*dt; s.y+=s.vy*dt;
    const X=(s.x+Math.sin(s.life*1.5+s.ph)*0.035)*S, Y=s.y*S;
    ctx.globalAlpha=(1-k)*0.42;
    ctx.fillStyle='#E4DCCE';
    ctx.beginPath(); ctx.arc(X,Y,S*s.r*(1+k*2.6),0,TAU); ctx.fill();
  }
  ctx.globalAlpha=1;
}

function lifeDesert(a,t,S){
  /* heat shimmer */
  ctx.globalAlpha=0.16;
  ctx.strokeStyle='#FFF3D2'; ctx.lineWidth=Math.max(1,S*0.015);
  for(let i=0;i<5;i++){
    const y=(-0.18+i*0.13)*S;
    ctx.beginPath();
    for(let x=-0.6;x<=0.6;x+=0.06){
      const yy=y+Math.sin(x*9+t*2.4+i)*S*0.011;
      x===-0.6?ctx.moveTo(x*S,yy):ctx.lineTo(x*S,yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha=1;
  /* tumbleweed */
  const tb=a.tumble; const dt=Math.min(0.05,lastDt);
  tb.t+=dt;
  if(tb.t>0){
    tb.x+=0.16*dt; tb.spin+=dt*4.4;
    if(tb.x>0.72){ tb.x=-0.72; tb.t=-(2+a.rnd()*7); tb.y=0.12+a.rnd()*0.3; }
    const X=tb.x*S, Y=(tb.y+Math.abs(Math.sin(tb.spin))*0.03)*S;
    ctx.save(); ctx.translate(X,Y); ctx.rotate(tb.spin);
    ctx.strokeStyle='#9A7A45'; ctx.lineWidth=Math.max(1,S*0.010);
    for(let i=0;i<7;i++){ const a2=i/7*TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(a2)*S*0.045,Math.sin(a2)*S*0.045);
      ctx.lineTo(Math.cos(a2+1.6)*S*0.050,Math.sin(a2+1.6)*S*0.050); ctx.stroke(); }
    ctx.restore();
  }
}

function lifeGold(a,t,S){
  const sweep=((t*0.5)%1)*2-1;
  ctx.save();
  hexPath(ctx,0,0,S*0.93); ctx.clip();
  const g=ctx.createLinearGradient(sweep*S-S*0.5,-S,sweep*S+S*0.5,S);
  g.addColorStop(0,'rgba(255,240,180,0)');
  g.addColorStop(0.5,'rgba(255,245,200,.30)');
  g.addColorStop(1,'rgba(255,240,180,0)');
  ctx.fillStyle=g; ctx.fillRect(-S,-S,S*2,S*2);
  ctx.restore();
  for(const it of a.items){
    const k=Math.pow(Math.max(0,Math.sin(t*it.sp+it.ph)),8);
    if(k<0.03) continue;
    ctx.globalAlpha=k; ctx.fillStyle='#FFF8DC';
    const X=it.x*S,Y=it.y*S,r=S*0.035*k;
    ctx.beginPath();
    ctx.moveTo(X,Y-r*2.4); ctx.lineTo(X+r*0.6,Y-r*0.6); ctx.lineTo(X+r*2.4,Y);
    ctx.lineTo(X+r*0.6,Y+r*0.6); ctx.lineTo(X,Y+r*2.4); ctx.lineTo(X-r*0.6,Y+r*0.6);
    ctx.lineTo(X-r*2.4,Y); ctx.lineTo(X-r*0.6,Y-r*0.6); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha=1;
}

