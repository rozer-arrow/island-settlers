/* =========================================================
   4. ART — every tile, token and piece is painted in code
   ========================================================= */
const PAL = {
  forest:   {g:'#2E4C2B', g2:'#375A31', g3:'#223D20', rim:'#1B3319'},
  hills:    {g:'#A9613A', g2:'#BE7448', g3:'#8B4C2B', rim:'#6E3A1F'},
  pasture:  {g:'#7CAA40', g2:'#8FBE4E', g3:'#679436', rim:'#4E7327'},
  fields:   {g:'#C9A33C', g2:'#DFBB55', g3:'#A5812A', rim:'#7E621C'},
  mountains:{g:'#7B8694', g2:'#98A2AF', g3:'#5D6775', rim:'#454E5B'},
  desert:   {g:'#DCC188', g2:'#EBD7A7', g3:'#C6A96E', rim:'#A08B57'},
  gold:     {g:'#8E7A46', g2:'#A9924F', g3:'#6E5D33', rim:'#4F4223'}
};
PAL.desert.rim='#A08B57';

function hexPath(ctx,cx,cy,R){
  ctx.beginPath();
  for(let i=0;i<6;i++){
    const a=(Math.PI/180)*(60*i-30);
    const x=cx+R*Math.cos(a), y=cy+R*Math.sin(a);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.closePath();
}
function blob(ctx,x,y,r,rnd){
  ctx.beginPath();
  const n=7;
  for(let i=0;i<=n;i++){
    const a=i/n*TAU, rr=r*(0.72+rnd()*0.5);
    const px=x+Math.cos(a)*rr, py=y+Math.sin(a)*rr*0.72;
    i?ctx.lineTo(px,py):ctx.moveTo(px,py);
  }
  ctx.closePath(); ctx.fill();
}

/* ---- base tiles rendered once per terrain, reused by every hex ---- */
const tileCache = {};
function tileTexture(terrain, px){
  const key = terrain+'@'+px;
  if(tileCache[key]) return tileCache[key];
  const cv = document.createElement('canvas');
  cv.width=px; cv.height=px;
  const ctx=cv.getContext('2d');
  const R=px/2, cx=px/2, cy=px/2;
  const rnd=mulberry32(terrain.length*9173+px);
  ctx.save(); hexPath(ctx,cx,cy,R*0.999); ctx.clip();
  const P=PAL[terrain]||PAL.desert;
  ctx.fillStyle=P.g; ctx.fillRect(0,0,px,px);
  (({forest:paintForest,hills:paintHills,pasture:paintPasture,fields:paintFields,
     mountains:paintMountains,desert:paintDesert,gold:paintGold})[terrain]||paintDesert)(ctx,px,rnd,P);
  /* soft vignette so tiles read as separate pieces */
  const vg=ctx.createRadialGradient(cx,cy,R*0.45,cx,cy,R*1.02);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.34)');
  ctx.fillStyle=vg; ctx.fillRect(0,0,px,px);
  ctx.restore();
  /* rim */
  ctx.save(); hexPath(ctx,cx,cy,R*0.985);
  ctx.strokeStyle=P.rim; ctx.lineWidth=px*0.022; ctx.stroke();
  hexPath(ctx,cx,cy,R*0.94);
  ctx.strokeStyle='rgba(255,255,255,.10)'; ctx.lineWidth=px*0.012; ctx.stroke();
  ctx.restore();
  tileCache[key]=cv; return cv;
}

function softBlobs(ctx,px,rnd,cols,count,rmin,rmax){
  for(let i=0;i<count;i++){
    ctx.fillStyle=cols[i%cols.length];
    ctx.globalAlpha=0.35+rnd()*0.4;
    blob(ctx,rnd()*px,rnd()*px,px*(rmin+rnd()*(rmax-rmin)),rnd);
  }
  ctx.globalAlpha=1;
}

