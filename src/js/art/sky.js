/* =========================================================
   SKY — what the board was missing: weather, birds and light
   ========================================================= */
const sky = {clouds:[], gulls:[], ships:[], ready:false, band:{x0:-12,x1:12,y0:-8,y1:8}};
const chimney = {};
const hexWake = {};

function initSky(B,tag){
  sky.for=tag||'game';
  const b=B&&B.bounds ? B.bounds : {minX:-5,maxX:5,minY:-4,maxY:4};
  sky.band={x0:b.minX-9, x1:b.maxX+9, y0:b.minY-3.0, y1:b.maxY+2.0};
  const rnd=mulberry32(4242);
  sky.clouds=[];
  for(let i=0;i<7;i++){
    const puffs=[]; const n=4+Math.floor(rnd()*4);
    for(let k=0;k<n;k++)
      puffs.push({dx:(rnd()*2-1)*1.15, dy:(rnd()*2-1)*0.40, dr:0.34+rnd()*0.44});
    sky.clouds.push({
      x: sky.band.x0 + rnd()*(sky.band.x1-sky.band.x0),
      y: sky.band.y0 + rnd()*(sky.band.y1-sky.band.y0),
      s: 0.75+rnd()*0.85, v: 0.10+rnd()*0.13, h: 0.55+rnd()*0.7,
      a: 0.16+rnd()*0.20, puffs
    });
  }
  sky.gulls=[];
  for(let i=0;i<3;i++) sky.gulls.push({
    x: sky.band.x0+rnd()*(sky.band.x1-sky.band.x0),
    y: b.minY-1.2+rnd()*(b.maxY-b.minY+2),
    v: 0.55+rnd()*0.5, ph:rnd()*TAU, amp:0.25+rnd()*0.5, sz:0.10+rnd()*0.06,
    dir: rnd()<0.5?-1:1, wait: rnd()*14
  });
  sky.ships=[];
  for(let i=0;i<2;i++) sky.ships.push({
    x: sky.band.x0+rnd()*(sky.band.x1-sky.band.x0),
    y: (i? b.maxY+1.6 : b.minY-1.5)+rnd()*0.8,
    v: (0.055+rnd()*0.05)*(i?-1:1), sz:0.42+rnd()*0.2, wake:[]
  });
  sky.ready=true;
}

