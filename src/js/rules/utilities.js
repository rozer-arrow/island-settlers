
/* =========================================================
   0. UTILITIES
   ========================================================= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const TAU=Math.PI*2, SQ3=Math.sqrt(3);
const deepClone = o => JSON.parse(JSON.stringify(o));

/* deterministic PRNG — used for board layout so every device in a
   room derives an identical island from one shared seed. */
function mulberry32(a){ return function(){
  a|=0; a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; };}

/* true randomness for dice / shuffles that must be unpredictable */
const CR = window.crypto || window.msCrypto;
function trueRand(){
  if(CR && CR.getRandomValues){ const a=new Uint32Array(1); CR.getRandomValues(a); return a[0]/4294967296; }
  return Math.random();
}
/* unbiased integer in [0,n) via rejection sampling */
function randInt(n){
  if(!(CR&&CR.getRandomValues)) return Math.floor(Math.random()*n);
  const limit=Math.floor(4294967296/n)*n, a=new Uint32Array(1);
  let v; do{ CR.getRandomValues(a); v=a[0]; }while(v>=limit);
  return v%n;
}
function rollDie(){ return randInt(6)+1; }
function shuffleTrue(arr){ for(let i=arr.length-1;i>0;i--){const j=randInt(i+1);[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
function shuffleSeeded(arr,rnd){ for(let i=arr.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

