/* =========================================================
   T&B variants: Harbourmaster + Event cards
   ========================================================= */
function harbourPoints(G,B,pIdx){
  let n=0;
  for(const vid in G.buildings){
    const b=G.buildings[vid]; if(b.p!==pIdx) continue;
    if(B.verts[vid] && B.verts[vid].port) n += (b.t==='c'?2:1);
  }
  return n;
}
function updateHarbour(G,B){
  if(!G.cfg.harbour) return;
  G.players.forEach(p=>p.harb=harbourPoints(G,B,p.idx));
  const cur=G.harbour ? G.harbour.p : -1;
  let best=0; G.players.forEach(p=>{ if(p.harb>best) best=p.harb; });
  if(best<3){ G.harbour={p:-1,n:best}; return; }
  if(cur>=0 && G.players[cur].harb>=best){ G.harbour={p:cur,n:G.players[cur].harb}; return; }
  const win=G.players.filter(p=>p.harb===best);
  if(win.length===1){
    if(win[0].idx!==cur) logit(G,`${win[0].name} הוא נמלאי ראשי (${best} נק׳ נמל)`);
    G.harbour={p:win[0].idx,n:best};
  } else G.harbour={p:cur>=0?cur:-1,n:best};
}
/* event cards replace the dice: the same 36 combinations, drawn without
   replacement, so long droughts and long streaks both get shorter */
function rollPair(G){
  /* tutorials script a roll or two so every lesson is reproducible */
  if(G.forced && G.forced.length) return G.forced.shift();
  if(!G.cfg.eventcards) return [rollDie(),rollDie()];
  if(!G.diceDeck || !G.diceDeck.length || (G.diceDrawn||0)>=30){
    G.diceDeck=[];
    for(let a=1;a<=6;a++) for(let b=1;b<=6;b++) G.diceDeck.push([a,b]);
    shuffleTrue(G.diceDeck); G.diceDrawn=0;
    logit(G,'חפיסת קלפי האירוע נטרפה מחדש');
  }
  G.diceDrawn=(G.diceDrawn||0)+1;
  return G.diceDeck.pop();
}

