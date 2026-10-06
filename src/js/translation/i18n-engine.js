
const I18N=(function(){
  const exact=new Map(), pats=[], frags=[];
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  I18N_PAIRS.forEach(([he,en])=>{
    if(he.indexOf('{}')>=0){
      const parts=he.split('{}');
      const w=parts.join('').length;
      pats.push({re:new RegExp('^'+parts.map(esc).join(w<4?'(\\S{1,12})':'([\\s\\S]*?)')+'$'),en,w});
    } else {
      exact.set(he,en);
      if(he.length>=4 || I18N_WORDS.indexOf(he)>=0) frags.push([he,en]);
    }
  });
  pats.sort((a,b)=>b.w-a.w); frags.sort((a,b)=>b[0].length-a[0].length);
  return {exact,pats,frags};
})();
const isHebLetter=ch=>!!ch && ch>='\u05D0' && ch<='\u05EA';
function i18nWordReplace(s,he,en){
  let out='', i=0, k;
  const short=he.length<4;
  while((k=s.indexOf(he,i))>=0){
    const before=s[k-1], after=s[k+he.length];
    if(isHebLetter(before) || (short && isHebLetter(after))){ out+=s.slice(i,k+he.length); i=k+he.length; continue; }
    const nx=s[k+he.length]; const gap=(nx && !/[\s.,:;!?)\]·—\-/]/.test(nx) && /[A-Za-z]$/.test(en)) ? ' ' : '';
    out+=s.slice(i,k)+en+gap; i=k+he.length;
  }
  return out+s.slice(i);
}
function i18nCore(c,d){
  const key=c.replace(/\s+/g,' ');
  if(I18N_ONLY_EXACT[key]) return I18N_ONLY_EXACT[key];
  const e=I18N.exact.get(key); if(e!==undefined) return e;
  for(const p of I18N.pats){
    const m=p.re.exec(key);
    if(m) return p.en.replace(/\{(\d)\}/g,(_,i)=>(d<3 && HEB_RE.test(m[+i]))?i18nCore(m[+i],d+1):m[+i]);
  }
  let out=key;
  for(const [he,en] of I18N.frags){ if(out.indexOf(he)>=0) out=i18nWordReplace(out,he,en); }
  return out;
}
/* translate a string (no-op in Hebrew mode) */
function trStr(s){
  if(LANG!=='en' || !s || !HEB_RE.test(s)) return s;
  const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  return m[1]+i18nCore(m[2],0)+m[3];
}

/* ---- DOM: translate text nodes and a few attributes, remembering the Hebrew original ---- */
const I18N_ORIG=new WeakMap();
const I18N_ATTRS=['title','aria-label','placeholder'];
function i18nText(n){
  const t=n.nodeValue; if(!t || !HEB_RE.test(t)) return;
  const r=trStr(t);
  if(r!==t){ if(!I18N_ORIG.has(n)) I18N_ORIG.set(n,t); n.nodeValue=r; }
}
function i18nAttrs(el){
  if(!el.getAttribute) return;
  I18N_ATTRS.forEach(a=>{
    const v=el.getAttribute(a);
    if(v && HEB_RE.test(v)){ const r=trStr(v); if(r!==v){ (el.__i18n=el.__i18n||{})[a]=v; el.setAttribute(a,r); } }
  });
}
function i18nTree(root){
  if(root.nodeType===3){ i18nText(root); return; }
  if(root.nodeType!==1 || /^(SCRIPT|STYLE|CANVAS)$/.test(root.tagName)) return;
  i18nAttrs(root);
  for(let n=root.firstChild;n;n=n.nextSibling) i18nTree(n);
}
function i18nRestore(root){
  if(root.nodeType===3){ const o=I18N_ORIG.get(root); if(o!==undefined){ root.nodeValue=o; I18N_ORIG.delete(root); } return; }
  if(root.nodeType!==1 || /^(SCRIPT|STYLE|CANVAS)$/.test(root.tagName)) return;
  if(root.__i18n){ for(const a in root.__i18n) root.setAttribute(a,root.__i18n[a]); root.__i18n=null; }
  for(let n=root.firstChild;n;n=n.nextSibling) i18nRestore(n);
}
let I18N_MO=null;
const I18N_OBS={childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:I18N_ATTRS};
function i18nWatch(on){
  if(!on){ if(I18N_MO){ I18N_MO.disconnect(); I18N_MO=null; } return; }
  if(I18N_MO || typeof MutationObserver==='undefined') return;
  I18N_MO=new MutationObserver(muts=>{
    if(LANG!=='en') return;
    I18N_MO.disconnect();
    for(const m of muts){
      if(m.type==='characterData') i18nText(m.target);
      else if(m.type==='childList') m.addedNodes.forEach(i18nTree);
      else if(m.type==='attributes') i18nAttrs(m.target);
    }
    I18N_MO.observe(document.body,I18N_OBS);
  });
  I18N_MO.observe(document.body,I18N_OBS);
}
function i18nSwapNames(toEn){
  if(typeof seats==='undefined') return;
  const from=toEn?DEFAULT_NAMES:DEFAULT_NAMES_EN, to=toEn?DEFAULT_NAMES_EN:DEFAULT_NAMES;
  seats.forEach(s=>{ const k=from.indexOf(s.name); if(k>=0) s.name=to[k]; });
  if($('#playersGrid') && typeof buildPlayersGrid==='function') buildPlayersGrid();
}
function setLang(l,boot){
  const en=(l==='en');
  LANG=en?'en':'he'; if(!boot) ls('silang',LANG);
  const de=document.documentElement; de.lang=LANG; de.dir=en?'ltr':'rtl';
  document.body.classList.toggle('en',en);
  i18nSwapNames(en);
  if(en){ i18nTree(document.body); i18nWatch(true); }
  else { i18nWatch(false); i18nRestore(document.body); }
  document.title=en?'Island Settlers':'אי המתיישבים';
  if(typeof CARD_ART!=='undefined') for(const k in CARD_ART) delete CARD_ART[k];
  $$('#langSw button').forEach(b=>b.classList.toggle('on',b.dataset.l===LANG));
  if(typeof ST!=='undefined' && ST.G){
    const nd=currentNeed(ST.G);
    drawStrip(); drawHand(); drawActions(nd); drawTurnPill(nd);
    if(isDesk()) fitNow();
  }
}

