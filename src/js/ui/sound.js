/* =========================================================
   S. SOUND — everything synthesised, no files, no network
   ========================================================= */
const SFX = (function(){
  let AC=null, master=null, ambGain=null, started=false;
  let on = (ls('sisnd')!=='0');
  let ambNodes=[];
  let gullTimer=null;

  function ctxOk(){
    if(!on) return false;
    if(!AC){
      const C=window.AudioContext||window.webkitAudioContext;
      if(!C) return false;
      AC=new C();
      master=AC.createGain(); master.gain.value=0.9; master.connect(AC.destination);
      ambGain=AC.createGain(); ambGain.gain.value=0; ambGain.connect(master);
    }
    if(AC.state==='suspended') AC.resume();
    return true;
  }
  function noiseBuf(sec){
    const n=Math.floor(AC.sampleRate*sec), b=AC.createBuffer(1,n,AC.sampleRate), d=b.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    return b;
  }
  /* ---- one-shots ---- */
  function env(node,t0,a,d,peak){
    const g=AC.createGain();
    g.gain.setValueAtTime(0.0001,t0);
    g.gain.exponentialRampToValueAtTime(peak,t0+a);
    g.gain.exponentialRampToValueAtTime(0.0001,t0+a+d);
    node.connect(g); return g;
  }
  function tone(freq,t0,dur,type,peak,detune){
    const o=AC.createOscillator(); o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
    if(detune) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*detune),t0+dur);
    const g=env(o,t0,Math.min(0.02,dur*0.2),dur,peak||0.2);
    g.connect(master); o.start(t0); o.stop(t0+dur+0.08);
    return o;
  }
  function noise(t0,dur,f,q,peak,type){
    const s=AC.createBufferSource(); s.buffer=noiseBuf(Math.max(0.05,dur+0.05));
    const bp=AC.createBiquadFilter(); bp.type=type||'bandpass'; bp.frequency.value=f; bp.Q.value=q||1;
    s.connect(bp);
    const g=env(bp,t0,0.006,dur,peak||0.2); g.connect(master);
    s.start(t0); s.stop(t0+dur+0.08);
    return bp;
  }

  const api = {
    get enabled(){ return on; },
    toggle(){ on=!on; ls('sisnd',on?'1':'0');
      if(!on){ stopAmbient(); if(AC){ master.gain.value=0;
        /* once the sea has faded out, put the whole audio engine to sleep — a silent but
           running engine still keeps the device busy */
        setTimeout(()=>{ if(!on && AC && AC.state==='running' && AC.suspend) AC.suspend().catch(()=>{}); },700); } }
      else { if(ctxOk()){ master.gain.value=0.9; if(started) startAmbient(); } }
      return on; },
    unlock(){ if(ctxOk() && AC.state==='running'){ return true; } return false; },

    click(){ if(!ctxOk())return; const t=AC.currentTime; noise(t,0.035,2400,1.6,0.10); },
    tap(){ if(!ctxOk())return; const t=AC.currentTime; tone(880,t,0.05,'triangle',0.06); },

    dice(){ if(!ctxOk())return; const t=AC.currentTime;
      for(let i=0;i<7;i++){ const k=t+i*0.075*(1+i*0.11);
        noise(k,0.05,900+Math.random()*1200,3,0.16); tone(180+Math.random()*90,k,0.05,'square',0.05); }
    },
    diceLand(sum){ if(!ctxOk())return; const t=AC.currentTime;
      noise(t,0.10,420,1.4,0.26); tone(120,t,0.16,'sine',0.16,0.6);
      if(sum===7){ tone(98,t+0.06,0.5,'sawtooth',0.10,0.5); noise(t+0.06,0.5,240,0.8,0.10,'lowpass'); }
    },
    build(kind){ if(!ctxOk())return; const t=AC.currentTime;
      /* each piece gets its own shape: road = one hammer tap, settlement = a short two-note
         rise, city = a full four-note fanfare with a low thud, ship = a soft wooden splash */
      if(kind==='road'){ noise(t,0.07,700,2.2,0.22); tone(320,t,0.09,'triangle',0.10,0.8); }
      else if(kind==='ship'){ noise(t,0.22,500,0.9,0.16,'lowpass'); tone(260,t,0.20,'sine',0.09,1.4); }
      else if(kind==='city'){ [262,330,392,523].forEach((f,i)=>tone(f,t+i*0.055,0.28,'triangle',0.13));
        noise(t,0.12,300,1.2,0.18); tone(80,t,0.30,'sine',0.16,0.7); }
      else { [392,587].forEach((f,i)=>tone(f,t+i*0.075,0.24,'triangle',0.14)); noise(t,0.08,600,2,0.18); }
    },
    gain(){ if(!ctxOk())return; const t=AC.currentTime;
      [523,659,784].forEach((f,i)=>tone(f,t+i*0.045,0.20,'sine',0.085)); },
    coins(){ if(!ctxOk())return; const t=AC.currentTime;
      for(let i=0;i<4;i++) tone(1400+Math.random()*900,t+i*0.045,0.10,'triangle',0.075); },
    robber(){ if(!ctxOk())return; const t=AC.currentTime;
      tone(70,t,0.7,'sawtooth',0.13,1.5); noise(t,0.6,180,0.7,0.10,'lowpass'); },
    knight(){ if(!ctxOk())return; const t=AC.currentTime;
      tone(1320,t,0.35,'triangle',0.10); tone(1976,t+0.02,0.30,'sine',0.06); noise(t,0.10,3200,2,0.10); },
    drum(){ if(!ctxOk())return; const t=AC.currentTime;
      tone(58,t,0.55,'sine',0.26,0.55); noise(t,0.18,110,0.8,0.14,'lowpass'); },
    horn(){ if(!ctxOk())return; const t=AC.currentTime;
      [196,262].forEach((f,i)=>{ const o=AC.createOscillator(); o.type='sawtooth';
        o.frequency.setValueAtTime(f,t+i*0.16); const g=env(o,t+i*0.16,0.09,0.75,0.09);
        const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=900;
        g.connect(lp); lp.connect(master); o.start(t+i*0.16); o.stop(t+i*0.16+0.95); }); },
    bleat(){ if(!ctxOk())return; const t=AC.currentTime;
      const o=AC.createOscillator(); o.type='sawtooth'; o.frequency.setValueAtTime(420,t);
      const lfo=AC.createOscillator(); lfo.frequency.value=22;
      const lg=AC.createGain(); lg.gain.value=34; lfo.connect(lg); lg.connect(o.frequency);
      const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1500;
      const g=env(o,t,0.04,0.42,0.045); g.connect(lp); lp.connect(master);
      o.start(t); o.stop(t+0.5); lfo.start(t); lfo.stop(t+0.5); },
    gull(){ if(!ctxOk())return; const t=AC.currentTime;
      for(let i=0;i<3;i++){ const k=t+i*0.19;
        const o=AC.createOscillator(); o.type='triangle';
        o.frequency.setValueAtTime(1500,k); o.frequency.exponentialRampToValueAtTime(760,k+0.18);
        const g=env(o,k,0.03,0.17,0.035); g.connect(master); o.start(k); o.stop(k+0.25); } },
    buyCard(){ if(!ctxOk())return; const t=AC.currentTime;          /* buying a development card: a card slides off the deck */
      noise(t,0.16,1900,1.1,0.16,'bandpass');                       /* the paper slide */
      tone(520,t+0.10,0.10,'triangle',0.09);
      tone(780,t+0.17,0.14,'triangle',0.10); },
    plentyCard(){ if(!ctxOk())return; const t=AC.currentTime;      /* year of plenty: a card opens with a sparkle */
      [740,988,1318].forEach((f,i)=>tone(f,t+i*0.07,0.22,'sine',0.11));
      noise(t,0.12,3400,3,0.06); },
    monoCard(){ if(!ctxOk())return; const t=AC.currentTime;         /* monopoly: a card opens with a dramatic sweep */
      tone(180,t,0.30,'sawtooth',0.11,2.4); noise(t,0.28,700,1.1,0.10,'lowpass');
      tone(90,t+0.16,0.35,'sine',0.10,1.5); },
    roadCard(){ if(!ctxOk())return; const t=AC.currentTime;         /* road building: two quick construction beats */
      [0,0.16].forEach(o=>{ noise(t+o,0.06,650,2.2,0.20); tone(300,t+o,0.08,'triangle',0.09,0.8); }); },
    win(){ if(!ctxOk())return; const t=AC.currentTime;
      [523,659,784,1046,1318].forEach((f,i)=>{ tone(f,t+i*0.13,0.55,'triangle',0.15);
        tone(f/2,t+i*0.13,0.55,'sine',0.07); });
      noise(t+0.65,0.9,1800,0.6,0.07); },
    lose(){ if(!ctxOk())return; const t=AC.currentTime;
      [392,330,262].forEach((f,i)=>tone(f,t+i*0.15,0.4,'triangle',0.11)); },

    /* ---- looping sea + wind ---- */
    ambient(v){ if(!ctxOk())return; started=true;
      if(!ambNodes.length) startAmbient();
      ambGain.gain.setTargetAtTime(on?(v===undefined?0.16:v):0, AC.currentTime, 0.8); },
    stop(){ stopAmbient(); }
  };
  function startAmbient(){
    if(!ctxOk()||ambNodes.length) return;
    /* surf: looping noise through a slowly-swept lowpass */
    const s=AC.createBufferSource(); s.buffer=noiseBuf(4); s.loop=true;
    const lp=AC.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=520; lp.Q.value=0.6;
    const swell=AC.createGain(); swell.gain.value=0.55;
    const lfo=AC.createOscillator(); lfo.frequency.value=0.09;
    const lg=AC.createGain(); lg.gain.value=0.34;
    lfo.connect(lg); lg.connect(swell.gain);
    const lfo2=AC.createOscillator(); lfo2.frequency.value=0.037;
    const lg2=AC.createGain(); lg2.gain.value=260;
    lfo2.connect(lg2); lg2.connect(lp.frequency);
    s.connect(lp); lp.connect(swell); swell.connect(ambGain);
    /* low wind */
    const w=AC.createBufferSource(); w.buffer=noiseBuf(4); w.loop=true;
    const wf=AC.createBiquadFilter(); wf.type='bandpass'; wf.frequency.value=230; wf.Q.value=0.8;
    const wg=AC.createGain(); wg.gain.value=0.22;
    const wl=AC.createOscillator(); wl.frequency.value=0.055;
    const wlg=AC.createGain(); wlg.gain.value=0.14;
    wl.connect(wlg); wlg.connect(wg.gain);
    w.connect(wf); wf.connect(wg); wg.connect(ambGain);
    [s,w,lfo,lfo2,wl].forEach(n=>n.start());
    ambNodes=[s,w,lfo,lfo2,wl];
    clearInterval(gullTimer);
    gullTimer=setInterval(()=>{ if(on&&Math.random()<0.35) api.gull(); }, 9000);
  }
  function stopAmbient(){
    if(ambGain&&AC) ambGain.gain.setTargetAtTime(0,AC.currentTime,0.3);
    clearInterval(gullTimer); gullTimer=null;
    setTimeout(()=>{ ambNodes.forEach(n=>{try{n.stop();}catch(e){}}); ambNodes=[]; },600);
  }
  return api;
})();