/* ---- 1. shadows that slide across the island ---- */
let cloudOpacity = (()=>{ const v=parseFloat(ls('sicloud')); return isNaN(v)?0.3:v; })();   /* dim by default — clouds shouldn't hide the board */
const CLOUD_LEVELS=[{v:1,he:'עננים: רגיל'},{v:0.3,he:'עננים: עמומים (30%)'},{v:0,he:'עננים: מוסתרים'}];
function cloudLevelIdx(){ let bi=0,bd=9; CLOUD_LEVELS.forEach((l,i)=>{ const d=Math.abs(l.v-cloudOpacity); if(d<bd){bd=d;bi=i;} }); return bi; }
function cycleCloudOpacity(){ cloudOpacity=CLOUD_LEVELS[(cloudLevelIdx()+1)%CLOUD_LEVELS.length].v; ls('sicloud',String(cloudOpacity)); return cloudOpacity; }
function drawCloudShadows(t){
  if(!sky.ready) return;
  const S=view.scale, dt=Math.min(0.06,lastDt);
  ctx.save();
  for(const c of sky.clouds){
    c.x+=c.v*dt;                                    /* keep drifting even while hidden, so it resumes smoothly */
    if(c.x-c.s*2 > sky.band.x1) c.x = sky.band.x0-c.s*2;
    if(cloudOpacity<=0) continue;
    const p=toScreen(c.x,c.y);
    if(p.x<-S*5||p.x>CW+S*5) continue;
    ctx.globalAlpha=c.a*0.62*cloudOpacity;
    ctx.fillStyle='#04121C';
    for(const q of c.puffs){
      ctx.beginPath();
      ctx.ellipse(p.x+q.dx*c.s*S, p.y+q.dy*c.s*S*0.8,
        q.dr*c.s*S*1.25, q.dr*c.s*S*0.78, 0,0,TAU);
      ctx.fill();
    }
  }
  ctx.restore(); ctx.globalAlpha=1;
}
/* ---- 2. the clouds themselves, offset by their height ---- */
function drawClouds(t){
  if(!sky.ready || cloudOpacity<=0) return;
  const S=view.scale;
  for(const c of sky.clouds){
    const p=toScreen(c.x - c.h*0.75, c.y - c.h*1.05);
    if(p.x<-S*5||p.x>CW+S*5) continue;
    ctx.globalAlpha=Math.min(0.72,c.a*2.8)*cloudOpacity;
    for(const q of c.puffs){
      const x=p.x+q.dx*c.s*S, y=p.y+q.dy*c.s*S*0.8, r=q.dr*c.s*S;
      const g=ctx.createRadialGradient(x-r*0.3,y-r*0.4,r*0.15,x,y,r*1.15);
      g.addColorStop(0,'rgba(255,253,246,.96)');
      g.addColorStop(0.55,'rgba(233,241,246,.80)');
      g.addColorStop(1,'rgba(196,214,226,0)');
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.ellipse(x,y,r*1.22,r*0.80,0,0,TAU); ctx.fill();
    }
  }
  ctx.globalAlpha=1;
}
/* ---- 3. gulls ---- */
function drawGulls(t){
  if(!sky.ready) return;
  const S=view.scale, dt=Math.min(0.06,lastDt);
  ctx.strokeStyle='rgba(243,249,252,.92)'; ctx.lineCap='round';
  for(const g of sky.gulls){
    if(g.wait>0){ g.wait-=dt; continue; }
    g.x+=g.v*dt*g.dir;
    if(g.dir>0 && g.x>sky.band.x1){ g.x=sky.band.x0; g.wait=4+Math.random()*16; g.y=sky.band.y0+Math.random()*(sky.band.y1-sky.band.y0); }
    if(g.dir<0 && g.x<sky.band.x0){ g.x=sky.band.x1; g.wait=4+Math.random()*16; g.y=sky.band.y0+Math.random()*(sky.band.y1-sky.band.y0); }
    const yy=g.y+Math.sin(t*0.7+g.ph)*g.amp;
    const p=toScreen(g.x,yy);
    if(p.x<-40||p.x>CW+40||p.y<-40||p.y>CH+40) continue;
    const flap=Math.sin(t*7.5+g.ph);
    const w=g.sz*S, lift=flap*w*0.55;
    ctx.lineWidth=Math.max(1,w*0.22);
    ctx.beginPath();
    ctx.moveTo(p.x-w,p.y+lift*0.35);
    ctx.quadraticCurveTo(p.x-w*0.45,p.y-lift, p.x,p.y);
    ctx.quadraticCurveTo(p.x+w*0.45,p.y-lift, p.x+w,p.y+lift*0.35);
    ctx.stroke();
  }
}
/* ---- 4. traffic out at sea ---- */
function drawSeaTraffic(t){
  if(!sky.ready) return;
  const S=view.scale, dt=Math.min(0.06,lastDt);
  for(const s of sky.ships){
    s.x+=s.v*dt;
    if(s.v>0 && s.x>sky.band.x1+2) s.x=sky.band.x0-2;
    if(s.v<0 && s.x<sky.band.x0-2) s.x=sky.band.x1+2;
    const p=toScreen(s.x,s.y);
    if(p.x<-S*3||p.x>CW+S*3) continue;
    const bob=Math.sin(t*1.1+s.x)*S*0.03;
    const sz=S*s.sz, dir=s.v>0?1:-1;
    ctx.globalAlpha=0.62;
    /* wake */
    ctx.strokeStyle='rgba(214,240,250,.35)'; ctx.lineWidth=Math.max(1,sz*0.09);
    ctx.beginPath();
    ctx.moveTo(p.x-dir*sz*1.0,p.y+bob+sz*0.30);
    ctx.lineTo(p.x-dir*sz*3.4,p.y+bob+sz*0.30+Math.sin(t*2+s.x)*sz*0.08);
    ctx.stroke();
    ctx.save(); ctx.translate(p.x,p.y+bob); ctx.scale(dir,1);
    ctx.rotate(Math.sin(t*0.9+s.x)*0.05);
    ctx.fillStyle='#2A4457';
    ctx.beginPath(); ctx.moveTo(-sz*0.85,0); ctx.quadraticCurveTo(0,sz*0.42,sz*0.85,0);
    ctx.lineTo(sz*0.62,-sz*0.14); ctx.lineTo(-sz*0.62,-sz*0.14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#22384A'; ctx.lineWidth=Math.max(1,sz*0.07);
    ctx.beginPath(); ctx.moveTo(0,-sz*0.14); ctx.lineTo(0,-sz*1.05); ctx.stroke();
    ctx.fillStyle='rgba(226,236,242,.88)';
    ctx.beginPath(); ctx.moveTo(sz*0.05,-sz*1.0);
    ctx.quadraticCurveTo(sz*0.62,-sz*0.5,sz*0.06,-sz*0.18); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha=1;
}
/* ---- 5. smoke from every roof ---- */
function drawChimneys(B,G,t){
  const S=view.scale, dt=Math.min(0.06,lastDt);
  if(S<26) return;
  for(const vid in G.buildings){
    const b=G.buildings[vid], v=B.verts[vid]; if(!v) continue;
    const p=toScreen(v.x,v.y);
    if(p.x<-60||p.x>CW+60||p.y<-60||p.y>CH+60) continue;
    let c=chimney[vid];
    if(!c){ c=chimney[vid]={puffs:[],emit:Math.random()*1.4}; }
    c.emit-=dt;
    const rate = b.t==='c'?0.62:1.15;
    if(c.emit<=0 && c.puffs.length<5){
      c.emit=rate*(0.7+Math.random()*0.7);
      c.puffs.push({x:0,y:0,vx:0.05+Math.random()*0.05,vy:-0.30-Math.random()*0.12,
        r:0.016+Math.random()*0.012,life:0,max:2.0+Math.random()*1.0,ph:Math.random()*TAU});
    }
    for(let i=c.puffs.length-1;i>=0;i--){
      const s=c.puffs[i]; s.life+=dt;
      if(s.life>s.max){ c.puffs.splice(i,1); continue; }
      const k=s.life/s.max;
      s.x+=s.vx*dt; s.y+=s.vy*dt;
      const wob=Math.sin(s.life*1.7+s.ph)*0.03;
      ctx.globalAlpha=(1-k)*0.30;
      ctx.fillStyle='#DCE6EC';
      ctx.beginPath();
      ctx.arc(p.x+(s.x+wob)*S, p.y-S*0.22+s.y*S, S*s.r*(1+k*2.8),0,TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha=1;
}
/* ---- 6. one warm light over the whole island ---- */
function drawLight(){
  const g=ctx.createRadialGradient(CW*0.24,CH*0.10,0,CW*0.24,CH*0.10,Math.max(CW,CH)*1.05);
  g.addColorStop(0,'rgba(255,228,168,.16)');
  g.addColorStop(0.42,'rgba(255,214,150,.05)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=g; ctx.fillRect(0,0,CW,CH);
  const v=ctx.createRadialGradient(CW*0.5,CH*0.48,Math.min(CW,CH)*0.34,CW*0.5,CH*0.5,Math.max(CW,CH)*0.80);
  v.addColorStop(0,'rgba(0,0,0,0)');
  v.addColorStop(1,'rgba(2,10,16,.42)');
  ctx.fillStyle=v; ctx.fillRect(0,0,CW,CH);
}
/* ---- 7. a hex wakes up when its number comes in ---- */
function wakeHex(id){ hexWake[id]=T; }
function wakeLift(id,t){
  const w=hexWake[id]; if(w==null) return 0;
  const k=(t-w)/1.25;
  if(k>=1){ delete hexWake[id]; return 0; }
  return Math.sin(k*Math.PI)*(1-k*0.3);
}

