/* =========================================================
   THE FRAME — the hexagonal wooden-blue border of a Catan board,
   sitting on a dark table
   ========================================================= */
function framePath(B){
  const S=view.scale; ctx.beginPath();
  for(const h of B.frameHexes){
    const p=toScreen(h.x,h.y);
    for(let i=0;i<6;i++){
      const a=(Math.PI/180)*(60*i-30);
      const x=p.x+S*Math.cos(a), y=p.y+S*Math.sin(a);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.closePath();
  }
}
function drawTable(){
  const g=ctx.createRadialGradient(CW*0.5,CH*0.42,Math.min(CW,CH)*0.08,CW*0.5,CH*0.5,Math.max(CW,CH)*0.8);
  g.addColorStop(0,'#123A52'); g.addColorStop(0.6,'#0A2233'); g.addColorStop(1,'#040E16');
  ctx.fillStyle=g; ctx.fillRect(-30,-30,CW+60,CH+60);
  /* very faint felt grain so the table reads as a surface */
  ctx.globalAlpha=0.05; ctx.fillStyle='#9FD3EA';
  for(let i=0;i<70;i++){
    const x=((i*7919)%997)/997*CW, y=((i*104729)%991)/991*CH;
    ctx.fillRect(x,y,1.5,1.5);
  }
  ctx.globalAlpha=1;
}
function strokeFrame(B,widthMul,color,alpha,offY){
  const S=view.scale; ctx.beginPath();
  for(const e of B.frameEdges){
    const a=toScreen(e.ax,e.ay), b=toScreen(e.bx,e.by);
    ctx.moveTo(a.x,a.y+offY); ctx.lineTo(b.x,b.y+offY);
  }
  ctx.globalAlpha=alpha; ctx.strokeStyle=color; ctx.lineWidth=Math.max(1,S*widthMul);
  ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke(); ctx.globalAlpha=1;
}
function drawBoardBase(B,t){
  const S=view.scale;
  /* the board casts a shadow on the table */
  ctx.save(); ctx.translate(0,S*0.18); framePath(B);
  ctx.fillStyle='rgba(0,0,0,.5)'; ctx.fill(); ctx.restore();

  /* the sea, clipped to the frame */
  ctx.save(); framePath(B); ctx.clip();
  drawOcean(t);
  /* the outer ring of sea tiles reads as separate frame pieces */
  ctx.beginPath();
  for(const h of B.frameHexes){
    if(B.hexById[h.id]) continue;
    const p=toScreen(h.x,h.y);
    for(let i=0;i<6;i++){
      const a=(Math.PI/180)*(60*i-30);
      const x=p.x+S*Math.cos(a), y=p.y+S*Math.sin(a);
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    }
    ctx.closePath();
  }
  ctx.fillStyle='rgba(3,24,40,.34)'; ctx.fill();
  ctx.strokeStyle='rgba(190,232,248,.20)'; ctx.lineWidth=Math.max(1,S*0.022); ctx.stroke();
  ctx.restore();

  /* the raised, bevelled frame itself: a heavy blue band, lit from the top-left */
  strokeFrame(B,0.50,'#000',0.34,S*0.12);
  strokeFrame(B,0.42,'#04182A',1,0);
  strokeFrame(B,0.34,'#123F5E',1,0);
  strokeFrame(B,0.24,'#1A5A82',1,0);
  strokeFrame(B,0.075,'#3A86B4',0.75,-S*0.035);
  strokeFrame(B,0.022,'#A9D6EC',0.32,-S*0.05);
}

