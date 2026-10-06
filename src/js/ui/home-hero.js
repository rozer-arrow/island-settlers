/* =========================================================
   11. HOME HERO ANIMATION
   ========================================================= */
let heroCv=null;
const HERO_HEX=[
  {id:'-1,0',q:-1,r:0,terrain:'pasture',num:8,...hexCenter(-1,0)},
  {id:'0,0', q:0, r:0,terrain:'fields', num:6,...hexCenter(0,0)},
  {id:'1,0', q:1, r:0,terrain:'forest', num:9,...hexCenter(1,0)}
];
const HERO_B={hexes:HERO_HEX,hexById:{}}; HERO_HEX.forEach(h=>HERO_B.hexById[h.id]=h);
const HERO_G={robber:null,buildings:{},roads:{}};
function renderHero(t){
  if(!heroCv) return;
  const r=heroCv.getBoundingClientRect();
  if(r.width<10||r.height<10) return;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  const w=Math.round(r.width*dpr), h=Math.round(r.height*dpr);
  if(heroCv.width!==w||heroCv.height!==h){ heroCv.width=w; heroCv.height=h; }
  const sc=ctx, sw=CW, sh=CH, ss=view.scale, sx=view.ox, sy=view.oy;
  ctx=heroCv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
  CW=r.width; CH=r.height;
  view.scale=Math.min(CW/5.6, CH/2.5);
  view.ox=CW/2; view.oy=CH/2;
  if(sky.for!=='hero') initSky({bounds:{minX:-2.6,maxX:2.6,minY:-1.2,maxY:1.2}},'hero');
  drawOcean(ECO?0:t);
  if(!ECO) drawSeaTraffic(t);
  drawTiles(HERO_B,t,HERO_G);
  drawCloudShadows(t);
  drawTokens(HERO_B,HERO_G,t);
  const S=view.scale;
  drawShip({x:CW*0.14,y:CH*0.82},{x:CW*0.14+S*0.8,y:CH*0.82},PCOLORS[1],S*0.8,t);
  drawClouds(t); if(!ECO) drawGulls(t); drawLight();
  ctx=sc; CW=sw; CH=sh; view.scale=ss; view.ox=sx; view.oy=sy;
}