function paintForest(ctx,px,rnd,P){
  softBlobs(ctx,px,rnd,[P.g2,P.g3],9,0.10,0.22);
  /* mossy speckle */
  for(let i=0;i<150;i++){
    ctx.fillStyle=rnd()>.5?'rgba(255,255,255,.05)':'rgba(0,0,0,.09)';
    ctx.fillRect(rnd()*px,rnd()*px,px*0.012,px*0.012);
  }
  /* a couple of fallen logs */
  for(let i=0;i<3;i++){
    const x=px*(0.2+rnd()*0.6), y=px*(0.25+rnd()*0.55), l=px*0.13, a=rnd()*TAU;
    ctx.save(); ctx.translate(x,y); ctx.rotate(a);
    ctx.fillStyle='#4A3625'; ctx.fillRect(-l/2,-px*0.014,l,px*0.028);
    ctx.fillStyle='#6A5138'; ctx.fillRect(-l/2,-px*0.014,l,px*0.010);
    ctx.restore();
  }
}
function paintHills(ctx,px,rnd,P){
  softBlobs(ctx,px,rnd,[P.g2,P.g3],7,0.12,0.24);
  /* terraces */
  ctx.lineCap='round';
  for(let i=0;i<7;i++){
    const y=px*(0.16+i*0.10);
    ctx.beginPath();
    for(let x=-px*0.1;x<px*1.1;x+=px*0.05){
      const yy=y+Math.sin(x/px*5+i)*px*0.022;
      x<0?ctx.moveTo(x,yy):ctx.lineTo(x,yy);
    }
    ctx.strokeStyle= i%2 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.10)';
    ctx.lineWidth=px*0.022; ctx.stroke();
  }
  /* clay pit + kiln base */
  ctx.fillStyle='rgba(0,0,0,.18)';
  blob(ctx,px*0.33,px*0.66,px*0.13,rnd);
  ctx.fillStyle='#6D3A20';
  ctx.beginPath(); ctx.moveTo(px*0.62,px*0.70); ctx.lineTo(px*0.74,px*0.70);
  ctx.lineTo(px*0.715,px*0.55); ctx.lineTo(px*0.645,px*0.55); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#8C4E2B'; ctx.fillRect(px*0.645,px*0.545,px*0.07,px*0.02);
  /* stacked bricks */
  for(let i=0;i<9;i++){
    const bx=px*(0.16+ (i%3)*0.055), by=px*(0.80 - Math.floor(i/3)*0.045);
    ctx.fillStyle= i%2?'#B4653C':'#9A5230';
    ctx.fillRect(bx,by,px*0.048,px*0.034);
    ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=px*0.006;
    ctx.strokeRect(bx,by,px*0.048,px*0.034);
  }
}
function paintPasture(ctx,px,rnd,P){
  softBlobs(ctx,px,rnd,[P.g2,P.g3],10,0.10,0.24);
  /* grass tufts */
  ctx.lineCap='round';
  for(let i=0;i<190;i++){
    const x=rnd()*px, y=rnd()*px, h=px*(0.012+rnd()*0.022);
    ctx.strokeStyle= rnd()>.5?'rgba(255,255,255,.18)':'rgba(0,0,0,.14)';
    ctx.lineWidth=px*0.006;
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+(rnd()-0.5)*px*0.012,y-h); ctx.stroke();
  }
  /* wildflowers */
  for(let i=0;i<16;i++){
    const x=rnd()*px,y=rnd()*px;
    ctx.fillStyle= ['#F4E9A0','#F2A8C0','#EDEDED'][Math.floor(rnd()*3)];
    ctx.beginPath(); ctx.arc(x,y,px*0.008,0,TAU); ctx.fill();
  }
}
function paintFields(ctx,px,rnd,P){
  softBlobs(ctx,px,rnd,[P.g2,P.g3],6,0.12,0.26);
  /* ploughed furrows running with the rows of wheat */
  for(let i=-2;i<22;i++){
    const y=px*0.06*i;
    ctx.beginPath();
    for(let x=-px*0.1;x<px*1.1;x+=px*0.06){
      const yy=y+Math.sin(x/px*3.1+i*0.6)*px*0.010;
      x<0?ctx.moveTo(x,yy):ctx.lineTo(x,yy);
    }
    ctx.strokeStyle= 'rgba(120,88,20,.30)'; ctx.lineWidth=px*0.016; ctx.stroke();
  }
  ctx.fillStyle='rgba(0,0,0,.10)';
  blob(ctx,px*0.5,px*0.86,px*0.25,rnd);
}
function paintMountains(ctx,px,rnd,P){
  softBlobs(ctx,px,rnd,[P.g2,P.g3],6,0.14,0.26);
  /* three peaks with lit and shadowed faces */
  const peaks=[[0.28,0.72,0.30],[0.54,0.80,0.44],[0.76,0.70,0.26]];
  peaks.forEach(([bx,by,h],i)=>{
    const X=px*bx, Y=px*by, H=px*h, W=px*(h*0.95);
    ctx.beginPath(); ctx.moveTo(X-W,Y); ctx.lineTo(X,Y-H); ctx.lineTo(X+W,Y); ctx.closePath();
    ctx.fillStyle=P.g3; ctx.fill();
    ctx.beginPath(); ctx.moveTo(X,Y-H); ctx.lineTo(X+W,Y); ctx.lineTo(X+W*0.15,Y); ctx.closePath();
    ctx.fillStyle='rgba(255,255,255,.16)'; ctx.fill();
    /* snow */
    ctx.beginPath(); ctx.moveTo(X,Y-H);
    ctx.lineTo(X+W*0.30,Y-H*0.62); ctx.lineTo(X+W*0.16,Y-H*0.68);
    ctx.lineTo(X+W*0.02,Y-H*0.56); ctx.lineTo(X-W*0.14,Y-H*0.66);
    ctx.lineTo(X-W*0.30,Y-H*0.60); ctx.closePath();
    ctx.fillStyle='#E9F1F6'; ctx.fill();
  });
  /* ore veins */
  for(let i=0;i<8;i++){
    const x=px*(0.15+rnd()*0.7), y=px*(0.55+rnd()*0.35);
    ctx.save(); ctx.translate(x,y); ctx.rotate(rnd()*TAU);
    ctx.fillStyle='#39414D';
    ctx.beginPath(); ctx.ellipse(0,0,px*0.028,px*0.016,0,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(190,205,220,.55)';
    ctx.beginPath(); ctx.ellipse(-px*0.006,-px*0.004,px*0.012,px*0.007,0,0,TAU); ctx.fill();
    ctx.restore();
  }
}
function paintDesert(ctx,px,rnd,P){
  softBlobs(ctx,px,rnd,[P.g2,P.g3],8,0.12,0.26);
  /* dune ripples */
  for(let i=0;i<13;i++){
    const y=px*(0.08+i*0.072);
    ctx.beginPath();
    for(let x=-px*0.1;x<px*1.1;x+=px*0.04){
      const yy=y+Math.sin(x/px*4.4+i*1.1)*px*0.028;
      x<0?ctx.moveTo(x,yy):ctx.lineTo(x,yy);
    }
    ctx.strokeStyle= i%2?'rgba(255,255,255,.22)':'rgba(150,115,60,.22)';
    ctx.lineWidth=px*0.013; ctx.stroke();
  }
  /* cactus */
  const cx0=px*0.68, cy0=px*0.66;
  ctx.strokeStyle='#4E7A44'; ctx.lineCap='round'; ctx.lineWidth=px*0.042;
  ctx.beginPath(); ctx.moveTo(cx0,cy0); ctx.lineTo(cx0,cy0-px*0.17); ctx.stroke();
  ctx.lineWidth=px*0.028;
  ctx.beginPath(); ctx.moveTo(cx0,cy0-px*0.07); ctx.lineTo(cx0-px*0.055,cy0-px*0.07);
  ctx.lineTo(cx0-px*0.055,cy0-px*0.115); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx0,cy0-px*0.11); ctx.lineTo(cx0+px*0.05,cy0-px*0.11);
  ctx.lineTo(cx0+px*0.05,cy0-px*0.15); ctx.stroke();
  /* bleached stones */
  for(let i=0;i<9;i++){
    const x=rnd()*px,y=px*(0.3+rnd()*0.6);
    ctx.fillStyle='rgba(120,95,55,.35)';
    ctx.beginPath(); ctx.ellipse(x,y,px*0.018,px*0.011,rnd(),0,TAU); ctx.fill();
  }
}
function paintGold(ctx,px,rnd,P){
  softBlobs(ctx,px,rnd,[P.g2,P.g3],7,0.12,0.24);
  /* quartz veins carrying gold */
  for(let i=0;i<6;i++){
    ctx.beginPath();
    let x=rnd()*px, y=rnd()*px; ctx.moveTo(x,y);
    for(let k=0;k<5;k++){ x+=(rnd()-0.5)*px*0.3; y+=(rnd()-0.5)*px*0.3; ctx.lineTo(x,y); }
    ctx.strokeStyle='rgba(244,205,90,.55)'; ctx.lineWidth=px*(0.010+rnd()*0.014);
    ctx.lineJoin='round'; ctx.stroke();
  }
  for(let i=0;i<22;i++){
    const x=rnd()*px,y=rnd()*px,r=px*(0.008+rnd()*0.014);
    ctx.fillStyle='#F3CB4E'; ctx.beginPath(); ctx.arc(x,y,r,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(x-r*0.3,y-r*0.3,r*0.35,0,TAU); ctx.fill();
  }
}

/* ---- small resource icons used on cards and ports ---- */
function drawResIcon(ctx,res,x,y,s){
  ctx.save(); ctx.translate(x,y);
  if(res==='wood'){
    ctx.fillStyle='#5B3F26';
    ctx.beginPath(); ctx.ellipse(0,s*0.18,s*0.42,s*0.16,0,0,TAU); ctx.fill();
    ctx.fillStyle='#2F6B38';
    ctx.beginPath(); ctx.moveTo(0,-s*0.52); ctx.lineTo(s*0.36,s*0.10); ctx.lineTo(-s*0.36,s*0.10); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#3E8A48';
    ctx.beginPath(); ctx.moveTo(0,-s*0.52); ctx.lineTo(s*0.36,s*0.10); ctx.lineTo(0,s*0.10); ctx.closePath(); ctx.fill();
  } else if(res==='brick'){
    for(let r=0;r<3;r++) for(let c=0;c<2;c++){
      const bw=s*0.40,bh=s*0.22;
      const ox=(r%2? -s*0.10: s*0.10)+ (c-0.5)*bw*1.06;
      ctx.fillStyle= (r+c)%2?'#B4653C':'#9E5330';
      ctx.fillRect(ox-bw/2,-s*0.36+r*bh*1.08,bw,bh);
      ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=s*0.02;
      ctx.strokeRect(ox-bw/2,-s*0.36+r*bh*1.08,bw,bh);
    }
  } else if(res==='sheep'){
    ctx.fillStyle='#F3F1EA';
    for(const [dx,dy,r] of [[-0.22,0,0.24],[0.02,-0.10,0.27],[0.22,0.04,0.22],[0,0.14,0.24]])
      { ctx.beginPath(); ctx.arc(dx*s,dy*s,r*s,0,TAU); ctx.fill(); }
    ctx.fillStyle='#3A3A3A';
    ctx.beginPath(); ctx.ellipse(s*0.34,s*0.02,s*0.13,s*0.11,0,0,TAU); ctx.fill();
    ctx.fillStyle='#2A2A2A';
    ctx.fillRect(-s*0.2,s*0.26,s*0.06,s*0.16); ctx.fillRect(s*0.12,s*0.26,s*0.06,s*0.16);
  } else if(res==='wheat'){
    ctx.strokeStyle='#8C6A1E'; ctx.lineWidth=s*0.05; ctx.lineCap='round';
    for(const dx of [-0.22,0,0.22]){
      ctx.beginPath(); ctx.moveTo(dx*s,s*0.45); ctx.quadraticCurveTo(dx*s*1.2,0,dx*s*1.3,-s*0.18); ctx.stroke();
    }
    ctx.fillStyle='#E8C255';
    for(const dx of [-0.22,0,0.22]) for(let k=0;k<4;k++){
      ctx.save(); ctx.translate(dx*s*1.3,-s*0.18+k*s*0.13);
      ctx.beginPath(); ctx.ellipse(0,0,s*0.09,s*0.055,-0.5,0,TAU); ctx.fill(); ctx.restore();
    }
  } else if(res==='ore'){
    ctx.fillStyle='#6E7885';
    ctx.beginPath(); ctx.moveTo(-s*0.42,s*0.30); ctx.lineTo(-s*0.18,-s*0.34); ctx.lineTo(s*0.20,-s*0.20);
    ctx.lineTo(s*0.42,s*0.30); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#98A3B0';
    ctx.beginPath(); ctx.moveTo(-s*0.18,-s*0.34); ctx.lineTo(s*0.20,-s*0.20); ctx.lineTo(s*0.02,s*0.30);
    ctx.lineTo(-s*0.42,s*0.30); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(-s*0.10,-s*0.05,s*0.09,s*0.05,-0.4,0,TAU); ctx.fill();
  } else if(res==='any'){
    ctx.strokeStyle='#E9DFC6'; ctx.lineWidth=s*0.10; ctx.lineCap='round';
    ctx.beginPath(); ctx.arc(0,0,s*0.30,0,TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,-s*0.42); ctx.lineTo(0,s*0.42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s*0.42,0); ctx.lineTo(s*0.42,0); ctx.stroke();
  } else if(res==='gold'){
    ctx.fillStyle='#F0C544';
    ctx.beginPath(); ctx.arc(0,0,s*0.36,0,TAU); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.75)';
    ctx.beginPath(); ctx.arc(-s*0.12,-s*0.12,s*0.12,0,TAU); ctx.fill();
  }
  ctx.restore();
}
const RES_BG = {wood:['#3E7A45','#1F4A28'],brick:['#C1764C','#7E3C1F'],sheep:['#BFD87E','#6E9440'],
  wheat:['#EED37A','#B08A24'],ore:['#A9B3C0','#5D6774'],gold:['#F5D66B','#B08A1C'],any:['#CDBE97','#7C6B42']};

